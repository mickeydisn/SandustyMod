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
    isActive,
    MENU_GROUPS,
    newEntryForm,
    normalizeShape,
    parseIdList,
    PASSTHROUGH_KEY,
    passthroughKeysOf,
    resolveAutoFill,
    resolveOptions,
    sectionsFor,
    shapeToText,
    type Tab,
    validateForm,
} from "./schema.ts";
import { definitionFor } from "./definition/index.ts";
import {
    countByOwner,
    countHiddenRows,
    filterRows,
    mergeRows,
    originTag,
    type OwnerKey,
    ownerLabel,
    ownersOf,
    renderListRow,
    shownBecauseOf,
} from "./panel/list.ts";
import {
    isContentField,
    renderSelector,
    selectorKey,
    type SelectorState,
} from "./panel/component/selector/selector.ts";
import { renderActionList } from "./action-list-control.ts";
import { renderProjectileOption } from "./projectile-option-control.ts";
import { listFor } from "./panel/index.ts";
import { handlerDoc, listBuildModeTypes, type Opt, searchLibraryAssets } from "../catalog.ts";
import * as S from "./styles.ts";
import { emptyViewState, LIST_DEFAULTS, type ViewMode } from "./viewstate.ts";
import { clampChip, exceedsSlop } from "./drag.ts";
import {
    type HandlersTabState,
    initialHandlersState,
    renderActions,
    renderProjectileOptions,
    renderUpgradeActions,
} from "./panel/handlers.ts";
import { renderHelp } from "./panel/help.ts";
import { renderConfigMap } from "./config-map.ts";
import { DEFAULT_UNLOCK_NODE, techUnlockStructureIds, unlockLine } from "./tech-link.ts";
import { renderDraws } from "./panel/draws.ts";

/**
 * Tab → screen, for the Handlers menu group.
 *
 * A table rather than a chain of ternaries. The chain version was already two
 * deep by the time a third screen arrived, and each addition put another
 * `cat === "…"` beside the others where a typo is a silent blank screen rather
 * than a type error. Here a missing key is a type error, and adding a screen is
 * one line.
 *
 * Deliberately keyed by tab and not derived from `MENU_GROUPS`: which renderer
 * answers a tab is a decision about the screen, not something the menu can infer.
 */
