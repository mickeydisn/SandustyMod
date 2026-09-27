// @ts-nocheck: the host stub is a partial `sandkit` and every register* call
// reaches through it, so the call sites cannot be typed without standing up the
// whole engine surface. Same trade as the other headless round-trip tests.
/**
 * The input-binding path in `registerTheRest`.
 */
import { assertEquals } from "jsr:@std/assert";

/** What the host was handed, per namespace. */
const seen: { bindings?: { id: string; keys: unknown; def: unknown }[] } = {};

/** A resolver stub: `listInputBindingHandlerKeys` decides which keys are known. */
globalThis.sandkit = {
    api: {
        storage: {
            ensure: () => {},
            get: () => undefined,
            set: () => {},
            remove: () => {},
        },
        ui: { toast: () => {} },
        sprites: { list: () => [] },
        structures: { list: () => [], recipes: {}, processing: {}, signals: {} },
        elements: { list: () => [] },
        items: { list: () => [] },
        input: {
            // The engine signature is `(id, defaultKeys, definition)` — see the
            // `constants.ts` note on binding ids. The definition is the third
            // argument, so a stub that records the first is looking at an id.
            registerBinding: (id: string, keys: unknown, def: unknown) => {
                (seen.bindings ??= []).push({ id, keys, def });
            },
        },
        actions: {
            // The key this test binds. It only has to be a name the handler
            // registry knows; the point is that it arrives at all.
            list: () => ["noop"],
        },
    },
    react: { createElement: () => null },
    enums: {},
};

const { registerTheRest } = await import("./the-rest.ts");

Deno.test("a bare-key input binding is registered with a live function", () => {
    seen.bindings = [];
    // `noop` is a real action in the registry; the stub host only needs to
    // exist for the register call itself.
    const counts = registerTheRest({
        inputBindings: [
            {
                id: "md-my-hown-mod:mdmy.binding.noop",
                onDownKey: "noop",
                onUpKey: "noop",
            },
        ],
    } as never);

    assertEquals(counts.inputBindings, 1, "the binding was not registered at all");
    const handlers = seen.bindings[0].def.handlers as Record<string, unknown>;
    // The whole failure mode was an empty pair: the key stayed as text because the
    // ref never resolved, so `typeof def.onDownKey === "function"` was false and
    // the slot was left out of `handlers` entirely.
    assertEquals(
        typeof handlers.down,
        "function",
        "the down slot was not compiled to a function",
    );
    assertEquals(
        typeof handlers.up,
        "function",
        "the up slot was not compiled to a function",
    );
});

Deno.test("an unknown binding key is reported, not registered as text", () => {
    seen.bindings = [];
    const counts = registerTheRest({
        inputBindings: [
            {
                id: "md-my-hown-mod:mdmy.binding.bogus",
                onDownKey: "noSuchHandlerAnywhere",
                onUpKey: "noSuchHandlerAnywhere",
            },
        ],
    } as never);
    // Counted, but the slots are left alone: handing the engine a handler pair
    // with neither side filled is inert, and it warned on the way past.
    assertEquals(counts.inputBindings, 1);
    const def = seen.bindings[0].def as Record<string, unknown>;
    assertEquals(def.handlers, {}, "an unknown key must not produce a handler");
});
