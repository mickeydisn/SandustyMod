/**
 * Field factories shared by every object definition.
 *
 * Nearly every tab opens with an id, a name and a description, and nearly every
 * tab ends with the passthrough box. Those are the same three fields 24 times
 * over, so they are written once here. What is *not* here is anything specific
 * to one object — a structure's 4×4 shape, an element's colour variants. Those
 * live in the definition that owns them, because a helper named after the thing
 * it is for is one nobody moves when that thing changes.
 */
import { MOD_ID } from "../../constants.ts";
import type { FieldSpec } from "./types.ts";

export const ID_PATTERN = "^[a-z0-9][a-z0-9._-]{0,62}$";
export const ID_MSG = "lowercase letters, digits, . _ - (max 63)";

export const SPRITE_ID_PATTERN =
    "^[a-z0-9][a-z0-9._-]{0,62}(:[a-z0-9][a-z0-9._-]{0,62})?$";
export const SPRITE_ID_MSG = "key, or namespace:key — e.g. sprites:crusher";

export const NAME_MAX = 64;
export const DESC_MAX = 200;

/** The mod-namespaced id field, stored as `md-my-hown-mod:<suffix>`. */
export function idField(): FieldSpec {
    return {
        key: "idSuffix", label: "Id", kind: "text", section: "Identity", required: true,
        pattern: ID_PATTERN, patternMsg: ID_MSG,
        hint: `stored as ${MOD_ID}:<id>`,
        placeholder: "my-thing",
    };
}

/**
 * Sprite ids are engine graphics keys ("sprites:crusher"), not mod-namespaced
 * ids — so this field accepts an optional "namespace:key" and is stored verbatim.
 */
export function spriteIdField(): FieldSpec {
    return {
        key: "idSuffix", label: "Graphics key", kind: "text", section: "Identity", required: true,
        pattern: SPRITE_ID_PATTERN, patternMsg: SPRITE_ID_MSG,
        hint: "used by render.imageName / item.sprite",
        placeholder: "sprites:crusher",
    };
}

/**
 * The form key that carries every stored field the form has no control for.
 *
 * Named rather than spelled out because three places have to agree on it: the
 * field that declares it, the panel that decides whether to show its section,
 * and the label that names what is being carried.
 */
export const PASSTHROUGH_KEY = "advancedJson";

/**
 * The stored keys a passthrough blob is carrying, or `[]` when it carries none.
 *
 * Takes the raw textarea text rather than a parsed object, because that is what
 * the panel has at hand on every render — and a render must never throw. So
 * anything that is not a JSON *object* reads as carrying nothing: an empty box
 * (`""` is what a form saves for "not set"), a half-typed value, an array, a
 * bare number, `null`. Showing a count of keys for a value that cannot be
 * merged would be claiming a guarantee the save path does not make.
 */
export function passthroughKeysOf(raw: string | undefined): string[] {
    const text = (raw ?? "").trim();
    if (text === "") return [];
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return []; // mid-edit or hand-typed nonsense — not a carried object yet
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return [];
    return Object.keys(parsed as Record<string, unknown>).sort();
}

/**
 * The passthrough box, and the only place the panel asks a user to hand-write
 * engine JSON.
 *
 * It is deliberately last: the normal path is a form control, and this exists
 * for the fields the form does not have. It says so on its face — the names
 * being carried, and an explicit note that typing here is a last resort —
 * because the old label ("Extra fields (JSON)") read like an authoring field
 * and invited people to put things there that the form would then fight over.
 *
 * It is also **conditional**, which is the part that is easy to get wrong in
 * both directions. Shown always, it is twelve copies of a box whose own hint
 * says "you do not need to touch this". Never shown, you cannot tell "nothing
 * is hidden" from "my fields are gone" — exactly the moment you need to know.
 * So it appears when it has something in it, and names it.
 */
export function advField(): FieldSpec {
    return {
        key: PASSTHROUGH_KEY,
        label: "Fields this form does not show",
        kind: "json",
        section: "Advanced",
        jsonType: "object",
        wide: true,
        when: (f) => passthroughKeysOf(f[PASSTHROUGH_KEY]).length > 0,
        hint:
            "Carried through on every edit, so nothing is lost. These keys have no " +
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

/**
 * Decide whether a library pick may overwrite a companion field (e.g. the
 * graphics key auto-derived from a picked asset).
 *
 * Returns the value to store, or `null` to leave the field alone. A hand-typed
 * value is never clobbered: we only write when the field is empty or still holds
 * the value we ourselves generated on a previous pick (`lastAuto`).
 */
export function resolveAutoFill(
    current: string | undefined,
    lastAuto: string | undefined,
    derived: string,
): string | null {
    const cur = current ?? "";
    if (cur !== "" && cur !== (lastAuto ?? "")) return null;
    return derived;
}

/** Graphics key auto-derived from a bundled asset name, e.g. "icon-alien" → "sprites:icon-alien". */
export function autoGraphicsKey(assetName: string): string {
    return `sprites:${assetName}`;
}
