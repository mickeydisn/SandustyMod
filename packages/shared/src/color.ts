type HSLDelta = {
    h?: number; // degrees, e.g. +20 or -20
    s?: number; // percentage points, e.g. +10 or -10
    l?: number; // percentage points, e.g. +10 or -10
};

export function adjustHSL(hex: string, delta: HSLDelta): string {
    // Hex -> RGB
    const value = hex.replace("#", "");

    const r = parseInt(value.slice(0, 2), 16) / 255;
    const g = parseInt(value.slice(2, 4), 16) / 255;
    const b = parseInt(value.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;

    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (d !== 0) {
        s = d / (1 - Math.abs(2 * l - 1));

        switch (max) {
            case r:
                h = 60 * (((g - b) / d) % 6);
                break;
            case g:
                h = 60 * ((b - r) / d + 2);
                break;
            case b:
                h = 60 * ((r - g) / d + 4);
                break;
        }
    }

    if (h < 0) h += 360;

    // Apply deltas
    h = (h + (delta.h ?? 0)) % 360;
    if (h < 0) h += 360;

    s = Math.max(0, Math.min(100, s * 100 + (delta.s ?? 0))) / 100;
    const lightness = Math.max(0, Math.min(100, l * 100 + (delta.l ?? 0))) / 100;

    // HSL -> RGB
    const c = (1 - Math.abs(2 * lightness - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = lightness - c / 2;

    let r1 = 0;
    let g1 = 0;
    let b1 = 0;

    if (h < 60) [r1, g1, b1] = [c, x, 0];
    else if (h < 120) [r1, g1, b1] = [x, c, 0];
    else if (h < 180) [r1, g1, b1] = [0, c, x];
    else if (h < 240) [r1, g1, b1] = [0, x, c];
    else if (h < 300) [r1, g1, b1] = [x, 0, c];
    else [r1, g1, b1] = [c, 0, x];

    const toHex = (v: number) =>
        Math.round((v + m) * 255)
            .toString(16)
            .padStart(2, "0");

    return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}
