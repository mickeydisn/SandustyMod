/**
 * The contract every object definition is written against.
 *
 * An "object definition" is one register() shape the panel can author. What
 * belongs to one of them lives in its own file; this is the shared vocabulary.
 *
 * A definition answers five questions: its fields, its round trip, its
 * cross-field rules, its panel, its list row.
 */
import type { ModConfig } from "../../constants.ts";
import type { Opt } from "../../catalog.ts";
// Type-only, and `selector.ts` imports `FieldSpec` from this file — so the two form a
// type-level cycle. That is fine and erased: nothing here reaches the panel at runtime, and
// the values the selector actually needs are imported by `param-controls.ts` instead.
import type { SelectorState } from "../panel/component/selector/selector.ts";
import type { ContentKind } from "../../handler/core/handler-registry.ts";

// ── Categories & groups ──────────────────────────────────────────────────────

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
    | "energy"
    | "networks"
    | "excavation"
    | "projectiles"
    | "sprites"
    | "modifiers"
    | "inputs"
    | "draws"
    /** The HandlerAction catalogue. **Must match `Tab` in `../schema.ts`** — edit that one. */
    | "action"
    | "projectileOption"
    /**
     * The ExcavationOption catalogue. A tab rather than rows in Actions because a
     * preset has no call site — it builds a value the same way a projectile option
     * does. **Must match `Tab` in `../schema.ts`** — edit that one.
     */
    | "excavationOption"
    /**
     * The Processes screen — the author's own named handlers. **Must match `Tab` in
     * `../schema.ts`** — edit that one.
     */
    | "customProcess"
    | "upgradeAction"
    /** Explains the objects and their relations — no configKey. */
    | "help"
    /** Instance-level map of the stored config — no configKey. */
    | "map"
    | "json";

export interface CategoryMeta {
    label: string;
    blurb: string;
    /** Storage key inside ModConfig (`json` has none). */
    configKey?: keyof ModConfig;
}

export interface MenuGroup {
    key: string;
    label: string;
    hint: string;
    categories: Tab[];
}

// ── Field specs ──────────────────────────────────────────────────────────────

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
    /** Repeating row editor: [{ cellType, damage, outputElementType }] (excavation). */
    | "terrainRules"
    /** Repeating row editor: `[{ type, spanTiles? }]` (structure build modes). */
    | "buildModes"
    /** Swatch list: `colors.variants`, the engine's `[[r,g,b,a], …]`. */
    | "colorVariants"
    /** Comma-separated in the form, a real `string[]` in the entry. */
    | "multiselect"
    /**
     * Ordered, repeating `{ key, options }` list — a HandlerProcess, held as JSON
     * text in the form. See `./actions-field.ts`.
     */
    | "actionList"
    /** One `{ key, params }` — a single ProjectileOption, not a list. */
    | "projectileOption"
    /** The same for an ExcavationOption. See `./excavation-option-field.ts`. */
    | "excavationOption"
    /**
     * A definition's **process reference** — one process id, not a list of actions.
     * See `./process-ref-field.ts`.
     */
    | "processRef"
    /**
     * A process's **program grid** — the ordered steps, plus the context list derived
     * from them. Its own kind because the two halves are computed from each other and
     * a generic json control could only show one of them. See
     * `../program-grid-control.ts`.
     */
    | "program";

export interface FieldSpec {
    key: string;
    label: string;
    kind: FieldKind;
    section: string;
    required?: boolean;
    hint?: string;
    placeholder?: string;
    /** Number constraints. */
    min?: number;
    max?: number;
    step?: number;
    int?: boolean;
    /** Text constraints. */
    maxLength?: number;
    pattern?: string;
    patternMsg?: string;
    /** select options: an array, or a resolver taking the form so a picker can narrow by another field. */
    options?: Opt[] | ((form: Record<string, string>) => Opt[]);
    /** json: "object" | "array" | "matrix" (matrix = rectangular 0/1 grid). */
    jsonType?: "object" | "array" | "matrix";
    /** Only render / validate / save when this returns true. */
    when?: (form: Record<string, string>) => boolean;
    /** Default value for a fresh form. */
    def?: string;
    /** Full-width control (textarea / outputs editor). */
    wide?: boolean;
    /** multiselect only: what to say when there is nothing to pick from yet. */
    emptyHint?: string;
    /** library only: also fill this field with a value derived from the picked asset. */
    autoKey?: string;
    /** library only: value previously auto-written, so it can be replaced safely. */
    autoValue?: string;
}

