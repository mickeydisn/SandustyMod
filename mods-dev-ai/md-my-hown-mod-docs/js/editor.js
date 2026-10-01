/**
 * Config editor — grouped like in-game menu, exhaustive forms, editable action params.
 */
(function () {
  const S = () => window.MD_SCHEMA;
  const STORE = "md-my-hown-mod-config";

  const state = {
    config: null,
    collection: "elements",
    editIndex: null,
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

  function ensureArray(key) {
    if (!Array.isArray(state.config[key])) state.config[key] = [];
    return state.config[key];
  }

  function updateCounts() {
    $$(".ed-col").forEach((btn) => {
      const key = btn.dataset.col;
      const n = (state.config[key] || []).length;
      const badge = btn.querySelector(".ed-count");
      if (badge) badge.textContent = n ? String(n) : "";
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  function renderShell() {
    const root = $("#editor-root");
    if (!root) return;
    const groups = S().MENU_GROUPS;

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
    groups.forEach((g) => {
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
          const data = JSON.parse(String(reader.result));
          state.config = { ...S().emptyConfig(), ...data };
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

  function collectionMeta(key) {
    for (const g of S().MENU_GROUPS) {
      const hit = g.items.find((i) => i.key === key);
      if (hit) return hit;
    }
    return { key, label: key, color: "#888" };
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
          entry.name ||
          entry.scope ||
          entry.kind ||
          entry.handlerKey ||
          entry.processId ||
          entry.structureType ||
          entry.structureId ||
          entry.hookId ||
          "";
        const stepsN = Array.isArray(entry.steps) ? entry.steps.length : null;
        return `
        <div class="ed-card" data-i="${i}">
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
      if (el.type === "checkbox") {
        entry[k] = el.checked;
      } else if (el.dataset.json) {
        const raw = el.value.trim();
        if (!raw) {
          delete entry[k];
          return;
        }
        try {
          entry[k] = JSON.parse(raw);
        } catch {
          entry[k] = raw;
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
              <div class="ed-blocks-head">Steps <span class="ed-muted">— pick action, set params, bind with <code>as</code></span></div>
              <div id="ed-blocks"></div>
              <button type="button" class="graph-btn primary" id="ed-add-step" style="margin-top:8px">+ Step</button>
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
        Object.keys(entry).forEach((k) => delete entry[k]);
        Object.assign(entry, raw);
      } catch (_) {}
      list[index] = entry;
      save();
      state.editIndex = null;
      renderMain();
    });

    if (isProcess) {
      if (!Array.isArray(entry.steps)) entry.steps = [];
      renderBlocks(entry.steps, $("#ed-blocks"), 0);
      $("#ed-add-step")?.addEventListener("click", () => {
        entry.steps.push({ key: "noop", options: {} });
        renderBlocks(entry.steps, $("#ed-blocks"), 0);
        syncRaw(entry);
      });
    }
  }

  function syncRaw(entry) {
    const ta = $("#ed-raw");
    if (ta) ta.value = JSON.stringify(entry, null, 2);
  }

  function currentEntry() {
    return ensureArray(state.collection)[state.editIndex];
  }

  function renderBlocks(steps, host, depth) {
    if (!host) return;
    host.innerHTML = "";
    steps.forEach((step, i) => {
      host.appendChild(blockEl(step, steps, i, depth));
    });
  }

  function blockEl(step, parentArr, index, depth) {
    if (!step.options || typeof step.options !== "object") step.options = {};
    const role = S().roleOf(step.key || "noop");
    const color = S().ROLE_COLOR[role] || "#888";
    const el = document.createElement("div");
    el.className = "ed-block";
    el.style.borderLeftColor = color;
    if (depth) el.style.marginLeft = depth * 10 + "px";

    const head = document.createElement("div");
    head.className = "ed-block-head";

    const roleTag = document.createElement("span");
    roleTag.className = "ed-role";
    roleTag.style.background = color + "33";
    roleTag.style.color = color;
    roleTag.textContent = S().ROLE_LABELS[role] || role;

    const keySel = document.createElement("select");
    keySel.className = "ed-key";
    let lastR = "";
    Object.entries(S().ACTIONS).forEach(([r, keys]) => {
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
    keySel.addEventListener("change", () => {
      step.key = keySel.value;
      // drop unknown options? keep all for safety
      if (step.key === "if") {
        if (!step.then) step.then = [];
        if (!step.else) step.else = [];
      } else {
        delete step.then;
        delete step.else;
      }
      renderBlocks(parentArr, el.parentElement, depth);
      const entry = currentEntry();
      if (entry) syncRaw(entry);
    });

    const asInp = document.createElement("input");
    asInp.className = "ed-as";
    asInp.placeholder = "as → var";
    asInp.value = step.as || "";
    asInp.title = "Bind return value";
    asInp.addEventListener("change", () => {
      const v = asInp.value.trim();
      if (v) step.as = v;
      else delete step.as;
      const entry = currentEntry();
      if (entry) syncRaw(entry);
    });

    const up = mkBtn("↑", () => {
      if (index <= 0) return;
      [parentArr[index - 1], parentArr[index]] = [parentArr[index], parentArr[index - 1]];
      renderBlocks(parentArr, el.parentElement, depth);
      const entry = currentEntry();
      if (entry) syncRaw(entry);
    });
    const down = mkBtn("↓", () => {
      if (index >= parentArr.length - 1) return;
      [parentArr[index + 1], parentArr[index]] = [parentArr[index], parentArr[index + 1]];
      renderBlocks(parentArr, el.parentElement, depth);
      const entry = currentEntry();
      if (entry) syncRaw(entry);
    });
    const del = mkBtn("×", () => {
      parentArr.splice(index, 1);
      renderBlocks(parentArr, el.parentElement, depth);
      const entry = currentEntry();
      if (entry) syncRaw(entry);
    });

    head.append(roleTag, keySel, asInp, up, down, del);
    el.appendChild(head);

    // Param fields from ACTION_PARAMS
    const params = S().ACTION_PARAMS[step.key] || [];
    if (params.length) {
      const grid = document.createElement("div");
      grid.className = "ed-block-params";
      params.forEach(([pk, plabel, ptype]) => {
        const lab = document.createElement("label");
        lab.className = "ed-pfield";
        const span = document.createElement("span");
        span.textContent = plabel;
        lab.appendChild(span);
        let input;
        if (ptype === "bool") {
          input = document.createElement("input");
          input.type = "checkbox";
          input.checked = !!step.options[pk];
          input.addEventListener("change", () => {
            step.options[pk] = input.checked;
            const entry = currentEntry();
            if (entry) syncRaw(entry);
          });
        } else {
          input = document.createElement("input");
          input.type = ptype === "number" ? "number" : "text";
          const v = step.options[pk];
          input.value = v == null ? "" : String(v);
          input.addEventListener("change", () => {
            const raw = input.value.trim();
            if (raw === "") delete step.options[pk];
            else if (ptype === "number") {
              const n = Number(raw);
              if (!Number.isNaN(n)) step.options[pk] = n;
            } else step.options[pk] = raw;
            const entry = currentEntry();
            if (entry) syncRaw(entry);
          });
        }
        lab.appendChild(input);
        grid.appendChild(lab);
      });
      el.appendChild(grid);
    } else {
      const hint = document.createElement("div");
      hint.className = "ed-block-hint";
      hint.textContent = "No parameters for this action";
      el.appendChild(hint);
    }

    if (step.key === "if") {
      if (!step.then) step.then = [];
      if (!step.else) step.else = [];
      appendBranch(el, "then", step.then, depth);
      appendBranch(el, "else", step.else, depth);
    }

    return el;
  }

  function appendBranch(el, name, arr, depth) {
    const lab = document.createElement("div");
    lab.className = "ed-branch-label";
    lab.textContent = name;
    const box = document.createElement("div");
    box.className = "ed-branch";
    renderBlocks(arr, box, depth + 1);
    const add = mkBtn("+ " + name, () => {
      arr.push({ key: "noop", options: {} });
      renderBlocks(arr, box, depth + 1);
      const entry = currentEntry();
      if (entry) syncRaw(entry);
    });
    add.classList.add("ed-branch-add");
    el.append(lab, box, add);
  }

  function mkBtn(text, fn) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "graph-btn";
    b.textContent = text;
    b.addEventListener("click", fn);
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
