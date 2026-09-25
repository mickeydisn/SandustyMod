/**
 * Register the configurator tool item + global overlay.
 * Overlay visible only while this tool is the active hotbar item
 * (md-word-statistic pattern).
 */
import { api, h, React, safe, toast, getSandkit } from "./api.ts";
import {
    DESC_KEY,
    ITEM_ID,
    LOG,
    NAME_KEY,
    OVERLAY_ID,
    SPRITE_ID,
    SPRITE_PATH,
    TOOL_DESC,
    TOOL_NAME,
} from "./constants.ts";
import { ConfiguratorPanel } from "./ui/panel.ts";

export async function registerTool(): Promise<void> {
    const sk = getSandkit();
    const a = sk?.api ?? api;
    if (!a) {
        console.error(`${LOG} sandkit.api missing — cannot register tool`, {
            hasDeclare: typeof sk !== "undefined",
            global: !!(globalThis as any).sandkit,
        });
        return;
    }

    safe(() =>
        a.i18n?.register?.("en", {
            [NAME_KEY]: TOOL_NAME,
            [DESC_KEY]: TOOL_DESC,
        }),
    );

    try {
        await a.sprites?.loadFromMod?.(SPRITE_ID, SPRITE_PATH);
        console.log(`${LOG} sprite loaded ${SPRITE_ID}`);
    } catch (err) {
        console.warn(`${LOG} sprite load failed (tool still registers)`, err);
    }

    try {
        a.items.register({
            id: ITEM_ID,
            nameKey: NAME_KEY,
            descriptionKey: DESC_KEY,
            name: TOOL_NAME,
            description: TOOL_DESC,
            sprite: { id: SPRITE_ID },
            itemType: "tool",
            energyCost: 0,
            cooldown: { durationMs: 120 },
        });
        console.log(`${LOG} items.register ${ITEM_ID}`);
    } catch (err) {
        console.warn(`${LOG} items.register failed`, err);
    }

    try {
        if (typeof a.player?.inventory?.hasById === "function") {
            if (!a.player.inventory.hasById(ITEM_ID)) {
                a.player.inventory.addById(ITEM_ID);
            }
        } else {
            a.player?.inventory?.addById?.(ITEM_ID);
        }
        console.log(`${LOG} tool added to inventory`);
    } catch (err) {
        console.warn(`${LOG} inventory add failed`, err);
    }

    const R = React ?? sk?.react;
    const create = h ?? R?.createElement?.bind(R);
    if (!create) {
        console.warn(`${LOG} sandkit.react missing — overlay unavailable`);
        return;
    }

    try {
        a.ui?.overlays?.unregister?.("global", OVERLAY_ID);
    } catch { /* */ }

    try {
        a.ui.overlays.register("global", OVERLAY_ID, () => ConfiguratorPanel());
        console.log(`${LOG} overlays.register(global, ${OVERLAY_ID})`);
    } catch (err) {
        console.warn(`${LOG} overlays.register failed, trying inject`, err);
        safe(() => a.ui.inject?.(OVERLAY_ID, ConfiguratorPanel));
    }

    const bump = () => {
        safe(() => a.ui.overlays.update?.("global"));
        safe(() => a.ui.overlays.update?.());
    };
    bump();
    setTimeout(bump, 300);
    setTimeout(bump, 1500);

    try {
        a.events.on("action:changed", bump);
    } catch { /* */ }
    try {
        a.events.on("game:ready", bump);
    } catch { /* */ }

    toast(`${TOOL_NAME} ready — select the tool in the hotbar`);
    console.log(`${LOG} tool + overlay registered (${ITEM_ID})`);
}

export function unregisterTool(): void {
    try {
        const a = getSandkit()?.api ?? api;
        a?.ui?.overlays?.unregister?.("global", OVERLAY_ID);
    } catch { /* */ }
}
