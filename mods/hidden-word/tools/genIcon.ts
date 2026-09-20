/**
 * Hidden World — generates `assets/lens.png` (32×32 Ghost Lens icon).
 *
 * Pure stdlib PNG writer (zlib "stored" deflate blocks + CRC32), so the build
 * needs no dependencies. Run once via `deno task build:icon`.
 */

const SIZE = 32;

type RGBA = [number, number, number, number];

/** Pixel-art painter: returns `color` inside a predicate, transparent outside. */
function paint(fill: (x: number, y: number) => RGBA | null): Uint8Array {
    const data = new Uint8Array(SIZE * SIZE * 4);
    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            const color = fill(x, y);
            const i = (y * SIZE + x) * 4;
            data[i] = color?.[0] ?? 0;
            data[i + 1] = color?.[1] ?? 0;
            data[i + 2] = color?.[2] ?? 0;
            data[i + 3] = color?.[3] ?? 0;
        }
    }
    return data;
}

const TRANSPARENT: RGBA = [0, 0, 0, 0];
const RIM: RGBA = [156, 39, 176, 255]; // deep purple ring
const LENS: RGBA = [80, 200, 255, 255]; // pale cyan glass
const SAND: RGBA = [233, 196, 106, 255]; // a sand grain in the lens
const TERRAIN: RGBA = [90, 90, 90, 255]; // grey terrain in the lens

function inCircle(x: number, y: number, cx: number, cy: number, r: number): boolean {
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= r * r;
}

const pixels = paint((x, y) => {
    if (!inCircle(x, y, 15.5, 15.5, 14)) return TRANSPARENT;
    if (!inCircle(x, y, 15.5, 15.5, 11)) return RIM; // ring body
    // Glass: upper half lens, lower half hidden terrain, one sand grain.
    if (inCircle(x, y, 13, 19, 2)) return SAND;
    return y < 16 ? LENS : TERRAIN;
});

// ---------------------------------------------------------------------------
// Minimal PNG encoder: IHDR + IDAT (stored deflate) + IEND.
// ---------------------------------------------------------------------------

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

function crc32(bytes: Uint8Array): number {
    let c = 0xffffffff;
    for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Uint8Array): Uint8Array {
    const out = new Uint8Array(12 + body.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, body.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(body, 8);
    view.setUint32(8 + body.length, crc32(out.subarray(4, 8 + body.length)));
    return out;
}

/** zlib stream made of stored (uncompressed) deflate blocks. */
function zlibStored(raw: Uint8Array): Uint8Array {
    const header = new Uint8Array([0x78, 0x01]);
    const blocks: Uint8Array[] = [];
    for (let offset = 0; offset < raw.length; offset += 65535) {
        const slice = raw.subarray(offset, Math.min(offset + 65535, raw.length));
        const isLast = offset + 65535 >= raw.length ? 1 : 0;
        const block = new Uint8Array(5 + slice.length);
        block[0] = isLast;
        const view = new DataView(block.buffer);
        view.setUint16(1, slice.length, true);
        view.setUint16(3, ~slice.length & 0xffff, true);
        block.set(slice, 5);
        blocks.push(block);
    }
    const adler = new Uint8Array(4);
    const aView = new DataView(adler.buffer);
    let s1 = 1;
    let s2 = 0;
    for (const b of raw) {
        s1 = (s1 + b) % 65521;
        s2 = (s2 + s1) % 65521;
    }
    aView.setUint32(0, (s2 << 16) | s1);
    const parts = [header, ...blocks, adler];
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let at = 0;
    for (const part of parts) {
        out.set(part, at);
        at += part.length;
    }
    return out;
}

const ihdr = new Uint8Array(13);
const ihdrView = new DataView(ihdr.buffer);
ihdrView.setUint32(0, SIZE);
ihdrView.setUint32(4, SIZE);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA

// Raw scanlines: one filter byte (0) per row before the RGBA pixels.
const raw = new Uint8Array(SIZE * (1 + SIZE * 4));
for (let y = 0; y < SIZE; y++) {
    raw[y * (1 + SIZE * 4)] = 0;
    raw.set(pixels.subarray(y * SIZE * 4, (y + 1) * SIZE * 4), y * (1 + SIZE * 4) + 1);
}

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const chunks = [
    chunk("IHDR", ihdr),
    chunk("IDAT", zlibStored(raw)),
    chunk("IEND", new Uint8Array(0)),
];
const total = png.length + chunks.reduce((sum, part) => sum + part.length, 0);
const file = new Uint8Array(total);
file.set(png, 0);
let at = png.length;
for (const part of chunks) {
    file.set(part, at);
    at += part.length;
}

await Deno.mkdir(new URL("../assets/", import.meta.url), { recursive: true });
await Deno.writeFile(new URL("../assets/lens.png", import.meta.url), file);
console.log(`[hidden-word] wrote assets/lens.png (${file.length} bytes)`);
