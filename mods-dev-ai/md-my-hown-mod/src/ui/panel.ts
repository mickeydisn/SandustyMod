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
import {
    LOG,
    type ModConfig,
    type PanelState,
} from "../constants.ts";
import {
    loadConfig,
    loadPanelState,
    savePanelState,
    addOrUpdateElement,
    removeElement,
    addOrUpdateStructure,
    removeStructure,
    addOrUpdateItem,
    removeItem,
    addOrUpdateRecipe,
    removeRecipe,
    addOrUpdateProcessing,
    removeProcessing,
    addOrUpdateContact,
    removeContact,
    addOrUpdateInteraction,
    removeInteraction,
    addOrUpdateModifier,
    removeModifier,
    addOrUpdateTerrain,
    removeTerrain,
    addOrUpdateTech,
    removeTech,
    addOrUpdateUpgrade,
    removeUpgrade,
    addOrUpdateProjectile,
    removeProjectile,
    addOrUpdateEnergyType,
    removeEnergyType,
    addOrUpdateExcavationProfile,
    removeExcavationProfile,
    addOrUpdateStructureBehavior,
    removeStructureBehavior,
    addOrUpdateSignal,
    removeSignal,
    addOrUpdateTrigger,
    removeTrigger,
    addOrUpdateSprite,
    removeSprite,
    exportConfigJson,
    importConfigJson,
} from "../config/store.ts";
import { applyConfig, reapplyFromStorage } from "../register/apply.ts";
import { api as skApi } from "../packages/mysandkit.ts";
import { api, React as HostReact } from "../api.ts";
import { isToolSelected } from "../select.ts";
import {
    CATEGORY_META,
    type FieldSpec,
    type Tab,
    MENU_GROUPS,
    entryToForm,
    formDefaults,
    formToEntry,
    isActive,
    resolveOptions,
    sectionsFor,
    validateForm,
} from "./schema.ts";
import { listElements } from "../catalog.ts";
import * as S from "./styles.ts";

/** External expand request (hotkey). Panel polls via useEffect. */
let expandRequest = 0;
export function forceExpandPanel(): void {
    expandRequest += 1;
    (globalThis as any).__mdMyHownPanelExpand = expandRequest;
    console.log(`${LOG} forceExpandPanel #${expandRequest}`);
}

type Mode = "list" | "form";

type UpsertFn = (entry: never) => ModConfig;
type RemoveFn = (id: string) => ModConfig;

const UPSERT: Partial<Record<Tab, UpsertFn>> = {
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
    upgrades: addOrUpdateUpgrade,
    projectiles: addOrUpdateProjectile,
    energy: addOrUpdateEnergyType,
    excavation: addOrUpdateExcavationProfile,
    behaviors: addOrUpdateStructureBehavior,
    signals: addOrUpdateSignal,
    triggers: addOrUpdateTrigger,
    sprites: addOrUpdateSprite,
};

const REMOVE: Partial<Record<Tab, RemoveFn>> = {
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
    upgrades: removeUpgrade,
    projectiles: removeProjectile,
    energy: removeEnergyType,
    excavation: removeExcavationProfile,
    behaviors: removeStructureBehavior,
    signals: removeSignal,
    triggers: removeTrigger,
    sprites: removeSprite,
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
        const [jsonText, setJsonText] = useState("");
        const [jsonError, setJsonError] = useState<string | null>(null);
        const drag = useRef<{ ox: number; oy: number; active: boolean }>({ ox: 0, oy: 0, active: false });

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

        const refresh = useCallback(() => setCfg(loadConfig()), []);

        const setField = useCallback((key: string, value: string) => {
            setForm((prev) => ({ ...prev, [key]: value }));
        }, []);

        const goGroup = (key: string) => {
            const g = MENU_GROUPS.find((x) => x.key === key);
            if (!g) return;
            setGroupKey(key);
            setCat(g.categories[0]);
            setMode("list");
            setConfirmId(null);
            setEditingId(null);
            setForm({});
        };

        const goCategory = (next: Tab) => {
            setCat(next);
            setMode("list");
            setConfirmId(null);
            setEditingId(null);
            setForm({});
        };

        const startNew = () => {
            setEditingId(null);
            setConfirmId(null);
            setForm(formDefaults(cat));
            setMode("form");
        };

        const startEdit = (entry: Record<string, unknown>) => {
            setConfirmId(null);
            setEditingId(typeof entry.id === "string" ? entry.id : null);
            setForm(entryToForm(cat, entry));
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
                const opts = resolveOptions(f);
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

            return h(
                "div",
                { key: f.key, style: wide ? S.fieldCellWide : S.fieldCell },
                labelRow,
                control,
                err
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
                                            j === i ? { ...r, elementType: e.target.value } : r,
                                        ),
                                    );
                                },
                            },
                            h("option", { value: "" }, "— element —"),
                            ...elements.map((o) =>
                                h("option", { key: o.value, value: o.value }, o.label),
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
                                        j === i ? { ...r, chance: Number(e.target.value) } : r,
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
                    ),
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
                                    h("button", { style: S.btn, onClick: () => startEdit(entry) }, "Edit"),
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
                ...sections.map((sec) =>
                    h(
                        "div",
                        { key: sec.title, style: S.sectionBox },
                        h("div", { style: S.sectionTitle }, sec.title),
                        h("div", { style: S.fieldGrid }, ...sec.fields.map((f) => renderField(f))),
                    ),
                ),
                h(
                    "div",
                    { style: S.footerBar },
                    h(
                        "span",
                        { style: { ...S.footerStatus, color: errorCount ? "#ff9b9b" : "#9fe0b0" } },
                        errorCount
                            ? `⚠ ${errorCount} issue${errorCount > 1 ? "s" : ""} — fix before saving`
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
                jsonError
                    ? h("div", { style: S.errorText }, jsonError)
                    : h(
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
            // globalThis, not window: the mod runs in the game host, not a browser.
            const vw = (globalThis as { innerWidth?: number }).innerWidth ?? 1280;
            const vh = (globalThis as { innerHeight?: number }).innerHeight ?? 720;
            const x = Math.max(4, Math.min(vw - 140, e.clientX - drag.current.ox));
            const y = Math.max(4, Math.min(vh - 40, e.clientY - drag.current.oy));
            setPanel((p) => ({ ...p, x, y }));
        };

        const onDragUp = () => {
            if (!drag.current.active) return;
            drag.current.active = false;
            setPanel((p) => {
                savePanelState(p);
                return p;
            });
        };

        const toggleMin = () => persistPanel({ ...panel, minimized: !panel.minimized });

        const applyNow = () => {
            applyConfig(loadConfig());
            skApi.toast("Config applied to game");
        };

        const totalEntries = MENU_GROUPS.flatMap((g) => g.categories).reduce(
            (n, c) => n + (CATEGORY_META[c].configKey ? entriesOf(cfg, c).length : 0),
            0,
        );

        const posStyle =
            panel.x >= 0 && panel.y >= 0
                ? { left: panel.x, top: panel.y, right: "auto", bottom: "auto" }
                : {};

        if (panel.minimized) {
            return h(
                "div",
                { style: { ...S.panelRoot, ...posStyle } },
                h(
                    "div",
                    { style: S.minimizedChip, onClick: toggleMin },
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
                        onPointerDown: onDragDown,
                        onPointerMove: onDragMove,
                        onPointerUp: onDragUp,
                        onPointerCancel: onDragUp,
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
                        ),
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
                    { style: S.body },
                    cat === "json"
                        ? renderJson()
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
        "My Own Mod — click / Alt+M",
    );
}