export interface Section {
    title: string;
    fields: FieldSpec[];
}

// ── The mapping context ──────────────────────────────────────────────────────

/** Writes stored values into the form, coercing to its string vocabulary. */
export interface EntryReader {
    /** Write a form value. `undefined` leaves the field's default in place. */
    put(key: string, value: string | undefined): void;
    /** A stored string, or undefined if it is not a string. */
    str(v: unknown): string | undefined;
    /** A stored number as text, or undefined if it is not a finite number. */
    num(v: unknown): string | undefined;
    /** A stored value as indented JSON, or undefined for `null`/`undefined`. */
    json(v: unknown): string | undefined;
    /** A stored `string[]` as the comma-separated text a `multiselect` uses. */
    jsonList(v: unknown): string | undefined;
}

/** The other direction: reads the form, writes the stored entry. An empty control means "not set". */
export interface EntryWriter {
    setStr(key: string, v: string | undefined): void;
    setNum(key: string, v: number | undefined): void;
    setBool(key: string, v: boolean | undefined): void;
    /** Write a value of any shape straight to the entry. A JSON control reaches it verbatim. */
    setRaw(key: string, v: unknown): void;
    /** Remove a key. The setters only ever write, so this is the only way to lose one. */
    del(key: string): void;
    /** Trimmed form string; `""` → undefined. */
    opt(key: string): string | undefined;
    /** Numeric form string; blank or non-numeric → undefined. */
    optNum(key: string): number | undefined;
    /** `"true"` → true, `"false"` → false, blank → undefined. */
    optBool(key: string): boolean | undefined;
    /** Parsed JSON; blank or unparseable → undefined (validation blocks Save). */
    optJson<T>(key: string): T | undefined;
}

// ── The panel context ────────────────────────────────────────────────────────

/** What a definition's own widgets are given to draw with. The panel owns React, a definition owns its widgets. */
export interface PanelContext {
    /** `React.createElement`, bound. */
    h: (...args: unknown[]) => unknown;
    /** The live form being edited. */
    form: Record<string, string>;
    /** The stored config, for relations a form field cannot show on its own. */
    cfg: ModConfig;
    /** Write one form field. */
    setField: (key: string, value: string) => void;
    /**
     * The shared selector's UI state, for a control that renders one.
     *
     * This exists because the selector keeps its open/filter/search state **outside**
     * React — in a `useState` the panel owns, keyed per field. A definition field reads
     * it directly; a *handler parameter* sits one level deeper (inside an action list or
     * the program grid) and cannot, so it arrives here. Without this the two paths would
     * each need their own state, and a selector inside an action row would close every
     * time the row re-rendered.
     *
     * Optional: absent means "defaults" — closed, filtered to this mod, no search text.
     */
    selector?: SelectorHandle;
}

/** How a nested control reaches the panel's shared selector. */
export interface SelectorHandle {
    /** Read this key's state, or `undefined` for the defaults. */
    read: (key: string) => SelectorState | undefined;
    /** Merge a patch into this key's state. */
    write: (key: string, patch: Partial<SelectorState>) => void;
    /**
     * Render the shared selector for one parameter, or return `null` when these options
     * are **not** content and the caller should fall back to a native control.
     *
     * The handle carries the renderer rather than having the caller import it, and that
     * is not tidiness — it is load-bearing. `selector.ts` imports `catalog.ts`, which
     * imports `api.ts`, which reads the global `sandkit` **at module load**. A parameter
     * renderer that reached the selector directly would therefore fail to import
     * anywhere the host is absent, including its own tests, and a widget that only draws
     * a text box would have acquired a dependency on the whole engine.
     *
     * So the dependency points one way: the panel imports the selector, and hands it down.
     */
    renderParam?: (req: ParamSelectorRequest) => unknown;
}

