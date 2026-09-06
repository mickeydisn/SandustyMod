// Dot/bracket path access: "items[2].name", "config.volume", "items[]" (whole array)

export type PathSegment = string | number | "[]";

// Three token kinds: a plain name run, a numeric [index], or a literal [] (whole-array marker).
const TOKEN = /([^[.\]]+)|\[(\d+)\]|(\[\])/g;

export function parsePath(path: string): PathSegment[] {
  if (!path) return [];
  const out: PathSegment[] = [];
  const re = new RegExp(TOKEN.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) {
    if (m[1] !== undefined) out.push(/^\d+$/.test(m[1]) ? Number(m[1]) : m[1]);
    else if (m[2] !== undefined) out.push(Number(m[2]));
    else if (m[3] !== undefined) out.push("[]");
  }
  return out;
}

/**
 * Read a value at a path. "[]" is a no-op/identity segment meaning "the
 * array itself" rather than an index — so getPath(root, "a[]") returns the
 * whole array, and getPath(root, "a[].length") returns its length (because
 * after the "[]" no-op, ".length" is just a normal property read on the
 * array). Use a numeric index ("a[0]") to read a specific element.
 */
export function getPath<V = unknown>(root: unknown, path: string): V | undefined {
  let cur: any = root;
  for (const part of parsePath(path)) {
    if (part === "[]") continue;
    if (cur == null) return undefined;
    cur = cur[part as any];
  }
  return cur as V;
}

function ensureChild(cur: any, part: PathSegment, nextIsIndex: boolean): any {
  if (part === "[]") {
    throw new Error(`setPath: "[]" cannot appear in the middle of a path being written to.`);
  }
  if (typeof part === "number") {
    if (!Array.isArray(cur)) {
      throw new Error(`setPath: expected an array to index into at "[${part}]"`);
    }
    while (cur.length <= part) cur.push(nextIsIndex ? [] : {});
    if (cur[part] == null || typeof cur[part] !== "object") {
      cur[part] = nextIsIndex ? [] : {};
    }
  } else {
    if (cur == null || typeof cur !== "object") {
      throw new Error(`setPath: cannot descend into "${part}" of a non-object`);
    }
    if (cur[part] == null || typeof cur[part] !== "object") {
      cur[part] = nextIsIndex ? [] : {};
    }
  }
  return cur[part as any];
}

/**
 * Set a value at a path, creating intermediate objects/arrays (and growing
 * arrays) as needed. "[]" is not settable — use a numeric index
 * ("a[0] = X") to write a specific element, or addToPath()/pushPath() to
 * append a new one.
 */
export function setPath(root: any, path: string, value: unknown): void {
  const parts = parsePath(path);
  if (parts.length === 0) return;
  const last = parts[parts.length - 1];
  if (last === "[]") {
    throw new Error(
      `setPath: "${path}" ends in "[]" (whole array), which isn't settable. ` +
        `Use a numeric index to write an element, or addToPath()/pushPath() to append.`,
    );
  }
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = ensureChild(cur, parts[i], typeof parts[i + 1] === "number");
  }
  if (typeof last === "number") {
    if (!Array.isArray(cur)) throw new Error(`setPath: expected an array at "${path}"`);
    while (cur.length <= last) cur.push(undefined);
    cur[last] = value;
  } else {
    cur[last] = value;
  }
}

/** Push a value onto the array at `path`, creating the array if it doesn't exist yet. Returns the new length. */
export function pushPath(root: any, path: string, value: unknown): number {
  let arr = getPath<unknown[]>(root, path);
  if (!Array.isArray(arr)) {
    arr = [];
    setPath(root, path, arr);
  }
  arr.push(value);
  return arr.length;
}

/**
 * Append to the array at `path`. If `value` is null/undefined, a default
 * item is generated instead of pushing null: it clones the shape of the
 * array's first existing element with every primitive reset to its zero
 * value (0 / false / "" / null), or falls back to `null` if the array is
 * currently empty (no shape to copy). Returns the index of the new item.
 */
export function addToPath(root: any, path: string, value?: unknown): number {
  const existing = getPath<unknown[]>(root, path);
  const arrExists = Array.isArray(existing);
  const item = value ?? (arrExists && existing.length > 0 ? defaultLike(existing[0]) : null);
  const len = pushPath(root, path, item);
  return len - 1;
}

function defaultLike(sample: unknown): unknown {
  if (sample === null || sample === undefined) return null;
  if (typeof sample === "boolean") return false;
  if (typeof sample === "number") return 0;
  if (typeof sample === "string") return "";
  if (Array.isArray(sample)) return [];
  if (typeof sample === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(sample as Record<string, unknown>)) out[k] = defaultLike(v);
    return out;
  }
  return null;
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

/** Inverse of parsePath: turn segments back into "a.b[2].c" / "a.b[]" form. */
export function formatPath(parts: PathSegment[]): string {
  let out = "";
  for (const p of parts) {
    if (typeof p === "number") out += `[${p}]`;
    else if (p === "[]") out += "[]";
    else out += out ? `.${p}` : p;
  }
  return out;
}
