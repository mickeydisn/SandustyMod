// ../../packages/dev/index.ts
function pruneStaleBuildings(PRUNE_MOD_ID) {
  const keep = /* @__PURE__ */ new Set();
  const buildings = sandkit.state?.store?.player?.buildings;
  if (!Array.isArray(buildings)) return [];
  const stale = buildings.filter((entry) => typeof entry === "string" && entry.startsWith(PRUNE_MOD_ID) && !keep.has(entry));
  if (stale.length === 0) return [];
  for (const id of stale) {
    const index = buildings.indexOf(id);
    if (index >= 0) buildings.splice(index, 1);
  }
  return stale;
}
function findOrphanedObjects(PRUNE_MOD_ID) {
  const keep = /* @__PURE__ */ new Set();
  const counts = /* @__PURE__ */ new Map();
  const structures = sandkit.state?.store?.structures;
  if (!Array.isArray(structures)) return counts;
  for (const structure of structures) {
    const type = structure?.type;
    if (typeof type !== "string" || !type.startsWith(PRUNE_MOD_ID) || keep.has(type)) continue;
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return counts;
}

// ../../packages/element-profiles/src/shared/util.ts
function safe(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

// ../../packages/element-profiles/src/main/build.ts
function elementNameKey(id) {
  return `${id}|name`;
}
function elementDescriptionKey(id) {
  return `${id}|description`;
}
function registerI18n(elements, locale) {
  const api = sandkit.api;
  for (const { spec: spec2 } of elements) {
    api.i18n.register(locale, {
      [elementNameKey(spec2.id)]: spec2.name,
      [elementDescriptionKey(spec2.id)]: spec2.description
    });
  }
}
function registerElements(elements, types) {
  const api = sandkit.api;
  for (const { spec: spec2 } of elements) {
    const elementTypeId = api.elements.register({
      id: spec2.id,
      nameKey: elementNameKey(spec2.id),
      descriptionKey: elementDescriptionKey(spec2.id),
      colors: {
        variants: spec2.colors
      },
      density: spec2.density,
      metaColor: spec2.metaColor,
      matterType: spec2.matterType
    }).elementType;
    types[spec2.key] = elementTypeId;
    api.discoveries.addElementByType(elementTypeId);
  }
}
function registerReactions(elements, types) {
  const api = sandkit.api;
  for (const { reactions } of elements) {
    for (const r of reactions) {
      api.reactions.registerContact({
        inputA: types[r.inputA],
        inputB: types[r.inputB],
        outputA: r.outputA ? types[r.outputA] : null,
        outputB: r.outputB ? types[r.outputB] : null
      });
    }
  }
}
function registerTech(tech, locale) {
  const api = sandkit.api;
  api.i18n.register(tech.locale ?? locale, {
    [tech.nameKey]: tech.name,
    [tech.descriptionKey]: tech.description
  });
  let parentId = null;
  for (const name of tech.parents ?? []) {
    const id = safe(() => sandkit.enums?.Tech?.[name]);
    if (id != null) {
      parentId = id;
      break;
    }
  }
  if (parentId == null) return false;
  api.tech.registerNode(tech.id, {
    nameKey: tech.nameKey,
    descriptionKey: tech.descriptionKey,
    cost: tech.cost ?? 0
  }, {
    parentId
  });
  return true;
}
function buildElementMain(config) {
  const locale = config.locale ?? "en";
  const types = {
    ...config.types
  };
  registerI18n(config.elements, locale);
  registerElements(config.elements, types);
  registerReactions(config.elements, types);
  const techRegistered = config.tech ? registerTech(config.tech, locale) : false;
  return {
    types,
    techRegistered
  };
}

// ../../packages/assets/src/loader.ts
async function loadSpriteMap(modId, entries, idPrefix) {
  const ids = {};
  let next = 0;
  const worker = async () => {
    while (next < entries.length) {
      const entry = entries[next++];
      const spriteId = `${modId}:${idPrefix ?? ""}${entry.id}`;
      try {
        await sandkit.api.sprites.loadFromMod(spriteId, `${entry.filePath}`);
        ids[entry.id] = spriteId;
      } catch (e) {
        console.error(`${modId}: Unknow Asset:  ${entry.filePath}`);
        console.error("Thrown value:", e);
      }
    }
  };
  await Promise.all(Array.from({
    length: Math.min(16, entries.length)
  }, () => worker()));
  return ids;
}

// ../../packages/buffer/src/utils/codec.ts
function decodeJson(buffer) {
  try {
    const end = buffer.indexOf(0);
    const bytes = buffer.slice(0, end === -1 ? buffer.length : end);
    const result = new TextDecoder().decode(bytes);
    const obj = JSON.parse(result);
    return obj;
  } catch (e) {
    console.error("readJsonString failed", e);
  }
  return null;
}
function encodeJsonInBuffer(buf, value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  if (bytes.length > buf.length) {
    throw new Error(`JSON payload of ${bytes.length} bytes does not fit in ${buf.length}-byte buffer`);
  }
  buf.fill(0);
  buf.set(bytes);
  return bytes;
}

// ../../packages/buffer/src/utils/paths.ts
var TOKEN = /([^[.\]]+)|\[(\d+)\]|(\[\])/g;
function parsePath(path) {
  if (!path) return [];
  const out = [];
  const re = new RegExp(TOKEN.source, "g");
  let m;
  while ((m = re.exec(path)) !== null) {
    if (m[1] !== void 0) out.push(/^\d+$/.test(m[1]) ? Number(m[1]) : m[1]);
    else if (m[2] !== void 0) out.push(Number(m[2]));
    else if (m[3] !== void 0) out.push("[]");
  }
  return out;
}
function getPath(root, path) {
  let cur = root;
  for (const part of parsePath(path)) {
    if (part === "[]") continue;
    if (cur == null) return void 0;
    cur = cur[part];
  }
  return cur;
}
function ensureChild(cur, part, nextIsIndex) {
  if (part === "[]") {
    throw new Error(`setPath: "[]" cannot appear in the middle of a path being written to.`);
  }
  if (typeof part === "number") {
    if (!Array.isArray(cur)) {
      throw new Error(`setPath: expected an array to index into at "[${part}]"`);
    }
    while (cur.length <= part) cur.push(nextIsIndex ? [] : {});
    if (cur[part] == null || typeof cur[part] !== "object") {
      cur[part] = nextIsIndex ? [] : {};
    }
  } else {
    if (cur == null || typeof cur !== "object") {
      throw new Error(`setPath: cannot descend into "${part}" of a non-object`);
    }
    if (cur[part] == null || typeof cur[part] !== "object") {
      cur[part] = nextIsIndex ? [] : {};
    }
  }
  return cur[part];
}
function setPath(root, path, value) {
  const parts = parsePath(path);
  if (parts.length === 0) return;
  const last = parts[parts.length - 1];
  if (last === "[]") {
    throw new Error(`setPath: "${path}" ends in "[]" (whole array), which isn't settable. Use a numeric index to write an element, or addToPath()/pushPath() to append.`);
  }
  let cur = root;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = ensureChild(cur, parts[i], typeof parts[i + 1] === "number");
  }
  if (typeof last === "number") {
    if (!Array.isArray(cur)) throw new Error(`setPath: expected an array at "${path}"`);
    while (cur.length <= last) cur.push(void 0);
    cur[last] = value;
  } else {
    cur[last] = value;
  }
}
function pushPath(root, path, value) {
  let arr = getPath(root, path);
  if (!Array.isArray(arr)) {
    arr = [];
    setPath(root, path, arr);
  }
  arr.push(value);
  return arr.length;
}
function addToPath(root, path, value) {
  const existing = getPath(root, path);
  const arrExists = Array.isArray(existing);
  const item = value ?? (arrExists && existing.length > 0 ? defaultLike(existing[0]) : null);
  const len = pushPath(root, path, item);
  return len - 1;
}
function defaultLike(sample) {
  if (sample === null || sample === void 0) return null;
  if (typeof sample === "boolean") return false;
  if (typeof sample === "number") return 0;
  if (typeof sample === "string") return "";
  if (Array.isArray(sample)) return [];
  if (typeof sample === "object") {
    const out = {};
    for (const [k, v] of Object.entries(sample)) out[k] = defaultLike(v);
    return out;
  }
  return null;
}
function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}
function formatPath(parts) {
  let out = "";
  for (const p of parts) {
    if (typeof p === "number") out += `[${p}]`;
    else if (p === "[]") out += "[]";
    else out += out ? `.${p}` : p;
  }
  return out;
}

// ../../packages/buffer/src/utils/introspect.ts
function listPaths(root, maxDepth = 8, includeContainers = true) {
  const out = [];
  const labelFor = (parts, path) => {
    const last = parts[parts.length - 1];
    const named = last === "[]" ? parts[parts.length - 2] : last;
    return named !== void 0 ? String(named) : path;
  };
  const visit = (value, parts, depth) => {
    if (depth > maxDepth) return;
    const kind = kindOf(value);
    const path = formatPath(parts);
    const label = labelFor(parts, path);
    if (kind === "object" && value) {
      if (includeContainers && parts.length > 0) out.push({
        path,
        kind,
        label,
        value
      });
      for (const [k, v] of Object.entries(value)) {
        visit(v, [
          ...parts,
          k
        ], depth + 1);
      }
      return;
    }
    if (kind === "array") {
      const arr = value;
      if (includeContainers && parts.length > 0) out.push({
        path,
        kind,
        label,
        value
      });
      if (arr.length === 0) {
        out.push({
          path: formatPath([
            ...parts,
            "[]"
          ]),
          kind: "array",
          label,
          value: []
        });
        return;
      }
      visit(arr[0], [
        ...parts,
        "[]"
      ], depth + 1);
      return;
    }
    if (parts.length === 0) return;
    out.push({
      path,
      kind,
      label,
      value
    });
  };
  visit(root, [], 0);
  return out;
}
function kindOf(value) {
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  if (Array.isArray(value)) return "array";
  if (value && typeof value === "object") return "object";
  return "string";
}

