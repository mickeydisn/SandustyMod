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

// ../../packages/shared/src/grid.ts
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

// ../../packages/shared/src/elements.ts
var MatterType = /* @__PURE__ */ function(MatterType2) {
  MatterType2[MatterType2["Solid"] = 1] = "Solid";
  MatterType2[MatterType2["Liquid"] = 2] = "Liquid";
  MatterType2[MatterType2["Particle"] = 3] = "Particle";
  MatterType2[MatterType2["Gas"] = 4] = "Gas";
  MatterType2[MatterType2["Static"] = 5] = "Static";
  MatterType2[MatterType2["Slushy"] = 6] = "Slushy";
  MatterType2[MatterType2["Wisp"] = 7] = "Wisp";
  MatterType2[MatterType2["Powder"] = 8] = "Powder";
  return MatterType2;
}({});

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

// src/config/ids.ts
var MOD_ID = "astro.seeds";
var VERSION = "3.1.0";
var ASTRO_FIELD = /* @__PURE__ */ function(ASTRO_FIELD2) {
  ASTRO_FIELD2[ASTRO_FIELD2["AGE"] = 1] = "AGE";
  ASTRO_FIELD2[ASTRO_FIELD2["VX"] = 2] = "VX";
  ASTRO_FIELD2[ASTRO_FIELD2["VY"] = 3] = "VY";
  return ASTRO_FIELD2;
}({});

// src/config/util.ts
function spec(entry) {
  return {
    ...entry,
    id: `${MOD_ID}:${entry.slug}`
  };
}

// src/config/elementConf/astroCopperCrystal.ts
var astroCopperCrystal = {
  spec: spec({
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
    matterType: MatterType.Static,
    toolboxLabel: "Cry. Copper",
    isSeed: false,
    isCrystal: true
  }),
  reactions: []
};

// src/config/elementConf/astroCopperPowder.ts
var LIQUID_COPPER_DENSITY = 150;
var SEED_DENSITY = Math.max(1, LIQUID_COPPER_DENSITY - 5);
var astroCopperPowder = {
  spec: spec({
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
    matterType: MatterType.Powder,
    toolboxLabel: "Astro Copper",
    isSeed: true,
    isCrystal: false
  }),
  reactions: [
    {
      inputA: "astroCopperCrystal",
      inputB: "fire",
      outputA: "astroCopperPowder",
      outputB: "fire"
    }
  ],
  profiles: [
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
    }
  ]
};

// src/config/elementConf/astroGoldCrystal.ts
var astroGoldCrystal = {
  spec: spec({
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
    matterType: MatterType.Static,
    toolboxLabel: "Cry. Gold",
    isSeed: false,
    isCrystal: true
  }),
  reactions: []
};

// src/config/elementConf/astroGoldPowder.ts
var LIQUID_COPPER_DENSITY2 = 150;
var SEED_DENSITY2 = Math.max(1, LIQUID_COPPER_DENSITY2 - 5);
var astroGoldPowder = {
  spec: spec({
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
    density: SEED_DENSITY2,
    metaColor: 11819760,
    matterType: MatterType.Powder,
    toolboxLabel: "Astro Gold",
    isSeed: true,
    isCrystal: false
  }),
  reactions: [
    {
      inputA: "astroGoldCrystal",
      inputB: "fire",
      outputA: "astroGoldPowder",
      outputB: "fire"
    }
  ],
  profiles: [
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
            rate: -50,
            rangeN: 4,
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
              "sides"
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
            rangeN: 4,
            maxK: 1,
            directions: [
              "top",
              "bottom",
              "sides"
            ],
            matchKeys: [
              "astroCopperPowder"
            ]
          }
        }
      ],
      grow: [],
      crystallization: []
    }
  ]
};

