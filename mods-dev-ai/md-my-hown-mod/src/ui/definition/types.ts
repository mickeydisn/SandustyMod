/**
 * The contract every object definition is written against.
 *
 * An "object definition" is one register() shape the panel can author: a
 * structure, an element, a recipe. Everything that belongs to exactly one of
 * them — its schema, its section panel, the shape helpers only it uses — lives
 * in that object's own file under `./`. This file is the vocabulary those files
 * share, so they can all be written against it without importing each other.
 *
 * The shape is the union of the four things a definition needs to answer:
 *
 *   1. **what fields exist** and how they are constrained   → `fields`
 *   2. **what the form means** in stored-entry terms         → `entryToForm` / `formToEntry`
 *   3. **what cannot be expressed as a field rule**         → `validate`
 *   4. **what it looks like** in the panel                   → `panel`
 *
 * Splitting those four across files was the problem this replaces: a form field
 * declared in one file, its save path in another and its widget in a third is
 * three places to forget, and forgetting one is a field that renders but never
 * persists. One file per object makes that a single-file question.
 */
import type { ModConfig } from "../../constants.ts";
import type { Opt } from "../../catalog.ts";

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
    /** Registry browser — no configKey, renders its own body. */
    | "handlers"
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
    /**
     * Repeating row editor: `[{ type, spanTiles? }]` (structure build modes).
     * The form used to hold a single mode, so a structure with more than one
     * silently lost the rest.
     */
    | "buildModes"
    /**
     * Swatch list: `colors.variants`, the engine's `[[r,g,b,a], …]`. Kept as its
     * own kind because the nested tuple is exactly the shape that is painful to
     * hand-write and easy to get subtly wrong.
     */
    | "colorVariants"
    /**
     * Multiple values in one control. The form holds a comma-separated string;
     * the entry always holds a real `string[]` (or is absent when empty).
     */
    | "multiselect";

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
    /**
     * select options: a plain array, or a resolver. The resolver receives the
     * current form values so a picker can narrow by another field's value
     * (e.g. the item handler list follows the chosen `itemType`).
     */
    options?: Opt[] | ((form: Record<string, string>) => Opt[]);
    /** json: "object" | "array" | "matrix" (matrix = rectangular 0/1 grid). */
    jsonType?: "object" | "array" | "matrix";
    /** Only render / validate / save when this returns true. */
    when?: (form: Record<string, string>) => boolean;
    /** Default value for a fresh form. */
    def?: string;
    /** Full-width control (textarea / outputs editor). */
    wide?: boolean;
    /**
     * multiselect only: what to say when there is nothing to pick from yet.
     * The user is told what to create rather than being handed a text box,
     * because a reference field must not accept a typed id.
     */
    emptyHint?: string;
    /**
     * library only: when an asset is picked, also fill this other field with a
     * derived value (e.g. the graphics key `sprites:<name>`). The derived value
     * is only written when the target is empty or still holds a previous
     * auto-generated value, so it never clobbers a hand-typed key.
     */
    autoKey?: string;
    /** library only: value previously auto-written, so it can be replaced safely. */
    autoValue?: string;
}

export interface Section {
    title: string;
    fields: FieldSpec[];
}


// ── The mapping context ──────────────────────────────────────────────────────

/**
 * Writes stored values into the form, coercing to the form's string vocabulary.
 *
 * Handed to a definition instead of letting it build its own, so "a stored `42`
 * becomes `"42"`" and "a stored `true` becomes `"true"`" are decided in exactly
 * one place. A definition that re-derived these would drift on the edges — the
 * non-finite number, the `null` that must read as absent — and the drift would
 * only show up on an entry nobody hand-wrote.
 */
export interface EntryReader {
    /** Write a form value. `undefined` leaves the field's default in place. */
    put(key: string, value: string | undefined): void;
    /** A stored string, or undefined if it is not a string. */
    str(v: unknown): string | undefined;
    /** A stored number as text, or undefined if it is not a finite number. */
    num(v: unknown): string | undefined;
    /** A stored value as indented JSON, or undefined for `null`/`undefined`. */
    json(v: unknown): string | undefined;
}

/**
 * The other direction: reads the form and writes the stored entry.
 *
 * The `opt*` reads treat an empty control as "not set" rather than writing
 * `""`, which is what lets a cleared field actually remove the key on save
 * instead of persisting a blank that the engine then reads as a value.
 */
