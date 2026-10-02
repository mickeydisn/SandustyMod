import { defineActions } from "../../engine/types.ts";
import { api } from "../../../packages/mysandkit.ts";
export const uiActions = defineActions({
    toast: {
        role: "feel",
        doc: "Shows a message. Set `text` in options.",
        fn: (_payload, _ctx, options) => {
            const text = (options as { text?: string } | null)?.text;
            if (!text) return;
            try {
                api.ui.toast(text);
            } catch (e) {
                console.warn("[md-my-hown-mod:feel] toast failed", e);
            }
        },
    },

    

});
