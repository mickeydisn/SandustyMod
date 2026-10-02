import { LOG } from "../../constants.ts";
import { api } from "../../packages/mysandkit.ts";
import { compileEntryProcess } from "../../handler/custom-process/index.ts";
import { registerEach, type RegisterContext } from "../registry.ts";

export function registerUpgradeCategories({ config }: RegisterContext): number {
    return registerEach(config.upgradeCategories, "upgradeCategories", (def) => {
        try {
            const { onUpgradeKey: _k, id: _id, ...rest } = def as Record<string, unknown>;
            const body: Record<string, unknown> = { ...rest, id: def.id };
            if (!body.name && !body.nameKey) {
                body.name = def.id;
                body.nameKey = `upgrades|${def.id}|name`;
            }
            api.upgrades.registerCategory(body);
        } catch (e) {
            console.error(`${LOG} upgrades.registerCategory failed`, def.id, e);
        }
    });
}

export function registerUpgrades({ config }: RegisterContext): number {
    return registerEach(config.upgrades, "upgrades", (def) => {
        try {
            const { id: _id, ...rest } = def as Record<string, unknown>;
            const compiled = compileEntryProcess(rest, "upgrade");
            if (compiled.skipped.length) {
                console.warn(
                    `${LOG} upgrade ${def.id}: unknown action ${compiled.skipped.join(", ")}`,
                );
            }
            api.upgrades.register({ ...rest, onUpgrade: compiled.fn });
        } catch (e) {
            console.error(`${LOG} upgrades.register failed`, def.id, e);
        }
    });
}