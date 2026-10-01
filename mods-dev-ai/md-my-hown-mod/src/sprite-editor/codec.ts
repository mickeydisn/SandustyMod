
import { createDoc, type PixelDoc } from "./engine.ts";

export const PNG_PREFIX = "data:image/png;base64,";

export function isPngDataUrl(v: unknown): v is string {
    return typeof v === "string" && v.startsWith(PNG_PREFIX);
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
}


export function docToDataUrl(doc: PixelDoc): string {
    const c = makeCanvas(doc.width, doc.height);
    const ctx = c.getContext("2d")!;
    ctx.putImageData(new ImageData(doc.data as any, doc.width, doc.height), 0, 0);
    return c.toDataURL("image/png");
}


export function dataUrlToBlob(url: string): Blob {
    const comma = url.indexOf(",");
    const meta = url.slice(5, comma); 
    const mime = meta.split(";")[0] || "image/png";
    const bin = atob(url.slice(comma + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

function loadImage(src: string, anonymous: boolean): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        if (anonymous) img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("image failed to load: " + src.slice(0, 80)));
        img.src = src;
    });
}

function imageToDoc(img: HTMLImageElement): PixelDoc {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (!w || !h) throw new Error("image has no size");
    const c = makeCanvas(w, h);
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, w, h).data; 
    const d = createDoc(w, h);
    d.data.set(px);
    return d;
}


export async function loadUrlToDoc(url: string): Promise<PixelDoc> {
    try {
        return imageToDoc(await loadImage(url, true));
    } catch (e1) {
        
        try {
            const blob = url.startsWith("data:")
                ? dataUrlToBlob(url)
                : await (await fetch(url)).blob();
            const obj = URL.createObjectURL(blob);
            try {
                return imageToDoc(await loadImage(obj, false));
            } finally {
                URL.revokeObjectURL(obj);
            }
        } catch (e2) {
            throw new Error(
                `cannot read image (${(e1 as Error)?.message ?? e1}; ${
                    (e2 as Error)?.message ?? e2
                })`,
            );
        }
    }
}


export function fileToDoc(file: Blob): Promise<PixelDoc> {
    return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onerror = () => reject(new Error("cannot read file"));
        fr.onload = () => loadUrlToDoc(String(fr.result)).then(resolve, reject);
        fr.readAsDataURL(file);
    });
}


export function downloadDataUrl(filename: string, url: string): void {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
}
