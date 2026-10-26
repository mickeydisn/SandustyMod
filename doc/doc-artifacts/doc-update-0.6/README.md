# Sandustry v0.6.0 — Modding Update Notes

**Target game version:** 0.6.0 (Update #5 — Orbital Delivery, Snow Biome, Silica Extraction)  
**Sources analysed:** `bundle.0.6.0.js`, `external-mod-runtime.0.6.0.js`  
**Date of this doc:** 2026-10-24  

Official community wiki (already labelled v0.6.0): https://sandustry.dev/  
Steam announcement: https://store.steampowered.com/news/app/2764460/view/681890829846973538  

> The base game 0.6.0 shipped first. The matching modding branch and full official API docs were stated to follow “shortly”. This document captures what is **already present and usable** in the 0.6.0 runtime for mod authors.

---

## Quick summary — what modders can use now

| Capability | Status in 0.6.0 | Notes |
|---|---|---|
| `entry` / `workerEntry` | Fully supported | Main-thread + simulation-worker scripts |
| `textureOverrides` | **Enhanced** | Static images **or** declarative animation (`frameWidth` / `frames` / `intervalMs`) |
| `provides` (selectable providers) | **New** | Competing texture packs; player picks one per `kind` |
| `configOverrides` | Supported | JSON config namespace overrides |
| `shaderOverrides` | **New** | Replaceable GLSL shader sources by shader ID |
| `worldgenEntry` | **New** | External worldgen / procgen mods |
| `map` | Supported | Custom map blueprints |
| `patches.json` | Supported | Find/replace on game JS (Steam only) |
| Content registration | Expanded | Elements, terrains, structures, matters, recipes, shared buffers, items, tech, sprites, shaders, UI |
| Events | Expanded | `mods:initialized`, `game:ready`, `game:started`, … |
| UI / React | Improved | UI overhaul intended to make custom panels easier |
| Example mod | Shipped | Sibling folder `mod-exemple/` (animated provides + configSchema + events) |

---

## Directory layout of this documentation

```
doc-update-0.6/
├── README.md                 ← this file
├── CHANGELOG-FOR-MODDERS.md  ← high-level “what’s new”
├── MANIFEST-0.6.md           ← modinfo.json fields relevant to 0.6
├── TEXTURE-OVERRIDES.md      ← static + animated overrides + providers
├── SHADER-OVERRIDES.md       ← shaderOverrides mechanics
├── WORLDGEN-ENTRY.md         ← worldgenEntry / external maps
├── EVENTS-AND-HOOKS.md       ← key lifecycle events
├── RUNTIME-DIAGNOSTICS.md    ← error codes you will see
└── SANDKIT-NAMESPACES-0.6.md ← full sandkit.api list + aliases / preferred names
```

---

## Recommended reading order

1. `CHANGELOG-FOR-MODDERS.md` — decide whether your existing mod needs changes.  
2. `MANIFEST-0.6.md` — update `modinfo.json`.  
3. `TEXTURE-OVERRIDES.md` and `SHADER-OVERRIDES.md` if you ship art or visuals.  
4. Official wiki https://sandustry.dev/ for the full sandkit surface.

---

## Compatibility notes

- `manifestVersion` and `apiVersion` remain **1**.  
- Saves from earlier versions are retrofitted; content balance may feel off if the player already finished the original ending.  
- Native patching and local mods remain **Steam-only**.  
- Many mutations stay `…WhenIdle` on the main thread; worker entries still use the direct `…AtCell` variants.

---

## Feedback / contribution

This is a community reverse-engineered snapshot derived from the shipped 0.6.0 bundles.  
Prefer the official wiki when it is updated. When in doubt, test against the live game.