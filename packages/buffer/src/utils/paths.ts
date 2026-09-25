// Dot/bracket path access: "items[2].name", "config.volume", "items[]" (whole array)

export type PathSegment = string | number | "[]";
type PathContainer = Record<string, unknown> | unknown[];

function isContainer(value: unknown): value is PathContainer {
    return value !== null && typeof value === "object";
}

function asContainer(value: unknown): PathContainer | null {
    return isContainer(value) ? value : null;
}

function readChild(value: unknown, part: string | number): unknown {
    if (!isContainer(value)) return undefined;
    return (value as Record<string | number, unknown>)[part];
}

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
    let current: unknown = root;
    for (const part of parsePath(path)) {
        if (part === "[]") continue;
        current = readChild(current, part);
    }
    return current as V | undefined;
}

function ensureChild(
    current: PathContainer,
    part: PathSegment,
    nextIsIndex: boolean,
): PathContainer {
    if (part === "[]") {
        throw new Error(`setPath: "[]" cannot appear in the middle of a path being written to.`);
    }
    if (typeof part === "number") {
        if (!Array.isArray(current)) {
            throw new Error(`setPath: expected an array to index into at "[${part}]"`);
        }
        while (current.length <= part) current.push(nextIsIndex ? [] : {});
        if (!isContainer(current[part])) {
            current[part] = nextIsIndex ? [] : {};
        }
        return current[part] as PathContainer;
    }

    if (!isContainer(current)) {
        throw new Error(`setPath: cannot descend into "${part}" of a non-object`);
    }
    const record = current as Record<string, unknown>;
    if (!isContainer(record[part])) {
        record[part] = nextIsIndex ? [] : {};
    }
    return record[part] as PathContainer;
}

/**
 * Set a value at a path, creating intermediate objects/arrays (and growing
 * arrays) as needed. "[]" is not settable — use a numeric index
 * ("a[0] = X") to write a specific element, or addToPath()/pushPath() to
 * append a new one.
 */
export function setPath(root: unknown, path: string, value: unknown): void {
    const parts = parsePath(path);
    if (parts.length === 0) return;
    const last = parts[parts.length - 1];
    if (last === "[]") {
        throw new Error(
            `setPath: "${path}" ends in "[]" (whole array), which isn't settable. ` +
                `Use a numeric index to write an element, or addToPath()/pushPath() to append.`,
        );
    }
    let current = asContainer(root);
    if (!current) throw new Error(`setPath: root for "${path}" is not an object or array.`);
    for (let i = 0; i < parts.length - 1; i++) {
        current = ensureChild(current, parts[i], typeof parts[i + 1] === "number");
    }
    if (typeof last === "number") {
        if (!Array.isArray(current)) throw new Error(`setPath: expected an array at "${path}"`);
        while (current.length <= last) current.push(undefined);
        current[last] = value;
    } else {
        if (!isContainer(current)) {
            throw new Error(`setPath: cannot write "${path}" on a non-object`);
        }
        (current as Record<string, unknown>)[last] = value;
    }
}

/** Push a value onto the array at `path`, creating the array if it doesn't exist yet. Returns the new length. */
export function pushPath(root: unknown, path: string, value: unknown): number {
    let arr = getPath<unknown[]>(root, path);
    if (!Array.isArray(arr)) {
        arr = [];
        setPath(root, path, arr);
    }
    arr.push(value);
    return arr.length;
}

/**
 * Append to the array at `path`, creating the array if it doesn't exist yet.
 * `null`/`undefined` explicitly requests a shape clone: primitives become their
 * zero value and objects/arrays are cloned recursively. Returns the new index.
 */
export function addToPath(root: unknown, path: string, value: unknown): number {
    const existing = getPath<unknown[]>(root, path);
    const item = value === null || value === undefined
        ? (Array.isArray(existing) && existing.length > 0 ? zeroLike(existing[0]) : null)
        : value;
    const len = pushPath(root, path, item);
    return len - 1;
}

function zeroLike(sample: unknown): unknown {
    if (sample === null || sample === undefined) return null;
    if (typeof sample === "boolean") return false;
    if (typeof sample === "number") return 0;
    if (typeof sample === "string") return "";
    if (Array.isArray(sample)) return [];
    if (typeof sample === "object") {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(sample as Record<string, unknown>)) {
            out[k] = zeroLike(v);
        }
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
