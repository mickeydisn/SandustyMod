
import { DRAW_FUNCTIONS } from "../../catalog.ts";
import * as S from "../styles.ts";

export interface DrawsProps {
    h: (...args: unknown[]) => unknown;
    cfg: Record<string, unknown>;
    onGoTo: (tab: string) => void;
}

interface StructureRow {
    id?: string;
    drawKey?: string;
}


export function usageOf(cfg: Record<string, unknown>, key: string): string[] {
    const structures = (cfg?.structures ?? []) as StructureRow[];
    return structures
        .filter((s) => s?.drawKey === key)
        .map((s) => String(s.id ?? "?"));
}


export function unknownDrawKeys(cfg: Record<string, unknown>): string[] {
    const known = new Set(DRAW_FUNCTIONS.map((d) => d.key));
    const structures = (cfg?.structures ?? []) as StructureRow[];
    return [
        ...new Set(
            structures
                .map((s) => s?.drawKey)
                .filter((k): k is string => !!k && !known.has(k)),
        ),
    ];
}

export function renderDraws(props: DrawsProps): unknown {
    const { h, cfg, onGoTo } = props;
    const unknown = unknownDrawKeys(cfg);
    const jump = (id: string) =>
        h(
            "button",
            {
                key: id,
                type: "button",
                style: { ...S.tagChip, cursor: "pointer" },
                title: `Go to structure ${id}`,
                onClick: () => onGoTo("structures"),
            },
            id,
        );

    return h(
        "div",
        null,
        h(
            "div",
            { style: S.screenHead },
            h("span", { style: S.screenTitle }, "Custom draw"),
            h(
                "span",
                { style: S.screenBlurb },
                "How a structure is painted. These are the only draw functions that reach the game.",
            ),
            h("span", { style: S.chipCount }, `${DRAW_FUNCTIONS.length} available`),
        ),
        h(
            "div",
            { style: { padding: "8px 10px 4px 10px" } },
            h(
                "div",
                { style: { ...S.card, marginTop: 8 } },
                h("div", { style: S.sectionTitle }, "How this works"),
                h(
                    "div",
                    { style: S.hint },
                    "A draw function is real code in the mod, not something the game can read from " +
                        "JSON. A structure stores a name here; the mod looks that name up on this " +
                        "list and hands the engine the matching function. A name that is not on " +
                        "this list reaches nothing, and the structure draws exactly as it always " +
                        "did.",
                ),
            ),
            h(
                "div",
                { style: { ...S.card, marginTop: 8 } },
                h("div", { style: S.sectionTitle }, "Available draw functions"),
                ...DRAW_FUNCTIONS.map((d) => {
                    const used = usageOf(cfg, d.key);
                    return h(
                        "div",
                        {
                            key: d.key,
                            style: {
                                padding: "6px 0",
                                borderTop: "1px solid rgba(120,140,180,0.14)",
                            },
                        },
                        h(
                            "div",
                            {
                                style: {
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                    flexWrap: "wrap",
                                },
                            },
                            h("span", { style: { fontWeight: 600 } }, d.label),
                            h("span", { style: S.nativeItem }, d.key),
                            used.length
                                ? h("span", { style: S.tagChip }, `used by ${used.length}`)
                                : h("span", { style: S.hintBelow }, "not used yet"),
                        ),
                        h("div", { style: { ...S.hint, marginTop: 2 } }, d.doc),
                        used.length
                            ? h(
                                "div",
                                {
                                    style: {
                                        marginTop: 4,
                                        display: "flex",
                                        gap: 4,
                                        flexWrap: "wrap",
                                    },
                                },
                                ...used.map(jump),
                            )
                            : null,
                    );
                }),
            ),
            unknown.length
                ? h(
                    "div",
                    {
                        style: {
                            ...S.card,
                            marginTop: 8,
                            borderColor: "rgba(255,150,120,0.45)",
                        },
                    },
                    h("div", { style: S.sectionTitle }, "Names this build does not know"),
                    h(
                        "div",
                        { style: S.hint },
                        "These structures name a draw function that is not on the list above. The " +
                            "mod will not find it, so nothing changes when you pick it. Either the " +
                            "name is a typo, or it belongs to a newer build than the config was " +
                            "written for.",
                    ),
                    h(
                        "div",
                        { style: { marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" } },
                        ...unknown.map((k) =>
                            h(
                                "button",
                                {
                                    key: k,
                                    type: "button",
                                    style: { ...S.tagChip, cursor: "pointer" },
                                    onClick: () => onGoTo("structures"),
                                },
                                k,
                            )
                        ),
                    ),
                )
                : null,
        ),
    );
}
