/**
 * The vocabulary every other schema file is written against.
 *
 * Types only — nothing here survives compilation — so `fields.ts`, `form.ts` and
 * `validate.ts` can all be written against these without importing each other.
 * Kept as one file because they are one idea: `FieldSpec.section` is a string,
 * and `sectionsFor` (in `form.ts`) is what turns it into the sections the panel
 * draws. Splitting them would put two halves of a single concept in two files.
 */
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
    /**
     * The HandlerAction catalogue, and the ProjectileOption catalogue beside it.
     *
     * Synced with the two other `Tab` lists (`../schema.ts` and
     * `../definition/types.ts`). **Nothing imports this file** — it is a
     * hand-copied third of the same vocabulary, kept in step so it cannot go stale
     * and mislead the next reader. The authoritative list is `../schema.ts`.
     */
    | "action"
    | "projectileOption"
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

/**
 * Top-level menu, in the order the user asked for.
 *
 * Three earlier groups are gone rather than renamed: `Systems` was a grab-bag
 * of unrelated things (a trigger, a key binding, a processor, a dig profile) and
 * `Hooks` held exactly one screen, which is a group that costs a click and
 * explains nothing. Their screens now sit under **Extend** and **Actions**,
 * where each one is next to the things it connects to.
 *
 * **Content** is the only group of things the player *sees* in the world, so it
 * reads first. **Store** is last: Map and JSON are for inspecting what you
 * built, not for building it.
 */

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
     * Repeating row editor: `[{ type, spanTiles? }]` (structure build modes). A
     * single-mode form silently loses every mode after the first.
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
