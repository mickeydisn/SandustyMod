import {
  CANVA_HEIGHT,
  CANVA_WIDTH,
  HEIGHT,
  itemsColorB,
  WIDTH,
} from "./const.js";

// ----------------------------------------------------
// ----------------------------------------------------
// ----------------------------------------------------

// 🔁 Convert to 2D array for GPU.js
export function IntArrayto2D(input, WIDTH, HEIGHT) {
  const result = [];
  for (let y = 0; y < HEIGHT; y++) {
    const row = [];
    for (let x = 0; x < WIDTH; x++) {
      row.push(input[y * WIDTH + x]);
    }
    result.push(row);
  }
  return result;
}

// ----------------------------------------------------

const gpu = new GPU.GPU();
// ----------------------------------------------------

export function tEmpty() {
  return 0;
}
gpu.addFunction(tEmpty);

export function tSky() {
  return 1;
}
gpu.addFunction(tSky);
export function tRock() {
  return 2;
}
gpu.addFunction(tRock);
export function tTunnel() {
  return 3;
}
gpu.addFunction(tTunnel);
export function tCave() {
  return 4;
}
gpu.addFunction(tCave);
export function tFloor() {
  return 101;
}
gpu.addFunction(tFloor);
export function tRoof() {
  return 102;
}
gpu.addFunction(tRoof);
export function tWallL() {
  return 103;
}
gpu.addFunction(tWallL);
export function tWallR() {
  return 104;
}
gpu.addFunction(tWallR);

// -----

function isCaverne(c) {
  return c == tTunnel() ? 1 : 0;
}
gpu.addFunction(isCaverne);

// -----
function gpuNearTile(data, x, y, w, h) {
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < w - 1 ? data[y][x + 1] : c;
  return [u, r, d, l];
}
gpu.addFunction(gpuNearTile);

// -----
function gpuNearTile2D(data, x, y, w, h) {
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < w - 1 ? data[y][x + 1] : c;

  const ur = y > 0 && x < this.constants.w - 1 ? data[y - 1][x + 1] : c;
  const dr = x < this.constants.w - 1 && y < this.constants.h - 1
    ? data[y + 1][x + 1]
    : c;
  const dl = y < this.constants.h - 1 && x > 0 ? data[y + 1][x - 1] : c;
  const ul = x > 0 && y > 0 ? data[y][x - 1] : c;

  return [[ul, u, ur], [l, c, r], [dl, d, dr]];
}
gpu.addFunction(gpuNearTile2D);

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

export const convIdentity = gpu.createKernel(function (data) {
  // ------
  const x = this.thread.x;
  const y = this.thread.y;
  const c = data[y][x];
  // ------
  return c;
}).setConstants({ w: WIDTH, h: HEIGHT })
  .setOutput([WIDTH, HEIGHT])
  .setPipeline(true)
  .setImmutable(true);

// ----------------------------------------------------------------------------
export const convIdentity2x = gpu.createKernel(function (data) {
  const x = Math.floor(this.thread.x / 2);
  const y = Math.floor(this.thread.y / 2);
  const c = data[y][x];
  return c;
})
  .setConstants({ w: WIDTH, h: HEIGHT })
  .setOutput([WIDTH * 2, HEIGHT * 2])
  .setPipeline(true)
  .setImmutable(true);

export const convIdentity4x = gpu.createKernel(function (data) {
  const x = Math.floor(this.thread.x / 2);
  const y = Math.floor(this.thread.y / 2);
  const c = data[y][x];
  return c;
})
  .setConstants({ w: WIDTH * 2, h: WIDTH * 2 })
  .setOutput([WIDTH * 4, HEIGHT * 4])
  .setPipeline(true)
  .setImmutable(true);
// ----------------------------------------------------------------------------
export const convKernelMakerSelectMask = (min, max) => {
  return gpu.createKernel(function (data) {
    // ------
    const x = this.thread.x;
    const y = this.thread.y;
    const c = data[y][x];
    // ------
    return c >= this.constants.min && c <= this.constants.max ? 1 : 0;
  })
    .setConstants({ w: WIDTH, h: HEIGHT, min: min, max: max })
    .setOutput([WIDTH, HEIGHT])
    .setPipeline(true)
    .setImmutable(true);
};

