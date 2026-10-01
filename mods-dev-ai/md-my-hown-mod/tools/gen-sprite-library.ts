
import { walk } from "jsr:@std/fs@1/walk";

const ROOT = new URL("..", import.meta.url);
const ASSETS = new URL("assets/", ROOT);
const OUT = new URL("src/generated/sprite-library.ts", ROOT);


function modRelative(p: string | URL): string {
    const full = (p instanceof URL ? p.pathname : p).replace(/\\/g, "/");
    const root = ROOT.pathname.replace(/\\/g, "/").replace(/\/?$/, "/");
    const i = full.indexOf(root);
    return i >= 0 ? full.slice(i + root.length) : full;
}


function parseFile(file: string): { name: string; size: string } | null {
    const m = /^(.*?)-(\d+x\d+)\.png$/.exec(file);
    if (!m) return null;
    return { name: m[1], size: m[2] };
}


function sizeRank(size: string): number {
    const [w, h] = size.split("x").map(Number);
    return (Number.isFinite(w) ? w : 0) * 1000 + (Number.isFinite(h) ? h : 0);
}

interface Entry {
    name: string;
    
    paths: Record<string, string>;
    
    previewW: number;
    previewH: number;
}


async function previewDataUrl(file: URL, bytes?: Uint8Array): Promise<string> {
    const data = bytes ?? await Deno.readFile(file);
    let bin = "";
    for (const b of data) bin += String.fromCharCode(b);
    return `data:image/png;base64,${btoa(bin)}`;
}


function pngSize(bytes: Uint8Array): { w: number; h: number } {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { w: view.getUint32(16), h: view.getUint32(20) };
}

const entries = new Map<string, Entry>();










for await (const item of walk(ASSETS, { exts: [".png"] })) {
    if (!item.isFile) continue;
    const file = item.name;
    const rel = modRelative(item.path);
    const parsed = parseFile(file);
    if (!parsed) {
        
        
        
        
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

const file = `
export interface LibraryIcon {
    
    name: string;
    
    path: string;
    
    sizes: string[];
    
    preview: string;
    
    previewW: number;
    previewH: number;
}

export const LIBRARY_ICONS: LibraryIcon[] = [
${body}
];


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
