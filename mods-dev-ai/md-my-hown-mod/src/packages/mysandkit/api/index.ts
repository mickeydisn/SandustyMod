import { core } from "./core.ts";
import { storage } from "./storage.ts";
import { settings } from "./settings.ts";
import { state } from "./state.ts";
import { rendering } from "./rendering.ts";
import { elements } from "./elements.ts";
import { grid } from "./grid.ts";
import { player } from "./player.ts";
import { structures } from "./structures.ts";
import { items } from "./items.ts";
import { tech } from "./tech.ts";
import { terrains } from "./terrains.ts";
import { upgrades } from "./upgrades.ts";
import { processing } from "./processing.ts";
import { reactions } from "./reactions.ts";
import { ui } from "./ui.ts";
import { hooks } from "./hooks.ts";
import { events } from "./events.ts";
import { i18n } from "./i18n.ts";
import { assets } from "./assets.ts";
import { sprites } from "./sprites.ts";
import { input } from "./input.ts";
import { signals } from "./signals.ts";
import { energy } from "./energy.ts";
import { effects } from "./effects.ts";
import { projectiles } from "./projectiles.ts";
import { random } from "./random.ts";
import { excavation } from "./excavation.ts";
import { triggers } from "./triggers.ts";
import { structureBehaviors } from "./structure-behaviors.ts";

export const api = {
    get raw() {
        return core.raw;
    },
    get host() {
        return core.host;
    },
    get enums() {
        return core.enums;
    },
    get react() {
        return core.react;
    },
    get mods() {
        return core.mods;
    },
    toast: core.toast,
    storage,
    settings,
    state,
    rendering,
    elements,
    grid,
    player,
    structures,
    items,
    tech,
    terrains,
    upgrades,
    processing,
    reactions,
    ui,
    hooks,
    events,
    i18n,
    assets,
    sprites,
    input,
    signals,
    energy,
    effects,
    projectiles,
    random,
    excavation,
    triggers,
    structureBehaviors,
};
