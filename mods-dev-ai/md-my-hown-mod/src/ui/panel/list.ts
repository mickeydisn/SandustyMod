/**
 * The object list screen — the rows, shared by every object.
 *
 * This exists because the two lists a screen has to show are *the same list*.
 * The mod's own entries and the host's existing objects differ in exactly one
 * way that matters to a user: a mod row can be edited and deleted, and a game
 * row cannot. Everything else — the row shape, the filter, the expansion, the
 * fallback detail — is identical, and a screen that drew them as two different
 * things would be making a distinction the user did not ask for and cannot act
 * on.
 *
 * So the two are *rows*, not *sections*. The origin decides which buttons a row
 * gets, and the definition decides what a row says about itself; the frame here
 * is the same either way.
 *
 * Split out of `panel.ts` rather than growing inside it. That file is the panel's
 * state machine and its form renderer, and a list screen is neither: it is a
 * pure function of (rows, filter, expansion) with no form state of its own. Kept
 * separate, it is testable without mounting a panel.
 */

import type { ListRenderCtx, ListRow, ModOrigin, RowOrigin } from "../definition/types.ts";
import {
    configIsHidden,
    entryVisibility,
    HIDDEN_FIELD,
    type HiddenCategory,
    OWN_ID_PREFIXES,
} from "../../constants.ts";
import * as S from "../styles.ts";
import type { Style } from "../styles.ts";

// ── Which mod an object came from ────────────────────────────────────────────

/**
 * The mod that owns an object, read from its id.
 *
 * The convention across the ecosystem is `<modId>.<name>` — `myMod.furnace`,
 * `mdmy.ores` — and the game's own objects are unnamespaced (`Sand`, `dirt`). So
 * the text before the first dot is the mod.
 *
 * Two things this deliberately does *not* do:
 *
 *  - **Guess.** An id with no dot (`Sand`) is the game's, not a mod called
 *    "Sand". It is reported as unnamespaced rather than attributed.
 *  - **Trust the label.** The mod is read from the *id* only. A label is
 *    author-supplied free text, and making the filter depend on how someone
 *    punctuated their display name would be nonsense.
 *
 * `own` is checked against `OWN_ID_PREFIXES`, which holds both this mod's package
 * name and the shorter prefix its own config uses.
 */
export function modOf(row: ListRow): ModOrigin {
    const dot = row.id.indexOf(".");
    if (dot <= 0) return { own: false };
    const modId = row.id.slice(0, dot);
    return { modId, own: OWN_ID_PREFIXES.includes(modId) };
}

/** A row's owner as a filter key: this mod, another mod, or the game. */
export type OwnerKey = "own" | "game" | `mod:${string}`;

/** The owner key for a row. */
export function ownerOf(row: ListRow): OwnerKey {
    // A row in this mod's own config is this mod's by definition — no need to
    // infer it from the id, and no risk of the id being unnamespaced.
    if (row.origin === "mod") return "own";
    const m = modOf(row);
    if (!m.modId) return "game";
    return `mod:${m.modId}`;
}

/** A human label for an owner key. */
export function ownerLabel(key: OwnerKey): string {
    if (key === "own") return "This mod";
    if (key === "game") return "Game";
    return key.slice(4);
}

/**
 * Every owner present in the rows: this mod, then the game, then other mods
 * alphabetically.
 *
 * Built from the rows rather than a fixed list, because the set of installed mods
 * is not knowable ahead of time — a chip for a mod that has contributed nothing
 * would be a filter that always returns nothing.
 */
export function ownersOf(rows: ListRow[]): OwnerKey[] {
    const seen = new Set<OwnerKey>();
    for (const r of rows) seen.add(ownerOf(r));
    const others = [...seen]
        .filter((k) => k !== "own" && k !== "game")
        .sort((a, b) => ownerLabel(a).localeCompare(ownerLabel(b)));
    return [
        ...(seen.has("own") ? ["own" as OwnerKey] : []),
        ...(seen.has("game") ? ["game" as OwnerKey] : []),
        ...others,
    ];
}

