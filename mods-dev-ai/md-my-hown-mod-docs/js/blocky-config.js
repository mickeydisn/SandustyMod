/**
 * Blocky Config — Program only.
 *
 * Tags are the join links of a process:
 *   • define / set a tag  → step.as
 *   • if [tag]            → options.var
 * Blocks that share a tag name are one group; the tag is the wire, not free text.
 */
(function () {
  const STORE = "md-my-hown-mod-config";
  const S = () => window.MD_SCHEMA;

  const ROLE_HUE = {
    sense: 210,
    decide: 280,
    act: 0,
    remember: 145,
    feel: 45,
    connect: 175,
    logic: 30,
    block: 310,
    tag: 45,
  };


  const VALUE_ROLES = new Set(["sense", "decide", "logic"]);
  const FIELD_W = 160; // uniform Blockly field width
  function textField(def, name) {
    return new Blockly.FieldTextInput(def == null ? "" : String(def), null, { width: FIELD_W });
  }
  function numField(def) {
    const v = def !== "" && def != null ? String(def) : "0";
    return new Blockly.FieldTextInput(v, null, { width: FIELD_W });
  }


  /** Built-in content ids (common Sandustry) + config-driven catalogs */
  const BUILTIN_ELEMENTS = [
    "sand", "water", "steam", "fire", "oil", "lava", "stone", "dirt", "grass",
    "copper", "gold", "coal", "void", "air", "smoke", "ice", "seed",
  ];
  const BUILTIN_STRUCTURES = [];
  const BUILTIN_TERRAINS = ["bedrock", "stone", "dirt", "sand", "grass"];

  const OPS = [
    ["=", "eq"],
    ["≠", "ne"],
    [">", "gt"],
    ["≥", "gte"],
    ["<", "lt"],
    ["≤", "lte"],
  ];

  function contentCatalog(kind) {
    const cfg = state.config || {};
    const fromCfg = (arr) =>
      (Array.isArray(arr) ? arr : [])
        .map((x) => {
          if (!x || typeof x !== "object") return null;
          return x.id || x.path || x.key || x.name || null;
        })
        .filter(Boolean)
        .map(String);
    if (kind === "element") {
      const ids = [...new Set([...BUILTIN_ELEMENTS, ...fromCfg(cfg.elements)])];
      return ids.sort().map((id) => [id, id]);
    }
    if (kind === "structure") {
      const ids = [...new Set([...BUILTIN_STRUCTURES, ...fromCfg(cfg.structures)])];
      if (!ids.length) return [["— define in Config editor —", ""]];
      return ids.sort().map((id) => [id, id]);
    }
    if (kind === "terrain") {
      const ids = [...new Set([...BUILTIN_TERRAINS, ...fromCfg(cfg.terrains)])];
      return ids.sort().map((id) => [id, id]);
    }
    if (kind === "buffer") {
      // buffers use path or id as the content tag
      const ids = [
        ...fromCfg(cfg.buffers),
        ...(Array.isArray(cfg.buffers)
          ? cfg.buffers.map((b) => (b && b.path) || null).filter(Boolean).map(String)
          : []),
      ];
      const uniq = [...new Set(ids)];
      if (!uniq.length) return [["— define buffer in Config editor —", ""]];
      return uniq.sort().map((id) => [id, id]);
    }
    return [["—", ""]];
  }

  /** Infer content kind for a param from key/label/hint */
  function contentKindFor(pr, actionKey) {
    // Prefer explicit content kind from schema ACTION_PARAMS
    if (pr && pr.content) return pr.content;
    const k = (pr.key || "").toLowerCase();
    const h = ((pr.hint || "") + " " + (pr.label || "") + " " + (pr.type || "")).toLowerCase();
    const ak = (actionKey || "").toLowerCase();
    if (k === "path" || (ak.includes("buffer") && k === "path") || h.includes("buffer path"))
      return "buffer";
    if (h.includes("[element picker]") || h.includes("element picker")) return "element";
    if (h.includes("[structure picker]") || h.includes("structure picker")) return "structure";
    if (h.includes("[terrain picker]") || h.includes("terrain picker")) return "terrain";
    if (k === "structure" || h.includes("structure id") || h.includes("structure type"))
      return "structure";
    if (k === "terrain" || h.includes("terrain type") || h.includes("terrain id"))
      return "terrain";
    if (
      k === "element" ||
      k === "from" ||
      k === "to" ||
      k === "when" ||
      h.includes("element id") ||
      h.includes("element type")
    )
      return "element";
    return null;
  }


  const state = {
    config: null,
    editIndex: null,
    workspace: null,
    registered: false,
    /** @type {string[]} ordered tag names in this program */
    tags: [],
  };

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $$(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function processes() {
    if (!state.config.processes) state.config.processes = [];
    if (!Array.isArray(state.config.processes)) state.config.processes = [];
    return state.config.processes;
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

  function paramDefs(key) {
    const raw = (S().ACTION_PARAMS && S().ACTION_PARAMS[key]) || [];
    return raw.map((p) =>
      Array.isArray(p)
        ? { key: p[0], label: p[1], type: p[2], hint: "", def: "", required: false, options: [] }
        : p
    );
  }
  function roleOf(key) {
    return S().roleOf ? S().roleOf(key) : "act";
  }
  function isValueAction(key) {
    return VALUE_ROLES.has(roleOf(key));
  }

  /* ── Tag registry for this workspace ── */
  function collectTagsFromSteps(steps, into) {
    if (!Array.isArray(steps)) return;
    steps.forEach((s) => {
      if (!s) return;
      if (s.as) into.add(String(s.as));
      if (s.key === "if" && s.options && s.options.var) into.add(String(s.options.var));
      if (s.then) collectTagsFromSteps(s.then, into);
      if (s.else) collectTagsFromSteps(s.else, into);
    });
  }

  function syncTagsFromWorkspace(ws) {
    const names = new Set(state.tags);
    if (ws) {
      ws.getAllBlocks(false).forEach((b) => {
        if (b.type === "md_tag_set" || b.type === "md_tag_ref") {
          const t = (b.getFieldValue("TAG") || "").trim();
          if (t) names.add(t);
        }
      });
    }
    state.tags = Array.from(names).filter(Boolean).sort();
  }

  function tagDropdown() {
    const list = state.tags.length ? state.tags.slice() : ["flag"];
    const opts = list.map((t) => [t, t]);
    opts.push(["+ new tag…", "__new__"]);
    return opts;
  }

  function onTagFieldChange(newVal) {
    if (newVal === "__new__") {
      const name = window.prompt("New tag name (process variable):", "flag");
      if (!name || !name.trim()) return state.tags[0] || "flag";
      const n = name.trim().replace(/\s+/g, "_");
      if (!state.tags.includes(n)) state.tags.push(n);
      state.tags.sort();
      refreshAllTagDropdowns();
      return n;
    }
    if (newVal && !state.tags.includes(newVal)) {
      state.tags.push(newVal);
      state.tags.sort();
    }
    return newVal;
  }

  function refreshAllTagDropdowns() {
    const ws = state.workspace;
    if (!ws) return;
    const opts = tagDropdown();
    ws.getAllBlocks(false).forEach((b) => {
      const f = b.getField("TAG");
      if (!f || typeof f.menuGenerator_ === "undefined") return;
      const cur = f.getValue();
      f.menuGenerator_ = opts;
      if (cur && cur !== "__new__") {
        try {
          f.setValue(cur);
        } catch (_) {}
      }
    });
  }

  function registerBlocks() {
    if (!window.Blockly) return;
    // Re-register every mount so content tags match current config definitions
    state.registered = true;
    const schema = S();

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

    /**
     * SET TAG — joins a value block into a named tag group.
     * Export: value steps + last step gets as: tagName
     */
    Blockly.Blocks["md_tag_set"] = {
      init: function () {
        this.appendValueInput("VALUE")
          .setCheck(["Number", "Boolean", "String", "Value", "Tag"])
          .appendField("set");
        this.appendDummyInput()
          .appendField("as tag")
          .appendField(new Blockly.FieldDropdown(tagDropdown, onTagFieldChange), "TAG");
        this.setPreviousStatement(true, "Step");
        this.setNextStatement(true, "Step");
        this.setColour(ROLE_HUE.tag);
        this.setTooltip(
          "Write a value into a process tag (step.as). Every block that uses this tag name is in the same group."
        );
      },
    };

    /**
     * TAG REF — the link itself: read a tag by name (for if and other plugs).
     */
    Blockly.Blocks["md_tag_ref"] = {
      init: function () {
        this.appendDummyInput()
          .appendField("tag")
          .appendField(new Blockly.FieldDropdown(tagDropdown, onTagFieldChange), "TAG");
        this.setOutput(true, ["Tag", "Boolean", "Number", "Value"]);
        this.setColour(ROLE_HUE.tag);
        this.setTooltip("Reference a tag group. Plug into if — this is options.var.");
      },
    };

    /**
     * if [tag/value] then / else
     */
    Blockly.Blocks["md_if"] = {
      init: function () {
        this.appendValueInput("COND")
          .setCheck(["Tag", "Boolean", "Number", "String", "Value"])
          .appendField("if");
        this.appendDummyInput()
          .appendField("else?")
          .appendField(new Blockly.FieldCheckbox("FALSE"), "HAS_ELSE");
        this.appendStatementInput("THEN").setCheck("Step").appendField("then");
        this.appendStatementInput("ELSE").setCheck("Step").appendField("else");
        this.setPreviousStatement(true, "Step");
        this.setNextStatement(true, "Step");
        this.setColour(ROLE_HUE.block);
        this.setTooltip("if without else: uncheck else?. Condition plug → options.var.");
        this.setOnChange(function (ev) {
          if (!this.workspace || this.isInFlyout) return;
          const has = this.getFieldValue("HAS_ELSE") === "TRUE";
          const elseIn = this.getInput("ELSE");
          if (elseIn) elseIn.setVisible(has);
          if (!has && elseIn && elseIn.connection) {
            const t = elseIn.connection.targetBlock();
            if (t) t.dispose(false);
          }
        });
      },
    };

    /** for-each cell in range → logicForEach (write element) */
    Blockly.Blocks["md_loop"] = {
      init: function () {
        this.appendDummyInput().appendField("for each cell");
        this.appendDummyInput()
          .appendField("size")
          .appendField(numField(1), "SIZE");
        this.appendDummyInput()
          .appendField("write ⌗element")
          .appendField(new Blockly.FieldDropdown(() => contentCatalog("element")), "TO");
        this.appendDummyInput()
          .appendField("when ⌗element")
          .appendField(
            new Blockly.FieldDropdown(() => {
              const o = contentCatalog("element");
              return [["(any)", ""]].concat(o);
            }),
            "WHEN"
          );
        this.setPreviousStatement(true, "Step");
        this.setNextStatement(true, "Step");
        this.setColour(ROLE_HUE.logic);
        this.setTooltip(
          "logicForEach — writes element at every cell in range. sandkit.api.elements + grid."
        );
      },
    };

    Blockly.Blocks["md_lit_number"] = {
      init: function () {
        this.appendDummyInput().appendField(numField(0), "NUM");
        this.setOutput(true, ["Number", "Value"]);
        this.setColour(160);
      },
    };
    Blockly.Blocks["md_lit_text"] = {
      init: function () {
        this.appendDummyInput().appendField(textField(""), "TXT");
        this.setOutput(true, ["String", "Value"]);
        this.setColour(160);
      },
    };
    Blockly.Blocks["md_lit_bool"] = {
      init: function () {
        this.appendDummyInput().appendField(
          new Blockly.FieldDropdown([
            ["true", "true"],
            ["false", "false"],
          ]),
          "BOOL"
        );
        this.setOutput(true, ["Boolean", "Value"]);
        this.setColour(160);
      },
    };

    
    Blockly.Blocks["md_op"] = {
      init: function () {
        this.appendValueInput("A").setCheck(["Number", "Boolean", "String", "Value", "Tag"]);
        this.appendDummyInput().appendField(
          new Blockly.FieldDropdown(OPS.map(([label, val]) => [label, val])),
          "OP"
        );
        this.appendValueInput("B").setCheck(["Number", "Boolean", "String", "Value", "Tag"]);
        this.setInputsInline(true);
        this.setOutput(true, ["Boolean", "Number", "Value"]);
        this.setColour(ROLE_HUE.decide);
        this.setTooltip("Compare A op B → same as compare action (eq/ne/gt/gte/lt/lte).");
      },
    };


    Object.entries(schema.ACTIONS || {}).forEach(([role, keys]) => {
      keys.forEach((key) => {
        if (key === "if") return;
        const typeName = "md_act_" + key;
        const params = paramDefs(key);
        const doc = (schema.ACTION_DOCS && schema.ACTION_DOCS[key]) || key;
        const hue = ROLE_HUE[role] || 0;
        const asValue = isValueAction(key);

        Blockly.Blocks[typeName] = {
          init: function () {
            this.appendDummyInput().appendField(key);
            params.forEach((pr) => {
              if (pr.key === "var") return;
              const fname = "P_" + pr.key;
              const ck = contentKindFor(pr, key);
              if (ck) {
                const kind = ck;
                const label =
                  (pr.label || pr.key) +
                  (kind === "element"
                    ? " ⌗element"
                    : kind === "structure"
                      ? " ⌗structure"
                      : kind === "terrain"
                        ? " ⌗terrain"
                        : " ⌗buffer");
                this.appendDummyInput()
                  .appendField(label)
                  .appendField(new Blockly.FieldDropdown(() => contentCatalog(kind)), fname);
                return;
              }
              if (pr.type === "bool") {
                this.appendDummyInput()
                  .appendField(pr.label || pr.key)
                  .appendField(new Blockly.FieldCheckbox(pr.def === "true" ? "TRUE" : "FALSE"), fname);
              } else if (pr.type === "select" && pr.options && pr.options.length) {
                const opts = pr.options.map((o) => [String(o), String(o)]);
                this.appendDummyInput()
                  .appendField(pr.label || pr.key)
                  .appendField(new Blockly.FieldDropdown(opts), fname);
              } else if (pr.type === "number") {
                const defN = pr.def !== "" && pr.def != null ? Number(pr.def) : 0;
                this.appendDummyInput()
                  .appendField(pr.label || pr.key)
                  .appendField(numField(Number.isFinite(defN) ? defN : 0), fname);
              } else {
                const plug =
                  pr.key === "left" ||
                  pr.key === "right" ||
                  (pr.hint && pr.hint.indexOf("{{") >= 0);
                if (plug) {
                  this.appendValueInput("V_" + pr.key)
                    .setCheck(["Number", "Boolean", "String", "Value", "Tag"])
                    .appendField(pr.label || pr.key);
                } else {
                  this.appendDummyInput()
                    .appendField(pr.label || pr.key)
                    .appendField(textField(pr.def || ""), fname);
                }
              }
            });
            if (asValue) {
              this.setOutput(true, ["Number", "Boolean", "String", "Value"]);
            } else {
              this.setPreviousStatement(true, "Step");
              this.setNextStatement(true, "Step");
            }
            this.setColour(hue);
            const apis = (schema.ACTION_APIS && schema.ACTION_APIS[key]) || [];
            this.setTooltip(doc + (apis.length ? "\nAPI: " + apis.join(", ") : ""));
          },
        };
      });
    });
  }

  function toolboxJson() {
    const schema = S();
    const contents = [
      {
        kind: "category",
        name: "Tags",
        colour: String(ROLE_HUE.tag),
        contents: [
          { kind: "block", type: "md_tag_set" },
          { kind: "block", type: "md_tag_ref" },
        ],
      },
      {
        kind: "category",
        name: "Flow",
        colour: String(ROLE_HUE.block),
        contents: [
          { kind: "block", type: "md_if" },
          { kind: "block", type: "md_loop" },
          { kind: "block", type: "md_op" },
          { kind: "block", type: "md_lit_number" },
          { kind: "block", type: "md_lit_text" },
          { kind: "block", type: "md_lit_bool" },
        ],
      },
    ];
    Object.entries(schema.ACTIONS || {}).forEach(([role, keys]) => {
      const blocks = keys
        .filter((k) => k !== "if")
        .map((k) => ({ kind: "block", type: "md_act_" + k }));
      if (!blocks.length) return;
      contents.push({
        kind: "category",
        name: (schema.ROLE_LABELS && schema.ROLE_LABELS[role]) || role,
        colour: String(ROLE_HUE[role] || 0),
        contents: blocks,
      });
    });
    return { kind: "categoryToolbox", contents };
  }

  /* ── value block → steps + expression (tag name or literal) ── */
  function valueToSteps(block, out) {
    if (!block) return "";
    if (block.type === "md_tag_ref") {
      return (block.getFieldValue("TAG") || "").trim();
    }
    if (block.type === "md_lit_number") return String(block.getFieldValue("NUM") ?? "0");
    if (block.type === "md_lit_text") return String(block.getFieldValue("TXT") ?? "");
    if (block.type === "md_lit_bool") return String(block.getFieldValue("BOOL") ?? "false");
    if (block.type === "md_op") {
      const prior = [];
      const left = valueToSteps(block.getInputTargetBlock("A"), prior);
      const right = valueToSteps(block.getInputTargetBlock("B"), prior);
      prior.forEach((s) => out.push(s));
      const op = block.getFieldValue("OP") || "eq";
      const step = {
        key: "compare",
        options: { left: left, op: op, right: right },
      };
      const tmp = "__tmp_" + out.length;
      step.as = tmp;
      out.push(step);
      return tmp;
    }
    if (block.type.startsWith("md_act_")) {
      const step = actionToStep(block, out);
      const tmp = "__tmp_" + out.length;
      step.as = tmp;
      out.push(step);
      return tmp;
    }
    return "";
  }

  function actionToStep(block, hoist) {
    const key = block.type.slice("md_act_".length);
    const options = {};
    paramDefs(key).forEach((pr) => {
      if (pr.key === "var") return;
      const vin = block.getInput("V_" + pr.key);
      if (vin && vin.connection && vin.connection.targetBlock()) {
        const prior = [];
        const expr = valueToSteps(vin.connection.targetBlock(), prior);
        prior.forEach((s) => hoist.push(s));
        options[pr.key] = expr;
        return;
      }
      const fname = "P_" + pr.key;
      try {
        const val = block.getFieldValue(fname);
        if (val == null || val === "") return;
        if (pr.type === "bool") options[pr.key] = val === "TRUE" || val === true;
        else if (pr.type === "number") {
          const n = Number(val);
          if (!Number.isNaN(n)) options[pr.key] = n;
        } else options[pr.key] = val;
      } catch (_) {}
    });
    return { key, options };
  }

  function statementChain(block) {
    const steps = [];
    let cur = block;
    while (cur) {
      emitStatement(cur, steps);
      cur = cur.getNextBlock();
    }
    return steps;
  }

  function emitStatement(block, steps) {
    if (!block) return;

    // set [value] as tag X  → value chain with as: X
    if (block.type === "md_tag_set") {
      const tag = (block.getFieldValue("TAG") || "").trim();
      const prior = [];
      const valBlock = block.getInputTargetBlock("VALUE");
      if (valBlock && valBlock.type === "md_op") {
        const left = valueToSteps(valBlock.getInputTargetBlock("A"), prior);
        const right = valueToSteps(valBlock.getInputTargetBlock("B"), prior);
        prior.forEach((s) => steps.push(s));
        const step = {
          key: "compare",
          options: {
            left: left,
            op: valBlock.getFieldValue("OP") || "eq",
            right: right,
          },
        };
        if (tag) step.as = tag;
        steps.push(step);
      } else if (valBlock && valBlock.type.startsWith("md_act_")) {
        const step = actionToStep(valBlock, prior);
        prior.forEach((s) => steps.push(s));
        if (tag) step.as = tag;
        steps.push(step);
      } else {
        // literal or tag_ref into set — write via a noop? skip invalid
        const expr = valueToSteps(valBlock, prior);
        prior.forEach((s) => steps.push(s));
        // if only a literal, nothing to bind unless we had a setter action
        if (tag && expr && prior.length) {
          const last = prior[prior.length - 1];
          if (last) last.as = tag;
        }
      }
      if (tag && !state.tags.includes(tag)) state.tags.push(tag);
      return;
    }

    if (block.type === "md_if") {
      const prior = [];
      const cond = block.getInputTargetBlock("COND");
      let varName = "";
      if (cond && cond.type === "md_tag_ref") {
        varName = (cond.getFieldValue("TAG") || "").trim();
      } else if (cond && cond.type === "md_op") {
        const left = valueToSteps(cond.getInputTargetBlock("A"), prior);
        const right = valueToSteps(cond.getInputTargetBlock("B"), prior);
        prior.forEach((s) => steps.push(s));
        varName = "__cond_" + steps.length;
        steps.push({
          key: "compare",
          options: { left: left, op: cond.getFieldValue("OP") || "eq", right: right },
          as: varName,
        });
      } else if (cond && cond.type.startsWith("md_act_")) {
        const step = actionToStep(cond, prior);
        varName = (step.as = "__cond_" + steps.length);
        prior.forEach((s) => steps.push(s));
        steps.push(step);
      } else {
        varName = valueToSteps(cond, prior);
        prior.forEach((s) => steps.push(s));
      }
      const thenSteps = statementChain(block.getInputTargetBlock("THEN"));
      const hasElse = block.getFieldValue("HAS_ELSE") === "TRUE";
      const elseSteps = hasElse ? statementChain(block.getInputTargetBlock("ELSE")) : [];
      const ifStep = {
        key: "if",
        options: { var: varName },
        then: thenSteps,
      };
      if (hasElse && elseSteps.length) ifStep.else = elseSteps;
      else if (hasElse) ifStep.else = [];
      steps.push(ifStep);
      return;
    }

    if (block.type === "md_loop") {
      const opts = {
        size: Number(block.getFieldValue("SIZE") || 1),
        to: block.getFieldValue("TO") || "",
      };
      const when = block.getFieldValue("WHEN") || "";
      if (when) opts.when = when;
      steps.push({ key: "logicForEach", options: opts });
      return;
    }

    if (block.type.startsWith("md_act_") && !isValueAction(block.type.slice(7))) {
      const prior = [];
      const step = actionToStep(block, prior);
      prior.forEach((s) => steps.push(s));
      steps.push(step);
    }
  }

  function workspaceToSteps(ws) {
    syncTagsFromWorkspace(ws);
    const tops = ws.getTopBlocks(true);
    const roots = tops.filter((b) => b.previousConnection && !b.previousConnection.isConnected());
    const steps = [];
    roots.forEach((root) => {
      statementChain(root).forEach((s) => steps.push(s));
    });
    return steps;
  }

  /* ── Import ── */
  function stepsToWorkspace(steps, ws) {
    ws.clear();
    const tagSet = new Set();
    collectTagsFromSteps(steps, tagSet);
    state.tags = Array.from(tagSet).sort();
    if (!state.tags.length) state.tags = ["flag"];

    if (!steps || !steps.length) return;
    let prev = null;
    let y = 24;
    steps.forEach((step) => {
      const block = stepToBlock(step, ws);
      if (!block) return;
      block.moveBy(24, y);
      y += 56;
      if (prev && prev.nextConnection && block.previousConnection) {
        try {
          prev.nextConnection.connect(block.previousConnection);
        } catch (_) {}
      }
      prev = block;
    });
    refreshAllTagDropdowns();
  }

  function stepToBlock(step, ws) {
    if (!step || !step.key) return null;

    if (step.key === "if") {
      const b = ws.newBlock("md_if");
      b.initSvg();
      b.render();
      const hasElse = Array.isArray(step.else);
      try {
        b.setFieldValue(hasElse ? "TRUE" : "FALSE", "HAS_ELSE");
      } catch (_) {}
      const v = (step.options && step.options.var) || "";
      if (v) {
        if (!state.tags.includes(v)) state.tags.push(v);
        const ref = ws.newBlock("md_tag_ref");
        ref.initSvg();
        ref.render();
        try {
          ref.setFieldValue(v, "TAG");
        } catch (_) {}
        try {
          b.getInput("COND").connection.connect(ref.outputConnection);
        } catch (_) {}
      }
      attachStack(b, "THEN", step.then || [], ws);
      if (hasElse) attachStack(b, "ELSE", step.else || [], ws);
      return b;
    }
    if (step.key === "logicForEach") {
      const b = ws.newBlock("md_loop");
      b.initSvg();
      b.render();
      const o = step.options || {};
      try {
        if (o.size != null) b.setFieldValue(String(o.size), "SIZE");
        if (o.to || o.element) b.setFieldValue(String(o.to || o.element), "TO");
        if (o.when) b.setFieldValue(String(o.when), "WHEN");
      } catch (_) {}
      return b;
    }

    // Step with as → set-tag group around value action, or statement + note
    if (step.as && isValueAction(step.key)) {
      const set = ws.newBlock("md_tag_set");
      set.initSvg();
      set.render();
      if (!state.tags.includes(step.as)) state.tags.push(step.as);
      try {
        set.setFieldValue(step.as, "TAG");
      } catch (_) {}
      const val = ws.newBlock("md_act_" + step.key);
      if (Blockly.Blocks["md_act_" + step.key]) {
        val.initSvg();
        val.render();
        fillParams(val, step);
        try {
          set.getInput("VALUE").connection.connect(val.outputConnection);
        } catch (_) {}
      }
      return set;
    }

    if (step.as && !isValueAction(step.key)) {
      // Statement that also binds as — rare; emit statement then user can add set-tag
    }

    if (isValueAction(step.key)) return null; // only live inside set-tag / plugs

    const type = "md_act_" + step.key;
    if (!Blockly.Blocks[type]) return null;
    const b = ws.newBlock(type);
    b.initSvg();
    b.render();
    fillParams(b, step);
    return b;
  }

  function fillParams(b, step) {
    const opts = step.options || {};
    paramDefs(step.key).forEach((pr) => {
      if (opts[pr.key] == null || opts[pr.key] === "") return;
      const vin = b.getInput("V_" + pr.key);
      if (vin) {
        const name = String(opts[pr.key]);
        if (state.tags.includes(name) || name.match(/^_?[a-zA-Z]/)) {
          const ref = b.workspace.newBlock("md_tag_ref");
          ref.initSvg();
          ref.render();
          if (!state.tags.includes(name)) state.tags.push(name);
          try {
            ref.setFieldValue(name, "TAG");
          } catch (_) {}
          try {
            vin.connection.connect(ref.outputConnection);
          } catch (_) {}
        } else {
          const lit = b.workspace.newBlock("md_lit_text");
          lit.initSvg();
          lit.render();
          lit.setFieldValue(name, "TXT");
          try {
            vin.connection.connect(lit.outputConnection);
          } catch (_) {}
        }
        return;
      }
      const fname = "P_" + pr.key;
      try {
        if (pr.type === "bool") b.setFieldValue(opts[pr.key] ? "TRUE" : "FALSE", fname);
        else b.setFieldValue(String(opts[pr.key]), fname);
      } catch (_) {}
    });
  }

  function attachStack(parent, inputName, steps, ws) {
    let prev = null;
    (steps || []).forEach((step) => {
      const b = stepToBlock(step, ws);
      if (!b) return;
      try {
        if (!prev) parent.getInput(inputName).connection.connect(b.previousConnection);
        else prev.nextConnection.connect(b.previousConnection);
      } catch (_) {}
      prev = b;
    });
  }


  function renderTagList() {
    const el = $("#by-tag-list");
    if (el) {
      syncTagsFromWorkspace(state.workspace);
      if (!state.tags.length) {
        el.innerHTML = '<span class="ed-muted">No process tags yet</span>';
      } else {
        el.innerHTML = state.tags
          .map(
            (tg) =>
              '<button type="button" class="by-tag-chip" data-tag="' +
              escapeHtml(tg) +
              '">' +
              escapeHtml(tg) +
              "</button>"
          )
          .join("");
      }
    }
    const cl = $("#by-content-list");
    if (cl) {
      const parts = [];
      ["element", "structure", "terrain", "buffer"].forEach((kind) => {
        const opts = contentCatalog(kind)
          .map((x) => x[1])
          .filter((v) => v && !String(v).startsWith("—"));
        if (!opts.length) return;
        parts.push(
          '<div class="by-content-kind"><span class="by-content-label">⌗' +
            kind +
            "</span> " +
            opts
              .slice(0, 24)
              .map((id) => '<span class="by-tag-chip by-content-chip">' + escapeHtml(id) + "</span>")
              .join(" ") +
            (opts.length > 24 ? " …" : "") +
            "</div>"
        );
      });
      cl.innerHTML = parts.length
        ? parts.join("")
        : '<span class="ed-muted">Define elements / buffers in Config editor</span>';
    }
  }

  function disposeWs() {
    if (state.workspace) {
      try {
        state.workspace.dispose();
      } catch (_) {}
      state.workspace = null;
    }
  }

  function mountBlockly(host, steps, onChange) {
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
      zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 2, minScale: 0.35 },
      grid: { spacing: 20, length: 2, colour: "#242424", snap: true },
      renderer: "geras",
    });
    // Prefer consistent min width for statement blocks
    try {
      if (Blockly.BlockSvg) {
        Blockly.BlockSvg.MIN_WIDTH = 220;
      }
    } catch (_) {}

    try {
      stepsToWorkspace(steps || [], state.workspace);
    } catch (e) {
      console.warn(e);
    }
    renderTagList();

    state.workspace.addChangeListener((ev) => {
      if (ev.type === Blockly.Events.FINISHED_LOADING) return;
      syncTagsFromWorkspace(state.workspace);
      renderTagList();
      if (onChange) {
        try {
          onChange(workspaceToSteps(state.workspace));
        } catch (err) {
          console.warn(err);
        }
      }
    });
  }

  /* ── Program-only UI ── */
  function renderShell() {
    const root = $("#blocky-root");
    if (!root) return;
    root.innerHTML = `
      <div class="by-program-only">
        <div class="ed-toolbar">
          <div>
            <h2 class="ed-title">Blocky Config · Program</h2>
            <p class="ed-sub">Tags join groups. Operators <code>== ≥ &gt; …</code>. Content tags: element / structure / terrain / buffer from builtins + config.</p>
          </div>
          <div class="ed-side-actions">
            <button type="button" class="graph-btn" id="by-export">Export</button>
            <button type="button" class="graph-btn" id="by-import">Import</button>
            <button type="button" class="graph-btn primary" id="by-add">+ Program</button>
          </div>
        </div>
        <input type="file" id="by-file" accept="application/json,.json" hidden />
        <div id="by-main"></div>
      </div>`;

    $("#by-export")?.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state.config, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "md-my-hown-mod-config.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
    $("#by-import")?.addEventListener("click", () => $("#by-file")?.click());
    $("#by-file")?.addEventListener("change", (ev) => {
      const f = ev.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          state.config = { ...S().emptyConfig(), ...JSON.parse(String(reader.result)) };
          state.editIndex = null;
          save();
          renderMain();
        } catch (err) {
          alert("Invalid JSON: " + err.message);
        }
      };
      reader.readAsText(f);
      ev.target.value = "";
    });
    $("#by-add")?.addEventListener("click", () => {
      const list = processes();
      list.push({ id: "mdmy.process." + (list.length + 1), scope: "signal", steps: [] });
      state.editIndex = list.length - 1;
      save();
      renderMain();
    });
    renderMain();
  }

  function renderMain() {
    const main = $("#by-main");
    if (!main) return;
    const list = processes();
    if (state.editIndex != null) {
      renderEdit(main, state.editIndex);
      return;
    }
    if (!list.length) {
      main.innerHTML = `<div class="ed-empty">No programs. Click <strong>+ Program</strong>.</div>`;
      return;
    }
    main.innerHTML = `<div class="ed-cards" id="by-cards"></div>`;
    const cards = $("#by-cards");
    cards.innerHTML = list
      .map((entry, i) => {
        const n = Array.isArray(entry.steps) ? entry.steps.length : 0;
        return `<div class="ed-card">
          <div class="ed-card-body">
            <div class="ed-card-id">${escapeHtml(entry.id || "(no id)")}</div>
            <div class="ed-card-sub">${escapeHtml(entry.scope || "")} · ${n} steps</div>
          </div>
          <div class="ed-card-actions">
            <button type="button" class="graph-btn by-edit" data-i="${i}">Edit</button>
            <button type="button" class="graph-btn by-del" data-i="${i}">Del</button>
          </div>
        </div>`;
      })
      .join("");
    $$(".by-edit", cards).forEach((b) =>
      b.addEventListener("click", () => {
        state.editIndex = Number(b.dataset.i);
        renderMain();
      })
    );
    $$(".by-del", cards).forEach((b) =>
      b.addEventListener("click", () => {
        const i = Number(b.dataset.i);
        if (!confirm("Delete?")) return;
        list.splice(i, 1);
        save();
        renderMain();
      })
    );
  }

  function renderEdit(main, index) {
    const list = processes();
    const entry = list[index];
    if (!entry) {
      state.editIndex = null;
      renderMain();
      return;
    }
    if (!Array.isArray(entry.steps)) entry.steps = [];

    main.innerHTML = `
      <div class="ed-toolbar">
        <div>
          <button type="button" class="graph-btn" id="by-back">← Back</button>
          <input class="by-id-input" id="by-id" value="${escapeHtml(entry.id || "")}" />
          <select id="by-scope" class="by-scope">
            ${["signal", "trigger", "processing", "itemAction", "upgrade", "modifier"]
              .map((s) => `<option value="${s}" ${entry.scope === s ? "selected" : ""}>${s}</option>`)
              .join("")}
          </select>
        </div>
        <button type="button" class="graph-btn primary" id="by-save">Save</button>
      </div>
      <div class="by-work-row">
        <div id="by-blockly" class="by-blockly-host"></div>
        <aside class="by-tag-panel" id="by-tag-panel">
          <div class="by-tag-head">Tags</div>
          <div class="by-tag-list" id="by-tag-list"></div>
          <p class="by-tag-hint">Tags are process variables. <code>set … as tag</code> writes; <code>if [tag]</code> reads. Same name = same group.</p>
          <div class="by-tag-head" style="margin-top:12px">Content tags</div>
          <div class="by-tag-list" id="by-content-list"></div>
          <p class="by-tag-hint">From Config editor definitions + builtins. Action params use matching ⌗element / ⌗structure / ⌗terrain / ⌗buffer.</p>
          <div class="by-tag-head" style="margin-top:12px">sandkit.api</div>
          <p class="by-tag-hint">Bound to <a href="https://github.com/sandustry-modding/SandustryTypes/tree/main/src/sandkit/api" target="_blank" rel="noopener">SandustryTypes / sandkit/api</a>.</p>
        </aside>
      </div>
      <details class="ed-raw"><summary>Raw steps JSON</summary><textarea id="by-raw" rows="8"></textarea></details>`;

    $("#by-raw").value = JSON.stringify(entry.steps, null, 2);
    mountBlockly($("#by-blockly"), entry.steps, (steps) => {
      entry.steps = steps;
      $("#by-raw").value = JSON.stringify(steps, null, 2);
    });

    $("#by-back")?.addEventListener("click", () => {
      disposeWs();
      state.editIndex = null;
      renderMain();
    });
    $("#by-save")?.addEventListener("click", () => {
      const id = ($("#by-id")?.value || "").trim();
      if (id) entry.id = id;
      entry.scope = $("#by-scope")?.value || entry.scope;
      if (state.workspace) {
        try {
          entry.steps = workspaceToSteps(state.workspace);
        } catch (_) {}
      }
      list[index] = entry;
      save();
      disposeWs();
      state.editIndex = null;
      renderMain();
    });
  }

  function boot() {
    load();
    renderShell();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if ($("#blocky-root")) boot();
    });
  } else if ($("#blocky-root")) {
    boot();
  }
  window.__mdBlockyBoot = boot;
})();
