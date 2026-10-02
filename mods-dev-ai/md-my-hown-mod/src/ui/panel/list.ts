import type { ListRenderCtx, ListRow, ModOrigin, RowOrigin } from "../definition/types.ts";
import {
    configIsHidden,
    entryVisibility,
    HIDDEN_FIELD,
    type HiddenCategory,
    humanise,
    OWN_ID_PREFIXES,
} from "../../constants.ts";
import * as S from "../styles.ts";
import type { Style } from "../styles.ts";

export function modOf(row: ListRow): ModOrigin {
    const dot = row.id.indexOf(".");
    if (dot <= 0) return { own: false };
    const modId = row.id.slice(0, dot);
    return { modId, own: OWN_ID_PREFIXES.includes(modId) };
}

export type OwnerKey = "own" | "game" | `mod:${string}`;

export function ownerOf(row: ListRow): OwnerKey {
    if (row.origin === "mod") return "own";
    const m = modOf(row);
    if (!m.modId) return "game";
    return `mod:${m.modId}`;
}

export function ownerLabel(key: OwnerKey): string {
    if (key === "own") return "This mod";
    if (key === "game") return "Game";
    return key.slice(4);
}

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

export function countByOwner(rows: ListRow[]): Map<OwnerKey, number> {
    const out = new Map<OwnerKey, number>();
    for (const r of rows) {
        const k = ownerOf(r);
        out.set(k, (out.get(k) ?? 0) + 1);
    }
    return out;
}

export { configIsHidden, HIDDEN_FIELD, type HiddenCategory } from "../../constants.ts";

export function hiddenFieldOf(cat: string): string | undefined {
    return HIDDEN_FIELD[cat as HiddenCategory];
}

export function brief(v: unknown): string {
    if (v === undefined || v === null || v === "") return "";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
    if (typeof v === "boolean") return v ? "yes" : "no";
    if (typeof v === "object") {
        const o = v as Record<string, unknown>;

        for (const k of ["id", "name", "type", "nameKey"]) {
            if (typeof o[k] === "string" && o[k]) return String(o[k]);
        }
        if (Array.isArray(v)) {
            const arr = v as unknown[];
            if (arr.length === 0) return "none";

            if (
                arr.length <= 4 &&
                arr.every((x) => typeof x === "string" || typeof x === "number")
            ) {
                return arr.join(", ");
            }
            return `${arr.length} entries`;
        }

        const keys = Object.keys(o);
        if (keys.length === 0) return "set";
        if (keys.length <= 6) return keys.map((k) => `${k}: ${brief(o[k])}`).join(", ");
        return `${keys.length} fields`;
    }
    return String(v);
}

export interface DetailField {
    key: string;
    label: string;

    pick?: (src: Record<string, unknown>) => unknown;
}

export interface DetailSpec {
    fields: DetailField[];

    skip: string[];
}

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

