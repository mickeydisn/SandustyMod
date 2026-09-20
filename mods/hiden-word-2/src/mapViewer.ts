/**
 * Map Viewer tool — ~80% fullscreen overlay:
 *   left  = generation config (all stages)
 *   right = low-resolution full-map preview (correct terrain colors)
 *
 * Ghost Lens stays separate: only paints the hidden world over the live view.
 */

import {
  CODE_OPTIONS,
  DEFAULT_PARAMS,
  LOG,
  TERRAIN,
  VIEWER_ICON_PATH,
  VIEWER_ICON_SPRITE_ID,
  VIEWER_ITEM_ID,
  VIEWER_OVERLAY_ID,
  KEY,
} from "./constants.ts";
import "./colors.ts"; // TERRAIN_COLORS available for future UI
import type { MapBoundsPercent, WallRule, FormRule } from "./types.ts";
import { api } from "./api.ts";
import { persistRecord, randomSeed } from "./persistence.ts";
import { ghostPalette, refreshHiddenWorld } from "./render.ts";
import { runtime } from "./state.ts";
import type {
  BandParams,
  FluidsParams,
  FormGrowParams,
  GenerationParams,
  SealParams,
  SkyWave,
  WallGrowParams,
} from "./types.ts";

type DraftParams = GenerationParams & { seed: string };

declare const sandkit: { react: any };
const react = sandkit.react;
const h = (
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): unknown => react.createElement(type, props, ...children);

const cloneParams = (params: GenerationParams): GenerationParams =>
  JSON.parse(JSON.stringify(params)) as GenerationParams;

function currentDraft(): DraftParams {
  return { ...cloneParams(runtime.params), seed: runtime.seed };
}
function defaultDraft(): DraftParams {
  return { ...cloneParams(DEFAULT_PARAMS), seed: runtime.seed };
}

export function isViewerSelected(): boolean {
  try {
    if (typeof api.items.isActiveById === "function") {
      return api.items.isActiveById(VIEWER_ITEM_ID) === true;
    }
  } catch { /* */ }
  try {
    return api.items.getActive?.()?.id === VIEWER_ITEM_ID;
  } catch {
    return false;
  }
}

/** User closed the panel; clears when the viewer tool is deselected. */
let panelDismissed = false;

function tryDeselectViewer(): void {
  // Best-effort: clear active item if the host exposes it.
  try {
    const items = api.items as Record<string, unknown>;
    if (typeof items.clearActive === "function") {
      (items.clearActive as () => void)();
      return;
    }
    if (typeof items.setActive === "function") {
      (items.setActive as (id: string | null) => void)(null);
      return;
    }
    if (typeof items.deselect === "function") {
      (items.deselect as () => void)();
      return;
    }
  } catch { /* */ }
  try {
    const inv = (globalThis as any).sandkit?.state?.store?.player;
    if (inv && "selectedItemId" in inv) inv.selectedItemId = null;
    if (inv && "activeItemId" in inv) inv.activeItemId = null;
  } catch { /* */ }
}

function closeMapViewerPanel(): void {
  panelDismissed = true;
  view.bound = false;
  tryDeselectViewer();
}

function toast(text: string): void {
  try {
    api.ui.toast(text, {});
  } catch (err) {
    console.warn(`${LOG} toast failed`, err);
  }
}

// ---------------------------------------------------------------------------
// Form widgets
// ---------------------------------------------------------------------------

function sliderRow(
  label: string,
  value: number,
  min: number,
  max: number,
  onChange: (value: number) => void,
): unknown {
  return h(
    "div",
    { className: "hwv-row" },
    h("label", null, label),
    h("input", {
      type: "range",
      min,
      max,
      step: 1,
      value,
      onChange: (e: { target: { value: string } }) => onChange(Number(e.target.value)),
    }),
    h("span", { className: "hwv-val" }, String(value)),
  );
}

function numberRow(
  label: string,
  value: number,
  onChange: (value: number) => void,
  step = 1,
): unknown {
  return h(
    "div",
    { className: "hwv-row" },
    h("label", null, label),
    h("input", {
      type: "number",
      step,
      value,
      onChange: (e: { target: { value: string } }) => onChange(Number(e.target.value) || 0),
    }),
  );
}

function checkRow(label: string, checked: boolean, onChange: (v: boolean) => void): unknown {
  return h(
    "div",
    { className: "hwv-row" },
    h("label", null, label),
    h("input", {
      type: "checkbox",
      checked,
      onChange: (e: { target: { checked: boolean } }) => onChange(!!e.target.checked),
    }),
  );
}

function bounds15(defaultValue: number, minCap: number, maxCap: number): [number, number] {
  return [
    Math.max(minCap, Math.round(defaultValue * 0.85)),
    Math.min(maxCap, Math.round(defaultValue * 1.15)),
  ];
}

