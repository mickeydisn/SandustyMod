/**
 * sprite-editor / engine — pure pixel logic.
 *
 * No DOM, no React, no sandkit: everything works on a `PixelDoc`
 * (RGBA bytes) so it can be unit-tested in plain Node and reused anywhere.
 * Ported from the "Grid Editor" (pixel-editor.html), reduced to ONE sprite.
 *
 * A sprite is treated as a horizontal strip of CELL×CELL tiles (= frames of a
 * spritesheet), exactly like the original editor.
 */

/** Tile / frame width in pixels. */
export const CELL = 16;
/** Undo depth (same as the original editor). */
export const UNDO_LIMIT = 60;

export type Rgba = [number, number, number, number];

export interface PixelDoc {
    width: number;
    height: number;
    /** RGBA, row-major, length = width*height*4 */
    data: Uint8ClampedArray;
}

export interface Snapshot {
    width: number;
    height: number;
    data: Uint8ClampedArray;
}

// ── colour helpers ───────────────────────────────────────────────────────

export function rgbToHex(r: number, g: number, b: number): string {
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const s = hex.replace("#", "");
    return {
        r: parseInt(s.slice(0, 2), 16) || 0,
        g: parseInt(s.slice(2, 4), 16) || 0,
        b: parseInt(s.slice(4, 6), 16) || 0,
    };
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
    const { r, g, b } = hexToRgb(hex);
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
        else if (max === gn) h = (bn - rn) / d + 2;
        else h = (rn - gn) / d + 4;
        h *= 60;
    }
    return { h, s, l };
}

// ── document ─────────────────────────────────────────────────────────────

export function createDoc(width: number, height: number): PixelDoc {
    const w = Math.max(1, Math.floor(width)), h = Math.max(1, Math.floor(height));
    return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
}

export function docFromRgba(width: number, height: number, data: ArrayLike<number>): PixelDoc {
    const d = createDoc(width, height);
    d.data.set(data as ArrayLike<number> as Uint8ClampedArray);
    return d;
}

export function cloneDoc(d: PixelDoc): PixelDoc {
    return { width: d.width, height: d.height, data: new Uint8ClampedArray(d.data) };
}

export function snapshotOf(d: PixelDoc): Snapshot {
    return { width: d.width, height: d.height, data: new Uint8ClampedArray(d.data) };
}

export function frameCount(d: PixelDoc): number {
    return Math.max(1, Math.ceil(d.width / CELL));
}

export function inBounds(d: PixelDoc, x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < d.width && y < d.height;
}

export function getPixel(d: PixelDoc, x: number, y: number): Rgba {
    const i = (y * d.width + x) * 4;
    return [d.data[i], d.data[i + 1], d.data[i + 2], d.data[i + 3]];
}

export function setPixel(
    d: PixelDoc,
    x: number,
    y: number,
    r: number,
    g: number,
    b: number,
    a: number,
): void {
    if (!inBounds(d, x, y)) return;
    const i = (y * d.width + x) * 4;
    d.data[i] = r;
    d.data[i + 1] = g;
    d.data[i + 2] = b;
    d.data[i + 3] = a;
}

// ── drawing primitives ───────────────────────────────────────────────────

/** Bresenham — no gaps when dragging fast. */
export function lineCells(x0: number, y0: number, x1: number, y1: number): Array<[number, number]> {
    const pts: Array<[number, number]> = [];
    x0 = Math.floor(x0);
    y0 = Math.floor(y0);
    x1 = Math.floor(x1);
    y1 = Math.floor(y1);
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x1 >= x0 ? 1 : -1, sy = y1 >= y0 ? 1 : -1;
    let x = x0, y = y0;
    if (dx >= dy) {
        let err = dx / 2;
        for (let i = 0; i <= dx; i++) {
            pts.push([x, y]);
            err -= dy;
            if (err < 0) {
                y += sy;
                err += dx;
            }
            x += sx;
        }
    } else {
        let err = dy / 2;
        for (let i = 0; i <= dy; i++) {
            pts.push([x, y]);
            err -= dx;
            if (err < 0) {
                x += sx;
                err += dy;
            }
            y += sy;
        }
    }
    return pts;
}

export function paintLine(
    d: PixelDoc,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    c: Rgba,
): void {
    for (const [x, y] of lineCells(x0, y0, x1, y1)) setPixel(d, x, y, c[0], c[1], c[2], c[3]);
}

