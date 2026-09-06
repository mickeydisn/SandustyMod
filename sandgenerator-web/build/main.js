// js/const.js
var WIDTH = 320;
var HEIGHT = 320;
var CANVA_SCALE = 4;
var CANVA_HEIGHT = HEIGHT * CANVA_SCALE;
var CANVA_WIDTH = WIDTH * CANVA_SCALE;
var itemsColorB = {
  sky: "#ffffff",
  rock: "#aaaaaa",
  tunnel: "#993300",
  cave: "#000000",
  fluxBorder: "#660066",
  empty: "#ffffff",
  Bedrock: "#aaaaaa",
  Fog: "#993300",
  CaveSandsoil: "#000000",
  SurfaceWater: "#6600ff",
  FogWater: "#9966ff",
  FogLava: "#ff6600",
  Ice: "#66ccff",
  CaveFrostBed: "#99ffff",
  Fluxite: "#af00e0",
  Crackstone: "#cd8b8b",
  SporeSoil: "#ffff00",
  RedsandSoil: "#ff5500",
  Grass: "#00ff00",
  Moss: "#00e000",
  Scoria: "#260000",
  GoldSoil: "#7f7f00",
  Divider: "#006600",
  RevealedFog: "#990000",
  AlternateFog: "#333333",
  BedrockFog: "#666666",
  RevealedFogWater: "#0000ff",
  JetpackFog: "#ff0099",
  JetpackFogWater: "#6666ff",
  JetpackFrostBed: "#ccffff"
};
var itemsID_FIX = {
  empty: 0,
  sky: 1,
  rock: 2,
  tunnel: 3,
  cave: 4,
  fluxBorder: 5
};
var itemsId = Object.fromEntries(Object.entries(itemsColorB).map(([k, _], idx) => {
  const value = itemsID_FIX[k] !== void 0 ? itemsID_FIX[k] : 32 + idx;
  return [
    k,
    value
  ];
}));
var itemsIdName = Object.fromEntries(Object.entries(itemsId).map(([k, v]) => {
  return [
    v,
    k
  ];
}));
var itemsIdColor = Object.fromEntries(Object.entries(itemsColorB).map(([k, v]) => {
  return [
    itemsId[k],
    v
  ];
}));
console.log(itemsId);

