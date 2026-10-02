import { LOG, type ModConfig } from "../constants.ts";
import type { CollectionKey } from "../config/store.ts";
import { api } from "../packages/mysandkit.ts";
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
import { applyAllModifiers, compileProcess } from "../handler/index.ts";
import { compileEntryProcess, type ProcessRegistry } from "../handler/custom-process/index.ts";
import {
    compileProjectile,
    PROJECTILE_OPTION_STORE_KEY,
    projectileOptionOf,
} from "../handler/projectile-option/index.ts";
import { engineTechOf, techUnlockStructureIds } from "../ui/tech-link.ts";
import { type Counted, registerEach, registered } from "./registry.ts";
import { joinedNetworkNames, reportEnergyNetworks } from "./custom/energy-network.ts";
import { installPlacementLimits } from "./custom/placement-limit.ts";

type Step = (config: ModConfig, processes: ProcessRegistry) => Counted;

const PLAIN = [
    "sprites",
    "items",
    "recipes",
    "contacts",
    "interactions",
    "upgradeCategories",
    "upgrades",
    "energyTypes",
    "excavationProfiles",
    "structureBehaviors",
    "placementConfigs",
] as const satisfies readonly CollectionKey[];

const PLAIN_REGISTER: Record<(typeof PLAIN)[number], (entry: never) => void> = {
    sprites: (sp) => void registerSprite(sp),
    items: (it) => api.items.register(it),
    recipes: (r) => registerRecipe(r),
    contacts: (x) => registerContact(x),
    interactions: (ix) => registerInteraction(ix),
    upgradeCategories: (u) => registerUpgradeCategory(u),
    upgrades: (u) => registerUpgrade(u),
    energyTypes: (e) => registerEnergyType(e),
    excavationProfiles: (e) => registerExcavationProfile(e),
    structureBehaviors: (b) => registerStructureBehavior(b),
    placementConfigs: (p) => registerPlacementConfig(p),
};

const STEPS: readonly Step[] = [
    (c, p) =>
        registerEach(c.processing, "processing", (entry) => {
            const raw = entry as Record<string, unknown>;
            if (typeof raw.process === "function") {
                registerProcessing(entry);
                return;
            }
            const id = entry.id ?? "?";
            const compiled = compileEntryProcess(raw, "processing", p);
            if (compiled.source.kind === "process" && compiled.expanded.length) {
                console.log(
                    `${LOG} processing ${id}: program from ${compiled.expanded.join(" → ")}`,
                );
            }
            if (compiled.skipped.length) {
                console.warn(
                    `${LOG} processing ${id}: unknown action ${compiled.skipped.join(", ")}`,
                );
            }
            if (compiled.unknownOptions.length) {
                console.warn(
                    `${LOG} processing ${id}: option no action declares ` +
                        `${compiled.unknownOptions.join(", ")} — the step runs on defaults`,
                );
            }
            registerProcessing({ ...raw, process: compiled.fn } as never);
        }),

    (c) => {
        const n = applyAllModifiers(c.modifiers ?? []);
        for (const m of c.modifiers ?? []) {
            if (m?.id) registered.modifiers.add(m.id);
        }
        return ["modifiers", n];
    },

    (c) =>
        registerEach(c.techs, "techs", (t) => {
            const ids = techUnlockStructureIds(t.id, c);
            registerTech(
                ids.length ? { ...t, unlocks: { ...(t.unlocks ?? {}), structures: ids } } : t,
            );
        }),

    (c) =>
        registerEach(c.unlockNodes, "techs", (n) => {
            if (n.kind !== "tech" || n.techId) return false;
            const tech = engineTechOf(n, c);
            if (!tech) return false;
            registerTech(tech);
        }),

    (c) =>
        registerEach(c.projectiles, "projectiles", (entry) => {
            const raw = entry as Record<string, unknown>;
            const id = entry.id ?? "?";
            const { ref, problem } = projectileOptionOf(raw);
            if (problem) console.warn(`${LOG} projectile ${id}: ${problem}`);
            if (typeof raw.getOptions === "function") {
                registerProjectile(entry);
                return;
            }
            const compiled = compileProjectile(
                ref,
                (f) => console.warn(`${LOG} projectile ${id} option ${f.key} failed`, f.error),
            );
            if (compiled.problem) console.warn(`${LOG} projectile ${id}: ${compiled.problem}`);
            registerProjectile({
                ...raw,
                ...(ref ? { [PROJECTILE_OPTION_STORE_KEY]: ref } : {}),
                getOptions: compiled.getOptions,
            } as never);
        }),

    (c) => {
        reportEnergyNetworks(c, joinedNetworkNames(c));
        return ["energyNetworks", 0];
    },
    (c) => ["placementLimits", installPlacementLimits(c)],

    (c, p) =>
        registerEach(c.signals, "signals", (sg) =>
            registerSignal(
                sg,
                compileEntryProcess(sg as Record<string, unknown>, "signal", p).fn as never,
            )),

    (c, p) =>
        registerEach(c.triggers, "triggers", (tr) =>
            registerTrigger(
                tr,
                compileEntryProcess(tr as Record<string, unknown>, "trigger", p).fn as never,
            )),

    (c) =>
        registerEach(c.inputBindings, "inputBindings", (b) => {
            const entry = { ...b } as Record<string, unknown>;
            for (const slot of ["onDownKey", "onUpKey"] as const) {
                const key = b[slot];
                if (!key) continue;
                const { fn, skipped } = compileProcess([{ key, options: undefined }], "behavior");
                if (typeof fn === "function" && !skipped.length) entry[slot] = fn as never;
                else console.warn(`${LOG} input binding ${b.id}: unknown ${slot} "${key}"`);
            }
            registerInputBinding(entry as never);
        }),
];

export function registerTheRest(
    config: ModConfig,
    processes: ProcessRegistry,
): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const category of PLAIN) {
        const [key, n] = registerEach(
            config[category] as never[],
            category,
            PLAIN_REGISTER[category],
        );
        counts[key] = n;
    }

    for (const step of STEPS) {
        const [category, n] = step(config, processes);
        counts[category] = (counts[category] ?? 0) + n;
    }
    return counts;
}
