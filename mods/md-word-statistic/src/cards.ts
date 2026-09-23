/**
 * Editable Home cards — config persisted in mod storage.
 *
 * First item on a card is the primary: larger number + drives text/border color.
 */
import { api, safe } from "./api.ts";
import { MOD_ID } from "./constants.ts";
import type { CardItemKind, CardItemRef, HomeCardConfig } from "./types.ts";

export const CARDS_STORE_KEY = "homeCards";

/**
 * Default cards. Item ids use the engine's lowercase forms from the vanilla
 * catalogue (see astro-seeds keys comment: water, gold, wetsand, sand, …).
 * Matching is alias-tolerant at count time.
 */
export const DEFAULT_CARDS: HomeCardConfig[] = [
    {
        id: "card-gold",
        title: "Gold",
        items: [
            { kind: "element", id: "gold" },
            { kind: "element", id: "liquidgold" },
        ],
    },
    {
        id: "card-sand",
        title: "Dirt / Sand",
        items: [
            { kind: "terrain", id: "dirt" },
            { kind: "element", id: "sand" },
            { kind: "element", id: "wetsand" },
        ],
    },
    {
        id: "card-water",
        title: "Water",
        items: [
            { kind: "element", id: "water" },
        ],
    },
];

function isValidItem(it: unknown): it is CardItemRef {
    if (!it || typeof it !== "object") return false;
    const o = it as Record<string, unknown>;
    const kind = o.kind;
    const id = o.id;
    if (kind !== "element" && kind !== "terrain" && kind !== "structure") return false;
    if (typeof id !== "string" || !id.trim()) return false;
    return true;
}

function isValidCard(c: unknown): c is HomeCardConfig {
    if (!c || typeof c !== "object") return false;
    const o = c as Record<string, unknown>;
    if (typeof o.id !== "string" || !o.id) return false;
    if (typeof o.title !== "string") return false;
    if (!Array.isArray(o.items) || !o.items.every(isValidItem)) return false;
    return true;
}

/** Load cards from mod storage, or defaults when missing/invalid. */
export function loadCards(): HomeCardConfig[] {
    const raw = safe(() => api.storage.get(MOD_ID, CARDS_STORE_KEY));
    if (Array.isArray(raw) && raw.length > 0 && raw.every(isValidCard)) {
        return raw.map((c) => ({
            id: c.id,
            title: c.title,
            items: c.items.map((it) => ({
                kind: it.kind as CardItemKind,
                id: String(it.id).trim(),
            })),
        }));
    }
    return DEFAULT_CARDS.map((c) => ({
        id: c.id,
        title: c.title,
        items: c.items.map((it) => ({ ...it })),
    }));
}

export function saveCards(cards: HomeCardConfig[]): void {
    safe(() => api.storage.set(MOD_ID, CARDS_STORE_KEY, cards));
}

export function newCardId(): string {
    return `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyCard(): HomeCardConfig {
    return {
        id: newCardId(),
        title: "New card",
        items: [],
    };
}
