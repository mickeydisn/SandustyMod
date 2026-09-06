import { perlinNoiseConfigurations } from "./configuration.js";

const GlobalDefinition = 2;

// caveGeneration.js
export class NoiseGenerator2D {
  constructor(menuDivId, name) {
    this.menuDiv = document.getElementById(menuDivId);
    this.x = 0;
    this.y = 0;

    this.name = name;

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

    this.menuDiv.querySelector(`#${this.name}_open`).addEventListener(
      "click",
      (e) => {
        this.enabled = e.target.checked;
        this.menuDiv.querySelector(`#${this.name}_contener`).style.display =
          e.target.checked ? "block" : "none";
      },
    );
  }

  generate(canvas) {
    const seed = document.getElementById("seed").value;

    for (const [k, v] of Object.entries(this.conf)) {
      if (v.type == "inputRange") {
        v.value = parseFloat(
          document.getElementById(this.name + "_" + k + "_value").value,
        );
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
        value += conf.A1.value * simplex.noise2D(
          xx * conf.F1.value * Definition,
          yy * conf.F1.value * Definition,
        );
        value += conf.A2.value * simplex.noise2D(
          xx * conf.F2.value * Definition,
          yy * conf.F2.value * Definition,
        );
        value += conf.A3.value * simplex.noise2D(
          xx * conf.F3.value * Definition,
          yy * conf.F3.value * Definition,
        );
        value += conf.A4.value * simplex.noise2D(
          xx * conf.F4.value * Definition,
          yy * conf.F4.value * Definition,
        );

        value /= conf.A1.value + conf.A2.value + conf.A3.value + conf.A4.value;

        if (
          conf.Inverse.value == 1 && y > canvas.height - conf.BottomLimit.value
        ) {
          value *= (canvas.height - y) / conf.BottomLimit.value + 0.1;
        }

        if (
          conf.Inverse.value == 0 && y > canvas.height - conf.BottomLimit.value
        ) {
          value = 1 / value;
          value *= (canvas.height - y) / conf.BottomLimit.value;
          value = 1 / value;
        }

        const tagTrue = conf.Inverse.value == 0 ? 1 : 0;
        const tagFalse = conf.Inverse.value == 0 ? 0 : 1;
        const thickness = conf.Inverse.value
          ? .5 - conf.Thickness.value
          : conf.Thickness.value;

        data[y * canvas.width + x] = value <= thickness && value >= -thickness
          ? tagTrue
          : tagFalse;
      }
    }
    // this.tagMap(data, canvas.width, canvas.height);
    return data;
  }

  tagMap(data, width, height) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;

        if (data[index] === 0) {
          // Check for floor
          if (y + 1 < height && data[(y + 1) * width + x] === 1) {
            data[index] = 2; // Floor
          } // Check for roof
          else if (y - 1 >= 0 && data[(y - 1) * width + x] === 1) {
            data[index] = 3; // Roof
          } else if (x - 1 >= 0 && data[y * width + x - 1] === 1) {
            data[index] = 4; // Wall
          } else if (x + 1 < height && data[y * width + x + 1] === 1) {
            data[index] = 4; // Wall
          }
        }
      }
    }
  }
}

export class CaveGenerator2D extends NoiseGenerator2D {
  constructor(menuDivId, name) {
    super(menuDivId, name);
  }

  init_cont() {
    return perlinNoiseConfigurations.cave.parameters;
  }
}
