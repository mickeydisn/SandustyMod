import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const structureBehaviors = {
    registerConveyorType(id: string, options: unknown): boolean {
        try {
            const grouped = g()?.api?.structureBehaviors as
                | { registerConveyorType?: (id: string, options: unknown) => void }
                | undefined;
            if (typeof grouped?.registerConveyorType === "function") {
                grouped.registerConveyorType(id, options);
                return true;
            }
            const ns = g()?.api?.conveyors;
            if (typeof ns?.registerType !== "function") return false;
            ns.registerType(id, options);
            return true;
        } catch (e) {
            console.error(`${LOG} registerConveyorType failed`, id, e);
            return false;
        }
    },
    registerLauncherType(payload: unknown): boolean {
        try {
            const grouped = g()?.api?.structureBehaviors as
                | { registerLauncherType?: (payload: unknown) => void }
                | undefined;
            if (typeof grouped?.registerLauncherType === "function") {
                grouped.registerLauncherType(payload);
                return true;
            }
            const ns = g()?.api?.launchers;
            if (typeof ns?.registerType !== "function") return false;
            ns.registerType(payload);
            return true;
        } catch (e) {
            console.error(`${LOG} registerLauncherType failed`, e);
            return false;
        }
    },
};
