/**
 * User-facing generation progress: toast alerts + fixed banner overlay.
 * Map generation can take hundreds of ms on large maps — warn the player.
 */

import { LOG } from "./constants.ts";
import { api } from "./api.ts";

const BANNER_ID = "hw2-gen-banner";
const STYLE_ID = "hw2-gen-banner-style";

let busy = false;
let lastToastAt = 0;

export function isGenerating(): boolean {
  return busy;
}

function ensureBannerStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${BANNER_ID} {
      position: fixed; top: 12%; left: 50%; transform: translateX(-50%);
      z-index: 10000; min-width: 280px; max-width: 90vw;
      padding: 14px 18px; border-radius: 8px;
      background: rgba(8, 10, 20, 0.95); border: 1px solid #6af;
      color: #eef; font: 13px/1.4 system-ui, sans-serif;
      text-align: center; pointer-events: none;
      box-shadow: 0 8px 32px rgba(0,0,0,0.45);
    }
    #${BANNER_ID} .hw2-title { font-weight: 700; color: #9cf; margin-bottom: 6px; }
    #${BANNER_ID} .hw2-stage { color: #ccd; margin-bottom: 8px; }
    #${BANNER_ID} .hw2-bar {
      height: 8px; background: #223; border-radius: 4px; overflow: hidden;
    }
    #${BANNER_ID} .hw2-bar > i {
      display: block; height: 100%; width: 0%;
      background: linear-gradient(90deg, #3af, #8f6);
      transition: width 0.15s ease-out;
    }
    #${BANNER_ID} .hw2-hint { margin-top: 8px; font-size: 11px; color: #889; }
  `;
  document.head.appendChild(style);
}

function showBanner(stage: string, percent: number): void {
  ensureBannerStyle();
  let el = document.getElementById(BANNER_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = BANNER_ID;
    el.innerHTML = `
      <div class="hw2-title">Generating hidden world…</div>
      <div class="hw2-stage"></div>
      <div class="hw2-bar"><i></i></div>
      <div class="hw2-hint">This can take a few seconds on large maps. Please wait.</div>
    `;
    document.body.appendChild(el);
  }
  const stageEl = el.querySelector(".hw2-stage");
  const bar = el.querySelector(".hw2-bar > i") as HTMLElement | null;
  if (stageEl) stageEl.textContent = stage;
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
}

function hideBanner(): void {
  document.getElementById(BANNER_ID)?.remove();
}

function toast(msg: string): void {
  try {
    api.ui.toast(msg, {});
  } catch (err) {
    console.warn(`${LOG} toast failed`, err);
  }
}

/** Call once before generation starts. */
export function notifyGenerationStart(width: number, height: number): void {
  busy = true;
  lastToastAt = Date.now();
  const cells = width * height;
  toast(
    `Generating hidden world (${width}×${height}, ${cells.toLocaleString()} cells) — please wait…`,
  );
  showBanner("Starting…", 0);
  console.log(`${LOG} generation start ${width}×${height}`);
}

/** Called from terrain pipeline per stage. */
export function notifyGenerationProgress(stage: string, percent: number): void {
  if (!busy) return;
  showBanner(stage, percent);
  // Throttle mid-toasts so we don't spam the toast API
  const now = Date.now();
  if (now - lastToastAt > 1200 && percent > 0 && percent < 100) {
    lastToastAt = now;
    toast(`${Math.round(percent)}% — ${stage}`);
  }
}

/** Call when generation finished (ok or fail). */
export function notifyGenerationEnd(ok: boolean, elapsedMs?: number): void {
  busy = false;
  hideBanner();
  const time =
    typeof elapsedMs === "number" && isFinite(elapsedMs)
      ? ` (${Math.round(elapsedMs)} ms)`
      : "";
  if (ok) {
    toast(`Hidden world ready${time}`);
    console.log(`${LOG} generation ok${time}`);
  } else {
    toast(`Hidden world generation failed${time}`);
    console.warn(`${LOG} generation failed${time}`);
  }
}
