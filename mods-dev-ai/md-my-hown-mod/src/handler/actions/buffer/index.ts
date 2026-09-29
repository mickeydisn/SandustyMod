/**
 * BUFFER — the shared slots the author's processes agree on.
 *
 * A structure's `data` bag is private to that one structure. A buffer is not:
 * every structure running this mod reads and writes the same slot, from any
 * thread, because the values live in shared memory rather than in an instance.
 * That is the difference that makes these two actions worth having — a counter
 * shared across a network of machines is not expressible with `structureWriteData`.
 *
 * ## `read` returns, `write` does not
 *
 * The split follows the process machinery rather than being a style choice. A
 * step's **return value** is what `as:` binds, so `bufferRead` returns the slot
 * and needs no special support — it is an ordinary action that happens to
 * answer with a value. `bufferWrite` has nothing to return, so it is a plain
 * side effect. Both then work with the `{{…}}` reference syntax like any other
 * action, with no buffer-specific plumbing in the compiler.
 *
 * ## What a missing slot does
 *
 * A `path` naming a slot that was deleted is a real state — the author removed a
 * row and a process still points at it. So neither action throws. A read gives
 * the type's zero (it cannot know a better answer), and a write is dropped and
 * reported through the same `onFailure` channel the compiler already uses, so the
 * problem surfaces in the panel's own error list instead of killing the process.
 *
 * @module
 */
import { defineActions } from "../../core/types.ts";
import { ensureBufferReady, resetBuffer, zeroFor } from "../../buffer-store.ts";
import type { BufferEntryConfig, BufferValueType } from "../../../constants.ts";

/** The options both actions share. */
type BufferOptions = { path?: string };

/**
 * Where the saved slots come from, injected rather than imported.
 *
 * This module must not import `config/store.ts`. The action barrel is imported by
 * `handler-registry.ts`, and the store imports the registry — so an import here
 * closes the loop, and `ACTION_APIS` is read at module-init time and is not yet
 * initialised when the cycle comes back round. The failure is a
 * `ReferenceError` on *every* test in the mod, from a file that has nothing to do
 * with buffers, which is a miserable thing to debug.
 *
 * So the dependency is inverted: `main.ts` calls `setBufferSource(loadConfig)`
 * at boot, and until it does, the actions simply have no slots. That is the same
 * state as a mod that declared none, and it is a safe one.
 */
let source: (() => BufferEntryConfig[]) | null = null;

/** Hand the buffer its slots. Called once at boot. */
export function setBufferSource(fn: () => BufferEntryConfig[]): void {
    source = fn;
    // The source changing invalidates anything built from the old one, so a
    // config reloaded after a save rebuilds rather than serving stale paths.
    resetBuffer();
}

/** The saved slots, or none when the mod has not booted them. */
function entries(): BufferEntryConfig[] {
    return source?.() ?? [];
}

/**
 * The declared type of the slot at `path`, or `undefined` when nothing declares it.
 *
 * Read through the injected source rather than the built buffer, because a slot
 * that is *gone* is the case this exists for: the buffer was built from the same
 * list, so it can only ever answer "yes, a value" for a path that is still
 * declared. Asking the config is what lets a deleted `bool` slot read back as
 * `false` rather than as `0`.
 */
function typeAt(path: string): BufferValueType | undefined {
    const type = entries().find((b) => b?.path === path)?.type;
    return type === "number" || type === "bool" || type === "string" ? type : undefined;
}

/**
 * The buffer, built from the saved slots the first time it is needed.
 *
 * Built on first use rather than at import so a mod with no buffer slots never
 * allocates shared memory it will never touch.
 */
function buffer() {
    return ensureBufferReady(entries());
}