/** 4-way flood fill on exact RGBA match. Returns false when nothing changed. */
export function floodFill(d: PixelDoc, lx: number, ly: number, c: Rgba): boolean {
    if (!inBounds(d, lx, ly)) return false;
    const t = getPixel(d, lx, ly);
    if (t[0] === c[0] && t[1] === c[1] && t[2] === c[2] && t[3] === c[3]) return false;
    const w = d.width, h = d.height;
    const stack: Array<[number, number]> = [[lx, ly]];
    const seen = new Uint8Array(w * h);
    while (stack.length) {
        const [x, y] = stack.pop()!;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const idx = y * w + x;
        if (seen[idx]) continue;
        const p = getPixel(d, x, y);
        if (p[0] !== t[0] || p[1] !== t[1] || p[2] !== t[2] || p[3] !== t[3]) continue;
        seen[idx] = 1;
        setPixel(d, x, y, c[0], c[1], c[2], c[3]);
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    return true;
}

export function drawRect(
    d: PixelDoc,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    filled: boolean,
    c: Rgba,
): void {
    const xa = Math.min(x0, x1),
        xb = Math.max(x0, x1),
        ya = Math.min(y0, y1),
        yb = Math.max(y0, y1);
    for (let y = ya; y <= yb; y++) {
        for (let x = xa; x <= xb; x++) {
            if (filled || x === xa || x === xb || y === ya || y === yb) {
                setPixel(d, x, y, c[0], c[1], c[2], c[3]);
            }
        }
    }
}

/**
 * Square-tool end point, clamped to the sprite and (optionally) forced 1:1.
 * (x0,y0) = drag start, (lx,ly) = current pixel.
 */
export function constrainRectEnd(
    d: PixelDoc,
    x0: number,
    y0: number,
    lx: number,
    ly: number,
    lockSquare: boolean,
): [number, number] {
    lx = Math.max(0, Math.min(d.width - 1, lx));
    ly = Math.max(0, Math.min(d.height - 1, ly));
    if (lockSquare) {
        const sx = lx >= x0 ? 1 : -1, sy = ly >= y0 ? 1 : -1;
        let size = Math.max(Math.abs(lx - x0), Math.abs(ly - y0));
        size = Math.min(size, sx > 0 ? d.width - 1 - x0 : x0, sy > 0 ? d.height - 1 - y0 : y0);
        lx = x0 + sx * size;
        ly = y0 + sy * size;
    }
    return [lx, ly];
}

// ── tile operations (return NEW docs when the size changes) ──────────────

/**
 * Insert a new CELL-wide tile column at pixel boundary `bx`.
 * The new tile is a copy of the tile on its left (transparent at the far left).
 */
export function insertTile(d: PixelDoc, bx: number): PixelDoc {
    const W = d.width, H = d.height, nW = W + CELL;
    bx = Math.max(0, Math.min(W, bx));
    const out = new Uint8ClampedArray(nW * H * 4);
    const srcStart = Math.max(0, bx - CELL);
    const srcW = bx - srcStart;
    for (let y = 0; y < H; y++) {
        const o = y * W * 4, n = y * nW * 4;
        out.set(d.data.subarray(o, o + bx * 4), n);
        for (let i = 0; i < Math.min(srcW, CELL); i++) {
            const s = o + (srcStart + i) * 4, t = n + (bx + i) * 4;
            out[t] = d.data[s];
            out[t + 1] = d.data[s + 1];
            out[t + 2] = d.data[s + 2];
            out[t + 3] = d.data[s + 3];
        }
        out.set(d.data.subarray(o + bx * 4, o + W * 4), n + (bx + CELL) * 4);
    }
    return { width: nW, height: H, data: out };
}

/** Delete tile column `col`; returns null when it is the last tile. */
export function removeTile(d: PixelDoc, col: number): PixelDoc | null {
    const W = d.width, H = d.height;
    const x0 = col * CELL, x1 = Math.min(x0 + CELL, W);
    const nW = W - (x1 - x0);
    if (x0 >= W || nW <= 0) return null;
    const out = new Uint8ClampedArray(nW * H * 4);
    for (let y = 0; y < H; y++) {
        const o = y * W * 4, n = y * nW * 4;
        out.set(d.data.subarray(o, o + x0 * 4), n);
        out.set(d.data.subarray(o + x1 * 4, o + W * 4), n + x0 * 4);
    }
    return { width: nW, height: H, data: out };
}

/** Read one CELL×CELL tile (transparent outside the sprite). */
export function extractTile(d: PixelDoc, cx: number, cy: number): Uint8ClampedArray {
    const out = new Uint8ClampedArray(CELL * CELL * 4);
    for (let ty = 0; ty < CELL; ty++) {
        for (let tx = 0; tx < CELL; tx++) {
            const x = cx * CELL + tx, y = cy * CELL + ty;
            if (!inBounds(d, x, y)) continue;
            const s = (y * d.width + x) * 4, t = (ty * CELL + tx) * 4;
            out[t] = d.data[s];
            out[t + 1] = d.data[s + 1];
            out[t + 2] = d.data[s + 2];
            out[t + 3] = d.data[s + 3];
        }
    }
    return out;
}

/** Overwrite a tile (transparent pixels are copied too). */
export function pasteTile(d: PixelDoc, cx: number, cy: number, tile: Uint8ClampedArray): void {
    for (let ty = 0; ty < CELL; ty++) {
        for (let tx = 0; tx < CELL; tx++) {
            const t = (ty * CELL + tx) * 4;
            setPixel(
                d,
                cx * CELL + tx,
                cy * CELL + ty,
                tile[t],
                tile[t + 1],
                tile[t + 2],
                tile[t + 3],
            );
        }
    }
}

// ── palette ──────────────────────────────────────────────────────────────

/** Replace every non-transparent pixel of colour oldHex with newHex. */
export function recolor(d: PixelDoc, oldHex: string, newHex: string): boolean {
    const o = hexToRgb(oldHex), n = hexToRgb(newHex);
    if (o.r === n.r && o.g === n.g && o.b === n.b) return false;
    let changed = false;
    const a = d.data;
    for (let i = 0; i < a.length; i += 4) {
        if (a[i] === o.r && a[i + 1] === o.g && a[i + 2] === o.b && a[i + 3] !== 0) {
            a[i] = n.r;
            a[i + 1] = n.g;
            a[i + 2] = n.b;
            changed = true;
        }
    }
    return changed;
}

export interface PaletteInfo {
    /** hue-sorted hex colours */
    colors: string[];
    counts: Record<string, number>;
}

/** Colours used by the sprite (fully transparent pixels ignored). */
export function scanPalette(d: PixelDoc): PaletteInfo {
    const counts = new Map<string, number>();
    const a = d.data;
    for (let i = 0; i < a.length; i += 4) {
        if (a[i + 3] === 0) continue;
        const hex = rgbToHex(a[i], a[i + 1], a[i + 2]);
        counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
    const colors = Array.from(counts.keys());
    colors.sort((x, y) => {
        const hx = hexToHsl(x), hy = hexToHsl(y);
        if (hx.h !== hy.h) return hx.h - hy.h;
        if (hx.s !== hy.s) return hx.s - hy.s;
        return hx.l - hy.l;
    });
    return { colors, counts: Object.fromEntries(counts) };
}

// ── edit session (document + undo + view), survives UI unmounts ──────────

export interface EditSession {
    /** Full sprite id, e.g. "md-my-hown-mod:crate". Editable while `isNew`. */
    id: string;
    /** true until first saved under this id */
    isNew: boolean;
    /** id of an existing config entry this session is allowed to replace */
    replaces?: string;
    doc: PixelDoc;
    undo: Snapshot[];
    dirty: boolean;
    view: { zoom: number; panX: number; panY: number; fitted: boolean };
    /** free text shown in the editor (where the pixels came from) */
    origin?: string;
}

export function newSession(
    id: string,
    doc: PixelDoc,
    opts: Partial<EditSession> = {},
): EditSession {
    return {
        id,
        isNew: true,
        doc,
        undo: [],
        dirty: false,
        view: { zoom: 8, panX: 40, panY: 40, fitted: false },
        ...opts,
    };
}

/** Push the current pixels on the undo stack (call BEFORE mutating). */
export function pushUndo(s: EditSession, snap: Snapshot = snapshotOf(s.doc)): void {
    s.undo.push(snap);
    if (s.undo.length > UNDO_LIMIT) s.undo.shift();
    s.dirty = true;
}

/** Pop one undo step. Returns true when something was restored. */
export function undoStep(s: EditSession): boolean {
    const snap = s.undo.pop();
    if (!snap) return false;
    s.doc = { width: snap.width, height: snap.height, data: new Uint8ClampedArray(snap.data) };
    s.dirty = true;
    return true;
}
