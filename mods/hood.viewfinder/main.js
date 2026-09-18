/**
 * Viewfinder — independent Sandustry mod (Main entry).
 *
 * 4 channels. One camera each. Unlimited screens.
 * Click a camera to cycle the 5×5-tile capture corner (TL → TR → BR → BL).
 * A tile is 16×16 px. The zone and the screen are 5×5 tiles = 80×80 px.
 *
 * Screens are painted on the overlay each frame (structure `draw` cannot
 * replace the Pixi tilemap). Do not pass `state`. Do not call sandkit.engine.api.
 */
const MOD = "hood.viewfinder";
const CHANNELS = 4;
const ZONE_TILES = 5;
const TILE_PX = 16;
const FEED_PX = ZONE_TILES * TILE_PX;
const MAX_CAMERAS = 1;

const api = sandkit.api;

const CHANNEL_HEX = ["#3de0ff", "#ff3d9a", "#ffc93d", "#7dff3d"];

const CAM_IDS = [];
const SCREEN_IDS = [];
for (let ch = 0; ch < CHANNELS; ch++) {
  CAM_IDS.push(`${MOD}.cam.${ch}`);
  SCREEN_IDS.push(`${MOD}.screen.${ch}`);
}

/** @type {Array<HTMLCanvasElement|null>} */
const feeds = [null, null, null, null];
/** @type {Array<boolean>} per channel: true once a real world capture succeeded */
const hadCopy = [false, false, false, false];
/** Last capture tick, throttles capture inside frame:render (~10 fps). */
let lastCaptureMs = 0;
/** Scratch canvas for the live world-map capture. */
let mapScratch = null;

function camId(ch) {
  return CAM_IDS[ch];
}
function screenId(ch) {
  return SCREEN_IDS[ch];
}

function metrics() {
  try {
    const m = api.rendering?.getGridMetrics?.() || {};
    const cell = m.cellSize || 4;
    const snap = m.snapGridCellSize || 4;
    return {
      cell,
      snap,
      tilePx: snap * cell || TILE_PX,
      zoneCells: ZONE_TILES * snap,
    };
  } catch {
    return { cell: 4, snap: 4, tilePx: TILE_PX, zoneCells: ZONE_TILES * 4 };
  }
}

function corners() {
  const span = (ZONE_TILES - 1) * metrics().snap;
  return [
    { id: 0, name: "top-left", dx: 0, dy: 0 },
    { id: 1, name: "top-right", dx: -span, dy: 0 },
    { id: 2, name: "bottom-right", dx: -span, dy: -span },
    { id: 3, name: "bottom-left", dx: 0, dy: -span },
  ];
}

function toast(key, params) {
  try {
    api.ui.toast({ key, params });
  } catch {
    try {
      api.ui.toast(api.i18n?.t?.(key, params) || key);
    } catch {
      /* optional */
    }
  }
}

function listType(id) {
  const out = [];
  try {
    api.structures.forEachOfType(id, (s) => out.push(s));
  } catch {
    /* none */
  }
  return out;
}

