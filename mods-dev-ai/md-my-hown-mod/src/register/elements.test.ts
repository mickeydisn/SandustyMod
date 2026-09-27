// @ts-nocheck
/**
 * Elements are registered *synchronously, during mod load* — the one content
 * kind that has to be.
 *   deno test -A src/register/elements.test.ts
 *
 * The engine hands mod element definitions to the simulation worker exactly
 * once, at boot, straight after it runs the mod script
 * (`postAll([dD.RegisterModElements, …])`, bundel.js:173617).
 * `elements.register` posts nothing — it only fills the main thread's copy
 * (`bundel.js/46781.js:1272-1296`) — so an element registered after that sync
 * is visible in the picker and the renderer and inert in the simulation: the
 * worker has no definition, so `ce[undefined]` is no matter type, so there is
 * no update function (`utils-worker.js/75089.js:393-397`).
 *
 * It cannot be fixed afterwards either: the worker-side `updateDefinition` is
 * `const l = m5[type]; l && Object.assign(l, patch)` (`utils-worker.js/75071.js:22`),
 * a guarded merge that ignores a type it has never been given.
 *
 * What is asserted here is the part the mod controls — that the early pass runs,
 * that it does not double-register when `applyConfig` follows it, and that a
 * late addition says out loud that it will not move.
 */
import { assertEquals } from "jsr:@std/assert";

/** Definitions the engine was handed, in call order. */
const seen: Record<string, unknown>[] = [];
/** Types handed to the discovery catalogue. */
const discovered: number[] = [];
/** What the worker would have been told about, by the boot sync. */
const workerKnows: number[] = [];

/**
 * The engine's real `sandkit.enums.MatterType`: a TypeScript *numeric* enum, so
 * it is reverse-mapped and carries both `8 → "Powder"` and `"Powder" → 8`.
 * Reproduced exactly, because the whole bug lives in that shape.
 */
const MatterType: Record<string, string | number> = {};
(function build(e: Record<string, string | number>) {
    e[e.Solid = 1] = "Solid";
    e[e.Liquid = 2] = "Liquid";
    e[e.Particle = 3] = "Particle";
    e[e.Gas = 4] = "Gas";
    e[e.Static = 5] = "Static";
    e[e.Slushy = 6] = "Slushy";
    e[e.Wisp = 7] = "Wisp";
    e[e.Powder = 8] = "Powder";
})(MatterType);

/** The worker's matter table, keyed by the numbers 1..8 — nothing else. */
const WORKER_MATTER: Record<number, string> = {
    1: "solid", 2: "liquid", 3: "particle", 4: "gas",
    5: "static", 6: "slushy", 7: "wisp", 8: "powder",
};

/** What the worker would assign for a definition's `matterType`. */
function workerBehaviour(matterType: unknown): string {
    const entry = WORKER_MATTER[matterType as number];
    return entry ?? "INERT (no update function — the cells never move)";
}

let stored: Record<string, unknown> | undefined = { elements: [] };

/**
 * `storage.get` is called as `get(MOD_ID, key)` — the facade adds the mod id, so
 * a stub that takes only the key silently returns the fallback and the test
 * would be asserting against an empty config.
 */
globalThis.sandkit = {
    api: {
        storage: {
            ensure: () => {},
            get: (_modId: string, key: string) => (key === "config" ? stored : undefined),
            set: () => {},
            remove: () => {},
        },
        enums: { MatterType },
        elements: {
            register: (def: Record<string, unknown>) => {
                seen.push(def);
                const type = 100 + seen.length;
                // The engine's boot sync copies main → worker. Everything
                // registered before it runs is what the worker ends up knowing.
                workerKnows.push(type);
                return { elementType: type };
            },
        },
        discoveries: { addElement: (t: number) => void discovered.push(t) },
        i18n: { register: () => {} },
    },
};

const {
    registerElements,
    closeBootWindow,
    __resetBootWindowForTests,
} = await import("./elements.ts");
const { registered, isBootWindowOpen, mayRegister } = await import("./registry.ts");

/** An element entry shaped like the ones the panel stores. */
const el = (id: string) => ({
    id: `mod:${id}`,
    name: id,
    matterType: "powder",
    density: 100,
    metaColor: 0x3366ff,
});

