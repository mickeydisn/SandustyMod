import {
  KEY,
  LOG,
  MATERIALIZE_MAP,
  MATERIALIZER_ENERGY,
  MATERIALIZER_ICON_PATH,
  MATERIALIZER_ICON_SPRITE_ID,
  MATERIALIZER_ITEM_ID,
  MATERIALIZER_OVERLAY_ID,
  MATERIALIZER_RADIUS_DEFAULT,
  MATERIALIZER_RADIUS_MAX,
  MATERIALIZER_RADIUS_MIN,
  MOD,
  TERRAIN,
} from "../world/constants.ts";
import { api } from "../api/api.ts";
import { runtime } from "../world/state.ts";
import {
  exploreMaterializeBorder,
  isExplorationEnabled,
  materializeTouchesExplored,
  patchGhostRegion,
} from "../world/exploration.ts";
import { persistExploredOnly } from "../world/persistence.ts";

declare const sandkit: { react: any; api: any };
const react = sandkit.react;
const h = (
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): unknown => react.createElement(type, props, ...children);

/** Raw sandkit api — full surface, not the typed subset. */
const rawApi = (): any => (sandkit as any).api ?? api;

export let materializerRadius = MATERIALIZER_RADIUS_DEFAULT;

const typeCache = new Map<string, string | number | null>();

const TERRAIN_ALIASES: Record<string, string[]> = {
  stone: ["stone", "Stone", "rock", "Rock"],
  dirt: ["dirt", "Dirt", "soil", "Soil"],
  moss: ["moss", "Moss"],
  grass: ["grass", "Grass"],
  redsoil: ["redsoil", "Redsoil", "redsand", "Redsand", "sandiumSoil", "SandiumSoil"],
  ice: ["ice", "Ice", "freezingIceSoil", "FreezingIceSoil"],
  water: ["water", "Water"],
  lava: ["lava", "Lava"],
  sporesoil: ["sporesoil", "SporeSoil", "sporeSoil", "spore", "Spore"],
};

export function isMaterializerSelected(): boolean {
  const a = rawApi();
  try {
    if (typeof a.items?.isActiveById === "function") {
      return a.items.isActiveById(MATERIALIZER_ITEM_ID) === true;
    }
  } catch { /* */ }
  try {
    return a.items?.getActive?.()?.id === MATERIALIZER_ITEM_ID;
  } catch {
    return false;
  }
}

/** Resolve to a value replaceAtCell accepts (string id preferred). */
function resolveTerrainRef(id: string): string | number | null {
  if (typeCache.has(id)) return typeCache.get(id)!;
  const a = rawApi();
  const candidates = TERRAIN_ALIASES[id] ?? [id];
  let found: string | number | null = null;

  for (const c of candidates) {
    try {
      const t = a.terrains?.getTypeById?.(c);
      if (typeof t === "number" && isFinite(t)) {
        found = t;
        break;
      }
    } catch { /* */ }
  }
  // Always keep the string id as last resort — API accepts terrainTypeOrId
  if (found === null) found = candidates[0] ?? id;

  typeCache.set(id, found);
  return found;
}

function toast(msg: string): void {
  try {
    rawApi().ui?.toast?.(msg, {});
  } catch {
    try {
      rawApi().ui?.toast?.(msg);
    } catch { /* */ }
  }
}

function injectStyles(): void {
  if (document.getElementById("hw-mat-style")) return;
  const style = document.createElement("style");
  style.id = "hw-mat-style";
  style.textContent = `
    .hw-mat-bar {
      position: fixed; left: 50%; transform: translateX(-50%);
      bottom: 5.5em; z-index: 1000;
      display: flex; align-items: center; gap: 10px;
      padding: 8px 14px; border-radius: 8px;
      background: rgba(10,12,20,0.92); border: 1px solid #456;
      color: #cde; font-size: 12px;
    }
    .hw-mat-bar input[type="number"] {
      width: 56px; background: #111 !important; color: #eee !important;
      border: 1px solid #445; border-radius: 3px; padding: 3px 6px;
      color-scheme: dark; font: inherit;
    }
    .hw-mat-bar button {
      background: #234; border: 1px solid #456; color: #cde;
      border-radius: 4px; padding: 4px 8px; cursor: pointer; font: inherit;
    }
  `;
  document.head.appendChild(style);
}

