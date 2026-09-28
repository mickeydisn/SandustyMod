/**
 * The `actions` → `processId` migration.
 *
 * This is the only **destructive** step in the custom-process feature, so its tests
 * are mostly about what it must *not* touch. The three that matter most:
 *
 *  1. **Idempotence.** `loadConfig` runs on every boot; a second pass must change
 *     nothing, or the config would grow a new derived process each launch.
 *  2. **A named process is never touched.** Only an entry with no `processId` is
 *     eligible, and its stale `actions` is left in place rather than deleted.
 *  3. **Two entries never share a derived process.** If they did, deleting one
 *     definition would silently change the other's behaviour — the worst outcome the
 *     reference model has.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { migrateLegacyActions } from "../../config/store.ts";
import { DEFAULT_CONFIG, type ModConfig } from "../../constants.ts";
import { derivedProcessId } from "../custom-process/registry.ts";

/**
 * A config with only the fields the migration reads.
 *
 * The override is `Record<string, unknown>` rather than `Partial<ModConfig>` on
 * purpose: several of the tests below feed the migration a config that is *not*
 * well-formed — a `signals` that is a string, an entry with no `kind` — because
 * surviving those is one of the things being tested. A typed override would force
 * every one of them to be cast individually, which is the sort of friction that
 * quietly ends up as a cast in the *migration* instead of in the test.
 */
function cfg(over: Record<string, unknown> = {}): ModConfig {
    return { ...DEFAULT_CONFIG, ...over } as ModConfig;
}

// ── The conversion ────────────────────────────────────────────────────────────

Deno.test("an entry's action array becomes a process it references", () => {
    const { config, changed } = migrateLegacyActions(
        cfg({
            signals: [{
                id: "mdmy.lever",
                kind: "interactables",
                target: "lever",
                actions: [
                    { key: "structureInspect" },
                    { key: "processorLog", options: { n: 2 } },
                ],
            }],
        }),
    );
    assertEquals(changed, 1);
    const entry = config.signals[0] as Record<string, unknown>;
    assertEquals(entry.processId, "mdmy.lever#process");
    assertEquals("actions" in entry, false, "the legacy array is gone");
    // And the program survived intact, in order, with its options.
    assertEquals(config.processes, [{
        id: "mdmy.lever#process",
        scope: "signal",
        steps: [
            { key: "structureInspect" },
            { key: "processorLog", options: { n: 2 } },
        ],
        derived: true,
        derivedFrom: "mdmy.lever",
    }]);
});

Deno.test("the derived process's scope is the slot the definition sits in", () => {
    // The scope is what the compiler checks the reference against, so getting it wrong
    // would make every migrated definition immediately unusable.
    const scopeOf = (key: keyof ModConfig): string | undefined =>
        migrateLegacyActions(cfg({ [key]: [{ id: "a", actions: [{ key: "noop" }] }] }))
            .config.processes[0]?.scope;

    assertEquals(scopeOf("signals"), "signal");
    assertEquals(scopeOf("triggers"), "trigger");
    assertEquals(scopeOf("processing"), "processing");
    assertEquals(scopeOf("upgrades"), "upgrade");
    assertEquals(scopeOf("modifiers"), "modifier");
    assertEquals(scopeOf("items"), "itemAction");
});

Deno.test("the derived id is the one the registry generates", () => {
    // Two places compute this id, so they must agree or a reference points at nothing.
    const { config } = migrateLegacyActions(
        cfg({ signals: [{ id: "x", actions: [{ key: "noop" }] }] }),
    );
    assertEquals(config.processes[0].id, derivedProcessId("x"));
});

// ── Idempotence ───────────────────────────────────────────────────────────────

Deno.test("running the migration twice changes nothing the second time", () => {
    // `loadConfig` runs on every boot. A second pass that created another derived
    // process would grow the config on every launch, forever.
    const first = migrateLegacyActions(
        cfg({ signals: [{ id: "a", actions: [{ key: "noop" }] }] }),
    );
    const second = migrateLegacyActions(first.config);
    const third = migrateLegacyActions(second.config);

    assertEquals(first.changed, 1);
    assertEquals(second.changed, 0, "the second pass is a no-op");
    assertEquals(third.changed, 0);
    assertEquals(second.config.processes.length, 1, "and did not add a process");
    assertEquals(second.config, third.config, "and is stable from then on");
});

// ── What it must not touch ────────────────────────────────────────────────────

