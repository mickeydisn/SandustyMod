import type { ModConfig } from "../../constants.ts";
import type { Opt } from "../../catalog.ts";

import type { SelectorState } from "../panel/component/selector/selector.ts";
import type { ContentKind } from "../../handler/index.ts";

export type Tab =
    | "elements"
    | "structures"
    | "items"
    | "recipes"
    | "processing"
    | "contacts"
    | "interactions"
    | "terrains"
    | "techs"
    | "upgrades"
    | "categories"
    | "unlockNodes"
    | "signals"
    | "triggers"
    | "behaviors"
    | "placementConfigs"
    | "energy"
    | "networks"
    | "buffers"
    | "excavation"
    | "projectiles"
    | "sprites"
    | "modifiers"
    | "inputs"
    | "draws"
    | "spriteEditor"
    | "action"
    | "projectileOption"
    | "excavationOption"
    | "customProcess"
    | "upgradeAction"
    | "help"
    | "map"
    | "json";

export interface CategoryMeta {
    label: string;
    blurb: string;

    configKey?: keyof ModConfig;
}

export interface MenuGroup {
    key: string;
    label: string;
    hint: string;
    categories: Tab[];
}

export type FieldKind =
    | "text"
    | "number"
    | "bool"
    | "select"
    | "color"
    | "json"
    | "outputs"
    | "shape"
    | "library"
    | "terrainRules"
    | "buildModes"
    | "colorVariants"
    | "multiselect"
    | "projectileOption"
    | "excavationOption"
    | "processRef"
    | "program";

export interface FieldSpec {
    key: string;
    label: string;
    kind: FieldKind;
    section: string;
    required?: boolean;
    hint?: string;
    placeholder?: string;

    min?: number;
    max?: number;
    step?: number;
    int?: boolean;

    maxLength?: number;
    pattern?: string;
    patternMsg?: string;

    options?: Opt[] | ((form: Record<string, string>) => Opt[]);

    jsonType?: "object" | "array" | "matrix";

    when?: (form: Record<string, string>) => boolean;

    def?: string;

    wide?: boolean;

    emptyHint?: string;

    autoKey?: string;

    autoValue?: string;
}

export interface Section {
    title: string;
    fields: FieldSpec[];
}

export interface EntryReader {
    put(key: string, value: string | undefined): void;

    str(v: unknown): string | undefined;

    num(v: unknown): string | undefined;

    json(v: unknown): string | undefined;

    jsonList(v: unknown): string | undefined;
}

export interface EntryWriter {
    /**
     * Write `v` under `key` unless it is `undefined`.
     *
     * The typed variants below are all this one rule; they exist so a call
     * site can hand over the exact type it read off a form without a cast.
     */
    set(key: string, v: unknown): void;

    setStr(key: string, v: string | undefined): void;

    setNum(key: string, v: number | undefined): void;

    setBool(key: string, v: boolean | undefined): void;

    setRaw(key: string, v: unknown): void;

    del(key: string): void;

    opt(key: string): string | undefined;

    optNum(key: string): number | undefined;

    optBool(key: string): boolean | undefined;

    optJson<T>(key: string): T | undefined;
}

export interface PanelContext {
    h: (...args: unknown[]) => unknown;

    form: Record<string, string>;

    cfg: ModConfig;

    setField: (key: string, value: string) => void;

    selector?: SelectorHandle;
}

export interface SelectorHandle {
    read: (key: string) => SelectorState | undefined;

    write: (key: string, patch: Partial<SelectorState>) => void;

    renderParam?: (req: ParamSelectorRequest) => unknown;
}

export interface ParamSelectorRequest {
    h: (...args: unknown[]) => unknown;

    content?: ContentKind;

    options: Opt[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    state?: SelectorState;
    onState: (patch: SelectorState) => void;
}

export interface FieldContext extends PanelContext {
    field: FieldSpec;

    value: string;

    error?: string;

    locked: boolean;

    tab: Tab;
}

export interface DefinitionPanel {
    renderField?: (ctx: FieldContext) => unknown;

    renderHeader?: (ctx: PanelContext) => unknown;
}

export type RowOrigin = "mod" | "game";

export type ModOrigin = {
    modId?: string;

    own: boolean;
};

export interface ListRow {
    id: string;

    label: string;
    origin: RowOrigin;

    color?: string;

    mod?: ModOrigin;

    entry?: Record<string, unknown>;

    native?: Record<string, unknown>;

    hidden?: boolean;
}

export interface ListRenderCtx extends PanelContext {
    row: ListRow;

    expanded: boolean;

    toggle: () => void;

    edit?: () => void;

    remove?: () => void;

    confirming?: boolean;
}

export interface DefinitionList {
    discover?: () => ListRow[];

    searchText?: (row: ListRow) => string;

    inlineRender?: (ctx: ListRenderCtx) => unknown;

    infoRender?: (ctx: ListRenderCtx) => unknown;
}

export interface Definition {
    tab: Tab;

    fields: FieldSpec[];

    formCovered: string[];

    entryToForm?: (entry: Record<string, unknown>, read: EntryReader) => void;

    formToEntry?: (form: Record<string, string>, write: EntryWriter) => void;

    validateField?: (field: FieldSpec, value: string) => string | undefined;

    validate?: (form: Record<string, string>, errors: Record<string, string>) => void;

    onNewEntry?: (form: Record<string, string>) => void;

    panel?: DefinitionPanel;

    list?: DefinitionList;
}
