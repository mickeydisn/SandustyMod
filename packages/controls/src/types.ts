/** A structure instance in the world (as exposed by sandkit). */
export interface StructureLike {
  x: number;
  y: number;
  type?: string;
  structureType?: string;
  id?: string | number;
  data: Record<string, unknown>;
}

/** Payload delivered to signal target / interact handlers. */
export interface SignalPayload {
  combined?: boolean;
  source?: StructureLike;
  inputCount?: number;
  onCount?: number;
  [key: string]: unknown;
}

/** Shared options for registering any structure-based control. */
export interface StructureOptions {
  id: string;
  name: string;
  nameKey?: string;
  categoryKey?: string;
  order?: number;
  spriteId: string;
  renderSize?: { width: number; height: number };
  shape?: number[][];
  buildModes?: Array<{ type: string; directions?: string[] }>;
  defaultData?: Record<string, unknown>;
  activeOnPlace?: boolean;
  description?: string;
  cells?: number | { w: number; h: number };
  colors?: {
    metal?: string;
    accent?: string;
    muted?: string;
    screen?: string;
    danger?: string;
  };
}

export type ConfigValue = boolean | number | string | null;

/** Handle returned by every `ControlSystem.registerXxx`. */
export interface RegisteredControl {
  structureId: string;
  path: string;
  setValue: (value: ConfigValue) => void;
  getValue: () => ConfigValue;
}
