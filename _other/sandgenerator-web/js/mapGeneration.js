import {
  skyDistanceConfiguration2,
  WallConfiguration,
} from "./configuration.js";
import { ConfSectionParams } from "./confSectionParams.js";
import { ConfSection } from "./confSelection.js";
import {
  CANVA_HEIGHT,
  CANVA_SCALE,
  CANVA_WIDTH,
  HEIGHT,
  itemsColorB,
  itemsId,
  itemsIdColor,
  WIDTH,
} from "./const.js";
import {
  applyMaskToBuffer,
  convIdentity,
  convIdentity2x,
  convIdentity4x,
  convKernelMakerGrowInside,
  convKernelMakerGrowInside4x,
  convKernelMakerMaskInside,
  convKernelMakerPropagateDistance,
  convKernelMakerReplaceInsideDistance,
  convKernelMakerReplaceOutsideDistance,
  convKernelMakerSelectMask,
  convPropagateLavaStepA,
  convPropagateLavaStepB,
  convPropagatSurfaceWaterStepA,
  convPropagatSurfaceWaterStepB,
  convPropagatWaterStepA,
  convPropagatWaterStepB,
  convRepaceCave,
  convSelectMaxNeighborValueMask,
  convSmoothBorder,
  IntArrayto2D,
  tCave,
  tSky,
  tTunnel,
} from "./convolution.js";
import { loadSvgMaskToBuffer } from "./iconFunction.js";
import { noiseGenerator1D } from "./noiseGeneration1D.js";
import { CaveGenerator2D, NoiseGenerator2D } from "./noiseGeneration2D.js";

// Expose generateMap (and changeValue) on the global scope as early as possible so
// the inline onclick="generateMap()" button in index2.html works even if the top-level
// await generateMap() below is still running or throws. generateMap is a hoisted
// function declaration, so it is safe to reference here.
window.generateMap = generateMap;
window.changeValue = changeValue;

const rockSky = new noiseGenerator1D("rockSkyMenu", "SkyLine");
const tunnel = new NoiseGenerator2D("tunnelMenu", "Tunnel");
const cave = new CaveGenerator2D("caveMenu", "Cave");

const fluidMenu = new ConfSection("fluidMenu", "Fluid", {});
/*
const wallMenu = new ConfSection("wallMenu", "Wall Distance", {
  SectionSpore: { type: "section", name: "RedSand" },
});
*/

const formeMenu = new ConfSectionParams(
  "distanceMenu",
  skyDistanceConfiguration2,
);

const WallMenu = new ConfSectionParams(
  "wallMenu",
  WallConfiguration,
);

