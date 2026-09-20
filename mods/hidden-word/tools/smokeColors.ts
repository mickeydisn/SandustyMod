/**
 * Smoke test for the terrain-colour mapping (dev only, not part of the mod).
 *
 * Stubs `globalThis.sandkit` with terrain definitions shaped like the engine's
 * own (`metaColor` packed 0xRRGGBB, `colorHSL`, plus `api.i18n.t`), then imports
 * `render.ts` and checks the resolved ghost palette against
 * `doc/docs_tech/COLOR-CATALOG.md` § "Terrain metadata colors".
 *
 * Run: deno run --allow-read mods/hidden-word/tools/smokeColors.ts
 */

/** Catalog metaColors: Stone `8421504` → #808080, Dirt `9593894` → #926426. */
const TERRAIN_COLORS: Record<string, number> = {
    stone: 8421504,
    dirt: 9593894,
};
/** Renderer `colorHSL` fallbacks from the catalog (Stone is `0, 0, 66`). */
const TERRAIN_HSL: Record<string, [number, number, number]> = {
    stone: [0, 0, 66],
};
const TERRAIN_NAMES: Record<string, string> = {
    stone: "Stone",
    dirt: "Dirt",
};
const TERRAIN_TYPES: Record<string, number> = { stone: 1, dirt: 2 };

/** Minimal engine stub: terrain id → type → definition (+ i18n names). */
function stubEngine(mode: "metaColor" | "colorHSL" | "i18nOnly" | "none"): void {
    const terrains = mode === "none" ? {} : {
        getTypeById: (id: string) => TERRAIN_TYPES[id] ?? null,
        getDefinitionByType: (type: number) => {
            const id = Object.keys(TERRAIN_TYPES).find((k) => TERRAIN_TYPES[k] === type) ?? "";
            if (mode === "metaColor") return { metaColor: TERRAIN_COLORS[id] };
            if (mode === "colorHSL") return { colorHSL: TERRAIN_HSL[id] };
            return {};
        },
    };
    (globalThis as unknown as { sandkit: unknown }).sandkit = {
        api: {
            terrains,
            i18n: { t: (key: string) => TERRAIN_NAMES[key.split("|")[1] ?? ""] ?? key },
        },
        state: {},
        react: {},
    };
}

/** Sweep the module fresh each time so its internal palette cache is empty. */
async function paletteWith(mode: Parameters<typeof stubEngine>[0], tag: string) {
    stubEngine(mode);
    const mod = await import(`../src/render.ts?${tag}`);
    return mod.ghostPalette() as {
        code: number;
        terrain: string | null;
        codeLabel: string;
        label: string;
        hex: string;
        alpha: number;
        source: string;
    }[];
}

function report(name: string, mode: Parameters<typeof stubEngine>[0]) {
    const entries = await paletteWith(mode, name);
    console.log(`${name}:`);
    for (const entry of entries) {
        const painted = entry.alpha === 0 ? "transparent" : `${entry.hex} (${entry.source})`;
        console.log(
            `  ${entry.codeLabel.padEnd(7)} → terrain=${entry.terrain ?? "—"} ${painted}  ${entry.label}`,
        );
    }
    return entries;
}

// 1) Engine metaColor wins — the catalog's own values.
const meta = await report("metaColor", "metaColor");
console.log("  mapping sky/tunnel transparent:", meta[0]!.alpha === 0 && meta[2]!.alpha === 0);
console.log("  rock=stone #808080:", meta[1]!.hex === "#808080" && meta[1]!.terrain === "stone");
console.log("  cave=dirt  #926426:", meta[3]!.hex === "#926426" && meta[3]!.terrain === "dirt");
console.log("  names from i18n:", meta[1]!.label === "Stone (stone)" && meta[3]!.label === "Dirt (dirt)");

// 2) No metaColor → the renderer's colorHSL is used instead.
const hsl = await report("colorHSL", "colorHSL");
console.log("  stone falls back to colorHSL:", hsl[1]!.hex === "#a8a8a8" && hsl[1]!.source === "engine colorHSL");

// 3) No definition colour → the catalog fallback keeps the map readable.
const fallback = await report("fallback", "i18nOnly");
console.log(
    "  catalog fallback colors:",
    fallback[1]!.hex === "#808080" && fallback[3]!.hex === "#926426" &&
        fallback[1]!.source === "catalog fallback",
);

// 4) No terrain API at all → still the catalog fallback (never throws).
const none = await report("no terrain API", "none");
console.log(
    "  survives a missing terrain API:",
    none[1]!.hex === "#808080" && none[3]!.hex === "#926426",
);
