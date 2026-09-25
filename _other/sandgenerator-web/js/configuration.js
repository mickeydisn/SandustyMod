import { itemsColorB, itemsId } from "./const.js";

export const extractConfParameters = (conf) => {
  return Object.fromEntries(
    conf.parameters.map((parameter) => [parameter.id, parameter.value]),
  );
};

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

export const perlinNoiseConfigurations = {
  skyline: {
    name: "Sky Line Generation",
    parameters: {
      BaseHeight: {
        type: "inputRange",
        value: 90 + 40,
        min: 0,
        max: 300,
        step: 10,
        name: "BaseHeight",
      },
      Phase: {
        type: "inputRange",
        value: 0,
        min: -1000,
        max: 1000,
        step: 10,
        name: "Phase",
      },
      Amp: {
        type: "inputRange",
        value: 1,
        min: 0,
        max: 2,
        step: .05,
        name: "Amplitude",
      },
      F1: { type: "fix", value: 0.001 },
      A1: {
        type: "inputRange",
        value: .3,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Big Wave",
      },
      F2: { type: "fix", value: 0.005 },
      A2: {
        type: "inputRange",
        value: .6,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Medium Wave",
      },
      F3: { type: "fix", value: 0.02 },
      A3: {
        type: "inputRange",
        value: .1,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Low Wave",
      },
      F4: { type: "fix", value: 0.1 },
      A4: {
        type: "inputRange",
        value: 0,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Roughness",
      },
    },
  },
  tunnel: {
    name: "Tunnel Generation",
    parameters: {
      BottomLimit: {
        type: "fix",
        value: 20,
      },
      Inverse: {
        type: "fix",
        value: 0,
      },
      Definition: {
        type: "inputRange",
        value: .5,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Definition",
      },
      Thickness: {
        type: "inputRange",
        value: .12,
        min: 0,
        max: .5,
        step: 0.05,
        name: "Thickness",
      },
      // -----
      SectionMove: { type: "section", name: "Move" },
      X: {
        type: "inputRange",
        value: 20,
        min: -1000,
        max: 1000,
        step: 10,
        name: "Move X",
      },
      Y: {
        type: "inputRange",
        value: -10 - 40,
        min: -1000,
        max: 1000,
        step: 10,
        name: "Move Y",
      },
      // -----
      Section1: { type: "section", name: "Amplitude" },
      F1: { type: "fix", value: 0.0075 },
      A1: {
        type: "inputRange",
        value: .5,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Big",
      },
      F2: { type: "fix", value: 0.015 },
      A2: {
        type: "inputRange",
        value: .5,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Medium",
      },
      F3: { type: "fix", value: 0.05 },
      A3: {
        type: "inputRange",
        value: 0.1,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Low",
      },
      F4: { type: "fix", value: 0.09 },
      A4: {
        type: "inputRange",
        value: .05,
        min: 0,
        max: .2,
        step: 0.01,
        name: "Roughness",
      },
    },
  },
  cave: {
    name: "Cave Generation",
    parameters: {
      // -----
      BottomLimit: {
        type: "fix",
        value: 1,
      },
      Inverse: {
        type: "Fix",
        value: 1,
      },
      Definition: {
        type: "inputRange",
        value: .45,
        min: 0,
        max: 1,
        step: 0.01,
        name: "Cluster size",
      },
      Thickness: {
        type: "inputRange",
        value: 0.22,
        min: 0,
        max: .5,
        step: 0.01,
        name: "Thickness",
      },
      // -----
      SectionMove: { type: "section", name: "Move" },
      X: {
        type: "inputRange",
        value: 0,
        min: -1000,
        max: 1000,
        step: 10,
        name: "Move X",
      },
      Y: {
        type: "inputRange",
        value: 0 - 40,
        min: -1000,
        max: 1000,
        step: 10,
        name: "Move Y",
      },
      // -----
      Section1: { type: "section", name: "Amplitude" },
      F1: { type: "fix", value: 0.006 },
      A1: {
        type: "inputRange",
        value: .5,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Big",
      },
      F2: { type: "fix", value: 0.012 },
      A2: {
        type: "inputRange",
        value: 0.5,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Medium",
      },
      F3: { type: "fix", value: 0.04 },
      A3: {
        type: "inputRange",
        value: 0.1,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Low",
      },
      F4: { type: "fix", value: 0.1 },
      A4: {
        type: "inputRange",
        value: 0.02,
        min: 0,
        max: .2,
        step: 0.01,
        name: "Roughness",
      },
    },
  },
};

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

