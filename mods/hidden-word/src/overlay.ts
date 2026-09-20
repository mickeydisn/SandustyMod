/**
 * Hidden World — generation parameter overlay (the picker).
 *
 * A hotbar overlay registered once; it renders a small parameter panel while
 * the Ghost Lens item is selected (same visibility driver as the ghost view).
 * Edits land in a local draft; **Refresh** applies the draft to the runtime
 * (seed + params), persists it to the save and regenerates the hidden world.
 *
 * UI follows the repo's picker pattern: `sandkit.react.createElement` (`h`),
 * a `useState` bump as the repaint handle, and an `action:changed`
 * subscription so the panel opens/closes with the selection.
 */

import { DEFAULT_PARAMS, LOG, OVERLAY_ID } from "./constants.ts";
import { api } from "./api.ts";
import { isLensSelected } from "./lens.ts";
import { persistRecord, randomSeed } from "./persistence.ts";
import { ghostPalette, refreshHiddenWorld } from "./render.ts";
import { runtime } from "./state.ts";
import type { BandParams, GenerationParams, SkyWave } from "./types.ts";

/** Draft = params + the seed, as edited in the panel. */
type DraftParams = GenerationParams & { seed: string };

/** React handle (host copy) — typed loosely like the catalogue picker does. */
const react = sandkit.react;
/** Create a React element. */
const h = (
    type: unknown,
    props: Record<string, unknown> | null,
    ...children: unknown[]
): unknown => react.createElement(type, props, ...children);

const cloneParams = (params: GenerationParams): GenerationParams =>
    JSON.parse(JSON.stringify(params)) as GenerationParams;

/** A fresh draft from the defaults (new installs / Reset). */
function defaultDraft(): DraftParams {
    return { ...cloneParams(DEFAULT_PARAMS), seed: runtime.seed };
}

/** A draft mirroring the current runtime state. */
function currentDraft(): DraftParams {
    return { ...cloneParams(runtime.params), seed: runtime.seed };
}

/** Small toast; the panel uses plain English labels (no i18n keys). */
function toast(text: string): void {
    try {
        api.ui.toast(text, {});
    } catch (err) {
        console.warn(`${LOG} toast failed`, err);
    }
}
/** One labeled integer slider row (value shown at the right). */
function sliderRow(
    label: string,
    value: number,
    min: number,
    max: number,
    onChange: (value: number) => void,
): unknown {
    return h(
        "div",
        { className: "hw-row" },
        h("label", null, label),
        h("input", {
            type: "range",
            min,
            max,
            step: 1,
            value,
            onChange: (e: { target: { value: string } }) => onChange(Number(e.target.value)),
        }),
        h("span", { className: "hw-val" }, String(value)),
    );
}

/** One labeled integer number row (band offsets). */
function numberRow(
    label: string,
    value: number,
    onChange: (value: number) => void,
): unknown {
    return h(
        "div",
        { className: "hw-row" },
        h("label", null, label),
        h("input", {
            type: "number",
            step: 10,
            value,
            onChange: (e: { target: { value: string } }) => onChange(Number(e.target.value) || 0),
        }),
    );
}

/** Slider bounds = default ±15%, rounded, capped by the hard bounds. */
function bounds15(defaultValue: number, minCap: number, maxCap: number): [number, number] {
    return [
        Math.max(minCap, Math.round(defaultValue * 0.85)),
        Math.min(maxCap, Math.round(defaultValue * 1.15)),
    ];
}

/** One skyline wave row: period (cells) + amplitude (%), integers. */
function skyWaveRow(
    label: string,
    wave: SkyWave,
    defaults: SkyWave,
    setWave: (wave: SkyWave) => void,
): unknown {
    // Same ±15% rule as the sliders for the upper end; amplitudes may go to 0
    // (flatten a wave), periods stay ≥ 2 cells.
    const [pMin, pMax] = bounds15(defaults.periodCells, 2, 1_000_000);
    const aMin = 0;
    const [, aMax] = bounds15(defaults.amplitudePercent, 0, 100);
    return h(
        "div",
        { className: "hw-row" },
        h("label", null, label),
        h("input", {
            type: "number",
            min: pMin,
            max: pMax,
            step: 10,
            value: wave.periodCells,
            title: `Period in cells, ${pMin}-${pMax} (frequency = 1 / period)`,
            onChange: (e: { target: { value: string } }) =>
                setWave({
                    ...wave,
                    periodCells: Math.min(
                        pMax,
                        Math.max(pMin, Math.round(Number(e.target.value) || pMin)),
                    ),
                }),
        }),
        h("span", { className: "hw-mini" }, "amp"),
        h("input", {
            type: "number",
            min: aMin,
            max: aMax,
            step: 1,
            value: wave.amplitudePercent,
            title: `Amplitude %, ${aMin}-${aMax}`,
            onChange: (e: { target: { value: string } }) =>
                setWave({
                    ...wave,
                    amplitudePercent: Math.min(
                        aMax,
                        Math.max(aMin, Math.round(Number(e.target.value) || aMin)),
                    ),
                }),
        }),
    );
}

