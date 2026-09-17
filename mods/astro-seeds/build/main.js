// ../../packages/element-profiles/src/shared/util.ts
function safe(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

// ../../packages/element-profiles/src/main/build.ts
function elementNameKey(id) {
  return `${id}|name`;
}
function elementDescriptionKey(id) {
  return `${id}|description`;
}
function registerI18n(elements, locale) {
  const api = sandkit.api;
  for (const { spec: spec2 } of elements) {
    api.i18n.register(locale, {
      [elementNameKey(spec2.id)]: spec2.name,
      [elementDescriptionKey(spec2.id)]: spec2.description
    });
  }
}
function registerElements(elements, types) {
  const api = sandkit.api;
  for (const { spec: spec2 } of elements) {
    const elementTypeId = api.elements.register({
      id: spec2.id,
      nameKey: elementNameKey(spec2.id),
      descriptionKey: elementDescriptionKey(spec2.id),
      colors: {
        variants: spec2.colors
      },
      density: spec2.density,
      metaColor: spec2.metaColor,
      matterType: spec2.matterType
    }).elementType;
    types[spec2.key] = elementTypeId;
    api.discoveries.addElementByType(elementTypeId);
  }
}
function registerReactions(elements, types) {
  const api = sandkit.api;
  for (const { reactions } of elements) {
    for (const r of reactions) {
      api.reactions.registerContact({
        inputA: types[r.inputA],
        inputB: types[r.inputB],
        outputA: r.outputA ? types[r.outputA] : null,
        outputB: r.outputB ? types[r.outputB] : null
      });
    }
  }
}
function registerTech(tech, locale) {
  const api = sandkit.api;
  api.i18n.register(tech.locale ?? locale, {
    [tech.nameKey]: tech.name,
    [tech.descriptionKey]: tech.description
  });
  let parentId = null;
  for (const name of tech.parents ?? []) {
    const id = safe(() => sandkit.enums?.Tech?.[name]);
    if (id != null) {
      parentId = id;
      break;
    }
  }
  if (parentId == null) return false;
  api.tech.registerNode(tech.id, {
    nameKey: tech.nameKey,
    descriptionKey: tech.descriptionKey,
    cost: tech.cost ?? 0
  }, {
    parentId
  });
  return true;
}
function buildElementMain(config) {
  const locale = config.locale ?? "en";
  const types = {
    ...config.types
  };
  registerI18n(config.elements, locale);
  registerElements(config.elements, types);
  registerReactions(config.elements, types);
  const techRegistered = config.tech ? registerTech(config.tech, locale) : false;
  return {
    types,
    techRegistered
  };
}

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

// src/config/elementShared/ids.ts
var MOD_ID = "astro.seeds";
var VERSION = "3.1.0";

// src/config/elementShared/util.ts
function spec(entry) {
  return {
    ...entry,
    id: `${MOD_ID}:${entry.slug}`
  };
}
function safe2(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

// src/config/elementMain/astroCopperCrystal.ts
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

// src/config/elementMain/astroCopperPowder.ts
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
  ]
};

// src/config/elementMain/astroGCalloyPowder.ts
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
  reactions: []
};

// src/config/elementMain/astroGoldCrystal.ts
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

// src/config/elementMain/astroGoldPowder.ts
var LIQUID_COPPER_DENSITY3 = 150;
var SEED_DENSITY3 = Math.max(1, LIQUID_COPPER_DENSITY3 - 5);
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
    density: SEED_DENSITY3,
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
  ]
};

// src/config/elementMain/astroSeed.ts
var LIQUID_COPPER_DENSITY4 = 150;
var SEED_DENSITY4 = Math.max(1, LIQUID_COPPER_DENSITY4 - 5);
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
    density: SEED_DENSITY4,
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
  ]
};

// src/config/elementMain/astroVoidSeed.ts
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

// src/config/elementMain/astroWaterCrystal.ts
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

// src/config/elementMain/astroWaterPowder.ts
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

// src/config/elementMain/catalogue.ts
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

// src/config/elementShared/resolve.ts
function resolveType(ids) {
  for (const id of ids) {
    const t = safe2(() => sandkit.api.elements.getTypeFromId(id));
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
function buildMain() {
  const api = sandkit.api;
  const { types } = buildElementMain({
    elements: ASTRO_ELEMENTS,
    // Vanilla keys the reactions reference (water, fire, florinol, …).
    types: ElementType,
    tech: {
      id: `${MOD_ID}:astro-seeds`,
      nameKey: `${MOD_ID}.tech.name`,
      descriptionKey: `${MOD_ID}.tech.description`,
      name: "Astro Seeds",
      description: "Seed\u2013crystal profiles over liquids.",
      cost: 4500,
      parents: [
        "SteamTurbine",
        "KineticPress"
      ]
    }
  });
  Object.assign(ElementType, types);
  safe2(() => api.events.on("game:ready", () => {
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
