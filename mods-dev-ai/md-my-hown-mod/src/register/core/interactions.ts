import { LOG } from "../../constants.ts";
import { api, resolveElementRef } from "../../packages/mysandkit.ts";
import { type RegisterContext, registerEach } from "../registry.ts";

export function registerInteractions({ config }: RegisterContext): number {
    return registerEach(config.interactions, "interactions", (ix) => {
        const el = resolveElementRef(ix.elementId);
        if (el === undefined || el === null) {
            console.warn(`${LOG} interaction ${ix.id}: bad elementId`);
            return;
        }
        api.elements.addInteractionInfo(el as string | number, ix.interaction);
    });
}
