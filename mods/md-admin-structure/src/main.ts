/**
 * md-admin-structure — dev panel (toggle: Alt+O).
 *
 * Lists structures: every mod-registered structure plus the player's unlocked
 * structures (built-ins). Filter by owning mod and by hideFromBuildMenu.
 * Unlock any structure via api.player.buildings.unlockById(id), or remove it
 * via api.player.buildings.removeById(id).
 */

import "@sandmd/sandkit";

const MOD_ID = "md-admin-structure";
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

// ---------------------------------------------------------------------------
// Typed access to the admin APIs the bundled sandkit ambient does not declare.
// ---------------------------------------------------------------------------

interface StructureDefinition {
    id?: string;
    name?: string;
    nameKey?: string;
    categoryKey?: string;
    hideFromBuildMenu?: boolean;
    alwaysUnlocked?: boolean;
}
interface StructuresAdmin {
    getAvailableTypes?(): Set<number | string> | Array<number | string>;
    getDefinitionByType?(ref: number | string): StructureDefinition | null | undefined;
}
interface InjectedUi {
    inject?: (id: string, component: unknown) => (() => void) | undefined;
}
interface AdminApi {
    structures: StructuresAdmin;
    player: { buildings: { unlockById(id: string): void; removeById(id: string): void } };
    i18n: { getName?(def: unknown): string | null };
    ui: InjectedUi;
}
const api = sandkit.api as unknown as AdminApi &
    Omit<typeof sandkit.api, "structures" | "player" | "i18n" | "ui">;

// ---------------------------------------------------------------------------
// Sources of structure definitions.
//  - sandkit.mods.structures           : every mod-registered structure
//  - sandkit.state.store.player.buildings : player's unlocked structure ids
//  - api.structures.getAvailableTypes? : all available types (when present)
// ---------------------------------------------------------------------------

interface ModStructureDef {
    id?: string;
    name?: string;
    nameKey?: string;
    categoryKey?: string;
    hideFromBuildMenu?: boolean;
    alwaysUnlocked?: boolean;
}
interface SandkitMods {
    structures?: Record<string, ModStructureDef>;
}

const root = sandkit as {
    mods?: SandkitMods;
    state?: {
        sandkit?: { mods?: SandkitMods };
        store?: { player?: { buildings?: string[] } };
    };
};

function modStructuresMap(): Record<string, ModStructureDef> | undefined {
    return root.mods?.structures ?? root.state?.sandkit?.mods?.structures;
}
function unlockedBuildingIds(): string[] {
    const b = root.state?.store?.player?.buildings;
    return Array.isArray(b) ? b.filter((v): v is string => typeof v === "string") : [];
}