/** How many rows each owner has, for the chip counts. */
export function countByOwner(rows: ListRow[]): Map<OwnerKey, number> {
    const out = new Map<OwnerKey, number>();
    for (const r of rows) {
        const k = ownerOf(r);
        out.set(k, (out.get(k) ?? 0) + 1);
    }
    return out;
}

// ── Merging the two lists ────────────────────────────────────────────────────

/**
 * The mod's entries and the host's objects as one sorted, de-duplicated list.
 *
 * A mod entry whose id the host also reports is **one** row, not two. This is the
 * case that matters most: a mod that has registered its own element appears in
 * both sources, and showing it twice would mean the user sees one object as two
 * and cannot tell which is the editable one.
 *
 * The merged row is `origin: "mod"` — that is the one the user owns and can edit
 * — and it keeps the host's `native` definition, so opening it still shows what
 * the engine actually registered. Losing that would be the one way to make a
 * merged row less informative than either source alone.
 */
/**
 * Re-exported from `constants.ts` so callers of this module need not know where
 * the flag table lives. The table and `configIsHidden` are the single source —
 * see their docs there. This module adds only the list-specific part: merging
 * the two row sources while respecting the flag.
 */
export {
    configIsHidden,
    HIDDEN_ALIASES,
    HIDDEN_FIELD,
    type HiddenCategory,
} from "../../constants.ts";

/** The config field that means "hidden" for a category, if it has one. */
export function hiddenFieldOf(cat: string): string | undefined {
    return HIDDEN_FIELD[cat as HiddenCategory];
}

// ── The expanded detail ───────────────────────────────────────────────────────

/**
 * A short, human-readable value: numbers trimmed, objects summarised.
 *
 * Was copy-pasted into all four object definitions. Identical in every copy, and
 * a row's detail is the one place a user goes to check a value, so four
 * implementations of "how do I print this" is four chances to show something
 * subtly different for the same object.
 */
export function brief(v: unknown): string {
    if (v === undefined || v === null || v === "") return "";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
    if (typeof v === "boolean") return v ? "yes" : "no";
    if (typeof v === "object") {
        const o = v as Record<string, unknown>;
        // A nested payload's one identifying key, not its whole shape.
        for (const k of ["id", "name", "type", "nameKey"]) {
            if (typeof o[k] === "string" && o[k]) return String(o[k]);
        }
        if (Array.isArray(v)) {
            const arr = v as unknown[];
            if (arr.length === 0) return "none";
            // A short array of primitives is worth reading in full — three
            // directions is a fact, "3 entries" is not.
            if (
                arr.length <= 4 &&
                arr.every((x) => typeof x === "string" || typeof x === "number")
            ) {
                return arr.join(", ");
            }
            return `${arr.length} entries`;
        }
        // A plain record of primitives is the shape of most engine payloads
        // (`defaultDataFields`, a data bag), and reading it out beats "set".
        const keys = Object.keys(o);
        if (keys.length === 0) return "set";
        if (keys.length <= 6) return keys.map((k) => `${k}: ${brief(o[k])}`).join(", ");
        return `${keys.length} fields`;
    }
    return String(v);
}

/** One `[label, value]` pair worth showing. */
export interface DetailField {
    key: string;
    label: string;
    /** Read this instead of `key` when the object nests the value. */
    pick?: (src: Record<string, unknown>) => unknown;
}

/**
 * What a category's expanded row shows.
 *
 * `fields` is the curated part — the properties worth reading, in the order a
 * person asks about them. The catch-all in `detailRows` covers the rest.
 *
 * The catch-all is why this gets more useful for free. Now that `discover*`
 * actually reaches the engine, a game row has a real definition on it, and a
 * hand-written list of "the fields we know about" is a list that is wrong the
 * moment the engine adds one. Listing the leftovers means a new engine field
 * shows up in the row instead of being silently dropped, while the curated part
 * keeps the interesting properties at the top where they are read first.
 */
