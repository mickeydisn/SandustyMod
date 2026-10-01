
import { LOG, type ModConfig, type PanelState, type StructureConfig } from "../constants.ts";
import {
    addOrUpdateBufferEntry,
    addOrUpdateContact,
    addOrUpdateCustomProcess,
    addOrUpdateElement,
    addOrUpdateEnergyNetwork,
    addOrUpdateEnergyType,
    addOrUpdateExcavationProfile,
    addOrUpdateInputBinding,
    addOrUpdateInteraction,
    addOrUpdateItem,
    addOrUpdateModifier,
    addOrUpdatePlacementConfig,
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
    removeBufferEntry,
    removeContact,
    removeCustomProcess,
    removeElement,
    removeEnergyNetwork,
    removeEnergyType,
    removeExcavationProfile,
    removeInputBinding,
    removeInteraction,
    removeItem,
    removeModifier,
    removePlacementConfig,
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
import { React as HostReact } from "../api.ts";
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
    sectionsToReveal,
    shapeToText,
    type Tab,
    validateForm,
} from "./schema.ts";


import type { SelectorHandle } from "./definition/types.ts";
import type { ContentKind } from "../handler/core/handler-registry.ts";


const CONTENT_LISTERS: Record<ContentKind, () => Opt[]> = {
    element: () => listElements(),
    structure: () => listStructures(),
    terrain: () => listTerrains(),
};
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
    type SelectorReact,
    type SelectorState,
} from "./panel/component/selector/selector.ts";
import { renderActionList } from "./action-list-control.ts";
import { renderProjectileOption } from "./projectile-option-control.ts";
import { renderProcessRef } from "./process-ref-control.ts";
import { listFor } from "./panel/index.ts";
import { attachedTo, isInlineCatalogue, parentOf } from "./panel/attach.ts";
import {
    handlerDoc,
    listBuildModeTypes,
    listElements,
    listStructures,
    listTerrains,
    type Opt,
    searchLibraryAssets,
} from "../catalog.ts";
import * as S from "./styles.ts";
import { emptyViewState, LIST_DEFAULTS, type ViewMode } from "./viewstate.ts";
import { clampChip, exceedsSlop } from "./drag.ts";
import {
    type FixedCatalogue,
    type HandlersTabState,
    initialHandlersState,
    renderActions,
    renderFixedCatalogue,
    renderUpgradeActions,
} from "./panel/handlers.ts";
import { renderHelp } from "./panel/help.ts";
import { renderConfigMap } from "./config-map.ts";
import { DEFAULT_UNLOCK_NODE, techUnlockStructureIds, unlockLine } from "./tech-link.ts";
import { renderDraws } from "./panel/draws.ts";



import { getDrawTab as getSpriteEditorTab } from "../sprite-editor/index.ts";



import {
    currentProcessRegistry,
    processProblem,
    ProcessRegistry,
    setProcessRegistry,
} from "../handler/custom-process/index.ts";


const HANDLER_SCREENS = {
    action: renderActions,
    upgradeAction: renderUpgradeActions,
} as const;


function safeJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}


export function resolveCat(raw: unknown): Tab {
    if (typeof raw === "string" && CATEGORY_META[raw as Tab]) {
        const tab = raw as Tab;
        
        
        
        
        if (isInlineCatalogue(tab)) return parentOf(tab) ?? tab;
        return tab;
    }
    console.warn(
        `${LOG} unknown category ${describeValue(raw)} — falling back to Elements`,
    );
    return "elements";
}


function describeValue(v: unknown): string {
    if (v === null) return "null";
    if (typeof v !== "object") return String(v);
    const name = (v as { constructor?: { name?: string } }).constructor?.name;
    return name ? `<${name}>` : Object.prototype.toString.call(v);
}

type Mode = ViewMode;


const CHIP_W = 150;
const CHIP_H = 40;

type UpsertFn = (entry: never) => ModConfig;
type RemoveFn = (id: string) => ModConfig;


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
    customProcess: addOrUpdateCustomProcess,
    behaviors: addOrUpdateStructureBehavior,
    placementConfigs: addOrUpdatePlacementConfig,
    signals: addOrUpdateSignal,
    triggers: addOrUpdateTrigger,
    sprites: addOrUpdateSprite,
    networks: addOrUpdateEnergyNetwork,
    categories: addOrUpdateUpgradeCategory,
    inputs: addOrUpdateInputBinding,
    buffers: addOrUpdateBufferEntry,
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
    customProcess: removeCustomProcess,
    behaviors: removeStructureBehavior,
    placementConfigs: removePlacementConfig,
    signals: removeSignal,
    triggers: removeTrigger,
    sprites: removeSprite,
    networks: removeEnergyNetwork,
    categories: removeUpgradeCategory,
    inputs: removeInputBinding,
    buffers: removeBufferEntry,
};