// src/config/elementConf/astroSeed.ts
var LIQUID_COPPER_DENSITY3 = 150;
var SEED_DENSITY3 = Math.max(1, LIQUID_COPPER_DENSITY3 - 5);
var astroSeed = {
  spec: spec({
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
    density: SEED_DENSITY3,
    metaColor: 9357567,
    matterType: MatterType.Powder,
    toolboxLabel: "Seed",
    isSeed: true,
    isCrystal: false
  }),
  reactions: [
    {
      inputA: "astroVoidSeed",
      inputB: "florinol",
      outputA: "astroSeed",
      outputB: null
    }
  ],
  profiles: [
    {
      id: "astroSeed-in-gold",
      seedKey: "astroSeed",
      liquidKey: "liquidGold",
      crystalKey: "astroGoldCrystal",
      growAge: 50,
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
          kind: "ageOnSurround",
          rate: 100,
          minCount: 4
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
        // { kind: "ageOnAir", rate: 30 },
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
    }
  ]
};

// src/config/elementConf/astroVoidSeed.ts
var astroVoidSeed = {
  spec: spec({
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
    matterType: MatterType.Powder,
    toolboxLabel: "Void Seed",
    isSeed: false,
    isCrystal: false
  }),
  reactions: [
    {
      inputA: "seedBase",
      inputB: "voidPetal",
      outputA: "astroVoidSeed",
      outputB: null
    }
  ]
};

// src/config/elementConf/astroWaterCrystal.ts
var astroWaterCrystal = {
  spec: spec({
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
    matterType: MatterType.Static,
    toolboxLabel: "Cry. Water",
    isSeed: false,
    isCrystal: true
  }),
  reactions: []
};

// src/config/elementConf/astroWaterPowder.ts
var astroWaterPowder = {
  spec: spec({
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
    matterType: MatterType.Powder,
    toolboxLabel: "Astro Water",
    isSeed: true,
    isCrystal: false
  }),
  reactions: [
    {
      inputA: "astroWaterCrystal",
      inputB: "fire",
      outputA: "astroWaterPowder",
      outputB: "fire"
    }
  ]
};

// src/config/catalogue.ts
var ASTRO_ELEMENTS = [
  astroCopperCrystal,
  astroCopperPowder,
  astroGoldCrystal,
  astroGoldPowder,
  astroSeed,
  astroVoidSeed,
  astroWaterCrystal,
  astroWaterPowder
];
var ASTRO_ELEMENT_BY_KEY = Object.fromEntries(ASTRO_ELEMENTS.map((e) => [
  e.spec.key,
  e.spec
]));
var ASTRO_REACTIONS = ASTRO_ELEMENTS.flatMap((c) => c.reactions);

// src/shared/utils.ts
function safe(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

// src/shared/resolve.ts
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
    e.spec.key,
    resolveType([
      e.spec.id
    ])
  ]));
}
var ElementType = {
  ...resolveVanilla(),
  ...resolveAstro()
};

// src/worker/elementProfileFactory.ts
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

// src/worker/build.ts
var api = sandkit.api;
var profileFactories = createProfileFactories(ASTRO_ELEMENTS.flatMap((el) => el.profiles ?? []));
function dispatchSeed(x, y, elementType, cancel) {
  for (const getProfile of Object.values(profileFactories)) {
    const profile = getProfile();
    if (profile.seedType == null || elementType !== profile.seedType) continue;
    if (profile.liquidType == null || !GridNear.isNear(x, y, profile.liquidType)) continue;
    api.elements.setPhysicsAtCell(x, y, 1);
    cancel.cancel();
    runProfile(x, y, profile);
    api.grid.reportActivityAtCell(x, y);
    api.grid.reportActivityAtCell(x, y - 1);
    return true;
  }
  api.elements.setPhysicsAtCell(x, y, 0);
  return false;
}
function buildWorker() {
  const seedTypes = [
    ...new Set(ASTRO_ELEMENTS.flatMap((el) => (el.profiles ?? []).map((p) => ElementType[p.seedKey])))
  ];
  for (const elementType of seedTypes) {
    if (!elementType) continue;
    api.hooks.intercept("element:update", (payload, cancel) => {
      const p = payload;
      return dispatchSeed(p.x, p.y, p.elementType || 0, cancel);
    }, {
      guard: {
        elementType
      }
    });
  }
  console.log(`[${MOD_ID} v${VERSION}] worker loaded`, seedTypes);
}

// src/worker.ts
try {
  buildWorker();
} catch (e) {
  console.error("[astro.seeds] worker failed:", e);
}