// ../../packages/buffer/src/sand.ts
var ensureBuffer = (key, config) => {
  const buffers = sandkit.api.shared?.buffers;
  if (!buffers) return null;
  const existing = buffers.get?.(key);
  if (existing) return existing;
  if (buffers.ensure) return buffers.ensure(key, config);
  if (buffers.require) return buffers.require(key, config);
  return null;
};

// ../../packages/buffer/src/json-buffer.ts
var DEFAULT_MAX_BYTES = 64 * 1024;
var JsonBuffer = class {
  versionView;
  dataView;
  modId;
  key;
  defaultRecord;
  assertShape;
  cache;
  localVersion;
  useAtomics = true;
  listeners = /* @__PURE__ */ new Set();
  notify = () => {
    for (const fn of this.listeners) fn(this.cache);
  };
  subscribe(fn) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  constructor(modId, key, defaultRecord, assertShape, percist = false, percistLoad = false, observe = false) {
    this.modId = modId;
    this.key = key;
    this.defaultRecord = defaultRecord;
    this.assertShape = assertShape;
    this.versionView = ensureBuffer(`${key}:ver`, {
      type: "int32",
      length: 1
    });
    try {
      Atomics.load(this.versionView, 0);
    } catch {
      this.useAtomics = false;
    }
    this.dataView = ensureBuffer(`${key}:json`, {
      type: "uint8",
      length: DEFAULT_MAX_BYTES
    });
    if (this.remoteVersion() > 0) {
      this.cache = this.readFromBuffer();
      this.localVersion = this.remoteVersion();
    } else if (observe) {
      this.cache = this.defaultRecord ? deepClone(this.defaultRecord) : {};
      this.localVersion = this.remoteVersion();
    } else {
      const storedRecord = !percistLoad ? false : sandkit.api.storage.local.get(this.key);
      if (percist) {
        sandkit.api.events.on("store:save", (_payload) => {
          this.commit();
          this.save();
        });
      }
      this.cache = storedRecord ? storedRecord : this.defaultRecord ? deepClone(this.defaultRecord) : {};
      this.localVersion = -1;
      this.commit();
    }
  }
  remoteVersion = () => {
    return this.useAtomics ? Atomics.load(this.versionView, 0) : this.versionView[0];
  };
  version = () => {
    return this.localVersion;
  };
  readFromBuffer = () => {
    const record = decodeJson(this.dataView) ?? {};
    return record;
  };
  pull() {
    const remote = this.remoteVersion();
    if (remote === this.localVersion) return null;
    this.cache = this.readFromBuffer();
    this.localVersion = remote;
    this.notify();
    return this.cache;
  }
  hasUpdate = () => this.remoteVersion() !== this.localVersion;
  get() {
    this.pull();
    return this.cache;
  }
  getPath(path) {
    this.pull();
    return getPath(this.cache, path);
  }
  listPaths(maxDepth = 8, includeContainers = true) {
    this.pull();
    return listPaths(this.cache, maxDepth, includeContainers);
  }
  setPath(path, value) {
    setPath(this.cache, path, value);
  }
  addToPath(path, value) {
    addToPath(this.cache, path, value);
  }
  replace(next) {
    this.cache = deepClone(next);
  }
  commit() {
    this.assertShape?.(this.cache);
    encodeJsonInBuffer(this.dataView, this.cache);
    this.localVersion = this.useAtomics ? Atomics.add(this.versionView, 0, 1) + 1 : this.versionView[0] += 1;
    this.notify();
  }
  save() {
    sandkit.api.storage.local.set(this.key, this.cache);
  }
};

// ../../packages/buffer/src/json-map-buffer.ts
var DEFAULT_MAX_BYTES2 = 64 * 1024;

// ../../packages/catalogue/src/list/createBuildList.ts
var MIRROR_SUFFIX = "~mirrored";
function compareSizes(a, b) {
  const [aw, ah] = a.split("x").map(Number);
  const [bw, bh] = b.split("x").map(Number);
  return (aw || 0) - (bw || 0) || (ah || 0) - (bh || 0);
}
var itemTypePrefix = (modId) => `${modId}:item/`;
function typeOfCatalogueItem(modId, itemId, mirrored = false) {
  return `${itemTypePrefix(modId)}${itemId}${mirrored ? MIRROR_SUFFIX : ""}`;
}
function itemIdFromType(modId, type) {
  const prefix = itemTypePrefix(modId);
  if (!type.startsWith(prefix)) return null;
  let id = type.slice(prefix.length);
  if (id.endsWith(MIRROR_SUFFIX)) id = id.slice(0, -MIRROR_SUFFIX.length);
  return id;
}
function findItem(items, id) {
  return items.find((entry) => entry.id === id);
}
var createBuildList = (options) => {
  const catalogueItems = options.catalogueItems.slice();
  let selectedId = options.selectedId ?? catalogueItems[0]?.id ?? "";
  let category = findItem(catalogueItems, selectedId)?.category ?? catalogueItems[0]?.category ?? "";
  let path = findItem(catalogueItems, selectedId)?.path ?? catalogueItems[0]?.path ?? "";
  let mirrored = false;
  let selectedTags = [];
  let selectedSizes = [];
  const listeners = {
    select: /* @__PURE__ */ new Set(),
    place: /* @__PURE__ */ new Set(),
    remove: /* @__PURE__ */ new Set(),
    category: /* @__PURE__ */ new Set(),
    path: /* @__PURE__ */ new Set(),
    mirror: /* @__PURE__ */ new Set(),
    tag: /* @__PURE__ */ new Set()
  };
  const emit = (name, event) => {
    for (const h2 of listeners[name]) {
      try {
        h2(event);
      } catch (err) {
        console.error("[panel-build-list]", name, err);
      }
    }
  };
  const list = {
    modId: options.modId,
    menuId: options.menuId,
    menuLabel: options.menuLabel,
    catalogueItems,
    // categories: categories,
    getSelected() {
      return findItem(catalogueItems, selectedId);
    },
    getSelectedType() {
      return typeOfCatalogueItem(options.modId, selectedId, mirrored);
    },
    setSelected(id) {
      const item = findItem(catalogueItems, id);
      if (!item) return;
      selectedId = id;
      category = item.category;
      emit("select", {
        item,
        mirrored
      });
    },
    isMirrored: () => mirrored,
    setMirrored(next) {
      mirrored = next;
      emit("mirror", {
        mirrored
      });
    },
    getCategory: () => category,
    setCategory(id) {
      category = id;
      emit("category", {
        categoryId: id
      });
    },
    getPath: () => path,
    setPath(id) {
      path = id;
      emit("path", {
        path: id
      });
    },
    allTags() {
      const set = /* @__PURE__ */ new Set();
      for (const it of catalogueItems) {
        for (const t of it.tags ?? []) set.add(t);
      }
      return [
        ...set
      ].sort();
    },
    allCategories() {
      const set = /* @__PURE__ */ new Set();
      for (const it of catalogueItems) {
        set.add(it.category);
      }
      return [
        ...set
      ].sort();
    },
    allPaths() {
      const set = /* @__PURE__ */ new Set();
      for (const it of catalogueItems) {
        set.add(it.path);
      }
      return [
        ...set
      ].sort();
    },
    allSizes() {
      const set = /* @__PURE__ */ new Set();
      for (const it of catalogueItems) {
        for (const s of it.sizes ?? []) set.add(s);
      }
      return [
        ...set
      ].sort(compareSizes);
    },
    getSelectedTags: () => selectedTags.slice(),
    setSelectedTags(tags) {
      selectedTags = tags.filter((t, i) => tags.indexOf(t) === i && catalogueItems.some((it) => (it.tags ?? []).includes(t)));
      emit("tag", {
        tags: selectedTags,
        sizes: selectedSizes
      });
    },
    toggleTag(tag) {
      const next = selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [
        ...selectedTags,
        tag
      ];
      list.setSelectedTags(next);
    },
    getSelectedSizes: () => selectedSizes.slice(),
    setSelectedSizes(sizes) {
      selectedSizes = sizes.filter((s, i) => sizes.indexOf(s) === i && catalogueItems.some((it) => (it.sizes ?? []).includes(s)));
      emit("tag", {
        tags: selectedTags,
        sizes: selectedSizes
      });
    },
    toggleSize(size) {
      const next = selectedSizes.includes(size) ? selectedSizes.filter((s) => s !== size) : [
        ...selectedSizes,
        size
      ];
      list.setSelectedSizes(next);
    },
    itemsInCategory(id) {
      const cat = id ?? category;
      return catalogueItems.filter((it) => it.category === cat);
    },
    itemsInPath(path2) {
      return catalogueItems.filter((it) => it.path === path2);
    },
    countIn(categoryId) {
      return catalogueItems.reduce((n, it) => n + (it.category === categoryId ? 1 : 0), 0);
    },
    structureType: (itemId, mir) => typeOfCatalogueItem(options.modId, itemId, mir ?? mirrored),
    itemFromType(type) {
      const id = itemIdFromType(options.modId, type);
      return id ? findItem(catalogueItems, id) : void 0;
    },
    on(name, handler) {
      const set = listeners[name];
      set.add(handler);
      return () => set.delete(handler);
    },
    notifyPlace(x, y, type) {
      const used = type ?? list.getSelectedType();
      const item = list.itemFromType(used);
      if (!item) return null;
      const payload = {
        item,
        type: used,
        x,
        y,
        mirrored: type ? type.endsWith(MIRROR_SUFFIX) : mirrored
      };
      emit("place", payload);
      return payload;
    },
    notifyRemove(x, y, type) {
      const item = list.itemFromType(type);
      if (!item) return null;
      const payload = {
        item,
        type,
        x,
        y,
        mirrored: type.endsWith(MIRROR_SUFFIX)
      };
      emit("remove", payload);
      return payload;
    },
    applyToBuildTool() {
      sandkit.api.building?.selectStructure?.(list.getSelectedType());
    }
  };
  if (sandkit.api.events?.on) {
    sandkit.api.events.on("building:placed", (payload) => {
      const p = payload;
      const structure = p.structure;
      if (!structure?.type) return;
      if (!structure.type.startsWith(`${options.modId}:`)) return;
      list.notifyPlace(structure.x, structure.y, structure.type);
    });
    sandkit.api.events.on("building:removed", (payload) => {
      const p = payload;
      const type = String(p.structureId ?? p.type ?? "");
      const x = Number(p.x);
      const y = Number(p.y);
      if (!type.startsWith(`${options.modId}:`)) return;
      list.notifyRemove(x, y, type);
    });
  }
  return list;
};

