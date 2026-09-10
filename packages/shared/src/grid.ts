export type Point = { x: number; y: number };

export type Size = {
    width: number;
    height: number;
};

export enum CrossDirection {
    UP = 0,
    RIGHT = 2,
    DOWN = 4,
    LEFT = 6,
}

export enum Direction {
    UP = 0,
    RIGHT_UP = 1,
    RIGHT = 2,
    RIGHT_DOWN = 3,
    DOWN = 4,
    LEFT_DOWN = 5,
    LEFT = 6,
    LEFT_UP = 7,
}

export type DirectionName =
    | "top"
    | "bottom"
    | "left"
    | "right"
    | "sides"
    | "cross";

/** Relative step on the grid — an alias of `Point` for delta call sites. */
export type IDelta = Point;

/** 8-compass delta for each `Direction` heading, indexed by heading value. */
export const DELTAS_INDEX: Point[] = [
    { x: 0, y: -1 }, // UP
    { x: 1, y: -1 }, // RIGHT_UP
    { x: 1, y: 0 }, // RIGHT
    { x: 1, y: 1 }, // RIGHT_DOWN
    { x: 0, y: 1 }, // DOWN
    { x: -1, y: 1 }, // LEFT_DOWN
    { x: -1, y: 0 }, // LEFT
    { x: -1, y: -1 }, // LEFT_UP
];

/** Which compass headings each `DirectionName` expands to. */
export const DIR_NAME_MAP: Record<DirectionName, Direction[]> = {
    top: [Direction.UP],
    bottom: [Direction.DOWN],
    left: [Direction.LEFT],
    right: [Direction.RIGHT],
    sides: [Direction.LEFT, Direction.RIGHT],
    cross: [
        Direction.RIGHT_UP,
        Direction.RIGHT_DOWN,
        Direction.LEFT_UP,
        Direction.LEFT_DOWN,
    ],
};
