/**
 * Shared panel chrome: drag handling, the right-anchored position/zoom/opacity
 * style, the header, the tab bar, and the lock/zoom/opacity settings rows.
 *
 * Both statistic mods draw the same window furniture; only the tab set and
 * tab bodies differ, so those are supplied by the mod.
 */
import { h } from "./api.ts";
import { styles } from "./styles.ts";
import type { PanelState } from "./state.ts";
import type { TabDef } from "./types.ts";
import type { UiStore } from "./uiStore.ts";
import { CfgRow, CfgSection } from "./section.ts";

/** CSS class on the panel root; the drag handler resolves it via closest(). */
export const ROOT_CLASS = "sandmd-stat-root";

/** Everything the chrome needs to read or mutate. */
export interface ChromeCtx<T = unknown> {
    state: PanelState<T>;
    store: UiStore;
    bump: () => void;
}

/**
 * Pointer-drag handler for the panel root. Right-anchored, so dragging right
 * decreases the stored `right` offset. `savePanelPos` runs on pointerup rather
 * than per move, so a drag does not thrash storage.
 */
export function startDrag(ev: any, ctx: ChromeCtx): void {
    const { state, store, bump } = ctx;
    if (ev.button != null && ev.button !== 0) return;
    const target = ev.target as { closest?: (s: string) => unknown } | null;
    if (target?.closest?.("button, input, select, textarea, a")) return;

    const rootEl = (ev.currentTarget as { closest?: (s: string) => HTMLElement | null })?.closest?.(
        `.${ROOT_CLASS}`,
    );
    const rect = rootEl?.getBoundingClientRect?.();
    const vw = (globalThis as { innerWidth?: number }).innerWidth ?? 1280;
    const startX = ev.clientX as number;
    const startY = ev.clientY as number;
    const origRight = rect ? Math.max(0, vw - rect.right) : state.pos.right;
    const origTop = rect ? rect.top : state.pos.top;

    state.dragging = true;
    bump();

    const onMove = (e2: any): void => {
        const dx = (e2.clientX as number) - startX;
        const dy = (e2.clientY as number) - startY;
        state.pos = {
            right: Math.max(0, origRight - dx),
            top: Math.max(0, origTop + dy),
        };
        bump();
    };
    const onUp = (): void => {
        state.dragging = false;
        store.savePanelPos(state.pos);
        bump();
        globalThis.removeEventListener?.("pointermove", onMove);
        globalThis.removeEventListener?.("pointerup", onUp);
        globalThis.removeEventListener?.("pointercancel", onUp);
    };
    globalThis.addEventListener?.("pointermove", onMove);
    globalThis.addEventListener?.("pointerup", onUp);
    globalThis.addEventListener?.("pointercancel", onUp);
    try {
        ev.preventDefault?.();
    } catch { /* */ }
}

/** Right-anchored placement plus zoom and opacity. */
export function posStyle(state: PanelState<unknown>): Record<string, string | number> {
    const out: Record<string, string | number> = {
        right: `${state.pos.right}px`,
        top: `${state.pos.top}px`,
        left: "auto",
        transformOrigin: "top right",
        opacity: state.alpha,
    };
    if (state.zoom !== 1) out.transform = `scale(${state.zoom})`;
    return out;
}

export interface HeaderOptions {
    title: string;
    /** Buttons rendered between the title and the minimize button. */
    actions?: unknown;
}

/** Title bar with a drag handle, optional action buttons, and minimize. */
export function Header<T>(ctx: ChromeCtx<T>, opts: HeaderOptions): unknown {
    const e = h;
    if (!e) return null;
    const { state, store, bump } = ctx;
    return e(
        "div",
        {
            style: { ...styles.header, cursor: "grab" },
            onPointerDown: (ev: any) => startDrag(ev, ctx),
        },
        e("span", { style: styles.dragHandle }, e("span", { style: styles.title }, opts.title)),
        opts.actions ?? null,
        e(
            "button",
            {
                style: styles.button,
                title: "Minimize",
                onClick: () => {
                    state.minimized = true;
                    store.saveMinimized(true);
                    bump();
                },
            },
            "—",
        ),
    );
}

