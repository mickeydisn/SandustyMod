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

// src/config/elementProfile/inGold.ts
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
var MASK_FULL = [
  [
    1,
    1,
    1,
    1,
    1
  ],
  [
    1,
    1,
    1,
    1,
    1
  ],
  [
    1,
    1,
    0,
    1,
    1
  ],
  [
    1,
    1,
    1,
    1,
    1
  ],
  [
    1,
    1,
    1,
    1,
    1
  ]
];
var InGoldProfileList = [
  // ==========================
  // ASTRO SEED
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
      },
      {
        kind: "channel",
        chance: 90,
        matchKeys: [
          "water"
        ],
        weight: -1,
        mask: MASK_FULL
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
  // ==========================
  // ASTRO GOLD POWDER
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
        mask: MASK_PLUS
      },
      // Dispersed — own kind beside it pushes back (orthogonal only,
      // so diagonal neighbours stay free to settle).
      {
        kind: "channel",
        chance: 90,
        matchKeys: [
          "water"
        ],
        weight: -1,
        mask: MASK_FULL
      },
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
        weight: -15,
        mask: MASK_FULL
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
  },
  // ==========================
  // ASTRO COPPER POWDER
  {
    id: "astroCopper-in-liquid-gold",
    seedKey: "astroCopperPowder",
    liquidKey: "liquidGold",
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
        weight: -0.1,
        mask: MASK_GRAVITY
      },
      {
        kind: "channel",
        chance: 90,
        matchKeys: [
          "water"
        ],
        weight: -1,
        mask: MASK_FULL
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
        mask: MASK_PLUS
      },
      {
        kind: "channel",
        chance: 90,
        matchKeys: [
          "astroGoldPowder"
        ],
        weight: 2
      },
      {
        kind: "channel",
        chance: 90,
        matchKeys: [
          "astroGCalloyPowder"
        ],
        weight: -1
      },
      {
        kind: "memory",
        chance: 20,
        weight: 0.5,
        mask: MASK_FULL
      },
      {
        kind: "inertia",
        chance: 20,
        weight: 0.5,
        mode: "full"
      }
    ],
    growAge: 3,
    grow: [
      {
        kind: "ageOnSurround",
        minCount: 4,
        rate: 2,
        typeId: "astroGoldPowder"
      },
      {
        kind: "eat",
        chance: 1,
        matchKeys: [
          "astroGoldPowder"
        ],
        replaceKey: "empty"
      }
    ],
    crystalKey: "astroGCalloyPowder",
    crystallization: [
      {
        kind: "disk",
        radius: 1
      }
    ]
  }
];
function indexByType(list) {
  return Object.fromEntries(list.map((x) => [
    x.seedKey,
    x
  ]));
}
var InGoldProfile = indexByType(InGoldProfileList);

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
      inputB: "water",
      outputA: "astroCopperPowder",
      outputB: "water"
    }
  ],
  profiles: [
    // InWaterProfile.astroCopperPowder,
    InGoldProfile.astroCopperPowder
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

// src/config/elementConf/astroGCalloyPowder.ts
var LIQUID_COPPER_DENSITY2 = 150;
var SEED_DENSITY2 = Math.max(1, LIQUID_COPPER_DENSITY2 - 5);
var astroGCalloyPowder = {
  spec: spec({
    key: "astroGCalloyPowder",
    slug: "astro-gc-alloy",
    name: "Astro GC Alloy Powder",
    description: "Powder from ...",
    colors: [
      [
        100,
        155,
        10
      ],
      [
        60,
        130,
        0
      ]
    ],
    density: SEED_DENSITY2,
    metaColor: 9714336,
    matterType: MatterType.Powder,
    toolboxLabel: "Astro GC Alloy",
    isSeed: true,
    isCrystal: false
  }),
  reactions: [],
  profiles: []
};

// src/config/elementProfile/inWater.ts
var InWaterProfileList = [
  // ==========================
  // ASTRO SEED
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
  // ==========================
  // ASTRO GOLD POWDER
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
  // ==========================
  // ASTRO COPPER POWDER
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
  }
];
function indexByType2(list) {
  return Object.fromEntries(list.map((x) => [
    x.seedKey,
    x
  ]));
}
var InWaterProfile = indexByType2(InWaterProfileList);

// src/config/elementProfile/inCopper.ts
var InCopperProfileList = [
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
        kind: "ageOnSurround",
        rate: 20,
        minCount: 4
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
        radius: 2
      }
    ]
  }
];
function indexByType3(list) {
  return Object.fromEntries(list.map((x) => [
    x.seedKey,
    x
  ]));
}
var InCopperProfile = indexByType3(InCopperProfileList);

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
    InWaterProfile.astroSeed,
    InGoldProfile.astroSeed,
    InCopperProfile.astroSeed
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

// src/config/elementConf/astroGoldPowder.ts
var LIQUID_COPPER_DENSITY4 = 150;
var SEED_DENSITY4 = Math.max(1, LIQUID_COPPER_DENSITY4 - 5);
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
    density: SEED_DENSITY4,
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
    // InWaterProfile.astroGoldPowder,
    InGoldProfile.astroGoldPowder
  ]
};

// src/config/catalogue.ts
var ASTRO_ELEMENTS = [
  astroCopperCrystal,
  astroCopperPowder,
  astroGoldCrystal,
  astroGoldPowder,
  astroGCalloyPowder,
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

// src/main/build.ts
var api = sandkit.api;
function registerI18n() {
  api.i18n.register("en", {
    [`${MOD_ID}.tech.name`]: "Astro Seeds",
    [`${MOD_ID}.tech.description`]: "Seed\u2013crystal profiles over liquids."
  });
  for (const conf of ASTRO_ELEMENTS) {
    api.i18n.register("en", {
      [`${conf.spec.id}|name`]: conf.spec.name,
      [`${conf.spec.id}|description`]: conf.spec.description
    });
  }
}
function registerElements() {
  for (const confEl of ASTRO_ELEMENTS) {
    const conf = confEl.spec;
    const elementTypeId = api.elements.register({
      id: conf.id,
      nameKey: `${conf.id}|name`,
      descriptionKey: `${conf.id}|description`,
      colors: {
        variants: conf.colors
      },
      density: conf.density,
      metaColor: conf.metaColor,
      matterType: conf.matterType
    }).elementType;
    ElementType[conf.key] = elementTypeId;
    api.discoveries.addElementByType(elementTypeId);
  }
  for (const r of ASTRO_REACTIONS) {
    api.reactions.registerContact({
      inputA: ElementType[r.inputA],
      inputB: ElementType[r.inputB],
      outputA: r.outputA ? ElementType[r.outputA] : null,
      outputB: r.outputB ? ElementType[r.outputB] : null
    });
  }
}
function registerTech() {
  const parent = safe(() => sandkit.enums?.Tech?.SteamTurbine) || safe(() => sandkit.enums?.Tech?.KineticPress) || null;
  if (parent == null) return;
  api.tech.registerNode(`${MOD_ID}:astro-seeds`, {
    nameKey: `${MOD_ID}.tech.name`,
    descriptionKey: `${MOD_ID}.tech.description`,
    cost: 4500
  }, {
    parentId: parent
  });
}
function buildMain() {
  registerI18n();
  registerElements();
  registerTech();
  safe(() => api.events.on("game:ready", () => {
    api.ui.toast(`Astro Seeds v${VERSION}`, {});
  }));
  console.log(`[${MOD_ID} v${VERSION}] main loaded`);
}

// src/main.ts
try {
  buildMain();
} catch (e) {
  console.error("[astro.seeds] main failed:", e);
}