/** Best effort: the structure-id prefix before ":" is the owning mod. */
function ownerMod(id: string): string {
    const sep = id.indexOf(":");
    return sep > 0 ? id.slice(0, sep) : "(built-in)";
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

interface StructureRow {
    id: string;
    name: string;
    mod: string;
    category: string;
    hidden: boolean;
    unlocked: boolean;
}

function structureRows(): StructureRow[] {
    const unlocked = new Set(unlockedBuildingIds());
    const rows = new Map<string, StructureRow>();

    const add = (id: string, def: StructureDefinition | ModStructureDef | null | undefined): void => {
        const d = def ?? {};
        const sid = typeof d.id === "string" ? d.id : id;
        if (!sid || rows.has(sid)) return;
        const name = d.name ??
            safe(() => api.i18n.getName?.(d) ?? null) ??
            d.nameKey ??
            sid;
        rows.set(sid, {
            id: sid,
            name,
            mod: ownerMod(sid),
            category: d.categoryKey ?? "",
            hidden: d.hideFromBuildMenu === true,
            unlocked: unlocked.has(sid),
        });
    };

    // 1) All mod-registered structures (authoritative, has hideFromBuildMenu).
    const mods = modStructuresMap();
    if (mods) for (const id of Object.keys(mods)) add(id, mods[id]);

    // 2) Everything else the engine reports as available / unlocked.
    const available = safe(() => api.structures.getAvailableTypes?.());
    const refs = available
        ? [...available as Iterable<number | string>]
        : unlockedBuildingIds();
    for (const ref of refs) {
        const def = safe(() => api.structures.getDefinitionByType?.(ref));
        add(typeof def?.id === "string" ? def.id : String(ref), def);
    }

    return [...rows.values()].sort((a, b) => a.id.localeCompare(b.id));
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
    ok: "#7ee787",
    danger: "#ff6b6b",
};

interface StyleObj {
    [key: string]: string | number | boolean;
}
const styles = {
    panel: {
        position: "fixed", right: "16px", bottom: "16px",
        width: "560px", maxWidth: "94vw", maxHeight: "72vh",
        display: "flex", flexDirection: "column",
        background: COLORS.bg, border: `1px solid ${COLORS.border}`,
        borderRadius: "10px", color: COLORS.text,
        font: "12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)", zIndex: 9000,
    } as StyleObj,
    header: {
        display: "flex", alignItems: "center", gap: "6px",
        padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}`,
        color: COLORS.accent, letterSpacing: "0.06em", flexWrap: "wrap",
    } as StyleObj,
    filters: {
        display: "flex", alignItems: "center", gap: "8px",
        padding: "6px 10px", borderBottom: `1px solid ${COLORS.border}`,
    } as StyleObj,
    select: {
        background: "#1a2130", color: COLORS.text,
        border: `1px solid ${COLORS.border}`, borderRadius: "5px",
        padding: "2px 6px", font: "inherit",
    } as StyleObj,
    button: {
        background: "#1a2130", color: COLORS.text,
        border: `1px solid ${COLORS.border}`, borderRadius: "5px",
        padding: "2px 8px", cursor: "pointer", font: "inherit",
    } as StyleObj,
    unlocked: {
        background: "#12281b", color: COLORS.ok,
        border: `1px solid ${COLORS.ok}`, borderRadius: "5px",
        padding: "2px 7px", cursor: "pointer", font: "inherit",
    } as StyleObj,
    lock: {
        background: "#2a1520", color: COLORS.danger,
        border: `1px solid ${COLORS.danger}`, borderRadius: "5px",
        padding: "2px 7px", cursor: "pointer", font: "inherit",
    } as StyleObj,
    list: { overflowY: "auto", padding: "4px 6px" } as StyleObj,
    row: {
        display: "flex", alignItems: "center", gap: "8px",
        padding: "4px 6px", borderBottom: `1px solid ${COLORS.border}`,
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

function StructurePanel(): unknown {
    // Only ever mounted when the guard in init() passed; keeps TS happy.
    if (!React || !h) return null;

    const [filterMod, setFilterMod] = React.useState<string>("");
    const [filterHidden, setFilterHidden] = React.useState<string>("");
    const [, setBump] = React.useState(0);

    React.useEffect(() => {
        repaint = setBump;
        return () => {
            repaint = null;
        };
    }, []);

    if (!state.open) return null;

    const all = structureRows();
    const mods = [...new Set(all.map((r) => r.mod))].sort();

    let shown = all;
    if (filterMod) shown = shown.filter((r) => r.mod === filterMod);
    if (filterHidden === "hidden") shown = shown.filter((r) => r.hidden);
    if (filterHidden === "shown") shown = shown.filter((r) => !r.hidden);

    const refilter = (updater: () => void): void => {
        updater();
        setBump((v) => v + 1);
    };
    const unlock = (id: string): void => {
        safe(() => api.player.buildings.unlockById(id));
        toast(`Unlocked ${id}`);
        refilter(() => undefined);
    };
    const remove = (id: string): void => {
        safe(() => api.player.buildings.removeById(id));
        toast(`Removed ${id}`);
        refilter(() => undefined);
    };

    return h(
        "div",
        { style: styles.panel },
        h(
            "div",
            { style: styles.header },
            h("span", { style: { flex: 1 } },
                `STRUCTURES · ${shown.length}/${all.length}`),
            h(
                "button",
                {
                    style: styles.button,
                    onClick: () => refilter(() => {
                        state.open = false;
                    }),
                },
                "×",
            ),
        ),
        h(
            "div",
            { style: styles.filters },
            h("label", { style: { color: COLORS.dim } }, "Mod:"),
            h(
                "select",
                { value: filterMod, style: styles.select, onChange: (e: Event) => setFilterMod((e.target as HTMLSelectElement).value) },
                h("option", { value: "" }, "All"),
                ...mods.map((m) => h("option", { value: m, key: m }, m)),
            ),
            h("label", { style: { color: COLORS.dim } }, "Menu:"),
            h(
                "select",
                { value: filterHidden, style: styles.select, onChange: (e: Event) => setFilterHidden((e.target as HTMLSelectElement).value) },
                h("option", { value: "" }, "All"),
                h("option", { value: "hidden" }, "Hidden"),
                h("option", { value: "shown" }, "Shown"),
            ),
        ),
        h(
            "div",
            { style: styles.list },
            shown.map((r) =>
                h(
                    "div",
                    { key: r.id, style: styles.row },
                    h("span", { style: { color: COLORS.dim } }, r.hidden ? "🕳" : "▣"),
                    h("span", { style: styles.grow }, r.name),
                    h("span", { style: { color: COLORS.dim, flexShrink: 0 } }, r.category),
                    h("span", { style: { color: COLORS.dim, width: "150px", flexShrink: 0 } }, r.mod),
                    h(
                        "button",
                        {
                            style: r.unlocked ? styles.unlocked : styles.button,
                            onClick: () => unlock(r.id),
                        },
                        r.unlocked ? "Unlocked" : "Unlock",
                    ),
                    h(
                        "button",
                        {
                            style: styles.lock,
                            onClick: () => remove(r.id),
                        },
                        "Remove",
                    ),
                )
            ),
        ),
        h(
            "div",
            { style: styles.footer },
            `Alt+O toggles · v${VERSION}`,
        ),
    );
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

const state = { open: true };
let repaint: Setter<number> | null = null;

function init(): void {
    // Toggle the panel with Alt+O.
    globalThis.addEventListener?.(
        "keydown",
        (event: Event) => {
            const e = event as KeyboardEvent;
            if (!e.altKey || e.code !== "KeyO") return;
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
    const dispose = safe(() => api.ui.inject?.(`${MOD_ID}-panel`, StructurePanel));
    if (!dispose) console.warn(`[${MOD_ID}] api.ui.inject failed — panel unavailable`);
}

try {
    init();
    console.log(`[${MOD_ID} v${VERSION}] loaded`);
} catch (e) {
    console.error(`[${MOD_ID}] init failed`, e);
}