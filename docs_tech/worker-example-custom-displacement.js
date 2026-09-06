/**
 * Example — "state over density": decide what happens when a particle sinks
 * or floats into another element, instead of letting the engine's pure-density
 * rule decide for you.
 *
 * ── Why you need this ─────────────────────────────────────────────────────
 * The engine's default displacement rule is STRICTLY density-based:
 *      mover.density  >  occupant.density   → sink/push through (a SWAP)
 *      mover.density <=  occupant.density   → blocked
 *
 * A displacement into an occupied cell is a SWAP (bundel-worker.js:40633).
 * A swap has:
 *   • NO `element:move` interceptor   → you cannot veto it at `element:move`
 *   • NO cancel token
 * (the only thing it fires is the `element:moved` notification, after the fact.)
 *
 * The lever is `element:update` (bundel-worker.js:46341-46352): it runs BEFORE
 * the tick's gravity/displacement resolver, and if you `cancel.cancel()` it the
 * engine hits an early `return` that skips the resolver. So you can:
 *   1. let the particle fall normally through air (no cancel),
 *   2. detect contact in the travel direction (the occupied cell below / above),
 *   3. `cancel.cancel()` the default density swap,
 *   4. run your OWN rule (react, freeze, manual swap, transform, ...).
 *
 * ── Recursion safety ──────────────────────────────────────────────────────
 * Calling `replaceAtCell` / `createAtCell` / `swapBetweenCells` from inside an
 * `element:update` handler will NOT re-trigger `element:update`: those helpers
 * mutate cells directly and only fire their own events on the next chunk pass.
 * `swap` in particular has no interceptor check anywhere (safe to call freely).
 *
 * With this partial example a type "mote" is registered elsewhere at mod load.
 */

let TYPES = null;
function getTypes(e) {
    if (TYPES) return TYPES;
    const E = sandkit.api.elements;
    TYPES = {
        mote:  E.getTypeFromId(e, "mote"),   // our custom element
        water: E.getTypeFromId(e, "water"),
        steam: E.getTypeFromId(e, "steam"),
        froth: E.getTypeFromId(e, "froth"),
    };
    return TYPES;
}

// Guard uses -1 (wildcard) because element:update requires a guard but we want
// to filter inside the handler (matching the "mote" type exactly). Guard type
// must be -1 or an integer 0..4095 (bundel.js:60457) — -1 is valid.
sandkit.api.hooks.intercept(
    "element:update",
    (e, payload, cancel) => {
        const T = getTypes(e);
        if (payload.elementType !== T.mote) return;   // only our type

        // ── 1) Normal air movement ────────────────────────────────
        // For a sinking solid the cell it's about to enter is BELOW (y+1).
        // If nothing meaningful is there (air), do NOT cancel → the engine's
        // default gravity + move runs as normal.
        const below = sandkit.api.elements.getResolvedTypeAtCell(
            e, payload.x, payload.y + 1
        );
        if (below !== T.water) return;

        // ── 2) Contact with water ── now decide, ignoring density ──
        // The engine would sink us (density swap) because (say) mote=150 > water=100.
        // Override the default entirely:
        cancel.cancel();   // skips the resolver → no gravity, no sink this tick

        const api = sandkit.api;
        const hot = api.elements.getDataFieldAtCell(e, payload.x, payload.y, 1) === 1;

        if (hot) {
            // State rule: HOT mote reacts on contact → becomes steam + froth.
            // (neither outcome could be expressed with density alone)
            api.elements.replaceAtCell(e, payload.x, payload.y, T.steam, { duration: 1.5 });
            api.elements.createAtCell(e, payload.x, payload.y + 1, T.froth, { duration: 0.6 });
        } else {
            // State rule: COLD mote refuses the density sink → hovers at the
            // surface (cancelling each tick freezes it there) and flags itself.
            api.elements.setDataFieldAtCell(e, payload.x, payload.y, 2, 1);
        }
    },
    { guard: { elementType: -1 } }
);


/* ── Variant: a FLOATING (buoyant) particle ────────────────────────────────
 * Check the cell ABOVE (y-1) instead of below; a gas puff that meets a denser
 * slab of water above could be told to condense rather than pass through:
 *
 *   sandkit.api.hooks.intercept("element:update", (e, p, cancel) => {
 *       const T = getTypes(e);
 *       if (p.elementType !== T.puff) return;
 *       const above = sandkit.api.elements.getResolvedTypeAtCell(e, p.x, p.y - 1);
 *       if (above !== T.water) return;            // normal float in air
 *       cancel.cancel();
 *       sandkit.api.elements.replaceAtCell(e, p.x, p.y, T.steam, { duration: 0.8 });
 *   }, { guard: { elementType: -1 } });
 * */


