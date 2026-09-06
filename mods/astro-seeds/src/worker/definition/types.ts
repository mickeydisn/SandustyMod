/** Minimal typing for sandkit (game-injected). */

import { TElementType } from "../../shared/elementTypes.ts";
import { DirectionName } from "../utils/gridnear.ts";

export interface Vec2 {
  x: number;
  y: number;
}

export interface Profile {
  id: string;
  seedType: TElementType;
  liquidType: TElementType;
  crystalType: TElementType;
  growAge: () => number;
  moves: MoveFn[];
  grow: GrowFn[];
  crystallization: CrystallizeFn[];
}

export type MoveFn = (ctx: Ctx) => Ctx;
export type GrowFn = (ctx: Ctx) => GrowResult;
export type CrystallizeFn = (ctx: Ctx) => boolean;

export interface Ctx {
  x: number;
  y: number;
  dx: number;
  dy: number;
  profile: Profile;
  age: number;
  blocked: boolean;
  tryInstant: boolean;
  stuck: boolean;
}

export interface GrowResult {
  matched: boolean;
  delta: number;
  tag: string | null;
  rate?: number;
}

/**
 * Serializable description of a single Move.columnForce() entry.
 * Serialized to a JSON string by the panel and parsed back on the worker.
 * Non-serializable function fields (rangeNFn / maxKFn) are stored as plain
 * numbers so the whole object survives JSON.stringify/JSON.parse.
 */
export interface ColumnForceEntry {
  rateFn: number;
  matchTypes: TElementType[];
  directions: DirectionName[];
  rangeNFn: number;
  maxKFn: number;
  freeTypes: TElementType[];
  excludeTypes: TElementType[];
}

/** Shape of the JSON string carried by the astroJson uint8 shared buffer. */
export interface ForceConfig {
  columnForce: ColumnForceEntry[];
}