// ----------------------------------------------------------------------------
export const convSelectMaxNeighborValueMask = gpu.createKernel(function (data) {
  // ------
  const x = this.thread.x;
  const y = this.thread.y;
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const r = x < this.constants.w - 1 ? data[y][x + 1] : c;
  const d = y < this.constants.h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;

  const ur = y > 0 && x < this.constants.w - 1 ? data[y - 1][x + 1] : c;
  const rd = x < this.constants.w - 1 && y < this.constants.h - 1
    ? data[y + 1][x + 1]
    : c;
  const dl = y < this.constants.h - 1 && x > 0 ? data[y + 1][x - 1] : c;
  const lu = x > 0 && y > 0 ? data[y][x - 1] : c;

  // ------
  return c > u && c > r && c > d && c > l &&
      c > ur && c > rd && c > dl &&
      c > lu
    ? 1
    : 0;
})
  .setConstants({ w: WIDTH, h: HEIGHT })
  .setOutput([WIDTH, HEIGHT])
  .setPipeline(true)
  .setImmutable(true);

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

export const convKernelMakerPropagateDistance = (from, inside) => {
  return gpu.createKernel(function (data) {
    // ------
    const x = this.thread.x;
    const y = this.thread.y;
    const c = data[y][x];
    const u = y > 0 ? data[y - 1][x] : c;
    const r = x < this.constants.w - 1 ? data[y][x + 1] : c;
    const d = y < this.constants.h - 1 ? data[y + 1][x] : c;
    const l = x > 0 ? data[y][x - 1] : c;

    const ur = y > 0 && x < this.constants.w - 1 ? data[y - 1][x + 1] : c;
    const rd = x < this.constants.w - 1 && y < this.constants.h - 1
      ? data[y + 1][x + 1]
      : c;
    const dl = y < this.constants.h - 1 && x > 0 ? data[y + 1][x - 1] : c;
    const lu = x > 0 && y > 0 ? data[y][x - 1] : c;

    // ------
    let from = 0;
    for (let i = 0; i < this.constants.fromLength; i++) {
      const item = this.constants.from[i];
      if (u == item || r == item || d == item || l == item) {
        from = 1;
      }
    }

    let inside = 0;
    for (let i = 0; i < this.constants.insideLength; i++) {
      const item = this.constants.inside[i];
      if (c == item) {
        inside = 1;
      }
    }
    if (inside == 1) {
      if (from == 1) {
        return 1024;
      }
      let max = 1024 - 1;
      max = u > max ? u : max;
      max = r > max ? r : max;
      max = d > max ? d : max;
      max = l > max ? l : max;
      let max2 = 1024 - 1;
      max2 = ur > max2 ? ur : max2;
      max2 = rd > max2 ? rd : max2;
      max2 = dl > max2 ? dl : max2;
      max2 = lu > max2 ? lu : max2;

      if (max >= 1024 || max2 >= 1024) {
        return max > max2 ? max + 1 : max2 + 1.414;
      }
    }
    return c;
  })
    .setConstants({
      w: WIDTH,
      h: HEIGHT,
      from: from,
      fromLength: from.length,
      inside: inside,
      insideLength: inside.length,
    })
    .setOutput([WIDTH, HEIGHT])
    .setPipeline(true)
    .setImmutable(true);
};

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

export const convRepaceCave = gpu.createKernel(function (data) {
  // ------
  const x = this.thread.x;
  const y = this.thread.y;
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < this.constants.h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < this.constants.w - 1 ? data[y][x + 1] : c;
  // ------

  return c == tCave() ? tTunnel() : c;
})
  .setConstants({ w: WIDTH, h: HEIGHT })
  .setOutput([WIDTH, HEIGHT])
  .setPipeline(true)
  .setImmutable(true);

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
export const convKernelMakerGrow = (
  from,
  inside,
  replaceWalls,
  mask = 0,
  scaleSize = 1,
) => {
  return gpu.createKernel(function (data) {
    // ------
    const w = this.constants.w;
    const h = this.constants.h;
    const x = this.thread.x;
    const y = this.thread.y;
    const c = data[y][x];
    const nearTile = gpuNearTile(data, x, y, w, h);

    // Test is the cell is inside the think we want modify .
    let inside = 0;
    for (let i = 0; i < this.constants.insideLength; i++) {
      const itemFrom = this.constants.inside[i];
      if (c == itemFrom) {
        inside = 1;
      }
    }
    // If c is not in the inside list , return the original color or 0.
    if (inside == 0) {
      return this.constants.isMask == 0 ? c : 0;
    }

    // Check if near tile match the from list  .
    for (let k = 0; k < 4; k++) {
      const replaceWalls = this.constants.replaceWalls[k];
      if (replaceWalls == 0) {
        continue;
      }
      for (let i = 0; i < this.constants.fromLength; i++) {
        const targetItem = this.constants.from[i];
        if (nearTile[k] == targetItem) {
          return replaceWalls;
        }
      }
    }
    return this.constants.isMask == 0 ? c : 0;
  })
    .setConstants({
      w: WIDTH * scaleSize,
      h: HEIGHT * scaleSize,
      from: from,
      fromLength: from.length,
      inside: inside,
      insideLength: inside.length,
      replaceWalls: replaceWalls,
      isMask: mask,
    })
    .setOutput([WIDTH * scaleSize, HEIGHT * scaleSize])
    .setPipeline(true)
    .setImmutable(true);
};

