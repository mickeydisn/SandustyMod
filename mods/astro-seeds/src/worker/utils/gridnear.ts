import { TElementType } from "../../shared/elementTypes.ts";
import { Grid } from "./grid.ts";

export const NEIGH8: readonly [number, number][] = [
  [-1, -1], // L U
  [0, -1], // U
  [1, -1], // R up
  [-1, 0], // L
  [1, 0], // R
  [-1, 1], //
  [0, 1],
  [1, 1],
];

export interface IDelta {
  x: number;
  y: number;
}

export enum MoveDirection {
  UP = 0,
  RIGHT_UP = 1,
  RIGHT = 2,
  RIGHT_DOWN = 3,
  DOWN = 4,
  LEFT_DOWN = 5,
  LEFT = 6,
  LEFT_UP = 7,
}
export enum MoveDirectionCross {
  UP = 0,
  RIGHT = 2,
  DOWN = 4,
  LEFT = 6,
}

export const DELTAS_INDEX: IDelta[] = [
  { x: 0, y: -1 }, // UP
  { x: 1, y: -1 }, // RIGHT_UP
  { x: 1, y: 0 }, // RIGHT
  { x: 1, y: 1 }, // RIGHT_DOWN
  { x: 0, y: 1 }, // DOWN
  { x: -1, y: 1 }, // LEFT_DOWN
  { x: -1, y: 0 }, // LEFT
  { x: -1, y: -1 }, // LEFT_UP
];

export type DirectionName =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "sides"
  | "cross";

export const DIR_NAME_MAP: Record<DirectionName, MoveDirection[]> = {
  top: [MoveDirection.UP],
  bottom: [MoveDirection.DOWN],
  left: [MoveDirection.LEFT],
  right: [MoveDirection.RIGHT],
  sides: [
    MoveDirection.LEFT,
    MoveDirection.RIGHT,
  ],
  cross: [
    MoveDirection.RIGHT_UP,
    MoveDirection.RIGHT_DOWN,
    MoveDirection.LEFT_UP,
    MoveDirection.LEFT_DOWN,
  ],
};

export const dirDelta = (dir: MoveDirection) => {
  return DELTAS_INDEX[dir];
};
export const dirInversedDelta = (dir: MoveDirection) => {
  const delta = DELTAS_INDEX[dir];
  return { x: -delta.x, y: -delta.y };
};

export const GridNear = {
  // Touching
  isNearEmpty(
    x: number,
    y: number,
    deltas: IDelta[] = DELTAS_INDEX,
  ): boolean {
    for (const d of deltas) {
      if (Grid.isEmptyAt(x + d.x, y + d.y)) return true;
    }
    return false;
  },
  isNear(
    x: number,
    y: number,
    includeType: TElementType[] | TElementType,
    deltas: IDelta[] = DELTAS_INDEX,
  ): boolean {
    for (const d of deltas) {
      if (Grid.isTypeAt(x + d.x, y + d.y, includeType)) return true;
    }
    return false;
  },
  isNotNear(
    x: number,
    y: number,
    excludeType: TElementType[] | TElementType,
    deltas: IDelta[] = DELTAS_INDEX,
  ): boolean {
    for (const d of deltas) {
      if (Grid.isNotTypeAt(x + d.x, y + d.y, excludeType)) return true;
    }
    return false;
  },

  firstNotNear(
    x: number,
    y: number,
    excludeType: TElementType[] | TElementType,
    deltas: IDelta[] = DELTAS_INDEX,
  ): TElementType | null {
    for (const d of deltas) {
      if (Grid.isNotTypeAt(x + d.x, y + d.y, excludeType)) {
        return Grid.getTypeAt(x + d.x, y + d.y);
      }
    }
    return null;
  },

  countNearEmpty(
    x: number,
    y: number,
    deltas: IDelta[] = DELTAS_INDEX,
  ): number {
    let n = 0;
    for (const d of deltas) {
      if (Grid.isEmptyAt(x + d.x, y + d.y)) n++;
    }
    return n;
  },
  countNear(
    x: number,
    y: number,
    includeType: TElementType[] | TElementType,
    deltas: IDelta[] = DELTAS_INDEX,
  ): number {
    let n = 0;
    for (const d of deltas) {
      if (Grid.isTypeAt(x + d.x, y + d.y, includeType)) n++;
    }
    return n;
  },
  countNotNear(
    x: number,
    y: number,
    excludeType: TElementType[] | TElementType,
    deltas: IDelta[] = DELTAS_INDEX,
  ): number {
    let n = 0;
    for (const d of deltas) {
      if (Grid.isNotTypeAt(x + d.x, y + d.y, excludeType)) n++;
    }
    return n;
  },
};
