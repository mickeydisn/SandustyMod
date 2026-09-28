/**
 * Resolving `{{name}}` references in an action's parameters.
 *
 * Once a process has a context, some of a step's params are not literals any more:
 * they are *pointers* at whatever an earlier step bound. `resolveRefs` is the one
 * place that turns a pointer into a value, and it is deliberately strict about the
 * two things that would otherwise fail silently.
 *
 * ## The three rules
 *
 * 1. **A whole-string reference keeps its type.** `"{{count}}"` with `count` bound to
 *    the number 3 resolves to the **number** 3, not to `"3"`. This is the rule that
 *    makes the feature usable: `processorConvert`'s `chance` is a number, and
 *    stringifying it would reach the engine as text.
 * 2. **A reference inside text is text.** `"power {{n}} of 10"` resolves to
 *    `"power 3 of 10"`, because that is a sentence and not a value. Only the
 *    whole-string case preserves the type.
 * 3. **An unknown reference is an error.** Not `undefined`, and not `""`. A typo'd
 *    `{{isWatre}}` resolving to an empty string would reach the engine as a real
 *    value — the same class of bug as the `pwoer: 40` parameter `withParams` refuses
 *    to accept in `../excavation-option/registry.ts`. Here it is worse: the value is
 *    not dropped, it is *sent*.
 *
 * ## Why the error is reported, not thrown
 *
 * A process must keep running when one step's params are wrong — the same
 * isolation rule `compileProcess` already applies to a throwing action. So a
 * failure is collected and the offending param is **omitted** from the resolved
 * object, leaving the action to run with that one param absent and (usually) to
 * complain in its own terms. Throwing here would let a typo in step 3 of 8 kill the
 * other seven.
 *
 * @module
 */
import { hasVar, type ProcessContext, varsRead } from "./context.ts";

/** One unresolved reference, for the panel and the log. */
export interface RefFailure {
    /** The step whose params contained it. */
    step: string;
    /** The exact text that was not found. */
    name: string;
}

/** The result of resolving one step's params. */
export interface ResolvedRefs<T> {
    /** The params, with every reference replaced. */
    value: T;
    /** What could not be resolved. Empty on success. */
    problems: RefFailure[];
}

/** Matches `{{ name }}`, tolerating spaces, and captures the name. */
const REF = /\{\{\s*([^{}]+?)\s*\}\}/g;

/** A name that is exactly one reference and nothing else. */
function wholeRef(text: string): string | null {
    const m = /^\{\{\s*([^{}]+?)\s*\}\}$/.exec(text);
    return m ? m[1].trim() : null;
}

/**
 * Replace every reference in one string.
 *
 * Returns the raw value when the whole string is a single reference (rule 1), and a
 * string with the references interpolated otherwise (rule 2).
 */
function resolveText(
    ctx: ProcessContext,
    text: string,
    step: string,
    problems: RefFailure[],
): unknown {
    const alone = wholeRef(text);
    if (alone !== null) {
        if (!hasVar(ctx, alone)) {
            problems.push({ step, name: alone });
            return undefined;
        }
        return varsRead(ctx, alone);
    }

    // A string with no reference in it is left exactly as it was, so a param that
    // merely *contains* braces is not mangled. That is the reason this is a separate
    // branch rather than a single `replace` with a callback.
    if (!text.includes("{{")) return text;

    return text.replace(REF, (whole, raw: string) => {
        const name = raw.trim();
        if (!hasVar(ctx, name)) {
            problems.push({ step, name });
            // Left as the literal text rather than dropped, so the engine is handed
            // something visibly wrong instead of a plausible-looking value.
            return whole;
        }
        const v = varsRead(ctx, name);
        return v === undefined || v === null ? "" : String(v);
    });
}

/**
 * Resolve a value of any shape: a string, an array, or a nested object.
 *
 * Objects recurse because an action's `options` is **nested JSON**, not a flat bag —
 * `buildHandlerOptions` produces whatever the author wrote, and a `{{name}}` two
 * levels down is as legitimate as one at the top. A first version handled arrays only,
 * and the test that caught it is the reason this recurses.
 *
 * Numbers and booleans pass through untouched. A `number` is already a value; there
 * is nothing for `{{…}}` to mean inside one, and coercing it to a string to look for
 * a reference would invent syntax the author never typed.
 */
function resolveAny(
    ctx: ProcessContext,
    value: unknown,
    step: string,
    problems: RefFailure[],
): unknown {
    if (typeof value === "string") return resolveText(ctx, value, step, problems);
    if (Array.isArray(value)) return value.map((v) => resolveAny(ctx, v, step, problems));
    // A plain object only. A function or a Date is a value the author put there and
    // it is passed through — rebuilding it as a plain object would strip its identity.
    if (value !== null && typeof value === "object") {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[k] = resolveAny(ctx, v, step, problems);
        }
        return out;
    }
    return value;
}

/**
 * Resolve every reference in one step's `options` bag.
 *
 * A failed reference **omits its param** rather than setting it to `undefined`: the
 * engine and the action both treat "absent" as "not supplied", which is recoverable,
 * while a present-but-undefined value is a type the caller did not ask for.
 */
export function resolveRefs(
    options: Record<string, unknown> | undefined,
    ctx: ProcessContext,
    step: string,
): ResolvedRefs<Record<string, unknown>> {
    const problems: RefFailure[] = [];
    if (!options) return { value: {}, problems };

    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(options)) {
        const resolved = resolveAny(ctx, raw, step, problems);
        // A whole-string reference to a name that does not exist resolves to
        // `undefined`; that param is dropped, and recorded above.
        if (resolved === undefined) continue;
        out[key] = resolved;
    }
    return { value: out, problems };
}

/** Every `{{name}}` a value refers to — for the panel's context list, and for validation. */
export function refsIn(value: unknown, into: Set<string> = new Set()): Set<string> {
    if (typeof value === "string") {
        for (const m of value.matchAll(REF)) into.add(m[1].trim());
    } else if (Array.isArray(value)) {
        for (const v of value) refsIn(v, into);
    } else if (value !== null && typeof value === "object") {
        // Objects recurse for the same reason `resolveAny` does: `options` is nested
        // JSON, so a reference three levels down is still a reference.
        for (const v of Object.values(value as Record<string, unknown>)) refsIn(v, into);
    }
    return into;
}
