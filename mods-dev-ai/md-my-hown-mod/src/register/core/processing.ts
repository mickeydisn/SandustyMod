import { LOG, type ProcessingConfig } from "../../constants.ts";
import { api } from "../../packages/mysandkit.ts";
import type { StructureProcessingDefinition } from "../../packages/mysandkit.ts";
import { compileEntryProcess } from "../../handler/processing/custom-process/index.ts";
import { type RegisterContext, registerEach } from "../registry.ts";

export function registerProcessing({ config, processes }: RegisterContext): number {
    return registerEach(config.processing, "processing", (entry) => {
        const raw = entry as Record<string, unknown>;
        const id = entry.id ?? "?";

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
        // The host throws a RangeError for a non-finite or non-positive
        // interval (extra-mod-runtime.js 779), so screen it here instead of
        // letting every such definition blow up at registration time.
        const intervalMs = rest.intervalMs;
        if (typeof intervalMs !== "number" || !Number.isFinite(intervalMs) || intervalMs <= 0) {
            console.warn(
                `${LOG} processing ${id}: intervalMs must be a finite number > 0, ` +
                    `got ${String(intervalMs)}. Skip.`,
            );
            return;
        }
        // The host also rejects async callbacks (line 781).
        if (rest.process.constructor?.name === "AsyncFunction") {
            console.warn(
                `${LOG} processing ${id}: process() must be synchronous. Skip.`,
            );
            return;
        }

        api.structures.processing.register(id ?? `${structureType}:process`, {
            ...rest,
            // narrowed by the guards above
            intervalMs,
            process: rest.process as StructureProcessingDefinition["process"],
        });
    });
}
