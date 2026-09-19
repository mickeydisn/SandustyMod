# Astro Seeds — Steam Workshop Description

---

## ⚛️ What is Astro Seeds?

A small Sandustry mod that adds an **astro seed family**: a seed that matures over time in a liquid into a crystal, and powders that cluster together in water via column forces.

> **Core loop**: Drop an **Astro Seed** → it drifts and ages → crystallises in the liquid → burn the crystal with fire → get a powder.

---

## 🌟 The Elements

| Element | Density | Matter | Role | How to get it |
|---------|--------:|--------|------|---------------|
| **Astro Void Seed** | 90 | Powder | Reagent | Craft: `seed` + `void petal` |
| **Astro Seed** | 145 | Static | Seed | Craft: `void seed` + `florinol` |
| **Astro Gold Crystal** | 200 | Static | Crystal | Astro Seed maturing in **liquid gold** |
| **Astro Copper Crystal** | 0 | Static | Crystal | Astro Seed maturing in **liquid copper** |
| **Astro Water Crystal** | 0 | Static | Crystal | *(creative only)* |
| **Astro Gold Powder** | 145 | Powder | Seed | Burn `gold crystal` with fire |
| **Astro Copper Powder** | 145 | Powder | Seed | Burn `copper crystal` with fire |
| **Astro Water Powder** | 280 | Powder | Reagent | Burn `water crystal` with fire |

---

## 🔥 Contact Reactions

| Input A | Input B | Output A | Output B |
|---------|---------|----------|----------|
| `seed` | `void petal` | Astro Void Seed | — |
| Astro Void Seed | florinol | Astro Seed | — |
| Astro Gold Crystal | fire | Astro Gold Powder | fire |
| Astro Copper Crystal | fire | Astro Copper Powder | fire |
| Astro Water Crystal | fire | Astro Water Powder | fire |

---

## 💧 Seed Profiles (Worker Behaviours)

The worker simulates three distinct environments:

| File | Contents |
|------|----------|
| `elementWorker/inWater.ts` | Astro Seed, Gold Powder, Copper Powder in water |
| `elementWorker/inGold.ts` | Astro Seed, Gold/Copper Powders in liquid gold |
| `elementWorker/inCopper.ts` | Astro Seed in liquid copper |

- **In water**: Seeds grow into crystals. Gold/Copper powders exhibit column forces (they attract each other and repel their own kind).
- **In liquid gold**: Seeds crystallise into gold disk-shaped crystals.
- **In liquid copper**: Seeds crystallise into copper crystals.

---

## 🛠️ How to Use

1. **Craft an Astro Seed**: Combine `void seed` + `florinol`.
2. **Drop it into a liquid** — water, liquid gold, or liquid copper.
3. Wait for the seed to **mature and crystallise**.
4. **Burn the crystal** with fire to recover a powder.
5. Use powders in water for column-force experiments or as seeds in other liquids.

---

## 📦 Technical Notes

- **Engine**: Sandustry
- **Dependencies**: None (vanilla elements only)
- **Type**: Element mod — adds 8 new elements and their simulation profiles
- **Architecture**: Two-catalogue system (main registration + worker profiles), driven by two threads
- **License**: MIT

---

## 📝 Author & Credits

Created by **mickey** — a small Sandustry experiment in liquid-driven crystal growth and column-force powder interactions.

---

## 🐛 Known Issues

- None at this time — the mod is experimental and intentionally minimal.