export function detailRows(
    src: Record<string, unknown>,
    spec: DetailSpec,
): [string, string][] {
    const rows: [string, string][] = [];
    const used = new Set<string>();

    for (const f of spec.fields) {
        used.add(f.key);
        const s = brief(f.pick ? f.pick(src) : src[f.key]);

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

type H = (type: string, props: unknown, ...children: unknown[]) => unknown;

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
    cat?: string,
): ListRow[] {
    const byId = new Map<string, ListRow>();

    for (const n of natives) {
        if (!n?.id) continue;
        byId.set(n.id, {
            id: n.id,
            label: n.label || n.id,
            origin: "game",
            color: n.color,
            native: n.native,

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

            native: prior?.native,
            entry: e,

            hidden: (() => {
                const said = entryVisibility(e, cat!);
                return said === undefined ? prior?.hidden === true : said;
            })(),
        });
    }

    return [...byId.values()].sort(byOwnerThenLabel);
}

function byOwnerThenLabel(a: ListRow, b: ListRow): number {
    const ka = ownerOf(a);
    const kb = ownerOf(b);
    if (ka !== kb) return ownerRank(ka) - ownerRank(kb);
    return a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
}

function ownerRank(key: OwnerKey): number {
    if (key === "own") return 0;
    if (key === "game") return 1;
    return 2;
}

export function filterRows(
    rows: ListRow[],
    text: string,
    searchText?: (row: ListRow) => string,
    owner: OwnerKey | "all" = "all",
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

    if (query.trim() && matches(owner, showHidden) === 0) {
        return `No ${what} match “${query.trim()}” in this view.`;
    }

    if (!showHidden && matches(owner, true) > 0) {
        return `All ${
            countHiddenRows(rows, owner)
        } ${what} in this view are hidden — tick “hidden” to show them.`;
    }

    if (owner !== "all" && matches("all", showHidden) > 0) {
        return `You have no ${what} in this view. ${
            matches("all", showHidden)
        } exist — switch the filter to “All” to see them.`;
    }

    if (matches("all", true) > 0) {
        return `All ${rows.length} ${what} here are another mod's and hidden — switch the filter to “All” and tick “hidden”.`;
    }

    return `No ${what} match that filter.`;
}

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

export function countByOrigin(rows: ListRow[]): Record<RowOrigin, number> {
    const out: Record<RowOrigin, number> = { mod: 0, game: 0 };
    for (const r of rows) out[r.origin]++;
    return out;
}

export function renderRowInline(
    ctx: ListRenderCtx,
    def: { inlineRender?: (c: ListRenderCtx) => unknown },
    shared: () => unknown,
): unknown {
    return def.inlineRender ? def.inlineRender(ctx) : shared();
}

export function renderRowInfo(
    ctx: ListRenderCtx,
    def: { infoRender?: (c: ListRenderCtx) => unknown },
    shared: () => unknown,
): unknown {
    return def.infoRender ? def.infoRender(ctx) : shared();
}

export function sharedInline(h: (...a: unknown[]) => unknown, ctx: ListRenderCtx): unknown {
    const { row } = ctx;
    return h(
        "div",
        { style: S.rowHead },
        disclosureMark(h, ctx),
        row.color ? h("span", { style: { ...S.rowSwatch, background: row.color } }) : null,
        h("span", { style: S.rowTitle, title: row.label }, row.label),
        row.label === row.id ? null : h("span", { style: S.rowId }, row.id),
        h("span", { style: originTagStyle(row), title: originHint(row) }, originText(row)),
    );
}

export function originText(row: ListRow): string {
    const key = ownerOf(row);
    if (key === "own") return "yours";
    if (key === "game") return "game";
    return key.slice(4);
}

export function originTagStyle(row: ListRow): Style {
    const key = ownerOf(row);
    if (key === "own") return S.rowTagMod;

    return key === "game" ? S.rowTagGame : S.rowTagOther;
}

export function originHint(row: ListRow): string {
    const key = ownerOf(row);
    if (key === "own") return "Defined by this mod — edit or delete it here.";
    if (key === "game") return "Built into the game — reference only.";
    return `Added by the "${key.slice(4)}" mod — reference only.`;
}

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

export function originTag(h: (...a: unknown[]) => unknown, row: ListRow): unknown {
    return h(
        "span",
        { style: originTagStyle(row), title: originHint(row) },
        originText(row),
    );
}

export function sharedInfo(h: (...a: unknown[]) => unknown, ctx: ListRenderCtx): unknown {
    const src = ctx.row.native ?? ctx.row.entry;
    if (!src) return null;
    const pairs: [string, unknown][] = [];
    for (const [k, v] of Object.entries(src)) {
        if (k === "id" || v === undefined || v === null || v === "") continue;
        if (typeof v === "object") continue;
        pairs.push([k, v]);

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

            open: expanded,
            onToggle: (e: { currentTarget: { open: boolean } }) => {
                if (e.currentTarget.open && !expanded) ctx.toggle();
            },
        },
        h(
            "summary",
            {
                style: S.rowSummary,
                title: expanded ? "Hide details" : "Show details",
            },
            inline,
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
