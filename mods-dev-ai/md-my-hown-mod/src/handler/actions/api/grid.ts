import { defineActions } from "../../engine/types.ts";
import { api } from "../../../packages/mysandkit.ts";
import { anchorFor } from "../../engine/cell-region.ts";
import { p } from "../../engine/registry/params.ts";
export const gridActions = defineActions({
    itemExcavate: {
        role: "act",
        needs: ["pos"],
        doc: "Digs at this position. Set `damage` and `velocity` in options.",
        type: "message",
        
        slots: ["signal", "processing", "modifier", "itemAction"],
        scope: "cell",
        itemTypes: ["Tool"],
        params: [
        p("profileId", "Excavation profile", "text", {
        hint: "falls back to the item's excavationProfileId",
        }),
        p("power", "Power", "number", { def: "10", min: 0 }),
        ],
        fn: (payload, _ctx, options) => {
            const o = (options ?? {}) as { damage?: number; vx?: number; vy?: number };

            const at = anchorFor(payload);
            if (at.source === "none") {
                console.warn(
                    "[md-my-hown-mod:act] itemExcavate: this call site gave no position and " +
                        "there is no cursor to read, so nothing was dug",
                );
                return;
            }
            try {
                api.grid.excavateAtCell(
                    at.x,
                    at.y,
                    { x: o.vx ?? 0, y: o.vy ?? 0 },
                    o.damage ?? 1,
                );
            } catch (e) {
                console.warn("[md-my-hown-mod:act] excavate failed", e);
            }
        },
    },

});
