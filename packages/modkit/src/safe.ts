/** Run `fn`, returning `fallback` when it throws (engine bridges may be absent). */
export function safe<T>(fn: () => T, fallback: T | null = null): T | null {
    try {
        return fn();
    } catch {
        return fallback;
    }
}
