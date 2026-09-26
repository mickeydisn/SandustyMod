/**
 * md-my-hown-mod — grouped, validated configurator panel (v0.2).
 *
 * UX rules:
 *   - 6 top-level menu groups (not 19 flat tabs)
 *   - one screen at a time: list → New/Edit form (no giant always-open form)
 *   - every field is typed and restrictive (enum / range / pattern / required)
 *   - Save is disabled until the form validates; errors show inline
 *   - Edit round-trips the full stored entry (incl. advanced JSON leftovers)
 *
 * Field definitions live in ./schema.ts (single source of truth).
 */
import { LOG, type ModConfig, type PanelState, type StructureConfig } from "../constants.ts";
import {
    addOrUpdateContact,
    addOrUpdateElement,
    addOrUpdateEnergyNetwork,
    addOrUpdateEnergyType,
    addOrUpdateExcavationProfile,
    addOrUpdateInputBinding,
    addOrUpdateInteraction,
    addOrUpdateItem,
    addOrUpdateModifier,
    addOrUpdateProcessing,
    addOrUpdateProjectile,
    addOrUpdateRecipe,
    addOrUpdateSignal,
    addOrUpdateSprite,
    addOrUpdateStructure,
    addOrUpdateStructureBehavior,
    addOrUpdateTech,
    addOrUpdateTerrain,
    addOrUpdateTrigger,
    addOrUpdateUnlockNode,
    addOrUpdateUpgrade,
    addOrUpdateUpgradeCategory,
    exportConfigJson,
    importConfigJson,
    loadConfig,
    loadPanelState,
    removeContact,
    removeElement,
    removeEnergyNetwork,
    removeEnergyType,
    removeExcavationProfile,
    removeInputBinding,
    removeInteraction,
    removeItem,
    removeModifier,
    removeProcessing,
    removeProjectile,
    removeRecipe,
    removeSignal,
    removeSprite,
    removeStructure,
    removeStructureBehavior,
    removeTech,
    removeTerrain,
    removeTrigger,
    removeUnlockNode,
    removeUpgrade,
    removeUpgradeCategory,
    savePanelState,
} from "../config/store.ts";
import {
    applyConfig,
    clearRegistrationCache,
    reapplyFromStorage,
    snapshotRegistered,
    staleAfter,
    updateEntry,
} from "../register/apply.ts";
import { api as skApi } from "../packages/mysandkit.ts";
import { api, React as HostReact } from "../api.ts";
import { isToolSelected } from "../select.ts";
import {
    autoGraphicsKey,
    CATEGORY_META,
    describeShape,
    emptyShape,
    entryToForm,
    type FieldSpec,
    formatIdList,
    formDefaults,
    formToEntry,
    hexListToVariants,
    isActive,
    MENU_GROUPS,
    normalizeShape,
    parseIdList,
    PASSTHROUGH_KEY,
    passthroughKeysOf,
    resolveAutoFill,
    resolveOptions,
    sectionsFor,
    seedVariantFromMapColor,
    shapeToText,
    type Tab,
    validateForm,
    variantsToHexList,
} from "./schema.ts";
import {
    handlerDoc,
    listBuildModeTypes,
    listElements,
    listTerrains,
    type Opt,
    PANEL_NATIVES,
    searchLibraryAssets,
} from "../catalog.ts";
import * as S from "./styles.ts";
import { emptyViewState, type ViewMode } from "./viewstate.ts";
import { clampChip, exceedsSlop } from "./drag.ts";
import {
    type HandlersTabState,
    initialHandlersState,
    renderHandlersTab,
} from "./handlers-panel.ts";
import { renderHelp } from "./help-panel.ts";
import { renderConfigMap } from "./config-map.ts";
import { DEFAULT_UNLOCK_NODE, techUnlockStructureIds, unlockLine } from "./tech-link.ts";
import { renderDraws } from "./draws-panel.ts";

/** Parse JSON text, returning undefined instead of throwing. */
function safeJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

/** External expand request (hotkey). Panel polls via useEffect. */
let expandRequest = 0;
export function forceExpandPanel(): void {
    expandRequest += 1;
    (globalThis as any).__mdMyHownPanelExpand = expandRequest;
    console.log(`${LOG} forceExpandPanel #${expandRequest}`);
}

type Mode = ViewMode;

/** Rough chip size, used only to keep a dragged chip fully on-screen. */
const CHIP_W = 150;
const CHIP_H = 40;

type UpsertFn = (entry: never) => ModConfig;
type RemoveFn = (id: string) => ModConfig;

/**
 * Which screen writes to which store function.
 *
 * Exported so a test can assert that *every* saveable screen has an entry. The
 * bug this guards against is invisible from the type system: `saveForm` returns
 * early when `UPSERT[cat]` is missing, so a screen can list, validate, and
 * swallow a save without a single complaint. Two screens were in that state.
 */
export const UPSERT: Partial<Record<Tab, UpsertFn>> = {
    elements: addOrUpdateElement,
    structures: addOrUpdateStructure,
    items: addOrUpdateItem,
    recipes: addOrUpdateRecipe,
    processing: addOrUpdateProcessing,
    contacts: addOrUpdateContact,
    interactions: addOrUpdateInteraction,
    modifiers: addOrUpdateModifier,
    terrains: addOrUpdateTerrain,
    techs: addOrUpdateTech,
    unlockNodes: addOrUpdateUnlockNode,
    upgrades: addOrUpdateUpgrade,
    projectiles: addOrUpdateProjectile,
    energy: addOrUpdateEnergyType,
    excavation: addOrUpdateExcavationProfile,
    behaviors: addOrUpdateStructureBehavior,
    signals: addOrUpdateSignal,
    triggers: addOrUpdateTrigger,
    sprites: addOrUpdateSprite,
    networks: addOrUpdateEnergyNetwork,
    categories: addOrUpdateUpgradeCategory,
    inputs: addOrUpdateInputBinding,
};

export const REMOVE: Partial<Record<Tab, RemoveFn>> = {
    elements: removeElement,
    structures: removeStructure,
    items: removeItem,
    recipes: removeRecipe,
    processing: removeProcessing,
    contacts: removeContact,
    interactions: removeInteraction,
    modifiers: removeModifier,
    terrains: removeTerrain,
    techs: removeTech,
    unlockNodes: removeUnlockNode,
    upgrades: removeUpgrade,
    projectiles: removeProjectile,
    energy: removeEnergyType,
    excavation: removeExcavationProfile,
    behaviors: removeStructureBehavior,
    signals: removeSignal,
    triggers: removeTrigger,
    sprites: removeSprite,
    networks: removeEnergyNetwork,
    categories: removeUpgradeCategory,
    inputs: removeInputBinding,
};

function entriesOf(cfg: ModConfig, cat: Tab): Record<string, unknown>[] {
    const key = CATEGORY_META[cat].configKey;
    if (!key) return [];
    const arr = (cfg as unknown as Record<string, unknown>)[key];
    return Array.isArray(arr) ? (arr as Record<string, unknown>[]) : [];
}

