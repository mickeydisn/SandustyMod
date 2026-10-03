import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const effects = {
    createParticlesAtWorld(
        x: number,
        y: number,
        options: { count?: number; [key: string]: unknown },
    ): void {
        try {
            g()?.api?.effects?.createParticlesAtWorld?.(x, y, options);
        } catch (e) {
            console.warn(`${LOG} effects.createParticlesAtWorld failed`, x, y, e);
        }
    },

    includes(effect: string): boolean {
        try {
            return g()?.api?.effects?.includes?.(effect) === true;
        } catch (e) {
            console.warn(`${LOG} effects.includes failed`, effect, e);
            return false;
        }
    },
};
