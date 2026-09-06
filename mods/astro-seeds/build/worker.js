// src/shared/ids.ts
var MOD_ID = "astro.seeds";
var VERSION = "3.1.0";
var ASTRO_FIELD = /* @__PURE__ */ function(ASTRO_FIELD2) {
  ASTRO_FIELD2[ASTRO_FIELD2["AGE"] = 1] = "AGE";
  ASTRO_FIELD2[ASTRO_FIELD2["VX"] = 2] = "VX";
  ASTRO_FIELD2[ASTRO_FIELD2["VY"] = 3] = "VY";
  return ASTRO_FIELD2;
}({});

// src/shared/configSchema.ts
var BUF_LENGTH = 32;
var JSON_BUF_LENGTH = 2048;
var JSON_COUNTER_INDEX = 7;
var CONFIG_FIELDS = [
  // master (panel toggles at top)
  {
    index: 0,
    key: "enabled",
    kind: "bool",
    section: "master",
    label: "Mod active",
    default: true
  },
  {
    index: 1,
    key: "debugLog",
    kind: "bool",
    section: "master",
    label: "Debug log",
    default: false
  },
  {
    index: 2,
    key: "waterEnabled",
    kind: "bool",
    section: "master",
    label: "Water profile",
    default: true
  },
  // move
  {
    index: 3,
    key: "stepMove",
    kind: "bool",
    section: "move",
    label: "Movement",
    default: true
  },
  {
    index: 4,
    key: "moveSide",
    kind: "number",
    section: "move",
    label: "Side %",
    default: 0,
    min: 0,
    max: 100,
    when: "stepMove"
  },
  {
    index: 5,
    key: "moveFloat",
    kind: "number",
    section: "move",
    label: "Float %",
    default: 0,
    min: 0,
    max: 100,
    when: "stepMove"
  },
  {
    index: 6,
    key: "moveSink",
    kind: "number",
    section: "move",
    label: "Sink %",
    default: 0,
    min: 0,
    max: 100,
    when: "stepMove"
  },
  // index 7 (old moveContact slot) is reused as JSON_COUNTER_INDEX by the
  // panel (uint8 JSON buffer change signal) — see JSON_COUNTER_INDEX.
  {
    index: 20,
    key: "stepForceMove",
    kind: "bool",
    section: "move",
    label: "Column forces",
    default: false
  },
  // grow
  {
    index: 8,
    key: "stepGrow",
    kind: "bool",
    section: "grow",
    label: "Grow",
    default: false
  },
  {
    index: 9,
    key: "growInstantTouch",
    kind: "number",
    section: "grow",
    label: "Instant %",
    default: 0,
    min: 0,
    max: 100,
    when: "stepGrow"
  },
  {
    index: 10,
    key: "growOnAir",
    kind: "number",
    section: "grow",
    label: "Air %",
    default: 0,
    min: 0,
    max: 100,
    when: "stepGrow"
  },
  {
    index: 11,
    key: "growOnWall",
    kind: "number",
    section: "grow",
    label: "Wall %",
    default: 0,
    min: 0,
    max: 100,
    when: "stepGrow"
  },
  {
    index: 12,
    key: "growOnFloor",
    kind: "number",
    section: "grow",
    label: "Floor %",
    default: 0,
    min: 0,
    max: 100,
    when: "stepGrow"
  },
  {
    index: 13,
    key: "growOnCrystal",
    kind: "number",
    section: "grow",
    label: "Crystal %",
    default: 0,
    min: 0,
    max: 100,
    when: "stepGrow"
  },
  {
    index: 14,
    key: "growIfSurround",
    kind: "number",
    section: "grow",
    label: "Surround %",
    default: 0,
    min: 0,
    max: 100,
    when: "stepGrow"
  },
  {
    index: 15,
    key: "growSurroundMin",
    kind: "number",
    section: "grow",
    label: "Surr. min",
    default: 0,
    min: 0,
    max: 8,
    when: "stepGrow"
  },
  // crystal
  {
    index: 16,
    key: "stepCrystalisation",
    kind: "bool",
    section: "crystal",
    label: "Crystallize",
    default: false
  },
  {
    index: 17,
    key: "crystalGrowAge",
    kind: "number",
    section: "crystal",
    label: "Grow age",
    default: 0,
    min: 0,
    max: 200,
    when: "stepCrystalisation"
  },
  {
    index: 18,
    key: "crystalShape",
    kind: "number",
    section: "crystal",
    label: "Shape 0\u20134",
    default: 0,
    min: 0,
    max: 4,
    when: "stepCrystalisation"
  },
  {
    index: 19,
    key: "crystalRadius",
    kind: "number",
    section: "crystal",
    label: "Radius",
    default: 0,
    min: 0,
    max: 6,
    when: "stepCrystalisation"
  }
];
var bufField = Object.fromEntries(CONFIG_FIELDS.map((f) => [
  f.key,
  f.index
]));
var DEFAULT_FORCE_CONFIG = {
  columnForce: [
    {
      rateFn: -50,
      matchTypes: [],
      directions: [
        "sides"
      ],
      rangeNFn: 10,
      maxKFn: 5,
      freeTypes: [],
      excludeTypes: []
    }
  ]
};

