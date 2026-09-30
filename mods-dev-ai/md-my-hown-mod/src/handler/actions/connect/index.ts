/**
 * CONNECT — reach an engine system.
 *
 * The last role, and the one with the largest gap between what the engine offers
 * and what an author can reach. These actions do not touch the grid; they use
 * systems the game already has — power, research, items, signals — instead of
 * reimplementing them.
 *
 * Everything listed below is **current** api; nothing in this folder is
 * `@deprecated` (see `HandlerAction.md` §9).
 *
 * | want to                        | current call                                        |
 * | ------------------------------ | --------------------------------------------------- |
 * | consume / generate power       | `energy.consume`, `energy.addAtCell`                 |
 * | ask whether there is power     | `energy.getNetworkFreeCapacityAtCell`                |
 * | a custom power type            | `energy.registerType`                                |
 * | unlock a tech                  | `tech.unlockById` (not `unlockByType`)               |
 * | gate on research               | `tech.isResearchedById`                              |
 * | discount research              | hook `progression:cost:prepare`                      |
 * | charge for placing             | hook `building:place` (intercept)                    |
 * | be a sensor / an actuator      | `signals.registerSenderType` / `registerReceiverType` |
 * | enable pipes                   | `pipes.setEnabledAtCell`                             |
 * | gate this structure's own work | `structures.processing.setEnabledAtCell`              |
 * | an element transform           | `reactions.registerContact`                          |
 * | a conveyor / launcher          | `structureBehaviors.registerConveyorType`            |
 * | a machine recipe               | `processing.registerGrower` / `registerShaker` / `registerKineticPress` |
 *
 * ## Two things worth knowing before building on signals
 *
 * - **`registerSenderType` is not a whole logic system in one call.** It only
 *   seeds a wire's `on` flag *when the wire is drawn*; a live sensor also has to
 *   push `session.mods.signals.links` + `dirtyReceivers` when its value changes.
 *   That push is not public api, so it cannot be offered as a config action.
 * - **`setEnabledAtCell` returns a boolean and is a *gate*.** Holding a machine
 *   in a state and releasing it cleanly is the missing verb behind a
 *   redstone-style mod.
 *
 * See `HandlerAction.md` §7.
 *
 * @module
 */
import { defineActions, defineModifiers, hostNs } from "../../core/types.ts";

// ── Payload-signature actions ────────────────────────────────────────────────

