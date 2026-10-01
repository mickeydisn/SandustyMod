/**
 * sprite-editor / editor — the editor window (React, host `sandkit.react`).
 *
 * Edits ONE sprite (an EditSession) with every tool of the original Grid Editor:
 *   1 Pencil · 2 Eraser · 3 Fill · 4 Picker · 5 Pan · 6 Add tile · 7 Remove tile
 *   8 Square (filled / 1:1) · 9 Copy tile · Undo · palette (click / dbl-click
 *   recolor / drag-merge) · zoom / fit / grid.
 *
 * Game-overlay specifics:
 *   - All canvas pointer handling is native (React's wheel listener is passive).
 *   - Key events inside the window never reach the game (typing a name must not
 *     make the character walk; 1-9 must not switch hotbar slots).
 *   - The session (pixels + undo + view) is a plain object owned by the caller,
 *     so closing/reopening the overlay never loses work.
 */
import { api, React as HostReact } from "../api.ts";
import { docToDataUrl, downloadDataUrl } from "./codec.ts";
import {
    CELL,
    constrainRectEnd,
    drawRect,
    type EditSession,
    extractTile,
    floodFill,
    getPixel,
    hexToRgb,
    insertTile,
    paintLine,
    pasteTile,
    type PixelDoc,
    pushUndo,
    recolor,
    removeTile,
    rgbToHex,
    scanPalette,
    setPixel,
    snapshotOf,
    undoStep,
} from "./engine.ts";
import * as T from "./theme.ts";

export type Tool = "pencil" | "eraser" | "fill" | "picker" | "pan" | "addtile" | "removetile" | "rect" | "copytile";

export interface EditorProps {
    session: EditSession;
    /** Persist the session. Resolve true when saved. */
    onSave(s: EditSession): Promise<boolean>;
    /** Close the window (caller drops/keeps the session). */
    onClose(): void;
}

const TOOLS: Array<[Tool, string, string, string]> = [
    ["pencil", "Pencil", "1", "Pencil (1)"],
    ["eraser", "Eraser", "2", "Eraser (2)"],
    ["fill", "Fill", "3", "Bucket fill (3)"],
    ["picker", "Picker", "4", "Color picker (4)"],
    ["pan", "Pan", "5", "Pan (5 / space / shift+drag)"],
];
const TILE_TOOLS: Array<[Tool, string, string, string]> = [
    ["addtile", "Add tile", "6", "Add tile (6) — click near a tile edge; the new tile copies the tile on its left"],
    ["removetile", "Del tile", "7", "Remove tile (7) — click a tile to delete it"],
    ["rect", "Square", "8", "Square / rectangle (8) — drag to draw"],
    ["copytile", "Copy tile", "9", "Copy tile (9) — drag a 16×16 tile onto another one"],
];
const KEY_TOOL: Record<string, Tool> = {
    "1": "pencil", "2": "eraser", "3": "fill", "4": "picker", "5": "pan",
    "6": "addtile", "7": "removetile", "8": "rect", "9": "copytile",
};

const MIN_ZOOM = 0.5, MAX_ZOOM = 48;

/** remembered between opens (session-scoped) */
let lastPos: { x: number; y: number } | null = null;

function isTyping(t: any): boolean {
    if (!t || !t.tagName) return false;
    const tag = String(t.tagName).toUpperCase();
    if (tag === "TEXTAREA" || tag === "SELECT") return true;
    if (tag === "INPUT") {
        const ty = String(t.type || "text").toLowerCase();
        return ty === "text" || ty === "search" || ty === "number" || ty === "password";
    }
    return false;
}

function samePixels(a: Uint8ClampedArray, b: Uint8ClampedArray): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

let _Editor: any = null;

