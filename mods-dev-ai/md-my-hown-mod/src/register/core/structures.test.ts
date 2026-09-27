// @ts-nocheck
/**
 * Structure unlocking.
 *   deno test -A src/register/structures.test.ts
 *
 * Registered is not the same as reachable. The build menu iterates
 * `player.buildings` and reads each definition from the vanilla registry *or* the
 * mod registry, so the only thing between a registered structure and a usable
 * one is membership of that list — and that push is separate work, with its own
 * rules (see `unlockStructures`).
 *
 * The stale/snapshot behaviour these tests used to sit next to is gone: nothing
 * applies the config after boot any more, so there is nothing to report as
 * stale.
 */
import { assert, assertEquals } from "jsr:@std/assert";

globalThis.sandkit = {
    api: {
        storage: { ensure: () => {}, get: () => undefined, set: () => {}, remove: () => {} },
        ui: { toast: () => {} },
        elements: { list: () => [], getRegisteredTypes: () => [1, 2] },
        structures: { list: () => [] },
        items: { list: () => [] },
        sprites: { list: () => [] },
    },
};

const { unlockStructures } = await import("./structures.ts");
const { entryToForm, formToEntry, passthroughKeys } = await import("../../ui/schema.ts");

const unlocked: string[] = [];
const removed: string[] = [];
(globalThis as Record<string, any>).sandkit.api = {
    ...(globalThis as Record<string, any>).sandkit.api,
    player: {
        buildings: {
            unlockByType: (id: string) => void unlocked.push(id),
            removeById: (id: string) => void removed.push(id),
        },
    },
};

Deno.test("every structure is unlocked, whatever the flags say", () => {
    // The build menu iterates `player.buildings` and reads definitions from the
    // vanilla registry *or* the mod registry (bundel.js 7493921) — so membership
    // of that list is the only thing that puts a structure in front of a player.
    //
    // `alwaysUnlocked` cannot do it: the engine reads that flag in exactly one
    // place, iterating a `const` literal of the *vanilla* structures with zero
    // assignment sites, so a mod id never reaches it. Which is why the panel no
    // longer offers the flag, and why this is now unconditional.
    unlocked.length = 0;
    const n = unlockStructures({
        structures: [
            { id: "a" },
            { id: "b", alwaysUnlocked: true },
            { id: "c", alwaysUnlocked: false },
        ],
    });
    assertEquals(unlocked, ["a", "b", "c"], "a structure was left out of the build menu");
    assertEquals(n, 3);
});

Deno.test("a hidden structure is still unlocked", () => {
    // Unlocking and hiding are independent. Unlocked-but-hidden is how a mod
    // offers a buildable type that only its own UI can select via
    // `building.selectStructure` (md-big-brother does exactly this), so
    // consulting `hideFromBuildMenu` here would break that pattern.
    unlocked.length = 0;
    unlockStructures({ structures: [{ id: "x", hideFromBuildMenu: true }] });
    assertEquals(unlocked, ["x"], "hideFromBuildMenu wrongly suppressed the unlock");
});

Deno.test("unlocking twice is safe", () => {
    // Apply can run many times in a session. The engine's `add` is
    // `includes(t) || push(t)`, so re-asking is a no-op rather than a duplicate.
    unlocked.length = 0;
    const cfg = { structures: [{ id: "a" }] };
    unlockStructures(cfg);
    unlockStructures(cfg);
    assertEquals(unlocked.length, 2);
});

Deno.test("a missing player API is not a crash", () => {
    // `player` is a main-thread API and may be absent in a worker. Losing one
    // unlock is bad; throwing mid-apply would lose every category after it.
    const save = (globalThis as Record<string, any>).sandkit.api;
    (globalThis as Record<string, any>).sandkit.api = { ...save, player: undefined };
    try {
        assertEquals(unlockStructures({ structures: [{ id: "a" }] }), 0);
    } finally {
        (globalThis as Record<string, any>).sandkit.api = save;
    }
});

Deno.test("an existing alwaysUnlocked survives a save even though the panel dropped it", () => {
    // The panel no longer has a control for `alwaysUnlocked` — the engine ignores
    // it on mod structures, so offering a checkbox for it was a trap. But someone
    // may already have it in their config, and losing the key on the next edit
    // would be silent data loss. It must fall into the passthrough and survive.
    const original = {
        id: "me:x",
        name: "X",
        alwaysUnlocked: false,
        hideFromBuildMenu: false,
    };
    const form = entryToForm("structures", original);
    assertEquals(
        form.alwaysUnlocked,
        undefined,
        "the removed field is still being read into the form",
    );
    const back = formToEntry("structures", form) as Record<string, unknown>;
    assertEquals(
        back.alwaysUnlocked,
        false,
        "an existing alwaysUnlocked was lost on save",
    );
    assert(
        passthroughKeys("structures", original).includes("alwaysUnlocked"),
        "alwaysUnlocked is not listed as carried through",
    );
});

Deno.test("a structure with no alwaysUnlocked does not grow one", () => {
    // The other half: the passthrough must not *invent* the key. A structure that
    // never had it should not acquire `alwaysUnlocked: false` on every save.
    const back = formToEntry(
        "structures",
        entryToForm("structures", { id: "me:x", name: "X" }),
    ) as Record<
        string,
        unknown
    >;
    assertEquals(back.alwaysUnlocked, undefined, "a phantom alwaysUnlocked was written");
});

Deno.test("a node-gated structure is not force-unlocked, and the unlock is withdrawn", () => {
    // The whole point of the node. Force-unlocking a gated structure would put it
    // in the menu from the first second and the gate would mean nothing.
    //
    // The removal is the half that is easy to miss: an earlier apply already put
    // the id in `player.buildings`, so without withdrawing it the gate would not
    // take effect until the game was reloaded and the change would look ignored.
    unlocked.length = 0;
    removed.length = 0;
    unlockStructures({
        structures: [{ id: "a" }, { id: "b", unlockNode: "u1" }],
        unlockNodes: [{ id: "u1", kind: "tech" }],
    });
    assertEquals(unlocked, ["a"], "a gated structure was force-unlocked");
    assertEquals(removed, ["b"], "the earlier unlock was not withdrawn");
});

Deno.test("a dangling unlockNode does not lock the structure away", () => {
    // The failure a strict "must name a node" reading would cause: the node was
    // deleted, so the structure would be in neither set — gone from a fresh game
    // with nothing to say why.
    unlocked.length = 0;
    removed.length = 0;
    unlockStructures({ structures: [{ id: "a", unlockNode: "gone" }], unlockNodes: [] });
    assertEquals(unlocked, ["a"], "a dangling node locked the structure away");
    assertEquals(removed, [], "an unlock was withdrawn that should not have been");
});

Deno.test("an 'always' node leaves the structure available from the start", () => {
    unlocked.length = 0;
    removed.length = 0;
    unlockStructures({
        structures: [{ id: "a", unlockNode: "u1" }],
        unlockNodes: [{ id: "u1", kind: "always" }],
    });
    assertEquals(unlocked, ["a"]);
    assertEquals(removed, []);
});
