/**
 * The content-object selector, and the one place a field picks a content id.
 *
 * Rendered for a `select` or a `multiselect` whose options name real content
 * objects — see `selectorOpts` in this file for how that is decided, and
 * `panel.ts` for where it is called from. Everything here is presentation; the
 * decisions live in `selector-state.ts` beside it, free of React so they can be
 * tested directly.
 *
 * **The menu is closed by default, and the filter defaults to "This mod".** A
 * form field is not a browser: it is a slot in a form the user is already
 * scrolling past, and a permanently open 200-row menu turns a one-line field into
 * a wall. So the collapsed state shows the choice and nothing else, and the
 * default filter hides the game's fifty elements behind a chip that says how many
 * they are. Hiding is always visible and always reversible — the counts are on
 * screen whether or not anything is filtered, and clicking is the way back.
 *
 * `h` and the hooks are threaded in from the host React rather than imported,
 * because the engine supplies React at runtime (`api.react`) and the rest of the
 * panel already does this. A hard import would bind a second copy.
 */

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

/** The host's React. Only `h` is needed — see the note on hooks below. */
export interface SelectorReact {
    h: (...args: unknown[]) => unknown;
}

/**
 * All of a selector's mutable UI state, held by whoever is *not* a hook.
 *
 * ## Why this is not a component
 *
 * The obvious way to write this is a React component with its own `useState`.
 * **That crashes the panel** — React error #310, "Rendered more hooks than during
 * the previous render" — and the reason is structural, not a slip.
 *
 * Every other control here (`renderActionList`, `renderProjectileOption`,
 * `paramInput`) is a *plain function* called during the panel's render, not a
 * component that React mounts. The panel builds its form with
 * `sec.fields.map((f) => renderField(f))`, so a `useState` inside a control
 * registers on the **panel's** hook slot. A form's field list is not fixed: it
 * changes with the tab, with `when()` on a field, and with `isActive`. Two renders
 * with different field sets produce different hook counts, and React throws — with
 * the minified error pointing at the panel rather than at this file.
 *
 * So the open/closed and filter state lives in the panel, keyed by field, and
 * arrives here as a plain object. `renderSelector` is a pure function of
 * `(props, state) -> element`, exactly like its neighbours.
 */
export interface SelectorState {
    /** The menu is open. Absent means closed — a selector starts collapsed. */
    open?: boolean;
    /** Which owner bucket is showing. Defaults to "own" when absent. */
    owner?: SelectorOwner;
    /** The search text. */
    query?: string;
    /**
     * Show the objects that are deliberately out of normal use: an element
     * marked `hidden`, a structure marked `hideFromBuildMenu`.
     *
     * Defaults to **off**, and the state is remembered per field so a tick on one
     * picker does not open every other one.
     */
    showHidden?: boolean;
}

/** A key for the panel's per-field selector state. */
export function selectorKey(field: string, entryId: string | null): string {
    return entryId ? `${field}::${entryId}` : field;
}

/** What the selector renders for, and what it may change. */
export interface SelectorProps {
    react: SelectorReact;
    value: string;
    options: readonly Opt[];
    /** True for a `multiselect`: pick several rather than one. */
    multiple: boolean;
    onChange: (value: string) => void;
    /** True while the entry is read-only; the selector still shows the choice. */
    locked?: boolean;
    /** Shown when there is nothing at all to pick from. */
    emptyHint?: string;
    /** Placeholder for the collapsed, unchosen state. */
    placeholder?: string;
    /**
     * This selector's UI state, read from the panel. Absent means "default" —
     * closed, filtered to this mod, no search text.
     */
    state?: SelectorState;
    /** Ask the panel to change the state. `(partial)` merges into it. */
    onState: (patch: SelectorState) => void;
}

/** A colour swatch, or nothing when the object has no colour to show. */
function swatch(h: SelectorReact["h"], item: SelectorItem): unknown {
    if (!item.color) return null;
    return h("span", {
        key: `sw:${item.value}`,
        style: {
            // 12px in a row, against 10px in a chip: a row has room for it, and the
            // swatch is the fastest way to tell two same-named entries apart.
            width: 12,
            height: 12,
            borderRadius: 2,
            background: item.color,
            border: "1px solid rgba(255,255,255,0.4)",
            flex: "0 0 auto",
        },
    });
}

