/**
 * Variable picker — custom overlay for buffer-controls.
 *
 * A slim list picker (icon + path text per row) showing every JsonBuffer path
 * in a single "Variables" category. No size selector, no category tabs — just
 * the rows. Opened when a buffer-controls structure is the active build action
 * (driven by `action:changed`, same pattern as the catalogue picker), and each
 * row click unlocks + selects that structure in the build tool.
 */
import "@sandmd/sandkit";
import type { BuildList, CatalogueItem } from "@sandmd/catalogue";

const h = (
    type: unknown,
    props: Record<string, unknown> | null,
    ...children: unknown[]
) => sandkit.react.createElement(type, props, ...children);

export interface VariablePicker {
    readonly pickerId: string;
    dispose(): void;
}

export interface VariablePickerOptions {
    list: BuildList;
    title?: string;
    /** Resolve the sprite id shown for an item (icon in the row). */
    spriteFor: (item: CatalogueItem) => string | undefined;
}

/** Mutable bridge so the non-React controller can bump the React view. */
interface RepaintBridge {
    repaint: (() => void) | null;
}

export function createVariablePicker(options: VariablePickerOptions): VariablePicker {
    const list = options.list;
    const pickerId = `${list.modId}/picker`;
    const title = options.title ?? "Buffer variables";
    const modPrefix = `${list.modId}:`;
    const bridge: RepaintBridge = { repaint: null };

    let open = false;
    let minimized = false;
    let unsubscribe: (() => void) | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const selectItem = (item: CatalogueItem) => {
        const type = list.structureType(item.id);
        sandkit.api.player.buildings.unlockByType(type);
        list.setSelected(item.id);
        sandkit.api.building?.selectStructure?.(type);
        bridge.repaint?.();
    };

    const Row = (props: { item: CatalogueItem }) => {
        const spriteId = options.spriteFor(props.item);
        const src = spriteId
            ? sandkit.api.sprites.getById(spriteId)?.imageAsset?.image?.src
            : undefined;
        const selected = list.getSelected()?.id === props.item.id;
        return h(
            "button",
            {
                key: props.item.id,
                onClick: () => selectItem(props.item),
                className:
                    "flex items-center gap-2 w-full text-left px-3 py-1.5 rounded border text-xs whitespace-nowrap " +
                    (selected
                        ? "text-[#ffe700] border-yellow-400 bg-yellow-400/10"
                        : "text-slate-300 border-slate-700 hover:text-white hover:border-slate-500"),
                children: [
                    src
                        ? h("img", { src, width: 16, height: 16, className: "shrink-0" })
                        : h("span", { className: "w-4 h-4 shrink-0" }),
                    h("span", { children: props.item.label }),
                    h("span", {
                        className: "ml-auto text-slate-500 text-[10px] uppercase",
                        children: String((props.item as { kind?: string }).kind ?? ""),
                    }),
                ],
            },
        );
    };

    const Panel = () => {
        const [, forceUpdate] = sandkit.react.useState(0) as [
            number,
            (n: number | ((p: number) => number)) => void,
        ];

        // Wire the controller's repaint to this component's state bump.
        if (!bridge.repaint) {
            bridge.repaint = () => forceUpdate((n: number) => n + 1);
        }

        const items = list.catalogueItems.filter((i) => i.category === "variables");
        if (!open) return null;

        if (minimized) {
            return h(
                "div",
                {
                    className:
                        "flex items-center gap-2 bg-slate-900/90 border border-slate-700 rounded px-3 py-1",
                },
                h("span", { className: "text-xs text-slate-300", children: title }),
                h("button", {
                    className: "text-xs text-slate-400 hover:text-white",
                    onClick: () => {
                        minimized = false;
                        bridge.repaint?.();
                    },
                    children: "▲",
                }),
            );
        }

        return h(
            "div",
            {
                className:
                    "flex flex-col bg-slate-900/90 border border-slate-700 rounded w-[320px] max-h-[40vh]",
            },
            h(
                "div",
                { className: "flex items-center px-3 py-2 border-b border-slate-700" },
                h("span", { className: "text-xs text-white font-bold", children: title }),
                h("button", {
                    className: "ml-auto text-xs text-slate-400 hover:text-white",
                    onClick: () => {
                        minimized = true;
                        bridge.repaint?.();
                    },
                    children: "—",
                }),
            ),
            h(
                "div",
                { className: "flex flex-col gap-1 px-2 py-2 overflow-y-auto" },
                items.map((item) => h(Row, { key: item.id, item })),
            ),
        );
    };

    const syncNow = () => {
        const selected = sandkit.api.action.getSelected?.();
        const building = sandkit.enums?.ActionType?.Building;
        const ours = !!selected && selected.type === building &&
            typeof selected.id === "string" && selected.id.startsWith(modPrefix);
        if (ours) {
            const id = list.itemFromType(String(selected.id))?.id;
            if (id) list.setSelected(id);
            open = true;
        } else {
            open = false;
            minimized = false;
        }
        bridge.repaint?.();
    };

    // `action:changed` carries no payload and can fire before the engine has
    // committed the new action, so `getSelected()` may read the PREVIOUS value
    // during the event (why a single emit looked like a no-op and a second one
    // was needed). Defer the read to the next tick so the committed state is
    // visible, and coalesce bursts.
    let syncQueued = false;
    const sync = () => {
        if (syncQueued) return;
        syncQueued = true;
        setTimeout(() => {
            syncQueued = false;
            syncNow();
        }, 0);
    };

    const install = () => {
        sandkit.api.ui.overlays.register(
            "hotbar",
            pickerId,
            () => sandkit.react.createElement(Panel, null),
        );
        unsubscribe = sandkit.api.events.on("action:changed", sync);
        // Safety net for engine paths that mutate the action without emitting
        // (docs_tech/11 §3) — a slow, cheap, read-only poll.
        pollTimer = setInterval(syncNow, 1000);
        sync();
    };

    install();

    return {
        pickerId,
        dispose() {
            unsubscribe?.();
            unsubscribe = null;
            if (pollTimer !== null) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
            open = false;
            bridge.repaint = null;
        },
    };
}
