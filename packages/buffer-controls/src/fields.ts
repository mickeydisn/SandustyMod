/**
 * Derive the JsonBuffer record and the sprite list from one declarative field
 * list.
 *
 * `BufferControlsField[]` is the single source of truth for every exposed path.
 * Nothing here reads a path segment by position: a field's `tag`, `category` and
 * filter `tags` are declared (or defaulted to the last segment / the parent
 * container), never inferred from the record's nesting depth.
 */
import { setPath, type FieldKind } from "@sandmd/buffer";
import { EXPOSED_KINDS } from "./const.ts";
import type { BufferControlsField, BufferControlsSprite, BufferControlsSprites } from "./types.ts";

/** Last dot segment of a path (`"P.InWater-ASeed.tickSpeed"` → `"tickSpeed"`). */
export function lastSegment(path: string): string {
    return path.split(".").at(-1) ?? path;
}

/** Parent container of a path (`"P.InWater-ASeed.tickSpeed"` → `"P.InWater-ASeed"`). */
export function parentPath(path: string): string {
    const parts = path.split(".");
    return parts.length > 1 ? parts.slice(0, -1).join(".") : "";
}

/** The sprite-matching tag of a field (declared, else the path's last segment). */
export function fieldTag(field: BufferControlsField): string {
    return field.tag ?? lastSegment(field.path);
}

/** The picker category of a field (declared, else the path's parent container). */
export function fieldCategory(field: BufferControlsField): string {
    return field.category ?? parentPath(field.path);
}

/** Build the JsonBuffer seed record from the field list. */
export function buildFieldsRecord<T extends object>(
    fields: readonly BufferControlsField[],
): T {
    const record = {} as T;
    for (const field of fields) setPath(record, field.path, field.default);
    return record;
}

/** Does a stored value have the declared field's kind? */
function matchesKind(value: unknown, kind: FieldKind): boolean {
    if (kind === "bool") return typeof value === "boolean";
    if (kind === "number") return typeof value === "number" && Number.isFinite(value);
    if (kind === "string") return typeof value === "string";
    return false;
}

/**
 * Re-shape a restored record onto the declared field list — the field list owns
 * the record, so:
 *   - a declared path keeps its current value,
 *   - a missing or wrong-kind value falls back to the field's `default`,
 *   - anything the field list does not declare is dropped.
 *
 * `JsonBuffer` restores a persisted record verbatim, so without this an older
 * save would keep removed knobs (which can no longer be matched to a field) and
 * miss newly-added ones. `changed` is true when the record differs from what was
 * read, i.e. when it needs rewriting.
 */
export function normalizeFieldsRecord<T extends object>(
    listed: readonly { path: string; kind: FieldKind }[],
    fields: readonly BufferControlsField[],
    read: (path: string) => unknown,
): { record: T; changed: boolean } {
    const declared = new Set(fields.map((field) => field.path));
    const scalars = listed.filter((entry) => EXPOSED_KINDS.includes(entry.kind));
    const changed = scalars.length !== fields.length ||
        scalars.some((entry) => !declared.has(entry.path));

    const record = {} as T;
    for (const field of fields) {
        const current = read(field.path);
        setPath(
            record,
            field.path,
            matchesKind(current, field.kind) ? current : field.default,
        );
    }
    return { record, changed };
}

/** One field's art → the tagged sprite entry the catalogue matches it by. */
function fieldSprite(field: BufferControlsField): BufferControlsSprite | null {
    const art = field.sprite;
    if (!art) return null;
    const base = {
        spriteId: art.spriteId,
        filePath: art.filePath,
        kind: field.kind,
        tag: fieldTag(field),
    };
    return art.action === "toggleRate"
        ? { ...base, action: "toggleRate", frames: art.frames }
        : { ...base, action: art.action };
}

/** Every declared field art, as sprite entries (in field order). */
export function fieldsToSprites(fields: readonly BufferControlsField[]): BufferControlsSprites {
    const out: BufferControlsSprites = [];
    for (const field of fields) {
        const sprite = fieldSprite(field);
        if (sprite) out.push(sprite);
    }
    return out;
}