export const convKernelMakerGrowInside = (
  from,
  inside,
  replaceWalls,
) => {
  return convKernelMakerGrow(from, inside, replaceWalls, 0, 1);
};
export const convKernelMakerGrowInside4x = (
  from,
  inside,
  replaceWalls,
) => {
  return convKernelMakerGrow(from, inside, replaceWalls, 0, 4);
};
export const convKernelMakerMaskInside = (
  from,
  inside,
  replaceWalls,
) => {
  return convKernelMakerGrow(from, inside, replaceWalls, 1, 1);
};
// ----------------------------------------------------------------------------

export const convExtandWall = gpu.createKernel(function (data) {
  // ------
  const x = this.thread.x;
  const y = this.thread.y;
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < this.constants.h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < this.constants.w - 1 ? data[y][x + 1] : c;
  // ------

  if (c == tWallL() && u == tRoof() && (l == tRoof() || r == tRoof())) {
    return tRoof();
  }
  if (c == tWallR() && u == tRoof() && (l == tRoof() || r == tRoof())) {
    return tRoof();
  }

  if (c == tWallL() && d == tFloor() && (l == tFloor() || r == tFloor())) {
    return tFloor();
  }
  if (c == tWallR() && d == tFloor() && (l == tFloor() || r == tFloor())) {
    return tFloor();
  }

  if (c == tCave() || c == tTunnel()) {
    if (u == tRoof() || (r == tRoof() && l == tRoof())) {
      return tRoof();
    }
    if (r == tWallR() || (u == tWallR() && d == tWallR())) {
      return tWallR();
    }
    if (d == tFloor() || (r == tFloor() && l == tFloor())) {
      return tFloor();
    }
    if (l == tWallL() || (u == tWallL() && d == tWallR())) {
      return tWallL();
    }

    if (u == tWallL() && l == tRoof()) {
      return tWallL();
    }
    if (u == tWallR() && r == tRoof()) {
      return tWallR();
    }
    if (d == tWallL() && l == tFloor()) {
      return tWallL();
    }
    if (d == tWallR() && r == tFloor()) {
      return tWallR();
    }
    return c;
  }
  return 0;
})
  .setConstants({ w: WIDTH, h: HEIGHT })
  .setOutput([WIDTH, HEIGHT])
  .setPipeline(true)
  .setImmutable(true);

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

export const convPropagatWaterStepA = gpu.createKernel(function (data) {
  // ------
  const x = this.thread.x;
  const y = this.thread.y;
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < this.constants.h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < this.constants.w - 1 ? data[y][x + 1] : c;
  // ------
  if (c == tTunnel() || c == tCave()) {
    if (d == tRock()) {
      return 1024;
    }
    if (d >= 1024) {
      return d + 1;
    }
  }
  if (c >= 1024) {
    if (l >= 1024 && l < c) {
      return l;
    }
    if (r >= 1024 && r < c) {
      return r;
    }
    if (d >= 1024) {
      return d + 1;
    }
  }
  return c;
})
  .setConstants({ w: WIDTH, h: HEIGHT })
  .setOutput([WIDTH, HEIGHT])
  .setPipeline(true)
  .setImmutable(true);

export const convPropagatWaterStepB = gpu.createKernel(function (data) {
  // ------
  const x = this.thread.x;
  const y = this.thread.y;
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < this.constants.h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < this.constants.w - 1 ? data[y][x + 1] : c;
  // ------
  if (c >= 1024) {
    if (l == tTunnel() || l == tCave() || l == tSky()) {
      return l;
    }
    if (r == tTunnel() || r == tCave() || r == tSky()) {
      return r;
    }
    if (d == tTunnel() || d == tCave() || d == tSky()) {
      return d;
    }
    if (d >= 1024) {
      return d + 1;
    }
    if (l >= 1024 && l > c) {
      return l;
    }
    if (r >= 1024 && r > c) {
      return r;
    }
  }
  return c;
})
  .setConstants({ w: WIDTH, h: HEIGHT })
  .setOutput([WIDTH, HEIGHT])
  .setPipeline(true)
  .setImmutable(true);

