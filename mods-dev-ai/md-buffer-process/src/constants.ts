/**
 * md-buffer-process — static configuration.
 */
import type { SettingsSchema } from "@sandmd/modkit";

export const MOD_ID = "md-buffer-process";
export const VERSION = "0.2.1";
export const LOG = `[${MOD_ID}]`;

export const STORAGE_KEYS: readonly string[] = [
    `${MOD_ID}:processConfig`,
];

export const SETTINGS = {
    enabled: { type: "boolean", default: true },
} as const satisfies SettingsSchema;
