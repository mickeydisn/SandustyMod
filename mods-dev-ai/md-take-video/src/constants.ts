/**
 * md-take-video — static configuration.
 * Mirror of configSchema in modinfo.json.
 */

export const MOD_ID = "md-take-video";
export const VERSION = "1.0.0";
export const LOG = `[${MOD_ID}]`;

export const STORAGE_KEYS = [
  "panel-geometry",
  "capture-settings",
] as const;

export const SETTINGS = {
  enabled: { type: "boolean" as const, default: true },
  countdownSeconds: { type: "number" as const, default: 2, min: 0, max: 10 },
  defaultFps: { type: "number" as const, default: 30, min: 5, max: 60 },
  videoBitrateMbps: { type: "number" as const, default: 4, min: 1, max: 20 },
};

/** Preferred MediaRecorder MIME types (Discord-friendly, compressed). */
export const VIDEO_MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
] as const;
