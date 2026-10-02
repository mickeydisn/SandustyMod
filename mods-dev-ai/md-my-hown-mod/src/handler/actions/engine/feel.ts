import { defineActions } from "../../engine/types.ts";


export const engineFeelActions = defineActions({
    upgradeLog: {
        role: "feel",
        needs: [],
        doc: "Prints the upgraded item and these options. Safe to leave on while testing.",
        type: "tech", slots: ["upgrade"], scope: "item", params: [],
        fn: (payload, _ctx, options) => {
            console.log("[md-my-hown-mod:upgrade]", payload, options);
        },
    },
});