// caveGeneration.js
class CaveGenerator {
  constructor(menuDivId) {
    this.menuDiv = document.getElementById(menuDivId);
    this.generateMenu();
    this.x = 0;
    this.y = 0;
  }

  generateMenu() {
    this.menuDiv.innerHTML += `
            <h3>My Cave Generation</h3>
            <input type="radio" id="caveLayer" name="layer" value="cave">
            <label for="caveLayer">Cave Layer</label><br>

            <label for="caveFreq1">Zoom:</label>
            <input type="range" id="caveFreq1" min="0" max="1" step="0.05" value=".25"><br>
            <label for="caveSize">Size:</label>
            <input type="range" id="caveSize" min="0" max=".5" step="0.01" value="0.3"><br>

            <h4>Amplitude</h4>
            <label for="caveFreq3">Big:</label>
            <input type="range" id="caveAmp3" min="0" max="1" step="0.01" value="0.4"><br>
            <label for="caveFreq2">Medium:</label>
            <input type="range" id="caveAmp2" min="0" max="1" step="0.01" value="0.5"><br>

        `;
  }

  generate(canvas) {
    const seed = document.getElementById("seed").value;

    const caveFreq1 = 1.5 -
      parseFloat(document.getElementById("caveFreq1").value);

    const caveAmp2 = parseFloat(document.getElementById("caveAmp2").value);
    const caveAmp3 = parseFloat(document.getElementById("caveAmp3").value);
    const caveSize = parseFloat(document.getElementById("caveSize").value);

    const data = new Float32Array(canvas.width * canvas.height);
    const simplex = new SimplexNoise(seed);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const xx = x + this.x;
        const yy = y + this.y;
        let value =
          simplex.noise2D(xx * 0.005 * caveFreq1, yy * 0.005 * caveFreq1) *
          caveAmp2;
        value +=
          simplex.noise2D(xx * 0.0025 * caveFreq1, yy * 0.0025 * caveFreq1) *
          caveAmp3;
        value /= caveAmp2 + caveAmp3;
        
        data[y * canvas.width + x] = value >= caveSize || value < -caveSize
          ? 1
          : 0;
      }
    }
    // this.fillWater(data, canvas);
    return data;
  }
}
