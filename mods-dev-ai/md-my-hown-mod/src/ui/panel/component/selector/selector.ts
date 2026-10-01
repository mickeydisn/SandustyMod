

import type { Opt } from "../../../../catalog.ts";
import {
    listElements,
    listEnergyNetworkOpts,
    listItems,
    listLinkedClearance,
    listMaterialIds,
    listOutputTargets,
    listSpriteIds,
    listStructures,
    listTechIds,
    listTerrains,
    listUpgradeCategoryIds,
} from "../../../../catalog.ts";
import type { FieldSpec } from "../../../definition/types.ts";
import * as S from "../../../styles.ts";
import { formatIdList, parseIdList } from "../../../definition/values.ts";
import {
    applyChoice,
    countByOwner,
    countHidden,
    filterByOwner,
    filterByText,
    filterHidden,
    orphans as findOrphans,
    otherMods,
    type SelectorItem,
    type SelectorOwner,
    toSelectorItems,
} from "./selector-state.ts";


export interface SelectorReact {
    h: (...args: unknown[]) => unknown;
}


export interface SelectorState {
    
    open?: boolean;
    
    owner?: SelectorOwner;
    
    query?: string;
    
    showHidden?: boolean;
}


export function selectorKey(field: string, entryId: string | null): string {
    return entryId ? `${field}::${entryId}` : field;
}


export interface SelectorProps {
    react: SelectorReact;
    value: string;
    options: readonly Opt[];
    
    multiple: boolean;
    onChange: (value: string) => void;
    
    locked?: boolean;
    
    emptyHint?: string;
    
    placeholder?: string;
    
    state?: SelectorState;
    
    onState: (patch: SelectorState) => void;
}


function swatch(h: SelectorReact["h"], item: SelectorItem): unknown {
    if (!item.color) return null;
    return h("span", {
        key: `sw:${item.value}`,
        style: {
            
            
            width: 12,
            height: 12,
            borderRadius: 2,
            background: item.color,
            border: "1px solid rgba(255,255,255,0.4)",
            flex: "0 0 auto",
        },
    });
}


export const CONTENT_RESOLVERS: ReadonlySet<unknown> = new Set([
    listElements,
    listStructures,
    listItems,
    listTerrains,
    listSpriteIds,
    listMaterialIds,
    listEnergyNetworkOpts,
    listOutputTargets,
    listLinkedClearance,
    
    
    
    
    listTechIds,
    
    
    listUpgradeCategoryIds,
]);


export function isContentField(options: FieldSpec["options"]): boolean {
    if (typeof options === "function") return CONTENT_RESOLVERS.has(options);
    
    
    return false;
}


