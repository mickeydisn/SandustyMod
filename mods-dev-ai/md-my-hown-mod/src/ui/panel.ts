/**
 * Movable, minimizable config panel.
 * - No item required (global overlay).
 * - Minimized by default.
 * - Position persisted via api.storage.
 */
import {
    LOG,
    MOD_ID,
    type ModConfig,
    type ElementConfig,
    type StructureConfig,
    type ItemConfig,
    type RecipeConfig,
    type ProcessingConfig,
    type PanelState,
} from "../constants.ts";
import {
    loadConfig,
    saveConfig,
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
    addOrUpdateTerrain, removeTerrain,
    addOrUpdateTech, removeTech,
    addOrUpdateUpgradeCategory, removeUpgradeCategory,
    addOrUpdateUpgrade, removeUpgrade,
    addOrUpdateProjectile, removeProjectile,
    addOrUpdateEnergyType, removeEnergyType,
    addOrUpdateExcavationProfile, removeExcavationProfile,
    addOrUpdateStructureBehavior, removeStructureBehavior,
    addOrUpdateSignal, removeSignal,
    addOrUpdateTrigger, removeTrigger,
    addOrUpdateSprite, removeSprite,
    exportConfigJson,
    importConfigJson,
} from "../config/store.ts";
import { FIELD_HELP, type ContactReactionConfig, type InteractionConfig, type ModifierConfig } from "../constants.ts";
import { listHandlerKeys } from "../hooks/index.ts";
import { applyConfig, reapplyFromStorage } from "../register/apply.ts";
import { api as skApi } from "../packages/mysandkit.ts";
import { api, React as HostReact } from "../api.ts";
import { isToolSelected } from "../select.ts";
import { fieldsForTab, type FieldDef, type Opt } from "../catalog.ts";
const apiMerged = skApi; // storage still via mysandkit

import * as S from "./styles.ts";


/** External expand request (hotkey). Panel polls via useEffect. */
let expandRequest = 0;
export function forceExpandPanel(): void {
    expandRequest += 1;
    (globalThis as any).__mdMyHownPanelExpand = expandRequest;
    console.log("[md-my-hown-mod] forceExpandPanel #" + expandRequest);
}

type Tab = "elements" | "structures" | "items" | "recipes" | "processing" | "contacts" | "interactions" | "modifiers" | "terrains" | "techs" | "upgrades" | "projectiles" | "energy" | "excavation" | "behaviors" | "signals" | "triggers" | "sprites" | "json";

type Props = {
    defaultMinimized?: boolean;
};

