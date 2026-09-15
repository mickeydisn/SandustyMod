/**
 * mdadmin — dev helper with a small panel.
 *
 * On load it opens the DevTools console and injects a panel (toggle: Alt+L)
 * that lists every registered element. Elements added by mods carry a
 * "Remove" button that deletes them from the live element registry, plus a
 * "Remove all mod elements" button to clean everything at once.
 */

import "@sandmd/sandkit";

const MOD_ID = "mdadmin";
const VERSION = "0.1.0";

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
const h = React?.createElement.bind(React) as
    | ((...args: unknown[]) => unknown)
    | undefined;

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
// declare (elements enumeration + removal path via the live registry).
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

const api = sandkit.api as unknown as {
    elements: ElementsAdmin;
    ui: InjectedUi & { toast?: (msg: string, opts?: Record<string, unknown>) => void };
};

// ---------------------------------------------------------------------------
// The live element registry, reached the same way the reference inspector:
//   sandkit.state.sandkit.mods.elements  (id -> { elementType, metaColor, … })
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
interface SandkitStateShape {
    state?: { sandkit?: { mods?: SandkitMods } };
}
// const g = sandkit as unknown as SandkitStateShape;

function modRegistry(): Record<string, ModElementDef> | undefined {
    return sandkit?.mods?.elements;
}

/** Best effort: the element-id prefix before ":" is the owning mod. */
function ownerMod(elementId: string): string {
    const sep = elementId.indexOf(":");
    return sep > 0 ? elementId.slice(0, sep) : "(built-in)";
}

// ---------------------------------------------------------------------------
// Data + removal
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

/** Delete a mod-registered element from the live registry (engine escape). */
function removeElement(id: string): boolean {
    const registry = modRegistry();
    if (!registry || !(id in registry)) return false;
    delete registry[id];

    // Drop any matching matter entry so lookups stop finding it too.
    const matters = g.state?.sandkit?.mods?.matters;
    if (matters && id in matters) delete matters[id];

    return true;
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

const COLORS = {
    bg: "rgba(10,12,18,0.92)",
    border: "#263043",
    accent: "#ffe700",
    text: "#cdd6e0",
    dim: "#76808f",
    danger: "#ff6b6b",
};

interface StyleObj {
    [key: string]: string | number | boolean;
}
const styles = {
    panel: {
        position: "fixed",
        right: "16px",
        bottom: "16px",
        width: "420px",
        maxWidth: "92vw",
        maxHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: "10px",
        color: COLORS.text,
        font: "12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        zIndex: 9000,
    } as StyleObj,
    header: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 10px",
        borderBottom: `1px solid ${COLORS.border}`,
        color: COLORS.accent,
        letterSpacing: "0.08em",
    } as StyleObj,
    button: {
        background: "#1a2130",
        color: COLORS.text,
        border: `1px solid ${COLORS.border}`,
        borderRadius: "5px",
        padding: "3px 8px",
        cursor: "pointer",
        font: "inherit",
    } as StyleObj,
    danger: {
        background: "#2a1520",
        color: COLORS.danger,
        border: `1px solid ${COLORS.danger}`,
        borderRadius: "5px",
        padding: "2px 7px",
        cursor: "pointer",
        font: "inherit",
    } as StyleObj,
    list: { overflowY: "auto", padding: "4px 6px" } as StyleObj,
    row: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "4px 6px",
        borderBottom: `1px solid ${COLORS.border}`,
    } as StyleObj,
    swatch: {
        width: "10px",
        height: "10px",
        borderRadius: "2px",
        flexShrink: 0,
    } as StyleObj,
    grow: {
        flex: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    } as StyleObj,
    footer: {
        padding: "6px 10px",
        color: COLORS.dim,
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

    const rows = registeredRows();
    const removableCount = rows.filter((r) => r.removable).length;

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

    return h(
        "div",
        { style: styles.panel },
        h(
            "div",
            { style: styles.header },
            h("span", null, `MD ADMIN · ${rows.length} element${rows.length === 1 ? "" : "s"}`),
            h(
                "button",
                { style: styles.danger, disabled: removableCount === 0, onClick: removeAll },
                `Remove ${removableCount} mod`,
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
            `Alt+L to toggle · v${VERSION}`,
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

    if (!h || !React) {
        console.warn(`[${MOD_ID}] sandkit.react missing — panel unavailable`);
        return;
    }
    // const dispose = safe(() => api.ui.inject?.(`${MOD_ID}-panel`, MdAdminPanel));
    // if (!dispose) console.warn(`[${MOD_ID}] api.ui.inject failed — panel unavailable`);

    console.log(`[${MOD_ID}]`, sandkit);
}

try {
    init();
    console.log(`[${MOD_ID} v${VERSION}] loaded`);
} catch (e) {
    console.error(`[${MOD_ID}] init failed`, e);
}
