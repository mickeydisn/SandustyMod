/**
 * The relations between the mod's own objects.
 *
 * The engine has a 40-edge type graph (`doc-bundel/object-graph.json`) but that
 * is *engine* types, and it does not answer the question a user actually has:
 * which of my own entries point at which? A trigger that references a signal
 * that no longer exists is the most common way a mod like this breaks, and
 * nothing on screen says so.
 *
 * So the table is written out by hand rather than derived, because each row is a
 * claim about a specific field on a specific form — and a claim like that
 * deserves to be checked. `relations.test.ts` verifies every field named here
 * really exists in the form it is filed under and really belongs to that
 * category, so the table cannot quietly rot.
 */
import type { Tab } from "./schema.ts";

export interface Relation {
    /** The object that holds the reference. */
    from: Tab;
    /** The form field that holds it. */
    field: string;
    /** The kind of object it points at. */
    to: Tab;
    /** Plain-language explanation, for the Help screen. */
    note: string;
    /**
     * `required` — the engine rejects the registration without it.
     * `optional` — omitting it is valid and simply does nothing.
     */
    strength: "required" | "optional";
    /**
     * True when the field holds more than one id (a `string[]` such as
     * `outputs` or `unlocks`). The live graph expands each one separately.
     */
    many?: boolean;
}