// ../../packages/catalogue/src/list/persistence.ts
var KEY_SELECTED = "picker.selected";
var KEY_MIRROR = "picker.mirror";
var KEY_CATEGORY = "picker.category";
var KEY_TAGS = "picker.tags";
var KEY_SIZES = "picker.sizes";
function restorePickerState(list) {
  if (!sandkit.api.storage) return;
  try {
    const selected = sandkit.api.storage.get(list.modId, KEY_SELECTED);
    if (typeof selected === "string" && list.catalogueItems.some((i) => i.id === selected)) {
      list.setSelected(selected);
    }
    const mirrored = sandkit.api.storage.get(list.modId, KEY_MIRROR);
    if (typeof mirrored === "boolean") list.setMirrored(mirrored);
    const category = sandkit.api.storage.get(list.modId, KEY_CATEGORY);
    if (typeof category === "string") list.setCategory(category);
    const tags = sandkit.api.storage.get(list.modId, KEY_TAGS);
    if (Array.isArray(tags)) list.setSelectedTags(tags);
    const sizes = sandkit.api.storage.get(list.modId, KEY_SIZES);
    if (Array.isArray(sizes)) list.setSelectedSizes(sizes);
  } catch (err) {
    console.warn("[picker-overlay] could not restore selection", err);
  }
}
function persistSelection(list) {
  if (!sandkit.api.storage) return;
  try {
    sandkit.api.storage.set(list.modId, KEY_SELECTED, list.getSelected()?.id ?? "");
    sandkit.api.storage.set(list.modId, KEY_MIRROR, list.isMirrored());
    sandkit.api.storage.set(list.modId, KEY_CATEGORY, list.getCategory());
    sandkit.api.storage.set(list.modId, KEY_TAGS, list.getSelectedTags());
    sandkit.api.storage.set(list.modId, KEY_SIZES, list.getSelectedSizes());
  } catch (err) {
    console.warn("[picker-overlay] could not persist selection", err);
  }
}

// ../../packages/catalogue/src/picker/react.ts
function h(type, props, ...children) {
  return sandkit.react.createElement(type, props, ...children);
}

// ../../packages/catalogue/src/picker/content.ts
var TOOLTIP_DELAY_MS = 120;
var SWATCH_BOX = 34;
var MAX_SWATCH_ZOOM = 4;
function createPickerCss() {
  console.log("[pkg-picker] injecting CSS");
  const css = `
        .pkg-picker-main-div {
            width: 70vw;
            max-width: 70vw;
            max-height: 20vh;
            min-height: 20vh;
            position: fixed;
            bottom: 6em;
            left: 50%;
            transform: translateX(-50%);
            z-index: 1000;    
            
            display: flex;
            flex-direction: column;
            overflow: hidden;
            background: rgba(0, 0, 0, 0.75);
            border: 1px solid #334;
            border-radius: 0.25rem;
            box-sizing: border-box;
            color: #ccc;
            font-size: 1rem;
            pointer-events: auto;
    }

    .pkg-picker-head {
        padding: .3rem .3rem;
        border-bottom: 1px solid #334;
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .pkg-picker-tooltip {
        font-size: 0.75rem;
        line-height: 1rem;

        position: fixed;
        transform: translate(-50%, -100%);
        padding: 2px 6px;
        white-space: nowrap;
        pointer-events: none;
        z-index: 1001;
        background: rgba(0, 0, 0, 0.9);
        border: 1px solid rgba(255, 255, 255, 0.25);
        border-radius: 3px;
        color: #fff;

    }
    `;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}
