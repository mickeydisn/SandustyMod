import { g } from "../host.ts";

export const i18n = {
    register(locale: string, map: Record<string, string>) {
        try {
            g()?.api?.i18n?.register?.(locale, map);
        } catch {}
    },
};
