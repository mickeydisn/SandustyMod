import "@sandmd/sandkit";

type SharedBufferType =
    | "uint8"
    | "uint16"
    | "uint32"
    | "int8"
    | "int16"
    | "int32"
    | "float32"
    | "float64";

type SharedBufferConfig = {
    type: SharedBufferType;
    length: number;
};

export const ensureBuffer = (
    key: string,
    config: SharedBufferConfig,
): unknown => {
    const buffers = (sandkit.api as {
        shared?: {
            buffers?: Record<string, unknown> & {
                get?: (key: string) => unknown;
                ensure?: (key: string, config: SharedBufferConfig) => unknown;
                require?: (key: string, config: SharedBufferConfig) => unknown;
            };
        };
    }).shared?.buffers;
    if (!buffers) return null;
    const existing = buffers.get?.(key);
    if (existing) return existing;
    // Main thread: ensure. Worker facade: only require (get-or-create) exists.
    if (buffers.ensure) return buffers.ensure(key, config);
    if (buffers.require) return buffers.require(key, config);
    return null;
};
