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
    | "action"
    | "projectileOption"
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
    | "multiselect";

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
