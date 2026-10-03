import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const input = {
    getMouseCellPosition(): { x: number; y: number } | null {
        try {
            return (g()?.api?.input?.getMouseCellPosition?.() as
                | { x: number; y: number }
                | null
                | undefined) ?? null;
        } catch (e) {
            console.warn(`${LOG} input.getMouseCellPosition failed`, e);
            return null;
        }
    },
    registerBinding(
        bindingId: string,
        defaultKeys: readonly string[],
        definition: Record<string, unknown>,
    ): void {
        try {
            g()?.api?.input?.registerBinding?.(bindingId, defaultKeys, definition);
        } catch (e) {
            console.warn(`${LOG} input.registerBinding failed`, bindingId, e);
        }
    },
};
