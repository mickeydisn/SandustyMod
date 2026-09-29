/**
 * md-my-hown-mod — entry.
 *
 * When enabled: register all content definitions, then mount the configurator
 * panel as a plain injected component. The panel is always present and starts
 * minimized — no hotbar item, no selection, nothing to equip.
 */
import { onSettingsChange, readSettings, runDisableCleanup } from "./packages/modkit.ts";
import { registerAll } from "./register/index.ts";
import { LOG, MOD_ID, SETTINGS, STORAGE_KEYS, VERSION } from "./constants.ts";
import { mountPanel } from "./tool.ts";
import "./handler/index.ts"; // register handler keys for pickers

console.log(`${LOG} SCRIPT START v${VERSION}`);

// TEMP. REMOTE BRIDGE — drive the running game from CDP without restarting it.
//
// The host injects `sandkit` as a *parameter* of the wrapper it builds with
// `new Function("__sandkit", ...)`, so it is on neither `window` nor
// `globalThis` and a CDP `Runtime.evaluate` cannot reach it. The fix is to hand
// the outside world a closure that already has it.
//
// Deliberately NO `eval`: the mod body is compiled through `new Function` under
// a CSP that refuses string evaluation, and a direct `eval` there made the whole
// entry fail to load — silently, with no console output at all. Plain functions
// capture the scope lexically and cost nothing at runtime.
//
// Use: python3 doc/steam/cdp-eval.py <port> '__sk.status()'
import { ProcessRegistry } from "./handler/custom-process/registry.ts";
import { compileCustomProcess } from "./handler/custom-process/compile.ts";

declare const sandkit: any;

const api = sandkit?.api as Record<string, any> | undefined;
const structures = api?.structures as Record<string, any> | undefined;
const elements = api?.elements as Record<string, any> | undefined;
const store = sandkit?.state?.store as Record<string, any> | undefined;