// js/configuration.js
var perlinNoiseConfigurations = {
  skyline: {
    name: "Sky Line Generation",
    parameters: {
      BaseHeight: {
        type: "inputRange",
        value: 90 + 40,
        min: 0,
        max: 300,
        step: 10,
        name: "BaseHeight"
      },
      Phase: {
        type: "inputRange",
        value: 0,
        min: -1e3,
        max: 1e3,
        step: 10,
        name: "Phase"
      },
      Amp: {
        type: "inputRange",
        value: 1,
        min: 0,
        max: 2,
        step: 0.05,
        name: "Amplitude"
      },
      F1: {
        type: "fix",
        value: 1e-3
      },
      A1: {
        type: "inputRange",
        value: 0.3,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Big Wave"
      },
      F2: {
        type: "fix",
        value: 5e-3
      },
      A2: {
        type: "inputRange",
        value: 0.6,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Medium Wave"
      },
      F3: {
        type: "fix",
        value: 0.02
      },
      A3: {
        type: "inputRange",
        value: 0.1,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Low Wave"
      },
      F4: {
        type: "fix",
        value: 0.1
      },
      A4: {
        type: "inputRange",
        value: 0,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Roughness"
      }
    }
  },
  tunnel: {
    name: "Tunnel Generation",
    parameters: {
      BottomLimit: {
        type: "fix",
        value: 20
      },
      Inverse: {
        type: "fix",
        value: 0
      },
      Definition: {
        type: "inputRange",
        value: 0.5,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Definition"
      },
      Thickness: {
        type: "inputRange",
        value: 0.12,
        min: 0,
        max: 0.5,
        step: 0.05,
        name: "Thickness"
      },
      // -----
      SectionMove: {
        type: "section",
        name: "Move"
      },
      X: {
        type: "inputRange",
        value: 20,
        min: -1e3,
        max: 1e3,
        step: 10,
        name: "Move X"
      },
      Y: {
        type: "inputRange",
        value: -10 - 40,
        min: -1e3,
        max: 1e3,
        step: 10,
        name: "Move Y"
      },
      // -----
      Section1: {
        type: "section",
        name: "Amplitude"
      },
      F1: {
        type: "fix",
        value: 75e-4
      },
      A1: {
        type: "inputRange",
        value: 0.5,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Big"
      },
      F2: {
        type: "fix",
        value: 0.015
      },
      A2: {
        type: "inputRange",
        value: 0.5,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Medium"
      },
      F3: {
        type: "fix",
        value: 0.05
      },
      A3: {
        type: "inputRange",
        value: 0.1,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Low"
      },
      F4: {
        type: "fix",
        value: 0.09
      },
      A4: {
        type: "inputRange",
        value: 0.05,
        min: 0,
        max: 0.2,
        step: 0.01,
        name: "Roughness"
      }
    }
  },
  cave: {
    name: "Cave Generation",
    parameters: {
      // -----
      BottomLimit: {
        type: "fix",
        value: 1
      },
      Inverse: {
        type: "Fix",
        value: 1
      },
      Definition: {
        type: "inputRange",
        value: 0.45,
        min: 0,
        max: 1,
        step: 0.01,
        name: "Cluster size"
      },
      Thickness: {
        type: "inputRange",
        value: 0.22,
        min: 0,
        max: 0.5,
        step: 0.01,
        name: "Thickness"
      },
      // -----
      SectionMove: {
        type: "section",
        name: "Move"
      },
      X: {
        type: "inputRange",
        value: 0,
        min: -1e3,
        max: 1e3,
        step: 10,
        name: "Move X"
      },
      Y: {
        type: "inputRange",
        value: 0 - 40,
        min: -1e3,
        max: 1e3,
        step: 10,
        name: "Move Y"
      },
      // -----
      Section1: {
        type: "section",
        name: "Amplitude"
      },
      F1: {
        type: "fix",
        value: 6e-3
      },
      A1: {
        type: "inputRange",
        value: 0.5,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Big"
      },
      F2: {
        type: "fix",
        value: 0.012
      },
      A2: {
        type: "inputRange",
        value: 0.5,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Medium"
      },
      F3: {
        type: "fix",
        value: 0.04
      },
      A3: {
        type: "inputRange",
        value: 0.1,
        min: 0,
        max: 1,
        step: 0.05,
        name: "Low"
      },
      F4: {
        type: "fix",
        value: 0.1
      },
      A4: {
        type: "inputRange",
        value: 0.02,
        min: 0,
        max: 0.2,
        step: 0.01,
        name: "Roughness"
      }
    }
  }
};
var skyDistanceConfiguration2 = [
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
      from: [
        itemsId.cave
      ],
      replaceItem: itemsId.SporeSoil,
      minDis: 120,
      maxDis: 200,
      growSize: 10
    }
  },
  {
    name: "Cave FrostBed",
    color: itemsColorB.Ice,
    type: "FormeGrow",
    parameters: {
      from: [
        itemsId.FogWater
      ],
      replaceItem: itemsId.Ice,
      minDis: 60,
      maxDis: 160,
      growSize: 6
    }
  },
  {
    name: "Cave FrostBed",
    color: itemsColorB.Ice,
    type: "FormeGrow",
    parameters: {
      from: [
        itemsId.FogWater
      ],
      replaceItem: itemsId.Ice,
      minDis: 230,
      maxDis: 400,
      growSize: 25
    }
  },
  {
    name: "Cave FrostBed",
    color: itemsColorB.CaveFrostBed,
    type: "FormeGrow",
    parameters: {
      from: [
        itemsId.tunnel
      ],
      replaceItem: itemsId.CaveFrostBed,
      minDis: 100,
      maxDis: 170,
      growSize: 4
    }
  },
  {
    name: "Cave FrostBed",
    color: itemsColorB.CaveFrostBed,
    type: "FormeGrow",
    parameters: {
      from: [
        itemsId.tunnel
      ],
      replaceItem: itemsId.CaveFrostBed,
      minDis: 200,
      maxDis: 300,
      growSize: 5
    }
  },
  {
    name: "Tunel Grass Bock",
    color: itemsColorB.Crackstone,
    type: "FormeGrow",
    parameters: {
      from: [
        itemsId.tunnel
      ],
      replaceItem: itemsId.Crackstone,
      minDis: 180,
      maxDis: 240,
      growSize: 6
    }
  }
];
var WallConfiguration = [
  // 🟠  Moss
  {
    name: "Sky Tunnel -> Cave",
    color: itemsColorB.cave,
    type: "WallGrow",
    parameters: {
      from: [
        itemsId.sky
      ],
      inside: [
        itemsId.tunnel
      ],
      replaceItem: itemsId.cave,
      nearMask: [
        1,
        0,
        1,
        0
      ],
      minDis: -1024,
      maxDis: 200,
      growSize: 2
    }
  },
  {
    name: "Sky Moss",
    color: itemsColorB.Grass,
    type: "WallGrow",
    parameters: {
      from: [
        itemsId.rock,
        itemsId.cave
      ],
      inside: [
        itemsId.sky
      ],
      replaceItem: itemsId.Grass,
      nearMask: [
        1,
        1,
        1,
        1
      ],
      minDis: -1024,
      maxDis: 200,
      growSize: 0
    }
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
      from: [
        itemsId.rock
      ],
      inside: [
        itemsId.tunnel
      ],
      replaceItem: itemsId.Moss,
      nearMask: [
        1,
        1,
        0,
        0
      ],
      minDis: 20,
      maxDis: 25,
      growSize: 5
    }
  },
  {
    name: "Tunel Moss Roof",
    color: itemsColorB.Moss,
    type: "WallGrow",
    parameters: {
      from: [
        itemsId.rock
      ],
      inside: [
        itemsId.tunnel
      ],
      replaceItem: itemsId.Moss,
      nearMask: [
        1,
        1,
        0,
        0
      ],
      minDis: 50,
      maxDis: 55,
      growSize: 4
    }
  },
  {
    name: "Tunel Moss Roof",
    color: itemsColorB.Moss,
    type: "WallGrow",
    parameters: {
      from: [
        itemsId.rock
      ],
      inside: [
        itemsId.tunnel
      ],
      replaceItem: itemsId.Moss,
      nearMask: [
        1,
        1,
        0,
        0
      ],
      minDis: 80,
      maxDis: 85,
      growSize: 7
    }
  },
  {
    name: "Tunel Moss Roof",
    color: itemsColorB.Moss,
    type: "WallGrow",
    parameters: {
      from: [
        itemsId.rock
      ],
      inside: [
        itemsId.tunnel
      ],
      replaceItem: itemsId.Moss,
      nearMask: [
        1,
        1,
        0,
        0
      ],
      minDis: 0,
      maxDis: 200,
      growSize: 0
    }
  },
  // 🟠  Grass
  {
    name: "Tunel Moss Bock",
    color: itemsColorB.Moss,
    type: "WallGrow",
    parameters: {
      from: [
        itemsId.rock
      ],
      inside: [
        itemsId.tunnel
      ],
      replaceItem: itemsId.Moss,
      nearMask: [
        0,
        1,
        0,
        1
      ],
      minDis: 130,
      maxDis: 160,
      growSize: 10
    }
  },
  {
    name: "Tunel SporeSoil Bock",
    color: itemsColorB.SporeSoil,
    type: "WallGrow",
    parameters: {
      from: [
        itemsId.rock
      ],
      inside: [
        itemsId.tunnel
      ],
      replaceItem: itemsId.SporeSoil,
      nearMask: [
        0,
        1,
        0,
        1
      ],
      minDis: 230,
      maxDis: 250,
      growSize: 3
    }
  },
  // 🟠# LAVE GAPE
  {
    name: "Lava Gape",
    color: itemsColorB.tunnel,
    type: "WallGrow",
    parameters: {
      from: [
        itemsId.FogLava,
        itemsId.FogWater
      ],
      inside: [
        itemsId.cave
      ],
      replaceItem: itemsId.tunnel,
      nearMask: [
        1,
        0,
        1,
        0
      ],
      minDis: 0,
      maxDis: 1e3,
      growSize: 1
    }
  },
  // 🟠# RED SOIL
  {
    name: "Redsand Roof Top",
    color: itemsColorB.RedsandSoil,
    type: "WallGrow",
    parameters: {
      from: [
        itemsId.rock,
        itemsId.tunnel
      ],
      inside: [
        itemsId.cave
      ],
      replaceItem: itemsId.RedsandSoil,
      nearMask: [
        1,
        0,
        0,
        0
      ],
      minDis: 80,
      maxDis: 120,
      growSize: 4
    }
  },
  {
    name: "Redsand Roof Bottom",
    color: itemsColorB.RedsandSoil,
    type: "WallGrow",
    parameters: {
      from: [
        itemsId.rock,
        itemsId.tunnel
      ],
      inside: [
        itemsId.cave
      ],
      replaceItem: itemsId.RedsandSoil,
      nearMask: [
        1,
        0,
        0,
        0
      ],
      minDis: 200,
      maxDis: 250,
      growSize: 10
    }
  },
  {
    name: "Redsand Wall",
    color: itemsColorB.RedsandSoil,
    type: "WallGrow",
    parameters: {
      from: [
        itemsId.rock,
        itemsId.tunnel
      ],
      inside: [
        itemsId.cave
      ],
      replaceItem: itemsId.RedsandSoil,
      nearMask: [
        0,
        1,
        0,
        1
      ],
      minDis: 250,
      maxDis: 350,
      growSize: 20
    }
  },
  {
    name: "Redsand Wall",
    color: itemsColorB.RedsandSoil,
    type: "WallGrow",
    parameters: {
      from: [
        itemsId.rock,
        itemsId.tunnel
      ],
      inside: [
        itemsId.cave
      ],
      replaceItem: itemsId.RedsandSoil,
      nearMask: [
        0,
        0,
        1,
        0
      ],
      minDis: 320,
      maxDis: 500,
      growSize: 20
    }
  }
];

