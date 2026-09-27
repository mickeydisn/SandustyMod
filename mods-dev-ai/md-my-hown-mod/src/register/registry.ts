/**
 * The registration guard: what is registered, and the one moment new content
 * may be registered.
 *
 * ## The boot window
 *
 * The engine hands mod definitions to the simulation worker exactly once, at
 * boot, in a single burst immediately after it runs the mod script
 * (`bundel.js:173616-173621`): matters, elements, terrains, structures, recipes.
 * Every `register` call only ever fills the *main thread's* copy — none of them
 * post. So an id registered after that window is a definition the worker has
 * never heard of: visible in the picker, drawn with its colour, and inert in the
 * simulation. Nothing throws, which is what makes it so expensive to debug.
 *
 * It cannot be repaired afterwards. The worker-side `updateDefinition` is a
 * *guarded merge* — `const l = m5[type]; l && Object.assign(l, patch)`
 * (`utils-worker.js/75071.js:22-34`) — so patching a type the worker has never
 * been given is a silent no-op, and no mod-facing call creates one.
 *
 * ## Why re-registering is not a workaround — it crashes
 *
 * Registering an id a second time does **not** update it. The engine computes
 * the type as `max(builtIn, modMax) + 1` (bundel.js:46781.js:1272-1278), so a
 * repeat call mints a *new* type number and overwrites the map entry — leaving
 * the previous type still in `m5` and still in the picker while the id now
 * describes a different definition.
 *
 * So the window is closed exactly once, by `registerAll`, and nothing may open
 * it again. The UI cannot apply anything at all; a save is a save.
 */

/** Categories whose definitions the simulation worker needs in order to run. */
const WORKER_SCOPED = ["elements", "terrains", "structures", "recipes"] as const;



const WORKER_SCOPED_SET: ReadonlySet<string> = new Set<string>(WORKER_SCOPED);

/** True when this category is meaningless to the worker without its definition. */
function needsWorker(cat: string): boolean {
    return WORKER_SCOPED_SET.has(cat);
}

let windowOpen = true;

export function closeBootWindow(): void {
    windowOpen = false;
}

export function isBootWindowOpen(): boolean {
    return windowOpen;
}

/**
 * Forget the window and everything recorded in it.
 *
 * Test-only, and named as such: the production lifecycle is "register, then
 * close", and nothing reopens it. A test that wants to assert the early path
 * again has to be able to put the module back in its initial state.
 */
export function __resetBootWindowForTests(): void {
    for (const s of Object.values(registered)) s.clear();
    windowOpen = true;
}

/**
 * May this id be pushed into the running game right now?
 *
 * False once the boot window has shut, for the categories the simulation worker
 * needs. Registering then cannot reach the worker, and registering an id that is
 * already live mints a *second* type for it — the engine computes a type as
 * `max(builtIn, modMax) + 1` (bundel.js:46781.js:1272-1278), so a repeat call
 * does not replace the old definition, it orphans it while the id starts
 * describing a different one.
 *
 * Categories the worker never sees (items, sprites, signals, …) are unaffected.
 *
 * One place, because four separate category modules ask this question.
 */
export function mayRegister(cat: string, id: string): boolean {
    if (!needsWorker(cat)) return true;
    return isBootWindowOpen();
}

/**
 * Every category that can be registered, so a guard can be a `Set` lookup rather
 * than a lazy `(registered as any)[cat] = new Set()` at each use site.
 *
 * A key that is *declared* but never written still returns an empty set, which is
 * what the "already registered?" check needs. A missing key returned `undefined`
 * and silently skipped the guard — the failure mode this list exists to remove.
 */
export const registered: Record<string, Set<string>> = {
    sprites: new Set(),
    elements: new Set(),
    structures: new Set(),
    items: new Set(),
    terrains: new Set(),
    recipes: new Set(),
    processing: new Set(),
    contacts: new Set(),
    interactions: new Set(),
    modifiers: new Set(),
    techs: new Set(),
    upgradeCategories: new Set(),
    upgrades: new Set(),
    projectiles: new Set(),
    energyTypes: new Set(),
    excavationProfiles: new Set(),
    structureBehaviors: new Set(),
    signals: new Set(),
    triggers: new Set(),
    inputBindings: new Set(),
};