const bridge = {
    /** Scene, tick and whether the tick is moving. */
    status() {
        return {
            scene: api?.scene?.getActive?.(),
            tick: api?.time?.getTick?.(),
            world: store?.meta?.worldName,
            playerCell: bridge.playerCell(),
        };
    },
    /** Player position, in cells. The raw x/y are PIXELS, so this divides. */
    playerCell() {
        const pl = store?.player;
        const size = api?.rendering?.getGridMetrics?.()?.cellSize ?? 24;
        if (typeof pl?.x !== "number") return null;
        return {
            px: pl.x,
            py: pl.y,
            cellSize: size,
            x: Math.floor(pl.x / size),
            y: Math.floor(pl.y / size),
        };
    },
    worldSize() {
        return store?.world?.size ?? null;
    },
    /**
     * Read any dotted path out of `sandkit.state.store` — the session/pause flags
     * are not on the `api` namespace, and this is the only way to see them from
     * outside. `dump("session.paused")`.
     */
    dump(path: string) {
        let node: unknown = sandkit?.state;
        for (const key of path.split(".")) {
            if (node == null) return { path, missing: true };
            node = (node as Record<string, unknown>)[key];
        }
        return { path, value: node ?? null };
    },
    /** Start a fresh world in the same session — the A/B control for a save. */
    newWorld() {
        try {
            api?.game?.start?.({});
            return { ok: true };
        } catch (e) {
            return { ok: false, threw: (e as Error).message };
        }
    },
    /** What is at a cell: terrain, element, and any structure. */
    at(x: number, y: number) {
        return {
            element: elements?.getTypeAtCell?.(x, y) ?? null,
            structure: structures?.getAtCell?.(x, y) ?? null,
        };
    },
    /** Walk down from a cell and return the rows that hold something. */
    column(x: number, from: number, count: number) {
        const hits: [number, unknown][] = [];
        for (let y = from; y < from + count; y++) {
            const t = elements?.getTypeAtCell?.(x, y);
            if (t != null) hits.push([y, t]);
        }
        return hits;
    },
    /** Try a placement and report what the engine actually committed. */
    place(id: string, x: number, y: number) {
        try {
            structures?.buildAtCell?.(x, y, id);
        } catch (e) {
            return { at: [x, y], threw: (e as Error).message };
        }
        const got = structures?.getAtCell?.(x, y) ?? null;
        return {
            at: [x, y],
            committed: got != null && got.queued !== true,
            record: got,
        };
    },
    /** Attach a compiled process to a structure type. */
    attachProcess(id: string, typeId: string, intervalMs = 100) {
        const proc = structures?.processing;
        if (!proc?.register) return { ok: false, why: "no processing.register" };
        try {
            proc.register(`${id}#process`, {
                structureType: typeId,
                intervalMs,
                process: (s: unknown, c: unknown) => {
                    bridge.counts.runs++;
                    if (bridge.counts.firstTick == null) {
                        bridge.counts.firstTick = api?.time?.getTick?.();
                    }
                    try {
                        (bridge.compiled as ((...a: unknown[]) => unknown) | null)?.(s, c);
                    } catch (e) {
                        bridge.counts.lastError = (e as Error).message;
                    }
                },
            });
            return { ok: true, intervalMs };
        } catch (e) {
            return { ok: false, threw: (e as Error).message };
        }
    },
    register(id: string, shape?: number[][]) {
        try {
            structures?.register?.({
                id,
                name: id,
                categoryKey: "special",
                shape: shape ?? [[1, 1, 1], [1, 1, 1], [1, 1, 1]],
                alwaysUnlocked: true,
            });
            return { ok: true, id };
        } catch (e) {
            return { ok: false, threw: (e as Error).message };
        }
    },
    /** Compile a process from action keys and stash it for `attachProcess`. */
    compile(steps: { key: string; options?: Record<string, unknown> }[], slot = "processing") {
        try {
            const registry = new ProcessRegistry([
                { id: "remote", scope: slot as never, steps },
            ]);
            const compiled = compileCustomProcess(registry, "remote", slot as never);
            bridge.compiled = compiled.fn as (...a: unknown[]) => unknown;
            return {
                ok: true,
                skipped: compiled.skipped,
                usesContext: compiled.usesContext,
                expanded: compiled.expanded,
                truncated: compiled.truncated,
            };
        } catch (e) {
            return { ok: false, threw: (e as Error).message };
        }
    },
    counts: { runs: 0, firstTick: null as number | null, lastError: "" },
    compiled: null as ((...a: unknown[]) => unknown) | null,
};

(globalThis as unknown as { __sk: typeof bridge }).__sk = bridge;
console.log(`${LOG} REMOTE BRIDGE ready — globalThis.__sk.status()`);

function applyEnabled(enabled: boolean, reason: string): void {
    console.log(`${LOG} applyEnabled`, enabled, reason);
    if (!enabled) {
        // The panel is deliberately left alone. It was mounted once at boot and is
        // not unmounted, so switching the mod off prunes the stored config but the
        // panel stays on screen — see the note in `tool.ts`. Re-enabling is a reload.
        try {
            runDisableCleanup(MOD_ID, reason, STORAGE_KEYS);
        } catch (e) {
            console.warn(`${LOG} cleanup failed`, e);
        }
        console.log(`${LOG} disabled (panel remains mounted; reload to re-enable)`);
        return;
    }
    mountPanel();
}

try {
    const cfg = readSettings(MOD_ID, SETTINGS);
    const enabled = cfg.enabled !== false;

    // The one and only registration. Synchronous, before anything can await, and
    // before the engine's one-shot sync to the simulation worker. The comment
    // inside `registerAll` says why it has to be here and not later.
    if (enabled) registerAll();

    applyEnabled(enabled, "boot");
    onSettingsChange(MOD_ID, SETTINGS, (next) => {
        applyEnabled(next.enabled !== false, "config-change");
    });
    console.log(`${LOG} LOADED v${VERSION}`);
} catch (e) {
    console.error(`${LOG} INIT FAILED`, e);
}
