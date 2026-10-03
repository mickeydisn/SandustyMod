declare const sandkit: any;

export const g = () => {
    try {
        if (typeof sandkit !== "undefined" && sandkit) return sandkit;
    } catch {}
    return (globalThis as any).sandkit ?? (globalThis as any).__sandkit;
};
