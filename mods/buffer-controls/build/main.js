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
  const existing = sandkit.api.shared.buffers.get(key);
  if (existing) return existing;
  if (!sandkit.api.shared.buffers.ensure) {
    return null;
  }
  return sandkit.api.shared.buffers.ensure(key, config);
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
  constructor(modId, key, defaultRecord, assertShape, loadFromStorage = false) {
    this.modId = modId;
    this.key = key;
    this.defaultRecord = defaultRecord;
    this.assertShape = assertShape;
    this.versionView = ensureBuffer(`${key}:ver`, {
      type: "int32",
      length: 1
    });
    this.dataView = ensureBuffer(`${key}:json`, {
      type: "uint8",
      length: DEFAULT_MAX_BYTES
    });
    if (this.remoteVersion() > 0) {
      this.cache = this.readFromBuffer();
      this.localVersion = this.remoteVersion();
    } else {
      const storedRecord = !loadFromStorage ? false : sandkit.api.storage.local.get(this.key);
      sandkit.api.events.on("store:save", (_payload) => {
        this.commit();
        this.save();
      });
      this.cache = storedRecord ? storedRecord : this.defaultRecord ? deepClone(this.defaultRecord) : {};
      this.localVersion = -1;
      this.commit();
    }
  }
  remoteVersion = () => {
    return this.versionView[0];
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
    this.localVersion = this.remoteVersion() + 1;
    this.notify();
  }
  save() {
    sandkit.api.storage.local.set(this.key, this.cache);
  }
};

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
  const categories = options.categories.filter((c) => catalogueItems.some((it) => it.category === c.id));
  let selectedId = options.selectedId ?? catalogueItems[0]?.id ?? "";
  let category = findItem(catalogueItems, selectedId)?.category ?? categories[0]?.id ?? "";
  let mirrored = false;
  let selectedTags = [];
  let selectedSizes = [];
  const listeners = {
    select: /* @__PURE__ */ new Set(),
    place: /* @__PURE__ */ new Set(),
    remove: /* @__PURE__ */ new Set(),
    category: /* @__PURE__ */ new Set(),
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
    categories,
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
    allTags() {
      const set = /* @__PURE__ */ new Set();
      for (const it of catalogueItems) {
        for (const t of it.tags ?? []) set.add(t);
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
    const categoryId = list.getCategory() || list.categories[0]?.id || "";
    function filterItems(items, options2) {
      const q = options2.query.trim().toLowerCase();
      return items.filter((item) => {
        if (item.category !== options2.categoryId) return false;
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
    const selectedTags = list.getSelectedTags();
    const availableTags = list.allTags();
    const selectedSizes = list.getSelectedSizes();
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
    const visibleCategories = list.categories.map((cat) => ({
      cat,
      count: list.itemsInCategory(cat.id).filter(matchesFilters).length
    })).filter((c) => c.count > 0);
    const visible = filterItems(list.catalogueItems, {
      categoryId,
      query: search,
      tags: selectedTags,
      sizes: selectedSizes,
      itemFilter: options.itemFilter
    });
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
    const categorieEl = hVerticalItemsList("Element:", visibleCategories.map(({ cat }) => h(FocusableButton, {
      key: cat.id,
      id: `${api.pickerId}-cat-${cat.id}`,
      onActivate: () => {
        savedScrollRef.current = 0;
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
        api.chooseCategory(cat.id);
      },
      className: `text-xs px-2 py-0.5 rounded border w-[100px] ${cat.id === categoryId ? "text-[#ffe700] border-yellow-400" : "text-slate-400 border-slate-600"}`,
      children: `${cat.label}`
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
    }, filterSizeEl, filterTagEl, categorieEl));
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
    list.setCategory(categoryId);
    const tags = list.getSelectedTags();
    const sizes = list.getSelectedSizes();
    const matches = (it) => {
      const itemTags = it.tags ?? [];
      const itemSizes = it.sizes ?? [];
      if (tags.length > 0 && !tags.some((t) => itemTags.includes(t))) return false;
      if (sizes.length > 0 && !sizes.some((s) => itemSizes.includes(s))) return false;
      return true;
    };
    const item = list.itemsInCategory(categoryId).find(matches);
    if (item) selectStructure(list.structureType(item.id, !list.isMirrored()));
    persistIfEnabled();
    repaint?.();
  };
  const toggleTag = (tag) => {
    list.toggleTag(tag);
    const tags = list.getSelectedTags();
    const avail = /* @__PURE__ */ new Set();
    for (const it of list.catalogueItems) {
      const itemTags = it.tags ?? [];
      if (tags.length > 0 && !tags.some((t) => itemTags.includes(t))) continue;
      for (const s of it.sizes ?? []) avail.add(s);
    }
    const stale = list.getSelectedSizes().filter((s) => !avail.has(s));
    if (stale.length > 0) {
      list.setSelectedSizes(list.getSelectedSizes().filter((s) => avail.has(s)));
    }
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

// ../../packages/buffer-controls/src/structure/shared.ts
var EXPOSED_KINDS = [
  "bool",
  "number",
  "string"
];
function resolveBindingPath(path) {
  return path.replace(/\[\]/g, "[0]");
}
var CELL = 16;
var STRUCT_H = 16;
var RECT_W = 5 * 16;
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
function loadImage(spriteId) {
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
  ctx.drawImage(image, origin.x, origin.y, CELL, CELL);
  const rx = origin.x + CELL;
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

// ../../packages/buffer-controls/src/structure/actionRegister.ts
var ACTION_LABEL = {
  inc: "+1",
  dec: "-1",
  toggle: "toggle"
};
function applyAction(op, current) {
  switch (op) {
    case "inc":
      return (Number(current) || 0) + 1;
    case "dec":
      return (Number(current) || 0) - 1;
    case "toggle":
      return !current;
  }
}
function registerActionStructures(list, spriteFor, read, write) {
  const modId = list.modId;
  const actionItems = [];
  const compute = (structure) => {
    const p = structure.data?.path;
    if (typeof p !== "string" || p.length === 0) return false;
    return read(p) ? true : false;
  };
  const push = (structure, on) => {
    sandkit.api.signals?.setOutputAtCell?.(structure.x, structure.y, on);
  };
  for (const item of list.catalogueItems) {
    if (!item.tags?.includes("action")) continue;
    const typeId = list.structureType(item.id);
    const spriteId = spriteFor(item) ?? typeId;
    const op = item.action ?? "inc";
    const path = item.path ?? item.id;
    actionItems.push({
      typeId,
      path
    });
    const draw = (_state, _structure, _render) => {
      const d = read(_structure.data?.path);
      sandkit.api.structures.setSpritesheetIndexAtCell(_structure.x, _structure.y, d ? 1 : 0);
      return false;
    };
    sandkit.api.structures.register({
      id: typeId,
      categoryKey: "blocks",
      name: item.label,
      description: item.description,
      hideFromBuildMenu: true,
      shape: makeShape(1, 1),
      ...sectionBuild.single(typeId),
      ...buildSectionTooltips(),
      render: {
        imageName: spriteId,
        size: {
          width: 16,
          height: 16
        }
      },
      copyData: true,
      defaultData: {
        path,
        kind: item.kind ?? "string",
        op
      },
      draw
    });
    sandkit.api.signals?.interactables?.register?.(typeId, (structure) => {
      const p = structure.data?.path;
      if (typeof p !== "string" || p.length === 0) return;
      write(p, applyAction(op, read(p)));
      push(structure, compute(structure));
    });
    sandkit.api.signals?.registerSenderType(typeId, (s) => compute(s));
  }
  const refreshSignals = () => {
    console.log("REFRESH SINAL : ", actionItems);
    for (const a of actionItems) {
      sandkit.api.structures.forEachOfType(a.typeId, (structure) => {
        push(structure, compute(structure));
      });
    }
  };
  console.log(`[${modId}] registered action structures (${actionItems.length} types)`);
  return {
    refreshSignals
  };
}

// ../../packages/buffer-controls/src/catalogue.ts
var CELL2 = 16;
var ITEM_HEIGHT = 6 * 15;
var VALUE_PREFIX = "value:";
var ACTION_PREFIX = "action:";
var menuItem = (menuItemId, menu, filePathFor) => ({
  id: menuItemId,
  label: menu.label,
  description: menu.description,
  category: "menu",
  tags: [
    "variables"
  ],
  width: CELL2,
  height: CELL2,
  filePath: filePathFor(menu.spriteId)
});
var variableItem = (field, filePathFor) => ({
  id: field.path,
  path: field.path,
  kind: field.kind,
  label: field.path,
  description: `${field.kind} \u2014 linked to jsonBuffer path "${field.path}".`,
  category: field.path,
  tags: [
    "variables"
  ],
  width: CELL2,
  height: ITEM_HEIGHT,
  filePath: filePathFor(field.kind)
});
var valueItem = (field, filePathFor) => ({
  id: `${VALUE_PREFIX}${field.path}`,
  path: field.path,
  kind: field.kind,
  label: field.path,
  description: `${field.kind} \u2014 live value for jsonBuffer path "${field.path}".`,
  category: field.path,
  tags: [
    "value"
  ],
  width: CELL2,
  height: ITEM_HEIGHT,
  filePath: filePathFor(field.kind)
});
var actionItem = (field, op, filePathFor) => ({
  id: `${ACTION_PREFIX}${field.path}:${op}`,
  action: op,
  path: field.path,
  kind: field.kind,
  label: `${field.path} ${ACTION_LABEL[op]}`,
  description: `${ACTION_LABEL[op]} \u2014 writes jsonBuffer path "${field.path}" then commits.`,
  category: field.path,
  tags: [
    "action"
  ],
  width: CELL2,
  height: CELL2,
  filePath: filePathFor(op)
});
var actionItemsFor = (field, filePathFor) => {
  if (field.kind === "number") {
    return [
      actionItem(field, "inc", filePathFor),
      actionItem(field, "dec", filePathFor)
    ];
  }
  if (field.kind === "bool") return [
    actionItem(field, "toggle", filePathFor)
  ];
  return [];
};
function boundFields(listed) {
  return listed.filter((f) => f.kind !== void 0 && EXPOSED_KINDS.includes(f.kind)).map((f) => ({
    kind: f.kind,
    path: resolveBindingPath(f.path)
  }));
}
function buildBufferControlList(modId, bound, config) {
  const filePathFor = (spriteEntryId) => config.spriteFiles.find((f) => f.id === spriteEntryId)?.filePath ?? "";
  const categories = bound.map((field) => {
    return {
      id: field.path,
      label: field.path
    };
  });
  const menuId = config.menuItemId ?? modId;
  const items = [
    menuItem(menuId, config.menu, filePathFor),
    ...bound.flatMap((field) => [
      variableItem(field, filePathFor),
      valueItem(field, filePathFor),
      ...actionItemsFor(field, filePathFor)
    ])
  ];
  const list = createBuildList({
    modId,
    menuId,
    menuLabel: config.menu.label,
    categories,
    catalogueItems: items,
    selectedId: bound[0]?.path
  });
  return {
    list,
    pathCount: bound.length
  };
}

// ../../packages/buffer-controls/src/structure/varRegister.ts
function registerPathStructures(list, spriteFor) {
  const modId = list.modId;
  let count = 0;
  for (const item of list.catalogueItems) {
    if (!item.tags?.includes("variables")) continue;
    count++;
    const isMenu = item.id === list.menuId;
    const typeId = list.structureType(item.id);
    const spriteId = spriteFor(item) ?? typeId;
    const draw = (_state, structure, render) => drawIconAndReadout(structure, render, {
      spriteId,
      // Path structure: the readout shows the bound jsonBuffer path.
      text: String(structure.data?.path ?? item.label ?? item.id)
    });
    sandkit.api.structures.register({
      id: typeId,
      categoryKey: "blocks",
      name: item.label,
      description: isMenu ? item.description : `${item.kind ?? "string"} \u2014 linked to jsonBuffer path "${item.path ?? item.id}".`,
      hideFromBuildMenu: !isMenu,
      shape: makeShape(1, 1),
      ...sectionBuild.single(typeId),
      ...isMenu ? buildMenuRender(item, spriteId) : {},
      ...buildSectionTooltips(),
      ...buildSectionData(item, spriteId),
      draw
    });
    if (isMenu) {
      console.log("--------------------------------------------  type is unlocked ");
      sandkit.api.player.buildings.unlockByType(typeId);
    }
  }
  console.log(`[${modId}] registered ${count} buffer structures`);
}

// ../../packages/buffer-controls/src/structure/valueRegister.ts
function formatBufferValue(value, kind) {
  if (kind === "string") return String(value ?? "");
  if (kind === "number") return String(value ?? 0);
  return String(value ?? false);
}
function registerValueStructures(list, spriteFor, readValue) {
  const entries = [];
  const modId = list.modId;
  for (const item of list.catalogueItems) {
    if (!item.tags?.includes("value")) continue;
    const typeId = list.structureType(item.id);
    const spriteId = spriteFor(item) ?? typeId;
    const kind = item.kind ?? "string";
    const path = item.path ?? item.id;
    const value = formatBufferValue(readValue(path), kind);
    const draw = (_state, structure, render) => drawIconAndReadout(structure, render, {
      spriteId,
      // Value structure: the readout shows the last buffer value,
      // refreshed on every buffer update via setData({ dataValue }).
      text: String(structure.data?.dataValue ?? value)
    });
    sandkit.api.structures.register({
      id: typeId,
      categoryKey: "blocks",
      name: item.label,
      description: `live value \u2014 linked to jsonBuffer path "${path}".`,
      hideFromBuildMenu: true,
      shape: makeShape(1, 1),
      ...sectionBuild.single(typeId),
      ...buildSectionTooltips(),
      ...buildSectionData(item, spriteId, {
        dataValue: value
      }),
      draw
    });
    entries.push({
      typeId,
      path,
      kind
    });
  }
  console.log(`[${modId}] registered ${entries.length} value structures`);
  return entries;
}

// ../../packages/buffer-controls/src/buffer-controls.ts
async function registerBufferControls(config) {
  const { modId } = config;
  const buffer = new JsonBuffer(modId, config.bufferId, config.defaultRecord);
  const readBuffer = (path) => buffer.getPath(path);
  const writeBuffer = (path, value) => {
    buffer.setPath(path, value);
    buffer.commit();
  };
  console.log("[pkg-buffControl], 1 ", buffer.get(), buffer.listPaths());
  const spriteIds = await loadSpriteMap(modId, config.spriteFiles);
  const menuItemId = config.menuItemId ?? modId;
  const spriteFor = (item) => {
    if (item.id === menuItemId) return spriteIds[config.menu.spriteId];
    const action = item.action;
    if (action) return spriteIds[config.sprites.action[action]];
    const kind = item.kind ?? "string";
    return spriteIds[config.sprites.kind[kind] ?? "string"];
  };
  const bound = boundFields(buffer.listPaths());
  const { list, pathCount } = buildBufferControlList(modId, bound, config);
  console.log("[pkg-buffControl], 3 ", list, pathCount);
  registerPathStructures(list, spriteFor);
  const valueEntries = registerValueStructures(list, spriteFor, readBuffer);
  const { refreshSignals } = registerActionStructures(list, spriteFor, readBuffer, writeBuffer);
  console.log("[pkg-buffControl], 4 ", valueEntries);
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
  setInterval(() => {
    buffer.pull();
  }, 500);
  refresh();
  sandkit.api.events?.on?.("building:placed", () => refresh());
  createPickerOverlay({
    list,
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
    list,
    pathCount,
    refresh
  };
}

// src/configSchema.ts
var CONFIG_FIELDS = [
  // master (panel toggles at top)
  {
    index: 0,
    key: "enabled",
    kind: "bool",
    section: "master",
    label: "Mod active",
    default: true
  },
  {
    index: 1,
    key: "debugLog",
    kind: "bool",
    section: "master",
    label: "Debug log",
    default: false
  },
  {
    index: 2,
    key: "waterEnabled",
    kind: "bool",
    section: "master",
    label: "Water profile",
    default: true
  },
  // move
  {
    index: 3,
    key: "stepMove",
    kind: "bool",
    section: "move",
    label: "Movement",
    default: true
  },
  {
    index: 4,
    key: "moveSide",
    kind: "number",
    section: "move",
    label: "Side %",
    default: 0,
    min: 0,
    max: 100,
    when: "stepMove"
  },
  {
    index: 5,
    key: "moveFloat",
    kind: "number",
    section: "move",
    label: "Float %",
    default: 0,
    min: 0,
    max: 100,
    when: "stepMove"
  },
  {
    index: 6,
    key: "moveSink",
    kind: "number",
    section: "move",
    label: "Sink %",
    default: 0,
    min: 0,
    max: 100,
    when: "stepMove"
  },
  // index 7 (old moveContact slot) is reused as JSON_COUNTER_INDEX by the
  // panel (uint8 JSON buffer change signal) — see JSON_COUNTER_INDEX.
  {
    index: 20,
    key: "stepForceMove",
    kind: "bool",
    section: "move",
    label: "Column forces",
    default: false
  },
  // grow
  {
    index: 8,
    key: "stepGrow",
    kind: "bool",
    section: "grow",
    label: "Grow",
    default: false
  },
  {
    index: 9,
    key: "growInstantTouch",
    kind: "number",
    section: "grow",
    label: "Instant %",
    default: 0,
    min: 0,
    max: 100,
    when: "stepGrow"
  },
  {
    index: 10,
    key: "growOnAir",
    kind: "number",
    section: "grow",
    label: "Air %",
    default: 0,
    min: 0,
    max: 100,
    when: "stepGrow"
  },
  {
    index: 11,
    key: "growOnWall",
    kind: "number",
    section: "grow",
    label: "Wall %",
    default: 0,
    min: 0,
    max: 100,
    when: "stepGrow"
  },
  {
    index: 12,
    key: "growOnFloor",
    kind: "number",
    section: "grow",
    label: "Floor %",
    default: 0,
    min: 0,
    max: 100,
    when: "stepGrow"
  },
  {
    index: 13,
    key: "growOnCrystal",
    kind: "number",
    section: "grow",
    label: "Crystal %",
    default: 0,
    min: 0,
    max: 100,
    when: "stepGrow"
  },
  {
    index: 14,
    key: "growIfSurround",
    kind: "number",
    section: "grow",
    label: "Surround %",
    default: 0,
    min: 0,
    max: 100,
    when: "stepGrow"
  },
  {
    index: 15,
    key: "growSurroundMin",
    kind: "number",
    section: "grow",
    label: "Surr. min",
    default: 0,
    min: 0,
    max: 8,
    when: "stepGrow"
  },
  // crystal
  {
    index: 16,
    key: "stepCrystalisation",
    kind: "bool",
    section: "crystal",
    label: "Crystallize",
    default: false
  },
  {
    index: 17,
    key: "crystalGrowAge",
    kind: "number",
    section: "crystal",
    label: "Grow age",
    default: 0,
    min: 0,
    max: 200,
    when: "stepCrystalisation"
  },
  {
    index: 18,
    key: "crystalShape",
    kind: "number",
    section: "crystal",
    label: "Shape 0\u20134",
    default: 0,
    min: 0,
    max: 4,
    when: "stepCrystalisation"
  },
  {
    index: 19,
    key: "crystalRadius",
    kind: "number",
    section: "crystal",
    label: "Radius",
    default: 0,
    min: 0,
    max: 6,
    when: "stepCrystalisation"
  }
];
function buildDefaultConfigRecord() {
  const state = {};
  for (const f of CONFIG_FIELDS) {
    state[f.key] = f.default;
  }
  return state;
}
var bufField = Object.fromEntries(CONFIG_FIELDS.map((f) => [
  f.key,
  f.index
]));

// src/main.ts
var MOD_ID = "buffer-controls";
var defaultValue = buildDefaultConfigRecord();
void (async () => {
  await registerBufferControls({
    modId: MOD_ID,
    bufferId: `${MOD_ID}:gameConfig`,
    defaultRecord: defaultValue,
    menu: {
      label: "Buffer Controls",
      description: "Buffer Controls \u2014 opens the variable picker.",
      spriteId: "menu"
    },
    categories: {
      variables: "Variables",
      value: "Value",
      action: "Action"
    },
    sprites: {
      kind: {
        bool: "bolean",
        number: "number",
        string: "string"
      },
      action: {
        inc: "actionPlus",
        dec: "actionMinus",
        toggle: "actionToggle"
      }
    },
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
        id: "actionToggle",
        filePath: "assets/types/toggle.png"
      }
    ],
    pickerTitle: "Buffer controls"
  });
})();
try {
  findOrphanedObjects(MOD_ID);
  pruneStaleBuildings(MOD_ID);
} catch (e) {
  console.error(e instanceof Error ? e.stack : e);
}