export const skyDistanceConfiguration2 = [
  /*
  {
    name: "Moss",
    color: itemsColorB.Moss,
    type: "FormeGrow",
    parameters: {
      from: [itemsId.tunnel],
      replaceItem: itemsId.Moss,
      minDis: 30,
      maxDis: 50,
      growSize: 3,
    },
  },
  {
    name: "Moss",
    color: itemsColorB.Moss,
    type: "FormeGrow",
    parameters: {
      from: [itemsId.tunnel],
      replaceItem: itemsId.Moss,
      minDis: 60,
      maxDis: 90,
      growSize: 5,
    },
  },
  */
  {
    name: "Spore Soil",
    color: itemsColorB.SporeSoil,
    type: "FormeGrow",
    parameters: {
      from: [itemsId.cave],
      replaceItem: itemsId.SporeSoil,
      minDis: 120,
      maxDis: 200,
      growSize: 10,
    },
  },
  {
    name: "Cave FrostBed",
    color: itemsColorB.Ice,
    type: "FormeGrow",
    parameters: {
      from: [itemsId.FogWater],
      replaceItem: itemsId.Ice,
      minDis: 60,
      maxDis: 160,
      growSize: 6,
    },
  },
  {
    name: "Cave FrostBed",
    color: itemsColorB.Ice,
    type: "FormeGrow",
    parameters: {
      from: [itemsId.FogWater],
      replaceItem: itemsId.Ice,
      minDis: 230,
      maxDis: 400,
      growSize: 25,
    },
  },

  {
    name: "Cave FrostBed",
    color: itemsColorB.CaveFrostBed,
    type: "FormeGrow",
    parameters: {
      from: [itemsId.tunnel],
      replaceItem: itemsId.CaveFrostBed,
      minDis: 100,
      maxDis: 170,
      growSize: 4,
    },
  },
  {
    name: "Cave FrostBed",
    color: itemsColorB.CaveFrostBed,
    type: "FormeGrow",
    parameters: {
      from: [itemsId.tunnel],
      replaceItem: itemsId.CaveFrostBed,
      minDis: 200,
      maxDis: 300,
      growSize: 5,
    },
  },

  {
    name: "Tunel Grass Bock",
    color: itemsColorB.Crackstone,
    type: "FormeGrow",
    parameters: {
      from: [itemsId.tunnel],
      replaceItem: itemsId.Crackstone,
      minDis: 180,
      maxDis: 240,
      growSize: 6,
    },
  },
];

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