// src/worker/definition/config.ts
var cfgBuf = null;
try {
  cfgBuf = sandkit.api.shared.buffers.require("astroConfig", {
    type: "uint16",
    length: BUF_LENGTH
  });
} catch (e) {
  console.error(`[${MOD_ID} v${VERSION}] config buffer missing:`, e);
}
var jsonBuf = null;
try {
  jsonBuf = sandkit.api.shared.buffers.require("astroJson", {
    type: "uint8",
    length: JSON_BUF_LENGTH
  });
} catch (e) {
  console.error(`[${MOD_ID} v${VERSION}] astroJson buffer missing:`, e);
}
function u16(i, fallback = 0) {
  if (!cfgBuf) return fallback;
  const v = cfgBuf[i];
  if (v === void 0 || v === null) return fallback;
  return v;
}
function bool(key) {
  const i = bufField[key];
  if (i === void 0) return false;
  return u16(i, 0) !== 0;
}
function num(key) {
  const i = bufField[key];
  if (i === void 0) return 0;
  return u16(i, 0);
}
var WaterCfg = {
  modEnabled: () => bool("enabled"),
  debug: () => bool("debugLog"),
  enabled: () => bool("waterEnabled"),
  stepMove: () => bool("stepMove"),
  moveSide: () => num("moveSide"),
  moveFloat: () => num("moveFloat"),
  moveSink: () => num("moveSink"),
  stepForceMove: () => bool("stepForceMove"),
  stepGrow: () => bool("stepGrow"),
  growInstantTouch: () => num("growInstantTouch"),
  growOnAir: () => num("growOnAir"),
  growOnWall: () => num("growOnWall"),
  growOnFloor: () => num("growOnFloor"),
  growOnCrystal: () => num("growOnCrystal"),
  growIfSurround: () => num("growIfSurround"),
  growSurroundMin: () => num("growSurroundMin"),
  stepCrystalisation: () => bool("stepCrystalisation"),
  crystalGrowAge: () => Math.max(0, num("crystalGrowAge")),
  crystalShape: () => num("crystalShape"),
  crystalRadius: () => Math.max(0, num("crystalRadius"))
};
function log(...args) {
  if (WaterCfg.debug()) console.log(`[${MOD_ID} v${VERSION}]`, ...args);
}
function toNum(v, d = 0) {
  return typeof v === "number" && Number.isFinite(v) ? v : d;
}
function toTypeArr(v) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const t of v) {
    if (typeof t === "number" && Number.isInteger(t)) out.push(t);
  }
  return out;
}
function toDirArr(v) {
  if (!Array.isArray(v)) return [];
  const known = [
    "top",
    "bottom",
    "left",
    "right",
    "sides"
  ];
  const out = /* @__PURE__ */ new Set();
  for (const d of v) {
    if (typeof d === "string" && known.includes(d)) {
      out.add(d);
    }
  }
  return [
    ...out
  ];
}
function readJsonString(buffer) {
  console.log("readJsonString", buffer);
  try {
    const end = buffer.indexOf(0);
    const bytes = buffer.slice(0, end === -1 ? buffer.length : end);
    const result = new TextDecoder().decode(bytes);
    console.log("readJsonString", result);
    return result;
  } catch (e) {
    console.error("readJsonString failed", e);
  }
  return "";
}
function parseForceConfig(raw) {
  if (!raw) return DEFAULT_FORCE_CONFIG;
  try {
    const obj = JSON.parse(raw);
    if (!Array.isArray(obj.columnForce)) return DEFAULT_FORCE_CONFIG;
    const columnForce = [];
    for (const rawEntry of obj.columnForce) {
      if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) continue;
      const e = rawEntry;
      columnForce.push({
        rateFn: toNum(e.rateFn),
        matchTypes: toTypeArr(e.matchTypes),
        directions: toDirArr(e.directions),
        rangeNFn: Math.max(0, toNum(e.rangeNFn, 10)),
        maxKFn: Math.max(0, toNum(e.maxKFn, 3)),
        freeTypes: toTypeArr(e.freeTypes),
        excludeTypes: toTypeArr(e.excludeTypes)
      });
    }
    return {
      columnForce
    };
  } catch {
    return DEFAULT_FORCE_CONFIG;
  }
}
var cacheCounter = -1;
var cacheConfig = null;
function forceConfig() {
  const counter = u16(JSON_COUNTER_INDEX, -1);
  if (counter !== cacheCounter || !cacheConfig) {
    cacheCounter = counter;
    cacheConfig = parseForceConfig(jsonBuf ? readJsonString(jsonBuf) : "");
  }
  return cacheConfig;
}
function forceEntries() {
  return forceConfig().columnForce;
}
var seen = /* @__PURE__ */ new Set();
for (const f of CONFIG_FIELDS) {
  if (seen.has(f.index)) {
    console.error(`[${MOD_ID}] duplicate buf index`, f.index, f.key);
  }
  seen.add(f.index);
}

