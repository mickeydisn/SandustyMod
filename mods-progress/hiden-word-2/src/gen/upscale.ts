/** Scale2x / EPX — edge-aware 2× upscale for discrete terrain codes. */

export function scale2x(
  src: Uint8Array,
  w: number,
  h: number,
): { data: Uint8Array; width: number; height: number } {
  const ow = w * 2;
  const oh = h * 2;
  const out = new Uint8Array(ow * oh);

  const at = (x: number, y: number) => {
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x >= w) x = w - 1;
    if (y >= h) y = h - 1;
    return src[y * w + x]!;
  };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const B = at(x, y - 1);
      const D = at(x - 1, y);
      const E = at(x, y);
      const F = at(x + 1, y);
      const H = at(x, y + 1);

      let e0 = E, e1 = E, e2 = E, e3 = E;
      if (B !== H && D !== F) {
        e0 = D === B ? D : E;
        e1 = B === F ? F : E;
        e2 = D === H ? D : E;
        e3 = H === F ? F : E;
      }

      const ox = x * 2;
      const oy = y * 2;
      out[oy * ow + ox] = e0;
      out[oy * ow + ox + 1] = e1;
      out[(oy + 1) * ow + ox] = e2;
      out[(oy + 1) * ow + ox + 1] = e3;
    }
  }

  return { data: out, width: ow, height: oh };
}

/** Nearest-neighbor pad if target is odd (Scale2x only does exact 2×). */
export function padToSize(
  data: Uint8Array,
  w: number,
  h: number,
  tw: number,
  th: number,
): Uint8Array {
  if (w === tw && h === th) return data;
  const out = new Uint8Array(tw * th);
  for (let y = 0; y < th; y++) {
    const sy = Math.min(h - 1, (y * h / th) | 0);
    for (let x = 0; x < tw; x++) {
      const sx = Math.min(w - 1, (x * w / tw) | 0);
      out[y * tw + x] = data[sy * w + sx]!;
    }
  }
  return out;
}
