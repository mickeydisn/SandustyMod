import { LOG, type ProcessingConfig } from "../../constants.ts";
import { api } from "../../packages/mysandkit.ts";
import { compileEntryProcess } from "../../handler/custom-process/index.ts";
import { registerEach, type RegisterContext } from "../registry.ts";

export function registerProcessing({ config, processes }: RegisterContext): number {
    return registerEach(config.processing, "processing", (entry) => {
        const raw = entry as Record<string, unknown>;
        const id = entry.id ?? "?";

        // A hand-written process function is already runnable.
        if (typeof raw.process !== "function") {
            const compiled = compileEntryProcess(raw, "processing", processes);
            if (compiled.source.kind === "process" && compiled.expanded.length) {
                console.log(
                    `${LOG} processing ${id}: program from ${compiled.expanded.join(" → ")}`,
                );
            }
            if (compiled.skipped.length) {
                console.warn(
                    `${LOG} processing ${id}: unknown action ${compiled.skipped.join(", ")}`,
                );
            }
            if (compiled.unknownOptions.length) {
                console.warn(
                    `${LOG} processing ${id}: option no action declares ` +
                        `${compiled.unknownOptions.join(", ")} — the step runs on defaults`,
                );
            }
            raw.process = compiled.fn;
        }

        const { id: _id, handlerKey: _hk, ...rest } = raw as
            & Record<string, unknown>
            & ProcessingConfig;
        const { structureType } = rest as { structureType?: string };
        if (structureType === undefined) {
            console.warn(`${LOG} processing ${id}: missing structureType`);
            return;
        }
        if (typeof rest.process !== "function") {
            console.warn(
                `${LOG} processing ${id}: process() not a function ` +
                    `(JSON cannot store callbacks). Skip.`,
            );
            return;
        }

        api.structures.processing.register(id ?? `${structureType}:process`, rest);
    });
}