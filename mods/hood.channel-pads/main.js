/**
 * Channel Pads — independent Sandustry mod (Main entry).
 *
 * Ten 1×1 pads (channels 0–9). At most two pads per channel.
 * Walk onto a linked pad → setPositionAtWorld at the twin. Shared cooldown.
 *
 * Workshop loader wraps this file as an async IIFE with `sandkit` in scope.
 * Do not pass `state` — Sandkit injects it.
 *
 * Do NOT call sandkit.engine.api.teleportZones — that is an internal
 * (state, …) facade and hard-crashes from mod code.
 */
const MOD = "hood.channel-pads";
const CHANNELS = 10;
const MAX_PER_CHANNEL = 2;
const COOLDOWN_MS = 1600;

const api = sandkit.api;

const CHANNEL_COLORS = [
  [0.24, 0.88, 1.0, 1],
  [1.0, 0.24, 0.6, 1],
  [1.0, 0.79, 0.24, 1],
  [0.49, 1.0, 0.24, 1],
  [0.62, 0.42, 1.0, 1],
  [1.0, 0.48, 0.24, 1],
  [0.91, 0.96, 1.0, 1],
  [1.0, 0.42, 0.54, 1],
  [0.18, 0.9, 0.75, 1],
  [0.3, 0.55, 1.0, 1],
];

const PAD_IDS = [];
for (let ch = 0; ch < CHANNELS; ch++) PAD_IDS.push(padId(ch));

/** @type {Record<number, number>} */
const lastJumpAt = {};
/** Skip the pad we just landed on until the player walks off it. */
let skipUntilLeave = null;

function padId(ch) {
  return `${MOD}.pad.${ch}`;
}

function cellSize() {
  try {
    return api.config?.getLegacy?.()?.cellSize ?? 4;
  } catch {
    return 4;
  }
}

function nowMs() {
  try {
    return api.time.getElapsedMs?.() ?? api.time.getTimeMs?.() ?? Date.now();
  } catch {
    return Date.now();
  }
}

function toast(key, params) {
  try {
    api.ui.toast({ key, params });
  } catch {
    try {
      api.ui.toast(api.i18n?.t?.(key, params) || key);
    } catch {
      /* toast optional */
    }
  }
}

function listChannel(ch) {
  const pads = [];
  try {
    api.structures.forEachOfType(padId(ch), (s) => pads.push(s));
  } catch {
    /* type not placed yet */
  }
  return pads;
}

