
import { onSettingsChange, readSettingRaw, runDisableCleanup } from "./packages/modkit.ts";
import { registerAll } from "./register/index.ts";
import { setBufferSource } from "./handler/actions/buffer/index.ts";
import { configStore } from "./config/store.ts";
import { LOG, MOD_ID, SETTINGS, STORAGE_KEYS, VERSION } from "./constants.ts";
import { mountPanel } from "./tool.ts";
import "./handler/index.ts"; 

console.log(`${LOG} SCRIPT START v${VERSION}`);


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

    
    
    
    if (enabled) registerAll();

    
    
    
    
    
    
    setBufferSource(() => configStore.load().buffers ?? []);

    applyEnabled(enabled, "boot");

    onSettingsChange(MOD_ID, SETTINGS, () => {
        
        
        applyEnabled(!explicitlyDisabled(), "config-change");
    });
    console.log(`${LOG} LOADED v${VERSION}`);
} catch (e) {
    console.error(`${LOG} INIT FAILED`, e);
}
