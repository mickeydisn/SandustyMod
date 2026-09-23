import { CODE_OPTIONS } from "../world/constants.ts";
import { ghostPalette } from "../world/render.ts";
import { runtime } from "../world/state.ts";
import type { MapBoundsPercent } from "../world/types.ts";
import { compositeTagPixel, isTagsEnabled, TAG } from "../world/tags.ts";

export const view = {
  zoom: 1,
  panX: 0,
  panY: 0,
  dragging: false,
  lastX: 0,
  lastY: 0,
};

export let focusedModId: string | null = null;
export function setFocusedModId(id: string | null): void {
  focusedModId = id;
}

function chooseBaseDivisor(mapW: number, mapH: number): 2 | 4 {
  const longest = Math.max(mapW, mapH);
  if (Math.ceil(longest / 2) <= 900) return 2;
  return 4;
}

let lastDiv = 2;
export function getPreviewDivisor(): number {
  return lastDiv;
}

function codeColor(id: number): string {
  return CODE_OPTIONS.find((o) => o.id === id)?.color ?? "#9cf";
}

function drawFocusedBounds(
  ctx: CanvasRenderingContext2D,
  pw: number,
  ph: number,
): void {
  if (!focusedModId) return;
  const mod = runtime.params.modifiers?.find((m) => m.id === focusedModId);
  if (!mod || !("bounds" in mod)) return;
  const bounds = mod.bounds as MapBoundsPercent;
  let stroke = "#9cf";
  if (mod.kind === "wall") stroke = codeColor(mod.replaceBy);
  else if (mod.kind === "form") stroke = codeColor(mod.replaceBy);
  else if (mod.kind === "liquid") {
    stroke = mod.liquidType === "lava" ? "#b22222" : "#4682b4";
  }
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

export function applyViewTransform(canvas: HTMLCanvasElement): void {
  canvas.style.transformOrigin = "center center";
  canvas.style.transform =
    `translate(calc(-50% + ${view.panX}px), calc(-50% + ${view.panY}px)) scale(${view.zoom})`;
}

export function fitCanvasToViewport(viewport: HTMLElement, canvas: HTMLCanvasElement): void {
  const vw = viewport.clientWidth || 400;
  const vh = viewport.clientHeight || 300;
  const cw = canvas.width || 1;
  const ch = canvas.height || 1;
  const fit = Math.min(vw / cw, vh / ch) * 0.92;
  canvas.style.width = `${Math.max(1, cw * fit)}px`;
  canvas.style.height = `${Math.max(1, ch * fit)}px`;
  applyViewTransform(canvas);
}

export function paintPreviewCanvas(canvas: HTMLCanvasElement): void {
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
  lastDiv = div;
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
  const tagsOn = isTagsEnabled() && runtime.showTagsOverlay !== false;
  const mask = tagsOn ? runtime.tags : null;
  for (let py = 0; py < ph; py++) {
    const sy = Math.min(h - 1, py * div);
    for (let px = 0; px < pw; px++) {
      const sx = Math.min(w - 1, px * div);
      const code = data[sy * w + sx]!;
      const base = (table.get(code) ?? [0, 0, 0, 0]) as [number, number, number, number];
      const tag = mask ? mask[sy * w + sx]! : TAG.MATERIALISED;
      const [r, g, b, a] = compositeTagPixel(code, tag, base, tagsOn);
      const i = (py * pw + px) * 4;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  drawFocusedBounds(ctx, pw, ph);
  applyViewTransform(canvas);
}

export function paintIfVisible(): void {
  const viewport = document.querySelector(".hwv-viewport") as HTMLElement | null;
  const canvas = document.querySelector(".hwv-viewport canvas") as HTMLCanvasElement | null;
  if (canvas) {
    paintPreviewCanvas(canvas);
    if (viewport) fitCanvasToViewport(viewport, canvas);
  }
}

export function resetView(): void {
  view.zoom = 1;
  view.panX = 0;
  view.panY = 0;
  const canvas = document.querySelector(".hwv-viewport canvas") as HTMLCanvasElement | null;
  if (canvas) applyViewTransform(canvas);
}

export function bindMapInteractions(viewport: HTMLElement): void {
  if ((viewport as unknown as { __hwvBound?: boolean }).__hwvBound) return;
  (viewport as unknown as { __hwvBound?: boolean }).__hwvBound = true;

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
