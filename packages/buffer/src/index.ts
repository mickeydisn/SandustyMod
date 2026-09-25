export { JsonBuffer } from "./json-buffer.ts";
export type { JsonBufferConfig } from "./json-buffer.ts";
export { JsonMapBuffer } from "./json-map-buffer.ts";
export type { JsonMapBufferConfig, JsonMapCounterOptions } from "./json-map-buffer.ts";
export type { FieldInfo, FieldKind, ListPathsOptions } from "./utils/introspect.ts";
// Pure path write helper — used to build a seed record from declared paths.
export { setPath } from "./utils/paths.ts";
// The surface JsonBuffer and JsonMapBuffer both satisfy, so a consumer can be
// written once and run on either backing store.
export type { BufferHandle } from "./buffer-handle.ts";
