/**
 * Scan assets/*.png (and assets2/*.png) and emit src/catalogue.generated.ts
 * Run: node tools/generate-catalogue.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const ASSET_DIRS = ["assets", "assets2"];
const PX = 16;

const WALL_HINTS = [
    "tile-wall",
    "tile-grating",
    "clock",
    "sign",
    "gauge",
    "billboard",
    "navlight",
    "valve",
    "level-bar",
    "warning-stripe",
    "wide-console-3x1",
    "vent",
    "light",
    "lamp",
    "window",
    "hud",
    "panel-wall",
];

/**
 * Derive a clean category name (no size suffix) from a base id.
 * The sprite's size is captured separately in each item's `tags` field
 * (e.g. "1x1", "3x2") so categories stay readable in the picker while the
 * size filter is handled by tags.
 */
function categoryFor(id) {
    if (id.startsWith("char-")) return "char";
    if (id.startsWith("icon-arrow-") || id.startsWith("icon-cheveron")) return "arraw";
    if (id.startsWith("icon-")) return "icon";
    if (id.startsWith("garden-")) return "garden";
    if (id.startsWith("home-")) return "home";
    if (id.startsWith("ind-") || id.startsWith("logi-")) return "indus";
    if (id.startsWith("wide-")) return "wide";
    if (id.startsWith("tile")) return "walls";
    if (id.startsWith("space-") || id.includes("habitat") || id.includes("airlock")) return "space";

    return id.split("-")[0];
}

function alignFor(id) {
    const lower = id.toLowerCase();
    return WALL_HINTS.some((hint) => lower.includes(hint)) ? "wall" : "floor";
}

function labelFor(id) {
    return id
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

/** Parse a filename into its base id and cell dimensions, e.g. "home-bed-3x2.png" -> { baseId: "home-bed", cellsW: 3, cellsH: 2 }. */
function parseFile(file, relDir) {
    const stem = file.replace(/\.png$/i, "");
    const match = file.match(/^(.+)-(\d+)x(\d+)\.png$/i);
    const cellsW = match ? Number(match[2]) : 1;
    const cellsH = match ? Number(match[3]) : 1;
    return {
        baseId: stem,
        cellsW,
        cellsH,
        file,
        relDir,
        path: relDir ? `./${relDir}/${file}` : `./${file}`,
    };
}

// Recursively walk an asset directory and return every PNG with its path
// relative to the mod root (e.g. "assets/walls/metal/tile-wall.png").
function walkPngs(dirPath, relBase = "") {
    const out = [];
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            out.push(...walkPngs(path.join(dirPath, entry.name), rel));
        } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) {
            out.push({ file: entry.name, relDir: relBase });
        }
    }
    return out;
}

// Gather every PNG across all asset directories (subdirectories included),
// keeping track of the relative directory so we can emit the full path and
// use subdirectory names as tags.
const parsedFiles = ASSET_DIRS.flatMap((dir) => {
    const dirPath = path.join(root, dir);
    return walkPngs(dirPath).map((p) => parseFile(p.file, p.relDir ? `${dir}/${p.relDir}` : dir));
});

// Many objects ship multiple cell-sizes (e.g. home-bed-2x2 / home-bed-3x2 /
// home-bed-3x3). Those share the same base id, which would collapse them
// into a single structure type and break per-variant selection in the
// picker. Count base ids and suffix the duplicates with their size so every
// sprite stays independently selectable.
const baseCounts = new Map();
for (const p of parsedFiles) {
    baseCounts.set(p.baseId, (baseCounts.get(p.baseId) ?? 0) + 1);
}

const items = parsedFiles
    .map((p) => {
        const isDuplicate = baseCounts.get(p.baseId) > 1;
        const id = isDuplicate ? `${p.baseId}-${p.cellsW}x${p.cellsH}` : p.baseId;
        return {
            id,
            label: labelFor(id),
            category: categoryFor(p.baseId),
            width: p.cellsW * PX,
            height: p.cellsH * PX,
            filePath: p.path.slice(2),
            align: alignFor(p.baseId),
            // Kept separate: "tags" = directory names, "sizes" = WxH from the
            // filename (e.g. "home-bed-3x2.png" -> sizes ["3x2"]).
            tags: p.relDir ? p.relDir.split("/").slice(1) : [],
            sizes: [`${p.cellsW}x${p.cellsH}`],
        };
    })
    .sort((a, b) => a.category.localeCompare(b.category) || a.label.localeCompare(b.label));

const categoryIds = [...new Set(items.map((i) => i.category))].sort();
const categories = categoryIds.map((id) => ({
    id,
    label: id.charAt(0).toUpperCase() + id.slice(1),
}));

// The catalogue always needs an "icons" menu entry; reuse whichever asset
// directory actually contains char-A-1x1.png so the path stays accurate.
const menuSource = parsedFiles.find((p) => p.baseId === "char-A-1x1");
const menu = {
    id: "icons",
    label: "Icons",
    category: "glyphs",
    width: 16,
    height: 16,
    filePath: menuSource ? menuSource.path : `${ASSET_DIRS[0]}/char-A-1x1.png`,
    align: "wall",
};

if (!items.some((i) => i.id === menu.id)) {
    items.unshift(menu);
}

const out = `/** AUTO-GENERATED by tools/generate-catalogue.mjs — do not edit */
import type { CatalogueCategory, CatalogueItem } from "@sandmd/catalogue";

export const ICON_CATEGORIES: CatalogueCategory[] = ${JSON.stringify(categories, null, 2)};

export const ICON_ITEMS: CatalogueItem[] = ${
    JSON.stringify(
        items.map(({ id, label, category, width, height, filePath, align, tags, sizes }) => ({
            id,
            label,
            category,
            width,
            height,
            filePath,
            align,
            tags,
            sizes,
            description: "Decorative. No collision.",
        })),
        null,
        2,
    )
};

export const ICON_FILES: { id: string; filePath: string }[] = ${
    JSON.stringify(
        items.map(({ id, filePath }) => ({ id, filePath })),
        null,
        2,
    )
};
`;

fs.writeFileSync(path.join(root, "src", "catalogue.generated.ts"), out, "utf8");
console.log(`Wrote ${items.length} items in ${categories.length} categories`);