/* ── Variant: manual custom "displacement window" ──────────────────────────
 * Instead of reacting, you can perform your OWN swap — sink only when YOUR
 * condition holds. This is how you replace the density rule with an arbitrary
 * eligibility test (e.g. only sink if field1===2), while still moving normally
 * through air (no cancel when the target cell is empty):
 *
 *   sandkit.api.hooks.intercept("element:update", (e, p, cancel) => {
 *       const T = getTypes(e);
 *       if (p.elementType !== T.mote) return;
 *       const below = sandkit.api.elements.getResolvedTypeAtCell(e, p.x, p.y + 1);
 *       if (below !== T.water) return;            // air → normal fall
 *       if (sandkit.api.elements.getDataFieldAtCell(e, p.x, p.y, 1) === 2) {
 *           cancel.cancel();                       // don't let the engine decide
 *           sandkit.api.elements.swapBetweenCells( // …we choose to pass through
 *               e, p.x, p.y, p.x, p.y + 1
 *           );
 *       }
 *   }, { guard: { elementType: -1 } });
 * */


/* ── Managing the bilateral (symmetric) density rule ───────────────────────
 * (This is not part of the update() hook above — read it carefully first.)
 *
 * The compare is ALWAYS `mover.density > occupant.density`, evaluated from
 * whichever element is the current mover each tick. Two management facts:
 *
 *   1. Your handler only runs when YOUR element is the MOVER (the element being
 *      stepped). For sink/float that's correct — your element is the one moving
 *      into the other substance.
 *
 *   2. It does NOT run when a DENSER element is the mover sinking INTO your
 *      element's cell. In that case the OTHER element's update is the mover, so
 *      your mote handler stays silent and the denser element displaces your mote.
 *      → To manage that direction you must hook the mover too (see B / C below).
 *
 * So pick exactly what you want to override in each direction:
 */


/* A) Branch on density to KEEP the engine's normal outcome in some cases.
 *    Only override when mote is the DENSER mover (it would sink). If mote is
 *    lighter, the engine already floats it — leave that alone. */
function exampleBranchOnDensity() {
    sandkit.api.hooks.intercept(
        "element:update",
        (e, payload, cancel) => {
            const T = getTypes(e);
            if (payload.elementType !== T.mote) return;

            const below = sandkit.api.elements.getResolvedTypeAtCell(e, payload.x, payload.y + 1);
            if (below !== T.water) return;                          // air → normal fall

            const moteDens = sandkit.api.elements.getDefinitionByType(e, T.mote).density;
            const occDens  = sandkit.api.elements.getDefinitionByType(e, below).density;
            if (!(moteDens > occDens)) return;                      // lighter → floats, nothing to override

            cancel.cancel();                                        // denser → would sink; decide NOW
            // ...your state reaction (transform / freeze / manual swap / ...).
        },
        { guard: { elementType: -1 } }
    );
}


/* B) Protect mote from being displaced by a DENSER mover.
 *    Hook that mover too (here "gold", density 300). When gold sinks into
 *    mote's cell YOU are the one vetoing it — otherwise gold displaces mote and
 *    your mote handler never even fires. */
function exampleProtectFromDenserMover() {
    sandkit.api.hooks.intercept(
        "element:update",
        (e, payload, cancel) => {
            const T = getTypes(e);
            if (payload.elementType !== T.gold) return;
            const below = sandkit.api.elements.getResolvedTypeAtCell(e, payload.x, payload.y + 1);
            if (below !== T.mote) return;                           // gold not over mote → normal
            cancel.cancel();                                        // stop gold displacing mote
        },
        { guard: { elementType: -1 } }
    );
}


/* C) The "density charge" shortcut for an undislodgable element.
 *    Register mote with a density >= every element it can ever meet. Then
 *    nothing lighter/equal sinks into it, and same-type still never displaces.
 *    element:update then controls ONLY mote's own movement & reactions. This is
 *    the cheapest way to make a particle that can't be pushed out of the way.
 *
 *    (mote registration elsewhere, e.g. at mod load:)
 *        elements.register(e, {
 *            id: "mote",
 *            density: 10000,          // heavier than anything it can meet
 *            matterType: MatterType.Solid,
 *            ...
 *        });
 * */