function channelFromId(id, ids) {
  if (id == null) return null;
  for (let ch = 0; ch < CHANNELS; ch++) {
    if (id === ids[ch]) return ch;
    try {
      const t = api.structures.getTypeById?.(ids[ch]);
      if (t != null && t === id) return ch;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function tileShape(tiles) {
  const n = tiles * (metrics().snap || 4);
  const row = Array(n).fill(1);
  return Array.from({ length: n }, () => row.slice());
}

function ensureFeed(ch) {
  if (feeds[ch]) return feeds[ch];
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = FEED_PX;
  c.height = FEED_PX;
  feeds[ch] = c;
  paintNoSignal(c.getContext("2d", { willReadFrequently: true }), ch);
  return c;
}

function overlayCanvas() {
  let canvas = null;
  try {
    api.rendering.withOverlayContext((ctx) => {
      canvas = ctx?.canvas || null;
    });
  } catch {
    /* ignore */
  }
  return canvas;
}

function worldCanvas() {
  const skip = overlayCanvas();
  if (typeof document === "undefined") return null;
  const nodes = document.querySelectorAll("canvas");
  let best = null;
  let area = 0;
  for (let i = 0; i < nodes.length; i++) {
    const c = nodes[i];
    if (c === skip) continue;
    const a = (c.width || 0) * (c.height || 0);
    if (a > area) {
      area = a;
      best = c;
    }
  }
  return best;
}

function drawPosWorld(wx, wy) {
  try {
    if (api.rendering.getDrawPositionAtWorld) {
      return api.rendering.getDrawPositionAtWorld(wx, wy);
    }
  } catch {
    /* fall through */
  }
  try {
    if (api.rendering.getDrawPositionAtCell) {
      const cs = metrics().cell;
      return api.rendering.getDrawPositionAtCell(wx / cs, wy / cs);
    }
  } catch {
    /* fall through */
  }
  return { x: wx, y: wy };
}

function zoneOf(camera) {
  const list = corners();
  const corner = list[(camera.data?.corner ?? 0) % list.length];
  return {
    x: camera.x + corner.dx,
    y: camera.y + corner.dy,
    corner,
  };
}

function zoneWorldRect(originX, originY) {
  const { cell, zoneCells, tilePx } = metrics();
  const w = zoneCells * cell || ZONE_TILES * tilePx;
  return {
    x: originX * cell,
    y: originY * cell,
    w,
    h: w,
  };
}

function colorAtCell(cx, cy) {
  try {
    const type = api.elements.getTypeAtCell?.(cx, cy);
    if (type != null) {
      // Deterministic hue per element type — the info payload has no color.
      const h = (type * 67) % 360;
      return `hsl(${h}, 65%, 55%)`;
    }
  } catch {
    /* ignore */
  }
  try {
    if (api.structures.hasBuiltAtCell?.(cx, cy)) return "#7a7278";
  } catch {
    /* ignore */
  }
  try {
    if (api.terrains.isAtCell?.(cx, cy)) return "#6a5138";
  } catch {
    /* ignore */
  }
  return "#1c1914";
}

function paintNoSignal(ctx, ch) {
  if (!ctx) return;
  ctx.fillStyle = "#0b0b0e";
  ctx.fillRect(0, 0, FEED_PX, FEED_PX);
  ctx.fillStyle = CHANNEL_HEX[ch];
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 40; i++) {
    ctx.fillRect((i * 17 + ch * 9) % FEED_PX, (i * 13 + ch * 5) % FEED_PX, 4, 4);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = CHANNEL_HEX[ch];
  ctx.font = "bold 12px monospace";
  ctx.fillText("NO SIGNAL", 8, 44);
  ctx.fillStyle = "#889";
  ctx.font = "10px monospace";
  ctx.fillText("CH " + ch, 8, 60);
}

function paintSchematic(ctx, originX, originY) {
  const { snap } = metrics();
  ctx.fillStyle = "#101014";
  ctx.fillRect(0, 0, FEED_PX, FEED_PX);
  for (let ty = 0; ty < ZONE_TILES; ty++) {
    for (let tx = 0; tx < ZONE_TILES; tx++) {
      const cx = originX + tx * snap + Math.floor(snap / 2);
      const cy = originY + ty * snap + Math.floor(snap / 2);
      ctx.fillStyle = colorAtCell(cx, cy);
      ctx.fillRect(tx * TILE_PX, ty * TILE_PX, TILE_PX, TILE_PX);
    }
  }
}

function feedLooksEmpty(ctx) {
  try {
    const d = ctx.getImageData(0, 0, 12, 12).data;
    let lit = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] + d[i + 1] + d[i + 2] > 24 && d[i + 3] > 8) lit++;
    }
    return lit < 6;
  } catch {
    return true;
  }
}

/**
 * Live engine state. The frame:render payload does NOT reliably carry live
 * state in the mod facade (docs/workshop mods use zero-arg handlers), so
 * capture reads the proven global instead (same pattern as workshop
 * mod 3787806696: `sandkit.state.shared.mapData`). This is a live
 * SharedArrayBuffer view — fresh from any context, no render timing needed.
 */
