// src/shared/ids.ts
var MOD_ID = "astro.seeds";
var VERSION = "3.1.0";

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
function createDefaultState() {
  const state2 = {};
  for (const f of CONFIG_FIELDS) state2[f.key] = f.default;
  return state2;
}
function clampField(f, value) {
  const min = f.min ?? 0;
  const max = f.max ?? 100;
  return Math.max(min, Math.min(max, Math.round(value)));
}
var FORCE_DIRECTIONS = [
  "sides",
  "top",
  "bottom",
  "left",
  "right",
  "cross"
];
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

// src/main/panel.ts
var api = sandkit.api;
var React = sandkit.react;
var h = React?.createElement.bind(React);
function safe(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
function toast(msg) {
  safe(() => api.ui.toast(msg));
}
function isModEnabled() {
  const v = safe(() => api.settings.get("enabled"));
  return typeof v === "boolean" ? v : true;
}
var state = createDefaultState();
var panelOpen = true;
var buf = api.shared.buffers.create("astroConfig", {
  type: "uint16",
  length: BUF_LENGTH
});
var jsonBuf = null;
function ensureJsonBuf() {
  if (jsonBuf) return jsonBuf;
  try {
    jsonBuf = api.shared.buffers.create("astroJson", {
      type: "uint8",
      length: JSON_BUF_LENGTH
    });
  } catch (e) {
    console.warn(`[${MOD_ID}] astroJson buffer unavailable:`, e);
    jsonBuf = null;
  }
  return jsonBuf;
}
var forceConfig = JSON.parse(JSON.stringify(DEFAULT_FORCE_CONFIG));
var forceExpanded = /* @__PURE__ */ new Set();
var forceToolbox = /* @__PURE__ */ new Set();
var jsonCounter = 0;
var FORCE_TYPE_CANDIDATES = [
  {
    id: "water",
    label: "Water"
  },
  {
    id: "liquidGold",
    label: "Gold liq."
  },
  {
    id: "liquidCopper",
    label: "Copper liq."
  },
  {
    id: `${MOD_ID}:astro-seed`,
    label: "Seed"
  },
  {
    id: `${MOD_ID}:astro-gold-crystal`,
    label: "Cry. Gold"
  },
  {
    id: `${MOD_ID}:astro-copper-crystal`,
    label: "Cry. Copper"
  },
  {
    id: `${MOD_ID}:astro-water-crystal`,
    label: "Cry. Water"
  },
  {
    id: `${MOD_ID}:astro-gold`,
    label: "Astro Gold"
  },
  {
    id: `${MOD_ID}:astro-copper`,
    label: "Astro Copper"
  },
  {
    id: `${MOD_ID}:astro-water`,
    label: "Astro Water"
  }
];
var resolvedForceTypes = null;
function forceTypes() {
  if (resolvedForceTypes) return resolvedForceTypes;
  const out = [];
  for (const c of FORCE_TYPE_CANDIDATES) {
    const t = safe(() => api.elements.getTypeFromId(c.id));
    if (t == null) continue;
    const name = safe(() => api.elements.getNameByType?.(t)) ?? c.label;
    out.push({
      type: t,
      label: name || c.label
    });
  }
  resolvedForceTypes = out;
  return out;
}
function writeForceJson() {
  const bytes = new TextEncoder().encode(JSON.stringify(forceConfig));
  const target = ensureJsonBuf();
  if (target) {
    if (bytes.length > JSON_BUF_LENGTH) {
      toast("Force config too big \u2014 buffer truncated");
    }
    target.fill(0);
    target.set(bytes.subarray(0, JSON_BUF_LENGTH));
  }
  jsonCounter = jsonCounter + 1 & 65535;
  if (buf) buf[JSON_COUNTER_INDEX] = jsonCounter;
}
function pushBuffer() {
  if (!buf) return;
  for (const f of CONFIG_FIELDS) {
    const raw = state[f.key];
    if (f.kind === "bool") {
      buf[f.index] = raw ? 1 : 0;
    } else {
      buf[f.index] = clampField(f, Number(raw) || 0);
    }
  }
  if (!isModEnabled()) buf[0] = 0;
  writeForceJson();
}
pushBuffer();
safe(() => api.settings.onChange(() => pushBuffer()));
var C = {
  bg: "rgba(8,12,20,0.95)",
  border: "rgba(140,200,255,0.28)",
  text: "#d0e8ff",
  dim: "#7a9ab8",
  accent: "#7ec8ff",
  gold: "#e0b0ff",
  copper: "#e09860",
  water: "#6ab0e0",
  off: "rgba(255,255,255,0.07)"
};
var SECTION_META = {
  master: {
    title: "FEATURES",
    color: C.accent
  },
  move: {
    title: "MOVE",
    color: C.water
  },
  grow: {
    title: "GROW",
    color: C.gold
  },
  crystal: {
    title: "CRYSTALLIZE",
    color: C.copper
  }
};
function toggleStyle(on) {
  return {
    flex: 1,
    padding: "5px 8px",
    background: on ? "rgba(126,200,255,0.2)" : C.off,
    border: `1px solid ${on ? C.accent : "transparent"}`,
    borderRadius: "4px",
    color: on ? C.accent : C.text,
    cursor: "pointer",
    font: "inherit",
    textAlign: "left"
  };
}
function btnStyle(active = false) {
  return {
    padding: "4px 6px",
    minWidth: "28px",
    background: active ? "rgba(126,200,255,0.22)" : C.off,
    border: `1px solid ${active ? C.accent : "transparent"}`,
    borderRadius: "4px",
    color: active ? C.accent : C.text,
    cursor: "pointer",
    font: "inherit",
    textAlign: "center"
  };
}
function inGame() {
  const active = safe(() => api.scene?.getActive());
  if (active === void 0 || active === null) return true;
  const Scene = safe(() => sandkit.enums?.Scene) || {};
  const menus = [
    Scene.MainMenu,
    Scene.Intro
  ].filter((v) => typeof v === "number");
  if (menus.length > 0) return !menus.includes(active);
  return active !== 1 && active !== 2;
}
function fieldsIn(section) {
  return CONFIG_FIELDS.filter((f) => f.section === section);
}
function visible(f) {
  if (!f.when) return true;
  return !!state[f.when];
}
function mountPanel() {
  if (!React || !h) {
    console.warn(`[${MOD_ID}] sandkit.react missing \u2014 panel skipped`);
    return;
  }
  function AstroPanel() {
    const [, bump] = React.useState(0);
    const redraw = () => {
      pushBuffer();
      bump((v) => v + 1);
    };
    React.useEffect(() => {
      const id = setInterval(() => bump((v) => v + 1), 500);
      return () => clearInterval(id);
    }, []);
    if (!isModEnabled() || !inGame() || !panelOpen) return null;
    const Toggle = (props) => {
      const on = !!state[props.field.key];
      return h("button", {
        style: toggleStyle(on),
        onClick: () => {
          state[props.field.key] = !on;
          redraw();
        }
      }, `${on ? "\u25C9" : "\u25CB"} ${props.field.label}`);
    };
    const Stepper = (props) => {
      const f = props.field;
      const value = Number(state[f.key]) || 0;
      const apply = (delta) => {
        state[f.key] = clampField(f, value + delta);
        redraw();
      };
      return h("div", {
        style: {
          display: "flex",
          gap: "4px",
          alignItems: "center"
        }
      }, h("span", {
        style: {
          flex: 1.2,
          color: C.dim,
          fontSize: "10px"
        }
      }, f.label), h("button", {
        style: btnStyle(),
        onClick: () => apply(-10)
      }, "\u2212\u2212"), h("button", {
        style: btnStyle(),
        onClick: () => apply(-1)
      }, "\u2212"), h("div", {
        style: {
          ...btnStyle(),
          cursor: "default",
          minWidth: "36px"
        }
      }, String(value)), h("button", {
        style: btnStyle(),
        onClick: () => apply(1)
      }, "+"), h("button", {
        style: btnStyle(),
        onClick: () => apply(10)
      }, "++"));
    };
    const chip = (active, small = false) => ({
      padding: small ? "2px 5px" : "3px 7px",
      background: active ? "rgba(126,200,255,0.22)" : C.off,
      border: `1px solid ${active ? C.accent : "transparent"}`,
      borderRadius: "4px",
      color: active ? C.accent : C.dim,
      cursor: "pointer",
      font: "inherit",
      textAlign: "center"
    });
    const NumField = (props) => {
      const clamp = (v) => {
        const lo = props.min ?? -1e3;
        const hi = props.max ?? 1e3;
        return Math.max(lo, Math.min(hi, Math.round(v)));
      };
      return h("div", {
        style: {
          display: "flex",
          gap: "4px",
          alignItems: "center"
        }
      }, h("span", {
        style: {
          flex: 1,
          color: C.dim,
          fontSize: "10px"
        }
      }, props.label), h("button", {
        style: btnStyle(),
        onClick: () => props.onChange(clamp(props.value - props.step))
      }, "\u2212"), h("div", {
        style: {
          ...btnStyle(),
          cursor: "default",
          minWidth: "34px"
        }
      }, String(props.value)), h("button", {
        style: btnStyle(),
        onClick: () => props.onChange(clamp(props.value + props.step))
      }, "+"));
    };
    const DirectionRow = (props) => {
      const toggleDir = (d) => {
        const dirs = props.entry.directions;
        props.entry.directions = dirs.includes(d) ? dirs.filter((x) => x !== d) : [
          ...dirs,
          d
        ];
        redraw();
      };
      return h("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "3px"
        }
      }, h("span", {
        style: {
          color: C.dim,
          fontSize: "10px"
        }
      }, "Directions"), h("div", {
        style: {
          display: "flex",
          flexWrap: "wrap",
          gap: "3px"
        }
      }, ...FORCE_DIRECTIONS.map((d) => h("button", {
        key: d,
        style: chip(props.entry.directions.includes(d), true),
        onClick: () => toggleDir(d)
      }, d))));
    };
    const TypeToolbox = (props) => {
      const key = `${props.index}:${props.field}`;
      const list = props.entry[props.field];
      const open = forceToolbox.has(key);
      const toggle = (t) => {
        const arr = props.entry[props.field];
        if (arr.includes(t)) {
          props.entry[props.field] = arr.filter((x) => x !== t);
        } else {
          props.entry[props.field] = [
            ...arr,
            t
          ];
        }
        redraw();
      };
      return h("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "3px"
        }
      }, h("button", {
        style: {
          ...chip(open, true),
          display: "flex",
          alignItems: "center",
          gap: "4px"
        },
        onClick: () => {
          if (open) forceToolbox.delete(key);
          else forceToolbox.add(key);
          redraw();
        }
      }, `${open ? "\u25BE" : "\u25B8"} ${props.label} (${list.length})`), open ? h("div", {
        style: {
          display: "flex",
          flexWrap: "wrap",
          gap: "3px"
        }
      }, ...forceTypes().map((t) => h("button", {
        key: t.type,
        style: chip(list.includes(t.type), true),
        onClick: () => toggle(t.type)
      }, t.label))) : null);
    };
    const ForceItem = (props) => {
      const { entry, index } = props;
      const open = forceExpanded.has(index);
      return h("div", {
        key: index,
        style: {
          border: `1px solid ${C.off}`,
          borderRadius: "5px",
          padding: "5px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          background: "rgba(255,255,255,0.03)"
        }
      }, h("div", {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "6px"
        }
      }, h("span", {
        style: {
          flex: 1,
          color: C.water,
          fontSize: "10px",
          letterSpacing: "0.05em"
        }
      }, `FORCE #${index + 1}`), h("span", {
        style: {
          color: C.dim,
          fontSize: "10px"
        }
      }, `rate ${entry.rateFn} \xB7 ${entry.directions.join(",")}`), h("button", {
        style: btnStyle(open),
        onClick: () => {
          if (open) forceExpanded.delete(index);
          else forceExpanded.add(index);
          redraw();
        }
      }, open ? "\u25B2" : "\u25BC"), h("button", {
        style: {
          ...btnStyle(),
          color: "#ff8a80"
        },
        onClick: () => {
          forceConfig.columnForce.splice(index, 1);
          redraw();
        }
      }, "\u2715")), open ? h("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "5px"
        }
      }, h(NumField, {
        label: "Rate (push<0 \xB7 attract>0)",
        value: entry.rateFn,
        step: 10,
        min: -100,
        max: 100,
        onChange: (v) => {
          entry.rateFn = v;
          redraw();
        }
      }), h(NumField, {
        label: "Range N",
        value: entry.rangeNFn,
        step: 1,
        min: 0,
        max: 64,
        onChange: (v) => {
          entry.rangeNFn = v;
          redraw();
        }
      }), h(NumField, {
        label: "Max K (steps)",
        value: entry.maxKFn,
        step: 1,
        min: 0,
        max: 64,
        onChange: (v) => {
          entry.maxKFn = v;
          redraw();
        }
      }), h(DirectionRow, {
        entry
      }), h(TypeToolbox, {
        entry,
        index,
        field: "matchTypes",
        label: "Match types"
      }), h(TypeToolbox, {
        entry,
        index,
        field: "freeTypes",
        label: "Free types"
      }), h(TypeToolbox, {
        entry,
        index,
        field: "excludeTypes",
        label: "Exclude types"
      })) : null);
    };
    const ForceEditor = () => {
      const add = () => {
        forceConfig.columnForce.push(JSON.parse(JSON.stringify(DEFAULT_FORCE_CONFIG.columnForce[0])));
        redraw();
      };
      return h("div", {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "5px"
        }
      }, h("div", {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "6px"
        }
      }, h("span", {
        style: {
          color: C.water,
          fontSize: "10px",
          textTransform: "uppercase",
          letterSpacing: "0.08em"
        }
      }, "\u25B8 Column forces"), h("button", {
        style: btnStyle(),
        onClick: add
      }, "+ add")), ...forceConfig.columnForce.map((entry, index) => h(ForceItem, {
        key: index,
        entry,
        index
      })), forceConfig.columnForce.length === 0 ? h("div", {
        style: {
          color: C.dim,
          fontSize: "10px"
        }
      }, "No forces. Add one.") : null);
    };
    const sectionBlock = (section) => {
      const meta = SECTION_META[section];
      const fields = fieldsIn(section);
      const bools = fields.filter((f) => f.kind === "bool");
      const nums = fields.filter((f) => f.kind === "number" && visible(f));
      return h("div", {
        key: section,
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "5px"
        }
      }, h("div", {
        style: {
          color: meta.color,
          fontSize: "10px",
          textTransform: "uppercase",
          letterSpacing: "0.08em"
        }
      }, `\u25B8 ${meta.title}`), ...bools.map((f) => h(Toggle, {
        key: f.key,
        field: f
      })), ...nums.map((f) => h(Stepper, {
        key: f.key,
        field: f
      })));
    };
    const moveBlock = () => {
      const meta = SECTION_META.move;
      const bools = fieldsIn("move").filter((f) => f.kind === "bool");
      const nums = fieldsIn("move").filter((f) => f.kind === "number" && visible(f));
      return h("div", {
        key: "move",
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "5px"
        }
      }, h("div", {
        style: {
          color: meta.color,
          fontSize: "10px",
          textTransform: "uppercase",
          letterSpacing: "0.08em"
        }
      }, `\u25B8 ${meta.title}`), ...bools.map((f) => h(Toggle, {
        key: f.key,
        field: f
      })), ...nums.map((f) => h(Stepper, {
        key: f.key,
        field: f
      })), !!state.stepForceMove ? h(ForceEditor, {
        key: "forceEditor"
      }) : null);
    };
    return h("div", {
      style: {
        position: "fixed",
        top: "12px",
        left: "12px",
        zIndex: 2147483646,
        width: "310px",
        maxHeight: "calc(100vh - 24px)",
        overflowY: "auto",
        background: C.bg,
        border: `1px solid ${C.border}`,
        borderRadius: "8px",
        color: C.text,
        font: "11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace",
        pointerEvents: "auto",
        userSelect: "none",
        boxShadow: "0 8px 28px rgba(0,0,0,0.55)"
      },
      onMouseDown: (e) => e.stopPropagation(),
      onMouseUp: (e) => e.stopPropagation(),
      onClick: (e) => e.stopPropagation(),
      onWheel: (e) => e.stopPropagation()
    }, h("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 10px",
        borderBottom: `1px solid ${C.border}`,
        color: C.accent,
        letterSpacing: "0.08em",
        position: "sticky",
        top: 0,
        background: C.bg,
        zIndex: 1
      }
    }, h("span", null, "ASTRO SEEDS"), h("button", {
      style: {
        background: "none",
        border: "none",
        color: C.dim,
        cursor: "pointer",
        font: "inherit"
      },
      onClick: () => {
        panelOpen = false;
        redraw();
      }
    }, "\xD7")), h("div", {
      style: {
        padding: "9px 10px",
        display: "flex",
        flexDirection: "column",
        gap: "10px"
      }
    }, sectionBlock("master"), moveBlock(), sectionBlock("grow"), sectionBlock("crystal"), h("div", {
      style: {
        color: C.dim,
        fontSize: "10px"
      }
    }, `v${VERSION} \xB7 Alt+A panel \xB7 \u2212\u2212 \u2212 + ++`)));
  }
  const dispose = safe(() => api.ui.inject?.("astro-seeds-panel", AstroPanel));
  if (!dispose) console.warn(`[${MOD_ID}] api.ui.inject failed`);
  safe(() => globalThis.addEventListener?.("keydown", (event) => {
    const e = event;
    if (!isModEnabled() || !e.altKey || e.code !== "KeyA") return;
    panelOpen = !panelOpen;
    pushBuffer();
    toast(panelOpen ? "Astro panel open" : "Astro panel closed");
    e.preventDefault();
    e.stopPropagation();
  }, true));
}

