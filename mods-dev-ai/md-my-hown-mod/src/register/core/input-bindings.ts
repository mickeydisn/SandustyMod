import { LOG } from "../../constants.ts";
import { api } from "../../packages/mysandkit.ts";
import { compileProcess, optionKeysFor } from "../../handler/index.ts";
import { registerEach, type RegisterContext } from "../registry.ts";

export function registerInputBindings({ config }: RegisterContext): number {
    return registerEach(config.inputBindings, "inputBindings", (b) => {
        try {
            const entry = { ...b } as Record<string, unknown>;
            for (const slot of ["onDownKey", "onUpKey"] as const) {
                const key = b[slot];
                if (!key) continue;
                const { fn, skipped } = compileProcess(
                    [{ key, options: undefined }],
                    "behavior",
                    undefined,
                    optionKeysFor,
                );
                if (typeof fn === "function" && !skipped.length) entry[slot] = fn;
                else console.warn(`${LOG} input binding ${b.id}: unknown ${slot} "${key}"`);
            }

            const handlers: Record<string, Function> = {};
            if (typeof entry.onDownKey === "function") handlers.down = entry.onDownKey;
            if (typeof entry.onUpKey === "function") handlers.up = entry.onUpKey;

            const definition: Record<string, unknown> = {
                displayName: b.displayName,
                category: b.category,
                handlers,
            };
            if (b.displayNameKey) definition.displayNameKey = b.displayNameKey;
            if (b.subsection) definition.subsection = b.subsection;

            api.input.registerBinding(b.id, b.defaultKeys ?? [], definition);
        } catch (e) {
            console.error(`${LOG} input.registerBinding failed`, b.id, e);
        }
    });
}