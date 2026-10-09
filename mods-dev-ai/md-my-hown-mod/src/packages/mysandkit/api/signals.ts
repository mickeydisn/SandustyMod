import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";
import type {
    SignalHandler,
    SignalInteractableHandler,
    SignalSenderReader,
} from "../host-types/signals.ts";
import type { StructureRef } from "../host-types/domain.d.ts";

/** Which signal surface a handler is being attached to. */
export type SignalKind = "targets" | "interactables" | "sender";

export const signals = {
    /**
     * Attach a handler to one of the host's three signal surfaces.
     *
     * `targets` and `interactables` receive the structure; `sender` receives
     * the structure and returns the outgoing value, so it takes the reader
     * shape instead of the handler shape.
     */
    registerTarget(
        kind: SignalKind,
        target: StructureRef,
        handler: SignalHandler,
    ): boolean {
        try {
            const sig = g()?.api?.signals as
                | {
                    targets?: {
                        register?: (t: StructureRef, h: SignalInteractableHandler) => void;
                    };
                    interactables?: {
                        register?: (t: StructureRef, h: SignalInteractableHandler) => void;
                    };
                    registerSenderType?: (t: StructureRef, h: SignalSenderReader) => void;
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
            sig.registerSenderType(target, handler as SignalSenderReader);
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