function createPickerView(options) {
  const { api } = options;
  const list = api.list;
  const search = "";
  let tooltip = null;
  let tooltipTimer = null;
  createPickerCss();
  const clearTooltip = () => {
    if (tooltipTimer) clearTimeout(tooltipTimer);
    tooltipTimer = null;
    if (!tooltip) return;
    tooltip = null;
    api.repaint();
  };
  const scheduleTooltip = (label, rect) => {
    if (tooltipTimer) clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => {
      tooltipTimer = null;
      tooltip = {
        label,
        x: rect.left + rect.width / 2,
        y: rect.top
      };
      api.repaint();
    }, TOOLTIP_DELAY_MS);
  };
  const spriteSrc = (item) => {
    const id = options.spriteIdFor?.(item) ?? item.spriteId ?? list.structureType(item.id, false);
    const r = sandkit.api.sprites.getById(id)?.imageAsset?.image?.src;
    return typeof r == "string" ? r : r;
  };
  const FocusableButton = (props) => {
    const navigation = sandkit.api.ui?.navigation;
    const focusable = navigation.useFocusable({
      id: props.id,
      scope: api.pickerId,
      onActivate: props.onActivate,
      scrollIntoView: true
    });
    const focusClass = navigation?.controllerFocusClass?.(!!focusable?.focused) ?? "";
    return h("button", {
      ref: focusable?.ref,
      type: "button",
      onClick: props.onActivate,
      onMouseEnter: props.onHoverStart ? (event) => {
        props.onHoverStart(event.currentTarget.getBoundingClientRect());
      } : void 0,
      onMouseLeave: props.onHoverEnd,
      className: `${props.className ?? ""} ${focusClass}`.trim()
    }, props.children);
  };
  const ObjectSwatch = (props) => {
    const src = spriteSrc(props.item);
    function swatchZoom(width, height, box = SWATCH_BOX) {
      const longest = Math.max(width, height);
      if (longest <= 0) return 1;
      return Math.max(1, Math.min(MAX_SWATCH_ZOOM, Math.floor(box / longest)));
    }
    const zoom = swatchZoom(props.item.width, props.item.height);
    return h(FocusableButton, {
      id: `${api.pickerId}-item-${props.item.id}`,
      onHoverStart: (rect) => {
        scheduleTooltip(`${props.item.label} \u2014 ${props.item.width}\xD7${props.item.height}`, rect);
      },
      onHoverEnd: clearTooltip,
      onActivate: () => api.selectItem(props.item),
      className: `w-10 h-10 rounded border-2 ${props.selected ? "border-yellow-400" : "border-slate-600"} hover:border-slate-400 flex items-center justify-center`,
      children: [
        src ? h("img", {
          key: "img",
          src,
          alt: props.item.label,
          style: {
            width: `${props.item.width * zoom}px`,
            height: `${props.item.height * zoom}px`,
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            imageRendering: "pixelated",
            display: "block"
          }
        }) : h("span", {
          key: "fallback",
          className: "text-xs"
        }, props.item.label.charAt(0))
      ]
    });
  };
  const Picker = () => {
    const [, bump] = sandkit.react.useState(0);
    const scrollRef = sandkit.react.useRef(null);
    const savedScrollRef = sandkit.react.useRef(0);
    const wasMinimizedRef = sandkit.react.useRef(true);
    sandkit.react.useEffect(() => {
      api.setRepaint(() => bump((n) => n + 1));
      api.setClearTooltip(() => clearTooltip);
      return () => {
        api.setRepaint(null);
        api.setClearTooltip(null);
      };
    }, []);
    const useLayoutEffect = sandkit.react.useLayoutEffect ?? sandkit.react.useEffect;
    useLayoutEffect(() => {
      const minimized = api.getState()?.minimized ?? true;
      if (!minimized && wasMinimizedRef.current && scrollRef.current) {
        scrollRef.current.scrollTop = savedScrollRef.current;
      }
      wasMinimizedRef.current = minimized;
    });
    const state = api.getState();
    if (!state) return null;
    const selected = list.getSelected();
    const availableTags = list.allTags();
    const availableCategorie = list.allCategories();
    const availablePath = list.allPaths();
    const selectedSizes = list.getSelectedSizes();
    const selectedTags = list.getSelectedTags();
    const selectedCategory = list.getCategory() || "";
    const selectedPath = list.getPath() || "";
    function filterItems(items, options2) {
      const q = options2.query.trim().toLowerCase();
      return items.filter((item) => {
        if (options2.categoryId && item.category !== options2.categoryId) return false;
        if (item.path && item.path !== options2.path) return false;
        if (options2.itemFilter && !options2.itemFilter(item)) return false;
        const itemTags = item.tags ?? [];
        if (options2.tags.length > 0 && !options2.tags.some((t) => itemTags.includes(t))) {
          return false;
        }
        const itemSizes = item.sizes ?? [];
        if (options2.sizes.length > 0 && !options2.sizes.some((s) => itemSizes.includes(s))) {
          return false;
        }
        if (!q) return true;
        const hay = `${item.label} ${item.id} ${item.description ?? ""} ${itemTags.join(" ")} ${itemSizes.join(" ")}`.toLowerCase();
        return hay.includes(q);
      });
    }
    const matchesTagGroup = (item) => {
      if (options.itemFilter && !options.itemFilter(item)) return false;
      const itemTags = item.tags ?? [];
      if (selectedTags.length > 0 && !selectedTags.some((t) => itemTags.includes(t))) {
        return false;
      }
      return true;
    };
    const availableSizes = (() => {
      const set = /* @__PURE__ */ new Set();
      for (const it of list.catalogueItems) {
        if (!matchesTagGroup(it)) continue;
        for (const s of it.sizes ?? []) set.add(s);
      }
      return [
        ...set
      ].sort(compareSizes);
    })();
    const matchesFilters = (item) => {
      if (options.itemFilter && !options.itemFilter(item)) return false;
      const itemTags = item.tags ?? [];
      if (selectedTags.length > 0 && !selectedTags.some((t) => itemTags.includes(t))) {
        return false;
      }
      const itemSizes = item.sizes ?? [];
      if (selectedSizes.length > 0 && !selectedSizes.some((s) => itemSizes.includes(s))) {
        return false;
      }
      return true;
    };
    const categoryFilters = (item) => {
      if (!selectedCategory) return true;
      return item.category == selectedCategory;
    };
    console.log("AVALIBEL CATEGORIE", availableCategorie, list);
    const visibleCategories = availableCategorie.map((cat) => ({
      id: cat,
      count: list.itemsInCategory(cat).filter(matchesFilters).length
    })).filter((c) => c.count > 0);
    console.log("AVALIBEL CATEGORIE: visibleCategories", visibleCategories);
    console.log("AVALIBEL  PATH", availableCategorie, list);
    const visiblePath = availablePath.map((path) => {
      return {
        id: path,
        count: list.itemsInPath(path).filter(matchesFilters).filter(categoryFilters).length
      };
    }).filter((c) => c.count > 0);
    console.log("AVALIBEL PATH: visiblePath", visiblePath);
    const visible = filterItems(list.catalogueItems, {
      path: selectedPath,
      categoryId: selectedCategory,
      query: search,
      tags: selectedTags,
      sizes: selectedSizes,
      itemFilter: options.itemFilter
    });
    console.log("AVALIBEL CATEGORIE", list, visible);
    if (state.minimized) {
      const src = selected ? spriteSrc(selected) : void 0;
      return h("div", {
        className: "pointer-events-auto flex items-center gap-2 bg-black bg-opacity-75 border border-slate-700 rounded px-3 py-2 ui-box text-slate-300",
        onClick: api.expand
      }, h("span", {
        className: "text-white text-xs opacity-70"
      }, api.title), h(FocusableButton, {
        id: `${api.pickerId}-selected`,
        onActivate: api.expand,
        className: "flex items-center gap-2 text-xs text-white hover:text-[#ffe700]",
        children: [
          h("div", {
            key: "swatch",
            className: "w-4 h-4 rounded border border-slate-600 flex items-center justify-center",
            style: {
              background: "#333",
              overflow: "hidden"
            }
          }, src ? h("img", {
            src,
            alt: "",
            style: {
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              imageRendering: "pixelated"
            }
          }) : null),
          h("span", {
            key: "label"
          }, selected?.label ?? "\u2014")
        ]
      }), list.isMirrored() ? h("span", {
        className: "text-xs text-[#ffe700]"
      }, "Mirrored") : null, h("span", {
        className: "text-xs text-slate-500"
      }, "Click to expand"));
    }
    const headEl = h("div", {
      className: "pkg-picker-head bg-black/30"
    }, h("span", {
      className: "text-white text-xs opacity-70"
    }, api.title), h(
      "div",
      {
        className: "flex items-center gap-2"
      },
      /*
               h(FocusableButton, {
                   id: `${api.pickerId}-mirror`,
                   onActivate: api.toggleMirror,
                   className: `text-xs px-2 py-0.5 border rounded ${
                       list.isMirrored()
                           ? "text-[#ffe700] border-yellow-400"
                           : "text-slate-300 border-slate-600"
                   }`,
                   children: `${list.isMirrored() ? "☑" : "☐"} Mirrored`,
               }),
               */
      h(FocusableButton, {
        id: `${api.pickerId}-minimize`,
        onActivate: api.minimize,
        className: "text-xs px-2 py-0.5 text-white bg-black border border-slate-600 rounded",
        children: "\u25BE"
      })
    ));
    const tooltipEl = !tooltip ? null : h("div", {
      className: "pkg-picker-tooltip",
      children: tooltip.label
    });
    const hVerticalItemsList = (name, contents) => h("div", {
      className: "flex flex-col items-center  overflow-y-auto"
    }, h("span", {
      className: "text-[10px] uppercase tracking-wide text-slate-500 pr-1"
    }, name), h("div", {
      className: "flex flex-col items-left gap-1  overflow-x-auto",
      style: {
        padding: "1px .8em 1px 1px"
      }
    }, ...contents));
    const filterTagEl = availableTags.length > 0 ? hVerticalItemsList("Tag:", availableTags.map((tag) => h(FocusableButton, {
      key: tag,
      id: `${api.pickerId}-tag-${tag}`,
      onActivate: () => api.toggleTag(tag),
      className: `text-xs px-2 py-0.5 rounded border ${selectedTags.includes(tag) ? "text-[#ffe700] border-yellow-400 bg-yellow-400/10" : "text-slate-400 border-slate-600"}`,
      children: `${selectedTags.includes(tag) ? "\u2611" : "\u2610"} ${tag}`
    }))) : [];
    const filterSizeEl = availableSizes.length > 0 ? hVerticalItemsList("Size:", availableSizes.map((size) => h(FocusableButton, {
      key: size,
      id: `${api.pickerId}-size-${size}`,
      onActivate: () => api.toggleSize(size),
      className: `text-xs px-2 py-0.5 rounded border ${selectedSizes.includes(size) ? "text-[#ffe700] border-yellow-400 bg-yellow-400/10" : "text-slate-400 border-slate-600"}`,
      children: `${selectedSizes.includes(size) ? "\u2611" : "\u2610"} ${size}`
    }))) : null;
    const categorieEl = hVerticalItemsList("Categorie:", visibleCategories.map((cat) => h(FocusableButton, {
      key: cat.id,
      id: `${api.pickerId}-cat-${cat.id}`,
      onActivate: () => {
        savedScrollRef.current = 0;
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
        api.chooseCategory(cat.id);
      },
      className: `text-xs px-2 py-0.5 rounded border w-[100px] ${cat.id === selectedCategory ? "text-[#ffe700] border-yellow-400" : "text-slate-400 border-slate-600"}`,
      children: `${cat.id}`
    })));
    const pathEl = hVerticalItemsList("Path:", visiblePath.map((path) => h(FocusableButton, {
      key: path.id,
      id: `${api.pickerId}-path-${path.id}`,
      onActivate: () => {
        savedScrollRef.current = 0;
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
        api.choosePath(path.id);
      },
      className: `text-xs px-2 py-0.5 rounded border w-[100px] ${path.id === selectedPath ? "text-[#ffe700] border-yellow-400" : "text-slate-400 border-slate-600"}`,
      children: `${path.id}`
    })));
    const filterClearEl = selectedTags.length > 0 || selectedSizes.length > 0 ? h(FocusableButton, {
      id: `${api.pickerId}-filters-clear`,
      onActivate: () => api.clearFilters(),
      className: "text-xs px-2 py-0.5 rounded border border-slate-600 text-slate-300 hover:text-white self-start",
      children: "Clear"
    }) : null;
    const filterEl = h("div", {
      className: "flex flex-col gap-1 px-1 py-1 border-b bg-black/30  overflow-y-auto"
    }, filterClearEl, h("div", {
      className: "flex flex-row gap-1 px-1 py-1 border-b bg-black/30  overflow-y-auto"
    }, filterSizeEl, filterTagEl, categorieEl, pathEl));
    const itemElemnts = h("div", {
      className: "min-h-0 flex-1 px-4 py-2  overflow-y-auto",
      style: {
        height: `18vh`
      },
      onScroll: (event) => {
        savedScrollRef.current = event.currentTarget.scrollTop;
      },
      ref: (node) => {
        scrollRef.current = node;
      }
    }, h("div", {
      className: "flex flex-wrap gap-1.5"
    }, visible.map((item) => h(ObjectSwatch, {
      key: item.id,
      item,
      selected: item.id === selected?.id
    }))));
    return h("div", {
      className: "pkg-picker-main-div"
    }, headEl, tooltipEl, h("div", {
      className: "flex-1 flex flex-row overflow-hidden"
    }, filterEl, itemElemnts));
  };
  return () => h(Picker, null);
}

