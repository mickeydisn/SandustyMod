/**
 * Editable Home cards — config persisted in mod storage.
 *
 * First item on a card is the primary: larger number + drives text/border color.
 */
import { api, safe } from "@sandmd/ui";
import { LOG, MOD_ID } from "./constants.ts";
import { listCataloguesForPicker } from "./data.ts";
import type { CardItemKind, CardItemRef, HomeCardConfig } from "./types.ts";

export const CARDS_STORE_KEY = "homeCards";
/**
 * Written by older versions, which seeded the default cards into storage on
 * first load. `loadCards` no longer writes anything, so nothing creates this
 * key any more — it stays listed in {@link allCardStorageKeys} so the disable
 * wipe still clears it from existing saves.
 */
export const CARDS_SEEDED_KEY = "homeCardsSeeded";

/** Desired default layout (ids resolved against live catalogue on first seed). */
const DEFAULT_SPEC: {
    id: string;
    title: string;
    items: { kind: CardItemKind; id: string; aliases?: string[] }[];
}[] = [
    {
        id: "card-gold",
        title: "Gold",
        items: [
            { kind: "element", id: "gold", aliases: ["gold", "Gold"] },
        ],
    },
    {
        id: "card-sand",
        title: "Sand",
        items: [
            { kind: "terrain", id: "dirt", aliases: ["dirt", "Dirt", "2"] },
            { kind: "element", id: "sand", aliases: ["sand", "Sand"] },
            {
                kind: "element",
                id: "wetsand",
                aliases: ["wetsand", "wetSand", "wet_sand", "Wet Sand"],
            },
        ],
    },
    {
        id: "card-water",
        title: "Water",
        items: [
            { kind: "element", id: "water", aliases: ["water", "Water"] },
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

function normalizeId(s: string): string {
    return s.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

/**
 * Resolve a desired item against the live catalogue.
 * Returns null if no matching element/terrain/structure id exists.
 */
function resolveItemId(
    kind: CardItemKind,
    preferred: string,
    aliases: string[] | undefined,
    cats: ReturnType<typeof listCataloguesForPicker>,
): string | null {
    const pool = kind === "element"
        ? cats.elements
        : kind === "terrain"
        ? cats.terrains
        : cats.structures;
    const candidates = [preferred, ...(aliases ?? [])].map(normalizeId);
    const byNorm = new Map(pool.map((r) => [normalizeId(r.id), r.id]));
    for (const c of candidates) {
        const hit = byNorm.get(c);
        if (hit) return hit;
    }
    // Also try name match
    for (const r of pool) {
        if (candidates.includes(normalizeId(r.name))) return r.id;
    }
    return null;
}

/**
 * Build default cards with IDs validated against the current game catalogue.
 * Items that cannot be resolved are dropped; empty cards are dropped.
 */
export function buildValidatedDefaultCards(): HomeCardConfig[] {
    let cats: ReturnType<typeof listCataloguesForPicker>;
    try {
        cats = listCataloguesForPicker();
    } catch {
        // Catalogue not ready — fall back to preferred ids as-is
        return DEFAULT_SPEC.map((c) => ({
            id: c.id,
            title: c.title,
            items: c.items.map((it) => ({ kind: it.kind, id: it.id })),
        }));
    }

    const out: HomeCardConfig[] = [];
    for (const spec of DEFAULT_SPEC) {
        const items: CardItemRef[] = [];
        for (const it of spec.items) {
            const id = resolveItemId(it.kind, it.id, it.aliases, cats);
            if (id) items.push({ kind: it.kind, id });
            else {console.warn(
                    `[md-word-statistic] default card skip ${it.kind}:${it.id} (not in catalogue)`,
                );}
        }
        if (items.length > 0) {
            out.push({ id: spec.id, title: spec.title, items });
        }
    }
    return out.length > 0 ? out : DEFAULT_SPEC.map((c) => ({
        id: c.id,
        title: c.title,
        items: c.items.map((it) => ({ kind: it.kind, id: it.id })),
    }));
}

/**
 * Load the card config from mod storage, falling back to the defaults.
 *
 * Read-only on purpose. This used to write the validated defaults straight back
 * to storage, which is a data-loss hazard now that the config is also read on
 * the boot scan — before the panel has mounted: a store that is not readable yet
 * would overwrite a real layout with defaults, and a catalogue that has only
 * half registered its mods would persist a default set with items already
 * dropped from it. The defaults are rebuilt from `DEFAULT_SPEC` on every load
 * anyway, so there is nothing to gain from writing them. Only the player's own
 * Save and "Reset defaults" write.
 *
 * A stored empty array is honoured: clearing every card in the editor is a
 * deliberate choice and has to survive a reload instead of falling back to the
 * default set.
 */
export function loadCards(): HomeCardConfig[] {
    const raw = safe(() => api.storage.get(MOD_ID, CARDS_STORE_KEY), null);
    if (Array.isArray(raw)) {
        if (raw.length === 0) return [];
        if (raw.every(isValidCard)) {
            return raw.map((c) => ({
                id: c.id,
                title: c.title,
                items: c.items.map((it) => ({
                    kind: it.kind as CardItemKind,
                    id: String(it.id).trim(),
                })),
            }));
        }
        console.warn(`${LOG} stored card config is malformed — using defaults`);
    }
    return buildValidatedDefaultCards();
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

/** Keys owned by this mod in storage (for wipe on disable). */
export function allCardStorageKeys(): string[] {
    return [CARDS_STORE_KEY, CARDS_SEEDED_KEY];
}