function channelFromId(id) {
  if (id == null) return null;
  for (let ch = 0; ch < CHANNELS; ch++) {
    if (id === padId(ch)) return ch;
    try {
      const type = api.structures.getTypeById?.(padId(ch));
      if (type != null && type === id) return ch;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function channelFromStructure(structure) {
  if (!structure) return null;
  if (typeof structure.data?.channel === "number") return structure.data.channel;
  for (let ch = 0; ch < CHANNELS; ch++) {
    try {
      if (api.structures.isType(structure, padId(ch))) return ch;
    } catch {
      /* ignore */
    }
  }
  return null;
}

function flash(cellX, cellY, ch) {
  try {
    const cs = cellSize();
    api.lights?.temporary?.createAtWorld?.(cellX * cs + cs / 2, cellY * cs + cs / 2, {
      durationMs: 220,
      brightness: 2.2,
      size: 56,
      color: CHANNEL_COLORS[ch] || [0.4, 0.9, 1, 1],
    });
  } catch {
    /* lights optional */
  }
}

function paint(ch) {
  const pads = listChannel(ch);
  const linked = pads.length === MAX_PER_CHANNEL;
  for (const s of pads) {
    try {
      api.structures.updateData(
        s,
        { channel: ch, mates: pads.length },
        { propagateToWorkers: true },
      );
    } catch {
      /* ignore */
    }
    const frame = linked ? 1 : 0;
    try {
      api.structures.setSpritesheetIndex(s, frame);
    } catch {
      try {
        api.structures.setSpritesheetIndexAtCell?.(s.x, s.y, frame);
      } catch {
        /* ignore */
      }
    }
  }
  return pads;
}

function relink(ch, reason) {
  const pads = paint(ch);
  if (reason === "placed" && pads.length === MAX_PER_CHANNEL) {
    flash(pads[0].x, pads[0].y, ch);
    flash(pads[1].x, pads[1].y, ch);
    toast("mods|channelPads|toast|linked", { channel: ch });
  } else if (reason === "placed" && pads.length === 1) {
    toast("mods|channelPads|toast|waiting", { channel: ch });
  } else if (reason === "removed" && pads.length === 1) {
    toast("mods|channelPads|toast|unpaired", { channel: ch });
  }
}

function standingOn(structure) {
  try {
    if (api.player.isCollidingWithCell(structure.x, structure.y)) return true;
  } catch {
    /* ignore */
  }
  try {
    if (api.player.isWithinRadiusOfCell?.(structure.x, structure.y, 1)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function worldAt(cellX, cellY) {
  const cs = cellSize();
  return { x: cellX * cs, y: cellY * cs };
}

function isClear(wx, wy) {
  try {
    if (typeof api.player.isPositionClearAtWorld !== "function") return true;
    return api.player.isPositionClearAtWorld(wx, wy) !== false;
  } catch {
    return true;
  }
}

/**
 * Land beside / above the dest pad so we never spawn inside the structure
 * (that is what used to ping-pong — and crash via internal teleportZones).
 */
function landingWorld(dest) {
  const offsets = [
    [0, -2],
    [0, -1],
    [-1, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [0, 1],
    [0, 0],
  ];
  for (const [dx, dy] of offsets) {
    const { x, y } = worldAt(dest.x + dx, dest.y + dy);
    if (isClear(x, y)) return { x, y };
  }
  return worldAt(dest.x, dest.y - 2);
}

function teleportTo(dest, ch) {
  const land = landingWorld(dest);
  try {
    if (typeof api.player.setPositionAtWorld === "function") {
      api.player.setPositionAtWorld(land.x, land.y);
    } else if (typeof api.player.setPosition === "function") {
      api.player.setPosition(land.x, land.y);
    } else {
      toast("mods|channelPads|toast|fail", { channel: ch });
      return false;
    }
  } catch (err) {
    console.warn("[channel-pads] setPositionAtWorld", err);
    toast("mods|channelPads|toast|fail", { channel: ch });
    return false;
  }
  try {
    api.player.setVelocity?.(0, 0);
  } catch {
    /* ignore */
  }
  flash(dest.x, dest.y, ch);
  skipUntilLeave = { ch, x: dest.x, y: dest.y };
  lastJumpAt[ch] = nowMs();
  return true;
}

function registerI18n() {
  const en = {
    "mods|channelPads|pack": "Channel Pads",
    "mods|channelPads|pad|desc":
      "Walk onto a linked pad to teleport to its twin. Only two pads per channel.",
    "mods|channelPads|toast|full": "Channel {channel} already has two pads.",
    "mods|channelPads|toast|linked": "Channel {channel} linked.",
    "mods|channelPads|toast|waiting": "Channel {channel} waiting for a twin.",
    "mods|channelPads|toast|unpaired": "Channel {channel} unpaired.",
    "mods|channelPads|toast|fail": "Channel {channel} could not fold.",
    "mods|channelPads|tooltip": "Channel {channel} · {mates}/2",
  };
  for (let ch = 0; ch < CHANNELS; ch++) {
    en[`mods|channelPads|pad|${ch}|name`] = `Channel Pad ${ch}`;
  }
  api.i18n.register("en", en);
}

function registerPads() {
  for (let ch = 0; ch < CHANNELS; ch++) {
    const id = padId(ch);
    api.structures.register({
      id,
      nameKey: `mods|channelPads|pad|${ch}|name`,
      descriptionKey: "mods|channelPads|pad|desc",
      categoryKey: "logistics",
      order: 40 + ch,
      buildModes: [{ type: "single" }],
      shape: [[1]],
      defaultData: { channel: ch, mates: 0 },
      copyData: ["channel"],
      render: { imageName: `${MOD}.img.${ch}`, size: { width: 16, height: 16 } },
      spritesheet: { frameSize: { width: 16, height: 16 } },
      tooltipHover: {
        type: "custom",
        dataFieldMessage: {
          messageKey: "mods|channelPads|tooltip",
          fields: [
            { param: "channel", field: "channel", fallback: ch },
            { param: "mates", field: "mates", fallback: 0 },
          ],
        },
      },
    });
    try {
      api.player.buildings.unlockById(id);
    } catch {
      api.player.buildings.add?.(id);
    }
  }
}

function registerLimitHook() {
  api.hooks.intercept(
    "building:place",
    (payload, ctx) => {
      try {
        const id = payload?.structureId ?? payload?.structureType ?? payload?.id;
        const ch = channelFromId(id);
        if (ch == null) return;
        if (listChannel(ch).length < MAX_PER_CHANNEL) return;
        toast("mods|channelPads|toast|full", { channel: ch });
        ctx?.cancel?.();
      } catch (err) {
        console.warn("[channel-pads] place intercept", err);
      }
    },
    { structureTypes: PAD_IDS },
  );
}

function registerLifecycle() {
  api.events.on("building:placed", (e) => {
    try {
      const structure = e?.structure;
      const ch =
        channelFromStructure(structure) ??
        channelFromId(e?.structureId ?? structure?.type);
      if (ch == null) return;
      relink(ch, "placed");
    } catch (err) {
      console.warn("[channel-pads] placed", err);
    }
  });

  api.events.on("building:removed", (e) => {
    try {
      const ch = channelFromId(e?.structureId ?? e?.structure?.type);
      if (ch == null) return;
      relink(ch, "removed");
    } catch (err) {
      console.warn("[channel-pads] removed", err);
    }
  });
}

function registerStep() {
  api.triggers.register(`${MOD}:step`, {
    intervalMs: 50,
    callback: () => {
      try {
        if (skipUntilLeave) {
          const still = listChannel(skipUntilLeave.ch).some(
            (s) => s.x === skipUntilLeave.x && s.y === skipUntilLeave.y && standingOn(s),
          );
          if (still) return;
          skipUntilLeave = null;
        }

        const t = nowMs();
        for (let ch = 0; ch < CHANNELS; ch++) {
          if (t - (lastJumpAt[ch] || 0) < COOLDOWN_MS) continue;
          const pads = listChannel(ch);
          if (pads.length !== MAX_PER_CHANNEL) continue;
          for (let i = 0; i < 2; i++) {
            const here = pads[i];
            const there = pads[1 - i];
            if (!standingOn(here)) continue;
            teleportTo(there, ch);
            return;
          }
        }
      } catch (err) {
        console.warn("[channel-pads] step", err);
      }
    },
  });
}

async function boot() {
  registerI18n();
  for (let ch = 0; ch < CHANNELS; ch++) {
    await api.sprites.loadFromMod(`${MOD}.img.${ch}`, `assets/pad-${ch}.png`);
  }
  registerPads();
  registerLimitHook();
  registerLifecycle();
  registerStep();
}

await boot();