// ../../packages/catalogue/src/picker/overlay.ts
function createPickerOverlay(options) {
  const list = options.list;
  const pickerId = options.pickerId ?? `${list.modId}/picker`;
  const slot = "hotbar";
  const title = options.title ?? "Pick item";
  let pickerState = null;
  let repaint = null;
  let clearTooltip = null;
  let unsubscribe = null;
  let registered = false;
  if (options.persistSelection !== false) restorePickerState(list);
  const unlockTypes = options.unlockTypes ?? ((types) => {
    for (const type of types) sandkit.api.player.buildings.unlockByType(type);
  });
  const persistIfEnabled = () => {
    if (options.persistSelection !== false) persistSelection(list);
  };
  const selectStructure = (type) => {
    unlockTypes([
      type
    ]);
    sandkit.api.building?.selectStructure?.(type);
  };
  const expand = () => {
    if (!pickerState?.minimized) return;
    pickerState = {
      minimized: false
    };
    repaint?.();
  };
  const minimize = () => {
    if (!pickerState || pickerState.minimized) return;
    clearTooltip?.();
    pickerState = {
      minimized: true
    };
    repaint?.();
  };
  const close = () => {
    clearTooltip?.();
    pickerState = null;
    repaint?.();
  };
  const selectItem = (item) => {
    const mirrored = list.isMirrored();
    list.setSelected(item.id);
    list.setCategory(item.category);
    selectStructure(list.structureType(item.id, mirrored));
    unlockTypes([
      list.structureType(item.id, !mirrored)
    ]);
    options.onSelect?.(item, mirrored);
    list.applyToBuildTool();
    persistIfEnabled();
    repaint?.();
  };
  const toggleMirror = () => {
    const next = !list.isMirrored();
    list.setMirrored(next);
    const item = list.getSelected();
    if (item) selectStructure(list.structureType(item.id, next));
    persistIfEnabled();
    repaint?.();
  };
  const chooseCategory = (categoryId) => {
    if (list.getCategory() == categoryId) {
      list.setCategory("");
    } else {
      list.setCategory(categoryId);
    }
    persistIfEnabled();
    repaint?.();
  };
  const choosePath = (path) => {
    if (list.getPath() == path) {
      list.setPath("");
    } else {
      list.setPath(path);
    }
    const tags = list.getSelectedTags();
    const sizes = list.getSelectedSizes();
    const matches = (it) => {
      const itemTags = it.tags ?? [];
      const itemSizes = it.sizes ?? [];
      if (tags.length > 0 && !tags.some((t) => itemTags.includes(t))) return false;
      if (sizes.length > 0 && !sizes.some((s) => itemSizes.includes(s))) return false;
      return true;
    };
    const item = list.itemsInPath(path).find(matches);
    if (item) selectStructure(list.structureType(item.id, !list.isMirrored()));
    persistIfEnabled();
    repaint?.();
  };
  const toggleTag = (tag) => {
    list.toggleTag(tag);
    persistIfEnabled();
    repaint?.();
  };
  const toggleSize = (size) => {
    list.toggleSize(size);
    persistIfEnabled();
    repaint?.();
  };
  const clearFilters = () => {
    list.setSelectedTags([]);
    list.setSelectedSizes([]);
    persistIfEnabled();
    repaint?.();
  };
  const contentApi = {
    pickerId,
    title,
    list,
    getState: () => pickerState,
    expand,
    minimize,
    selectItem,
    toggleMirror,
    chooseCategory,
    choosePath,
    toggleTag,
    toggleSize,
    clearFilters,
    setRepaint(fn) {
      repaint = fn;
    },
    setClearTooltip(fn) {
      clearTooltip = fn;
    },
    repaint: () => repaint?.()
  };
  const render = createPickerView({
    api: contentApi,
    spriteIdFor: options.spriteIdFor,
    itemFilter: options.itemFilter
  });
  const currentSelectedItem = () => {
    const selected = sandkit.api.action.getSelected?.();
    const building = sandkit.enums.ActionType.Building;
    if (!selected || !building || selected.type !== building) {
      return void 0;
    }
    const id = selected.id;
    if (!id || !id.startsWith(`${list.modId}:`)) return void 0;
    return list.itemFromType(id);
  };
  const sync = () => {
    const item = currentSelectedItem();
    if (!item) {
      if (pickerState) close();
      return;
    }
    if (item.id !== list.getSelected()?.id) {
      list.setSelected(item.id);
      if (pickerState) repaint?.();
    }
    if (!pickerState) {
      pickerState = {
        minimized: true
      };
      repaint?.();
    }
  };
  const install = () => {
    if (registered) return;
    sandkit.api.ui.overlays.register(slot, pickerId, render);
    registered = true;
    unsubscribe = sandkit.api.events.on("action:changed", () => {
      sandkit.api.schedule.nextTick(sync);
    });
    sandkit.api.schedule.nextTick(sync);
  };
  install();
  return {
    pickerId,
    expand,
    minimize,
    close,
    sync,
    dispose() {
      unsubscribe?.();
      unsubscribe = null;
      close();
    }
  };
}

// ../../packages/buffer-controls/src/const.ts
var EXPOSED_KINDS = [
  "bool",
  "number",
  "string"
];

// ../../packages/buffer-controls/src/structure/defBuilders.ts
function resolveBindingPath(path) {
  return path.replace(/\[\]/g, "[0]");
}
var makeShape = (x, y) => Array.from({
  length: x * 4
}, () => Array(y * 4).fill(0));
function buildSectionData(item, spriteId, extra = {}) {
  return {
    copyData: true,
    defaultData: {
      path: item.path ?? item.id,
      kind: item.kind ?? "string",
      spriteId,
      ...extra
    }
  };
}
function buildSectionTooltips() {
  return {
    tooltipHover: {
      type: "custom",
      dataFieldMessage: {
        // Generic "{field}: {field}" template — shows the bound
        // jsonBuffer path and its kind while hovering the structure.
        messageKey: "{path}",
        fields: [
          {
            param: "path",
            field: "path",
            fallback: "Unbound"
          }
        ]
      }
    }
  };
}
function buildMenuRender(item, spriteId) {
  return {
    render: {
      imageName: spriteId,
      size: {
        width: item.width,
        height: item.height
      },
      outline: true,
      ui: {
        imageName: spriteId,
        width: item.width,
        height: item.height,
        outline: true
      }
    }
  };
}
var sectionBuild = {
  single: (typeId) => ({
    buildModes: [
      {
        type: "single"
      }
    ],
    variants: [
      {
        id: typeId,
        angles: [
          0
        ]
      }
    ]
  })
};

// ../../packages/buffer-controls/src/structure/register/actionRegister.ts
var ACTION_LABEL = {
  inc: "+1",
  incX: "+10",
  dec: "-1",
  decX: "-10",
  toggle: "toggle"
};
function applyAction(op, current) {
  switch (op) {
    case "inc":
      return (Number(current) || 0) + 1;
    case "dec":
      return (Number(current) || 0) - 1;
    case "incX":
      return (Number(current) || 0) + 10;
    case "decX":
      return (Number(current) || 0) - 10;
    case "toggle":
      return !current;
  }
}

// ../../packages/buffer-controls/src/catalogue.ts
var CELL = 16;
var ITEM_HEIGHT = 6 * 15;
var VALUE_PREFIX = "value:";
var ACTION_PREFIX = "action:";
var menuItem = (menuItemId, menu) => ({
  id: menuItemId,
  label: menu.label,
  description: menu.description,
  category: "menu",
  path: "menu",
  tags: [
    "variables"
  ],
  width: CELL,
  height: CELL,
  color: "#FFFFFF"
});
var variableItem = (field) => ({
  id: field.path,
  path: field.path,
  kind: field.kind,
  label: field.path,
  description: `${field.kind} \u2014 linked to jsonBuffer path "${field.path}".`,
  category: field.path.split(".")[1],
  tags: [
    "variables",
    ...field.path.split(".").slice(2)
  ],
  width: CELL,
  height: ITEM_HEIGHT,
  color: "#FFFFFF"
});
var valueItem = (field) => ({
  id: `${VALUE_PREFIX}${field.path}`,
  path: field.path,
  kind: field.kind,
  label: field.path,
  description: `${field.kind} \u2014 live value for jsonBuffer path "${field.path}".`,
  category: field.path.split(".")[1],
  tags: [
    "value",
    ...field.path.split(".").slice(2)
  ],
  width: CELL,
  height: ITEM_HEIGHT,
  color: "#FFFFFF"
});
var actionItem = (field, op) => ({
  id: `${ACTION_PREFIX}${field.path}:${op}`,
  action: op,
  path: field.path,
  kind: field.kind,
  label: `${field.path} ${ACTION_LABEL[op]}`,
  description: `${ACTION_LABEL[op]} \u2014 writes jsonBuffer path "${field.path}" then commits.`,
  category: field.path.split(".")[1],
  tags: [
    "action",
    ...field.path.split(".").slice(2)
  ],
  width: CELL,
  height: CELL,
  color: "#FFFFFF"
});
var actionItemsFor = (field) => {
  if (field.kind === "number") {
    return [
      actionItem(field, "inc"),
      actionItem(field, "dec"),
      actionItem(field, "incX"),
      actionItem(field, "decX")
    ];
  }
  if (field.kind === "bool") {
    return [
      actionItem(field, "toggle")
    ];
  }
  return [];
};
function boundFields(listed) {
  return listed.filter((f) => f.kind !== void 0 && EXPOSED_KINDS.includes(f.kind)).map((f) => ({
    kind: f.kind,
    path: resolveBindingPath(f.path)
  }));
}
function buildBufferControlList(modId, bound, config, spriteFor) {
  const filePathFor = (spriteEntryId) => config.spriteFiles.find((f) => f.id === spriteEntryId)?.filePath ?? "";
  const menuId = config.menuItemId ?? modId;
  const items = [
    menuItem(menuId, config.menu),
    ...bound.flatMap((field) => [
      variableItem(field),
      valueItem(field),
      ...actionItemsFor(field)
    ])
  ];
  items.forEach((item) => item.spriteId = spriteFor(item));
  items.forEach((item) => item.filePath = filePathFor(item.spriteId ?? ""));
  items.forEach((item) => item.color = config.categories.find((c) => c.id == item.category)?.color ?? "#FFFFFF");
  const list = createBuildList({
    modId,
    menuId,
    menuLabel: config.menu.label,
    // categories,
    catalogueItems: items,
    selectedId: bound[0]?.path
  });
  return {
    buildList: list,
    pathCount: bound.length
  };
}

// ../../packages/shared/src/grid.ts
var Direction = /* @__PURE__ */ function(Direction2) {
  Direction2[Direction2["UP"] = 0] = "UP";
  Direction2[Direction2["RIGHT_UP"] = 1] = "RIGHT_UP";
  Direction2[Direction2["RIGHT"] = 2] = "RIGHT";
  Direction2[Direction2["RIGHT_DOWN"] = 3] = "RIGHT_DOWN";
  Direction2[Direction2["DOWN"] = 4] = "DOWN";
  Direction2[Direction2["LEFT_DOWN"] = 5] = "LEFT_DOWN";
  Direction2[Direction2["LEFT"] = 6] = "LEFT";
  Direction2[Direction2["LEFT_UP"] = 7] = "LEFT_UP";
  return Direction2;
}({});
var DIR_NAME_MAP = {
  top: [
    Direction.UP
  ],
  bottom: [
    Direction.DOWN
  ],
  left: [
    Direction.LEFT
  ],
  right: [
    Direction.RIGHT
  ],
  sides: [
    Direction.LEFT,
    Direction.RIGHT
  ],
  cross: [
    Direction.RIGHT_UP,
    Direction.RIGHT_DOWN,
    Direction.LEFT_UP,
    Direction.LEFT_DOWN
  ]
};

// ../../packages/shared/src/elements.ts
var MatterType = /* @__PURE__ */ function(MatterType2) {
  MatterType2[MatterType2["Solid"] = 1] = "Solid";
  MatterType2[MatterType2["Liquid"] = 2] = "Liquid";
  MatterType2[MatterType2["Particle"] = 3] = "Particle";
  MatterType2[MatterType2["Gas"] = 4] = "Gas";
  MatterType2[MatterType2["Static"] = 5] = "Static";
  MatterType2[MatterType2["Slushy"] = 6] = "Slushy";
  MatterType2[MatterType2["Wisp"] = 7] = "Wisp";
  MatterType2[MatterType2["Powder"] = 8] = "Powder";
  return MatterType2;
}({});

