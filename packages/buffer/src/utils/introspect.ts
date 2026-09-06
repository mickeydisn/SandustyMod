import { formatPath, type PathSegment } from "./paths.ts";

export type FieldKind = "bool" | "number" | "string" | "array" | "object";

export interface FieldInfo {
  /** Full dot/bracket path, directly usable with getPath/setPath, e.g. "players[0].score" or "players[].name". */
  path: string;
  kind: FieldKind;
  /** A short display name — the last real (non-"[]") path segment. */
  label: string;
  /** Current value at this path. For a "path[]" entry, this is the first array element (the one the type was inferred from), not the whole array. */
  value: unknown;
}

/**
 * Walk a record's state and list every field with its path and type, e.g.
 * for building an in-game "pick a variable" list.
 *
 * Arrays are summarized once using their *first element's* shape rather
 * than enumerated per current index — so an array never produces a
 * variable-length list of paths, and the "[]" path template stays valid
 * even as items are added/removed later:
 *
 *   listPaths({ a: [0, 1], b: [{ x: 1 }] })
 *   => [
 *        { path: "a[]",    kind: "number", label: "a", value: 0 },
 *        { path: "b[].x",  kind: "number", label: "x", value: 1 },
 *      ]
 *
 * getPath("a[]") returns the whole array; getPath("b[0].x") reads a real
 * element. Use a real index to read/write a specific item, and
 * addToPath()/pushPath() to append one.
 */
export function listPaths(
  root: unknown,
  /** How deep to recurse into nested objects/arrays. Default 8. */
  maxDepth: number = 8,
  /** Also list object/array container paths themselves (e.g. "players" as kind "array"), not just their leaves/templates. Default false. */
  includeContainers: boolean = true,
): FieldInfo[] {
  const out: FieldInfo[] = [];

  const labelFor = (parts: PathSegment[], path: string): string => {
    const last = parts[parts.length - 1];
    const named = last === "[]" ? parts[parts.length - 2] : last;
    return named !== undefined ? String(named) : path;
  };

  const visit = (value: unknown, parts: PathSegment[], depth: number): void => {
    if (depth > maxDepth) return;
    const kind = kindOf(value);
    const path = formatPath(parts);
    const label = labelFor(parts, path);

    if (kind === "object" && value) {
      if (includeContainers && parts.length > 0) out.push({ path, kind, label, value });
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        visit(v, [...parts, k], depth + 1);
      }
      return;
    }

    if (kind === "array") {
      const arr = value as unknown[];
      if (includeContainers && parts.length > 0) out.push({ path, kind, label, value });
      if (arr.length === 0) {
        // No element to infer a type from — still surface it as a discoverable,
        // currently-empty template so e.g. an "add item" UI has something to bind to.
        out.push({ path: formatPath([...parts, "[]"]), kind: "array", label, value: [] });
        return;
      }
      // Summarize using the first element's shape only — do NOT enumerate every index.
      visit(arr[0], [...parts, "[]"], depth + 1);
      return;
    }

    if (parts.length === 0) return; // root itself was a primitive; nothing to list
    out.push({ path, kind, label, value });
  };

  visit(root, [], 0);
  return out;
}

function kindOf(value: unknown): FieldKind {
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (Array.isArray(value)) return "array";
  if (value && typeof value === "object") return "object";
  return "string"; // null/undefined treated as an empty string-kind leaf
}