export function createPanelComponent(defaultMinimized = true) {
    const React = HostReact ?? (api as { react?: typeof HostReact }).react;
    if (!React) {
        console.error(`${LOG} sandkit.react unavailable — panel disabled`);
        return () => null;
    }
    const { useState, useEffect, useRef, useCallback, useMemo } = React;
    const h = React.createElement.bind(React) as (...args: unknown[]) => unknown;

    function Panel() {
        const [panel, setPanel] = useState<PanelState>(() => loadPanelState(defaultMinimized));
        const [cfg, setCfg] = useState<ModConfig>(() => loadConfig());
        const [groupKey, setGroupKey] = useState("content");
        const [cat, setCat] = useState<Tab>("elements");
        const [mode, setMode] = useState<Mode>("list");
        const [form, setForm] = useState<Record<string, string>>({});
        const [editingId, setEditingId] = useState<string | null>(null);
        const [confirmId, setConfirmId] = useState<string | null>(null);
        /**
         * Which reference fields have their native list expanded.
         *
         * Collapsed by default on purpose: a form with thirty fields would
         * otherwise open as a wall. The *count* is shown while collapsed,
         * because "38 in the game" is the thing worth knowing — it says the
         * list is real before you spend a click finding out.
         */
        const [nativeOpen, setNativeOpen] = useState<Record<string, boolean>>({});
        /**
         * Which kind the Graph screen is narrowed to.
         *
         * Held here rather than inside the screen because the body remounts on
         * every category switch (`key: cat:mode`). Filter state that resets on
         * each visit makes the filter unusable — you narrow the graph, glance at
         * a screen, come back, and find the whole diagram again.
         */
        const [helpFilter, setHelpFilter] = useState("all");
        const [jsonText, setJsonText] = useState("");
        const [jsonError, setJsonError] = useState<string | null>(null);
        /** Handlers tab: which handler is expanded, and its live param values. */
        const [handlerTab, setHandlerTab] = useState<HandlersTabState>(() =>
            initialHandlersState()
        );
        /** Per-field search text for `kind: "library"` pickers. */
        const [libQuery, setLibQuery] = useState<Record<string, string>>({});
        const drag = useRef<{
            ox: number;
            oy: number;
            active: boolean;
            /** True once the pointer has travelled far enough to be a drag. */
            moved: boolean;
            startX: number;
            startY: number;
        }>({ ox: 0, oy: 0, active: false, moved: false, startX: 0, startY: 0 });
        /**
         * Set when a drag just ended, so the click that follows can tell the
         * difference between "moved the chip" and "clicked the chip".
         */
        const suppressClick = useRef(false);

        const group = MENU_GROUPS.find((g) => g.key === groupKey) ?? MENU_GROUPS[0];
        const meta = CATEGORY_META[cat];

        // Live validation — Save stays disabled while invalid.
        const errors = useMemo<Record<string, string>>(
            () => (mode === "form" ? validateForm(cat, form) : {}),
            [mode, cat, form],
        );
        const errorCount = Object.keys(errors).length;

        // Poll the external expand request (Alt+M / tool.ts).
        useEffect(() => {
            let last = 0;
            const id = setInterval(() => {
                const n = (globalThis as any).__mdMyHownPanelExpand | 0;
                if (n && n !== last) {
                    last = n;
                    setPanel((p) => {
                        const next = {
                            ...p,
                            minimized: false,
                            x: Math.max(8, p.x || 24),
                            y: Math.max(8, p.y || 80),
                        };
                        savePanelState(next);
                        return next;
                    });
                }
            }, 200);
            return () => clearInterval(id);
        }, []);

        /**
         * The "native" list under a reference field: what already exists, and by
         * whom.
         *
         * This answers the question a select cannot: *how much is there, and is
         * it mine?* A field offering 38 game elements and 2 of your own is a
         * very different proposition from one of unknown size, and before this
         * the only way to find out was to open the dropdown and count.
         *
         * It renders for any `select`/`multiselect` whose options carry a
         * `source`, so the rule is "the catalog knows where these came from"
         * rather than a hand-kept list of fields that would silently drift out
         * of date. A field with no sourced options gets nothing — no empty box,
         * and no count of zero pretending to be information.
         *
         * Read-only by design. The value is chosen in the picker above; this
         * exists to be looked at, not to be a second place to type into.
         */
        const nativeBox = (f: FieldSpec, opts: Opt[]): unknown => {
            if (f.kind !== "select" && f.kind !== "multiselect") return null;
            if (!opts.length) return null;
            const game = opts.filter((o) => o.source === "game");
            const mine = opts.filter((o) => o.source === "mod");
            // Untagged options mean the catalog recorded no origin. Counting
            // around them would be a lie, so say nothing instead.
            if (!game.length && !mine.length) return null;

            const isOpen = !!nativeOpen[f.key];
            const summary = [
                game.length ? `${game.length} in the game` : null,
                mine.length ? `${mine.length} from this mod` : null,
            ].filter(Boolean).join(" · ");

            return h(
                "div",
                { style: S.nativeBox },
                h(
                    "button",
                    {
                        type: "button",
                        style: S.nativeToggle,
                        onClick: () => setNativeOpen({ ...nativeOpen, [f.key]: !isOpen }),
                        title: isOpen ? "Hide what already exists" : "Show what already exists",
                    },
                    `${isOpen ? "▾" : "▸"} ${summary}`,
                ),
                isOpen
                    ? h(
                        "div",
                        { style: S.nativeList },
                        ...game.slice(0, 200).map((o) =>
                            h("span", { key: `g-${o.value}`, style: S.nativeItem }, o.label)
                        ),
                        ...(game.length > 200
                            ? [
                                h(
                                    "span",
                                    { style: S.nativeItem },
                                    `…and ${game.length - 200} more`,
                                ),
                            ]
                            : []),
                        ...mine.map((o) =>
                            h(
                                "span",
                                {
                                    key: `m-${o.value}`,
                                    style: { ...S.nativeItem, ...S.nativeItemMod },
                                },
                                o.label,
                            )
                        ),
                    )
                    : null,
            );
        };

        /**
         * "What already exists", at the top of the panel.
         *
         * The per-field native box answers this one field at a time, and only
         * once you have scrolled to a picker. This answers it on arrival, which
         * is when the question is actually in your head: you opened Elements
         * because you want to make something out of Water, and you want to know
         * that Water exists before you start filling in fields.
         *
         * Collapsed, but never silent: the summary carries the count, and a count
         * of zero is a real answer. Only the five screens with something to
         * enumerate get one — see `PANEL_NATIVES`.
         */
        const panelNatives = (cat: Tab): unknown => {
            const list = PANEL_NATIVES[cat];
            if (!list) return null;
            const opts = list();
            if (!opts.length) return null;
            const game = opts.filter((o) => o.source === "game");
            const mine = opts.filter((o) => o.source === "mod");
            return h(
                "details",
                { style: { margin: "0 10px 8px 10px" } },
                h(
                    "summary",
                    { style: S.nativeToggle },
                    `▸ ${opts.length} in the game already${
                        mine.length ? ` · ${mine.length} from this mod` : ""
                    }`,
                ),
                h(
                    "div",
                    { style: { ...S.nativeList, marginTop: 6 } },
                    // Sorted, because a registry's order is an implementation
                    // detail and a list you are scanning to find "is there a
                    // Water?" should not depend on it.
                    ...[...opts]
                        .sort((a, b) => a.value.localeCompare(b.value))
                        .map((o) =>
                            h(
                                "button",
                                {
                                    key: o.value,
                                    type: "button",
                                    style: {
                                        ...S.nativeItem,
                                        ...(o.source === "mod" ? S.nativeItemMod : null),
                                        cursor: "pointer",
                                    },
                                    // The id, not the label. The label is what you
                                    // read to find it; the id is what you paste
                                    // into a field, and it is the one that is not
                                    // obvious from the label.
                                    title: `${o.value} — click to copy`,
                                    onClick: () => copyRef.current(o.value),
                                },
                                o.label,
                            )
                        ),
                ),
            );
        };

        const refresh = useCallback(() => setCfg(loadConfig()), []);

        /**
         * Return the view to a clean screen.
         *
         * Both `goGroup` and `goCategory` used to clear only `mode`, `form`,
         * `editingId` and `confirmId`, so the raw-JSON buffer, the open handler
         * and its parameter values, and every library-picker search string all
         * survived a category change. That is what made a switch look like it
         * half-worked: the next screen inherited the last one's scratch state.
         *
         * One function, called from both paths — a second reset path is a
         * second bug waiting to happen.
         */
        const resetView = useCallback(() => {
            // The list of what gets cleared lives in ./viewstate.ts so it can be
            // tested; this only applies it to the separate useState hooks.
            const clean = emptyViewState();
            setMode(clean.mode);
            setConfirmId(clean.confirmId);
            setEditingId(clean.editingId);
            setForm(clean.form);
            setJsonText(clean.jsonText);
            setJsonError(clean.jsonError);
            setLibQuery(clean.libQuery);
            setHandlerTab(clean.handlerTab);
        }, []);

        const setField = useCallback((key: string, value: string) => {
            setForm((prev) => ({ ...prev, [key]: value }));
        }, []);

        const goGroup = (key: string) => {
            const g = MENU_GROUPS.find((x) => x.key === key);
            if (!g) return;
            resetView();
            setGroupKey(key);
            setCat(g.categories[0]);
        };

        const goCategory = (next: Tab) => {
            resetView();
            setCat(next);
        };

        /**
         * Shared by the Handlers, Help and Map screens.
         *
         * Three screens all offer "copy this as text", and the clipboard is
         * missing or blocked often enough that the fallback toast matters more
         * than the happy path.
         */
        const copyText = (text: string) => {
            try {
                (globalThis as {
                    navigator?: { clipboard?: { writeText?: (t: string) => void } };
                }).navigator?.clipboard?.writeText?.(text);
                skApi.toast("Copied to the clipboard");
            } catch {
                skApi.toast("Clipboard unavailable — select the text instead");
            }
        };
        // `panelNatives` is built above this, and its chips call it. A ref rather
        // than a reorder, so the two stay independent of which came first.
        const copyRef = { current: copyText };

        const startNew = () => {
            setEditingId(null);
            setConfirmId(null);
            const next = formDefaults(cat);
            // A structure must name an unlock node, so a new one starts on the
            // built-in default rather than on nothing. Without this the required
            // field opens empty and blocks the first save on a rule the author
            // never chose — "available from the start" is a decision, and this is
            // where it is pre-made rather than assumed.
            if (cat === "structures") next.unlockNode = DEFAULT_UNLOCK_NODE;
            setForm(next);
            setMode("form");
        };

        const startEdit = (entry: Record<string, unknown>) => {
            setConfirmId(null);
            const id = typeof entry.id === "string" ? entry.id : null;
            setEditingId(id);
            const next = entryToForm(cat, entry);
            // A tech's structure-derived unlocks live on the *structures*, not on
            // the node, so the form would open showing fewer unlocks than the game
            // will actually grant — and saving would then write that smaller list
            // back, quietly dropping the link. Seeded here so the picker shows the
            // truth and an edit is a no-op when nothing was changed.
            if (cat === "techs" && id) {
                const ids = techUnlockStructureIds(id, loadConfig());
                if (ids.length > 0) {
                    next.unlockStructures = formatIdList(
                        Array.from(new Set([...parseIdList(next.unlockStructures), ...ids])),
                    );
                }
            }
            setForm(next);
            setMode("form");
        };

        const cancelForm = () => {
            setMode("list");
            setForm({});
            setEditingId(null);
        };

        const saveForm = () => {
            if (errorCount > 0) {
                skApi.toast(`Fix ${errorCount} issue${errorCount > 1 ? "s" : ""} before saving`);
                return;
            }
            const upsert = UPSERT[cat];
            if (!upsert) return;
            const entry = formToEntry(cat, form);
            if (!entry.id) {
                skApi.toast("Id is required");
                return;
            }
            if (!editingId) {
                const exists = entriesOf(loadConfig(), cat).some((e) => e.id === entry.id);
                if (exists) {
                    setForm((p) => ({ ...p }));
                    skApi.toast(`Id already exists: ${entry.id}`);
                    return;
                }
            }
            try {
                (upsert as (e: unknown) => ModConfig)(entry);
            } catch (e) {
                console.error(`${LOG} save failed`, e);
                skApi.toast("Save failed — see console");
                return;
            }
            applyConfig(loadConfig());
            // An edit to an already-registered entry is skipped by applyConfig's
            // cache, so push it through updateDefinition explicitly.
            if (editingId) updateEntry(cat, editingId, entry);
            refresh();
            skApi.toast(`${meta.label} saved`);
            cancelForm();
        };

        const requestRemove = (id: string) => {
            if (confirmId !== id) {
                setConfirmId(id);
                return;
            }
            const remove = REMOVE[cat];
            if (!remove) return;
            try {
                remove(id);
            } catch (e) {
                console.error(`${LOG} remove failed`, e);
            }
            setConfirmId(null);
            applyConfig(loadConfig());
            refresh();
            skApi.toast("Removed");
        };

        // ── Field rendering ────────────────────────────────────────────────
        /**
         * 4×4 footprint editor. The engine only accepts a 4×4 matrix of 0/1, so
         * this replaces a raw JSON textarea with a clickable grid: click a cell
         * to toggle it, or use the fill buttons for the common solid/empty cases.
         */
        const renderShape = (f: FieldSpec, val: string, err?: string) => {
            const grid = normalizeShape(safeJson(val) ?? emptyShape(1));
            const write = (next: number[][]) => setField(f.key, shapeToText(next));

            const cellAt = (y: number, x: number) => {
                const on = grid[y][x] === 1;
                return h(
                    "button",
                    {
                        key: `${y}-${x}`,
                        title: on
                            ? `cell ${x},${y} — occupied (click to clear)`
                            : `cell ${x},${y} — empty (click to fill)`,
                        style: on ? S.shapeCellOn : S.shapeCellOff,
                        onClick: () => {
                            const next = grid.map((r) => r.slice());
                            next[y][x] = on ? 0 : 1;
                            write(next);
                        },
                    },
                    "",
                );
            };

            return h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: 6 } },
                h(
                    "div",
                    { style: S.shapeGridBox },
                    ...grid.map((_row, y) =>
                        h(
                            "div",
                            { key: y, style: S.shapeRow },
                            ...grid[y].map((_v, x) => cellAt(y, x)),
                        )
                    ),
                ),
                h(
                    "div",
                    { style: { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" } },
                    h("button", { style: S.btn, onClick: () => write(emptyShape(1)) }, "Fill 4×4"),
                    h("button", { style: S.btn, onClick: () => write(emptyShape(0)) }, "Clear all"),
                    h("button", {
                        style: S.btn,
                        onClick: () => write(grid.map((r) => r.slice()).reverse()),
                    }, "Flip Y"),
                    h("span", { style: S.hintBelow }, describeShape(grid)),
                ),
                err ? h("div", { style: S.errorText }, err) : null,
            );
        };

        /**
         * Bundled-asset picker over the build-time sprite catalog (248 icons).
         *
         * The mod runtime has no filesystem access, so `src/generated/sprite-library.ts`
         * is generated by `deno task build:sprites` and imported here. Picking a tile
         * writes the asset path into the field; when the field declares `autoKey`, the
         * companion field (e.g. the graphics key) is auto-filled too — but only if the
         * user has not hand-typed something that is not a previous auto-value, so a
         * manual edit is never silently clobbered.
         */
        const renderLibrary = (f: FieldSpec, val: string, err?: string) => {
            const q = libQuery[f.key] ?? "";
            // Cap the rendered slice: 248 tiles is a lot of DOM for a side panel.
            const matches = searchLibraryAssets(q);
            const shown = matches.slice(0, 120);

            /** Big pixelated preview of the currently selected asset. */
            const selectedPreview = (path: string) => {
                const a = matches.find((x) => x.path === path);
                if (!a?.preview) {
                    return [h("span", { style: S.hint }, `No bundled preview for ${path}.`)];
                }
                return [
                    h("span", { style: S.hint }, "16×16:"),
                    h("img", {
                        src: a.preview,
                        alt: a.name,
                        width: a.previewW,
                        height: a.previewH,
                        style: { ...S.spritePixel, width: 96, height: 96 },
                    }),
                ];
            };

            const pick = (name: string, path: string) => {
                setField(f.key, path);
                const target = f.autoKey;
                if (!target) return;
                const derived = autoGraphicsKey(name);
                setForm((prev) => {
                    // Never clobber a hand-typed graphics key: only write when the
                    // field is empty or still holds our own previous auto-value.
                    const next = resolveAutoFill(prev[target], prev[`${target}__auto`], derived);
                    if (next === null) return prev;
                    return { ...prev, [target]: next, [`${target}__auto`]: next };
                });
            };

            return h(
                "div",
                null,
                h("input", {
                    type: "text",
                    style: err ? { ...S.libSearch, ...S.inputError } : S.libSearch,
                    value: q,
                    spellCheck: false,
                    placeholder: f.placeholder ?? "search the bundled icon library…",
                    onChange: (e: { target: { value: string } }) =>
                        setLibQuery((p) => ({ ...p, [f.key]: e.target.value })),
                }),
                val
                    ? h(
                        "div",
                        { style: S.hintBelow },
                        "Selected: ",
                        h("code", null, val),
                    )
                    : null,
                matches.length === 0
                    ? h("div", { style: S.hintBelow }, `No bundled asset matches “${q}”.`)
                    : h(
                        "div",
                        { style: S.libGrid },
                        ...shown.map((a) =>
                            h(
                                "button",
                                {
                                    key: a.path,
                                    type: "button",
                                    title:
                                        `${a.name}\n${a.path}\n${a.previewW}×${a.previewH} px · sizes: ${
                                            a.sizes.join(", ")
                                        }`,
                                    style: val === a.path ? S.libTileActive : S.libTile,
                                    onClick: () => pick(a.name, a.path),
                                },
                                // The real art, upscaled with nearest-neighbour so
                                // the 16×16 pixel grid stays crisp.
                                h("img", {
                                    src: a.preview,
                                    alt: a.name,
                                    width: a.previewW,
                                    height: a.previewH,
                                    style: S.spritePixel,
                                }),
                                h("span", { style: S.libTileName }, a.name),
                            )
                        ),
                    ),
                matches.length > shown.length
                    ? h(
                        "div",
                        { style: S.hintBelow },
                        `Showing ${shown.length} of ${matches.length} — refine the search.`,
                    )
                    : null,
                // Magnified 16×16 view of the current pick.
                val ? h("div", { style: S.spritePreviewRow }, ...selectedPreview(val)) : null,
                err ? h("div", { style: S.errorText }, err) : null,
            );
        };

        /**
         * Colour-variant swatches — one row per `colors.variants` entry.
         *
         * The engine shape is a nested array of RGBA tuples, which as a raw
         * textarea meant hand-counting brackets and remembering that alpha is a
         * fourth number. Every workshop mod that uses this ships four or five
         * variants (`__scraped-mods/workshop/3790149867`), so the common case is
         * a list, and a list deserves a list control.
         */
        const renderColorVariants = (f: FieldSpec, val: string, locked: boolean) => {
            const swatches = variantsToHexList(val);
            const write = (next: string[]) =>
                setField(f.key, JSON.stringify(hexListToVariants(next)));

            return h(
                "div",
                null,
                swatches.length === 0
                    ? h(
                        "div",
                        { style: S.hintBelow },
                        "No variants — every cell uses the map colour, which is fine for most elements.",
                    )
                    : null,
                ...swatches.map((hexValue, i) =>
                    h(
                        "div",
                        { key: `cv-${i}`, style: S.outputsRow },
                        h("input", {
                            type: "color",
                            value: hexValue.slice(0, 7),
                            disabled: locked,
                            title: `variant ${i + 1}`,
                            style: {
                                width: 40,
                                height: 26,
                                border: "none",
                                background: "transparent",
                                cursor: locked ? "default" : "pointer",
                            },
                            onChange: (e: { target: { value: string } }) => {
                                const next = [...swatches];
                                // A colour input has no alpha, so the swatch keeps
                                // whatever alpha it already had.
                                next[i] = e.target.value + hexValue.slice(7);
                                write(next);
                            },
                        }),
                        h(
                            "span",
                            { style: { ...S.hint, fontFamily: "monospace" } },
                            hexValue,
                        ),
                        h(
                            "button",
                            {
                                type: "button",
                                style: { ...S.btnDanger, opacity: locked ? 0.5 : 1 },
                                disabled: locked,
                                title: "remove this variant",
                                onClick: () => write(swatches.filter((_, j) => j !== i)),
                            },
                            "✕",
                        ),
                    )
                ),
                h(
                    "button",
                    {
                        type: "button",
                        style: S.btn,
                        disabled: locked,
                        // Seed from the map colour so a new variant is a variation
                        // on what the element already looks like, not a random
                        // new hue.
                        onClick: () =>
                            write([...swatches, seedVariantFromMapColor(form.metaColor)]),
                    },
                    "+ variant from map colour",
                ),
            );
        };

        /**
         * `buildModes[]` editor — one row per build mode.
         *
         * The engine takes a **list** (`Array.isArray(e) && e.forEach(rt)`) and
         * a structure may have several: a line mode for dragging out a pipe run
         * plus a single mode for dropping one node. The form used to hold
         * exactly one (`buildModeType` + `spanTiles`), so a structure with two
         * modes had the second dropped on save — silently, leaving a structure
         * that behaved in a way the form never described.
         *
         * `spanTiles` is per-row because the engine validates it per mode and
         * throws: `rt` rejects `spanTiles` on any `type` other than `"line"`.
         */
        const renderBuildModes = (f: FieldSpec, val: string, locked: boolean) => {
            let rows: Record<string, unknown>[] = [];
            try {
                const parsed = JSON.parse(val || "[]");
                if (Array.isArray(parsed)) rows = parsed;
            } catch { /* raw value stays; validation reports it */ }
            const writeRows = (next: Record<string, unknown>[]) =>
                setField(f.key, JSON.stringify(next));
            const modes = listBuildModeTypes();

            return h(
                "div",
                null,
                rows.length === 0
                    ? h(
                        "div",
                        { style: S.hintBelow },
                        "No build modes listed — the engine places this as a single point.",
                    )
                    : null,
                ...rows.map((row, i) => {
                    const type = String(row.type ?? "single");
                    return h(
                        "div",
                        { key: i, style: S.outputsRow },
                        h(
                            "select",
                            {
                                style: S.input,
                                title: "build mode type",
                                value: type,
                                disabled: locked,
                                onChange: (e: { target: { value: string } }) => {
                                    const nextType = e.target.value;
                                    writeRows(
                                        rows.map((r, j) => {
                                            if (j !== i) return r;
                                            if (nextType === "line") {
                                                return { ...r, type: nextType };
                                            }
                                            // spanTiles is meaningless off a line
                                            // mode, and leaving it behind would
                                            // make the engine throw on register.
                                            const { spanTiles: _drop, ...rest } = r;
                                            return { ...rest, type: nextType };
                                        }),
                                    );
                                },
                            },
                            ...modes.map((o) =>
                                h("option", { key: o.value, value: o.value }, o.label)
                            ),
                        ),
                        type === "line"
                            ? h("input", {
                                type: "number",
                                style: S.input,
                                min: 1,
                                max: 64,
                                placeholder: "span",
                                title: "tiles per drag; the engine throws below 1",
                                value: row.spanTiles === undefined ? "" : String(row.spanTiles),
                                disabled: locked,
                                onInput: (e: { currentTarget: { value: string } }) => {
                                    const raw = e.currentTarget.value.trim();
                                    writeRows(
                                        rows.map((r, j) => {
                                            if (j !== i) return r;
                                            if (raw === "") {
                                                const { spanTiles: _drop, ...rest } = r;
                                                return rest;
                                            }
                                            return { ...r, spanTiles: Number(raw) };
                                        }),
                                    );
                                },
                            })
                            : h("span", { style: S.hintBelow }, "no span"),
                        h(
                            "button",
                            {
                                type: "button",
                                style: { ...S.btnDanger, opacity: locked ? 0.5 : 1 },
                                disabled: locked,
                                title: "remove this build mode",
                                onClick: () => writeRows(rows.filter((_, j) => j !== i)),
                            },
                            "✕",
                        ),
                    );
                }),
                h(
                    "button",
                    {
                        type: "button",
                        style: S.btn,
                        disabled: locked,
                        onClick: () => writeRows([...rows, { type: "single" }]),
                    },
                    "+ build mode",
                ),
            );
        };

        /**
         * Excavation `terrainRules[]` editor — one row per matched terrain.
         *
         * These were completely unreachable before: the register layer dropped
         * `terrainRules` on the floor and the form had no field for it.
         * `cellType` / `outputElementType` are stored as ids; the engine wants
         * runtime handles, which `registerExcavationProfile` resolves.
         */
        const renderTerrainRules = (f: FieldSpec, val: string, err?: string) => {
            let rows: Record<string, unknown>[] = [];
            try {
                const parsed = JSON.parse(val || "[]");
                if (Array.isArray(parsed)) rows = parsed;
            } catch { /* raw value stays; validation reports it */ }
            const writeRows = (next: Record<string, unknown>[]) =>
                setField(f.key, JSON.stringify(next, null, 2));
            const terrains = listTerrains();
            const elements = listElements();
            const drop = (
                cellType: unknown,
            ) => (cellType === undefined ? undefined : String(cellType));

            return h(
                "div",
                null,
                rows.length === 0
                    ? h(
                        "div",
                        { style: S.hintBelow },
                        "No rules — this profile treats every terrain the same.",
                    )
                    : null,
                ...rows.map((row, i) =>
                    h(
                        "div",
                        { key: i, style: S.outputsRow },
                        h(
                            "select",
                            {
                                style: S.input,
                                title: "terrain matched by this rule",
                                value: drop(row.cellType) ?? "",
                                onChange: (e: { target: { value: string } }) =>
                                    writeRows(
                                        rows.map((r, j) =>
                                            j === i ? { ...r, cellType: e.target.value } : r
                                        ),
                                    ),
                            },
                            h("option", { value: "" }, "— terrain —"),
                            ...terrains.map((o) =>
                                h("option", { key: o.value, value: o.value }, o.label)
                            ),
                        ),
                        h("input", {
                            type: "number",
                            style: S.input,
                            value: row.damage === undefined ? "" : String(row.damage),
                            placeholder: "damage",
                            title: "damage applied when this terrain matches (optional)",
                            onChange: (e: { target: { value: string } }) => {
                                const v = e.target.value;
                                writeRows(
                                    rows.map((r, j) => {
                                        if (j !== i) return r;
                                        const next = { ...r };
                                        if (v === "") delete next.damage;
                                        else next.damage = Number(v);
                                        return next;
                                    }),
                                );
                            },
                        }),
                        h(
                            "select",
                            {
                                style: S.input,
                                title: "element produced when dug",
                                value: drop(row.outputElementType) ?? "",
                                onChange: (e: { target: { value: string } }) => {
                                    const v = e.target.value;
                                    writeRows(
                                        rows.map((r, j) => {
                                            if (j !== i) return r;
                                            const next = { ...r };
                                            if (v === "") delete next.outputElementType;
                                            else next.outputElementType = v;
                                            return next;
                                        }),
                                    );
                                },
                            },
                            h("option", { value: "" }, "— drop —"),
                            ...elements.map((o) =>
                                h("option", { key: o.value, value: o.value }, o.label)
                            ),
                        ),
                        h(
                            "button",
                            {
                                style: S.btnDanger,
                                onClick: () => writeRows(rows.filter((_, j) => j !== i)),
                            },
                            "×",
                        ),
                    )
                ),
                h(
                    "button",
                    {
                        style: S.btn,
                        onClick: () => writeRows([...rows, { cellType: "" }]),
                    },
                    "+ Add terrain rule",
                ),
                err ? h("div", { style: S.errorText }, err) : null,
            );
        };

        const renderField = (f: FieldSpec) => {
            if (!isActive(f, form)) return null;
            const err = errors[f.key];
            const val = form[f.key] ?? "";
            const locked = f.key === "idSuffix" && !!editingId;
            const wide = !!f.wide || f.kind === "json" || f.kind === "outputs";
            const inputStyle = err ? S.inputError : S.input;
            const set = (v: string) => setField(f.key, v);

            const labelRow = h(
                "div",
                { style: { display: "flex", alignItems: "center", gap: 2 } },
                h("span", null, f.label),
                f.required ? h("span", { style: S.requiredMark }, "*") : null,
            );

            let control: unknown = null;
            if (f.kind === "select") {
                const opts = resolveOptions(f, form);
                const placeholder = f.required ? "— select —" : "— none —";
                control = h(
                    "select",
                    {
                        style: { ...inputStyle, cursor: "pointer" },
                        value: val,
                        disabled: locked,
                        onChange: (e: { target: { value: string } }) => set(e.target.value),
                    },
                    h("option", { value: "" }, placeholder),
                    ...opts.map((o) => h("option", { key: o.value, value: o.value }, o.label)),
                );
            } else if (f.kind === "multiselect") {
                const opts = resolveOptions(f, form);
                const chosen = parseIdList(val);
                if (opts.length === 0) {
                    // No free-text fallback, on purpose.
                    //
                    // An empty option list means the thing being referenced does
                    // not exist yet — not that the user should type the id. A
                    // text box here let a typo through to the engine, and the
                    // one thing a reference field must never do is invent a
                    // value. Any value already chosen is still shown, so an
                    // entry that has since become unreferenceable stays visible
                    // and fixable rather than silently uneditable.
                    const orphans = chosen.filter((v) => v && v !== "__none__");
                    control = h(
                        "div",
                        { style: S.emptyBox },
                        `Nothing to pick from yet — ${
                            f.emptyHint ?? "no entries of this kind exist."
                        }`,
                        ...(orphans.length
                            ? [
                                h(
                                    "div",
                                    { style: { marginTop: 4, opacity: 0.85 } },
                                    "Currently set to: ",
                                ),
                                ...orphans.map((v) =>
                                    h("button", {
                                        key: `orphan-${v}`,
                                        type: "button",
                                        style: { ...S.tagChip, cursor: "pointer" },
                                        onClick: () =>
                                            set(chosen.filter((x) => x !== v).join(", ")),
                                        title: "Click to remove this reference",
                                    }, `${v}  ✕`)
                                ),
                            ]
                            : []),
                    );
                } else {
                    const toggle = (value: string) => {
                        const next = chosen.includes(value)
                            ? chosen.filter((v) => v !== value)
                            : [...chosen, value];
                        set(next.join(", "));
                    };
                    control = h(
                        "div",
                        {
                            style: {
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 4,
                                maxHeight: 150,
                                overflowY: "auto",
                            },
                        },
                        ...opts.map((o) => {
                            const on = chosen.includes(o.value);
                            return h(
                                "button",
                                {
                                    key: o.value,
                                    type: "button",
                                    disabled: locked,
                                    style: {
                                        ...S.tagChip,
                                        cursor: locked ? "default" : "pointer",
                                        background: on
                                            ? "rgba(120,190,255,0.3)"
                                            : "rgba(90,120,190,0.12)",
                                        color: on ? "#ffffff" : "#cfe0ff",
                                        borderColor: on ? "rgba(180,220,255,0.95)" : undefined,
                                    },
                                    onClick: () => toggle(o.value),
                                },
                                on ? `✓ ${o.label}` : o.label,
                            );
                        }),
                    );
                }
            } else if (f.kind === "bool") {
                control = h(
                    "select",
                    {
                        style: { ...inputStyle, cursor: "pointer" },
                        value: val === "true" ? "true" : "false",
                        disabled: locked,
                        onChange: (e: { target: { value: string } }) => set(e.target.value),
                    },
                    h("option", { value: "true" }, "Yes"),
                    h("option", { value: "false" }, "No"),
                );
            } else if (f.kind === "number") {
                control = h("input", {
                    type: "number",
                    style: inputStyle,
                    value: val,
                    disabled: locked,
                    min: f.min,
                    max: f.max,
                    step: f.step ?? 1,
                    placeholder: f.placeholder,
                    onChange: (e: { target: { value: string } }) => set(e.target.value),
                });
            } else if (f.kind === "color") {
                const hex = /^#[0-9a-fA-F]{6}$/.test(val) ? val : "#888888";
                control = h(
                    "div",
                    { style: { display: "flex", gap: 8, alignItems: "center" } },
                    h("input", {
                        type: "color",
                        value: hex,
                        disabled: locked,
                        onChange: (e: { target: { value: string } }) => set(e.target.value),
                        style: {
                            width: 40,
                            height: 26,
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                        },
                    }),
                    h("input", {
                        type: "text",
                        style: { ...inputStyle, flex: 1 },
                        value: val,
                        disabled: locked,
                        placeholder: "#rrggbb",
                        maxLength: 7,
                        onChange: (e: { target: { value: string } }) => set(e.target.value),
                    }),
                );
            } else if (f.kind === "shape") {
                control = renderShape(f, val, err);
            } else if (f.kind === "library") {
                control = renderLibrary(f, val, err);
            } else if (f.kind === "buildModes") {
                control = renderBuildModes(f, val, locked);
            } else if (f.kind === "colorVariants") {
                control = renderColorVariants(f, val, locked);
            } else if (f.kind === "terrainRules") {
                control = renderTerrainRules(f, val, err);
            } else if (f.kind === "json") {
                control = h("textarea", {
                    style: err ? { ...S.textarea, ...S.inputError } : S.textarea,
                    value: val,
                    disabled: locked,
                    spellCheck: false,
                    rows: 4,
                    placeholder: f.placeholder,
                    onChange: (e: { target: { value: string } }) => set(e.target.value),
                });
                // For the passthrough box, name what is actually being carried.
                // The box only appears when there is something in it, so this is
                // never an empty list — but listing the names is still the point:
                // it is the only place the user can see that a field they cannot
                // edit is being preserved rather than quietly dropped.
                if (f.key === PASSTHROUGH_KEY) {
                    const carried = passthroughKeysOf(val);
                    if (carried.length) {
                        control = h(
                            "div",
                            null,
                            control,
                            h(
                                "div",
                                { style: S.hintBelow },
                                `Carrying ${carried.length} field${
                                    carried.length === 1 ? "" : "s"
                                } this form has no control for: ${carried.join(", ")}`,
                            ),
                        );
                    }
                }
            } else if (f.kind === "outputs") {
                control = renderOutputs(f, val, inputStyle, locked);
            } else {
                control = h("input", {
                    type: "text",
                    style: inputStyle,
                    value: val,
                    disabled: locked,
                    maxLength: f.maxLength,
                    placeholder: f.placeholder,
                    onChange: (e: { target: { value: string } }) => set(e.target.value),
                });
            }

            const opts = (f.kind === "select" || f.kind === "multiselect")
                ? resolveOptions(f, form)
                : [];
            return h(
                "div",
                { key: f.key, style: wide ? S.fieldCellWide : S.fieldCell },
                labelRow,
                control,
                // What the game already has, next to the field that picks from
                // it. Only for reference fields, and only when the list knows
                // where its options came from.
                nativeBox(f, opts),
                // Show what the selected handler actually does, inline (5.2).
                f.kind === "select" && f.key.endsWith("Key") && val
                    ? handlerDoc(val) ? h("div", { style: S.hintBelow }, handlerDoc(val)) : null
                    : err
                    ? h("div", { style: S.errorText }, err)
                    : f.hint
                    ? h("div", { style: S.hintBelow }, f.hint)
                    : null,
            );
        };

        const renderOutputs = (
            f: FieldSpec,
            val: string,
            inputStyle: Record<string, unknown>,
            locked: boolean,
        ) => {
            let rows: { elementType?: string; chance?: number }[] = [];
            try {
                const parsed = JSON.parse(val || "[]");
                if (Array.isArray(parsed)) rows = parsed;
            } catch { /* raw value stays in the form; validation reports it */ }
            const writeRows = (next: { elementType?: string; chance?: number }[]) =>
                setField(f.key, JSON.stringify(next, null, 2));
            const elements = listElements();

            return h(
                "div",
                null,
                ...rows.map((row, i) =>
                    h(
                        "div",
                        { key: i, style: S.outputsRow },
                        h(
                            "select",
                            {
                                style: { ...inputStyle, cursor: "pointer" },
                                value: row.elementType ?? "",
                                disabled: locked,
                                onChange: (e: { target: { value: string } }) => {
                                    writeRows(
                                        rows.map((r, j) =>
                                            j === i ? { ...r, elementType: e.target.value } : r
                                        ),
                                    );
                                },
                            },
                            h("option", { value: "" }, "— element —"),
                            ...elements.map((o) =>
                                h("option", { key: o.value, value: o.value }, o.label)
                            ),
                        ),
                        h("input", {
                            type: "number",
                            style: inputStyle,
                            value: row.chance === undefined ? "1" : String(row.chance),
                            disabled: locked,
                            min: 0,
                            max: 1,
                            step: 0.05,
                            title: "chance 0–1",
                            onChange: (e: { target: { value: string } }) => {
                                writeRows(
                                    rows.map((r, j) =>
                                        j === i ? { ...r, chance: Number(e.target.value) } : r
                                    ),
                                );
                            },
                        }),
                        h(
                            "button",
                            {
                                style: S.btnDanger,
                                disabled: locked,
                                onClick: () => writeRows(rows.filter((_, j) => j !== i)),
                            },
                            "×",
                        ),
                    )
                ),
                h(
                    "button",
                    {
                        style: S.btn,
                        disabled: locked,
                        onClick: () => writeRows([...rows, { elementType: "", chance: 1 }]),
                    },
                    "+ Add output",
                ),
            );
        };

        // ── Screens ────────────────────────────────────────────────────────
        const entryLabel = (entry: Record<string, unknown>): string => {
            const name = typeof entry.name === "string" ? entry.name : "";
            const id = typeof entry.id === "string" ? entry.id : "";
            return name || id;
        };

        const renderList = () => {
            const rows = entriesOf(cfg, cat);
            return h(
                "div",
                null,
                h(
                    "div",
                    { style: S.screenHead },
                    h("span", { style: S.screenTitle }, meta.label),
                    h("span", { style: S.screenBlurb }, meta.blurb),
                    h("span", { style: S.chipCount }, `${rows.length} in config`),
                    h("button", { style: S.btnPrimary, onClick: startNew }, "+ New"),
                ),
                h(
                    "div",
                    { style: { padding: "8px 10px 4px 10px" } },
                    rows.length === 0
                        ? h(
                            "div",
                            { style: S.emptyState },
                            `Nothing here yet — press “+ New” to create the first ${meta.label.toLowerCase()}.`,
                        )
                        : h(
                            "div",
                            { style: S.listScroll },
                            ...rows.map((entry) => {
                                const id = typeof entry.id === "string" ? entry.id : "";
                                const confirming = confirmId === id;
                                return h(
                                    "div",
                                    { key: id, style: S.row },
                                    h("span", { style: S.rowId, title: id }, entryLabel(entry)),
                                    h(
                                        "button",
                                        { style: S.btn, onClick: () => startEdit(entry) },
                                        "Edit",
                                    ),
                                    h(
                                        "button",
                                        {
                                            style: confirming ? S.btnPrimary : S.btnDanger,
                                            onClick: () => requestRemove(id),
                                        },
                                        confirming ? "Sure?" : "Del",
                                    ),
                                );
                            }),
                        ),
                ),
            );
        };

        const renderForm = () => {
            const sections = sectionsFor(cat);
            const title = editingId ? `Edit ${meta.label}` : `New ${meta.label.toLowerCase()}`;
            return h(
                "div",
                { style: { padding: "0 10px 6px 10px" } },
                h(
                    "div",
                    { style: S.screenHead },
                    h("span", { style: S.screenTitle }, title),
                    h("span", { style: S.screenBlurb }, meta.blurb),
                    h("button", { style: S.btn, onClick: cancelForm }, "← Back"),
                ),
                // The unlock relation, stated in words as well as shown in the
                // picker — "which node is this behind, and does it need research?"
                // is the question an author actually has, and answering it needs the
                // node's kind and cost, not just its id. Only on the structure
                // screen, which is where the question is asked.
                ...(cat === "structures"
                    ? [
                        h(
                            "div",
                            { key: "unlock-row", style: S.unlockRow },
                            h("span", { style: S.unlockText }, unlockLine(form, cfg)),
                        ),
                    ]
                    : []),
                ...sections.map((sec) =>
                    h(
                        "div",
                        { key: sec.title, style: S.sectionBox },
                        h("div", { style: S.sectionTitle }, sec.title),
                        h("div", { style: S.fieldGrid }, ...sec.fields.map((f) => renderField(f))),
                    )
                ),
                h(
                    "div",
                    { style: S.footerBar },
                    h(
                        "span",
                        { style: { ...S.footerStatus, color: errorCount ? "#ff9b9b" : "#9fe0b0" } },
                        errorCount
                            ? `⚠ ${errorCount} issue${
                                errorCount > 1 ? "s" : ""
                            } — fix before saving`
                            : "✓ ready to save",
                    ),
                    h("button", { style: S.btn, onClick: cancelForm }, "Cancel"),
                    h(
                        "button",
                        { style: S.btnPrimary, disabled: errorCount > 0, onClick: saveForm },
                        "Save",
                    ),
                ),
            );
        };

        const validateJsonText = (): boolean => {
            try {
                const parsed = JSON.parse(jsonText || "{}");
                if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
                    setJsonError("Root must be a JSON object");
                    return false;
                }
                setJsonError(null);
                return true;
            } catch (e) {
                setJsonError(`invalid JSON: ${(e as Error).message}`);
                return false;
            }
        };

        const renderJson = () =>
            h(
                "div",
                { style: { padding: "0 10px 6px 10px" } },
                h(
                    "div",
                    { style: S.screenHead },
                    h("span", { style: S.screenTitle }, "Full config JSON"),
                    h(
                        "span",
                        { style: S.screenBlurb },
                        "Everything stored for this mod — power-user escape hatch.",
                    ),
                ),
                h(
                    "div",
                    { style: { display: "flex", gap: 6, margin: "8px 0", flexWrap: "wrap" } },
                    h(
                        "button",
                        {
                            style: S.btn,
                            onClick: () => {
                                setJsonText(exportConfigJson());
                                setJsonError(null);
                            },
                        },
                        "Load from config",
                    ),
                    h("button", { style: S.btn, onClick: validateJsonText }, "Validate"),
                    h(
                        "button",
                        {
                            style: S.btnPrimary,
                            onClick: () => {
                                if (!validateJsonText()) return;
                                try {
                                    importConfigJson(jsonText);
                                    refresh();
                                    reapplyFromStorage();
                                    skApi.toast("Config imported & applied");
                                } catch (e) {
                                    console.error(`${LOG} import failed`, e);
                                    setJsonError(`import failed: ${(e as Error).message}`);
                                }
                            },
                        },
                        "Import & apply",
                    ),
                ),
                h("textarea", {
                    style: jsonError
                        ? { ...S.textarea, ...S.inputError, minHeight: 240 }
                        : { ...S.textarea, minHeight: 240 },
                    value: jsonText,
                    spellCheck: false,
                    placeholder: "click “Load from config”",
                    onChange: (e: { target: { value: string } }) => setJsonText(e.target.value),
                }),
                jsonError ? h("div", { style: S.errorText }, jsonError) : h(
                    "div",
                    { style: S.hint },
                    "A successful import registers everything immediately.",
                ),
            );

        // ── Chrome (drag / minimize) ───────────────────────────────────────
        const persistPanel = (next: PanelState) => {
            setPanel(next);
            savePanelState(next);
        };

        const onDragDown = (e: {
            clientX: number;
            clientY: number;
            currentTarget: { getBoundingClientRect: () => { left: number; top: number } };
            target: { setPointerCapture?: (id: number) => void };
            pointerId: number;
        }) => {
            const rect = e.currentTarget.getBoundingClientRect();
            drag.current = {
                ox: e.clientX - rect.left,
                oy: e.clientY - rect.top,
                active: true,
                moved: false,
                startX: e.clientX,
                startY: e.clientY,
            };
            try {
                e.target.setPointerCapture?.(e.pointerId);
            } catch { /* */ }
            if (panel.x < 0) {
                persistPanel({ ...panel, x: Math.round(rect.left), y: Math.round(rect.top) });
            }
        };

        const onDragMove = (e: { clientX: number; clientY: number }) => {
            if (!drag.current.active) return;
            // A drag must not also count as a click. The chip both drags and
            // opens, so without this a user who nudges it would open the panel
            // they were trying to move.
            if (exceedsSlop(drag.current.startX, drag.current.startY, e.clientX, e.clientY)) {
                drag.current.moved = true;
            }
            if (!drag.current.moved) return;
            // globalThis, not window: the mod runs in the game host, not a browser.
            const vw = (globalThis as { innerWidth?: number }).innerWidth ?? 1280;
            const vh = (globalThis as { innerHeight?: number }).innerHeight ?? 720;
            const next = clampChip(
                e.clientX - drag.current.ox,
                e.clientY - drag.current.oy,
                vw,
                vh,
                CHIP_W,
                CHIP_H,
            );
            setPanel((p) => ({ ...p, x: next.x, y: next.y }));
        };

        const onDragUp = () => {
            if (!drag.current.active) return;
            const moved = drag.current.moved;
            drag.current.active = false;
            // clear the flag on the next tick, so the click that follows this
            // pointerup still sees it
            if (moved) suppressClick.current = true;
            setPanel((p) => {
                savePanelState(p);
                return p;
            });
        };

        /** Open the panel, unless this click was really the end of a drag. */
        const openFromChip = () => {
            if (suppressClick.current) {
                suppressClick.current = false;
                return;
            }
            persistPanel({ ...panel, minimized: false });
        };

        const toggleMin = () => persistPanel({ ...panel, minimized: !panel.minimized });

        /**
         * Re-apply the whole config.
         *
         * `applyConfig` skips any id already in its registration cache, so without
         * clearing it first this button would report success while the game kept
         * every stale definition. Clearing first makes Apply mean what it says.
         *
         * What it still cannot mean is "un-register". The engine has no unregister
         * for content kinds — only `ui.unregister`, for overlays — so an entry
         * *deleted* from the config stays live in the game until a reload. That
         * is reported instead of glossed over, because the alternative is an
         * author deleting a structure, hitting Apply, and finding it still in the
         * build menu with nothing anywhere saying why.
         *
         * The snapshot has to be taken before the cache is cleared — clearing is
         * the first thing that happens, and the list of what was registered is
         * exactly what it destroys.
         */
        const applyNow = () => {
            const cfgNow = loadConfig();
            const prev = snapshotRegistered();
            clearRegistrationCache();
            applyConfig(cfgNow);
            const stale = staleAfter(cfgNow, prev);
            if (stale.length > 0) {
                const names = stale.slice(0, 3).map((s) => s.id).join(", ");
                const more = stale.length > 3 ? ` +${stale.length - 3} more` : "";
                skApi.toast(
                    `Applied, but the game still holds ${stale.length} removed ` +
                        `entr${stale.length > 1 ? "ies" : "y"} (${names}${more}). ` +
                        `Reload the game to clear.`,
                );
            } else {
                skApi.toast("Config re-applied to game");
            }
        };

        const totalEntries = MENU_GROUPS.flatMap((g) => g.categories).reduce(
            (n, c) => n + (CATEGORY_META[c].configKey ? entriesOf(cfg, c).length : 0),
            0,
        );

        /**
         * Where the panel sits, which depends entirely on whether it is open.
         *
         * Open: a centred 90vw/90vh overlay, and the stored drag position is
         * ignored — a full-screen window has no business being parked in a
         * corner. Minimised: at the stored position, or the default corner when
         * it has never been dragged.
         */
        const posStyle = panel.minimized
            ? (panel.x >= 0 && panel.y >= 0
                ? { left: panel.x, top: panel.y, right: "auto", bottom: "auto" }
                : {})
            : S.overlayBox;

        if (panel.minimized) {
            return h(
                "div",
                {
                    style: { ...S.panelRoot, ...posStyle },
                    // The chip is the one draggable surface in the panel.
                    onPointerDown: onDragDown,
                    onPointerMove: onDragMove,
                    onPointerUp: onDragUp,
                    onPointerCancel: onDragUp,
                },
                h(
                    "div",
                    { style: S.minimizedChip, onClick: openFromChip },
                    "⚙ My Own Mod",
                    h("span", { style: S.chipCount }, String(totalEntries)),
                ),
            );
        }

        return h(
            "div",
            { style: { ...S.panelRoot, ...posStyle } },
            h(
                "div",
                { style: S.panelChrome },
                h(
                    "div",
                    {
                        style: S.titleBar,
                        // No drag handlers here on purpose: the open panel is a
                        // fixed 90vw/90vh overlay. Dragging lives on the
                        // minimised chip, which is the only thing small enough
                        // for a position to mean anything.
                    },
                    h("span", { style: S.titleText }, "My Own Mod — Configurator"),
                    h("span", { style: S.chipCount }, `${totalEntries} entries`),
                    h("button", { style: S.btn, onClick: applyNow }, "Apply"),
                    h("button", { style: S.btn, onClick: toggleMin }, "–"),
                ),
                h(
                    "div",
                    { style: S.groupNav },
                    ...MENU_GROUPS.map((g) =>
                        h(
                            "button",
                            {
                                key: g.key,
                                title: g.hint,
                                style: g.key === groupKey ? S.chipActive : S.chip,
                                onClick: () => goGroup(g.key),
                            },
                            g.label,
                        )
                    ),
                ),
                h(
                    "div",
                    { style: S.subNav },
                    ...group.categories.map((c) => {
                        const m = CATEGORY_META[c];
                        const n = m.configKey ? entriesOf(cfg, c).length : 0;
                        return h(
                            "button",
                            {
                                key: c,
                                style: c === cat ? S.chipActive : S.chip,
                                onClick: () => goCategory(c),
                            },
                            m.label,
                            h("span", { style: S.chipCount }, String(n)),
                        );
                    }),
                ),
                h(
                    "div",
                    {
                        style: S.body,
                        // Remount the screen when the category or the
                        // list/form mode genuinely changes. Without this React
                        // reconciles the previous screen's DOM into the new
                        // one positionally, and anything holding DOM state
                        // survives the switch — which is how a stale section
                        // could outlive the form that drew it.
                        key: `${cat}:${mode}`,
                    },
                    // Above the screen, not inside it, so it is the first thing
                    // on the panel in both the list and the form — and so it does
                    // not get remounted with either.
                    panelNatives(cat),
                    cat === "json" ? renderJson() : cat === "handlers"
                        ? renderHandlersTab({
                            h: h as never,
                            cfg: cfg as unknown as Record<string, unknown>,
                            state: handlerTab,
                            setState: setHandlerTab,
                            onGoTo: (key) => goCategory(key as Tab),
                            onCopy: copyText,
                        })
                        : cat === "help"
                        ? renderHelp({
                            h: h as never,
                            cfg: cfg as unknown as Record<string, unknown>,
                            onGoTo: (key) => goCategory(key as Tab),
                            onCopy: copyText,
                            filter: helpFilter,
                            setFilter: setHelpFilter,
                        })
                        : cat === "draws"
                        ? renderDraws({
                            h: h as never,
                            cfg: cfg as unknown as Record<string, unknown>,
                            onGoTo: (key) => goCategory(key as Tab),
                        })
                        : cat === "map"
                        ? renderConfigMap({
                            h: h as never,
                            cfg: cfg as unknown as Record<string, unknown>,
                            onGoTo: (key) => goCategory(key as Tab),
                            onCopy: copyText,
                        })
                        : mode === "form"
                        ? renderForm()
                        : renderList(),
                ),
            ),
        );
    }

    return Panel;
}

