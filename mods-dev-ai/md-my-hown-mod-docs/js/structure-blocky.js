/**
 * Structure Blocky — define structures as Blockly blocks.
 * A Structure block holds property blocks; its id is the content tag ⌗structure.
 */
(function () {
  const STORE = "md-my-hown-mod-config";
  const S = () => window.MD_SCHEMA;

  const FIELD_W = 180; // same width for all value fields

  const state = {
    config: null,
    workspace: null,
    registered: false,
  };

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) {
        state.config = { ...S().emptyConfig(), ...JSON.parse(raw) };
        return;
      }
    } catch (_) {}
    state.config = S().emptyConfig();
  }
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify(state.config));
    } catch (_) {}
  }
  function structures() {
    if (!Array.isArray(state.config.structures)) state.config.structures = [];
    return state.config.structures;
  }

  function structureFields() {
    return (S().FIELDS && S().FIELDS.structures) || [
      ["id", "ID", "text", { required: true }],
      ["name", "Name", "text", {}],
    ];
  }

  /** Group fields for toolbox categories */
  function fieldGroups() {
    const all = structureFields();
    const identity = ["id", "name", "nameKey", "description", "descriptionKey", "categoryKey", "order"];
    const unlock = ["unlockNode", "hideFromBuildMenu", "alwaysUnlocked", "disallowPick", "maxPlaced"];
    const shape = ["blockGridType", "shape", "buildModes", "variants", "altOriginOffsetY", "rejectWhenBlocked"];
    const look = ["render", "drawKey", "tooltipHover"];
    const data = ["defaultData", "copyData", "registerOptions"];
    const pick = (keys) => all.filter((f) => keys.includes(f[0]));
    const used = new Set([...identity, ...unlock, ...shape, ...look, ...data]);
    const rest = all.filter((f) => !used.has(f[0]));
    return [
      { name: "Identity", colour: "160", fields: pick(identity) },
      { name: "Unlock / limits", colour: "30", fields: pick(unlock) },
      { name: "Shape / build", colour: "200", fields: pick(shape) },
      { name: "Look", colour: "280", fields: pick(look) },
      { name: "Data", colour: "120", fields: pick(data) },
      ...(rest.length ? [{ name: "Other", colour: "60", fields: rest }] : []),
    ];
  }

  function registerBlocks() {
    if (!window.Blockly) return;
    state.registered = true;

    if (!Blockly.Themes.MdBlack) {
      Blockly.Themes.MdBlack = Blockly.Theme.defineTheme("md_black", {
        base: Blockly.Themes.Classic,
        componentStyles: {
          workspaceBackgroundColour: "#090b0f",
          toolboxBackgroundColour: "#141414",
          toolboxForegroundColour: "#c4cad6",
          flyoutBackgroundColour: "#1c2127",
          flyoutForegroundColour: "#c4cad6",
          flyoutOpacity: 0.95,
          scrollbarColour: "#2e2e2e",
          insertionMarkerColour: "#ffe700",
          insertionMarkerOpacity: 0.4,
          scrollbarOpacity: 0.5,
          cursorColour: "#ffe700",
        },
        fontStyle: { family: "Inter, system-ui, sans-serif", weight: "500", size: 12 },
      });
    }

    // Container: one structure definition → content tag = id
    Blockly.Blocks["md_structure"] = {
      init: function () {
        this.appendDummyInput()
          .appendField("structure tag")
          .appendField(new Blockly.FieldTextInput("mdmy.structure.1", null, { width: FIELD_W }), "ID");
        this.appendDummyInput().appendField("(id = ⌗structure content tag)");
        this.appendStatementInput("PROPS").setCheck("StructProp").appendField("define");
        this.setColour(160);
        this.setTooltip(
          "Defines one structure. The id is the content tag used by buildStructure and pickers."
        );
        // No previous/next — each structure is a top-level card; chain optional for order
        this.setPreviousStatement(true, "Structure");
        this.setNextStatement(true, "Structure");
      },
    };

    structureFields().forEach((row) => {
      const [key, label, type, extra] = row;
      const ext = extra || {};
      if (key === "id") return; // id lives on the container
      const typeName = "md_sprop_" + key;
      Blockly.Blocks[typeName] = {
        init: function () {
          const head = this.appendDummyInput().appendField(
            (label || key).padEnd(18, "\u00a0")
          );
          if (type === "bool") {
            head.appendField(new Blockly.FieldCheckbox("FALSE"), "VAL");
          } else if (type === "select") {
            let opts = ext.options || [];
            if (typeof opts === "string") opts = S()[opts] || [];
            if (key === "categoryKey") opts = S().CATEGORIES || opts;
            const pairs = (opts.length ? opts : ["—"]).map((o) => [String(o), String(o)]);
            head.appendField(new Blockly.FieldDropdown(pairs), "VAL");
          } else if (type === "number") {
            head.appendField(
              new Blockly.FieldTextInput("0", null, { width: FIELD_W }),
              "VAL"
            );
          } else if (type === "json") {
            head.appendField(
              new Blockly.FieldTextInput("{}", null, { width: FIELD_W }),
              "VAL"
            );
            this.setTooltip((ext.hint || "JSON") + " — " + key);
          } else {
            head.appendField(
              new Blockly.FieldTextInput("", null, { width: FIELD_W }),
              "VAL"
            );
            if (ext.hint) this.setTooltip(ext.hint);
          }
          this.setPreviousStatement(true, "StructProp");
          this.setNextStatement(true, "StructProp");
          this.setColour(200);
          this.setTooltip((ext.hint || label || key) + " → structures[]." + key);
        },
      };
    });

    // Optional: link process / unlock as property shortcuts
    Blockly.Blocks["md_sprop_processRef"] = {
      init: function () {
        this.appendDummyInput()
          .appendField("process id")
          .appendField(new Blockly.FieldTextInput("", null, { width: FIELD_W }), "VAL");
        this.setPreviousStatement(true, "StructProp");
        this.setNextStatement(true, "StructProp");
        this.setColour(310);
        this.setTooltip("Stored under defaultData.processId or registerOptions (convention).");
      },
    };
  }

  function toolboxJson() {
    const contents = [
      {
        kind: "category",
        name: "Structure",
        colour: "160",
        contents: [{ kind: "block", type: "md_structure" }],
      },
    ];
    fieldGroups().forEach((g) => {
      const blocks = g.fields
        .filter((f) => f[0] !== "id")
        .map((f) => ({ kind: "block", type: "md_sprop_" + f[0] }));
      if (!blocks.length) return;
      contents.push({ kind: "category", name: g.name, colour: g.colour, contents: blocks });
    });
    contents.push({
      kind: "category",
      name: "Links",
      colour: "310",
      contents: [{ kind: "block", type: "md_sprop_processRef" }],
    });
    return { kind: "categoryToolbox", contents };
  }

  function workspaceToStructures(ws) {
    const list = [];
    const tops = ws.getTopBlocks(true).filter(
      (b) => b.type === "md_structure" && b.previousConnection && !b.previousConnection.isConnected()
    );
    // also include unconnected structures that have previousConnection connected mid-stack
    const allStruct = ws.getAllBlocks(false).filter((b) => b.type === "md_structure");
    const roots = allStruct.filter(
      (b) => !b.previousConnection || !b.previousConnection.isConnected()
    );
    roots.forEach((root) => {
      let cur = root;
      while (cur) {
        if (cur.type === "md_structure") list.push(structureBlockToObj(cur));
        cur = cur.getNextBlock();
      }
    });
    return list;
  }

  function structureBlockToObj(block) {
    const id = (block.getFieldValue("ID") || "").trim() || "mdmy.structure.unnamed";
    const obj = { id };
    let prop = block.getInputTargetBlock("PROPS");
    while (prop) {
      if (prop.type && prop.type.startsWith("md_sprop_")) {
        const key = prop.type.slice("md_sprop_".length);
        let val = prop.getFieldValue("VAL");
        const fieldDef = structureFields().find((f) => f[0] === key);
        const type = fieldDef ? fieldDef[2] : "text";
        if (type === "bool") val = val === "TRUE" || val === true;
        else if (type === "number") {
          const n = Number(val);
          val = Number.isNaN(n) ? undefined : n;
        } else if (type === "json") {
          try {
            val = JSON.parse(val);
          } catch (_) {
            /* keep string */
          }
        }
        if (key === "processRef") {
          if (!obj.defaultData || typeof obj.defaultData !== "object") obj.defaultData = {};
          if (val) obj.defaultData.processId = val;
        } else if (val !== undefined && val !== "") {
          obj[key] = val;
        }
      }
      prop = prop.getNextBlock();
    }
    return obj;
  }

  function structuresToWorkspace(list, ws) {
    ws.clear();
    let prev = null;
    let y = 24;
    (list || []).forEach((entry, i) => {
      const b = objToStructureBlock(entry, ws);
      if (!b) return;
      b.moveBy(24, y);
      y += 80;
      if (prev && prev.nextConnection && b.previousConnection) {
        try {
          prev.nextConnection.connect(b.previousConnection);
        } catch (_) {}
      }
      prev = b;
    });
  }

  function objToStructureBlock(entry, ws) {
    if (!entry) return null;
    const b = ws.newBlock("md_structure");
    b.initSvg();
    b.render();
    try {
      b.setFieldValue(String(entry.id || "mdmy.structure.1"), "ID");
    } catch (_) {}

    let prevProp = null;
    structureFields().forEach((row) => {
      const key = row[0];
      if (key === "id") return;
      if (entry[key] == null || entry[key] === "") return;
      const typeName = "md_sprop_" + key;
      if (!Blockly.Blocks[typeName]) return;
      const pb = ws.newBlock(typeName);
      pb.initSvg();
      pb.render();
      const type = row[2];
      let val = entry[key];
      try {
        if (type === "bool") pb.setFieldValue(val ? "TRUE" : "FALSE", "VAL");
        else if (type === "json")
          pb.setFieldValue(typeof val === "string" ? val : JSON.stringify(val), "VAL");
        else pb.setFieldValue(String(val), "VAL");
      } catch (_) {}
      try {
        if (!prevProp) b.getInput("PROPS").connection.connect(pb.previousConnection);
        else prevProp.nextConnection.connect(pb.previousConnection);
      } catch (_) {}
      prevProp = pb;
    });
    return b;
  }

  function disposeWs() {
    if (state.workspace) {
      try {
        state.workspace.dispose();
      } catch (_) {}
      state.workspace = null;
    }
  }

  function renderTagPanel() {
    const el = $("#st-tag-list");
    if (!el) return;
    const ids = structures()
      .map((s) => s && s.id)
      .filter(Boolean);
    if (!ids.length) {
      el.innerHTML = '<span class="ed-muted">No structure tags yet</span>';
      return;
    }
    el.innerHTML = ids
      .map(
        (id) =>
          '<span class="by-tag-chip by-content-chip" title="⌗structure">' +
          escapeHtml(id) +
          "</span>"
      )
      .join(" ");
  }

  function mount(host) {
    disposeWs();
    host.innerHTML = "";
    if (!window.Blockly) {
      host.innerHTML = '<div class="ed-empty">Blockly CDN failed to load.</div>';
      return;
    }
    registerBlocks();
    const div = document.createElement("div");
    div.className = "by-workspace by-workspace-full";
    host.appendChild(div);

    state.workspace = Blockly.inject(div, {
      toolbox: toolboxJson(),
      theme: Blockly.Themes.MdBlack,
      trashcan: true,
      scrollbars: true,
      move: { scrollbars: true, drag: true, wheel: true },
      zoom: { controls: true, wheel: true, startScale: 0.85, maxScale: 2, minScale: 0.35 },
      grid: { spacing: 20, length: 2, colour: "#242424", snap: true },
      renderer: "geras",
    });

    try {
      structuresToWorkspace(structures(), state.workspace);
    } catch (e) {
      console.warn(e);
    }

    const sync = () => {
      try {
        state.config.structures = workspaceToStructures(state.workspace);
        save();
        renderTagPanel();
        const raw = $("#st-raw");
        if (raw) raw.value = JSON.stringify(state.config.structures, null, 2);
      } catch (err) {
        console.warn(err);
      }
    };

    state.workspace.addChangeListener((ev) => {
      if (ev.type === Blockly.Events.FINISHED_LOADING) return;
      sync();
    });
    renderTagPanel();
  }

  function renderShell() {
    const root = $("#structure-blocky-root");
    if (!root) return;
    root.innerHTML = `
      <div class="by-program-only">
        <div class="ed-toolbar">
          <div>
            <h2 class="ed-title">Structure Blocky</h2>
            <p class="ed-sub">
              Each <strong>structure</strong> block is a definition. Attach property blocks under
              <em>define</em>. The structure <strong>tag (id)</strong> is the ⌗structure content tag
              used by Program actions (buildStructure, etc.).
            </p>
          </div>
          <div class="ed-side-actions">
            <button type="button" class="graph-btn" id="st-reload">Reload from config</button>
            <button type="button" class="graph-btn primary" id="st-save">Save to config</button>
          </div>
        </div>
        <div class="by-work-row">
          <div id="st-blockly" class="by-blockly-host"></div>
          <aside class="by-tag-panel">
            <div class="by-tag-head">Structure tags</div>
            <div class="by-tag-list" id="st-tag-list"></div>
            <p class="by-tag-hint">
              Tags appear in Blocky Config content dropdowns for ⌗structure parameters.
              Shared store with Config editor.
            </p>
          </aside>
        </div>
        <details class="ed-raw"><summary>structures[] JSON</summary>
          <textarea id="st-raw" rows="10"></textarea>
        </details>
      </div>`;

    $("#st-raw").value = JSON.stringify(structures(), null, 2);

    $("#st-reload")?.addEventListener("click", () => {
      load();
      mount($("#st-blockly"));
      $("#st-raw").value = JSON.stringify(structures(), null, 2);
    });
    $("#st-save")?.addEventListener("click", () => {
      if (state.workspace) {
        state.config.structures = workspaceToStructures(state.workspace);
        save();
        renderTagPanel();
        $("#st-raw").value = JSON.stringify(state.config.structures, null, 2);
      }
    });

    mount($("#st-blockly"));
  }

  function boot() {
    load();
    renderShell();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if ($("#structure-blocky-root")) boot();
    });
  } else if ($("#structure-blocky-root")) {
    boot();
  }
  window.__mdStructureBlockyBoot = boot;
})();