// src/worker/utils/grid.ts
var Grid = {
  // TYPE
  getTypeAt(x, y) {
    return sandkit.api.elements.getResolvedTypeAtCell(x, y);
  },
  isEmptyAt(x, y) {
    try {
      if (typeof sandkit.api.grid.isCellEmptyAtCell === "function") {
        return sandkit.api.grid.isCellEmptyAtCell(x, y);
      }
    } catch {
    }
    const t = sandkit.api.elements.getTypeAtCell(x, y);
    return t == null || t === 0;
  },
  isTypeAt(x, y, includeType) {
    const t = this.getTypeAt(x, y);
    if (t == null || t === 0) return false;
    if (typeof includeType === "number") includeType = [
      includeType
    ];
    if (includeType.includes(t)) return true;
    return false;
  },
  isNotTypeAt(x, y, excludeTypes) {
    if (Grid.isEmptyAt(x, y)) return true;
    const t = Grid.getTypeAt(x, y);
    if (t == null || t === 0) return true;
    if (typeof excludeTypes === "number") excludeTypes = [
      excludeTypes
    ];
    if (excludeTypes.includes(t)) return false;
    return true;
  },
  // DATA
  readFieldAt(x, y, field) {
    try {
      const v = sandkit.api.elements.getDataFieldAtCell(x, y, field);
      return v == null || v < 0 ? 0 : v;
    } catch {
      console.error(`Grid.read failed for cell (${x}, ${y}) and field ${field}`);
      return 0;
    }
  },
  writeFieldAt(x, y, field, value) {
    try {
      sandkit.api.elements.setDataFieldAtCell(x, y, field, value);
    } catch {
    }
  },
  resetFieldAt(x, y, field) {
    Grid.writeFieldAt(x, y, field, 0);
  },
  swapCell(x, y, nx, ny, liquidType) {
    if (liquidType == null || !Grid.isTypeAt(nx, ny, liquidType)) return null;
    try {
      if (sandkit.api.elements.swapCells?.(x, y, nx, ny) === true) {
        return {
          x: nx,
          y: ny
        };
      }
    } catch {
    }
    try {
      if (sandkit.api.elements.moveBetweenCells?.(x, y, nx, ny) === true) {
        return {
          x: nx,
          y: ny
        };
      }
    } catch {
    }
    return null;
  }
};

// src/worker/utils/gridnear.ts
var MoveDirection = /* @__PURE__ */ function(MoveDirection2) {
  MoveDirection2[MoveDirection2["UP"] = 0] = "UP";
  MoveDirection2[MoveDirection2["RIGHT_UP"] = 1] = "RIGHT_UP";
  MoveDirection2[MoveDirection2["RIGHT"] = 2] = "RIGHT";
  MoveDirection2[MoveDirection2["RIGHT_DOWN"] = 3] = "RIGHT_DOWN";
  MoveDirection2[MoveDirection2["DOWN"] = 4] = "DOWN";
  MoveDirection2[MoveDirection2["LEFT_DOWN"] = 5] = "LEFT_DOWN";
  MoveDirection2[MoveDirection2["LEFT"] = 6] = "LEFT";
  MoveDirection2[MoveDirection2["LEFT_UP"] = 7] = "LEFT_UP";
  return MoveDirection2;
}({});
var DELTAS_INDEX = [
  {
    x: 0,
    y: -1
  },
  {
    x: 1,
    y: -1
  },
  {
    x: 1,
    y: 0
  },
  {
    x: 1,
    y: 1
  },
  {
    x: 0,
    y: 1
  },
  {
    x: -1,
    y: 1
  },
  {
    x: -1,
    y: 0
  },
  {
    x: -1,
    y: -1
  }
];
var DIR_NAME_MAP = {
  top: [
    MoveDirection.UP
  ],
  bottom: [
    MoveDirection.DOWN
  ],
  left: [
    MoveDirection.LEFT
  ],
  right: [
    MoveDirection.RIGHT
  ],
  sides: [
    MoveDirection.LEFT,
    MoveDirection.RIGHT
  ],
  cross: [
    MoveDirection.RIGHT_UP,
    MoveDirection.RIGHT_DOWN,
    MoveDirection.LEFT_UP,
    MoveDirection.LEFT_DOWN
  ]
};
var GridNear = {
  // Touching
  isNearEmpty(x, y, deltas = DELTAS_INDEX) {
    for (const d of deltas) {
      if (Grid.isEmptyAt(x + d.x, y + d.y)) return true;
    }
    return false;
  },
  isNear(x, y, includeType, deltas = DELTAS_INDEX) {
    for (const d of deltas) {
      if (Grid.isTypeAt(x + d.x, y + d.y, includeType)) return true;
    }
    return false;
  },
  isNotNear(x, y, excludeType, deltas = DELTAS_INDEX) {
    for (const d of deltas) {
      if (Grid.isNotTypeAt(x + d.x, y + d.y, excludeType)) return true;
    }
    return false;
  },
  firstNotNear(x, y, excludeType, deltas = DELTAS_INDEX) {
    for (const d of deltas) {
      if (Grid.isNotTypeAt(x + d.x, y + d.y, excludeType)) {
        return Grid.getTypeAt(x + d.x, y + d.y);
      }
    }
    return null;
  },
  countNearEmpty(x, y, deltas = DELTAS_INDEX) {
    let n = 0;
    for (const d of deltas) {
      if (Grid.isEmptyAt(x + d.x, y + d.y)) n++;
    }
    return n;
  },
  countNear(x, y, includeType, deltas = DELTAS_INDEX) {
    let n = 0;
    for (const d of deltas) {
      if (Grid.isTypeAt(x + d.x, y + d.y, includeType)) n++;
    }
    return n;
  },
  countNotNear(x, y, excludeType, deltas = DELTAS_INDEX) {
    let n = 0;
    for (const d of deltas) {
      if (Grid.isNotTypeAt(x + d.x, y + d.y, excludeType)) n++;
    }
    return n;
  }
};

