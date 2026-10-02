import { defineActions } from "../../engine/types.ts";
import { api } from "../../../packages/mysandkit.ts";
import { p } from "../../engine/registry/params.ts";
export const uiActions = defineActions({
    toast: {
        role: "feel",
        doc: "Shows a message. Set `text` in options.",
        type: "message",
        slots: ["signal", "trigger", "processing", "itemAction", "upgrade", "modifier"],
        scope: "global",
        params: [p("text", "Text", "text", { def: "Hello", required: true })],
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
