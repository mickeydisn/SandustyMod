// ../../packages/assets/src/loader.ts
async function loadSpriteMap(modId, entries, options = {}) {
  const assetDir = options.assetDir ? options.assetDir + "/" : "";
  const concurrency = options.concurrency ?? 16;
  const ids = {};
  let next = 0;
  const worker = async () => {
    while (next < entries.length) {
      const entry = entries[next++];
      const spriteId = `${modId}:${options.idPrefix ?? ""}${entry.id}`;
      try {
        await sandkit.api.sprites.loadFromMod(spriteId, `${assetDir}${entry.file}`);
        ids[entry.id] = spriteId;
      } catch (e) {
        console.error(`${modId}: Unknow Asset:  ${assetDir}${entry.file}`);
        console.error("Thrown value:", e);
      }
    }
  };
  await Promise.all(Array.from({
    length: Math.min(concurrency, entries.length)
  }, () => worker()));
  return ids;
}

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

// src/catalogue.generated.ts
var ICON_FILES = [
  {
    "id": "icons",
    "file": "assets/char-A-1x1.png"
  },
  {
    "id": "button",
    "file": "assets/button.png"
  },
  {
    "id": "counter",
    "file": "assets/counter.png"
  },
  {
    "id": "counter-2x1",
    "file": "assets/counter-2x1.png"
  },
  {
    "id": "counter-3x1",
    "file": "assets/counter-3x1.png"
  },
  {
    "id": "counter-4x1",
    "file": "assets/counter-4x1.png"
  },
  {
    "id": "counter-5x1",
    "file": "assets/counter-5x1.png"
  },
  {
    "id": "counter-1x1",
    "file": "assets/counter-1x1.png"
  },
  {
    "id": "display",
    "file": "assets/display.png"
  },
  {
    "id": "display-2x1",
    "file": "assets/display-2x1.png"
  },
  {
    "id": "display-3x1",
    "file": "assets/display-3x1.png"
  },
  {
    "id": "display-4x1",
    "file": "assets/display-4x1.png"
  },
  {
    "id": "display-5x1",
    "file": "assets/display-5x1.png"
  },
  {
    "id": "display-2x2",
    "file": "assets/display-2x2.png"
  },
  {
    "id": "display-3x3",
    "file": "assets/display-3x3.png"
  },
  {
    "id": "dpad",
    "file": "assets/dpad.png"
  },
  {
    "id": "gauge",
    "file": "assets/gauge.png"
  },
  {
    "id": "gauge-2x1",
    "file": "assets/gauge-2x1.png"
  },
  {
    "id": "gauge-3x1",
    "file": "assets/gauge-3x1.png"
  },
  {
    "id": "gauge-4x1",
    "file": "assets/gauge-4x1.png"
  },
  {
    "id": "gauge-5x1",
    "file": "assets/gauge-5x1.png"
  },
  {
    "id": "gauge-1x1",
    "file": "assets/gauge-1x1.png"
  },
  {
    "id": "led-off",
    "file": "assets/led-off.png"
  },
  {
    "id": "led-on",
    "file": "assets/led-on.png"
  },
  {
    "id": "minus",
    "file": "assets/minus.png"
  },
  {
    "id": "plus",
    "file": "assets/plus.png"
  },
  {
    "id": "pulse",
    "file": "assets/pulse.png"
  },
  {
    "id": "range",
    "file": "assets/range.png"
  },
  {
    "id": "range-2x1",
    "file": "assets/range-2x1.png"
  },
  {
    "id": "range-3x1",
    "file": "assets/range-3x1.png"
  },
  {
    "id": "range-4x1",
    "file": "assets/range-4x1.png"
  },
  {
    "id": "range-5x1",
    "file": "assets/range-5x1.png"
  },
  {
    "id": "range-1x1",
    "file": "assets/range-1x1.png"
  },
  {
    "id": "selector",
    "file": "assets/selector.png"
  },
  {
    "id": "selector-2x1",
    "file": "assets/selector-2x1.png"
  },
  {
    "id": "selector-3x1",
    "file": "assets/selector-3x1.png"
  },
  {
    "id": "selector-4x1",
    "file": "assets/selector-4x1.png"
  },
  {
    "id": "selector-5x1",
    "file": "assets/selector-5x1.png"
  },
  {
    "id": "selector-1x1",
    "file": "assets/selector-1x1.png"
  },
  {
    "id": "text",
    "file": "assets/text.png"
  },
  {
    "id": "text-2x1",
    "file": "assets/text-2x1.png"
  },
  {
    "id": "text-3x1",
    "file": "assets/text-3x1.png"
  },
  {
    "id": "text-4x1",
    "file": "assets/text-4x1.png"
  },
  {
    "id": "text-5x1",
    "file": "assets/text-5x1.png"
  },
  {
    "id": "text-1x1",
    "file": "assets/text-1x1.png"
  },
  {
    "id": "toggle-off",
    "file": "assets/toggle-off.png"
  },
  {
    "id": "toggle-on",
    "file": "assets/toggle-on.png"
  }
];

// ../../packages/buffer/src/utils/codec.ts
function decodeJson(buffer) {
  try {
    const end = buffer.indexOf(0);
    const bytes = buffer.slice(0, end === -1 ? buffer.length : end);
    const result = new TextDecoder().decode(bytes);
    console.log("=====> ReadJson Buffer", result);
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
    console.error("Force config too big \u2014 buffer truncated");
  }
  buf.fill(0);
  buf.set(bytes.subarray(0, buf.length));
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
  console.log("Create a new Buffer ", key);
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
    return () => this.listeners.delete(fn);
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
      console.log("STORAGE Get", this.modId, this.key, storedRecord);
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
  hasUpdate = () => {
    this.remoteVersion() !== this.localVersion;
  };
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
    console.log("STORAGE set", this.key, this.cache);
    this.localVersion = this.remoteVersion() + 1;
    this.notify();
  }
  save() {
    sandkit.api.storage.local.set(this.key, this.cache);
  }
};

// src/main.ts
var MOD_ID = "buffer-controls";
var BUFFER_ID = `${MOD_ID}:gameConfig`;
async function main() {
  const spriteIds = await loadSpriteMap(MOD_ID, ICON_FILES, {
    assetDir: "",
    concurrency: 16
  });
  console.log("=== SPRITE ", spriteIds);
  const buffer = new JsonBuffer(MOD_ID, BUFFER_ID, {
    volume: 1,
    muted: false,
    players: [
      {
        name: "Bob",
        score: 0
      }
    ]
  });
  const buffer2 = new JsonBuffer(MOD_ID, BUFFER_ID, {
    volume: 1,
    muted: false,
    players: [
      {
        name: "Bob",
        score: 0
      }
    ]
  });
  const path = buffer.listPaths();
  console.log("LIST _PATH");
}
try {
  findOrphanedObjects(MOD_ID);
  pruneStaleBuildings(MOD_ID);
  const storage = sandkit.api.storage.ensure(MOD_ID);
  console.log("STORE", storage);
  console.log("getGridMetrics:", sandkit.api.rendering.getGridMetrics());
  void main();
} catch (e) {
  console.error(e instanceof Error ? e.stack : e);
  console.error(e);
}
