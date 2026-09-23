/** Shared tool helpers: selection, hold-fire, radius bar, brush ring, toast, energy. */

declare const sandkit: { react: any; api: any };

const react = sandkit.react;
export const h = (
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): unknown => react.createElement(type, props, ...children);

export const rawApi = (): any => (sandkit as any).api;

export function isItemSelected(itemId: string): boolean {
  const a = rawApi();
  try {
    if (typeof a.items?.isActiveById === "function") {
      return a.items.isActiveById(itemId) === true;
    }
  } catch { /* */ }
  try {
    return a.items?.getActive?.()?.id === itemId;
  } catch {
    return false;
  }
}

export function toast(msg: string): void {
  try { rawApi().ui?.toast?.(msg, {}); } catch {
    try { rawApi().ui?.toast?.(msg); } catch { /* */ }
  }
}

export function readMouseCell(): { x: number; y: number } | null {
  const a = rawApi();
  try {
    const c = a.input?.getMousePositionAtCell?.() ?? a.input?.getMouseCellPosition?.();
    if (c && typeof c.x === "number") return { x: c.x, y: c.y };
  } catch { /* */ }
  return null;
}

export function tryEnergy(cost: number): boolean {
  const a = rawApi();
  try {
    if (typeof a.energy?.consume === "function") {
      const result = a.energy.consume(cost);
      if (result === false) return false;
      if (result && typeof result === "object" && result.ok === false) return false;
    }
  } catch { /* */ }
  return true;
}

export function paintBrushRing(
  radius: number,
  color = "rgba(120, 200, 255, 0.9)",
): void {
  const a = rawApi();
  try {
    const cell = readMouseCell();
    if (!cell) return;
    const cellSize = a.rendering.getGridMetrics().cellSize;
    const worldCenter = a.rendering.getDrawPositionAtWorld(
      (cell.x + 0.5) * cellSize,
      (cell.y + 0.5) * cellSize,
    );
    const edge = a.rendering.getDrawPositionAtWorld(
      (cell.x + 0.5 + radius) * cellSize,
      (cell.y + 0.5) * cellSize,
    );
    const radiusPx = Math.abs(edge.x - worldCenter.x);
    a.rendering.withOverlayContext((ctx: any) => {
      if (!ctx) return;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash?.([4, 4]);
      ctx.beginPath();
      ctx.arc(worldCenter.x, worldCenter.y, radiusPx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = color.replace(/[\d.]+\)$/, "0.08)");
      ctx.fill();
      ctx.restore();
    });
  } catch { /* */ }
}

export type HoldFireOpts = {
  itemId: string;
  holdMs?: number;
  cooldownMs?: number;
  onFire: (source: string, quiet: boolean) => void;
  uiIgnore?: string;
};

/** pointer/key hold → repeated onFire. */
export function bindHoldFire(opts: HoldFireOpts): void {
  const holdMs = opts.holdMs ?? 100;
  const cooldownMs = opts.cooldownMs ?? 90;
  let last = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = () => {
    if (timer != null) { clearInterval(timer); timer = null; }
  };

  const fire = (source: string, quiet: boolean) => {
    const now = performance.now?.() ?? Date.now();
    if (now - last < cooldownMs) return;
    last = now;
    opts.onFire(source, quiet);
  };

  const start = (source: string) => {
    fire(source, false);
    stop();
    timer = setInterval(() => {
      if (!isItemSelected(opts.itemId)) { stop(); return; }
      fire("hold", true);
    }, holdMs);
  };

  const ignore = opts.uiIgnore ??
    ".hwv-root, .hw-tool-bar, button, input, textarea, select";

  try {
    globalThis.addEventListener("pointerdown", (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      if (!isItemSelected(opts.itemId)) return;
      const t = ev.target as HTMLElement | null;
      if (t?.closest?.(ignore)) return;
      start("pointerdown");
    }, true);
    globalThis.addEventListener("pointerup", stop, true);
    globalThis.addEventListener("pointercancel", stop, true);
  } catch { /* */ }

  try {
    globalThis.addEventListener("keydown", (ev: KeyboardEvent) => {
      if (ev.code !== "KeyF" && ev.key !== "f" && ev.key !== "F") return;
      if (ev.repeat) return;
      if (!isItemSelected(opts.itemId)) return;
      const t = ev.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      start("keydown-F");
    }, true);
    globalThis.addEventListener("keyup", (ev: KeyboardEvent) => {
      if (ev.code === "KeyF" || ev.key === "f" || ev.key === "F") stop();
    }, true);
  } catch { /* */ }

  try {
    const a = rawApi();
    a.events?.on?.("item:used", (...args: unknown[]) => {
      const payload = (args.length >= 2 ? args[1] : args[0]) as { itemId?: string } | undefined;
      if (payload?.itemId !== opts.itemId) return;
      fire("item:used", false);
    });
  } catch { /* */ }
}

