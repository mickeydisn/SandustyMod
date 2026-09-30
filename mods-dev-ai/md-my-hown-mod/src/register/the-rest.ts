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
import { applyAllModifiers, compileProcess } from "../handler/index.ts";
import {
    compileEntryProcess,
    ProcessRegistry,
    setProcessRegistry,
} from "../handler/custom-process/index.ts";
import {
    compileProjectile,
    PROJECTILE_OPTION_STORE_KEY,
    projectileOptionOf,
} from "../handler/projectile-option/index.ts";

export function registerTheRest(config: ModConfig): Record<string, number> {
    const counts: Record<string, number> = {};

    // One index of the author's processes, built once and handed to every call site
    // below. Built here rather than imported so the register path is the only thing
    // that needs it, and so a config with no processes costs one empty map.
    const processes = new ProcessRegistry(config.processes ?? []);
    // And **installed**, because two call sites live in `../packages/mysandkit.ts` and
    // cannot take it as an argument: that layer mirrors the engine's own signatures
    // (`registerItem(def)`, `registerUpgrade(def)` — one definition, no config), and
    // changing those to thread a registry through would mean diverging from the API
    // they exist to mirror. See the note on `setProcessRegistry`.
    setProcessRegistry(processes);

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
            // A program, not a key. A definition stores a *reference* to a process
            // (`processId`); the migration in `../config/store.ts` has already turned
            // any legacy `actions` array into one. This is the call that finally
            // resolves the reference — the engine passes only `(structure, context)`,
            // so `processorConvert`'s required `to` must be bound at compile time or
            // the action can never fire.
            const compiled = compileEntryProcess(entry, "processing", processes);
            if (compiled.source.kind === "process" && compiled.expanded.length) {
                console.log(
                    `${LOG} processing ${p.id}: program from ${compiled.expanded.join(" → ")}`,
                );
            }
            if (compiled.skipped.length) {
                console.warn(
                    `${LOG} processing ${p.id}: unknown action ${compiled.skipped.join(", ")}`,
                );
            }
            if (compiled.unknownOptions.length) {
                // Loud on purpose. An option no action declares is *not* a compile
                // error — the step still runs, on defaults — so this is the only
                // place the mistake is visible before it shows up as an action
                // quietly doing the wrong thing.
                console.warn(
                    `${LOG} processing ${p.id}: option no action declares ` +
                        `${compiled.unknownOptions.join(", ")} — the step runs on defaults`,
                );
            }
            // A **copy**, never `entry.process = …` on the object being iterated.
            //
            // `api.storage.get` is `state.store.mods[modId][key]` — a live
            // reference, not a copy — so `config` here *is* the save payload.
            // Writing the compiled callback onto it put a **function** into the
            // store, and the game saves with
            //     simulation.manager.postMessage([Save, { ...e.store }, …])
            // which is a structured clone. A function cannot be cloned, so every
            // quit threw
            //     DataCloneError: … could not be cloned
            // Reproduced in the game, on every save, for any config with a
            // `processing` or `projectiles` entry.
            registerProcessing({ ...entry, process: compiled.fn } as never);
        } else {
            registerProcessing(p);
        }
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
            // A **copy** again, for the same reason as `processing` above: `entry`
            // is the live object inside the save payload, and a function there
            // breaks the save's structured clone.
            //
            // Only the current key is written. The pre-split spellings are left
            // where they are: nothing reads them, and deleting an author's key on
            // the way to the engine is how a config loses data it never showed
            // anyone.
            registerProjectile({
                ...entry,
                ...(ref ? { [PROJECTILE_OPTION_STORE_KEY]: ref } : {}),
                getOptions: compiled.getOptions,
            } as never);
        } else {
            registerProjectile(p);
        }
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
        registerSignal(
            sg,
            compileEntryProcess(sg as Record<string, unknown>, "signal", processes).fn as never,
        );
        registered.signals.add(sg.id);
        counts.signals = (counts.signals ?? 0) + 1;
    }
    for (const tr of config.triggers ?? []) {
        if (!tr?.id || registered.triggers.has(tr.id)) continue;
        // The engine calls a trigger's callback with **no arguments** — `extra` goes
        // in the registration, not the call — so the program is what finally hands
        // the options to the action.
        registerTrigger(
            tr,
            compileEntryProcess(tr as Record<string, unknown>, "trigger", processes).fn as never,
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
            // to put a list. So the ref is built here rather than read off the
            // entry: `actionRefsOf` reads a stored `actions` array, and these slots
            // hold a string.
            //
            // It used to pass a synthetic `{ handlerKey: key }` to `actionRefsOf`,
            // which worked only while that function still consulted the pre-split
            // key. Now that it reads only `actions`, that call returns nothing, the
            // `skipped` branch is taken, and every input binding is dropped with a
            // warning. The single-action shape is spelled out instead.
            const { fn, skipped } = compileProcess([{ key, options: undefined }], "behavior");
            if (typeof fn === "function" && !skipped.length) entry[slot] = fn as never;
            else console.warn(`${LOG} input binding ${b.id}: unknown ${slot} "${key}"`);
        }
        registerInputBinding(entry as never);
        registered.inputBindings.add(b.id);
        counts.inputBindings = (counts.inputBindings ?? 0) + 1;
    }

    return counts;
}