// js/confSectionParams.js
function colorSelector(divname, selectorConf) {
  const itemList = typeof selectorConf.value === "number" ? [
    selectorConf.value
  ] : selectorConf.value;
  const li = itemList.map((itemId) => {
    const itemName = itemsIdName[itemId];
    const itemColor = itemsIdColor[itemId];
    return `
      <li style="background-color:${itemColor}"><span>${itemName}</span></li>
    `;
  }).join("");
  return `
    <div id="${divname}_wrapper"  class="valueSelector">
       <label for="${divname}">${selectorConf.name}:</label>
      <ul id="${divname}_colorSelector" class="colorSelector">${li}</ul>
    </div>
  `;
}
var ConfSectionParams = class {
  constructor(menuDivId, confs = []) {
    this.menuDivId = menuDivId, this.name = name;
    this.menuDiv = document.getElementById(menuDivId);
    this.confs = confs;
    this.enabled = confs.map(() => true);
    this.renderParams = [];
    this.generateMenu();
  }
  generateMenu() {
    for (let k = 0; k < this.confs.length; k++) {
      const newDiv = document.createElement("div");
      this.menuDiv.appendChild(newDiv);
      const conf = this.confs[k];
      this.generateMenuConf(k, conf, newDiv);
    }
  }
  generateMenuConf(id, conf, boxDiv) {
    const confDivId = this.menuDivId + "_" + id;
    boxDiv.setAttribute("id", confDivId);
    console.log(confDivId, conf);
    let confRenderParamter = null;
    if (conf.type == "WallGrow") {
      confRenderParamter = makeWallConfParameter(conf.parameters);
    } else if (conf.type == "FormeGrow") {
      confRenderParamter = makeDistanceFormeConfParameter(conf.parameters);
    } else {
      return;
    }
    this.renderParams[id] = confRenderParamter;
    const inputValue = Object.entries(confRenderParamter).map(([_idx, v]) => {
      const divname = confDivId + "_" + v.id;
      if (v.type == "inputRange") {
        return `
        <div id="${divname}_wrapper" class="valueSelector">
          <label for="${divname}">${v.name}:</label>
          <div onclick="changeValue('${divname}', -${v.step}, ${v.min})">-</div>
          <input type="text" id="${divname}_value" value="${v.value}">
          <div onclick="changeValue('${divname}', ${v.step}, ${v.max})">+</div>
        </div>
        `;
      }
      if (v.type == "section") {
        return `
        <div id="${divname}_section" class="Section">
        <h4>${v.name}</h4>
        </div>`;
      }
      if (v.type == "tileSelector") {
        return colorSelector(divname, v);
      }
      return "";
    }).join("");
    const colorBox = !conf.color ? "" : `
      <span style="background-color:${conf.color}; min-width:1rem; height:1rem; border-radius:100%; display: inline-block;"></span>
    `;
    boxDiv.innerHTML += `
    <details>
      <summary>
         
            <input id="${confDivId}_open" type="checkbox" checked>
            ${colorBox}
            ${conf.name}
          
      </summary>
          <div id="${confDivId}_contener" >
           ${inputValue}
          </div>
    </details>
        `;
    boxDiv.querySelector(`#${confDivId}_open`).addEventListener("click", (e) => {
      this.enabled[id] = e.target.checked;
    });
  }
  update() {
    for (let k = 0; k < this.confs.length; k++) {
      const conf = this.confs[k];
      const render = this.renderParams[k];
      if (!render) continue;
      for (const v of render) {
        if (v.type === "inputRange") {
          const el = document.getElementById(`${this.menuDivId}_${k}_${v.id}_value`);
          if (el && conf.parameters) {
            conf.parameters[v.id] = parseFloat(el.value);
          }
        }
      }
    }
    return this.confs;
  }
  getEnabledConfs() {
    return this.confs.filter((_c, i) => this.enabled[i]);
  }
};
var makeDistanceFormeConfParameter = (conf) => {
  return [
    {
      id: "from",
      name: "InBorderOf",
      type: "tileSelector",
      value: conf.from
    },
    {
      id: "replaceItem",
      name: "ReplaceBy",
      type: "tileSelector",
      value: conf.replaceItem
    },
    {
      id: "minDis",
      type: "inputRange",
      value: conf.minDis,
      min: 0,
      max: 1e3,
      step: 5,
      name: "Min Sky Distance"
    },
    {
      id: "maxDis",
      type: "inputRange",
      value: conf.maxDis,
      min: 0,
      max: 1e3,
      step: 5,
      name: "Max Sky Distance"
    },
    {
      id: "growSize",
      type: "inputRange",
      value: conf.growSize,
      min: 0,
      max: 50,
      step: 1,
      name: "growSize"
    }
  ];
};
var makeWallConfParameter = (conf) => {
  return [
    {
      id: "from",
      name: "InBorderOf",
      type: "tileSelector",
      value: conf.from
    },
    {
      id: "inside",
      name: "TypeToReplace",
      type: "tileSelector",
      value: conf.inside
    },
    {
      id: "replaceItem",
      name: "ReplaceBy",
      type: "tileSelector",
      value: conf.replaceItem
    },
    {
      id: "nearMask",
      name: "Apply Wall",
      type: "fixed",
      value: conf.nearMask
    },
    {
      id: "minDis",
      type: "inputRange",
      value: conf.minDis,
      min: 0,
      max: 1e3,
      step: 5,
      name: "Min Sky Distance"
    },
    {
      id: "maxDis",
      type: "inputRange",
      value: conf.maxDis,
      min: 0,
      max: 1e3,
      step: 5,
      name: "Max Sky Distance"
    },
    {
      id: "growSize",
      type: "inputRange",
      value: conf.growSize,
      min: 0,
      max: 50,
      step: 1,
      name: "growSize"
    }
  ];
};

// js/confSelection.js
var ConfSection = class {
  constructor(menuDivId, name2, conf = {}) {
    this.menuDivId = menuDivId, this.name = name2;
    this.menuDiv = document.getElementById(menuDivId);
    this.name = name2;
    this.conf = conf;
    this.enabled = true;
    this.generateMenu();
  }
  generateMenu() {
    const inputValue = Object.entries(this.conf).map(([k, v]) => {
      if (v.type == "inputRange") {
        return `
        <div id="${this.menuDivId}_${k}_wrapper" class="valueSelector">
        <label for="${this.menuDivId}_${k}">${v.name}:</label>
          <div onclick="changeValue('${this.menuDivId}_${k}', -${v.step}, ${v.min})">-</div>
          <input type="text" id="${this.menuDivId}_${k}_value" value="${v.value}">
          <div onclick="changeValue('${this.menuDivId}_${k}', ${v.step}, ${v.max})">+</div>
        </div>
        `;
      }
      if (v.type == "section") {
        return `
        <div id="${this.menuDivId}_${k}_section" class="Section">
        <h4>${v.name}</h4>
        </div>`;
      }
      return "";
    }).join("");
    this.menuDiv.innerHTML += `
            <h3>
              <input id="${this.menuDivId}_open" type="checkbox" checked>
              ${this.name} Generation
            </h3>
          <div id="${this.menuDivId}_contener" >
           ${inputValue}
           <div>
        `;
    this.menuDiv.querySelector(`#${this.menuDivId}_contener`).style.display = "block";
    this.menuDiv.querySelector(`#${this.menuDivId}_open`).addEventListener("click", (e) => {
      this.enabled = e.target.checked;
      this.menuDiv.querySelector(`#${this.menuDivId}_contener`).style.display = e.target.checked ? "block" : "none";
    });
  }
  update() {
    for (const [k, v] of Object.entries(this.conf)) {
      if (v.type == "inputRange") {
        v.value = parseFloat(document.getElementById(this.menuDivId + "_" + k + "_value").value);
      }
    }
    return this.conf;
  }
};

