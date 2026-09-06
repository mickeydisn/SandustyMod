/**
 * Picker — presentational view (pure UI).
 *
 * This file owns the *content* of the picker overlay: the swatches, category
 * grid, minimize/mirror buttons, tooltip, header extras and the minimized bar.
 * It does NOT know about the overlay state machine or the build-action sync —
 * that lives in overlay.ts (the controller). The view reports user intent
 * through the {@link PickerContentApi} it is given.
 */
import { CatalogueItem } from "../strucutre/types.ts";
import { h, HTMLElement } from "./react.ts";
import type { PickerContentApi, PickerContext } from "./types.ts";

const TOOLTIP_DELAY_MS = 120;
const SWATCH_BOX = 34;
const MAX_SWATCH_ZOOM = 4;

/** Presentational options the view needs beyond the controller contract. */
export interface PickerViewOptions {
    api: PickerContentApi;
    maxHeight: number;
    spriteIdFor?: (item: CatalogueItem) => string | undefined;
    itemFilter?: (item: CatalogueItem) => boolean;
    renderItemBadge?: (item: CatalogueItem) => unknown;
    renderHeaderExtra?: (ctx: PickerContext) => unknown;
}

/**
 * Build the picker's render function. The returned function is registered with
 * the overlay system; the view wires its own React state so non-React code only
 * needs the controller's `setRepaint`/`repaint` hooks.
 */
