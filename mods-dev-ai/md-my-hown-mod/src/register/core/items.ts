import {
    api,
    type CompiledItemAction,
    setItemActionCompiler,
} from "../../packages/mysandkit.ts";
import { compileEntryProcess } from "../../handler/processing/custom-process/index.ts";
import { registerEach, type RegisterContext } from "../registry.ts";


setItemActionCompiler(
    (def) => compileEntryProcess(def, "itemAction") as unknown as CompiledItemAction,
);

export function registerItems({ config }: RegisterContext): number {
    return registerEach(config.items, "items", (it) => {
        api.items.register(it);
    });
}