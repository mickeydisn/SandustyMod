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
    menuId: null,
    defaultScope: null,
    editIndex: null,
    dragFrom: null,
    /** @type {Set<string>} path keys of expanded steps e.g. "0", "0.then.1" */
    openSteps: new Set(["0"]),
    /** catalog | reorder */
    dragPayload: null,
    programMode: "v1",
    catalogFilter: { cell: false, returns: false },
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
  function collectionMeta(key, menuId) {
    for (const g of S().MENU_GROUPS) {
      const hit = g.items.find((i) => {
        if (menuId) return i.menuId === menuId || (i.key === key && i.menuId === menuId);
        return i.key === key && !i.menuId;
      });
      if (hit) return hit;
      // fallback: first matching key
      if (!menuId) {
        const h2 = g.items.find((i) => i.key === key);
        if (h2) return h2;
      }
    }
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
      const scope = btn.dataset.scope || "";
      let n = 0;
      const list = state.config[key] || [];
      if (scope && key === "programV2") {
        n = list.filter((e) => (e.scope || "") === scope).length;
      } else {
        n = list.length;
      }
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
        const mid = c.menuId || "";
        const active =
          c.key === state.collection &&
          (mid ? state.menuId === mid : !state.menuId || state.menuId === mid);
        btn.type = "button";
        btn.className =
          "ed-col" +
          (c.nest ? " ed-col-nest" : "") +
          (active ? " on" : "");
        btn.dataset.col = c.key;
        if (mid) btn.dataset.menuId = mid;
        if (c.defaultScope) btn.dataset.scope = c.defaultScope;
        btn.innerHTML = `<span class="ed-dot" style="background:${c.color}"></span>
          <span class="ed-col-label">${escapeHtml(c.label)}</span>
          <span class="ed-count"></span>`;
        btn.addEventListener("click", () => {
          state.collection = c.key;
          state.menuId = c.menuId || null;
          state.defaultScope = c.defaultScope || null;
          state.editIndex = null;
          state.programMode = c.key === "programV2" ? "v2" : c.key === "processes" ? "v1" : state.programMode;
          $$(".ed-col").forEach((b) => {
            const bMid = b.dataset.menuId || "";
            const on =
              b.dataset.col === state.collection &&
              (state.menuId ? bMid === state.menuId : !bMid);
            b.classList.toggle("on", on);
          });
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
    const all = ensureArray(key);
    const scopeFilter = state.defaultScope;
    const list =
      key === "programV2" && scopeFilter
        ? all.filter((e) => (e.scope || "") === scopeFilter)
        : all;
    const meta = collectionMeta(key, state.menuId);

    if (state.editIndex != null) {
      renderForm(main, key, state.editIndex, meta);
      return;
    }

    const groupDoc = (() => {
      for (const g of S().MENU_GROUPS || []) {
        if (g.items.some((i) => i.key === key && (state.menuId ? i.menuId === state.menuId : true))) {
          return g.doc || g.hint || "";
        }
      }
      return "";
    })();
    const itemDoc = meta.doc || meta.hint || "";
    const docBody = [itemDoc, groupDoc && itemDoc !== groupDoc ? groupDoc : ""]
      .filter(Boolean)
      .join("\n\n");

    main.innerHTML = `
      <div class="ed-toolbar">
        <div>
          <h2 class="ed-title">${escapeHtml(meta.label)}</h2>
          <p class="ed-sub">${list.length} entr${list.length === 1 ? "y" : "ies"} · <code>${escapeHtml(key)}</code>${
            scopeFilter ? ' · scope <code>' + escapeHtml(scopeFilter) + '</code>' : ''
          }</p>
        </div>
        <button type="button" class="graph-btn primary" id="ed-add">+ Add</button>
      </div>
      ${
        docBody
          ? `<details class="ed-cat-doc"><summary class="ed-cat-doc-sum">About this category</summary>
              <div class="ed-cat-doc-body">${escapeHtml(docBody).replace(/\n/g, "<br/>")}</div>
            </details>`
          : ""
      }
      <div class="ed-cards" id="ed-cards"></div>`;

    $("#ed-add")?.addEventListener("click", () => {
      const blank = { id: "mdmy." + key.replace(/s$/, "") + "." + (all.length + 1) };
      // Seed every collection with the defaults its register step expects.
      const DEFAULTS = {
        processes: null, // handled below (needs scope/steps)
        programV2: null,
        recipes: { kind: "structure" },
        signals: { kind: "targets" },
        modifiers: { kind: "intercept", enabled: true },
        elements: { matterType: "Solid" },
        unlockNodes: { kind: "always" },
        structureBehaviors: { kind: "conveyor" },
        energyTypes: { type: "conductor" },
        buffers: { type: "number" },
        processing: { intervalMs: 1000 },
        triggers: { interval: 60, sequentialRuns: 1 },
        items: { itemType: "Mod" },
        structures: { categoryKey: "blocks" },
        projectiles: {},
        excavationProfiles: { power: 1, pattern: [[1]] },
        placementConfigs: { fields: [] },
        contacts: {},
        terrains: {},
        sprites: { fromMod: true },
        techs: {},
        upgrades: {},
        upgradeCategories: {},
        inputBindings: {},
        energyNetworks: {},
      };
      Object.assign(blank, DEFAULTS[key] || {});
      if (key === "processes" || key === "programV2") {
        blank.scope = state.defaultScope || "signal";
        blank.steps = [];
      }
      all.push(blank);
      state.editIndex = all.length - 1;
      save();
      renderMain();
    });

    const cards = $("#ed-cards");
    if (!list.length) {
      cards.innerHTML = `<div class="ed-empty">No entries. Click <strong>+ Add</strong>.</div>`;
      return;
    }
    // Map filtered entries to real indices in `all`
    const realIndices = list.map((e) => all.indexOf(e));
    cards.innerHTML = list
      .map((entry, i) => {
        const real = realIndices[i];
        const id = entry.id || "(no id)";
        const sub =
          entry.name || entry.scope || entry.kind || entry.handlerKey ||
          entry.processId || entry.structureType || entry.structureId || entry.hookId || "";
        const stepsN = Array.isArray(entry.steps) ? entry.steps.length : null;
        return `<div class="ed-card" data-i="${real}">
          <div class="ed-card-body">
            <div class="ed-card-id">${escapeHtml(id)}</div>
            <div class="ed-card-sub">${escapeHtml(String(sub))}${
              stepsN != null ? ` · ${stepsN} step${stepsN === 1 ? "" : "s"}` : ""
            }</div>
          </div>
          <div class="ed-card-actions">
            <button type="button" class="graph-btn ed-edit" data-i="${real}">Edit</button>
            <button type="button" class="graph-btn ed-del" data-i="${real}">Del</button>
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
        if (!confirm("Delete " + (all[i]?.id || i) + "?")) return;
        all.splice(i, 1);
        save();
        renderMain();
      });
    });
  }


  /* ---------- typed-field infrastructure (Phase 1) ---------- */
  const FIELD_TYPES = [
    "text", "number", "bool", "select", "tags", "color", "ref",
    "kv", "list", "matrix", "triple", "pair", "json",
  ];

  function pathTokens(p) {
    const out = [];
    String(p).replace(/([^.[\]]+)|\[(\d+)\]/g, (_m, key, idx) => {
      out.push(idx != null ? Number(idx) : key);
    });
    return out;
  }
  function joinPath(prefix, k) {
    if (!prefix) return String(k || "");
    if (!k) return String(prefix);
    return prefix + "." + k;
  }
  function setPath(obj, p, v) {
    const t = pathTokens(p);
    if (!t.length) return;
    let o = obj;
    for (let i = 0; i < t.length - 1; i++) {
      const k = t[i];
      if (o[k] == null || typeof o[k] !== "object") o[k] = typeof t[i + 1] === "number" ? [] : {};
      o = o[k];
    }
    o[t[t.length - 1]] = v;
  }
  function delPath(obj, p) {
    const t = pathTokens(p);
    if (!t.length) return;
    let o = obj;
    for (let i = 0; i < t.length - 1; i++) {
      o = o == null ? undefined : o[t[i]];
      if (o == null || typeof o !== "object") return;
    }
    delete o[t[t.length - 1]];
  }
  function getPathVal(obj, p) {
    let o = obj;
    for (const k of pathTokens(p)) {
      if (o == null) return undefined;
      o = o[k];
    }
    return o;
  }
  function deepClone(v) {
    return v == null ? v : JSON.parse(JSON.stringify(v));
  }
  function isEmptyObj(v) {
    return !!v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 0;
  }
  /** Parent prefixes of a path ("sprite.id" → "sprite") — used to prune emptied containers. */
  function parentPaths(p) {
    const t = pathTokens(p);
    const out = [];
    for (let i = 1; i < t.length; i++) out.push(t.slice(0, i).join("."));
    return out;
  }

  function refValues(from) {
    if (!from) return [];
    if (from === "@actions") {
      const acts = (S() && S().ACTIONS) || {};
      const out = [];
      Object.keys(acts).forEach((r) => (acts[r] || []).forEach((k) => out.push(k)));
      return out;
    }
    const list = (state.config || {})[from];
    if (!Array.isArray(list)) return [];
    return list
      .map((e) => (e && (e.id != null ? e.id : e.path != null ? e.path : null)))
      .filter((v) => v != null && v !== "")
      .map(String);
  }
  function colorToHex(v, fmt) {
    if (v == null || v === "") return "#000000";
    if (typeof v === "number" && fmt === "int") {
      return "#" + (v >>> 0 & 0xffffff).toString(16).padStart(6, "0");
    }
    const s = String(v);
    if (/^#[0-9a-fA-F]{6}$/.test(s)) return s;
    if (/^#[0-9a-fA-F]{3}$/.test(s)) {
      return "#" + s.slice(1).split("").map((c) => c + c).join("");
    }
    return "#000000";
  }
  function arrayFromNumericObj(o) {
    const keys = Object.keys(o).map(Number).filter((n) => !Number.isNaN(n)).sort((a, b) => a - b);
    if (!keys.length) return null;
    return keys.map((n) => o[String(n)]);
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
          .map(([k, label, type, extra]) => fieldControl(k, label, type, extra, getPathVal(entry, k)))
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

  function attrsFor(extra) {
    const a = [];
    if (extra && extra.required) a.push('data-req="1"');
    if (extra && extra.rows) {
      if (extra.rows.min != null) a.push(`data-rows-min="${extra.rows.min}"`);
      if (extra.rows.max != null) a.push(`data-rows-max="${extra.rows.max}"`);
    }
    if (extra && extra.min != null) a.push(`data-min="${extra.min}"`);
    if (extra && extra.max != null) a.push(`data-max="${extra.max}"`);
    if (extra && extra.pattern) a.push(`data-pattern="${escapeAttr(extra.pattern)}"`);
    if (extra && extra.msg) a.push(`data-msg="${escapeAttr(extra.msg)}"`);
    if (extra && extra.coerceBy) a.push(`data-coerce="${escapeAttr(extra.coerceBy)}"`);
    return a.join(" ");
  }
  function whenAttr(extra) {
    return extra && extra.when ? ` data-when="${escapeAttr(JSON.stringify(extra.when))}"` : "";
  }
  function ctrl(inner, extra) {
    return `<div class="ed-ctrl"${whenAttr(extra)}>${inner}</div>`;
  }
  function kvRowHtml(key, val) {
    const v = val == null ? "" : typeof val === "object" ? JSON.stringify(val) : String(val);
    return `<div class="ed-kv-row"><input type="text" class="ed-kv-key" data-kv-key value="${escapeAttr(key)}" placeholder="key" />
      <input type="text" class="ed-kv-val" data-kv-val value="${escapeAttr(v)}" placeholder="value" />
      <button type="button" class="ed-kv-del" title="Remove pair">×</button></div>`;
  }
  function listRowHtml(fields, item, index) {
    const body = fields
      .map((f) => fieldControl(f[0], f[1], f[2], f[3], item ? getPathVal(item, f[0]) : undefined))
      .join("");
    return `<div class="ed-list-row"><span class="ed-list-idx">${index + 1}</span>${body}
      <button type="button" class="ed-list-del" title="Remove row">×</button></div>`;
  }

  function fieldControl(k, label, type, extra, value) {
    extra = extra || {};
    const req = extra.required ? " *" : "";
    const hint = extra.hint || "";
    if (!FIELD_TYPES.includes(type)) {
      console.error("[editor] unknown field type", JSON.stringify(type), "for field", k);
      return ctrl(
        `<label class="ed-field ed-field-bad"><span>${escapeHtml(label)} ⚠ unknown type</span>
        <input type="text" value="${escapeAttr(String(type))}" disabled /></label>`,
        extra
      );
    }
    if (type === "kv") {
      const obj = value && typeof value === "object" && !Array.isArray(value) ? value : {};
      const vt = extra.valueType || "auto";
      const rows = Object.keys(obj).map((kk) => kvRowHtml(kk, obj[kk])).join("");
      return ctrl(
        `<div class="ed-field ed-field-wide"><span>${escapeHtml(label)}${req}</span>
        <div class="ed-kv" data-kv="${escapeAttr(k)}" data-kv-type="${vt}" ${attrsFor(extra)}>${rows}</div>
        <div class="ed-ctrl-actions"><button type="button" class="graph-btn ed-kv-add">+ Add pair</button></div>
        ${hint ? `<p class="ed-muted">${escapeHtml(hint)}</p>` : ""}</div>`,
        extra
      );
    }
    if (type === "list") {
      const fields = extra.fields || [];
      const arr = Array.isArray(value) ? value : [];
      const rows = arr.map((it, i) => listRowHtml(fields, it, i)).join("");
      return ctrl(
        `<div class="ed-field ed-field-wide"><span>${escapeHtml(label)}${req}</span>
        <div class="ed-list" data-list="${escapeAttr(k)}" data-fields="${escapeAttr(JSON.stringify(fields))}" data-item="${extra.item || "object"}" ${attrsFor(extra)}>${rows}</div>
        <div class="ed-ctrl-actions"><button type="button" class="graph-btn ed-list-add">+ Add row</button></div>
        ${hint ? `<p class="ed-muted">${escapeHtml(hint)}</p>` : ""}</div>`,
        extra
      );
    }
    return leafControl(k, label, type, extra, value);
  }

  function leafControl(k, label, type, extra, value) {
    const req = extra.required ? " *" : "";
    const hint = extra.hint || "";
    const A = attrsFor(extra);
    const dataF = `data-f="${escapeAttr(k)}" data-t="${type}"`;
    if (type === "bool") {
      return ctrl(
        `<label class="ed-field"><span>${escapeHtml(label)}</span>
        <input type="checkbox" ${dataF} ${value ? "checked" : ""} /></label>`,
        extra
      );
    }
    if (type === "select") {
      let opts = extra.options || [];
      if (typeof opts === "string") opts = S()[opts] || [];
      const cur = value == null ? "" : String(value);
      const known = cur === "" || opts.includes(cur);
      const options = opts
        .map((o) => `<option value="${escapeAttr(o)}" ${cur === o ? "selected" : ""}>${escapeHtml(o)}</option>`)
        .join("");
      const unknown = known
        ? ""
        : `<option value="${escapeAttr(cur)}" selected>${escapeHtml(cur)} ⚠ not in list</option>`;
      return ctrl(
        `<label class="ed-field${known ? "" : " ed-warn"}"><span>${escapeHtml(label)}${req}</span>
        <select ${dataF} ${A}><option value="">—</option>${unknown}${options}</select></label>`,
        extra
      );
    }
    if (type === "tags") {
      const arr = Array.isArray(value) ? value : [];
      return ctrl(
        `<label class="ed-field ed-field-wide"><span>${escapeHtml(label)}${req}</span>
        <input type="text" ${dataF} data-num="${extra.numeric ? 1 : 0}" ${A}
          value="${escapeAttr(arr.join(", "))}"
          placeholder="${escapeAttr(hint || "comma-separated")} " /></label>`,
        extra
      );
    }
    if (type === "color") {
      const fmt = extra.fmt || "string";
      const hex = colorToHex(value, fmt);
      const shown =
        value == null || value === ""
          ? ""
          : fmt === "int" && typeof value === "number"
          ? hex
          : String(value);
      return ctrl(
        `<label class="ed-field ed-field-wide"><span>${escapeHtml(label)}${req}</span>
        <span class="ed-color">
          <input type="color" class="ed-color-pick" value="${hex}" title="colour picker" />
          <input type="text" ${dataF} data-fmt="${fmt}" ${A} value="${escapeAttr(shown)}" placeholder="#RRGGBB" />
        </span></label>`,
        extra
      );
    }
    if (type === "ref") {
      const vals = refValues(extra.from);
      const dlId =
        "dl-" + String(k).replace(/[^a-zA-Z0-9_-]+/g, "_") + "-" + extra.from;
      const isNull = value === null;
      const cur = value == null || value === null ? "" : String(value);
      return ctrl(
        `<label class="ed-field ed-field-wide"><span>${escapeHtml(label)}${req}</span>
        <span class="ed-ref">
          <input type="text" list="${escapeAttr(dlId)}" ${dataF} ${A} value="${escapeAttr(cur)}"
            placeholder="${escapeAttr(hint || (extra.from ? "id from " + extra.from : ""))}" />
          <datalist id="${escapeAttr(dlId)}">${vals
            .map((v) => `<option value="${escapeAttr(v)}"></option>`)
            .join("")}</datalist>
          ${
            extra.nullable
              ? `<label class="ed-null" title="store an explicit null — means deliberately nothing">
            <input type="checkbox" ${dataF.replace('data-t="ref"', 'data-t="nullflag"')} ${isNull ? "checked" : ""} /> null</label>`
              : ""
          }
        </span></label>`,
        extra
      );
    }
    if (type === "triple" || type === "pair") {
      const tri = Array.isArray(value) ? value : [];
      const slots = extra.labels || (type === "pair" ? ["A", "B"] : ["0", "1", "2"]);
      return ctrl(
        `<label class="ed-field ed-field-wide"><span>${escapeHtml(label)}${req}</span>
        <span class="ed-triple" ${dataF} data-slots="${escapeAttr(slots.join("|"))}" ${A} title="${escapeAttr(hint)}">
          ${slots
            .map(
              (s, i) =>
                `<input type="number" data-slot="${i}" placeholder="${escapeAttr(s)}" value="${
                  tri[i] != null ? escapeAttr(String(tri[i])) : ""
                }" />`
            )
            .join("")}
        </span></label>`,
        extra
      );
    }
    if (type === "matrix") {
      const rows = Array.isArray(value) ? value : [];
      const group = extra.group || 0;
      const text = rows
        .map((r) =>
          (Array.isArray(r) ? r : [])
            .map((c) => (Array.isArray(c) ? c.join(" ") : String(c)))
            .join(group > 1 ? "   " : ",")
        )
        .join("\n");
      const cellHint =
        group > 1
          ? `one row per line, ${group} numbers per cell, cells separated by "   " (e.g. 1 0.5 0 1   0 1 0.5 1)`
          : "one row per line: 1,0,1";
      return ctrl(
        `<label class="ed-field ed-field-wide"><span>${escapeHtml(label)}${req}</span>
        <textarea ${dataF} ${A} data-group="${group}" rows="${Math.max(3, Math.min(rows.length || 3, 12))}"
          placeholder="${escapeAttr(hint || cellHint)}">${escapeHtml(text)}</textarea></label>`,
        extra
      );
    }
    if (type === "json") {
      const text = value == null ? "" : typeof value === "string" ? value : JSON.stringify(value, null, 2);
      return ctrl(
        `<label class="ed-field ed-field-wide"><span>${escapeHtml(label)}${req}</span>
        <textarea ${dataF} ${A} rows="3" placeholder="${escapeAttr(hint || "JSON")}">${escapeHtml(text)}</textarea></label>`,
        extra
      );
    }
    if (type === "number") {
      return ctrl(
        `<label class="ed-field"><span>${escapeHtml(label)}${req}</span>
        <input type="number" ${dataF} ${A} value="${escapeAttr(value == null ? "" : String(value))}"
          placeholder="${escapeAttr(hint)}" /></label>`,
        extra
      );
    }
    return ctrl(
      `<label class="ed-field"><span>${escapeHtml(label)}${req}</span>
      <input type="text" ${dataF} ${A} value="${escapeAttr(value == null ? "" : String(value))}"
        placeholder="${escapeAttr(hint)}" /></label>`,
      extra
    );
  }


  function markErr(el, errors, msg) {
    if (!errors) return;
    const lab = (el && el.closest && (el.closest(".ed-field") || el.closest(".ed-ctrl"))) || el;
    if (lab && lab.classList) lab.classList.add("err");
    if (el && el.classList) el.classList.add("err");
    errors.push(msg);
  }
  function fieldLabelOf(el, path) {
    const lab = el && el.closest && el.closest(".ed-field");
    const span = lab && lab.querySelector("span");
    return (span ? span.textContent : path).replace(" *", "").trim();
  }
  function coerceValue(el, form, v) {
    const by = el.dataset.coerce;
    if (!by || !form) return { ok: true, value: v };
    const other = form.querySelector(`[data-f="${by}"]`);
    const t = !other
      ? ""
      : other.type === "checkbox"
      ? other.checked
        ? "true"
        : "false"
      : String(other.value || "").trim();
    if (t === "number") {
      const n = Number(v);
      return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
    }
    if (t === "bool") {
      if (v === true || v === "true") return { ok: true, value: true };
      if (v === false || v === "false") return { ok: true, value: false };
      return { ok: false };
    }
    return { ok: true, value: String(v) };
  }
  function isHiddenEl(el) {
    return !!(el && el.closest && el.closest("[hidden]"));
  }

  /** Recursive reader: walks container children, writing into `root` at `prefix`. */
  function walkScope(scope, prefix, root, errors, form) {
    const children = scope && scope.children ? Array.from(scope.children) : [];
    for (const child of children) {
      const d = child.dataset || {};
      if (d.list != null) {
        handleList(child, joinPath(prefix, d.list), root, errors, form);
        continue;
      }
      if (d.kv != null) {
        handleKv(child, joinPath(prefix, d.kv), root, errors, form);
        continue;
      }
      if (d.f != null) {
        handleLeaf(child, joinPath(prefix, d.f), root, errors, form);
        continue;
      }
      if (child.children && child.children.length) walkScope(child, prefix, root, errors, form);
    }
  }

  let ownedSet = null;
  function noteOwned(p) {
    if (!ownedSet || !p) return;
    ownedSet.add(p);
    parentPaths(p).forEach((pp) => ownedSet.add(pp));
  }
  /** Fill `target` from the DOM form. Pass `errors = null` for silent preview mode. */
  function fillFromForm(target, form, errors) {
    ownedSet = new Set();
    walkScope(form, "", target, errors, form);
    const paths = Array.from(ownedSet).sort((a, b) => pathTokens(b).length - pathTokens(a).length);
    for (const p of paths) {
      if (isEmptyObj(getPathVal(target, p))) delPath(target, p);
    }
    ownedSet = null;
  }
  /**
   * Apply the form to `entry`. Returns false when validation errors were found;
   * `errors` then lists them (and the offending controls carry `.err`).
   */
  function readFormInto(entry, form, errors) {
    errors = errors || [];
    $$(".err", form).forEach((el) => el.classList.remove("err"));
    fillFromForm(entry, form, errors);
    return errors.length === 0;
  }

  function handleLeaf(el, path, root, errors, form) {
    const t = el.dataset.t;
    if (isHiddenEl(el)) {
      // Conditional field that does not apply → its key must not survive a save.
      delPath(root, path);
      noteOwned(path);
      return;
    }
    noteOwned(path);
    const req = el.dataset.req === "1";
    const label = (el.closest(".ed-field") && el.closest(".ed-field").querySelector("span")
      ? el.closest(".ed-field").querySelector("span").textContent
      : path
    ).replace(" *", "").trim();
    const need = () => markErr(el, errors, `${label} is required`);
    if (t === "nullflag") {
      if (el.checked) setPath(root, path, null);
      return;
    }
    if (t === "bool") {
      setPath(root, path, !!el.checked);
      return;
    }
    if (t === "triple" || t === "pair") {
      const slots = $$("[data-slot]", el);
      const vals = slots.map((s) => String(s.value || "").trim());
      const names = (el.dataset.slots || "").split("|").filter(Boolean);
      const want = names.length || slots.length;
      const what = want === 2 ? "two numbers" : want === 4 ? "four numbers" : `${want} numbers`;
      if (vals.every((v) => v === "")) {
        if (req) need();
        else delPath(root, path);
        return;
      }
      const nums = vals.map((v) => Number(v));
      if (nums.some((n) => !Number.isFinite(n))) {
        markErr(el, errors, `${label}: needs ${what}`);
        return;
      }
      setPath(root, path, nums);
      return;
    }
    const raw = String(el.value || "").trim();
    if (t === "number") {
      if (raw === "") {
        if (req) need();
        else delPath(root, path);
        return;
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        markErr(el, errors, `${label}: not a number`);
        return;
      }
      if (el.dataset.min != null && n < Number(el.dataset.min)) {
        markErr(el, errors, `${label} must be ≥ ${el.dataset.min}`);
        return;
      }
      if (el.dataset.max != null && n > Number(el.dataset.max)) {
        markErr(el, errors, `${label} must be ≤ ${el.dataset.max}`);
        return;
      }
      setPath(root, path, n);
      return;
    }
    if (t === "tags") {
      if (raw === "") {
        if (req) need();
        else delPath(root, path);
        return;
      }
      const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
      if (el.dataset.num === "1") {
        const nums = parts.map((p) => Number(p));
        if (nums.some((x) => !Number.isFinite(x))) {
          markErr(el, errors, `${label}: list must be numbers (comma-separated)`);
          return;
        }
        setPath(root, path, nums);
      } else {
        setPath(root, path, parts);
      }
      return;
    }
    if (t === "color") {
      if (raw === "") {
        if (req) need();
        else delPath(root, path);
        return;
      }
      const hex = raw.startsWith("#") ? raw : "#" + raw;
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
        markErr(el, errors, `${label}: need a #RRGGBB colour`);
        return;
      }
      setPath(root, path, el.dataset.fmt === "int" ? Number.parseInt(hex.slice(1), 16) : hex);
      return;
    }
    if (t === "matrix") {
      const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
      if (!lines.length) {
        if (req) need();
        else delPath(root, path);
        return;
      }
      const group = Number(el.dataset.group) || 0;
      const rows = [];
      let width = null;
      for (const line of lines) {
        // With grouped cells, 2+ spaces or a tab separates cells; otherwise comma/space.
        if (group > 1) {
          const parts = line.split(/\s{2,}|\t+/).filter(Boolean);
          const packed = [];
          for (const part of parts) {
            const nums = part.split(/[\s,]+/).filter(Boolean).map((c) => Number(c));
            if (nums.some((c) => !Number.isFinite(c))) {
              markErr(el, errors, `${label}: rows must contain only numbers`);
              return;
            }
            if (nums.length !== group) {
              markErr(el, errors, `${label}: every cell needs exactly ${group} numbers`);
              return;
            }
            packed.push(nums);
          }
          if (width == null) width = packed.length;
          else if (packed.length !== width) {
            markErr(el, errors, `${label}: every row needs the same number of cells`);
            return;
          }
          rows.push(packed);
          continue;
        }
        const cells = line.split(/[\s,]+/).filter(Boolean).map((c) => Number(c));
        if (cells.some((c) => !Number.isFinite(c))) {
          markErr(el, errors, `${label}: rows must contain only numbers`);
          return;
        }
        if (width == null) width = cells.length;
        else if (cells.length !== width) {
          markErr(el, errors, `${label}: every row needs the same number of cells`);
          return;
        }
        rows.push(cells);
      }
      setPath(root, path, rows);
      return;
    }
    if (t === "json") {
      if (raw === "") {
        if (req) need();
        else delPath(root, path);
        return;
      }
      try {
        setPath(root, path, JSON.parse(raw));
      } catch (e) {
        markErr(el, errors, `${label}: invalid JSON — ${e.message}`);
      }
      return;
    }
    // text · select · ref
    if (raw === "") {
      if (req) need();
      else delPath(root, path);
      return;
    }
    const pat = el.dataset.pattern;
    if (pat) {
      let ok = false;
      try {
        ok = new RegExp(pat).test(raw);
      } catch (_) {
        ok = true;
      }
      if (!ok) {
        markErr(el, errors, `${label}: ${el.dataset.msg || "invalid format"}`);
        return;
      }
    }
    if (el.dataset.coerce) {
      const c = coerceValue(el, form, raw);
      if (!c.ok) {
        markErr(el, errors, `${label}: value does not match the selected type`);
        return;
      }
      setPath(root, path, c.value);
      return;
    }
    setPath(root, path, raw);
  }

  function handleKv(container, path, root, errors, form) {
    if (isHiddenEl(container)) {
      delPath(root, path);
      noteOwned(path);
      return;
    }
    noteOwned(path);
    const label = fieldLabelOf(container, path);
    const req = container.dataset.req === "1";
    const vt = container.dataset.kvType || "auto";
    const obj = {};
    $$(".ed-kv-row", container).forEach((row) => {
      const kIn = row.querySelector("[data-kv-key]");
      const vIn = row.querySelector("[data-kv-val]");
      const key = String((kIn && kIn.value) || "").trim();
      const val = String((vIn && vIn.value) || "").trim();
      if (!key || val === "") return;
      if (vt === "number") {
        const n = Number(val);
        if (!Number.isFinite(n)) {
          markErr(vIn, errors, `${label}: "${key}" must be a number`);
          return;
        }
        obj[key] = n;
      } else if (vt === "string") {
        obj[key] = val;
      } else if (/^-?\d+(\.\d+)?$/.test(val)) {
        obj[key] = Number(val);
      } else if (val === "true" || val === "false") {
        obj[key] = val === "true";
      } else if (/^[{[]/.test(val)) {
        try {
          obj[key] = JSON.parse(val);
        } catch (e) {
          markErr(vIn, errors, `${label}: "${key}" is not valid JSON (${e.message})`);
        }
      } else {
        obj[key] = val;
      }
    });
    if (Object.keys(obj).length) {
      setPath(root, path, obj);
    } else if (req) {
      markErr(container, errors, `${label} needs at least one pair`);
    } else {
      delPath(root, path);
    }
  }

  function handleList(container, path, root, errors, form) {
    if (isHiddenEl(container)) {
      delPath(root, path);
      noteOwned(path);
      return;
    }
    noteOwned(path);
    const label = fieldLabelOf(container, path);
    const req = container.dataset.req === "1";
    const out = [];
    $$(".ed-list-row", container).forEach((row) => {
      if (isHiddenEl(row)) return;
      const tmp = {};
      walkScope(row, "", tmp, errors, form);
      const v = container.dataset.item === "array" ? arrayFromNumericObj(tmp) : tmp;
      if (v && (Array.isArray(v) ? v.length : !isEmptyObj(v))) out.push(v);
    });
    const min = Number(container.dataset.rowsMin);
    const max = Number(container.dataset.rowsMax);
    if (out.length) {
      if (Number.isFinite(min) && out.length < min) {
        markErr(container, errors, `${label} needs at least ${min} row${min === 1 ? "" : "s"}`);
        return;
      }
      if (Number.isFinite(max) && out.length > max) {
        markErr(container, errors, `${label} allows at most ${max} row${max === 1 ? "" : "s"}`);
        return;
      }
      setPath(root, path, out);
    } else if (Number.isFinite(min) && min > 0) {
      markErr(container, errors, `${label} needs at least ${min} row${min === 1 ? "" : "s"}`);
    } else if (req) {
      markErr(container, errors, `${label} needs at least one row`);
    } else {
      delPath(root, path);
    }
  }

  function evalWhen(cond, v) {
    if (!cond) return true;
    if (Array.isArray(cond.in)) return cond.in.map(String).includes(String(v));
    if (Array.isArray(cond.notIn)) return !cond.notIn.map(String).includes(String(v));
    if (cond.truthy) return v !== undefined && v !== null && v !== false && v !== "" && v !== "false";
    if (cond.falsy) return !evalWhen({ truthy: true }, v);
    if ("equals" in cond) {
      if (cond.equals === null) return v === null;
      return String(v) === String(cond.equals);
    }
    return true;
  }
  /** Show/hide every `data-when` control from the live form state. */
  function applyWhen(form, entry) {
    if (!form) return;
    const probe = deepClone(entry) || {};
    walkScope(form, "", probe, null, form);
    $$("[data-when]", form).forEach((el) => {
      let cond = null;
      try {
        cond = JSON.parse(el.getAttribute("data-when"));
      } catch (_) {
        return;
      }
      const row = el.closest(".ed-list-row");
      let scopeObj = probe;
      if (row) {
        scopeObj = {};
        walkScope(row, "", scopeObj, null, form);
      }
      el.hidden = !evalWhen(cond, getPathVal(scopeObj, cond.field));
    });
  }
  /** Live preview: refresh conditional visibility + the read-only Raw JSON mirror. */
  function liveSync(form, entry) {
    if (!form) return;
    applyWhen(form, entry);
    const probe = deepClone(entry) || {};
    fillFromForm(probe, form, null);
    const ta = $("#ed-raw");
    if (ta && document.activeElement !== ta) ta.value = JSON.stringify(probe, null, 2);
  }
  function onFormInput(ev, form, entry) {
    const t = ev && ev.target;
    if (t && t.classList && t.classList.contains("ed-color-pick")) {
      const txt = t.parentElement && t.parentElement.querySelector("[data-t='color']");
      if (txt) txt.value = t.value;
    }
    liveSync(form, entry);
  }
  function renumberRows(host) {
    $$(".ed-list-row", host).forEach((r, i) => {
      const idx = r.querySelector(".ed-list-idx");
      if (idx) idx.textContent = String(i + 1);
    });
  }
  function onFormClick(ev, form, entry) {
    const t = ev && ev.target;
    if (!t || !t.classList) return;
    if (t.classList.contains("ed-list-add")) {
      const host = t.closest(".ed-ctrl") && t.closest(".ed-ctrl").querySelector("[data-list]");
      if (host) {
        let fields = [];
        try {
          fields = JSON.parse(host.dataset.fields || "[]");
        } catch (_) {}
        host.insertAdjacentHTML(
          "beforeend",
          listRowHtml(fields, null, host.querySelectorAll(".ed-list-row").length)
        );
      }
    } else if (t.classList.contains("ed-list-del")) {
      const row = t.closest(".ed-list-row");
      const host = t.closest("[data-list]");
      if (row) row.remove();
      if (host) renumberRows(host);
    } else if (t.classList.contains("ed-kv-add")) {
      const host = t.closest(".ed-ctrl") && t.closest(".ed-ctrl").querySelector("[data-kv]");
      if (host) host.insertAdjacentHTML("beforeend", kvRowHtml("", ""));
    } else if (t.classList.contains("ed-kv-del")) {
      const row = t.closest(".ed-kv-row");
      if (row) row.remove();
    } else {
      return;
    }
    liveSync(form, entry);
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
    const isProcess = key === "processes" || key === "programV2";
    const isProgramV2 = key === "programV2";

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
      <details class="ed-raw"><summary>Raw JSON (read-only preview — the form is what saves)</summary><textarea id="ed-raw" rows="12" readonly spellcheck="false"></textarea></details>`;

    const form = $("#ed-form");
    form.innerHTML = renderSectionedForm(key, fields, entry);
    form.addEventListener("input", (ev) => onFormInput(ev, form, entry));
    form.addEventListener("change", () => liveSync(form, entry));
    form.addEventListener("click", (ev) => onFormClick(ev, form, entry));
    applyWhen(form, entry);
    liveSync(form, entry);

    $("#ed-back")?.addEventListener("click", () => {
      state.editIndex = null;
      state.openSteps = new Set(["0"]);
      renderMain();
    });
    $("#ed-save")?.addEventListener("click", () => {
      const errors = [];
      if (!readFormInto(entry, form, errors)) {
        alert("Fix these fields before saving:\n• " + errors.join("\n• "));
        return;
      }
      syncRaw(entry);
      save();
      state.editIndex = null;
      renderMain();
    });

    if (isProcess) {
      if (!Array.isArray(entry.steps)) entry.steps = [];
      state.programMode = isProgramV2 ? "v2" : "v1";
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


  function nsColor(ns) {
    const map = {
      elements: "#f87171",
      structures: "#34d399",
      terrains: "#a3a3a3",
      grid: "#6b9eff",
      energy: "#fbbf24",
      items: "#c084fc",
      player: "#2dd4bf",
      projectiles: "#fb923c",
      tech: "#e879f9",
      upgrades: "#f472b6",
      signals: "#22d3ee",
      effects: "#fbbf24",
      ui: "#a78bfa",
      sprites: "#60a5fa",
      storage: "#94a3b8",
      settings: "#94a3b8",
      random: "#f472b6",
      rendering: "#818cf8",
      assets: "#a3e635",
      hooks: "#f97316",
      api: "#ffe700",
    };
    return map[ns] || "#888";
  }

  function renderActionCatalog(entry) {
    const host = $("#ed-catalog");
    if (!host) return;
    const v2 = state.programMode === "v2";
    const families = v2 ? S().PROGRAM_V2_FAMILIES || {} : S().ACTION_FAMILIES || {};
    const famKeys = Object.keys(families);
    const cf = state.catalogFilter || { cell: false, returns: false };
    let html =
      '<div class="ed-catalog-head">' +
      (v2 ? "mysandkit api · Program v2" : "Action catalog") +
      (v2
        ? '<div class="ed-catalog-filters">' +
          '<label class="ed-cat-filter"><input type="checkbox" id="cf-cell"' +
          (cf.cell ? " checked" : "") +
          '/> cell</label>' +
          '<label class="ed-cat-filter"><input type="checkbox" id="cf-returns"' +
          (cf.returns ? " checked" : "") +
          '/> returns value</label>' +
          "</div>"
        : "") +
      "</div>";
    if (famKeys.length) {
      famKeys.forEach((fk, i) => {
        const fam = families[fk];
        const title = (fam.title || fk).split("—")[0].trim();
        const open = i < 3 ? " open" : "";
        html +=
          '<details class="ed-catalog-fam"' +
          open +
          "><summary>" +
          escapeHtml(title) +
          ' <span class="ed-muted">(' +
          (fam.keys || []).length +
          ")</span></summary><div class=\"ed-catalog-list\">";
        (fam.keys || []).forEach((key) => {
          if (v2) {
            const meta = (S().PROGRAM_V2_META && S().PROGRAM_V2_META[key]) || {};
            if (cf.cell && !meta.cell) return;
            if (cf.returns && !meta.returns) return;
            const doc = ((S().PROGRAM_V2_DOCS && S().PROGRAM_V2_DOCS[key]) || "").slice(0, 120);
            const ret = (S().PROGRAM_V2_RETURNS && S().PROGRAM_V2_RETURNS[key]) || "";
            const col = nsColor(fk);
            const short = key.includes(".") ? key.split(".").slice(1).join(".") : key;
            html +=
              '<div class="ed-catalog-item" draggable="true" data-action="' +
              escapeAttr(key) +
              '" data-role="' +
              escapeAttr(fk) +
              '" style="border-left:3px solid ' +
              col +
              '" title="' +
              escapeAttr(doc) +
              '"><span class="ed-role-tag" style="background:' +
              col +
              '">' +
              escapeHtml(fk) +
              "</span> " +
              escapeHtml(short) +
              (ret
                ? ' <span class="ed-muted">→ ' + escapeHtml(String(ret).slice(0, 24)) + "</span>"
                : "") +
              "</div>";
          } else {
            const doc = ((S().ACTION_DOCS && S().ACTION_DOCS[key]) || "").slice(0, 80);
            const role = S().roleOf ? S().roleOf(key) : "act";
            const col = (S().ROLE_COLOR && S().ROLE_COLOR[role]) || "#888";
            const rlab = (S().ROLE_LABELS && S().ROLE_LABELS[role]) || role;
            html +=
              '<div class="ed-catalog-item" draggable="true" data-action="' +
              escapeAttr(key) +
              '" data-role="' +
              escapeAttr(role) +
              '" style="border-left:3px solid ' +
              col +
              '" title="' +
              escapeAttr(rlab + " · " + doc) +
              '"><span class="ed-role-tag" style="background:' +
              col +
              '">' +
              escapeHtml(rlab) +
              "</span> " +
              escapeHtml(key) +
              "</div>";
          }
        });
        html += "</div></details>";
      });
    } else if (!v2) {
      const acts = S().ACTIONS || {};
      Object.keys(acts).forEach((role) => {
        const col = (S().ROLE_COLOR && S().ROLE_COLOR[role]) || "#888";
        const rlab = (S().ROLE_LABELS && S().ROLE_LABELS[role]) || role;
        html +=
          '<details class="ed-catalog-fam" open><summary>' +
          escapeHtml(rlab) +
          '</summary><div class="ed-catalog-list">';
        (acts[role] || []).forEach((key) => {
          html +=
            '<div class="ed-catalog-item" draggable="true" data-action="' +
            escapeAttr(key) +
            '" data-role="' +
            escapeAttr(role) +
            '" style="border-left:3px solid ' +
            col +
            '"><span class="ed-role-tag" style="background:' +
            col +
            '">' +
            escapeHtml(rlab) +
            "</span> " +
            escapeHtml(key) +
            "</div>";
        });
        html += "</div></details>";
      });
    }
    if (!v2) {
      const bcol = (S().ROLE_COLOR && S().ROLE_COLOR.block) || "#e879f9";
      html +=
        '<details class="ed-catalog-fam"><summary>Control</summary><div class="ed-catalog-list">' +
        '<div class="ed-catalog-item" draggable="true" data-action="if" data-role="block" style="border-left:3px solid ' +
        bcol +
        '"><span class="ed-role-tag" style="background:' +
        bcol +
        '">Block</span> if</div></div></details>';
    }
    host.innerHTML = html;

    host.querySelector("#cf-cell")?.addEventListener("change", (ev) => {
      state.catalogFilter.cell = !!ev.target.checked;
      renderActionCatalog(entry);
    });
    host.querySelector("#cf-returns")?.addEventListener("change", (ev) => {
      state.catalogFilter.returns = !!ev.target.checked;
      renderActionCatalog(entry);
    });

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
    let role, roleCol, roleLab;
    if (state.programMode === "v2") {
      role = (step.key || "").split(".")[0] || "api";
      roleCol = nsColor(role);
      roleLab = role;
    } else {
      role = step.key === "if" ? "block" : S().roleOf ? S().roleOf(step.key) : "act";
      roleCol = (S().ROLE_COLOR && S().ROLE_COLOR[role]) || "#888";
      roleLab = (S().ROLE_LABELS && S().ROLE_LABELS[role]) || role;
    }
    wrap.style.borderLeft = "3px solid " + roleCol;
    wrap.dataset.role = role;
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
      '</span><span class="ed-role-tag" style="background:' +
      roleCol +
      '">' +
      escapeHtml(roleLab) +
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
    let doc = "";
    let apis = [];
    let returns = "";
    if (state.programMode === "v2") {
      doc = (S().PROGRAM_V2_DOCS && S().PROGRAM_V2_DOCS[step.key]) || "";
      returns = (S().PROGRAM_V2_RETURNS && S().PROGRAM_V2_RETURNS[step.key]) || "";
      apis = ["mysandkit.api." + step.key];
    } else {
      doc = (S().ACTION_DOCS && S().ACTION_DOCS[step.key]) || "";
      apis = (S().ACTION_APIS && S().ACTION_APIS[step.key]) || [];
    }
    if (doc || apis.length || returns) {
      const docEl = document.createElement("p");
      docEl.className = "ed-step-doc";
      docEl.textContent = doc;
      if (returns) {
        docEl.innerHTML +=
          '<br/><span class="ed-muted">returns <code>' +
          escapeHtml(String(returns)) +
          "</code></span>";
      }
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
    if (state.programMode === "v2") {
      const raw = (S().PROGRAM_V2_PARAMS && S().PROGRAM_V2_PARAMS[actionKey]) || [];
      return raw.map((p) => ({
        key: p.key,
        label: p.label || p.key,
        type: p.type || "text",
        hint: p.ts ? String(p.ts) : "",
        def: p.def || "",
        required: !p.optional,
        options: [],
        content: p.content || null,
      }));
    }
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

    // cell type: {x,y} as one control → writes options[xKey], options[yKey]
    if (pr.type === "cell" || pr.key === "cell") {
      lab.classList.add("ed-field-wide");
      const keys = pr.keys || ["x", "y"];
      const xKey = keys[0] || "x";
      const yKey = keys[1] || "y";
      title.innerHTML =
        escapeHtml(pr.label || "cell") +
        ' <span class="ed-muted">{x, y}</span>' +
        (pr.required ? " *" : "");
      lab.appendChild(title);
      const row = document.createElement("div");
      row.className = "ed-cell-row";
      const xInp = document.createElement("input");
      xInp.type = "number";
      xInp.placeholder = xKey;
      xInp.value = step.options[xKey] != null ? String(step.options[xKey]) : "";
      const yInp = document.createElement("input");
      yInp.type = "number";
      yInp.placeholder = yKey;
      yInp.value = step.options[yKey] != null ? String(step.options[yKey]) : "";
      const sync = () => {
        const xv = xInp.value.trim();
        const yv = yInp.value.trim();
        if (xv === "") delete step.options[xKey];
        else step.options[xKey] = Number(xv);
        if (yv === "") delete step.options[yKey];
        else step.options[yKey] = Number(yv);
        // also store cell object for clarity
        if (xv !== "" && yv !== "") step.options.cell = { x: Number(xv), y: Number(yv) };
        else delete step.options.cell;
        if (entry) syncRaw(entry);
      };
      xInp.addEventListener("change", sync);
      yInp.addEventListener("change", sync);
      row.appendChild(xInp);
      row.appendChild(yInp);
      lab.appendChild(row);
      return lab;
    }

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
