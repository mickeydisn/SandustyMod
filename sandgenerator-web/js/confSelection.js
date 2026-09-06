// rockSkyGeneration.js
export class ConfSection {
  constructor(menuDivId, name, conf = {}) {
    this.menuDivId = menuDivId, this.name = name;
    this.menuDiv = document.getElementById(menuDivId);

    this.name = name;
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
      // <input type="range" id="${this.name}_${k}" min="${v.min}" max="${v.max}" step="${v.step}" value="${v.value}"><br>
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
    this.menuDiv.querySelector(`#${this.menuDivId}_contener`).style.display =
      "block";

    this.menuDiv.querySelector(`#${this.menuDivId}_open`).addEventListener(
      "click",
      (e) => {
        this.enabled = e.target.checked;
        this.menuDiv.querySelector(`#${this.menuDivId}_contener`).style
          .display = e.target.checked ? "block" : "none";
      },
    );
  }

  update() {
    for (const [k, v] of Object.entries(this.conf)) {
      if (v.type == "inputRange") {
        v.value = parseFloat(
          document.getElementById(this.menuDivId + "_" + k + "_value").value,
        );
      }
    }
    return this.conf;
  }
}
