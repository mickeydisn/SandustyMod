import { itemIdFromType } from "../list/createBuildList.ts";
import { CatalogueItem } from "../strucutre/types.ts";
import { persistSelection, restorePickerState } from "../list/persistence.ts";
import { h, HTMLElement } from "./react.ts";
import { applyScroll, rememberScroll, requestScrollRestore, resetScroll } from "./scroll.ts";
import type { PickerContext, PickerOverlay, PickerOverlayOptions } from "./types.ts";

type PickerState = { minimized: boolean } | null;

const TOOLTIP_DELAY_MS = 120;

export function createPickerOverlay(
    options: PickerOverlayOptions,
): PickerOverlay {
    // const host = options.host;
    const list = options.list;
    const pickerId = options.pickerId ?? `${list.modId}/picker`;
    const slot = options.slot ?? "hotbar";
    const title = options.title ?? "Pick item";
    const maxHeight = options.maxHeight ?? 400;
    const syncIntervalMs = options.syncIntervalMs ?? 100;

    let pickerState: PickerState = null;
    let repaint: (() => void) | null = null;
    const search = "";
    let tooltip: { label: string; x: number; y: number } | null = null;
    let tooltipTimer: ReturnType<typeof setTimeout> | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let registered = false;

    if (options.persistSelection !== false) restorePickerState(list);

    const unlockTypes = options.unlockTypes ??
        ((types: string[]) => {
            for (const type of types) sandkit.api.player.buildings.unlockByType(type);
        });

    const clearTooltip = () => {
        if (tooltipTimer) clearTimeout(tooltipTimer);
        tooltipTimer = null;
        if (!tooltip) return;
        tooltip = null;
        repaint?.();
    };

    const scheduleTooltip = (label: string, rect: DOMRect) => {
        if (tooltipTimer) clearTimeout(tooltipTimer);
        tooltipTimer = setTimeout(() => {
            tooltipTimer = null;
            tooltip = { label, x: rect.left + rect.width / 2, y: rect.top };
            repaint?.();
        }, TOOLTIP_DELAY_MS);
    };

    const ctx = (): PickerContext => ({
        list,
        selected: list.getSelected(),
        mirrored: list.isMirrored(),
        categoryId: list.getCategory(),
        search,
        repaint: () => repaint?.(),
    });

    const selectItem = (item: CatalogueItem) => {
        list.setSelected(item.id);
        list.setCategory(item.category);
        const mirrored = list.isMirrored();
        const type = list.structureType(item.id, mirrored);
        unlockTypes([type, list.structureType(item.id, !mirrored)]);
        options.onSelect?.(item, mirrored);
        list.applyToBuildTool();
        if (options.persistSelection !== false) persistSelection(list);
        repaint?.();
        // minimize();
    };

    const expand = () => {
        if (!pickerState?.minimized) return;
        requestScrollRestore();
        pickerState = { minimized: false };
        repaint?.();
    };

    const minimize = () => {
        if (!pickerState || pickerState.minimized) return;
        clearTooltip();
        pickerState = { minimized: true };
        repaint?.();
    };

    const close = () => {
        clearTooltip();
        pickerState = null;
        repaint?.();
    };

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
            scope: pickerId,
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

        const SWATCH_BOX = 34;
        const MAX_SWATCH_ZOOM = 4;

        function swatchZoom(width: number, height: number, box = SWATCH_BOX): number {
            const longest = Math.max(width, height);
            if (longest <= 0) return 1;
            return Math.max(1, Math.min(MAX_SWATCH_ZOOM, Math.floor(box / longest)));
        }

        const zoom = swatchZoom(props.item.width, props.item.height);
        return h(
            FocusableButton,
            {
                id: `${pickerId}-item-${props.item.id}`,
                onHoverStart: (rect: DOMRect) => {
                    const extra = "Hello";
                    scheduleTooltip(
                        `${props.item.label} — ${props.item.width}×${props.item.height}${extra}`,
                        rect,
                    );
                },
                onHoverEnd: clearTooltip,
                onActivate: () => selectItem(props.item),
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
        sandkit.react.useEffect(() => {
            repaint = () => bump((n: number) => n + 1); // functional update, always changes
            return () => {
                if (repaint) repaint = null;
            };
        }, []);

        if (!pickerState) return null;

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

        if (pickerState.minimized) {
            const src = selected ? spriteSrc(selected) : undefined;
            return h(
                "div",
                {
                    className:
                        "pointer-events-auto flex items-center gap-2 bg-black bg-opacity-75 border border-slate-700 rounded px-3 py-2 ui-box text-slate-300",
                    onClick: expand,
                },
                h("span", { className: "text-white text-xs opacity-70" }, title),
                h(
                    FocusableButton,
                    {
                        id: `${pickerId}-selected`,
                        onActivate: expand,
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
                h("span", { className: "text-white text-xs opacity-70" }, title),
                h(
                    "div",
                    { className: "flex items-center gap-2" },
                    h(FocusableButton, {
                        id: `${pickerId}-mirror`,
                        onActivate: () => {
                            const next = !list.isMirrored();
                            list.setMirrored(next);
                            const item = list.getSelected();
                            if (item) {
                                const type = list.structureType(item.id, next);
                                unlockTypes([type]);
                                sandkit.api.building?.selectStructure(type);
                            }
                            if (options.persistSelection !== false) {
                                persistSelection(list);
                            }
                            repaint?.();
                        },
                        className: `text-xs px-2 py-0.5 border rounded ${
                            list.isMirrored()
                                ? "text-[#ffe700] border-yellow-400"
                                : "text-slate-300 border-slate-600"
                        }`,
                        children: `${list.isMirrored() ? "☑" : "☐"} Mirrored`,
                    }),
                    h(FocusableButton, {
                        id: `${pickerId}-minimize`,
                        onActivate: minimize,
                        className:
                            "text-xs px-2 py-0.5 text-white bg-black border border-slate-600 rounded",
                        children: "Minimize ▾",
                    }),
                ),
            ),
            /*
      options.search !== false
        ? h(
          "div",
          { className: "px-4 py-2 border-b border-slate-800" },
          h("input", {
            type: "search",
            placeholder: "Search…",
            value: search,
            className:
              "w-full text-xs bg-black border border-slate-700 rounded px-2 py-1 text-white",
            onInput: (event: { currentTarget: { value: string } }) => {
              search = event.currentTarget.value;
              repaint?.();
            },
          }),
        )
        : null,
      */
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
                    // className: "flex flex-wrap gap-1 px-4 py-2 border-b border-slate-800",
                    className: "flex flex-row flex-wrap ",
                },
                h(
                    "div",
                    {
                        // className: "flex flex-wrap gap-1 px-4 py-2 border-b border-slate-800",
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
                                id: `${pickerId}-cat-${cat.id}`,
                                onActivate: () => {
                                    list.setCategory(cat.id);
                                    const next = !list.isMirrored();
                                    const item = list.itemsInCategory(cat.id)[0];
                                    if (item) {
                                        const type = list.structureType(item.id, next);
                                        unlockTypes([type]);
                                        sandkit.api.building?.selectStructure(type);
                                    }
                                    if (options.persistSelection !== false) {
                                        persistSelection(list);
                                    }
                                    resetScroll();
                                    repaint?.();
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
                            // @ts-ignore HTMLElement
                            rememberScroll(event.currentTarget.scrollTop);
                        },
                        ref: (node: HTMLElement | null) => applyScroll(node),
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

    const selectedModType = (): string | undefined => {
        const selected = sandkit.api.action.getSelected?.();
        const building = sandkit.enums.ActionType.Building;
        if (!selected || (building != null && selected.type !== building)) {
            return undefined;
        }
        const id = selected.id;
        if (!id || !id.startsWith(`${list.modId}:`)) return undefined;
        return itemIdFromType(list.modId, id) ? id : undefined;
    };
    const sync = () => {
        const type = selectedModType();
        if (type && !pickerState) {
            const itemId = itemIdFromType(list.modId, type);
            if (itemId) {
                list.setSelected(itemId);
                // list.setMirrored(isMirroredType(type));
                pickerState = { minimized: true };
                repaint?.();
            }
            return;
        }
        if (type && pickerState) {
            const itemId = itemIdFromType(list.modId, type);
            if (itemId && itemId !== list.getSelected()?.id) {
                list.setSelected(itemId);
                repaint?.();
            }
            return;
        }
        if (!type && pickerState) {
            close();
        }
    };

    const install = () => {
        if (registered) return;
        sandkit.api.ui.overlays.register(slot, pickerId, () => h(Picker, null));
        registered = true;
        timer = setInterval(sync, syncIntervalMs);
        timer.unref?.();
    };

    install();

    return {
        pickerId,
        expand,
        minimize,
        close,
        sync,
        dispose() {
            if (timer) clearInterval(timer);
            timer = null;
            close();
        },
    };
}