export interface EntryWriter {
    setStr(key: string, v: string | undefined): void;
    setNum(key: string, v: number | undefined): void;
    setBool(key: string, v: boolean | undefined): void;
    /**
     * Write a value of any shape straight to the entry.
     *
     * The three setters above cover what a form field can produce on its own.
     * A JSON control produces whatever the user typed — an object, an array, a
     * nested tuple — and that has to reach the entry verbatim. Round-tripping it
     * through a string is how `[[1,2],[3]]` becomes `"1,2,3"`.
     */
    setRaw(key: string, v: unknown): void;
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

/**
 * What a definition's own widgets are given to draw with.
 *
 * The panel owns React and the form state; a definition owns its widgets. This
 * is the seam — a definition never imports `panel.ts`, and `panel.ts` never
 * imports a definition's widgets, so a structure widget cannot reach into the
 * list screen and a list screen cannot grow a special case for shapes.
 */
export interface PanelContext {
    /** `React.createElement`, bound. */
    h: (...args: unknown[]) => unknown;
    /** The live form being edited. */
    form: Record<string, string>;
    /** The stored config, for relations a form field cannot show on its own. */
    cfg: ModConfig;
    /** Write one form field. */
    setField: (key: string, value: string) => void;
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
}

/** The parts of the panel a definition may own. */
export interface DefinitionPanel {
    /**
     * The control for one of this definition's field kinds.
     *
     * Return `null` for a kind it does not own, so the panel falls through to
     * the generic renderer. A definition claims a kind rather than the panel
     * knowing about it, which is the point: adding a structure-only widget must
     * not add a `kind === "shape"` branch to the generic form renderer.
     */
    renderField?: (ctx: FieldContext) => unknown;
    /**
     * A block drawn under the form's title, above the sections.
     *
     * For a relation that is real but has no field — the structure's unlock node
     * is chosen in a picker, and the question the author actually has is "what
     * does that grant, and does it cost anything", which the picker's options
     * cannot answer.
     */
    renderHeader?: (ctx: PanelContext) => unknown;
}

// ── The definition itself ────────────────────────────────────────────────────

/**
 * One object the panel can author.
 *
 * Every member is optional except `fields`, because a definition should not have
 * to invent hooks it has nothing to say about: a category with no cross-field
 * rule writes no `validate`, and one with no odd control writes no `renderField`.
 */
export interface Definition {
    /** The tab this definition is reached through. */
    tab: Tab;
    /**
     * The schema: every field, in the order the form draws them.
     *
     * Order is the section order, because `sectionsFor` groups by consecutive
     * equality — a field list is also a layout.
     */
    fields: FieldSpec[];
    /**
     * Stored keys this form owns; everything else round-trips via the
     * passthrough so an edit never drops a field the engine understands.
     */
    formCovered: string[];
    /** Stored entry → form strings. */
    entryToForm?: (entry: Record<string, unknown>, read: EntryReader) => void;
    /** Form strings → stored entry. */
    formToEntry?: (form: Record<string, string>, write: EntryWriter) => void;
    /**
     * Validate one of this definition's own field kinds.
     *
     * The generic rules in `validateField` are per-kind and shared; this is for a
     * kind only this object uses, so only this object can say what a legal one
     * looks like. Returning `undefined` means "no opinion", which is what keeps
     * the generic loop from having to know that `shape` exists.
     */
    validateField?: (field: FieldSpec, value: string) => string | undefined;
    /**
     * Rules a single field cannot express, added to the per-field results.
     *
     * This is the escape hatch that stays an escape hatch: a rule that only
     * makes sense across two fields (a min that must not exceed its max) does
     * not belong on either field, and inventing a field for it would be worse.
     */
    validate?: (form: Record<string, string>, errors: Record<string, string>) => void;
    /**
     * Seed a *new* entry's form, after the field defaults are applied.
     *
     * For a decision the author should not have to make to get a first save —
     * a structure must name an unlock node, so a new one starts on the built-in
     * default rather than on nothing.
     */
    onNewEntry?: (form: Record<string, string>) => void;
    /** The parts of the panel this definition owns. */
    panel?: DefinitionPanel;
}
