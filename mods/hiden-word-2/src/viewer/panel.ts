/**
 * Map Viewer panel — Map stages + ordered Modifiers (drag to reorder).
 */
import { DEFAULT_PARAMS, TERRAIN, VIEWER_ITEM_ID } from "../constants.ts";
import { api } from "../api.ts";
import { persistRecord, randomSeed } from "../persistence.ts";
import { ghostPalette, refreshHiddenWorld } from "../render.ts";
import { runtime } from "../state.ts";
import type {
  BandParams,
  FormModifier,
  GenerationParams,
  LiquidModifier,
  Modifier,
  SealParams,
  WallModifier,
} from "../types.ts";
import {
  boundsEditor,
  checkRow,
  groupLabel,
  h,
  nearMaskEditor,
  numberRow,
  section,
  terrainMulti,
  terrainSelect,
  textRow,
} from "./controls.ts";
import {
  bindMapInteractions,
  fitCanvasToViewport,
  getPreviewDivisor,
  paintIfVisible,
  paintPreviewCanvas,
  resetView,
  setFocusedModId,
  focusedModId,
  view,
} from "./preview.ts";

declare const sandkit: { react: any };
const react = sandkit.react;

type Draft = GenerationParams & { seed: string };

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

function currentDraft(): Draft {
  return { ...clone(runtime.params), seed: runtime.seed };
}
function defaultDraft(): Draft {
  return { ...clone(DEFAULT_PARAMS), seed: runtime.seed };
}

export function isViewerSelected(): boolean {
  try {
    if (typeof api.items.isActiveById === "function") {
      return api.items.isActiveById(VIEWER_ITEM_ID) === true;
    }
  } catch { /* */ }
  try {
    return api.items.getActive?.()?.id === VIEWER_ITEM_ID;
  } catch {
    return false;
  }
}

let panelDismissed = false;

function toast(text: string): void {
  try { api.ui.toast(text, {}); } catch { /* */ }
}

function tryDeselect(): void {
  try {
    const items = api.items as Record<string, unknown>;
    if (typeof items.clearActive === "function") (items.clearActive as () => void)();
    else if (typeof items.setActive === "function") (items.setActive as (x: null) => void)(null);
  } catch { /* */ }
}

