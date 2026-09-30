/**
 * Build-time sprite library codegen.
 *
 * The game runtime has no filesystem access, so the bundled asset collection
 * cannot be scanned while the mod runs. Instead this script walks `assets/`
 * and writes a static manifest that the UI imports.
 *
 * The manifest is not a convenience: the panel validates a sprite's `path`
 * against it, so an asset missing from here is an entry the author cannot save.
 * That is why this walks the whole tree — the icons under `assets/icons/` are
 * the bulk of it, but structure art lives elsewhere and is just as real.
 *
 * Run via:  deno task build:sprites
 * The output is committed so `deno check` works without running the task.
 */
import { walk } from "jsr:@std/fs@1/walk";

const ROOT = new URL("..", import.meta.url);
const ASSETS = new URL("assets/", ROOT);
const OUT = new URL("src/generated/sprite-library.ts", ROOT);

/**
 * Mod-root-relative form of a walked path.
 *
 * `walk` hands back a path whose exact type has moved between releases (string,
 * then URL), so this accepts either and normalises. Written out rather than
 * imported because the obvious `@std/path/relative-path` export does not exist
 * in the pinned `@std/path@1.1.6`.
 */
function modRelative(p: string | URL): string {
    const full = (p instanceof URL ? p.pathname : p).replace(/\\/g, "/");
    const root = ROOT.pathname.replace(/\\/g, "/").replace(/\/?$/, "/");
    const i = full.indexOf(root);
    return i >= 0 ? full.slice(i + root.length) : full;
}

/** Split "icon-alien-2x2.png" → { name: "icon-alien", size: "2x2" }. */
function parseFile(file: string): { name: string; size: string } | null {
    const m = /^(.*?)-(\d+x\d+)\.png$/.exec(file);
    if (!m) return null;
    return { name: m[1], size: m[2] };
}

/** Sort "3x3" > "2x2" so the default path uses the highest-resolution asset. */
function sizeRank(size: string): number {
    const [w, h] = size.split("x").map(Number);
    return (Number.isFinite(w) ? w : 0) * 1000 + (Number.isFinite(h) ? h : 0);
}

interface Entry {
    name: string;
    /** size → mod-root-relative path. */
    paths: Record<string, string>;
    /** Pixel dimensions of the previewed PNG, filled in below. */
    previewW: number;
    previewH: number;
}

/**
 * Inline the PNG as a data URL so the panel can show the real art.
 *
 * The game runtime has no filesystem access, so the bytes have to be baked in at
 * build time — there is no way to read them back while the mod runs. Every icon
 * is a 16×16 cell, so the whole set costs ~30 KB of base64 and gives an exact
 * preview rather than a stand-in.
 */
async function previewDataUrl(file: URL, bytes?: Uint8Array): Promise<string> {
    const data = bytes ?? await Deno.readFile(file);
    let bin = "";
    for (const b of data) bin += String.fromCharCode(b);
    return `data:image/png;base64,${btoa(bin)}`;
}

/** PNG dimensions from the IHDR chunk (bytes 16..24 of the file). */
function pngSize(bytes: Uint8Array): { w: number; h: number } {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { w: view.getUint32(16), h: view.getUint32(20) };
}

const entries = new Map<string, Entry>();

