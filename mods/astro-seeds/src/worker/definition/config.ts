import {
  BUF_LENGTH,
  bufField,
  CONFIG_FIELDS,
  DEFAULT_FORCE_CONFIG,
  JSON_BUF_LENGTH,
  JSON_COUNTER_INDEX,
} from "../../shared/configSchema.ts";
import { ColumnForceEntry, ForceConfig } from "./types.ts";
import { TElementType } from "../../shared/elementTypes.ts";

import { MOD_ID, VERSION } from "../../shared/ids.ts";
import { DirectionName } from "../utils/gridnear.ts";

let cfgBuf: Uint16Array | null = null;
try {
  cfgBuf = sandkit.api.shared.buffers.ensure("astroConfig", {
    type: "uint16",
    length: BUF_LENGTH,
  }) as Uint16Array;
} catch (e) {
  console.error(`[${MOD_ID} v${VERSION}] config buffer missing:`, e);
}

// uint8 buffer carrying the JSON string of the ForceConfig built by the panel.
let jsonBuf: Uint8Array | null = null;
try {
  jsonBuf = sandkit.api.shared.buffers.ensure("astroJson", {
    type: "uint8",
    length: JSON_BUF_LENGTH,
  }) as Uint8Array;
} catch (e) {
  console.error(`[${MOD_ID} v${VERSION}] astroJson buffer missing:`, e);
}

export function u16(i: number, fallback = 0): number {
  if (!cfgBuf) return fallback;
  const v = cfgBuf[i];
  if (v === undefined || v === null) return fallback;
  return v;
}

function bool(key: string): boolean {
  const i = bufField[key];
  if (i === undefined) return false;
  return u16(i, 0) !== 0;
}

function num(key: string): number {
  const i = bufField[key];
  if (i === undefined) return 0;
  return u16(i, 0);
}

/** Schema-driven accessors — add fields in configSchema only. */
export const WaterCfg = {
  modEnabled: () => bool("enabled"),
  debug: () => bool("debugLog"),
  enabled: () => bool("waterEnabled"),
  stepMove: () => bool("stepMove"),
  moveSide: () => num("moveSide"),
  moveFloat: () => num("moveFloat"),
  moveSink: () => num("moveSink"),
  stepForceMove: () => bool("stepForceMove"),
  stepGrow: () => bool("stepGrow"),
  growInstantTouch: () => num("growInstantTouch"),
  growOnAir: () => num("growOnAir"),
  growOnWall: () => num("growOnWall"),
  growOnFloor: () => num("growOnFloor"),
  growOnCrystal: () => num("growOnCrystal"),
  growIfSurround: () => num("growIfSurround"),
  growSurroundMin: () => num("growSurroundMin"),
  stepCrystalisation: () => bool("stepCrystalisation"),
  crystalGrowAge: () => Math.max(0, num("crystalGrowAge")),
  crystalShape: () => num("crystalShape"),
  crystalRadius: () => Math.max(0, num("crystalRadius")),
};

export function log(...args: unknown[]): void {
  if (WaterCfg.debug()) console.log(`[${MOD_ID} v${VERSION}]`, ...args);
}

// ---------------------------------------------------------------------------
// ForceConfig JSON cache.
//
// The panel writes a JSON string into the uint8 `astroJson` buffer and bumps
// JSON_COUNTER_INDEX (previously the moveContact slot) on every edit. The
// worker only re-parses when that counter changes, so parsing happens once per
// edit instead of once per cell frame.
// ---------------------------------------------------------------------------

function toNum(v: unknown, d = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : d;
}

function toTypeArr(v: unknown): TElementType[] {
  if (!Array.isArray(v)) return [];
  const out: TElementType[] = [];
  for (const t of v) {
    if (typeof t === "number" && Number.isInteger(t)) out.push(t);
  }
  return out;
}

function toDirArr(v: unknown): DirectionName[] {
  if (!Array.isArray(v)) return [];
  const known: DirectionName[] = ["top", "bottom", "left", "right", "sides"];
  const out = new Set<DirectionName>();
  for (const d of v) {
    if (typeof d === "string" && (known as string[]).includes(d)) {
      out.add(d as DirectionName);
    }
  }
  return [...out];
}

function readJsonString(buffer: Uint8Array): string {
  console.log("readJsonString", buffer);
  try {
    const end = buffer.indexOf(0);
    const bytes = buffer.slice(0, end === -1 ? buffer.length : end);
    const result = new TextDecoder().decode(bytes);
    console.log("readJsonString", result);
    return result;
  } catch (e) {
    console.error("readJsonString failed", e);
  }
  return "";
}

function parseForceConfig(raw: string): ForceConfig {
  if (!raw) return DEFAULT_FORCE_CONFIG;
  try {
    const obj = JSON.parse(raw) as Partial<ForceConfig>;
    if (!Array.isArray(obj.columnForce)) return DEFAULT_FORCE_CONFIG;
    const columnForce: ColumnForceEntry[] = [];
    for (const rawEntry of obj.columnForce) {
      if (
        !rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)
      ) continue;
      const e = rawEntry as unknown as Record<string, unknown>;
      columnForce.push({
        rateFn: toNum(e.rateFn),
        matchTypes: toTypeArr(e.matchTypes),
        directions: toDirArr(e.directions),
        rangeNFn: Math.max(0, toNum(e.rangeNFn, 10)),
        maxKFn: Math.max(0, toNum(e.maxKFn, 3)),
        freeTypes: toTypeArr(e.freeTypes),
        excludeTypes: toTypeArr(e.excludeTypes),
      });
    }
    return { columnForce };
  } catch {
    return DEFAULT_FORCE_CONFIG;
  }
}

let cacheCounter = -1;
let cacheConfig: ForceConfig | null = null;

/**
 * Parsed ForceConfig from the panel's JSON buffer, re-parsed only when the
 * jsonConfigUpdateCounter (JSON_COUNTER_INDEX) changes.
 */
export function forceConfig(): ForceConfig {
  const counter = u16(JSON_COUNTER_INDEX, -1);
  if (counter !== cacheCounter || !cacheConfig) {
    cacheCounter = counter;
    cacheConfig = parseForceConfig(jsonBuf ? readJsonString(jsonBuf) : "");
  }
  return cacheConfig;
}

/** Read-only view of forceConfig().columnForce (convenience). */
export function forceEntries(): readonly ColumnForceEntry[] {
  return forceConfig().columnForce;
}

// Ensure schema indices are unique at load
const seen = new Set<number>();
for (const f of CONFIG_FIELDS) {
  if (seen.has(f.index)) {
    console.error(`[${MOD_ID}] duplicate buf index`, f.index, f.key);
  }
  seen.add(f.index);
}
