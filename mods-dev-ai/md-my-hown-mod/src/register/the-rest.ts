/**
 * Every category without a module of its own, registered in dependency order.
 *
 * These share three properties that put them in one file rather than twenty:
 * they are all **not** worker-scoped (the engine posts no matching sync message,
 * so a definition registered at boot is fully live), each is a single
 * `register*` call with no per-category guard beyond the shared id set, and
 * their order here is a dependency order, not a priority.
 *
 * Sprites come first because items and structures reference them by id.
 * Upgrades come after techs and upgrade categories because the engine resolves
 * their requirements against them.
 */
import { LOG, type ModConfig } from "../constants.ts";
import {
    registerContact,
    registerEnergyType,
    registerExcavationProfile,
    registerInputBinding,
    registerInteraction,
    registerProcessing,
    registerProjectile,
    registerRecipe,
    registerSignal,
    registerSprite,
    registerStructureBehavior,
    registerTech,
    registerTrigger,
    registerUpgrade,
    registerUpgradeCategory,
} from "../packages/mysandkit.ts";
import { registerItems } from "./core/items.ts";
import { mayRegister, registered } from "./registry.ts";
import { joinedNetworkNames, reportEnergyNetworks } from "./custom/energy-network.ts";
import { engineTechOf, techUnlockStructureIds } from "../ui/tech-link.ts";
import { actionRefsOf, applyAllModifiers, compileProcess } from "../hooks/index.ts";
import {
    compileProjectile,
    PROJECTILE_OPTION_LEGACY_KEYS,
    PROJECTILE_OPTION_STORE_KEY,
    projectileOptionOf,
} from "../hooks/projectile-option/index.ts";