function liveState() {
  try {
    return typeof sandkit !== "undefined" ? (sandkit.state ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * The engine keeps a live RGBA world map shared from the sim worker:
 * `state.shared.mapData` = { data: Uint8Array (RGBA, 1 px per cell), width, height }.
 * Layout verified in the engine: index = 4 * (x + y * width); empty cells are
 * stored as [0,0,0,0]. This is the same buffer the GPU uploads every frame,
 * so it is always fresh and independent of what is visible on screen.
 */
function captureFromMap(ctx, z, zoneCells, ch, state) {
  // Use the live state passed explicitly (from frame:render) when available;
  // otherwise fall back to the global sandkit.state. This avoids the stale
  // frame:render payload problem that froze the image.
  const st = (state && state.shared) ? state : (liveState && liveState());
  const md = (st && st.shared) ? st.shared.mapData : null;
  if (!md || !md.data || !md.width || !md.height) {
    if (!captureFromMap._warned) {
      captureFromMap._warned = true;
      console.warn("[viewfinder] map capture unavailable:", {
        hasState: !!state,
        hasLiveState: !!liveState && liveState() != null,
        hasMapData: !!md,
      });
    }
    return false;
  }
  try {
    if (!mapScratch) mapScratch = document.createElement("canvas");
    if (mapScratch.width !== zoneCells) {
      mapScratch.width = zoneCells;
      mapScratch.height = zoneCells;
    }
    const sctx = mapScratch.getContext("2d");
    const img = sctx.createImageData(zoneCells, zoneCells);
    const dst = img.data;
    const src = md.data;
    for (let r = 0; r < zoneCells; r++) {
      const wy = z.y + r;
      if (wy < 0 || wy >= md.height) continue;
      const rowStart = wy * md.width;
      for (let c = 0; c < zoneCells; c++) {
        const wx = z.x + c;
        if (wx < 0 || wx >= md.width) continue;
        const si = (rowStart + wx) * 4;
        const di = (r * zoneCells + c) * 4;
        const a = src[si + 3];
        if (a === 0) {
          // Empty cell → dark background.
          dst[di] = 20;
          dst[di + 1] = 17;
          dst[di + 2] = 14;
          dst[di + 3] = 255;
        } else {
          dst[di] = src[si];
          dst[di + 1] = src[si + 1];
          dst[di + 2] = src[si + 2];
          dst[di + 3] = 255;
        }
      }
    }
    sctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, FEED_PX, FEED_PX);
    ctx.drawImage(mapScratch, 0, 0, zoneCells, zoneCells, 0, 0, FEED_PX, FEED_PX);
    hadCopy[ch] = true;
    return true;
  } catch {
    return false;
  }
}

function captureChannel(ch, state) {
  const frame = ensureFeed(ch);
  if (!frame) return;
  const ctx = frame.getContext("2d");
  if (!ctx) return;
  const cams = listType(camId(ch));
  if (cams.length === 0) {
    if (hadCopy[ch]) {
      hadCopy[ch] = false;
      paintNoSignal(ctx, ch);
    }
    return;
  }
  const z = zoneOf(cams[0]);
  const zoneCells = metrics().zoneCells || ZONE_TILES * 4;
  // 1) Live world map (best source, always fresh, works off-screen too).
  // Uses the live state passed from frame:render when available; falls back
  // to the global sandkit.state for other callers (placement, interact).
  if (captureFromMap(ctx, z, zoneCells, ch, state)) return;
  const rect = zoneWorldRect(z.x, z.y);
  const a = drawPosWorld(rect.x, rect.y);
  const b = drawPosWorld(rect.x + rect.w, rect.y + rect.h);
  const sx = Math.min(a.x, b.x);
  const sy = Math.min(a.y, b.y);
  const sw = Math.abs(b.x - a.x);
  const sh = Math.abs(b.y - a.y);
  const src = worldCanvas();
  let copied = false;
  if (src && sw > 2 && sh > 2) {
    try {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(src, sx, sy, sw, sh, 0, 0, FEED_PX, FEED_PX);
      copied = !feedLooksEmpty(ctx);
    } catch {
      copied = false;
    }
  }
  if (copied) {
    hadCopy[ch] = true;
    return;
  }
  // A blank copy is normal outside the render frame — don't overwrite the
  // last good frame with it. Only degrade to the schematic if we never
  // captured anything real.
  if (!hadCopy[ch]) paintSchematic(ctx, z.x, z.y);
}

function normalizeDraw(a, b, c) {
  if (c && typeof c === "object" && ("ctx" in c || "placing" in c || "tilemap" in c)) {
    return { structure: b, ctx: c };
  }
  return { structure: a, ctx: b };
}

function strokeZoneOn(g, camera, ch) {
  const z = zoneOf(camera);
  const rect = zoneWorldRect(z.x, z.y);
  const a = drawPosWorld(rect.x, rect.y);
  const b = drawPosWorld(rect.x + rect.w, rect.y + rect.h);
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.max(4, Math.abs(b.x - a.x));
  const h = Math.max(4, Math.abs(b.y - a.y));
  g.save();
  g.strokeStyle = CHANNEL_HEX[ch];
  g.lineWidth = 2;
  if (g.setLineDash) g.setLineDash([6, 4]);
  g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  g.setLineDash?.([]);
  g.fillStyle = CHANNEL_HEX[ch];
  const handle = 6;
  const corner = (camera.data?.corner ?? 0) % 4;
  const hx = corner === 0 || corner === 3 ? x : x + w - handle;
  const hy = corner === 0 || corner === 1 ? y : y + h - handle;
  g.fillRect(hx, hy, handle, handle);
  g.restore();
}

function blitScreenOn(g, structure, ch) {
  const { cell, zoneCells, tilePx } = metrics();
  const span = (zoneCells || ZONE_TILES * 4) * cell || ZONE_TILES * tilePx;
  const a = drawPosWorld(structure.x * cell, structure.y * cell);
  const b = drawPosWorld(structure.x * cell + span, structure.y * cell + span);
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.max(8, Math.abs(b.x - a.x));
  const h = Math.max(8, Math.abs(b.y - a.y));
  const inset = Math.max(3, Math.floor(Math.min(w, h) * 0.06));
  const feed = ensureFeed(ch);

  g.save();
  g.shadowColor = "rgba(0,0,0,0.75)";
  g.shadowBlur = 14;
  g.shadowOffsetX = 3;
  g.shadowOffsetY = 5;
  g.fillStyle = "#14110e";
  g.fillRect(x, y, w, h);
  g.shadowColor = "transparent";
  if (feed) {
    g.imageSmoothingEnabled = false;
    g.drawImage(feed, x + inset, y + inset, w - inset * 2, h - inset * 2);
  }
  g.strokeStyle = CHANNEL_HEX[ch];
  g.lineWidth = 3;
  g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  g.strokeStyle = "rgba(0,0,0,0.55)";
  g.lineWidth = 1;
  g.strokeRect(x + inset + 0.5, y + inset + 0.5, w - inset * 2 - 1, h - inset * 2 - 1);
  g.restore();
}

function paintOverlay() {
  try {
    api.rendering.withOverlayContext((g) => {
      if (!g) return;
      for (let ch = 0; ch < CHANNELS; ch++) {
        const cams = listType(camId(ch));
        for (let i = 0; i < cams.length; i++) strokeZoneOn(g, cams[i], ch);
        const screens = listType(screenId(ch));
        for (let i = 0; i < screens.length; i++) blitScreenOn(g, screens[i], ch);
      }
    });
  } catch (err) {
    console.warn("[viewfinder] overlay", err);
  }
}

function drawCamera(a, b, c) {
  try {
    const { structure, ctx } = normalizeDraw(a, b, c);
    if (structure && ctx?.ctx && ctx.placing) {
      const ch = structure.data?.channel ?? channelFromId(structure.type, CAM_IDS);
      if (ch != null) strokeZoneOn(ctx.ctx, structure, ch);
    }
  } catch (err) {
    console.warn("[viewfinder] camera draw", err);
  }
  return false;
}

function drawScreen(a, b, c) {
  try {
    const { structure, ctx } = normalizeDraw(a, b, c);
    if (structure && ctx?.ctx && ctx.placing) {
      const ch = structure.data?.channel ?? channelFromId(structure.type, SCREEN_IDS);
      if (ch != null) blitScreenOn(ctx.ctx, structure, ch);
    }
  } catch (err) {
    console.warn("[viewfinder] screen draw", err);
  }
  return false;
}

function paintCameraSprite(cam) {
  const corner = (cam.data?.corner ?? 0) % 4;
  try {
    api.structures.setSpritesheetIndex(cam, corner);
  } catch {
    try {
      api.structures.setSpritesheetIndexAtCell?.(cam.x, cam.y, corner);
    } catch {
      /* ignore */
    }
  }
}

function registerI18n() {
  const en = {
    "mods|viewfinder|pack": "Viewfinder",
    "mods|viewfinder|cam|desc":
      "Click to swing the 5×5 tile capture corner. One camera per channel.",
    "mods|viewfinder|screen|desc":
      "Draws that channel's 5×5 tile feed (80×80 px). Place as many as you want.",
    "mods|viewfinder|toast|camFull": "Channel {channel} already has a camera.",
    "mods|viewfinder|toast|corner": "Channel {channel} · {corner}",
    "mods|viewfinder|toast|waiting": "Channel {channel} camera online. Place a screen.",
    "mods|viewfinder|tooltip|cam": "Channel {channel} · {corner}",
    "mods|viewfinder|tooltip|screen": "Channel {channel} screen",
  };
  for (let ch = 0; ch < CHANNELS; ch++) {
    en[`mods|viewfinder|cam|${ch}|name`] = `Camera ${ch}`;
    en[`mods|viewfinder|screen|${ch}|name`] = `Screen ${ch}`;
  }
  api.i18n.register("en", en);
}

function registerStructures() {
  for (let ch = 0; ch < CHANNELS; ch++) {
    api.structures.register({
      id: camId(ch),
      nameKey: `mods|viewfinder|cam|${ch}|name`,
      descriptionKey: "mods|viewfinder|cam|desc",
      categoryKey: "logic",
      order: 50 + ch * 2,
      buildModes: [{ type: "single" }],
      shape: tileShape(1),
      defaultData: { channel: ch, corner: 0, cornerName: "top-left" },
      copyData: ["channel", "corner", "cornerName"],
      render: {
        imageName: `${MOD}.cam.${ch}`,
        size: { width: TILE_PX, height: TILE_PX },
        spritesheet: { frameSize: { width: TILE_PX, height: TILE_PX } },
      },
      tooltipHover: {
        type: "custom",
        dataFieldMessage: {
          messageKey: "mods|viewfinder|tooltip|cam",
          fields: [
            { param: "channel", field: "channel", fallback: ch },
            { param: "corner", field: "cornerName", fallback: "top-left" },
          ],
        },
      },
      draw: drawCamera,
    });

    api.structures.register({
      id: screenId(ch),
      nameKey: `mods|viewfinder|screen|${ch}|name`,
      descriptionKey: "mods|viewfinder|screen|desc",
      categoryKey: "logic",
      order: 51 + ch * 2,
      buildModes: [{ type: "single" }],
      shape: tileShape(ZONE_TILES),
      defaultData: { channel: ch },
      copyData: ["channel"],
      render: {
        imageName: `${MOD}.screen`,
        size: { width: FEED_PX, height: FEED_PX },
      },
      tooltipHover: {
        type: "custom",
        dataFieldMessage: {
          messageKey: "mods|viewfinder|tooltip|screen",
          fields: [{ param: "channel", field: "channel", fallback: ch }],
        },
      },
      draw: drawScreen,
    });

    try {
      api.player.buildings.unlockById(camId(ch));
      api.player.buildings.unlockById(screenId(ch));
    } catch {
      api.player.buildings.add?.(camId(ch));
      api.player.buildings.add?.(screenId(ch));
    }
  }
}

function registerLimit() {
  api.hooks.intercept(
    "building:place",
    (payload, ctx) => {
      try {
        const id = payload?.structureId ?? payload?.structureType ?? payload?.id;
        const ch = channelFromId(id, CAM_IDS);
        if (ch == null) return;
        if (listType(camId(ch)).length < MAX_CAMERAS) return;
        toast("mods|viewfinder|toast|camFull", { channel: ch });
        ctx?.cancel?.();
      } catch (err) {
        console.warn("[viewfinder] place intercept", err);
      }
    },
    { structureTypes: CAM_IDS },
  );
}

function registerInteract() {
  for (let ch = 0; ch < CHANNELS; ch++) {
    api.signals.interactables.register(camId(ch), (structure) => {
      try {
        const list = corners();
        const next = ((structure.data?.corner ?? 0) + 1) % list.length;
        const name = list[next].name;
        api.structures.updateData(
          structure,
          { channel: ch, corner: next, cornerName: name },
          { propagateToWorkers: true },
        );
        paintCameraSprite(structure);
        toast("mods|viewfinder|toast|corner", { channel: ch, corner: name });
        captureChannel(ch);
      } catch (err) {
        console.warn("[viewfinder] interact", err);
      }
    });
  }
}

function registerLifecycle() {
  api.events.on("building:placed", (e) => {
    try {
      const s = e?.structure;
      const camCh = channelFromId(e?.structureId ?? s?.type, CAM_IDS);
      if (camCh != null) {
        const cam = s || listType(camId(camCh))[0];
        if (cam) {
          api.structures.updateData(
            cam,
            {
              channel: camCh,
              corner: cam.data?.corner ?? 0,
              cornerName: corners()[(cam.data?.corner ?? 0) % 4].name,
            },
            { propagateToWorkers: true },
          );
          paintCameraSprite(cam);
        }
        toast("mods|viewfinder|toast|waiting", { channel: camCh });
        captureChannel(camCh);
      }
      const scrCh = channelFromId(e?.structureId ?? s?.type, SCREEN_IDS);
      if (scrCh != null) captureChannel(scrCh);
    } catch (err) {
      console.warn("[viewfinder] placed", err);
    }
  });

  // Capture on a timer (NOT from the frame:render payload): capture reads the
  // LIVE global sandkit.state.shared.mapData. Throttled to ~10 fps.
  api.events.on("frame:render", () => {
    paintOverlay();
    const now = Date.now();
    if (now - lastCaptureMs < 100) return;
    lastCaptureMs = now;
    for (let ch = 0; ch < CHANNELS; ch++) captureChannel(ch);
  });
}

function registerCapture() {
  api.triggers.register(`${MOD}:capture`, {
    // This engine build's scheduler reads `interval` (no `intervalMs`
    // aliasing — an undefined interval means the trigger never fires).
    interval: 100,
    intervalMs: 100,
    callback: () => {
      try {
        // Keep captures fresh here too: captureChannel reads the LIVE global
        // state directly (not the frame:render payload), so the trigger is a
        // real capture tick — not just fallbacks.
        for (let ch = 0; ch < CHANNELS; ch++) captureChannel(ch);
      } catch (err) {
        console.warn("[viewfinder] capture", err);
      }
    },
  });
}

async function boot() {
  registerI18n();
  // Sprites first (documented order: load before structure render.imageName
  // use) — but each load is best-effort so one failure can never abort boot
  // and prevent structure registration.
  try {
    await api.sprites.loadFromMod(`${MOD}.screen`, "assets/screen.png");
  } catch (err) {
    console.warn("[viewfinder] screen sprite failed", err);
  }
  for (let ch = 0; ch < CHANNELS; ch++) {
    try {
      await api.sprites.loadFromMod(`${MOD}.cam.${ch}`, `assets/camera-${ch}.png`);
    } catch (err) {
      console.warn(`[viewfinder] camera ${ch} sprite failed`, err);
    }
    ensureFeed(ch);
  }
  // Structures can no longer be blocked by sprite loading failures.
  registerStructures();
  registerLimit();
  registerInteract();
  registerLifecycle();
  registerCapture();
}

await boot();