/** One parameter's worth of a selector render. */
export interface ParamSelectorRequest {
    /** `React.createElement`, bound. */
    h: (...args: unknown[]) => unknown;
    /**
     * What kind of content to list, or `undefined` for a fixed option list.
     *
     * A **kind**, not the catalogue's own `list*` function: the panel owns that mapping
     * (`CONTENT_LISTERS`), because this module and everything above it must not depend on
     * the catalogue, which reads the global `sandkit` at module load.
     */
    content?: ContentKind;
    /** The parameter's fixed options; empty when `content` is set. */
    options: Opt[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    state?: SelectorState;
    onState: (patch: SelectorState) => void;
}

/** One field's worth of that context, for a control renderer. */
export interface FieldContext extends PanelContext {
    field: FieldSpec;
    /** The field's current form value. */
    value: string;
    /** The field's validation error, if it has one. */
    error?: string;
    /** The id field is locked while editing an existing entry. */
    locked: boolean;
    /** The tab this field is on, so a call site's `actionList` offers only what it can run. */
    tab: Tab;
}

/** The parts of the panel a definition may own. */
export interface DefinitionPanel {
    /** The control for one of this definition's field kinds. `null` falls through to the generic renderer. */
    renderField?: (ctx: FieldContext) => unknown;
    /** A block above the sections, for a relation that is real but has no field. */
    renderHeader?: (ctx: PanelContext) => unknown;
}

// ── The object list ───────────────────────────────────────────────────────────

/** Where a list row came from. Both are the same row shape; `game` is reference-only. */
export type RowOrigin = "mod" | "game";

/** Which mod an object came from, from the prefix before the first dot. Dotless = the game. */
export type ModOrigin = {
    /** The mod's own id, or `undefined` for an unnamespaced (built-in) id. */
    modId?: string;
    /** True when the id is namespaced with *this* mod's prefix. */
    own: boolean;
};

/** One object in a list screen. `native` is optional — the host's enumeration is uneven. */
export interface ListRow {
    /** The object's id. Unique within a list; also the React key. */
    id: string;
    /** Display label. Falls back to the id when the object has no name. */
    label: string;
    origin: RowOrigin;
    /** A colour swatch, when the object has one (an element's metaColor). */
    color?: string;
    /** Which mod this object belongs to. Separate from `origin`, which answers "can I edit it?". */
    mod?: ModOrigin;
    /** The stored config entry. Present exactly when `origin === "mod"`. */
    entry?: Record<string, unknown>;
    /** The host's own definition, when the API exposes one. */
    native?: Record<string, unknown>;
    /** Kept out of normal use: `hidden` / `hideFromBuildMenu`. Carried, not filtered. */
    hidden?: boolean;
}

/** What a definition contributes to its list screen. Both renders are optional and may return `null`. */
export interface ListRenderCtx extends PanelContext {
    row: ListRow;
    /** True while this row's detail is open. */
    expanded: boolean;
    /** Open or close this row's detail. */
    toggle: () => void;
    /** Begin editing this row. Only offered for a `mod` row. */
    edit?: () => void;
    /** Ask to delete this row. Only offered for a `mod` row. */
    remove?: () => void;
    /** True while this row is armed for delete confirmation. */
    confirming?: boolean;
}

export interface DefinitionList {
    /** The objects the host already has of this kind. `[]` for a kind it cannot enumerate. */
    discover?: () => ListRow[];
    /** Extra text a row is matched against when the user filters. */
    searchText?: (row: ListRow) => string;
    /** The row's own line. Hot path, so it may omit anything already in the id. */
    inlineRender?: (ctx: ListRenderCtx) => unknown;
    /** The row's expanded detail — where a game row shows the engine's own values. */
    infoRender?: (ctx: ListRenderCtx) => unknown;
}

// ── The definition itself ────────────────────────────────────────────────────

/** One object the panel can author. Every member but `fields` is optional. */
export interface Definition {
    /** The tab this definition is reached through. */
    tab: Tab;
    /** The schema, in draw order — also the layout, since sections group by consecutive equality. */
    fields: FieldSpec[];
    /** Stored keys this form owns; the rest round-trip via the passthrough. */
    formCovered: string[];
    /** Stored entry → form strings. */
    entryToForm?: (entry: Record<string, unknown>, read: EntryReader) => void;
    /** Form strings → stored entry. */
    formToEntry?: (form: Record<string, string>, write: EntryWriter) => void;
    /** Validate one of this definition's own field kinds. `undefined` means "no opinion". */
    validateField?: (field: FieldSpec, value: string) => string | undefined;
    /** Rules a single field cannot express, added to the per-field results. */
    validate?: (form: Record<string, string>, errors: Record<string, string>) => void;
    /** Seed a *new* entry's form, after field defaults — so it can save without the author choosing. */
    onNewEntry?: (form: Record<string, string>) => void;
    /** The parts of the panel this definition owns. */
    panel?: DefinitionPanel;
    /** How this object appears in its list screen. Entirely optional — the shared list is a fine default. */
    list?: DefinitionList;
}