Deno.test("an entry that already references a process is left completely alone", () => {
    // Its `actions` is stale data from an earlier save. Deleting it would be
    // destructive; overwriting the reference worse. Both are refused.
    const { config, changed } = migrateLegacyActions(
        cfg({
            signals: [{ id: "a", processId: "sorter", actions: [{ key: "structureInspect" }] }],
        }),
    );
    assertEquals(changed, 0);
    assertEquals(config.processes, [], "no process was invented");
    assertEquals(config.signals[0] as Record<string, unknown>, {
        id: "a",
        processId: "sorter",
        actions: [{ key: "structureInspect" }],
    });
});

Deno.test("the author's own named processes are never rewritten", () => {
    const mine = { id: "sorter", scope: "signal" as const, steps: [{ key: "noop" }] };
    const { config } = migrateLegacyActions(
        cfg({ processes: [mine], signals: [{ id: "a", actions: [{ key: "noop" }] }] }),
    );
    // Both survive; the new one is appended, not substituted.
    assertEquals(config.processes.length, 2);
    assertEquals(config.processes[0], mine);
    assertEquals(config.processes[1].derived, true);
});

Deno.test("two entries never share a derived process", () => {
    // If they did, deleting one definition would silently change the other's
    // behaviour — the worst outcome the reference model has.
    const { config } = migrateLegacyActions(
        cfg({
            signals: [
                { id: "a", actions: [{ key: "structureInspect" }] },
                { id: "b", actions: [{ key: "processorLog" }] },
            ],
        }),
    );
    assertEquals(config.processes.length, 2);
    assertEquals(new Set(config.processes.map((p) => p.id)).size, 2, "two distinct ids");
    assertEquals((config.signals[0] as Record<string, unknown>).processId, "a#process");
    assertEquals((config.signals[1] as Record<string, unknown>).processId, "b#process");
});

Deno.test("an id collision does not overwrite an existing process", () => {
    const taken = { id: "a#process", scope: "signal" as const, steps: [{ key: "noop" }] };
    const { config, changed } = migrateLegacyActions(
        cfg({
            processes: [taken],
            signals: [{ id: "a", actions: [{ key: "structureInspect" }] }],
        }),
    );
    assertEquals(changed, 0, "refused rather than clobbered");
    assertEquals(config.processes[0], taken);
    // And the entry keeps its array, so nothing is lost by the refusal.
    assert(Array.isArray((config.signals[0] as Record<string, unknown>).actions));
});

// ── What it ignores ───────────────────────────────────────────────────────────

Deno.test("an empty array is 'no program', not 'a program that is empty'", () => {
    // A definition with no actions is a legitimate state, and inventing a process for
    // it would give the panel a row that does nothing.
    const { config, changed } = migrateLegacyActions(cfg({ signals: [{ id: "a", actions: [] }] }));
    assertEquals(changed, 0);
    assertEquals(config.processes, []);
    assertEquals((config.signals[0] as Record<string, unknown>).processId, undefined);
});

Deno.test("an array of unusable rows produces no process", () => {
    // Every row needs a string `key` to be a step. An array of nothing usable is the
    // same situation as an empty one.
    const { changed } = migrateLegacyActions(
        cfg({ signals: [{ id: "a", actions: [null, 5, {}, { key: 7 }] as never[] }] }),
    );
    assertEquals(changed, 0);
});

Deno.test("an entry with no id is skipped, not given a nameless process", () => {
    // A derived id is built from the entry id, so no id means no process. The entry
    // keeps its array rather than losing it to a process nothing can reference.
    const { config, changed } = migrateLegacyActions(
        cfg({ signals: [{ actions: [{ key: "noop" }] }] }),
    );
    assertEquals(changed, 0);
    assert(Array.isArray((config.signals[0] as Record<string, unknown>).actions));
});

Deno.test("a config that is not shaped like a config is survived, not thrown on", () => {
    // A hand-edited or half-written store can hold anything, and the loader runs
    // before anything can report a problem.
    for (
        const broken of [
            cfg({ signals: null as never }),
            cfg({ signals: "nope" as never }),
            cfg({ signals: [null as never, 5 as never] }),
            cfg({ processing: [{}] }),
        ]
    ) {
        let threw = false;
        try {
            migrateLegacyActions(broken);
        } catch {
            threw = true;
        }
        assert(!threw, "the migration must not throw on a bad config");
    }
});

Deno.test("the migration does not mutate the config it was given", () => {
    // `loadConfig` hands the result straight to every reader, and the object it was
    // given is the one that came out of storage. Editing it in place would make a
    // second call see an already-migrated config even if the first had failed.
    const signals = [{ id: "a", actions: [{ key: "noop" }] }];
    migrateLegacyActions(cfg({ signals }));
    assertEquals((signals[0] as Record<string, unknown>).processId, undefined);
    assert(Array.isArray((signals[0] as Record<string, unknown>).actions));
});