// ../../packages/shared/src/color.ts
function adjustHSL(hex, delta) {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h2 = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h2 = 60 * ((g - b) / d % 6);
        break;
      case g:
        h2 = 60 * ((b - r) / d + 2);
        break;
      case b:
        h2 = 60 * ((r - g) / d + 4);
        break;
    }
  }
  if (h2 < 0) h2 += 360;
  h2 = (h2 + (delta.h ?? 0)) % 360;
  if (h2 < 0) h2 += 360;
  s = Math.max(0, Math.min(100, s * 100 + (delta.s ?? 0))) / 100;
  const lightness = Math.max(0, Math.min(100, l * 100 + (delta.l ?? 0))) / 100;
  const c = (1 - Math.abs(2 * lightness - 1)) * s;
  const x = c * (1 - Math.abs(h2 / 60 % 2 - 1));
  const m = lightness - c / 2;
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (h2 < 60) [r1, g1, b1] = [
    c,
    x,
    0
  ];
  else if (h2 < 120) [r1, g1, b1] = [
    x,
    c,
    0
  ];
  else if (h2 < 180) [r1, g1, b1] = [
    0,
    c,
    x
  ];
  else if (h2 < 240) [r1, g1, b1] = [
    0,
    x,
    c
  ];
  else if (h2 < 300) [r1, g1, b1] = [
    x,
    0,
    c
  ];
  else [r1, g1, b1] = [
    c,
    0,
    x
  ];
  const toHex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}

// ../../packages/buffer-controls/src/structure/render.ts
var CELL2 = 16;
var STRUCT_H = 16;
var RECT_W = 8 * 16;
function loadImage(spriteId) {
  if (!spriteId) return;
  return sandkit.api.sprites?.getById(spriteId)?.imageAsset?.image;
}
function drawIconAndReadout(structure, render, opts) {
  const ctx = render?.ctx;
  if (!ctx || !sandkit.api.rendering?.getDrawPositionAtCell) return false;
  const image = loadImage(opts.spriteId);
  if (!image) return false;
  const origin = sandkit.api.rendering.getDrawPositionAtCell(structure.x, structure.y);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, origin.x, origin.y, CELL2, CELL2);
  const rx = origin.x + CELL2;
  const ry = origin.y;
  const rw = RECT_W;
  const rh = STRUCT_H;
  ctx.fillStyle = "#da9c0a";
  ctx.fillRect(rx, ry, rw, rh);
  ctx.fillStyle = "#edab11";
  ctx.fillRect(rx + 1, ry + 1, rw - 2, rh - 2);
  ctx.fillStyle = "#000000";
  ctx.fillRect(rx + 2, ry + 2, rw - 4, rh - 4);
  ctx.font = "9px monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(opts.text, rx + 6, ry + rh / 2 + 1, rw - 12);
  ctx.restore();
  return true;
}
function drawBorder(structure, render, color, tileWidth = 1) {
  const ctx = render?.ctx;
  if (!ctx || !sandkit.api.rendering?.getDrawPositionAtCell) return false;
  const origin = sandkit.api.rendering.getDrawPositionAtCell(structure.x, structure.y);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const rx = origin.x;
  const ry = origin.y;
  const rw = tileWidth * CELL2;
  const rh = CELL2;
  ctx.strokeStyle = adjustHSL(color, {
    l: -40
  });
  ctx.strokeRect(rx, ry, rw, rh);
  ctx.strokeStyle = color;
  ctx.strokeRect(rx + 1, ry + 1, rw - 2, rh - 2);
  ctx.restore();
  return true;
}

// ../../packages/buffer-controls/src/structure/register/valueRegister.ts
function formatBufferValue(value, kind) {
  if (kind === "string") return String(value ?? "");
  if (kind === "number") return String(value ?? 0);
  return String(value ?? false);
}
function registerValueStructures(ops) {
  if (!ops.item.tags?.includes("value")) return;
  const entries = [];
  const kind = ops.item.kind ?? "string";
  const path = ops.item.path ?? ops.item.id;
  const value = formatBufferValue(ops.read(path), kind);
  const draw = (_state, structure, render) => {
    drawIconAndReadout(structure, render, {
      spriteId: ops.item.spriteId,
      // Value structure: the readout shows the last buffer value,
      // refreshed on every buffer update via setData({ dataValue }).
      text: String(structure.data?.dataValue ?? value)
    });
    drawBorder(structure, render, ops.item.color, 9);
    return true;
  };
  sandkit.api.structures.register({
    id: ops.typeId,
    categoryKey: "blocks",
    name: ops.item.label,
    description: `live value \u2014 linked to jsonBuffer path "${path}".`,
    hideFromBuildMenu: true,
    shape: makeShape(1, 1),
    ...sectionBuild.single(ops.typeId),
    ...buildSectionTooltips(),
    ...buildSectionData(ops.item, ops.item.spriteId, {
      dataValue: value
    }),
    draw
  });
  sandkit.api.player.buildings.unlockByType(ops.typeId);
  entries.push({
    typeId: ops.typeId,
    path,
    kind
  });
  return {
    entries
  };
}

// ../../packages/buffer-controls/src/structure/register/menuRegister.ts
function registerMenuStructures(ops) {
  if (ops.item.category !== "menu") return;
  const draw = (_state, structure, render) => {
    drawIconAndReadout(structure, render, {
      spriteId: ops.item.spriteId,
      // Path structure: the readout shows the bound jsonBuffer path.
      text: String(structure.data?.path ?? ops.item.label ?? ops.item.id)
    });
    drawBorder(structure, render, ops.item.color, 9);
    return true;
  };
  sandkit.api.structures.register({
    id: ops.typeId,
    categoryKey: "blocks",
    name: ops.item.label,
    description: ops.item.description,
    hideFromBuildMenu: false,
    shape: makeShape(1, 1),
    ...sectionBuild.single(ops.typeId),
    ...buildMenuRender(ops.item, ops.item.spriteId),
    ...buildSectionTooltips(),
    ...buildSectionData(ops.item, ops.item.spriteId),
    draw
  });
  sandkit.api.player.buildings.unlockByType(ops.typeId);
}

// ../../packages/buffer-controls/src/structure/register/varRegister.ts
function registerPathStructures(ops) {
  if (!ops.item.tags?.includes("variables") || ops.item.category === "menu") return;
  const draw = (_state, structure, render) => {
    drawIconAndReadout(structure, render, {
      spriteId: ops.item.spriteId,
      // Path structure: the readout shows the bound jsonBuffer path.
      text: String(structure.data?.path ?? ops.item.label ?? ops.item.id)
    });
    drawBorder(structure, render, ops.item.color, 9);
    return true;
  };
  sandkit.api.structures.register({
    id: ops.typeId,
    categoryKey: "blocks",
    name: ops.item.label,
    description: `${ops.item.kind ?? "string"} \u2014 linked to jsonBuffer path "${ops.item.path ?? ops.item.id}".`,
    hideFromBuildMenu: true,
    shape: makeShape(1, 1),
    ...sectionBuild.single(ops.typeId),
    ...buildSectionTooltips(),
    ...buildSectionData(ops.item, ops.item.spriteId),
    draw
  });
  sandkit.api.player.buildings.unlockByType(ops.typeId);
}

// ../../packages/buffer-controls/src/structure/register/actionNumberRegister.ts
function registerActionNumberStructures(ops) {
  if (!ops.item.tags?.includes("action") || ops.item.kind !== "number") return;
  const computeSignal = (structure) => {
    const p = structure.data?.path;
    if (typeof p !== "string" || p.length === 0) return false;
    return ops.read(p) ? true : false;
  };
  const pushSignal = (structure) => {
    sandkit.api.signals?.setOutputAtCell?.(structure.x, structure.y, computeSignal(structure));
  };
  const act = (structure, op2) => {
    const p = structure.data?.path;
    if (typeof p !== "string" || p.length === 0) return;
    ops.write(p, applyAction(op2, ops.read(p)));
    pushSignal(structure);
  };
  const draw = (_state, structure, render) => {
    const d = ops.read(structure.data?.path);
    sandkit.api.structures.setSpritesheetIndexAtCell(structure.x, structure.y, d ? 1 : 0);
    drawBorder(structure, render, ops.item.color, 1);
    return false;
  };
  const actionItems = [];
  const op = ops.item.action ?? "inc";
  const path = ops.item.path ?? ops.item.id;
  actionItems.push({
    typeId: ops.typeId,
    path
  });
  sandkit.api.structures.register({
    id: ops.typeId,
    categoryKey: "blocks",
    name: ops.item.label,
    description: ops.item.description,
    hideFromBuildMenu: true,
    shape: makeShape(1, 1),
    ...sectionBuild.single(ops.typeId),
    ...buildSectionTooltips(),
    render: {
      imageName: ops.item.spriteId,
      size: {
        width: 16,
        height: 16
      }
    },
    copyData: true,
    defaultData: {
      path,
      kind: ops.item.kind ?? "string",
      op
    },
    draw
  });
  sandkit.api.player.buildings.unlockByType(ops.typeId);
  sandkit.api.signals?.interactables?.register?.(ops.typeId, (structure) => {
    act(structure, op);
  });
  sandkit.api.signals?.registerSenderType(ops.typeId, (s) => computeSignal(s));
  return {
    refreshSignals: () => {
      for (const a of actionItems) {
        sandkit.api.structures.forEachOfType(a.typeId, (structure) => {
          pushSignal(structure);
        });
      }
    }
  };
}