function ownerChips(
    h: SelectorReact["h"],
    owner: SelectorOwner,
    counts: Record<SelectorOwner, number>,
    mods: readonly string[],
    set: (patch: SelectorState) => void,
    
    hiddenCount: number,
    
    showHidden: boolean,
): unknown[] {
    const rows: [SelectorOwner, string, number, Record<string, unknown>, string][] = [
        ["game", "Game", counts.game, S.chipGame, "Only what the game ships"],
        ["all", "All", counts.all, S.chipOther, "Everything, including other mods"],
    ];
    return [
        h(
            "div",
            { style: { display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" } },
            ...rows.map(([key, label, n, style, title]) =>
                h(
                    "button",
                    {
                        key: `own:${key}`,
                        type: "button",
                        style: owner === key ? S.chipActive : style,
                        title,
                        onClick: () => set({ owner: key }),
                    },
                    label,
                    h("span", { style: S.chipCount }, String(n)),
                )
            ),
            
            
            owner === "own"
                ? h(
                    "span",
                    { style: { ...S.hint, fontSize: 10 } },
                    `showing your ${counts.own}`,
                )
                : h(
                    "button",
                    {
                        type: "button",
                        style: S.chip,
                        title: "Go back to only this mod's own objects",
                        onClick: () => set({ owner: "own" }),
                    },
                    "✕ only mine",
                ),
            
            
            mods.length
                ? h(
                    "span",
                    { style: { ...S.hint, fontSize: 10 } },
                    `+${mods.length}`,
                )
                : null,
            
            
            
            hiddenCount
                ? h(
                    "label",
                    {
                        key: "hidden-box",
                        style: {
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 3,
                            fontSize: 10,
                            opacity: 0.8,
                            cursor: "pointer",
                            marginLeft: "auto",
                        },
                        title: "Include objects marked hidden or kept out of the build menu",
                    },
                    h("input", {
                        type: "checkbox",
                        checked: showHidden,
                        style: { margin: 0 },
                        onChange: (e: { target: { checked: boolean } }) =>
                            set({ showHidden: e.target.checked }),
                    }),
                    `hidden (${hiddenCount})`,
                )
                : null,
        ),
    ].filter(Boolean) as unknown[];
}

export function renderSelector(props: SelectorProps): unknown {
    const { h } = props.react;
    const { value, options, multiple, onChange, locked, emptyHint, placeholder } = props;
    
    
    const { open = false, owner = "own", query = "", showHidden = false } = props.state ?? {};
    const setState = props.onState;

    const items = toSelectorItems(options);
    const selected = multiple ? parseIdList(value) : value ? [value] : [];
    const counts = countByOwner(items);
    
    
    
    
    const shown = filterByText(filterHidden(filterByOwner(items, owner), showHidden), query);
    const hiddenCount = countHidden(filterByOwner(items, owner));
    
    const missing = findOrphans(selected, items);
    const order = items.map((i) => i.value);
    const mods = otherMods(items);

    const commit = (next: readonly string[]) => {
        onChange(multiple ? formatIdList(next) : (next[0] ?? ""));
        if (!multiple) setState({ open: false });
    };
    const pick = (v: string) => commit(applyChoice(selected, v, multiple, order));
    const clear = (v: string) => commit(selected.filter((x) => x !== v));

    
    if (!open) {
        const chosen = selected
            .map((v) => items.find((i) => i.value === v))
            .filter((i): i is SelectorItem => !!i);
        return h(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: 4 } },
            h(
                "button",
                {
                    type: "button",
                    disabled: locked,
                    style: {
                        ...S.input,
                        cursor: locked ? "default" : "pointer",
                        textAlign: "left",
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        flexWrap: "wrap",
                        minHeight: 26,
                    },
                    title: locked ? "" : "Choose a value",
                    onClick: () => setState({ open: true }),
                },
                chosen.length
                    ? chosen.map((i) =>
                        h(
                            "span",
                            {
                                key: `sel:${i.value}`,
                                style: {
                                    ...S.tagChip,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 5,
                                },
                                title: i.value,
                            },
                            swatch(h, i),
                            i.label,
                        )
                    )
                    : h("span", { style: { color: "#7f90ad" } }, placeholder ?? "— none —"),
                h("span", { style: { marginLeft: "auto", fontSize: 10, color: "#7f90ad" } }, "▾"),
            ),
            
            ...missing.map((v) =>
                h(
                    "span",
                    {
                        key: `orphan:${v}`,
                        style: {
                            ...S.tagChip,
                            color: "#ffb08a",
                            borderColor: "rgba(255,150,120,0.5)",
                        },
                        title: "Not in the catalogue any more — the mod will not find it",
                    },
                    `${v}  no longer exists `,
                    locked ? null : h(
                        "button",
                        {
                            type: "button",
                            style: {
                                background: "none",
                                border: "none",
                                color: "inherit",
                                cursor: "pointer",
                            },
                            title: "Clear this reference",
                            onClick: () => clear(v),
                        },
                        "✕",
                    ),
                )
            ),
        );
    }

    
    return h(
        "div",
        {
            style: {
                display: "flex",
                flexDirection: "column",
                gap: 5,
                padding: 6,
                border: "1px solid rgba(120,140,180,0.3)",
                borderRadius: 5,
                background: "rgba(20,26,40,0.6)",
            },
        },
        h(
            "div",
            { style: { display: "flex", gap: 4, alignItems: "center" } },
            h("input", {
                type: "text",
                value: query,
                placeholder: "filter…",
                style: { ...S.input, flex: 1, minWidth: 80 },
                onChange: (e: { target: { value: string } }) => setState({ query: e.target.value }),
            }),
            h(
                "button",
                {
                    type: "button",
                    style: S.chip,
                    title: "Close",
                    onClick: () => {
                        setState({ open: false, query: "" });
                    },
                },
                "✕",
            ),
        ),
        ...ownerChips(h, owner, counts, mods, setState, hiddenCount, showHidden),
        h(
            "div",
            {
                style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    maxHeight: 170,
                    overflowY: "auto",
                },
            },
            ...shown.map((i) => {
                const on = selected.includes(i.value);
                return h(
                    "button",
                    {
                        key: `opt:${i.value}`,
                        type: "button",
                        style: {
                            
                            
                            
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            width: "100%",
                            padding: "3px 6px",
                            border: "1px solid transparent",
                            borderRadius: 3,
                            background: on ? "rgba(120,190,255,0.22)" : "transparent",
                            color: on ? "#ffffff" : "#d6e2f5",
                            cursor: "pointer",
                            textAlign: "left",
                        },
                        title: i.value,
                        onClick: () => pick(i.value),
                    },
                    swatch(h, i),
                    h(
                        "span",
                        {
                            style: {
                                flex: 1,
                                minWidth: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            },
                        },
                        i.label,
                    ),
                    
                    
                    
                    i.own ? null : h(
                        "span",
                        {
                            style: {
                                fontSize: 9,
                                opacity: 0.6,
                                flex: "0 0 auto",
                                padding: "0 4px",
                                border: "1px solid rgba(140,160,200,0.3)",
                                borderRadius: 2,
                            },
                        },
                        i.modId ?? "game",
                    ),
                    on ? h("span", { style: { fontSize: 10, flex: "0 0 auto" } }, "✓") : null,
                );
            }),
        ),
        shown.length === 0
            ? h(
                "div",
                { style: S.hint },
                items.length === 0
                    ? `Nothing to pick from yet — ${emptyHint ?? "no entries of this kind exist."}`
                    : "Nothing matches this filter.",
            )
            : null,
    );
}