export const connectActions = defineActions({
    /**
     * Publishes this structure's signal output.
     *
     * `registerSenderType` alone cannot be a live sensor — it only seeds a wire's
     * `on` flag at the moment the wire is drawn, and the push that updates a
     * sensor afterwards is not public api. That is why the note at the top of this
     * file says the two together are not one call. It is **not** the end of the
     * story: `api.signals.setOutputAtCell(x, y, value)` is public and is a direct
     * call to the engine's `signals.setAll`, and it is what the source mod used to
     * keep its material links lit.
     *
     * So a `senderType` signal plus this action is the working combination, and
     * this action is the half that was missing: without it a config could
     * *register* a sender and never actually publish anything, which looks like a
     * successful setup and is inert.
     *
     * The value is coerced to a boolean, because the engine's own `setAll` takes
     * the on/off flag and a number that happens to be `0` should read as off.
     */
    signalOutput: {
        role: "connect",
        doc: "Publishes this structure's signal output. Set `value` in options.",
        fn: (payload, _ctx, options) => {
            const s = payload as { x?: number; y?: number } | null;
            const x = Number(s?.x);
            const y = Number(s?.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            const value = (options as { value?: unknown } | null)?.value;
            try {
                hostNs("signals")?.setOutputAtCell?.(x, y, Boolean(value));
            } catch (e) {
                console.warn("[md-my-hown-mod:connect] signal output failed", e);
            }
        },
    },

    /**
     * Draws energy from the pool.
     *
     * The engine has **no** per-cell consume: `energy.consume(amount, options?)`
     * draws from the global pool, and the old call `consume(p.x, p.y, amount)`
     * therefore consumed `p.x` units — the requested `amount` was a third
     * argument the function never read, and `p.y` landed in the `options` slot
     * where a `{ allOrNothing }` flag belongs. Optional chaining meant it never
     * threw.
     *
     * ## Why it no longer needs a position
     *
     * The `payload` argument used to exist only to feed `p.x`/`p.y` into that
     * broken call. With the call fixed there is nothing left to read from it, so
     * keeping an `if (!payload) return` guard would demand a position the action
     * never uses — and the scope probe is right to call that drift: it records
     * payload *property* reads, and there are none.
     *
     * A global-pool draw genuinely is position-independent, so the honest scope is
     * `[]` (`ACTION_SCOPE` in `core/scope.ts`) and the action is now allowed to run
     * at any call site. This is the scope table agreeing with the code rather than
     * being edited to agree with a stale measurement.
     */
    energyConsumePerRun: {
        role: "connect",
        doc: "Draws `amount` from the shared power pool. Set `amount` in options.",
        fn: (_payload, _ctx, options) => {
            const amount = Number((options as { amount?: number } | null)?.amount ?? 0);
            if (!amount) return;
            try {
                // `allOrNothing: false` is the documented default; it is passed
                // explicitly so the intent survives if the engine ever changes it.
                hostNs("energy")?.consume?.(amount, { allOrNothing: false });
            } catch (e) {
                console.warn("[md-my-hown-mod:connect] energy consume failed", e);
            }
        },
    },

    /** Puts power into the network at this position. */
    energyGenerateWhileHeld: {
        role: "connect",
        doc: "Adds power to the network here. Set `amount` in options.",
        fn: (payload, _ctx, options) => {
            const amount = Number((options as { amount?: number } | null)?.amount ?? 0);
            const p = payload as { x?: number; y?: number } | null;
            if (!p || !amount) return;
            try {
                hostNs("energy")?.addAtCell?.(p.x, p.y, amount);
            } catch (e) {
                console.warn("[md-my-hown-mod:connect] energy generate failed", e);
            }
        },
    },

    /**
     * Appends to a built-in tech node's unlock list.
     *
     * `tech.conservatory.appendUnlock(techId, unlocks)` — the namespace matters,
     * and the second argument is an **object of id lists**, not a bare id. Both
     * were wrong in an earlier version of this file (`tech.appendUnlock(id, id)`),
     * and the failure was silent: the call went nowhere and the structure simply
     * never became researchable. `handler-classification.test.ts` pins it.
     */
    techAppendUnlock: {
        role: "connect",
        doc: "Adds structures to a tech node. Set `techId` and `structures` in options.",
        fn: (payload, _ctx, options) => {
            const o = (options ?? {}) as {
                techId?: unknown;
                structures?: string[];
                items?: string[];
            };
            const self = (payload as { id?: string } | null)?.id;
            const structures = o.structures ?? (self ? [self] : []);
            if (!o.techId || structures.length === 0) return;
            try {
                hostNs("tech")?.conservatory?.appendUnlock?.(o.techId, {
                    structures,
                    ...(o.items ? { items: o.items } : {}),
                });
            } catch (e) {
                console.warn("[md-my-hown-mod:connect] tech append failed", e);
            }
        },
    },

    /** Grants an item to the player. */
    techGrantItem: {
        role: "connect",
        doc: "Gives the player an item. Set `itemId` and `count` in options.",
        fn: (_payload, _ctx, options) => {
            const o = (options ?? {}) as { itemId?: string; count?: number };
            if (!o.itemId) return;
            try {
                // `addById`, not `addFromId` — the latter is @deprecated. It also
                // takes no count, so a request for more than one is one call per
                // item rather than a silently ignored argument.
                const add = hostNs("player")?.inventory?.addById;
                if (typeof add !== "function") return;
                for (let i = 0; i < Math.max(1, o.count ?? 1); i++) add(o.itemId);
            } catch (e) {
                console.warn("[md-my-hown-mod:connect] grant item failed", e);
            }
        },
    },

    /**
     * Sets an upgrade's level on completion.
     *
     * `setLevelById`, not `setLevelByType` — see `HandlerAction.md` §9.
     */
    techSetUpgradeLevel: {
        role: "connect",
        doc: "Sets an upgrade level. Set `itemId`, `upgradeId` and `level` in options.",
        fn: (_payload, _ctx, options) => {
            const o = (options ?? {}) as {
                itemId?: string;
                upgradeId?: string;
                level?: number;
            };
            if (!o.itemId || !o.upgradeId) return;
            try {
                hostNs("upgrades")?.setLevelById?.(o.itemId, o.upgradeId, o.level ?? 1);
            } catch (e) {
                console.warn("[md-my-hown-mod:connect] set upgrade level failed", e);
            }
        },
    },

    /**
     * A storage node: returns the capacity descriptor a structure registers with.
     *
     * One of four energy presets. All four return a *value* rather than performing
     * an effect, which is why they read oddly as CONNECT actions — they build the
     * registration payload, so they are kept together rather than split.
     */
    energyDefault: {
        role: "connect",
        doc: "Storage node descriptor: capacity 1000. Override `capacity` in options.",
        fn: (_structure, _ctx, extra) => {
            const o = (extra as { capacity?: number; energyType?: string } | null) ?? {};
            return {
                capacity: o.capacity ?? 1000,
                ...(o.energyType ? { energyType: o.energyType } : {}),
            };
        },
    },

    /** A large buffer, for a machine that stores a lot. */
    energyBank: {
        role: "connect",
        doc: "Storage node descriptor: capacity 100000 — a large buffer.",
        fn: (_structure, _ctx, extra) => {
            const o = (extra as { capacity?: number; energyType?: string } | null) ?? {};
            return {
                capacity: o.capacity ?? 100000,
                ...(o.energyType ? { energyType: o.energyType } : {}),
            };
        },
    },

    /** A small buffer between two machines. */
    energyWire: {
        role: "connect",
        doc: "Storage node descriptor: capacity 200 — a small buffer between machines.",
        fn: (_structure, _ctx, extra) => {
            const o = (extra as { capacity?: number; energyType?: string } | null) ?? {};
            return {
                capacity: o.capacity ?? 200,
                ...(o.energyType ? { energyType: o.energyType } : {}),
            };
        },
    },

    /** A conductor: forwards power and holds none of its own. */
    energyConductor: {
        role: "connect",
        doc: "Conductor descriptor: capacity 0. Forwards energy without holding any.",
        fn: () => ({ capacity: 0 }),
    },

    /** Joins the network named by `energyType`. */
    energyNetwork: {
        role: "connect",
        doc: "Joins the network named by `energyType` in options.",
        fn: (_structure, _ctx, extra) => {
            const o = (extra as { energyType?: string } | null) ?? {};
            return { capacity: 0, ...(o.energyType ? { energyType: o.energyType } : {}) };
        },
    },

    /** Baseline item options, for a tool or weapon that changes nothing. */
    itemDefault: {
        role: "connect",
        doc: "Baseline item options (power 5). Use as a base for a tool or weapon.",
        fn: () => ({ power: 5 }),
    },
});

// ── Modifier-signature actions ───────────────────────────────────────────────
//
// `{ kind, fn }` rather than a bare function, because the engine must know before
// it runs whether this action can cancel. `intercept` can; `modify` cannot.
//
// `unlockByType` and `addFromId` are deliberately absent — see
// `HandlerAction.md` §9 and `deprecated-api.test.ts`, which fails the build if
// one is ever called.

export const connectModifierActions = defineModifiers({
    /** Prints whatever the hook passed in — for discovering hook names. */
    logArgs: {
        role: "connect",
        kind: "intercept",
        doc: "Modifier: prints whatever the hook passed in. Use to discover hook names.",
        fn: (args, ctx) => {
            console.log("[md-my-hown-mod:modifier] intercept", args, ctx);
        },
    },

    /** Returns its argument untouched — proves a `modify` hook is wired. */
    identity: {
        role: "connect",
        kind: "modify",
        doc: "Modifier: returns the args untouched. Proves a modify hook is wired.",
        fn: (args) => args,
    },

    /** Prints a building-placement-shaped payload. */
    logBuildingPayload: {
        role: "connect",
        kind: "intercept",
        doc: "Modifier: prints a building-placement-shaped payload. Useful while wiring.",
        fn: (args) => {
            try {
                console.log(
                    "[md-my-hown-mod:modifier] building-ish",
                    JSON.parse(JSON.stringify(args ?? null)),
                );
            } catch {
                console.log("[md-my-hown-mod:modifier] building-ish (raw)", args);
            }
        },
    },
});
