"""Consolidate: one wrapper (packages/mysandkit.ts), host.ts gone.

mysandkit.ts becomes the leaf engine interface. The handler-coupled `register*`
helpers move to packages/registrations.ts, which is allowed to import the
handler and which nothing in the handler imports.
"""
import pathlib

root = pathlib.Path("src")
host = (root / "host.ts").read_text().split("\n")
msk = (root / "packages" / "mysandkit.ts").read_text().split("\n")


def L(lines, a, b):  # 1-based inclusive
    return "\n".join(lines[a - 1 : b])


# --- host.ts -> the body of mysandkit.ts (drop its doc header, keep the rest) ------
body = host[45:]  # everything after the 45-line doc header
body = "\n".join(body)
body = body.replace('from "./constants.ts"', 'from "../constants.ts"')
body = body.replace('from "./config/placement.ts"', 'from "../config/placement.ts"')

DOC = '''/**
 * The wrapper: every game api call the mod makes, in one place.
 *
 * ## One file, on purpose
 *
 * There used to be a second one — `src/host.ts` — holding the same `api` object.
 * Two files meant two import paths to the same thing, and the one the action
 * files used was the one that could drift. This file is the single place an
 * engine call is reached through.
 *
 * ## Why it imports nothing from `handler/`
 *
 * Because the dependency runs the other way: `handler/core/types.ts` re-exports
 * `api` from here, and `handler/core/handler-registry.ts` initialises `process.ts`
 * state at load. An import of any handler barrel from this file closes that loop
 * and the mod dies on
 * `ReferenceError: Cannot access 'BLOCK_KEY' before initialization` before a
 * single action runs — which is exactly what happened, twice, while this was
 * being built.
 *
 * So the rule is: **the handler may import the wrapper, never the reverse.** The
 * registration helpers that need `handler/custom-process` and
 * `handler/excavation-option` to compile a stored process live in
 * `registrations.ts` beside this file. They import the handler; nothing imports
 * them from inside the handler.
 *
 * ## What every wrapper here keeps
 *
 * - **Resolved per call.** `g()` reads the injected `sandkit` on every access. It
 *   was captured once at import in an earlier version, which froze `undefined`
 *   for any host injected later and turned every call into a silent no-op.
 * - **Typed from the engine's own declarations** (`packages/mysandkit/src/sandkit.ts`).
 *   Where the engine marks a member optional, this answers `undefined` or `null`
 *   rather than a fabricated value that would be indistinguishable from a real
 *   answer. A terrain at zero hit points is `0`, not "no terrain".
 * - **Contained.** Every call is in a try/catch, because these run on the worker
 *   thread where an uncaught throw takes the whole structure down.
 */'''

(root / "packages" / "mysandkit.ts").write_text(DOC + "\n" + body.strip() + "\n")

# --- the register* half -> registrations.ts --------------------------------------
tail = "\n".join(msk[51:])  # from RECIPE_MACHINES to end
REG_DOC = '''/**
 * Registration: the half of the wrapper that needs the handler.
 *
 * Everything here turns a stored process into something the engine can run, so
 * it imports `handler/custom-process` and `handler/excavation-option`. That is
 * precisely what `mysandkit.ts` cannot do, which is why these are separate
 * files rather than one: the split is the cycle-breaker, not an accident of
 * organisation.
 *
 * Nothing inside `handler/` imports this module, so the dependency still points
 * one way.
 */
import { compileExcavationProfile } from "../handler/excavation-option/index.ts";
import {
    type ContactReactionConfig,
    type ElementConfig,
    type InteractionConfig,
    type ItemConfig,
    LOG,
    MOD_ID,
    type ProcessingConfig,
    type RecipeConfig,
    type StructureConfig,
} from "../constants.ts";
import { compileEntryProcess } from "../handler/custom-process/index.ts";
import { placementConfigPayload, placementConfigProblem } from "../config/placement.ts";
import {
    type CompiledItemAction,
    g,
    resolveElementRef,
    resolveTerrainRef,
    setItemActionCompiler,
} from "./mysandkit.ts";

/**
 * Hand the wrapper the one thing it cannot build for itself.
 *
 * Runs at module load, which is why importing this module is part of boot: it is
 * what makes `api.items.register` work. Done here rather than at the call site
 * so a missing compiler throws with a message that says what to do, instead of
 * registering an item that can never be used.
 */
setItemActionCompiler(
    (def) =>
        compileEntryProcess(def, "itemAction") as unknown as CompiledItemAction,
);
'''
(root / "packages" / "registrations.ts").write_text(REG_DOC + "\n" + tail.strip() + "\n")

(root / "host.ts").unlink()
print("consolidated: host.ts removed, registrations.ts written")