export function createPanelComponent(defaultMinimized = true) {
    const React = HostReact ?? api.react;
    if (!React) {
        console.error(`${LOG} sandkit.react unavailable — panel disabled`);
        return () => null;
    }
    const { useState, useEffect, useRef, useCallback } = React;

    function Panel(_props: Props) {
        const [panel, setPanel] = useState<PanelState>(() => loadPanelState(defaultMinimized));
        const [cfg, setCfg] = useState<ModConfig>(() => loadConfig());
        const [tab, setTab] = useState<Tab>("elements");
        const [editJson, setEditJson] = useState("");
        const [form, setForm] = useState<Record<string, string>>({});
        const [editingId, setEditingId] = useState<string | null>(null);
        const drag = useRef<{ ox: number; oy: number; active: boolean }>({ ox: 0, oy: 0, active: false });

        // Hotkey / external expand
        useEffect(() => {
            let last = 0;
            const id = setInterval(() => {
                const n = (globalThis as any).__mdMyHownPanelExpand | 0;
                if (n && n !== last) {
                    last = n;
                    setPanel((p) => {
                        const next = { ...p, minimized: false, x: Math.max(8, p.x || 24), y: Math.max(8, p.y || 80) };
                        savePanelState(next);
                        return next;
                    });
                }
            }, 200);
            return () => clearInterval(id);
        }, []);

        const persistPanel = useCallback((next: PanelState) => {
            setPanel(next);
            savePanelState(next);
        }, []);

        const refresh = useCallback(() => {
            setCfg(loadConfig());
        }, []);

        const resolveOpts = (f: FieldDef): Opt[] => {
            if (!f.options) return [];
            return typeof f.options === "function" ? f.options() : f.options;
        };

        const renderField = (f: FieldDef) => {
            const React = HostReact ?? api.react;
            if (!React) return null;
            const h = React.createElement.bind(React);
            const val = form[f.key] ?? "";
            const set = (v: string) => setForm((prev) => ({ ...prev, [f.key]: v }));

            let control: unknown = null;
            if (f.type === "select") {
                const opts = resolveOpts(f);
                control = h(
                    "select",
                    {
                        style: { ...S.input, cursor: "pointer" },
                        value: val,
                        onChange: (e: any) => set(e.target.value),
                    },
                    h("option", { value: "" }, "— select —"),
                    ...opts.map((o) =>
                        h(
                            "option",
                            { key: o.value, value: o.value },
                            o.color ? `■ ${o.label}` : o.label,
                        ),
                    ),
                );
            } else if (f.type === "color") {
                const hex = val && val.startsWith("#") ? val : val ? `#${val}` : "#888888";
                control = h(
                    "div",
                    { style: { display: "flex", gap: 8, alignItems: "center" } },
                    h("input", {
                        type: "color",
                        value: /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#888888",
                        onChange: (e: any) => set(e.target.value),
                        style: { width: 42, height: 28, border: "none", background: "transparent", cursor: "pointer" },
                    }),
                    h("input", {
                        style: S.input,
                        value: val,
                        placeholder: "#rrggbb",
                        onChange: (e: any) => set(e.target.value),
                    }),
                );
            } else if (f.type === "bool") {
                control = h(
                    "select",
                    {
                        style: S.input,
                        value: val === "false" || val === "0" ? "false" : "true",
                        onChange: (e: any) => set(e.target.value),
                    },
                    h("option", { value: "true" }, "Yes"),
                    h("option", { value: "false" }, "No"),
                );
            } else if (f.type === "number") {
                control = h("input", {
                    type: "number",
                    style: S.input,
                    value: val,
                    placeholder: f.placeholder || "",
                    onChange: (e: any) => set(e.target.value),
                });
            } else if (f.type === "textarea") {
                control = h("textarea", {
                    style: S.textarea,
                    value: val,
                    placeholder: f.placeholder || "",
                    onChange: (e: any) => set(e.target.value),
                });
            } else {
                control = h("input", {
                    style: S.input,
                    value: val,
                    placeholder: f.placeholder || "",
                    onChange: (e: any) => set(e.target.value),
                });
            }

            return h(
                "label",
                { key: f.key, style: S.label },
                f.label,
                control,
                f.hint ? h("span", { style: S.hint }, f.hint) : null,
            );
        };


        // Drag handlers
        const onTitleDown = (e: any) => {
            if (e.button !== 0) return;
            drag.current = { ox: e.clientX - panel.x, oy: e.clientY - panel.y, active: true };
            e.preventDefault();
        };

        useEffect(() => {
            const onMove = (e: MouseEvent) => {
                if (!drag.current.active) return;
                const x = Math.max(0, e.clientX - drag.current.ox);
                const y = Math.max(0, e.clientY - drag.current.oy);
                setPanel((p) => ({ ...p, x, y }));
            };
            const onUp = () => {
                if (!drag.current.active) return;
                drag.current.active = false;
                setPanel((p) => {
                    savePanelState(p);
                    return p;
                });
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
            return () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
            };
        }, []);

        const toggleMin = () => {
            persistPanel({ ...panel, minimized: !panel.minimized });
        };

        const openJsonTab = () => {
            setEditJson(exportConfigJson());
            setTab("json");
        };

        const applyJson = () => {
            try {
                importConfigJson(editJson);
                refresh();
                reapplyFromStorage();
                api.toast("Config imported & applied");
            } catch (e) {
                console.error(`${LOG} import failed`, e);
                api.toast("Invalid JSON");
            }
        };

        const applyNow = () => {
            applyConfig(loadConfig());
            api.toast("Config applied to game");
        };

        // ── Form helpers ───────────────────────────────────────────────────
        const startEdit = (category: Tab, entry: { id: string; [k: string]: unknown }) => {
            setEditingId(entry.id);
            const f: Record<string, string> = { id: entry.id };
            if (category === "elements") {
                const el = entry as ElementConfig;
                f.name = String(el.name ?? "");
                f.description = String(el.description ?? "");
                f.matterType = String(el.matterType ?? "powder");
                f.density = el.density != null ? String(el.density) : "";
                f.metaColor = el.metaColor != null ? String(el.metaColor) : "";
            } else if (category === "structures") {
                const st = entry as StructureConfig;
                f.name = String(st.name ?? "");
                f.description = String(st.description ?? "");
                f.categoryKey = String(st.categoryKey ?? "blocks");
            } else if (category === "items") {
                const it = entry as ItemConfig;
                f.name = String(it.name ?? "");
                f.description = String(it.description ?? "");
                f.itemType = String(it.itemType ?? "Mod");
            } else if (category === "recipes") {
                const r = entry as RecipeConfig;
                f.kind = String(r.kind ?? "shaker");
                f.structureType = String(r.structureType ?? "");
                f.input = String(r.input ?? "");
                f.output = String(r.output ?? "");
            } else if (category === "processing") {
                const p = entry as ProcessingConfig;
                f.structureId = String(p.structureId ?? "");
            }
            setForm(f);
        };

        const clearForm = () => {
            setEditingId(null);
            setForm({});
        };

        const saveForm = () => {
            const suffix = (form.idSuffix || form.id || "").trim();
            if (!suffix) {
                console.warn(`${LOG} id required`);
                return;
            }
            const fullId = suffix.includes(":") ? suffix : `${MOD_ID}:${suffix}`;
            let body: any = {};
            try {
                if (form.bodyJson) body = JSON.parse(form.bodyJson);
            } catch (e) {
                console.warn(`${LOG} bodyJson parse failed`, e);
            }

            if (tab === "elements") {
                addOrUpdateElement({
                    id: fullId,
                    name: form.name || fullId,
                    description: form.description || undefined,
                    matterType: form.matterType || "powder",
                    density: form.density ? Number(form.density) : undefined,
                    metaColor: form.metaColor || undefined,
                    ...body,
                });
            } else if (tab === "structures") {
                let shape: any = undefined;
                try { if (form.shapeJson) shape = JSON.parse(form.shapeJson); } catch { /* */ }
                addOrUpdateStructure({
                    id: fullId,
                    name: form.name || fullId,
                    description: form.description || undefined,
                    buildModes: form.buildMode ? [form.buildMode] : undefined,
                    shape,
                    ...body,
                });
            } else if (tab === "items") {
                addOrUpdateItem({
                    id: fullId,
                    name: form.name || fullId,
                    description: form.description || undefined,
                    itemType: form.itemType || "tool",
                    sprite: form.spriteId ? { id: form.spriteId } : body.sprite,
                    ...body,
                });
            } else if (tab === "recipes") {
                addOrUpdateRecipe({
                    id: fullId,
                    kind: form.kind || "shaker",
                    structureId: form.structureId || undefined,
                    input: form.inputElement ? { element: form.inputElement } : body.input,
                    output: form.outputElement
                        ? { element: form.outputElement, chance: form.outputChance ? Number(form.outputChance) : 1 }
                        : body.output,
                    ...body,
                });
            } else if (tab === "processing") {
                addOrUpdateProcessing({
                    id: fullId,
                    kind: form.kind || "structure",
                    structureId: form.structureId || undefined,
                    ...body,
                });
            } else if (tab === "contacts") {
                addOrUpdateContact({
                    id: fullId,
                    elementA: form.elementA || "",
                    elementB: form.elementB || "",
                    result: form.resultElement || undefined,
                    chance: form.chance ? Number(form.chance) : undefined,
                    ...body,
                } as any);
            } else if (tab === "interactions") {
                addOrUpdateInteraction({
                    id: fullId,
                    elementId: form.elementId || "",
                    interaction: body,
                });
            } else if (tab === "modifiers") {
                addOrUpdateModifier({
                    id: fullId,
                    hookId: form.hookId || "",
                    kind: form.kind === "modify" ? "modify" : "intercept",
                    handlerKey: form.handlerKey || undefined,
                    enabled: form.enabled !== "false",
                    notes: form.notes || undefined,
                });
            } else if (tab === "terrains") {
                addOrUpdateTerrain({
                    id: fullId,
                    name: form.name || fullId,
                    hp: form.hp ? Number(form.hp) : undefined,
                    metaColor: form.metaColor || undefined,
                    output: form.outputElement ? { elementType: form.outputElement } : body.output,
                    ...body,
                });
            } else if (tab === "techs") {
                addOrUpdateTech({
                    id: fullId,
                    name: form.name || fullId,
                    cost: form.cost ? Number(form.cost) : undefined,
                    currencyType: form.currencyType || undefined,
                    branch: form.branch || undefined,
                    ...body,
                });
            } else if (tab === "upgrades") {
                addOrUpdateUpgrade({
                    id: fullId,
                    itemId: form.itemId || fullId,
                    categoryId: form.categoryId || "tools",
                    upgrade: body.upgrade || { id: fullId, maxLevel: 1, costs: [100] },
                    ...body,
                });
            } else if (tab === "projectiles") {
                addOrUpdateProjectile({
                    id: fullId,
                    sprite: { id: form.spriteId || `${fullId}-sprite` },
                    getOptionsKey: form.getOptionsKey || undefined,
                    ...body,
                });
            } else if (tab === "energy") {
                addOrUpdateEnergyType({
                    id: fullId,
                    structureId: form.structureId || fullId,
                    type: form.type || "storage",
                    options: body,
                });
            } else if (tab === "excavation") {
                let pattern: any = [[1]];
                try { if (form.patternJson) pattern = JSON.parse(form.patternJson); } catch { /* */ }
                addOrUpdateExcavationProfile({
                    id: fullId,
                    power: form.power ? Number(form.power) : 10,
                    pattern,
                    options: body,
                });
            } else if (tab === "behaviors") {
                addOrUpdateStructureBehavior({
                    id: fullId,
                    kind: form.kind || "conveyor",
                    definition: body,
                });
            } else if (tab === "signals") {
                addOrUpdateSignal({
                    id: fullId,
                    kind: form.kind || "targets",
                    target: form.target || "",
                    handlerKey: form.handlerKey || undefined,
                });
            } else if (tab === "triggers") {
                addOrUpdateTrigger({
                    id: fullId,
                    triggerId: fullId,
                    interval: form.interval ? Number(form.interval) : 60,
                    handlerKey: form.handlerKey || undefined,
                    extra: body,
                });
            } else if (tab === "sprites") {
                addOrUpdateSprite({
                    id: fullId,
                    path: form.path || `assets/${suffix}.png`,
                    fromMod: form.fromMod !== "false",
                });
            }
            applyConfig();
            setForm({});
            setEditingId(null);
            refresh();
        };

        const doRemove = (category: Tab, id: string) => {
            if (category === "elements") removeElement(id);
            else if (category === "structures") removeStructure(id);
            else if (category === "items") removeItem(id);
            else if (category === "recipes") removeRecipe(id);
            else if (category === "processing") removeProcessing(id);
            else if (category === "contacts") removeContact(id);
            else if (category === "interactions") removeInteraction(id);
            else if (category === "modifiers") removeModifier(id);
            else if (category === "terrains") removeTerrain(id);
            else if (category === "techs") removeTech(id);
            else if (category === "upgrades") { removeUpgrade(id); removeUpgradeCategory(id); }
            else if (category === "projectiles") removeProjectile(id);
            else if (category === "energy") removeEnergyType(id);
            else if (category === "excavation") removeExcavationProfile(id);
            else if (category === "behaviors") removeStructureBehavior(id);
            else if (category === "signals") removeSignal(id);
            else if (category === "triggers") removeTrigger(id);
            else if (category === "sprites") removeSprite(id);
            refresh();
            api.toast(`Removed ${id}`);
        };

        // ── Render ─────────────────────────────────────────────────────────
        if (panel.minimized) {
            return React.createElement(
                "div",
                {
                    style: {
                        ...S.panelRoot,
                        ...(panel.x >= 0 && panel.y >= 0
                            ? { left: panel.x, top: panel.y, right: "auto", bottom: "auto" }
                            : { right: 16, bottom: 16, left: "auto", top: "auto" }),
                    },
                },
                React.createElement(
                    "div",
                    {
                        style: S.minimizedChip,
                        onMouseDown: onTitleDown,
                        onDoubleClick: toggleMin,
                        title: "Double-click or press ▢ to expand",
                    },
                    React.createElement("span", null, "⚙ My Own Mod"),
                    React.createElement(
                        "button",
                        { style: S.btn, onClick: (e: any) => { e.stopPropagation(); toggleMin(); } },
                        "▢",
                    ),
                ),
            );
        }

        const listForTab = (): Array<{ id: string; [k: string]: unknown }> => {
            if (tab === "elements") return cfg.elements;
            if (tab === "structures") return cfg.structures;
            if (tab === "items") return cfg.items;
            if (tab === "recipes") return cfg.recipes;
            if (tab === "processing") return cfg.processing;
            if (tab === "contacts") return cfg.contacts ?? [];
            if (tab === "interactions") return cfg.interactions ?? [];
            if (tab === "modifiers") return cfg.modifiers ?? [];
            if (tab === "terrains") return cfg.terrains ?? [];
            if (tab === "techs") return cfg.techs ?? [];
            if (tab === "upgrades") return [...(cfg.upgradeCategories ?? []), ...(cfg.upgrades ?? [])];
            if (tab === "projectiles") return cfg.projectiles ?? [];
            if (tab === "energy") return cfg.energyTypes ?? [];
            if (tab === "excavation") return cfg.excavationProfiles ?? [];
            if (tab === "behaviors") return cfg.structureBehaviors ?? [];
            if (tab === "signals") return cfg.signals ?? [];
            if (tab === "triggers") return cfg.triggers ?? [];
            if (tab === "sprites") return cfg.sprites ?? [];
            return [];
        };

        const formFields = () => {
            const React = HostReact ?? api.react;
            if (!React) return null;
            const h = React.createElement.bind(React);
            const defs = fieldsForTab(tab);
            return h(
                "div",
                { style: S.form },
                h("label", { style: S.label },
                    "Id suffix (required)",
                    h("input", {
                        style: S.input,
                        value: form.idSuffix ?? "",
                        placeholder: "my-thing",
                        onChange: (e: any) => setForm((p) => ({ ...p, idSuffix: e.target.value })),
                    }),
                    h("span", { style: S.hint }, `Full id → ${MOD_ID}:` + (form.idSuffix || "…")),
                ),
                ...defs.map((f) => renderField(f)),
                h(
                    "div",
                    { style: S.toolbar },
                    h("button", { style: S.btnPrimary, type: "button", onClick: () => saveForm() }, editingId ? "Update" : "Add"),
                    h("button", { style: S.btn, type: "button", onClick: () => { setForm({}); setEditingId(null); } }, "Clear"),
                ),
            );
        };

        return React.createElement(
            "div",
            {
                style: {
                    ...S.panelRoot,
                    left: panel.x,
                    top: panel.y,
                    width: panel.width ?? 420,
                },
            },
            React.createElement(
                "div",
                { style: S.panelChrome },
                // Title bar
                React.createElement(
                    "div",
                    { style: S.titleBar, onMouseDown: onTitleDown },
                    React.createElement("span", { style: S.titleText }, "My Own Mod — Configurator"),
                    React.createElement("button", { style: S.btn, onClick: toggleMin, title: "Minimize" }, "—"),
                ),
                // Body
                React.createElement(
                    "div",
                    { style: S.body },
                    // Tabs
                    React.createElement(
                        "div",
                        { style: S.tabs },
                        (["elements", "structures", "items", "recipes", "processing", "contacts", "interactions", "modifiers", "terrains", "techs", "upgrades", "projectiles", "energy", "excavation", "behaviors", "signals", "triggers", "sprites", "json"] as Tab[]).map((t) =>
                            React.createElement(
                                "button",
                                {
                                    key: t,
                                    style: tab === t ? S.tabActive : S.tab,
                                    onClick: () => (t === "json" ? openJsonTab() : setTab(t)),
                                },
                                t,
                            ),
                        ),
                    ),
                    // Toolbar
                    React.createElement(
                        "div",
                        { style: S.toolbar },
                        React.createElement("button", { style: S.btnPrimary, onClick: applyNow }, "Apply to game"),
                        React.createElement("button", { style: S.btn, onClick: refresh }, "Reload"),
                    ),
                    // JSON editor
                    tab === "json"
                        ? React.createElement(
                            "div",
                            null,
                            React.createElement("textarea", {
                                style: S.textarea,
                                value: editJson,
                                onChange: (e: any) => setEditJson(e.target.value),
                            }),
                            React.createElement(
                                "div",
                                { style: S.toolbar },
                                React.createElement("button", { style: S.btnPrimary, onClick: applyJson }, "Import & Apply"),
                                React.createElement("button", {
                                    style: S.btn,
                                    onClick: () => setEditJson(exportConfigJson()),
                                }, "Reset to stored"),
                            ),
                            React.createElement("div", { style: S.hint }, "Edit the full config as JSON, then Import & Apply."),
                        )
                        : React.createElement(
                            "div",
                            null,
                            React.createElement(
                                "div",
                                { style: S.list },
                                listForTab().length === 0
                                    ? React.createElement("div", { style: S.hint }, "No entries yet. Fill the form below.")
                                    : listForTab().map((entry) =>
                                        React.createElement(
                                            "div",
                                            { key: entry.id, style: S.row },
                                            React.createElement("span", { style: S.rowId, title: entry.id }, entry.id),
                                            React.createElement("button", {
                                                style: S.btn,
                                                onClick: () => startEdit(tab, entry),
                                            }, "Edit"),
                                            React.createElement("button", {
                                                style: S.btnDanger,
                                                onClick: () => doRemove(tab, entry.id),
                                            }, "Del"),
                                        ),
                                    ),
                            ),
                            formFields(),
                            React.createElement(
                                "div",
                                { style: S.hint },
                                "Ids auto-prefixed with " + MOD_ID + ":. Full field list (see constants FIELD_HELP / JSON tab): ",
                                (FIELD_HELP as any)[tab] ? (FIELD_HELP as any)[tab].join(" · ") : "",
                            ),
                        ),
                ),
            ),
        );
    }

    return Panel;
}


/**
 * Primary entry used by overlays.register("global", id, () => ConfiguratorPanel()).
 * Same pattern as md-word-statistic: call the panel function during the overlay
 * render so hooks attach to the overlay fiber.
 *
 * Panel instance is created ONCE (stable hook order).
 */
let _panelInstance: ((props?: unknown) => unknown) | null = null;

function getPanelInstance(): (props?: unknown) => unknown {
    if (_panelInstance) return _panelInstance;
    _panelInstance = createPanelComponent(false); // expanded when tool selected
    return _panelInstance;
}

export function ConfiguratorPanel(): unknown {
    // word-statistic pattern: hide unless the tool is the active hotbar item
    if (!isToolSelected()) return null;

    const React = HostReact ?? api.react ?? (globalThis as any).sandkit?.react;
    if (!React?.createElement) {
        console.error(`${LOG} ConfiguratorPanel: no react`);
        return null;
    }
    const h = React.createElement.bind(React);

    try {
        const Panel = getPanelInstance();
        const tree = Panel({});
        if (tree != null) return tree;
    } catch (e) {
        console.error(`${LOG} ConfiguratorPanel render failed`, e);
    }

    return h(
        "div",
        {
            style: {
                position: "fixed",
                right: "16px",
                bottom: "16px",
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