// ../../packages/buffer-controls/src/structure/register/actionBooleanRegister.ts
function registerBooleanActionStructures(ops) {
  if (!ops.item.tags?.includes("action") || ops.item.kind !== "bool") return;
  const actionItems = [];
  const computeSignal = (structure) => {
    const p = structure.data?.path;
    if (typeof p !== "string" || p.length === 0) return false;
    return ops.read(p) ? true : false;
  };
  const pushSignal = (structure) => {
    sandkit.api.signals?.setOutputAtCell?.(structure.x, structure.y, computeSignal(structure));
  };
  const act = (structure, op2) => {
    const p = structure.data?.path;
    if (typeof p !== "string" || p.length === 0) return;
    ops.write(p, applyAction(op2, ops.read(p)));
    pushSignal(structure);
  };
  const draw = (_state, structure, render) => {
    const d = ops.read(structure.data?.path);
    sandkit.api.structures.setSpritesheetIndexAtCell(structure.x, structure.y, d ? 1 : 0);
    drawBorder(structure, render, ops.item.color, 1);
    return false;
  };
  const op = ops.item.action ?? "toggle";
  const path = ops.item.path;
  actionItems.push({
    typeId: ops.typeId,
    path
  });
  sandkit.api.structures.register({
    id: ops.typeId,
    categoryKey: "blocks",
    name: ops.item.label,
    description: ops.item.description,
    hideFromBuildMenu: true,
    shape: makeShape(1, 1),
    ...sectionBuild.single(ops.typeId),
    ...buildSectionTooltips(),
    render: {
      imageName: ops.item.spriteId,
      size: {
        width: 16,
        height: 16
      }
    },
    copyData: true,
    defaultData: {
      path,
      kind: ops.item.kind ?? "string",
      op
    },
    draw
  });
  sandkit.api.player.buildings.unlockByType(ops.typeId);
  sandkit.api.signals?.interactables?.register?.(ops.typeId, (structure) => {
    act(structure, op);
  });
  sandkit.api.signals?.registerSenderType(ops.typeId, (s) => computeSignal(s));
  const refreshSignals = () => {
    for (const a of actionItems) {
      sandkit.api.structures.forEachOfType(a.typeId, (structure) => {
        pushSignal(structure);
      });
    }
  };
  return {
    refreshSignals
  };
}

// ../../packages/buffer-controls/src/structure/register.ts
function registerStructures(buffer, list) {
  const readBuffer = (path) => buffer.getPath(path);
  const writeBuffer = (path, value) => {
    buffer.setPath(path, value);
    buffer.commit();
  };
  const refreshers = [];
  const valueEntries = [];
  for (const item of list.catalogueItems) {
    const ops = {
      // Structure type id is the catalogue-prefixed type (`modId:item/<id>`),
      // which is what list.structureType / picker select / unlock all use.
      typeId: list.structureType(item.id),
      item,
      read: readBuffer,
      write: writeBuffer
    };
    if (item.category == "menu") {
      registerMenuStructures(ops);
      continue;
    }
    if (item.tags?.includes("variables")) {
      registerPathStructures(ops);
    }
    if (item.tags?.includes("value")) {
      const value = registerValueStructures(ops);
      if (value) valueEntries.push(...value.entries);
    }
    if (ops.item.tags?.includes("action") && ops.item.kind == "number") {
      const number = registerActionNumberStructures(ops);
      if (number) refreshers.push(number.refreshSignals);
    }
    if (ops.item.tags?.includes("action") && ops.item.kind == "bool") {
      const boolean = registerBooleanActionStructures(ops);
      if (boolean) refreshers.push(boolean.refreshSignals);
    }
  }
  return {
    valueEntries,
    refreshSignals: () => {
      for (const refresh of refreshers) refresh();
    }
  };
}

// ../../packages/buffer-controls/src/buffer-controls.ts
async function registerBufferControls(config) {
  const { modId } = config;
  const buffer = new JsonBuffer(modId, config.bufferId, config.defaultRecord, void 0, config.persist ?? true, config.persistLoad ?? true);
  const readBuffer = (path) => buffer.getPath(path);
  const spriteIds = await loadSpriteMap(modId, config.spriteFiles);
  const menuItemId = config.menuItemId ?? modId;
  const spriteFor = (item) => {
    if (item.id === menuItemId) return spriteIds[config.menu.spriteId];
    const aItem = item;
    const found = config.sprites.find((c) => c.itemId == item.id) ?? config.sprites.find((c) => aItem.action && c.action === aItem.action && c.kind === aItem.kind) ?? config.sprites.find((c) => !c.action && c.kind === aItem.kind);
    return spriteIds[found?.spriteId ?? ""];
  };
  const bound = boundFields(buffer.listPaths());
  const { buildList, pathCount } = buildBufferControlList(modId, bound, config, spriteFor);
  const { refreshSignals, valueEntries } = registerStructures(buffer, buildList);
  const refresh = () => {
    refreshSignals();
    for (const entry of valueEntries) {
      const value = readBuffer(entry.path);
      const next = formatBufferValue(value, entry.kind);
      sandkit.api.structures.forEachOfType(entry.typeId, (structure) => {
        if (String(structure.data?.dataValue) === next) return;
        sandkit.api.structures.setData(structure, {
          dataValue: next
        }, {
          propagateToWorkers: true
        });
      });
    }
  };
  buffer.subscribe(() => refresh());
  refresh();
  sandkit.api.events?.on?.("building:placed", () => refresh());
  createPickerOverlay({
    list: buildList,
    /** Overlay id. Default `${modId}/picker`. */
    pickerId: "buffControl:",
    /** Overlay slot. Default "hotbar". */
    title: config.pickerTitle,
    /**
         * Resolves the sprite id actually loaded for an item. Defaults to
         * `item.spriteId ?? mod structure-type`, but mods that load sprites under
         * their own id scheme (e.g. `modId:<id>`) must supply this so the swatches
         * show the correct art.
         */
    spriteIdFor: spriteFor
  });
  console.log(`[${modId}] loaded ${pathCount} jsonBuffer paths`);
  return {
    buffer,
    list: buildList,
    pathCount,
    refresh
  };
}

// src/config/elementShared/ids.ts
var MOD_ID = "astro.seeds";
var VERSION = "3.1.0";

