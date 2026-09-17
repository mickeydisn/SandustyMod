/**
 * Run `fn`, swallowing errors into `fallback`.
 *
 * The engine api is optional at import time (mods are loaded in the sandbox and
 * some enums simply may not exist), so a failed probe must never crash a
 * builder.
 */
export function safe<T>(fn: () => T, fallback: T | null = null): T | null {
    try {
        return fn();
    } catch {
        return fallback;
    }
}
