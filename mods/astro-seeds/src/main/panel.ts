/**
 * In-game Astro Seeds config panel.
 * Renders from CONFIG_FIELDS; writes shared buffer on every change.
 */
import {
  BUF_LENGTH,
  clampField,
  CONFIG_FIELDS,
  type ConfigField,
  createDefaultState,
  DEFAULT_FORCE_CONFIG,
  FORCE_DIRECTIONS,
  JSON_BUF_LENGTH,
  JSON_COUNTER_INDEX,
} from "../shared/configSchema.ts";
import { ColumnForceEntry, DirectionName, ForceConfig } from "../worker/definition/types.ts";
import { TElementType } from "../shared/elementTypes.ts";
import { MOD_ID, VERSION } from "../shared/ids.ts";

type ReactLike = {
  createElement: (...args: unknown[]) => unknown;
  useState: <T>(v: T) => [T, (u: T | ((p: T) => T)) => void];
  useEffect: (fn: () => void | (() => void), deps?: unknown[]) => void;
};

const api = sandkit.api;
const React = (sandkit as { react?: ReactLike }).react;
const h = React?.createElement.bind(React);

function safe<T>(fn: () => T, fallback: T | null = null): T | null {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function toast(msg: string): void {
  safe(() => api.ui.toast(msg));
}

function isModEnabled(): boolean {
  const v = safe(() => api.settings.get("enabled"));
  return typeof v === "boolean" ? v : true;
}

const state = createDefaultState();
let panelOpen = true;

const buf = api.shared.buffers.ensure("astroConfig", {
  type: "uint16",
  length: BUF_LENGTH,
});

// uint8 buffer carrying the JSON string of the ForceConfig built by the panel.
// Created lazily (and guarded) so a buffer-registration failure can never stop
// the mod from loading — the real game's buffers.create throws on mismatch.
let jsonBuf: Uint8Array | null = null;
function ensureJsonBuf(): Uint8Array | null {
  if (jsonBuf) return jsonBuf;
  try {
    jsonBuf = api.shared.buffers.ensure("astroJson", {
      type: "uint8",
      length: JSON_BUF_LENGTH,
    }) as unknown as Uint8Array;
  } catch (e) {
    console.warn(`[${MOD_ID}] astroJson buffer unavailable:`, e);
    jsonBuf = null;
  }
  return jsonBuf;
}

// Force config edited in the panel. Serialized to a JSON string in jsonBuf.
const forceConfig: ForceConfig = JSON.parse(
  JSON.stringify(DEFAULT_FORCE_CONFIG),
);
// UI state for the force editor.
const forceExpanded = new Set<number>();
const forceToolbox = new Set<string>(); // e.g. "3:matchTypes", "0:excludeTypes"
// Bumped on every JSON write so the worker knows to re-parse.
let jsonCounter = 0;

// Toolbox options for match/free/exclude type lists (creative-mode style).
const FORCE_TYPE_CANDIDATES: readonly { id: string; label: string }[] = [
  { id: "water", label: "Water" },
  { id: "liquidGold", label: "Gold liq." },
  { id: "liquidCopper", label: "Copper liq." },
  { id: `${MOD_ID}:astro-seed`, label: "Seed" },
  { id: `${MOD_ID}:astro-gold-crystal`, label: "Cry. Gold" },
  { id: `${MOD_ID}:astro-copper-crystal`, label: "Cry. Copper" },
  { id: `${MOD_ID}:astro-water-crystal`, label: "Cry. Water" },
  { id: `${MOD_ID}:astro-gold`, label: "Astro Gold" },
  { id: `${MOD_ID}:astro-copper`, label: "Astro Copper" },
  { id: `${MOD_ID}:astro-water`, label: "Astro Water" },
];

// Lazily-resolved toolbox options — resolved on first render (after element
// registration), and only elements present in the current game appear.
let resolvedForceTypes: { type: TElementType; label: string }[] | null = null;
function forceTypes(): { type: TElementType; label: string }[] {
  if (resolvedForceTypes) return resolvedForceTypes;
  const out: { type: TElementType; label: string }[] = [];
  for (const c of FORCE_TYPE_CANDIDATES) {
    const t = safe(() => api.elements.getTypeFromId(c.id));
    if (t == null) continue;
    const name = safe(() => api.elements.getNameByType?.(t!)) ?? c.label;
    out.push({ type: t, label: name || c.label });
  }
  resolvedForceTypes = out;
  return out;
}

function writeForceJson(): void {
  // Always bump the change counter so the worker re-reads / falls back even if
  // the buffer could not be created this time.
  const bytes = new TextEncoder().encode(JSON.stringify(forceConfig));
  const target = ensureJsonBuf();
  if (target) {
    if (bytes.length > JSON_BUF_LENGTH) {
      toast("Force config too big — buffer truncated");
    }
    target.fill(0);
    target.set(bytes.subarray(0, JSON_BUF_LENGTH));
  }
  jsonCounter = (jsonCounter + 1) & 0xffff;
  if (buf) buf[JSON_COUNTER_INDEX] = jsonCounter;
}

export function pushBuffer(): void {
  if (!buf) return;
  for (const f of CONFIG_FIELDS) {
    const raw = state[f.key];
    if (f.kind === "bool") {
      buf[f.index] = raw ? 1 : 0;
    } else {
      buf[f.index] = clampField(f, Number(raw) || 0);
    }
  }
  // modinfo "enabled" can force master off
  if (!isModEnabled()) buf[0] = 0;
  // Keep the JSON buffer + change counter in sync from the single choke point.
  writeForceJson();
}

pushBuffer();
safe(() => api.settings.onChange(() => pushBuffer()));

const C = {
  bg: "rgba(8,12,20,0.95)",
  border: "rgba(140,200,255,0.28)",
  text: "#d0e8ff",
  dim: "#7a9ab8",
  accent: "#7ec8ff",
  gold: "#e0b0ff",
  copper: "#e09860",
  water: "#6ab0e0",
  off: "rgba(255,255,255,0.07)",
};

const SECTION_META: Record<
  string,
  { title: string; color: string }
> = {
  master: { title: "FEATURES", color: C.accent },
  move: { title: "MOVE", color: C.water },
  grow: { title: "GROW", color: C.gold },
  crystal: { title: "CRYSTALLIZE", color: C.copper },
};

function toggleStyle(on: boolean): Record<string, unknown> {
  return {
    flex: 1,
    padding: "5px 8px",
    background: on ? "rgba(126,200,255,0.2)" : C.off,
    border: `1px solid ${on ? C.accent : "transparent"}`,
    borderRadius: "4px",
    color: on ? C.accent : C.text,
    cursor: "pointer",
    font: "inherit",
    textAlign: "left",
  };
}

function btnStyle(active = false): Record<string, unknown> {
  return {
    padding: "4px 6px",
    minWidth: "28px",
    background: active ? "rgba(126,200,255,0.22)" : C.off,
    border: `1px solid ${active ? C.accent : "transparent"}`,
    borderRadius: "4px",
    color: active ? C.accent : C.text,
    cursor: "pointer",
    font: "inherit",
    textAlign: "center",
  };
}

function inGame(): boolean {
  const active = safe(() => (api as { scene?: { getActive(): number } }).scene?.getActive());
  if (active === undefined || active === null) return true;
  const Scene = safe(() => sandkit.enums?.Scene as Record<string, number>) ||
    {};
  const menus = [Scene.MainMenu, Scene.Intro].filter((v) => typeof v === "number");
  if (menus.length > 0) return !menus.includes(active as number);
  return active !== 1 && active !== 2;
}

function fieldsIn(section: string): ConfigField[] {
  return CONFIG_FIELDS.filter((f) => f.section === section);
}

function visible(f: ConfigField): boolean {
  if (!f.when) return true;
  return !!state[f.when];
}

export function mountPanel(): void {
  if (!React || !h) {
    console.warn(`[${MOD_ID}] sandkit.react missing — panel skipped`);
    return;
  }

  function AstroPanel() {
    const [, bump] = React!.useState(0);
    const redraw = () => {
      pushBuffer();
      bump((v) => v + 1);
    };

    React!.useEffect(() => {
      const id = setInterval(() => bump((v) => v + 1), 500);
      return () => clearInterval(id);
    }, []);

    if (!isModEnabled() || !inGame() || !panelOpen) return null;

    const Toggle = (props: { field: ConfigField }) => {
      const on = !!state[props.field.key];
      return h(
        "button",
        {
          style: toggleStyle(on),
          onClick: () => {
            state[props.field.key] = !on;
            redraw();
          },
        },
        `${on ? "◉" : "○"} ${props.field.label}`,
      );
    };

    const Stepper = (props: { field: ConfigField }) => {
      const f = props.field;
      const value = Number(state[f.key]) || 0;
      const apply = (delta: number) => {
        state[f.key] = clampField(f, value + delta);
        redraw();
      };
      return h(
        "div",
        {
          style: {
            display: "flex",
            gap: "4px",
            alignItems: "center",
          },
        },
        h(
          "span",
          { style: { flex: 1.2, color: C.dim, fontSize: "10px" } },
          f.label,
        ),
        h("button", { style: btnStyle(), onClick: () => apply(-10) }, "−−"),
        h("button", { style: btnStyle(), onClick: () => apply(-1) }, "−"),
        h(
          "div",
          {
            style: {
              ...btnStyle(),
              cursor: "default",
              minWidth: "36px",
            },
          },
          String(value),
        ),
        h("button", { style: btnStyle(), onClick: () => apply(1) }, "+"),
        h("button", { style: btnStyle(), onClick: () => apply(10) }, "++"),
      );
    };

    const chip = (active: boolean, small = false): Record<string, unknown> => ({
      padding: small ? "2px 5px" : "3px 7px",
      background: active ? "rgba(126,200,255,0.22)" : C.off,
      border: `1px solid ${active ? C.accent : "transparent"}`,
      borderRadius: "4px",
      color: active ? C.accent : C.dim,
      cursor: "pointer",
      font: "inherit",
      textAlign: "center",
    });

    // Numeric stepper in the compact (− value +) style used across the panel.
    const NumField = (props: {
      label: string;
      value: number;
      step: number;
      min?: number;
      max?: number;
      onChange: (v: number) => void;
    }) => {
      const clamp = (v: number) => {
        const lo = props.min ?? -1000;
        const hi = props.max ?? 1000;
        return Math.max(lo, Math.min(hi, Math.round(v)));
      };
      return h(
        "div",
        { style: { display: "flex", gap: "4px", alignItems: "center" } },
        h(
          "span",
          { style: { flex: 1, color: C.dim, fontSize: "10px" } },
          props.label,
        ),
        h("button", {
          style: btnStyle(),
          onClick: () => props.onChange(clamp(props.value - props.step)),
        }, "−"),
        h("div", {
          style: { ...btnStyle(), cursor: "default", minWidth: "34px" },
        }, String(props.value)),
        h("button", {
          style: btnStyle(),
          onClick: () => props.onChange(clamp(props.value + props.step)),
        }, "+"),
      );
    };

    // Direction toggle row for one force entry.
    const DirectionRow = (props: { entry: ColumnForceEntry }) => {
      const toggleDir = (d: string) => {
        const dirs = props.entry.directions;
        props.entry.directions = dirs.includes(d as DirectionName)
          ? dirs.filter((x) => x !== d)
          : [...dirs, d as DirectionName];
        redraw();
      };
      return h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "3px" } },
        h("span", { style: { color: C.dim, fontSize: "10px" } }, "Directions"),
        h(
          "div",
          { style: { display: "flex", flexWrap: "wrap", gap: "3px" } },
          ...FORCE_DIRECTIONS.map((d) =>
            h(
              "button",
              {
                key: d,
                style: chip(
                  (props.entry.directions as string[]).includes(d),
                  true,
                ),
                onClick: () => toggleDir(d),
              },
              d,
            )
          ),
        ),
      );
    };

    // Collapsible toolbox (creative-mode style) editing an entry type list.
    const TypeToolbox = (props: {
      entry: ColumnForceEntry;
      index: number;
      field: keyof Pick<
        ColumnForceEntry,
        "matchTypes" | "freeTypes" | "excludeTypes"
      >;
      label: string;
    }) => {
      const key = `${props.index}:${props.field}`;
      const list = props.entry[props.field] as TElementType[];
      const open = forceToolbox.has(key);
      const toggle = (t: TElementType) => {
        const arr = props.entry[props.field] as TElementType[];
        if (arr.includes(t)) {
          props.entry[props.field] = arr.filter((x) => x !== t) as never;
        } else {
          props.entry[props.field] = [...arr, t] as never;
        }
        redraw();
      };
      return h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "3px" } },
        h(
          "button",
          {
            style: {
              ...chip(open, true),
              display: "flex",
              alignItems: "center",
              gap: "4px",
            },
            onClick: () => {
              if (open) forceToolbox.delete(key);
              else forceToolbox.add(key);
              redraw();
            },
          },
          `${open ? "▾" : "▸"} ${props.label} (${list.length})`,
        ),
        open
          ? h(
            "div",
            { style: { display: "flex", flexWrap: "wrap", gap: "3px" } },
            ...forceTypes().map((t) =>
              h(
                "button",
                {
                  key: t.type,
                  style: chip(list.includes(t.type), true),
                  onClick: () => toggle(t.type),
                },
                t.label,
              )
            ),
          )
          : null,
      );
    };
    // One expandable columnForce entry (open/close, editable, removable).
    const ForceItem = (props: { entry: ColumnForceEntry; index: number }) => {
      const { entry, index } = props;
      const open = forceExpanded.has(index);
      return h(
        "div",
        {
          key: index,
          style: {
            border: `1px solid ${C.off}`,
            borderRadius: "5px",
            padding: "5px",
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            background: "rgba(255,255,255,0.03)",
          },
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "6px" } },
          h("span", {
            style: {
              flex: 1,
              color: C.water,
              fontSize: "10px",
              letterSpacing: "0.05em",
            },
          }, `FORCE #${index + 1}`),
          h(
            "span",
            { style: { color: C.dim, fontSize: "10px" } },
            `rate ${entry.rateFn} · ${entry.directions.join(",")}`,
          ),
          h(
            "button",
            {
              style: btnStyle(open),
              onClick: () => {
                if (open) forceExpanded.delete(index);
                else forceExpanded.add(index);
                redraw();
              },
            },
            open ? "▲" : "▼",
          ),
          h(
            "button",
            {
              style: { ...btnStyle(), color: "#ff8a80" },
              onClick: () => {
                forceConfig.columnForce.splice(index, 1);
                redraw();
              },
            },
            "✕",
          ),
        ),
        open
          ? h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "5px" } },
            h(NumField, {
              label: "Rate (push<0 · attract>0)",
              value: entry.rateFn,
              step: 10,
              min: -100,
              max: 100,
              onChange: (v: number) => {
                entry.rateFn = v;
                redraw();
              },
            }),
            h(NumField, {
              label: "Range N",
              value: entry.rangeNFn,
              step: 1,
              min: 0,
              max: 64,
              onChange: (v: number) => {
                entry.rangeNFn = v;
                redraw();
              },
            }),
            h(NumField, {
              label: "Max K (steps)",
              value: entry.maxKFn,
              step: 1,
              min: 0,
              max: 64,
              onChange: (v: number) => {
                entry.maxKFn = v;
                redraw();
              },
            }),
            h(DirectionRow, { entry }),
            h(TypeToolbox, {
              entry,
              index,
              field: "matchTypes",
              label: "Match types",
            }),
            h(TypeToolbox, {
              entry,
              index,
              field: "freeTypes",
              label: "Free types",
            }),
            h(TypeToolbox, {
              entry,
              index,
              field: "excludeTypes",
              label: "Exclude types",
            }),
          )
          : null,
      );
    };

    // "Column forces" block: add button + list of editable entries.
    const ForceEditor = () => {
      const add = () => {
        forceConfig.columnForce.push(
          JSON.parse(JSON.stringify(DEFAULT_FORCE_CONFIG.columnForce[0])),
        );
        redraw();
      };
      return h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "5px" } },
        h(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "6px",
            },
          },
          h("span", {
            style: {
              color: C.water,
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            },
          }, "▸ Column forces"),
          h("button", { style: btnStyle(), onClick: add }, "+ add"),
        ),
        ...forceConfig.columnForce.map((entry, index) =>
          h(ForceItem, { key: index, entry, index })
        ),
        forceConfig.columnForce.length === 0
          ? h(
            "div",
            { style: { color: C.dim, fontSize: "10px" } },
            "No forces. Add one.",
          )
          : null,
      );
    };

    const sectionBlock = (section: string) => {
      const meta = SECTION_META[section];
      const fields = fieldsIn(section);
      const bools = fields.filter((f) => f.kind === "bool");
      const nums = fields.filter((f) => f.kind === "number" && visible(f));

      return h(
        "div",
        {
          key: section,
          style: { display: "flex", flexDirection: "column", gap: "5px" },
        },
        h(
          "div",
          {
            style: {
              color: meta.color,
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            },
          },
          `▸ ${meta.title}`,
        ),
        ...bools.map((f) => h(Toggle, { key: f.key, field: f })),
        ...nums.map((f) => h(Stepper, { key: f.key, field: f })),
      );
    };

    // Move section: toggles + steppers, then the force editor when enabled.
    const moveBlock = () => {
      const meta = SECTION_META.move;
      const bools = fieldsIn("move").filter((f) => f.kind === "bool");
      const nums = fieldsIn("move").filter((f) => f.kind === "number" && visible(f));
      return h(
        "div",
        {
          key: "move",
          style: { display: "flex", flexDirection: "column", gap: "5px" },
        },
        h(
          "div",
          {
            style: {
              color: meta.color,
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            },
          },
          `▸ ${meta.title}`,
        ),
        ...bools.map((f) => h(Toggle, { key: f.key, field: f })),
        ...nums.map((f) => h(Stepper, { key: f.key, field: f })),
        !!state.stepForceMove ? h(ForceEditor, { key: "forceEditor" }) : null,
      );
    };

    return h(
      "div",
      {
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
          boxShadow: "0 8px 28px rgba(0,0,0,0.55)",
        },
        onMouseDown: (e: Event) => e.stopPropagation(),
        onMouseUp: (e: Event) => e.stopPropagation(),
        onClick: (e: Event) => e.stopPropagation(),
        onWheel: (e: Event) => e.stopPropagation(),
      },
      h(
        "div",
        {
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
            zIndex: 1,
          },
        },
        h("span", null, "ASTRO SEEDS"),
        h(
          "button",
          {
            style: {
              background: "none",
              border: "none",
              color: C.dim,
              cursor: "pointer",
              font: "inherit",
            },
            onClick: () => {
              panelOpen = false;
              redraw();
            },
          },
          "×",
        ),
      ),
      h(
        "div",
        {
          style: {
            padding: "9px 10px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          },
        },
        // Top: feature on/off only (master bools)
        sectionBlock("master"),
        moveBlock(),
        sectionBlock("grow"),
        sectionBlock("crystal"),
        h(
          "div",
          { style: { color: C.dim, fontSize: "10px" } },
          `v${VERSION} · Alt+A panel · −− − + ++`,
        ),
      ),
    );
  }

  const dispose = safe(() =>
    (api.ui as { inject?: (id: string, c: unknown) => unknown }).inject?.(
      "astro-seeds-panel",
      AstroPanel,
    )
  );
  if (!dispose) console.warn(`[${MOD_ID}] api.ui.inject failed`);

  safe(() =>
    globalThis.addEventListener?.(
      "keydown",
      (event: Event) => {
        const e = event as KeyboardEvent;
        if (!isModEnabled() || !e.altKey || e.code !== "KeyA") return;
        panelOpen = !panelOpen;
        pushBuffer();
        toast(panelOpen ? "Astro panel open" : "Astro panel closed");
        e.preventDefault();
        e.stopPropagation();
      },
      true,
    )
  );
}
