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
