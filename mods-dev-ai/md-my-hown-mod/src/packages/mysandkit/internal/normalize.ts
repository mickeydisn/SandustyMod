import { LOG } from "../../../constants.ts";
import { i18n } from "../api/i18n.ts";
import type { ElementConfig, ItemConfig, StructureConfig } from "../types.ts";
import { resolveMatterType, variantFromMetaColor } from "./matter.ts";
import { isConsumableType, resolveItemType } from "./refs.ts";

function registerI18n(map: Record<string, string>) {
    if (Object.keys(map).length) i18n.register("en", map);
}

export function normalizeElementPatch(
    entry: Partial<ElementConfig> & Record<string, unknown>,
): Record<string, unknown> {
    const out: Record<string, unknown> = { ...entry };
    const mt = resolveMatterType(entry.matterType);
    if (mt !== undefined) out.matterType = mt;
    const rawColors = entry.colors;
    const rawVariants = Array.isArray(rawColors) ? rawColors : rawColors?.variants;
    if (Array.isArray(rawVariants) && rawVariants.length > 0) {
        out.colors = Array.isArray(rawColors)
            ? { variants: rawVariants }
            : { ...rawColors, variants: rawVariants };
    } else if (entry.metaColor !== undefined) {
        out.colors = { variants: [variantFromMetaColor(entry.metaColor)] };
    }
    if (typeof entry.getExtraProps !== "function") delete out.getExtraProps;
    return out;
}

export function normalizeElement(def: ElementConfig): Record<string, unknown> {
    const id = String(def.id);
    const name = def.name ?? id;
    const nameKey = def.nameKey ?? `elements|${id}|name`;
    const out: Record<string, unknown> = { ...def, id, name, nameKey };
    const mt = resolveMatterType(def.matterType);
    if (mt !== undefined) out.matterType = mt;

    const rawColors = def.colors;
    const rawVariants = Array.isArray(rawColors) ? rawColors : rawColors?.variants;
    if (Array.isArray(rawVariants) && rawVariants.length > 0) {
        out.colors = Array.isArray(rawColors)
            ? { variants: rawVariants }
            : { ...rawColors, variants: rawVariants };
    } else {
        out.colors = Array.isArray(rawColors) || !rawColors
            ? { variants: [variantFromMetaColor(def.metaColor)] }
            : { ...rawColors, variants: [variantFromMetaColor(def.metaColor)] };
    }
    if (typeof def.getExtraProps !== "function") delete out.getExtraProps;
    if (def.description && !def.descriptionKey) {
        out.descriptionKey = `elements|${id}|description`;
    }
    const i18n: Record<string, string> = {};
    if (typeof name === "string") i18n[nameKey] = name;
    if (typeof def.description === "string") i18n[String(out.descriptionKey)] = def.description;
    registerI18n(i18n);
    return out;
}
export function normalizeStructure(def: StructureConfig): Record<string, unknown> & {
    registerOptions?: { useRawShape?: boolean };
} {
    const id = String(def.id);
    const name = def.name ?? id;
    const nameKey = def.nameKey ?? `structures|${id}|name`;
    const out: Record<string, unknown> = {
        ...def,
        id,
        name,
        nameKey,
        categoryKey: def.categoryKey ?? "blocks",
        buildModes: def.buildModes ?? [{ type: "single" }],
        variants: def.variants ?? [{ id, angles: [0] }],
    };
    if (typeof def.draw !== "function") delete out.draw;
    if (def.description && !def.descriptionKey) {
        out.descriptionKey = `structures|${id}|description`;
    }
    const i18n: Record<string, string> = {};
    if (typeof name === "string") i18n[nameKey] = name;
    if (typeof def.description === "string") i18n[String(out.descriptionKey)] = def.description;
    registerI18n(i18n);
    const registerOptions = def.registerOptions;
    delete out.registerOptions;
    return { ...out, registerOptions };
}

export interface CompiledItemAction {
    fn: unknown;
    skipped: string[];
    source:
        | { kind: "none" }
        | { kind: "process"; id: string };
}

let compileItemAction: ((def: Record<string, unknown>) => CompiledItemAction) | null = null;

export function setItemActionCompiler(
    fn: (def: Record<string, unknown>) => CompiledItemAction,
): void {
    compileItemAction = fn;
}

export function normalizeItem(def: ItemConfig): Record<string, unknown> {
    const id = String(def.id);
    const name = def.name ?? id;
    const nameKey = def.nameKey ?? `items|${id}|name`;
    const itemType = resolveItemType(def.itemType ?? def.type);
    const isConsumable = isConsumableType(def.itemType ?? def.type);
    const out: Record<string, unknown> = { ...def, id, name, nameKey, itemType, type: itemType };
    if (!out.sprite || typeof out.sprite !== "object" || !(out.sprite as any).id) {
        out.sprite = {
            id: `${id}-sprite`,
            type: (def.sprite as any)?.type ?? "onehand",
            ...(typeof def.sprite === "object" ? def.sprite : {}),
        };
        if (!(out.sprite as any).id) (out.sprite as any).id = `${id}-sprite`;
    }
    if (def.description && !def.descriptionKey) {
        out.descriptionKey = `items|${id}|description`;
    }

    if (!compileItemAction) {
        throw new Error(
            `${LOG} items.register needs the process compiler; nothing called ` +
                `setItemActionCompiler. Import packages/mysandkit.ts before registering.`,
        );
    }
    const compiled = compileItemAction(def as Record<string, unknown>);
    if (compiled.source.kind !== "none" && !isConsumable) {
        if (compiled.skipped.length) {
            console.warn(
                `[md-my-hown-mod] item ${id}: unknown action ${compiled.skipped.join(", ")}`,
            );
        }
        out.handleAction = compiled.fn as never;

        if (compiled.source.kind === "process") out.processId = compiled.source.id;
        out.options = {
            ...(typeof def.options === "object" ? def.options : {}),
            itemId: id,
            itemType: def.itemType ?? "Mod",
        };
    } else {
        for (const k of ["actions", "handlerKey", "onUpgradeKey"]) delete out[k];
        delete out.options;
    }

    const i18n: Record<string, string> = {};
    if (typeof name === "string") i18n[nameKey] = name;
    if (typeof def.description === "string") i18n[String(out.descriptionKey)] = def.description;
    registerI18n(i18n);
    return out;
}
