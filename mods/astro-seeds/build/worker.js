// ../../packages/element-profiles/src/grid.ts
var cachedEmpty = null;
var MEM_BIAS = 128;
var MEM_SCALE = 4;
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
  /**
     * Raw field read that keeps negative values (the age reader clamps them
     * because the engine uses -1 as a sentinel). The vote-memory channel
     * stores signed vectors, so it must read through this.
     */
  readFieldRawAt(x, y, field) {
    try {
      return sandkit.api.elements.getDataFieldAtCell(x, y, field) ?? 0;
    } catch {
      return 0;
    }
  },
  /**
     * Signed vector storage for the vote-memory channel.
     *
     * The engine's data fields cannot be relied on to hold negative numbers
     * (cell fields are typically unsigned bytes — a stored -2 comes back as
     * 0 or garbage, which silently erased every "up"/"left" velocity while
     * "down"/"right" survived). So vectors are encoded as
     * `round(v * MEM_SCALE) + MEM_BIAS`, clamped to 1..255. Raw `0` is
     * reserved for "no memory" — an encoded zero vector reads back as 128.
     * This round-trips correctly whether the field is a byte, int or float.
     */
  readVecAt(x, y, field) {
    const raw = Grid.readFieldRawAt(x, y, field);
    if (raw <= 0) return 0;
    return (raw - MEM_BIAS) / MEM_SCALE;
  },
  writeVecAt(x, y, field, v) {
    const raw = Math.round(v * MEM_SCALE) + MEM_BIAS;
    Grid.writeFieldAt(x, y, field, raw < 1 ? 1 : raw > 255 ? 255 : raw);
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
  /**
     * Best-effort numeric type for "empty" used to clear eaten cells.
     * Probes common empty ids, falls back to 0 (universally empty).
     * Cached after first lookup.
     */
  emptyType() {
    if (cachedEmpty != null) return cachedEmpty;
    const ids = [
      "empty",
      "Empty",
      "air",
      "Air",
      "void",
      "Void",
      "none",
      "None"
    ];
    for (const id of ids) {
      try {
        const t = sandkit.api.elements.getTypeFromId(id);
        if (t != null) {
          cachedEmpty = t;
          return t;
        }
      } catch {
      }
    }
    cachedEmpty = 0;
    return cachedEmpty;
  },
  // MOVE
  swapCell(x, y, nx, ny, passable) {
    const ok = passable == null ? [] : typeof passable === "number" ? [
      passable
    ] : passable;
    const t = this.getTypeAt(nx, ny);
    if (t == null || !ok.includes(t)) return null;
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
  },
  /**
     * Eat helper — replace whatever is at a cell with `replaceType`,
     * or clear to empty when `replaceType` is null.
     * Never touches the seed itself; caller must guard that.
     */
  eatAt(x, y, replaceType) {
    try {
      if (replaceType == null) {
        const empty = Grid.emptyType();
        if (empty != null) {
          sandkit.api.elements.replaceAtCell(x, y, empty);
        }
      } else {
        sandkit.api.elements.replaceAtCell(x, y, replaceType);
      }
    } catch {
    }
  },
  /**
     * Pick a random 8-neighbour cell of (`x`,`y`) whose type is in
     * `matchTypes`. Returns null when none match.
     */
  randomNearCell(x, y, matchTypes) {
    const match = typeof matchTypes === "number" ? [
      matchTypes
    ] : matchTypes;
    const order = [
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7
    ];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [
        order[j],
        order[i]
      ];
    }
    for (const k of order) {
      const d = EAT_DELTAS[k];
      if (Grid.isTypeAt(x + d.x, y + d.y, match)) {
        return {
          x: x + d.x,
          y: y + d.y
        };
      }
    }
    return null;
  }
};
var EAT_DELTAS = [
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
  getNear(x, y, deltas = DELTAS_INDEX) {
    return deltas.map((d) => Grid.getTypeAt(x + d.x, y + d.y));
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

// ../../packages/element-profiles/src/sense.ts
function idx(s, ox, oy) {
  return (oy + s.half) * s.size + (ox + s.half);
}
function inWindow(s, ox, oy) {
  return ox >= -s.half && ox <= s.half && oy >= -s.half && oy <= s.half;
}
var Sense = {
  /** Window index of offset (`ox`,`oy`), or `-1` when outside the window. */
  index(s, ox, oy) {
    return inWindow(s, ox, oy) ? idx(s, ox, oy) : -1;
  },
  /** Type at offset (`0` = empty). Out of window → 0. */
  at(s, ox, oy) {
    if (!inWindow(s, ox, oy)) return 0;
    return s.cells[idx(s, ox, oy)];
  },
  /** True when the offset cell's type is in `match` (0 never matches). */
  is(s, ox, oy, match) {
    if (!inWindow(s, ox, oy)) return false;
    const t = s.cells[idx(s, ox, oy)];
    if (t == null || t === 0) return false;
    const list = typeof match === "number" ? [
      match
    ] : match;
    return list.includes(t);
  },
  /** True when the offset cell is empty (type 0/null). */
  isEmpty(s, ox, oy) {
    if (!inWindow(s, ox, oy)) return false;
    const t = s.cells[idx(s, ox, oy)];
    return t == null || t === 0;
  },
  /** Count offsets whose type is in `match` (0 never counts). */
  count(s, match, offsets) {
    const list = typeof match === "number" ? [
      match
    ] : match;
    let n = 0;
    if (offsets) {
      for (const o of offsets) {
        if (!inWindow(s, o.x, o.y)) continue;
        const t = s.cells[idx(s, o.x, o.y)];
        if (t != null && t !== 0 && list.includes(t)) n++;
      }
      return n;
    }
    for (let i = 0; i < s.cells.length; i++) {
      if (i === s.center) continue;
      const t = s.cells[i];
      if (t != null && t !== 0 && list.includes(t)) n++;
    }
    return n;
  },
  /** True when any window cell (excl. centre) matches. */
  isNear(s, match) {
    const list = typeof match === "number" ? [
      match
    ] : match;
    for (let i = 0; i < s.cells.length; i++) {
      if (i === s.center) continue;
      const t = s.cells[i];
      if (t != null && t !== 0 && list.includes(t)) return true;
    }
    return false;
  },
  /** True when any window cell (excl. centre) is empty. */
  isNearEmpty(s, offsets) {
    if (offsets) {
      for (const o of offsets) {
        if (this.isEmpty(s, o.x, o.y)) return true;
      }
      return false;
    }
    for (let i = 0; i < s.cells.length; i++) {
      if (i === s.center) continue;
      const t = s.cells[i];
      if (t == null || t === 0) return true;
    }
    return false;
  },
  /**
     * Uniform-random offset (excl. centre) whose type is in `match`.
     * Returns null when nothing matches.
     */
  random(s, match) {
    const list = typeof match === "number" ? [
      match
    ] : match;
    let pick = -1;
    let n = 0;
    for (let i = 0; i < s.cells.length; i++) {
      if (i === s.center) continue;
      const t = s.cells[i];
      if (t == null || t === 0 || !list.includes(t)) continue;
      n++;
      if (Math.random() * n < 1) pick = i;
    }
    if (pick < 0) return null;
    return {
      x: pick % s.size - s.half,
      y: Math.floor(pick / s.size) - s.half
    };
  }
};

// ../../packages/element-profiles/src/resolve.ts
function resolveNum(v, fallback = 0) {
  if (typeof v === "function") return v();
  if (v === void 0 || v === null) return fallback;
  return v;
}
function roll(chance) {
  return chance >= 100 || chance > 0 && Math.random() * 100 < chance;
}

// ../../packages/element-profiles/src/vote.ts
var Vote = {
  /** Zero the accumulator — the pipeline does this once per tick. */
  clear(votes) {
    return votes.fill(0);
  },
  /**
     * Add `weight` at a window index. `-1` (what `Sense.index` returns for
     * offsets outside the window) is ignored, so callers never bound-check.
     * Index `0` IS a valid window cell (top-left of the 5x5).
     */
  add(votes, i, weight = 1) {
    if (i >= 0 && weight !== 0) votes[i] += weight;
  },
  /** Add `weight` at window offset (`ox`,`oy`). Out of window = no-op. */
  addAt(votes, sense, ox, oy, weight = 1) {
    Vote.add(votes, Sense.index(sense, ox, oy), weight);
  },
  /**
     * Reduce a type list to a lookup set. `0`/`null` entries are dropped —
     * `0` means "empty", which only `matchEmpty` may claim.
     */
  set(types) {
    const out = /* @__PURE__ */ new Set();
    if (types == null) return out;
    const raw = typeof types === "number" ? [
      types
    ] : types;
    for (const t of raw) {
      if (t != null && t !== 0) out.add(t);
    }
    return out;
  },
  /** True when at least one cell holds a vote. */
  any(votes) {
    for (let i = 0; i < votes.length; i++) {
      if (votes[i] !== 0) return true;
    }
    return false;
  },
  /** Number of voting cells (channels never stamp the centre). */
  count(votes) {
    let n = 0;
    for (let i = 0; i < votes.length; i++) {
      if (votes[i] !== 0) n++;
    }
    return n;
  },
  /**
     * Compile a mask once per window size into a flat lookup that `channel`
     * indexes directly — the per-tick path allocates nothing. Masks are
     * centre-cropped/padded with 0, so a 3x3 works inside the 5x5 window.
     * Returns `null` when the mask is absent or all-zero ("all offsets 1").
     */
  mask(mask, size) {
    if (!mask) return null;
    const half = Math.floor(size / 2);
    const out = new Float64Array(size * size);
    let any = false;
    if (typeof mask === "function") {
      for (let oy = -half; oy <= half; oy++) {
        for (let ox = -half; ox <= half; ox++) {
          if (ox === 0 && oy === 0) continue;
          const v = mask(ox, oy);
          out[(oy + half) * size + (ox + half)] = v;
          if (v !== 0) any = true;
        }
      }
      return any ? out : null;
    }
    let rows;
    if (mask.length > 0 && Array.isArray(mask[0])) {
      rows = mask;
    } else {
      const arr = mask;
      const sq = Math.sqrt(arr.length);
      if (!Number.isInteger(sq) || sq < 2) return null;
      const built = [];
      for (let r = 0; r < sq; r++) built.push(arr.slice(r * sq, (r + 1) * sq));
      rows = built;
    }
    let mw = 0;
    for (const r of rows) mw = Math.max(mw, r.length);
    if (rows.length === 0 || mw === 0) return null;
    const ox0 = half - Math.floor(mw / 2);
    const oy0 = half - Math.floor(rows.length / 2);
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const x = c + ox0;
        const y = r + oy0;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        if (x === half && y === half) continue;
        const v = rows[r][c];
        out[y * size + x] = v;
        if (v !== 0) any = true;
      }
    }
    return any ? out : null;
  },
  /**
     * Stamp ONE channel into `ctx.votes`: every offset except the centre
     * whose cell matches (`match`, or any non-excluded type when `match` is
     * empty; empties only when `matchEmpty`) gets `weight x mask`.
     * Returns how many cells voted — `columnForce` uses this to honour `maxK`.
     */
  channel(ctx, ch) {
    if (ch.weight === 0) return 0;
    const s = ctx.sense;
    const v = ctx.votes;
    const { match, exclude, matchEmpty = false, weight, mask } = ch;
    const anyType = !match || match.size === 0;
    let n = 0;
    for (let i = 0; i < v.length; i++) {
      if (i === s.center) continue;
      const m = mask ? mask[i] : 1;
      if (m === 0) continue;
      const t = s.cells[i];
      const hit = t == null || t === 0 ? matchEmpty : anyType ? !(exclude?.has(t) ?? false) : match.has(t);
      if (!hit) continue;
      v[i] += weight * m;
      n++;
    }
    return n;
  },
  /** Centroid reduce: offset-weighted vote vector → one 8-way step. */
  reduce(votes, size, center, threshold = 0) {
    const half = Math.floor(size / 2);
    let vx = 0;
    let vy = 0;
    for (let i = 0; i < votes.length; i++) {
      if (i === center) continue;
      const s = votes[i];
      if (!s) continue;
      vx += s * (i % size - half);
      vy += s * (Math.floor(i / size) - half);
    }
    return {
      dx: Math.abs(vx) > threshold ? vx > 0 ? 1 : -1 : 0,
      dy: Math.abs(vy) > threshold ? vy > 0 ? 1 : -1 : 0
    };
  },
  /** Raw (non-quantized) centroid vector — what the pipeline stores as memory. */
  vector(votes, size, center) {
    const half = Math.floor(size / 2);
    let vx = 0;
    let vy = 0;
    for (let i = 0; i < votes.length; i++) {
      if (i === center) continue;
      const s = votes[i];
      if (!s) continue;
      vx += s * (i % size - half);
      vy += s * (Math.floor(i / size) - half);
    }
    return {
      vx,
      vy
    };
  }
};

