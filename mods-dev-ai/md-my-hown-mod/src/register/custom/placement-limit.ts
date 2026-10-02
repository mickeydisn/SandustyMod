import { api } from "../../packages/mysandkit.ts";
import { LOG, type ModConfig, type StructureConfig } from "../../constants.ts";

export interface Limit {
    id: string;
    name: string;
    max: number;
    ref: number | string;
}

function keysFor(limit: Limit): string[] {
    return limit.ref === limit.id ? [limit.id] : [limit.id, String(limit.ref)];
}

function capOf(st: StructureConfig): number | null {
    const n = st?.maxPlaced;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 1) return null;
    return Math.floor(n);
}

function buildLimitTable(config: ModConfig): Map<string, Limit> {
    const out = new Map<string, Limit>();
    for (const st of config.structures ?? []) {
        const id = typeof st?.id === "string" ? st.id.trim() : "";
        const max = capOf(st);
        if (!id || max === null) continue;
        const limit: Limit = {
            id,
            name: (typeof st.name === "string" && st.name.trim()) || id,
            max,
            ref: api.structures.getTypeById(id),
        };
        for (const k of keysFor(limit)) out.set(k, limit);
    }
    return out;
}

let unsubscribe: (() => void) | null = null;

export function installPlacementLimits(config: ModConfig): number {
    if (unsubscribe) {
        try {
            unsubscribe();
        } catch (e) {
            console.warn(`${LOG} could not detach the previous placement limit`, e);
        }
        unsubscribe = null;
    }

    const table = buildLimitTable(config);
    if (table.size === 0) {
        return 0;
    }

    const hooks = api.hooks;
    if (typeof hooks?.intercept !== "function") {
        console.warn(`${LOG} hooks.intercept missing — placement caps NOT enforced`);
        return 0;
    }
    try {
        const ret = hooks.intercept(
            "building:place",
            (args: { structureId?: number | string }, context: { cancel?: () => void }) => {
                const limit = table.get(String(args?.structureId ?? ""));
                if (!limit) return;

                const n = api.structures.countOfType(limit.ref);
                if (n === null) {
                    console.warn(
                        `${LOG} cannot count ${limit.id} — cap of ${limit.max} NOT enforced`,
                    );
                    return;
                }
                if (n >= limit.max) {
                    context.cancel?.();
                    api.ui.toast(`Only ${limit.max} × ${limit.name} allowed (${n} placed)`);
                    console.log(`${LOG} place cancelled — ${limit.id} ${n}/${limit.max}`);
                }
            },
        );
        unsubscribe = typeof ret === "function" ? (ret as () => void) : null;
    } catch (e) {
        console.error(`${LOG} placement limit hook failed`, e);
        return 0;
    }
    console.log(`${LOG} placement limits active for ${table.size} ref(s)`);
    return table.size;
}
