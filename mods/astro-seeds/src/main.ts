/**
 * Main-thread entry — elements, reactions, config panel.
 */
import "@sandmd/sandkit";

import { MOD_ID, VERSION } from "./config/ids.ts";
import { pushBuffer } from "../../../__archive/panel.ts";
import { registerI18n } from "./main/i18n.ts";
import { registerElement } from "./main/register.ts";
import { safe } from "./shared/utils.ts";

try {
    const api = sandkit.api;
    // CALL i18nRegister
    registerI18n();

    // Register Element
    registerElement();

    // mountPanel();
    pushBuffer();

    // MESSAGE TO USER
    safe(() =>
        api.events.on("game:ready", () => {
            api.ui.toast(`Astro Seeds v${VERSION} — Alt+A panel`, {});
        })
    );
    console.log(`[${MOD_ID} v${VERSION}] main loaded `);
} catch (e) {
    console.log(e);
}
/*  */
