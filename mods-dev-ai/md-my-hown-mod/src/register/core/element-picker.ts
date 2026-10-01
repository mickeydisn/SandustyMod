
import { configIsHidden, LOG } from "../../constants.ts";


const hiddenTypes = new Set<number>();

let installed = false;
let detach: (() => void) | null = null;


function getHooksApi(): {
    modify?: (id: string, fn: (args: unknown) => void, opts?: unknown) => unknown;
} | null {
    try {
        return (globalThis as { sandkit?: { api?: { hooks?: unknown } } }).sandkit?.api?.hooks ??
            null;
    } catch {
        return null;
    }
}

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

    const modify = getHooksApi()?.modify;
    if (typeof modify !== "function") {
        
        
        
        console.warn(
            `${LOG} element picker: hooks.modify unavailable — ` +
                `${hiddenTypes.size} element(s) hidden in the panel but still in the vacuum`,
        );
        return 0;
    }

    const ret = modify(
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
    if (typeof ret === "function") detach = ret as () => void;

    console.log(
        `${LOG} element picker: withholding ${hiddenTypes.size} element(s) ` +
            `types ${[...hiddenTypes].join(",")}`,
    );
    return hiddenTypes.size;
}


export function hiddenElementTypes(): number[] {
    return [...hiddenTypes].sort((a, b) => a - b);
}


export function __resetElementPickerForTests(): void {
    try {
        detach?.();
    } catch {
        
    }
    detach = null;
    installed = false;
    hiddenTypes.clear();
}
