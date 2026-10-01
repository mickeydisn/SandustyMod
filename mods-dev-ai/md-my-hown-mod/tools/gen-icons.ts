
const ROOT = new URL("../", import.meta.url);
const ICONS_DIR = new URL("assets/icons/", ROOT);
const OUT = new URL("src/generated/icons.ts", ROOT);


function parseName(file: string): { name: string; w: number; h: number } | null {
    const stem = file.replace(/\.png$/i, "");
    const m = /^(.*)-(\d+)x(\d+)$/.exec(stem);
    if (!m) return { name: stem, w: 0, h: 0 };
    return { name: m[1], w: Number(m[2]), h: Number(m[3]) };
}

function humanize(name: string): string {
    return name
        .replace(/^icon-/, "")
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

const IMAGE_EXT = /\.(png|jpg|jpeg|gif|webp)$/i;

interface IconEntry {
    id: string;
    path: string;
    label: string;
    size: string;
    width: number;
    height: number;
}

async function main(): Promise<void> {
    const entries: IconEntry[] = [];
    const seen = new Set<string>();

    const walk = async (dir: URL, prefix: string) => {
        let iter: AsyncIterable<DirEntry>;
        try {
            iter = Deno.readDir(dir);
        } catch {
            return; 
        }
        for await (const d of iter) {
            if (d.isDirectory) {
                await walk(new URL(`${d.name}/`, dir), `${prefix}${d.name}/`);
                continue;
            }
            if (!IMAGE_EXT.test(d.name)) continue;
            const parsed = parseName(d.name);
            if (!parsed) continue;
            const rel = `${prefix}${d.name}`;
            if (seen.has(rel)) continue;
            seen.add(rel);
            entries.push({
                id: `icons:${parsed.name}`,
                path: rel,
                label: parsed.w
                    ? `${humanize(parsed.name)} — ${parsed.w}×${parsed.h}`
                    : humanize(parsed.name),
                size: `${parsed.w}x${parsed.h}`,
                width: parsed.w,
                height: parsed.h,
            });
        }
    };

    await walk(ICONS_DIR, "assets/icons/");

    
    entries.sort((a, b) => {
        const area = (e: IconEntry) => e.width * e.height;
        if (area(b) !== area(a)) return area(b) - area(a);
        return a.id.localeCompare(b.id);
    });

    const body = entries.map((e) =>
        `    { id: ${JSON.stringify(e.id)}, path: ${JSON.stringify(e.path)}, label: ${
            JSON.stringify(e.label)
        }, size: ${JSON.stringify(e.size)}, width: ${e.width}, height: ${e.height} },`
    ).join("\n");

    
    
    
    const file = `
export interface IconEntry {
    
    id: string;
    
    path: string;
    
    label: string;
    
    size: string;
    width: number;
    height: number;
}

export const ICONS: IconEntry[] = [
${body}
];


export function searchIcons(query: string): IconEntry[] {
    const q = query.trim().toLowerCase();
    if (!q) return ICONS;
    return ICONS.filter((i) =>
        i.label.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)
    );
}
`;

    await Deno.mkdir(new URL("src/generated/", ROOT), { recursive: true });
    await Deno.writeTextFile(OUT, file);
    console.log(
        `icons: ${entries.length} images → ${new URL("src/generated/icons.ts", ROOT).pathname}`,
    );
}

if (import.meta.main) {
    await main();
}