// ../../packages/element-profiles/src/actions/move.ts
var DX8 = [
  0,
  1,
  1,
  1,
  0,
  -1,
  -1,
  -1
];
var DY8 = [
  -1,
  -1,
  0,
  1,
  1,
  1,
  0,
  -1
];
function dirSteps(name) {
  switch (name) {
    case "top":
      return [
        [
          0,
          -1
        ],
        [
          -1,
          -1
        ],
        [
          1,
          -1
        ]
      ];
    case "bottom":
      return [
        [
          0,
          1
        ],
        [
          -1,
          1
        ],
        [
          1,
          1
        ]
      ];
    case "left":
      return [
        [
          -1,
          0
        ],
        [
          -1,
          -1
        ],
        [
          -1,
          1
        ]
      ];
    case "right":
      return [
        [
          1,
          0
        ],
        [
          1,
          -1
        ],
        [
          1,
          1
        ]
      ];
    case "sides":
      return [
        [
          -1,
          0
        ],
        [
          1,
          0
        ]
      ];
    case "cross":
      return [
        [
          1,
          1
        ],
        [
          -1,
          1
        ],
        [
          1,
          -1
        ],
        [
          -1,
          -1
        ]
      ];
    default:
      return [
        [
          0,
          1
        ],
        [
          0,
          -1
        ],
        [
          -1,
          0
        ],
        [
          1,
          0
        ],
        [
          -1,
          -1
        ],
        [
          1,
          -1
        ],
        [
          -1,
          1
        ],
        [
          1,
          1
        ]
      ];
  }
}
function columnRay(ctx, dx, dy, rangeN, rate2, match, free, exclude) {
  const steps = Math.min(rangeN, ctx.sense.half);
  for (let n = 1; n <= steps; n++) {
    const ox = dx * n;
    const oy = dy * n;
    const t = Sense.at(ctx.sense, ox, oy);
    if (t === 0 || free.has(t)) continue;
    const hit = match.size > 0 ? match.has(t) : !exclude.has(t);
    if (hit) {
      Vote.add(ctx.votes, Sense.index(ctx.sense, ox, oy), rate2 > 0 ? 1 : -1);
      return true;
    }
    return false;
  }
  return false;
}
var Move = {
  /** Vote one cell left or right (fair coin). */
  side(chanceFn) {
    return (ctx) => {
      const chance = resolveNum(chanceFn);
      if (!roll(chance) || ctx.sense.half < 1) return ctx;
      const dir = Math.random() < 0.5 ? -1 : 1;
      Vote.addAt(ctx.votes, ctx.sense, dir, 0, 1);
      return ctx;
    };
  },
  /** Vote the cell above. */
  up(chanceFn) {
    return (ctx) => {
      if (!roll(resolveNum(chanceFn)) || ctx.sense.half < 1) return ctx;
      Vote.addAt(ctx.votes, ctx.sense, 0, -1, 1);
      return ctx;
    };
  },
  /** Vote the cell below. */
  down(chanceFn) {
    return (ctx) => {
      if (!roll(resolveNum(chanceFn)) || ctx.sense.half < 1) return ctx;
      Vote.addAt(ctx.votes, ctx.sense, 0, 1, 1);
      return ctx;
    };
  },
  /**
     * Random-matrix walk: one uniform draw over the window offsets allowed by
     * `mask` (default: the 8 neighbours), voting the picked cell. Same shape
     * as stacking `side`/`up`/`down`, but uniform across all allowed offsets.
     * The draw list is compiled once from the mask (centre always excluded).
     */
  random(chanceFn, mask) {
    let dirs = null;
    return (ctx) => {
      if (!roll(resolveNum(chanceFn)) || ctx.sense.half < 1) return ctx;
      const s = ctx.sense;
      if (!dirs) {
        dirs = [];
        const m = mask ? Vote.mask(mask, s.size) : null;
        if (m) {
          for (let i = 0; i < m.length; i++) {
            if (m[i] !== 0) dirs.push(i);
          }
        } else {
          for (let k = 0; k < 8; k++) {
            dirs.push((DY8[k] + s.half) * s.size + (DX8[k] + s.half));
          }
        }
      }
      if (dirs.length === 0) return ctx;
      Vote.add(ctx.votes, dirs[Math.floor(Math.random() * dirs.length)], 0.1);
      return ctx;
    };
  },
  /**
     * Single-channel vote: every sense cell whose type matches adds
     * `weight x rate x mask` to the pipeline sum. One channel per call —
     * stack calls for multi-channel steering.
     *
     * Compilation is lazy (first tick): the type sets and the mask need the
     * live seed type and window size, and are then reused allocation-free.
     */
  channel(opts) {
    let inited = false;
    let match = /* @__PURE__ */ new Set();
    let exclude = /* @__PURE__ */ new Set();
    let maskSize = -1;
    let mask = null;
    return (ctx) => {
      if (!roll(resolveNum(opts.chance ?? 100))) return ctx;
      const weight = resolveNum(opts.weight) * resolveNum(opts.rate ?? 1);
      if (!weight) return ctx;
      if (!inited) {
        inited = true;
        match = Vote.set(opts.matchTypes);
        exclude = Vote.set(opts.excludeTypes);
        exclude.add(ctx.profile.seedType);
      }
      if (maskSize !== ctx.sense.size) {
        maskSize = ctx.sense.size;
        mask = Vote.mask(opts.mask, maskSize);
      }
      Vote.channel(ctx, {
        match,
        exclude,
        matchEmpty: opts.matchEmpty,
        weight,
        mask
      });
      return ctx;
    };
  },
  /**
     * ColumnForce: cast rays in `directions` and let the first opaque cell
     * of each ray vote ±1. Stacking directions composes a force field.
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
      if (!roll(Math.min(100, Math.abs(rate2)))) return ctx;
      const free = Vote.set([
        ctx.profile.liquidType,
        ...freeTypes
      ]);
      const match = Vote.set(matchTypes);
      const exclude = Vote.set([
        ctx.profile.seedType,
        ...excludeTypes
      ]);
      let voted = 0;
      for (const name of directions) {
        if (voted >= maxK) break;
        for (const [dx, dy] of dirSteps(name)) {
          if (voted >= maxK) break;
          if (columnRay(ctx, dx, dy, rangeN, rate2, match, free, exclude)) voted++;
        }
      }
      return ctx;
    };
  },
  /**
     * Trail-eat: deferred intent applied to the origin cell *after* a
     * successful move swap (see `runProfile`). Reads no engine state —
     * the pipeline applies it only when the centroid step actually moved.
     *
     * Multiple `trailEat` intents stack; each rolls its own chance.
     */
  trailEat(opts) {
    const replaceType = opts.replaceType ?? null;
    return (ctx) => ({
      ...ctx,
      trailEat: [
        ...ctx.trailEat,
        {
          chance: opts.chance,
          replaceType
        }
      ]
    });
  },
  /**
     * Vote-memory channel: each neighbour's stored movement vector (written
     * by the pipeline to `profile.memField`/`memField+1` after its last swap)
     * is re-voted at that neighbour's offset, scaled by how aligned the
     * vector is with the offset direction:
     *   vote += weight * mask * (vx * signX + vy * signY)
     * so neighbours already flowing away in a direction reinforce moving that
     * way (flocking/flow alignment); opposing vectors cancel naturally.
     * Needs `memField` set on the owning Profile — a no-op otherwise.
     */
  memory(opts) {
    let maskSize = -1;
    let mask = null;
    return (ctx) => {
      const chance = resolveNum(opts.chance ?? 100);
      if (chance <= 0 || !roll(chance)) return ctx;
      const w = resolveNum(opts.weight) * resolveNum(opts.rate ?? 1);
      if (!w) return ctx;
      const f = ctx.profile.memField;
      if (f == null) return ctx;
      const s = ctx.sense;
      if (maskSize !== s.size) {
        maskSize = s.size;
        mask = Vote.mask(opts.mask, s.size);
      }
      for (let oy = -s.half; oy <= s.half; oy++) {
        for (let ox = -s.half; ox <= s.half; ox++) {
          if (ox === 0 && oy === 0) continue;
          const i = (oy + s.half) * s.size + (ox + s.half);
          const m = mask ? mask[i] : 1;
          if (m === 0) continue;
          const vx = Grid.readVecAt(ctx.x + ox, ctx.y + oy, f);
          const vy = Grid.readVecAt(ctx.x + ox, ctx.y + oy, f + 1);
          if (vx === 0 && vy === 0) continue;
          const align = (vx > 0 ? 1 : vx < 0 ? -1 : 0) * Math.sign(ox) + (vy > 0 ? 1 : vy < 0 ? -1 : 0) * Math.sign(oy);
          if (align === 0) continue;
          ctx.votes[i] += w * m * align;
        }
      }
      return ctx;
    };
  },
  /**
     * Inertia channel — the self variant of `Move.memory`. Instead of
     * scanning neighbours, it reads the seed's OWN stored movement vector
     * (2 field reads, no window scan) and builds a vote matrix that matches
     * it: every offset votes by its normalized dot product with the vector,
     *
     *   vote += weight * mask * (ox * vx + oy * vy) / |v|
     *
     * which is a linear gradient pointing along last tick's flow — cells in
     * front of the motion are voted in, cells behind voted out (or skipped
     * with `mode: "ahead"`). Faster than `memory` (2 reads vs 2 x 24) and
     * gives straight-line persistence; combine both for flocking + inertia.
     * Needs `memField` set on the owning Profile — a no-op otherwise.
     */
  inertia(opts) {
    let maskSize = -1;
    let mask = null;
    return (ctx) => {
      const chance = resolveNum(opts.chance ?? 100);
      if (chance <= 0 || !roll(chance)) return ctx;
      const w = resolveNum(opts.weight) * resolveNum(opts.rate ?? 1);
      if (!w) return ctx;
      const f = ctx.profile.memField;
      if (f == null) return ctx;
      const vx = Grid.readVecAt(ctx.x, ctx.y, f);
      const vy = Grid.readVecAt(ctx.x, ctx.y, f + 1);
      if (vx === 0 && vy === 0) return ctx;
      const mag = Math.sqrt(vx * vx + vy * vy);
      if (mag === 0) return ctx;
      const aheadOnly = opts.mode === "ahead";
      const s = ctx.sense;
      if (maskSize !== s.size) {
        maskSize = s.size;
        mask = Vote.mask(opts.mask, s.size);
      }
      for (let oy = -s.half; oy <= s.half; oy++) {
        for (let ox = -s.half; ox <= s.half; ox++) {
          if (ox === 0 && oy === 0) continue;
          const i = (oy + s.half) * s.size + (ox + s.half);
          const m = mask ? mask[i] : 1;
          if (m === 0) continue;
          const dot = (ox * vx + oy * vy) / mag;
          if (aheadOnly && dot <= 0) continue;
          ctx.votes[i] += w * m * dot;
        }
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
    return (ctx) => Sense.isNearEmpty(ctx.sense) ? rate(resolveNum(rateFn), "air") : noMatch();
  },
  ageOnFloor(rateFn) {
    return (ctx) => {
      const below = Sense.at(ctx.sense, 0, 1);
      const solid = below !== 0 && below !== ctx.profile.seedType && below !== ctx.profile.liquidType;
      return solid ? rate(resolveNum(rateFn), "floor") : noMatch();
    };
  },
  ageOnWall(rateFn) {
    return (ctx) => {
      const hit = [
        Sense.at(ctx.sense, 1, 0),
        Sense.at(ctx.sense, -1, 0)
      ].some((t) => t !== 0 && t !== ctx.profile.seedType && t !== ctx.profile.liquidType);
      return hit ? rate(resolveNum(rateFn), "wall") : noMatch();
    };
  },
  ageOnCrystal(rateFn) {
    return (ctx) => ctx.profile.crystalType != null && Sense.isNear(ctx.sense, ctx.profile.crystalType) ? rate(resolveNum(rateFn), "crystal") : noMatch();
  },
  ageOnSurround(rateFn, minCountFn) {
    return (ctx) => {
      const minCount = resolveNum(minCountFn, 6);
      const n = Sense.count(ctx.sense, ctx.profile.liquidType);
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
      if (blockType != null && Sense.isNear(ctx.sense, blockType)) {
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
  },
  /**
     * Eat a random neighbouring cell from the sense matrix and report it as
     * growth. Picks one uniform-random window cell (excl. centre) whose type
     * is in `matchTypes` (default: the profile's `liquidType`), rolls
     * `chance`, then clears it or replaces it via `Grid.eatAt` using ENGINE
     * coordinates (sense offset + seed position).
     * Returns `matched: true, delta: 1` on success so it composes with the
     * first-match grow chain and actually ages the seed.
     */
  eat(opts) {
    const replaceType = opts.replaceType ?? null;
    return (ctx) => {
      const chance = resolveNum(opts.chance);
      if (chance <= 0 || Math.random() * 100 >= chance) return noMatch();
      const match = opts.matchTypes ?? ctx.profile.liquidType;
      if (match == null) return noMatch();
      const off = Sense.random(ctx.sense, match);
      if (!off) return noMatch();
      Grid.eatAt(ctx.x + off.x, ctx.y + off.y, replaceType);
      return {
        matched: true,
        delta: 1,
        tag: "eat",
        rate: chance
      };
    };
  }
};

// ../../packages/element-profiles/src/actions/crystallize.ts
function diskOffsets(r, senseHalf) {
  const cells = [];
  const rr = Math.min(r, senseHalf);
  for (let dy = -rr; dy <= rr; dy++) {
    for (let dx = -rr; dx <= rr; dx++) {
      if (dx * dx + dy * dy > r * r + 0.5) continue;
      cells.push({
        x: dx,
        y: dy
      });
    }
  }
  return cells;
}
function crossOffsets(r, senseHalf) {
  const cells = [];
  const rr = Math.min(r, senseHalf);
  for (let i = 1; i <= rr; i++) {
    cells.push({
      x: i,
      y: 0
    }, {
      x: -i,
      y: 0
    }, {
      x: 0,
      y: i
    }, {
      x: 0,
      y: -i
    });
  }
  return cells;
}
function ringOffsets(r, senseHalf) {
  const cells = [];
  const rr = Math.min(r, senseHalf);
  const r2 = r * r;
  const i2 = Math.max(0, r - 1) ** 2;
  for (let dy = -rr; dy <= rr; dy++) {
    for (let dx = -rr; dx <= rr; dx++) {
      const d = dx * dx + dy * dy;
      if (d > r2 + 0.5 || d < i2 - 0.5) continue;
      cells.push({
        x: dx,
        y: dy
      });
    }
  }
  return cells;
}
function columnOffsets(r, senseHalf) {
  const cells = [];
  const rr = Math.min(r, senseHalf);
  for (let dy = -rr; dy <= rr; dy++) {
    if (dy === 0) continue;
    cells.push({
      x: 0,
      y: dy
    });
  }
  return cells;
}
function commit(ctx, offsets) {
  const { seedType, crystalType, ageField, liquidType } = ctx.profile;
  if (seedType == null || Sense.at(ctx.sense, 0, 0) !== seedType) return false;
  const targets = [];
  for (const o of offsets) {
    if (Sense.is(ctx.sense, o.x, o.y, liquidType)) targets.push(o);
  }
  if (targets.length < 1) return false;
  for (const t of targets) {
    sandkit.api.elements.replaceAtCell(ctx.x + t.x, ctx.y + t.y, crystalType);
  }
  sandkit.api.elements.replaceAtCell(ctx.x, ctx.y, crystalType);
  Grid.resetFieldAt(ctx.x, ctx.y, ageField);
  return true;
}
var Crystallization = {
  disk(radiusFn) {
    return (ctx) => commit(ctx, diskOffsets(resolveNum(radiusFn), ctx.sense.half));
  },
  cross(radiusFn) {
    return (ctx) => commit(ctx, crossOffsets(resolveNum(radiusFn), ctx.sense.half));
  },
  ring(radiusFn) {
    return (ctx) => commit(ctx, ringOffsets(resolveNum(radiusFn), ctx.sense.half));
  },
  column(radiusFn) {
    return (ctx) => commit(ctx, columnOffsets(resolveNum(radiusFn), ctx.sense.half));
  },
  single() {
    return (ctx) => {
      if (!Sense.isNear(ctx.sense, ctx.profile.liquidType)) return false;
      if (ctx.profile.seedType == null || Sense.at(ctx.sense, 0, 0) !== ctx.profile.seedType) {
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
var SENSE_SIZE = 5;
var SENSE_N = SENSE_SIZE * SENSE_SIZE;
var SENSE_HALF = Math.floor(SENSE_SIZE / 2);
var SENSE_CENTER = SENSE_HALF * SENSE_SIZE + SENSE_HALF;
var senseCells = new Int32Array(SENSE_N);
var voteAcc = new Float64Array(SENSE_N);
function sampleSense(x, y) {
  for (let dy = -SENSE_HALF; dy <= SENSE_HALF; dy++) {
    for (let dx = -SENSE_HALF; dx <= SENSE_HALF; dx++) {
      const i = (dy + SENSE_HALF) * SENSE_SIZE + (dx + SENSE_HALF);
      let t = 0;
      try {
        t = Grid.getTypeAt(x + dx, y + dy) ?? 0;
      } catch {
        t = 0;
      }
      senseCells[i] = t;
    }
  }
  return {
    size: SENSE_SIZE,
    half: SENSE_HALF,
    cells: senseCells,
    center: SENSE_CENTER
  };
}
function runProfile(x, y, profile) {
  const sense = sampleSense(x, y);
  if (sense.cells[SENSE_CENTER] !== profile.seedType) return false;
  let liquidNear = false;
  for (let i = 0; i < SENSE_N; i++) {
    if (i !== SENSE_CENTER && sense.cells[i] === profile.liquidType) {
      liquidNear = true;
      break;
    }
  }
  if (!liquidNear) {
    Grid.resetFieldAt(x, y, profile.ageField);
    return false;
  }
  if (!roll(resolveNum(profile.tickSpeed))) return true;
  let ctx = {
    x,
    y,
    profile,
    sense,
    votes: Vote.clear(voteAcc),
    age: Grid.readFieldAt(x, y, profile.ageField),
    blocked: false,
    tryInstant: false,
    stuck: false,
    trailEat: []
  };
  let delta = 0;
  for (const fn of profile.grow) {
    const result = fn(ctx);
    if (ctx.blocked) break;
    if (result.matched) {
      delta = result.delta || 0;
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
  let pvx = 0;
  let pvy = 0;
  if (profile.memField != null) {
    pvx = Grid.readVecAt(ctx.x, ctx.y, profile.memField);
    pvy = Grid.readVecAt(ctx.x, ctx.y, profile.memField + 1);
  }
  for (const fn of profile.moves) {
    ctx = fn(ctx);
  }
  const tick = Vote.vector(ctx.votes, SENSE_SIZE, SENSE_CENTER);
  const passable = new Set(ctx.profile.passableTypes ?? []);
  passable.add(ctx.profile.liquidType);
  const s = ctx.sense;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      if (ox === 0 && oy === 0) continue;
      const i = (oy + s.half) * s.size + (ox + s.half);
      if (!passable.has(s.cells[i] ?? 0)) ctx.votes[i] = 0;
    }
  }
  const { dx, dy } = Vote.reduce(ctx.votes, SENSE_SIZE, SENSE_CENTER, 0);
  let moved = false;
  if (dx !== 0 || dy !== 0) {
    const ox = ctx.x;
    const oy = ctx.y;
    const r = Grid.swapCell(ctx.x, ctx.y, ctx.x + dx, ctx.y + dy, ctx.profile.passableTypes ? [
      ctx.profile.liquidType,
      ...ctx.profile.passableTypes
    ] : ctx.profile.liquidType);
    if (r) {
      moved = true;
      for (const eat of ctx.trailEat) {
        if (roll(resolveNum(eat.chance))) Grid.eatAt(ox, oy, eat.replaceType);
      }
      ctx = {
        ...ctx,
        x: r.x,
        y: r.y
      };
    }
  }
  if (profile.memField != null) {
    const d = profile.memDecay ?? 0;
    let vx = pvx * d + tick.vx;
    let vy = pvy * d + tick.vy;
    if (!moved && profile.memBounce && (pvx !== 0 || pvy !== 0) && Vote.any(ctx.votes)) {
      vx = -pvx * d;
      vy = -pvy * d;
    }
    Grid.writeVecAt(ctx.x, ctx.y, profile.memField, vx);
    Grid.writeVecAt(ctx.x, ctx.y, profile.memField + 1, vy);
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
var MASK_CROSS = [
  [
    0,
    1,
    0
  ],
  [
    1,
    0,
    1
  ],
  [
    0,
    1,
    0
  ]
];
var MASK_PLUS = [
  [
    0,
    1,
    0
  ],
  [
    1,
    0,
    1
  ],
  [
    0,
    1,
    0
  ]
];
var MASK_DIAGONAL = [
  [
    1,
    0,
    1
  ],
  [
    0,
    0,
    0
  ],
  [
    1,
    0,
    1
  ]
];
var MASK_GRAVITY = [
  [
    0,
    0,
    0,
    0,
    0
  ],
  [
    0,
    0,
    0.5,
    0,
    0
  ],
  [
    0,
    0,
    0,
    0,
    0
  ],
  [
    0,
    0,
    1,
    0,
    0
  ],
  [
    0,
    0,
    0.5,
    0,
    0
  ]
];
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
      inputB: "water",
      outputA: "astroCopperPowder",
      outputB: "water"
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
          chance: 10
        },
        {
          kind: "down",
          chance: 5
        },
        {
          kind: "columnForce",
          rate: -30,
          rangeN: 4,
          maxK: 1,
          directions: [
            "top",
            "bottom",
            "sides"
          ]
        },
        {
          kind: "columnForce",
          rate: 20,
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
        },
        {
          kind: "columnForce",
          rate: -40,
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
        },
        {
          kind: "columnForce",
          rate: 40,
          rangeN: 4,
          maxK: 1,
          directions: [
            "cross"
          ],
          matchKeys: [
            "astroCopperPowder"
          ]
        }
      ],
      grow: [],
      crystallization: []
    },
    {
      id: "astroCopper-in-liquid-gold",
      seedKey: "astroCopperPowder",
      liquidKey: "liquidGold",
      crystalKey: "astroCopperCrystal",
      growAge: 10,
      // Vote memory: vx @ VX, vy @ VY (pipeline writes it every tick).
      // memDecay integrates it into a real fading velocity; memBounce
      // reflects it off walls/floor so landing seeds rebound upward.
      memField: ASTRO_FIELD.VX,
      memDecay: 0.9,
      memBounce: true,
      moves: [
        // Jitter — uniform random draw over the 8 neighbours.
        {
          kind: "random",
          chance: 80
        },
        // Gravity — liquid gold below pulls the seed down.
        {
          kind: "channel",
          chance: 1,
          matchKeys: [
            "liquidGold"
          ],
          weight: 1,
          mask: MASK_GRAVITY
        },
        {
          kind: "channel",
          matchKeys: [
            "empty",
            "structure"
          ],
          chance: 100,
          weight: -10,
          mask: MASK_PLUS
        },
        // Lattice — own kind repels orthogonally but attracts
        // diagonally, so copper settles into diagonal chains instead
        // of stacking into a solid blob.
        {
          kind: "channel",
          chance: 90,
          matchKeys: [
            "astroCopperPowder"
          ],
          weight: -2,
          mask: MASK_CROSS
        },
        {
          kind: "channel",
          chance: 90,
          matchKeys: [
            "astroCopperPowder"
          ],
          weight: 2,
          mask: MASK_DIAGONAL
        },
        // Cluster — any nearby gold powder pulls this copper in.
        {
          kind: "channel",
          chance: 90,
          matchKeys: [
            "astroGoldPowder"
          ],
          weight: 5
        },
        // Flow memory — align with the movement vector neighbours
        // stored last tick (flocking; keeps drifting seeds coherent).
        {
          kind: "memory",
          chance: 100,
          weight: 2
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
var MASK_VERT = [
  [
    0,
    1,
    0
  ],
  [
    0,
    0,
    0
  ],
  [
    0,
    1,
    0
  ]
];
var MASK_SIDE = [
  [
    0,
    0,
    0
  ],
  [
    1,
    0,
    1
  ],
  [
    0,
    0,
    0
  ]
];
var MASK_PLUS2 = [
  [
    0,
    1,
    0
  ],
  [
    1,
    0,
    1
  ],
  [
    0,
    1,
    0
  ]
];
var MASK_ALL = [
  [
    1,
    1,
    1
  ],
  [
    1,
    0,
    1
  ],
  [
    1,
    1,
    1
  ]
];
var MASK_OUT = [
  [
    1,
    1,
    1,
    1,
    1
  ],
  [
    1,
    0,
    0,
    0,
    1
  ],
  [
    1,
    0,
    0,
    0,
    1
  ],
  [
    1,
    0,
    0,
    0,
    1
  ],
  [
    1,
    1,
    1,
    1,
    0
  ]
];
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
          rate: -30,
          rangeN: 4,
          maxK: 1,
          directions: [
            "top",
            "bottom",
            "sides"
          ]
        },
        {
          kind: "columnForce",
          rate: -20,
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
        },
        {
          kind: "columnForce",
          rate: 80,
          rangeN: 5,
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
      ],
      grow: [],
      crystallization: []
    },
    {
      id: "astroGold-in-liquid-gold",
      seedKey: "astroGoldPowder",
      liquidKey: "liquidGold",
      crystalKey: "astroGoldCrystal",
      growAge: 10,
      // Vote memory: vx @ VX, vy @ VY (pipeline writes it every tick).
      // memDecay integrates it into a real fading velocity; memBounce
      // reflects it off walls/floor so landing seeds rebound upward.
      memField: ASTRO_FIELD.VX,
      memDecay: 0.1,
      memBounce: true,
      moves: [
        // Jitter — uniform random draw over the 8 neighbours.
        // { kind: "trailEat", chance: 1, replaceKey: "sand" },
        // Jitter — uniform random draw over the 8 neighbours.
        {
          kind: "random",
          chance: 80,
          mask: MASK_SIDE
        },
        {
          kind: "random",
          chance: 80,
          mask: MASK_VERT
        },
        // Gravity — liquid gold below pulls the seed down.
        /*
                        {
                            kind: "channel",
                            chance: 1,
                            matchKeys: ["liquidGold"],
                            weight: .1,
                            mask: MASK_GRAVITY,
        
                        },
                        */
        {
          kind: "channel",
          matchKeys: [
            "empty",
            "structure"
          ],
          chance: 100,
          weight: -15,
          mask: MASK_PLUS2
        },
        // Dispersed — own kind beside it pushes back (orthogonal only,
        // so diagonal neighbours stay free to settle).
        {
          kind: "channel",
          chance: 80,
          matchKeys: [
            "astroGoldPowder"
          ],
          weight: -1,
          mask: MASK_ALL
        },
        {
          kind: "channel",
          chance: 50,
          matchKeys: [
            "astroGoldPowder"
          ],
          weight: 0.4,
          mask: MASK_OUT
        },
        {
          kind: "channel",
          chance: 50,
          matchKeys: [
            "astroCopperPowder"
          ],
          weight: -5,
          mask: MASK_ALL
        },
        // Cluster — any nearby copper powder pulls this gold in.
        // { kind: "channel", chance: 20, matchKeys: ["astroCopperPowder"], weight: -2 },
        // Flow memory — align with the movement vector neighbours
        // stored last tick (flocking; keeps drifting seeds coherent).
        // { kind: "memory", chance: 100, weight: .1 },
        // Inertia — own last-tick flow vector drives a matching vote
        // gradient (straight-line persistence on top of flocking).
        {
          kind: "inertia",
          chance: 1,
          weight: 0.1,
          mode: "full"
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
      id: "astroSeed-in-sand",
      seedKey: "astroSeed",
      liquidKey: "water",
      crystalKey: "astroGoldCrystal",
      growAge: 150,
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
      id: "astroSeed-in-gold",
      seedKey: "astroSeed",
      liquidKey: "liquidGold",
      crystalKey: "astroGoldCrystal",
      growAge: 150,
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
      growAge: 40,
      moves: [
        {
          kind: "up",
          chance: 0
        },
        {
          kind: "side",
          chance: 25
        },
        {
          kind: "down",
          chance: 35
        }
      ],
      grow: [
        // { kind: "blockOn", blockKey: "water" },
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
  ],
  sand: [
    "sand",
    "Sand"
  ],
  empty: [
    "empty",
    "Empty",
    "air",
    "Air",
    "void",
    "Void",
    "none",
    "None"
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
var structureTypes = null;
function structureTypeSet() {
  if (structureTypes !== null) return structureTypes;
  structureTypes = /* @__PURE__ */ new Set();
  try {
    const getDef = sandkit.api.elements.getDefinitionByType;
    if (getDef) {
      for (const t of Object.values(ElementType)) {
        if (t == null || t === 0) continue;
        const def = getDef.call(sandkit.api.elements, t);
        if (def && def.matterType === MatterType.Static) structureTypes.add(t);
      }
    }
  } catch {
  }
  return structureTypes;
}
function keysOf(keys) {
  if (keys == null) return void 0;
  const out = [];
  for (const k of keys) {
    if (k === "empty") continue;
    if (k === "structure") {
      for (const t of structureTypeSet()) out.push(t);
    } else {
      out.push(ElementType[k]);
    }
  }
  return out;
}
function keyOf(key) {
  return key == null || key === "empty" ? null : ElementType[key] ?? null;
}
function keysChannel(keys) {
  return {
    matchTypes: keysOf(keys),
    matchEmpty: keys?.includes("empty") ?? void 0
  };
}
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
    else if (spec2.kind === "random") out.push(Move.random(spec2.chance, spec2.mask));
    else if (spec2.kind === "channel") {
      out.push(Move.channel({
        ...keysChannel(spec2.matchKeys),
        weight: spec2.weight,
        rate: spec2.rate,
        chance: spec2.chance,
        excludeTypes: keysOf(spec2.excludeKeys),
        mask: spec2.mask
      }));
    } else if (spec2.kind === "memory") {
      out.push(Move.memory({
        chance: spec2.chance,
        weight: spec2.weight,
        rate: spec2.rate,
        mask: spec2.mask
      }));
    } else if (spec2.kind === "inertia") {
      out.push(Move.inertia({
        chance: spec2.chance,
        weight: spec2.weight,
        rate: spec2.rate,
        mask: spec2.mask,
        mode: spec2.mode
      }));
    } else if (spec2.kind === "trailEat") {
      out.push(Move.trailEat({
        chance: spec2.chance,
        replaceType: keyOf(spec2.replaceKey)
      }));
    } else if (spec2.kind === "columnForce") {
      out.push(Move.columnForce({
        rateFn: spec2.rate,
        matchTypes: keysOf(spec2.matchKeys) ?? [],
        directions: spec2.directions,
        rangeNFn: spec2.rangeN,
        maxKFn: spec2.maxK,
        freeTypes: keysOf(spec2.freeKeys) ?? [],
        excludeTypes: keysOf(spec2.excludeKeys) ?? []
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
  if (spec2.kind === "eat") {
    return Grow.eat({
      chance: spec2.chance,
      replaceType: keyOf(spec2.replaceKey),
      // Omit = profile's own liquid (Grow.eat resolves it per tick).
      matchTypes: keysOf(spec2.matchKeys)
    });
  }
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
    tickSpeed: 50,
    ageField: ASTRO_FIELD.AGE,
    // Vote-memory vector storage (vx @ VX, vy @ VX+1). Opt-in per profile
    // so profiles without `Move.memory` never write fields. `memDecay`
    // integrates it into a decaying velocity; `memBounce` reflects it
    // off blocked moves (walls / floor).
    memField: spec2.memField,
    memDecay: typeof spec2.memDecay === "function" ? spec2.memDecay() : spec2.memDecay,
    memBounce: spec2.memBounce,
    // `keysOf` skips "empty" (match lists use matchEmpty instead) —
    // for passability 0 must be an explicit member, so resolve here.
    passableTypes: spec2.passableKeys?.map((k) => k === "empty" ? 0 : k === "structure" ? [
      ...structureTypeSet()
    ] : ElementType[k]).flat(),
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
