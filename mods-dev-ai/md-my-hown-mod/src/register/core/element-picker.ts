import { api } from "../../packages/mysandkit.ts";
import { configIsHidden, LOG } from "../../constants.ts";

const hiddenTypes = new Set<number>();

let installed = false;

export function noteElementVisibility(
    type: number | undefined,
    entry: Record<string, unknown>,
): boolean {
    if (typeof type !== "number" || !configIsHidden(entry, "elements")) return false;
    hiddenTypes.add(type);
    return true;
}

export function installElementPickerVisibility(): number {
    if (installed) return hiddenTypes.size;
    installed = true;
    if (hiddenTypes.size === 0) return 0;

    if (!api.hooks.hasHooks()) {
        console.warn(
            `${LOG} element picker: hooks.modify unavailable — ` +
                `${hiddenTypes.size} element(s) hidden in the panel but still in the vacuum`,
        );
        return 0;
    }

    api.hooks.modify(
        "vacuum:element:prepare",
        (args: unknown) => {
            const a = args as { elementType?: unknown; visibleInPicker?: unknown } | null;
            if (a === null || typeof a !== "object") return;
            if (typeof a.elementType === "number" && hiddenTypes.has(a.elementType)) {
                a.visibleInPicker = false;
            }
        },
        { priority: 1000 },
    );

    console.log(
        `${LOG} element picker: withholding ${hiddenTypes.size} element(s) ` +
            `types ${[...hiddenTypes].join(",")}`,
    );
    return hiddenTypes.size;
}
