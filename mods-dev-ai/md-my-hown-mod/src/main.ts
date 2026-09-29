/**
 * md-my-hown-mod — entry.
 *
 * When enabled: register all content definitions, then mount the configurator
 * panel as a plain injected component. The panel is always present and starts
 * minimized — no hotbar item, no selection, nothing to equip.
 */
import { onSettingsChange, readSettings, runDisableCleanup } from "./packages/modkit.ts";
import { registerAll } from "./register/index.ts";
import { LOG, MOD_ID, SETTINGS, STORAGE_KEYS, VERSION } from "./constants.ts";
import { mountPanel } from "./tool.ts";
import "./handler/index.ts"; // register handler keys for pickers

console.log(`${LOG} SCRIPT START v${VERSION}`);

// TEMP. API-EXISTENCE PROBE — remove after auditing.
import { g } from "./packages/mysandkit.ts";
(function probeApiExistence() {
    // Does the module-scoped `sandkit` (a param the host injects) differ from
    // `globalThis.sandkit` (what `hostApi()` reads)? If they disagree, every
    // `hostNs(...)` call in the action system silently returns undefined.
    const scoped = g() as { api?: Record<string, unknown> } | undefined;
    const onGlobal = (globalThis as { sandkit?: { api?: unknown } }).sandkit;
    console.log(
        `${LOG} PROBE-PATHS scoped=${typeof scoped} scoped.api=${typeof scoped?.api} ` +
            `globalThis.sandkit=${typeof onGlobal} globalThis.sandkit.api=${typeof onGlobal?.api}`,
    );
    console.log(
        `${LOG} PROBE-GLOBALKEYS ${
            Object.keys(globalThis).filter((k) => /sandkit|modkit|sdk/i.test(k)).join(",") ||
                "(none)"
        }`,
    );

    const CHECKS = [
        "elements.getResolvedTypeAtCell", "elements.setVelocityAtCell",
        "elements.setDurationAtCell", "elements.convertToParticleAtCell",
        "elements.teleportBetweenCells", "elements.getVelocityAtCell",
        "elements.addParticleVelocityAtCell", "elements.getTypeAtCell",
        "elements.getIdByType", "elements.findFreeCellInStructure",
        "grid.mutate", "grid.isCellEmptyAtCell",
        "terrains.getTypeAtCell", "terrains.isTypeAtCell", "terrains.getIdByType",
        "terrains.removeAtCell", "terrains.getDataAtCell",
        "terrains.setHitPointsAtCell", "terrains.damageAtCell",
        "structures.isTypeAtCell", "structures.setData",
        "structures.isLauncherAtCell", "structures.hasBuiltAtCell",
        "structures.buildAtCell", "structures.isBlockedByPlayerAtCell",
        "structures.setSpritesheetIndexAtCell",
        "structures.setSpritesheetIndexByValueAtCell",
        "ui.toast", "effects.createParticlesAtWorld",
        "energy.consume", "energy.addAtCell",
        "tech.conservatory", "upgrades.setLevelById",
        "player.inventory", "projectiles.spawn",
    ];
    const api = scoped?.api as Record<string, Record<string, unknown>>;
    const lines: string[] = [];
    let missing = 0;
    for (const dotted of CHECKS) {
        const [ns, ...rest] = dotted.split(".");
        const member = rest.join(".");
        const node = api[ns] as Record<string, unknown> | undefined;
        const t = node === undefined ? "NO-NS" : typeof node[member];
        if (t !== "function") missing++;
        lines.push(`APICHECK ${dotted} = ${t}`);
    }
    // Also record the surface the grid writer actually exposes, since the element
    // family's atomicity depends on it.
    const writerProbe: string[] = [];
    try {
        const gmut = (api.grid as {
            mutate: (fn: (w: Record<string, unknown>) => void) => void;
        });
        writerProbe.push(`MUTATE type=${typeof gmut.mutate} arity=${gmut.mutate?.length}`);
        let called = 0;
        // `mutate` is documented as DEFERRED ("reads see the old grid until
        // mutations apply"), so the callback does not run synchronously. Record
        // the writer's real surface on the next macrotask instead.
        (globalThis as Record<string, unknown>).__writerProbe = writerProbe;
        gmut.mutate((w) => {
            called++;
            const seen = new Set<string>();
            let p = Object.getPrototypeOf(w);
            while (p && p !== Object.prototype) {
                for (const k of Object.getOwnPropertyNames(p)) seen.add(k);
                p = Object.getPrototypeOf(p);
            }
            writerProbe.push(
                `WRITER proto=${Object.getPrototypeOf(w)?.constructor?.name} ` +
                    `members=${[...seen].sort().join(",")}`,
            );
            writerProbe.push(
                `WRITER ns.elements=${typeof (w as { elements?: unknown }).elements} ` +
                    `ns.terrains=${typeof (w as { terrains?: unknown }).terrains}`,
            );
            const el = (w as { elements?: Record<string, unknown> }).elements;
            const tr = (w as { terrains?: Record<string, unknown> }).terrains;
            writerProbe.push(
                `WRITER elements=[${Object.getOwnPropertyNames(el ?? {}).sort().join(",")}] ` +
                    `terrains=[${Object.getOwnPropertyNames(tr ?? {}).sort().join(",")}]`,
            );
        });
        writerProbe.push(`MUTATE callbackInvokedSync=${called}`);
        setTimeout(() => {
            console.log(`${LOG} WRITERPROBE\n${writerProbe.join("\n")}`);
        }, 120);
    } catch (e) {
        writerProbe.push(`WRITER-ERROR ${(e as Error).message}`);
    }

    // Does `projectiles.getTypeFromId` / `spawnAtWorld` behave as act/index.ts assumes?
    try {
        const proj = api.projectiles as Record<string, unknown>;
        writerProbe.push(
            `PROJ getTypeFromId=${typeof proj.getTypeFromId} ` +
                `getTypeFromIdIn=${String((proj.getTypeFromId as { length?: number })?.length)} ` +
                `spawnAtWorld=${typeof proj.spawnAtWorld} ` +
                `spawnAtWorldArity=${String((proj.spawnAtWorld as { length?: number })?.length)}`,
        );
    } catch (e) {
        writerProbe.push(`PROJ-ERROR ${(e as Error).message}`);
    }
    console.log(
        `${LOG} APICHECK-BEGIN\n${lines.join("\n")}\n${writerProbe.join("\n")}\n` +
            `${LOG} APICHECK-END missing=${missing}/${CHECKS.length}`,
    );
})();

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
    const cfg = readSettings(MOD_ID, SETTINGS);
    const enabled = cfg.enabled !== false;

    // The one and only registration. Synchronous, before anything can await, and
    // before the engine's one-shot sync to the simulation worker. The comment
    // inside `registerAll` says why it has to be here and not later.
    if (enabled) registerAll();

    applyEnabled(enabled, "boot");
    onSettingsChange(MOD_ID, SETTINGS, (next) => {
        applyEnabled(next.enabled !== false, "config-change");
    });
    console.log(`${LOG} LOADED v${VERSION}`);
} catch (e) {
    console.error(`${LOG} INIT FAILED`, e);
}
