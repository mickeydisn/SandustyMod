import { LOG } from "../../constants.ts";
import { api } from "../../packages/mysandkit.ts";
import { compileEntryProcess } from "../../handler/custom-process/index.ts";
import { registerEach, type RegisterContext } from "../registry.ts";

export function registerSignals({ config, processes }: RegisterContext): number {
    return registerEach(config.signals, "signals", (def) => {
        const handler = compileEntryProcess(
            def as Record<string, unknown>,
            "signal",
            processes,
        ).fn;
        try {
            const kind = String(def.kind || "targets").toLowerCase();
            if (typeof handler !== "function") {
                console.warn(`${LOG} signal ${def.id}: no handler — stored only`);
                return;
            }
            const asKind = kind === "targets" || kind === "interactables"
                ? kind
                : kind === "sendertype" || kind === "sender"
                ? "sender"
                : null;
            if (asKind === null) {
                console.warn(`${LOG} signal ${def.id}: unknown kind ${def.kind}`);
                return;
            }
            if (
                !api.signals.registerTarget(
                    asKind,
                    def.target,
                    handler as (...args: unknown[]) => unknown,
                )
            ) {
                console.warn(`${LOG} signal ${def.id}: no ${asKind}.register on this build`);
            }
        } catch (e) {
            console.error(`${LOG} signals.register failed`, def.id, e);
        }
    });
}

export function registerTriggers({ config, processes }: RegisterContext): number {
    return registerEach(config.triggers, "triggers", (def) => {
        const handler = compileEntryProcess(
            def as Record<string, unknown>,
            "trigger",
            processes,
        ).fn;
        try {
            const tid = def.triggerId || def.id;
            if (typeof handler !== "function") {
                console.warn(`${LOG} trigger ${def.id}: no handler — stored only`);
                return;
            }
            api.triggers.register(tid, {
                interval: def.interval ?? 60,
                sequentialRuns: def.sequentialRuns ?? 1,
                extra: def.extra ?? {},
                callback: handler,
            });
        } catch (e) {
            console.error(`${LOG} triggers.register failed`, def.id, e);
        }
    });
}