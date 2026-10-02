import { defineActions } from "../../engine/types.ts";
import { api } from "../../../packages/mysandkit.ts";
import { anchorFor } from "../../engine/cell-region.ts";
export const projectilesActions = defineActions({
    itemShoot: {
        role: "act",
        doc: "Fires a projectile. Set `projectileId` and `velocity` in options.",
        fn: (payload, _ctx, options) => {
            const o = (options ?? {}) as { projectileId?: string; vx?: number; vy?: number };
            if (!o.projectileId) return;

            const at = anchorFor(payload);
            if (at.source === "none") {
                console.warn(
                    "[md-my-hown-mod:act] itemShoot: this call site gave no position and " +
                        "there is no cursor to read, so nothing was fired",
                );
                return;
            }
            try {
                const blueprint = api.projectiles.createBlueprintFromId(o.projectileId);
                if (!blueprint) {
                    console.warn(
                        `[md-my-hown-mod:act] itemShoot: no projectile registered as ` +
                            `"${o.projectileId}", so nothing was fired`,
                    );
                    return;
                }
                const vx = o.vx ?? 0;
                const vy = o.vy ?? 0;

                const angle = vx === 0 && vy === 0 ? 0 : Math.atan2(vy, vx);
                api.projectiles.spawnAtWorld(at.x, at.y, angle, blueprint);
            } catch (e) {
                console.warn("[md-my-hown-mod:act] shoot failed", e);
            }
        },
    },

});