export const convPropagatWaterStepRefill = gpu.createKernel(function (data) {
  // ------
  const x = this.thread.x;
  const y = this.thread.y;
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < this.constants.h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < this.constants.w - 1 ? data[y][x + 1] : c;
  // ------
  if (c == tTunnel() || c == tCave()) {
    if (u >= 1024) {
      return u - 1;
    }
  }
  return c;
})
  .setConstants({ w: WIDTH, h: HEIGHT })
  .setOutput([WIDTH, HEIGHT])
  .setPipeline(true)
  .setImmutable(true);

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

export const convPropagateLavaStepA = gpu.createKernel(function (data) {
  // ------
  const x = this.thread.x;
  const y = this.thread.y;
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < this.constants.h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < this.constants.w - 1 ? data[y][x + 1] : c;

  if (c == tTunnel() || c == tCave()) {
    if (y == this.constants.h - 1) {
      return 1024;
    }
    if (d == 1024 || l >= 1024 || r >= 1024) {
      return 1024;
    }
  }
  // ------
  return c;
})
  .setConstants({ w: WIDTH, h: HEIGHT })
  .setOutput([WIDTH, HEIGHT])
  .setPipeline(true)
  .setImmutable(true);

export const convPropagateLavaStepB = gpu.createKernel(function (data) {
  // ------
  const x = this.thread.x;
  const y = this.thread.y;
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < this.constants.h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < this.constants.w - 1 ? data[y][x + 1] : c;

  if (c == tTunnel() || c == tCave()) {
    if (l >= 1024 || r >= 1024) {
      return 1024;
    }
  }
  // ------
  return c;
})
  .setConstants({ w: WIDTH, h: HEIGHT })
  .setOutput([WIDTH, HEIGHT])
  .setPipeline(true)
  .setImmutable(true);

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

export const convPropagatSurfaceWaterStepA = gpu.createKernel(function (data) {
  // ------
  const x = this.thread.x;
  const y = this.thread.y;
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < this.constants.h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < this.constants.w - 1 ? data[y][x + 1] : c;
  // ------
  if (c == tSky()) {
    if (d == tRock() || d == tCave()) {
      return 1024;
    }
    if (d >= 1024) {
      return d + 16;
    }
  }
  if (c >= 1024) {
    if (l >= 1024 && l > c) {
      return l;
    }
    if (r >= 1024 && r > c) {
      return r;
    }
  }
  return c;
})
  .setConstants({ w: WIDTH, h: HEIGHT })
  .setOutput([WIDTH, HEIGHT])
  .setPipeline(true)
  .setImmutable(true);

export const convPropagatSurfaceWaterStepB = gpu.createKernel(function (data) {
  // ------
  const x = this.thread.x;
  const y = this.thread.y;
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < this.constants.h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < this.constants.w - 1 ? data[y][x + 1] : c;
  // ------
  if (c >= 1024) {
    if (l == tTunnel() || l == tSky()) {
      return l;
    }
    if (r == tTunnel() || r == tSky()) {
      return r;
    }
    if (d == tTunnel() || d == tSky()) {
      return d;
    }
  }
  return c;
})
  .setConstants({ w: WIDTH, h: HEIGHT })
  .setOutput([WIDTH, HEIGHT])
  .setPipeline(true)
  .setImmutable(true);

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------

export const convKernelMakerReplaceDistance = (
  inside,
  into,
  min,
  maxx = null,
  isInRange = 1, // select in or out ?
) => {
  const max = maxx === null ? min : maxx;
  return gpu.createKernel(function (data, mask) {
    // ------
    const x = this.thread.x;
    const y = this.thread.y;
    const c = data[y][x];
    const m = mask[y][x];
    // ------

    if (m < this.constants.min || m > this.constants.max) {
      return this.constants.isInRange == 1 ? c : this.constants.into;
    }

    let inside = 0;
    for (let i = 0; i < this.constants.insideLength; i++) {
      const item = this.constants.inside[i];
      if (c == item) {
        inside = 1;
      }
    }

    if (inside == 1) {
      return this.constants.isInRange == 1 ? this.constants.into : c;
    }
    return this.constants.isInRange == 1 ? c : this.constants.into;
  })
    .setConstants({
      w: WIDTH,
      h: HEIGHT,
      inside: inside,
      insideLength: inside.length,
      into: into,
      min: min,
      max: max,
      isInRange: isInRange,
    })
    .setOutput([WIDTH, HEIGHT])
    .setPipeline(true)
    .setImmutable(true);
};