// js/convolution.js
function IntArrayto2D(input, WIDTH2, HEIGHT2) {
  const result = [];
  for (let y = 0; y < HEIGHT2; y++) {
    const row = [];
    for (let x = 0; x < WIDTH2; x++) {
      row.push(input[y * WIDTH2 + x]);
    }
    result.push(row);
  }
  return result;
}
var gpu = new GPU.GPU();
function tEmpty() {
  return 0;
}
gpu.addFunction(tEmpty);
function tSky() {
  return 1;
}
gpu.addFunction(tSky);
function tRock() {
  return 2;
}
gpu.addFunction(tRock);
function tTunnel() {
  return 3;
}
gpu.addFunction(tTunnel);
function tCave() {
  return 4;
}
gpu.addFunction(tCave);
function tFloor() {
  return 101;
}
gpu.addFunction(tFloor);
function tRoof() {
  return 102;
}
gpu.addFunction(tRoof);
function tWallL() {
  return 103;
}
gpu.addFunction(tWallL);
function tWallR() {
  return 104;
}
gpu.addFunction(tWallR);
function isCaverne(c) {
  return c == tTunnel() ? 1 : 0;
}
gpu.addFunction(isCaverne);
function gpuNearTile(data, x, y, w, h) {
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < w - 1 ? data[y][x + 1] : c;
  return [
    u,
    r,
    d,
    l
  ];
}
gpu.addFunction(gpuNearTile);
function gpuNearTile2D(data, x, y, w, h) {
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < w - 1 ? data[y][x + 1] : c;
  const ur = y > 0 && x < this.constants.w - 1 ? data[y - 1][x + 1] : c;
  const dr = x < this.constants.w - 1 && y < this.constants.h - 1 ? data[y + 1][x + 1] : c;
  const dl = y < this.constants.h - 1 && x > 0 ? data[y + 1][x - 1] : c;
  const ul = x > 0 && y > 0 ? data[y][x - 1] : c;
  return [
    [
      ul,
      u,
      ur
    ],
    [
      l,
      c,
      r
    ],
    [
      dl,
      d,
      dr
    ]
  ];
}
gpu.addFunction(gpuNearTile2D);
var convIdentity = gpu.createKernel(function(data) {
  const x = this.thread.x;
  const y = this.thread.y;
  const c = data[y][x];
  return c;
}).setConstants({
  w: WIDTH,
  h: HEIGHT
}).setOutput([
  WIDTH,
  HEIGHT
]).setPipeline(true).setImmutable(true);
var convIdentity2x = gpu.createKernel(function(data) {
  const x = Math.floor(this.thread.x / 2);
  const y = Math.floor(this.thread.y / 2);
  const c = data[y][x];
  return c;
}).setConstants({
  w: WIDTH,
  h: HEIGHT
}).setOutput([
  WIDTH * 2,
  HEIGHT * 2
]).setPipeline(true).setImmutable(true);
var convIdentity4x = gpu.createKernel(function(data) {
  const x = Math.floor(this.thread.x / 2);
  const y = Math.floor(this.thread.y / 2);
  const c = data[y][x];
  return c;
}).setConstants({
  w: WIDTH * 2,
  h: WIDTH * 2
}).setOutput([
  WIDTH * 4,
  HEIGHT * 4
]).setPipeline(true).setImmutable(true);
var convKernelMakerSelectMask = (min, max) => {
  return gpu.createKernel(function(data) {
    const x = this.thread.x;
    const y = this.thread.y;
    const c = data[y][x];
    return c >= this.constants.min && c <= this.constants.max ? 1 : 0;
  }).setConstants({
    w: WIDTH,
    h: HEIGHT,
    min,
    max
  }).setOutput([
    WIDTH,
    HEIGHT
  ]).setPipeline(true).setImmutable(true);
};
var convSelectMaxNeighborValueMask = gpu.createKernel(function(data) {
  const x = this.thread.x;
  const y = this.thread.y;
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const r = x < this.constants.w - 1 ? data[y][x + 1] : c;
  const d = y < this.constants.h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const ur = y > 0 && x < this.constants.w - 1 ? data[y - 1][x + 1] : c;
  const rd = x < this.constants.w - 1 && y < this.constants.h - 1 ? data[y + 1][x + 1] : c;
  const dl = y < this.constants.h - 1 && x > 0 ? data[y + 1][x - 1] : c;
  const lu = x > 0 && y > 0 ? data[y][x - 1] : c;
  return c > u && c > r && c > d && c > l && c > ur && c > rd && c > dl && c > lu ? 1 : 0;
}).setConstants({
  w: WIDTH,
  h: HEIGHT
}).setOutput([
  WIDTH,
  HEIGHT
]).setPipeline(true).setImmutable(true);
var convKernelMakerPropagateDistance = (from, inside) => {
  return gpu.createKernel(function(data) {
    const x = this.thread.x;
    const y = this.thread.y;
    const c = data[y][x];
    const u = y > 0 ? data[y - 1][x] : c;
    const r = x < this.constants.w - 1 ? data[y][x + 1] : c;
    const d = y < this.constants.h - 1 ? data[y + 1][x] : c;
    const l = x > 0 ? data[y][x - 1] : c;
    const ur = y > 0 && x < this.constants.w - 1 ? data[y - 1][x + 1] : c;
    const rd = x < this.constants.w - 1 && y < this.constants.h - 1 ? data[y + 1][x + 1] : c;
    const dl = y < this.constants.h - 1 && x > 0 ? data[y + 1][x - 1] : c;
    const lu = x > 0 && y > 0 ? data[y][x - 1] : c;
    let from2 = 0;
    for (let i = 0; i < this.constants.fromLength; i++) {
      const item = this.constants.from[i];
      if (u == item || r == item || d == item || l == item) {
        from2 = 1;
      }
    }
    let inside2 = 0;
    for (let i = 0; i < this.constants.insideLength; i++) {
      const item = this.constants.inside[i];
      if (c == item) {
        inside2 = 1;
      }
    }
    if (inside2 == 1) {
      if (from2 == 1) {
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
  }).setConstants({
    w: WIDTH,
    h: HEIGHT,
    from,
    fromLength: from.length,
    inside,
    insideLength: inside.length
  }).setOutput([
    WIDTH,
    HEIGHT
  ]).setPipeline(true).setImmutable(true);
};
var convRepaceCave = gpu.createKernel(function(data) {
  const x = this.thread.x;
  const y = this.thread.y;
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < this.constants.h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < this.constants.w - 1 ? data[y][x + 1] : c;
  return c == tCave() ? tTunnel() : c;
}).setConstants({
  w: WIDTH,
  h: HEIGHT
}).setOutput([
  WIDTH,
  HEIGHT
]).setPipeline(true).setImmutable(true);
var convKernelMakerGrow = (from, inside, replaceWalls, mask = 0, scaleSize = 1) => {
  return gpu.createKernel(function(data) {
    const w = this.constants.w;
    const h = this.constants.h;
    const x = this.thread.x;
    const y = this.thread.y;
    const c = data[y][x];
    const nearTile = gpuNearTile(data, x, y, w, h);
    let inside2 = 0;
    for (let i = 0; i < this.constants.insideLength; i++) {
      const itemFrom = this.constants.inside[i];
      if (c == itemFrom) {
        inside2 = 1;
      }
    }
    if (inside2 == 0) {
      return this.constants.isMask == 0 ? c : 0;
    }
    for (let k = 0; k < 4; k++) {
      const replaceWalls2 = this.constants.replaceWalls[k];
      if (replaceWalls2 == 0) {
        continue;
      }
      for (let i = 0; i < this.constants.fromLength; i++) {
        const targetItem = this.constants.from[i];
        if (nearTile[k] == targetItem) {
          return replaceWalls2;
        }
      }
    }
    return this.constants.isMask == 0 ? c : 0;
  }).setConstants({
    w: WIDTH * scaleSize,
    h: HEIGHT * scaleSize,
    from,
    fromLength: from.length,
    inside,
    insideLength: inside.length,
    replaceWalls,
    isMask: mask
  }).setOutput([
    WIDTH * scaleSize,
    HEIGHT * scaleSize
  ]).setPipeline(true).setImmutable(true);
};
var convKernelMakerGrowInside = (from, inside, replaceWalls) => {
  return convKernelMakerGrow(from, inside, replaceWalls, 0, 1);
};
var convKernelMakerGrowInside4x = (from, inside, replaceWalls) => {
  return convKernelMakerGrow(from, inside, replaceWalls, 0, 4);
};
var convKernelMakerMaskInside = (from, inside, replaceWalls) => {
  return convKernelMakerGrow(from, inside, replaceWalls, 1, 1);
};
var convExtandWall = gpu.createKernel(function(data) {
  const x = this.thread.x;
  const y = this.thread.y;
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < this.constants.h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < this.constants.w - 1 ? data[y][x + 1] : c;
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
    if (u == tRoof() || r == tRoof() && l == tRoof()) {
      return tRoof();
    }
    if (r == tWallR() || u == tWallR() && d == tWallR()) {
      return tWallR();
    }
    if (d == tFloor() || r == tFloor() && l == tFloor()) {
      return tFloor();
    }
    if (l == tWallL() || u == tWallL() && d == tWallR()) {
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
}).setConstants({
  w: WIDTH,
  h: HEIGHT
}).setOutput([
  WIDTH,
  HEIGHT
]).setPipeline(true).setImmutable(true);
var convPropagatWaterStepA = gpu.createKernel(function(data) {
  const x = this.thread.x;
  const y = this.thread.y;
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < this.constants.h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < this.constants.w - 1 ? data[y][x + 1] : c;
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
}).setConstants({
  w: WIDTH,
  h: HEIGHT
}).setOutput([
  WIDTH,
  HEIGHT
]).setPipeline(true).setImmutable(true);
var convPropagatWaterStepB = gpu.createKernel(function(data) {
  const x = this.thread.x;
  const y = this.thread.y;
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < this.constants.h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < this.constants.w - 1 ? data[y][x + 1] : c;
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
}).setConstants({
  w: WIDTH,
  h: HEIGHT
}).setOutput([
  WIDTH,
  HEIGHT
]).setPipeline(true).setImmutable(true);
var convPropagatWaterStepRefill = gpu.createKernel(function(data) {
  const x = this.thread.x;
  const y = this.thread.y;
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < this.constants.h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < this.constants.w - 1 ? data[y][x + 1] : c;
  if (c == tTunnel() || c == tCave()) {
    if (u >= 1024) {
      return u - 1;
    }
  }
  return c;
}).setConstants({
  w: WIDTH,
  h: HEIGHT
}).setOutput([
  WIDTH,
  HEIGHT
]).setPipeline(true).setImmutable(true);
var convPropagateLavaStepA = gpu.createKernel(function(data) {
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
  return c;
}).setConstants({
  w: WIDTH,
  h: HEIGHT
}).setOutput([
  WIDTH,
  HEIGHT
]).setPipeline(true).setImmutable(true);
var convPropagateLavaStepB = gpu.createKernel(function(data) {
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
  return c;
}).setConstants({
  w: WIDTH,
  h: HEIGHT
}).setOutput([
  WIDTH,
  HEIGHT
]).setPipeline(true).setImmutable(true);
var convPropagatSurfaceWaterStepA = gpu.createKernel(function(data) {
  const x = this.thread.x;
  const y = this.thread.y;
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < this.constants.h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < this.constants.w - 1 ? data[y][x + 1] : c;
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
}).setConstants({
  w: WIDTH,
  h: HEIGHT
}).setOutput([
  WIDTH,
  HEIGHT
]).setPipeline(true).setImmutable(true);
var convPropagatSurfaceWaterStepB = gpu.createKernel(function(data) {
  const x = this.thread.x;
  const y = this.thread.y;
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < this.constants.h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < this.constants.w - 1 ? data[y][x + 1] : c;
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
}).setConstants({
  w: WIDTH,
  h: HEIGHT
}).setOutput([
  WIDTH,
  HEIGHT
]).setPipeline(true).setImmutable(true);
var convKernelMakerReplaceDistance = (inside, into, min, maxx = null, isInRange = 1) => {
  const max = maxx === null ? min : maxx;
  return gpu.createKernel(function(data, mask) {
    const x = this.thread.x;
    const y = this.thread.y;
    const c = data[y][x];
    const m = mask[y][x];
    if (m < this.constants.min || m > this.constants.max) {
      return this.constants.isInRange == 1 ? c : this.constants.into;
    }
    let inside2 = 0;
    for (let i = 0; i < this.constants.insideLength; i++) {
      const item = this.constants.inside[i];
      if (c == item) {
        inside2 = 1;
      }
    }
    if (inside2 == 1) {
      return this.constants.isInRange == 1 ? this.constants.into : c;
    }
    return this.constants.isInRange == 1 ? c : this.constants.into;
  }).setConstants({
    w: WIDTH,
    h: HEIGHT,
    inside,
    insideLength: inside.length,
    into,
    min,
    max,
    isInRange
  }).setOutput([
    WIDTH,
    HEIGHT
  ]).setPipeline(true).setImmutable(true);
};
var convKernelMakerReplaceInsideDistance = (from, to, min, maxx = null) => {
  return convKernelMakerReplaceDistance(from, to, min, maxx, 1);
};
var convKernelMakerReplaceOutsideDistance = (from, to, min, maxx = null) => {
  return convKernelMakerReplaceDistance(from, to, min, maxx, 0);
};
function gpuNearTileID(data, x, y, w, h) {
  const c = data[y][x];
  const u = y > 0 ? data[y - 1][x] : c;
  const d = y < h - 1 ? data[y + 1][x] : c;
  const l = x > 0 ? data[y][x - 1] : c;
  const r = x < w - 1 ? data[y][x + 1] : c;
  const ur = y > 0 && x < this.constants.w - 1 ? data[y - 1][x + 1] : c;
  const dr = x < this.constants.w - 1 && y < this.constants.h - 1 ? data[y + 1][x + 1] : c;
  const dl = y < this.constants.h - 1 && x > 0 ? data[y + 1][x - 1] : c;
  const ul = x > 0 && y > 0 ? data[y][x - 1] : c;
  return [
    ul,
    u,
    ur,
    l,
    c,
    r,
    dl,
    d,
    dr
  ];
}
gpu.addFunction(gpuNearTileID);
var convKernelMakeNearTileFrequency = (factorSize) => {
  const kernel = gpu.createKernel(function(data) {
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
  }).setConstants({
    w: WIDTH * factorSize,
    h: HEIGHT * factorSize
  }).setOutput([
    WIDTH * factorSize,
    HEIGHT * factorSize,
    64
  ]).setPipeline(true);
  return kernel;
};
var convKernelMakeSmoothing = (factorSize) => {
  const kernel = gpu.createKernel(function(dataNearFrequency) {
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
  }).setConstants({
    w: WIDTH * factorSize,
    h: HEIGHT * factorSize
  }).setOutput([
    WIDTH * factorSize,
    HEIGHT * factorSize
  ]).setPipeline(true);
  return kernel;
};
var convSmoothBorder = (data, sizeScall = 1) => {
  const kernelNearTileFrequency = convKernelMakeNearTileFrequency(sizeScall);
  const kernelSmoothing = convKernelMakeSmoothing(sizeScall);
  const frequenty = kernelNearTileFrequency(data);
  const smoothing = kernelSmoothing(frequenty);
  return smoothing;
};

// js/isonList.js
var iconsList = [
  {
    "title": ".ENV",
    "hex": "ECD53F",
    "source": "https://github.com/motdotla/dotenv/blob/40e75440337d1de2345dc8326d6108331f583fd8/dotenv.svg",
    "aliases": {
      "aka": [
        "Dotenv"
      ]
    }
  }
];

// js/iconFunction.js
var iconsURL = iconsList.map((iconsInfo) => {
  const name2 = iconsInfo.title.toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `https://cdn.simpleicons.org/${name2}/000000`;
});

// js/noiseGeneration1D.js
var GlobalZoom = 2;
var noiseGenerator1D = class {
  constructor(menuDivId, name2) {
    this.name = name2;
    this.menuDiv = document.getElementById(menuDivId);
    this.name = name2;
    this.conf = perlinNoiseConfigurations.skyline.parameters;
    this.enabled = true;
    this.generateMenu();
  }
  generateMenu() {
    const inputValue = Object.entries(this.conf).map(([k, v]) => {
      if (v.type == "inputRange") {
        return `
        <div id="${this.name}_${k}_wrapper" class="valueSelector">
        <label for="${this.name}_${k}">${v.name}:</label>
          <div onclick="changeValue('${this.name}_${k}', -${v.step}, ${v.min})">-</div>
          <input type="text" id="${this.name}_${k}_value" value="${v.value}">
          <div onclick="changeValue('${this.name}_${k}', ${v.step}, ${v.max})">+</div>
        </div>
        `;
      }
      return "";
    }).join("");
    this.menuDiv.innerHTML += `
            <h3>
              <input id="${this.name}_open" type="checkbox" checked>
              ${this.name} Generation
            </h3>
          <div id="${this.name}_contener" >
           ${inputValue}
           <div>
        `;
    this.menuDiv.querySelector(`#${this.name}_contener`).style.display = "block";
    this.menuDiv.querySelector(`#${this.name}_open`).addEventListener("click", (e) => {
      this.enabled = e.target.checked;
      this.menuDiv.querySelector(`#${this.name}_contener`).style.display = e.target.checked ? "block" : "none";
    });
  }
  generate(canvas) {
    const seed = document.getElementById("seed").value;
    for (const [k, v] of Object.entries(this.conf)) {
      if (v.type == "inputRange") {
        v.value = parseFloat(document.getElementById(this.name + "_" + k + "_value").value);
      }
    }
    const data = new Int16Array(canvas.width * canvas.height);
    console.log(this.conf);
    const simplex = new SimplexNoise(seed);
    const maxAmplitude = canvas.height / 4;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        let value = 0;
        const xx = (x + this.conf.Phase.value) * GlobalZoom;
        value += (-0.5 + simplex.noise2D(xx * this.conf.F1.value, 0)) * this.conf.Amp.value * this.conf.A1.value * maxAmplitude;
        value += (-0.5 + simplex.noise2D(xx * this.conf.F2.value, 0)) * this.conf.Amp.value * this.conf.A2.value * maxAmplitude;
        value += (-0.5 + simplex.noise2D(xx * this.conf.F3.value, 0)) * this.conf.Amp.value * this.conf.A3.value * maxAmplitude;
        value += (-0.5 + simplex.noise2D(xx * this.conf.F4.value, 0)) * this.conf.Amp.value * this.conf.A4.value * maxAmplitude;
        data[y * canvas.width + x] = this.conf.BaseHeight.value + value > y ? 1 : 0;
      }
    }
    return data;
  }
};

// js/noiseGeneration2D.js
var GlobalDefinition = 2;
var NoiseGenerator2D = class {
  constructor(menuDivId, name2) {
    this.menuDiv = document.getElementById(menuDivId);
    this.x = 0;
    this.y = 0;
    this.name = name2;
    this.conf = this.init_cont();
    this.enabled = true;
    this.generateMenu();
  }
  init_cont() {
    return perlinNoiseConfigurations.tunnel.parameters;
  }
  generateMenu() {
    const inputValue = Object.entries(this.conf).map(([k, v]) => {
      if (v.type == "inputRange") {
        return `
        <div id="${this.name}_${k}_wrapper" class="valueSelector">
        <label for="${this.name}_${k}">${v.name}:</label>
          <div onclick="changeValue('${this.name}_${k}', -${v.step}, ${v.min})">-</div>
          <input type="text" id="${this.name}_${k}_value" value="${v.value}">
          <div onclick="changeValue('${this.name}_${k}', ${v.step}, ${v.max})">+</div>
        </div>        `;
      }
      if (v.type == "section") {
        return `
        <div id="${this.name}_${k}_section" class="Section">
        <h4>${v.name}</h4>
        </div>`;
      }
      return "";
    }).join("");
    this.menuDiv.innerHTML += `
          <h3> <input id="${this.name}_open" type="checkbox" checked> ${this.name} Generation</h3>
          <div id="${this.name}_contener" >
           ${inputValue}
           </div>
        `;
    this.menuDiv.querySelector(`#${this.name}_contener`).style.display = "block";
    this.menuDiv.querySelector(`#${this.name}_open`).addEventListener("click", (e) => {
      this.enabled = e.target.checked;
      this.menuDiv.querySelector(`#${this.name}_contener`).style.display = e.target.checked ? "block" : "none";
    });
  }
  generate(canvas) {
    const seed = document.getElementById("seed").value;
    for (const [k, v] of Object.entries(this.conf)) {
      if (v.type == "inputRange") {
        v.value = parseFloat(document.getElementById(this.name + "_" + k + "_value").value);
      }
    }
    const conf = this.conf;
    const data = new Int16Array(canvas.width * canvas.height);
    const simplex = new SimplexNoise(seed);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const xx = (x + this.x - this.conf.X.value) * GlobalDefinition;
        const yy = (y + this.y + this.conf.Y.value) * GlobalDefinition;
        const Definition = 1 - conf.Definition.value;
        let value = 0;
        value += conf.A1.value * simplex.noise2D(xx * conf.F1.value * Definition, yy * conf.F1.value * Definition);
        value += conf.A2.value * simplex.noise2D(xx * conf.F2.value * Definition, yy * conf.F2.value * Definition);
        value += conf.A3.value * simplex.noise2D(xx * conf.F3.value * Definition, yy * conf.F3.value * Definition);
        value += conf.A4.value * simplex.noise2D(xx * conf.F4.value * Definition, yy * conf.F4.value * Definition);
        value /= conf.A1.value + conf.A2.value + conf.A3.value + conf.A4.value;
        if (conf.Inverse.value == 1 && y > canvas.height - conf.BottomLimit.value) {
          value *= (canvas.height - y) / conf.BottomLimit.value + 0.1;
        }
        if (conf.Inverse.value == 0 && y > canvas.height - conf.BottomLimit.value) {
          value = 1 / value;
          value *= (canvas.height - y) / conf.BottomLimit.value;
          value = 1 / value;
        }
        const tagTrue = conf.Inverse.value == 0 ? 1 : 0;
        const tagFalse = conf.Inverse.value == 0 ? 0 : 1;
        const thickness = conf.Inverse.value ? 0.5 - conf.Thickness.value : conf.Thickness.value;
        data[y * canvas.width + x] = value <= thickness && value >= -thickness ? tagTrue : tagFalse;
      }
    }
    return data;
  }
  tagMap(data, width, height) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (data[index] === 0) {
          if (y + 1 < height && data[(y + 1) * width + x] === 1) {
            data[index] = 2;
          } else if (y - 1 >= 0 && data[(y - 1) * width + x] === 1) {
            data[index] = 3;
          } else if (x - 1 >= 0 && data[y * width + x - 1] === 1) {
            data[index] = 4;
          } else if (x + 1 < height && data[y * width + x + 1] === 1) {
            data[index] = 4;
          }
        }
      }
    }
  }
};
var CaveGenerator2D = class extends NoiseGenerator2D {
  constructor(menuDivId, name2) {
    super(menuDivId, name2);
  }
  init_cont() {
    return perlinNoiseConfigurations.cave.parameters;
  }
};

