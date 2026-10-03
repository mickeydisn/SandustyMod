import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";
import { type SignalHandler } from "../types.ts";

export const signals = {
    registerTarget(
        kind: "targets" | "interactables" | "sender",
        target: string,
        handler: (...args: unknown[]) => unknown,
    ): boolean {
        try {
            const sig = g()?.api?.signals as
                | {
                    targets?: { register?: (t: string, h: SignalHandler) => void };
                    interactables?: { register?: (t: string, h: SignalHandler) => void };
                    registerSenderType?: (t: string, h: SignalHandler) => void;
                }
                | undefined;
            if (!sig) return false;
            if (kind === "targets") {
                if (typeof sig.targets?.register !== "function") return false;
                sig.targets.register(target, handler);
                return true;
            }
            if (kind === "interactables") {
                if (typeof sig.interactables?.register !== "function") return false;
                sig.interactables.register(target, handler);
                return true;
            }
            if (typeof sig.registerSenderType !== "function") return false;
            sig.registerSenderType(target, handler);
            return true;
        } catch (e) {
            console.error(`${LOG} signals.registerTarget failed`, kind, target, e);
            return false;
        }
    },
    setOutputAtCell(x: number, y: number, value: boolean): void {
        try {
            g()?.api?.signals?.setOutputAtCell?.(x, y, value);
        } catch (e) {
            console.warn(`${LOG} signals.setOutputAtCell failed`, x, y, e);
        }
    },
};
