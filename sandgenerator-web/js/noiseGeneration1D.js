import { perlinNoiseConfigurations } from "./configuration.js";

const GlobalZoom = 2;

// rockSkyGeneration.js
export class noiseGenerator1D {
  constructor(menuDivId, name) {
    this.name = name;
    this.menuDiv = document.getElementById(menuDivId);

    this.name = name;
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
      // <input type="range" id="${this.name}_${k}" min="${v.min}" max="${v.max}" step="${v.step}" value="${v.value}"><br>

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

    const data = new Int16Array(canvas.width * canvas.height);
    console.log(this.conf);
    const simplex = new SimplexNoise(seed);
    const maxAmplitude = canvas.height / 4;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        let value = 0;
        const xx = (x + this.conf.Phase.value) * GlobalZoom;

        value += (-0.5 + simplex.noise2D(xx * this.conf.F1.value, 0)) *
          this.conf.Amp.value * this.conf.A1.value * maxAmplitude;
        value += (-0.5 + simplex.noise2D(xx * this.conf.F2.value, 0)) *
          this.conf.Amp.value * this.conf.A2.value * maxAmplitude;
        value += (-0.5 + simplex.noise2D(xx * this.conf.F3.value, 0)) *
          this.conf.Amp.value * this.conf.A3.value * maxAmplitude;
        value += (-0.5 + simplex.noise2D(xx * this.conf.F4.value, 0)) *
          this.conf.Amp.value * this.conf.A4.value * maxAmplitude;

        data[y * canvas.width + x] = this.conf.BaseHeight.value + value > y
          ? 1
          : 0;
        // value * (canvas.height / 4); // Adjust amplitude
      }
    }
    return data;
  }
}
