/**
 * Apply stored JSON config → sandkit registration APIs (all categories).
 */
import { LOG, type ModConfig } from "../constants.ts";
import {
    api,
    registerRecipe,
    registerProcessing,
    registerContact,
    registerInteraction,
    registerTerrain,
    registerTech,
    registerUpgradeCategory,
    registerUpgrade,
    registerProjectile,
    registerEnergyType,
    registerExcavationProfile,
    registerStructureBehavior,
    registerSignal,
    registerTrigger,
    registerSprite,
} from "../packages/mysandkit.ts";
import { loadConfig } from "../config/store.ts";
import { applyAllModifiers, detachAllModifiers, resolveAnyHandler } from "../hooks/index.ts";

const registered = {
    elements: new Set<string>(),
    structures: new Set<string>(),
    items: new Set<string>(),
    recipes: new Set<string>(),
    processing: new Set<string>(),
    contacts: new Set<string>(),
    interactions: new Set<string>(),
    modifiers: new Set<string>(),
};

export function clearRegistrationCache(): void {
    for (const s of Object.values(registered)) s.clear();
    detachAllModifiers();
}

export function applyConfig(cfg?: ModConfig): void {
    const config = cfg ?? loadConfig();
    let nEl = 0, nSt = 0, nIt = 0, nRe = 0, nPr = 0, nCt = 0, nIx = 0, nMod = 0;
    let nTe = 0, nTech = 0, nUC = 0, nUp = 0, nPj = 0, nEn = 0, nEx = 0, nSb = 0, nSg = 0, nTr = 0, nSp = 0;

    // Sprites first so items/structures can reference them
    for (const sp of config.sprites ?? []) {
        if (!sp?.id || registered.sprites?.has(sp.id)) continue;
        void registerSprite(sp);
        registered.sprites = registered.sprites || new Set();
        registered.sprites.add(sp.id);
        nSp++;
    }

    for (const el of config.elements) {
        if (!el?.id || registered.elements.has(el.id)) continue;
        const res = api.elements.register(el);
        if (res !== undefined) {
            registered.elements.add(el.id);
            nEl++;
        }
    }
    for (const st of config.structures) {
        if (!st?.id || registered.structures.has(st.id)) continue;
        api.structures.register(st);
        registered.structures.add(st.id);
        nSt++;
    }
    for (const it of config.items) {
        if (!it?.id || registered.items.has(it.id)) continue;
        api.items.register(it);
        registered.items.add(it.id);
        nIt++;
    }
    for (const r of config.recipes) {
        if (!r?.id || registered.recipes.has(r.id)) continue;
        registerRecipe(r);
        registered.recipes.add(r.id);
        nRe++;
    }
    for (const p of config.processing) {
        if (!p?.id || registered.processing.has(p.id)) continue;
        registerProcessing(p);
        registered.processing.add(p.id);
        nPr++;
    }
    for (const c of config.contacts ?? []) {
        if (!c?.id || registered.contacts.has(c.id)) continue;
        registerContact(c);
        registered.contacts.add(c.id);
        nCt++;
    }
    for (const ix of config.interactions ?? []) {
        if (!ix?.id || registered.interactions.has(ix.id)) continue;
        registerInteraction(ix);
        registered.interactions.add(ix.id);
        nIx++;
    }

    nMod = applyAllModifiers(config.modifiers ?? []);
    for (const m of config.modifiers ?? []) {
        if (m?.id) registered.modifiers.add(m.id);
    }

    for (const t of config.terrains ?? []) {
        if (!t?.id || (registered as any).terrains?.has(t.id)) continue;
        registerTerrain(t);
        (registered as any).terrains = (registered as any).terrains || new Set();
        (registered as any).terrains.add(t.id);
        nTe++;
    }
    for (const t of config.techs ?? []) {
        if (!t?.id || (registered as any).techs?.has(t.id)) continue;
        registerTech(t);
        (registered as any).techs = (registered as any).techs || new Set();
        (registered as any).techs.add(t.id);
        nTech++;
    }
    for (const u of config.upgradeCategories ?? []) {
        if (!u?.id || (registered as any).upgradeCategories?.has(u.id)) continue;
        registerUpgradeCategory(u);
        (registered as any).upgradeCategories = (registered as any).upgradeCategories || new Set();
        (registered as any).upgradeCategories.add(u.id);
        nUC++;
    }
    for (const u of config.upgrades ?? []) {
        if (!u?.id || (registered as any).upgrades?.has(u.id)) continue;
        registerUpgrade(u);
        (registered as any).upgrades = (registered as any).upgrades || new Set();
        (registered as any).upgrades.add(u.id);
        nUp++;
    }
    for (const p of config.projectiles ?? []) {
        if (!p?.id || (registered as any).projectiles?.has(p.id)) continue;
        // wire getOptions from handler if present
        const key = (p as any).getOptionsKey;
        const h = resolveAnyHandler(key);
        if (h) (p as any).getOptions = h;
        registerProjectile(p);
        (registered as any).projectiles = (registered as any).projectiles || new Set();
        (registered as any).projectiles.add(p.id);
        nPj++;
    }
    for (const e of config.energyTypes ?? []) {
        if (!e?.id || (registered as any).energyTypes?.has(e.id)) continue;
        registerEnergyType(e);
        (registered as any).energyTypes = (registered as any).energyTypes || new Set();
        (registered as any).energyTypes.add(e.id);
        nEn++;
    }
    for (const e of config.excavationProfiles ?? []) {
        if (!e?.id || (registered as any).excavationProfiles?.has(e.id)) continue;
        registerExcavationProfile(e);
        (registered as any).excavationProfiles = (registered as any).excavationProfiles || new Set();
        (registered as any).excavationProfiles.add(e.id);
        nEx++;
    }
    for (const b of config.structureBehaviors ?? []) {
        if (!b?.id || (registered as any).structureBehaviors?.has(b.id)) continue;
        registerStructureBehavior(b);
        (registered as any).structureBehaviors = (registered as any).structureBehaviors || new Set();
        (registered as any).structureBehaviors.add(b.id);
        nSb++;
    }
    for (const sg of config.signals ?? []) {
        if (!sg?.id || (registered as any).signals?.has(sg.id)) continue;
        registerSignal(sg, resolveAnyHandler(sg.handlerKey) as any);
        (registered as any).signals = (registered as any).signals || new Set();
        (registered as any).signals.add(sg.id);
        nSg++;
    }
    for (const tr of config.triggers ?? []) {
        if (!tr?.id || (registered as any).triggers?.has(tr.id)) continue;
        registerTrigger(tr, resolveAnyHandler(tr.handlerKey) as any);
        (registered as any).triggers = (registered as any).triggers || new Set();
        (registered as any).triggers.add(tr.id);
        nTr++;
    }

    console.log(
        `${LOG} applied: el${nEl} st${nSt} it${nIt} re${nRe} pr${nPr} ct${nCt} ix${nIx} mod${nMod} te${nTe} tech${nTech} uc${nUC} up${nUp} pj${nPj} en${nEn} ex${nEx} sb${nSb} sg${nSg} tr${nTr} sp${nSp}`,
    );
}

export function reapplyFromStorage(): void {
    applyConfig(loadConfig());
}