export async function generateMap() {
  // --------------------------------------------------------------------------
  // ⚪️ NOISE MATRIX : Create The Simplex Noise Generation
  const rockSkyData = rockSky.enabled
    ? rockSky.generate({ width: WIDTH, height: HEIGHT })
    : null;
  const tunnelData = tunnel.enabled
    ? tunnel.generate({ width: WIDTH, height: HEIGHT })
    : null;
  const caveData = cave.enabled
    ? cave.generate({ width: WIDTH, height: HEIGHT })
    : null;

  // --------------------------------------------------------------------------
  // ⚪️ MERGE NOISE MATRIX: Initialize Image with Sky , Rock , Tunnel , and Cave
  const data = new Int16Array(WIDTH * HEIGHT);

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const idx = y * WIDTH + x;

      let item = itemsId.rock;

      if (x == 0 || x == WIDTH - 1) { //  y == 0 |||| y == HEIGHT - 1
        data[idx] = item;
        continue;
      }

      if (rockSky.enabled && rockSkyData[idx] == 1) {
        item = itemsId.sky;
      }

      if (
        tunnel.enabled && [itemsId.rock].includes(item) &&
        tunnelData[idx] == 1
      ) {
        item = itemsId.tunnel;
      }

      if (
        cave.enabled && [itemsId.rock, itemsId.tunnel].includes(item) &&
        caveData[idx] == 1
      ) {
        item = itemsId.cave;
      }

      data[idx] = item;
    }
  }

  // --------------------------------------------------------------------------
  // ⚪️ TO GPU: Transform the matrix to Used GPU convolution

  let map2D = IntArrayto2D(data, WIDTH, HEIGHT);
  map2D = convIdentity(map2D);
  const caveMask2D = convRepaceCave(map2D);

  let finalMap2D = convIdentity(map2D);

  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // ⚪️ SKY DISTANCE : Compute Distance Mask Using Convolution From Sky Inside Cave And Tunel

  // Distance from the Sky .
  let skyDistance2D = caveMask2D;
  const convPropagateSkyDistance2 = convKernelMakerPropagateDistance(
    [tSky()],
    [tTunnel(), tCave()],
  );
  for (let i = 0; i < 400; i++) {
    skyDistance2D = convPropagateSkyDistance2(skyDistance2D);
  }

  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // 🟠 SKY DISTANCE : Compute Distance Mask Using Convolution From Sky Inside Cave And Tunel

  const kernelMapReplaceNoteAcces = convKernelMakerReplaceInsideDistance(
    [itemsId.cave, itemsId.tunnel],
    itemsId.rock,
    0,
    1024 - 1,
  );
  finalMap2D = kernelMapReplaceNoteAcces(finalMap2D, skyDistance2D);

  /*
  const selectZoneA1 = selectZone(skyDistance2D, 20, 2, 40);
  const selectZoneA2 = selectZone(skyDistance2D, 100, 2, 100);
  const selectZoneB = selectZone(skyDistance2D, 60, 6, 100);
  const selectZoneC = selectZone(skyDistance2D, 150, 6, 100);
  */

  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------

  // --------------------------------------------------------------------------
  // 🔵 STEP WATER

  const fluidConf = fluidMenu.update();

  if (fluidMenu.enabled) {
  let water2DMask = caveMask2D;
  // Compute Column From the Floor ( rock or cave ) . ( Max Heigt of the Pool )
  for (let i = 0; i < 10; i++) {
    water2DMask = convPropagatWaterStepA(water2DMask);
  }
  // Remove Column if touch an empty space , ( Remove flotting Water )
  for (let i = 0; i < 200; i++) {
    water2DMask = convPropagatWaterStepB(water2DMask);
  }
  // Remove The bottom on the pool ( Goal is to remove the small Pool )
  const kernelMapReplaceWater = convKernelMakerReplaceInsideDistance(
    [itemsId.cave, itemsId.tunnel],
    itemsId.FogWater,
    1024, // Min pool Size
    4024,
  );
  finalMap2D = kernelMapReplaceWater(finalMap2D, water2DMask);

  ////

  const kernelGrowWaterDown2 = convKernelMakerGrowInside(
    [itemsId.cave, itemsId.tunnel, itemsId.rock],
    [itemsId.FogWater],
    [0, itemsId.tunnel, itemsId.tunnel, itemsId.tunnel],
  );
  for (let i = 0; i < 6; i++) {
    finalMap2D = kernelGrowWaterDown2(finalMap2D);
  }

  const kernelGrowWaterDown = convKernelMakerGrowInside(
    [itemsId.FogWater],
    [itemsId.cave, itemsId.tunnel],
    [itemsId.FogWater, itemsId.FogWater, 0, itemsId.FogWater],
  );
  for (let i = 0; i < 20; i++) {
    finalMap2D = kernelGrowWaterDown(finalMap2D);
  }

  // --------------------------------------------------------------------------
  // 🔵 STEP LAVA

  let lava2DMask = caveMask2D;
  for (let i = 0; i < 10; i++) {
    lava2DMask = convPropagateLavaStepA(lava2DMask);
  }
  for (let i = 0; i < 10; i++) {
    lava2DMask = convPropagateLavaStepB(lava2DMask);
  }

  const kernelMapReplaceLava = convKernelMakerReplaceInsideDistance(
    [itemsId.cave, itemsId.tunnel],
    itemsId.FogLava,
    1024,
    1024 + 800,
  );
  finalMap2D = kernelMapReplaceLava(finalMap2D, lava2DMask);

  // --------------------------------------------------------------------------
  // 🔵 STEP SURFACE WATER

  let surfaceWaterMask2D = map2D;
  for (let i = 0; i < 20; i++) {
    surfaceWaterMask2D = convPropagatSurfaceWaterStepA(surfaceWaterMask2D);
  }
  for (let i = 0; i < 80; i++) {
    surfaceWaterMask2D = convPropagatSurfaceWaterStepB(surfaceWaterMask2D);
  }

  const kernelMapReplaceSurfaceWater = convKernelMakerReplaceInsideDistance(
    [itemsId.sky],
    itemsId.SurfaceWater,
    1024,
    1024 * 32,
  );
  finalMap2D = kernelMapReplaceSurfaceWater(finalMap2D, surfaceWaterMask2D);

  const kernelGrowSurfaceWaterDown2 = convKernelMakerGrowInside(
    [itemsId.cave, itemsId.tunnel, itemsId.rock, itemsId.sky],
    [itemsId.SurfaceWater],
    [0, itemsId.sky, itemsId.sky, itemsId.sky],
  );
  for (let i = 0; i < 6; i++) {
    finalMap2D = kernelGrowSurfaceWaterDown2(finalMap2D);
  }

  const kernelGrowSurfaceWaterDown = convKernelMakerGrowInside(
    [itemsId.SurfaceWater],
    [itemsId.sky],
    [itemsId.SurfaceWater, itemsId.SurfaceWater, 0, itemsId.SurfaceWater],
  );
  for (let i = 0; i < 20; i++) {
    finalMap2D = kernelGrowSurfaceWaterDown(finalMap2D);
  }
  }

  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // 🟠🟣 STEP Grow Central Form - STEP X: Select Centeral Zone At SkyDistance Range

  function selectCenterDistanceRange(
    distance2D,
    distanceMin,
    distanceMax,
    growSize,
  ) {
    // Select a Zone inside The Sky Distance Mask
    let selectZone = convKernelMakerSelectMask(
      1024 + distanceMin,
      1024 + distanceMax,
    )(
      distance2D,
    );
    // Distance from the border of the zone to the Center.
    const convPropagateDistanceBorderA = convKernelMakerPropagateDistance([0], [
      1,
    ]);
    for (let i = 0; i < (distanceMax - distanceMin) * 2; i++) {
      selectZone = convPropagateDistanceBorderA(selectZone);
    }
    // Select the Center of the Zone ( Select Cell is  Max  neighbor Value )
    selectZone = convSelectMaxNeighborValueMask(selectZone);

    // Set the Center To 1.
    selectZone = convKernelMakerSelectMask(1, 2048)(selectZone);

    // Distance from the Center, ouside.
    const convPropagateDistanceOusideA = convKernelMakerPropagateDistance([1], [
      0,
    ]);
    for (let i = 0; i < growSize; i++) {
      selectZone = convPropagateDistanceOusideA(selectZone);
    }
    return selectZone;
  }

  // --------------------------------------------------------------------------
  // 🟠🟣 STEP Grow Central Form - Function

  function applyGrowCenterForme(
    finalMap2D,
    conf, // { from, inside, nearMask, minDis, maxDis, GrowSize , replaceItem}
  ) {
    const from = conf.from;
    const replaceItem = conf.replaceItem;

    const formeMask2D = selectCenterDistanceRange(
      skyDistance2D,
      conf.minDis,
      conf.maxDis,
      conf.growSize,
    );

    const kernelMapReplaceSporeSoil = convKernelMakerReplaceInsideDistance(
      from,
      replaceItem,
      1024,
      1024 * 32,
    );
    finalMap2D = kernelMapReplaceSporeSoil(finalMap2D, formeMask2D);
    return finalMap2D;
  }

  // --------------------------------------------------------------------------
  // 🟠🟣 STEP Apply Central Form Configuration - Apply

  formeMenu.update();
  console.log(formeMenu.getEnabledConfs())
  for (const conf of formeMenu.getEnabledConfs()) {
    console.log(conf);
    const parameters = conf.parameters;
    console.log(parameters);

    finalMap2D = applyGrowCenterForme(
      finalMap2D,
      parameters,
    );
  }

  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // 🟠🟢 STEP X:  Apply Grow Wall . Function

  function applyGrowWall(
    finalMap2D,
    conf, // { from, inside, nearMask, minDis, maxDis, GrowSize , replaceItem}
  ) {
    const from = conf.from;
    const inside = conf.inside;
    const replaceItem = conf.replaceItem;

    const kernelGrowRedSandA_Wall = convKernelMakerMaskInside(
      from, // [itemsId.rock, itemsId.tunnel],
      inside, // [itemsId.cave],
      conf.nearMask, //[1, 0, 0, 0],
    );
    let redSandMask = kernelGrowRedSandA_Wall(finalMap2D);
    const kernelGrowRedSandA_FilterDistance =
      convKernelMakerReplaceOutsideDistance(
        [1],
        0,
        1024 + conf.minDis, // 1024 + 150,
        1024 + conf.maxDis, // 1024 * 32,
      );
    redSandMask = kernelGrowRedSandA_FilterDistance(redSandMask, skyDistance2D);

    const kernelGrowRedSandA_Grow = convKernelMakerGrowInside(
      [1],
      [0],
      [1, 1, 1, 1],
    );
    for (let i = 0; i < conf.growSize; i++) {
      redSandMask = kernelGrowRedSandA_Grow(redSandMask);
    }

    const kernelGrowRedSandA_Apply = convKernelMakerReplaceInsideDistance(
      inside, // [itemsId.cave],
      replaceItem, // itemsId.RedsandSoil,
      1,
    );
    finalMap2D = kernelGrowRedSandA_Apply(finalMap2D, redSandMask);

    return finalMap2D;
  }
  // -----------------
  // --------------------------------------------------------------------------
  // 🟠🟢 STEP X:  Apply Grow Wall .

  WallMenu.update();
  for (const wallConf of WallMenu.getEnabledConfs()) {
    console.log(wallConf);
    const parameters = wallConf.parameters;
    console.log(parameters);

    finalMap2D = applyGrowWall(
      finalMap2D,
      parameters,
    );
  }

  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // 🔴🔴 STEP X: Transform GPU Matrix to JS array
  const canvas = document.getElementById("mapCanvas");

  canvas.style.zoom = .65;
  finalMap2D = convIdentity2x(finalMap2D);
  finalMap2D = convSmoothBorder(finalMap2D, 2);

  finalMap2D = convIdentity4x(finalMap2D);
  finalMap2D = convSmoothBorder(finalMap2D, 4);

  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // 🔴🔴 STEP X: Transform GPU Matrix to JS array
  if (false) {

    const isClose = (listPos, x, y) => {
      const listDist = listPos.map(([xx, yy]) =>
        Math.abs(xx - x) + Math.abs(yy - y)
      );
      const meanDist = listDist.reduce(
        (acc, value) => Math.min(acc, value),
        1000,
      );
      return meanDist;
    };

    const itemMask2D = selectCenterDistanceRange(
      skyDistance2D,
      80,
      350,
      0,
    );
    const itemMaskArray = itemMask2D.toArray();

    const listPosItem = [];
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        if (itemMaskArray[y][x] > 0) {
          console.log("Item ", x, y, isClose(listPosItem, x, y));

          if (isClose(listPosItem, x, y) > 50) { // Min Distance bettew Element .
            const yy = y > HEIGHT - 15 ? y - 15 : y;
            const size = 2 * (15 + Math.floor(Math.random() * 4));
            const mask = await loadSvgMaskToBuffer(size, listPosItem.length);
            console.log(size);
            listPosItem.push([x, yy]);
            //          try {
            finalMap2D = applyMaskToBuffer(
              size,
              size,
              x * CANVA_SCALE,
              yy * CANVA_SCALE,
              itemsId.Fluxite,
            )(finalMap2D, mask);
            // } catch (_e) {
            //   console.error(size, x * CANVA_SCALE, y * CANVA_SCALE);
            // }
          }
        }
      }
    }
  }

  const AllItem = [
    itemsId.cave,
    itemsId.tunnel,
    itemsId.rock,
    itemsId.CaveSandsoil,
    itemsId.RedsandSoil,
    itemsId.Grass,
    itemsId.SporeSoil,
    itemsId.Moss,
  ];

  const kernelGrowFluxiteBorder = convKernelMakerGrowInside4x(
    [itemsId.Fluxite, itemsId.fluxBorder],
    [...AllItem],
    [
      itemsId.fluxBorder,
      itemsId.fluxBorder,
      itemsId.fluxBorder,
      itemsId.fluxBorder,
    ],
  );
  for (let i = 0; i < 12; i++) {
    finalMap2D = kernelGrowFluxiteBorder(finalMap2D);
  }

  const kernelGrowFluxiteBorder1 = convKernelMakerGrowInside4x(
    [...AllItem],
    [itemsId.fluxBorder],
    [
      itemsId.Moss,
      itemsId.Moss,
      itemsId.Moss,
      itemsId.Moss,
    ],
  );

  for (let i = 0; i < 3; i++) {
    finalMap2D = kernelGrowFluxiteBorder1(finalMap2D);
  }

  const kernelGrowFluxiteBorder2 = convKernelMakerGrowInside4x(
    [...AllItem],
    [itemsId.fluxBorder],
    [
      itemsId.cave,
      itemsId.cave,
      itemsId.cave,
      itemsId.cave,
    ],
  );
  for (let i = 0; i < 6; i++) {
    finalMap2D = kernelGrowFluxiteBorder2(finalMap2D);
  }

  const kernelGrowFluxiteBorder3 = convKernelMakerGrowInside4x(
    [itemsId.tunnel, itemsId.Fluxite],
    [itemsId.fluxBorder],
    [
      itemsId.tunnel,
      itemsId.tunnel,
      itemsId.tunnel,
      itemsId.tunnel,
    ],
  );
  for (let i = 0; i < 10; i++) {
    finalMap2D = kernelGrowFluxiteBorder3(finalMap2D);
  }


  /**/
  // --------------------------------------------------------------------------
  // 🎨🎨🎨  STEP X: Build The Image

  const finalMapArray = finalMap2D.toArray();

  const CWIDTH = WIDTH * 4;
  const CHEIGHT = HEIGHT * 4;

  // mapGeneration.js
  canvas.setAttribute("width", CWIDTH);
  canvas.setAttribute("height", CHEIGHT);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, CWIDTH, CHEIGHT);

  for (let y = 0; y < CHEIGHT; y++) {
    for (let x = 0; x < CWIDTH; x++) {
      if (y > CHEIGHT - 16) {
        ctx.fillStyle = itemsColorB.rock;
      } else {
        ctx.fillStyle = itemsIdColor[finalMapArray[y][x]];
      }
      // Init
      ctx.fillRect(x, y, 1, 1);

      /* /---------------
      // = LAYER DISTANCE * /
      const skyD = skyDistanceArray[y][x] - 1025;
      if (skyDistanceArray[y][x] >= 1024) {
        const c = (skyD % 32) * 4;
        ctx.fillStyle = `rgba(${c}, ${c}, ${c}, .2)`;
        ctx.fillRect(x, y, 1, 1);
      } /* */
    }
  }

  // FOG
  if (true) {
    const canvasFog = document.getElementById("mapCanvasFog");
    canvasFog.style.zoom = .2;

    canvasFog.setAttribute("width", CANVA_WIDTH);
    canvasFog.setAttribute("height", CANVA_HEIGHT);
    const ctxFog = canvasFog.getContext("2d");
    ctxFog.imageSmoothingEnabled = false;
    ctxFog.clearRect(0, 0, CANVA_WIDTH, CANVA_HEIGHT);

    for (let y = 0; y < CANVA_HEIGHT; y++) {
      for (let x = 0; x < CANVA_WIDTH; x++) {
        // Init
        const item = finalMapArray[y][x];
        if (item == itemsId.sky || item == itemsId.SurfaceWater) {
          ctxFog.fillStyle = "#FFFFFF00";
        } else if (finalMapArray[y][x] == itemsId.Grass) {
          ctxFog.fillStyle = "#00000099";
        } else {
          ctxFog.fillStyle = "#000000DD";
        }
        ctxFog.fillRect(x, y, 1, 1);
      }
    }
  }

  // END
  console.log("[map] generation finished", {
    drawn: [CWIDTH, CHEIGHT],
    grid: [finalMapArray.length, finalMapArray[0]?.length],
    sampleColors: [
      ...new Set(
        finalMapArray.slice(0, 64).map((row) => row.slice(0, 64)).flat(),
      ),
    ].slice(0, 20),
  });
  /*
} catch (err) {
  console.error("[generateMap] FAILED:", err);
  const stat = document.getElementById("Stat");
  if (stat) {
    stat.textContent = `Generate Map error: ${err?.message ?? err}`;
  }
}
  */
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
/*
const callbackKeyboard = async (action) => {
  const layer = document.querySelector('input[name="layer"]:checked').value;
  if (layer === "tunnel") {
    tunnel.y += action.up ? 10 : action.down ? -10 : 0;
    tunnel.x += action.left ? 10 : action.right ? -10 : 0;
  }
  await generateMap();
};
*/
// await generateMap();
/*
document.getElementById("fromMenu").addEventListener(
  "change",
  async (_e) => await generateMap(),
);
*/
// initKeyBoard(callbackKeyboard);

/// --------------------------------
/// --------------------------------

async function changeValue(id, step, limit) {
  const valueSpan = document.getElementById(id + "_value");
  let currentValue = parseFloat(valueSpan.value);
  const newValue = currentValue + step;

  // Check if we're increasing or decreasing and clamp to limits
  if (
    (step > 0 && newValue <= limit) ||
    (step < 0 && newValue >= limit)
  ) {
    valueSpan.value = newValue.toFixed(2);
  }
  await generateMap();
}

window.changeValue = changeValue;

window.generateMap = generateMap;
