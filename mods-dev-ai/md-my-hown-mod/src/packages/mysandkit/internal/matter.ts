import { g } from "../host.ts";

const MATTER_MAP: Record<string, number> = {
    solid: 1,
    liquid: 2,
    particle: 3,
    gas: 4,
    static: 5,
    slushy: 6,
    wisp: 7,
    powder: 8,
};

export function resolveMatterType(v: string | number | undefined): number | undefined {
    if (v === undefined || v === null) return undefined;
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string") {
        const lower = v.trim().toLowerCase();
        if (lower in MATTER_MAP) return MATTER_MAP[lower];

        if (/^\d+$/.test(lower)) return Number(lower);
        const enums = g()?.enums?.MatterType;
        if (enums) {
            const cap = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();

            const viaEnum = enums[cap];
            if (typeof viaEnum === "number") return viaEnum;
        }
    }
    return MATTER_MAP.powder;
}

const NEUTRAL_VARIANT: [number, number, number, number] = [204, 204, 204, 255];

export function variantFromMetaColor(
    metaColor: unknown,
): [number, number, number, number] {
    if (typeof metaColor !== "number" || !Number.isFinite(metaColor)) return NEUTRAL_VARIANT;
    const packed = Math.max(0, Math.min(0xffffff, Math.floor(metaColor)));
    return [(packed >> 16) & 255, (packed >> 8) & 255, packed & 255, 255];
}
