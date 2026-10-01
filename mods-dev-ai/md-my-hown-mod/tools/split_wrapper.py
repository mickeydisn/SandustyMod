"""One-shot split: move the api wrapper out of mysandkit.ts into a leaf host.ts."""
import pathlib

src = pathlib.Path("src/packages/mysandkit.ts").read_text().split("\n")


def L(a, b):  # 1-based inclusive
    return "\n".join(src[a - 1 : b])


head_imports = L(5, 19)  # constants block + placement import
declare_g = L(21, 27)  # declare const sandkit + g()
api_block = L(29, 971)  # api object + helpers through normalizeItem
tail = L(974, 1489)  # RECIPE_MACHINES onward

declare_g = declare_g.replace("const g =", "export const g =")
for fn in ("resolveElementRef", "resolveTerrainRef"):
    api_block = api_block.replace(f"\nfunction {fn}(", f"\nexport function {fn}(")

HOST_DOC = '''/**
 * The engine interface: every game api call in the mod, in one place.
 *
 * ## Why this file is separate, and why it is a leaf
 *
 * The mod has one wrapper over the host, and this is it. It is deliberately the
 * only module in the api path that imports nothing from `handler/`, because the
 * dependency runs the other way too: `handler/core/types.ts` re-exports `api`
 * from here, and `handler/core/handler-registry.ts` initialises `process.ts`
 * state at load. If the wrapper imported a handler barrel, that chain closed into
 * a cycle and threw `Cannot access 'optionKeysLookup' before initialization`
 * before a single action ran.
 *
 * So the rule this file exists to enforce: **the handler may import the wrapper,
 * never the reverse.** The registration helpers that genuinely need
 * `handler/custom-process` and `handler/excavation-option` to compile a stored
 * process live in `packages/mysandkit.ts`, which is allowed those imports, and
 * nothing imports that file.
 *
 * ## The three properties every wrapper here keeps
 *
 * - **Resolved per call.** `g()` reads the injected `sandkit` on every access. It
 *   used to be captured once at import, which froze `undefined` for any host
 *   injected later and turned every call into a silent no-op.
 * - **Typed from the engine's own declarations.** Signatures mirror
 *   `packages/mysandkit/src/sandkit.ts`. Where the engine marks a member
 *   optional (`isCellEmptyAtCell?`) the wrapper answers `undefined` rather than
 *   inventing a `false` that would be indistinguishable from a real answer.
 * - **Contained.** Every call sits in a try/catch, because these run on the
 *   worker thread where an uncaught throw takes the whole structure down.
 */'''

placement = 'import { placementConfigPayload, placementConfigProblem } from "../config/placement.ts";\n'
leaf_imports = head_imports.replace(placement, "")
tail_imports = (
    head_imports
    .replace(placement, "")
    + "import { compileEntryProcess } from \"../handler/custom-process/index.ts\";\n"
    + placement
    + "import { api, g, resolveElementRef, resolveTerrainRef } from \"../host.ts\";\n"
)

pathlib.Path("src/host.ts").write_text(
    HOST_DOC + "\n" + leaf_imports + "\n" + declare_g + "\n" + api_block + "\n"
)

pathlib.Path("src/packages/mysandkit.ts").write_text(
    '''/**
 * Registration: the half of the wrapper that needs the handler.
 *
 * The typed engine interface lives in `../host.ts`, which stays a leaf so the
 * handler can import it without closing a cycle. What lives here is everything
 * that turns a stored process into something the engine can run, which means
 * `handler/custom-process` and `handler/excavation-option` — imports the leaf
 * cannot have. Nothing imports this file, so the dependency still points one way.
 */
import { compileExcavationProfile } from "../handler/excavation-option/index.ts";
'''
    + tail_imports
    + "\n// The one wrapper object, re-exported so callers reach for a single import.\n"
    + "export { api };\n\n"
    + tail
    + "\n"
)

for p in ("src/host.ts", "src/packages/mysandkit.ts"):
    print(p, len(pathlib.Path(p).read_text().split("\n")), "lines")