export interface DetailSpec {
    fields: DetailField[];
    /**
     * Keys held back from the catch-all: plumbing, or pure noise. Without this,
     * `elementType` and a dozen internal keys would sit under the values a user
     * actually came to read.
     */
    skip: string[];
}

/** Definition keys that are plumbing rather than content, for every category. */
const ALWAYS_SKIP = [
    "id",
    "name",
    "nameKey",
    "description",
    "descriptionKey",
    "sprite",
    "getExtraProps",
    "interactions",
    "handlers",
    "onPlace",
    "onBreak",
    "onDamage",
];

/** `isGrabbable` → "Is grabbable", for the catch-all's labels. */
function humanise(k: string): string {
    const spaced = k.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * The rows of an expanded list row: curated fields first, then the rest.
 *
 * Exported separately from the render so the *content* is testable without a
 * renderer — which fields a category shows is a decision, and a decision that
 * only shows up in a DOM diff is a decision nobody reviews.
 */
export function detailRows(
    src: Record<string, unknown>,
    spec: DetailSpec,
): [string, string][] {
    const rows: [string, string][] = [];
    const used = new Set<string>();

    for (const f of spec.fields) {
        used.add(f.key);
        const s = brief(f.pick ? f.pick(src) : src[f.key]);
        // An empty value is not a row. A detail block full of blanks reads as
        // "there is nothing here" rather than "these are the fields that apply".
        if (s) rows.push([f.label, s]);
    }

    const skip = new Set([...spec.skip, ...ALWAYS_SKIP, ...used]);
    for (const k of Object.keys(src).sort()) {
        if (skip.has(k)) continue;
        const s = brief(src[k]);
        if (s) rows.push([humanise(k), s]);
    }
    return rows;
}

/** The `createElement` shape the list renders with. */
type H = (type: string, props: unknown, ...children: unknown[]) => unknown;

/**
 * Draw an expanded row's detail block, or `null` when the object has nothing to
 * say — which is the honest answer for a game row whose definition could not be
 * read, rather than an empty bordered box.
 */
export function renderDetail(h: H, ctx: ListRenderCtx, spec: DetailSpec): unknown {
    const src = ctx.row.native ?? ctx.row.entry ?? {};
    const rows = detailRows(src, spec);
    if (!rows.length) return null;
    return h(
        "div",
        { style: S.rowDetail },
        h(
            "div",
            { style: S.detailNote },
            ctx.row.origin === "game"
                ? "The engine's own values for this object."
                : "The values this mod stores. Saved by editing the row.",
        ),
        ...rows.map(([k, v]) =>
            h(
                "div",
                { key: k, style: S.detailLine },
                h("span", { style: S.detailKey }, k),
                // The full value on hover: a summarised one — "3 fields" — is
                // fine to read and useless to check a number against.
                h("span", { style: S.detailVal, title: v }, v),
            )
        ),
    );
}

export function mergeRows(
    entries: Record<string, unknown>[],
    natives: {
        id: string;
        label: string;
        color?: string;
        hidden?: boolean;
        native?: Record<string, unknown>;
    }[],
    /** The category, for the hidden flag — see `HIDDEN_FIELD`. */
    cat?: string,
): ListRow[] {
    const byId = new Map<string, ListRow>();

    // The host's objects first, so a mod row of the same id overwrites rather
    // than colliding with them.
    for (const n of natives) {
        if (!n?.id) continue;
        byId.set(n.id, {
            id: n.id,
            label: n.label || n.id,
            origin: "game",
            color: n.color,
            native: n.native,
            // The discovery pass has already read the engine's own definition and
            // decided. It was dropped here, which is why ticking "hidden" appeared
            // to do nothing: every *game* element came back unflagged, so the
            // only rows the filter could ever reveal were the mod's own.
            hidden: n.hidden === true,
        });
    }

    for (const e of entries) {
        const id = typeof e?.id === "string" ? e.id : "";
        if (!id) continue;
        const name = typeof e.name === "string" && e.name ? e.name : "";
        const prior = byId.get(id);
        byId.set(id, {
            id,
            label: name || prior?.label || id,
            origin: "mod",
            color: prior?.color,
            // The host's definition survives the merge: it is the engine's own
            // view of this object, and the mod's config does not contain it.
            native: prior?.native,
            entry: e,
            // The mod's entry wins when it *says* something about visibility; when
            // it says nothing, the prior row's own flag stands. "Absent" is not
            // "visible" — otherwise renaming a hidden object in the panel would
            // silently reveal it.
            hidden: (() => {
                const said = entryVisibility(e, cat!);
                return said === undefined ? prior?.hidden === true : said;
            })(),
        });
    }

    return [...byId.values()].sort(byOwnerThenLabel);
}

/**
 * Your rows first, then the game's, then other mods' — each group alphabetical.
 *
 * The grouping is the point. "What did I make?", "what already exists?" and "what
 * did *that* mod add?" are three different questions, and answering them in one
 * undifferentiated wall forces the user to read every row to work out which one
 * they asked. Keeping them adjacent rather than split by headers also means a
 * filtered list stays a single scroll with no jump when a group empties out.
 */
function byOwnerThenLabel(a: ListRow, b: ListRow): number {
    const ka = ownerOf(a);
    const kb = ownerOf(b);
    if (ka !== kb) return ownerRank(ka) - ownerRank(kb);
    return a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
}

/** This mod, then the game, then other mods — matching the chip order. */
function ownerRank(key: OwnerKey): number {
    if (key === "own") return 0;
    if (key === "game") return 1;
    return 2;
}

// ── Filtering ────────────────────────────────────────────────────────────────

/**
 * Narrow the rows to what the user is looking for.
 *
 * Two things narrow, and they compose because they answer different questions:
 *
 *  - `text` — "which one is called gravel?". Matched against the id, the label
 *    and whatever the definition adds via `searchText`, because a user searching
 *    "powder" means the matter type, not a name.
 *  - `owner` — "show me only mine" / "only the game's" / "only otherA's".
 *
 * There is deliberately **no separate `origin` filter**. There was one — All /
 * Yours / Game, beside these owner chips — and it was the same filter twice:
 * "Yours" is `owner: "own"` and "Game" is `owner: "game"`, while `origin` only
 * ever had two values to say, both of which `owner` already says more precisely.
 * Two arguments setting one piece of state is how they end up disagreeing.
 *
 * Matching is case-insensitive substring, not prefix and not regex. Substring is
 * the forgiving middle: a prefix match hides `mdmy.ores` from a search for
 * `ores`, and a regex turns a stray `(` into a silent empty list.
 */
export function filterRows(
    rows: ListRow[],
    text: string,
    searchText?: (row: ListRow) => string,
    owner: OwnerKey | "all" = "all",
    /** Show rows that are deliberately out of normal use. Off by default. */
    showHidden = false,
): ListRow[] {
    const q = text.trim().toLowerCase();
    return rows.filter((row) => {
        if (!showHidden && row.hidden) return false;
        if (owner !== "all" && ownerOf(row) !== owner) return false;
        if (!q) return true;
        const hay = `${row.id} ${row.label}${searchText ? ` ${searchText(row)}` : ""}`;
        return hay.toLowerCase().includes(q);
    });
}

/**
 * Explain an empty list by naming the filter responsible, with a way out.
 *
 * The list no longer starts unfiltered — it starts on "This mod" with hidden
 * objects off — so "no match" is no longer the honest one-line answer. There are
 * three ways to reach an empty list, and the user cannot see which filters are
 * holding rows back from the rows alone.
 *
 * The test is in order of how much it would help to name it: a filter that
 * *alone* empties the list is the whole story, and only when nothing on its own
 * does is it worth blaming the combination. Otherwise the message names the
 * widest filter — "show this mod's objects" — which is the one whose removal
 * most obviously changes the result.
 *
 * `label` is the category's display name; this lower-cases it, since every use
 * is inside a sentence.
 */
export function shownBecauseOf(
    rows: ListRow[],
    owner: OwnerKey | "all",
    showHidden: boolean,
    query: string,
    label: string,
): string {
    const what = label.toLowerCase();
    const matches = (o: OwnerKey | "all", hid: boolean) =>
        filterRows(rows, query, undefined, o, hid).length;

    // 1. The text filter, first: it is the one cause the user cannot see for
    //    themselves, and they have just typed it.
    if (query.trim() && matches(owner, showHidden) === 0) {
        return `No ${what} match “${query.trim()}” in this view.`;
    }

    // 2. The hidden tick, but only when ticking it would actually help — under
    //    the *current* owner filter. A user narrowed to "This mod" is not
    //    helped by a box that only reveals another mod's objects, so this must
    //    not be able to fire on its own strength.
    if (!showHidden && matches(owner, true) > 0) {
        return `All ${
            countHiddenRows(rows, owner)
        } ${what} in this view are hidden — tick “hidden” to show them.`;
    }

    // 3. The owner filter. The count is taken with the owner filter off and
    //    hidden still off, so it answers "what is there if I widen this?" and
    //    never counts rows the user has not been shown how to reach.
    if (owner !== "all" && matches("all", showHidden) > 0) {
        return `You have no ${what} in this view. ${
            matches("all", showHidden)
        } exist — switch the filter to “All” to see them.`;
    }

    // 4. Neither filter alone explains it, but both together would. This was an
    //    unexplained empty screen: the rows are all another mod's *and* all
    //    hidden, so "switch to All" still shows nothing and so does "tick
    //    hidden". Both instructions have to be given, or the user tries one and
    //    concludes the panel is broken.
    if (matches("all", true) > 0) {
        return `All ${rows.length} ${what} here are another mod's and hidden — switch the filter to “All” and tick “hidden”.`;
    }

    // 5. Defensive: no combination of these two filters can show anything. The
    //    panel only calls this when `rows` is non-empty and the filtered list is
    //    not, so reaching here means every row is both another mod's and hidden
    //    *and* something else went wrong. Say so plainly rather than implying a
    //    filter the user can change will help.
    return `No ${what} match that filter.`;
}

/**
 * How many rows are hidden, for the checkbox's label.
 *
 * Counted over the *owner-filtered* rows, not all of them: the box reveals what
 * the current view is holding back, and a number that included other mods'
 * hidden rows would not match what ticking it does.
 */
export function countHiddenRows(
    rows: ListRow[],
    owner: OwnerKey | "all" = "all",
): number {
    let n = 0;
    for (const r of rows) {
        if (!r.hidden) continue;
        if (owner !== "all" && ownerOf(r) !== owner) continue;
        n++;
    }
    return n;
}

/** How many rows each origin has, for the filter chips. */
export function countByOrigin(rows: ListRow[]): Record<RowOrigin, number> {
    const out: Record<RowOrigin, number> = { mod: 0, game: 0 };
    for (const r of rows) out[r.origin]++;
    return out;
}

// ── The shared row renderer ──────────────────────────────────────────────────

/**
 * A row, drawn by whichever renderer can say the most about it.
 *
 * The definition's own `inlineRender` *replaces* the shared one rather than
 * composing with it. Composition is the tempting choice and the wrong one: an
 * element that renders its own swatch and label would then also get the shared
 * swatch and label, so the row shows everything twice. A definition that
 * renders a row is claiming that row.
 */
export function renderRowInline(
    ctx: ListRenderCtx,
    def: { inlineRender?: (c: ListRenderCtx) => unknown },
    shared: () => unknown,
): unknown {
    return def.inlineRender ? def.inlineRender(ctx) : shared();
}

/** The row's detail: the definition's own, or the shared fallback. */
export function renderRowInfo(
    ctx: ListRenderCtx,
    def: { infoRender?: (c: ListRenderCtx) => unknown },
    shared: () => unknown,
): unknown {
    return def.infoRender ? def.infoRender(ctx) : shared();
}

/**
 * The default row line: swatch, label, id, and a marker for whose it is.
 *
 * This is what an object with no `inlineRender` gets, and it is enough on its
 * own: the origin marker is the one piece of information that is true of every
 * row and cannot be read off the name.
 */
export function sharedInline(h: (...a: unknown[]) => unknown, ctx: ListRenderCtx): unknown {
    const { row } = ctx;
    return h(
        "div",
        { style: S.rowHead },
        // First in the line, like every object panel draws it, so the swatch and
        // the name sit at the same x on every row whatever drew them.
        disclosureMark(h, ctx),
        row.color ? h("span", { style: { ...S.rowSwatch, background: row.color } }) : null,
        h("span", { style: S.rowTitle, title: row.label }, row.label),
        row.label === row.id ? null : h("span", { style: S.rowId }, row.id),
        h("span", { style: originTagStyle(row), title: originHint(row) }, originText(row)),
    );
}

/** The row's origin tag: who it belongs to. */
export function originText(row: ListRow): string {
    const key = ownerOf(row);
    if (key === "own") return "yours";
    if (key === "game") return "game";
    return key.slice(4);
}

/** The origin tag's style: yours, the game's, or another mod's. */
export function originTagStyle(row: ListRow): Style {
    const key = ownerOf(row);
    if (key === "own") return S.rowTagMod;
    // Another mod's object is a third thing: not yours, not the game's. A
    // distinct tint is what makes "whose" readable at a glance down a long list.
    return key === "game" ? S.rowTagGame : S.rowTagOther;
}

/** The origin tag's tooltip: what the badge means, said in words. */
export function originHint(row: ListRow): string {
    const key = ownerOf(row);
    if (key === "own") return "Defined by this mod — edit or delete it here.";
    if (key === "game") return "Built into the game — reference only.";
    return `Added by the "${key.slice(4)}" mod — reference only.`;
}

/**
 * The row's disclosure marker: a quiet `▸` that rotates when the row is open.
 *
 * The browser's own marker is suppressed by `listStyle: "none"` on the summary,
 * and this replaces it. It is drawn by the *object's* renderer rather than by the
 * shared row so it can sit first in the line — before the swatch or the footprint
 * — which is what keeps every row's name at the same x. A marker appended after
 * those would be indented by them, and the columns would be ragged again.
 */
export function disclosureMark(h: (...a: unknown[]) => unknown, ctx: ListRenderCtx): unknown {
    return h(
        "span",
        {
            style: {
                ...S.rowSummaryMark,
                transform: ctx.expanded ? "rotate(90deg)" : "none",
            },
            "aria-hidden": "true",
        },
        "▸",
    );
}

/**
 * The origin badge itself.
 *
 * Exported because every per-object panel draws the same badge, and four copies
 * of a two-way `origin === "mod" ? … : …` is how the list ended up with a third
 * state (another mod's object) that nothing knew how to draw. A panel that wants
 * its own badge can still build one; this is the one that stays correct.
 */
export function originTag(h: (...a: unknown[]) => unknown, row: ListRow): unknown {
    return h(
        "span",
        { style: originTagStyle(row), title: originHint(row) },
        originText(row),
    );
}

/**
 * The default detail: the entry's own fields, or the host's definition.
 *
 * For a game row with a `native` this is the whole point of the screen — the
 * engine's own values for an object the mod never declared. For a mod row it
 * is a read-only echo of what the form would show, which is still worth having:
 * it answers "what is actually stored" without entering the form.
 *
 * A row with neither is not drawn at all. An empty detail box is worse than no
 * detail box: it looks like something failed to load.
 */
export function sharedInfo(h: (...a: unknown[]) => unknown, ctx: ListRenderCtx): unknown {
    const src = ctx.row.native ?? ctx.row.entry;
    if (!src) return null;
    const pairs: [string, unknown][] = [];
    for (const [k, v] of Object.entries(src)) {
        if (k === "id" || v === undefined || v === null || v === "") continue;
        if (typeof v === "object") continue;
        pairs.push([k, v]);
        // A definition with thirty fields does not get a thirty-line dump; the
        // first handful answers "what is this" and the form answers the rest.
        if (pairs.length >= 8) break;
    }
    if (!pairs.length) return null;
    return h(
        "div",
        { style: S.rowDetail },
        pairs.map(([k, v]) =>
            h(
                "div",
                { key: k, style: S.detailLine },
                h("span", { style: S.detailKey }, k),
                h("span", { style: S.detailVal }, String(v)),
            )
        ),
    );
}

// ── One row, with its buttons ───────────────────────────────────────────────

/**
 * A row as the screen draws it: a `<details>` whose `<summary>` is the whole
 * object line, with the detail underneath and the buttons its origin allows.
 *
 * **Why `details`/`summary` and not a div with a click handler.** Three reasons,
 * in order of how much they matter:
 *
 *  1. *The whole row is the control.* A `div` with `onClick` is not focusable, so
 *     the detail could not be reached from the keyboard at all, and nothing
 *     announced it as expandable. `summary` is a real control: it takes focus,
 *     responds to Enter and Space, and exposes `aria-expanded` for free.
 *  2. *The expander marker is free.* `summary` draws its own disclosure triangle,
 *     so the 10px `▸` glyph button goes — and that glyph was the complaint: a
 *     10px target with no hit area, sitting in the corner of every row.
 *  3. *The detail is positioned by the browser, not by us.* This is the layout
 *     bug: `S.row` is `display: flex` in the *row* direction, so a detail div
 *     placed after the bar was laid out **beside** it, not under it. A
 *     `details` element is a block box, so its content is below the summary by
 *     construction and cannot drift.
 *
 * The Edit and Del buttons live inside the `summary`, so a click on them lands
 * there too. That is why their handlers must stop propagation — without it,
 * pressing Edit would also toggle the row open.
 */
export function renderListRow(
    ctx: ListRenderCtx,
    def: {
        inlineRender?: (c: ListRenderCtx) => unknown;
        infoRender?: (c: ListRenderCtx) => unknown;
    },
): unknown {
    const { h, row, expanded } = ctx;
    const inline = renderRowInline(ctx, def, () => sharedInline(h, ctx));
    const detail = expanded ? renderRowInfo(ctx, def, () => sharedInfo(h, ctx)) : null;
    // A button inside a `summary` toggles the summary as well as doing its own
    // job, so every row button has to swallow the click. Guarded rather than
    // assumed, so a future button added without the guard is caught here.
    const stop = (fn?: () => void) =>
        fn
            ? (e: { stopPropagation: () => void; preventDefault?: () => void }) => {
                e.stopPropagation();
                e.preventDefault?.();
                fn();
            }
            : null;
    return h(
        "details",
        {
            style: { ...(row.origin === "mod" ? S.row : S.rowReadOnly), ...S.rowDetails },
            // Controlled by the panel's `openRow` state rather than left to the
            // browser, so that opening one row can close the previous one and a
            // category switch can clear it.
            open: expanded,
            onToggle: (e: { currentTarget: { open: boolean } }) => {
                // The browser fires this on click *and* on programmatic change.
                // Only the transition into "open" is ours to report, otherwise
                // closing a row would immediately re-open it.
                if (e.currentTarget.open && !expanded) ctx.toggle();
            },
        },
        h(
            "summary",
            {
                style: S.rowSummary,
                title: expanded ? "Hide details" : "Show details",
            },
            // No marker here: each object's own `inlineRender` draws it first in
            // the line, so it sits before the swatch or footprint rather than
            // being indented by them. `disclosureMark` is what they call.
            inline,
            // Only a mod row is editable. Offering Edit on a game row would be
            // offering to edit Sand, and Del would be a lie about what the
            // screen can do.
            ctx.edit ? h("button", { style: S.btn, onClick: stop(ctx.edit) }, "Edit") : null,
            ctx.remove
                ? h(
                    "button",
                    {
                        style: ctx.confirming ? S.btnPrimary : S.btnDanger,
                        onClick: stop(ctx.remove),
                    },
                    ctx.confirming ? "Sure?" : "Del",
                )
                : null,
        ),
        detail,
    );
}
