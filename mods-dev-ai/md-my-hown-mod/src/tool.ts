/**
 * Mount the configurator panel.
 *
 * The panel used to be reached through a hotbar item: it registered a tool, added
 * it to the player's inventory, registered a global overlay, and then returned
 * `null` from every render unless that item happened to be the active selection.
 * So the panel's existence depended on game state the author had to arrange before
 * they could edit anything — and an author who had picked a different tool had no
 * way back to the configurator at all.
 *
 * It is now a plain injected component, mounted once at boot (the mdadmin pattern
 * in `mods-dev/md-admin-element`). `api.ui.inject` takes a custom mount id and
 * returns an unmount function; the panel renders itself minimized, and the chip is
 * the way in.
 *
 * **No teardown, on purpose.** `inject` hands back an unmount fn and it is
 * discarded. The mod is either enabled at boot — and then the panel is there for
 * the session, like any HUD — or it is not, and nothing is mounted at all. The
 * `enabled` setting still prunes stored config when switched off, but that is
 * `runDisableCleanup`'s job in `main.ts` and has nothing to do with the panel: the
 * alternative is a half-torn-down screen that is still on screen and no longer
 * able to save.
 */
import { getSandkit, h, React, safe, toast } from "./api.ts";
import { api as skApi } from "./packages/mysandkit.ts";
import { LOG, MOD_ID, OVERLAY_ID, SETTINGS, TOOL_NAME } from "./constants.ts";
import { readSettings } from "./packages/modkit.ts";
import { ConfiguratorPanel } from "./ui/panel.ts";

/** Guards against a second mount if this is somehow called again. */
let mounted = false;

export function mountPanel(): void {
    if (mounted) return;
    mounted = true;

    const sk = getSandkit();
    const a = skApi.raw;
    if (!a) {
        console.error(`${LOG} sandkit.api missing — panel unavailable`, {
            hasDeclare: typeof sk !== "undefined",
            global: !!(globalThis as any).sandkit,
        });
        return;
    }

    const R = React ?? sk?.react;
    const create = h ?? R?.createElement?.bind(R);
    if (!create) {
        console.warn(`${LOG} sandkit.react missing — panel unavailable`);
        return;
    }

    // Does a fresh install start as a chip or wide open? Read once, here, and
    // handed to the component — the reader's own stored choice overrides it after
    // the first launch either way.
    const startMinimized = readSettings(MOD_ID, SETTINGS).panelMinimized !== false;

    // `inject` is the documented way to mount a component under a custom id, and
    // it returns an unmount function — deliberately discarded. See the note on
    // teardown below.
    const dispose = safe(() =>
        a.ui?.inject?.(OVERLAY_ID, (() => ConfiguratorPanel(startMinimized)) as never)
    );
    if (dispose) {
        console.log(
            `${LOG} ui.inject(${OVERLAY_ID}) — panel mounted, ${
                startMinimized ? "minimized" : "open"
            }`,
        );
        // The engine mounts overlays once the UI is live, so an early mount can
        // land on nothing. A failed mount is silent, which makes a short retry
        // cheaper than a panel that simply never appears.
        const bump = () => safe(() => a.ui.overlays?.update?.("global"));
        setTimeout(bump, 300);
        setTimeout(bump, 1500);
        try {
            a.events?.on?.("game:ready", bump);
        } catch { /* events unavailable — the retries above are the fallback */ }
        return;
    }

    // `inject` is not the only spelling: builds that predate it expose the overlay
    // slot registry instead. Registering there is equivalent from the author's
    // side — the render function always returns the panel, with no selection gate.
    try {
        safe(() => a.ui.overlays?.unregister?.("global", OVERLAY_ID));
        a.ui.overlays.register(
            "global",
            OVERLAY_ID,
            () => ConfiguratorPanel(startMinimized),
        );
        console.log(`${LOG} overlays.register(global, ${OVERLAY_ID}) — fallback mount`);
        const bump = () => safe(() => a.ui.overlays?.update?.("global"));
        bump();
        setTimeout(bump, 300);
        setTimeout(bump, 1500);
        try {
            a.events?.on?.("action:changed", bump);
        } catch { /* events unavailable */ }
    } catch (err) {
        console.warn(`${LOG} panel mount failed — no ui.inject, no overlays.register`, err);
        toast(`${TOOL_NAME}: could not open the panel — see console`);
    }
}