/**
 * The catalogue resolvers that return **content objects** — elements,
 * structures, items, terrains, sprites, energy networks — as opposed to a closed
 * set of values the engine itself defines.
 *
 * Membership here is the one thing that decides whether a field gets the content
 * selector, so it is listed explicitly rather than inferred from the data. An
 * earlier version guessed from the shape of the options — "has a colour, or a
 * dot in the id" — and it was wrong in the direction that matters: with only
 * `Furnace` and `Sand` defined, *every* game object is unnamespaced and most
 * carry no swatch, so the guess rejected the game's own content objects and only
 * accepted namespaced ones. The fields that quietly kept the old picker were
 * exactly the most-used ones: `behaviors.structureId`, `energy.structureId`,
 * `processing.structureType`.
 *
 * A resolver is a member because of what it *returns*, and no amount of looking
 * at one game's worth of results can tell you that. `listMatterTypes` and
 * `listKeyCodes` are not content; `listStructures` is, whether or not anything is
 * registered yet.
 */
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
    // A tech is an engine object — `registerTech` really is called, and the node
    // the player researches is the engine's. `listTechIds` reads the mod's config
    // rather than a registry, because the engine offers no way to enumerate techs,
    // but what it lists is still content.
    listTechIds,
    // Upgrade categories are mod-owned and registered via
    // `api.upgrades.registerCategory`, so `registerAll` does hand them over.
    listUpgradeCategoryIds,
]);

/** True when this field's options come from a content resolver. */
export function isContentField(options: FieldSpec["options"]): boolean {
    if (typeof options === "function") return CONTENT_RESOLVERS.has(options);
    // A literal array cannot be a resolver, so it is a fixed list — an enum, a
    // handler key, a machine type. Never content.
    return false;
}

/**
 * The owner filter row: Game / All, with counts.
 *
 * **No "This mod" chip.** This mod is what you get by default, so a button that
 * only ever selects the state the menu opened in is a control that teaches
 * nothing and costs a click to dismiss. The other two are the states you have to
 * *move to*, so they are the ones worth a chip.
 *
 * The default is still visible where it is honest: the counts, and the per-row
 * owner tag on anything that is not this mod's. Those say what is hidden without
 * a button that only ever re-selects it.
 */
function ownerChips(
    h: SelectorReact["h"],
    owner: SelectorOwner,
    counts: Record<SelectorOwner, number>,
    mods: readonly string[],
    set: (patch: SelectorState) => void,
    /** How many hidden objects are behind the current owner filter. */
    hiddenCount: number,
    /** Whether the hidden-objects tick is on. */
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
            // The state the menu opened in, stated rather than offered: a chip for it
            // would do nothing, but the fact that it is on is the thing to know.
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
            // A count, not a chip per mod. A second row of owner buttons for every
            // installed mod is the very thing this selector exists to stop doing.
            mods.length
                ? h(
                    "span",
                    { style: { ...S.hint, fontSize: 10 } },
                    `+${mods.length}`,
                )
                : null,
            // The hidden-objects tick. Only rendered when there is something to
            // reveal — a checkbox that can only ever say "0" is noise on every
            // sprite, key-code and recipe-machine field.
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
    // Defaults live here rather than in a hook, so a selector with no state
    // entry is simply closed and filtered to this mod.
    const { open = false, owner = "own", query = "", showHidden = false } = props.state ?? {};
    const setState = props.onState;

    const items = toSelectorItems(options);
    const selected = multiple ? parseIdList(value) : value ? [value] : [];
    const counts = countByOwner(items);
    // Hidden filtering runs *before* the search, so a search for a hidden
    // element's name finds nothing until the box is ticked — which is the honest
    // answer. A filter that quietly ignored the box would let you "find" the
    // object and then not show it.
    const shown = filterByText(filterHidden(filterByOwner(items, owner), showHidden), query);
    const hiddenCount = countHidden(filterByOwner(items, owner));
    // A value the catalogue no longer offers still has to be visible and clearable.
    const missing = findOrphans(selected, items);
    const order = items.map((i) => i.value);
    const mods = otherMods(items);

    const commit = (next: readonly string[]) => {
        onChange(multiple ? formatIdList(next) : (next[0] ?? ""));
        if (!multiple) setState({ open: false });
    };
    const pick = (v: string) => commit(applyChoice(selected, v, multiple, order));
    const clear = (v: string) => commit(selected.filter((x) => x !== v));

    // ── Collapsed: the choice, and nothing else ────────────────────────────────
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
            // Orphans live outside the menu, because the menu filters them out.
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

    // ── Open: search, mod filter, and the list ────────────────────────────────
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
                            // A row, not a chip: full width and left aligned, so a long
                            // name does not reflow the list and two entries can never sit
                            // side by side. Reading the list is the whole job here.
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
                    // Who else owns it, for the rows that are not this mod's. A tag
                    // rather than a filter: the filter decides what is *shown*, this
                    // says why a row you are looking at belongs to somebody else.
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
