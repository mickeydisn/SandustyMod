// src/shared/ids.ts
var MOD_ID = "astro.seeds";
var VERSION = "3.1.0";
var ASTRO_FIELD = /* @__PURE__ */ function(ASTRO_FIELD2) {
  ASTRO_FIELD2[ASTRO_FIELD2["AGE"] = 1] = "AGE";
  ASTRO_FIELD2[ASTRO_FIELD2["VX"] = 2] = "VX";
  ASTRO_FIELD2[ASTRO_FIELD2["VY"] = 3] = "VY";
  return ASTRO_FIELD2;
}({});

// ../../packages/element-profiles/src/grid.ts
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
    const include = typeof includeType === "number" ? [
      includeType
    ] : includeType;
    return include.includes(t);
  },
  isNotTypeAt(x, y, excludeTypes) {
    if (Grid.isEmptyAt(x, y)) return true;
    const t = Grid.getTypeAt(x, y);
    if (t == null || t === 0) return true;
    const exclude = typeof excludeTypes === "number" ? [
      excludeTypes
    ] : excludeTypes;
    return !exclude.includes(t);
  },
  // DATA
  readFieldAt(x, y, field) {
    try {
      const v = sandkit.api.elements.getDataFieldAtCell(x, y, field);
      return v == null || v < 0 ? 0 : v;
    } catch {
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
  // MOVE
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

// ../../packages/shared-types/src/grid.ts
var Direction = /* @__PURE__ */ function(Direction2) {
  Direction2[Direction2["UP"] = 0] = "UP";
  Direction2[Direction2["RIGHT_UP"] = 1] = "RIGHT_UP";
  Direction2[Direction2["RIGHT"] = 2] = "RIGHT";
  Direction2[Direction2["RIGHT_DOWN"] = 3] = "RIGHT_DOWN";
  Direction2[Direction2["DOWN"] = 4] = "DOWN";
  Direction2[Direction2["LEFT_DOWN"] = 5] = "LEFT_DOWN";
  Direction2[Direction2["LEFT"] = 6] = "LEFT";
  Direction2[Direction2["LEFT_UP"] = 7] = "LEFT_UP";
  return Direction2;
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
    Direction.UP
  ],
  bottom: [
    Direction.DOWN
  ],
  left: [
    Direction.LEFT
  ],
  right: [
    Direction.RIGHT
  ],
  sides: [
    Direction.LEFT,
    Direction.RIGHT
  ],
  cross: [
    Direction.RIGHT_UP,
    Direction.RIGHT_DOWN,
    Direction.LEFT_UP,
    Direction.LEFT_DOWN
  ]
};

// ../../packages/element-profiles/src/near.ts
var GridNear = {
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

// ../../packages/element-profiles/src/resolve.ts
function resolveNum(v, fallback = 0) {
  if (typeof v === "function") return v();
  if (v === void 0 || v === null) return fallback;
  return v;
}

// ../../packages/element-profiles/src/actions/move.ts
function random100() {
  return Math.random() * 100;
}
var Move = {
  side(chanceFn) {
    return (ctx) => {
      const chance = resolveNum(chanceFn);
      if (chance <= 0 || random100() >= chance) return ctx;
      const dir = Math.random() < 0.5 ? -1 : 1;
      return {
        ...ctx,
        dx: ctx.dx + dir
      };
    };
  },
  up(chanceFn) {
    return (ctx) => {
      const chance = resolveNum(chanceFn);
      if (chance <= 0 || random100() >= chance) return ctx;
      return {
        ...ctx,
        dy: ctx.dy - 1
      };
    };
  },
  down(chanceFn) {
    return (ctx) => {
      const chance = resolveNum(chanceFn);
      if (chance <= 0 || random100() >= chance) return ctx;
      return {
        ...ctx,
        dy: ctx.dy + 1
      };
    };
  },
  /**
     * Directional attraction on a list of deltas:
     *   - `rate`: 0 off; >0 attract; <0 push. The seed type is never a target.
     *   - `freeTypes`: cells the seed can pass through without counting as a hit.
     *   - `matchTypes`: hit set. Empty = "any type not in excludeTypes".
     * Walks `deltas` in order and applies the first hit (unless `cumul`).
     */
  forceDelta(opts) {
    return (ctx) => {
      const rate2 = resolveNum(opts.rate);
      if (!rate2) return ctx;
      if (random100() >= Math.min(100, Math.abs(rate2))) return ctx;
      const f = rate2 > 0 ? 1 : -1;
      let countMatch = 0;
      for (const d of opts.deltas) {
        const dx = ctx.dx + Math.min(1, Math.max(-1, d.x)) * f;
        const dy = ctx.dy + Math.min(1, Math.max(-1, d.y)) * f;
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
        } else if (opts.matchTypes.length === 0 && !Grid.isTypeAt(ctx.x + d.x, ctx.y + d.y, opts.excludeTypes)) {
          countMatch += 1;
          ctx = {
            ...ctx,
            dx,
            dy
          };
        }
        if (!opts.cumul && countMatch > 0) break;
      }
      return ctx;
    };
  },
  /**
     * Column attract / push-back along a liquid. Casts a ray of `rangeN` cells
     * per compass direction and lets the first non-free occupant steer the seed.
     */
  columnForce(opts = {}) {
    const { rateFn = 0, matchTypes = [], directions = [
      "bottom"
    ], rangeNFn = 10, maxKFn = 3, freeTypes = [], excludeTypes = [] } = opts;
    return (ctx) => {
      const rate2 = resolveNum(rateFn);
      const rangeN = resolveNum(rangeNFn);
      const maxK = resolveNum(maxKFn);
      if (!rate2) return ctx;
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
          rate: rate2,
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

// ../../packages/element-profiles/src/actions/grow.ts
var noMatch = () => ({
  matched: false,
  delta: 0,
  tag: null
});
function rate(rate2, tag) {
  if (rate2 <= 0) return noMatch();
  return {
    matched: true,
    delta: Math.random() * 100 < rate2 ? 1 : 0,
    tag,
    rate: rate2
  };
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
    return (ctx) => GridNear.isNearEmpty(ctx.x, ctx.y) ? rate(resolveNum(rateFn), "air") : noMatch();
  },
  ageOnFloor(rateFn) {
    return (ctx) => {
      const under = !Grid.isNotTypeAt(ctx.x, ctx.y + 1, [
        ctx.profile.seedType,
        ctx.profile.liquidType
      ]);
      return under ? noMatch() : rate(resolveNum(rateFn), "floor");
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
      return GridNear.isNotNear(ctx.x, ctx.y, [
        ctx.profile.seedType,
        ctx.profile.liquidType
      ], sideOffsets) ? rate(resolveNum(rateFn), "wall") : noMatch();
    };
  },
  ageOnCrystal(rateFn) {
    return (ctx) => ctx.profile.crystalType != null && GridNear.isNear(ctx.x, ctx.y, ctx.profile.crystalType) ? rate(resolveNum(rateFn), "crystal") : noMatch();
  },
  ageOnSurround(rateFn, minCountFn) {
    return (ctx) => {
      const minCount = resolveNum(minCountFn, 6);
      const n = GridNear.countNear(ctx.x, ctx.y, ctx.profile.liquidType);
      return n >= minCount ? rate(resolveNum(rateFn), "surround") : noMatch();
    };
  },
  /**
     * Hard-block growth while the seed touches `blockType`, unless that type is
     * the profile's own liquid (its normal medium). Marks the Ctx blocked so the
     * pipeline stops growing this tick.
     */
  blockOn(blockType) {
    return (ctx) => {
      if (ctx.profile.liquidType === blockType) return noMatch();
      if (blockType != null && GridNear.isNear(ctx.x, ctx.y, blockType)) {
        ctx.blocked = true;
        return {
          matched: true,
          delta: 0,
          tag: "blocked"
        };
      }
      return noMatch();
    };
  },
  instantChance(rateFn) {
    return (ctx) => {
      const rate2 = resolveNum(rateFn);
      if (ctx.age === 0 && rate2 > 0 && Math.random() * 100 < rate2) {
        ctx.tryInstant = true;
      }
      return noMatch();
    };
  }
};

// ../../packages/element-profiles/src/actions/crystallize.ts
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
function commit(ctx, cells) {
  const { seedType, crystalType, ageField } = ctx.profile;
  if (seedType == null || !Grid.isTypeAt(ctx.x, ctx.y, seedType)) return false;
  if (cells.length < 1) return false;
  for (const c of cells) {
    sandkit.api.elements.replaceAtCell(c.x, c.y, crystalType);
  }
  sandkit.api.elements.replaceAtCell(ctx.x, ctx.y, crystalType);
  Grid.resetFieldAt(ctx.x, ctx.y, ageField);
  return true;
}
var Crystallization = {
  disk(radiusFn) {
    return (ctx) => commit(ctx, disk(ctx.x, ctx.y, ctx.profile.liquidType, resolveNum(radiusFn)));
  },
  cross(radiusFn) {
    return (ctx) => commit(ctx, cross(ctx.x, ctx.y, ctx.profile.liquidType, resolveNum(radiusFn)));
  },
  ring(radiusFn) {
    return (ctx) => commit(ctx, ring(ctx.x, ctx.y, ctx.profile.liquidType, resolveNum(radiusFn)));
  },
  column(radiusFn) {
    return (ctx) => commit(ctx, column(ctx.x, ctx.y, ctx.profile.liquidType, resolveNum(radiusFn)));
  },
  single() {
    return (ctx) => {
      if (!GridNear.isNear(ctx.x, ctx.y, ctx.profile.liquidType)) return false;
      if (ctx.profile.seedType == null || !Grid.isTypeAt(ctx.x, ctx.y, ctx.profile.seedType)) {
        return false;
      }
      if (ctx.profile.crystalType == null) return false;
      sandkit.api.elements.replaceAtCell(ctx.x, ctx.y, ctx.profile.crystalType);
      Grid.resetFieldAt(ctx.x, ctx.y, ctx.profile.ageField);
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

// ../../packages/element-profiles/src/pipeline.ts
function runProfile(x, y, profile) {
  if (!Grid.isTypeAt(x, y, profile.seedType)) return false;
  if (!GridNear.isNear(x, y, profile.liquidType)) {
    Grid.resetFieldAt(x, y, profile.ageField);
    return false;
  }
  let ctx = {
    x,
    y,
    profile,
    dx: 0,
    dy: 0,
    age: Grid.readFieldAt(x, y, profile.ageField),
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
    Grid.writeFieldAt(ctx.x, ctx.y, profile.ageField, ctx.age);
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
      Grid.resetFieldAt(ctx.x, ctx.y, profile.ageField);
    }
  }
  for (const fn of profile.moves) {
    ctx = fn(ctx);
  }
  if (ctx.dx !== 0 || ctx.dy !== 0) {
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

// src/shared/utils.ts
function safe(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

// src/shared/elements/catalogue.ts
function matterPowder() {
  const MatterType = safe(() => sandkit.enums?.MatterType);
  return MatterType?.Powder ?? 8;
}
function matterStatic() {
  const MatterType = safe(() => sandkit.enums?.MatterType);
  return MatterType?.Static ?? 5;
}
var LIQUID_COPPER_DENSITY = 150;
var SEED_DENSITY = Math.max(1, LIQUID_COPPER_DENSITY - 5);
function spec(entry) {
  return {
    ...entry,
    id: `${MOD_ID}:${entry.slug}`
  };
}
var ASTRO_ELEMENTS = [
  spec({
    key: "astroVoidSeed",
    slug: "astro-void-seed",
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
    matterType: matterPowder(),
    toolboxLabel: "Void Seed",
    isSeed: false,
    isCrystal: false
  }),
  spec({
    key: "astroSeed",
    slug: "astro-seed",
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
    matterType: matterPowder(),
    toolboxLabel: "Seed",
    isSeed: true,
    isCrystal: false
  }),
  spec({
    key: "astroGoldCrystal",
    slug: "astro-gold-crystal",
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
    matterType: matterStatic(),
    toolboxLabel: "Cry. Gold",
    isSeed: false,
    isCrystal: true
  }),
  spec({
    key: "astroGoldPowder",
    slug: "astro-gold",
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
    matterType: matterPowder(),
    toolboxLabel: "Astro Gold",
    isSeed: true,
    isCrystal: false
  }),
  spec({
    key: "astroCopperCrystal",
    slug: "astro-copper-crystal",
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
    matterType: matterStatic(),
    toolboxLabel: "Cry. Copper",
    isSeed: false,
    isCrystal: true
  }),
  spec({
    key: "astroCopperPowder",
    slug: "astro-copper",
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
    matterType: matterPowder(),
    toolboxLabel: "Astro Copper",
    isSeed: true,
    isCrystal: false
  }),
  spec({
    key: "astroWaterCrystal",
    slug: "astro-water-crystal",
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
    matterType: matterStatic(),
    toolboxLabel: "Cry. Water",
    isSeed: false,
    isCrystal: true
  }),
  spec({
    key: "astroWaterPowder",
    slug: "astro-water",
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
    matterType: matterPowder(),
    toolboxLabel: "Astro Water",
    isSeed: true,
    isCrystal: false
  })
];
var ASTRO_ELEMENT_BY_KEY = Object.fromEntries(ASTRO_ELEMENTS.map((e) => [
  e.key,
  e
]));

// src/shared/elements/resolve.ts
function resolveType(ids) {
  for (const id of ids) {
    const t = safe(() => sandkit.api.elements.getTypeFromId(id));
    if (t != null) return t;
  }
  return 0;
}
var VANILLA_ALIASES = {
  liquidGold: [
    "liquidGold",
    "liquidgold",
    "LiquidGold",
    "goldLiquid",
    "liquid_gold"
  ],
  liquidCopper: [
    "liquidCopper",
    "liquidcopper",
    "LiquidCopper",
    "copperLiquid",
    "liquid_copper"
  ],
  florinol: [
    "florinol",
    "Florinol",
    "florin",
    "Florin"
  ],
  voidPetal: [
    "voidPetal",
    "voidpetal",
    "VoidPetal",
    "void_petal",
    "petalium"
  ],
  seedBase: [
    "seed",
    "Seed"
  ],
  fire: [
    "fire",
    "Fire"
  ],
  water: [
    "water",
    "Water"
  ]
};
function resolveVanilla() {
  return Object.fromEntries(Object.entries(VANILLA_ALIASES).map(([key, aliases]) => [
    key,
    resolveType(aliases)
  ]));
}
function resolveAstro() {
  return Object.fromEntries(ASTRO_ELEMENTS.map((e) => [
    e.key,
    resolveType([
      e.id
    ])
  ]));
}
var ElementType = {
  ...resolveVanilla(),
  ...resolveAstro()
};

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
  cfgBuf = sandkit.api.shared.buffers.ensure("astroConfig", {
    type: "uint16",
    length: BUF_LENGTH
  });
} catch (e) {
  console.error(`[${MOD_ID} v${VERSION}] config buffer missing:`, e);
}
var jsonBuf = null;
try {
  jsonBuf = sandkit.api.shared.buffers.ensure("astroJson", {
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
  try {
    const end = buffer.indexOf(0);
    const bytes = buffer.slice(0, end === -1 ? buffer.length : end);
    return new TextDecoder().decode(bytes);
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

// src/worker/definition/elementProfileFactory.ts
function buildMoves(specs) {
  const out = [];
  for (const spec2 of specs) {
    if (spec2.kind === "gated") {
      if (!spec2.when()) continue;
      out.push(...buildMoves(spec2.moves));
      continue;
    }
    if (spec2.when && !spec2.when()) continue;
    if (spec2.kind === "up") out.push(Move.up(spec2.chance));
    else if (spec2.kind === "side") out.push(Move.side(spec2.chance));
    else if (spec2.kind === "down") out.push(Move.down(spec2.chance));
    else if (spec2.kind === "columnForce") {
      const o = spec2.opts;
      out.push(Move.columnForce({
        rateFn: o.rate,
        matchTypes: (o.matchKeys ?? []).map((k) => ElementType[k]),
        directions: [
          ...o.directions
        ],
        rangeNFn: o.rangeN,
        maxKFn: o.maxK,
        freeTypes: (o.freeKeys ?? []).map((k) => ElementType[k]),
        excludeTypes: (o.excludeKeys ?? []).map((k) => ElementType[k])
      }));
    } else {
      for (const e of spec2.entries()) {
        out.push(Move.columnForce({
          rateFn: e.rateFn,
          matchTypes: [
            ...e.matchTypes
          ],
          directions: [
            ...e.directions
          ],
          rangeNFn: e.rangeNFn,
          maxKFn: e.maxKFn,
          freeTypes: [
            ...e.freeTypes
          ],
          excludeTypes: [
            ...e.excludeTypes
          ]
        }));
      }
    }
  }
  return out;
}
function buildGrow(spec2) {
  if (spec2.kind === "ageAlways") return Grow.ageAlways();
  if (spec2.kind === "instantChance") return Grow.instantChance(spec2.rate);
  if (spec2.kind === "ageOnFloor") return Grow.ageOnFloor(spec2.rate);
  if (spec2.kind === "ageOnWall") return Grow.ageOnWall(spec2.rate);
  if (spec2.kind === "ageOnAir") return Grow.ageOnAir(spec2.rate);
  if (spec2.kind === "ageOnCrystal") return Grow.ageOnCrystal(spec2.rate);
  if (spec2.kind === "ageOnSurround") return Grow.ageOnSurround(spec2.rate, spec2.minCount);
  return Grow.blockOn(ElementType[spec2.blockKey]);
}
function buildCrystal(spec2) {
  if (spec2.kind === "disk") return Crystallization.disk(spec2.radius);
  if (spec2.kind === "cross") return Crystallization.cross(spec2.radius);
  if (spec2.kind === "ring") return Crystallization.ring(spec2.radius);
  if (spec2.kind === "column") return Crystallization.column(spec2.radius);
  if (spec2.kind === "single") return Crystallization.single();
  return Crystallization.fromShapeIndex(spec2.shape, spec2.radius);
}
function createElementProfileFactory(spec2) {
  return () => ({
    id: spec2.id,
    seedType: ElementType[spec2.seedKey],
    liquidType: ElementType[spec2.liquidKey],
    crystalType: ElementType[spec2.crystalKey],
    ageField: ASTRO_FIELD.AGE,
    growAge: () => typeof spec2.growAge === "function" ? spec2.growAge() : spec2.growAge,
    moves: spec2.whenMove && !spec2.whenMove() ? [] : buildMoves(spec2.moves),
    grow: spec2.whenGrow && !spec2.whenGrow() ? [] : spec2.grow.map(buildGrow),
    crystallization: spec2.whenCrystal && !spec2.whenCrystal() ? [] : spec2.crystallization.map(buildCrystal)
  });
}
function createProfileFactories(specs) {
  return Object.fromEntries(specs.map((s) => [
    s.id,
    createElementProfileFactory(s)
  ]));
}

// src/worker/definition/profileCatalogue.ts
var PROFILE_SPECS = [
  {
    id: "astroSeed-in-gold",
    seedKey: "astroSeed",
    liquidKey: "liquidGold",
    crystalKey: "astroGoldCrystal",
    growAge: 40,
    moves: [
      {
        kind: "side",
        chance: 15
      },
      {
        kind: "down",
        chance: 20
      }
    ],
    grow: [
      {
        kind: "ageAlways"
      }
    ],
    crystallization: [
      {
        kind: "disk",
        radius: 1
      }
    ]
  },
  {
    id: "astroSeed-in-copper",
    seedKey: "astroSeed",
    liquidKey: "liquidCopper",
    crystalKey: "astroCopperCrystal",
    growAge: 10,
    moves: [
      {
        kind: "up",
        chance: 0
      },
      {
        kind: "side",
        chance: 15
      },
      {
        kind: "down",
        chance: 35
      }
    ],
    grow: [
      {
        kind: "blockOn",
        blockKey: "water"
      },
      {
        kind: "instantChance",
        rate: 0
      },
      {
        kind: "ageOnFloor",
        rate: 60
      },
      {
        kind: "ageOnWall",
        rate: 70
      },
      {
        kind: "ageOnAir",
        rate: 30
      },
      {
        kind: "ageOnCrystal",
        rate: 100
      }
    ],
    crystallization: [
      {
        kind: "cross",
        radius: 1
      }
    ]
  },
  {
    id: "astroGold-in-water",
    seedKey: "astroGoldPowder",
    liquidKey: "water",
    crystalKey: "astroGoldCrystal",
    growAge: 10,
    moves: [
      {
        kind: "up",
        chance: 8
      },
      {
        kind: "side",
        chance: 8
      },
      {
        kind: "down",
        chance: 8
      },
      {
        kind: "columnForce",
        opts: {
          rate: -80,
          rangeN: 8,
          maxK: 1,
          directions: [
            "top",
            "bottom",
            "sides"
          ]
        }
      },
      {
        kind: "columnForce",
        opts: {
          rate: -10,
          rangeN: 2,
          maxK: 1,
          directions: [
            "top",
            "bottom",
            "sides",
            "cross"
          ],
          matchKeys: [
            "astroGoldPowder"
          ]
        }
      },
      {
        kind: "columnForce",
        opts: {
          rate: 90,
          rangeN: 6,
          maxK: 1,
          directions: [
            "top",
            "bottom",
            "sides",
            "cross"
          ],
          matchKeys: [
            "astroCopperPowder"
          ]
        }
      }
    ],
    grow: [],
    crystallization: []
  },
  {
    id: "astroCopper-in-water",
    seedKey: "astroCopperPowder",
    liquidKey: "water",
    crystalKey: "astroCopperCrystal",
    growAge: 10,
    moves: [
      {
        kind: "up",
        chance: 5
      },
      {
        kind: "side",
        chance: 5
      },
      {
        kind: "down",
        chance: 5
      },
      {
        kind: "columnForce",
        opts: {
          rate: -80,
          rangeN: 8,
          maxK: 1,
          directions: [
            "top",
            "bottom",
            "sides"
          ]
        }
      },
      {
        kind: "columnForce",
        opts: {
          rate: 30,
          rangeN: 2,
          maxK: 1,
          directions: [
            "top",
            "bottom",
            "sides",
            "cross"
          ],
          matchKeys: [
            "astroGoldPowder"
          ]
        }
      },
      {
        kind: "columnForce",
        opts: {
          rate: -20,
          rangeN: 4,
          maxK: 1,
          directions: [
            "top",
            "bottom",
            "sides",
            "cross"
          ],
          matchKeys: [
            "astroCopperPowder"
          ]
        }
      }
    ],
    grow: [],
    crystallization: []
  },
  {
    // Live panel-driven profile: guards + thunks read WaterCfg per build.
    id: "water",
    seedKey: "astroSeed",
    liquidKey: "water",
    crystalKey: "astroWaterCrystal",
    growAge: () => WaterCfg.crystalGrowAge(),
    moves: [
      {
        kind: "gated",
        when: () => WaterCfg.stepForceMove(),
        moves: [
          {
            kind: "columnForceFrom",
            entries: () => forceEntries()
          }
        ]
      },
      {
        kind: "gated",
        when: () => WaterCfg.stepMove(),
        moves: [
          {
            kind: "up",
            chance: () => WaterCfg.moveFloat()
          },
          {
            kind: "side",
            chance: () => WaterCfg.moveSide()
          },
          {
            kind: "down",
            chance: () => WaterCfg.moveSink()
          }
        ]
      }
    ],
    grow: [
      {
        kind: "instantChance",
        rate: () => WaterCfg.growInstantTouch()
      },
      {
        kind: "ageOnFloor",
        rate: () => WaterCfg.growOnFloor()
      },
      {
        kind: "ageOnWall",
        rate: () => WaterCfg.growOnWall()
      },
      {
        kind: "ageOnAir",
        rate: () => WaterCfg.growOnAir()
      },
      {
        kind: "ageOnCrystal",
        rate: () => WaterCfg.growOnCrystal()
      },
      {
        kind: "ageOnSurround",
        rate: () => WaterCfg.growIfSurround(),
        minCount: () => WaterCfg.growSurroundMin()
      }
    ],
    crystallization: [
      {
        kind: "fromShape",
        shape: () => WaterCfg.crystalShape(),
        radius: () => WaterCfg.crystalRadius()
      }
    ],
    whenGrow: () => WaterCfg.stepGrow(),
    whenCrystal: () => WaterCfg.stepCrystalisation()
  }
];
var profileFactories = createProfileFactories(PROFILE_SPECS);
var profiles = Object.values(profileFactories);

// src/worker/main.ts
function dispatchSeed(x, y, elementType, cancel) {
  if (!WaterCfg.modEnabled()) return false;
  for (const getProfile of Object.values(profiles)) {
    const profile = getProfile();
    if (profile.seedType == null || elementType !== profile.seedType) {
      continue;
    }
    if (profile.liquidType == null || !GridNear.isNear(x, y, profile.liquidType)) {
      continue;
    }
    sandkit.api.elements.setPhysicsAtCell(x, y, 1);
    cancel.cancel();
    runProfile(x, y, profile);
    sandkit.api.grid.reportActivityAtCell(x, y);
    sandkit.api.grid.reportActivityAtCell(x, y - 1);
    return true;
  }
  sandkit.api.elements.setPhysicsAtCell(x, y, 0);
  return false;
}
try {
  const seedKeys = [
    ...new Set(PROFILE_SPECS.map((s) => s.seedKey))
  ];
  const seedTypes = seedKeys.map((k) => ElementType[k]);
  for (const elementType of seedTypes) {
    if (!elementType) continue;
    sandkit.api.hooks.intercept("element:update", (payload, cancel) => {
      try {
        const p = payload;
        return dispatchSeed(p.x, p.y, p.elementType || 0, cancel);
      } catch (e) {
        console.error('hooks.intercept("element:update")', e);
      }
    }, {
      guard: {
        elementType
      }
    });
  }
} catch (e) {
  console.error(`[${MOD_ID} v${VERSION}] update intercept failed:`, e);
}
