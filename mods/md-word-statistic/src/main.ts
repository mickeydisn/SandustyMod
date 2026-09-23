/**
 * md-word-statistic — entry point.
 *
 * Registers a hotbar tool. While the tool is selected, a global UI overlay
 * shows four tabs (Home / Structures / Elements / Terrains) with per-type
 * counts of items present on the world grid. Refresh re-scans the map.
 */
import { LOG, VERSION } from "./constants.ts";
import { registerTool } from "./tool.ts";

try {
    await registerTool();
    console.log(`${LOG} v${VERSION} loaded`);
} catch (e) {
    console.error(`${LOG} init failed`, e);
}