// Walk the WHOLE `assets/` tree, not just `assets/icons/`.
//
// The panel's sprite `path` field is `kind: "library"`, validated with
//     return known ? null : "not a bundled asset — pick one from the list";
// so anything missing from this manifest is a sprite the author cannot save.
// Scanning only `assets/icons/` meant the mod's own structure art under
// `assets/artefact/` (`generator.png`, `material-sand.png`, …) failed that
// check: the entries were valid, the game ran them, and pressing Save was
// refused with "not a bundled asset" for a file shipped inside the mod.
for await (const item of walk(ASSETS, { exts: [".png"] })) {
    if (!item.isFile) continue;
    const file = item.name;
    const rel = modRelative(item.path);
    const parsed = parseFile(file);
    if (!parsed) {
        // Not the `name-NxM.png` icon convention — a plain asset (structure art,
        // sprite sheet). It is still a real bundled asset, so it is listed; the
        // name is the bare basename and the "size" is its real pixel size, read
        // below. `parseFile` is what used to make these invisible.
        const bytes = await Deno.readFile(new URL(rel, ROOT));
        const { w, h } = pngSize(bytes);
        const name = file.replace(/\.png$/i, "");
        const key = entries.has(name) ? rel.replace(/^assets\/|\.png$/gi, "") : name;
        entries.set(key, {
            name: key,
            paths: { [`${w}x${h}`]: rel },
            previewW: w,
            previewH: h,
        });
        continue;
    }
    const prev = entries.get(parsed.name);
    if (prev) {
        prev.paths[parsed.size] = rel;
    } else {
        entries.set(parsed.name, { name: parsed.name, paths: { [parsed.size]: rel } });
    }
}

const list = [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));

// Fill in the previewed PNG's real pixel dimensions and inline it as a data URL.
// (previewDataUrl is async, so this must happen before the sync template build —
// JSON.stringify on a Promise would silently emit `{}`.)
for (const e of list) {
    const sizes = Object.keys(e.paths).sort((a, b) => sizeRank(b) - sizeRank(a));
    const file = new URL(e.paths[sizes[0]], ROOT);
    const bytes = await Deno.readFile(file);
    const { w, h } = pngSize(bytes);
    e.previewW = w;
    e.previewH = h;
    e.preview = await previewDataUrl(file, bytes);
}

const body = list
    .map((e) => {
        const sizes = Object.keys(e.paths).sort((a, b) => sizeRank(b) - sizeRank(a));
        const path = e.paths[sizes[0]];
        return `    { name: ${JSON.stringify(e.name)}, path: ${JSON.stringify(path)}, sizes: ${
            JSON.stringify(sizes)
        }, preview: ${
            JSON.stringify(e.preview)
        }, previewW: ${e.previewW}, previewH: ${e.previewH} },`;
    })
    .join("\n");

const file = `/**
 * AUTO-GENERATED by tools/gen-sprite-library.ts — do not edit by hand.
 * Run \`deno task build:sprites\` after adding any PNG under assets/.
 *
 * Every entry is a real PNG shipped inside this mod, so a sprite can be
 * registered with sprites.loadFromMod(<graphicsKey>, <path>) without the user
 * having to know the on-disk filename — and, more importantly, so the panel's
 * \`kind: "library"\` check can confirm the path resolves to something real.
 * \`path\` is the highest-resolution
 * variant; \`sizes\` lists the cell sizes that exist for this icon.
 */
export interface LibraryIcon {
    /** Base name, e.g. "icon-alien" (from icon-alien-2x2.png). */
    name: string;
    /** Mod-root-relative path passed straight to loadFromMod (largest variant). */
    path: string;
    /** Available cell sizes, largest first, e.g. ["3x3", "2x2", "1x1"]. */
    sizes: string[];
    /**
     * The PNG inlined as a data URL, so the panel can render the real art. The
     * runtime has no filesystem access, so this is the only way to see an icon.
     */
    preview: string;
    /** Pixel size of the previewed PNG (16x16 for a 1x1 icon). */
    previewW: number;
    previewH: number;
}

export const LIBRARY_ICONS: LibraryIcon[] = [
${body}
];

/** Case-insensitive substring search used by the sprite picker. */
export function searchLibraryIcons(query: string): LibraryIcon[] {
    const q = query.trim().toLowerCase();
    if (!q) return LIBRARY_ICONS;
    return LIBRARY_ICONS.filter((i) => i.name.toLowerCase().includes(q));
}
`;

await Deno.mkdir(new URL("src/generated/", ROOT), { recursive: true });
await Deno.writeTextFile(OUT, file);
console.log(
    `sprite-library: ${list.length} bundled assets → ${
        new URL("src/generated/sprite-library.ts", ROOT).pathname
    }`,
);