/** Header row shown while minimized: no title, just action buttons. */
export function MiniHeader<T>(
    ctx: ChromeCtx<T>,
    actions?: unknown,
    onExpand?: () => void,
): unknown {
    const e = h;
    if (!e) return null;
    const { state, store, bump } = ctx;
    return e(
        "div",
        {
            style: {
                ...styles.header,
                padding: "6px 8px",
                cursor: "grab",
                justifyContent: "flex-end",
                gap: "6px",
            },
            onPointerDown: (ev: any) => startDrag(ev, ctx),
        },
        actions ?? null,
        e(
            "button",
            {
                style: styles.button,
                title: "Expand",
                onClick: onExpand ??
                    (() => {
                        state.minimized = false;
                        store.saveMinimized(false);
                        bump();
                    }),
            },
            "□",
        ),
    );
}

export interface TabsOptions {
    tabs: TabDef[];
    active: string;
    onSelect: (id: string) => void;
    /** Extra tab rendered after the standard ones. */
    extra?: unknown;
    hidden?: boolean;
}

/** Horizontal tab strip. `flex-wrap` is on, so long tab sets wrap. */
export function Tabs(opts: TabsOptions): unknown {
    const e = h;
    if (!e) return null;
    if (opts.hidden) return null;
    return e(
        "div",
        { style: styles.tabs },
        ...opts.tabs.map((t) =>
            e(
                "button",
                {
                    key: t.id,
                    style: opts.active === t.id ? styles.tabActive : styles.tab,
                    onClick: () => opts.onSelect(t.id),
                },
                t.label,
            )
        ),
        opts.extra ?? null,
    );
}

/** "− value + Reset" control used by the zoom and opacity rows. */
function stepper(
    value: number,
    lo: number,
    hi: number,
    step: number,
    decimals: number,
    onChange: (v: number) => void,
    resetTo = 1,
): unknown {
    const e = h;
    if (!e) return null;
    const clampRound = (v: number): number =>
        Math.min(hi, Math.max(lo, Number(v.toFixed(decimals))));
    return e(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 6 } },
        e(
            "button",
            { style: styles.button, onClick: () => onChange(clampRound(value - step)) },
            "−",
        ),
        e(
            "span",
            { style: { minWidth: 40, textAlign: "center" } },
            `${Math.round(value * 100)}%`,
        ),
        e(
            "button",
            { style: styles.button, onClick: () => onChange(clampRound(value + step)) },
            "+",
        ),
        e("button", { style: styles.button, onClick: () => onChange(resetTo) }, "Reset"),
    );
}

export interface ChromeRowsOptions<T> extends ChromeCtx<T> {
    zoomRange: [number, number];
    alphaRange: [number, number];
}

/** The shared "Panel" settings group: lock, zoom, opacity. */
export function ChromeRows<T>(opts: ChromeRowsOptions<T>): unknown {
    const e = h;
    if (!e) return null;
    const { state, store, bump } = opts;
    const [zLo, zHi] = opts.zoomRange;
    const [aLo, aHi] = opts.alphaRange;

    return e(
        "div",
        null,
        CfgSection("Panel"),
        CfgRow(
            "Lock panel",
            e(
                "button",
                {
                    style: state.locked ? styles.buttonPrimary : styles.button,
                    onClick: () => {
                        state.locked = !state.locked;
                        store.saveLocked(state.locked);
                        bump();
                    },
                },
                state.locked ? "🔒 Locked" : "🔓 Unlocked",
            ),
        ),
        CfgRow(
            "Zoom",
            stepper(
                state.zoom,
                zLo,
                zHi,
                0.1,
                1,
                (v) => {
                    state.zoom = v;
                    store.saveZoom(v);
                    bump();
                },
            ),
        ),
        CfgRow(
            "Opacity",
            stepper(
                state.alpha,
                aLo,
                aHi,
                0.05,
                2,
                (v) => {
                    state.alpha = v;
                    store.saveAlpha(v);
                    bump();
                },
            ),
        ),
    );
}