// src/worker/pipeline.ts
function runProfile(x, y, profile) {
  if (!WaterCfg.modEnabled()) {
    return false;
  }
  if (!Grid.isTypeAt(x, y, profile.seedType)) {
    return false;
  }
  if (!GridNear.isNear(x, y, profile.liquidType)) {
    Grid.resetFieldAt(x, y, ASTRO_FIELD.AGE);
    return false;
  }
  let ctx = {
    x,
    y,
    profile,
    dx: 0,
    dy: 0,
    age: Grid.readFieldAt(x, y, ASTRO_FIELD.AGE),
    blocked: false,
    tryInstant: false,
    stuck: false
  };
  let delta = 0;
  let tag = "-";
  for (const fn of profile.grow) {
    const result = fn(ctx);
    if (ctx.blocked) {
      tag = result.tag || "blocked";
      break;
    }
    if (result.matched) {
      delta = result.delta || 0;
      tag = result.tag || "-";
      break;
    }
  }
  if (delta > 0) {
    ctx.age += delta;
    Grid.writeFieldAt(ctx.x, ctx.y, ASTRO_FIELD.AGE, ctx.age);
  }
  const need = profile.growAge();
  if (need > 0 && ctx.age >= need) {
    let ok = false;
    for (const fn of profile.crystallization) {
      if (fn(ctx)) {
        ok = true;
        break;
      }
    }
    if (!ok) {
      Grid.resetFieldAt(ctx.x, ctx.y, ASTRO_FIELD.AGE);
    }
  }
  for (const fn of profile.moves) {
    ctx = fn(ctx);
  }
  if (ctx.dx != 0 || ctx.dy != 0) {
    const r = Grid.swapCell(ctx.x, ctx.y, ctx.x + Math.min(1, Math.max(-1, ctx.dx)), ctx.y + Math.min(1, Math.max(-1, ctx.dy)), ctx.profile.liquidType);
    ctx = r ? {
      ...ctx,
      x: r.x,
      y: r.y,
      dx: 0,
      dy: 0
    } : ctx;
  }
  return true;
}

