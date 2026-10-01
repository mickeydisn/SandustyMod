
import { api, g } from "./packages/mysandkit.ts";

declare const sandkit: {
    api: Record<string, any>;
    react?: any;
    state?: any;
    mods?: any;
    enums?: any;
};


export interface HostReactType {
    createElement: (...args: unknown[]) => unknown;
    useState: <S>(initial: S | (() => S)) => [S, (v: S | ((prev: S) => S)) => void];
    useEffect: (fn: () => void | (() => void), deps?: readonly unknown[]) => void;
    useRef: <T>(initial: T) => { current: T };
    useCallback: <T>(fn: T, deps?: readonly unknown[]) => T;
    useMemo: <T>(fn: () => T, deps?: readonly unknown[]) => T;
}


export const React = (sandkit as { react?: HostReactType }).react;
export const h = React?.createElement?.bind(React) as
    | ((...args: unknown[]) => unknown)
    | undefined;

export function safe<T>(fn: () => T, fallback: T | null = null): T | null {
    try {
        return fn();
    } catch {
        return fallback;
    }
}

export function toast(msg: string): void {
    api.toast(msg);
}


export function getSandkit(): typeof sandkit | any {
    return g() ?? null;
}