/** Component factory (memoised so the component identity is stable). */
export function getSpriteEditor(): (props: EditorProps) => any {
    if (_Editor) return _Editor;
    const React: any = HostReact ?? (api as any)?.react;
    if (!React) {
        console.error("[sprite-editor] sandkit.react unavailable");
        return (_Editor = () => null);
    }
    const h = React.createElement.bind(React);
    const { useState, useEffect, useRef } = React;

    function SpriteEditor(props: EditorProps) {
        const sessionRef = useRef(props.session);
        sessionRef.current = props.session;
        const sess = (): EditSession => sessionRef.current;

        const rootRef = useRef(null as any);
        const wrapRef = useRef(null as any);
        const canvasRef = useRef(null as any);
        const statusRef = useRef(null as any);
        const colorEditRef = useRef(null as any);
        const offRef = useRef(null as any); // offscreen canvas holding the sprite pixels

        const R = useRef(null as any);
        if (!R.current) {
            R.current = {
                tool: "pencil" as Tool,
                color: { r: 0xf6, g: 0xa5, b: 0x31 },
                rectFilled: false,
                rectSquare: false,
                grid: true,
                gridPx: false,
                pointerDown: false,
                panning: null,
                lastPixel: null,
                stroke: null,
                overlay: null,
                copyDrag: null,
                shapeDrag: null,
                lastScreen: null,
                spaceHeld: false,
                shiftHeld: false,
                editing: null, // palette recolor in progress
                palette: scanPalette(props.session.doc),
                cw: 480,
                ch: 360,
                closing: false,
                saving: false,
                note: "",
            };
        }

        const [, setTick] = useState(0);
        const bump = () => setTick((n: number) => n + 1);
        const [pos, setPos] = useState(() => lastPos ?? {
            x: Math.max(8, Math.round((window.innerWidth - Math.min(780, window.innerWidth - 16)) / 2)),
            y: 24,
        });
        const dragRef = useRef(null as any);
        const F = useRef({} as any); // always-latest handlers for the native listeners

        // ── view / render ────────────────────────────────────────────────
        const dpr = () => window.devicePixelRatio || 1;

        const syncOff = () => {
            const d = sess().doc;
            if (!offRef.current) offRef.current = document.createElement("canvas");
            const o: HTMLCanvasElement = offRef.current;
            if (o.width !== d.width || o.height !== d.height) { o.width = d.width; o.height = d.height; }
            o.getContext("2d")!.putImageData(new ImageData(d.data as any, d.width, d.height), 0, 0);
        };

        const render = () => {
            const c: HTMLCanvasElement | null = canvasRef.current;
            if (!c || !offRef.current) return;
            const ctx = c.getContext("2d")!;
            const S = R.current, s = sess(), d = s.doc, v = s.view, dp = dpr();
            ctx.setTransform(dp, 0, 0, dp, 0, 0);
            ctx.clearRect(0, 0, c.width / dp, c.height / dp);
            ctx.imageSmoothingEnabled = false;
            ctx.save();
            ctx.translate(v.panX, v.panY);
            ctx.scale(v.zoom, v.zoom);

            // transparency checkerboard, only under the sprite
            const K = 4;
            for (let y = 0; y * K < d.height; y++) {
                for (let x = 0; x * K < d.width; x++) {
                    ctx.fillStyle = (x + y) % 2 ? T.C.checkA : T.C.checkB;
                    ctx.fillRect(x * K, y * K, Math.min(K, d.width - x * K), Math.min(K, d.height - y * K));
                }
            }
            ctx.drawImage(offRef.current, 0, 0);

            if (S.gridPx && v.zoom >= 8) {
                ctx.lineWidth = 1 / v.zoom;
                ctx.strokeStyle = "rgba(255,255,255,0.07)";
                ctx.beginPath();
                for (let x = 0; x <= d.width; x++) { ctx.moveTo(x, 0); ctx.lineTo(x, d.height); }
                for (let y = 0; y <= d.height; y++) { ctx.moveTo(0, y); ctx.lineTo(d.width, y); }
                ctx.stroke();
            }
            if (S.grid && v.zoom >= 4) {
                ctx.lineWidth = 1 / v.zoom;
                ctx.strokeStyle = "rgba(255,255,255,0.16)";
                ctx.beginPath();
                for (let x = 0; x <= d.width; x += CELL) { ctx.moveTo(x, 0); ctx.lineTo(x, d.height); }
                for (let y = 0; y <= d.height; y += CELL) { ctx.moveTo(0, y); ctx.lineTo(d.width, y); }
                ctx.stroke();
                ctx.strokeStyle = "rgba(246,165,49,0.55)";
                ctx.lineWidth = 1.5 / v.zoom;
                ctx.strokeRect(0.5 / v.zoom, 0.5 / v.zoom, d.width - 1 / v.zoom, d.height - 1 / v.zoom);
            }
            drawOverlay(ctx);
            ctx.restore();
        };

        const drawOverlay = (ctx: CanvasRenderingContext2D) => {
            const o = R.current.overlay;
            if (!o) return;
            const z = sess().view.zoom, d = sess().doc;
            ctx.save();
            if (o.kind === "add") {
                const x = o.bx;
                const srcStart = Math.max(0, o.bx - CELL), srcW = Math.min(CELL, o.bx - srcStart);
                ctx.fillStyle = "rgba(98,214,196,0.18)";
                ctx.fillRect(x, 0, CELL, d.height);
                if (srcW > 0) {
                    ctx.globalAlpha = 0.65;
                    ctx.drawImage(offRef.current, srcStart, 0, srcW, d.height, x, 0, srcW, d.height);
                    ctx.globalAlpha = 1;
                }
                ctx.strokeStyle = T.C.accent2; ctx.lineWidth = 1.5 / z;
                ctx.setLineDash([3 / z, 3 / z]);
                ctx.strokeRect(x, 0, CELL, d.height);
                ctx.setLineDash([]);
                ctx.lineWidth = 3 / z;
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, d.height); ctx.stroke();
            } else if (o.kind === "remove") {
                const x = o.col * CELL, w = Math.min(CELL, d.width - x);
                ctx.fillStyle = "rgba(226,88,93,0.38)";
                ctx.fillRect(x, 0, w, d.height);
                ctx.strokeStyle = T.C.danger; ctx.lineWidth = 2 / z;
                ctx.strokeRect(x, 0, w, d.height);
                ctx.beginPath();
                ctx.moveTo(x, 0); ctx.lineTo(x + w, d.height); ctx.moveTo(x + w, 0); ctx.lineTo(x, d.height);
                ctx.stroke();
            } else if (o.kind === "copy") {
                ctx.strokeStyle = T.C.accent; ctx.lineWidth = 2 / z;
                ctx.strokeRect(o.src.cx * CELL, o.src.cy * CELL, CELL, CELL);
                if (o.dst) {
                    const dx = o.dst.cx * CELL, dy = o.dst.cy * CELL;
                    ctx.save();
                    ctx.beginPath(); ctx.rect(0, 0, d.width, d.height); ctx.clip();
                    ctx.clearRect(dx, dy, CELL, CELL);
                    ctx.drawImage(o.tileCanvas, dx, dy);
                    ctx.restore();
                    ctx.strokeStyle = T.C.accent2; ctx.lineWidth = 2 / z;
                    ctx.strokeRect(dx, dy, CELL, CELL);
                } else {
                    ctx.globalAlpha = 0.6;
                    ctx.drawImage(o.tileCanvas, o.mx - CELL / 2, o.my - CELL / 2);
                }
            }
            ctx.restore();
        };

        const resize = () => {
            const wrap = wrapRef.current, c = canvasRef.current;
            if (!wrap || !c) return;
            const w = wrap.clientWidth || 480, hgt = wrap.clientHeight || 360;
            const S = R.current;
            S.cw = w; S.ch = hgt;
            c.style.width = w + "px";
            c.style.height = hgt + "px";
            c.width = Math.round(w * dpr());
            c.height = Math.round(hgt * dpr());
            const v = sess().view;
            if (!v.fitted) { fit(); v.fitted = true; }
            render();
        };

        const fit = () => {
            const S = R.current, d = sess().doc, v = sess().view, margin = 30;
            const z = Math.min((S.cw - margin * 2) / d.width, (S.ch - margin * 2) / d.height);
            v.zoom = z >= 1 ? Math.min(32, Math.floor(z)) : Math.max(MIN_ZOOM, z);
            v.panX = (S.cw - d.width * v.zoom) / 2;
            v.panY = (S.ch - d.height * v.zoom) / 2;
        };

        const setZoom = (z: number, sx?: number, sy?: number) => {
            const S = R.current, v = sess().view;
            const ax = sx ?? S.cw / 2, ay = sy ?? S.ch / 2;
            const bx = (ax - v.panX) / v.zoom, by = (ay - v.panY) / v.zoom;
            v.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
            v.panX = ax - bx * v.zoom;
            v.panY = ay - by * v.zoom;
            bump(); render();
        };

        // ── document changes ─────────────────────────────────────────────
        /** after pixels/size changed by something other than a live stroke */
        const afterDoc = () => {
            syncOff();
            R.current.palette = scanPalette(sess().doc);
            bump(); render();
        };

        const beginStroke = () => { R.current.stroke = snapshotOf(sess().doc); };
        const endStroke = () => {
            const S = R.current;
            if (!S.stroke) return;
            const snap = S.stroke; S.stroke = null;
            if (!samePixels(snap.data, sess().doc.data)) {
                pushUndo(sess(), snap);
                S.palette = scanPalette(sess().doc);
                bump();
            }
        };
        const cancelStroke = () => {
            const S = R.current;
            if (S.stroke) {
                sess().doc.data.set(S.stroke.data);
                S.stroke = null;
                syncOff();
            }
        };

        const colorArr = (): [number, number, number, number] => {
            const c = R.current.color;
            return [c.r, c.g, c.b, 255];
        };

        const setColor = (r: number, g: number, b: number) => { R.current.color = { r, g, b }; bump(); };

        const structural = (fn: () => PixelDoc | null): boolean => {
            const s = sess();
            const before = snapshotOf(s.doc);
            const next = fn();
            if (!next) return false;
            pushUndo(s, before);
            s.doc = next;
            afterDoc();
            return true;
        };

        const doUndo = () => {
            if (undoStep(sess())) afterDoc();
        };

        // ── pointer helpers ──────────────────────────────────────────────
        const canvasPoint = (e: MouseEvent) => {
            const c: HTMLCanvasElement = canvasRef.current;
            const r = c.getBoundingClientRect();
            const kx = r.width ? (c.clientWidth || r.width) / r.width : 1;
            const ky = r.height ? (c.clientHeight || r.height) / r.height : 1;
            return { sx: (e.clientX - r.left) * kx, sy: (e.clientY - r.top) * ky };
        };
        const toDoc = (sx: number, sy: number) => {
            const v = sess().view;
            return { x: (sx - v.panX) / v.zoom, y: (sy - v.panY) / v.zoom };
        };
        const pixelAt = (c: { x: number; y: number }) => {
            const d = sess().doc, lx = Math.floor(c.x), ly = Math.floor(c.y);
            return lx >= 0 && ly >= 0 && lx < d.width && ly < d.height ? { lx, ly } : null;
        };
        const tileAt = (c: { x: number; y: number }) => {
            const p = pixelAt(c);
            return p ? { cx: Math.floor(p.lx / CELL), cy: Math.floor(p.ly / CELL), fx: c.x } : null;
        };

        const modPan = () => R.current.spaceHeld || R.current.shiftHeld;
        const syncCursor = () => {
            const c = canvasRef.current, S = R.current;
            if (!c) return;
            c.style.cursor = S.panning ? "grabbing"
                : (S.tool === "pan" || modPan()) ? "grab"
                : S.tool === "copytile" ? "copy" : "crosshair";
        };

        const updateHover = () => {
            const S = R.current;
            if (S.copyDrag) return;
            S.overlay = null;
            if (S.lastScreen && (S.tool === "addtile" || S.tool === "removetile")) {
                const t = tileAt(toDoc(S.lastScreen.sx, S.lastScreen.sy));
                if (t) {
                    if (S.tool === "addtile") {
                        S.overlay = { kind: "add", bx: Math.min(Math.round(t.fx / CELL) * CELL, sess().doc.width) };
                    } else {
                        S.overlay = { kind: "remove", col: t.cx };
                    }
                }
            }
            render();
        };

        const selectTool = (t: Tool) => {
            const S = R.current;
            if (S.shapeDrag) { cancelStroke(); }
            S.tool = t; S.copyDrag = null; S.shapeDrag = null; S.overlay = null; S.pointerDown = false;
            syncCursor(); bump(); updateHover();
        };

        // ── tools at a point ─────────────────────────────────────────────
        const applyToolAt = (c: { x: number; y: number }, isNew: boolean) => {
            const S = R.current, s = sess(), d = s.doc;
            const p = pixelAt(c);
            if (S.tool === "picker") {
                if (p) {
                    const px = getPixel(d, p.lx, p.ly);
                    if (px[3] !== 0) setColor(px[0], px[1], px[2]);
                }
                return;
            }
            if (!p) return;
            if (S.tool === "pencil" || S.tool === "eraser") {
                if (isNew) beginStroke();
                const col: [number, number, number, number] = S.tool === "eraser" ? [0, 0, 0, 0] : colorArr();
                if (S.lastPixel) paintLine(d, S.lastPixel.lx, S.lastPixel.ly, p.lx, p.ly, col);
                else setPixel(d, p.lx, p.ly, col[0], col[1], col[2], col[3]);
                S.lastPixel = p;
                syncOff(); render();
            } else if (S.tool === "fill") {
                beginStroke();
                floodFill(d, p.lx, p.ly, colorArr());
                syncOff();
                endStroke();
                render();
            }
        };

        const updateShape = (c: { x: number; y: number }) => {
            const S = R.current, d = sess().doc, sd = S.shapeDrag;
            const [lx, ly] = constrainRectEnd(d, sd.x0, sd.y0, Math.floor(c.x), Math.floor(c.y), S.rectSquare);
            d.data.set(S.stroke.data); // live preview from the untouched pixels
            drawRect(d, sd.x0, sd.y0, lx, ly, S.rectFilled, colorArr());
            syncOff(); render();
        };

        // ── native pointer handlers (registered once, call latest via F) ──
        const onDown = (e: MouseEvent) => {
            e.stopPropagation();
            focusRoot();
            if (e.button === 2) return;
            const S = R.current, s = sess();
            const { sx, sy } = canvasPoint(e);
            if (S.tool === "pan" || e.button === 1 || modPan()) {
                S.panning = { sx, sy, panX: s.view.panX, panY: s.view.panY };
                syncCursor();
                return;
            }
            const c = toDoc(sx, sy);
            S.lastScreen = { sx, sy };

            if (S.tool === "addtile" || S.tool === "removetile") {
                const t = tileAt(c);
                if (!t) return;
                if (S.tool === "addtile") {
                    const bx = Math.min(Math.round(t.fx / CELL) * CELL, s.doc.width);
                    structural(() => insertTile(s.doc, bx));
                } else {
                    const ok = structural(() => removeTile(s.doc, t.cx));
                    if (!ok) { S.note = "Cannot remove the last tile"; bump(); }
                }
                updateHover();
                return;
            }
            if (S.tool === "rect") {
                const p = pixelAt(c);
                if (!p) return;
                S.pointerDown = true;
                beginStroke();
                S.shapeDrag = { x0: p.lx, y0: p.ly };
                updateShape(c);
                return;
            }
            if (S.tool === "copytile") {
                const t = tileAt(c);
                if (!t) return;
                S.pointerDown = true;
                const tile = extractTile(s.doc, t.cx, t.cy);
                const tc = document.createElement("canvas");
                tc.width = CELL; tc.height = CELL;
                tc.getContext("2d")!.putImageData(new ImageData(tile as any, CELL, CELL), 0, 0);
                S.copyDrag = { src: t, tile, tileCanvas: tc };
                S.overlay = { kind: "copy", src: t, dst: null, tileCanvas: tc, mx: c.x, my: c.y };
                render();
                return;
            }
            S.pointerDown = true;
            S.lastPixel = null;
            applyToolAt(c, true);
        };

        const setStatus = (c: { x: number; y: number }) => {
            const el = statusRef.current;
            if (!el) return;
            const p = pixelAt(c);
            if (!p) { el.textContent = `x:${Math.floor(c.x)} y:${Math.floor(c.y)}`; return; }
            const px = getPixel(sess().doc, p.lx, p.ly);
            el.textContent = `x:${p.lx} y:${p.ly}  ${rgbToHex(px[0], px[1], px[2])}${px[3] < 255 ? ` a:${px[3]}` : ""}`;
        };

        const onMove = (e: MouseEvent) => {
            const S = R.current, s = sess();
            if (!canvasRef.current) return;
            const busy = S.panning || S.pointerDown || S.copyDrag || S.shapeDrag;
            if (!busy && e.target !== canvasRef.current) return; // game is underneath: do nothing
            const { sx, sy } = canvasPoint(e);
            if (S.panning) {
                s.view.panX = S.panning.panX + (sx - S.panning.sx);
                s.view.panY = S.panning.panY + (sy - S.panning.sy);
                render();
                return;
            }
            const c = toDoc(sx, sy);
            S.lastScreen = { sx, sy };
            setStatus(c);
            if (S.copyDrag) {
                S.overlay = { kind: "copy", src: S.copyDrag.src, dst: tileAt(c), tileCanvas: S.copyDrag.tileCanvas, mx: c.x, my: c.y };
                render();
                return;
            }
            if (S.shapeDrag) { updateShape(c); return; }
            if (S.pointerDown && (S.tool === "pencil" || S.tool === "eraser")) { applyToolAt(c, false); return; }
            if (S.tool === "addtile" || S.tool === "removetile") updateHover();
        };

        const onUp = (e: MouseEvent) => {
            const S = R.current, s = sess();
            if (!(S.panning || S.pointerDown || S.copyDrag || S.shapeDrag)) return;
            if (S.copyDrag) {
                const cd = S.copyDrag;
                S.copyDrag = null; S.overlay = null;
                const r = canvasRef.current?.getBoundingClientRect();
                const inside = r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
                let t = null;
                if (inside) { const p = canvasPoint(e); t = tileAt(toDoc(p.sx, p.sy)); }
                if (t && !(t.cx === cd.src.cx && t.cy === cd.src.cy)) {
                    const before = snapshotOf(s.doc);
                    pasteTile(s.doc, t.cx, t.cy, cd.tile);
                    pushUndo(s, before);
                    afterDoc();
                } else render();
            }
            if (S.shapeDrag) S.shapeDrag = null;
            if (S.pointerDown) endStroke();
            S.pointerDown = false;
            S.panning = null;
            S.lastPixel = null;
            syncCursor();
            if (s.dirty) bump();
        };

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const wrap = wrapRef.current;
            let dx = e.deltaX, dy = e.deltaY;
            if (e.deltaMode === 1) { dx *= 16; dy *= 16; } else if (e.deltaMode === 2) { dx *= wrap.clientWidth; dy *= wrap.clientHeight; }
            const v = sess().view;
            if (e.shiftKey || e.ctrlKey) {
                const d = dy || dx;
                if (!d) return;
                const { sx, sy } = canvasPoint(e);
                setZoom(v.zoom * (d < 0 ? 1.15 : 1 / 1.15), sx, sy);
            } else {
                v.panY -= dy; v.panX -= dx;
                render();
            }
        };

        /** canvas click: drop text-field focus, make the window the key target */
        const focusRoot = () => {
            const r = rootRef.current;
            if (!r) return;
            const ae: any = document.activeElement;
            if (ae && ae !== r && r.contains(ae) && isTyping(ae)) ae.blur();
            const cur: any = document.activeElement;
            if (cur !== r && !(cur && r.contains(cur))) r.focus({ preventScroll: true });
        };

        const onKeyDown = (e: KeyboardEvent) => {
            e.stopPropagation(); // never let typing / hotkeys reach the game
            if (isTyping(e.target)) return;
            const S = R.current;
            const key = e.key;
            if (e.code === "Space") { S.spaceHeld = true; syncCursor(); e.preventDefault(); return; }
            if (key === "Shift") { S.shiftHeld = true; syncCursor(); return; }
            if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === "z") { doUndo(); e.preventDefault(); return; }
            if ((e.ctrlKey || e.metaKey) && key.toLowerCase() === "s") { e.preventDefault(); void doSave(); return; }
            if (KEY_TOOL[key] && !e.ctrlKey && !e.metaKey && !e.altKey) { selectTool(KEY_TOOL[key]); return; }
            if (key === "Escape" && (S.copyDrag || S.shapeDrag)) {
                cancelStroke();
                S.copyDrag = null; S.shapeDrag = null; S.overlay = null; S.pointerDown = false;
                render();
                return;
            }
            if (key === "+" || key === "=") setZoom(sess().view.zoom * 1.3);
            else if (key === "-") setZoom(sess().view.zoom / 1.3);
            else if (key === "0") { fit(); bump(); render(); }
        };
        const onKeyUp = (e: KeyboardEvent) => {
            e.stopPropagation();
            const S = R.current;
            if (e.code === "Space") { S.spaceHeld = false; syncCursor(); if (!isTyping(e.target)) e.preventDefault(); }
            if (e.key === "Shift") { S.shiftHeld = false; syncCursor(); }
        };

        // ── save / close ─────────────────────────────────────────────────
        const doSave = async (): Promise<boolean> => {
            const S = R.current;
            if (S.saving) return false;
            S.saving = true; bump();
            let ok = false;
            try { ok = await props.onSave(sess()); } catch (e) { console.error("[sprite-editor] save failed", e); }
            S.saving = false; bump();
            return ok;
        };
        const requestClose = () => {
            if (sess().dirty) { R.current.closing = true; bump(); } else props.onClose();
        };
        const doExport = () => {
            const name = (sess().id.split(":").pop() || "sprite") + ".png";
            downloadDataUrl(name, docToDataUrl(sess().doc));
        };

        // ── palette ──────────────────────────────────────────────────────
        const startRecolor = (hex: string) => {
            const input = colorEditRef.current;
            if (!input) return;
            R.current.editing = { prev: hex, snap: snapshotOf(sess().doc), pushed: false };
            input.value = hex.toLowerCase();
            input.click();
        };
        const onRecolorInput = () => {
            const S = R.current, ed = S.editing, input = colorEditRef.current;
            if (!ed || !input) return;
            const next = String(input.value).toUpperCase();
            if (next.toLowerCase() === ed.prev.toLowerCase()) return;
            if (recolor(sess().doc, ed.prev, next)) {
                if (!ed.pushed) { pushUndo(sess(), ed.snap); ed.pushed = true; }
                ed.prev = next;
                syncOff(); render();
            }
        };
        const onRecolorChange = () => {
            const S = R.current;
            if (!S.editing) return;
            S.editing = null;
            afterDoc();
        };
        const mergeSwatch = (targetHex: string, sourceHex: string) => {
            if (!sourceHex || sourceHex.toLowerCase() === targetHex.toLowerCase()) return;
            const s = sess(), before = snapshotOf(s.doc);
            // the swatch dropped ON takes the colour that was dragged
            if (recolor(s.doc, targetHex, sourceHex)) { pushUndo(s, before); afterDoc(); }
        };

        F.current = { onDown, onMove, onUp, onWheel, onKeyDown, onKeyUp, resize, onRecolorInput, onRecolorChange };

        // ── mount: native listeners ──────────────────────────────────────
        useEffect(() => {
            const canvas = canvasRef.current, wrap = wrapRef.current, root = rootRef.current, ci = colorEditRef.current;
            syncOff();
            resize();

            const down = (e: any) => F.current.onDown(e);
            const move = (e: any) => F.current.onMove(e);
            const up = (e: any) => F.current.onUp(e);
            const wheel = (e: any) => F.current.onWheel(e);
            const kd = (e: any) => F.current.onKeyDown(e);
            const ku = (e: any) => F.current.onKeyUp(e);
            const kp = (e: any) => e.stopPropagation();
            const ctxm = (e: any) => { e.preventDefault(); e.stopPropagation(); };
            const leave = () => {
                const S = R.current;
                S.lastScreen = null;
                if (!S.copyDrag && S.overlay) { S.overlay = null; render(); }
            };
            // hover: claim the keyboard only if nothing inside already has it (don't interrupt typing)
            const enterRoot = () => {
                if (!root.contains(document.activeElement)) root.focus({ preventScroll: true });
            };
            const leaveRoot = () => {
                const ae: any = document.activeElement;
                if (ae === root) root.blur(); // hand keyboard back to the game
            };
            const ri = () => F.current.onRecolorInput();
            const rc = () => F.current.onRecolorChange();
            const onWinResize = () => F.current.resize();

            canvas.addEventListener("mousedown", down);
            canvas.addEventListener("mouseleave", leave);
            canvas.addEventListener("contextmenu", ctxm);
            wrap.addEventListener("wheel", wheel, { passive: false });
            window.addEventListener("mousemove", move);
            window.addEventListener("mouseup", up);
            root.addEventListener("keydown", kd);
            root.addEventListener("keyup", ku);
            root.addEventListener("keypress", kp);
            root.addEventListener("mouseenter", enterRoot);
            root.addEventListener("mouseleave", leaveRoot);
            ci?.addEventListener("input", ri);
            ci?.addEventListener("change", rc);
            window.addEventListener("resize", onWinResize);
            const RO: any = (globalThis as any).ResizeObserver;
            const ro = RO ? new RO(() => F.current.resize()) : null;
            ro?.observe(wrap);

            // header drag
            const dmove = (e: MouseEvent) => {
                const dr = dragRef.current;
                if (!dr) return;
                const p = { x: Math.max(0, e.clientX - dr.ox), y: Math.max(0, e.clientY - dr.oy) };
                lastPos = p;
                setPos(p);
            };
            const dup = () => { dragRef.current = null; };
            window.addEventListener("mousemove", dmove);
            window.addEventListener("mouseup", dup);

            return () => {
                canvas.removeEventListener("mousedown", down);
                canvas.removeEventListener("mouseleave", leave);
                canvas.removeEventListener("contextmenu", ctxm);
                wrap.removeEventListener("wheel", wheel);
                window.removeEventListener("mousemove", move);
                window.removeEventListener("mouseup", up);
                root.removeEventListener("keydown", kd);
                root.removeEventListener("keyup", ku);
                root.removeEventListener("keypress", kp);
                root.removeEventListener("mouseenter", enterRoot);
                root.removeEventListener("mouseleave", leaveRoot);
                ci?.removeEventListener("input", ri);
                ci?.removeEventListener("change", rc);
                window.removeEventListener("resize", onWinResize);
                ro?.disconnect();
                window.removeEventListener("mousemove", dmove);
                window.removeEventListener("mouseup", dup);
            };
        }, []);

        // re-render the canvas after any React re-render (state may have changed the doc)
        useEffect(() => { syncOff(); render(); });

        // ── UI ───────────────────────────────────────────────────────────
        const S = R.current, s = sess();
        const hex = rgbToHex(S.color.r, S.color.g, S.color.b);
        const toolBtn = ([t, label, key, title]: [Tool, string, string, string]) =>
            h("button", {
                key: t, type: "button", title,
                style: S.tool === t ? T.btnActive : T.btn,
                onClick: () => selectTool(t),
            }, `${key} ${label}`);

        const pal = S.palette;
        const swatches = pal.colors.map((c: string) =>
            h("div", {
                key: c,
                draggable: true,
                title: `${c} — ${pal.counts[c]} px · click select · double-click recolor · drag onto another swatch to merge`,
                style: { ...T.swatch, background: c, outline: c === hex ? `2px solid ${T.C.accent}` : "none", outlineOffset: 1 },
                onClick: () => { const r = hexToRgb(c); setColor(r.r, r.g, r.b); },
                onDoubleClick: (e: any) => { e.stopPropagation(); startRecolor(c); },
                onDragStart: (e: any) => { e.dataTransfer.setData("text/plain", c); e.dataTransfer.effectAllowed = "move"; },
                onDragOver: (e: any) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; },
                onDragEnter: (e: any) => { e.preventDefault(); e.currentTarget.style.outline = `2px dashed ${T.C.accent2}`; },
                onDragLeave: (e: any) => { e.currentTarget.style.outline = c === hex ? `2px solid ${T.C.accent}` : "none"; },
                onDrop: (e: any) => {
                    e.preventDefault();
                    e.currentTarget.style.outline = "none";
                    mergeSwatch(c, e.dataTransfer.getData("text/plain"));
                },
            }));

        const w = Math.min(780, window.innerWidth - 16), hgt = Math.min(590, window.innerHeight - 16);

        return h("div", {
            ref: rootRef, tabIndex: -1,
            style: { ...T.win, left: pos.x, top: pos.y, width: w, height: hgt },
            onMouseDown: (e: any) => e.stopPropagation(),
        },
            // header
            h("div", {
                style: T.header,
                onMouseDown: (e: any) => {
                    if (e.button !== 0 || (e.target as HTMLElement).closest("button,input")) return;
                    dragRef.current = { ox: e.clientX - pos.x, oy: e.clientY - pos.y };
                    e.preventDefault();
                },
            },
                h("b", { style: { letterSpacing: 0.5 } }, "✏ SPRITE EDITOR"),
                s.isNew
                    ? h("input", {
                        style: { ...T.textInput, flex: 1 }, value: s.id, spellCheck: false,
                        title: "Sprite id (used by items / structures / projectiles)",
                        onChange: (e: any) => { s.id = e.target.value; bump(); },
                    })
                    : h("span", { style: { flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: s.id }, s.id),
                h("span", { style: { color: s.dirty ? T.C.accent : T.C.muted }, title: s.dirty ? "Unsaved changes" : "Saved" }, s.dirty ? "● unsaved" : "saved"),
                h("button", { type: "button", style: T.btnPrimary, disabled: S.saving, onClick: () => { void doSave(); }, title: "Save (Ctrl+S)" }, S.saving ? "Saving…" : "Save"),
                h("button", { type: "button", style: T.btn, onClick: doExport, title: "Download as .png" }, "Export PNG"),
                h("button", { type: "button", style: T.btn, onClick: requestClose, title: "Close" }, "✕"),
            ),
            // unsaved-close bar
            S.closing ? h("div", { style: T.bar },
                h("span", { style: { flex: 1 } }, "Unsaved changes."),
                h("button", { type: "button", style: T.btnPrimary, onClick: async () => { if (await doSave()) props.onClose(); else { R.current.closing = false; bump(); } } }, "Save & close"),
                h("button", { type: "button", style: T.btnDanger, onClick: () => props.onClose(), title: "Throw the changes away" }, "Discard"),
                h("button", { type: "button", style: T.btn, onClick: () => { R.current.closing = false; bump(); } }, "Cancel"),
            ) : null,
            // body
            h("div", { style: T.body },
                h("div", { style: T.aside },
                    h("div", { style: T.section },
                        h("h3", { style: T.h3 }, "Tools"),
                        h("div", { style: T.toolGrid },
                            ...TOOLS.map(toolBtn),
                            h("button", { type: "button", style: T.btn, title: "Undo (Ctrl+Z)", onClick: doUndo, disabled: s.undo.length === 0 }, "↶ Undo"),
                        ),
                    ),
                    h("div", { style: T.section },
                        h("h3", { style: T.h3 }, "Tiles & shapes"),
                        h("div", { style: T.toolGrid }, ...TILE_TOOLS.map(toolBtn)),
                        h("label", { style: T.check },
                            h("input", { type: "checkbox", checked: S.rectFilled, onChange: (e: any) => { S.rectFilled = e.target.checked; e.target.blur(); bump(); } }),
                            "filled square"),
                        h("label", { style: T.check },
                            h("input", { type: "checkbox", checked: S.rectSquare, onChange: (e: any) => { S.rectSquare = e.target.checked; e.target.blur(); bump(); } }),
                            "lock 1:1 ratio"),
                    ),
                    h("div", { style: T.section },
                        h("h3", { style: T.h3 }, "Current color"),
                        h("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                            h("div", { style: { width: 30, height: 26, border: `1px solid ${T.C.border}`, background: hex } }),
                            h("input", {
                                type: "color", value: hex.toLowerCase(),
                                style: { width: 34, height: 26, border: `1px solid ${T.C.border}`, background: "none", padding: 0, cursor: "pointer" },
                                onChange: (e: any) => { const r = hexToRgb(e.target.value); setColor(r.r, r.g, r.b); },
                            }),
                            h("span", { style: { color: T.C.muted, fontSize: 11 } }, hex),
                        ),
                    ),
                    h("div", { style: T.section },
                        h("h3", { style: T.h3 }, "Palette"),
                        pal.colors.length
                            ? h("div", { style: T.palette }, ...swatches)
                            : h("div", { style: { color: T.C.muted, fontSize: 11 } }, "Draw something to see its colors."),
                    ),
                    h("div", { style: T.section },
                        h("h3", { style: T.h3 }, "View"),
                        h("div", { style: { display: "flex", gap: 5, alignItems: "center" } },
                            h("button", { type: "button", style: T.btn, onClick: () => setZoom(s.view.zoom / 1.3), title: "Zoom out (-)" }, "−"),
                            h("span", { style: { flex: 1, textAlign: "center", color: T.C.muted } }, Math.round(s.view.zoom * 100) + "%"),
                            h("button", { type: "button", style: T.btn, onClick: () => setZoom(s.view.zoom * 1.3), title: "Zoom in (+)" }, "+"),
                            h("button", { type: "button", style: T.btn, onClick: () => { fit(); bump(); render(); }, title: "Fit (0)" }, "Fit"),
                        ),
                        h("label", { style: T.check },
                            h("input", { type: "checkbox", checked: S.grid, onChange: (e: any) => { S.grid = e.target.checked; e.target.blur(); bump(); } }),
                            "tile grid"),
                        h("label", { style: T.check },
                            h("input", { type: "checkbox", checked: S.gridPx, onChange: (e: any) => { S.gridPx = e.target.checked; e.target.blur(); bump(); } }),
                            "pixel grid (zoom ≥ 800%)"),
                    ),
                ),
                h("div", { ref: wrapRef, style: T.canvasWrap },
                    h("canvas", { ref: canvasRef, style: { position: "absolute", left: 0, top: 0, cursor: "crosshair" } }),
                    h("input", { ref: colorEditRef, type: "color", tabIndex: -1, style: { position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" } }),
                ),
            ),
            // footer
            h("div", { style: T.footer },
                h("b", { style: { color: T.C.text } }, `${s.doc.width}×${s.doc.height}`),
                h("span", null, `${Math.ceil(s.doc.width / CELL)} tile${Math.ceil(s.doc.width / CELL) === 1 ? "" : "s"}`),
                h("span", { ref: statusRef, style: { minWidth: 150 } }, "x:– y:–"),
                h("span", { style: { color: T.C.accent } }, S.note),
                h("span", { style: { flex: 1 } }),
                h("span", null, "1-9 tools · space/shift+drag pan · scroll pan · shift+scroll zoom · Ctrl+Z undo · Ctrl+S save"),
            ),
        );
    }

    _Editor = SpriteEditor;
    return _Editor;
}
