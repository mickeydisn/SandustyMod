export interface StructureLike {
  id?: string | number;
  x: number;
  y: number;
  type?: string;
  structureType?: string;
  data: Record<string, unknown>;
}

export interface SandkitStructure {
  register(definition: unknown, options?: Record<string, unknown>): void;
  update: (structure: StructureLike, options?: Record<string, unknown>) => void;
  setData: (
    structure: StructureLike,
    partial: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => void;
  processing: {
    register: (
      structureType: string,
      definition: {
        structureType?: string;
        intervalMs: number;
        process: (s: StructureLike, context: unknown) => void;
      },
    ) => void;
    setEnabledAt?: (x: number, y: number, enabled: boolean) => void;
  };
  forEachOfType: (type: string, cb: (s: StructureLike) => void) => void;
  setSpritesheetIndex?: (structure: StructureLike, index: number) => void;
  setSpritesheetIndexAtCell?: (x: number, y: number, index: number) => void;
  setSpritesheetIndexByValue?: (
    structure: StructureLike,
    value: number,
    thresholds: number[],
  ) => void;

  // recipes.register(id, definition)
  // updateDefinition(structureTypeOrId, partial, options?)
  // registerVariant(baseStructureTypeOrId, variant, options?)
  // registerPlacementConfig(definition)
  // getAtCell(cellX, cellY)
  // getDefinitionByType(structureType)
  // getAvailableTypes()
  // getTypeById(structureId)
  // hasBuiltAtCell(cellX, cellY)
  // isBlockedByPlayerAtCell(cellX, cellY)
  // isLauncherAtCell(cellX, cellY)
  // isType(structure, structureId)
  // isTypeAtCell(cellX, cellY, structureId)
  // isLockedByType(structureType)
  // mapValueToSpritesheetIndex(value, thresholds)
  // setSpritesheetIndex(structure, index)
  // setSpritesheetIndexAtCell(cellX, cellY, index)
  // setSpritesheetIndexByValue(structure, value, thresholds)
  // setSpritesheetIndexByValueAtCell(cellX, cellY, value, thresholds)
  // updateData(structure, partial, options?)
  // buildAtCell(cellX, cellY, structureTypeOrId, options?)
  // removeAtCell(cellX, cellY, options?)
  // removeBetweenCells(startCellX, startCellY, endCellX, endCellY, options?)
  // removeAtCells(positions, options?)
  // processing.isEnabledAtCell(cellX, cellY)
  // processing.setEnabledAtCell(cellX, cellY, enabled)
}

export interface SandkitSprite {
  /**
   * Load a sprite from a URL path.
   * @param spriteId - Id used with {@link getById}.
   * @param path - URL or asset path to load.
   * @param options - Optional tint and load options.
   */
  load(spriteId: string, path: string, options?: SpriteLoadOptions): Promise<void>;
  /**
   * Load a sprite from the calling mod folder.
   * @param spriteId - Id used with {@link getById}.
   * @param relativePath - Path relative to the mod folder.
   * @param options - Optional tint and load options.
   */
  loadFromMod(spriteId: string, relativePath: string, options?: SpriteLoadOptions): Promise<void>;
  /**
   * Return a loaded sprite by id.
   * @param spriteId - Sprite id from {@link load} or {@link loadFromMod}.
   */
  getById(spriteId: string): LoadedSprite | undefined;
  /** Hide all player mod-attached sprites. */
  hideAllPlayerModSprites(): void;
  /**
   * Rotate all player mod-attached sprites by angle.
   * @param angle - Rotation in radians.
   */
  rotatePlayerModSprites(angle: number): void;
}

export type CanvasImageSource = { src: unknown };

/** Loaded sprite handle (runtime texture or display object). */
export type LoadedSprite = {
  imageAsset?: {
    image?: CanvasImageSource;
  };
};

/** Options for {@link load} and {@link loadFromMod}. */
export interface SpriteLoadOptions {
  /** Packed RGB tint applied after load. */
  tint?: number;
  [key: string]: unknown;
}