// src/shared/elementConfig.ts
function safe(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
var MatterType = safe(() => sandkit.enums?.MatterType) || {};
var MT_POWDER = MatterType.Powder ?? 8;
var MT_STATIC = MatterType.Static ?? 5;
var LIQUID_COPPER_DENSITY = 150;
var SEED_DENSITY = Math.max(1, LIQUID_COPPER_DENSITY - 5);
var elementConfig = {
  astroVoidSeed: {
    id: `${MOD_ID}:astro-void-seed`,
    name: "Astro Void Seed",
    description: "Mix with Florinol \u2192 Astro Seed.",
    colors: [
      [
        80,
        40,
        140
      ],
      [
        60,
        20,
        110
      ],
      [
        100,
        50,
        160
      ]
    ],
    density: 90,
    metaColor: 5253260,
    matterType: MT_POWDER
  },
  astroSeed: {
    id: `${MOD_ID}:astro-seed`,
    name: "Astro Seed",
    description: "Liquid Gold / Copper / Water \u2192 crystals.",
    colors: [
      [
        180,
        220,
        255
      ],
      [
        140,
        190,
        255
      ],
      [
        100,
        160,
        240
      ],
      [
        220,
        240,
        255
      ]
    ],
    density: SEED_DENSITY,
    metaColor: 9357567,
    matterType: MT_POWDER
  },
  astroGoldCrystal: {
    id: `${MOD_ID}:astro-gold-crystal`,
    name: "Astro Gold Crystal",
    description: "From Liquid Gold. Burn \u2192 Astro Gold.",
    colors: [
      [
        210,
        160,
        255
      ],
      [
        180,
        120,
        240
      ],
      [
        230,
        190,
        255
      ],
      [
        160,
        90,
        220
      ]
    ],
    density: 200,
    metaColor: 11827440,
    matterType: MT_STATIC
  },
  astroGoldPowder: {
    id: `${MOD_ID}:astro-gold`,
    name: "Astro Gold Powder",
    description: "Powder from gold crystal + Fire.",
    colors: [
      [
        180,
        255,
        90
      ],
      [
        150,
        230,
        60
      ]
    ],
    density: SEED_DENSITY,
    metaColor: 11819760,
    matterType: MT_POWDER
  },
  astroCopperCrystal: {
    id: `${MOD_ID}:astro-copper-crystal`,
    name: "Astro Copper Crystal",
    description: "From Liquid Copper. Burn \u2192 Astro Copper.",
    colors: [
      [
        200,
        120,
        80
      ],
      [
        180,
        90,
        50
      ],
      [
        220,
        140,
        90
      ],
      [
        160,
        70,
        40
      ]
    ],
    density: 0,
    metaColor: 13138e3,
    matterType: MT_STATIC
  },
  astroCopperPowder: {
    id: `${MOD_ID}:astro-copper`,
    name: "Astro Copper",
    description: "Powder from copper crystal + Fire.",
    colors: [
      [
        240,
        80,
        40
      ],
      [
        180,
        60,
        20
      ]
    ],
    density: SEED_DENSITY,
    metaColor: 11822120,
    matterType: MT_POWDER
  },
  astroWaterCrystal: {
    id: `${MOD_ID}:astro-water-crystal`,
    name: "Astro Water Crystal",
    description: "From Water (panel). Burn \u2192 Astro Water.",
    colors: [
      [
        60,
        100,
        155
      ],
      [
        40,
        90,
        155
      ],
      [
        0,
        60,
        155
      ]
    ],
    density: 0,
    metaColor: 9357567,
    matterType: MT_STATIC
  },
  astroWaterPowder: {
    id: `${MOD_ID}:astro-water`,
    name: "Astro Water",
    description: "Powder from water crystal + Fire.",
    colors: [
      [
        180,
        120,
        155
      ],
      [
        180,
        90,
        155
      ],
      [
        220,
        140,
        155
      ]
    ],
    density: 280,
    metaColor: 9357567,
    matterType: MT_POWDER
  }
};

// src/worker/elementResolve.ts
function resolveType(ids) {
  for (const id of ids) {
    try {
      const t = sandkit.api.elements.getTypeFromId(id);
      if (t != null) return t;
    } catch {
    }
  }
  console.error("elementTypes.ts , resolveType Unknow: ", ids);
  return 0;
}
var ElementTypeInWorker = {
  liquidGold: resolveType([
    "liquidGold",
    "liquidgold",
    "LiquidGold",
    "goldLiquid",
    "liquid_gold"
  ]),
  liquidCopper: resolveType([
    "liquidCopper",
    "liquidcopper",
    "LiquidCopper",
    "copperLiquid",
    "liquid_copper"
  ]),
  florinol: resolveType([
    "florinol",
    "Florinol",
    "florin",
    "Florin"
  ]),
  voidPetal: resolveType([
    "voidPetal",
    "voidpetal",
    "VoidPetal",
    "void_petal",
    "petalium"
  ]),
  seedBase: resolveType([
    "seed",
    "Seed"
  ]),
  fire: resolveType([
    "fire",
    "Fire"
  ]),
  water: resolveType([
    "water",
    "Water"
  ]),
  // mod types
  astroVoidSeed: resolveType([
    elementConfig.astroVoidSeed.id
  ]),
  astroSeed: resolveType([
    elementConfig.astroSeed.id
  ]),
  astroGoldCrystal: resolveType([
    elementConfig.astroGoldCrystal.id
  ]),
  astroGoldPowder: resolveType([
    elementConfig.astroGoldPowder.id
  ]),
  astroCopperCrystal: resolveType([
    elementConfig.astroCopperCrystal.id
  ]),
  astroCopperPowder: resolveType([
    elementConfig.astroCopperPowder.id
  ]),
  astroWaterCrystal: resolveType([
    elementConfig.astroWaterCrystal.id
  ]),
  astroWaterPowder: resolveType([
    elementConfig.astroWaterPowder.id
  ])
};
console.log("ElementTypeInWorker", ElementTypeInWorker);

// src/worker/action/crystallize.ts
function resolveNum(v) {
  return typeof v === "function" ? v() : v;
}
function disk(cx, cy, liquid, r) {
  const cells = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r + 0.5) continue;
      if (Grid.isTypeAt(cx + dx, cy + dy, liquid)) {
        cells.push({
          x: cx + dx,
          y: cy + dy
        });
      }
    }
  }
  return cells;
}
function cross(cx, cy, liquid, r) {
  const cells = [];
  for (let i = 1; i <= r; i++) {
    for (const [x, y] of [
      [
        cx + i,
        cy
      ],
      [
        cx - i,
        cy
      ],
      [
        cx,
        cy + i
      ],
      [
        cx,
        cy - i
      ]
    ]) {
      if (Grid.isTypeAt(x, y, liquid)) cells.push({
        x,
        y
      });
    }
  }
  return cells;
}
function ring(cx, cy, liquid, r) {
  const cells = [];
  const r2 = r * r;
  const i2 = Math.max(0, r - 1) ** 2;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const d = dx * dx + dy * dy;
      if (d > r2 + 0.5 || d < i2 - 0.5) continue;
      if (Grid.isTypeAt(cx + dx, cy + dy, liquid)) {
        cells.push({
          x: cx + dx,
          y: cy + dy
        });
      }
    }
  }
  return cells;
}
function column(cx, cy, liquid, r) {
  const cells = [];
  for (let dy = -r; dy <= r; dy++) {
    if (dy === 0) continue;
    if (Grid.isTypeAt(cx, cy + dy, liquid)) cells.push({
      x: cx,
      y: cy + dy
    });
  }
  return cells;
}
function commit(cx, cy, profile, cells, label) {
  if (!Grid.isTypeAt(cx, cy, profile.seedType)) {
    return false;
  }
  if (cells.length < 1) {
    log("grow ABORT", label, "no liquid \u2014 seed RESET", cx, cy);
    return false;
  }
  let n = 0;
  for (const c of cells) {
    sandkit.api.elements.replaceAtCell(c.x, c.y, profile.crystalType);
    n++;
  }
  sandkit.api.elements.replaceAtCell(cx, cy, profile.crystalType);
  n++;
  Grid.resetFieldAt(cx, cy, ASTRO_FIELD.AGE);
  log("GREW", profile.id, label, "at", cx, cy, "cells=", n);
  return true;
}
var Crystallization = {
  disk(radiusFn) {
    return (ctx) => {
      const r = resolveNum(radiusFn);
      const cells = disk(ctx.x, ctx.y, ctx.profile.liquidType, r);
      return commit(ctx.x, ctx.y, ctx.profile, cells, "disk");
    };
  },
  cross(radiusFn) {
    return (ctx) => {
      const r = resolveNum(radiusFn);
      return commit(ctx.x, ctx.y, ctx.profile, cross(ctx.x, ctx.y, ctx.profile.liquidType, r), "cross");
    };
  },
  ring(radiusFn) {
    return (ctx) => {
      const r = resolveNum(radiusFn);
      return commit(ctx.x, ctx.y, ctx.profile, ring(ctx.x, ctx.y, ctx.profile.liquidType, r), "ring");
    };
  },
  column(radiusFn) {
    return (ctx) => {
      const r = resolveNum(radiusFn);
      return commit(ctx.x, ctx.y, ctx.profile, column(ctx.x, ctx.y, ctx.profile.liquidType, r), "column");
    };
  },
  single() {
    return (ctx) => {
      if (!GridNear.isNear(ctx.x, ctx.y, ctx.profile.liquidType)) {
        return false;
      }
      if (ctx.profile.seedType == null || !Grid.isTypeAt(ctx.x, ctx.y, ctx.profile.seedType)) {
        return false;
      }
      if (ctx.profile.crystalType == null) return false;
      sandkit.api.elements.replaceAtCell(ctx.x, ctx.y, ctx.profile.crystalType);
      Grid.resetFieldAt(ctx.x, ctx.y, ASTRO_FIELD.AGE);
      log("GREW", ctx.profile.id, "single at", ctx.x, ctx.y);
      return true;
    };
  },
  fromShapeIndex(shapeFn, radiusFn) {
    return (ctx) => {
      const shape = resolveNum(shapeFn);
      const r = resolveNum(radiusFn);
      if (shape === 1) return Crystallization.cross(() => r)(ctx);
      if (shape === 2) return Crystallization.ring(() => r)(ctx);
      if (shape === 3) return Crystallization.column(() => r)(ctx);
      if (shape === 4) return Crystallization.single()(ctx);
      return Crystallization.disk(() => r)(ctx);
    };
  }
};

