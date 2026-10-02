export const EXCAVATION_FLAGS = [
    "fromGun",
    "fromRocketExplosion",
    "fromDrill",
    "useLiteralOutVelocity",
    "destroyNonDestructible",
    "forceRemoveAll",
    "drillTierDamage",
] as const;

export type ExcavationFlag = (typeof EXCAVATION_FLAGS)[number];

export type ExcavationOptionFn = (params: unknown) => ExcavationOptionValue;

export interface ExcavationOptionValue {
    power?: number;

    options?: Record<string, unknown>;
}

export interface ExcavationOptionRef {
    key: string;
    params?: Record<string, unknown>;
}

export interface ExcavationOptionPatch {
    power?: number;
    options?: Record<string, unknown>;
}

export interface ExcavationOptionFailure {
    key: string;
    error: unknown;
}