export const WallConfiguration = [
  // 🟠  Moss
  {
    name: "Sky Tunnel -> Cave",
    color: itemsColorB.cave,
    type: "WallGrow",
    parameters: {
      from: [itemsId.sky],
      inside: [itemsId.tunnel],
      replaceItem: itemsId.cave,
      nearMask: [1, 0, 1, 0],
      minDis: -1024,
      maxDis: 200,
      growSize: 2,
    },
  },
  {
    name: "Sky Moss",
    color: itemsColorB.Grass,
    type: "WallGrow",
    parameters: {
      from: [itemsId.rock, itemsId.cave],
      inside: [itemsId.sky],
      replaceItem: itemsId.Grass,
      nearMask: [1, 1, 1, 1],
      minDis: -1024,
      maxDis: 200,
      growSize: 0,
    },
  },
  /*
  {
    name: "Sky Grass",
    color: itemsColorB.Moss,
    type: "WallGrow",
    parameters: {
      from: [itemsId.Moss],
      inside: [itemsId.sky],
      replaceItem: itemsId.Grass,
      nearMask: [1, 0, 1, 0],
      minDis: -1024,
      maxDis: 200,
      growSize: 0,
    },
  },
  */
  {
    name: "Tunel Moss Roof",
    color: itemsColorB.Moss,
    type: "WallGrow",
    parameters: {
      from: [itemsId.rock],
      inside: [itemsId.tunnel],
      replaceItem: itemsId.Moss,
      nearMask: [1, 1, 0, 0],
      minDis: 20,
      maxDis: 25,
      growSize: 5,
    },
  },
  {
    name: "Tunel Moss Roof",
    color: itemsColorB.Moss,
    type: "WallGrow",
    parameters: {
      from: [itemsId.rock],
      inside: [itemsId.tunnel],
      replaceItem: itemsId.Moss,
      nearMask: [1, 1, 0, 0],
      minDis: 50,
      maxDis: 55,
      growSize: 4,
    },
  },
  {
    name: "Tunel Moss Roof",
    color: itemsColorB.Moss,
    type: "WallGrow",
    parameters: {
      from: [itemsId.rock],
      inside: [itemsId.tunnel],
      replaceItem: itemsId.Moss,
      nearMask: [1, 1, 0, 0],
      minDis: 80,
      maxDis: 85,
      growSize: 7,
    },
  },
  {
    name: "Tunel Moss Roof",
    color: itemsColorB.Moss,
    type: "WallGrow",
    parameters: {
      from: [itemsId.rock],
      inside: [itemsId.tunnel],
      replaceItem: itemsId.Moss,
      nearMask: [1, 1, 0, 0],
      minDis: 0,
      maxDis: 200,
      growSize: 0,
    },
  },
  // 🟠  Grass

  {
    name: "Tunel Moss Bock",
    color: itemsColorB.Moss,
    type: "WallGrow",
    parameters: {
      from: [itemsId.rock],
      inside: [itemsId.tunnel],
      replaceItem: itemsId.Moss,
      nearMask: [0, 1, 0, 1],
      minDis: 130,
      maxDis: 160,
      growSize: 10,
    },
  },
  {
    name: "Tunel SporeSoil Bock",
    color: itemsColorB.SporeSoil,
    type: "WallGrow",
    parameters: {
      from: [itemsId.rock],
      inside: [itemsId.tunnel],
      replaceItem: itemsId.SporeSoil,
      nearMask: [0, 1, 0, 1],
      minDis: 230,
      maxDis: 250,
      growSize: 3,
    },
  },

  // 🟠# LAVE GAPE
  {
    name: "Lava Gape",
    color: itemsColorB.tunnel,
    type: "WallGrow",
    parameters: {
      from: [itemsId.FogLava, itemsId.FogWater],
      inside: [itemsId.cave],
      replaceItem: itemsId.tunnel,
      nearMask: [1, 0, 1, 0],
      minDis: 0,
      maxDis: 1000,
      growSize: 1,
    },
  },

  // 🟠# RED SOIL

  {
    name: "Redsand Roof Top",
    color: itemsColorB.RedsandSoil,
    type: "WallGrow",
    parameters: {
      from: [itemsId.rock, itemsId.tunnel],
      inside: [itemsId.cave],
      replaceItem: itemsId.RedsandSoil,
      nearMask: [1, 0, 0, 0],
      minDis: 80,
      maxDis: 120,
      growSize: 4,
    },
  },

  {
    name: "Redsand Roof Bottom",
    color: itemsColorB.RedsandSoil,
    type: "WallGrow",
    parameters: {
      from: [itemsId.rock, itemsId.tunnel],
      inside: [itemsId.cave],
      replaceItem: itemsId.RedsandSoil,
      nearMask: [1, 0, 0, 0],
      minDis: 200,
      maxDis: 250,
      growSize: 10,
    },
  },

  {
    name: "Redsand Wall",
    color: itemsColorB.RedsandSoil,
    type: "WallGrow",
    parameters: {
      from: [itemsId.rock, itemsId.tunnel],
      inside: [itemsId.cave],
      replaceItem: itemsId.RedsandSoil,
      nearMask: [0, 1, 0, 1],
      minDis: 250,
      maxDis: 350,
      growSize: 20,
    },
  },
  {
    name: "Redsand Wall",
    color: itemsColorB.RedsandSoil,
    type: "WallGrow",
    parameters: {
      from: [itemsId.rock, itemsId.tunnel],
      inside: [itemsId.cave],
      replaceItem: itemsId.RedsandSoil,
      nearMask: [0, 0, 1, 0],
      minDis: 320,
      maxDis: 500,
      growSize: 20,
    },
  },
];
