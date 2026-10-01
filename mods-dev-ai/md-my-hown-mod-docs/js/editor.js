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
    dragFrom: null, // { arr, index } for step DnD
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
          ? `<div class="ed-blocks-wrap">
              <div class="ed-blocks-head">Program steps <span class="ed-muted">— drag handle ⋮⋮ to reorder · stack = order</span></div>
              <div id="ed-blocks" class="ed-step-list"></div>
              <button type="button" class="graph-btn primary" id="ed-add-step" style="margin-top:10px">+ Step</button>
            </div>`
          : ""
      }
      <details class="ed-raw"><summary>Raw JSON</summary><textarea id="ed-raw" rows="12"></textarea></details>`;

    const form = $("#ed-form");
    form.innerHTML = fields
      .map(([k, label, type, extra]) => fieldControl(k, label, type, extra, entry[k]))
      .join("");
    $("#ed-raw").value = JSON.stringify(entry, null, 2);

    $("#ed-back")?.addEventListener("click", () => {
      state.editIndex = null;
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
      renderSteps(entry.steps, $("#ed-blocks"), 0);
      $("#ed-add-step")?.addEventListener("click", () => {
        entry.steps.push({ key: "noop", options: {} });
        renderSteps(entry.steps, $("#ed-blocks"), 0);
        syncRaw(entry);
      });
    }
  }

  /** Normalize ACTION_PARAMS entry to object shape */
  function paramDefs(actionKey) {
    const raw = (S().ACTION_PARAMS && S().ACTION_PARAMS[actionKey]) || [];
    return raw.map((p) => {
      if (Array.isArray(p)) {
        return { key: p[0], label: p[1], type: p[2], hint: "", def: "", required: false, options: [] };
      }
      return p;
    });
  }

  function renderSteps(steps, host, depth) {
    if (!host) return;
    host.innerHTML = "";
    if (!steps.length && depth === 0) {
      host.innerHTML = `<div class="ed-empty" style="padding:16px">No steps yet. Add a step or drag from below.</div>`;
    }
    steps.forEach((step, i) => {
      host.appendChild(stepCard(step, steps, i, depth));
    });
  }

  function stepCard(step, parentArr, index, depth) {
    if (!step.options || typeof step.options !== "object") step.options = {};
    // Legacy: options.condition → options.var (mod compiler only reads options.var)
    if (step.key === "if" && step.options.condition != null && step.options.var == null) {
      step.options.var = step.options.condition;
      delete step.options.condition;
    }
    // Drop stray condition key so it does not appear under Advanced
    if (step.key === "if" && "condition" in step.options) delete step.options.condition;

    const isIf = step.key === "if";
    const role = S().roleOf(step.key || "noop");
    const color = S().ROLE_COLOR[role] || "#888";
    const el = document.createElement("div");
    el.className = "ed-block" + (isIf ? " ed-block-if" : "");
    el.draggable = true;
    el.style.borderLeftColor = color;
    if (depth) el.style.marginLeft = depth * 12 + "px";

    // DnD
    el.addEventListener("dragstart", (ev) => {
      state.dragFrom = { arr: parentArr, index };
      el.classList.add("ed-dragging");
      ev.dataTransfer.effectAllowed = "move";
      try { ev.dataTransfer.setData("text/plain", String(index)); } catch (_) {}
    });
    el.addEventListener("dragend", () => {
      el.classList.remove("ed-dragging");
      state.dragFrom = null;
      $$(".ed-drop-target").forEach((n) => n.classList.remove("ed-drop-target"));
    });
    el.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "move";
      el.classList.add("ed-drop-target");
    });
    el.addEventListener("dragleave", () => el.classList.remove("ed-drop-target"));
    el.addEventListener("drop", (ev) => {
      ev.preventDefault();
      el.classList.remove("ed-drop-target");
      const from = state.dragFrom;
      if (!from || from.arr !== parentArr) return;
      const fi = from.index;
      const ti = index;
      if (fi === ti) return;
      const [item] = parentArr.splice(fi, 1);
      parentArr.splice(ti, 0, item);
      const entry = currentEntry();
      renderSteps(parentArr, el.parentElement, depth);
      if (entry) syncRaw(entry);
    });

    const head = document.createElement("div");
    head.className = "ed-block-head";

    const grip = document.createElement("span");
    grip.className = "ed-grip";
    grip.title = "Drag to reorder";
    grip.textContent = "⋮⋮";

    const roleTag = document.createElement("span");
    roleTag.className = "ed-role";
    roleTag.style.background = color + "33";
    roleTag.style.color = color;
    roleTag.textContent = isIf ? "If" : (S().ROLE_LABELS[role] || role);

    const keySel = document.createElement("select");
    keySel.className = "ed-key";
    Object.entries(S().ACTIONS || {}).forEach(([r, keys]) => {
      const og = document.createElement("optgroup");
      og.label = S().ROLE_LABELS[r] || r;
      keys.forEach((k) => {
        const opt = document.createElement("option");
        opt.value = k;
        opt.textContent = k;
        if (k === step.key) opt.selected = true;
        og.appendChild(opt);
      });
      keySel.appendChild(og);
    });
    if (![...keySel.querySelectorAll("option")].some((o) => o.value === "if")) {
      const og = document.createElement("optgroup");
      og.label = "Block";
      const opt = document.createElement("option");
      opt.value = "if";
      opt.textContent = "if";
      if (step.key === "if") opt.selected = true;
      og.appendChild(opt);
      keySel.appendChild(og);
    }
    keySel.addEventListener("change", () => {
      step.key = keySel.value;
      step.options = {};
      if (step.key === "if") {
        step.then = Array.isArray(step.then) ? step.then : [];
        step.else = Array.isArray(step.else) ? step.else : [];
        step.options = { var: "" };
        delete step.as;
      } else {
        delete step.then;
        delete step.else;
      }
      const entry = currentEntry();
      renderSteps(parentArr, el.parentElement, depth);
      if (entry) syncRaw(entry);
    });

    head.append(grip, roleTag, keySel);

    // `as` only on real actions — if-blocks branch on options.var, they do not bind a return
    if (!isIf) {
      const asInp = document.createElement("input");
      asInp.className = "ed-as";
      asInp.placeholder = "as → var";
      asInp.value = step.as || "";
      asInp.title = "Bind return value to a process variable";
      asInp.addEventListener("change", () => {
        const v = asInp.value.trim();
        if (v) step.as = v;
        else delete step.as;
        const entry = currentEntry();
        if (entry) syncRaw(entry);
      });
      head.appendChild(asInp);
    }

    const up = mkBtn("↑", () => moveStep(parentArr, index, -1, el.parentElement, depth));
    const down = mkBtn("↓", () => moveStep(parentArr, index, 1, el.parentElement, depth));
    const del = mkBtn("×", () => {
      parentArr.splice(index, 1);
      const entry = currentEntry();
      renderSteps(parentArr, el.parentElement, depth);
      if (entry) syncRaw(entry);
    });
    head.append(up, down, del);
    el.appendChild(head);

    // Doc
    const doc = isIf
      ? "Branch on the truthiness of a process variable (options.var). Shape: { key:\"if\", options:{ var }, then:[], else:[] }."
      : ((S().ACTION_DOCS && S().ACTION_DOCS[step.key]) || "");
    const apiList = (!isIf && S().ACTION_APIS && S().ACTION_APIS[step.key]) || [];
    if (doc || (apiList && apiList.length)) {
      const docEl = document.createElement("div");
      docEl.className = "ed-block-doc";
      let html = doc ? escapeHtml(doc) : "";
      if (apiList && apiList.length) {
        html += (html ? " " : "") + '<span class="ed-api">API: ' +
          apiList.map((a) => "<code>" + escapeHtml(a) + "</code>").join(" · ") +
          "</span>";
      }
      docEl.innerHTML = html;
      el.appendChild(docEl);
    }

    if (isIf) {
      // ── Official mod shape: options.var + then[] + else[] ──
      const grid = document.createElement("div");
      grid.className = "ed-block-params";
      const lab = document.createElement("label");
      lab.className = "ed-pfield ed-pfield-wide";
      lab.innerHTML =
        '<span>When variable is true <code class="ed-pkey">options.var</code> *</span>' +
        '<span class="ed-phint">Name bound by an earlier step\\\'s <code>as</code>. Both branches are compiled; the one that runs is chosen at run time.</span>';
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "variable name (e.g. wet)";
      input.value = step.options.var != null ? String(step.options.var) : "";
      input.addEventListener("change", () => {
        const v = input.value.trim();
        // keep only var in options for if
        step.options = v ? { var: v } : { var: "" };
        const entry = currentEntry();
        if (entry) syncRaw(entry);
      });
      lab.appendChild(input);
      grid.appendChild(lab);
      el.appendChild(grid);

      if (!Array.isArray(step.then)) step.then = [];
      if (!Array.isArray(step.else)) step.else = [];
      appendBranch(el, "then", step.then, depth);
      appendBranch(el, "else", step.else, depth);
    } else {
      // ── Normal action params ──
      const defs = paramDefs(step.key);
      const grid = document.createElement("div");
      grid.className = "ed-block-params";
      if (defs.length) {
        defs.forEach((pr) => grid.appendChild(paramField(step, pr)));
      } else {
        const hint = document.createElement("div");
        hint.className = "ed-block-hint";
        hint.textContent = "No parameters for this action.";
        grid.appendChild(hint);
      }
      const known = new Set(defs.map((d) => d.key));
      const extraObj = {};
      Object.keys(step.options).forEach((k) => {
        if (!known.has(k)) extraObj[k] = step.options[k];
      });
      if (Object.keys(extraObj).length) {
        const details = document.createElement("details");
        details.className = "ed-extra-details";
        details.open = true;
        const sum = document.createElement("summary");
        sum.textContent = "Extra options (" + Object.keys(extraObj).length + " unlisted keys)";
        details.appendChild(sum);
        const extraTa = document.createElement("textarea");
        extraTa.className = "ed-extra-json";
        extraTa.rows = 2;
        extraTa.value = JSON.stringify(extraObj, null, 2);
        extraTa.addEventListener("change", () => {
          Object.keys(step.options).forEach((k) => {
            if (!known.has(k)) delete step.options[k];
          });
          const raw = extraTa.value.trim();
          if (raw) {
            try { Object.assign(step.options, JSON.parse(raw)); }
            catch (err) { alert("Extra options: " + err.message); }
          }
          const entry = currentEntry();
          if (entry) syncRaw(entry);
        });
        details.appendChild(extraTa);
        grid.appendChild(details);
      }
      el.appendChild(grid);
    }

    return el;
  }

  function paramField(step, pr) {
    const lab = document.createElement("label");
    lab.className = "ed-pfield";
    const title = document.createElement("span");
    title.innerHTML =
      escapeHtml(pr.label) +
      (pr.required ? " *" : "") +
      ' <code class="ed-pkey">' +
      escapeHtml(pr.key) +
      "</code>";
    lab.appendChild(title);
    if (pr.hint) {
      const h = document.createElement("span");
      h.className = "ed-phint";
      h.textContent = pr.hint;
      lab.appendChild(h);
    }

    let input;
    const cur = step.options[pr.key];
    if (pr.type === "bool") {
      input = document.createElement("input");
      input.type = "checkbox";
      input.checked = cur != null ? !!cur : pr.def === "true";
      input.addEventListener("change", () => {
        step.options[pr.key] = input.checked;
        const entry = currentEntry();
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
      const v = cur != null ? String(cur) : pr.def || "";
      input.value = v;
      input.addEventListener("change", () => {
        if (input.value === "") delete step.options[pr.key];
        else step.options[pr.key] = input.value;
        const entry = currentEntry();
        if (entry) syncRaw(entry);
      });
    } else {
      input = document.createElement("input");
      input.type = pr.type === "number" ? "number" : "text";
      input.placeholder = pr.hint || pr.def || pr.type;
      if (cur != null) input.value = String(cur);
      else if (pr.def) input.value = pr.def;
      input.addEventListener("change", () => {
        const raw = input.value.trim();
        if (raw === "") delete step.options[pr.key];
        else if (pr.type === "number") {
          const n = Number(raw);
          if (!Number.isNaN(n)) step.options[pr.key] = n;
        } else step.options[pr.key] = raw;
        const entry = currentEntry();
        if (entry) syncRaw(entry);
      });
    }
    lab.appendChild(input);
    return lab;
  }

  function appendBranch(el, name, arr, depth) {
    const lab = document.createElement("div");
    lab.className = "ed-branch-label";
    lab.textContent = name;
    const box = document.createElement("div");
    box.className = "ed-branch ed-step-list";
    renderSteps(arr, box, depth + 1);
    const add = mkBtn("+ " + name, () => {
      arr.push({ key: "noop", options: {} });
      renderSteps(arr, box, depth + 1);
      const entry = currentEntry();
      if (entry) syncRaw(entry);
    });
    add.classList.add("ed-branch-add");
    el.append(lab, box, add);
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