export function registerTheRest(config: ModConfig): Record<string, number> {
    const counts: Record<string, number> = {};

    // Sprites first so items/structures can reference them
    for (const sp of config.sprites ?? []) {
        if (!sp?.id || registered.sprites.has(sp.id)) continue;
        void registerSprite(sp);
        registered.sprites.add(sp.id);
        counts.sprites = (counts.sprites ?? 0) + 1;
    }

    // Items are not worker-synced: the engine has no `RegisterModItems`
    // message, so a definition registered at boot is fully live.
    counts.items = registerItems(config);

    for (const r of config.recipes ?? []) {
        if (!r?.id || registered.recipes.has(r.id)) continue;
        if (!mayRegister("recipes", r.id)) continue;
        registerRecipe(r);
        registered.recipes.add(r.id);
        counts.recipes = (counts.recipes ?? 0) + 1;
    }
    for (const p of config.processing ?? []) {
        if (!p?.id || registered.processing.has(p.id)) continue;
        // process() cannot live in JSON — compile the process first.
        const entry = p as Record<string, unknown>;
        if (typeof entry.process !== "function") {
            // A process, not a key: an ordered list of actions, each with its own
            // options. This is the call that finally delivers them — the engine
            // passes only `(structure, context)`, so `processorConvert`'s required
            // `to` must be bound at compile time or the action can never fire.
            const { fn, skipped } = compileProcess(actionRefsOf(entry), "processing");
            if (skipped.length) {
                console.warn(`${LOG} processing ${p.id}: unknown action ${skipped.join(", ")}`);
            }
            entry.process = fn;
        }
        registerProcessing(p);
        registered.processing.add(p.id);
        counts.processing = (counts.processing ?? 0) + 1;
    }
    for (const c of config.contacts ?? []) {
        if (!c?.id || registered.contacts.has(c.id)) continue;
        registerContact(c);
        registered.contacts.add(c.id);
        counts.contacts = (counts.contacts ?? 0) + 1;
    }
    for (const ix of config.interactions ?? []) {
        if (!ix?.id || registered.interactions.has(ix.id)) continue;
        registerInteraction(ix);
        registered.interactions.add(ix.id);
        counts.interactions = (counts.interactions ?? 0) + 1;
    }

    counts.modifiers = applyAllModifiers(config.modifiers ?? []);
    for (const m of config.modifiers ?? []) {
        if (m?.id) registered.modifiers.add(m.id);
    }

    for (const t of config.techs ?? []) {
        if (!t?.id || registered.techs.has(t.id)) continue;
        // The engine reads `unlocks.structures` off the *tech*, while a structure
        // names an unlock *node*, so the tech is handed the union. Without this a
        // structure whose node builds or borrows this tech would never be granted,
        // and the node would silently do nothing — the same class of bug as
        // `alwaysUnlocked`, in the opposite direction.
        const ids = techUnlockStructureIds(t.id, config);
        registerTech(ids.length ? { ...t, unlocks: { ...(t.unlocks ?? {}), structures: ids } } : t);
        registered.techs.add(t.id);
        counts.techs = (counts.techs ?? 0) + 1;
    }
    // A "tech"-kind node *builds* a real engine tech, which is what makes a node
    // and an in-game research step the same thing to edit. Registered after the
    // hand-written techs so a node's union already includes everything, and
    // skipped when it borrows one so the borrowed definition is never overwritten.
    for (const n of config.unlockNodes ?? []) {
        if (!n?.id || n.kind !== "tech" || n.techId) continue;
        if (registered.techs.has(n.id)) continue;
        const tech = engineTechOf(n, config);
        if (!tech) continue;
        registerTech(tech);
        registered.techs.add(n.id);
        counts.techs = (counts.techs ?? 0) + 1;
    }
    for (const u of config.upgradeCategories ?? []) {
        if (!u?.id || registered.upgradeCategories.has(u.id)) continue;
        registerUpgradeCategory(u);
        registered.upgradeCategories.add(u.id);
        counts.upgradeCategories = (counts.upgradeCategories ?? 0) + 1;
    }
    for (const u of config.upgrades ?? []) {
        if (!u?.id || registered.upgrades.has(u.id)) continue;
        registerUpgrade(u);
        registered.upgrades.add(u.id);
        counts.upgrades = (counts.upgrades ?? 0) + 1;
    }
    for (const p of config.projectiles ?? []) {
        if (!p?.id || registered.projectiles.has(p.id)) continue;
        // The one slot that is **not** a process. `getOptions()` is called with no
        // arguments and the engine reads its return as the projectile's config, so
        // this is a single `ProjectileOption` — not an ordered list whose returns
        // are merged. `compileProjectile` refuses a non-option key and reports an
        // old multi-option config rather than silently picking one; `mysandkit`
        // synthesises a `getOptions` from the static options only if we leave it
        // unset, which is the all-static projectile case.
        const entry = p as Record<string, unknown>;
        const { ref, problem } = projectileOptionOf(entry);
        if (problem) console.warn(`[md-my-hown-mod] projectile ${entry.id}: ${problem}`);
        if (typeof entry.getOptions !== "function") {
            const compiled = compileProjectile(
                ref,
                (f) =>
                    console.warn(
                        `[md-my-hown-mod] projectile ${entry.id} option ${f.key} failed`,
                        f.error,
                    ),
            );
            if (compiled.problem) {
                console.warn(`[md-my-hown-mod] projectile ${entry.id}: ${compiled.problem}`);
            }
            // The legacy keys are dropped whether or not they were understood, so
            // saving from the panel cannot leave two competing option references.
            for (const k of PROJECTILE_OPTION_LEGACY_KEYS) delete entry[k];
            if (ref) {
                entry[PROJECTILE_OPTION_STORE_KEY] = ref;
            }
            entry.getOptions = compiled.getOptions as never;
        }
        registerProjectile(p);
        registered.projectiles.add(p.id);
        counts.projectiles = (counts.projectiles ?? 0) + 1;
    }
    for (const e of config.energyTypes ?? []) {
        if (!e?.id || registered.energyTypes.has(e.id)) continue;
        registerEnergyType(e);
        registered.energyTypes.add(e.id);
        counts.energyTypes = (counts.energyTypes ?? 0) + 1;
    }
    // The one place a network name becomes something the engine acts on, so it is
    // also the only place the set of *joined* networks can be read off the config.
    reportEnergyNetworks(config, joinedNetworkNames(config));

    for (const e of config.excavationProfiles ?? []) {
        if (!e?.id || registered.excavationProfiles.has(e.id)) continue;
        registerExcavationProfile(e);
        registered.excavationProfiles.add(e.id);
        counts.excavationProfiles = (counts.excavationProfiles ?? 0) + 1;
    }
    for (const b of config.structureBehaviors ?? []) {
        if (!b?.id || registered.structureBehaviors.has(b.id)) continue;
        registerStructureBehavior(b);
        registered.structureBehaviors.add(b.id);
        counts.structureBehaviors = (counts.structureBehaviors ?? 0) + 1;
    }
    for (const sg of config.signals ?? []) {
        if (!sg?.id || registered.signals.has(sg.id)) continue;
        // `actionRefsOf` migrates a pre-split `handlerKey` to a one-action process,
        // so an existing config still registers the way it always did.
        registerSignal(
            sg,
            compileProcess(actionRefsOf(sg as Record<string, unknown>), "signal").fn as never,
        );
        registered.signals.add(sg.id);
        counts.signals = (counts.signals ?? 0) + 1;
    }
    for (const tr of config.triggers ?? []) {
        if (!tr?.id || registered.triggers.has(tr.id)) continue;
        // The engine calls a trigger's callback with **no arguments** — `extra` goes
        // in the registration, not the call — so the process is what finally hands
        // the options to the action.
        registerTrigger(
            tr,
            compileProcess(actionRefsOf(tr as Record<string, unknown>), "trigger").fn as never,
        );
        registered.triggers.add(tr.id);
        counts.triggers = (counts.triggers ?? 0) + 1;
    }

    // Input bindings: `handlers` is a function pair, so the stored keys are
    // resolved to functions here rather than in the config.
    for (const b of config.inputBindings ?? []) {
        if (!b?.id || registered.inputBindings.has(b.id)) continue;
        const entry = { ...b } as Record<string, unknown>;
        for (const slot of ["onDownKey", "onUpKey"] as const) {
            const key = b[slot];
            if (!key) continue;
            // Input bindings still store a bare key rather than a list — they are a
            // function *pair* on one entry, not one process, and there is no place
            // to put a list. A one-action process is the whole of it.
            const { fn, skipped } = compileProcess(actionRefsOf({ handlerKey: key }), "behavior");
            if (typeof fn === "function" && !skipped.length) entry[slot] = fn as never;
            else console.warn(`${LOG} input binding ${b.id}: unknown ${slot} "${key}"`);
        }
        registerInputBinding(entry as never);
        registered.inputBindings.add(b.id);
        counts.inputBindings = (counts.inputBindings ?? 0) + 1;
    }

    return counts;
}
