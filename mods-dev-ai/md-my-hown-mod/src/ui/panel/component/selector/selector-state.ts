

import type { Opt } from "../../../../catalog.ts";
import { OWN_ID_PREFIXES } from "../../../../constants.ts";


export type SelectorOwner = "own" | "game" | "all";


export interface SelectorItem {
    value: string;
    label: string;
    color?: string;
    
    own: boolean;
    
    modId?: string;
    
    hidden?: boolean;
}


export function classifyId(id: string): { own: boolean; modId?: string } {
    const dot = id.indexOf(".");
    if (dot <= 0) return { own: false };
    const modId = id.slice(0, dot);
    return { own: OWN_ID_PREFIXES.includes(modId), modId };
}


export function toSelectorItems(opts: readonly Opt[]): SelectorItem[] {
    return opts.map((o) => {
        const fromId = classifyId(o.value);
        const own = fromId.own || o.source === "mod";
        return {
            value: o.value,
            label: o.label,
            color: o.color,
            own,
            modId: own ? undefined : fromId.modId,
            hidden: o.hidden === true,
        };
    });
}


export function filterHidden(
    items: readonly SelectorItem[],
    showHidden: boolean,
): SelectorItem[] {
    if (showHidden) return [...items];
    return items.filter((i) => !i.hidden);
}


export function countHidden(items: readonly SelectorItem[]): number {
    let n = 0;
    for (const i of items) if (i.hidden) n++;
    return n;
}


export function filterByOwner(
    items: readonly SelectorItem[],
    owner: SelectorOwner,
): SelectorItem[] {
    if (owner === "all") return [...items];
    if (owner === "own") return items.filter((i) => i.own);
    return items.filter((i) => !i.own && !i.modId);
}


export function filterByText(
    items: readonly SelectorItem[],
    text: string,
): SelectorItem[] {
    const q = text.trim().toLowerCase();
    if (!q) return [...items];
    return items.filter((i) => `${i.value} ${i.label}`.toLowerCase().includes(q));
}


export function countByOwner(items: readonly SelectorItem[]): Record<SelectorOwner, number> {
    const out: Record<SelectorOwner, number> = { own: 0, game: 0, all: 0 };
    for (const i of items) {
        out.all++;
        if (i.own) out.own++;
        else if (!i.modId) out.game++;
    }
    return out;
}


export function otherMods(items: readonly SelectorItem[]): string[] {
    const seen = new Set<string>();
    for (const i of items) if (!i.own && i.modId) seen.add(i.modId);
    return [...seen].sort();
}


export function applyChoice(
    current: readonly string[],
    value: string,
    multiple: boolean,
    order: readonly string[],
): string[] {
    if (!multiple) return [value];
    const set = new Set(current);
    if (set.has(value)) set.delete(value);
    else set.add(value);
    return order.filter((v) => set.has(v));
}


export function orphans(selected: readonly string[], items: readonly SelectorItem[]): string[] {
    const known = new Set(items.map((i) => i.value));
    return selected.filter((v) => v && v !== "__none__" && !known.has(v));
}
