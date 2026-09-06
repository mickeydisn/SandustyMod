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
  const existing = sandkit.api.shared.buffers.get(key);
  if (existing) return existing;
  if (!sandkit.api.shared.buffers.ensure) {
    return null;
  }
  return sandkit.api.shared.buffers.ensure(key, config);
};
