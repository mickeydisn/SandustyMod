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

/*
const DirectionIndex = {
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "sides"
  | "cross";
}
*/

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