// src/worker/action/grow.ts
var GrowMatch = {
  noMatch() {
    return {
      matched: false,
      delta: 0,
      tag: null
    };
  },
  rate(rate, tag) {
    if (rate <= 0) return GrowMatch.noMatch();
    return {
      matched: true,
      delta: Math.random() * 100 < rate ? 1 : 0,
      tag,
      rate
    };
  }
};
function resolveNum2(v, d = 0) {
  return typeof v === "function" ? v() : v;
}
var Grow = {
  ageAlways() {
    return () => ({
      matched: true,
      delta: 1,
      tag: "always"
    });
  },
  ageOnAir(rateFn) {
    return (ctx) => {
      const hit = GridNear.isNearEmpty(ctx.x, ctx.y);
      if (!hit) return GrowMatch.noMatch();
      return GrowMatch.rate(resolveNum2(rateFn), "air");
    };
  },
  ageOnFloor(rateFn) {
    return (ctx) => {
      if (!Grid.isNotTypeAt(ctx.x, ctx.y + 1, [
        ctx.profile.seedType,
        ctx.profile.liquidType
      ])) {
        return GrowMatch.noMatch();
      }
      return GrowMatch.rate(resolveNum2(rateFn), "floor");
    };
  },
  ageOnWall(rateFn) {
    return (ctx) => {
      const sideOffsets = [
        {
          x: 1,
          y: 0
        },
        {
          x: -1,
          y: 0
        }
      ];
      const hit = GridNear.isNotNear(ctx.x, ctx.y, [
        ctx.profile.seedType,
        ctx.profile.liquidType
      ], sideOffsets);
      if (!hit) return GrowMatch.noMatch();
      return GrowMatch.rate(resolveNum2(rateFn), "wall");
    };
  },
  ageOnCrystal(rateFn) {
    return (ctx) => {
      const c = ctx.profile.crystalType;
      if (c == null || !GridNear.isNear(ctx.x, ctx.y, c)) {
        return GrowMatch.noMatch();
      }
      return GrowMatch.rate(resolveNum2(rateFn), "crystal");
    };
  },
  ageOnSurround(rateFn, minCountFn) {
    return (ctx) => {
      const minCount = resolveNum2(minCountFn, 6);
      const n = GridNear.countNear(ctx.x, ctx.y, ctx.profile.liquidType);
      if (n < minCount) return GrowMatch.noMatch();
      return GrowMatch.rate(resolveNum2(rateFn), "surround");
    };
  },
  blockOnWater() {
    return (ctx) => {
      if (ctx.profile.liquidType === ElementTypeInWorker.water) {
        return GrowMatch.noMatch();
      }
      if (ElementTypeInWorker.water != null && GridNear.isNear(ctx.x, ctx.y, ElementTypeInWorker.water)) {
        ctx.blocked = true;
        return {
          matched: true,
          delta: 0,
          tag: "water-block"
        };
      }
      return GrowMatch.noMatch();
    };
  },
  instantChance(rateFn) {
    return (ctx) => {
      const rate = resolveNum2(rateFn);
      if (ctx.age === 0 && rate > 0 && Math.random() * 100 < rate) {
        ctx.tryInstant = true;
      }
      return GrowMatch.noMatch();
    };
  }
};