function entriesOf(cfg: ModConfig, cat: Tab): Record<string, unknown>[] {
    const key = CATEGORY_META[cat].configKey;
    if (!key) return [];
    const arr = (cfg as unknown as Record<string, unknown>)[key];
    return Array.isArray(arr) ? (arr as Record<string, unknown>[]) : [];
}


export function createPanelComponent(defaultMinimized = true) {
    
    
    
    
    
    const React = HostReact;
    if (!React) {
        console.error(`${LOG} sandkit.react unavailable — panel disabled`);
        return () => null;
    }
    
    
    
    
    const { useState, useRef, useCallback, useMemo } = React;
    const h = React.createElement.bind(React) as (...args: unknown[]) => unknown;

    function Panel() {
        const [panel, setPanel] = useState<PanelState>(() => loadPanelState(defaultMinimized));
        const [cfg, setCfg] = useState<ModConfig>(() => {
            const loaded = loadConfig();
            
            
            
            
            
            setProcessRegistry(new ProcessRegistry(loaded.processes ?? []));
            return loaded;
        });
        const [groupKey, setGroupKey] = useState("content");
        const [rawCat, setCat] = useState<Tab>("elements");
        const [mode, setMode] = useState<Mode>("list");
        const [form, setForm] = useState<Record<string, string>>({});
        const [editingId, setEditingId] = useState<string | null>(null);
        const [confirmId, setConfirmId] = useState<string | null>(null);
        
        const revealed = useRef<Set<string>>(new Set());
        
        const [listQuery, setListQuery] = useState(LIST_DEFAULTS.listQuery);
        
        const [listOwner, setListOwner] = useState<OwnerKey | "all">(LIST_DEFAULTS.listOwner);
        
        const [listHidden, setListHidden] = useState(LIST_DEFAULTS.listHidden);
        
        const [openRow, setOpenRow] = useState<string | null>(null);
        
        const [nativeOpen, setNativeOpen] = useState<Record<string, boolean>>({});
        
        const [selectorState, setSelectorState] = useState<Record<string, SelectorState>>({});

        
        const selectorHandle = useMemo<SelectorHandle>(
            () => ({
                read: (key) => selectorState[`param:${key}`],
                write: (key, patch) =>
                    setSelectorState((prev) => ({
                        ...prev,
                        [`param:${key}`]: { ...prev[`param:${key}`], ...patch },
                    })),
                renderParam: (req) => {
                    if (!req.content) return null;
                    const list = CONTENT_LISTERS[req.content];
                    
                    
                    
                    
                    
                    
                    if (!list) throw new Error(`no content lister for "${req.content}"`);
                    return renderSelector({
                        react: { h: req.h as SelectorReact["h"] },
                        value: req.value,
                        
                        
                        options: list(),
                        multiple: false,
                        onChange: req.onChange,
                        placeholder: req.placeholder,
                        state: req.state,
                        onState: req.onState,
                    });
                },
            }),
            [selectorState],
        );
        
        const [helpFilter, setHelpFilter] = useState("all");
        const [jsonText, setJsonText] = useState("");
        const [jsonError, setJsonError] = useState<string | null>(null);
        
        const [handlerTab, setHandlerTab] = useState<HandlersTabState>(() =>
            initialHandlersState()
        );
        
        const [libQuery, setLibQuery] = useState<Record<string, string>>({});
        
        const [attachedQuery, setAttachedQuery] = useState<Record<string, string>>({});
        
        const [catalogueOnlyUsed, setCatalogueOnlyUsed] = useState<Record<string, boolean>>({});
        const drag = useRef<{
            ox: number;
            oy: number;
            active: boolean;
            
            moved: boolean;
            startX: number;
            startY: number;
        }>({ ox: 0, oy: 0, active: false, moved: false, startX: 0, startY: 0 });
        
        const suppressClick = useRef(false);

        const group = MENU_GROUPS.find((g) => g.key === groupKey) ?? MENU_GROUPS[0];
        
        
        
        
        
        
        
        
        
        
        
        const cat = resolveCat(rawCat);
        const meta = CATEGORY_META[cat];
        
        
        
        
        
        const navCat = parentOf(cat) ?? cat;
        const navGroup = MENU_GROUPS.find((g) => g.categories.includes(navCat)) ?? group;

        
        const errors = useMemo<Record<string, string>>(
            () => (mode === "form" ? validateForm(cat, form) : {}),
            [mode, cat, form],
        );
        const errorCount = Object.keys(errors).length;

        
        const nativeBox = (f: FieldSpec, opts: Opt[]): unknown => {
            if (f.kind !== "select" && f.kind !== "multiselect") return null;
            if (!opts.length) return null;
            const game = opts.filter((o) => o.source === "game");
            const mine = opts.filter((o) => o.source === "mod");
            
            
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

        
        const resetView = useCallback(() => {
            
            
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
            
            
            
            setCat(isInlineCatalogue(next) ? (parentOf(next) ?? next) : next);
        };

        
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
        
        
        
        
        

        
        const startNew = (tab: Tab = cat) => {
            setEditingId(null);
            setConfirmId(null);
            setCat(tab);
            revealed.current = new Set();
            
            
            
            
            setForm(newEntryForm(tab));
            setMode("form");
        };

        const startEdit = (entry: Record<string, unknown>, tab: Tab = cat) => {
            setConfirmId(null);
            const id = typeof entry.id === "string" ? entry.id : null;
            setEditingId(id);
            revealed.current = new Set();
            const next = entryToForm(tab, entry);
            
            
            
            
            
            if (tab === "techs" && id) {
                const ids = techUnlockStructureIds(id, loadConfig());
                if (ids.length > 0) {
                    next.unlockStructures = formatIdList(
                        Array.from(new Set([...parseIdList(next.unlockStructures), ...ids])),
                    );
                }
            }
            setCat(tab);
            setForm(next);
            setMode("form");
        };

        const cancelForm = () => {
            
            
            
            const home = parentOf(cat);
            if (home) setCat(home);
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
            
            
            
            
            refresh();
            skApi.toast(`${meta.label} saved — reload the game to apply it.`);
            cancelForm();
        };

        
        const requestRemove = (id: string, tab: Tab = cat) => {
            const key = `${tab}:${id}`;
            if (confirmId !== key) {
                setConfirmId(key);
                return;
            }
            const remove = REMOVE[tab];
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

        
        const renderLibrary = (f: FieldSpec, val: string, err?: string) => {
            const q = libQuery[f.key] ?? "";
            
            const matches = searchLibraryAssets(q);
            const shown = matches.slice(0, 120);

            
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

            
            
            
            
            
            const own = definitionFor(cat)?.panel?.renderField?.({
                h,
                form,
                cfg,
                setField,
                selector: selectorHandle,
                field: f,
                value: val,
                error: err,
                locked,
                
                
                tab: cat,
            });
            let control: unknown = own ?? null;
            
            
            
            
            
            
            
            
            
            if (control === null && f.kind === "actionList") {
                
                
                
                control = renderActionList({
                    h,
                    form,
                    cfg,
                    setField,
                    selector: selectorHandle,
                    field: f,
                    value: val,
                    error: err,
                    locked,
                    tab: cat,
                });
            }
            if (control === null && f.kind === "projectileOption") {
                
                
                
                control = renderProjectileOption({
                    h,
                    form,
                    cfg,
                    setField,
                    selector: selectorHandle,
                    field: f,
                    value: val,
                    error: err,
                    locked,
                    tab: cat,
                });
            }
            if (control === null && f.kind === "processRef") {
                
                
                
                control = renderProcessRef({
                    h,
                    form,
                    cfg,
                    setField,
                    selector: selectorHandle,
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
                
                
                
                nativeBox(f, opts),
                
                f.kind === "select" && f.key.endsWith("Key") && val
                    ? handlerDoc(val) ? h("div", { style: S.hintBelow }, handlerDoc(val)) : null
                    : err
                    ? h("div", { style: S.errorText }, err)
                    : f.hint
                    ? h("div", { style: S.hintBelow }, f.hint)
                    : null,
            );
        };

        
        const entryLabel = (entry: Record<string, unknown>): string => {
            const name = typeof entry.name === "string" ? entry.name : "";
            const id = typeof entry.id === "string" ? entry.id : "";
            return name || id;
        };

        
        const renderAttachedList = (child: Tab) => {
            
            
            
            
            
            if (isInlineCatalogue(child)) {
                return h(
                    "div",
                    { key: child, style: { ...S.sectionBox, marginBottom: 8 } },
                    renderFixedCatalogue(child as FixedCatalogue, {
                        h: h as never,
                        cfg: cfg as unknown as Record<string, unknown>,
                        query: attachedQuery[child] ?? "",
                        setQuery: (next: string) =>
                            setAttachedQuery((p) => ({ ...p, [child]: next })),
                        onlyUsed: catalogueOnlyUsed[child] ?? false,
                        setOnlyUsed: (next: boolean) =>
                            setCatalogueOnlyUsed((p) => ({ ...p, [child]: next })),
                    }),
                );
            }

            const childMeta = CATEGORY_META[child];
            const childSpec = listFor(child);
            
            
            
            const childRows = mergeRows(
                entriesOf(cfg, child),
                childSpec?.discover?.() ?? [],
                child,
            );
            const q = attachedQuery[child] ?? "";
            const childShown = filterRows(
                childRows,
                q,
                childSpec?.searchText,
                "all",
                false,
            );
            
            
            const openKey = `${child} `;

            return h(
                "div",
                { key: child, style: S.sectionBox },
                h(
                    "div",
                    
                    
                    { style: S.listHeadingRow },
                    childMeta.label,
                    h("span", { style: S.chipCount }, String(childRows.length)),
                ),
                h(
                    "div",
                    { style: S.listFilterBar },
                    h("input", {
                        type: "text",
                        style: { ...S.input, flex: 1, minWidth: 120 },
                        value: q,
                        placeholder: `Filter ${childMeta.label.toLowerCase()}…`,
                        onChange: (e: { target: { value: string } }) =>
                            setAttachedQuery((p) => ({ ...p, [child]: e.target.value })),
                    }),
                    h(
                        "button",
                        { style: S.btnPrimary, onClick: () => startNew(child) },
                        "+ New",
                    ),
                ),
                h("div", { style: S.hintBelow }, childMeta.blurb),
                childShown.length === 0
                    ? h(
                        "div",
                        { style: { ...S.emptyState, margin: "8px 0" } },
                        childRows.length === 0
                            ? `No ${childMeta.label.toLowerCase()} yet — press “+ New” to add one.`
                            : `No ${childMeta.label.toLowerCase()} match “${q}”.`,
                    )
                    : h(
                        "div",
                        { style: { ...S.listScroll, padding: "0" } },
                        ...childShown.map((row) =>
                            h(
                                "div",
                                { key: row.id },
                                renderListRow({
                                    h,
                                    form,
                                    cfg,
                                    setField,
                                    row,
                                    expanded: openRow === openKey + row.id,
                                    toggle: () =>
                                        setOpenRow(
                                            openRow === openKey + row.id ? null : openKey + row.id,
                                        ),
                                    edit: row.origin === "mod" && row.entry
                                        ? () =>
                                            startEdit(row.entry as Record<string, unknown>, child)
                                        : undefined,
                                    remove: row.origin === "mod"
                                        ? () => requestRemove(row.id, child)
                                        : undefined,
                                    confirming: row.origin === "mod" &&
                                        confirmId === `${child}:${row.id}`,
                                }, childSpec ?? {}),
                            )
                        ),
                    ),
            );
        };

        const renderList = () => {
            const listSpec = listFor(cat);
            
            
            const attached = attachedTo(cat).filter((c) => parentOf(c) === cat);
            
            
            
            
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
            
            
            const hiddenHere = countHiddenRows(rows, listOwner);

            const ownerChip = (key: OwnerKey, n: number) =>
                h(
                    "button",
                    {
                        key: `owner:${key}`,
                        
                        
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
                        
                        
                        
                        onClick: () => setListOwner(listOwner === key ? "all" : key),
                    },
                    ownerLabel(key),
                    h("span", { style: S.chipCount }, String(n)),
                );

            
            
            
            
            
            
            
            
            
            
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
                    
                    
                    hiddenHere ? h("span", { style: S.chipCount }, String(hiddenHere)) : null,
                );

            return h(
                "div",
                
                
                
                
                { style: S.screen },
                h(
                    "div",
                    { style: S.screenHead },
                    h("span", { style: S.screenTitle }, meta.label),
                    h("span", { style: S.screenBlurb }, meta.blurb),
                    
                    
                    
                    
                    h(
                        "span",
                        { style: S.chipCount },
                        `${ownerCounts.get("own") ?? 0} in config`,
                    ),
                    
                    
                    
                    
                    
                    
                    
                    
                    h(
                        "button",
                        { style: S.btnPrimary, onClick: () => startNew() },
                        "+ New",
                    ),
                ),
                
                
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
                                    
                                    
                                    edit: row.origin === "mod" && row.entry
                                        ? () => startEdit(row.entry as Record<string, unknown>)
                                        : undefined,
                                    remove: row.origin === "mod"
                                        ? () => requestRemove(row.id)
                                        : undefined,
                                    confirming: row.origin === "mod" &&
                                        confirmId === `${cat}:${row.id}`,
                                }, listSpec ?? {}),
                            )
                        ),
                    ),
                
                
                
                ...(attached.length === 0 ? [] : [
                    h(
                        "div",
                        { key: "__attached", style: { ...S.listScroll, padding: "0 10px 14px" } },
                        ...attached.map((child) => renderAttachedList(child)),
                    ),
                ]),
            );
        };

        const renderForm = () => {
            
            
            
            const sections = sectionsFor(cat, form);
            
            
            
            
            
            
            
            
            
            for (const title of sectionsToReveal(sections, errors)) {
                revealed.current.add(title);
            }
            const revealedSet = revealed.current;
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
                
                
                
                
                ...(definitionFor(cat)?.panel?.renderHeader
                    ? [definitionFor(cat)!.panel!.renderHeader!({ h, form, cfg, setField })]
                    : []),
                ...sections.map((sec) =>
                    h(
                        "details",
                        {
                            key: sec.title,
                            style: S.sectionBox,
                            
                            
                            
                            
                            
                            open: revealedSet.has(sec.title),
                        },
                        h(
                            "summary",
                            { style: S.sectionSummary },
                            h("span", { style: S.sectionTitle }, sec.title),
                            h("span", { style: S.sectionCount }, String(sec.fields.length)),
                        ),
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
            } catch {  }
            if (panel.x < 0) {
                persistPanel({ ...panel, x: Math.round(rect.left), y: Math.round(rect.top) });
            }
        };

        const onDragMove = (e: { clientX: number; clientY: number }) => {
            if (!drag.current.active) return;
            
            
            
            if (exceedsSlop(drag.current.startX, drag.current.startY, e.clientX, e.clientY)) {
                drag.current.moved = true;
            }
            if (!drag.current.moved) return;
            
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
            
            
            if (moved) suppressClick.current = true;
            setPanel((p) => {
                savePanelState(p);
                return p;
            });
        };

        
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
                    ...navGroup.categories.map((c) => {
                        const m = CATEGORY_META[c];
                        const n = m.configKey ? entriesOf(cfg, c).length : 0;
                        return h(
                            "button",
                            {
                                key: c,
                                style: c === navCat ? S.chipActive : S.chip,
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
                        
                        
                        
                        
                        
                        
                        key: `${cat}:${mode}`,
                    },
                    
                    
                    
                    
                    
                    
                    cat === "json"
                        ? renderJson()
                        : cat === "spriteEditor"
                        ? h(getSpriteEditorTab(), { onChange: refresh })
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


let _panelInstance: (() => unknown) | null = null;

function getPanelInstance(startMinimized: boolean): () => unknown {
    if (_panelInstance) return _panelInstance;
    _panelInstance = createPanelComponent(startMinimized);
    return _panelInstance;
}


export function ConfiguratorPanel(startMinimized = true): unknown {
    const React = HostReact;
    if (!React?.createElement) {
        console.error(`${LOG} ConfiguratorPanel: no react`);
        return null;
    }
    const h = React.createElement.bind(React);

    try {
        const Panel = getPanelInstance(startMinimized);
        return h(Panel as never, {});
    } catch (e) {
        console.error(`${LOG} ConfiguratorPanel mount failed`, e);
    }

    return h(
        "div",
        {
            style: {
                position: "fixed",
                right: 16,
                bottom: 16,
                zIndex: 100000,
                background: "rgba(120,30,30,0.95)",
                color: "#ffe8e8",
                border: "1px solid rgba(255,140,140,0.8)",
                borderRadius: "10px",
                padding: "10px 14px",
                font: "13px/1.4 system-ui,sans-serif",
                pointerEvents: "auto",
            },
        },
        `${LOG} panel failed to mount — see console`,
    );
}