function skyWaveRow(
  label: string,
  wave: SkyWave,
  defaults: SkyWave,
  setWave: (wave: SkyWave) => void,
): unknown {
  const [pMin, pMax] = bounds15(defaults.periodCells, 2, 1_000_000);
  const [, aMax] = bounds15(defaults.amplitudePercent, 0, 100);
  return h(
    "div",
    { className: "hwv-row" },
    h("label", null, label),
    h("input", {
      type: "number",
      min: pMin,
      max: pMax,
      step: 10,
      value: wave.periodCells,
      onChange: (e: { target: { value: string } }) =>
        setWave({
          ...wave,
          periodCells: Math.min(pMax, Math.max(pMin, Math.round(Number(e.target.value) || pMin))),
        }),
    }),
    h("span", { className: "hwv-mini" }, "amp%"),
    h("input", {
      type: "number",
      min: 0,
      max: aMax,
      step: 1,
      value: wave.amplitudePercent,
      onChange: (e: { target: { value: string } }) =>
        setWave({
          ...wave,
          amplitudePercent: Math.min(aMax, Math.max(0, Math.round(Number(e.target.value) || 0))),
        }),
    }),
  );
}

function bandSection(
  title: string,
  band: BandParams,
  defaults: BandParams,
  setBand: (b: BandParams) => void,
): unknown[] {
  const [tMin, tMax] = bounds15(defaults.thicknessPercent, 0, 50);
  const [dMin, dMax] = bounds15(defaults.definitionPercent, 0, 95);
  return [
    h("div", { className: "hwv-sec" }, title),
    checkRow("Enabled", band.enabled, (v) => setBand({ ...band, enabled: v })),
    sliderRow("Thickness %", band.thicknessPercent, tMin, tMax, (v) =>
      setBand({ ...band, thicknessPercent: v })),
    sliderRow("Definition %", band.definitionPercent, dMin, dMax, (v) =>
      setBand({ ...band, definitionPercent: v })),
    numberRow("Move X", band.offsetX, (v) => setBand({ ...band, offsetX: v }), 10),
    numberRow("Move Y", band.offsetY, (v) => setBand({ ...band, offsetY: v }), 10),
  ];
}

// ---------------------------------------------------------------------------
// Low-res map canvas + mouse zoom/pan
// ---------------------------------------------------------------------------

/** Base resolution: 1/2 of the real map (fallback 1/4 if enormous). */
let baseDivisor: 2 | 4 = 2;
let lastPreviewDiv = 2;

/** View transform (CSS pixels relative to viewport center). */
/** Which rule rectangle to stroke on the preview: "wall:0" | "form:1" | null */
let focusedRuleKey: string | null = null;

const view = {
  zoom: 1,
  panX: 0,
  panY: 0,
  dragging: false,
  lastX: 0,
  lastY: 0,
  bound: false,
};

function chooseBaseDivisor(mapW: number, mapH: number): 2 | 4 {
  const longest = Math.max(mapW, mapH);
  // 1/2 unless that would exceed ~900px on a side
  if (Math.ceil(longest / 2) <= 900) return 2;
  return 4;
}