function RadiusOverlay(): unknown {
  const [r, setR] = react.useState(materializerRadius) as [number, (n: number) => void];
  const [, bump] = react.useState(0) as [number, (fn: (n: number) => number) => void];
  react.useEffect(() => {
    const unsub = rawApi().events.on("action:changed", () => bump((n) => n + 1));
    return () => { try { unsub(); } catch { /* */ } };
  }, []);
  if (!isMaterializerSelected()) return null;
  const setRadius = (n: number) => {
    const v = Math.min(
      MATERIALIZER_RADIUS_MAX,
      Math.max(MATERIALIZER_RADIUS_MIN, Math.round(n) || MATERIALIZER_RADIUS_MIN),
    );
    materializerRadius = v;
    setR(v);
  };
  return h(
    "div",
    { className: "hw-mat-bar" },
    h("span", null, "Manifest r"),
    h("button", { type: "button", onClick: () => setRadius(r - 1) }, "−"),
    h("input", {
      type: "number",
      min: MATERIALIZER_RADIUS_MIN,
      max: MATERIALIZER_RADIUS_MAX,
      value: r,
      onChange: (e: { target: { value: string } }) => setRadius(Number(e.target.value)),
    }),
    h("button", { type: "button", onClick: () => setRadius(r + 1) }, "+"),
    h("span", { style: { color: "#889" } }, "click or F"),
  );
}

function tryEnergy(): boolean {
  const a = rawApi();
  try {
    if (typeof a.energy?.consume === "function") {
      const result = a.energy.consume(MATERIALIZER_ENERGY);
      if (result === false) return false;
      if (result && typeof result === "object" && result.ok === false) return false;
    }
  } catch { /* allow */ }
  return true;
}

function isLiveEmpty(x: number, y: number): boolean {
  const a = rawApi();
  try {
    if (typeof a.grid?.isCellEmptyAtCell === "function") {
      return a.grid.isCellEmptyAtCell(x, y) === true;
    }
  } catch { /* */ }
  // If API missing, allow write
  return true;
}

function placeCell(
  terrains: any,
  report: ((x: number, y: number) => void) | undefined,
  x: number,
  y: number,
  ref: string | number | null,
  apiTerrains?: any,
): "ok" | "empty" | "fail" | "skip" {
  const check = apiTerrains ?? terrains;
  try {
    // Fog/sky → do not place solid (leave empty). No forced clear of existing terrain.
    if (ref === null) {
      return "empty";
    }

    // Only materialize into empty live cells
    if (!isLiveEmpty(x, y)) {
      return "skip";
    }

    let wrote = false;
    for (const t of [terrains, apiTerrains]) {
      if (!t) continue;
      try {
        if (typeof t.createAtCell === "function") {
          t.createAtCell(x, y, ref);
          wrote = true;
        }
      } catch { /* */ }
      try {
        if (typeof t.replaceAtCell === "function") {
          t.replaceAtCell(x, y, ref);
          wrote = true;
        }
      } catch { /* */ }
    }

    try { report?.(x, y); } catch { /* */ }

    try {
      const after = check?.getTypeAtCell?.(x, y);
      if (after != null && after !== false) return "ok";
    } catch { /* */ }

    return wrote ? "ok" : "fail";
  } catch {
    return "fail";
  }
}

function materializeAt(cx: number, cy: number, radius: number): {
  painted: number;
  emptied: number;
  failed: number;
} {
  const data = runtime.data;
  if (!data || runtime.width <= 0) {
    toast("No hidden map — Generate in Map Viewer first");
    return { painted: 0, emptied: 0, failed: 0 };
  }

  const a = rawApi();
  const w = runtime.width;
  const h = runtime.height;
  const r2 = radius * radius;
  let painted = 0;
  let emptied = 0;
  let failed = 0;

  const cells: { x: number; y: number; ref: string | number | null }[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx * dx + dy * dy > r2) continue;
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;

      const code = data[y * w + x]!;
      if (code === TERRAIN.TUNNEL || code === TERRAIN.SKY) {
        cells.push({ x, y, ref: null });
        continue;
      }
      const mapId = MATERIALIZE_MAP[code];
      if (!mapId) {
        cells.push({ x, y, ref: null });
        continue;
      }
      cells.push({ x, y, ref: resolveTerrainRef(mapId) });
    }
  }

  const applyAll = (terrains: any, report?: (x: number, y: number) => void) => {
    for (const c of cells) {
      const r = placeCell(terrains, report, c.x, c.y, c.ref, a.terrains);
      if (r === "ok") painted++;
      else if (r === "empty" || r === "skip") emptied++;
      else failed++;
    }
  };

  // 1) grid.mutate (coherent batch — recommended)
  let didMutate = false;
  try {
    if (typeof a.grid?.mutate === "function") {
      a.grid.mutate((writer: any) => {
        const terrains = writer?.terrains ?? a.terrains;
        const report = writer?.reportActivityAtCell?.bind(writer) ??
          a.grid?.reportActivityAtCell?.bind(a.grid);
        applyAll(terrains, report);
      });
      didMutate = true;
    }
  } catch (err) {
    console.warn(`${LOG} mutate failed`, err);
  }

  // 2) Direct api.terrains only if mutate unavailable
  if (!didMutate) {
    painted = 0; emptied = 0; failed = 0;
    try {
      applyAll(a.terrains, a.grid?.reportActivityAtCell?.bind(a.grid));
    } catch (err) {
      console.warn(`${LOG} direct terrains failed`, err);
    }
  }

  try {
    a.grid?.redrawAroundCell?.(cx, cy, radius + 2);
  } catch { /* */ }

  if (failed > 0 && painted === 0) {
    console.warn(
      `${LOG} manifest @(${cx},${cy}) fail=${failed} cells=${cells.length}`,
    );
  }
  return { painted, emptied, failed };
}

