/**
 * Config editor — grouped menu, exhaustive forms, visual Program steps
 * (Blockly-inspired stack + drag-and-drop, no Blockly dependency).
 */
(function () {
  const STORE = "md-my-hown-mod-config";
  const S = () => window.MD_SCHEMA;

  const state = {
    config: null,
    collection: "elements",
    editIndex: null,
    dragFrom: null,
    /** @type {Set<string>} path keys of expanded steps e.g. "0", "0.then.1" */
    openSteps: new Set(["0"]),
    /** catalog | reorder */
    dragPayload: null,
  };

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
    updateCounts();
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $$(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }
  function ensureArray(key) {
    if (!Array.isArray(state.config[key])) state.config[key] = [];
    return state.config[key];
  }
  function collectionMeta(key) {
    for (const g of S().MENU_GROUPS) {
      const hit = g.items.find((i) => i.key === key);
      if (hit) return hit;
    }
    return { key, label: key, color: "#888" };
  }
  function currentEntry() {
    return ensureArray(state.collection)[state.editIndex];
  }
  function syncRaw(entry) {
    const ta = $("#ed-raw");
    if (ta && entry) ta.value = JSON.stringify(entry, null, 2);
  }

  function updateCounts() {
    $$(".ed-col").forEach((btn) => {
      const key = btn.dataset.col;
      const n = (state.config[key] || []).length;
      const badge = btn.querySelector(".ed-count");
      if (badge) badge.textContent = n ? String(n) : "";
    });
  }

  function renderShell() {
    const root = $("#editor-root");
    if (!root) return;
    root.innerHTML = `
      <div class="ed-layout">
        <aside class="ed-side">
          <div class="ed-side-head">
            <span>Collections</span>
            <div class="ed-side-actions">
              <button type="button" class="graph-btn" id="ed-import">Import</button>
              <button type="button" class="graph-btn" id="ed-export">Export</button>
              <button type="button" class="graph-btn" id="ed-clear">Clear</button>
            </div>
          </div>
          <div class="ed-cols" id="ed-cols"></div>
          <input type="file" id="ed-file" accept="application/json,.json" hidden />
        </aside>
        <div class="ed-main" id="ed-main"></div>
      </div>`;

    const cols = $("#ed-cols");
    S().MENU_GROUPS.forEach((g) => {
      const gh = document.createElement("div");
      gh.className = "ed-group-title";
      gh.textContent = g.label;
      gh.title = g.hint || "";
      cols.appendChild(gh);
      g.items.forEach((c) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ed-col" + (c.key === state.collection ? " on" : "");
        btn.dataset.col = c.key;
        btn.innerHTML = `<span class="ed-dot" style="background:${c.color}"></span>
          <span class="ed-col-label">${escapeHtml(c.label)}</span>
          <span class="ed-count"></span>`;
        btn.addEventListener("click", () => {
          state.collection = c.key;
          state.editIndex = null;
          $$(".ed-col").forEach((b) => b.classList.toggle("on", b.dataset.col === state.collection));
          renderMain();
        });
        cols.appendChild(btn);
      });
    });

    $("#ed-export")?.addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state.config, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "md-my-hown-mod-config.json";
      a.click();
      URL.revokeObjectURL(a.href);
    });
    $("#ed-import")?.addEventListener("click", () => $("#ed-file")?.click());
    $("#ed-file")?.addEventListener("change", (ev) => {
      const f = ev.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          state.config = { ...S().emptyConfig(), ...JSON.parse(String(reader.result)) };
          state.editIndex = null;
          save();
          renderMain();
        } catch (e) {
          alert("Invalid JSON: " + e.message);
        }
      };
      reader.readAsText(f);
      ev.target.value = "";
    });
    $("#ed-clear")?.addEventListener("click", () => {
      if (!confirm("Reset all collections to empty?")) return;
      state.config = S().emptyConfig();
      state.editIndex = null;
      save();
      renderMain();
    });

    updateCounts();
    renderMain();
  }

  function renderMain() {
    const main = $("#ed-main");
    if (!main) return;
    const key = state.collection;
    const list = ensureArray(key);
    const meta = collectionMeta(key);

    if (state.editIndex != null) {
      renderForm(main, key, state.editIndex, meta);
      return;
    }

    main.innerHTML = `
      <div class="ed-toolbar">
        <div>
          <h2 class="ed-title">${escapeHtml(meta.label)}</h2>
          <p class="ed-sub">${list.length} entr${list.length === 1 ? "y" : "ies"} · <code>${escapeHtml(key)}</code></p>
        </div>
        <button type="button" class="graph-btn primary" id="ed-add">+ Add</button>
      </div>
      <div class="ed-cards" id="ed-cards"></div>`;

    $("#ed-add")?.addEventListener("click", () => {
      const blank = { id: "mdmy." + key.replace(/s$/, "") + "." + (list.length + 1) };
      if (key === "processes") {
        blank.scope = "signal";
        blank.steps = [];
      }
      if (key === "recipes") blank.kind = "structure";
      if (key === "signals") blank.kind = "targets";
      if (key === "modifiers") {
        blank.kind = "intercept";
        blank.enabled = true;
      }
      if (key === "elements") blank.matterType = "Solid";
      list.push(blank);
      state.editIndex = list.length - 1;
      save();
      renderMain();
    });

    const cards = $("#ed-cards");
    if (!list.length) {
      cards.innerHTML = `<div class="ed-empty">No entries. Click <strong>+ Add</strong>.</div>`;
      return;
    }
    cards.innerHTML = list
      .map((entry, i) => {
        const id = entry.id || "(no id)";
        const sub =
          entry.name || entry.scope || entry.kind || entry.handlerKey ||
          entry.processId || entry.structureType || entry.structureId || entry.hookId || "";
        const stepsN = Array.isArray(entry.steps) ? entry.steps.length : null;
        return `<div class="ed-card" data-i="${i}">
          <div class="ed-card-body">
            <div class="ed-card-id">${escapeHtml(id)}</div>
            <div class="ed-card-sub">${escapeHtml(String(sub))}${
              stepsN != null ? ` · ${stepsN} step${stepsN === 1 ? "" : "s"}` : ""
            }</div>
          </div>
          <div class="ed-card-actions">
            <button type="button" class="graph-btn ed-edit" data-i="${i}">Edit</button>
            <button type="button" class="graph-btn ed-del" data-i="${i}">Del</button>
          </div>
        </div>`;
      })
      .join("");

    $$(".ed-edit", cards).forEach((b) => {
      b.addEventListener("click", () => {
        state.editIndex = Number(b.dataset.i);
        renderMain();
      });
    });
    $$(".ed-del", cards).forEach((b) => {
      b.addEventListener("click", () => {
        const i = Number(b.dataset.i);
        if (!confirm("Delete " + (list[i]?.id || i) + "?")) return;
        list.splice(i, 1);
        save();
        renderMain();
      });
    });
  }


  function renderSectionedForm(collection, fields, entry) {
    const secMap = (S().FIELD_SECTIONS && S().FIELD_SECTIONS[collection]) || {};
    const order = (S().SECTION_ORDER && S().SECTION_ORDER[collection]) || [];
    const groups = {};
    fields.forEach((row) => {
      const k = row[0];
      const sec = secMap[k] || (k === "id" ? "Identity" : "Other");
      if (!groups[sec]) groups[sec] = [];
      groups[sec].push(row);
    });
    const seen = new Set();
    const seq = [];
    order.forEach((s) => {
      if (groups[s] && groups[s].length) {
        seq.push(s);
        seen.add(s);
      }
    });
    Object.keys(groups).forEach((s) => {
      if (!seen.has(s)) seq.push(s);
    });
    // Identity open by default; others collapsed
    return seq
      .map((sec, i) => {
        const rows = groups[sec] || [];
        const body = rows
          .map(([k, label, type, extra]) => fieldControl(k, label, type, extra, entry[k]))
          .join("");
        const open = sec === "Identity" || i === 0 ? " open" : "";
        return (
          '<details class="ed-section"' +
          open +
          "><summary class=\"ed-section-sum\">" +
          escapeHtml(sec) +
          ' <span class="ed-section-count">' +
          rows.length +
          "</span></summary><div class=\"ed-section-body\">" +
          body +
          "</div></details>"
        );
      })
      .join("");
  }

  function fieldControl(k, label, type, extra, value) {
    extra = extra || {};
    if (type === "bool") {
      return `<label class="ed-field"><span>${escapeHtml(label)}</span>
        <input type="checkbox" data-k="${k}" ${value ? "checked" : ""} /></label>`;
    }
    if (type === "select") {
      let opts = extra.options || [];
      if (typeof opts === "string") opts = S()[opts] || [];
      const options = opts
        .map((o) => `<option value="${escapeAttr(o)}" ${String(value) === o ? "selected" : ""}>${escapeHtml(o)}</option>`)
        .join("");
      return `<label class="ed-field"><span>${escapeHtml(label)}${extra.required ? " *" : ""}</span>
        <select data-k="${k}"><option value="">—</option>${options}</select></label>`;
    }
    if (type === "json") {
      const text = value == null ? "" : typeof value === "string" ? value : JSON.stringify(value, null, 2);
      return `<label class="ed-field ed-field-wide"><span>${escapeHtml(label)}${extra.required ? " *" : ""}</span>
        <textarea data-k="${k}" data-json="1" rows="3" placeholder="${escapeAttr(extra.hint || "JSON")}">${escapeHtml(text)}</textarea></label>`;
    }
    return `<label class="ed-field"><span>${escapeHtml(label)}${extra.required ? " *" : ""}</span>
      <input type="${type === "number" ? "number" : "text"}" data-k="${k}" value="${escapeAttr(
        value == null ? "" : String(value)
      )}" placeholder="${escapeAttr(extra.hint || "")}" /></label>`;
  }

  function readFormInto(entry, form) {
    $$("[data-k]", form).forEach((el) => {
      const k = el.dataset.k;
      if (el.type === "checkbox") entry[k] = el.checked;
      else if (el.dataset.json) {
        const raw = el.value.trim();
        if (!raw) delete entry[k];
        else {
          try {
            entry[k] = JSON.parse(raw);
          } catch {
            entry[k] = raw;
          }
        }
      } else if (el.type === "number") {
        if (el.value === "") delete entry[k];
        else {
          const n = Number(el.value);
          if (!Number.isNaN(n)) entry[k] = n;
        }
      } else {
        const v = el.value.trim();
        if (v) entry[k] = v;
        else delete entry[k];
      }
    });
  }


  function renderForm(main, key, index, meta) {
    const list = ensureArray(key);
    const entry = list[index];
    if (!entry) {
      state.editIndex = null;
      renderMain();
      return;
    }
    const fields = S().FIELDS[key] || [["id", "ID", "text", { required: true }]];
    const isProcess = key === "processes";

    main.innerHTML = `
      <div class="ed-toolbar">
        <div>
          <button type="button" class="graph-btn" id="ed-back">← Back</button>
          <h2 class="ed-title" style="display:inline;margin-left:10px">${escapeHtml(meta.label)}</h2>
        </div>
        <button type="button" class="graph-btn primary" id="ed-save">Save</button>
      </div>
      <div class="ed-form" id="ed-form"></div>
      ${
        isProcess
          ? `<div class="ed-program-layout" id="ed-program">
              <div class="ed-program">
                <details class="ed-section" open>
                  <summary class="ed-section-sum">Steps <span class="ed-section-count" id="ed-step-count">0</span></summary>
                  <div class="ed-section-body ed-program-body">
                    <p class="ed-muted" style="margin:0">Drag actions from the catalog → drop here. Drag steps to reorder. Action type is fixed.</p>
                    <div id="ed-blocks" class="ed-program-steps"></div>
                  </div>
                </details>
                <details class="ed-section">
                  <summary class="ed-section-sum">Process tags <span class="ed-section-count" id="ed-tag-count">0</span></summary>
                  <div class="ed-section-body" id="ed-tag-list"></div>
                </details>
              </div>
              <aside class="ed-catalog" id="ed-catalog"></aside>
            </div>`
          : ""
      }
      <details class="ed-raw"><summary>Raw JSON</summary><textarea id="ed-raw" rows="12"></textarea></details>`;

    const form = $("#ed-form");
    form.innerHTML = renderSectionedForm(key, fields, entry);
    $("#ed-raw").value = JSON.stringify(entry, null, 2);

    $("#ed-back")?.addEventListener("click", () => {
      state.editIndex = null;
      state.openSteps = new Set(["0"]);
      renderMain();
    });
    $("#ed-save")?.addEventListener("click", () => {
      readFormInto(entry, form);
      try {
        const raw = JSON.parse($("#ed-raw").value);
        const steps = entry.steps;
        Object.keys(entry).forEach((k) => delete entry[k]);
        Object.assign(entry, raw);
        if (isProcess && Array.isArray(steps)) entry.steps = steps;
      } catch (_) {}
      list[index] = entry;
      save();
      state.editIndex = null;
      renderMain();
    });

    if (isProcess) {
      if (!Array.isArray(entry.steps)) entry.steps = [];
      renderProgramSteps(entry);
      renderActionCatalog(entry);
      wireProgramDropZone(entry);
    }
  }

  function collectTags(steps, into) {
    if (!Array.isArray(steps)) return;
    steps.forEach((s) => {
      if (!s) return;
      if (s.as) into.add(String(s.as));
      if (s.key === "if" && s.options && s.options.var) into.add(String(s.options.var));
      if (s.then) collectTags(s.then, into);
      if (s.else) collectTags(s.else, into);
    });
  }

  function contentOptions(kind) {
    const cfg = state.config || {};
    const from = (arr) =>
      (Array.isArray(arr) ? arr : [])
        .map((x) => (x && (x.id || x.path || x.key || x.name)) || null)
        .filter(Boolean)
        .map(String);
    const builtins = {
      element: ["sand", "water", "steam", "fire", "oil", "lava", "stone", "dirt", "grass", "copper", "gold", "coal"],
      terrain: ["bedrock", "stone", "dirt", "sand", "grass"],
      structure: [],
      buffer: [],
    };
    if (kind === "element") return [...new Set([...(builtins.element || []), ...from(cfg.elements)])].sort();
    if (kind === "structure") return [...new Set([...from(cfg.structures)])].sort();
    if (kind === "terrain") return [...new Set([...(builtins.terrain || []), ...from(cfg.terrains)])].sort();
    if (kind === "buffer") return [...new Set([...from(cfg.buffers)])].sort();
    return [];
  }

  function contentKind(pr, actionKey) {
    if (pr && pr.content) return pr.content;
    const k = (pr.key || "").toLowerCase();
    const h = ((pr.hint || "") + " " + (pr.label || "")).toLowerCase();
    const ak = (actionKey || "").toLowerCase();
    if (k === "path" || (ak.includes("buffer") && k === "path")) return "buffer";
    if (k === "structure" || h.includes("structure")) return "structure";
    if (k === "terrain" || h.includes("terrain")) return "terrain";
    if (k === "element" || k === "from" || k === "to" || k === "when" || h.includes("element")) return "element";
    return null;
  }

  function stepPathKey(path) {
    return path.join(".");
  }

  function formatStepSummary(step) {
    const bits = [];
    if (step.key === "if") {
      if (step.options && step.options.var) bits.push("var=" + step.options.var);
      const nt = Array.isArray(step.then) ? step.then.length : 0;
      const ne = Array.isArray(step.else) ? step.else.length : 0;
      if (nt) bits.push("then:" + nt);
      if (ne) bits.push("else:" + ne);
    } else {
      if (step.as) bits.push("as " + step.as);
      const opts = step.options || {};
      Object.keys(opts)
        .sort()
        .forEach((k) => {
          const v = opts[k];
          if (v == null || v === "") return;
          if (typeof v === "boolean") {
            if (v) bits.push(k);
            return;
          }
          if (typeof v === "object") {
            bits.push(k + "={…}");
            return;
          }
          const s = String(v);
          bits.push(k + "=" + (s.length > 24 ? s.slice(0, 22) + "…" : s));
        });
    }
    return bits.length ? bits.join(" · ") : "";
  }


  function renderActionCatalog(entry) {
    const host = $("#ed-catalog");
    if (!host) return;
    const families = S().ACTION_FAMILIES || {};
    const famKeys = Object.keys(families);
    // fallback by role if no families
    let html = '<div class="ed-catalog-head">Action catalog</div>';
    if (famKeys.length) {
      famKeys.forEach((fk, i) => {
        const fam = families[fk];
        const title = (fam.title || fk).split("—")[0].trim();
        const open = i < 2 ? " open" : "";
        html +=
          '<details class="ed-catalog-fam"' +
          open +
          "><summary>" +
          escapeHtml(title) +
          ' <span class="ed-muted">(' +
          (fam.keys || []).length +
          ")</span></summary><div class=\"ed-catalog-list\">";
        (fam.keys || []).forEach((key) => {
          const doc = ((S().ACTION_DOCS && S().ACTION_DOCS[key]) || "").slice(0, 80);
          html +=
            '<div class="ed-catalog-item" draggable="true" data-action="' +
            escapeAttr(key) +
            '" title="' +
            escapeAttr(doc) +
            '">' +
            escapeHtml(key) +
            "</div>";
        });
        html += "</div></details>";
      });
    } else {
      const acts = S().ACTIONS || {};
      Object.keys(acts).forEach((role) => {
        html +=
          '<details class="ed-catalog-fam" open><summary>' +
          escapeHtml(role) +
          '</summary><div class="ed-catalog-list">';
        (acts[role] || []).forEach((key) => {
          html +=
            '<div class="ed-catalog-item" draggable="true" data-action="' +
            escapeAttr(key) +
            '">' +
            escapeHtml(key) +
            "</div>";
        });
        html += "</div></details>";
      });
    }
    // if block
    html +=
      '<details class="ed-catalog-fam"><summary>Control</summary><div class="ed-catalog-list">' +
      '<div class="ed-catalog-item" draggable="true" data-action="if">if</div></div></details>';
    host.innerHTML = html;

    host.querySelectorAll(".ed-catalog-item").forEach((el) => {
      el.addEventListener("dragstart", (ev) => {
        const key = el.getAttribute("data-action");
        state.dragPayload = { type: "catalog", action: key };
        ev.dataTransfer.setData("text/plain", "catalog:" + key);
        ev.dataTransfer.effectAllowed = "copy";
      });
      el.addEventListener("dragend", () => {
        state.dragPayload = null;
      });
    });
  }

  function wireProgramDropZone(entry) {
    const host = $("#ed-blocks");
    if (!host || host.dataset.dropWired) return;
    host.dataset.dropWired = "1";
    host.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      host.classList.add("ed-drop-target");
      if (state.dragPayload && state.dragPayload.type === "catalog") {
        ev.dataTransfer.dropEffect = "copy";
      } else {
        ev.dataTransfer.dropEffect = "move";
      }
    });
    host.addEventListener("dragleave", () => host.classList.remove("ed-drop-target"));
    host.addEventListener("drop", (ev) => {
      ev.preventDefault();
      host.classList.remove("ed-drop-target");
      const p = state.dragPayload;
      if (!p) return;
      if (p.type === "catalog" && p.action) {
        const step = { key: p.action, options: {} };
        if (p.action === "if") {
          step.options = { var: "" };
          step.then = [];
          step.else = [];
        }
        let insertAt = entry.steps.length;
        // if over a step, insert before it
        const over = ev.target.closest(".ed-step-section");
        if (over && over.dataset.stepIndex != null && over.dataset.branchPath == null) {
          insertAt = Number(over.dataset.stepIndex);
        }
        entry.steps.splice(insertAt, 0, step);
        state.openSteps.add(String(insertAt));
        state.dragPayload = null;
        renderProgramSteps(entry);
        return;
      }
      if (p.type === "reorder" && Array.isArray(p.fromPath)) {
        // handled on step drop
      }
      state.dragPayload = null;
    });
  }

  function renderProgramSteps(entry) {
    const host = $("#ed-blocks");
    if (!host) return;
    const steps = entry.steps;
    const tags = new Set();
    collectTags(steps, tags);
    const tc = $("#ed-tag-count");
    if (tc) tc.textContent = String(tags.size);
    const sc = $("#ed-step-count");
    if (sc) sc.textContent = String(steps.length);
    const tl = $("#ed-tag-list");
    if (tl) {
      tl.innerHTML = tags.size
        ? [...tags]
            .sort()
            .map((t) => '<span class="by-tag-chip">' + escapeHtml(t) + "</span>")
            .join(" ")
        : '<span class="ed-muted">No tags yet — set <code>as</code> on a step or use if var</span>';
    }
    host.innerHTML = "";
    if (!steps.length) {
      host.innerHTML = '<div class="ed-empty">No steps. Click <strong>+ Step</strong>.</div>';
      syncRaw(entry);
      return;
    }
    steps.forEach((step, i) => {
      host.appendChild(stepSection(step, steps, i, 0, entry, [i]));
    });
    syncRaw(entry);
  }

  function actionOptions() {
    const acts = S().ACTIONS || {};
    const opts = [];
    Object.keys(acts)
      .sort()
      .forEach((role) => {
        (acts[role] || []).forEach((k) => opts.push({ role, key: k }));
      });
    if (!opts.find((o) => o.key === "if")) opts.push({ role: "block", key: "if" });
    return opts;
  }

  function stepSection(step, arr, index, depth, entry, path) {
    if (!step.options || typeof step.options !== "object") step.options = {};
    const wrap = document.createElement("details");
    wrap.className = "ed-section ed-step-section";
    const pathKey = stepPathKey(path || [index]);
    wrap.open = state.openSteps.has(pathKey);
    wrap.addEventListener("toggle", () => {
      if (wrap.open) state.openSteps.add(pathKey);
      else state.openSteps.delete(pathKey);
      // refresh closed summary without full re-render of other open steps
      const sumBits = wrap.querySelector(".ed-step-cfg");
      if (sumBits) sumBits.textContent = wrap.open ? "" : formatStepSummary(step);
    });

    const sum = document.createElement("summary");
    sum.className = "ed-section-sum ed-step-sum";
    wrap.dataset.stepIndex = String(index);
    wrap.draggable = true;
    wrap.addEventListener("dragstart", (ev) => {
      // don't start drag from interactive controls
      if (ev.target.closest("button, input, select, textarea, label")) {
        ev.preventDefault();
        return;
      }
      state.dragPayload = { type: "reorder", fromPath: path.slice(), fromArr: arr, fromIndex: index };
      wrap.classList.add("ed-dragging");
      ev.dataTransfer.setData("text/plain", "reorder:" + pathKey);
      ev.dataTransfer.effectAllowed = "move";
    });
    wrap.addEventListener("dragend", () => {
      wrap.classList.remove("ed-dragging");
      $$(".ed-drag-over").forEach((el) => el.classList.remove("ed-drag-over"));
      state.dragPayload = null;
    });
    wrap.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      wrap.classList.add("ed-drag-over");
    });
    wrap.addEventListener("dragleave", () => wrap.classList.remove("ed-drag-over"));
    wrap.addEventListener("drop", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      wrap.classList.remove("ed-drag-over");
      const p = state.dragPayload;
      if (!p) return;
      if (p.type === "catalog" && p.action) {
        const stepNew = { key: p.action, options: {} };
        if (p.action === "if") {
          stepNew.options = { var: "" };
          stepNew.then = [];
          stepNew.else = [];
        }
        arr.splice(index, 0, stepNew);
        state.openSteps.add(stepPathKey(path));
        state.dragPayload = null;
        renderProgramSteps(entry);
        return;
      }
      if (p.type === "reorder" && p.fromArr === arr) {
        const from = p.fromIndex;
        let to = index;
        if (from === to) return;
        const [moved] = arr.splice(from, 1);
        if (from < to) to -= 1;
        arr.splice(to, 0, moved);
        state.dragPayload = null;
        renderProgramSteps(entry);
      }
    });

    const left = document.createElement("span");
    left.className = "ed-step-sum-left";
    left.innerHTML =
      '<span class="ed-step-grip" title="Drag to reorder">⋮⋮</span><span class="ed-step-idx">' +
      (index + 1) +
      "</span> <code>" +
      escapeHtml(step.key || "?") +
      "</code>";
    const cfg = document.createElement("span");
    cfg.className = "ed-step-cfg";
    if (!wrap.open) cfg.textContent = formatStepSummary(step);
    left.appendChild(cfg);
    sum.appendChild(left);

    const actions = document.createElement("span");
    actions.className = "ed-step-actions";
    actions.innerHTML =
      '<button type="button" class="graph-btn ed-step-up" title="Move up">↑</button>' +
      '<button type="button" class="graph-btn ed-step-dn" title="Move down">↓</button>' +
      '<button type="button" class="graph-btn ed-step-del" title="Delete">×</button>';
    sum.appendChild(actions);

    // Prevent summary toggle when clicking buttons
    actions.addEventListener("click", (e) => e.preventDefault());

    wrap.appendChild(sum);

    const body = document.createElement("div");
    body.className = "ed-section-body ed-step-body";

    // Fixed action type — only "as" is editable in the head
    const head = document.createElement("div");
    head.className = "ed-step-head";
    const typeLab = document.createElement("div");
    typeLab.className = "ed-field";
    typeLab.innerHTML =
      "<span>Action</span><div><code>" + escapeHtml(step.key || "?") + "</code></div>";
    head.appendChild(typeLab);

    if (step.key !== "if") {
      const asLab = document.createElement("label");
      asLab.className = "ed-field";
      asLab.innerHTML = "<span>Store as tag</span>";
      const asInp = document.createElement("input");
      asInp.type = "text";
      asInp.placeholder = "process tag name";
      asInp.value = step.as || "";
      asInp.addEventListener("change", () => {
        const v = asInp.value.trim();
        if (v) step.as = v;
        else delete step.as;
        state.openSteps.add(pathKey);
        renderProgramSteps(entry);
      });
      asLab.appendChild(asInp);
      head.appendChild(asLab);
    }
    body.appendChild(head);

    // Doc
    const doc = (S().ACTION_DOCS && S().ACTION_DOCS[step.key]) || "";
    const apis = (S().ACTION_APIS && S().ACTION_APIS[step.key]) || [];
    if (doc || apis.length) {
      const docEl = document.createElement("p");
      docEl.className = "ed-step-doc";
      docEl.textContent = doc;
      if (apis.length) {
        docEl.innerHTML +=
          '<br/><span class="ed-muted">API: ' +
          apis.map((a) => "<code>" + escapeHtml(a) + "</code>").join(" ") +
          "</span>";
      }
      body.appendChild(docEl);
    }

    if (step.key === "if") {
      const varLab = document.createElement("label");
      varLab.className = "ed-field ed-field-wide";
      varLab.innerHTML = "<span>When tag is true</span>";
      const varSel = document.createElement("select");
      const tags = new Set();
      collectTags(entry.steps, tags);
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "— select tag —";
      varSel.appendChild(empty);
      [...tags].sort().forEach((tg) => {
        const o = document.createElement("option");
        o.value = tg;
        o.textContent = tg;
        if (String(step.options.var) === tg) o.selected = true;
        varSel.appendChild(o);
      });
      // allow free text via extra option
      const custom = document.createElement("option");
      custom.value = "__custom__";
      custom.textContent = "custom…";
      varSel.appendChild(custom);
      varSel.addEventListener("change", () => {
        if (varSel.value === "__custom__") {
          const v = prompt("Tag name", step.options.var || "");
          if (v) step.options.var = v.trim();
        } else {
          step.options.var = varSel.value;
        }
        renderProgramSteps(entry);
      });
      varLab.appendChild(varSel);
      body.appendChild(varLab);

      if (!Array.isArray(step.then)) step.then = [];
      if (!Array.isArray(step.else)) step.else = [];
      body.appendChild(branchSection("then", step.then, entry, step, path));
      body.appendChild(branchSection("else", step.else, entry, step, path));
    } else {
      const defs = paramDefs(step.key);
      const grid = document.createElement("div");
      grid.className = "ed-step-params";
      if (!defs.length) {
        grid.innerHTML = '<span class="ed-muted">No parameters</span>';
      } else {
        defs.forEach((pr) => grid.appendChild(paramField(step, pr, entry)));
      }
      body.appendChild(grid);
    }

    wrap.appendChild(body);

    // Move / delete
    actions.querySelector(".ed-step-up")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (index <= 0) return;
      const tmp = arr[index - 1];
      arr[index - 1] = arr[index];
      arr[index] = tmp;
      renderProgramSteps(entry);
    });
    actions.querySelector(".ed-step-dn")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (index >= arr.length - 1) return;
      const tmp = arr[index + 1];
      arr[index + 1] = arr[index];
      arr[index] = tmp;
      renderProgramSteps(entry);
    });
    actions.querySelector(".ed-step-del")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!confirm("Delete step " + (step.key || index) + "?")) return;
      arr.splice(index, 1);
      renderProgramSteps(entry);
    });

    return wrap;
  }

  function branchSection(label, steps, entry, parentStep, parentPath) {
    const d = document.createElement("details");
    d.className = "ed-section ed-branch";
    d.open = steps.length > 0;
    const sum = document.createElement("summary");
    sum.className = "ed-section-sum";
    sum.innerHTML =
      escapeHtml(label) +
      ' <span class="ed-section-count">' +
      steps.length +
      "</span>";
    d.appendChild(sum);
    const body = document.createElement("div");
    body.className = "ed-section-body ed-program-body";
    const list = document.createElement("div");
    list.className = "ed-program-steps";
    list.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      list.classList.add("ed-drop-target");
    });
    list.addEventListener("dragleave", () => list.classList.remove("ed-drop-target"));
    list.addEventListener("drop", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      list.classList.remove("ed-drop-target");
      const p = state.dragPayload;
      if (p && p.type === "catalog" && p.action) {
        const stepNew = { key: p.action, options: {} };
        if (p.action === "if") {
          stepNew.options = { var: "" };
          stepNew.then = [];
          stepNew.else = [];
        }
        steps.push(stepNew);
        state.openSteps.add(stepPathKey((parentPath || []).concat([label, steps.length - 1])));
        state.dragPayload = null;
        renderProgramSteps(entry);
      }
    });
    steps.forEach((s, i) => {
      const childPath = (parentPath || []).concat([label, i]);
      list.appendChild(stepSection(s, steps, i, 1, entry, childPath));
    });
    body.appendChild(list);
    d.appendChild(body);
    return d;
  }

  /** Normalize ACTION_PARAMS entry to object shape */
  function paramDefs(actionKey) {
    const raw = (S().ACTION_PARAMS && S().ACTION_PARAMS[actionKey]) || [];
    return raw.map((p) =>
      Array.isArray(p)
        ? { key: p[0], label: p[1], type: p[2], hint: "", def: "", required: false, options: [], content: null }
        : p
    );
  }

  function paramField(step, pr, entry) {
    const lab = document.createElement("label");
    lab.className = "ed-field";
    const title = document.createElement("span");
    const ck = contentKind(pr, step.key);
    title.innerHTML =
      escapeHtml(pr.label || pr.key) +
      (pr.required ? " *" : "") +
      (ck ? ' <span class="ed-muted">⌗' + ck + "</span>" : "");
    lab.appendChild(title);

    let input;
    const cur = step.options[pr.key];

    if (ck) {
      input = document.createElement("select");
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "—";
      input.appendChild(empty);
      contentOptions(ck).forEach((id) => {
        const o = document.createElement("option");
        o.value = id;
        o.textContent = id;
        input.appendChild(o);
      });
      if (cur != null && cur !== "") {
        const v = String(cur);
        if (![...input.options].some((o) => o.value === v)) {
          const o = document.createElement("option");
          o.value = v;
          o.textContent = v + " (custom)";
          input.appendChild(o);
        }
        input.value = v;
      }
      input.addEventListener("change", () => {
        if (input.value === "") delete step.options[pr.key];
        else step.options[pr.key] = input.value;
        if (entry) syncRaw(entry);
      });
    } else if (pr.type === "bool") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = cur != null ? !!cur : pr.def === "true";
      input.addEventListener("change", () => {
        step.options[pr.key] = input.checked;
        if (entry) syncRaw(entry);
      });
    } else if (pr.type === "select" && pr.options && pr.options.length) {
      input = document.createElement("select");
      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "—";
      input.appendChild(empty);
      pr.options.forEach((o) => {
        const opt = document.createElement("option");
        opt.value = o;
        opt.textContent = o;
        input.appendChild(opt);
      });
      input.value = cur != null ? String(cur) : pr.def || "";
      input.addEventListener("change", () => {
        if (input.value === "") delete step.options[pr.key];
        else step.options[pr.key] = input.value;
        if (entry) syncRaw(entry);
      });
    } else if (pr.type === "json") {
      input = document.createElement("textarea");
      input.rows = 3;
      input.value =
        cur != null
          ? typeof cur === "string"
            ? cur
            : JSON.stringify(cur, null, 2)
          : pr.def || "{}";
      lab.classList.add("ed-field-wide");
      input.addEventListener("change", () => {
        const raw = input.value.trim();
        if (raw === "") delete step.options[pr.key];
        else {
          try {
            step.options[pr.key] = JSON.parse(raw);
          } catch (_) {
            step.options[pr.key] = raw;
          }
        }
        if (entry) syncRaw(entry);
      });
    } else {
      input = document.createElement("input");
      input.type = pr.type === "number" ? "number" : "text";
      input.placeholder = pr.hint || pr.def || pr.type || "";
      if (cur != null) input.value = String(cur);
      else if (pr.def) input.value = pr.def;
      input.addEventListener("change", () => {
        const raw = input.value.trim();
        if (raw === "") delete step.options[pr.key];
        else if (pr.type === "number") {
          const n = Number(raw);
          if (!Number.isNaN(n)) step.options[pr.key] = n;
        } else step.options[pr.key] = raw;
        if (entry) syncRaw(entry);
      });
    }
    lab.appendChild(input);
    return lab;
  }



  function moveStep(arr, index, delta, host, depth) {
    const j = index + delta;
    if (j < 0 || j >= arr.length) return;
    const t = arr[index];
    arr[index] = arr[j];
    arr[j] = t;
    renderSteps(arr, host, depth);
    const entry = currentEntry();
    if (entry) syncRaw(entry);
  }

  function mkBtn(text, fn) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "graph-btn";
    b.textContent = text;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      fn();
    });
    return b;
  }

  function boot() {
    load();
    renderShell();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      if ($("#editor-root")) boot();
    });
  } else if ($("#editor-root")) {
    boot();
  }
  window.__mdEditorBoot = boot;
})();