export function createPickerView(options: PickerViewOptions): () => unknown {
    const { api, maxHeight } = options;
    const list = api.list;
    const search = "";

    let tooltip: { label: string; x: number; y: number } | null = null;
    let tooltipTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTooltip = () => {
        if (tooltipTimer) clearTimeout(tooltipTimer);
        tooltipTimer = null;
        if (!tooltip) return;
        tooltip = null;
        api.repaint();
    };

    const scheduleTooltip = (label: string, rect: DOMRect) => {
        if (tooltipTimer) clearTimeout(tooltipTimer);
        tooltipTimer = setTimeout(() => {
            tooltipTimer = null;
            tooltip = { label, x: rect.left + rect.width / 2, y: rect.top };
            api.repaint();
        }, TOOLTIP_DELAY_MS);
    };

    const ctx = (): PickerContext => ({
        list,
        selected: list.getSelected(),
        mirrored: list.isMirrored(),
        categoryId: list.getCategory(),
        search,
        repaint: () => api.repaint(),
    });

    const spriteSrc = (item: CatalogueItem): string | unknown => {
        const id = options.spriteIdFor?.(item) ??
            item.spriteId ??
            list.structureType(item.id, false);
        const r = sandkit.api.sprites.getById(id)?.imageAsset?.image?.src;
        return typeof r == "string" ? r as string : r;
    };

    const FocusableButton = (props: {
        id: string;
        onActivate: () => void;
        onHoverStart?: (rect: DOMRect) => void;
        onHoverEnd?: () => void;
        className?: string;
        children: unknown;
    }) => {
        const navigation = sandkit.api.ui?.navigation;
        const focusable = navigation.useFocusable({
            id: props.id,
            scope: api.pickerId,
            onActivate: props.onActivate,
            scrollIntoView: true,
        });
        const focusClass = navigation?.controllerFocusClass?.(!!focusable?.focused) ?? "";
        return h(
            "button",
            {
                ref: focusable?.ref,
                type: "button",
                onClick: props.onActivate,
                onMouseEnter: props.onHoverStart
                    ? (event: { currentTarget: HTMLElement }) => {
                        // @ts-ignore HTMLElement
                        props.onHoverStart!(event.currentTarget.getBoundingClientRect());
                    }
                    : undefined,
                onMouseLeave: props.onHoverEnd,
                className: `${props.className ?? ""} ${focusClass}`.trim(),
            },
            props.children,
        );
    };
    const ObjectSwatch = (props: { item: CatalogueItem; selected: boolean }) => {
        const src = spriteSrc(props.item);

        function swatchZoom(width: number, height: number, box = SWATCH_BOX): number {
            const longest = Math.max(width, height);
            if (longest <= 0) return 1;
            return Math.max(1, Math.min(MAX_SWATCH_ZOOM, Math.floor(box / longest)));
        }

        const zoom = swatchZoom(props.item.width, props.item.height);
        return h(
            FocusableButton,
            {
                id: `${api.pickerId}-item-${props.item.id}`,
                onHoverStart: (rect: DOMRect) => {
                    scheduleTooltip(
                        `${props.item.label} — ${props.item.width}×${props.item.height}`,
                        rect,
                    );
                },
                onHoverEnd: clearTooltip,
                onActivate: () => api.selectItem(props.item),
                className: `w-10 h-10 rounded border-2 ${
                    props.selected ? "border-yellow-400" : "border-slate-600"
                } hover:border-slate-400 flex items-center justify-center`,
                children: [
                    src
                        ? h("img", {
                            key: "img",
                            src,
                            alt: props.item.label,
                            style: {
                                width: `${props.item.width * zoom}px`,
                                height: `${props.item.height * zoom}px`,
                                maxWidth: "100%",
                                maxHeight: "100%",
                                objectFit: "contain",
                                imageRendering: "pixelated",
                                display: "block",
                            },
                        })
                        : h(
                            "span",
                            { key: "fallback", className: "text-xs" },
                            props.item.label.charAt(0),
                        ),
                    options.renderItemBadge
                        ? h(
                            "span",
                            { key: "badge" },
                            options.renderItemBadge(props.item),
                        )
                        : null,
                ],
            },
        );
    };
    const Picker = () => {
        // @ts-ignore React Type
        const [, bump] = sandkit.react.useState(0);
        // @ts-ignore React Type
        const scrollRef = sandkit.react.useRef(null) as { current: HTMLElement | null };
        // @ts-ignore React Type
        const savedScrollRef = sandkit.react.useRef(0) as { current: number };
        // @ts-ignore React Type
        const wasMinimizedRef = sandkit.react.useRef(true) as { current: boolean };
        sandkit.react.useEffect(() => {
            api.setRepaint(() => bump((n: number) => n + 1)); // functional update, always changes
            api.setClearTooltip(() => clearTooltip);
            return () => {
                api.setRepaint(null);
                api.setClearTooltip(null);
            };
        }, []);

        // Restore the scroll cursor when the list is re-expanded after being
        // minimized. Runs after every render (no deps) so the DOM has committed
        // before we assign `scrollTop`.
        // @ts-ignore React Type
        const useLayoutEffect = sandkit.react.useLayoutEffect ?? sandkit.react.useEffect;
        useLayoutEffect(() => {
            const minimized = api.getState()?.minimized ?? true;
            if (!minimized && wasMinimizedRef.current && scrollRef.current) {
                scrollRef.current.scrollTop = savedScrollRef.current;
            }
            wasMinimizedRef.current = minimized;
        });

        const state = api.getState();
        if (!state) return null;

        const selected = list.getSelected();
        const categoryId = list.getCategory() || list.categories[0]?.id || "";

        function filterItems(
            items: CatalogueItem[],
            options: {
                categoryId: string;
                query: string;
                itemFilter?: (item: CatalogueItem) => boolean;
            },
        ): CatalogueItem[] {
            const q = options.query.trim().toLowerCase();
            return items.filter((item) => {
                if (item.category !== options.categoryId) return false;
                if (options.itemFilter && !options.itemFilter(item)) return false;
                if (!q) return true;
                const hay = `${item.label} ${item.id} ${item.description ?? ""} ${
                    (item.tags ?? []).join(" ")
                }`.toLowerCase();
                return hay.includes(q);
            });
        }

        const visible = filterItems(list.catalogueItems, {
            categoryId,
            query: search,
            itemFilter: options.itemFilter,
        });

        if (state.minimized) {
            const src = selected ? spriteSrc(selected) : undefined;
            return h(
                "div",
                {
                    className:
                        "pointer-events-auto flex items-center gap-2 bg-black bg-opacity-75 border border-slate-700 rounded px-3 py-2 ui-box text-slate-300",
                    onClick: api.expand,
                },
                h("span", { className: "text-white text-xs opacity-70" }, api.title),
                h(
                    FocusableButton,
                    {
                        id: `${api.pickerId}-selected`,
                        onActivate: api.expand,
                        className:
                            "flex items-center gap-2 text-xs text-white hover:text-[#ffe700]",
                        children: [
                            h(
                                "div",
                                {
                                    key: "swatch",
                                    className:
                                        "w-4 h-4 rounded border border-slate-600 flex items-center justify-center",
                                    style: { background: "#333", overflow: "hidden" },
                                },
                                src
                                    ? h("img", {
                                        src,
                                        alt: "",
                                        style: {
                                            maxWidth: "100%",
                                            maxHeight: "100%",
                                            objectFit: "contain",
                                            imageRendering: "pixelated",
                                        },
                                    })
                                    : null,
                            ),
                            h("span", { key: "label" }, selected?.label ?? "—"),
                        ],
                    },
                ),
                list.isMirrored()
                    ? h("span", { className: "text-xs text-[#ffe700]" }, "Mirrored")
                    : null,
                h(
                    "span",
                    { className: "text-xs text-slate-500" },
                    "Click to expand",
                ),
            );
        }
        return h(
            "div",
            {
                className:
                    "pointer-events-auto flex min-h-0 flex-col overflow-hidden bg-black bg-opacity-75 border border-slate-700 rounded ui-box text-slate-300",
                style: {
                    width: `75vw`,
                    maxWidth: `75vw`,
                    maxHeight: `${maxHeight}px`,
                    position: "fixed",
                    bottom: "80px",
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 1000,
                },
            },
            h(
                "div",
                {
                    className:
                        "px-4 py-2 border-b border-slate-800 flex items-center justify-between",
                },
                h("span", { className: "text-white text-xs opacity-70" }, api.title),
                h(
                    "div",
                    { className: "flex items-center gap-2" },
                    h(FocusableButton, {
                        id: `${api.pickerId}-mirror`,
                        onActivate: api.toggleMirror,
                        className: `text-xs px-2 py-0.5 border rounded ${
                            list.isMirrored()
                                ? "text-[#ffe700] border-yellow-400"
                                : "text-slate-300 border-slate-600"
                        }`,
                        children: `${list.isMirrored() ? "☑" : "☐"} Mirrored`,
                    }),
                    h(FocusableButton, {
                        id: `${api.pickerId}-minimize`,
                        onActivate: api.minimize,
                        className:
                            "text-xs px-2 py-0.5 text-white bg-black border border-slate-600 rounded",
                        children: "Minimize ▾",
                    }),
                ),
            ),
            options.renderHeaderExtra ? options.renderHeaderExtra(ctx()) : null,
            tooltip
                ? h("div", {
                    style: {
                        position: "fixed",
                        left: `${tooltip.x}px`,
                        top: `${tooltip.y - 8}px`,
                        transform: "translate(-50%, -100%)",
                        padding: "2px 6px",
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                        zIndex: 1001,
                        background: "rgba(0,0,0,0.9)",
                        border: "1px solid rgba(255,255,255,0.25)",
                        borderRadius: "3px",
                    },
                    className: "text-xs text-white",
                    children: tooltip.label,
                })
                : null,
            h(
                "div",
                {
                    className: "flex flex-row flex-wrap ",
                },
                h(
                    "div",
                    {
                        className:
                            "grid grid-cols-4 overflow-y-auto  gap-1 px-4 py-2 border-b border-slate-800",
                        style: {
                            height: `18vh`,
                        },
                    },
                    list.categories
                        .filter((cat: { id: string; label: string }) => list.countIn(cat.id) > 0)
                        .map((cat: { id: string; label: string }) =>
                            h(FocusableButton, {
                                key: cat.id,
                                id: `${api.pickerId}-cat-${cat.id}`,
                                onActivate: () => {
                                    // Jump back to the top before switching category.
                                    savedScrollRef.current = 0;
                                    if (scrollRef.current) scrollRef.current.scrollTop = 0;
                                    api.chooseCategory(cat.id);
                                },
                                className: `text-xs px-2 py-0.5 rounded border w-[100px] ${
                                    cat.id === categoryId
                                        ? "text-[#ffe700] border-yellow-400"
                                        : "text-slate-400 border-slate-600"
                                }`,
                                children: `${cat.label} ${list.countIn(cat.id)}`,
                            })
                        ),
                ),
                h(
                    "div",
                    {
                        className: "min-h-0 flex-1 px-4 py-2  overflow-y-auto",
                        style: {
                            height: `18vh`,
                        },
                        onScroll: (event: { currentTarget: HTMLElement }) => {
                            savedScrollRef.current = event.currentTarget.scrollTop;
                        },
                        ref: (node: HTMLElement | null) => {
                            scrollRef.current = node;
                        },
                    },
                    h(
                        "div",
                        { className: "flex flex-wrap gap-1.5" },
                        visible.map((item) =>
                            h(ObjectSwatch, {
                                key: item.id,
                                item,
                                selected: item.id === selected?.id,
                            })
                        ),
                    ),
                ),
            ),
        );
    };

    return () => h(Picker, null);
}
