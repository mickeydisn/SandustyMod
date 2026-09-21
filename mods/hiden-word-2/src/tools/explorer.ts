import {
  EXPLORER_ENERGY,
  EXPLORER_ICON_PATH,
  EXPLORER_ICON_SPRITE_ID,
  EXPLORER_ITEM_ID,
  EXPLORER_OVERLAY_ID,
  EXPLORER_RADIUS_DEFAULT,
  EXPLORER_RADIUS_MAX,
  EXPLORER_RADIUS_MIN,
  KEY,
  LOG,
  MOD,
} from "../world/constants.ts";
import { api } from "../api/api.ts";
import {
  exploreNearFog,
  isExplorationEnabled,
  patchGhostRegion,
} from "../world/exploration.ts";
import { runtime } from "../world/state.ts";
import { persistExploredOnly } from "../world/persistence.ts";

declare const sandkit: { react: any; api: any };
const react = sandkit.react;
const h = (
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): unknown => react.createElement(type, props, ...children);

const rawApi = (): any => (sandkit as any).api ?? api;

export let explorerRadius = EXPLORER_RADIUS_DEFAULT;

export function isExplorerSelected(): boolean {
  const a = rawApi();
  try {
    if (typeof a.items?.isActiveById === "function") {
      return a.items.isActiveById(EXPLORER_ITEM_ID) === true;
    }
  } catch { /* */ }
  try {
    return a.items?.getActive?.()?.id === EXPLORER_ITEM_ID;
  } catch {
    return false;
  }
}

function toast(msg: string): void {
  try { rawApi().ui?.toast?.(msg, {}); } catch {
    try { rawApi().ui?.toast?.(msg); } catch { /* */ }
  }
}

function injectStyles(): void {
  if (document.getElementById("hw-exp-style")) return;
  const style = document.createElement("style");
  style.id = "hw-exp-style";
  style.textContent = `
    .hw-exp-bar {
      position: fixed; left: 50%; transform: translateX(-50%);
      bottom: 5.5em; z-index: 1000;
      display: flex; align-items: center; gap: 10px;
      padding: 8px 14px; border-radius: 8px;
      background: rgba(10,12,20,0.92); border: 1px solid #654;
      color: #cde; font-size: 12px;
    }
    .hw-exp-bar input[type="number"] {
      width: 56px; background: #111 !important; color: #eee !important;
      border: 1px solid #445; border-radius: 3px; padding: 3px 6px;
      color-scheme: dark; font: inherit;
    }
    .hw-exp-bar button {
      background: #342; border: 1px solid #564; color: #cde;
      border-radius: 4px; padding: 4px 8px; cursor: pointer; font: inherit;
    }
  `;
  document.head.appendChild(style);
}

function RadiusOverlay(): unknown {
  const [r, setR] = react.useState(explorerRadius) as [number, (n: number) => void];
  const [, bump] = react.useState(0) as [number, (fn: (n: number) => number) => void];
  react.useEffect(() => {
    const unsub = rawApi().events.on("action:changed", () => bump((n) => n + 1));
    return () => { try { unsub(); } catch { /* */ } };
  }, []);
  if (!isExplorerSelected()) return null;
  const setRadius = (n: number) => {
    const v = Math.min(
      EXPLORER_RADIUS_MAX,
      Math.max(EXPLORER_RADIUS_MIN, Math.round(n) || EXPLORER_RADIUS_MIN),
    );
    explorerRadius = v;
    setR(v);
  };
  return h(
    "div",
    { className: "hw-exp-bar" },
    h("span", null, isExplorationEnabled() ? "Explore fog r" : "Exploration OFF"),
    h("button", { type: "button", onClick: () => setRadius(r - 1) }, "−"),
    h("input", {
      type: "number",
      min: EXPLORER_RADIUS_MIN,
      max: EXPLORER_RADIUS_MAX,
      value: r,
      onChange: (e: { target: { value: string } }) => setRadius(Number(e.target.value)),
    }),
    h("button", { type: "button", onClick: () => setRadius(r + 1) }, "+"),
  );
}

