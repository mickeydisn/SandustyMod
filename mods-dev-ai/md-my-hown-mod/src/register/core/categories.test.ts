// @ts-nocheck
/**
 * The three categories that became their own modules: structures, terrains and
 * items.
 *
 *   deno test -A src/register/categories.test.ts
 *
 * The claim under test is the one the boot ordering rests on. The engine copies
 * mod **elements, terrains and structures** into the simulation worker in a single
 * burst, at one point, immediately after it runs the mod script
 * (`bundel.js:173616-173619`):
 *
 *   postAll(RegisterModMatters,    sandkit.mods.matters)
 *   postAll(RegisterModElements,   sandkit.mods.elements)
 *   postAll(RegisterModTerrains,   sandkit.mods.terrains)
 *   postAll(RegisterModStructures, sandkit.mods.structures, snapshot)
 *
 * So "registered too late to reach the worker" is not an element-only problem. A
 * terrain or a structure registered after that burst is exactly as inert as an
 * element would be — and each of the three `register` calls only writes the main
 * thread's copy, so nothing else picks it up.
 *
 * **Items are the deliberate exception.** There is no `RegisterModItems` message
 * anywhere in the engine, so an item registered after boot is genuinely live.
 * That difference is invisible at a call site, which is why it is asserted here.
 */
import { assertEquals } from "jsr:@std/assert";

const terrainRegs: unknown[] = [];
const structureRegs: unknown[] = [];
const itemRegs: unknown[] = [];

globalThis.sandkit = {
    api: {
        storage: { ensure: () => {}, get: () => undefined, set: () => {}, remove: () => {} },
        ui: { toast: () => {} },
        elements: {
            list: () => [],
            getRegisteredTypes: () => [1, 2],
            register: () => ({ elementType: 101 }),
        },
        terrains: { list: () => [], register: (d: unknown) => void terrainRegs.push(d) },
        structures: {
            list: () => [],
            register: (d: unknown) => void structureRegs.push(d),
            recipes: { register: () => {} },
            processing: { register: () => {} },
        },
        items: { list: () => [], register: (d: unknown) => void itemRegs.push(d) },
        sprites: { list: () => [], register: () => {} },
        player: {
            buildings: { unlockByType: () => true, removeById: () => {} },
        },
    },
};

const registry = await import("../registry.ts");
const { registerAll } = await import("../index.ts");

function fresh(): void {
    for (const s of Object.values(registry.registered)) s.clear();
    registry.__resetBootWindowForTests();
    terrainRegs.length = 0;
    structureRegs.length = 0;
    itemRegs.length = 0;
}

const cfg = (o: Record<string, unknown>) =>
    ({ elements: [], structures: [], items: [], terrains: [], ...o }) as never;

Deno.test("registerAll reaches the worker with every category", () => {
    // The one path that matters. The engine syncs elements, terrains and
    // structures in a single burst after the mod script returns, so all three
    // have to be registered by the time this returns.
    fresh();
    const counts = registerAll(cfg({ terrains: [{ id: "t" }], structures: [{ id: "s" }] }));
    assertEquals(counts.terrains, 1);
    assertEquals(counts.structures, 1);
    assertEquals(terrainRegs.length, 1);
    assertEquals(structureRegs.length, 1);
    assertEquals(registry.registered.terrains.has("t"), true);
    assertEquals(registry.registered.structures.has("s"), true);
});

Deno.test("registerAll closes the boot window itself", () => {
    // So a caller cannot forget. A second call is then a no-op rather than the
    // fork-the-type crash.
    fresh();
    assertEquals(registry.isBootWindowOpen(), true, "registration starts with the window open");
    registerAll(cfg({ terrains: [{ id: "t" }] }));
    assertEquals(registry.isBootWindowOpen(), false, "registerAll must close the window");

    const again = registerAll(cfg({ terrains: [{ id: "t" }] }));
    assertEquals(again.terrains, 0, "a second boot registered the terrain again");
    assertEquals(terrainRegs.length, 1, "the engine was handed a duplicate");
});

Deno.test("a late registration is refused, not half-applied", () => {
    // The failure this prevents is silent: the definition lands in the picker,
    // keeps its name and colour, and simply never simulates. Nothing throws.
    fresh();
    registerAll(cfg({}));
    const n = registerAll(cfg({ terrains: [{ id: "late" }] }));
    assertEquals(n.terrains, 0, "a terrain registered after boot must be refused");
    assertEquals(terrainRegs.length, 0, "the engine must not be handed a late terrain");
});

Deno.test("an item is registered, and is never worker-synced", () => {
    // There is no `RegisterModItems` message in the engine, so an item needs no
    // worker copy and is not gated by the boot window. If this ever fails, the
    // item category became worker-scoped and the note in items.ts is a lie.
    fresh();
    const counts = registerAll(cfg({ items: [{ id: "i" }] }));
    assertEquals(counts.rest.items, 1);
    assertEquals(itemRegs.length, 1);
    assertEquals(registry.mayRegister("items", "i"), true, "items must not be gated");
});

Deno.test("a structure is registered without the mod's own unlock fields", () => {
    // `drawKey` and `unlockNode` are ours; the engine has no use for them, and a
    // string in `draw` would silently stop the structure rendering.
    fresh();
    registerAll(cfg({ structures: [{ id: "s", drawKey: "outline", unlockNode: "n" }] }));
    const sent = structureRegs[0] as Record<string, unknown>;
    assertEquals("drawKey" in sent, false, "drawKey leaked to the engine");
    assertEquals("unlockNode" in sent, false, "unlockNode leaked to the engine");
    assertEquals(typeof sent.draw, "function", "a drawKey must become a real function");
});
