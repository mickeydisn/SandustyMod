/**
 * placement.ts — the rules `registerPlacementConfig` enforces, in one place.
 *
 * ## Why this file exists
 *
 * The engine validates a placement config and **throws** (bundel 88861):
 *
 * ```js
 * c = (e, t) => {
 *     if (!t.structureId || !t.fields.length)
 *         throw new Error("Placement config requires a structureId and fields.");
 *     const n = new Set;
 *     for (let e = 0; e < t.fields.length; e++) {
 *         const r = t.fields[e];
 *         if (!r.id || !a(r) || n.has(r.id))
 *             throw new Error(`Invalid or duplicate placement field "${r.id}".`);
 *         if (n.add(r.id),
 *         "choice" === r.type && 0 === r.options.length)
 *             throw new Error(`Placement choice "${r.id}" requires at least one option.`);
 *         if ("choice" === r.type)
 *             for (let e = 0; e < r.options.length; e++)
 *                 if (!a(r.options[e]))
 *                     throw new Error(`Placement choice "${r.id}" has an option without a label.`)
 *     }
 *     r.set(t.structureId, t), u(e, t.structureId)
 * }
 * ```
 *
 * A throw inside a mod's registration is the worst failure mode there is: the
 * config silently does not exist, and the player sees no hotbar widget and no
 * message. So the rules are checked **twice** — once here, before the call, and
 * once in the panel, at save time — and this module is what both use. Two copies
 * of these five rules would be two places for them to drift, and a drifted copy
 * is exactly the silent failure this is meant to prevent.
 *
 * ## The two things the typings get wrong
 *
 * Both are load-bearing here, and both are why this is not a straight port of
 * `PlacementConfigField`:
 *
 * 1. **A label is `label` *or* `labelKey`.** The shipped `.d.ts` declares only
 *    `labelKey`, but the engine's predicate accepts either:
 *
 *    ```js
 *    a = e => "string" == typeof e.label && e.label.trim().length > 0 ||
 *                 "string" == typeof e.labelKey && e.labelKey.trim().length > 0
 *    ```
 *
 *    So a plain `label` is the *primary* form and `labelKey` is for a translated
 *    label. Only requiring `labelKey` would reject a config the engine accepts.
 *
 * 2. **A `type` outside `integer` / `choice` is fatal, not merely unsupported.**
 *    The value is read with `"integer" === r.type ? s(...) : l(...)`, so anything
 *    else takes the *choice* path — and `l` walks `e.options.length` without a
 *    guard, so an unrecognised type with no `options` dies on a `TypeError`
 *    rather than on the engine's own readable error. Worth catching first.
 */
import type { PlacementConfigConfig, PlacementFieldConfig } from "../constants.ts";

/**
 * The engine's `a` predicate: a non-blank `label` or a non-blank `labelKey`.
 *
 * `.trim()` is load-bearing — the engine trims, so `"   "` is *not* a label and
 * must not pass here either.
 */
export function hasPlacementLabel(v: unknown): boolean {
    if (!v || typeof v !== "object") return false;
    const o = v as { label?: unknown; labelKey?: unknown };
    const text = (x: unknown): boolean => typeof x === "string" && x.trim().length > 0;
    return text(o.label) || text(o.labelKey);
}

/**
 * Check one entry, returning the engine's own message when it would throw.
 *
 * `null` means the entry is safe to hand to the engine. The messages are
 * deliberately the engine's wording: when the panel refuses a save and when the
 * boot log refuses a registration, the author should be reading the same
 * sentence the game would have thrown at them.
 */
export function placementConfigProblem(
    def: Partial<PlacementConfigConfig> | null | undefined,
): string | null {
    if (!def) return "no placement config";
    const id = typeof def.structureId === "string" ? def.structureId.trim() : "";
    const fields = def.fields;
    if (!id || !Array.isArray(fields) || fields.length === 0) {
        return "Placement config requires a structureId and fields.";
    }
    const seen = new Set<string>();
    for (const f of fields as PlacementFieldConfig[]) {
        const fid = typeof f?.id === "string" ? f.id.trim() : "";
        if (!fid || !hasPlacementLabel(f) || seen.has(fid)) {
            // The id is interpolated *raw*, not defaulted, because the engine's
            // own template literal does exactly that: a field with no `id` makes
            // the game say `field "undefined"`. Coercing it to `""` here would
            // make the panel and the boot log disagree with the throw they are
            // both quoting.
            return `Invalid or duplicate placement field "${f?.id}".`;
        }
        seen.add(fid);
        const type = f?.type;
        if (type !== "integer" && type !== "choice") {
            // Not the engine's wording, because the engine has none here — it
            // would walk `options.length` on undefined and throw a TypeError.
            return `Placement field "${fid}" has type "${
                String(type)
            }" — expected integer or choice.`;
        }
        if (type === "choice") {
            const opts = (f as { options?: unknown }).options;
            if (!Array.isArray(opts) || opts.length === 0) {
                return `Placement choice "${fid}" requires at least one option.`;
            }
            for (const o of opts) {
                if (!hasPlacementLabel(o)) {
                    return `Placement choice "${fid}" has an option without a label.`;
                }
            }
        }
    }
    return null;
}

/**
 * The payload the engine is actually given.
 *
 * Only `structureId` and `fields` are sent. The mod-local `id` exists for the
 * list row and the already-registered guard, and the engine neither reads nor
 * stores it — passing it would be a stray key in a definition the engine puts
 * straight into a `Map` and hands back to the player.
 */
export function placementConfigPayload(
    def: PlacementConfigConfig,
): { structureId: string; fields: PlacementFieldConfig[] } {
    return { structureId: def.structureId, fields: def.fields };
}
