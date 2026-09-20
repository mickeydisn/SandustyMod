/** Seeded 2D simplex noise (self-contained, same contract as web generator). */

function seedFromString(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

const GRAD3: ReadonlyArray<readonly [number, number, number]> = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];
const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

export class SimplexNoise {
  private readonly perm = new Uint8Array(512);
  private readonly permMod12 = new Uint8Array(512);

  constructor(seed: string | number) {
    const next = seedFromString(String(seed));
    const source = Uint8Array.from({ length: 256 }, (_, i) => i % 12);
    for (let i = 255; i > 0; i--) {
      const j = next() % (i + 1);
      const tmp = source[i]!;
      source[i] = source[j]!;
      source[j] = tmp;
    }
    for (let i = 0; i < 512; i++) {
      const value = source[i & 255]!;
      this.perm[i] = value;
      this.permMod12[i] = value % 12;
    }
  }

  noise2D(xin: number, yin: number): number {
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const x0 = xin - (i - t);
    const y0 = yin - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    let n = 0;
    n += this.corner(x0, y0, this.permMod12[ii + this.perm[jj]!]!);
    n += this.corner(x1, y1, this.permMod12[ii + i1 + this.perm[jj + j1]!]!);
    n += this.corner(x2, y2, this.permMod12[ii + 1 + this.perm[jj + 1]!]!);
    return 70 * n;
  }

  private corner(x: number, y: number, gi: number): number {
    let t = 0.5 - x * x - y * y;
    if (t < 0) return 0;
    const g = GRAD3[gi]!;
    t *= t;
    return t * t * (g[0] * x + g[1] * y);
  }
}
