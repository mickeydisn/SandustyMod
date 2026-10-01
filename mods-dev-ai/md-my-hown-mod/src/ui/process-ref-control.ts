
import {
    currentProcessRegistry,
    processProblem,
    processUsageCounts,
} from "../handler/custom-process/index.ts";
import { type HandlerSlot, TAB_TO_CALL_SITE } from "../handler/core/handler-registry.ts";
import { CALL_SITE_LABELS, CALL_SITE_SIGNATURES } from "../handler/core/types.ts";
import { PROCESS_FORM_KEY } from "./definition/process-ref-field.ts";
import * as S from "./styles.ts";
import type { FieldContext, Tab } from "./definition/types.ts";


function slotOf(tab: Tab | undefined): HandlerSlot | undefined {
    return tab ? TAB_TO_CALL_SITE[tab] : undefined;
}

export function renderProcessRef(ctx: FieldContext): unknown {
    const { h, form, cfg, setField, error, locked, tab } = ctx;
    const key = form[PROCESS_FORM_KEY] ?? "";
    const legacyCount = form[`${PROCESS_FORM_KEY}__legacy`] ?? "";
    const registry = currentProcessRegistry();
    const slot = slotOf(tab);
    const used = processUsageCounts((cfg ?? {}) as Record<string, unknown>);

    
    
    const offered = slot ? registry.forSlot(slot) : registry.all();
    const chosen = key ? registry.get(key) : undefined;
    
    
    const unknown = !!key && !chosen;
    const mine = chosen ? used[chosen.id] ?? 0 : 0;

    return h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: 6 } },
        h(
            "select",
            {
                key: "ref",
                style: { ...S.input, cursor: locked ? "default" : "pointer" },
                value: key,
                disabled: locked,
                onChange: (e: { target: { value: string } }) =>
                    setField(PROCESS_FORM_KEY, e.target.value),
            },
            h("option", { value: "" }, "— no process —"),
            unknown ? h("option", { value: key }, `${key} (missing)`) : null,
            ...offered.map((p) => {
                const n = used[p.id] ?? 0;
                return h(
                    "option",
                    { key: p.id, value: p.id },
                    `${p.name ?? p.id}${n > 0 ? `  (used ×${n})` : ""}`,
                );
            }),
        ),
        legacyCount
            ? h(
                "div",
                { style: { ...S.noteBox, borderColor: "#e67e22" } },
                h(
                    "div",
                    { style: S.label },
                    `This entry still stores ${legacyCount} action(s) inline.`,
                ),
                h(
                    "div",
                    { style: S.hint },
                    "That is the old format, and it still runs as-is. Pick a process above " +
                        "to convert it — after which editing that process on the Processes " +
                        "tab would change every entry that uses it.",
                ),
            )
            : null,
        chosen
            ? h(
                "div",
                { style: S.noteBox },
                h("div", { style: S.label }, chosen.name ?? chosen.id),
                h(
                    "div",
                    { style: S.hint },
                    `${CALL_SITE_LABELS[chosen.scope]} · ${CALL_SITE_SIGNATURES[chosen.scope]} · ` +
                        `${chosen.steps.length} step(s)` +
                        (mine > 0 ? ` · used ×${mine}` : " · unused"),
                ),
                chosen.doc ? h("div", { style: S.hint }, chosen.doc) : null,
                
                
                chosen.derived
                    ? h(
                        "div",
                        { style: S.hint },
                        `Converted from the action list on "${chosen.derivedFrom}". Rename ` +
                            "it to reuse it elsewhere.",
                    )
                    : null,
            )
            : null,
        
        
        key && !chosen ? h("div", { style: S.errorText }, `No process named "${key}".`) : null,
        key && chosen && slot && processProblem(registry, key, slot)
            ? h(
                "div",
                { style: S.errorText },
                `Built for ${chosen.scope}, but a ${CALL_SITE_LABELS[slot].toLowerCase()} ` +
                    `only runs processes built for ${chosen.scope}.`,
            )
            : null,
        error ? h("div", { style: S.errorText }, error) : null,
    );
}
