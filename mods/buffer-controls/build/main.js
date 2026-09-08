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
    for (const h3 of listeners[name]) {
      try {
        h3(event);
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
  constructor(modId, key, defaultRecord, assertShape) {
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
      const storedRecord = sandkit.api.storage.local.get(this.key);
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

// src/structure/sectionStructure.ts
var BUILD_MODE = () => {
  return {
    single: {
      type: "single"
    },
    rec: {
      type: "rectangle"
    },
    line: {
      type: "line",
      directions: [
        "horizontal",
        "vertical"
      ]
    }
  };
};
var VARIANTS = (typeId) => {
  return {
    single: {
      id: typeId,
      angles: [
        0
      ]
    },
    card: {
      id: typeId,
      angles: [
        0,
        90,
        180,
        270
      ]
    }
  };
};
var sectionBuild = {
  single: (typeId) => {
    return {
      buildModes: [
        BUILD_MODE().single
      ],
      variants: [
        VARIANTS(typeId).single
      ]
    };
  },
  rec: (typeId) => {
    return {
      buildModes: [
        BUILD_MODE().rec
      ],
      variants: [
        VARIANTS(typeId).single
      ]
    };
  }
};

// src/structure/shared.ts
var KIND_SPRITE_KEY = {
  bool: "bolean",
  number: "number",
  string: "string"
};
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
        messageKey: "{material}: {amount}",
        fields: [
          {
            param: "material",
            field: "path",
            fallback: "Unbound"
          },
          {
            param: "amount",
            field: "kind",
            fallback: "string"
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
  ctx.fillStyle = "#000000";
  ctx.fillRect(rx, ry, rw, rh);
  ctx.fillStyle = "#c1812e";
  ctx.fillRect(rx + 1, ry + 1, rw - 2, rh - 2);
  ctx.fillStyle = "#000000";
  ctx.fillRect(rx + 2, ry + 2, rw - 4, rh - 4);
  ctx.font = "9px monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = "#c1812e";
  ctx.fillText(opts.text, rx + 6, ry + rh / 2, rw - 12);
  ctx.restore();
  return true;
}

// src/structure/register.ts
function registerPathStructures(list, spriteFor) {
  const modId = list.modId;
  let count = 0;
  for (const item of list.catalogueItems) {
    if (item.category === "value" || item.category === "action") continue;
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
      description: isMenu ? "Buffer Controls \u2014 opens the variable picker." : `${item.kind ?? "string"} \u2014 linked to jsonBuffer path "${item.path ?? item.id}".`,
      hideFromBuildMenu: !isMenu,
      shape: makeShape(1, 1),
      ...sectionBuild.single(typeId),
      ...isMenu ? buildMenuRender(item, spriteId) : {},
      ...buildSectionTooltips(),
      ...buildSectionData(item, spriteId),
      draw
    });
    if (isMenu) {
      sandkit.api.player.buildings.unlockByType(typeId);
    }
  }
  console.log(`[${modId}] registered ${count} buffer structures`);
}

// src/structure/valueRegister.ts
function formatBufferValue(value, kind) {
  if (kind === "string") return String(value ?? "");
  if (kind === "number") return String(value ?? 0);
  return String(value ?? false);
}
function registerValueStructures(list, spriteFor, readValue) {
  const entries = [];
  const modId = list.modId;
  for (const item of list.catalogueItems) {
    if (item.category !== "value") continue;
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

// src/structure/actionRegister.ts
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
  for (const item of list.catalogueItems) {
    if (item.category !== "action") continue;
    const typeId = list.structureType(item.id);
    const spriteId = spriteFor(item) ?? typeId;
    const op = item.action ?? "inc";
    const path = item.path ?? item.id;
    sandkit.api.structures.register({
      id: typeId,
      categoryKey: "blocks",
      name: item.label,
      description: `${ACTION_LABEL[op]} \u2014 writes jsonBuffer path "${path}" then commits.`,
      hideFromBuildMenu: true,
      shape: makeShape(1, 1),
      ...sectionBuild.single(typeId),
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
      }
    });
    sandkit.api.signals?.interactables?.register?.(typeId, (structure) => {
      const p = structure.data?.path;
      if (typeof p !== "string" || p.length === 0) return;
      write(p, applyAction(op, read(p)));
    });
  }
  console.log(`[${modId}] registered action structures`);
}

// src/picker.ts
var h2 = (type, props, ...children) => sandkit.react.createElement(type, props, ...children);
function createVariablePicker(options) {
  const list = options.list;
  const pickerId = `${list.modId}/picker`;
  const title = options.title ?? "Buffer variables";
  const modPrefix = `${list.modId}:`;
  const bridge = {
    repaint: null
  };
  let open = false;
  let minimized = false;
  let activeCategory = list.getCategory() || "";
  let unsubscribe = null;
  let pollTimer = null;
  const selectItem = (item) => {
    const type = list.structureType(item.id);
    sandkit.api.player.buildings.unlockByType(type);
    list.setSelected(item.id);
    sandkit.api.building?.selectStructure?.(type);
    bridge.repaint?.();
  };
  const Row = (props) => {
    const spriteId = options.spriteFor(props.item);
    const src = spriteId ? sandkit.api.sprites.getById(spriteId)?.imageAsset?.image?.src : void 0;
    const selected = list.getSelected()?.id === props.item.id;
    return h2("button", {
      key: props.item.id,
      onClick: () => selectItem(props.item),
      className: "flex items-center gap-2 w-full text-left px-3 py-1.5 rounded border text-xs whitespace-nowrap " + (selected ? "text-[#ffe700] border-yellow-400 bg-yellow-400/10" : "text-slate-300 border-slate-700 hover:text-white hover:border-slate-500"),
      children: [
        src ? h2("img", {
          src,
          width: 16,
          height: 16,
          className: "shrink-0"
        }) : h2("span", {
          className: "w-4 h-4 shrink-0"
        }),
        h2("span", {
          children: props.item.label
        }),
        h2("span", {
          className: "ml-auto text-slate-500 text-[10px] uppercase",
          children: String(props.item.kind ?? "")
        })
      ]
    });
  };
  const Panel = () => {
    const [, forceUpdate] = sandkit.react.useState(0);
    if (!bridge.repaint) {
      bridge.repaint = () => forceUpdate((n) => n + 1);
    }
    const categories = list.categories.filter((c) => list.countIn(c.id) > 0);
    if (categories.length > 0 && !categories.some((c) => c.id === activeCategory)) {
      activeCategory = categories[0].id;
    }
    const items = list.catalogueItems.filter((i) => i.category === activeCategory);
    if (!open) return null;
    if (minimized) {
      return h2("div", {
        className: "flex items-center gap-2 bg-slate-900/90 border border-slate-700 rounded px-3 py-1"
      }, h2("span", {
        className: "text-xs text-slate-300",
        children: title
      }), h2("button", {
        className: "text-xs text-slate-400 hover:text-white",
        onClick: () => {
          minimized = false;
          bridge.repaint?.();
        },
        children: "\u25B2"
      }));
    }
    return h2("div", {
      className: "flex flex-col bg-slate-900/90 border border-slate-700 rounded w-[320px] max-h-[40vh]"
    }, h2("div", {
      className: "flex items-center px-3 py-2 border-b border-slate-700"
    }, h2("span", {
      className: "text-xs text-white font-bold",
      children: title
    }), h2("button", {
      className: "ml-auto text-xs text-slate-400 hover:text-white",
      onClick: () => {
        minimized = true;
        bridge.repaint?.();
      },
      children: "\u2014"
    })), h2("div", {
      className: "flex items-center gap-1 px-2 py-1 border-b border-slate-700 overflow-x-auto"
    }, categories.length > 1 ? categories.map((cat) => h2("button", {
      key: cat.id,
      className: "text-[10px] px-2 py-0.5 rounded border whitespace-nowrap " + (cat.id === activeCategory ? "text-[#ffe700] border-yellow-400 bg-yellow-400/10" : "text-slate-400 border-slate-700 hover:text-white hover:border-slate-500"),
      onClick: () => {
        activeCategory = cat.id;
        list.setCategory(cat.id);
        bridge.repaint?.();
      },
      children: cat.label
    })) : null), h2("div", {
      className: "flex flex-col gap-1 px-2 py-2 overflow-y-auto"
    }, items.map((item) => h2(Row, {
      key: item.id,
      item
    }))));
  };
  const syncNow = () => {
    const selected = sandkit.api.action.getSelected?.();
    const building = sandkit.enums?.ActionType?.Building;
    const ours = !!selected && selected.type === building && typeof selected.id === "string" && selected.id.startsWith(modPrefix);
    if (ours) {
      const id = list.itemFromType(String(selected.id))?.id;
      if (id) list.setSelected(id);
      open = true;
    } else {
      open = false;
      minimized = false;
    }
    bridge.repaint?.();
  };
  let syncQueued = false;
  const sync = () => {
    if (syncQueued) return;
    syncQueued = true;
    setTimeout(() => {
      syncQueued = false;
      syncNow();
    }, 0);
  };
  const install = () => {
    sandkit.api.ui.overlays.register("hotbar", pickerId, () => sandkit.react.createElement(Panel, null));
    unsubscribe = sandkit.api.events.on("action:changed", sync);
    pollTimer = setInterval(syncNow, 1e3);
    sync();
  };
  install();
  return {
    pickerId,
    dispose() {
      unsubscribe?.();
      unsubscribe = null;
      if (pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      open = false;
      bridge.repaint = null;
    }
  };
}

// src/main.ts
var MOD_ID = "buffer-controls";
var MENU_ID = "buffer-controls";
var VARIABLE_CATEGORY = "variables";
var VALUE_CATEGORY = "value";
var ACTION_CATEGORY = "action";
var VALUE_PREFIX = "value:";
var ACTION_PREFIX = "action:";
var BUFFER_ID = `${MOD_ID}:gameConfig`;
var SPRITE_FILES = [
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
    filePath: "assets/other/display.png"
  },
  {
    id: "actionPlus",
    filePath: "assets/other/plus.png"
  },
  {
    id: "actionMinus",
    filePath: "assets/other/minus.png"
  },
  {
    id: "actionToggle",
    filePath: "assets/other/toggle-on.png"
  }
];
var ACTION_SPRITE_ID = {
  inc: "actionPlus",
  dec: "actionMinus",
  toggle: "actionToggle"
};
var CELL2 = 16;
var STRUCT_H2 = 6 * 15;
async function main() {
  const api = sandkit.api;
  const buffer = new JsonBuffer(MOD_ID, BUFFER_ID, {
    volume: 1,
    muted: false,
    label: "hello",
    players: [
      {
        name: "Bob",
        score: 0
      }
    ]
  });
  const readBuffer = (path) => buffer.getPath(path);
  const writeBuffer = (path, value) => {
    buffer.setPath(path, value);
    buffer.commit();
  };
  const spriteIds = await loadSpriteMap(MOD_ID, SPRITE_FILES);
  const kindSpriteId = (kind) => spriteIds[KIND_SPRITE_KEY[kind] ?? "string"];
  const spriteFor = (item) => {
    if (item.id === MENU_ID) return spriteIds["menu"];
    const action = item.action;
    if (action) return spriteIds[ACTION_SPRITE_ID[action]];
    return kindSpriteId(item.kind ?? "string");
  };
  const bound = buffer.listPaths().filter((field) => EXPOSED_KINDS.includes(field.kind)).map((field) => ({
    ...field,
    path: resolveBindingPath(field.path)
  }));
  const actionItems = (field) => {
    if (field.kind === "number") {
      const make = (op) => ({
        id: `${ACTION_PREFIX}${field.path}:${op}`,
        action: op,
        path: field.path,
        kind: field.kind,
        label: `${field.path} ${ACTION_LABEL[op]}`,
        description: `${ACTION_LABEL[op]} \u2014 writes jsonBuffer path "${field.path}" then commits.`,
        category: ACTION_CATEGORY,
        width: CELL2,
        height: CELL2,
        filePath: "assets/other/plus.png"
      });
      return [
        make("inc"),
        make("dec")
      ];
    }
    if (field.kind === "bool") {
      return [
        {
          id: `${ACTION_PREFIX}${field.path}:toggle`,
          action: "toggle",
          path: field.path,
          kind: field.kind,
          label: `${field.path} ${ACTION_LABEL["toggle"]}`,
          description: `toggle \u2014 writes jsonBuffer path "${field.path}" then commits.`,
          category: ACTION_CATEGORY,
          width: CELL2,
          height: CELL2,
          filePath: "assets/other/toggle-on.png"
        }
      ];
    }
    return [];
  };
  const items = [
    {
      id: MENU_ID,
      label: "Buffer Controls",
      description: "Buffer Controls \u2014 opens the variable picker.",
      category: VARIABLE_CATEGORY,
      width: CELL2,
      height: CELL2,
      filePath: "assets/other/display.png"
    },
    ...bound.map((field) => ({
      id: field.path,
      path: field.path,
      label: field.path,
      description: `${field.kind} \u2014 linked to jsonBuffer path "${field.path}".`,
      category: VARIABLE_CATEGORY,
      width: CELL2,
      height: STRUCT_H2,
      filePath: "assets/types/string.png",
      kind: field.kind
    })),
    ...bound.map((field) => ({
      id: `${VALUE_PREFIX}${field.path}`,
      path: field.path,
      label: field.path,
      description: `${field.kind} \u2014 live value for jsonBuffer path "${field.path}".`,
      category: VALUE_CATEGORY,
      width: CELL2,
      height: STRUCT_H2,
      filePath: "assets/types/string.png",
      kind: field.kind
    })),
    ...bound.flatMap(actionItems)
  ];
  const categories = [
    {
      id: VARIABLE_CATEGORY,
      label: "Variables"
    },
    {
      id: VALUE_CATEGORY,
      label: "Value"
    },
    {
      id: ACTION_CATEGORY,
      label: "Action"
    }
  ];
  const list = createBuildList({
    modId: MOD_ID,
    menuId: MENU_ID,
    menuLabel: "Buffer Controls",
    categories,
    catalogueItems: items,
    selectedId: bound[0]?.path
  });
  registerPathStructures(list, spriteFor);
  const valueEntries = registerValueStructures(list, spriteFor, readBuffer);
  registerActionStructures(list, spriteFor, readBuffer, writeBuffer);
  const refreshValueStructures = () => {
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
  buffer.subscribe(() => refreshValueStructures());
  setInterval(() => {
    buffer.pull();
  }, 500);
  refreshValueStructures();
  sandkit.api.events?.on?.("building:placed", () => refreshValueStructures());
  createVariablePicker({
    list,
    title: "Buffer controls",
    spriteFor
  });
  api.ui?.toast?.(`Buffer Controls \u2014 ${bound.length} paths loaded`, {});
  console.log(`[${MOD_ID}] loaded ${bound.length} jsonBuffer paths`);
}
try {
  findOrphanedObjects(MOD_ID);
  pruneStaleBuildings(MOD_ID);
  console.log("==== STATE STORE === ", sandkit.state?.store);
  void main();
} catch (e) {
  console.error(e instanceof Error ? e.stack : e);
  console.error(e);
}
