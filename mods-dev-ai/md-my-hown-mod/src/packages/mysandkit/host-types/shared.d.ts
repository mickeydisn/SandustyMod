/**
 * Host primitives vendored from `@sandustry-modding/types`
 * (`__scraped-mods/SandustryTypes/src/shared/`).
 *
 * These are declaration-only: the host owns the runtime values.
 */

/**
 * Number handle that does not mix with a different tag.
 *
 * Plain `number` stays assignable (so values read off the host and raw numbers
 * from mod code both work), but a handle tagged `"elementType"` is rejected
 * where a `"terrainType"` is expected. That is what stops an element type from
 * being passed into a terrain slot.
 */
export type TaggedNumber<Tag extends string> = number & {
    readonly __tag?: Tag;
};

/**
 * String id that does not mix with a different tag.
 *
 * Plain `string` stays assignable, so `"sand"` and any `string` variable still
 * work — no churn for existing call sites. But an id *returned by the host or
 * annotated as one domain* is rejected in another, which is what
 * `string | number` unions could never do.
 */
export type TaggedString<Tag extends string> = string & {
    readonly __idTag?: Tag;
};

/**
 * Known string literals plus any other string.
 *
 * `T | string` collapses to `string` and drops autocomplete; the
 * `string & {}` intersection keeps both the suggestions and the openness.
 */
export type LooseString<T extends string> = T | (string & Record<never, never>);

/** Packed simulation cell id from `world.getCellIdAtCell`. */
export type CellId = TaggedNumber<"cellId">;

/** Grid cell position as `[cellX, cellY]` — column first, then row. */
export type CellCoordinates = [cellX: number, cellY: number];

/** Grid cell position as an object — preferred in event and hook payloads. */
export type CellXY = {
    /** Cell column. */
    cellX: number;
    /** Cell row. */
    cellY: number;
};

/** 2D vector in world or cell space. World positions use pixels. */
export type Vector2 = {
    /** Horizontal component. */
    x: number;
    /** Vertical component. */
    y: number;
};

/** 2D size in pixels or UI units. Not for grid extents. */
export type Size2 = {
    /** Horizontal size. */
    width: number;
    /** Vertical size. */
    height: number;
};

/** JSON value: primitive, object, array, or null. */
export type JsonValue = string | number | boolean | JsonObject | JsonValue[] | null;

/** JSON object with string keys and {@link JsonValue} values. */
export type JsonObject = {
    [key: string]: JsonValue;
};
