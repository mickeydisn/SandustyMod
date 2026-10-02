import { listElements } from "../../catalog.ts";
import { MOD_ID } from "../../constants.ts";
import { HANDLER_TYPE_LABELS, handlerTypesForKeys } from "../../handler/index.ts";
import type { Opt } from "../../catalog.ts";
import type { FieldSpec } from "./types.ts";

export function typesHintFor(pick: () => Opt[]): string {
    const types = handlerTypesForKeys(pick().map((o) => o.value));
    if (types.length === 0) {
        return "No handler serves this slot.";
    }
    return `Accepts: ${types.map((t) => HANDLER_TYPE_LABELS[t]).join(", ")}.`;
}

export const ID_PATTERN = "^[a-z0-9][a-z0-9._-]{0,62}$";
export const ID_MSG = "lowercase letters, digits, . _ - (max 63)";

export const SPRITE_ID_PATTERN = "^[a-z0-9][a-z0-9._-]{0,62}(:[a-z0-9][a-z0-9._-]{0,62})?$";
export const SPRITE_ID_MSG = "key, or namespace:key — e.g. sprites:crusher";

export const NAME_MAX = 64;
export const DESC_MAX = 200;

export function idField(): FieldSpec {
    return {
        key: "idSuffix",
        label: "Id",
        kind: "text",
        section: "Identity",
        required: true,
        pattern: ID_PATTERN,
        patternMsg: ID_MSG,
        hint: `stored as ${MOD_ID}:<id>`,
        placeholder: "my-thing",
    };
}

export function spriteIdField(): FieldSpec {
    return {
        key: "idSuffix",
        label: "Graphics key",
        kind: "text",
        section: "Identity",
        required: true,
        pattern: SPRITE_ID_PATTERN,
        patternMsg: SPRITE_ID_MSG,
        hint: "used by render.imageName / item.sprite",
        placeholder: "sprites:crusher",
    };
}

export const PASSTHROUGH_KEY = "advancedJson";

export function passthroughKeysOf(raw: string | undefined): string[] {
    const text = (raw ?? "").trim();
    if (text === "") return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return [];
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    return Object.keys(parsed as Record<string, unknown>).sort();
}

export function advField(): FieldSpec {
    return {
        key: PASSTHROUGH_KEY,
        label: "Fields this form does not show",
        kind: "json",
        section: "Advanced",
        jsonType: "object",
        wide: true,
        when: (f) => passthroughKeysOf(f[PASSTHROUGH_KEY]).length > 0,
        hint: "Carried through on every edit, so nothing is lost. These keys have no " +
            "control above. Change one only if you know what the engine expects — a " +
            "misspelled key here is ignored by the game and will not warn you.",
        placeholder: "{ }",
    };
}

export function boolField(
    key: string,
    label: string,
    section: string,
    def = "false",
    hint?: string,
): FieldSpec {
    return { key, label, kind: "bool", section, def, hint };
}

export function textField(
    key: string,
    label: string,
    section: string,
    required = false,
    extra: Partial<FieldSpec> = {},
): FieldSpec {
    return { key, label, kind: "text", section, required, maxLength: DESC_MAX, ...extra };
}

export function numField(
    key: string,
    label: string,
    section: string,
    extra: Partial<FieldSpec> = {},
): FieldSpec {
    return { key, label, kind: "number", section, step: 1, int: true, ...extra };
}

export function elSelect(
    key: string,
    label: string,
    section: string,
    required = false,
    hint?: string,
): FieldSpec {
    return { key, label, kind: "select", section, required, options: listElements, hint };
}

export function resolveAutoFill(
    current: string | undefined,
    lastAuto: string | undefined,
    derived: string,
): string | null {
    const cur = current ?? "";
    if (cur !== "" && cur !== (lastAuto ?? "")) return null;
    return derived;
}

export function autoGraphicsKey(assetName: string): string {
    return `sprites:${assetName}`;
}
