import { g } from "../host.ts";
import { LOG } from "../../../constants.ts";

export const assets = {
    getUrl(path: string): string | undefined {
        try {
            return g()?.api?.assets?.getUrl?.(path) as string | undefined;
        } catch (e) {
            console.warn(`${LOG} assets.getUrl failed`, path, e);
            return undefined;
        }
    },
};
