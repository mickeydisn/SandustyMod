import { applyModifier } from "../../handler/index.ts";
import { type RegisterContext, registered } from "../registry.ts";

export function registerModifiers({ config }: RegisterContext): number {
    let n = 0;
    for (const m of config.modifiers ?? []) {
        if (!m?.id || registered.modifiers.has(m.id)) continue;
        if (applyModifier(m)) n++;
        registered.modifiers.add(m.id);
    }
    return n;
}
