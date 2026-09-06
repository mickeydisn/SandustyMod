export interface StructureLike {
  id?: string | number;
  x: number;
  y: number;
  type?: string;
  structureType?: string;
  data: Record<string, unknown>;
}

export interface WorldGridHost {
  structures: {
    forEachOfType?: (type: string, cb: (s: StructureLike) => void) => void;
  };
}

type MomentaryApi = {
  structures: {
    processing?: {
      register: (
        type: string,
        def: { intervalMs: number; process: (s: { data: Record<string, unknown> }) => void },
      ) => void;
    };
    forEachOfType: (type: string, fn: (s: { data: Record<string, unknown> }) => void) => void;
  };
};
