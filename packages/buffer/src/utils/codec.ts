// NUL-terminated JSON codec for the shared data buffer.
/** Decode the JSON payload currently stored in `view`. Returns null if empty/corrupt. */
export function decodeJson<T>(buffer: Uint8Array): T | null {
  try {
    const end = buffer.indexOf(0);
    const bytes = buffer.slice(0, end === -1 ? buffer.length : end);
    const result = new TextDecoder().decode(bytes);
    const obj = JSON.parse(result) as T;
    return obj;
  } catch (e) {
    console.error("readJsonString failed", e);
  }
  return null;
}

/**
 * Encode `value` as JSON into `view`. NUL-terminates the bytes and throws if
 * the payload doesn't fit — never silently truncates (that would corrupt the
 * stored record).
 */
export function encodeJsonInBuffer(buf: Uint8Array, value: unknown): Uint8Array {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  if (bytes.length > buf.length) {
    throw new Error(
      `JSON payload of ${bytes.length} bytes does not fit in ${buf.length}-byte buffer`,
    );
  }
  buf.fill(0);
  buf.set(bytes);
  return bytes;
}
