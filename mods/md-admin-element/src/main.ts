/**
 * mdadmin — dev helper with a small panel.
 *
 * On load it opens the DevTools console and injects a panel (toggle: Alt+L)
 * that lists every registered element. Elements added by mods carry a
 * "Remove" button that deletes them from the live element registry.
 *
 * Removal is PERSISTENT: the element ids are remembered in mod storage and the
 * scrub is re-applied on every load (init + game:ready + a short interval), so
 * elements do not come back on reload — including "ghost" elements left in the
 * save by mods that were removed from the game.
 */

import "@sandmd/sandkit";

const MOD_ID = "mdadmin";
const VERSION = "0.1.0";
const REMOVED_STORE_KEY = "removedElements";

// ---------------------------------------------------------------------------
// Minimal React handle + safe() helper. The host's SandkitReact type is too
// loose to use directly without `any`, so type just what the panel uses.
// ---------------------------------------------------------------------------

type Setter<S> = (value: S | ((prev: S) => S)) => void;

interface PanelReact {
    createElement: (...args: unknown[]) => unknown;
    useState: <S>(init: S) => [S, Setter<S>];
    useEffect: (fn: () => void | (() => void), deps?: unknown[]) => void;
}

const React = (sandkit as { react?: unknown }).react as PanelReact | undefined;
const h = React?.createElement.bind(React) as ((...args: unknown[]) => unknown) | undefined;

function safe<T>(fn: () => T, fallback: T | null = null): T | null {
    try {
        return fn();
    } catch {
        return fallback;
    }
}

function toast(msg: string): void {
    safe(() => sandkit.api.ui.toast(msg));
}

// Typed access to the admin methods the bundled sandkit ambient does not
// declare (element enumeration + removal via the live registry).
interface ElementDefinition {
    id?: string;
    nameKey?: string;
    density?: number;
    matterType?: number;
    metaColor?: number;
}
interface ElementsAdmin {
    getRegisteredTypes(): number[];
    getDefinitionByType(t: number): ElementDefinition | null | undefined;
    getNameByType?(t: number): string | null;
    getIdByType?(t: number): string;
}
interface InjectedUi {
    inject?: (id: string, component: unknown) => (() => void) | undefined;
}

type AdminApi = { elements: ElementsAdmin; ui: InjectedUi } &
    Omit<typeof sandkit.api, "elements" | "ui">;

const api = sandkit.api as unknown as AdminApi;

// ---------------------------------------------------------------------------
// The live element registry, reached via sandkit.mods.elements. On the real
// runtime the container can live on `sandkit.mods` directly, or nested under
// `sandkit.state.sandkit.mods` — accept both.
// ---------------------------------------------------------------------------

interface ModElementDef {
    id?: string;
    elementType?: number;
    matterType?: number;
    metaColor?: number;
}
interface SandkitMods {
    elements?: Record<string, ModElementDef>;
    matters?: Record<string, { matterType?: number }>;
}

const root = sandkit as {
    mods?: SandkitMods;
    state?: { sandkit?: { mods?: SandkitMods } };
};

function modsBox(): SandkitMods | undefined {
    return root.mods ?? root.state?.sandkit?.mods;
}
function modRegistry(): Record<string, ModElementDef> | undefined {
    return modsBox()?.elements;
}
function mattersRegistry(): Record<string, { matterType?: number }> | undefined {
    return modsBox()?.matters;
}

/** Best effort: the element-id prefix before ":" is the owning mod. */
function ownerMod(elementId: string): string {
    const sep = elementId.indexOf(":");
    return sep > 0 ? elementId.slice(0, sep) : "(built-in)";
}

// ---------------------------------------------------------------------------
// Persistent blacklist of removed element ids.
// ---------------------------------------------------------------------------

function loadRemoved(): string[] {
    const raw = safe(() => api.storage.get(MOD_ID, REMOVED_STORE_KEY));
    if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === "string");
    return [];
}
function saveRemoved(list: string[]): void {
    safe(() => api.storage.set(MOD_ID, REMOVED_STORE_KEY, list));
}

// ---------------------------------------------------------------------------
// Data + removal + persistent re-application
// ---------------------------------------------------------------------------