/** Slider + number rows for one band (bounds = default ±15%, rounded). */
function bandRows(
    title: string,
    band: BandParams,
    defaults: BandParams,
    setBand: (band: BandParams) => void,
): unknown[] {
    const [tMin, tMax] = bounds15(defaults.thicknessPercent, 0, 50);
    const [dMin, dMax] = bounds15(defaults.definitionPercent, 0, 95);
    return [
        h("div", { className: "hw-sec" }, title),
        sliderRow(
            "Thickness %",
            band.thicknessPercent,
            tMin,
            tMax,
            (v) => setBand({ ...band, thicknessPercent: v }),
        ),
        sliderRow(
            "Definition %",
            band.definitionPercent,
            dMin,
            dMax,
            (v) => setBand({ ...band, definitionPercent: v }),
        ),
        numberRow("Move X", band.offsetX, (v) => setBand({ ...band, offsetX: v })),
        numberRow("Move Y", band.offsetY, (v) => setBand({ ...band, offsetY: v })),
    ];
}

/**
 * The terrain-colour legend: a swatch + the terrain name per matrix code.
 * Codes with no terrain (sky, tunnels) show as a checkered "transparent" chip.
 */
function legendRows(): unknown {
    const entries = ghostPalette();
    return h(
        "div",
        { className: "hw-legend" },
        ...entries.map((entry) =>
            h(
                "span",
                {
                    className: "hw-legend-item",
                    title: entry.alpha === 0
                        ? `${entry.codeLabel}: no terrain — fully transparent (${entry.source})`
                        : `${entry.label} ${entry.hex} — ${entry.source}`,
                },
                h("i", {
                    className: "hw-swatch",
                    style: entry.alpha === 0
                        ? {
                            background:
                                "repeating-conic-gradient(#666 0% 25%, #333 0% 50%) 0 0 / 8px 8px",
                        }
                        : { background: entry.hex },
                }),
                entry.alpha === 0 ? entry.label : `${entry.label} ${entry.hex}`,
            )
        ),
    );
}

/** Inject the panel stylesheet once (plain CSS, like the catalogue picker). */
function injectStyles(): void {
    if (document.getElementById("hw-panel-style")) return;
    const style = document.createElement("style");
    style.id = "hw-panel-style";
    style.textContent = `
        .hw-panel {
            position: fixed; left: 50%; transform: translateX(-50%);
            bottom: 7em; width: 360px; max-height: 62vh; overflow-y: auto;
            z-index: 1000; padding: 10px 12px; box-sizing: border-box;
            background: rgba(10, 10, 16, 0.92); border: 1px solid #445;
            border-radius: 6px; color: #ddd; font-size: 12px;
            pointer-events: auto; font-family: inherit;
        }
        .hw-panel h3 { margin: 0 0 6px; font-size: 13px; letter-spacing: 0.05em; color: #9cf; }
        .hw-sec { margin: 8px 0 2px; padding-bottom: 2px; color: #89f;
            font-weight: bold; border-bottom: 1px solid #334; }
        .hw-row { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
        .hw-row label { flex: 0 0 96px; color: #aaa; }
        .hw-row input[type="range"] { flex: 1; }
        .hw-row input[type="number"], .hw-row input[type="text"] {
            background: #111; color: #eee; border: 1px solid #445;
            border-radius: 3px; padding: 2px 4px; font: inherit;
        }
        .hw-row input[type="number"] { width: 64px; }
        .hw-row input[type="text"] { flex: 1; }
        .hw-mini { color: #778; font-size: 10px; flex: 0 0 auto; }
        .hw-val { flex: 0 0 34px; text-align: right; color: #fff; }
        .hw-legend { display: flex; flex-wrap: wrap; gap: 4px 10px; margin: 4px 0; }
        .hw-legend-item { display: flex; align-items: center; gap: 4px;
            color: #bbb; font-size: 11px; }
        .hw-swatch { width: 10px; height: 10px; border-radius: 2px;
            border: 1px solid #556; display: inline-block; }
        .hw-btns { display: flex; gap: 6px; margin-top: 10px; }
        .hw-btn { background: #234; border: 1px solid #456; color: #cde;
            border-radius: 4px; padding: 4px 8px; cursor: pointer; font: inherit; }
        .hw-btn:hover { background: #345; }
    `;
    document.head.appendChild(style);
}