function closePanel(): void {
  panelDismissed = true;
  tryDeselect();
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function blankWall(): WallModifier {
  return {
    id: uid("wall"),
    kind: "wall",
    enabled: true,
    name: "New Wall",
    inBorderOf: [TERRAIN.ROCK],
    typeToReplace: [TERRAIN.TUNNEL],
    replaceBy: TERRAIN.MOSS,
    nearMask: [1, 0, 0, 0],
    bounds: { top: 10, bottom: 40, left: 0, right: 100 },
    growSize: 3,
  };
}
function blankForm(): FormModifier {
  return {
    id: uid("form"),
    kind: "form",
    enabled: true,
    name: "New Form",
    inBorderOf: [TERRAIN.CAVE],
    replaceBy: TERRAIN.SPORE_SOIL,
    bounds: { top: 30, bottom: 70, left: 0, right: 100 },
    growSize: 5,
    scatterPercent: 35,
  };
}
function blankLiquid(): LiquidModifier {
  return {
    id: uid("liq"),
    kind: "liquid",
    enabled: true,
    name: "New Liquid",
    liquidType: "water",
    minDepth: 4,
    bounds: { top: 20, bottom: 80, left: 0, right: 100 },
  };
}

function modEditor(
  mod: Modifier,
  update: (patch: Partial<Modifier>) => void,
  remove: () => void,
  onFocus: () => void,
): unknown {
  let body: unknown[] = [];
  if (mod.kind === "wall") {
    const w = mod as WallModifier;
    body = [
      terrainMulti("InBorderOf", w.inBorderOf, (ids) => update({ inBorderOf: ids } as Partial<WallModifier>)),
      terrainMulti("TypeToReplace", w.typeToReplace, (ids) => update({ typeToReplace: ids } as Partial<WallModifier>)),
      terrainSelect("ReplaceBy", w.replaceBy, (id) => update({ replaceBy: id } as Partial<WallModifier>)),
      nearMaskEditor(w.nearMask, (m) => update({ nearMask: m } as Partial<WallModifier>)),
      boundsEditor(w.bounds, (b) => {
        update({ bounds: b } as Partial<WallModifier>);
        onFocus();
      }),
      numberRow("Grow size", w.growSize, (v) => update({ growSize: v } as Partial<WallModifier>)),
    ];
  } else if (mod.kind === "form") {
    const f = mod as FormModifier;
    body = [
      terrainMulti("InBorderOf", f.inBorderOf, (ids) => update({ inBorderOf: ids } as Partial<FormModifier>)),
      terrainSelect("ReplaceBy", f.replaceBy, (id) => update({ replaceBy: id } as Partial<FormModifier>)),
      boundsEditor(f.bounds, (b) => {
        update({ bounds: b } as Partial<FormModifier>);
        onFocus();
      }),
      numberRow("Grow size", f.growSize, (v) => update({ growSize: v } as Partial<FormModifier>)),
      numberRow("Scatter %", f.scatterPercent, (v) => update({ scatterPercent: v } as Partial<FormModifier>)),
    ];
  } else {
    const l = mod as LiquidModifier;
    body = [
      h(
        "div",
        { className: "hwv-row" },
        h("label", null, "Liquid type"),
        h(
          "select",
          {
            value: l.liquidType,
            onChange: (e: { target: { value: string } }) =>
              update({ liquidType: e.target.value as LiquidModifier["liquidType"] } as Partial<LiquidModifier>),
          },
          h("option", { value: "water" }, "water"),
          h("option", { value: "lava" }, "lava"),
          h("option", { value: "surface" }, "surface"),
        ),
      ),
      numberRow("Min depth", l.minDepth, (v) => update({ minDepth: v } as Partial<LiquidModifier>)),
      boundsEditor(l.bounds, (b) => {
        update({ bounds: b } as Partial<LiquidModifier>);
        onFocus();
      }),
    ];
  }

  // Delete at bottom of expanded content
  body.push(
    h(
      "button",
      {
        className: "hwv-btn hwv-mod-del",
        type: "button",
        onClick: (e: { stopPropagation?: () => void }) => {
          e.stopPropagation?.();
          remove();
        },
      },
      "Delete modifier",
    ),
  );

  return h(
    "details",
    {
      className: focusedModId === mod.id ? "hwv-mod hwv-focus" : "hwv-mod",
      draggable: true,
      "data-mod-id": mod.id,
      onToggle: (e: { target: { open?: boolean } }) => {
        if (e.target?.open) onFocus();
      },
    },
    h(
      "summary",
      {
        onClick: onFocus,
      },
      h("input", {
        type: "checkbox",
        checked: mod.enabled,
        onChange: (e: { target: { checked: boolean } }) => update({ enabled: !!e.target.checked }),
        onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
      }),
      h("span", { className: `hwv-mod-kind hwv-mod-kind-${mod.kind}` }, mod.kind),
      h("input", {
        type: "text",
        className: "hwv-mod-name",
        value: mod.name,
        onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
        onChange: (e: { target: { value: string } }) => update({ name: e.target.value }),
      }),
    ),
    h("div", { className: "hwv-mod-body" }, ...body),
  );
}

export function MapViewerPanel(): unknown {
  const [draft, setDraft] = react.useState(currentDraft) as [Draft, (d: Draft) => void];
  const [, bump] = react.useState(0) as [number, (fn: (n: number) => number) => void];
  const dragId = react.useRef(null) as { current: string | null };
  const [ioMode, setIoMode] = react.useState(null) as [
    "save" | "load" | null,
    (m: "save" | "load" | null) => void,
  ];
  const [ioText, setIoText] = react.useState("") as [string, (s: string) => void];

  react.useEffect(() => {
    const unsub = api.events.on("action:changed", () => {
      if (!isViewerSelected()) panelDismissed = false;
      bump((n) => n + 1);
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isViewerSelected() && !panelDismissed) {
        closePanel();
        bump((n) => n + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      try { unsub(); } catch { /* */ }
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  react.useEffect(() => {
    if (!isViewerSelected() || panelDismissed) return;
    requestAnimationFrame(() => paintIfVisible());
  });

  if (!isViewerSelected()) {
    panelDismissed = false;
    return null;
  }
  if (panelDismissed) return null;

  const setMods = (modifiers: Modifier[]) => setDraft({ ...draft, modifiers });
  const patchMod = (id: string, patch: Partial<Modifier>) => {
    setMods(draft.modifiers.map((m) => (m.id === id ? { ...m, ...patch } as Modifier : m)));
  };

  const apply = () => {
    toast("Generating map — please wait…");
    runtime.seed = draft.seed.trim() || runtime.seed;
    runtime.params = clone(draft);
    // Drop seed from params object if present
    const { seed: _s, ...paramsOnly } = draft as Draft & { seed?: string };
    runtime.params = clone(paramsOnly) as GenerationParams;
    const ok = refreshHiddenWorld();
    persistRecord();
    setDraft(currentDraft());
    bump((n) => n + 1);
    requestAnimationFrame(() => paintIfVisible());
    if (!ok) toast("Generation failed");
  };

  const doClose = () => {
    closePanel();
    bump((n) => n + 1);
  };

  const onDragStart = (id: string) => {
    dragId.current = id;
  };
  const onDragOver = (e: { preventDefault: () => void }, overId: string) => {
    e.preventDefault();
    const from = dragId.current;
    if (!from || from === overId) return;
    const list = [...draft.modifiers];
    const fi = list.findIndex((m) => m.id === from);
    const ti = list.findIndex((m) => m.id === overId);
    if (fi < 0 || ti < 0) return;
    const [item] = list.splice(fi, 1);
    list.splice(ti, 0, item!);
    dragId.current = overId;
    setMods(list);
  };

  const entries = ghostPalette();

  const setTunnel = (band: BandParams) => setDraft({ ...draft, tunnel: band });
  const setCave = (band: BandParams) => setDraft({ ...draft, cave: band });
  const setSeal = (seal: SealParams) => setDraft({ ...draft, seal });

  return h(
    "div",
    {
      className: "hwv-root",
      onClick: (e: { target: EventTarget; currentTarget: EventTarget }) => {
        if (e.target === e.currentTarget) doClose();
      },
    },
    h(
      "div",
      { className: "hwv-frame" },
      h(
        "button",
        { className: "hwv-close", title: "Close (Esc)", onClick: doClose },
        "×",
      ),

      h(
        "div",
        { className: "hwv-side" },
        h("h2", null, "HIDEN WORLD 2 — Map Viewer"),
        h(
          "div",
          { className: "hwv-btns", style: { marginTop: 0 } },
          h("button", { className: "hwv-btn hwv-btn-primary", onClick: apply }, "↻ Generate / Refresh"),
          h(
            "button",
            {
              className: "hwv-btn",
              onClick: () => {
                setDraft(defaultDraft());
                toast("Draft reset");
              },
            },
            "Reset",
          ),
          h(
            "button",
            {
              className: "hwv-btn",
              onClick: () => {
                setIoMode("save");
                setIoText(JSON.stringify({ seed: draft.seed, params: {
                  sky: draft.sky,
                  baseHeightPercent: draft.baseHeightPercent,
                  tunnel: draft.tunnel,
                  cave: draft.cave,
                  seal: draft.seal,
                  modifiers: draft.modifiers,
                }}, null, 2));
              },
            },
            "Save",
          ),
          h(
            "button",
            {
              className: "hwv-btn",
              onClick: () => {
                setIoMode("load");
                setIoText("");
              },
            },
            "Load",
          ),
        ),

        section("Seed", null, null, [
          h(
            "div",
            { className: "hwv-row" },
            h("label", null, "Seed"),
            h("input", {
              type: "text",
              value: draft.seed,
              onChange: (e: { target: { value: string } }) =>
                setDraft({ ...draft, seed: e.target.value }),
            }),
            h(
              "button",
              { className: "hwv-btn", onClick: () => setDraft({ ...draft, seed: randomSeed() }) },
              "🎲",
            ),
          ),
        ]),

        checkRow("Exploration mode", !!draft.explorationEnabled, (v) =>
          setDraft({ ...draft, explorationEnabled: v }),
        ),
        h(
          "div",
          { className: "hwv-mini", style: { marginBottom: 8 } },
          "Fog of war: sky starts explored; Explorer reveals fog; Manifest needs explored contact.",
        ),

        groupLabel("Map"),

        section("1 · Skyline", null, null, [
          numberRow("Ground Lvl", draft.baseHeightPercent, (v) =>
            setDraft({ ...draft, baseHeightPercent: v }), 0.5),
          numberRow("Big wave period", draft.sky.bigWave.periodCells, (v) =>
            setDraft({ ...draft, sky: { ...draft.sky, bigWave: { ...draft.sky.bigWave, periodCells: v } } }), 10),
          numberRow("Big wave amp %", draft.sky.bigWave.amplitudePercent, (v) =>
            setDraft({ ...draft, sky: { ...draft.sky, bigWave: { ...draft.sky.bigWave, amplitudePercent: v } } }), 0.5),
          numberRow("Med wave period", draft.sky.mediumWave.periodCells, (v) =>
            setDraft({ ...draft, sky: { ...draft.sky, mediumWave: { ...draft.sky.mediumWave, periodCells: v } } }), 10),
          numberRow("Med wave amp %", draft.sky.mediumWave.amplitudePercent, (v) =>
            setDraft({ ...draft, sky: { ...draft.sky, mediumWave: { ...draft.sky.mediumWave, amplitudePercent: v } } }), 0.5),
          numberRow("Low wave period", draft.sky.lowWave.periodCells, (v) =>
            setDraft({ ...draft, sky: { ...draft.sky, lowWave: { ...draft.sky.lowWave, periodCells: v } } }), 10),
          numberRow("Low wave amp %", draft.sky.lowWave.amplitudePercent, (v) =>
            setDraft({ ...draft, sky: { ...draft.sky, lowWave: { ...draft.sky.lowWave, amplitudePercent: v } } }), 0.5),
          numberRow("Rough period", draft.sky.roughness.periodCells, (v) =>
            setDraft({ ...draft, sky: { ...draft.sky, roughness: { ...draft.sky.roughness, periodCells: v } } }), 10),
          numberRow("Rough amp %", draft.sky.roughness.amplitudePercent, (v) =>
            setDraft({ ...draft, sky: { ...draft.sky, roughness: { ...draft.sky.roughness, amplitudePercent: v } } }), 0.5),
        ]),

        section("2 · Tunnels", draft.tunnel.enabled, (v) => setTunnel({ ...draft.tunnel, enabled: v }), [
          numberRow("Definition %", draft.tunnel.definitionPercent, (v) => setTunnel({ ...draft.tunnel, definitionPercent: v }), 0.5),
          numberRow("Thickness %", draft.tunnel.thicknessPercent, (v) => setTunnel({ ...draft.tunnel, thicknessPercent: v }), 0.5),
          numberRow("Move X", draft.tunnel.offsetX, (v) => setTunnel({ ...draft.tunnel, offsetX: v }), 1),
          numberRow("Move Y", draft.tunnel.offsetY, (v) => setTunnel({ ...draft.tunnel, offsetY: v }), 1),
        ]),

        section("3 · Caves", draft.cave.enabled, (v) => setCave({ ...draft.cave, enabled: v }), [
          numberRow("Definition %", draft.cave.definitionPercent, (v) => setCave({ ...draft.cave, definitionPercent: v }), 0.5),
          numberRow("Thickness %", draft.cave.thicknessPercent, (v) => setCave({ ...draft.cave, thicknessPercent: v }), 0.5),
          numberRow("Move X", draft.cave.offsetX, (v) => setCave({ ...draft.cave, offsetX: v }), 1),
          numberRow("Move Y", draft.cave.offsetY, (v) => setCave({ ...draft.cave, offsetY: v }), 1),
        ]),

        section("4 · Seal", draft.seal.enabled, (v) => setSeal({ ...draft.seal, enabled: v }), [
          checkRow("Seal tunnels", draft.seal.sealTunnels, (v) => setSeal({ ...draft.seal, sealTunnels: v })),
          checkRow("Seal caves", draft.seal.sealCaves, (v) => setSeal({ ...draft.seal, sealCaves: v })),
          numberRow("Max iterations", draft.seal.maxIterations, (v) => setSeal({ ...draft.seal, maxIterations: v })),
        ]),

        groupLabel("Modifiers"),
        h(
          "div",
          { className: "hwv-btns" },
          h("button", { className: "hwv-btn", onClick: () => setMods([...draft.modifiers, blankWall()]) }, "+ Wall"),
          h("button", { className: "hwv-btn", onClick: () => setMods([...draft.modifiers, blankForm()]) }, "+ Form"),
          h("button", { className: "hwv-btn", onClick: () => setMods([...draft.modifiers, blankLiquid()]) }, "+ Liquid"),
        ),
        h(
          "div",
          {
            className: "hwv-mod-list",
            onDragOver: (e: { preventDefault: () => void }) => e.preventDefault(),
          },
          ...draft.modifiers.map((mod) =>
            h(
              "div",
              {
                key: mod.id,
                draggable: true,
                onDragStart: () => onDragStart(mod.id),
                onDragOver: (e: { preventDefault: () => void }) => onDragOver(e, mod.id),
                onDragEnd: () => { dragId.current = null; },
              },
              modEditor(
                mod,
                (patch) => patchMod(mod.id, patch),
                () => setMods(draft.modifiers.filter((m) => m.id !== mod.id)),
                () => {
                  setFocusedModId(mod.id);
                  runtime.params = { ...runtime.params, modifiers: draft.modifiers };
                  paintIfVisible();
                  bump((n) => n + 1);
                },
              ),
            ),
          ),
        ),
      ),

      // map
      h(
        "div",
        { className: "hwv-map" },
        ioMode
          ? h(
            "div",
            { className: "hwv-io" },
            h("div", { className: "hwv-io-title" }, ioMode === "save" ? "Save config (JSON)" : "Load config (JSON)"),
            h("textarea", {
              className: "hwv-io-text",
              value: ioText,
              readOnly: ioMode === "save",
              placeholder: ioMode === "load" ? "Paste JSON here…" : "",
              onChange: (e: { target: { value: string } }) => {
                if (ioMode === "load") setIoText(e.target.value);
              },
            }),
            h(
              "div",
              { className: "hwv-btns" },
              ioMode === "save"
                ? h(
                  "button",
                  {
                    className: "hwv-btn hwv-btn-primary",
                    onClick: async () => {
                      try {
                        await navigator.clipboard.writeText(ioText);
                        toast("Copied to clipboard");
                      } catch {
                        toast("Copy failed — select & copy manually");
                      }
                    },
                  },
                  "Copy",
                )
                : h(
                  "button",
                  {
                    className: "hwv-btn hwv-btn-primary",
                    onClick: () => {
                      try {
                        const parsed = JSON.parse(ioText);
                        const seed = typeof parsed.seed === "string" ? parsed.seed : draft.seed;
                        const params = parsed.params ?? parsed;
                        const next = {
                          ...clone(DEFAULT_PARAMS),
                          ...params,
                          seed,
                        };
                        // normalize via persist path-ish
                        setDraft({
                          seed,
                          sky: params.sky ?? draft.sky,
                          baseHeightPercent: params.baseHeightPercent ?? draft.baseHeightPercent,
                          tunnel: params.tunnel ?? draft.tunnel,
                          cave: params.cave ?? draft.cave,
                          seal: params.seal ?? draft.seal,
                          modifiers: Array.isArray(params.modifiers) ? params.modifiers : draft.modifiers,
                        } as Draft);
                        setIoMode(null);
                        toast("Config loaded — hit Generate to apply");
                      } catch (err) {
                        toast("Invalid JSON");
                        console.warn(err);
                      }
                    },
                  },
                  "Load",
                ),
              h(
                "button",
                { className: "hwv-btn", onClick: () => setIoMode(null) },
                "Close",
              ),
            ),
          )
          : null,
        h(
          "div",
          { className: "hwv-map-title" },
          h("span", null, `${runtime.width}×${runtime.height} · base 1/${getPreviewDivisor()}`),
          h("span", { className: "hwv-zoom-label" }, `zoom ${view.zoom.toFixed(2)}×`),
          h(
            "button",
            {
              className: "hwv-btn",
              onClick: () => {
                resetView();
                const z = document.querySelector(".hwv-zoom-label");
                if (z) z.textContent = "zoom 1.00×";
              },
            },
            "Reset view",
          ),
        ),
        h(
          "div",
          {
            className: "hwv-viewport",
            ref: (el: HTMLElement | null) => {
              if (!el) return;
              bindMapInteractions(el);
              const c = el.querySelector("canvas") as HTMLCanvasElement | null;
              if (c) {
                paintPreviewCanvas(c);
                fitCanvasToViewport(el, c);
              }
            },
          },
          h("canvas", null),
        ),
        h("div", { className: "hwv-hint" }, "Scroll = zoom · drag map = pan · drag modifiers = reorder"),
        h(
          "div",
          { className: "hwv-legend" },
          ...entries.map((e) =>
            h(
              "span",
              { title: e.label },
              h("i", {
                className: "hwv-swatch",
                style: { background: e.alpha < 16 ? "#1a1a22" : e.hex },
              }),
              e.codeLabel,
            ),
          ),
        ),
      ),
    ),
  );
}
