import { api, resolveElementRef } from "../../packages/mysandkit.ts";
import { type RegisterContext, registerEach } from "../registry.ts";

export function registerContacts({ config }: RegisterContext): number {
    return registerEach(config.contacts, "contacts", (c) => {
        api.reactions.registerContact({
            inputA: resolveElementRef(c.inputA),
            inputB: resolveElementRef(c.inputB),
            outputA: resolveElementRef(c.outputA),
            outputB: resolveElementRef(c.outputB),
            orientation: c.orientation,
        });
    });
}