interface RegisteredRow {
    type: number;
    id: string;
    name: string;
    color: string;
    mod: string;
    removable: boolean;
}

function registeredRows(): RegisteredRow[] {
    const types = safe(() => api.elements.getRegisteredTypes(), []) ?? [];
    const registry = modRegistry();

    return types
        .map((t) => {
            const def = safe(() => api.elements.getDefinitionByType(t)) ?? {};
            const id = def.id ?? String(t);
            const removable = Boolean(registry && id in registry);
            const name = safe(() => api.elements.getNameByType?.(t)) ?? def.nameKey ?? id;
            const color = typeof def.metaColor === "number"
                ? `#${def.metaColor.toString(16).padStart(6, "0")}`
                : "#8a8a8a";
            return { type: t, id, name, color, mod: ownerMod(id), removable };
        })
        .sort((a, b) => a.type - b.type);
}

/** Delete one element from the live registry and remember it as removed. */
function removeElement(id: string): boolean {
    const registry = modRegistry();
    const matters = mattersRegistry();
    if (!registry || !(id in registry)) return false;

    delete registry[id];
    if (matters && id in matters) delete matters[id];

    const removed = new Set(loadRemoved());
    removed.add(id);
    saveRemoved([...removed]);
    return true;
}

/**
 * Re-apply every remembered removal to the current registry. Call after mods
 * have (re)registered so ghost elements from removed mods are scrubbed too.
 */
function reapplyRemovals(): void {
    const registry = modRegistry();
    const matters = mattersRegistry();
    const removed = loadRemoved();
    if (!registry || removed.length === 0) return;

    for (const id of removed) {
        if (id in registry) delete registry[id];
        if (matters && id in matters) delete matters[id];
    }
}

// ---------------------------------------------------------------------------
// Panel styles
// ---------------------------------------------------------------------------

const COLORS = {
    bg: "rgba(10,12,18,0.92)",
    border: "#263043",
    accent: "#ffe700",
    text: "#cdd6e0",
    dim: "#76808f",
    danger: "#ff6b6b",
    ok: "#7ee787",
};

interface StyleObj {
    [key: string]: string | number | boolean;
}
const styles = {
    panel: {
        position: "fixed", right: "16px", bottom: "16px",
        width: "430px", maxWidth: "92vw", maxHeight: "70vh",
        display: "flex", flexDirection: "column",
        background: COLORS.bg, border: `1px solid ${COLORS.border}`,
        borderRadius: "10px", color: COLORS.text,
        font: "12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)", zIndex: 9000,
    } as StyleObj,
    header: {
        display: "flex", alignItems: "center", gap: "6px",
        padding: "8px 10px", borderBottom: `1px solid ${COLORS["border"]}`,
        color: COLORS.accent, letterSpacing: "0.06em", flexWrap: "wrap",
    } as StyleObj,
    button: {
        background: "#1a2130", color: COLORS.text,
        border: `1px solid ${COLORS.border}`, borderRadius: "5px",
        padding: "3px 8px", cursor: "pointer", font: "inherit",
    } as StyleObj,
    danger: {
        background: "#2a1520", color: COLORS.danger,
        border: `1px solid ${COLORS.danger}`, borderRadius: "5px",
        padding: "2px 7px", cursor: "pointer", font: "inherit",
    } as StyleObj,
    list: { overflowY: "auto", padding: "4px 6px" } as StyleObj,
    row: {
        display: "flex", alignItems: "center", gap: "8px",
        padding: "4px 6px", borderBottom: `1px solid ${COLORS.border}`,
    } as StyleObj,
    swatch: {
        width: "10px", height: "10px", borderRadius: "2px", flexShrink: 0,
    } as StyleObj,
    grow: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } as StyleObj,
    footer: {
        padding: "6px 10px", color: COLORS.dim,
        borderTop: `1px solid ${COLORS.border}`,
    } as StyleObj,
};

// ---------------------------------------------------------------------------
// Panel component
// ---------------------------------------------------------------------------

