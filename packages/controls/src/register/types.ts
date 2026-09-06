import type { StructureOptions } from "../types.ts";

import type { ConfigValue } from "../types.ts";

/** Clamp `v` into the inclusive `[lo, hi]` range. */
export function clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
}

export interface RangeOptions extends StructureOptions {
    min: number;
    max: number;
    step?: number;
    initial?: number;
    layout?: "single" | "triple";
}

export interface LedOptions extends StructureOptions {
    onWhen?: ConfigValue;
    spriteIdOn?: string;
    intervalMs?: number;
    /** Emit on signals.sources when the LED state changes. Default true. */
    signalOutput?: boolean;
}

export interface GaugeOptions extends StructureOptions {
    min?: number;
    max?: number;
    steps?: number;
    intervalMs?: number;
    signalOutput?: boolean;
}

export interface DpadOptions extends StructureOptions {
    pathX?: string;
    pathY?: string;
    cycleOnClick?: boolean;
}

export interface TextOptions extends StructureOptions {
    promptTitle?: string;
    promptMessage?: string;
}

export interface CounterOptions extends StructureOptions {
    intervalMs?: number;
    digits?: number;
    signalOutput?: boolean;
}

export interface DisplayOptions extends StructureOptions {
    mode?: "spritesheet" | "data-only";
    thresholds?: number[];
    intervalMs?: number;
    signalOutput?: boolean;
}

export interface ToggleOptions extends StructureOptions {
    accumulate?: boolean;
    onValue?: ConfigValue;
    offValue?: ConfigValue;
}

export interface SelectorOptions extends StructureOptions {
    options: string[];
    exclusive?: boolean;
    cycleOnClick?: boolean;
}

export interface ButtonOptions extends StructureOptions {
    mode?: "set" | "pulse" | "increment";
    pressValue?: ConfigValue;
    pulseMs?: number;
    incrementBy?: number;
}