const HANDLER_SCREENS = {
    action: renderActions,
    projectileOption: renderProjectileOptions,
    upgradeAction: renderUpgradeActions,
} as const;

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
         * The list screen's own filter state.
         *
         * Both are per-category rather than global: narrowing the element list to
         * "yours" and then opening a recipe should not silently reuse that
         * narrowing. They live beside `confirmId` and are reset with it, because
         * all three are "what am I looking at on this screen" rather than config.
         */
        const [listQuery, setListQuery] = useState(LIST_DEFAULTS.listQuery);
        /**
         * Which mod's objects to show: this mod, the game, or one named other.
         *
         * The *only* source filter on the list. There was a second one here — All
         * / Yours / Game — and it was this one said twice: "Yours" is `own`,
         * "Game" is `game`, and `origin` had no third value to offer. Two pieces
         * of state for one choice is a way for the chips to disagree.
         *
         * Starts on `LIST_DEFAULTS.listOwner` ("own") rather than a literal, so
         * this and the reset in `viewstate.ts` cannot drift apart.
         */
        const [listOwner, setListOwner] = useState<OwnerKey | "all">(LIST_DEFAULTS.listOwner);
        /**
         * Show the objects that are deliberately out of normal use: an element
         * marked `hidden`, a structure marked `hideFromBuildMenu`.
         *
         * Off by default, and the same rule the content selector applies, so a
         * user is not told an element is hidden in one screen and offered it as
         * ordinary in another.
         *
         * Cleared on a category change (below, with `listOwner`'s neighbours) —
         * the flag is the same for elements and structures but the *rows* are
         * not, so carrying "show hidden" into Items would offer a box that can
         * only ever reveal nothing.
         */
        const [listHidden, setListHidden] = useState(LIST_DEFAULTS.listHidden);
        /** Which row has its detail open. One at a time — two open is noise. */
        const [openRow, setOpenRow] = useState<string | null>(null);
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
         * Per-field state for the content selector: is the menu open, which
         * owner bucket, what the search box says.
         *
         * Held here, and not in a `useState` inside `renderSelector`, because
         * **that crashes the panel** — React #310, "Rendered more hooks than
         * during the previous render". Every control here is a plain function
         * called inside `sec.fields.map(...)`, not a component React mounts, so a
         * hook in one registers against the *panel's* hook slots. A form's field
         * list changes with the tab and with each field's `when`, so the hook
         * count changes between renders and React throws. `nativeOpen` above is
         * the same idea for the same reason.
         *
         * Keyed by field *and* entry id, so a given field's menu is its own and
         * opening one entry's picker does not open the next one's.
         */
        const [selectorState, setSelectorState] = useState<Record<string, SelectorState>>({});
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

        const refresh = useCallback(() => setCfg(loadConfig()), []);

        /**
         * Return the view to a clean screen.
         *
         * Every volatile field is cleared, so the raw-JSON buffer, the open handler
         * and its parameter values, and every library-picker search string cannot
         * survive a category change. A switch that inherits the last screen's
         * scratch state is what makes a switch look like it half-worked.
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
            setListQuery(clean.listQuery);
            // No cast needed: `listOwner` is typed `OwnerKey | "all"` in the
            // state interface, so the value is already right for the setter.
            setListOwner(clean.listOwner);
            setListHidden(clean.listHidden);
            setOpenRow(clean.openRow);
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
        // Used directly by the Handlers, Help and Map screens (`onCopy`). It used
        // to be reached indirectly through a `copyRef`, because the deleted
        // "in the game already" section was built above this line and needed a
        // forward reference to it; those buttons are gone, so the indirection went
        // with them.

        const startNew = () => {
            setEditingId(null);
            setConfirmId(null);
            // `newEntryForm` applies the field defaults and then the definition's
            // own seed, so a tab whose first save needs a decision the author
            // never made (a structure's unlock node) does not need a special case
            // here to get one.
            setForm(newEntryForm(cat));
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
            // The config is the source of truth, and saving it is the entire job.
            // The running game is not touched: the engine syncs mod content to the
            // simulation worker once, at boot, and cannot be told about a new or
            // changed definition afterwards. See `../register/registry.ts`.
            refresh();
            skApi.toast(`${meta.label} saved — reload the game to apply it.`);
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
            refresh();
            skApi.toast("Removed — reload the game to apply it.");
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

            // A definition may own the control for one of its own field kinds —
            // the 4×4 shape grid, the repeating build-modes editor. Asked before
            // the generic chain below, which then handles every kind it does not
            // claim. That ordering is the whole point: a structure-only widget is
            // added without the generic renderer learning that `shape` exists.
            const own = definitionFor(cat)?.panel?.renderField?.({
                h,
                form,
                cfg,
                setField,
                field: f,
                value: val,
                error: err,
                locked,
                // The `actionList` control needs the call site, which is a property
                // of the object rather than the field.
                tab: cat,
            });
            let control: unknown = own ?? null;
            // The generic chain below is a fallback, so it must be *guarded* by
            // `control === null` as a whole — not just on its first branch.
            //
            // Checking only the first `if` looks equivalent and is not: the chain
            // is an if/else-if ladder, so a field the definition claimed (`shape`,
            // `buildModes`) fails the first test on `f.kind`, falls all the way
            // down, and lands in the final `else` — which assigns a plain text
            // input over the widget that was just built. The 4×4 grid and the
            // build-modes editor both silently rendered as an empty text box.
            if (control === null && f.kind === "actionList") {
                // The ordered-process editor. Handled here rather than in each of the
                // six definitions that store one, because `actionList` is a *shared*
                // kind, like `json` — one widget for every object with a process.
                control = renderActionList({
                    h,
                    form,
                    cfg,
                    setField,
                    field: f,
                    value: val,
                    error: err,
                    locked,
                    tab: cat,
                });
            }
            if (control === null && f.kind === "projectileOption") {
                // The single-option editor. Its own kind rather than an `actionList`
                // special case, because a projectile is not a process: there is no
                // list, so there is nothing to add, reorder or repeat.
                control = renderProjectileOption({
                    h,
                    form,
                    cfg,
                    setField,
                    field: f,
                    value: val,
                    error: err,
                    locked,
                    tab: cat,
                });
            }
            if (control === null && f.kind === "select") {
                const opts = resolveOptions(f, form);
                if (isContentField(f.options)) {
                    // A content reference: the shared selector, with a swatch, a
                    // search box, and a mod filter that defaults to this mod's own
                    // objects. The native `<select>` below stays for the fixed
                    // enums ("conductor"/"storage"), where none of that applies.
                    control = renderSelector({
                        react: { h },
                        value: val,
                        options: opts,
                        multiple: false,
                        locked,
                        emptyHint: f.emptyHint,
                        placeholder: f.required ? "— select —" : "— none —",
                        onChange: set,
                        state: selectorState[selectorKey(f.key, editingId)],
                        onState: (patch) =>
                            setSelectorState((prev) => ({
                                ...prev,
                                [selectorKey(f.key, editingId)]: {
                                    ...prev[selectorKey(f.key, editingId)],
                                    ...patch,
                                },
                            })),
                    });
                } else {
                    control = h(
                        "select",
                        {
                            style: { ...inputStyle, cursor: "pointer" },
                            value: val,
                            disabled: locked,
                            onChange: (e: { target: { value: string } }) => set(e.target.value),
                        },
                        h("option", { value: "" }, f.required ? "— select —" : "— none —"),
                        ...opts.map((o) => h("option", { key: o.value, value: o.value }, o.label)),
                    );
                }
            } else if (control === null && f.kind === "multiselect") {
                const opts = resolveOptions(f, form);
                const chosen = parseIdList(val);
                if (isContentField(f.options)) {
                    // The same selector, in its multiple form. Same widget, same
                    // filters, same swatches — only the commit differs, and that is
                    // the caller's `formatIdList` rather than a branch here.
                    control = renderSelector({
                        react: { h },
                        value: val,
                        options: opts,
                        multiple: true,
                        locked,
                        emptyHint: f.emptyHint,
                        placeholder: "— none —",
                        onChange: set,
                        state: selectorState[selectorKey(f.key, editingId)],
                        onState: (patch) =>
                            setSelectorState((prev) => ({
                                ...prev,
                                [selectorKey(f.key, editingId)]: {
                                    ...prev[selectorKey(f.key, editingId)],
                                    ...patch,
                                },
                            })),
                    });
                } else if (opts.length === 0) {
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
            } else if (control === null && f.kind === "library") {
                control = renderLibrary(f, val, err);
            } else if (control === null && f.kind === "json") {
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
            } else if (control === null) {
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

        // ── Screens ────────────────────────────────────────────────────────
        const entryLabel = (entry: Record<string, unknown>): string => {
            const name = typeof entry.name === "string" ? entry.name : "";
            const id = typeof entry.id === "string" ? entry.id : "";
            return name || id;
        };

        const renderList = () => {
            const listSpec = listFor(cat);
            // One list, two sources: the mod's own entries, plus whatever the host
            // already has of this kind. An object with no host registry (a recipe,
            // a trigger) contributes no game rows — that is a fact about the API,
            // not an empty section to apologise for.
            const rows = mergeRows(entriesOf(cfg, cat), listSpec?.discover?.() ?? [], cat);
            const shown = filterRows(
                rows,
                listQuery,
                listSpec?.searchText,
                listOwner,
                listHidden,
            );
            const ownerCounts = countByOwner(rows);
            const owners = ownersOf(rows);
            // Counted under the current owner filter, so the number on the box is
            // what ticking it would actually add.
            const hiddenHere = countHiddenRows(rows, listOwner);

            const ownerChip = (key: OwnerKey, n: number) =>
                h(
                    "button",
                    {
                        key: `owner:${key}`,
                        // Tinted to match the row's own badge, so a chip and the rows
                        // it selects read as the same category.
                        style: listOwner === key
                            ? S.chipActive
                            : key === "own"
                            ? S.chipOwn
                            : key === "game"
                            ? S.chipGame
                            : S.chipOther,
                        title: key === "own"
                            ? "Objects this mod defines"
                            : key === "game"
                            ? "Built into the game"
                            : `Objects the "${key.slice(4)}" mod adds`,
                        // Clicking the active chip clears it, so there is no dead
                        // end where a filter is on and the only way out is the
                        // separate clear button.
                        onClick: () => setListOwner(listOwner === key ? "all" : key),
                    },
                    ownerLabel(key),
                    h("span", { style: S.chipCount }, String(n)),
                );

            // The hidden-objects tick, sitting with the owner chips rather than
            // on the search box. It filters the same rows they do, so putting it
            // apart from them split the screen's only filter controls across two
            // bars for no reason — the search box is a *lookup*, not a filter,
            // and this reads better as "the third filter" next to the other two.
            //
            // A chip rather than a bare checkbox, for the same reason: it is a
            // filter, and filters here are pills. Tinted with `chipCheckOn` when
            // on so it reads as "applied" the same way an active owner chip does,
            // rather than needing its own visual language.
            const hiddenToggle = () =>
                h(
                    "label",
                    {
                        key: "list-hidden",
                        style: listHidden ? S.chipCheckOn : S.chipCheck,
                        title: hiddenHere
                            ? `Include ${hiddenHere} marked hidden or kept out of the build menu`
                            : "No hidden objects in this view",
                    },
                    h("input", {
                        type: "checkbox",
                        checked: listHidden,
                        style: { margin: 0 },
                        onChange: (e: { target: { checked: boolean } }) =>
                            setListHidden(e.target.checked),
                    }),
                    "hidden",
                    // The count is omitted at zero rather than shown as "(0)": a
                    // permanent zero beside a tick implies the tick is broken.
                    hiddenHere ? h("span", { style: S.chipCount }, String(hiddenHere)) : null,
                );

            return h(
                "div",
                // A flex column, so the list below can claim the leftover height
                // of the body. Without this the screen is a block, `flex: 1` on
                // the list resolves against nothing, and the rows sit at their
                // natural height with the rest of the 90vh window empty.
                { style: S.screen },
                h(
                    "div",
                    { style: S.screenHead },
                    h("span", { style: S.screenTitle }, meta.label),
                    h("span", { style: S.screenBlurb }, meta.blurb),
                    // "N in config" — how many of these are the mod's own. Read
                    // from the owner counts rather than a second tally: "this
                    // mod" and "editable" are the same set, and two counters for
                    // one number is how they drift apart.
                    h(
                        "span",
                        { style: S.chipCount },
                        `${ownerCounts.get("own") ?? 0} in config`,
                    ),
                    h("button", { style: S.btnPrimary, onClick: startNew }, "+ New"),
                ),
                // The search box, on its own. It is a lookup over the rows rather
                // than one of the filters, so it does not share a bar with them.
                h(
                    "div",
                    { style: S.listFilterBar },
                    h("input", {
                        type: "text",
                        style: { ...S.input, flex: 1, minWidth: 120 },
                        value: listQuery,
                        placeholder: `Filter ${meta.label.toLowerCase()}…`,
                        onChange: (e: { target: { value: string } }) =>
                            setListQuery(e.target.value),
                    }),
                ),
                // The filters, as one row: the owner chips, then the hidden tick.
                // Always drawn — see the note on `S.listFilterBar`. When only one
                // owner has rows the chip row is just the hidden tick, which is
                // the right answer: there is one filter, and it is shown.
                h(
                    "div",
                    { style: S.listFilterBar },
                    ...owners.map((k) => ownerChip(k, ownerCounts.get(k) ?? 0)),
                    hiddenToggle(),
                    listOwner !== "all"
                        ? h(
                            "button",
                            {
                                key: "list-owner-clear",
                                style: S.chip,
                                onClick: () => setListOwner("all"),
                            },
                            "✕ clear",
                        )
                        : null,
                ),
                shown.length === 0
                    ? h(
                        "div",
                        { style: { ...S.emptyState, margin: "8px 10px" } },
                        // Name the filter that emptied the list, or the empty screen
                        // is a dead end: with the owner filter and the hidden tick
                        // both on by default, "no match" now has three possible
                        // causes and the user can only guess. The counts are what
                        // turn it from a shrug into a next step.
                        rows.length === 0
                            ? `Nothing here yet — press “+ New” to create the first ${meta.label.toLowerCase()}.`
                            : shownBecauseOf(
                                rows,
                                listOwner,
                                listHidden,
                                listQuery,
                                meta.label,
                            ),
                    )
                    : h(
                        "div",
                        { style: { ...S.listScroll, padding: "0 10px" } },
                        ...shown.map((row) =>
                            h(
                                "div",
                                { key: row.id },
                                renderListRow({
                                    h,
                                    form,
                                    cfg,
                                    setField,
                                    row,
                                    expanded: openRow === row.id,
                                    toggle: () => setOpenRow(openRow === row.id ? null : row.id),
                                    // Only a mod row is editable. Handing a game row an
                                    // edit button would be offering to edit Sand.
                                    edit: row.origin === "mod" && row.entry
                                        ? () => startEdit(row.entry as Record<string, unknown>)
                                        : undefined,
                                    remove: row.origin === "mod"
                                        ? () => requestRemove(row.id)
                                        : undefined,
                                    confirming: row.origin === "mod" && confirmId === row.id,
                                }, listSpec ?? {}),
                            )
                        ),
                    ),
            );
        };

        const renderForm = () => {
            // The live form is passed so a section with nothing to show is left
            // out entirely — that is what keeps an entry with nothing hidden from
            // showing an empty "Advanced" heading.
            const sections = sectionsFor(cat, form);
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
                // Whatever this definition wants above its own fields — the
                // structure's unlock relation, said in words rather than left to
                // a dropdown label. A tab with nothing to add contributes
                // nothing, so this is not a special case for one screen.
                ...(definitionFor(cat)?.panel?.renderHeader
                    ? [definitionFor(cat)!.panel!.renderHeader!({ h, form, cfg, setField })]
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
                                    skApi.toast("Config imported — reload the game to apply it.");
                                } catch (e) {
                                    console.error(`${LOG} import failed`, e);
                                    setJsonError(`import failed: ${(e as Error).message}`);
                                }
                            },
                        },
                        "Import",
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
                    "Importing replaces the stored config. Reload the game to register it.",
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
                    // The screen fills the body, and no "N in the game already"
                    // summary sits above it: the game's objects and the
                    // mod's own are the same rows, with the same counts and the
                    // same filter. A collapsed summary promising to list what
                    // already exists, above a screen that lists it, is the same
                    // answer twice.
                    cat === "json"
                        ? renderJson()
                        : HANDLER_SCREENS[cat as keyof typeof HANDLER_SCREENS]
                        ? HANDLER_SCREENS[cat as keyof typeof HANDLER_SCREENS]({
                            h: h as never,
                            cfg: cfg as unknown as Record<string, unknown>,
                            state: handlerTab,
                            setState: setHandlerTab,
                            onGoTo: (key: string) => goCategory(key as Tab),
                            onCopy: copyText,
                        })
                        : cat === "help"
                        ? renderHelp({
                            h: h as never,
                            cfg: cfg as unknown as Record<string, unknown>,
                            onGoTo: (key: string) => goCategory(key as Tab),
                            onCopy: copyText,
                            filter: helpFilter,
                            setFilter: setHelpFilter,
                        })
                        : cat === "draws"
                        ? renderDraws({
                            h: h as never,
                            cfg: cfg as unknown as Record<string, unknown>,
                            onGoTo: (key: string) => goCategory(key as Tab),
                        })
                        : cat === "map"
                        ? renderConfigMap({
                            h: h as never,
                            cfg: cfg as unknown as Record<string, unknown>,
                            onGoTo: (key: string) => goCategory(key as Tab),
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