function paintPreviewCanvas(canvas: HTMLCanvasElement): void {
  const data = runtime.data;
  if (!data || runtime.width <= 0 || runtime.height <= 0) {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      canvas.width = 320;
      canvas.height = 180;
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#666";
      ctx.font = "12px sans-serif";
      ctx.fillText("No map yet — hit Generate", 12, 24);
    }
    applyViewTransform(canvas);
    return;
  }

  const w = runtime.width;
  const h = runtime.height;
  const div = chooseBaseDivisor(w, h);
  baseDivisor = div;
  lastPreviewDiv = div;

  const pw = Math.max(1, Math.ceil(w / div));
  const ph = Math.max(1, Math.ceil(h / div));

  canvas.width = pw;
  canvas.height = ph;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const entries = ghostPalette();
  const table = new Map<number, [number, number, number, number]>();
  for (const e of entries) table.set(e.code, e.rgba);

  const img = ctx.createImageData(pw, ph);
  for (let py = 0; py < ph; py++) {
    const sy = Math.min(h - 1, py * div);
    for (let px = 0; px < pw; px++) {
      const sx = Math.min(w - 1, px * div);
      const code = data[sy * w + sx]!;
      const [r, g, b, a] = table.get(code) ?? [0, 0, 0, 255];
      const i = (py * pw + px) * 4;
      if (a < 16) {
        img.data[i] = 0x1a;
        img.data[i + 1] = 0x1a;
        img.data[i + 2] = 0x22;
        img.data[i + 3] = 255;
      } else {
        img.data[i] = r;
        img.data[i + 1] = g;
        img.data[i + 2] = b;
        img.data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  drawFocusedBounds(ctx, pw, ph, w, h);
  applyViewTransform(canvas);
}

function codeColor(id: number): string {
  const opt = CODE_OPTIONS.find((o) => o.id === id);
  return opt?.color ?? "#fff";
}

function drawFocusedBounds(
  ctx: CanvasRenderingContext2D,
  pw: number,
  ph: number,
  mapW: number,
  mapH: number,
): void {
  if (!focusedRuleKey) return;
  const [kind, idxStr] = focusedRuleKey.split(":");
  const idx = Number(idxStr);
  let bounds: MapBoundsPercent | null = null;
  let stroke = "#9cf";
  if (kind === "wall") {
    const r = runtime.params.wallGrow.rules[idx];
    if (!r) return;
    bounds = r.bounds;
    stroke = codeColor(r.replaceBy);
  } else if (kind === "form") {
    const r = runtime.params.formGrow.rules[idx];
    if (!r) return;
    bounds = r.bounds;
    stroke = codeColor(r.replaceBy);
  }
  if (!bounds) return;
  const x0 = (Math.min(bounds.left, bounds.right) / 100) * pw;
  const x1 = (Math.max(bounds.left, bounds.right) / 100) * pw;
  const y0 = (Math.min(bounds.top, bounds.bottom) / 100) * ph;
  const y1 = (Math.max(bounds.top, bounds.bottom) / 100) * ph;
  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(2, Math.round(Math.min(pw, ph) / 80));
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, Math.max(1, x1 - x0 - 1), Math.max(1, y1 - y0 - 1));
  ctx.restore();
}

function applyViewTransform(canvas: HTMLCanvasElement): void {
  canvas.style.transformOrigin = "center center";
  // left/top 50% + -50% centers the canvas; pan/zoom on top
  canvas.style.transform =
    `translate(calc(-50% + ${view.panX}px), calc(-50% + ${view.panY}px)) scale(${view.zoom})`;
}

export function getPreviewDivisor(): number {
  return lastPreviewDiv;
}

/** Scale CSS display size so the canvas fits the viewport at zoom=1. */
function fitCanvasToViewport(viewport: HTMLElement, canvas: HTMLCanvasElement): void {
  const vw = viewport.clientWidth || 400;
  const vh = viewport.clientHeight || 300;
  const cw = canvas.width || 1;
  const ch = canvas.height || 1;
  const fit = Math.min(vw / cw, vh / ch) * 0.92;
  canvas.style.width = `${Math.max(1, cw * fit)}px`;
  canvas.style.height = `${Math.max(1, ch * fit)}px`;
  applyViewTransform(canvas);
}

function resetView(): void {
  view.zoom = 1;
  view.panX = 0;
  view.panY = 0;
  const canvas = document.querySelector(".hwv-viewport canvas") as HTMLCanvasElement | null;
  if (canvas) applyViewTransform(canvas);
}

/** Bind wheel + drag once on the viewport element. */
function bindMapInteractions(viewport: HTMLElement): void {
  // Always re-bind when the viewport node is new (open after close)
  if ((viewport as any).__hwvBound) return;
  (viewport as any).__hwvBound = true;
  view.bound = true;

  viewport.addEventListener(
    "wheel",
    (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      view.zoom = Math.min(12, Math.max(0.25, view.zoom * factor));
      const canvas = viewport.querySelector("canvas");
      if (canvas) applyViewTransform(canvas);
      const zel = document.querySelector(".hwv-zoom-label");
      if (zel) zel.textContent = `zoom ${view.zoom.toFixed(2)}×`;
    },
    { passive: false },
  );

  viewport.addEventListener("mousedown", (e: MouseEvent) => {
    if (e.button !== 0) return;
    view.dragging = true;
    view.lastX = e.clientX;
    view.lastY = e.clientY;
    viewport.classList.add("hwv-dragging");
  });

  window.addEventListener("mousemove", (e: MouseEvent) => {
    if (!view.dragging) return;
    view.panX += e.clientX - view.lastX;
    view.panY += e.clientY - view.lastY;
    view.lastX = e.clientX;
    view.lastY = e.clientY;
    const canvas = viewport.querySelector("canvas");
    if (canvas) applyViewTransform(canvas);
  });

  window.addEventListener("mouseup", () => {
    if (!view.dragging) return;
    view.dragging = false;
    viewport.classList.remove("hwv-dragging");
  });
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

function injectStyles(): void {
  if (document.getElementById("hwv-style")) return;
  const style = document.createElement("style");
  style.id = "hwv-style";
  style.textContent = `
    .hwv-root {
      position: fixed; inset: 0; z-index: 9000;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.55);
      pointer-events: auto;
      font-family: inherit;
    }
    .hwv-frame {
      position: relative;
      width: 80vw; height: 80vh; max-width: 1400px;
      display: flex; flex-direction: row;
      background: rgba(12, 12, 18, 0.97);
      border: 1px solid #456; border-radius: 10px;
      overflow: hidden; box-shadow: 0 12px 48px rgba(0,0,0,0.5);
      color: #ddd; font-size: 12px;
    }
    .hwv-close {
      position: absolute; top: 8px; right: 10px; z-index: 5;
      width: 28px; height: 28px; line-height: 26px; text-align: center;
      background: #322; border: 1px solid #644; border-radius: 4px;
      color: #fcc; font-size: 16px; cursor: pointer; padding: 0;
    }
    .hwv-close:hover { background: #533; }
    .hwv-side {
      width: 320px; min-width: 280px; max-width: 38%;
      overflow-y: auto; padding: 12px 14px;
      border-right: 1px solid #334;
      box-sizing: border-box;
    }
    .hwv-side h2 {
      margin: 0 0 8px; font-size: 14px; color: #9cf; letter-spacing: 0.04em;
    }
    .hwv-details {
      border: 1px solid #334; border-radius: 4px; margin: 6px 0;
      background: rgba(0,0,0,0.2);
    }
    .hwv-details > summary {
      cursor: pointer; padding: 6px 8px; color: #9cf; font-weight: bold;
      list-style: none; display: flex; align-items: center; gap: 8px;
      user-select: none;
    }
    .hwv-details > summary::-webkit-details-marker { display: none; }
    .hwv-details > summary::before { content: "▸"; color: #678; width: 12px; }
    .hwv-details[open] > summary::before { content: "▾"; }
    .hwv-details-body { padding: 4px 8px 8px; border-top: 1px solid #334; }
    .hwv-sec {
      margin: 10px 0 2px; padding-bottom: 2px; color: #89f;
      font-weight: bold; border-bottom: 1px solid #334;
    }
    .hwv-row {
      display: flex; align-items: center; gap: 6px; margin: 3px 0;
    }
    .hwv-row label { flex: 0 0 108px; color: #aaa; font-size: 11px; }
    .hwv-row input[type="range"] { flex: 1; }
    .hwv-row input[type="checkbox"] { width: 15px; height: 15px; }
    .hwv-row input[type="number"], .hwv-row input[type="text"] {
      background: #111; color: #eee; border: 1px solid #445;
      border-radius: 3px; padding: 2px 4px; font: inherit; width: 64px;
    }
    .hwv-row input[type="text"] { flex: 1; width: auto; }
    .hwv-mini { color: #778; font-size: 10px; }
    .hwv-val { flex: 0 0 30px; text-align: right; color: #fff; }
    .hwv-btns { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    .hwv-btn {
      background: #234; border: 1px solid #456; color: #cde;
      border-radius: 4px; padding: 5px 10px; cursor: pointer; font: inherit;
    }
    .hwv-btn:hover { background: #345; }
    .hwv-btn-primary { background: #246; border-color: #48a; }
    .hwv-map {
      flex: 1; display: flex; flex-direction: column;
      min-width: 0; padding: 10px 12px; background: #0a0a10;
    }
    .hwv-map-title {
      display: flex; justify-content: space-between; align-items: center;
      gap: 8px; margin-bottom: 6px; color: #9ab; font-size: 11px; flex-wrap: wrap;
    }
    .hwv-viewport {
      flex: 1; position: relative; overflow: hidden;
      border: 1px solid #333; background: #121218;
      border-radius: 4px; cursor: grab; min-height: 200px;
    }
    .hwv-viewport.hwv-dragging { cursor: grabbing; }
    .hwv-viewport canvas {
      image-rendering: pixelated;
      image-rendering: crisp-edges;
      position: absolute; left: 50%; top: 50%;
      /* center then apply translate/scale via JS */
      margin-left: 0; margin-top: 0;
      transform-origin: center center;
      max-width: none; max-height: none;
      border: 1px solid #2a2a33; background: #1a1a22;
    }
    .hwv-hint { font-size: 10px; color: #667; margin-top: 4px; }
    .hwv-legend {
      display: flex; flex-wrap: wrap; gap: 4px 8px; margin-top: 8px;
      max-width: 100%;
    }
    .hwv-legend span {
      display: flex; align-items: center; gap: 3px; font-size: 10px; color: #99a;
    }
    .hwv-swatch {
      width: 9px; height: 9px; border-radius: 2px; border: 1px solid #556;
      display: inline-block;
    }
  `;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// React panel
// ---------------------------------------------------------------------------


function colorSwatch(color: string, size = 12): unknown {
  return h("i", {
    className: "hwv-swatch",
    style: {
      background: color,
      width: size,
      height: size,
      borderRadius: 2,
      border: "1px solid #556",
      display: "inline-block",
      flexShrink: 0,
    },
  });
}

/** Multi-select chips for terrain codes. */
function codeMultiSelect(
  selected: number[],
  onChange: (ids: number[]) => void,
): unknown {
  return h(
    "div",
    { className: "hwv-chips" },
    ...CODE_OPTIONS.map((opt) => {
      const on = selected.includes(opt.id);
      return h(
        "button",
        {
          type: "button",
          className: on ? "hwv-chip hwv-chip-on" : "hwv-chip",
          title: `${opt.label} (${opt.id})`,
          onClick: () => {
            if (on) onChange(selected.filter((x) => x !== opt.id));
            else onChange([...selected, opt.id]);
          },
        },
        colorSwatch(opt.color, 10),
        opt.label,
      );
    }),
  );
}

/** Single code selector with color. */
function codeSelect(
  value: number,
  onChange: (id: number) => void,
): unknown {
  return h(
    "div",
    { className: "hwv-chips" },
    ...CODE_OPTIONS.map((opt) => {
      const on = value === opt.id;
      return h(
        "button",
        {
          type: "button",
          className: on ? "hwv-chip hwv-chip-on" : "hwv-chip",
          title: `${opt.label} (${opt.id})`,
          onClick: () => onChange(opt.id),
        },
        colorSwatch(opt.color, 10),
        opt.label,
      );
    }),
  );
}

function boundsEditor(
  bounds: MapBoundsPercent,
  onChange: (b: MapBoundsPercent) => void,
): unknown {
  const field = (key: keyof MapBoundsPercent, label: string) =>
    h(
      "div",
      { className: "hwv-row" },
      h("label", null, label),
      h("input", {
        type: "number",
        min: 0,
        max: 100,
        step: 1,
        value: bounds[key],
        onChange: (e: { target: { value: string } }) => {
          const n = Math.min(100, Math.max(0, Number(e.target.value) || 0));
          onChange({ ...bounds, [key]: n });
        },
      }),
      h("span", { className: "hwv-mini" }, "%"),
    );
  return h(
    "div",
    null,
    h("div", { style: { color: "#778", fontSize: 10, margin: "4px 0" } },
      "Bounds = % of full map (top/bottom of height, left/right of width)"),
    field("top", "Top %"),
    field("bottom", "Bottom %"),
    field("left", "Left %"),
    field("right", "Right %"),
  );
}

function nearMaskEditor(
  mask: [number, number, number, number],
  onChange: (m: [number, number, number, number]) => void,
): unknown {
  const labels = ["Up", "Right", "Down", "Left"];
  return h(
    "div",
    { className: "hwv-row", style: { flexWrap: "wrap" } },
    h("label", null, "Near mask"),
    ...labels.map((lab, i) =>
      h(
        "label",
        { style: { flex: "0 0 auto", display: "flex", gap: 4, alignItems: "center" } },
        h("input", {
          type: "checkbox",
          checked: !!mask[i],
          onChange: (e: { target: { checked: boolean } }) => {
            const m = [...mask] as [number, number, number, number];
            m[i] = e.target.checked ? 1 : 0;
            onChange(m);
          },
        }),
        lab,
      ),
    ),
  );
}


function section(
  title: string,
  enabled: boolean | null,
  onEnable: ((v: boolean) => void) | null,
  children: unknown[],
): unknown {
  return h(
    "details",
    { className: "hwv-details" },
    h(
      "summary",
      null,
      enabled === null
        ? null
        : h("input", {
          type: "checkbox",
          checked: enabled,
          onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
          onChange: (e: { target: { checked: boolean } }) => onEnable?.(!!e.target.checked),
        }),
      title,
    ),
    h("div", { className: "hwv-details-body" }, ...children),
  );
}

function codeList(codes: number[]): string {
  return codes.join(",");
}

function parseCodes(s: string, fallback: number[]): number[] {
  const parts = s.split(/[,\s]+/).map((x) => Number(x.trim())).filter((n) => Number.isFinite(n));
  return parts.length ? parts : fallback;
}

function MapViewerPanel(): unknown {
  const [draft, setDraft] = react.useState(currentDraft) as [
    DraftParams,
    (v: DraftParams) => void,
  ];
  const [, bump] = react.useState(0) as [unknown, (fn: (n: number) => number) => void];
  const canvasRef = react.useRef(null) as { current: HTMLCanvasElement | null };

  react.useEffect(() => {
    const unsub = api.events.on("action:changed", () => {
      if (!isViewerSelected()) panelDismissed = false;
      bump((n) => n + 1);
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isViewerSelected() && !panelDismissed) {
        e.preventDefault();
        closeMapViewerPanel();
        bump((n) => n + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      try { unsub(); } catch { /* */ }
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  react.useEffect(() => {
    if (!isViewerSelected() || panelDismissed) return;
    requestAnimationFrame(() => paintIfVisible());
  });

  if (!isViewerSelected()) {
    panelDismissed = false;
    return null;
  }
  if (panelDismissed) return null;

  const setTunnel = (band: BandParams) => setDraft({ ...draft, tunnel: band });
  const setCave = (band: BandParams) => setDraft({ ...draft, cave: band });
  const setSeal = (seal: SealParams) => setDraft({ ...draft, seal });
  const setFluids = (fluids: FluidsParams) => setDraft({ ...draft, fluids });
  const setWall = (wallGrow: WallGrowParams) => setDraft({ ...draft, wallGrow });
  const setForm = (formGrow: FormGrowParams) => setDraft({ ...draft, formGrow });

  const updateWallRule = (idx: number, patch: Record<string, unknown>) => {
    const rules = draft.wallGrow.rules.map((r, i) => i === idx ? { ...r, ...patch } : r);
    setWall({ ...draft.wallGrow, rules });
  };
  const updateFormRule = (idx: number, patch: Record<string, unknown>) => {
    const rules = draft.formGrow.rules.map((r, i) => i === idx ? { ...r, ...patch } : r);
    setForm({ ...draft.formGrow, rules });
  };

  const apply = () => {
    toast("Generating map — please wait…");
    runtime.seed = draft.seed.trim() || runtime.seed;
    runtime.params = cloneParams(draft);
    const ok = refreshHiddenWorld();
    persistRecord();
    setDraft(currentDraft());
    bump((n) => n + 1);
    requestAnimationFrame(() => paintIfVisible());
    if (!ok) toast("Generation failed");
  };

  const doClose = () => {
    closeMapViewerPanel();
    bump((n) => n + 1);
  };

  const entries = ghostPalette();

  return h(
    "div",
    {
      className: "hwv-root",
      onClick: (e: { target: EventTarget; currentTarget: EventTarget }) => {
        if (e.target === e.currentTarget) doClose();
      },
    },
    h(
      "div",
      { className: "hwv-frame" },
      h(
        "button",
        {
          className: "hwv-close",
          title: "Close (Esc)",
          onClick: (e: { stopPropagation?: () => void }) => {
            e.stopPropagation?.();
            doClose();
          },
        },
        "×",
      ),

      // ----- LEFT -----
      h(
        "div",
        { className: "hwv-side" },
        h("h2", null, "HIDEN WORLD 2 — Map Viewer"),

        // Generate ON TOP
        h(
          "div",
          { className: "hwv-btns", style: { marginTop: 0, marginBottom: 8 } },
          h(
            "button",
            { className: "hwv-btn hwv-btn-primary", onClick: apply },
            "↻ Generate / Refresh",
          ),
          h(
            "button",
            {
              className: "hwv-btn",
              onClick: () => {
                setDraft(defaultDraft());
                toast("Draft reset");
              },
            },
            "Reset",
          ),
        ),

        section("Seed", null, null, [
          h(
            "div",
            { className: "hwv-row" },
            h("label", null, "Seed"),
            h("input", {
              type: "text",
              value: draft.seed,
              onChange: (e: { target: { value: string } }) =>
                setDraft({ ...draft, seed: e.target.value }),
            }),
            h(
              "button",
              {
                className: "hwv-btn",
                onClick: () => setDraft({ ...draft, seed: randomSeed() }),
              },
              "🎲",
            ),
          ),
        ]),

        section("1 · Skyline", null, null, [
          skyWaveRow("Big wave", draft.sky.bigWave, DEFAULT_PARAMS.sky.bigWave, (wave) =>
            setDraft({ ...draft, sky: { ...draft.sky, bigWave: wave } })),
          skyWaveRow("Medium", draft.sky.mediumWave, DEFAULT_PARAMS.sky.mediumWave, (wave) =>
            setDraft({ ...draft, sky: { ...draft.sky, mediumWave: wave } })),
          skyWaveRow("Low", draft.sky.lowWave, DEFAULT_PARAMS.sky.lowWave, (wave) =>
            setDraft({ ...draft, sky: { ...draft.sky, lowWave: wave } })),
          skyWaveRow("Roughness", draft.sky.roughness, DEFAULT_PARAMS.sky.roughness, (wave) =>
            setDraft({ ...draft, sky: { ...draft.sky, roughness: wave } })),
          sliderRow(
            "Ground %",
            draft.baseHeightPercent,
            ...bounds15(DEFAULT_PARAMS.baseHeightPercent, 5, 90),
            (v) => setDraft({ ...draft, baseHeightPercent: v }),
          ),
        ]),

        section(
          "2 · Tunnels",
          draft.tunnel.enabled,
          (v) => setTunnel({ ...draft.tunnel, enabled: v }),
          [
            sliderRow("Thickness %", draft.tunnel.thicknessPercent, 0, 50, (v) =>
              setTunnel({ ...draft.tunnel, thicknessPercent: v })),
            sliderRow("Definition %", draft.tunnel.definitionPercent, 0, 95, (v) =>
              setTunnel({ ...draft.tunnel, definitionPercent: v })),
            numberRow("Move X", draft.tunnel.offsetX, (v) => setTunnel({ ...draft.tunnel, offsetX: v }), 10),
            numberRow("Move Y", draft.tunnel.offsetY, (v) => setTunnel({ ...draft.tunnel, offsetY: v }), 10),
          ],
        ),

        section(
          "3 · Caves",
          draft.cave.enabled,
          (v) => setCave({ ...draft.cave, enabled: v }),
          [
            sliderRow("Thickness %", draft.cave.thicknessPercent, 0, 50, (v) =>
              setCave({ ...draft.cave, thicknessPercent: v })),
            sliderRow("Definition %", draft.cave.definitionPercent, 0, 95, (v) =>
              setCave({ ...draft.cave, definitionPercent: v })),
            numberRow("Move X", draft.cave.offsetX, (v) => setCave({ ...draft.cave, offsetX: v }), 10),
            numberRow("Move Y", draft.cave.offsetY, (v) => setCave({ ...draft.cave, offsetY: v }), 10),
          ],
        ),

        section(
          "4 · Seal",
          draft.seal.enabled,
          (v) => setSeal({ ...draft.seal, enabled: v }),
          [
            checkRow("Seal tunnels", draft.seal.sealTunnels, (v) =>
              setSeal({ ...draft.seal, sealTunnels: v })),
            checkRow("Seal caves", draft.seal.sealCaves, (v) =>
              setSeal({ ...draft.seal, sealCaves: v })),
            checkRow("Diagonal (8-conn)", draft.seal.diagonal, (v) =>
              setSeal({ ...draft.seal, diagonal: v })),
            sliderRow("Max iterations", draft.seal.maxIterations, 50, 800, (v) =>
              setSeal({ ...draft.seal, maxIterations: v })),
            sliderRow("Surface keep %", draft.seal.surfaceKeepPercent, 0, 40, (v) =>
              setSeal({ ...draft.seal, surfaceKeepPercent: v })),
          ],
        ),

        section(
          "5 · Fluids",
          draft.fluids.enabled,
          (v) => setFluids({ ...draft.fluids, enabled: v }),
          [
            checkRow("Water", draft.fluids.water, (v) => setFluids({ ...draft.fluids, water: v })),
            checkRow("Lava", draft.fluids.lava, (v) => setFluids({ ...draft.fluids, lava: v })),
            checkRow("Surface water", draft.fluids.surfaceWater, (v) =>
              setFluids({ ...draft.fluids, surfaceWater: v })),
            numberRow("Water min depth", draft.fluids.waterMinDepth, (v) =>
              setFluids({ ...draft.fluids, waterMinDepth: v })),
            numberRow("Lava min depth", draft.fluids.lavaMinDepth, (v) =>
              setFluids({ ...draft.fluids, lavaMinDepth: v })),
            numberRow("Surface depth", draft.fluids.surfaceWaterDepth, (v) =>
              setFluids({ ...draft.fluids, surfaceWaterDepth: v })),
          ],
        ),

                section(
          "6 · Wall grow",
          draft.wallGrow.enabled,
          (v) => setWall({ ...draft.wallGrow, enabled: v }),
          [
            h(
              "div",
              { className: "hwv-btns", style: { marginBottom: 6 } },
              h(
                "button",
                {
                  className: "hwv-btn",
                  onClick: () => {
                    const blank: WallRule = {
                      enabled: true,
                      name: `Wall ${draft.wallGrow.rules.length + 1}`,
                      inBorderOf: [TERRAIN.ROCK],
                      typeToReplace: [TERRAIN.TUNNEL],
                      replaceBy: TERRAIN.MOSS,
                      nearMask: [1, 0, 0, 0],
                      bounds: { top: 10, bottom: 40, left: 0, right: 100 },
                      growSize: 3,
                    };
                    setWall({
                      ...draft.wallGrow,
                      rules: [...draft.wallGrow.rules, blank],
                    });
                  },
                },
                "+ Add wall rule",
              ),
            ),
            ...draft.wallGrow.rules.flatMap((rule, idx) => [
              h(
                "div",
                {
                  className: focusedRuleKey === `wall:${idx}` ? "hwv-rule-focus" : "",
                  onFocus: () => {
                    focusedRuleKey = `wall:${idx}`;
                    paintIfVisible();
                  },
                  onClick: () => {
                    focusedRuleKey = `wall:${idx}`;
                    paintIfVisible();
                    bump((n) => n + 1);
                  },
                },
                section(
                  rule.name,
                  rule.enabled,
                  (v) => updateWallRule(idx, { enabled: v }),
                  [
                    h(
                      "div",
                      { className: "hwv-row" },
                      h("label", null, "Name"),
                      h("input", {
                        type: "text",
                        value: rule.name,
                        onChange: (e: { target: { value: string } }) =>
                          updateWallRule(idx, { name: e.target.value }),
                      }),
                      h(
                        "button",
                        {
                          className: "hwv-btn",
                          title: "Remove rule",
                          onClick: () => {
                            setWall({
                              ...draft.wallGrow,
                              rules: draft.wallGrow.rules.filter((_, i) => i !== idx),
                            });
                            if (focusedRuleKey === `wall:${idx}`) focusedRuleKey = null;
                          },
                        },
                        "−",
                      ),
                    ),
                    h("div", { className: "hwv-mini" }, "InBorderOf (neighbors)"),
                    codeMultiSelect(rule.inBorderOf, (ids) =>
                      updateWallRule(idx, { inBorderOf: ids })),
                    h("div", { className: "hwv-mini" }, "TypeToReplace"),
                    codeMultiSelect(rule.typeToReplace, (ids) =>
                      updateWallRule(idx, { typeToReplace: ids })),
                    h("div", { className: "hwv-mini" }, "ReplaceBy"),
                    codeSelect(rule.replaceBy, (id) =>
                      updateWallRule(idx, { replaceBy: id })),
                    nearMaskEditor(rule.nearMask, (m) =>
                      updateWallRule(idx, { nearMask: m })),
                    boundsEditor(rule.bounds, (b) => {
                      updateWallRule(idx, { bounds: b });
                      focusedRuleKey = `wall:${idx}`;
                      // preview uses runtime.params — sync draft bounds into a temp for stroke
                      runtime.params = {
                        ...runtime.params,
                        wallGrow: {
                          ...draft.wallGrow,
                          rules: draft.wallGrow.rules.map((r, i) =>
                            i === idx ? { ...r, bounds: b } : r
                          ),
                        },
                      };
                      paintIfVisible();
                    }),
                    numberRow("Grow size", rule.growSize, (v) =>
                      updateWallRule(idx, { growSize: v })),
                  ],
                ),
              ),
            ]),
          ],
        ),

        section(
          "7 · Form grow",
          draft.formGrow.enabled,
          (v) => setForm({ ...draft.formGrow, enabled: v }),
          [
            h(
              "div",
              { className: "hwv-btns", style: { marginBottom: 6 } },
              h(
                "button",
                {
                  className: "hwv-btn",
                  onClick: () => {
                    const blank: FormRule = {
                      enabled: true,
                      name: `Form ${draft.formGrow.rules.length + 1}`,
                      inBorderOf: [TERRAIN.CAVE],
                      replaceBy: TERRAIN.SPORE_SOIL,
                      bounds: { top: 30, bottom: 70, left: 0, right: 100 },
                      growSize: 5,
                    };
                    setForm({
                      ...draft.formGrow,
                      rules: [...draft.formGrow.rules, blank],
                    });
                  },
                },
                "+ Add form rule",
              ),
            ),
            ...draft.formGrow.rules.flatMap((rule, idx) => [
              h(
                "div",
                {
                  className: focusedRuleKey === `form:${idx}` ? "hwv-rule-focus" : "",
                  onClick: () => {
                    focusedRuleKey = `form:${idx}`;
                    paintIfVisible();
                    bump((n) => n + 1);
                  },
                },
                section(
                  rule.name,
                  rule.enabled,
                  (v) => updateFormRule(idx, { enabled: v }),
                  [
                    h(
                      "div",
                      { className: "hwv-row" },
                      h("label", null, "Name"),
                      h("input", {
                        type: "text",
                        value: rule.name,
                        onChange: (e: { target: { value: string } }) =>
                          updateFormRule(idx, { name: e.target.value }),
                      }),
                      h(
                        "button",
                        {
                          className: "hwv-btn",
                          title: "Remove rule",
                          onClick: () => {
                            setForm({
                              ...draft.formGrow,
                              rules: draft.formGrow.rules.filter((_, i) => i !== idx),
                            });
                            if (focusedRuleKey === `form:${idx}`) focusedRuleKey = null;
                          },
                        },
                        "−",
                      ),
                    ),
                    h("div", { className: "hwv-mini" }, "InBorderOf"),
                    codeMultiSelect(rule.inBorderOf, (ids) =>
                      updateFormRule(idx, { inBorderOf: ids })),
                    h("div", { className: "hwv-mini" }, "ReplaceBy"),
                    codeSelect(rule.replaceBy, (id) =>
                      updateFormRule(idx, { replaceBy: id })),
                    boundsEditor(rule.bounds, (b) => {
                      updateFormRule(idx, { bounds: b });
                      focusedRuleKey = `form:${idx}`;
                      runtime.params = {
                        ...runtime.params,
                        formGrow: {
                          ...draft.formGrow,
                          rules: draft.formGrow.rules.map((r, i) =>
                            i === idx ? { ...r, bounds: b } : r
                          ),
                        },
                      };
                      paintIfVisible();
                    }),
                    numberRow("Grow size", rule.growSize, (v) =>
                      updateFormRule(idx, { growSize: v })),
                  ],
                ),
              ),
            ]),
          ],
        ),

      // ----- RIGHT: map -----
      h(
        "div",
        { className: "hwv-map" },
        h(
          "div",
          { className: "hwv-map-title" },
          h(
            "span",
            null,
            `${runtime.width}×${runtime.height} · base 1/${getPreviewDivisor()}`,
          ),
          h(
            "span",
            { className: "hwv-zoom-label" },
            `zoom ${view.zoom.toFixed(2)}×`,
          ),
          h(
            "button",
            {
              className: "hwv-btn",
              title: "Reset pan & zoom",
              onClick: () => {
                resetView();
                const zel = document.querySelector(".hwv-zoom-label");
                if (zel) zel.textContent = "zoom 1.00×";
              },
            },
            "Reset view",
          ),
        ),
        h(
          "div",
          {
            className: "hwv-viewport",
            ref: (el: HTMLElement | null) => {
              if (el) {
                bindMapInteractions(el);
                const c = el.querySelector("canvas") as HTMLCanvasElement | null;
                if (c) {
                  paintPreviewCanvas(c);
                  fitCanvasToViewport(el, c);
                }
              }
            },
          },
          h("canvas", { ref: canvasRef }),
        ),
        h(
          "div",
          { className: "hwv-hint" },
          "Scroll = zoom · drag = pan · base 1/2 (or 1/4 on huge maps)",
        ),
        h(
          "div",
          { className: "hwv-legend" },
          ...entries.map((e) =>
            h(
              "span",
              { title: e.label },
              h("i", {
                className: "hwv-swatch",
                style: {
                  background: e.alpha < 16 ? "#1a1a22" : e.hex,
                },
              }),
              e.codeLabel,
            ),
          ),
        ),
      ),
    ),
  );
}

function paintIfVisible(): void {
  if (!isViewerSelected()) return;
  const viewport = document.querySelector(".hwv-viewport") as HTMLElement | null;
  const canvas = document.querySelector(".hwv-viewport canvas") as HTMLCanvasElement | null;
  if (canvas) {
    paintPreviewCanvas(canvas);
    if (viewport) fitCanvasToViewport(viewport, canvas);
  }
}

export async function registerMapViewer(): Promise<void> {
  injectStyles();

  try {
    api.i18n?.register("en", {
      [KEY.viewerName]: "Map Viewer",
      [KEY.viewerDesc]:
        "Open the full hidden-world map (low-res) with generation settings on the left.",
    });
  } catch (err) {
    console.warn(`${LOG} viewer i18n failed`, err);
  }

  try {
    await api.sprites.loadFromMod(VIEWER_ICON_SPRITE_ID, VIEWER_ICON_PATH);
  } catch (err) {
    console.warn(`${LOG} viewer icon load failed`, err);
  }

  try {
    api.items.register({
      id: VIEWER_ITEM_ID,
      nameKey: KEY.viewerName,
      descriptionKey: KEY.viewerDesc,
      name: "Map Viewer",
      sprite: { id: VIEWER_ICON_SPRITE_ID },
    });
  } catch (err) {
    console.warn(`${LOG} viewer item register failed`, err);
  }

  try {
    if (typeof api.player.inventory.hasById === "function") {
      if (!api.player.inventory.hasById(VIEWER_ITEM_ID)) {
        api.player.inventory.addById(VIEWER_ITEM_ID);
      }
    } else {
      api.player.inventory.addById(VIEWER_ITEM_ID);
    }
  } catch (err) {
    console.warn(`${LOG} viewer inventory add failed`, err);
  }

  try {
    api.ui.overlays.register("global", VIEWER_OVERLAY_ID, () => MapViewerPanel());
  } catch (err) {
    console.warn(`${LOG} viewer overlay register failed`, err);
  }

  // Keep preview canvas in sync when selection changes / after gen
  try {
    api.events.on("action:changed", () => {
      requestAnimationFrame(() => paintIfVisible());
    });
    api.events.on("frame:render", () => {
      // cheap: only paint when viewer selected and canvas empty size?
      // skip per-frame — paint on action + after generate only
    });
  } catch { /* */ }

  console.log(`${LOG} Map Viewer tool registered`);
}

/** Call after generation so the preview updates if the viewer is open. */
export function refreshMapViewerPreview(): void {
  paintIfVisible();
}