export const RELATIONS: Relation[] = [
    // ── production ──────────────────────────────────────────────────────────
    // ── recipes: the inputs and every output stream ─────────────────────────
    // These were the worst gap: a recipe's whole job is to name things, and the
    // graph showed only one of the five places it does.
    {
        from: "recipes",
        field: "input",
        to: "items",
        note: "The item the machine consumes. Some machine kinds take an element instead.",
        strength: "optional",
    },
    {
        from: "recipes",
        field: "outputs",
        to: "elements",
        note: "What the machine makes. One entry per output, each with its own chance.",
        strength: "optional",
        many: true,
    },
    {
        from: "recipes",
        field: "outputsAbove",
        to: "elements",
        note: "Pushed upward out of the machine — a chute or pipe output.",
        strength: "optional",
    },
    {
        from: "recipes",
        field: "outputsBelow",
        to: "elements",
        note: "Pushed downward out of the machine.",
        strength: "optional",
    },
    {
        from: "recipes",
        field: "outputElement",
        to: "elements",
        note: "What the built-in machine produces. The engine reads this as an element id.",
        strength: "optional",
    },
    {
        from: "contacts",
        field: "inputA",
        to: "elements",
        note: "One of the two elements that must touch.",
        strength: "required",
    },
    {
        from: "contacts",
        field: "inputB",
        to: "elements",
        note: "The other element. Order does not matter to the engine.",
        strength: "required",
    },
    {
        from: "contacts",
        field: "outputA",
        to: "elements",
        note: "What forms when the two touch.",
        strength: "optional",
    },
    {
        from: "contacts",
        field: "outputB",
        to: "elements",
        note: "The second product. Optional — a contact may produce one thing.",
        strength: "optional",
    },
    {
        from: "interactions",
        field: "elementId",
        to: "elements",
        note: "The element this interaction is attached to.",
        strength: "required",
    },
    {
        from: "interactions",
        field: "structures",
        to: "structures",
        note: "The machines named in this element's interaction tooltip.",
        strength: "optional",
        many: true,
    },
    {
        from: "interactions",
        field: "destroyerItems",
        to: "items",
        note:
            "Items this element destroys when used. A corrosion element eats through a drill bit this way.",
        strength: "optional",
        many: true,
    },
    {
        from: "processing",
        field: "structureType",
        to: "structures",
        note: "The machine this processor runs inside. Without it, the processor never ticks.",
        strength: "required",
    },

    // ── world ───────────────────────────────────────────────────────────────
    {
        from: "terrains",
        field: "outputElement",
        to: "elements",
        note: "The element this terrain drops when it is dug up.",
        strength: "optional",
    },
    {
        from: "terrains",
        field: "excavationRequirements",
        to: "items",
        note: "Items that can dig this terrain. With none set, anything can.",
        strength: "optional",
        many: true,
    },
    {
        from: "excavation",
        field: "terrainRulesJson",
        to: "terrains",
        note: "Per-terrain dig rules — which terrain each rule applies to, and what it produces.",
        strength: "optional",
        many: true,
    },

    // ── items: everything a tool points at ─────────────────────────────────
    {
        from: "items",
        field: "excavationProfileId",
        to: "excavation",
        note: "The dig rules this tool uses. Without one it cannot dig anything.",
        strength: "optional",
    },
    {
        from: "items",
        field: "projectileId",
        to: "projectiles",
        note: "What this weapon shoots when used. A weapon with none does nothing on use.",
        strength: "optional",
    },
    {
        from: "items",
        field: "spriteId",
        to: "sprites",
        note: "The icon this item shows in the hotbar and inventory.",
        strength: "optional",
    },

    // ── structures: what a machine is made of ───────────────────────────────
    {
        from: "structures",
        field: "imageName",
        to: "sprites",
        note: "The sprite this structure is drawn with. A structure with none is invisible.",
        strength: "optional",
    },
    {
        from: "structures",
        field: "blockGridType",
        to: "structures",
        note:
            "Shares another structure's block grid, so both keep one shared grid instead of one each. Leave empty to get your own.",
        strength: "optional",
    },
    {
        from: "structures",
        field: "variantsJson",
        to: "structures",
        note: "Other structures this one rotates to look like, and at which angles.",
        strength: "optional",
        many: true,
    },

    // ── tech & upgrades ─────────────────────────────────────────────────────
    {
        from: "techs",
        field: "unlockStructures",
        to: "structures",
        note: "Structures this tech makes buildable.",
        strength: "optional",
        many: true,
    },
    {
        // The required owner of the link. The engine only ever reads the *tech*
        // side, so this is the panel's own handle — and the side an author reasons
        // from ("this one is behind research").
        from: "structures",
        field: "unlockNode",
        to: "unlockNodes",
        note: "The node that gates this structure.",
        strength: "required",
        many: false,
    },
    {
        // A node either builds a tech of its own or borrows one. The borrow is the
        // only link *out* of a node, and omitting it would leave a borrowed node
        // looking like a self-contained one in the graph.
        from: "unlockNodes",
        field: "techId",
        to: "techs",
        note: "An existing engine tech to use instead of building one.",
        strength: "optional",
        many: false,
    },
    {
        // Read-only in the graph's terms: the link is stored on each structure and
        // this row is the reverse view of it. Declared so the graph can show what a
        // node holds back, and marked optional because the *authoritative* edge is
        // the structure → node one above.
        from: "unlockNodes",
        field: "gatesStructures",
        to: "structures",
        note: "Structures this node gates (derived — set it on the structure).",
        strength: "optional",
        many: true,
    },
    {
        // A self-built node places itself in the tech grid. Declared against the
        // category it is read from, which is `unlockNodes` and not `techs` — the
        // engine tech it produces is a *result*, not the thing being edited.
        from: "unlockNodes",
        field: "parentId",
        to: "techs",
        note: "Where the built tech node sits in the grid.",
        strength: "optional",
        many: false,
    },
    {
        from: "unlockNodes",
        field: "requires",
        to: "techs",
        note: "Other research the built tech node needs first.",
        strength: "optional",
        many: true,
    },
    {
        from: "techs",
        field: "unlockItems",
        to: "items",
        note: "Items this tech puts in the hotbar.",
        strength: "optional",
        many: true,
    },
    {
        from: "techs",
        field: "requires",
        to: "techs",
        note: "Other techs that must be researched first. This is what makes a tree.",
        strength: "optional",
        many: true,
    },
    {
        from: "techs",
        field: "parentId",
        to: "techs",
        note:
            "Another tech that must be researched first. Self-referential — this is what makes a tree.",
        strength: "optional",
    },
    {
        from: "upgrades",
        field: "itemId",
        to: "items",
        note: "The item this upgrade applies to. An upgrade for a deleted item does nothing.",
        strength: "required",
    },
    {
        from: "upgrades",
        field: "categoryId",
        to: "categories",
        note: "Which upgrade category it is listed under. The engine rejects one with no name.",
        strength: "optional",
    },
    {
        from: "categories",
        field: "requirementTechId",
        to: "techs",
        note:
            "A tech id stored on the category. Nothing in the engine ever reads it, so a dangling id here is harmless — but it is recorded because it looks like it should matter.",
        strength: "optional",
    },

    // ── systems ─────────────────────────────────────────────────────────────
    {
        from: "signals",
        field: "target",
        to: "structures",
        note: "The structure the signal is attached to. A signal without one does nothing.",
        strength: "required",
    },
    {
        from: "energy",
        field: "structureId",
        to: "structures",
        note: "The structure that carries this energy node.",
        strength: "required",
    },
    // ── structure behaviours ──
    //
    // `api.structureBehaviors` takes *structure ids*, not handler keys: a
    // conveyor is registered against one structure, a launcher against three
    // (`upType` / `leftType` / `rightType`). They sit inside the behaviour's
    // `definition` object because that is the shape the engine wants, but they
    // are ordinary references and belong in the graph like any other — a typo
    // here means a conveyor that quietly transports nothing.
    {
        from: "behaviors",
        field: "structureId",
        to: "structures",
        note: "The structure this conveyor moves items for.",
        strength: "required",
    },
    // ── placement configs ──
    //
    // The one reference a placement config has. It is the field the engine keys
    // the whole definition by — `registerPlacementConfig` stores the entry in a
    // `Map` under this id and only reads it while that building is selected — so
    // a typo here produces a config that validates, registers, and is then never
    // shown to the player. Required for the same reason it is required for a
    // behaviour: the engine throws without it.
    {
        from: "placementConfigs",
        field: "structureId",
        to: "structures",
        note: "The building whose placement hotbar these fields appear on.",
        strength: "required",
    },
    {
        from: "behaviors",
        field: "upType",
        to: "structures",
        note: "The structure a launcher fires upwards.",
        strength: "required",
    },
    {
        from: "behaviors",
        field: "leftType",
        to: "structures",
        note: "The structure a launcher fires leftwards.",
        strength: "required",
    },
    {
        from: "behaviors",
        field: "rightType",
        to: "structures",
        note: "The structure a launcher fires rightwards.",
        strength: "required",
    },
    {
        from: "projectiles",
        field: "spriteId",
        to: "sprites",
        note: "The graphics entry the projectile draws with.",
        strength: "optional",
    },
];

/** Every relation declared by a category, in table order. */
export function relationsOf(cat: Tab): Relation[] {
    return RELATIONS.filter((r) => r.from === cat);
}

/** The categories something points at, deduplicated and in table order. */
export function targetsOf(cat: Tab): Tab[] {
    return [...new Set(RELATIONS.filter((r) => r.from === cat).map((r) => r.to))];
}