function MdAdminPanel(): unknown {
    // Only ever mounted when the guard in init() passed; keeps TS happy.
    if (!React || !h) return null;

    const [, setBump] = React.useState(0);

    React.useEffect(() => {
        repaint = setBump;
        return () => {
            repaint = null;
        };
    }, []);

    if (!state.open) return null;

    reapplyRemovals();
    const rows = registeredRows();
    const removableCount = rows.filter((r) => r.removable).length;
    const rememberedCount = loadRemoved().length;

    const remove = (id: string): void => {
        if (!removeElement(id)) return;
        toast(`Removed ${id}`);
        setBump((v) => v + 1);
    };
    const removeAll = (): void => {
        const registry = modRegistry();
        const ids = registry ? Object.keys(registry) : [];
        if (ids.length === 0) return;
        for (const id of ids) removeElement(id);
        toast(`Removed ${ids.length} mod element${ids.length === 1 ? "" : "s"}`);
        setBump((v) => v + 1);
    };
    const forgetAll = (): void => {
        const removed = loadRemoved();
        if (removed.length === 0) return;
        saveRemoved([]);
        toast(`Forgot ${removed.length} removal${removed.length === 1 ? "" : "s"}`);
        setBump((v) => v + 1);
    };

    return h(
        "div",
        { style: styles.panel },
        h(
            "div",
            { style: styles.header },
            h("span", { style: { flex: 1 } },
                `MD ADMIN · ${rows.length} element${rows.length === 1 ? "" : "s"}`),
            h(
                "button",
                { style: styles.danger, disabled: removableCount === 0, onClick: removeAll },
                `Remove ${removableCount}`,
            ),
            h(
                "button",
                {
                    style: styles.button,
                    disabled: rememberedCount === 0,
                    onClick: forgetAll,
                    title: "Forget every remembered removal (restore)",
                },
                "Reset",
            ),
            h(
                "button",
                {
                    style: styles.button,
                    onClick: () => {
                        state.open = false;
                        setBump((v) => v + 1);
                    },
                },
                "×",
            ),
        ),
        h(
            "div",
            { style: styles.list },
            rows.map((r) =>
                h(
                    "div",
                    { key: r.id, style: styles.row },
                    h("div", { style: { ...styles.swatch, background: r.color } }),
                    h("span", { style: { color: COLORS.dim } }, String(r.type)),
                    h("span", { style: styles.grow }, r.name),
                    h("span", { style: { color: COLORS.dim } }, r.mod),
                    r.removable
                        ? h(
                            "button",
                            { style: styles.danger, onClick: () => remove(r.id) },
                            "Remove",
                        )
                        : null,
                )
            ),
        ),
        h(
            "div",
            { style: styles.footer },
            `${rememberedCount} remembered · Alt+L toggles · v${VERSION}`,
        ),
    );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

const state = { open: true };
let repaint: Setter<number> | null = null;

function openDevTools(): void {
    try {
        const electron = (globalThis as { electron?: { openDevTools?: () => void } }).electron;
        electron?.openDevTools?.();
    } catch {
        /* devtools bridge unavailable — non-fatal */
    }
}

function init(): void {
    openDevTools();

    // Toggle the panel with Alt+L.
    globalThis.addEventListener?.(
        "keydown",
        (event: Event) => {
            const e = event as KeyboardEvent;
            if (!e.altKey || e.code !== "KeyL") return;
            state.open = !state.open;
            if (repaint) repaint((v) => v + 1);
            e.preventDefault();
            e.stopPropagation();
        },
        true,
    );

    // Persist removals across reloads: scrub now and re-apply as mods (and any
    // save-ghosted elements of removed mods) finish re-registering.
    reapplyRemovals();
    safe(() => api.events.on("game:ready", reapplyRemovals));
    setTimeout(reapplyRemovals, 1000);
    setInterval(reapplyRemovals, 2000);

    if (!h || !React) {
        console.warn(`[${MOD_ID}] sandkit.react missing — panel unavailable`);
        return;
    }
    const dispose = safe(() => api.ui.inject?.(`${MOD_ID}-panel`, MdAdminPanel));
    if (!dispose) console.warn(`[${MOD_ID}] api.ui.inject failed — panel unavailable`);
}

try {
    init();
    console.log(`[${MOD_ID} v${VERSION}] loaded`);
} catch (e) {
    console.error(`[${MOD_ID}] init failed`, e);
}