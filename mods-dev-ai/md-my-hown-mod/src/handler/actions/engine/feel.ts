import { defineActions } from "../../core/types.ts";

/** Feel actions that need nothing from the host. */
export const engineFeelActions = defineActions({
    upgradeLog: {
        role: "feel",
        doc: "Prints the upgraded item and these options. Safe to leave on while testing.",
        fn: (payload, _ctx, options) => {
            console.log("[md-my-hown-mod:upgrade]", payload, options);
        },
    },
});