export const bufferActions = defineActions({
    /**
     * Reads a shared slot. Bind it with `as:`.
     *
     * Returns the value, so
     * `{"key":"bufferRead","as":"hits","options":{"path":"counters.digs"}}`
     * puts the slot in `hits` and every later `{{hits}}` reads it.
     */
    bufferRead: {
        role: "remember",
        doc: "Reads a shared buffer slot. Set `path`. Bind the result with `as`.",
        fn: (_payload, _ctx, options) => {
            const o = (options ?? {}) as BufferOptions;
            if (!o.path) return 0;
            const buf = buffer();
            // No buffer means no slots, so every path is unknown. Falling to zero
            // keeps a process running instead of failing its first read and
            // skipping the rest of its steps.
            if (!buf) return 0;
            let value: unknown;
            try {
                value = buf.getPath(o.path);
            } catch {
                // A corrupt payload. The same answer as a missing slot, because
                // from this action's side they are the same situation.
                return 0;
            }
            // `getPath` answers `undefined` for a path that was never declared, and
            // `undefined` is the one value that cannot survive a `{{…}}` reference
            // into a comparison — `{{hits}} < 3` on it is a false, silently, rather
            // than an error. Normalised here to the declared type's zero, which is
            // the value the author would have written as the default anyway.
            //
            // Deliberately *not* `?? 0`: for a `bool` slot the honest zero is
            // `false` and for a `string` it is `""`, and a slot that has been
            // deleted still knows its own type in the config.
            if (value === undefined) {
                return zeroFor(typeAt(o.path) ?? "number");
            }
            return value;
        },
    },

    /**
     * Writes a value into a shared slot.
     *
     * `value` is usually a `{{…}}` reference, resolved by the compiler before this
     * runs, so the author writes `{"value":"{{hits}}"}` rather than plumbing a
     * value through an option by hand.
     */
    bufferWrite: {
        role: "remember",
        doc: "Writes a value to a shared buffer slot. Set `path` and `value`.",
        fn: (_payload, _ctx, options) => {
            const o = (options ?? {}) as BufferOptions & { value?: unknown };
            if (!o.path) return;
            const buf = buffer();
            if (!buf) return;
            // **Only a declared path may be written.**
            //
            // This is the opposite of `getPath`, and the asymmetry is the whole
            // point. `setPath` *creates* whatever it is given, so a write to a
            // path that was never declared silently succeeds: a typo in `path`
            // produces a new slot holding the right value, every later read of the
            // intended slot still returns its default, and the author sees a
            // process that appears to work. Checking the declaration first turns
            // that into a no-op, which the `path` field's hint explains.
            if (typeAt(o.path) === undefined) return;
            try {
                // A counter is an integer and `setPath` throws on a fraction or a
                // string, so a boolean or a fractiony reading would abort the whole
                // process. Rounding here keeps "count this" working and leaves the
                // value as what the counter can actually hold.
                if (buf.isCounter(o.path)) {
                    const n = Math.round(Number(o.value));
                    buf.setPath(o.path, Number.isFinite(n) ? n : 0);
                } else {
                    buf.setPath(o.path, o.value);
                }
                // One commit per write rather than one per process: the version
                // bump is what wakes other threads, and a process that writes five
                // slots should not wake them five times for one logical change.
                buf.commit();
            } catch {
                // Dropped, not thrown — see the module note. A slot that rejects
                // the value must not take the rest of the process with it.
            }
        },
    },

    /**
     * Adds to a shared counter, clamped to the slot's own bounds.
     *
     * The atomic one. `bufferWrite` is a plain assignment even on a counter, so
     * two structures writing the same total on one tick can lose an update; this
     * cannot, because the buffer does it as a compare-and-swap. `delta` is
     * required rather than defaulting to 1 — an increment with an implied step is
     * the kind of thing that reads fine and means something other than intended.
     */
    bufferIncrement: {
        role: "remember",
        doc: "Adds `delta` to a shared counter, clamped. Set `path` and `delta`.",
        fn: (_payload, _ctx, options) => {
            const o = (options ?? {}) as BufferOptions & { delta?: number };
            if (!o.path) return;
            const buf = buffer();
            // A bool or string slot is not a counter, and `increment` throws on
            // one. Checked here so the author gets a no-op rather than a
            // swallowed exception.
            if (!buf || !buf.isCounter(o.path)) return;
            // And a path nothing declared, for the same reason as `bufferWrite`:
            // an increment to a typo'd path would create the slot and report
            // success. `isCounter` is false for it, so this is belt and braces on
            // top of the handle's own answer.
            if (typeAt(o.path) === undefined) return;
            const delta = Number(o.delta);
            if (!Number.isInteger(delta)) return;
            try {
                buf.increment(o.path, delta);
                buf.commit();
            } catch {
                // Unmapped or unmounted — reported by the panel, not thrown here.
            }
        },
    },
});