// src/config/elementShared/util.ts
function spec(entry) {
  return {
    ...entry,
    id: `${MOD_ID}:${entry.slug}`
  };
}
function safe2(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

// src/config/elementMain/astroCopperCrystal.ts
var astroCopperCrystal = {
  spec: spec({
    key: "astroCopperCrystal",
    slug: "astro-copper-crystal",
    name: "Astro Copper Crystal",
    description: "From Liquid Copper. Burn \u2192 Astro Copper.",
    colors: [
      [
        200,
        120,
        80
      ],
      [
        180,
        90,
        50
      ],
      [
        220,
        140,
        90
      ],
      [
        160,
        70,
        40
      ]
    ],
    density: 0,
    metaColor: 13138e3,
    matterType: MatterType.Static,
    toolboxLabel: "Cry. Copper",
    isSeed: false,
    isCrystal: true
  }),
  reactions: []
};

// src/config/elementMain/astroCopperPowder.ts
var LIQUID_COPPER_DENSITY = 150;
var SEED_DENSITY = Math.max(1, LIQUID_COPPER_DENSITY - 5);
var astroCopperPowder = {
  spec: spec({
    key: "astroCopperPowder",
    slug: "astro-copper",
    name: "Astro Copper",
    description: "Powder from copper crystal + Fire.",
    colors: [
      [
        240,
        80,
        40
      ],
      [
        180,
        60,
        20
      ]
    ],
    density: SEED_DENSITY,
    metaColor: 11822120,
    matterType: MatterType.Powder,
    toolboxLabel: "Astro Copper",
    isSeed: true,
    isCrystal: false
  }),
  reactions: [
    {
      inputA: "astroCopperCrystal",
      inputB: "water",
      outputA: "astroCopperPowder",
      outputB: "water"
    }
  ]
};

// src/config/elementMain/astroGCalloyPowder.ts
var LIQUID_COPPER_DENSITY2 = 150;
var SEED_DENSITY2 = Math.max(1, LIQUID_COPPER_DENSITY2 - 5);
var astroGCalloyPowder = {
  spec: spec({
    key: "astroGCalloyPowder",
    slug: "astro-gc-alloy",
    name: "Astro GC Alloy Powder",
    description: "Powder from ...",
    colors: [
      [
        100,
        155,
        10
      ],
      [
        60,
        130,
        0
      ]
    ],
    density: SEED_DENSITY2,
    metaColor: 9714336,
    matterType: MatterType.Powder,
    toolboxLabel: "Astro GC Alloy",
    isSeed: true,
    isCrystal: false
  }),
  reactions: []
};

// src/config/elementMain/astroGoldCrystal.ts
var astroGoldCrystal = {
  spec: spec({
    key: "astroGoldCrystal",
    slug: "astro-gold-crystal",
    name: "Astro Gold Crystal",
    description: "From Liquid Gold. Burn \u2192 Astro Gold.",
    colors: [
      [
        210,
        160,
        255
      ],
      [
        180,
        120,
        240
      ],
      [
        230,
        190,
        255
      ],
      [
        160,
        90,
        220
      ]
    ],
    density: 200,
    metaColor: 11827440,
    matterType: MatterType.Static,
    toolboxLabel: "Cry. Gold",
    isSeed: false,
    isCrystal: true
  }),
  reactions: []
};

// src/config/elementMain/astroGoldPowder.ts
var LIQUID_COPPER_DENSITY3 = 150;
var SEED_DENSITY3 = Math.max(1, LIQUID_COPPER_DENSITY3 - 5);
var astroGoldPowder = {
  spec: spec({
    key: "astroGoldPowder",
    slug: "astro-gold",
    name: "Astro Gold Powder",
    description: "Powder from gold crystal + Fire.",
    colors: [
      [
        180,
        255,
        90
      ],
      [
        150,
        230,
        60
      ]
    ],
    density: SEED_DENSITY3,
    metaColor: 11819760,
    matterType: MatterType.Powder,
    toolboxLabel: "Astro Gold",
    isSeed: true,
    isCrystal: false
  }),
  reactions: [
    {
      inputA: "astroGoldCrystal",
      inputB: "fire",
      outputA: "astroGoldPowder",
      outputB: "fire"
    }
  ]
};

// src/config/elementMain/astroSeed.ts
var LIQUID_COPPER_DENSITY4 = 150;
var SEED_DENSITY4 = Math.max(1, LIQUID_COPPER_DENSITY4 - 5);
var astroSeed = {
  spec: spec({
    key: "astroSeed",
    slug: "astro-seed",
    name: "Astro Seed",
    description: "Liquid Gold / Copper / Water \u2192 crystals.",
    colors: [
      [
        180,
        220,
        255
      ],
      [
        140,
        190,
        255
      ],
      [
        100,
        160,
        240
      ],
      [
        220,
        240,
        255
      ]
    ],
    density: SEED_DENSITY4,
    metaColor: 9357567,
    matterType: MatterType.Powder,
    toolboxLabel: "Seed",
    isSeed: true,
    isCrystal: false
  }),
  reactions: [
    {
      inputA: "astroVoidSeed",
      inputB: "florinol",
      outputA: "astroSeed",
      outputB: null
    }
  ]
};

// src/config/elementMain/astroVoidSeed.ts
var astroVoidSeed = {
  spec: spec({
    key: "astroVoidSeed",
    slug: "astro-void-seed",
    name: "Astro Void Seed",
    description: "Mix with Florinol \u2192 Astro Seed.",
    colors: [
      [
        80,
        40,
        140
      ],
      [
        60,
        20,
        110
      ],
      [
        100,
        50,
        160
      ]
    ],
    density: 90,
    metaColor: 5253260,
    matterType: MatterType.Powder,
    toolboxLabel: "Void Seed",
    isSeed: false,
    isCrystal: false
  }),
  reactions: [
    {
      inputA: "seedBase",
      inputB: "voidPetal",
      outputA: "astroVoidSeed",
      outputB: null
    }
  ]
};

// src/config/elementMain/astroWaterCrystal.ts
var astroWaterCrystal = {
  spec: spec({
    key: "astroWaterCrystal",
    slug: "astro-water-crystal",
    name: "Astro Water Crystal",
    description: "From Water (panel). Burn \u2192 Astro Water.",
    colors: [
      [
        60,
        100,
        155
      ],
      [
        40,
        90,
        155
      ],
      [
        0,
        60,
        155
      ]
    ],
    density: 0,
    metaColor: 9357567,
    matterType: MatterType.Static,
    toolboxLabel: "Cry. Water",
    isSeed: false,
    isCrystal: true
  }),
  reactions: []
};

// src/config/elementMain/astroWaterPowder.ts
var astroWaterPowder = {
  spec: spec({
    key: "astroWaterPowder",
    slug: "astro-water",
    name: "Astro Water",
    description: "Powder from water crystal + Fire.",
    colors: [
      [
        180,
        120,
        155
      ],
      [
        180,
        90,
        155
      ],
      [
        220,
        140,
        155
      ]
    ],
    density: 280,
    metaColor: 9357567,
    matterType: MatterType.Powder,
    toolboxLabel: "Astro Water",
    isSeed: true,
    isCrystal: false
  }),
  reactions: [
    {
      inputA: "astroWaterCrystal",
      inputB: "fire",
      outputA: "astroWaterPowder",
      outputB: "fire"
    }
  ]
};

// src/config/elementMain/catalogue.ts
var ASTRO_ELEMENTS = [
  astroCopperCrystal,
  astroCopperPowder,
  astroGoldCrystal,
  astroGoldPowder,
  astroGCalloyPowder,
  astroSeed,
  astroVoidSeed,
  astroWaterCrystal,
  astroWaterPowder
];
var ASTRO_ELEMENT_BY_KEY = Object.fromEntries(ASTRO_ELEMENTS.map((e) => [
  e.spec.key,
  e.spec
]));
var ASTRO_REACTIONS = ASTRO_ELEMENTS.flatMap((c) => c.reactions);

// src/config/elementShared/resolve.ts
function resolveType(ids) {
  for (const id of ids) {
    const t = safe2(() => sandkit.api.elements.getTypeFromId(id));
    if (t != null) return t;
  }
  return 0;
}
var VANILLA_ALIASES = {
  liquidGold: [
    "liquidGold",
    "liquidgold",
    "LiquidGold",
    "goldLiquid",
    "liquid_gold"
  ],
  liquidCopper: [
    "liquidCopper",
    "liquidcopper",
    "LiquidCopper",
    "copperLiquid",
    "liquid_copper"
  ],
  florinol: [
    "florinol",
    "Florinol",
    "florin",
    "Florin"
  ],
  voidPetal: [
    "voidPetal",
    "voidpetal",
    "VoidPetal",
    "void_petal",
    "petalium"
  ],
  seedBase: [
    "seed",
    "Seed"
  ],
  fire: [
    "fire",
    "Fire"
  ],
  water: [
    "water",
    "Water"
  ],
  sand: [
    "sand",
    "Sand"
  ],
  empty: [
    "empty",
    "Empty",
    "air",
    "Air",
    "void",
    "Void",
    "none",
    "None"
  ]
};
function resolveVanilla() {
  return Object.fromEntries(Object.entries(VANILLA_ALIASES).map(([key, aliases]) => [
    key,
    resolveType(aliases)
  ]));
}
function resolveAstro() {
  return Object.fromEntries(ASTRO_ELEMENTS.map((e) => [
    e.spec.key,
    resolveType([
      e.spec.id
    ])
  ]));
}
var ElementType = {
  ...resolveVanilla(),
  ...resolveAstro()
};

// src/config/profileRuntime.ts
var PROFILE_BUFFER_ID = "astro-seeds:profileConfig";
var PROFILE_IDS = [
  "InWater-ASeed",
  "InGold-ASeed",
  "InGold-AGold",
  "InGold-ACopper",
  "InCopper-ASeed"
];
var PROFILES_CONFIG = [
  {
    id: "InWater-ASeed",
    color: "#0000FF"
  },
  {
    id: "InGold-ASeed",
    color: "#AA2299"
  },
  {
    id: "InGold-AGold",
    color: "#FFFF00"
  },
  {
    id: "InGold-ACopper",
    color: "#FF9900"
  },
  {
    id: "InCopper-ASeed",
    color: "#FF0055"
  }
];
function buildDefaultProfileRecord() {
  const profiles = {};
  for (const id of PROFILE_IDS) {
    profiles[id] = {
      enabled: true,
      tickSpeed: 50,
      growEnabled: false,
      crystalEnabled: false,
      moveSide: 15,
      moveDown: 20,
      moveUp: 20
    };
  }
  profiles["InCopper-ASeed"].moveSide = 25;
  profiles["InCopper-ASeed"].moveDown = 35;
  return {
    P: profiles
  };
}

// src/config/elementWorker/live.ts
var mainBuffer = null;
function setProfileBuffer(buffer) {
  mainBuffer = buffer;
}

// src/main/build.ts
function buildMain() {
  const api = sandkit.api;
  const { types } = buildElementMain({
    elements: ASTRO_ELEMENTS,
    // Vanilla keys the reactions reference (water, fire, florinol, …).
    types: ElementType,
    tech: {
      id: `${MOD_ID}:astro-seeds`,
      nameKey: `${MOD_ID}.tech.name`,
      descriptionKey: `${MOD_ID}.tech.description`,
      name: "Astro Seeds",
      description: "Seed\u2013crystal profiles over liquids.",
      cost: 4500,
      parents: [
        "SteamTurbine",
        "KineticPress"
      ]
    }
  });
  Object.assign(ElementType, types);
  safe2(() => api.events.on("game:ready", () => {
    api.ui.toast(`Astro Seeds v${VERSION}`, {});
  }));
  registerBufferControls({
    modId: MOD_ID,
    bufferId: PROFILE_BUFFER_ID,
    defaultRecord: buildDefaultProfileRecord(),
    menuItemId: `${MOD_ID}:bufferProfile:menu`,
    menu: {
      label: "Astro Profiles",
      description: "Astro Profiles \u2014 opens the per-profile config picker.",
      spriteId: "menu"
    },
    categories: PROFILES_CONFIG,
    sprites: [
      {
        itemId: `${MOD_ID}:bufferProfile:menu`,
        spriteId: "menu"
      },
      {
        kind: "string",
        spriteId: "string"
      },
      {
        kind: "number",
        action: "dec",
        spriteId: "actionPlus"
      },
      {
        kind: "number",
        action: "decX",
        spriteId: "actionPlusX"
      },
      {
        kind: "number",
        action: "inc",
        spriteId: "actionMinus"
      },
      {
        kind: "number",
        action: "incX",
        spriteId: "actionMinusX"
      },
      {
        kind: "number",
        spriteId: "number"
      },
      {
        kind: "bool",
        action: "toggle",
        spriteId: "actionToggle"
      },
      {
        kind: "bool",
        spriteId: "bolean"
      }
    ],
    spriteFiles: [
      {
        id: "number",
        filePath: "assets/types/number.png"
      },
      {
        id: "bolean",
        filePath: "assets/types/bolean.png"
      },
      {
        id: "string",
        filePath: "assets/types/string.png"
      },
      {
        id: "menu",
        filePath: "assets/types/display.png"
      },
      {
        id: "actionPlus",
        filePath: "assets/types/plus.png"
      },
      {
        id: "actionMinus",
        filePath: "assets/types/minus.png"
      },
      {
        id: "actionPlusX",
        filePath: "assets/types/plusX.png"
      },
      {
        id: "actionMinusX",
        filePath: "assets/types/minusX.png"
      },
      {
        id: "actionToggle",
        filePath: "assets/types/toggle.png"
      }
    ],
    pickerTitle: "Astro profile config",
    persist: true,
    persistLoad: false
  }).then(({ buffer }) => setProfileBuffer(buffer)).catch((e) => console.warn(`[${MOD_ID}] buffer controls failed:`, e));
  console.log(`[${MOD_ID} v${VERSION}] main loaded`);
}

// src/main.ts
try {
  findOrphanedObjects(MOD_ID);
  pruneStaleBuildings(MOD_ID);
  buildMain();
} catch (e) {
  console.error("[astro.seeds] main failed:", e);
}
