/**
 * The five rules `registerPlacementConfig` enforces — the shared validator.
 *
 * These are not this file's opinion. They are the engine's, read off its own
 * body (bundel 88861), which **throws** on each one. A throw inside mod
 * registration is the worst outcome available: the config silently does not
 * exist, the player sees no hotbar widget, and nothing says why.
 *
 * So the rules are asserted against the engine's *own* behaviour, and each test
 * states the line it comes from. The two that are *not* the engine's wording —
 * the unknown `type` check and the whitespace `label` — are marked as such,
 * because an assertion that pretends to quote the engine when it is not is
 * worse than no assertion.
 *
 *     deno test -A src/config/placement.test.ts
 */
import { assertEquals } from "jsr:@std/assert";
import { hasPlacementLabel, placementConfigPayload, placementConfigProblem } from "./placement.ts";
import type { PlacementConfigConfig } from "../constants.ts";

/** A valid entry, so each test can break exactly one thing. */
const GOOD: PlacementConfigConfig = {
    id: "furnace-tiers",
    structureId: "md-my-hown-mod:furnace",
    fields: [{ type: "integer", id: "tier", label: "Tier", min: 1, max: 3 }],
};

// ── the engine's first two checks ────────────────────────────────────────────

Deno.test("a structureId and a non-empty fields list are both required", () => {
    // if (!t.structureId || !t.fields.length) throw
    assertEquals(placementConfigProblem(GOOD), null);
    assertEquals(
        placementConfigProblem({ ...GOOD, structureId: "" }),
        "Placement config requires a structureId and fields.",
    );
    // The engine tests `!fields.length`, so `[]` and a non-array fail alike. A
    // `fields: {}` is the shape a hand-written entry most easily ends up as,
    // and it must not slip past as "present but empty".
    assertEquals(
        placementConfigProblem({ ...GOOD, fields: [] }),
        "Placement config requires a structureId and fields.",
    );
    assertEquals(
        placementConfigProblem({ ...GOOD, fields: undefined as never }),
        "Placement config requires a structureId and fields.",
    );
    assertEquals(placementConfigProblem(null), "no placement config");
});

// ── the per-field check ──────────────────────────────────────────────────────

Deno.test("a field needs an id, a label, and an id of its own", () => {
    // if (!r.id || !a(r) || n.has(r.id)) throw
    assertEquals(
        placementConfigProblem({
            ...GOOD,
            fields: [{ type: "integer", label: "Tier" } as never],
        }),
        'Invalid or duplicate placement field "undefined".',
    );
    assertEquals(
        placementConfigProblem({
            ...GOOD,
            fields: [{ type: "integer", id: "tier" } as never],
        }),
        'Invalid or duplicate placement field "tier".',
    );
    // The duplicate is the third arm of one condition, so it is asserted here
    // rather than in a test of its own: same `n.has(r.id)`, same message.
    assertEquals(
        placementConfigProblem({
            ...GOOD,
            fields: [GOOD.fields[0]!, GOOD.fields[0]!],
        }),
        'Invalid or duplicate placement field "tier".',
    );
});

Deno.test("a labelKey is a label, and a blank label is not", () => {
    // `a = e => typeof e.label === "string" && e.label.trim().length > 0 || …`
    // The `.trim()` is the point: the engine trims *before* testing, so `"   "`
    // is no label at all and must not be accepted here either.
    assertEquals(hasPlacementLabel({ label: "Tier" }), true);
    assertEquals(hasPlacementLabel({ labelKey: "mods|tier" }), true);
    assertEquals(hasPlacementLabel({ label: "Tier", labelKey: "x" }), true);
    assertEquals(hasPlacementLabel({ label: "   " }), false);
    assertEquals(hasPlacementLabel({ labelKey: "  " }), false);
    assertEquals(hasPlacementLabel({}), false);
    assertEquals(hasPlacementLabel(null), false);
    assertEquals(hasPlacementLabel("Tier"), false);
    // A `labelKey` alone is enough — the shipped `.d.ts` declares only
    // `labelKey`, and requiring `label` would reject a config the engine takes.
    assertEquals(
        placementConfigProblem({
            ...GOOD,
            fields: [{ type: "integer", id: "tier", labelKey: "mods|tier" }],
        }),
        null,
    );
});

// ── the choice check ────────────────────────────────────────────────────────

Deno.test("a choice needs options, and each option needs a label", () => {
    // if ("choice" === r.type && 0 === r.options.length) throw
    assertEquals(
        placementConfigProblem({
            ...GOOD,
            fields: [{ type: "choice", id: "mode", label: "Mode" }],
        }),
        'Placement choice "mode" requires at least one option.',
    );
    // if (!a(r.options[e])) throw
    assertEquals(
        placementConfigProblem({
            ...GOOD,
            fields: [
                { type: "choice", id: "mode", label: "Mode", options: [{ value: "a" }] },
            ],
        }),
        'Placement choice "mode" has an option without a label.',
    );
    assertEquals(
        placementConfigProblem({
            ...GOOD,
            fields: [
                {
                    type: "choice",
                    id: "mode",
                    label: "Mode",
                    options: [{ value: "a", label: "A" }, { value: "b", labelKey: "k" }],
                },
            ],
        }),
        null,
    );
    // An integer carries no options at all, and must not be asked for them.
    assertEquals(placementConfigProblem(GOOD), null);
});

// ── the one rule that is ours ───────────────────────────────────────────────

Deno.test("a type outside integer/choice is refused before the engine can crash on it", () => {
    // NOT an engine line. The engine reads `"integer" === r.type ? s(...) : l(...)`,
    // so anything else takes the *choice* path — and `l` walks `e.options.length`
    // unguarded, dying on a TypeError rather than on the engine's own readable
    // error. Catching it here is the difference between a message and a stack.
    assertEquals(
        placementConfigProblem({
            ...GOOD,
            fields: [{ type: "slider", id: "tier", label: "Tier" } as never],
        }),
        'Placement field "tier" has type "slider" — expected integer or choice.',
    );
    assertEquals(
        placementConfigProblem({
            ...GOOD,
            fields: [{ id: "tier", label: "Tier" } as never],
        }),
        'Placement field "tier" has type "undefined" — expected integer or choice.',
    );
});

// ── the payload ──────────────────────────────────────────────────────────────

Deno.test("only structureId and fields reach the engine", () => {
    // The engine does `r.set(t.structureId, t)` and hands the whole object back
    // to the player, so a stray mod-local `id` would ride along in the game's
    // own options store. The id exists for the list row and the dedupe set only.
    const payload = placementConfigPayload(GOOD);
    assertEquals(Object.keys(payload).sort(), ["fields", "structureId"]);
    assertEquals(payload.structureId, "md-my-hown-mod:furnace");
    assertEquals(payload.fields, GOOD.fields);
});