// src/shared/elementConfig.ts
function safe2(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
var MatterType = safe2(() => sandkit.enums?.MatterType) || {};
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

// src/main/i18n.ts
var api2 = sandkit.api;
var registerI18n = () => {
  api2.i18n.register("en", {
    [`${MOD_ID}.tech.name`]: "Astro Seeds",
    [`${MOD_ID}.tech.description`]: "Seed\u2013crystal profiles over liquids."
  });
  for (const [_, conf] of Object.entries(elementConfig)) {
    api2.i18n.register("en", {
      [`${conf.id}|name`]: conf.name,
      [`${conf.id}|description`]: conf.description
    });
  }
};

// src/main/elementResolve.ts
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
var ElementType = {
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
  astroVoidSeed: 0,
  astroSeed: 0,
  astroGoldCrystal: 0,
  astroGoldPowder: 0,
  astroCopperCrystal: 0,
  astroCopperPowder: 0,
  astroWaterCrystal: 0,
  astroWaterPowder: 0
};

// src/shared/utils.ts
function safe3(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

// src/main/register.ts
var api3 = sandkit.api;
var registerElement = () => {
  for (const [key, conf] of Object.entries(elementConfig)) {
    const elementTypeId = api3.elements.register({
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
    console.log("Register", conf, elementTypeId);
    ElementType[key] = elementTypeId;
    api3.discoveries.addElementByType(elementTypeId);
  }
  api3.reactions.registerContact({
    inputA: ElementType.seedBase,
    inputB: ElementType.voidPetal,
    outputA: ElementType.astroVoidSeed,
    outputB: null
  });
  api3.reactions.registerContact({
    inputA: ElementType.astroVoidSeed,
    inputB: ElementType.florinol,
    outputA: ElementType.astroSeed,
    outputB: null
  });
  api3.reactions.registerContact({
    inputA: ElementType.astroGoldCrystal,
    inputB: ElementType.fire,
    outputA: ElementType.astroGoldPowder,
    outputB: ElementType.fire
  });
  api3.reactions.registerContact({
    inputA: ElementType.astroCopperCrystal,
    inputB: ElementType.fire,
    outputA: ElementType.astroCopperPowder,
    outputB: ElementType.fire
  });
  api3.reactions.registerContact({
    inputA: ElementType.astroWaterCrystal,
    inputB: ElementType.fire,
    outputA: ElementType.astroWaterPowder,
    outputB: ElementType.fire
  });
};
try {
  const parent = safe3(() => sandkit.enums?.Tech?.SteamTurbine) || safe3(() => sandkit.enums?.Tech?.KineticPress) || null;
  if (parent != null) {
    api3.tech.registerNode(`${MOD_ID}:astro-seeds`, {
      nameKey: `${MOD_ID}.tech.name`,
      descriptionKey: `${MOD_ID}.tech.description`,
      cost: 4500
    }, {
      parentId: parent
    });
  }
} catch {
}

// src/main/main.ts
try {
  const api4 = sandkit.api;
  registerI18n();
  registerElement();
  mountPanel();
  pushBuffer();
  safe3(() => api4.events.on("game:ready", () => {
    api4.ui.toast(`Astro Seeds v${VERSION} \u2014 Alt+A panel`, {});
  }));
  console.log(`[${MOD_ID} v${VERSION}] main loaded `);
} catch (e) {
  console.log(e);
}
