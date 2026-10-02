import { LOG, type ModConfig } from "../constants.ts";
import {
    registerContact,
    registerEnergyType,
    registerExcavationProfile,
    registerInputBinding,
    registerInteraction,
    registerPlacementConfig,
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
} from "../packages/registrations.ts";
import { registerItems } from "./core/items.ts";
import { mayRegister, registered } from "./registry.ts";
import { joinedNetworkNames, reportEnergyNetworks } from "./custom/energy-network.ts";
import { installPlacementLimits } from "./custom/placement-limit.ts";
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

    const processes = new ProcessRegistry(config.processes ?? []);

    setProcessRegistry(processes);

    for (const sp of config.sprites ?? []) {
        if (!sp?.id || registered.sprites.has(sp.id)) continue;
        void registerSprite(sp);
        registered.sprites.add(sp.id);
        counts.sprites = (counts.sprites ?? 0) + 1;
    }

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

        const entry = p as Record<string, unknown>;
        if (typeof entry.process !== "function") {
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
                console.warn(
                    `${LOG} processing ${p.id}: option no action declares ` +
                        `${compiled.unknownOptions.join(", ")} — the step runs on defaults`,
                );
            }

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

        const ids = techUnlockStructureIds(t.id, config);
        registerTech(ids.length ? { ...t, unlocks: { ...(t.unlocks ?? {}), structures: ids } } : t);
        registered.techs.add(t.id);
        counts.techs = (counts.techs ?? 0) + 1;
    }

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

    reportEnergyNetworks(config, joinedNetworkNames(config));

    counts.placementLimits = installPlacementLimits(config);

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

    for (const p of config.placementConfigs ?? []) {
        if (!p?.id || registered.placementConfigs.has(p.id)) continue;
        registerPlacementConfig(p);

        registered.placementConfigs.add(p.id);
        counts.placementConfigs = (counts.placementConfigs ?? 0) + 1;
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

        registerTrigger(
            tr,
            compileEntryProcess(tr as Record<string, unknown>, "trigger", processes).fn as never,
        );
        registered.triggers.add(tr.id);
        counts.triggers = (counts.triggers ?? 0) + 1;
    }

    for (const b of config.inputBindings ?? []) {
        if (!b?.id || registered.inputBindings.has(b.id)) continue;
        const entry = { ...b } as Record<string, unknown>;
        for (const slot of ["onDownKey", "onUpKey"] as const) {
            const key = b[slot];
            if (!key) continue;

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