// js/mapGeneration.js
window.generateMap = generateMap;
window.changeValue = changeValue;
var rockSky = new noiseGenerator1D("rockSkyMenu", "SkyLine");
var tunnel = new NoiseGenerator2D("tunnelMenu", "Tunnel");
var cave = new CaveGenerator2D("caveMenu", "Cave");
var fluidMenu = new ConfSection("fluidMenu", "Fluid", {});
var formeMenu = new ConfSectionParams(
  "distanceMenu",
  skyDistanceConfiguration2
);
var WallMenu = new ConfSectionParams(
  "wallMenu",
  WallConfiguration
);
async function generateMap() {
  const rockSkyData = rockSky.enabled ? rockSky.generate({ width: WIDTH, height: HEIGHT }) : null;
  const tunnelData = tunnel.enabled ? tunnel.generate({ width: WIDTH, height: HEIGHT }) : null;
  const caveData = cave.enabled ? cave.generate({ width: WIDTH, height: HEIGHT }) : null;
  const data = new Int16Array(WIDTH * HEIGHT);
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const idx = y * WIDTH + x;
      let item = itemsId.rock;
      if (x == 0 || x == WIDTH - 1) {
        data[idx] = item;
        continue;
      }
      if (rockSky.enabled && rockSkyData[idx] == 1) {
        item = itemsId.sky;
      }
      if (tunnel.enabled && [itemsId.rock].includes(item) && tunnelData[idx] == 1) {
        item = itemsId.tunnel;
      }
      if (cave.enabled && [itemsId.rock, itemsId.tunnel].includes(item) && caveData[idx] == 1) {
        item = itemsId.cave;
      }
      data[idx] = item;
    }
  }
  let map2D = IntArrayto2D(data, WIDTH, HEIGHT);
  map2D = convIdentity(map2D);
  const caveMask2D = convRepaceCave(map2D);
  let finalMap2D = convIdentity(map2D);
  let skyDistance2D = caveMask2D;
  const convPropagateSkyDistance2 = convKernelMakerPropagateDistance(
    [tSky()],
    [tTunnel(), tCave()]
  );
  for (let i = 0; i < 400; i++) {
    skyDistance2D = convPropagateSkyDistance2(skyDistance2D);
  }
  const kernelMapReplaceNoteAcces = convKernelMakerReplaceInsideDistance(
    [itemsId.cave, itemsId.tunnel],
    itemsId.rock,
    0,
    1024 - 1
  );
  finalMap2D = kernelMapReplaceNoteAcces(finalMap2D, skyDistance2D);
  const fluidConf = fluidMenu.update();
  if (fluidMenu.enabled) {
    let water2DMask = caveMask2D;
    for (let i = 0; i < 10; i++) {
      water2DMask = convPropagatWaterStepA(water2DMask);
    }
    for (let i = 0; i < 200; i++) {
      water2DMask = convPropagatWaterStepB(water2DMask);
    }
    const kernelMapReplaceWater = convKernelMakerReplaceInsideDistance(
      [itemsId.cave, itemsId.tunnel],
      itemsId.FogWater,
      1024,
      // Min pool Size
      4024
    );
    finalMap2D = kernelMapReplaceWater(finalMap2D, water2DMask);
    const kernelGrowWaterDown2 = convKernelMakerGrowInside(
      [itemsId.cave, itemsId.tunnel, itemsId.rock],
      [itemsId.FogWater],
      [0, itemsId.tunnel, itemsId.tunnel, itemsId.tunnel]
    );
    for (let i = 0; i < 6; i++) {
      finalMap2D = kernelGrowWaterDown2(finalMap2D);
    }
    const kernelGrowWaterDown = convKernelMakerGrowInside(
      [itemsId.FogWater],
      [itemsId.cave, itemsId.tunnel],
      [itemsId.FogWater, itemsId.FogWater, 0, itemsId.FogWater]
    );
    for (let i = 0; i < 20; i++) {
      finalMap2D = kernelGrowWaterDown(finalMap2D);
    }
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
      1024 + 800
    );
    finalMap2D = kernelMapReplaceLava(finalMap2D, lava2DMask);
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
      1024 * 32
    );
    finalMap2D = kernelMapReplaceSurfaceWater(finalMap2D, surfaceWaterMask2D);
    const kernelGrowSurfaceWaterDown2 = convKernelMakerGrowInside(
      [itemsId.cave, itemsId.tunnel, itemsId.rock, itemsId.sky],
      [itemsId.SurfaceWater],
      [0, itemsId.sky, itemsId.sky, itemsId.sky]
    );
    for (let i = 0; i < 6; i++) {
      finalMap2D = kernelGrowSurfaceWaterDown2(finalMap2D);
    }
    const kernelGrowSurfaceWaterDown = convKernelMakerGrowInside(
      [itemsId.SurfaceWater],
      [itemsId.sky],
      [itemsId.SurfaceWater, itemsId.SurfaceWater, 0, itemsId.SurfaceWater]
    );
    for (let i = 0; i < 20; i++) {
      finalMap2D = kernelGrowSurfaceWaterDown(finalMap2D);
    }
  }
  function selectCenterDistanceRange(distance2D, distanceMin, distanceMax, growSize) {
    let selectZone = convKernelMakerSelectMask(
      1024 + distanceMin,
      1024 + distanceMax
    )(
      distance2D
    );
    const convPropagateDistanceBorderA = convKernelMakerPropagateDistance([0], [
      1
    ]);
    for (let i = 0; i < (distanceMax - distanceMin) * 2; i++) {
      selectZone = convPropagateDistanceBorderA(selectZone);
    }
    selectZone = convSelectMaxNeighborValueMask(selectZone);
    selectZone = convKernelMakerSelectMask(1, 2048)(selectZone);
    const convPropagateDistanceOusideA = convKernelMakerPropagateDistance([1], [
      0
    ]);
    for (let i = 0; i < growSize; i++) {
      selectZone = convPropagateDistanceOusideA(selectZone);
    }
    return selectZone;
  }
  function applyGrowCenterForme(finalMap2D2, conf) {
    const from = conf.from;
    const replaceItem = conf.replaceItem;
    const formeMask2D = selectCenterDistanceRange(
      skyDistance2D,
      conf.minDis,
      conf.maxDis,
      conf.growSize
    );
    const kernelMapReplaceSporeSoil = convKernelMakerReplaceInsideDistance(
      from,
      replaceItem,
      1024,
      1024 * 32
    );
    finalMap2D2 = kernelMapReplaceSporeSoil(finalMap2D2, formeMask2D);
    return finalMap2D2;
  }
  formeMenu.update();
  console.log(formeMenu.getEnabledConfs());
  for (const conf of formeMenu.getEnabledConfs()) {
    console.log(conf);
    const parameters = conf.parameters;
    console.log(parameters);
    finalMap2D = applyGrowCenterForme(
      finalMap2D,
      parameters
    );
  }
  function applyGrowWall(finalMap2D2, conf) {
    const from = conf.from;
    const inside = conf.inside;
    const replaceItem = conf.replaceItem;
    const kernelGrowRedSandA_Wall = convKernelMakerMaskInside(
      from,
      // [itemsId.rock, itemsId.tunnel],
      inside,
      // [itemsId.cave],
      conf.nearMask
      //[1, 0, 0, 0],
    );
    let redSandMask = kernelGrowRedSandA_Wall(finalMap2D2);
    const kernelGrowRedSandA_FilterDistance = convKernelMakerReplaceOutsideDistance(
      [1],
      0,
      1024 + conf.minDis,
      // 1024 + 150,
      1024 + conf.maxDis
      // 1024 * 32,
    );
    redSandMask = kernelGrowRedSandA_FilterDistance(redSandMask, skyDistance2D);
    const kernelGrowRedSandA_Grow = convKernelMakerGrowInside(
      [1],
      [0],
      [1, 1, 1, 1]
    );
    for (let i = 0; i < conf.growSize; i++) {
      redSandMask = kernelGrowRedSandA_Grow(redSandMask);
    }
    const kernelGrowRedSandA_Apply = convKernelMakerReplaceInsideDistance(
      inside,
      // [itemsId.cave],
      replaceItem,
      // itemsId.RedsandSoil,
      1
    );
    finalMap2D2 = kernelGrowRedSandA_Apply(finalMap2D2, redSandMask);
    return finalMap2D2;
  }
  WallMenu.update();
  for (const wallConf of WallMenu.getEnabledConfs()) {
    console.log(wallConf);
    const parameters = wallConf.parameters;
    console.log(parameters);
    finalMap2D = applyGrowWall(
      finalMap2D,
      parameters
    );
  }
  const canvas = document.getElementById("mapCanvas");
  canvas.style.zoom = 0.65;
  finalMap2D = convIdentity2x(finalMap2D);
  finalMap2D = convSmoothBorder(finalMap2D, 2);
  finalMap2D = convIdentity4x(finalMap2D);
  finalMap2D = convSmoothBorder(finalMap2D, 4);
  if (false) {
    const isClose = (listPos, x, y) => {
      const listDist = listPos.map(
        ([xx, yy]) => Math.abs(xx - x) + Math.abs(yy - y)
      );
      const meanDist = listDist.reduce(
        (acc, value) => Math.min(acc, value),
        1e3
      );
      return meanDist;
    };
    const itemMask2D = selectCenterDistanceRange(
      skyDistance2D,
      80,
      350,
      0
    );
    const itemMaskArray = itemMask2D.toArray();
    const listPosItem = [];
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        if (itemMaskArray[y][x] > 0) {
          console.log("Item ", x, y, isClose(listPosItem, x, y));
          if (isClose(listPosItem, x, y) > 50) {
            const yy = y > HEIGHT - 15 ? y - 15 : y;
            const size = 2 * (15 + Math.floor(Math.random() * 4));
            const mask = await loadSvgMaskToBuffer(size, listPosItem.length);
            console.log(size);
            listPosItem.push([x, yy]);
            finalMap2D = applyMaskToBuffer(
              size,
              size,
              x * CANVA_SCALE,
              yy * CANVA_SCALE,
              itemsId.Fluxite
            )(finalMap2D, mask);
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
    itemsId.Moss
  ];
  const kernelGrowFluxiteBorder = convKernelMakerGrowInside4x(
    [itemsId.Fluxite, itemsId.fluxBorder],
    [...AllItem],
    [
      itemsId.fluxBorder,
      itemsId.fluxBorder,
      itemsId.fluxBorder,
      itemsId.fluxBorder
    ]
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
      itemsId.Moss
    ]
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
      itemsId.cave
    ]
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
      itemsId.tunnel
    ]
  );
  for (let i = 0; i < 10; i++) {
    finalMap2D = kernelGrowFluxiteBorder3(finalMap2D);
  }
  const finalMapArray = finalMap2D.toArray();
  const CWIDTH = WIDTH * 4;
  const CHEIGHT = HEIGHT * 4;
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
      ctx.fillRect(x, y, 1, 1);
    }
  }
  if (true) {
    const canvasFog = document.getElementById("mapCanvasFog");
    canvasFog.style.zoom = 0.2;
    canvasFog.setAttribute("width", CANVA_WIDTH);
    canvasFog.setAttribute("height", CANVA_HEIGHT);
    const ctxFog = canvasFog.getContext("2d");
    ctxFog.imageSmoothingEnabled = false;
    ctxFog.clearRect(0, 0, CANVA_WIDTH, CANVA_HEIGHT);
    for (let y = 0; y < CANVA_HEIGHT; y++) {
      for (let x = 0; x < CANVA_WIDTH; x++) {
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
  console.log("[map] generation finished", {
    drawn: [CWIDTH, CHEIGHT],
    grid: [finalMapArray.length, finalMapArray[0]?.length],
    sampleColors: [
      ...new Set(
        finalMapArray.slice(0, 64).map((row) => row.slice(0, 64)).flat()
      )
    ].slice(0, 20)
  });
}
async function changeValue(id, step, limit) {
  const valueSpan = document.getElementById(id + "_value");
  let currentValue = parseFloat(valueSpan.value);
  const newValue = currentValue + step;
  if (step > 0 && newValue <= limit || step < 0 && newValue >= limit) {
    valueSpan.value = newValue.toFixed(2);
  }
  await generateMap();
}
window.changeValue = changeValue;
window.generateMap = generateMap;
export {
  generateMap
};
