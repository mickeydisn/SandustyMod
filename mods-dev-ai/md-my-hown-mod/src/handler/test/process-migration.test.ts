
import { assert, assertEquals } from "https:
import { migrateLegacyActions } from "../../config/store.ts";
import { DEFAULT_CONFIG, type ModConfig } from "../../constants.ts";
import { derivedProcessId } from "../custom-process/registry.ts";


function cfg(over: Record<string, unknown> = {}): ModConfig {
    return { ...DEFAULT_CONFIG, ...over } as ModConfig;
}



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
    
    const { config } = migrateLegacyActions(
        cfg({ signals: [{ id: "x", actions: [{ key: "noop" }] }] }),
    );
    assertEquals(config.processes[0].id, derivedProcessId("x"));
});



Deno.test("running the migration twice changes nothing the second time", () => {
    
    
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



Deno.test("an entry that already references a process is left completely alone", () => {
    
    
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
    
    assertEquals(config.processes.length, 2);
    assertEquals(config.processes[0], mine);
    assertEquals(config.processes[1].derived, true);
});

Deno.test("two entries never share a derived process", () => {
    
    
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
    
    assert(Array.isArray((config.signals[0] as Record<string, unknown>).actions));
});



Deno.test("an empty array is 'no program', not 'a program that is empty'", () => {
    
    
    const { config, changed } = migrateLegacyActions(cfg({ signals: [{ id: "a", actions: [] }] }));
    assertEquals(changed, 0);
    assertEquals(config.processes, []);
    assertEquals((config.signals[0] as Record<string, unknown>).processId, undefined);
});

Deno.test("an array of unusable rows produces no process", () => {
    
    
    const { changed } = migrateLegacyActions(
        cfg({ signals: [{ id: "a", actions: [null, 5, {}, { key: 7 }] as never[] }] }),
    );
    assertEquals(changed, 0);
});

Deno.test("an entry with no id is skipped, not given a nameless process", () => {
    
    
    const { config, changed } = migrateLegacyActions(
        cfg({ signals: [{ actions: [{ key: "noop" }] }] }),
    );
    assertEquals(changed, 0);
    assert(Array.isArray((config.signals[0] as Record<string, unknown>).actions));
});

Deno.test("a config that is not shaped like a config is survived, not thrown on", () => {
    
    
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
    
    
    
    const signals = [{ id: "a", actions: [{ key: "noop" }] }];
    migrateLegacyActions(cfg({ signals }));
    assertEquals((signals[0] as Record<string, unknown>).processId, undefined);
    assert(Array.isArray((signals[0] as Record<string, unknown>).actions));
});