// src/worker/action/move.ts
function resolveNum3(v, d = 0) {
  if (d === void 0) d = 0;
  if (v === void 0) return d;
  return typeof v === "function" ? v() : v;
}
var Move = {
  side(chanceFn) {
    return (ctx) => {
      const chance = resolveNum3(chanceFn);
      if (chance <= 0 || Math.random() * 100 >= chance) return ctx;
      const dir = Math.random() < 0.5 ? -1 : 1;
      return {
        ...ctx,
        dx: ctx.dx + dir
      };
    };
  },
  up(chanceFn) {
    return (ctx) => {
      const chance = resolveNum3(chanceFn);
      if (chance <= 0 || Math.random() * 100 >= chance) return ctx;
      return {
        ...ctx,
        dy: ctx.dy - 1
      };
    };
  },
  down(chanceFn) {
    return (ctx) => {
      const chance = resolveNum3(chanceFn);
      if (chance <= 0 || Math.random() * 100 >= chance) return ctx;
      return {
        ...ctx,
        dy: ctx.dy + 1
      };
    };
  },
  /**
   * Elements Attraction Force:
   * Param:
   *   - rate: 0 off; >0 attract; <0 push. Seed always excluded from match.
   *   - deltas: List of deltat to check , whil hit the first one
   *   - freeTypes:  List of type the particul can go thouw , must be fill.
   *   - matchTypes: List of type the particul that count as hit. empty = [] = match any not in exclude.
   *   - excludeTypes: in case of hit all , you can exclude some element .
   *
   * Loop in deltas to find the first match to it.
   *    t = typeAt(postion + delta)
   *
   *    if t in freeTypes : continue
   *
   *    if matchTypes.lengh > 0 :
   *      if t in matchTypes : return  Force(d, rate)
   *
   *    if matchTypes.lengh == 0 :
   *      if t in excludeTypes : return NoForce()
   *      else : return Force(d, rate)
   */
  forceDelta(opts = {
    rate: 0,
    deltas: [],
    freeTypes: [],
    matchTypes: [],
    excludeTypes: [],
    cumul: false
  }) {
    return (ctx) => {
      opts.rate = resolveNum3(opts.rate);
      if (!opts.rate) return ctx;
      const chance = Math.min(100, Math.abs(opts.rate));
      if (Math.random() * 100 >= chance) return ctx;
      const f = opts.rate > 0 ? 1 : opts.rate < 0 ? -1 : 0;
      let countMatch = 0;
      for (const d of opts.deltas) {
        const dx = ctx.dx + Math.min(1, Math.max(-1, d.x)) * f;
        const dy = ctx.dx + Math.min(1, Math.max(-1, d.y)) * f;
        if (Grid.isTypeAt(ctx.x + d.x, ctx.y + d.y, opts.freeTypes)) {
          continue;
        }
        if (opts.matchTypes.length > 0 && Grid.isTypeAt(ctx.x + d.x, ctx.y + d.y, opts.matchTypes)) {
          countMatch += 1;
          ctx = {
            ...ctx,
            dx,
            dy
          };
        }
        if (opts.matchTypes.length == 0 && !Grid.isTypeAt(ctx.x + d.x, ctx.y + d.y, opts.excludeTypes)) {
          countMatch += 1;
          ctx = {
            ...ctx,
            dx,
            dy
          };
        }
        if (!opts.cumul && countMatch > 0) {
          break;
        }
      }
      return ctx;
    };
  },
  /**
   * Column attract / push-back along liquid.
   * rate 0 off; >0 attract; <0 push. Seed always excluded from match.
   */
  columnForce(opts = {}) {
    const { rateFn = 0, matchTypes = [], directions = [
      "bottom"
    ], rangeNFn = 10, maxKFn = 3, freeTypes = [], excludeTypes = [] } = opts;
    return (ctx) => {
      const rate = resolveNum3(rateFn);
      const rangeN = resolveNum3(rangeNFn);
      const maxK = resolveNum3(maxKFn);
      if (!rate) return ctx;
      if (rangeN <= 0 || maxK <= 0) return ctx;
      const freeList = [
        ctx.profile.liquidType,
        ...freeTypes.filter((v) => v !== null)
      ];
      const matchList = [
        ...matchTypes.filter((v) => v !== null)
      ];
      const excludeList = [
        ctx.profile.seedType,
        ...excludeTypes.filter((v) => v !== null)
      ];
      if (directions.length === 0) return ctx;
      const dirs = [
        ...new Set(directions.map((d) => DIR_NAME_MAP[d]).flat())
      ];
      for (const dir of dirs) {
        const d = DELTAS_INDEX[dir];
        const deltas = Array.from({
          length: rangeN
        }, (_, n) => ({
          x: d.x * -(n + 1),
          y: d.y * -(n + 1)
        }));
        ctx = Move.forceDelta({
          rate,
          deltas,
          freeTypes: freeList,
          matchTypes: matchList,
          excludeTypes: excludeList,
          cumul: false
        })(ctx);
      }
      return ctx;
    };
  }
};

