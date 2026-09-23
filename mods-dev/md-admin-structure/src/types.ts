/**
 * md-admin-structure — local typing for the runtime API surface.
 *
 * The bundled `@sandmd/sandkit` ambient declares most of the API; the admin-only
 * members (structure enumeration/definitions, `ui.inject`, `i18n.getName`) are
 * typed here and applied with a single cast in `api.ts`. The host's
 * `SandkitReact` type is too loose to use directly without `any`, so only the
 * hooks this panel calls are typed.
 */
import "@sandmd/sandkit";

// --- React subset ---------------------------------------------------------

export type Setter<S> = (value: S | ((prev: S) => S)) => void;

export interface PanelReact {
    createElement: (...args: unknown[]) => unknown;
    useState: <S>(init: S) => [S, Setter<S>];
    useEffect: (fn: () => void | (() => void), deps?: unknown[]) => void;
}

// --- structures -----------------------------------------------------------

/**
 * A structure definition as reported by the mod registry or the engine. The
 * registry entries and `getDefinitionByType` results share this shape.
 */
export interface StructureDefinition {
    id?: string;
    name?: string;
    nameKey?: string;
    categoryKey?: string;
    hideFromBuildMenu?: boolean;
    alwaysUnlocked?: boolean;
}

export interface StructuresAdmin {
    getAvailableTypes?(): Iterable<number | string>;
    getDefinitionByType?(ref: number | string): StructureDefinition | null | undefined;
}

/** `api.ui` — the toast call plus the injection point this mod uses. */
export interface InjectedUi {
    toast(message: string): void;
    inject?: (id: string, component: unknown) => (() => void) | undefined;
}

export interface AdminApi {
    structures: StructuresAdmin;
    player: {
        buildings: {
            unlockById(id: string): void;
            removeById(id: string): void;
        };
    };
    i18n: {
        getName?(def: unknown): string | null;
    };
    ui: InjectedUi;
}

/** The widened handle plus everything else the ambient already declares. */
export type WidenedApi =
    & AdminApi
    & Omit<typeof sandkit.api, "structures" | "player" | "i18n" | "ui">;

// --- live mod registries --------------------------------------------------

export interface SandkitMods {
    structures?: Record<string, StructureDefinition>;
}

/** `sandkit`, restricted to the containers this mod reads. */
export interface SandkitRoot {
    mods?: SandkitMods;
    state?: {
        sandkit?: { mods?: SandkitMods };
        store?: { player?: { buildings?: string[] } };
    };
}

// --- panel -----------------------------------------------------------------

/** One rendered row: a structure plus its menu/unlock state. */
export interface StructureRow {
    id: string;
    name: string;
    mod: string;
    category: string;
    hidden: boolean;
    unlocked: boolean;
}

/** Filter for the panel's "Menu" dropdown. */
export type MenuFilter = "" | "hidden" | "shown";

/** Inline CSS object accepted by the host React. */
export interface StyleObj {
    [key: string]: string | number | boolean;
}