/** Each test starts from a clean slate: no guard, no window, no records. */
function fresh(): void {
    seen.length = 0;
    discovered.length = 0;
    workerKnows.length = 0;
    registered.elements.clear();
    __resetBootWindowForTests();
    stored = { elements: [] } as never;
}

Deno.test("every spelling of a matter type reaches the worker as a number", () => {
    // This is the whole bug. `sandkit.enums.MatterType` is reverse-mapped, so
    // `enums["8"]` is the *string* "Powder", not 8. A `matterType` stored as the
    // text "8" — which the form produced for any entry stored as a number, and
    // which a hand-edited config can hold — used to be resolved to that string.
    // The worker's matter table is keyed `1..8`, so it matched nothing, no update
    // function was assigned, and the element stood completely still while looking
    // entirely normal: right colour, in the picker, just inert.
    for (const [stored, expected] of [
        ["powder", 8],
        ["Powder", 8],
        ["POWDER", 8],
        ["8", 8],
        [8, 8],
        ["liquid", 2],
        ["2", 2],
        [2, 2],
        ["Solid", 1],
        [5, 5],
    ] as const) {
        fresh();
        registerElements({
            elements: [{ ...el("m"), matterType: stored }],
        } as never);
        const sent = seen[0]?.matterType;
        assertEquals(
            typeof sent,
            "number",
            `matterType ${JSON.stringify(stored)} was sent as ${JSON.stringify(sent)}`,
        );
        assertEquals(sent, expected, `matterType ${JSON.stringify(stored)}`);
        assertEquals(
            workerBehaviour(sent),
            WORKER_MATTER[expected],
            `${JSON.stringify(stored)} gives the worker no update function`,
        );
    }
});

Deno.test("an unknown matter type still lands on a real one", () => {
    fresh();
    registerElements({ elements: [{ ...el("m"), matterType: "unobtainium" }] } as never);
    // The documented fallback is powder, and it must be the *number*.
    assertEquals(seen[0].matterType, 8);
    assertEquals(workerBehaviour(seen[0].matterType), "powder");
});

Deno.test("elements register with a numeric matter type and a colour", () => {
    fresh();
    assertEquals(registerElements({ elements: [el("a")] } as never), 1);
    assertEquals(seen.length, 1);
    // Powder is 8. A string here would leave the worker's `ce[…]` lookup
    // undefined and the element would never move.
    assertEquals(seen[0].matterType, 8);
    assertEquals(seen[0].colors, { variants: [[51, 102, 255, 255]] });
    assertEquals(discovered, [101], "a registered element was not discovered");
});

Deno.test("the load-time pass and a later Apply do not double-register", () => {
    fresh();
    const cfg = { elements: [el("a"), el("b")] } as never;
    assertEquals(registerElements(cfg), 2, "the early pass registered nothing");
    // `applyConfig` runs afterwards and walks the same config again.
    assertEquals(registerElements(cfg), 0, "the same element was registered twice");
    assertEquals(seen.length, 2);
});

Deno.test("an element added after boot is never registered", () => {
    fresh();
    closeBootWindow();

    const n = registerElements({ elements: [el("late")] } as never);
    // Nothing is pushed at the running game. Registering now would mint a type
    // the worker never hears of, so the element would not simulate; and for an id
    // already live it would mint a *second* type and orphan the first, which is
    // the crash. Doing nothing is the only safe answer.
    assertEquals(n, 0);
    assertEquals(seen.length, 0, "an element was registered after the boot window");
    assertEquals(discovered, []);
});

Deno.test("an element already live is left alone, not re-registered", () => {
    fresh();
    const cfg = { elements: [el("a")] } as never;
    registerElements(cfg);
    const callsAfterBoot = seen.length;
    closeBootWindow();

    // This is the path that used to crash the game: a second `register` of a live
    // id mints a *new* type and orphans the first.
    registerElements(cfg);
    assertEquals(seen.length, callsAfterBoot, "a live element was registered a second time");
});

Deno.test("the boot window is what keeps a late registration out", () => {
    fresh();
    assertEquals(isBootWindowOpen(), true, "a fresh registry must allow registration");
    closeBootWindow();
    assertEquals(isBootWindowOpen(), false);
    assertEquals(mayRegister("elements", "mod:x"), false, "a late register must be refused");
    // A category the worker never sees is unaffected — it needs no worker copy.
    assertEquals(mayRegister("items", "mod:x"), true, "items must not be gated by the window");
});