// src/worker/definition/profiles.ts
function profileGold() {
  return {
    id: "astroSeed-in-gold",
    seedType: ElementTypeInWorker.astroSeed,
    liquidType: ElementTypeInWorker.liquidGold,
    crystalType: ElementTypeInWorker.astroGoldCrystal,
    growAge: () => 40,
    moves: [
      Move.side(15),
      Move.down(20)
    ],
    grow: [
      Grow.ageAlways()
    ],
    crystallization: [
      Crystallization.disk(1)
    ]
  };
}
function profileCopper() {
  return {
    id: "astroSeed-in-copper",
    seedType: ElementTypeInWorker.astroSeed,
    liquidType: ElementTypeInWorker.liquidCopper,
    crystalType: ElementTypeInWorker.astroCopperCrystal,
    growAge: () => 10,
    moves: [
      Move.up(0),
      Move.side(15),
      Move.down(35)
    ],
    grow: [
      Grow.blockOnWater(),
      Grow.instantChance(0),
      Grow.ageOnFloor(60),
      Grow.ageOnWall(70),
      Grow.ageOnAir(30),
      Grow.ageOnCrystal(100)
    ],
    crystallization: [
      Crystallization.cross(1)
    ]
  };
}
function profileGoldPowder() {
  return {
    id: "astroGold-in-water",
    seedType: ElementTypeInWorker.astroGoldPowder,
    liquidType: ElementTypeInWorker.water,
    crystalType: ElementTypeInWorker.astroGoldCrystal,
    growAge: () => 10,
    moves: [
      Move.up(8),
      Move.side(8),
      Move.down(8),
      Move.columnForce({
        rateFn: -80,
        matchTypes: [],
        directions: [
          "top",
          "bottom",
          "sides"
        ],
        rangeNFn: 8,
        maxKFn: 1,
        freeTypes: [],
        excludeTypes: []
      }),
      Move.columnForce({
        rateFn: -10,
        matchTypes: [
          ElementTypeInWorker.astroGoldPowder
        ],
        directions: [
          "top",
          "bottom",
          "sides",
          "cross"
        ],
        rangeNFn: 2,
        maxKFn: 1,
        freeTypes: [],
        excludeTypes: []
      }),
      Move.columnForce({
        rateFn: 90,
        matchTypes: [
          ElementTypeInWorker.astroCopperPowder
        ],
        directions: [
          "top",
          "bottom",
          "sides",
          "cross"
        ],
        rangeNFn: 6,
        maxKFn: 1,
        freeTypes: [],
        excludeTypes: []
      })
    ],
    grow: [],
    crystallization: []
  };
}
function profileCopperPowder() {
  return {
    id: "astroCopper-in-water",
    seedType: ElementTypeInWorker.astroCopperPowder,
    liquidType: ElementTypeInWorker.water,
    crystalType: ElementTypeInWorker.astroCopperCrystal,
    growAge: () => 10,
    moves: [
      Move.up(5),
      Move.side(5),
      Move.down(5),
      Move.columnForce({
        rateFn: -80,
        matchTypes: [],
        directions: [
          "top",
          "bottom",
          "sides"
        ],
        rangeNFn: 8,
        maxKFn: 1,
        freeTypes: [],
        excludeTypes: []
      }),
      Move.columnForce({
        rateFn: 30,
        matchTypes: [
          ElementTypeInWorker.astroGoldPowder
        ],
        directions: [
          "top",
          "bottom",
          "sides",
          "cross"
        ],
        rangeNFn: 2,
        maxKFn: 1,
        freeTypes: [],
        excludeTypes: []
      }),
      Move.columnForce({
        rateFn: -20,
        matchTypes: [
          ElementTypeInWorker.astroCopperPowder
        ],
        directions: [
          "top",
          "bottom",
          "sides",
          "cross"
        ],
        rangeNFn: 4,
        maxKFn: 1,
        freeTypes: [],
        excludeTypes: []
      })
    ],
    grow: [],
    crystallization: []
  };
}
function profileWater() {
  return {
    id: "water",
    seedType: ElementTypeInWorker.astroSeed,
    liquidType: ElementTypeInWorker.water,
    crystalType: ElementTypeInWorker.astroWaterCrystal,
    growAge: () => WaterCfg.crystalGrowAge(),
    moves: [
      ...WaterCfg.stepForceMove() ? forceEntries().map((e) => {
        console.log("forceEntries", e);
        return Move.columnForce({
          rateFn: e.rateFn,
          matchTypes: e.matchTypes,
          directions: e.directions,
          rangeNFn: e.rangeNFn,
          maxKFn: e.maxKFn,
          freeTypes: e.freeTypes,
          excludeTypes: e.excludeTypes
        });
      }) : [],
      ...WaterCfg.stepMove() ? [
        Move.up(WaterCfg.moveFloat),
        Move.side(WaterCfg.moveSide),
        Move.down(WaterCfg.moveSink)
      ] : []
    ],
    grow: WaterCfg.stepGrow() ? [
      Grow.instantChance(WaterCfg.growInstantTouch),
      Grow.ageOnFloor(WaterCfg.growOnFloor),
      Grow.ageOnWall(WaterCfg.growOnWall),
      Grow.ageOnAir(WaterCfg.growOnAir),
      Grow.ageOnCrystal(WaterCfg.growOnCrystal),
      Grow.ageOnSurround(WaterCfg.growIfSurround, WaterCfg.growSurroundMin)
    ] : [],
    crystallization: WaterCfg.stepCrystalisation() ? [
      Crystallization.fromShapeIndex(WaterCfg.crystalShape, WaterCfg.crystalRadius)
    ] : []
  };
}
var PROFILES = {
  gold: profileGold,
  copper: profileCopper,
  water: profileWater,
  gInWater: profileGoldPowder,
  cInWater: profileCopperPowder
};
var profiles = Object.values(PROFILES);

// src/worker/main.ts
function dispatchSeed(x, y, elementType, c) {
  if (!WaterCfg.modEnabled()) return false;
  for (const getProfile of Object.values(profiles)) {
    const profile = getProfile();
    if (profile.seedType == null || elementType != profile.seedType) {
      continue;
    }
    if (profile.liquidType == null || !GridNear.isNear(x, y, profile.liquidType)) {
      continue;
    }
    sandkit.api.elements.setPhysicsAtCell(x, y, 1);
    c.cancel();
    runProfile(x, y, profile);
    sandkit.api.grid.reportActivityAtCell(x, y);
    sandkit.api.grid.reportActivityAtCell(x, y - 1);
    return true;
  }
  sandkit.api.elements.setPhysicsAtCell(x, y, 0);
  return false;
}
try {
  sandkit.api.hooks.intercept("element:update", (payload, cancel) => {
    try {
      const p = payload;
      const isDispatch = dispatchSeed(p.x, p.y, p.elementType || 0, cancel);
      return isDispatch;
    } catch (e) {
      console.error('hooks.intercept("element:updated")', e);
    }
  }, {
    guard: {
      elementType: ElementTypeInWorker.astroSeed
    }
  });
  sandkit.api.hooks.intercept("element:update", (payload, cancel) => {
    try {
      const p = payload;
      const isDispatch = dispatchSeed(p.x, p.y, p.elementType || 0, cancel);
      return isDispatch;
    } catch (e) {
      console.error('hooks.intercept("element:updated")', e);
    }
  }, {
    guard: {
      elementType: ElementTypeInWorker.astroGoldPowder
    }
  });
  sandkit.api.hooks.intercept("element:update", (payload, cancel) => {
    try {
      const p = payload;
      const isDispatch = dispatchSeed(p.x, p.y, p.elementType || 0, cancel);
      return isDispatch;
    } catch (e) {
      console.error('hooks.intercept("element:updated")', e);
    }
  }, {
    guard: {
      elementType: ElementTypeInWorker.astroCopperPowder
    }
  });
} catch (e) {
  console.error(`[${MOD_ID} v${VERSION}] moved failed:`, e);
}
