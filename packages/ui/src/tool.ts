/**
 * Register a statistic tool item and its global overlay.
 *
 * `items.register` dereferences the loaded sprite texture without a guard, so
 * the sprite must load first or registration throws. The overlay is mounted
 * once and stays mounted; its render returns `null` when the tool is not the
 * active hotbar item.
 */
import { api, h, React, safe, toast } from "./api.ts";

/**
 * Numeric `ItemType.Tool` (2). The engine compares `itemType === SP.Tool`
 * **numerically**, so registering the string `"tool"` silently files the item
 * as a plain item rather than a tool — no error, just the wrong hotbar slot.
 */
export const ITEM_TYPE_TOOL = 2;

export interface StatisticToolOptions {
    /** Console prefix, e.g. `[md-player-statistic]`. */
    log: string;
    /** Item id (hotbar), e.g. `md-player-statistic:tool`. */
    itemId: string;
    /** Overlay id under the `global` zone. */
    overlayId: string;
    /** Sprite id for the tool icon. */
    spriteId: string;
    /** Path relative to the mod root, loaded via `sprites.loadFromMod`. */
    spritePath: string;
    nameKey: string;
    descKey: string;
    toolName: string;
    toolDesc: string;
    /** Panel component. */
    render: () => unknown;
    /** Cooldown in ms. */
    cooldownMs?: number;
    /** Numeric item type; defaults to {@link ITEM_TYPE_TOOL}. */
    itemType?: number;
    /**
     * Abort instead of continuing when the sprite fails to load. `items.register`
     * dereferences the loaded texture with no guard, so without this the item is
     * never registered, the inventory add throws, and the overlay can never
     * open — all with only a warning in the log.
     */
    requireSprite?: boolean;
}

export interface StatisticToolResult {
    ok: boolean;
    /** Set when `ok` is false. */
    reason?: string;
    itemRegistered: boolean;
}

/** True when the sprite is present in the sprite registry. */
export function assertSpriteLoaded(spriteId: string): boolean {
    return safe(() => api.sprites?.getById?.(spriteId) != null, false) === true;
}

export async function registerStatisticTool(
    opts: StatisticToolOptions,
): Promise<StatisticToolResult> {
    const { log, itemId, overlayId, spriteId, spritePath, nameKey, descKey } = opts;

    safe(() =>
        api.i18n?.register?.("en", {
            [nameKey]: opts.toolName,
            [descKey]: opts.toolDesc,
        })
    );

    // — Sprite. Must load: items.register dereferences it unguarded. —
    let spriteReady = false;
    try {
        await api.sprites?.loadFromMod?.(spriteId, spritePath);
        spriteReady = assertSpriteLoaded(spriteId);
    } catch (err) {
        console.warn(`${log} sprite load threw for ${spritePath}`, err);
    }
    if (!spriteReady) {
        const msg = `sprite "${spritePath}" did not load, so items.register would throw ` +
            `and the tool would never reach the hotbar (check build/assets/)`;
        if (opts.requireSprite) {
            console.error(`${log} ABORT — ${msg}`);
            return { ok: false, reason: msg, itemRegistered: false };
        }
        console.warn(`${log} ${msg}`);
    }

    // — Item definition. Re-registering is a no-op, not an error. —
    let itemRegistered = false;
    try {
        if (api.items?.getDefinitionById?.(itemId)) {
            itemRegistered = true; // enable -> disable -> enable
        } else {
            api.items.register({
                id: itemId,
                nameKey,
                descriptionKey: descKey,
                name: opts.toolName,
                description: opts.toolDesc,
                sprite: { id: spriteId },
                itemType: opts.itemType ?? ITEM_TYPE_TOOL,
                energyCost: 0,
                cooldown: { durationMs: opts.cooldownMs ?? 120 },
            });
            itemRegistered = true;
        }
    } catch (err) {
        console.error(`${log} items.register failed`, err);
        return { ok: false, reason: "items.register failed", itemRegistered: false };
    }

    // — Inventory. A no-op at the main menu; callers retry via a watch. —
    safe(() => {
        const inv = api.player?.inventory;
        if (!inv) return;
        if (typeof inv.hasById === "function") {
            if (!inv.hasById(itemId)) inv.addById(itemId);
        } else {
            inv.addById?.(itemId);
        }
    });

    if (!h || !React) {
        console.warn(`${log} sandkit.react missing — overlay unavailable`);
        return { ok: true, itemRegistered };
    }

    // — Overlay. —
    try {
        api.ui.overlays.register("global", overlayId, () => opts.render());
    } catch (err) {
        console.warn(`${log} overlays.register failed, trying ui.inject`, err);
        safe(() => api.ui.inject?.(overlayId, opts.render));
    }

    try {
        api.events.on("action:changed", () => {
            // Force overlay re-eval when the player switches tools.
            safe(() => api.ui.overlays.update?.("global"));
        });
    } catch { /* */ }

    toast(`${opts.toolName} ready`);
    console.log(`${log} tool + overlay registered (${itemId})`);
    return { ok: true, itemRegistered };
}