function readMouseCell(): { x: number; y: number } | null {
  const a = rawApi();
  try {
    const c = a.input?.getMousePositionAtCell?.() ?? a.input?.getMouseCellPosition?.();
    if (c && typeof c.x === "number" && typeof c.y === "number") return { x: c.x, y: c.y };
  } catch { /* */ }
  return null;
}

export function fire(payload?: Record<string, unknown>, opts?: { quiet?: boolean }): void {

  let cx = payload?.cellX ?? payload?.x;
  let cy = payload?.cellY ?? payload?.y;
  if (typeof cx !== "number" || typeof cy !== "number") {
    const m = readMouseCell();
    if (m) {
      cx = m.x;
      cy = m.y;
    }
  }
  if (typeof cx !== "number" || typeof cy !== "number") {
    toast("No cursor cell");
    console.warn(`${LOG} no cell coords`);
    return;
  }

  if (!tryEnergy()) {
    toast("Not enough energy");
    return;
  }

  if (isExplorationEnabled() && !materializeTouchesExplored(cx as number, cy as number, materializerRadius)) {
    toast("Unexplored — explore fog first or touch an explored cell");
    return;
  }

  const { painted, emptied, failed } = materializeAt(
    cx as number,
    cy as number,
    materializerRadius,
  );

  if (painted > 0 || emptied > 0) {
    const gained = exploreMaterializeBorder(cx as number, cy as number, materializerRadius);
    const rr = materializerRadius + 4;
    patchGhostRegion(cx - rr, cy - rr, cx + rr, cy + rr);
    scheduleManifestPersist();
    if (!opts?.quiet) {
      if (painted > 0) toast(`Manifested ${painted} cells (+${gained} explored)`);
      else toast(`Cleared ${emptied} fog cells (+${gained} explored)`);
    }
  } else if (!opts?.quiet) {
    if (isExplorationEnabled() && failed === 0 && painted === 0) {
      /* already toasted unexplored */
    } else {
      toast(`Nothing placed (fail=${failed}). Generate map first?`);
    }
  }
}

export function paintManifestBrush(): void {
  if (!isMaterializerSelected()) return;
  const a = rawApi();
  try {
    const cell = readMouseCell();
    if (!cell) return;
    const cellSize = a.rendering.getGridMetrics().cellSize;
    const r = materializerRadius;
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
      ctx.strokeStyle = "rgba(100, 200, 255, 0.9)";
      ctx.lineWidth = 2;
      ctx.setLineDash?.([6, 4]);
      ctx.beginPath();
      ctx.arc(worldCenter.x, worldCenter.y, radiusPx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(100, 200, 255, 0.1)";
      ctx.fill();
      ctx.restore();
    });
  } catch { /* quiet */ }
}

function onItemUsed(...args: unknown[]): void {
  // Support (payload) and (event, payload)
  const payload = (args.length >= 2 ? args[1] : args[0]) as Record<string, unknown> | undefined;
  if (!payload || typeof payload !== "object") return;
  const id = payload.itemId ?? payload.id;
  if (id !== MATERIALIZER_ITEM_ID) return;
  fire(payload);
}

