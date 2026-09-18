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
const TILE_PX = 16;
const MAX_CAMERAS = 1;

const api = sandkit.api;
const state = sandkit.state;

// Up to 10 channel colours. Only the first CHANNELS are ever used.
const CHANNEL_HEX = [
  "#3de0ff",
  "#ff3d9a",
  "#ffc93d",
  "#7dff3d",
  "#ff8c3d",
  "#a855f7",
  "#3dd1ff",
  "#ff6b3d",
  "#3dff7d",
  "#ff3dbd",
];

/**
 * Live, settings-driven channel/zone configuration. Defaults match the static
 * constants above; they get overridden by `api.settings.get(...)` on boot and
 * whenever the player changes the mod settings.
 */
let CHANNELS = 4;
let ZONE_TILES = 6;
let FEED_PX = ZONE_TILES * TILE_PX;

/**
 * @type {Array<string>} cam ids: ${MOD}.cam.${ch} for each channel
 */
let CAM_IDS = [];
/**
 * @type {Array<string>} screen ids: ${MOD}.screen.${ch} for each channel
 */
let SCREEN_IDS = [];
/**
 * @type {Array<HTMLCanvasElement|null>} feed canvas per channel
 */
let feeds = [];
/**
 * @type {Array<boolean>} per channel: true once a real world capture succeeded
 */
let hadCopy = [];

/** Rebuild channel id arrays, feed slots and canvas sizes from current settings. */
function rebuildChannelArrays() {
  const prevChannels = CAM_IDS.length;
  const prevFeeds = feeds;

  CAM_IDS = [];
  SCREEN_IDS = [];
  for (let ch = 0; ch < CHANNELS; ch++) {
    CAM_IDS.push(`${MOD}.cam.${ch}`);
    SCREEN_IDS.push(`${MOD}.screen.${ch}`);
  }

  feeds = [];
  hadCopy = [];
  for (let ch = 0; ch < CHANNELS; ch++) {
    const prev = ch < prevChannels ? prevFeeds[ch] : null;
    feeds.push(prev);
    hadCopy.push(ch < prevChannels ? (hadCopy[ch] ?? false) : false);
  }

  FEED_PX = ZONE_TILES * TILE_PX;
  for (let ch = 0; ch < CHANNELS; ch++) {
    const f = feeds[ch];
    if (!f) {
      if (typeof document === "undefined") {
        feeds[ch] = null;
        continue;
      }
      const c = document.createElement("canvas");
      c.width = FEED_PX;
      c.height = FEED_PX;
      feeds[ch] = c;
    } else {
      f.width = FEED_PX;
      f.height = FEED_PX;
    }
    const ctx = feeds[ch] ? feeds[ch].getContext("2d", { willReadFrequently: true }) : null;
    if (ctx) paintNoSignal(ctx, ch);
  }
}

/** Clip a numeric setting value into its allowed range. */
function clampInt(v, lo, hi) {
  if (typeof v !== "number" || !isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, Math.floor(v)));
}

/** Read the current enabled . Default true if the field is missing. */
function isEnabled() {
  try {
    const v = api.settings.get("isEnabled");
    return typeof v === "boolean" ? v : true;
  } catch {
    return true;
  }
}

/** Apply settings changes: rebuild channel arrays / feed size when relevant
 * fields change, then re-register structures so the new channel count takes
 * effect without a restart. */
function applySettings(values) {
  const nextChannels = clampInt(values.channels, 1, 10);
  const nextZone = clampInt(values.zoneTiles, 2, 30);
  let changed = false;
  if (nextChannels !== CHANNELS) {
    CHANNELS = nextChannels;
    changed = true;
  }
  if (nextZone !== ZONE_TILES) {
    ZONE_TILES = nextZone;
    changed = true;
  }
  if (changed) {
    rebuildChannelArrays();
    registerStructures();
    registerI18n();
  }
}

function camId(ch) {
  return CAM_IDS[ch];
}
function screenId(ch) {
  return SCREEN_IDS[ch];
}

/** Last capture tick, throttles capture inside frame:render (~10 fps). */
let lastCaptureMs = 0;
/** Scratch canvas for the live world-map capture. */
let mapScratch = null;

