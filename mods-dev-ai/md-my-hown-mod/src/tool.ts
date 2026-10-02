import { getSandkit, h, React, safe, toast } from "./api.ts";
import { api as skApi } from "./packages/mysandkit.ts";
import { LOG, MOD_ID, OVERLAY_ID, SETTINGS, TOOL_NAME } from "./constants.ts";
import { readSettings } from "./packages/modkit.ts";
import { ConfiguratorPanel } from "./ui/panel.ts";

let mounted = false;

export function mountPanel(): void {
    if (mounted) return;
    mounted = true;

    const sk = getSandkit();
    const a = skApi.raw;
    if (!a) {
        console.error(`${LOG} sandkit.api missing — panel unavailable`, {
            resolved: !!getSandkit(),
        });
        return;
    }

    const R = React ?? sk?.react;
    const create = h ?? R?.createElement?.bind(R);
    if (!create) {
        console.warn(`${LOG} sandkit.react missing — panel unavailable`);
        return;
    }

    const startMinimized = readSettings(MOD_ID, SETTINGS).panelMinimized !== false;

    const dispose = safe(() =>
        a.ui?.inject?.(OVERLAY_ID, (() => ConfiguratorPanel(startMinimized)) as never)
    );
    if (dispose) {
        console.log(
            `${LOG} ui.inject(${OVERLAY_ID}) — panel mounted, ${
                startMinimized ? "minimized" : "open"
            }`,
        );

        const bump = () => safe(() => a.ui.overlays?.update?.("global"));
        setTimeout(bump, 300);
        setTimeout(bump, 1500);
        try {
            a.events?.on?.("game:ready", bump);
        } catch {}
        return;
    }

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
        } catch {}
    } catch (err) {
        console.warn(`${LOG} panel mount failed — no ui.inject, no overlays.register`, err);
        toast(`${TOOL_NAME}: could not open the panel — see console`);
    }
}
