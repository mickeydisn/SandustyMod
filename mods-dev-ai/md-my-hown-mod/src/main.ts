/**
 * md-my-hown-mod — entry.
 *
 * When enabled: register all content definitions, then mount the configurator
 * panel as a plain injected component. The panel is always present and starts
 * minimized — no hotbar item, no selection, nothing to equip.
 */
import { onSettingsChange, readSettingRaw, runDisableCleanup } from "./packages/modkit.ts";
import { registerAll } from "./register/index.ts";
import { setBufferSource } from "./handler/actions/buffer/index.ts";
import { loadConfig } from "./config/store.ts";
import { LOG, MOD_ID, SETTINGS, STORAGE_KEYS, VERSION } from "./constants.ts";
import { mountPanel } from "./tool.ts";
import "./handler/index.ts"; // register handler keys for pickers

console.log(`${LOG} SCRIPT START v${VERSION}`);

/**
 * Whether the player has *explicitly* switched this mod off.
 *
 * `undefined` — the setting could not be read, or was never written — is
 * deliberately **not** `false`. `applyEnabled` treats false as "wipe the stored
 * config", and that is irreversible: the save it removes from is the only copy.
 * A setting we merely failed to read is not consent to delete anything, so the
 * mod stays enabled and says why.
 *
 * This is not hypothetical. The engine namespaces a mod's settings by its
 * `modinfo.json` id, and that id was `md-mod-school` while every call site in
 * this mod passes `MOD_ID` (`md-my-hown-mod`). The lookup therefore always
 * missed, the fallback read an unrelated *global* `enabled` field, and a mod
 * that was on could resolve to false and prune its own config on boot.
 */
function explicitlyDisabled(): boolean {
    const raw = readSettingRaw(MOD_ID, "enabled");
    if (raw === undefined) {
        console.warn(
            `${LOG} 'enabled' setting unreadable — staying enabled and keeping the stored config. ` +
                `If the mod really should be off, set it in the game's mod settings.`,
        );
        return false;
    }
    return raw === false || raw === "false" || raw === 0 || raw === "0";
}

function applyEnabled(enabled: boolean, reason: string): void {
    console.log(`${LOG} applyEnabled`, enabled, reason);
    if (!enabled) {
        // The panel is deliberately left alone. It was mounted once at boot and is
        // not unmounted, so switching the mod off prunes the stored config but the
        // panel stays on screen — see the note in `tool.ts`. Re-enabling is a reload.
        try {
            runDisableCleanup(MOD_ID, reason, STORAGE_KEYS);
        } catch (e) {
            console.warn(`${LOG} cleanup failed`, e);
        }
        console.log(`${LOG} disabled (panel remains mounted; reload to re-enable)`);
        return;
    }
    mountPanel();
}

try {
    const enabled = !explicitlyDisabled();

    // The one and only registration. Synchronous, before anything can await, and
    // before the engine's one-shot sync to the simulation worker. The comment
    // inside `registerAll` says why it has to be here and not later.
    if (enabled) registerAll();

    // Hand the buffer actions their slots, so a `bufferRead`/`bufferWrite` in a
    // process resolves a path against what the author declared in
    // Content → Buffer. Set here rather than imported there because the action
    // module cannot reach the config store itself — the store imports the handler
    // registry, which imports the action barrel, and the cycle would take the
    // whole mod down. See the note on `setBufferSource`.
    setBufferSource(() => loadConfig().buffers ?? []);

    applyEnabled(enabled, "boot");
    onSettingsChange(MOD_ID, SETTINGS, () => {
        // Re-read raw rather than trusting the defaulted object: this callback
        // can wipe the config, so it needs the same explicit-false rule as boot.
        applyEnabled(!explicitlyDisabled(), "config-change");
    });
    console.log(`${LOG} LOADED v${VERSION}`);
} catch (e) {
    console.error(`${LOG} INIT FAILED`, e);
}