export type RadiusState = { value: number };

export function makeRadiusBar(
  label: string,
  state: RadiusState,
  min: number,
  max: number,
  itemId: string,
): () => unknown {
  return () => {
    const [r, setR] = react.useState(state.value) as [number, (n: number) => void];
    const [, bump] = react.useState(0) as [number, (fn: (n: number) => number) => void];
    react.useEffect(() => {
      const unsub = rawApi().events?.on?.("action:changed", () => bump((n) => n + 1));
      return () => { try { unsub?.(); } catch { /* */ } };
    }, []);
    if (!isItemSelected(itemId)) return null;
    const set = (n: number) => {
      const v = Math.min(max, Math.max(min, Math.round(n) || min));
      state.value = v;
      setR(v);
    };
    return h(
      "div",
      { className: "hw-tool-bar" },
      h("span", null, label),
      h("button", { type: "button", onClick: () => set(r - 1) }, "−"),
      h("input", {
        type: "number",
        min,
        max,
        value: r,
        onChange: (e: { target: { value: string } }) => set(Number(e.target.value)),
      }),
      h("button", { type: "button", onClick: () => set(r + 1) }, "+"),
    );
  };
}

export function injectToolBarStyles(): void {
  if (document.getElementById("hw-tool-bar-style")) return;
  const style = document.createElement("style");
  style.id = "hw-tool-bar-style";
  style.textContent = `
    .hw-tool-bar {
      position: fixed; left: 50%; transform: translateX(-50%);
      bottom: 5.5em; z-index: 1000;
      display: flex; align-items: center; gap: 10px;
      padding: 8px 14px; border-radius: 8px;
      background: rgba(10,12,20,0.92); border: 1px solid #456;
      color: #cde; font-size: 12px;
    }
    .hw-tool-bar input[type="number"] {
      width: 56px; background: #111 !important; color: #eee !important;
      border: 1px solid #445; border-radius: 3px; padding: 3px 6px;
      color-scheme: dark; font: inherit;
    }
    .hw-tool-bar button {
      background: #234; border: 1px solid #456; color: #cde;
      border-radius: 4px; padding: 4px 8px; cursor: pointer; font: inherit;
    }
  `;
  document.head.appendChild(style);
}

export async function registerToolItem(opts: {
  id: string;
  name: string;
  desc: string;
  nameKey: string;
  descKey: string;
  spriteId: string;
  spritePath: string;
  energyCost?: number;
}): Promise<void> {
  const a = rawApi();
  try {
    a.i18n?.register("en", { [opts.nameKey]: opts.name, [opts.descKey]: opts.desc });
  } catch { /* */ }
  try {
    await a.sprites.loadFromMod(opts.spriteId, opts.spritePath);
  } catch { /* */ }
  try {
    a.items.register({
      id: opts.id,
      nameKey: opts.nameKey,
      descriptionKey: opts.descKey,
      name: opts.name,
      sprite: { id: opts.spriteId },
      itemType: "tool",
      energyCost: opts.energyCost ?? 0,
      cooldown: { durationMs: 150 },
    });
  } catch (err) {
    console.warn("[hiden-word-2] register", opts.id, err);
  }
  try {
    if (typeof a.player?.inventory?.hasById === "function") {
      if (!a.player.inventory.hasById(opts.id)) a.player.inventory.addById(opts.id);
    } else {
      a.player?.inventory?.addById?.(opts.id);
    }
  } catch { /* */ }
}