function metrics() {
  try {
    return {
      cell : 4,
      snap : 4,
      tilePx: 4 * 4 ,
      zoneCells: ZONE_TILES * 4,
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
  const row = Array(n).fill(0);
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
  let fullCell = false
    const md = (state && state.shared) ? state.shared.mapData : null;
    if (md != null) {
      const si = 4 * (cy * md.width + cx );
      const c = [md.data[si], md.data[si + 1], md.data[si + 2], md.data[si + 3]]
      if (c[3] != 0) {
        fullCell = 1
        if (!(c[0] == 255 && c[1] == 0 && c[2] == 0)){
          const color = `rgba(${c[0]}, ${c[1]}, ${c[2]}, 1)`
          return color;
        }
    }
  }
  try {
    // ====== for not catch element like liquid
    const type = api.elements.getTypeAtCell(cx, cy);
    // console.log(" TYPE==", type);
    if (type != null) {
        // Deterministic hue per element type — the info payload has no color.
        const h = (type * 67) % 360;
        return `hsla(${h}, 35%, 25%, .5)`;
    }
  } catch {
    /* ignore */
  }
  try {
    if (api.structures.hasBuiltAtCell?.(cx, cy)) {
      const r = 4 * Math.floor(Math.random() * 6)
      if (fullCell)  {
        return `rgba(${128 + r}, ${128 + r}, ${128 + r}, .25)`
      }
      else {
        return `rgba(${64 + r}, ${64 + r}, ${64 + r}, .25)`;
      }
    }
  } catch {
    /* ignore */
  }
  try {
    if (api.terrains.isAtCell?.(cx, cy)) return "#49628c";
  } catch {
    /* ignore */
  }
  const r = 4 * Math.floor(Math.random() * 8)
  return `rgba(${r}, ${r}, ${r}, .25)`;
}

function paintNoSignal(ctx, ch) {
  if (!ctx) return;
  ctx.clearRect(0, 0, FEED_PX, FEED_PX);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, FEED_PX, FEED_PX);
  ctx.fillStyle = CHANNEL_HEX[ch];
  ctx.globalAlpha = 0.3;
  for (let i = 0; i < 30; i++) {
    ctx.fillRect((i * 17 + ch * 9) % FEED_PX, (i * 13 + ch * 5) % FEED_PX, 3, 3);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = CHANNEL_HEX[ch];
  ctx.font = "bold 12px monospace";
  ctx.fillText("NO SIGNAL", 8, 44);
  ctx.fillStyle = "#889";
  ctx.font = "10px monospace";
  ctx.fillText("CH " + ch, 8, 60);
}

function paintSchematic(ctx, originX, originY,  zoneCells) {
  for (let ty = 0; ty < zoneCells; ty++) {
    for (let tx = 0; tx < zoneCells; tx++) {
      const cx = originX + tx;
      const cy = originY + ty;
      ctx.fillStyle = colorAtCell(cx, cy);
      ctx.fillRect(tx * 4 , ty * 4 , 4, 4);
    }
  }
}



function captureChannel(ch) {
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
  // if (captureFromMap(ctx, z, zoneCells, ch, state)) return;
  if (!hadCopy[ch]) paintSchematic(ctx, z.x, z.y, zoneCells);
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
  const feed = ensureFeed(ch);

  g.save();
  // 50% transparent black background — empty feed pixels (alpha < 255)
  // composite onto this. Edge to edge, no inset.
  g.fillStyle = "rgba(20,20,20,0.3)";
  g.fillRect(x, y, w, h);
  if (feed) {
    g.imageSmoothingEnabled = false;
    // Fill the full screen rectangle, no inset gap — image is edge to edge.
    g.drawImage(feed, x, y, w, h);
  }
  // Colored border per channel (kept).
  g.strokeStyle = CHANNEL_HEX[ch];
  g.lineWidth = 3;
  g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
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
      categoryKey: "camera",
      order: 0,
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
      categoryKey: "camera",
      order: 0,
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

  // Read settings and build channel arrays / feed size from them. A
  // settings.onChange callback re-runs the same flow when the player edits
  // the mod config.
  try {
    const all = api.settings.getAll();
    const channels = clampInt(all.channels, 1, 10);
    const zone = clampInt(all.zoneTiles, 2, 30);
    if (channels !== CHANNELS) CHANNELS = channels;
    if (zone !== ZONE_TILES) ZONE_TILES = zone;
  } catch {
    /* settings API may not be present; keep defaults */
  }
  rebuildChannelArrays();

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

  // React to config changes at runtime.
  try {
    api.settings.onChange((values) => {
      if (!isEnabled()) {
        // Mod disabled: stop capturing and clear feeds.
        for (let ch = 0; ch < CHANNELS; ch++) hadCopy[ch] = false;
        return;
      }
      applySettings(values);
    });
  } catch {
    /* settings API may not be present */
  }
}

await boot();
