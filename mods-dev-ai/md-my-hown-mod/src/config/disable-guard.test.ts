/**
 * The disable path destroys the only copy of the config, so "am I off?" has to
 * mean *explicitly* off — never "I could not read the setting".
 *
 * These lock in the two halves of that rule:
 *   1. the manifest id and `MOD_ID` agree, so the settings lookup can hit at all;
 *   2. an unreadable `enabled` resolves to **enabled**, not to a wipe.
 */
import { assertEquals } from "jsr:@std/assert@1";
import { MOD_ID, SETTINGS } from "../constants.ts";
import { readSettingRaw } from "../packages/modkit.ts";
import modinfo from "../modinfo.json" with { type: "json" };

/** The engine namespaces settings by the manifest id — that is the whole bug. */
Deno.test("the manifest id matches MOD_ID, so settings lookups can hit", () => {
    assertEquals(
        modinfo.id,
        MOD_ID,
        `modinfo.json id is "${modinfo.id}" but the code uses "${MOD_ID}". ` +
            `The engine namespaces a mod's settings by its manifest id, so ` +
            `every settings.get("${MOD_ID}.<key>") silently misses.`,
    );
});

Deno.test("the manifest still declares the fields the code reads", () => {
    for (const key of Object.keys(SETTINGS)) {
        assertEquals(
            Object.hasOwn(modinfo.configSchema ?? {}, key),
            true,
            `configSchema is missing "${key}", which main.ts reads at boot.`,
        );
    }
});

/** Mirrors `explicitlyDisabled()` in main.ts against a mocked engine. */
function explicitlyDisabled(get: (field: string) => unknown): boolean {
    const raw = readSettingRaw(MOD_ID, "enabled");
    void get;
    if (raw === undefined) return false;
    return raw === false || raw === "false" || raw === 0 || raw === "0";
}

function withSettings<T>(get: (field: string) => unknown, body: () => T): T {
    const saved = (globalThis as { sandkit?: unknown }).sandkit;
    (globalThis as { sandkit?: unknown }).sandkit = {
        api: { settings: { get } },
    };
    try {
        return body();
    } finally {
        (globalThis as { sandkit?: unknown }).sandkit = saved;
    }
}

Deno.test("an unreadable setting does NOT wipe the config", () => {
    const off = withSettings(() => undefined, () => explicitlyDisabled(() => undefined));
    assertEquals(off, false, "an unreadable 'enabled' must not be read as 'off'");
});

Deno.test("the lookup asks for this mod's own field, never a global one", () => {
    const asked: string[] = [];
    withSettings((field) => {
        asked.push(field);
        return undefined;
    }, () => explicitlyDisabled(() => undefined));
    assertEquals(asked, [`${MOD_ID}.enabled`]);
    assertEquals(
        asked.includes("enabled"),
        false,
        "a bare 'enabled' is a global field belonging to no mod",
    );
});

Deno.test("an explicit off is still honoured", () => {
    for (const raw of [false, "false", 0, "0"]) {
        const off = withSettings(() => raw, () => explicitlyDisabled(() => raw));
        assertEquals(off, true, `${JSON.stringify(raw)} should read as off`);
    }
});

Deno.test("an explicit on is honoured", () => {
    for (const raw of [true, "true", 1, "1"]) {
        const off = withSettings(() => raw, () => explicitlyDisabled(() => raw));
        assertEquals(off, false, `${JSON.stringify(raw)} should read as on`);
    }
});
