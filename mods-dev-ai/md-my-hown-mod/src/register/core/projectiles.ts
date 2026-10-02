import { LOG } from "../../constants.ts";
import { api } from "../../packages/mysandkit.ts";
import {
    compileProjectile,
    PROJECTILE_OPTION_STORE_KEY,
    projectileOptionOf,
} from "../../handler/processing/projectile-option/index.ts";
import { registerEach, type RegisterContext } from "../registry.ts";

export function registerProjectiles({ config }: RegisterContext): number {
    return registerEach(config.projectiles, "projectiles", (entry) => {
        try {
            const raw = entry as Record<string, unknown>;
            const id = entry.id ?? "?";

            const out: Record<string, unknown> = { ...raw };
            if (!out.sprite || !(out.sprite as { id?: unknown }).id) {
                out.sprite = { id: `${entry.id}-sprite`, ...(out.sprite as object || {}) };
            }

            if (typeof raw.getOptions === "function") {
                api.projectiles.register(out);
                return;
            }

            const { ref, problem } = projectileOptionOf(raw);
            if (problem) console.warn(`${LOG} projectile ${id}: ${problem}`);

            const compiled = compileProjectile(
                ref,
                (f) => console.warn(`${LOG} projectile ${id} option ${f.key} failed`, f.error),
            );
            if (compiled.problem) console.warn(`${LOG} projectile ${id}: ${compiled.problem}`);

            if (ref) out[PROJECTILE_OPTION_STORE_KEY] = ref;
            out.getOptions = compiled.getOptions;
            api.projectiles.register(out);
        } catch (e) {
            console.error(`${LOG} projectiles.register failed`, entry.id, e);
        }
    });
}