/** Apply the draft to the runtime, persist it, regenerate and repaint. */
function applyDraft(draft: DraftParams, setDraft: (value: DraftParams) => void): void {
    runtime.seed = draft.seed.trim() || runtime.seed;
    runtime.params = cloneParams(draft);
    const ok = refreshHiddenWorld();
    persistRecord();
    setDraft(currentDraft());
    toast(ok ? "Hidden world regenerated" : "Hidden world refresh failed");
    console.log(`${LOG} hidden world refreshed (${ok ? "ok" : "failed"})`);
}

/** The React panel component (hidden unless the Ghost Lens is selected). */
function ParamsPanel(): unknown {
    const [draft, setDraft] = react.useState(currentDraft) as [
        DraftParams,
        (value: DraftParams) => void,
    ];
    const [, bump] = react.useState(0) as [unknown, (fn: (n: number) => number) => void];

    react.useEffect(() => {
        // Re-render when the selected action changes → panel opens/closes.
        const unsubscribe = api.events.on("action:changed", () => bump((n) => n + 1));
        return () => {
            try {
                unsubscribe();
            } catch {
                /* optional */
            }
        };
    }, []);

    if (!isLensSelected()) return null;

    const setTunnel = (band: BandParams) => setDraft({ ...draft, tunnel: band });
    const setCave = (band: BandParams) => setDraft({ ...draft, cave: band });

    return h(
        "div",
        { className: "hw-panel" },
        h("h3", null, `HIDDEN WORLD — ${runtime.width}×${runtime.height} cells`),
        h(
            "div",
            { className: "hw-row" },
            h("label", null, "Seed"),
            h("input", {
                type: "text",
                value: draft.seed,
                onChange: (e: { target: { value: string } }) =>
                    setDraft({ ...draft, seed: e.target.value }),
            }),
            h(
                "button",
                { className: "hw-btn", onClick: () => setDraft({ ...draft, seed: randomSeed() }) },
                "🎲",
            ),
        ),
        h("div", { className: "hw-sec" }, "Skyline"),
        skyWaveRow(
            "Big wave",
            draft.sky.bigWave,
            DEFAULT_PARAMS.sky.bigWave,
            (wave) => setDraft({ ...draft, sky: { ...draft.sky, bigWave: wave } }),
        ),
        skyWaveRow(
            "Medium wave",
            draft.sky.mediumWave,
            DEFAULT_PARAMS.sky.mediumWave,
            (wave) => setDraft({ ...draft, sky: { ...draft.sky, mediumWave: wave } }),
        ),
        skyWaveRow(
            "Low wave",
            draft.sky.lowWave,
            DEFAULT_PARAMS.sky.lowWave,
            (wave) => setDraft({ ...draft, sky: { ...draft.sky, lowWave: wave } }),
        ),
        skyWaveRow(
            "Roughness",
            draft.sky.roughness,
            DEFAULT_PARAMS.sky.roughness,
            (wave) => setDraft({ ...draft, sky: { ...draft.sky, roughness: wave } }),
        ),
        h("div", { className: "hw-sec" }, "Terrain"),
        sliderRow(
            "Ground level %",
            draft.baseHeightPercent,
            ...bounds15(DEFAULT_PARAMS.baseHeightPercent, 5, 90),
            (v) => setDraft({ ...draft, baseHeightPercent: v }),
        ),
        ...bandRows("Tunnels", draft.tunnel, DEFAULT_PARAMS.tunnel, setTunnel),
        ...bandRows("Caves", draft.cave, DEFAULT_PARAMS.cave, setCave),
        h("div", { className: "hw-sec" }, "Colors (elements)"),
        legendRows(),
        h(
            "div",
            { className: "hw-btns" },
            h("button", { className: "hw-btn", onClick: () => setDraft(defaultDraft()) }, "Reset"),
            h(
                "button",
                { className: "hw-btn", onClick: () => applyDraft(draft, setDraft) },
                "↻ Refresh hidden world",
            ),
        ),
    );
}

let registered = false;

/** Register the params overlay (hotbar slot); idempotent. */
export function registerParamsOverlay(): void {
    if (registered) return;
    injectStyles();
    try {
        api.ui.overlays.register("hotbar", OVERLAY_ID, () => h(ParamsPanel, null));
        registered = true;
        console.log(`${LOG} params overlay registered`);
    } catch (err) {
        console.warn(`${LOG} overlay registration failed`, err);
    }
}
