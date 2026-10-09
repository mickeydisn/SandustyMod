/**
 * Ambient host enums, vendored from `@sandustry-modding/types`
 * (`__scraped-mods/SandustryTypes/src/sandkit/enums/index.d.ts`).
 *
 * These are `declare enum` on purpose: they exist for *types only*. The real
 * values come from `sandkit.enums.*` at runtime, so importing these as values
 * would be wrong. Use `import type` and rely on the host for the runtime enum.
 *
 * Numeric members can shift between game versions — prefer resolving string
 * ids through the API where a call accepts one.
 */

/**
 * Built-in element type ids, as a literal union.
 *
 * A literal union rather than a `declare enum`: a numeric enum is assignable
 * from any `number`, which would let an element type be passed where a terrain
 * type is expected (both enums contain `1`). Literal members keep the tagged
 * handle strict while still completing the known built-ins.
 *
 * Read the values from `sandkit.enums.ElementType` at runtime.
 */
export type ElementTypeEnum =
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 11
    | 12
    | 13
    | 14
    | 15
    | 16
    | 17
    | 18
    | 19
    | 20;

/** Terrain / special cell kinds in the simulation grid. */
export type CellTypeEnum =
    | 0
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6
    | 7
    | 8
    | 9
    | 10
    | 11
    | 12
    | 13
    | 14
    | 15
    | 16
    | 17
    | 18
    | 19
    | 20
    | 21
    | 22
    | 23
    | 24
    | 25
    | 26
    | 27
    | 28
    | 29
    | 30;

/** Built-in item ids. */
export type ItemIdEnum = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Physical behaviour category for an element. */
export type MatterTypeEnum = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Item categories. */
export type ItemTypeEnum = 1 | 2 | 3 | 4;

/** Linear vs rectangular structure placement. */
export type BuildModeEnum = 1 | 2;

/** Visibility and research state of a tech node. */
export type TechStatusEnum = 0 | 1 | 2 | 3 | 4;

/** Phases of a held or repeated player action. */
export type ActionStateEnum = 1 | 2 | 3;

/** High-level action channel (weapon, building, tool, mod). */
export type ActionTypeEnum = 1 | 2 | 3 | 4;

/** Zone rules that restrict player abilities. */
export type AuthorizationTypeEnum = 1 | 2 | 3 | 4 | 5 | 6;

/** Result of a build placement check. */
export type BuildingClearanceEnum = 1 | 2 | 3 | 4;