export const convKernelMakerReplaceInsideDistance = (
  from,
  to,
  min,
  maxx = null,
) => {
  return convKernelMakerReplaceDistance(from, to, min, maxx, 1);
};

export const convKernelMakerReplaceOutsideDistance = (
  from,
  to,
  min,
  maxx = null,
) => {
  return convKernelMakerReplaceDistance(from, to, min, maxx, 0);
};

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

// -----
function gpuNearTileID(data, x, y, w, h) {
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < w - 1 ? data[y][x + 1] : c;

  const ur = y > 0 && x < this.constants.w - 1 ? data[y - 1][x + 1] : c;
  const dr = x < this.constants.w - 1 && y < this.constants.h - 1
    ? data[y + 1][x + 1]
    : c;
  const dl = y < this.constants.h - 1 && x > 0 ? data[y + 1][x - 1] : c;
  const ul = x > 0 && y > 0 ? data[y][x - 1] : c;

  return [ul, u, ur, l, c, r, dl, d, dr];
}
gpu.addFunction(gpuNearTileID);

export const convKernelMakeNearTileFrequency = (factorSize) => {
  const kernel = gpu.createKernel(function (data) {
    const x = this.thread.x;
    const y = this.thread.y;
    const idToCheck = this.thread.z;

    let countFreq = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < this.output.x && yy >= 0 && yy < this.output.y) {
          const id = Math.floor(data[yy][xx]);
          if (id == idToCheck) {
            countFreq += 1;
          }
        }
      }
    }

    return countFreq;
    // ------
  })
    .setConstants({ w: WIDTH * factorSize, h: HEIGHT * factorSize })
    .setOutput([WIDTH * factorSize, HEIGHT * factorSize, 64])
    .setPipeline(true);
  // .setImmutable(true);

  return kernel; // (data) => kernel(data, freqMap);
};

export const convKernelMakeSmoothing = (factorSize) => {
  const kernel = gpu.createKernel(function (dataNearFrequency) {
    const x = this.thread.x;
    const y = this.thread.y;

    let bestFreq = 0;
    let bestID = 0;
    for (let k = 0; k < 64; k++) {
      if (dataNearFrequency[k][y][x] > bestFreq) {
        bestFreq = dataNearFrequency[k][y][x];
        bestID = k;
      }
    }

    return bestID;
    // ------
  })
    .setConstants({ w: WIDTH * factorSize, h: HEIGHT * factorSize })
    .setOutput([WIDTH * factorSize, HEIGHT * factorSize])
    .setPipeline(true);
  // .setImmutable(true);

  return kernel; // (data) => kernel(data, freqMap);
};

export const convSmoothBorder = (data, sizeScall = 1) => {
  const kernelNearTileFrequency = convKernelMakeNearTileFrequency(sizeScall);
  const kernelSmoothing = convKernelMakeSmoothing(sizeScall);

  const frequenty = kernelNearTileFrequency(data);
  const smoothing = kernelSmoothing(frequenty);

  return smoothing;
};

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

export const applyMaskToBuffer = (
  maskWidth,
  maskHeight,
  centerX,
  centerY,
  itemId,
) => {
  return gpu.createKernel(
    function (data, mask) {
      const x = this.thread.x;
      const y = this.thread.y;

      const maskX = x - this.constants.centerX +
        Math.floor(this.constants.maskWidth / 2);
      const maskY = y - this.constants.centerY +
        Math.floor(this.constants.maskHeight / 2);

      let maskValue = 0;
      if (
        maskX >= 0 && maskY >= 0 && maskX < this.constants.maskWidth &&
        maskY < this.constants.maskHeight
      ) {
        const maskIdx = maskY * this.constants.maskWidth + maskX;
        maskValue = mask[maskIdx];
      }

      return maskValue == 0 ? data[y][x] : this.constants.itemId;
    },
  ).setOutput([CANVA_WIDTH, CANVA_HEIGHT])
    .setConstants({
      w: CANVA_WIDTH,
      h: CANVA_HEIGHT,
      maskWidth: maskWidth,
      maskHeight: maskHeight,
      centerX: centerX,
      centerY: centerY,
      itemId: itemId,
    })
    .setPipeline(true).setImmutable(true);
};
