/**
 * mdadmin — local typing for the runtime API surface.
 *
 * The bundled `@sandmd/sandkit` ambient declares most of the API; the admin-only
 * members (element enumeration/removal, `ui.inject`) are typed here and applied
 * with a single cast in `api.ts`. The host's `SandkitReact` type is too loose to
 * use directly without `any`, so only the hooks this panel calls are typed.
 */
import "@sandmd/sandkit";

// --- React subset ---------------------------------------------------------

export type Setter<S> = (value: S | ((prev: S) => S)) => void;

export interface PanelReact {
    createElement: (...args: unknown[]) => unknown;
    useState: <S>(init: S) => [S, Setter<S>];
    useEffect: (fn: () => void | (() => void), deps?: unknown[]) => void;
}

// --- elements -------------------------------------------------------------

/** The element fields this panel reads. */
export interface ElementDefinition {
    id?: string;
    nameKey?: string;
    /** Packed RGB used for the row swatch. */
    metaColor?: number;
}

export interface ElementsAdmin {
    getRegisteredTypes(): number[];
    getDefinitionByType(t: number): ElementDefinition | null | undefined;
    getNameByType?(t: number): string | null;
}

/** `api.ui` — the toast call plus the injection point this mod uses. */
export interface InjectedUi {
    toast(message: string): void;
    inject?: (id: string, component: unknown) => (() => void) | undefined;
}

type AdminApi =
    & { elements: ElementsAdmin; ui: InjectedUi }
    & Omit<typeof sandkit.api, "elements" | "ui">;

export type { AdminApi };

// --- live mod registries --------------------------------------------------

/** One entry of `sandkit.mods.elements`. */
export interface ModElementDef {
    id?: string;
    elementType?: number;
    metaColor?: number;
}

export interface SandkitMods {
    elements?: Record<string, ModElementDef>;
    /** Matter records; only ever deleted, never read. */
    matters?: Record<string, unknown>;
}

/** `sandkit`, restricted to the registries this mod reaches into. */
export interface SandkitRoot {
    mods?: SandkitMods;
    state?: { sandkit?: { mods?: SandkitMods } };
}

// --- panel -----------------------------------------------------------------

/** One rendered row: a registered element plus its owning mod. */
export interface RegisteredRow {
    type: number;
    id: string;
    name: string;
    color: string;
    mod: string;
    removable: boolean;
}

/** Inline CSS object accepted by the host React. */
export interface StyleObj {
    [key: string]: string | number | boolean;
}
