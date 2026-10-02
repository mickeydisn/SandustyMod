import { LOG } from "../../constants.ts";
import { api, normalizeElementPatch } from "../../packages/mysandkit.ts";
import { type RegisterContext, registerEach } from "../registry.ts";
import { noteElementVisibility } from "./element-picker.ts";

export function registerElements({ config }: RegisterContext): number {
    return registerEach(
        config.elements,
        "elements",
        (el) => {
            const res = api.elements.register(el);
            if (res === undefined) return false;
            const type = res.elementType;
            if (typeof type === "number") api.elements.addElementToDiscoveries(type);

            noteElementVisibility(type, el as Record<string, unknown>);

            const normalised = normalizeElementPatch(el as Record<string, unknown>);
            console.log(
                `${LOG} element ${el.id} type=${type} matterType ` +
                    `${JSON.stringify((el as { matterType?: unknown }).matterType)} ` +
                    `-> ${JSON.stringify(normalised.matterType)}`,
            );
        },
    );
}
