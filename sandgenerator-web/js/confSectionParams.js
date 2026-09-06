import { itemsIdColor, itemsIdName } from "./const.js";

function colorSelector(divname, selectorConf) {
  const itemList = typeof selectorConf.value === "number"
    ? [selectorConf.value]
    : selectorConf.value;
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

// rockSkyGeneration.js
export class ConfSectionParams {
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
      // <input type="range" id="${this.name}_${k}" min="${v.min}" max="${v.max}" step="${v.step}" value="${v.value}"><br>
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
    boxDiv.querySelector(`#${confDivId}_open`).addEventListener(
      "click",
      (e) => {
        this.enabled[id] = e.target.checked;
      },
    );
  }

  update() {
    for (let k = 0; k < this.confs.length; k++) {
      const conf = this.confs[k];
      const render = this.renderParams[k];
      if (!render) continue;
      for (const v of render) {
        if (v.type === "inputRange") {
          const el = document.getElementById(
            `${this.menuDivId}_${k}_${v.id}_value`,
          );
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
}

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------

const makeDistanceFormeConfParameter = (conf) => {
  return [
    {
      id: "from",
      name: "InBorderOf",
      type: "tileSelector",
      value: conf.from,
    },
    {
      id: "replaceItem",
      name: "ReplaceBy",
      type: "tileSelector",
      value: conf.replaceItem,
    },
    {
      id: "minDis",
      type: "inputRange",
      value: conf.minDis,
      min: 0,
      max: 1000,
      step: 5,
      name: "Min Sky Distance",
    },
    {
      id: "maxDis",
      type: "inputRange",
      value: conf.maxDis,
      min: 0,
      max: 1000,
      step: 5,
      name: "Max Sky Distance",
    },
    {
      id: "growSize",
      type: "inputRange",
      value: conf.growSize,
      min: 0,
      max: 50,
      step: 1,
      name: "growSize",
    },
  ];
};

export const makeWallConfParameter = (conf) => {
  return [
    {
      id: "from",
      name: "InBorderOf",
      type: "tileSelector",
      value: conf.from,
    },
    {
      id: "inside",
      name: "TypeToReplace",
      type: "tileSelector",
      value: conf.inside,
    },
    {
      id: "replaceItem",
      name: "ReplaceBy",
      type: "tileSelector",
      value: conf.replaceItem,
    },
    {
      id: "nearMask",
      name: "Apply Wall",
      type: "fixed",
      value: conf.nearMask,
    },
    {
      id: "minDis",
      type: "inputRange",
      value: conf.minDis,
      min: 0,
      max: 1000,
      step: 5,
      name: "Min Sky Distance",
    },
    {
      id: "maxDis",
      type: "inputRange",
      value: conf.maxDis,
      min: 0,
      max: 1000,
      step: 5,
      name: "Max Sky Distance",
    },
    {
      id: "growSize",
      type: "inputRange",
      value: conf.growSize,
      min: 0,
      max: 50,
      step: 1,
      name: "growSize",
    },
  ];
};
