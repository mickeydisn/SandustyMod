/**
 * Channel Pads — static configuration.
 *
 * Compile-time constants only: mod id, channel count, the per-channel cap,
 * jump cooldown, palette and the i18n key map.
 */

/** Mod id — used for structure ids, sprite ids and i18n keys. */
export const MOD = "md-channel-pads";

/** Channels `0..9`. */
export const CHANNELS = 10;

/** Hard cap: two pads per channel. */
export const MAX_PER_CHANNEL = 2;

/** Jump lockout, shared across all channels. */
export const COOLDOWN_MS = 1600;

/** Player-collision poll interval. */
export const STEP_INTERVAL_MS = 50;

/** Pad sprite size in px (each `pad-{n}.png` is two 16×16 frames). */
export const PAD_SIZE_PX = 16;

/** Build-menu order offset for the pad structures. */
export const ORDER_BASE = 40;

/** Log prefix so every warning is attributable to this mod. */
export const LOG = "[md-channel-pads]";

/** RGBA palette used for the teleport flash, one per channel. */
export type ChannelColor = [number, number, number, number];

export const CHANNEL_COLORS: readonly ChannelColor[] = [
    [0.24, 0.88, 1.0, 1],
    [1.0, 0.24, 0.6, 1],
    [1.0, 0.79, 0.24, 1],
    [0.49, 1.0, 0.24, 1],
    [0.62, 0.42, 1.0, 1],
    [1.0, 0.48, 0.24, 1],
    [0.91, 0.96, 1.0, 1],
    [1.0, 0.42, 0.54, 1],
    [0.18, 0.9, 0.75, 1],
    [0.3, 0.55, 1.0, 1],
];

/** Colour used when a channel has no palette entry. */
export const FALLBACK_COLOR: ChannelColor = [0.4, 0.9, 1, 1];

/** Structure id for a channel's pad type. */
export function padId(ch: number): string {
    return `${MOD}.pad.${ch}`;
}

/** Every pad type id, `0..CHANNELS-1`. */
export const PAD_IDS: readonly string[] = Array.from(
    { length: CHANNELS },
    (_, ch) => padId(ch),
);

/** i18n keys, namespaced under `mods|channelPads|…`. */
const NS = "mods|channelPads";
export const KEY = {
    pack: `${NS}|pack`,
    padDesc: `${NS}|pad|desc`,
    toastFull: `${NS}|toast|full`,
    toastLinked: `${NS}|toast|linked`,
    toastWaiting: `${NS}|toast|waiting`,
    toastUnpaired: `${NS}|toast|unpaired`,
    toastFail: `${NS}|toast|fail`,
    tooltip: `${NS}|tooltip`,
    padName: (ch: number) => `${NS}|pad|${ch}|name`,
} as const;