/**
 * Primary entry used by overlays.register("global", id, () => ConfiguratorPanel()).
 * The panel instance is created ONCE so hook order stays stable.
 */
let _panelInstance: (() => unknown) | null = null;

function getPanelInstance(): () => unknown {
    if (_panelInstance) return _panelInstance;
    _panelInstance = createPanelComponent(false); // expanded when the tool is selected
    return _panelInstance;
}

export function ConfiguratorPanel(): unknown {
    // word-statistic pattern: hide unless the tool is the active hotbar item
    if (!isToolSelected()) return null;

    const React = HostReact ?? (api as { react?: typeof HostReact }).react;
    if (!React?.createElement) {
        console.error(`${LOG} ConfiguratorPanel: no react`);
        return null;
    }
    const h = React.createElement.bind(React);

    try {
        const Panel = getPanelInstance();
        const tree = Panel();
        if (tree != null) return tree;
    } catch (e) {
        console.error(`${LOG} ConfiguratorPanel render failed`, e);
    }

    return h(
        "div",
        {
            style: {
                position: "fixed",
                right: 16,
                bottom: 16,
                zIndex: 100000,
                background: "rgba(20,40,90,0.95)",
                color: "#e8f0ff",
                border: "1px solid rgba(120,170,255,0.8)",
                borderRadius: "10px",
                padding: "10px 14px",
                font: "13px/1.4 system-ui,sans-serif",
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                pointerEvents: "auto",
            },
            onClick: () => forceExpandPanel(),
        },
        // Click-only: the minimised chip is the single way back in. There is no
        // Alt+M binding — do not advertise one until one is actually wired up.
        "My Own Mod — click to open",
    );
}
