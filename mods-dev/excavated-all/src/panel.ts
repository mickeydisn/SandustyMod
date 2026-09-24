/**
 * excavated-all — the hotbar overlay.
 *
 * Shows a radius stepper and four filter toggles (Terrain / Structure /
 * Element / Fixed) whenever the Total Excavator is the active
 * item — same "renders null when not selected" pattern as the materializer's
 * `RadiusOverlay` in `hiden-word-2/tools/materializer.ts`.
 */
import { api, h, React } from "./api.ts";
import {
    FILTER_KEYS,
    FILTER_LABELS,
    FILTER_TITLES,
    FIRE_KEY_LABEL,
    MOD_ID,
    OVERLAY_ID,
    RADIUS_MAX,
    RADIUS_MIN,
    VERSION,
} from "./ids.ts";
import { isExcavatorSelected } from "./tool.ts";
import { setRadius, setRepaint, toggleFilter, toolState } from "./state.ts";
import { COLORS, styles } from "./styles.ts";
import type { FilterKey } from "./ids.ts";

export function ExcavatorPanel(): unknown {
    const react = React;
    const e = h;
    if (!react || !e) return null;

    const [, bump] = react.useState(0) as [number, (fn: (n: number) => number) => void];

    react.useEffect(() => {
        setRepaint(bump);
        let unsub: (() => void) | void;
        try {
            unsub = api.events.on("action:changed", () => bump((n) => n + 1));
        } catch { /* optional */ }
        return () => {
            setRepaint(null);
            try {
                unsub?.();
            } catch { /* */ }
        };
    }, []);

    if (!isExcavatorSelected()) return null;

    const stats = toolState.lastStats;
    const statLine = stats
        ? `last: ${stats.terrain}t / ${stats.element}e / ${stats.structure}s` +
            (stats.skippedFixed || stats.skippedAuth ? ` · skipped ${stats.skippedFixed + stats.skippedAuth}` : "") +
            (stats.structureNoTerrain > 0 ? ` · ${stats.structureNoTerrain} under structures` : "") +
            (stats.skippedStructureTerrain > 0 ? ` · ${stats.skippedStructureTerrain} machine terrain` : "")
        : "click or hold, or press " + FIRE_KEY_LABEL;

    const toggle = (key: FilterKey) =>
        e(
            "button",
            {
                key,
                type: "button",
                title: FILTER_TITLES[key],
                style: toolState.filters[key] ? styles.toggleOn : styles.toggleOff,
                onClick: () => toggleFilter(key),
            },
            `${toolState.filters[key] ? "\u25A3" : "\u25A1"} ${FILTER_LABELS[key]}`,
        );

    return e(
        "div",
        { className: `${MOD_ID}-bar`, style: styles.bar },
        e(
            "div",
            { style: styles.row },
            e("span", { style: styles.title }, "EXCAVATED ALL"),
            e("span", { style: { color: COLORS.dim } }, `v${VERSION}`),
        ),
        e(
            "div",
            { style: styles.row },
            e("span", { style: { color: COLORS.dim } }, "radius"),
            e(
                "button",
                { type: "button", style: styles.radiusBtn, onClick: () => setRadius(toolState.radius - 1) },
                "\u2212",
            ),
            e("input", {
                type: "number",
                min: RADIUS_MIN,
                max: RADIUS_MAX,
                value: toolState.radius,
                style: styles.radiusInput,
                onChange: (ev: { target: { value: string } }) => setRadius(Number(ev.target.value)),
            }),
            e(
                "button",
                { type: "button", style: styles.radiusBtn, onClick: () => setRadius(toolState.radius + 1) },
                "+",
            ),
            e("span", { style: { color: COLORS.dim } }, "cells"),
        ),
        e(
            "div",
            { style: { ...styles.row, flexWrap: "wrap" } },
            ...FILTER_KEYS.map((key) => toggle(key)),
        ),
        e("div", { style: styles.footer }, statLine),
    );
}

export function registerPanel(): void {
    try {
        api.ui.overlays.register("hotbar", OVERLAY_ID, () => ExcavatorPanel());
    } catch (err) {
        console.warn(`[${MOD_ID}] panel overlay register failed`, err);
    }
}