function readMouseCell(): { x: number; y: number } | null {
  const a = rawApi();
  try {
    const c = a.input?.getMousePositionAtCell?.() ?? a.input?.getMouseCellPosition?.();
    if (c && typeof c.x === "number") return { x: c.x, y: c.y };
  } catch { /* */ }
  return null;
}

function tryEnergy(): boolean {
  const a = rawApi();
  try {
    if (typeof a.energy?.consume === "function") {
      const result = a.energy.consume(EXPLORER_ENERGY);
      if (result === false) return false;
      if (result && typeof result === "object" && result.ok === false) return false;
    }
  } catch { /* */ }
  return true;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function schedulePersist(): void {
  if (persistTimer != null) clearTimeout(persistTimer);
  // Debounced light save — full map encode was causing lag spikes
  persistTimer = setTimeout(() => {
    persistTimer = null;
    try { persistExploredOnly(); } catch { /* */ }
  }, 1500);
}

export function fireExplorer(payload?: Record<string, unknown>, opts?: { quiet?: boolean }): void {
  if (!isExplorationEnabled()) {
    toast("Enable Exploration in Map Viewer config first");
    return;
  }
  if (!runtime.data) {
    toast("Generate hidden map first");
    return;
  }

  let cx = payload?.cellX ?? payload?.x;
  let cy = payload?.cellY ?? payload?.y;
  if (typeof cx !== "number" || typeof cy !== "number") {
    const m = readMouseCell();
    if (m) { cx = m.x; cy = m.y; }
  }
  if (typeof cx !== "number" || typeof cy !== "number") {
    toast("No cursor cell");
    return;
  }
  if (!tryEnergy()) {
    toast("Not enough energy");
    return;
  }

  const n = exploreNearFog(cx as number, cy as number, explorerRadius);
  if (n > 0) {
    // Patch only the brush rect on the single ghost layer
    const r = explorerRadius + 2;
    patchGhostRegion(cx - r, cy - r, cx + r, cy + r);
    schedulePersist();
  }
  // Toasts only when not continuous hold (quietHold flag)
  if (!opts?.quiet) {
    if (n < 0) toast("Must touch an explored zone");
    else if (n > 0) toast(`Explored ${n} cells`);
  }
}

export function paintExplorerBrush(): void {
  if (!isExplorerSelected()) return;
  const a = rawApi();
  try {
    const cell = readMouseCell();
    if (!cell) return;
    const cellSize = a.rendering.getGridMetrics().cellSize;
    const r = explorerRadius;
    const worldCenter = a.rendering.getDrawPositionAtWorld(
      (cell.x + 0.5) * cellSize,
      (cell.y + 0.5) * cellSize,
    );
    const edge = a.rendering.getDrawPositionAtWorld(
      (cell.x + 0.5 + r) * cellSize,
      (cell.y + 0.5) * cellSize,
    );
    const radiusPx = Math.abs(edge.x - worldCenter.x);
    a.rendering.withOverlayContext((ctx: any) => {
      if (!ctx) return;
      ctx.save();
      ctx.strokeStyle = "rgba(255, 200, 80, 0.9)";
      ctx.lineWidth = 2;
      ctx.setLineDash?.([4, 4]);
      ctx.beginPath();
      ctx.arc(worldCenter.x, worldCenter.y, radiusPx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 200, 80, 0.08)";
      ctx.fill();
      ctx.restore();
    });
  } catch { /* */ }
}

export async function registerExplorer(): Promise<void> {
  injectStyles();
  const a = rawApi();

  try {
    a.i18n?.register("en", {
      [KEY.explorerName]: "Fog Explorer",
      [KEY.explorerDesc]:
        "Reveal fog and 2px around it. Requires Exploration mode in Map Viewer.",
    });
  } catch { /* */ }

  try {
    await a.sprites.loadFromMod(EXPLORER_ICON_SPRITE_ID, EXPLORER_ICON_PATH);
  } catch { /* */ }

  try {
    a.items.register({
      id: EXPLORER_ITEM_ID,
      nameKey: KEY.explorerName,
      descriptionKey: KEY.explorerDesc,
      name: "Fog Explorer",
      sprite: { id: EXPLORER_ICON_SPRITE_ID },
      itemType: "tool",
      energyCost: EXPLORER_ENERGY,
      cooldown: { durationMs: 150 },
    });
  } catch (err) {
    console.warn(`${LOG} explorer register`, err);
  }

  try {
    if (typeof a.player?.inventory?.hasById === "function") {
      if (!a.player.inventory.hasById(EXPLORER_ITEM_ID)) {
        a.player.inventory.addById(EXPLORER_ITEM_ID);
      }
    } else {
      a.player?.inventory?.addById?.(EXPLORER_ITEM_ID);
    }
  } catch { /* */ }

  try {
    a.ui.overlays.register("hotbar", EXPLORER_OVERLAY_ID, () => RadiusOverlay());
  } catch { /* */ }

  let lastFireAt = 0;
  const tryFire = (source: string, payload?: Record<string, unknown>) => {
    const now = performance.now?.() ?? Date.now();
    if (now - lastFireAt < 100) return;
    lastFireAt = now;
    const quiet = source === "hold";
    fireExplorer(payload, { quiet });
  };

  try {
    a.events.on("item:used", (...args: unknown[]) => {
      const payload = (args.length >= 2 ? args[1] : args[0]) as Record<string, unknown> | undefined;
      if (!payload || (payload.itemId ?? payload.id) !== EXPLORER_ITEM_ID) return;
      tryFire("item:used", payload);
    });
  } catch { /* */ }

  try {
    a.hooks?.intercept?.(
      "item:use",
      (args: { itemId?: string }) => {
        if (args?.itemId !== EXPLORER_ITEM_ID) return;
        tryFire("item:use", args as unknown as Record<string, unknown>);
      },
      { itemIds: [EXPLORER_ITEM_ID], priority: 0 },
    );
  } catch { /* */ }

  // Hold-to-fire: pointer down → repeat every HOLD_MS until up
  const HOLD_MS = 120;
  let holdTimer: ReturnType<typeof setInterval> | null = null;
  const stopHold = () => {
    if (holdTimer != null) {
      clearInterval(holdTimer);
      holdTimer = null;
    }
  };
  const startHold = (source: string) => {
    tryFire(source);
    stopHold();
    holdTimer = setInterval(() => {
      if (!isExplorerSelected()) {
        stopHold();
        return;
      }
      tryFire("hold");
    }, HOLD_MS);
  };

  try {
    globalThis.addEventListener(
      "pointerdown",
      (ev: PointerEvent) => {
        if (ev.button !== 0) return;
        if (!isExplorerSelected()) return;
        const t = ev.target as HTMLElement | null;
        if (t?.closest?.(".hwv-root, .hw-exp-bar, .hw-mat-bar, button, input, textarea")) return;
        startHold("pointerdown");
      },
      true,
    );
    globalThis.addEventListener("pointerup", stopHold, true);
    globalThis.addEventListener("pointercancel", stopHold, true);
    globalThis.addEventListener("blur", stopHold);
  } catch { /* */ }

  try {
    globalThis.addEventListener(
      "keydown",
      (ev: KeyboardEvent) => {
        if (ev.code !== "KeyF" && ev.key !== "f" && ev.key !== "F") return;
        if (ev.repeat) return; // hold handled by interval after first
        if (!isExplorerSelected()) return;
        const t = ev.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
        startHold("keydown-F");
      },
      true,
    );
    globalThis.addEventListener(
      "keyup",
      (ev: KeyboardEvent) => {
        if (ev.code === "KeyF" || ev.key === "f" || ev.key === "F") stopHold();
      },
      true,
    );
  } catch { /* */ }

  console.log(`${LOG} Fog Explorer registered`);
}