export async function registerMaterializer(): Promise<void> {
  injectStyles();
  const a = rawApi();

  try {
    a.i18n?.register("en", {
      [KEY.materializerName]: "World Manifest",
      [KEY.materializerDesc]:
        "Paint the hidden world into real terrain. Ghost view + brush. Click or press F.",
    });
  } catch (err) {
    console.warn(`${LOG} materializer i18n`, err);
  }

  try {
    await a.sprites.loadFromMod(MATERIALIZER_ICON_SPRITE_ID, MATERIALIZER_ICON_PATH);
  } catch (err) {
    console.warn(`${LOG} materializer icon`, err);
  }

  try {
    a.items.register({
      id: MATERIALIZER_ITEM_ID,
      nameKey: KEY.materializerName,
      descriptionKey: KEY.materializerDesc,
      name: "World Manifest",
      sprite: { id: MATERIALIZER_ICON_SPRITE_ID },
      itemType: "tool",
      energyCost: MATERIALIZER_ENERGY,
      // Help engine treat it as a click-usable tool
      cooldown: { durationMs: 200 },
    });
  } catch (err) {
    console.warn(`${LOG} materializer register`, err);
  }

  try {
    if (typeof a.player?.inventory?.hasById === "function") {
      if (!a.player.inventory.hasById(MATERIALIZER_ITEM_ID)) {
        a.player.inventory.addById(MATERIALIZER_ITEM_ID);
      }
    } else {
      a.player?.inventory?.addById?.(MATERIALIZER_ITEM_ID);
    }
  } catch (err) {
    console.warn(`${LOG} materializer inventory`, err);
  }

  try {
    a.ui.overlays.register("hotbar", MATERIALIZER_OVERLAY_ID, () => RadiusOverlay());
  } catch (err) {
    console.warn(`${LOG} materializer overlay`, err);
  }

  // --- Activation (item:used often never fires for custom tools) ---
  let lastFireAt = 0;
  const FIRE_COOLDOWN_MS = 100;

  const tryFire = (source: string, payload?: Record<string, unknown>) => {
    const now = performance.now?.() ?? Date.now();
    if (now - lastFireAt < FIRE_COOLDOWN_MS) return;
    lastFireAt = now;
    fire(payload, { quiet: source === "hold" });
  };

  // 1) Event after use
  try {
    a.events.on("item:used", (...args: unknown[]) => {
      const payload = (args.length >= 2 ? args[1] : args[0]) as Record<string, unknown> | undefined;
      if (!payload || typeof payload !== "object") return;
      const id = payload.itemId ?? payload.id;
      if (id !== MATERIALIZER_ITEM_ID) return;
      tryFire("item:used", payload);
    });
    console.log(`${LOG} bound item:used`);
  } catch (err) {
    console.warn(`${LOG} item:used bind failed`, err);
  }

  // 2) Hook during use (more reliable for custom tools)
  try {
    if (typeof a.hooks?.intercept === "function") {
      a.hooks.intercept(
        "item:use",
        (args: { itemId?: string }, _ctx: unknown) => {
          if (args?.itemId !== MATERIALIZER_ITEM_ID) return;
          tryFire("item:use", args as unknown as Record<string, unknown>);
        },
        { itemIds: [MATERIALIZER_ITEM_ID], priority: 0 },
      );
      console.log(`${LOG} bound item:use hook`);
    }
  } catch (err) {
    console.warn(`${LOG} item:use hook failed`, err);
  }

  // 3) Pointer click on the game (while tool selected)
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
      if (!isMaterializerSelected()) {
        stopHold();
        return;
      }
      tryFire("hold");
    }, HOLD_MS);
  };

  try {
    const onPointer = (ev: PointerEvent) => {
      if (ev.button !== 0) return;
      if (!isMaterializerSelected()) return;
      const t = ev.target as HTMLElement | null;
      if (t?.closest?.(".hwv-root, .hw-mat-bar, .hwv-frame, button, input, textarea, select")) {
        return;
      }
      startHold("pointerdown");
    };
    globalThis.addEventListener("pointerdown", onPointer, true);
    globalThis.addEventListener("pointerup", stopHold, true);
    globalThis.addEventListener("pointercancel", stopHold, true);
    globalThis.addEventListener("blur", stopHold);
    console.log(`${LOG} bound pointerdown hold`);
  } catch (err) {
    console.warn(`${LOG} pointerdown failed`, err);
  }

  // 4) KeyF while selected (hold repeats)
  try {
    a.input?.registerBinding?.(`${MOD}.manifestFire`, ["KeyF"], {
      nameKey: KEY.materializerName,
    });
  } catch { /* */ }

  try {
    globalThis.addEventListener(
      "keydown",
      (ev: KeyboardEvent) => {
        if (ev.code !== "KeyF" && ev.key !== "f" && ev.key !== "F") return;
        if (ev.repeat) return;
        if (!isMaterializerSelected()) return;
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
    console.log(`${LOG} bound KeyF hold`);
  } catch (err) {
    console.warn(`${LOG} keydown failed`, err);
  }

  // 5) Optional: poll binding via triggers if engine marks it pressed
  try {
    a.triggers?.register?.(`${MOD}:manifestPoll`, {
      intervalMs: 100,
      data: { wasDown: false },
      callback: (trigger: { data: { wasDown: boolean } }) => {
        if (!isMaterializerSelected()) {
          trigger.data.wasDown = false;
          return;
        }
        // Some builds expose isBindingDown / getBindingState
        let down = false;
        try {
          down = !!a.input?.isBindingDown?.(`${MOD}.manifestFire`);
        } catch { /* */ }
        if (down && !trigger.data.wasDown) tryFire("binding");
        trigger.data.wasDown = down;
      },
    });
  } catch { /* optional */ }

  // Probe terrains
  console.log(`${LOG} World Manifest registered (${MATERIALIZER_ITEM_ID})`);
}
