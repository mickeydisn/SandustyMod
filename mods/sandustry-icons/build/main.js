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
    getSelectedTags: () => selectedTags.slice(),
    setSelectedTags(tags) {
      selectedTags = tags.filter((t, i) => tags.indexOf(t) === i && catalogueItems.some((it) => (it.tags ?? []).includes(t)));
      emit("tag", {
        tags: selectedTags
      });
    },
    toggleTag(tag) {
      const next = selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [
        ...selectedTags,
        tag
      ];
      list.setSelectedTags(next);
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
function createPickerView(options) {
  const { api, maxHeight } = options;
  const list = api.list;
  const search = "";
  let tooltip = null;
  let tooltipTimer = null;
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
  const ctx = () => ({
    list,
    selected: list.getSelected(),
    mirrored: list.isMirrored(),
    categoryId: list.getCategory(),
    search,
    repaint: () => api.repaint()
  });
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
        }, props.item.label.charAt(0)),
        options.renderItemBadge ? h("span", {
          key: "badge"
        }, options.renderItemBadge(props.item)) : null
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
        if (!q) return true;
        const hay = `${item.label} ${item.id} ${item.description ?? ""} ${itemTags.join(" ")}`.toLowerCase();
        return hay.includes(q);
      });
    }
    const selectedTags = list.getSelectedTags();
    const availableTags = list.allTags();
    const matchesTags = (item) => {
      if (options.itemFilter && !options.itemFilter(item)) return false;
      const itemTags = item.tags ?? [];
      if (selectedTags.length > 0 && !selectedTags.some((t) => itemTags.includes(t))) {
        return false;
      }
      return true;
    };
    const visibleCategories = list.categories.map((cat) => ({
      cat,
      count: list.itemsInCategory(cat.id).filter(matchesTags).length
    })).filter((c) => c.count > 0);
    const visible = filterItems(list.catalogueItems, {
      categoryId,
      query: search,
      tags: selectedTags,
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
    return h("div", {
      className: "pointer-events-auto flex min-h-0 flex-col overflow-hidden bg-black bg-opacity-75 border border-slate-700 rounded ui-box text-slate-300",
      style: {
        width: `75vw`,
        maxWidth: `75vw`,
        maxHeight: `${maxHeight}px`,
        position: "fixed",
        bottom: "80px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1e3
      }
    }, h("div", {
      className: "px-4 py-2 border-b border-slate-800 flex items-center justify-between"
    }, h("span", {
      className: "text-white text-xs opacity-70"
    }, api.title), h("div", {
      className: "flex items-center gap-2"
    }, h(FocusableButton, {
      id: `${api.pickerId}-mirror`,
      onActivate: api.toggleMirror,
      className: `text-xs px-2 py-0.5 border rounded ${list.isMirrored() ? "text-[#ffe700] border-yellow-400" : "text-slate-300 border-slate-600"}`,
      children: `${list.isMirrored() ? "\u2611" : "\u2610"} Mirrored`
    }), h(FocusableButton, {
      id: `${api.pickerId}-minimize`,
      onActivate: api.minimize,
      className: "text-xs px-2 py-0.5 text-white bg-black border border-slate-600 rounded",
      children: "Minimize \u25BE"
    }))), options.renderHeaderExtra ? options.renderHeaderExtra(ctx()) : null, tooltip ? h("div", {
      style: {
        position: "fixed",
        left: `${tooltip.x}px`,
        top: `${tooltip.y - 8}px`,
        transform: "translate(-50%, -100%)",
        padding: "2px 6px",
        whiteSpace: "nowrap",
        pointerEvents: "none",
        zIndex: 1001,
        background: "rgba(0,0,0,0.9)",
        border: "1px solid rgba(255,255,255,0.25)",
        borderRadius: "3px"
      },
      className: "text-xs text-white",
      children: tooltip.label
    }) : null, availableTags.length > 0 ? h("div", {
      className: "w-full flex flex-wrap items-center gap-1 px-4 py-1 border-b border-slate-800 bg-black/30"
    }, h("span", {
      className: "text-[10px] uppercase tracking-wide text-slate-500 pr-1"
    }, "Tags:"), availableTags.map((tag) => h(FocusableButton, {
      key: tag,
      id: `${api.pickerId}-tag-${tag}`,
      onActivate: () => api.toggleTag(tag),
      className: `text-xs px-2 py-0.5 rounded border ${selectedTags.includes(tag) ? "text-[#ffe700] border-yellow-400 bg-yellow-400/10" : "text-slate-400 border-slate-600"}`,
      children: `${selectedTags.includes(tag) ? "\u2611" : "\u2610"} ${tag}`
    })), selectedTags.length > 0 ? h(FocusableButton, {
      id: `${api.pickerId}-tags-clear`,
      onActivate: () => api.clearTags(),
      className: "text-xs px-2 py-0.5 rounded border border-slate-600 text-slate-300 hover:text-white",
      children: "Clear"
    }) : null) : null, h("div", {
      className: "flex flex-row flex-wrap "
    }, h("div", {
      className: "grid grid-cols-4 overflow-y-auto  gap-1 px-4 py-2 border-b border-slate-800",
      style: {
        height: `18vh`
      }
    }, visibleCategories.map(({ cat, count }) => h(FocusableButton, {
      key: cat.id,
      id: `${api.pickerId}-cat-${cat.id}`,
      onActivate: () => {
        savedScrollRef.current = 0;
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
        api.chooseCategory(cat.id);
      },
      className: `text-xs px-2 py-0.5 rounded border w-[100px] ${cat.id === categoryId ? "text-[#ffe700] border-yellow-400" : "text-slate-400 border-slate-600"}`,
      children: `${cat.label} ${count}`
    })))), h("div", {
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
    })))));
  };
  return () => h(Picker, null);
}

// ../../packages/catalogue/src/picker/overlay.ts
function createPickerOverlay(options) {
  const list = options.list;
  const pickerId = options.pickerId ?? `${list.modId}/picker`;
  const slot = options.slot ?? "hotbar";
  const title = options.title ?? "Pick item";
  const maxHeight = options.maxHeight ?? 400;
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
    const matches = (it) => tags.length === 0 || tags.some((t) => (it.tags ?? []).includes(t));
    const item = list.itemsInCategory(categoryId).find(matches);
    if (item) selectStructure(list.structureType(item.id, !list.isMirrored()));
    persistIfEnabled();
    repaint?.();
  };
  const toggleTag = (tag) => {
    list.toggleTag(tag);
    persistIfEnabled();
    repaint?.();
  };
  const clearTags = () => {
    list.setSelectedTags([]);
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
    clearTags,
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
    maxHeight,
    spriteIdFor: options.spriteIdFor,
    itemFilter: options.itemFilter,
    renderItemBadge: options.renderItemBadge,
    renderHeaderExtra: options.renderHeaderExtra
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
    unsubscribe = sandkit.api.events.on("action:changed", sync);
    sync();
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

// ../../packages/catalogue/src/strucutre/buildDefinitiont.ts
function buildStructureDefinition(opts) {
  const makeEmptyShape = (x, y) => Array.from({
    length: y
  }, () => Array(x).fill(0));
  const _shapeEmpty = makeEmptyShape(Math.round(opts.renderSize.width / 4), Math.round(opts.renderSize.height / 4));
  const def = opts.def;
  return {
    id: opts.id,
    name: opts.name,
    categoryKey: def.categoryKey ?? "misc",
    buildModes: def.buildModes ?? [
      {
        type: "single"
      }
    ],
    variants: def.variants ?? [
      {
        id: opts.id,
        angles: [
          0
        ]
      }
    ],
    shape: def.shape ?? _shapeEmpty,
    render: def.render ?? {
      imageName: opts.spriteId,
      size: opts.renderSize ?? {
        width: 16,
        height: 16
      }
    },
    copyData: true,
    defaultData: {
      ...opts.defaultData ?? {}
    },
    // Menu definition
    ...def.nameKey ? {
      nameKey: def.nameKey
    } : {},
    ...def.description ? {
      description: def.description
    } : {},
    ...def.order != null ? {
      order: def.order
    } : {}
  };
}

// ../../packages/catalogue/src/strucutre/buildCustumDraw.ts
var DEFAULT_SPRITE_PX_PER_TILE = 16;
var buildCustumDraw = (item) => {
  return (_state, structure, render) => {
    const ctx = render?.ctx;
    if (!ctx || !sandkit.api.rendering?.getDrawPositionAtCell) return false;
    if (!item.spriteId) return false;
    const image = sandkit.api.sprites?.getById(item.spriteId)?.imageAsset?.image;
    if (!image) return false;
    const origin = sandkit.api.rendering.getDrawPositionAtCell(structure.x, structure.y);
    drawImageAligned(ctx, image, origin, item);
    return true;
  };
};
function alignFromOrigin(cellOrigin, size, align = "floor") {
  if (align === "wall" || align === "center") {
    return {
      x: cellOrigin.x + (DEFAULT_SPRITE_PX_PER_TILE - size.width) / 2,
      y: cellOrigin.y + (DEFAULT_SPRITE_PX_PER_TILE - size.height) / 2
    };
  }
  return {
    x: cellOrigin.x,
    y: cellOrigin.y + DEFAULT_SPRITE_PX_PER_TILE - size.height
  };
}
function drawImageAligned(ctx, image, origin, item) {
  const imagePos = alignFromOrigin(origin, item);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (item.isMirrored) {
    ctx.translate(imagePos.x + item.width, imagePos.y);
    ctx.scale(-1, 1);
    ctx.drawImage(image, 0, 0, item.width, item.height);
  } else {
    ctx.drawImage(image, imagePos.x, imagePos.y, item.width, item.height);
  }
  ctx.restore();
}

// src/catalogue.generated.ts
var ICON_CATEGORIES = [
  {
    "id": "arraw",
    "label": "Arraw"
  },
  {
    "id": "banner",
    "label": "Banner"
  },
  {
    "id": "beacon",
    "label": "Beacon"
  },
  {
    "id": "bg",
    "label": "Bg"
  },
  {
    "id": "block",
    "label": "Block"
  },
  {
    "id": "bot",
    "label": "Bot"
  },
  {
    "id": "char",
    "label": "Char"
  },
  {
    "id": "emoji",
    "label": "Emoji"
  },
  {
    "id": "fence",
    "label": "Fence"
  },
  {
    "id": "garden",
    "label": "Garden"
  },
  {
    "id": "gem",
    "label": "Gem"
  },
  {
    "id": "glyph",
    "label": "Glyph"
  },
  {
    "id": "hatch",
    "label": "Hatch"
  },
  {
    "id": "holo",
    "label": "Holo"
  },
  {
    "id": "home",
    "label": "Home"
  },
  {
    "id": "horiz",
    "label": "Horiz"
  },
  {
    "id": "icon",
    "label": "Icon"
  },
  {
    "id": "indus",
    "label": "Indus"
  },
  {
    "id": "jar",
    "label": "Jar"
  },
  {
    "id": "key",
    "label": "Key"
  },
  {
    "id": "lever",
    "label": "Lever"
  },
  {
    "id": "port",
    "label": "Port"
  },
  {
    "id": "portal",
    "label": "Portal"
  },
  {
    "id": "probs",
    "label": "Probs"
  },
  {
    "id": "sign",
    "label": "Sign"
  },
  {
    "id": "space",
    "label": "Space"
  },
  {
    "id": "vert",
    "label": "Vert"
  },
  {
    "id": "walls",
    "label": "Walls"
  },
  {
    "id": "wide",
    "label": "Wide"
  }
];
var ICON_ITEMS = [
  {
    "id": "icons",
    "label": "Icons",
    "category": "glyphs",
    "width": 16,
    "height": 16,
    "filePath": "./assets/icons/char-A-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-back-1x1",
    "label": "Icon Arrow Back 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-back-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-back-2x2",
    "label": "Icon Arrow Back 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-back-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-back-3x3",
    "label": "Icon Arrow Back 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-back-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-bounce-1x1",
    "label": "Icon Arrow Bounce 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-bounce-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-bounce-2x2",
    "label": "Icon Arrow Bounce 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-bounce-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-bounce-3x3",
    "label": "Icon Arrow Bounce 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-bounce-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-down-1x1",
    "label": "Icon Arrow Circle Down 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-circle-down-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-down-2x2",
    "label": "Icon Arrow Circle Down 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-circle-down-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-down-3x3",
    "label": "Icon Arrow Circle Down 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-circle-down-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-left-1x1",
    "label": "Icon Arrow Circle Left 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-circle-left-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-left-2x2",
    "label": "Icon Arrow Circle Left 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-circle-left-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-left-3x3",
    "label": "Icon Arrow Circle Left 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-circle-left-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-right-1x1",
    "label": "Icon Arrow Circle Right 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-circle-right-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-right-2x2",
    "label": "Icon Arrow Circle Right 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-circle-right-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-right-3x3",
    "label": "Icon Arrow Circle Right 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-circle-right-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-up-1x1",
    "label": "Icon Arrow Circle Up 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-circle-up-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-up-2x2",
    "label": "Icon Arrow Circle Up 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-circle-up-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-up-3x3",
    "label": "Icon Arrow Circle Up 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-circle-up-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-collapse-1x1",
    "label": "Icon Arrow Collapse 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-collapse-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-collapse-2x2",
    "label": "Icon Arrow Collapse 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-collapse-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-collapse-3x3",
    "label": "Icon Arrow Collapse 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-collapse-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-down-1x1",
    "label": "Icon Arrow Double Down 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-double-down-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-down-2x2",
    "label": "Icon Arrow Double Down 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-double-down-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-down-3x3",
    "label": "Icon Arrow Double Down 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-double-down-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-left-1x1",
    "label": "Icon Arrow Double Left 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-double-left-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-left-2x2",
    "label": "Icon Arrow Double Left 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-double-left-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-left-3x3",
    "label": "Icon Arrow Double Left 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-double-left-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-right-1x1",
    "label": "Icon Arrow Double Right 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-double-right-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-right-2x2",
    "label": "Icon Arrow Double Right 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-double-right-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-right-3x3",
    "label": "Icon Arrow Double Right 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-double-right-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-up-1x1",
    "label": "Icon Arrow Double Up 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-double-up-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-up-2x2",
    "label": "Icon Arrow Double Up 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-double-up-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-up-3x3",
    "label": "Icon Arrow Double Up 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-double-up-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-down-1x1",
    "label": "Icon Arrow Down 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-down-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-down-2x2",
    "label": "Icon Arrow Down 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-down-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-down-3x3",
    "label": "Icon Arrow Down 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-down-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-down-left-1x1",
    "label": "Icon Arrow Down Left 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-down-left-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-down-left-2x2",
    "label": "Icon Arrow Down Left 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-down-left-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-down-left-3x3",
    "label": "Icon Arrow Down Left 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-down-left-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-down-right-1x1",
    "label": "Icon Arrow Down Right 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-down-right-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-down-right-2x2",
    "label": "Icon Arrow Down Right 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-down-right-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-down-right-3x3",
    "label": "Icon Arrow Down Right 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-down-right-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-enter-1x1",
    "label": "Icon Arrow Enter 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-enter-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-enter-2x2",
    "label": "Icon Arrow Enter 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-enter-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-enter-3x3",
    "label": "Icon Arrow Enter 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-enter-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-expand-1x1",
    "label": "Icon Arrow Expand 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-expand-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-expand-2x2",
    "label": "Icon Arrow Expand 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-expand-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-expand-3x3",
    "label": "Icon Arrow Expand 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-expand-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-fork-1x1",
    "label": "Icon Arrow Fork 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-fork-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-fork-2x2",
    "label": "Icon Arrow Fork 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-fork-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-fork-3x3",
    "label": "Icon Arrow Fork 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-fork-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-left-1x1",
    "label": "Icon Arrow Left 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-left-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-left-2x2",
    "label": "Icon Arrow Left 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-left-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-left-3x3",
    "label": "Icon Arrow Left 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-left-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-left-right-1x1",
    "label": "Icon Arrow Left Right 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-left-right-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-left-right-2x2",
    "label": "Icon Arrow Left Right 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-left-right-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-left-right-3x3",
    "label": "Icon Arrow Left Right 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-left-right-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-merge-1x1",
    "label": "Icon Arrow Merge 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-merge-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-merge-2x2",
    "label": "Icon Arrow Merge 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-merge-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-merge-3x3",
    "label": "Icon Arrow Merge 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-merge-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-redo-1x1",
    "label": "Icon Arrow Redo 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-redo-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-redo-2x2",
    "label": "Icon Arrow Redo 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-redo-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-redo-3x3",
    "label": "Icon Arrow Redo 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-redo-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-right-1x1",
    "label": "Icon Arrow Right 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-right-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-right-2x2",
    "label": "Icon Arrow Right 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-right-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-right-3x3",
    "label": "Icon Arrow Right 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-right-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-rotate-ccw-1x1",
    "label": "Icon Arrow Rotate Ccw 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-rotate-ccw-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-rotate-ccw-2x2",
    "label": "Icon Arrow Rotate Ccw 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-rotate-ccw-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-rotate-ccw-3x3",
    "label": "Icon Arrow Rotate Ccw 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-rotate-ccw-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-rotate-cw-1x1",
    "label": "Icon Arrow Rotate Cw 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-rotate-cw-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-rotate-cw-2x2",
    "label": "Icon Arrow Rotate Cw 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-rotate-cw-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-rotate-cw-3x3",
    "label": "Icon Arrow Rotate Cw 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-rotate-cw-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-shuffle-1x1",
    "label": "Icon Arrow Shuffle 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-shuffle-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-shuffle-2x2",
    "label": "Icon Arrow Shuffle 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-shuffle-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-shuffle-3x3",
    "label": "Icon Arrow Shuffle 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-shuffle-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-sort-1x1",
    "label": "Icon Arrow Sort 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-sort-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-sort-2x2",
    "label": "Icon Arrow Sort 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-sort-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-sort-3x3",
    "label": "Icon Arrow Sort 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-sort-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-trend-down-1x1",
    "label": "Icon Arrow Trend Down 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-trend-down-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-trend-down-2x2",
    "label": "Icon Arrow Trend Down 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-trend-down-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-trend-down-3x3",
    "label": "Icon Arrow Trend Down 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-trend-down-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-trend-up-1x1",
    "label": "Icon Arrow Trend Up 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-trend-up-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-trend-up-2x2",
    "label": "Icon Arrow Trend Up 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-trend-up-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-trend-up-3x3",
    "label": "Icon Arrow Trend Up 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-trend-up-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-undo-1x1",
    "label": "Icon Arrow Undo 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-undo-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-undo-2x2",
    "label": "Icon Arrow Undo 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-undo-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-undo-3x3",
    "label": "Icon Arrow Undo 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-undo-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-1x1",
    "label": "Icon Arrow Up 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-up-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-2x2",
    "label": "Icon Arrow Up 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-up-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-3x3",
    "label": "Icon Arrow Up 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-up-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-down-1x1",
    "label": "Icon Arrow Up Down 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-up-down-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-down-2x2",
    "label": "Icon Arrow Up Down 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-up-down-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-down-3x3",
    "label": "Icon Arrow Up Down 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-up-down-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-left-1x1",
    "label": "Icon Arrow Up Left 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-up-left-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-left-2x2",
    "label": "Icon Arrow Up Left 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-up-left-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-left-3x3",
    "label": "Icon Arrow Up Left 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-up-left-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-right-1x1",
    "label": "Icon Arrow Up Right 1x1",
    "category": "arraw",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-arrow-up-right-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-right-2x2",
    "label": "Icon Arrow Up Right 2x2",
    "category": "arraw",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-arrow-up-right-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-right-3x3",
    "label": "Icon Arrow Up Right 3x3",
    "category": "arraw",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-arrow-up-right-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-atom-1x2",
    "label": "Banner Atom 1x2",
    "category": "banner",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/banner-atom-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-atom-1x3",
    "label": "Banner Atom 1x3",
    "category": "banner",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/banner-atom-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-atom-1x4",
    "label": "Banner Atom 1x4",
    "category": "banner",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/banner-atom-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-bio-1x2",
    "label": "Banner Bio 1x2",
    "category": "banner",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/banner-bio-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-bio-1x3",
    "label": "Banner Bio 1x3",
    "category": "banner",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/banner-bio-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-bio-1x4",
    "label": "Banner Bio 1x4",
    "category": "banner",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/banner-bio-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-blue-1x2",
    "label": "Banner Blue 1x2",
    "category": "banner",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/banner-blue-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-blue-1x3",
    "label": "Banner Blue 1x3",
    "category": "banner",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/banner-blue-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-blue-1x4",
    "label": "Banner Blue 1x4",
    "category": "banner",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/banner-blue-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-bolt-1x2",
    "label": "Banner Bolt 1x2",
    "category": "banner",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/banner-bolt-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-bolt-1x3",
    "label": "Banner Bolt 1x3",
    "category": "banner",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/banner-bolt-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-bolt-1x4",
    "label": "Banner Bolt 1x4",
    "category": "banner",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/banner-bolt-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-diamond-1x2",
    "label": "Banner Diamond 1x2",
    "category": "banner",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/banner-diamond-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-diamond-1x3",
    "label": "Banner Diamond 1x3",
    "category": "banner",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/banner-diamond-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-diamond-1x4",
    "label": "Banner Diamond 1x4",
    "category": "banner",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/banner-diamond-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-flame-1x2",
    "label": "Banner Flame 1x2",
    "category": "banner",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/banner-flame-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-flame-1x3",
    "label": "Banner Flame 1x3",
    "category": "banner",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/banner-flame-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-flame-1x4",
    "label": "Banner Flame 1x4",
    "category": "banner",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/banner-flame-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-gear-1x2",
    "label": "Banner Gear 1x2",
    "category": "banner",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/banner-gear-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-gear-1x3",
    "label": "Banner Gear 1x3",
    "category": "banner",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/banner-gear-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-gear-1x4",
    "label": "Banner Gear 1x4",
    "category": "banner",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/banner-gear-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-green-1x2",
    "label": "Banner Green 1x2",
    "category": "banner",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/banner-green-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-green-1x3",
    "label": "Banner Green 1x3",
    "category": "banner",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/banner-green-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-green-1x4",
    "label": "Banner Green 1x4",
    "category": "banner",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/banner-green-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-red-1x2",
    "label": "Banner Red 1x2",
    "category": "banner",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/banner-red-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-red-1x3",
    "label": "Banner Red 1x3",
    "category": "banner",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/banner-red-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-red-1x4",
    "label": "Banner Red 1x4",
    "category": "banner",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/banner-red-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-skull-1x2",
    "label": "Banner Skull 1x2",
    "category": "banner",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/banner-skull-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-skull-1x3",
    "label": "Banner Skull 1x3",
    "category": "banner",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/banner-skull-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-skull-1x4",
    "label": "Banner Skull 1x4",
    "category": "banner",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/banner-skull-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-spore-1x2",
    "label": "Banner Spore 1x2",
    "category": "banner",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/banner-spore-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-spore-1x3",
    "label": "Banner Spore 1x3",
    "category": "banner",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/banner-spore-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-spore-1x4",
    "label": "Banner Spore 1x4",
    "category": "banner",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/banner-spore-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-star-1x2",
    "label": "Banner Star 1x2",
    "category": "banner",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/banner-star-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-star-1x3",
    "label": "Banner Star 1x3",
    "category": "banner",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/banner-star-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-star-1x4",
    "label": "Banner Star 1x4",
    "category": "banner",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/banner-star-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-tech-1x2",
    "label": "Banner Tech 1x2",
    "category": "banner",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/banner-tech-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-tech-1x3",
    "label": "Banner Tech 1x3",
    "category": "banner",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/banner-tech-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-tech-1x4",
    "label": "Banner Tech 1x4",
    "category": "banner",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/banner-tech-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-warning-1x2",
    "label": "Banner Warning 1x2",
    "category": "banner",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/banner-warning-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-warning-1x3",
    "label": "Banner Warning 1x3",
    "category": "banner",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/banner-warning-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-warning-1x4",
    "label": "Banner Warning 1x4",
    "category": "banner",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/banner-warning-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-wave-1x2",
    "label": "Banner Wave 1x2",
    "category": "banner",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/banner-wave-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-wave-1x3",
    "label": "Banner Wave 1x3",
    "category": "banner",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/banner-wave-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-wave-1x4",
    "label": "Banner Wave 1x4",
    "category": "banner",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/banner-wave-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-alert-1x1",
    "label": "Beacon Alert 1x1",
    "category": "beacon",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/beacon-alert-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-alert-1x2",
    "label": "Beacon Alert 1x2",
    "category": "beacon",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/beacon-alert-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-alert-1x3",
    "label": "Beacon Alert 1x3",
    "category": "beacon",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/beacon-alert-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-amber-1x1",
    "label": "Beacon Amber 1x1",
    "category": "beacon",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/beacon-amber-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-amber-1x2",
    "label": "Beacon Amber 1x2",
    "category": "beacon",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/beacon-amber-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-amber-1x3",
    "label": "Beacon Amber 1x3",
    "category": "beacon",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/beacon-amber-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-bio-1x1",
    "label": "Beacon Bio 1x1",
    "category": "beacon",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/beacon-bio-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-bio-1x2",
    "label": "Beacon Bio 1x2",
    "category": "beacon",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/beacon-bio-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-bio-1x3",
    "label": "Beacon Bio 1x3",
    "category": "beacon",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/beacon-bio-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-cyan-1x1",
    "label": "Beacon Cyan 1x1",
    "category": "beacon",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/beacon-cyan-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-cyan-1x2",
    "label": "Beacon Cyan 1x2",
    "category": "beacon",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/beacon-cyan-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-cyan-1x3",
    "label": "Beacon Cyan 1x3",
    "category": "beacon",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/beacon-cyan-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-ice-1x1",
    "label": "Beacon Ice 1x1",
    "category": "beacon",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/beacon-ice-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-ice-1x2",
    "label": "Beacon Ice 1x2",
    "category": "beacon",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/beacon-ice-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-ice-1x3",
    "label": "Beacon Ice 1x3",
    "category": "beacon",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/beacon-ice-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-moth-1x1",
    "label": "Beacon Moth 1x1",
    "category": "beacon",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/beacon-moth-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-moth-1x2",
    "label": "Beacon Moth 1x2",
    "category": "beacon",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/beacon-moth-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-moth-1x3",
    "label": "Beacon Moth 1x3",
    "category": "beacon",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/beacon-moth-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-rainbow-1x1",
    "label": "Beacon Rainbow 1x1",
    "category": "beacon",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/beacon-rainbow-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-rainbow-1x2",
    "label": "Beacon Rainbow 1x2",
    "category": "beacon",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/beacon-rainbow-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-rainbow-1x3",
    "label": "Beacon Rainbow 1x3",
    "category": "beacon",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/beacon-rainbow-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-spore-1x1",
    "label": "Beacon Spore 1x1",
    "category": "beacon",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/beacon-spore-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-spore-1x2",
    "label": "Beacon Spore 1x2",
    "category": "beacon",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/beacon-spore-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-spore-1x3",
    "label": "Beacon Spore 1x3",
    "category": "beacon",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/beacon-spore-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-strobe-1x1",
    "label": "Beacon Strobe 1x1",
    "category": "beacon",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/beacon-strobe-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-strobe-1x2",
    "label": "Beacon Strobe 1x2",
    "category": "beacon",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/beacon-strobe-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-strobe-1x3",
    "label": "Beacon Strobe 1x3",
    "category": "beacon",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/beacon-strobe-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-torch-1x1",
    "label": "Beacon Torch 1x1",
    "category": "beacon",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/beacon-torch-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-torch-1x2",
    "label": "Beacon Torch 1x2",
    "category": "beacon",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/beacon-torch-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-torch-1x3",
    "label": "Beacon Torch 1x3",
    "category": "beacon",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/beacon-torch-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-bio-membrane-1x1",
    "label": "Bg Bio Membrane 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-bio-membrane-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-blueprint-1x1",
    "label": "Bg Blueprint 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-blueprint-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-brick-dark-1x1",
    "label": "Bg Brick Dark 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-brick-dark-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-brick-red-1x1",
    "label": "Bg Brick Red 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-brick-red-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-brick-white-1x1",
    "label": "Bg Brick White 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-brick-white-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-cables-1x1",
    "label": "Bg Cables 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-cables-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-carbon-1x1",
    "label": "Bg Carbon 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-carbon-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-circuit-1x1",
    "label": "Bg Circuit 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-circuit-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-concrete-1x1",
    "label": "Bg Concrete 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-concrete-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-concrete-crack-1x1",
    "label": "Bg Concrete Crack 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-concrete-crack-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-corrugated-1x1",
    "label": "Bg Corrugated 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-corrugated-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-crate-face-1x1",
    "label": "Bg Crate Face 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-crate-face-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-diamond-plate-1x1",
    "label": "Bg Diamond Plate 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-diamond-plate-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-glass-block-1x1",
    "label": "Bg Glass Block 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-glass-block-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-grime-1x1",
    "label": "Bg Grime 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-grime-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-hex-1x1",
    "label": "Bg Hex 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-hex-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-honeycomb-1x1",
    "label": "Bg Honeycomb 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-honeycomb-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-insulation-1x1",
    "label": "Bg Insulation 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-insulation-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-led-grid-1x1",
    "label": "Bg Led Grid 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-led-grid-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-metal-bronze-1x1",
    "label": "Bg Metal Bronze 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-metal-bronze-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-metal-dark-1x1",
    "label": "Bg Metal Dark 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-metal-dark-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-metal-plate-1x1",
    "label": "Bg Metal Plate 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-metal-plate-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-metal-rivet-1x1",
    "label": "Bg Metal Rivet 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-metal-rivet-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-neon-1x1",
    "label": "Bg Neon 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-neon-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-padded-1x1",
    "label": "Bg Padded 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-padded-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-panel-screen-1x1",
    "label": "Bg Panel Screen 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-panel-screen-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-panel-steel-1x1",
    "label": "Bg Panel Steel 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-panel-steel-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-panel-warning-1x1",
    "label": "Bg Panel Warning 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-panel-warning-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-pipes-1x1",
    "label": "Bg Pipes 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-pipes-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-poster-1x1",
    "label": "Bg Poster 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-poster-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-rust-1x1",
    "label": "Bg Rust 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-rust-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-spore-1x1",
    "label": "Bg Spore 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-spore-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-stars-1x1",
    "label": "Bg Stars 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-stars-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-stone-1x1",
    "label": "Bg Stone 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-stone-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-stripe-hazard-1x1",
    "label": "Bg Stripe Hazard 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-stripe-hazard-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-stripe-red-1x1",
    "label": "Bg Stripe Red 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-stripe-red-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-tile-green-1x1",
    "label": "Bg Tile Green 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-tile-green-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-tile-lab-1x1",
    "label": "Bg Tile Lab 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-tile-lab-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-tile-white-1x1",
    "label": "Bg Tile White 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-tile-white-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-vent-1x1",
    "label": "Bg Vent 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-vent-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-warning-band-1x1",
    "label": "Bg Warning Band 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-warning-band-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-window-1x1",
    "label": "Bg Window 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-window-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-window-bars-1x1",
    "label": "Bg Window Bars 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-window-bars-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-wood-1x1",
    "label": "Bg Wood 1x1",
    "category": "bg",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/bg-wood-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-acid-1x1",
    "label": "Block Acid 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-acid-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-asphalt-1x1",
    "label": "Block Asphalt 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-asphalt-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-bio-gel-1x1",
    "label": "Block Bio Gel 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-bio-gel-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-brick-1x1",
    "label": "Block Brick 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-brick-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-bronze-1x1",
    "label": "Block Bronze 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-bronze-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-carbon-1x1",
    "label": "Block Carbon 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-carbon-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-ceramic-1x1",
    "label": "Block Ceramic 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-ceramic-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-checker-1x1",
    "label": "Block Checker 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-checker-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-circuit-1x1",
    "label": "Block Circuit 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-circuit-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-cobble-1x1",
    "label": "Block Cobble 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-cobble-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-concrete-1x1",
    "label": "Block Concrete 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-concrete-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-copper-1x1",
    "label": "Block Copper 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-copper-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-crystal-1x1",
    "label": "Block Crystal 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-crystal-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-diamond-1x1",
    "label": "Block Diamond 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-diamond-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-dirt-1x1",
    "label": "Block Dirt 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-dirt-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-glass-1x1",
    "label": "Block Glass 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-glass-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-gold-1x1",
    "label": "Block Gold 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-gold-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-grass-1x1",
    "label": "Block Grass 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-grass-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-grate-1x1",
    "label": "Block Grate 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-grate-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-gravel-1x1",
    "label": "Block Gravel 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-gravel-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-hazard-1x1",
    "label": "Block Hazard 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-hazard-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-hex-1x1",
    "label": "Block Hex 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-hex-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-ice-1x1",
    "label": "Block Ice 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-ice-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-lava-1x1",
    "label": "Block Lava 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-lava-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-marble-1x1",
    "label": "Block Marble 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-marble-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-mesh-1x1",
    "label": "Block Mesh 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-mesh-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-moss-1x1",
    "label": "Block Moss 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-moss-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-obsidian-1x1",
    "label": "Block Obsidian 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-obsidian-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-padded-1x1",
    "label": "Block Padded 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-padded-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-plasma-1x1",
    "label": "Block Plasma 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-plasma-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-rubber-1x1",
    "label": "Block Rubber 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-rubber-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-rust-1x1",
    "label": "Block Rust 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-rust-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-sand-1x1",
    "label": "Block Sand 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-sand-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-snow-1x1",
    "label": "Block Snow 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-snow-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-solar-1x1",
    "label": "Block Solar 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-solar-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-steel-1x1",
    "label": "Block Steel 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-steel-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-steel-lite-1x1",
    "label": "Block Steel Lite 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-steel-lite-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-tech-1x1",
    "label": "Block Tech 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-tech-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-vent-1x1",
    "label": "Block Vent 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-vent-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-void-1x1",
    "label": "Block Void 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-void-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-warning-1x1",
    "label": "Block Warning 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-warning-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-water-1x1",
    "label": "Block Water 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-water-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "block-wood-1x1",
    "label": "Block Wood 1x1",
    "category": "block",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block/block-wood-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-farm-1x1",
    "label": "Bot Farm 1x1",
    "category": "bot",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/bot-farm-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-farm-2x2",
    "label": "Bot Farm 2x2",
    "category": "bot",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/bot-farm-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-farm-3x3",
    "label": "Bot Farm 3x3",
    "category": "bot",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/bot-farm-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-haul-1x1",
    "label": "Bot Haul 1x1",
    "category": "bot",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/bot-haul-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-haul-2x2",
    "label": "Bot Haul 2x2",
    "category": "bot",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/bot-haul-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-haul-3x3",
    "label": "Bot Haul 3x3",
    "category": "bot",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/bot-haul-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-king-1x1",
    "label": "Bot King 1x1",
    "category": "bot",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/bot-king-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-king-2x2",
    "label": "Bot King 2x2",
    "category": "bot",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/bot-king-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-king-3x3",
    "label": "Bot King 3x3",
    "category": "bot",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/bot-king-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-medic-1x1",
    "label": "Bot Medic 1x1",
    "category": "bot",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/bot-medic-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-medic-2x2",
    "label": "Bot Medic 2x2",
    "category": "bot",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/bot-medic-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-medic-3x3",
    "label": "Bot Medic 3x3",
    "category": "bot",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/bot-medic-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-mine-1x1",
    "label": "Bot Mine 1x1",
    "category": "bot",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/bot-mine-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-mine-2x2",
    "label": "Bot Mine 2x2",
    "category": "bot",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/bot-mine-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-mine-3x3",
    "label": "Bot Mine 3x3",
    "category": "bot",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/bot-mine-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-pet-1x1",
    "label": "Bot Pet 1x1",
    "category": "bot",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/bot-pet-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-pet-2x2",
    "label": "Bot Pet 2x2",
    "category": "bot",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/bot-pet-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-pet-3x3",
    "label": "Bot Pet 3x3",
    "category": "bot",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/bot-pet-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-scan-1x1",
    "label": "Bot Scan 1x1",
    "category": "bot",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/bot-scan-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-scan-2x2",
    "label": "Bot Scan 2x2",
    "category": "bot",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/bot-scan-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-scan-3x3",
    "label": "Bot Scan 3x3",
    "category": "bot",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/bot-scan-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-sentry-1x1",
    "label": "Bot Sentry 1x1",
    "category": "bot",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/bot-sentry-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-sentry-2x2",
    "label": "Bot Sentry 2x2",
    "category": "bot",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/bot-sentry-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-sentry-3x3",
    "label": "Bot Sentry 3x3",
    "category": "bot",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/bot-sentry-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-water-1x1",
    "label": "Bot Water 1x1",
    "category": "bot",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/bot-water-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-water-2x2",
    "label": "Bot Water 2x2",
    "category": "bot",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/bot-water-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-water-3x3",
    "label": "Bot Water 3x3",
    "category": "bot",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/bot-water-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-weld-1x1",
    "label": "Bot Weld 1x1",
    "category": "bot",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/bot-weld-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-weld-2x2",
    "label": "Bot Weld 2x2",
    "category": "bot",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/bot-weld-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-weld-3x3",
    "label": "Bot Weld 3x3",
    "category": "bot",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/bot-weld-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-0-1x1",
    "label": "Char 0 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-0-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-0-2x2",
    "label": "Char 0 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-0-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-1-1x1",
    "label": "Char 1 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-1-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-1-2x2",
    "label": "Char 1 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-1-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-2-1x1",
    "label": "Char 2 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-2-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-2-2x2",
    "label": "Char 2 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-2-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-3-1x1",
    "label": "Char 3 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-3-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-3-2x2",
    "label": "Char 3 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-3-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-4-1x1",
    "label": "Char 4 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-4-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-4-2x2",
    "label": "Char 4 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-4-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-5-1x1",
    "label": "Char 5 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-5-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-5-2x2",
    "label": "Char 5 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-5-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-6-1x1",
    "label": "Char 6 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-6-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-6-2x2",
    "label": "Char 6 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-6-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-7-1x1",
    "label": "Char 7 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-7-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-7-2x2",
    "label": "Char 7 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-7-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-8-1x1",
    "label": "Char 8 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-8-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-8-2x2",
    "label": "Char 8 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-8-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-9-1x1",
    "label": "Char 9 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-9-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-9-2x2",
    "label": "Char 9 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-9-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-A-1x1",
    "label": "Char A 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-A-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-A-2x2",
    "label": "Char A 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-A-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-B-1x1",
    "label": "Char B 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-B-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-B-2x2",
    "label": "Char B 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-B-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-C-1x1",
    "label": "Char C 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-C-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-C-2x2",
    "label": "Char C 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-C-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-D-1x1",
    "label": "Char D 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-D-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-D-2x2",
    "label": "Char D 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-D-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-E-1x1",
    "label": "Char E 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-E-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-E-2x2",
    "label": "Char E 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-E-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-F-1x1",
    "label": "Char F 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-F-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-F-2x2",
    "label": "Char F 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-F-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-G-1x1",
    "label": "Char G 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-G-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-G-2x2",
    "label": "Char G 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-G-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-H-1x1",
    "label": "Char H 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-H-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-H-2x2",
    "label": "Char H 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-H-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-I-1x1",
    "label": "Char I 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-I-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-I-2x2",
    "label": "Char I 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-I-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-J-1x1",
    "label": "Char J 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-J-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-J-2x2",
    "label": "Char J 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-J-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-K-1x1",
    "label": "Char K 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-K-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-K-2x2",
    "label": "Char K 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-K-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-L-1x1",
    "label": "Char L 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-L-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-L-2x2",
    "label": "Char L 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-L-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-M-1x1",
    "label": "Char M 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-M-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-M-2x2",
    "label": "Char M 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-M-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-N-1x1",
    "label": "Char N 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-N-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-N-2x2",
    "label": "Char N 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-N-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-O-1x1",
    "label": "Char O 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-O-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-O-2x2",
    "label": "Char O 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-O-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-P-1x1",
    "label": "Char P 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-P-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-P-2x2",
    "label": "Char P 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-P-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-Q-1x1",
    "label": "Char Q 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-Q-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-Q-2x2",
    "label": "Char Q 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-Q-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-R-1x1",
    "label": "Char R 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-R-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-R-2x2",
    "label": "Char R 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-R-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-S-1x1",
    "label": "Char S 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-S-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-S-2x2",
    "label": "Char S 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-S-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-amp-1x1",
    "label": "Char Sym Amp 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-amp-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-at-1x1",
    "label": "Char Sym At 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-at-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-brace-l-1x1",
    "label": "Char Sym Brace L 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-brace-l-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-brace-r-1x1",
    "label": "Char Sym Brace R 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-brace-r-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-bslash-1x1",
    "label": "Char Sym Bslash 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-bslash-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-caret-1x1",
    "label": "Char Sym Caret 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-caret-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-colon-1x1",
    "label": "Char Sym Colon 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-colon-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-comma-1x1",
    "label": "Char Sym Comma 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-comma-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-dollar-1x1",
    "label": "Char Sym Dollar 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-dollar-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-dot-1x1",
    "label": "Char Sym Dot 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-dot-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-eq-1x1",
    "label": "Char Sym Eq 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-eq-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-excl-1x1",
    "label": "Char Sym Excl 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-excl-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-gt-1x1",
    "label": "Char Sym Gt 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-gt-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-hash-1x1",
    "label": "Char Sym Hash 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-hash-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-lbracket-1x1",
    "label": "Char Sym Lbracket 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-lbracket-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-lparen-1x1",
    "label": "Char Sym Lparen 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-lparen-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-lt-1x1",
    "label": "Char Sym Lt 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-lt-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-minus-1x1",
    "label": "Char Sym Minus 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-minus-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-pct-1x1",
    "label": "Char Sym Pct 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-pct-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-pipe-1x1",
    "label": "Char Sym Pipe 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-pipe-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-plus-1x1",
    "label": "Char Sym Plus 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-plus-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-quest-1x1",
    "label": "Char Sym Quest 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-quest-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-quote-1x1",
    "label": "Char Sym Quote 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-quote-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-rbracket-1x1",
    "label": "Char Sym Rbracket 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-rbracket-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-rparen-1x1",
    "label": "Char Sym Rparen 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-rparen-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-semi-1x1",
    "label": "Char Sym Semi 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-semi-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-slash-1x1",
    "label": "Char Sym Slash 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-slash-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-star-1x1",
    "label": "Char Sym Star 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-star-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-tilde-1x1",
    "label": "Char Sym Tilde 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-tilde-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-underscore-1x1",
    "label": "Char Sym Underscore 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-sym-underscore-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-T-1x1",
    "label": "Char T 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-T-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-T-2x2",
    "label": "Char T 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-T-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-U-1x1",
    "label": "Char U 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-U-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-U-2x2",
    "label": "Char U 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-U-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-V-1x1",
    "label": "Char V 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-V-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-V-2x2",
    "label": "Char V 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-V-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-W-1x1",
    "label": "Char W 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-W-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-W-2x2",
    "label": "Char W 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-W-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-X-1x1",
    "label": "Char X 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-X-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-X-2x2",
    "label": "Char X 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-X-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-Y-1x1",
    "label": "Char Y 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-Y-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-Y-2x2",
    "label": "Char Y 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-Y-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-Z-1x1",
    "label": "Char Z 1x1",
    "category": "char",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/char-Z-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "char-Z-2x2",
    "label": "Char Z 2x2",
    "category": "char",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/char-Z-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-alien-1x1",
    "label": "Emoji Alien 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-alien-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-alien-2x2",
    "label": "Emoji Alien 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-alien-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-alien-3x3",
    "label": "Emoji Alien 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-alien-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-angel-1x1",
    "label": "Emoji Angel 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-angel-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-angel-2x2",
    "label": "Emoji Angel 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-angel-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-angel-3x3",
    "label": "Emoji Angel 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-angel-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-angry-1x1",
    "label": "Emoji Angry 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-angry-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-angry-2x2",
    "label": "Emoji Angry 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-angry-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-angry-3x3",
    "label": "Emoji Angry 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-angry-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-cat-1x1",
    "label": "Emoji Cat 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-cat-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-cat-2x2",
    "label": "Emoji Cat 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-cat-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-cat-3x3",
    "label": "Emoji Cat 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-cat-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-cool-1x1",
    "label": "Emoji Cool 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-cool-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-cool-2x2",
    "label": "Emoji Cool 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-cool-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-cool-3x3",
    "label": "Emoji Cool 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-cool-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-cry-1x1",
    "label": "Emoji Cry 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-cry-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-cry-2x2",
    "label": "Emoji Cry 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-cry-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-cry-3x3",
    "label": "Emoji Cry 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-cry-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-dead-1x1",
    "label": "Emoji Dead 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-dead-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-dead-2x2",
    "label": "Emoji Dead 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-dead-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-dead-3x3",
    "label": "Emoji Dead 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-dead-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-devil-1x1",
    "label": "Emoji Devil 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-devil-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-devil-2x2",
    "label": "Emoji Devil 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-devil-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-devil-3x3",
    "label": "Emoji Devil 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-devil-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-grin-1x1",
    "label": "Emoji Grin 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-grin-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-grin-2x2",
    "label": "Emoji Grin 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-grin-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-grin-3x3",
    "label": "Emoji Grin 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-grin-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-heart-eyes-1x1",
    "label": "Emoji Heart Eyes 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-heart-eyes-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-heart-eyes-2x2",
    "label": "Emoji Heart Eyes 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-heart-eyes-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-heart-eyes-3x3",
    "label": "Emoji Heart Eyes 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-heart-eyes-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-kiss-1x1",
    "label": "Emoji Kiss 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-kiss-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-kiss-2x2",
    "label": "Emoji Kiss 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-kiss-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-kiss-3x3",
    "label": "Emoji Kiss 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-kiss-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-laugh-1x1",
    "label": "Emoji Laugh 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-laugh-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-laugh-2x2",
    "label": "Emoji Laugh 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-laugh-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-laugh-3x3",
    "label": "Emoji Laugh 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-laugh-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-love-1x1",
    "label": "Emoji Love 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-love-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-love-2x2",
    "label": "Emoji Love 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-love-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-love-3x3",
    "label": "Emoji Love 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-love-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-mindblown-1x1",
    "label": "Emoji Mindblown 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-mindblown-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-mindblown-2x2",
    "label": "Emoji Mindblown 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-mindblown-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-mindblown-3x3",
    "label": "Emoji Mindblown 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-mindblown-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-money-1x1",
    "label": "Emoji Money 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-money-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-money-2x2",
    "label": "Emoji Money 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-money-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-money-3x3",
    "label": "Emoji Money 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-money-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-nerd-1x1",
    "label": "Emoji Nerd 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-nerd-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-nerd-2x2",
    "label": "Emoji Nerd 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-nerd-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-nerd-3x3",
    "label": "Emoji Nerd 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-nerd-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-nervous-1x1",
    "label": "Emoji Nervous 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-nervous-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-nervous-2x2",
    "label": "Emoji Nervous 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-nervous-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-nervous-3x3",
    "label": "Emoji Nervous 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-nervous-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-party-1x1",
    "label": "Emoji Party 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-party-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-party-2x2",
    "label": "Emoji Party 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-party-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-party-3x3",
    "label": "Emoji Party 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-party-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-robot-1x1",
    "label": "Emoji Robot 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-robot-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-robot-2x2",
    "label": "Emoji Robot 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-robot-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-robot-3x3",
    "label": "Emoji Robot 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-robot-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sad-1x1",
    "label": "Emoji Sad 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-sad-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sad-2x2",
    "label": "Emoji Sad 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-sad-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sad-3x3",
    "label": "Emoji Sad 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-sad-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-shocked-1x1",
    "label": "Emoji Shocked 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-shocked-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-shocked-2x2",
    "label": "Emoji Shocked 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-shocked-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-shocked-3x3",
    "label": "Emoji Shocked 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-shocked-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sick-1x1",
    "label": "Emoji Sick 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-sick-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sick-2x2",
    "label": "Emoji Sick 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-sick-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sick-3x3",
    "label": "Emoji Sick 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-sick-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-skull-1x1",
    "label": "Emoji Skull 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-skull-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-skull-2x2",
    "label": "Emoji Skull 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-skull-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-skull-3x3",
    "label": "Emoji Skull 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-skull-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sleepy-1x1",
    "label": "Emoji Sleepy 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-sleepy-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sleepy-2x2",
    "label": "Emoji Sleepy 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-sleepy-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sleepy-3x3",
    "label": "Emoji Sleepy 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-sleepy-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-smile-1x1",
    "label": "Emoji Smile 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-smile-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-smile-2x2",
    "label": "Emoji Smile 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-smile-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-smile-3x3",
    "label": "Emoji Smile 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-smile-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-smirk-1x1",
    "label": "Emoji Smirk 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-smirk-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-smirk-2x2",
    "label": "Emoji Smirk 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-smirk-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-smirk-3x3",
    "label": "Emoji Smirk 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-smirk-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-star-eyes-1x1",
    "label": "Emoji Star Eyes 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-star-eyes-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-star-eyes-2x2",
    "label": "Emoji Star Eyes 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-star-eyes-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-star-eyes-3x3",
    "label": "Emoji Star Eyes 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-star-eyes-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sunglasses-1x1",
    "label": "Emoji Sunglasses 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-sunglasses-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sunglasses-2x2",
    "label": "Emoji Sunglasses 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-sunglasses-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sunglasses-3x3",
    "label": "Emoji Sunglasses 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-sunglasses-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-thinking-1x1",
    "label": "Emoji Thinking 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-thinking-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-thinking-2x2",
    "label": "Emoji Thinking 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-thinking-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-thinking-3x3",
    "label": "Emoji Thinking 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-thinking-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-wink-1x1",
    "label": "Emoji Wink 1x1",
    "category": "emoji",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/emoji-wink-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-wink-2x2",
    "label": "Emoji Wink 2x2",
    "category": "emoji",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/emoji-wink-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-wink-3x3",
    "label": "Emoji Wink 3x3",
    "category": "emoji",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/emoji-wink-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "fence-amber-1x1",
    "label": "Fence Amber 1x1",
    "category": "fence",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/fence-amber-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "fence-amber-2x1",
    "label": "Fence Amber 2x1",
    "category": "fence",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/fence-amber-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "fence-bio-1x1",
    "label": "Fence Bio 1x1",
    "category": "fence",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/fence-bio-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "fence-cyan-1x1",
    "label": "Fence Cyan 1x1",
    "category": "fence",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/fence-cyan-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "fence-ice-1x1",
    "label": "Fence Ice 1x1",
    "category": "fence",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/fence-ice-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "fence-magma-1x1",
    "label": "Fence Magma 1x1",
    "category": "fence",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/fence-magma-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "fence-pink-1x1",
    "label": "Fence Pink 1x1",
    "category": "fence",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/fence-pink-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "fence-red-1x1",
    "label": "Fence Red 1x1",
    "category": "fence",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/fence-red-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "fence-void-1x1",
    "label": "Fence Void 1x1",
    "category": "fence",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/fence-void-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-bed-3x2",
    "label": "Garden Bed 3x2",
    "category": "garden",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/garden-bed-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-bench-2x1",
    "label": "Garden Bench 2x1",
    "category": "garden",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/garden-bench-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-bench-2x2",
    "label": "Garden Bench 2x2",
    "category": "garden",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/garden-bench-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-bush-1x1",
    "label": "Garden Bush 1x1",
    "category": "garden",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/garden-bush-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-climber-1x2",
    "label": "Garden Climber 1x2",
    "category": "garden",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/garden-climber-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-composter-2x2",
    "label": "Garden Composter 2x2",
    "category": "garden",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/garden-composter-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-crate-2x2",
    "label": "Garden Crate 2x2",
    "category": "garden",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/garden-crate-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-crops-3x2",
    "label": "Garden Crops 3x2",
    "category": "garden",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/garden-crops-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-fence-2x1",
    "label": "Garden Fence 2x1",
    "category": "garden",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/garden-fence-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-fence-3x2",
    "label": "Garden Fence 3x2",
    "category": "garden",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/garden-fence-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-fencepost-1x1",
    "label": "Garden Fencepost 1x1",
    "category": "garden",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/garden-fencepost-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-flower-1x1",
    "label": "Garden Flower 1x1",
    "category": "garden",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/garden-flower-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-flowerbed-2x1",
    "label": "Garden Flowerbed 2x1",
    "category": "garden",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/garden-flowerbed-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-fountain-1x3",
    "label": "Garden Fountain 1x3",
    "category": "garden",
    "width": 16,
    "height": 48,
    "filePath": "assets/deco/garden-fountain-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-fountain-2x2",
    "label": "Garden Fountain 2x2",
    "category": "garden",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/garden-fountain-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-fountain-3x3",
    "label": "Garden Fountain 3x3",
    "category": "garden",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/garden-fountain-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-gazebo-3x3",
    "label": "Garden Gazebo 3x3",
    "category": "garden",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/garden-gazebo-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-greenhouse-3x2",
    "label": "Garden Greenhouse 3x2",
    "category": "garden",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/garden-greenhouse-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-greenhouse-3x3",
    "label": "Garden Greenhouse 3x3",
    "category": "garden",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/garden-greenhouse-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-greenhouse-4x4",
    "label": "Garden Greenhouse 4x4",
    "category": "garden",
    "width": 64,
    "height": 64,
    "filePath": "assets/deco/garden-greenhouse-4x4.png",
    "align": "floor",
    "tags": [
      "4x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-hedge-2x1",
    "label": "Garden Hedge 2x1",
    "category": "garden",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/garden-hedge-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-herbs-1x1",
    "label": "Garden Herbs 1x1",
    "category": "garden",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/garden-herbs-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-lamp-1x2",
    "label": "Garden Lamp 1x2",
    "category": "garden",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/garden-lamp-1x2.png",
    "align": "wall",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-lamp-1x3",
    "label": "Garden Lamp 1x3",
    "category": "garden",
    "width": 16,
    "height": 48,
    "filePath": "assets/deco/garden-lamp-1x3.png",
    "align": "wall",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-lantern-1x1",
    "label": "Garden Lantern 1x1",
    "category": "garden",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/garden-lantern-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-obelisk-1x2",
    "label": "Garden Obelisk 1x2",
    "category": "garden",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/garden-obelisk-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-orchard-3x3",
    "label": "Garden Orchard 3x3",
    "category": "garden",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/garden-orchard-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-park-4x4",
    "label": "Garden Park 4x4",
    "category": "garden",
    "width": 64,
    "height": 64,
    "filePath": "assets/deco/garden-park-4x4.png",
    "align": "floor",
    "tags": [
      "4x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-path-2x1",
    "label": "Garden Path 2x1",
    "category": "garden",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/garden-path-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-patio-4x4",
    "label": "Garden Patio 4x4",
    "category": "garden",
    "width": 64,
    "height": 64,
    "filePath": "assets/deco/garden-patio-4x4.png",
    "align": "floor",
    "tags": [
      "4x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-pergola-3x2",
    "label": "Garden Pergola 3x2",
    "category": "garden",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/garden-pergola-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-pond-3x2",
    "label": "Garden Pond 3x2",
    "category": "garden",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/garden-pond-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-pond-4x4",
    "label": "Garden Pond 4x4",
    "category": "garden",
    "width": 64,
    "height": 64,
    "filePath": "assets/deco/garden-pond-4x4.png",
    "align": "floor",
    "tags": [
      "4x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-pot-1x1",
    "label": "Garden Pot 1x1",
    "category": "garden",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/garden-pot-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-rock-1x1",
    "label": "Garden Rock 1x1",
    "category": "garden",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/garden-rock-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-rows-2x2",
    "label": "Garden Rows 2x2",
    "category": "garden",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/garden-rows-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-sapling-1x1",
    "label": "Garden Sapling 1x1",
    "category": "garden",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/garden-sapling-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-shrubs-2x2",
    "label": "Garden Shrubs 2x2",
    "category": "garden",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/garden-shrubs-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-table-2x2",
    "label": "Garden Table 2x2",
    "category": "garden",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/garden-table-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-tallpot-1x2",
    "label": "Garden Tallpot 1x2",
    "category": "garden",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/garden-tallpot-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-tree-1x2",
    "label": "Garden Tree 1x2",
    "category": "garden",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/garden-tree-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-tree-1x3",
    "label": "Garden Tree 1x3",
    "category": "garden",
    "width": 16,
    "height": 48,
    "filePath": "assets/deco/garden-tree-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-trellis-1x2",
    "label": "Garden Trellis 1x2",
    "category": "garden",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/garden-trellis-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-trellis-1x3",
    "label": "Garden Trellis 1x3",
    "category": "garden",
    "width": 16,
    "height": 48,
    "filePath": "assets/deco/garden-trellis-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-trough-2x1",
    "label": "Garden Trough 2x1",
    "category": "garden",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/garden-trough-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-well-2x2",
    "label": "Garden Well 2x2",
    "category": "garden",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/garden-well-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-amber-1x1",
    "label": "Gem Amber 1x1",
    "category": "gem",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/gem-amber-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-amber-2x2",
    "label": "Gem Amber 2x2",
    "category": "gem",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/gem-amber-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-cyan-1x1",
    "label": "Gem Cyan 1x1",
    "category": "gem",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/gem-cyan-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-cyan-2x2",
    "label": "Gem Cyan 2x2",
    "category": "gem",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/gem-cyan-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-gold-1x1",
    "label": "Gem Gold 1x1",
    "category": "gem",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/gem-gold-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-gold-2x2",
    "label": "Gem Gold 2x2",
    "category": "gem",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/gem-gold-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-ice-1x1",
    "label": "Gem Ice 1x1",
    "category": "gem",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/gem-ice-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-ice-2x2",
    "label": "Gem Ice 2x2",
    "category": "gem",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/gem-ice-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-leaf-1x1",
    "label": "Gem Leaf 1x1",
    "category": "gem",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/gem-leaf-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-leaf-2x2",
    "label": "Gem Leaf 2x2",
    "category": "gem",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/gem-leaf-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-rose-1x1",
    "label": "Gem Rose 1x1",
    "category": "gem",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/gem-rose-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-rose-2x2",
    "label": "Gem Rose 2x2",
    "category": "gem",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/gem-rose-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-ruby-1x1",
    "label": "Gem Ruby 1x1",
    "category": "gem",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/gem-ruby-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-ruby-2x2",
    "label": "Gem Ruby 2x2",
    "category": "gem",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/gem-ruby-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-void-1x1",
    "label": "Gem Void 1x1",
    "category": "gem",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/gem-void-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-void-2x2",
    "label": "Gem Void 2x2",
    "category": "gem",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/gem-void-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-beetle-1x1",
    "label": "Glyph Beetle 1x1",
    "category": "glyph",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/glyph-beetle-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-beetle-2x2",
    "label": "Glyph Beetle 2x2",
    "category": "glyph",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/glyph-beetle-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-chip-1x1",
    "label": "Glyph Chip 1x1",
    "category": "glyph",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/glyph-chip-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-chip-2x2",
    "label": "Glyph Chip 2x2",
    "category": "glyph",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/glyph-chip-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-eye-1x1",
    "label": "Glyph Eye 1x1",
    "category": "glyph",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/glyph-eye-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-eye-2x2",
    "label": "Glyph Eye 2x2",
    "category": "glyph",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/glyph-eye-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-gate-1x1",
    "label": "Glyph Gate 1x1",
    "category": "glyph",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/glyph-gate-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-gate-2x2",
    "label": "Glyph Gate 2x2",
    "category": "glyph",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/glyph-gate-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-gear-sun-1x1",
    "label": "Glyph Gear Sun 1x1",
    "category": "glyph",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/glyph-gear-sun-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-gear-sun-2x2",
    "label": "Glyph Gear Sun 2x2",
    "category": "glyph",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/glyph-gear-sun-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-ladder-1x1",
    "label": "Glyph Ladder 1x1",
    "category": "glyph",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/glyph-ladder-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-ladder-2x2",
    "label": "Glyph Ladder 2x2",
    "category": "glyph",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/glyph-ladder-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-mask-1x1",
    "label": "Glyph Mask 1x1",
    "category": "glyph",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/glyph-mask-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-mask-2x2",
    "label": "Glyph Mask 2x2",
    "category": "glyph",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/glyph-mask-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-mountain-1x1",
    "label": "Glyph Mountain 1x1",
    "category": "glyph",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/glyph-mountain-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-mountain-2x2",
    "label": "Glyph Mountain 2x2",
    "category": "glyph",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/glyph-mountain-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-river-1x1",
    "label": "Glyph River 1x1",
    "category": "glyph",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/glyph-river-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-river-2x2",
    "label": "Glyph River 2x2",
    "category": "glyph",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/glyph-river-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-scarab-1x1",
    "label": "Glyph Scarab 1x1",
    "category": "glyph",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/glyph-scarab-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-scarab-2x2",
    "label": "Glyph Scarab 2x2",
    "category": "glyph",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/glyph-scarab-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-seed-1x1",
    "label": "Glyph Seed 1x1",
    "category": "glyph",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/glyph-seed-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-seed-2x2",
    "label": "Glyph Seed 2x2",
    "category": "glyph",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/glyph-seed-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-spiral-1x1",
    "label": "Glyph Spiral 1x1",
    "category": "glyph",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/glyph-spiral-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-spiral-2x2",
    "label": "Glyph Spiral 2x2",
    "category": "glyph",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/glyph-spiral-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-sun-1x1",
    "label": "Glyph Sun 1x1",
    "category": "glyph",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/glyph-sun-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-sun-2x2",
    "label": "Glyph Sun 2x2",
    "category": "glyph",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/glyph-sun-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-twin-moon-1x1",
    "label": "Glyph Twin Moon 1x1",
    "category": "glyph",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/glyph-twin-moon-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-twin-moon-2x2",
    "label": "Glyph Twin Moon 2x2",
    "category": "glyph",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/glyph-twin-moon-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-void-1x1",
    "label": "Glyph Void 1x1",
    "category": "glyph",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/glyph-void-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-void-2x2",
    "label": "Glyph Void 2x2",
    "category": "glyph",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/glyph-void-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-wave-1x1",
    "label": "Glyph Wave 1x1",
    "category": "glyph",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/glyph-wave-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-wave-2x2",
    "label": "Glyph Wave 2x2",
    "category": "glyph",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/glyph-wave-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-bio-1x2",
    "label": "Hatch Bio 1x2",
    "category": "hatch",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/hatch-bio-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-bio-2x2",
    "label": "Hatch Bio 2x2",
    "category": "hatch",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/hatch-bio-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-bronze-1x2",
    "label": "Hatch Bronze 1x2",
    "category": "hatch",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/hatch-bronze-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-bronze-2x2",
    "label": "Hatch Bronze 2x2",
    "category": "hatch",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/hatch-bronze-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-grate-1x2",
    "label": "Hatch Grate 1x2",
    "category": "hatch",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/hatch-grate-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-grate-2x2",
    "label": "Hatch Grate 2x2",
    "category": "hatch",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/hatch-grate-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-hazard-1x2",
    "label": "Hatch Hazard 1x2",
    "category": "hatch",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/hatch-hazard-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-hazard-2x2",
    "label": "Hatch Hazard 2x2",
    "category": "hatch",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/hatch-hazard-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-ice-1x2",
    "label": "Hatch Ice 1x2",
    "category": "hatch",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/hatch-ice-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-ice-2x2",
    "label": "Hatch Ice 2x2",
    "category": "hatch",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/hatch-ice-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-round-1x2",
    "label": "Hatch Round 1x2",
    "category": "hatch",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/hatch-round-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-round-2x2",
    "label": "Hatch Round 2x2",
    "category": "hatch",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/hatch-round-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-shutter-1x2",
    "label": "Hatch Shutter 1x2",
    "category": "hatch",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/hatch-shutter-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-shutter-2x2",
    "label": "Hatch Shutter 2x2",
    "category": "hatch",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/hatch-shutter-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-temple-1x2",
    "label": "Hatch Temple 1x2",
    "category": "hatch",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/hatch-temple-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-temple-2x2",
    "label": "Hatch Temple 2x2",
    "category": "hatch",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/hatch-temple-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-biome-2x2",
    "label": "Holo Biome 2x2",
    "category": "holo",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/holo-biome-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-biome-3x3",
    "label": "Holo Biome 3x3",
    "category": "holo",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/holo-biome-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-cyan-2x2",
    "label": "Holo Cyan 2x2",
    "category": "holo",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/holo-cyan-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-cyan-3x3",
    "label": "Holo Cyan 3x3",
    "category": "holo",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/holo-cyan-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-ghost-2x2",
    "label": "Holo Ghost 2x2",
    "category": "holo",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/holo-ghost-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-ghost-3x3",
    "label": "Holo Ghost 3x3",
    "category": "holo",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/holo-ghost-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-map-2x2",
    "label": "Holo Map 2x2",
    "category": "holo",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/holo-map-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-map-3x3",
    "label": "Holo Map 3x3",
    "category": "holo",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/holo-map-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-playback-2x2",
    "label": "Holo Playback 2x2",
    "category": "holo",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/holo-playback-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-playback-3x3",
    "label": "Holo Playback 3x3",
    "category": "holo",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/holo-playback-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-portrait-2x2",
    "label": "Holo Portrait 2x2",
    "category": "holo",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/holo-portrait-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-portrait-3x3",
    "label": "Holo Portrait 3x3",
    "category": "holo",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/holo-portrait-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-warn-2x2",
    "label": "Holo Warn 2x2",
    "category": "holo",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/holo-warn-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-warn-3x3",
    "label": "Holo Warn 3x3",
    "category": "holo",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/holo-warn-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-waypoint-2x2",
    "label": "Holo Waypoint 2x2",
    "category": "holo",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/holo-waypoint-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-waypoint-3x3",
    "label": "Holo Waypoint 3x3",
    "category": "holo",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/holo-waypoint-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bathroom-4x4",
    "label": "Home Bathroom 4x4",
    "category": "home",
    "width": 64,
    "height": 64,
    "filePath": "assets/deco/home-bathroom-4x4.png",
    "align": "floor",
    "tags": [
      "4x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bathtub-3x2",
    "label": "Home Bathtub 3x2",
    "category": "home",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/home-bathtub-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bathtub-3x3",
    "label": "Home Bathtub 3x3",
    "category": "home",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/home-bathtub-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bed-2x2",
    "label": "Home Bed 2x2",
    "category": "home",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/home-bed-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bed-3x2",
    "label": "Home Bed 3x2",
    "category": "home",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/home-bed-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bed-3x3",
    "label": "Home Bed 3x3",
    "category": "home",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/home-bed-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bedroom-4x4",
    "label": "Home Bedroom 4x4",
    "category": "home",
    "width": 64,
    "height": 64,
    "filePath": "assets/deco/home-bedroom-4x4.png",
    "align": "floor",
    "tags": [
      "4x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bench-2x1",
    "label": "Home Bench 2x1",
    "category": "home",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/home-bench-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bookrow-2x1",
    "label": "Home Bookrow 2x1",
    "category": "home",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/home-bookrow-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-books-1x1",
    "label": "Home Books 1x1",
    "category": "home",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/home-books-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bookshelf-1x3",
    "label": "Home Bookshelf 1x3",
    "category": "home",
    "width": 16,
    "height": 48,
    "filePath": "assets/deco/home-bookshelf-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bookshelf-3x2",
    "label": "Home Bookshelf 3x2",
    "category": "home",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/home-bookshelf-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bookshelf-3x3",
    "label": "Home Bookshelf 3x3",
    "category": "home",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/home-bookshelf-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bottle-1x1",
    "label": "Home Bottle 1x1",
    "category": "home",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/home-bottle-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-cabinet-1x2",
    "label": "Home Cabinet 1x2",
    "category": "home",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/home-cabinet-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-chair-2x2",
    "label": "Home Chair 2x2",
    "category": "home",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/home-chair-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-clock-1x1",
    "label": "Home Clock 1x1",
    "category": "home",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/home-clock-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-coatstand-1x2",
    "label": "Home Coatstand 1x2",
    "category": "home",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/home-coatstand-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-conduit-1x3",
    "label": "Home Conduit 1x3",
    "category": "home",
    "width": 16,
    "height": 48,
    "filePath": "assets/deco/home-conduit-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-counter-3x2",
    "label": "Home Counter 3x2",
    "category": "home",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/home-counter-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-counter-3x3",
    "label": "Home Counter 3x3",
    "category": "home",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/home-counter-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-cushion-2x1",
    "label": "Home Cushion 2x1",
    "category": "home",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/home-cushion-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-desk-3x2",
    "label": "Home Desk 3x2",
    "category": "home",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/home-desk-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-desk-3x3",
    "label": "Home Desk 3x3",
    "category": "home",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/home-desk-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-dining-4x4",
    "label": "Home Dining 4x4",
    "category": "home",
    "width": 64,
    "height": 64,
    "filePath": "assets/deco/home-dining-4x4.png",
    "align": "floor",
    "tags": [
      "4x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-fireplace-3x3",
    "label": "Home Fireplace 3x3",
    "category": "home",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/home-fireplace-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-floorlamp-1x2",
    "label": "Home Floorlamp 1x2",
    "category": "home",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/home-floorlamp-1x2.png",
    "align": "wall",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-fridge-2x2",
    "label": "Home Fridge 2x2",
    "category": "home",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/home-fridge-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-kitchen-4x4",
    "label": "Home Kitchen 4x4",
    "category": "home",
    "width": 64,
    "height": 64,
    "filePath": "assets/deco/home-kitchen-4x4.png",
    "align": "floor",
    "tags": [
      "4x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-lamp-1x1",
    "label": "Home Lamp 1x1",
    "category": "home",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/home-lamp-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-living-4x4",
    "label": "Home Living 4x4",
    "category": "home",
    "width": 64,
    "height": 64,
    "filePath": "assets/deco/home-living-4x4.png",
    "align": "floor",
    "tags": [
      "4x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-locker-1x3",
    "label": "Home Locker 1x3",
    "category": "home",
    "width": 16,
    "height": 48,
    "filePath": "assets/deco/home-locker-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-mirror-1x2",
    "label": "Home Mirror 1x2",
    "category": "home",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/home-mirror-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-mug-1x1",
    "label": "Home Mug 1x1",
    "category": "home",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/home-mug-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-nightstand-1x2",
    "label": "Home Nightstand 1x2",
    "category": "home",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/home-nightstand-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-panel-1x3",
    "label": "Home Panel 1x3",
    "category": "home",
    "width": 16,
    "height": 48,
    "filePath": "assets/deco/home-panel-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-patio-4x4",
    "label": "Home Patio 4x4",
    "category": "home",
    "width": 64,
    "height": 64,
    "filePath": "assets/deco/home-patio-4x4.png",
    "align": "floor",
    "tags": [
      "4x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-pillow-1x1",
    "label": "Home Pillow 1x1",
    "category": "home",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/home-pillow-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-plant-1x1",
    "label": "Home Plant 1x1",
    "category": "home",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/home-plant-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-planter-2x1",
    "label": "Home Planter 2x1",
    "category": "home",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/home-planter-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-radiator-1x2",
    "label": "Home Radiator 1x2",
    "category": "home",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/home-radiator-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-radiator-2x1",
    "label": "Home Radiator 2x1",
    "category": "home",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/home-radiator-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-shelf-2x1",
    "label": "Home Shelf 2x1",
    "category": "home",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/home-shelf-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-sidetable-2x2",
    "label": "Home Sidetable 2x2",
    "category": "home",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/home-sidetable-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-sink-2x2",
    "label": "Home Sink 2x2",
    "category": "home",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/home-sink-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-sofa-3x2",
    "label": "Home Sofa 3x2",
    "category": "home",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/home-sofa-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-sofa-3x3",
    "label": "Home Sofa 3x3",
    "category": "home",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/home-sofa-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-soundbar-2x1",
    "label": "Home Soundbar 2x1",
    "category": "home",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/home-soundbar-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-stool-1x1",
    "label": "Home Stool 1x1",
    "category": "home",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/home-stool-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-stove-2x2",
    "label": "Home Stove 2x2",
    "category": "home",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/home-stove-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-table-3x2",
    "label": "Home Table 3x2",
    "category": "home",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/home-table-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-table-3x3",
    "label": "Home Table 3x3",
    "category": "home",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/home-table-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-tallplant-1x2",
    "label": "Home Tallplant 1x2",
    "category": "home",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/home-tallplant-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-toilet-2x2",
    "label": "Home Toilet 2x2",
    "category": "home",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/home-toilet-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-torchere-1x3",
    "label": "Home Torchere 1x3",
    "category": "home",
    "width": 16,
    "height": 48,
    "filePath": "assets/deco/home-torchere-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-towelrail-2x1",
    "label": "Home Towelrail 2x1",
    "category": "home",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/home-towelrail-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-tree-1x3",
    "label": "Home Tree 1x3",
    "category": "home",
    "width": 16,
    "height": 48,
    "filePath": "assets/deco/home-tree-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-tv-2x2",
    "label": "Home Tv 2x2",
    "category": "home",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/home-tv-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-tv-3x2",
    "label": "Home Tv 3x2",
    "category": "home",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/home-tv-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-vase-1x2",
    "label": "Home Vase 1x2",
    "category": "home",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/home-vase-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-wardrobe-2x2",
    "label": "Home Wardrobe 2x2",
    "category": "home",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/home-wardrobe-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "home-washer-2x2",
    "label": "Home Washer 2x2",
    "category": "home",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/home-washer-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-barrier-2x1",
    "label": "Horiz Barrier 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-barrier-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-barrier-3x1",
    "label": "Horiz Barrier 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-barrier-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-barrier-4x1",
    "label": "Horiz Barrier 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-barrier-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-battery-2x1",
    "label": "Horiz Battery 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-battery-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-battery-3x1",
    "label": "Horiz Battery 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-battery-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-battery-4x1",
    "label": "Horiz Battery 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-battery-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-beam-2x1",
    "label": "Horiz Beam 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-beam-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-beam-3x1",
    "label": "Horiz Beam 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-beam-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-beam-4x1",
    "label": "Horiz Beam 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-beam-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-bed-2x1",
    "label": "Horiz Bed 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-bed-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-bed-3x1",
    "label": "Horiz Bed 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-bed-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-bed-4x1",
    "label": "Horiz Bed 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-bed-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-bench-2x1",
    "label": "Horiz Bench 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-bench-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-bench-3x1",
    "label": "Horiz Bench 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-bench-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-bench-4x1",
    "label": "Horiz Bench 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-bench-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-bumper-2x1",
    "label": "Horiz Bumper 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-bumper-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-bumper-3x1",
    "label": "Horiz Bumper 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-bumper-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-bumper-4x1",
    "label": "Horiz Bumper 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-bumper-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-cables-2x1",
    "label": "Horiz Cables 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-cables-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-cables-3x1",
    "label": "Horiz Cables 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-cables-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-cables-4x1",
    "label": "Horiz Cables 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-cables-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-console-2x1",
    "label": "Horiz Console 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-console-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-console-3x1",
    "label": "Horiz Console 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-console-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-console-4x1",
    "label": "Horiz Console 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-console-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-conveyor-2x1",
    "label": "Horiz Conveyor 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-conveyor-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-conveyor-3x1",
    "label": "Horiz Conveyor 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-conveyor-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-conveyor-4x1",
    "label": "Horiz Conveyor 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-conveyor-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-counter-2x1",
    "label": "Horiz Counter 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-counter-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-counter-3x1",
    "label": "Horiz Counter 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-counter-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-counter-4x1",
    "label": "Horiz Counter 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-counter-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-crates-2x1",
    "label": "Horiz Crates 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-crates-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-crates-3x1",
    "label": "Horiz Crates 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-crates-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-crates-4x1",
    "label": "Horiz Crates 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-crates-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-desk-2x1",
    "label": "Horiz Desk 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-desk-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-desk-3x1",
    "label": "Horiz Desk 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-desk-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-desk-4x1",
    "label": "Horiz Desk 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-desk-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-duct-2x1",
    "label": "Horiz Duct 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-duct-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-duct-3x1",
    "label": "Horiz Duct 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-duct-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-duct-4x1",
    "label": "Horiz Duct 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-duct-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-fence-2x1",
    "label": "Horiz Fence 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-fence-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-fence-3x1",
    "label": "Horiz Fence 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-fence-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-fence-4x1",
    "label": "Horiz Fence 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-fence-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-garden-2x1",
    "label": "Horiz Garden 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-garden-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-garden-3x1",
    "label": "Horiz Garden 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-garden-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-garden-4x1",
    "label": "Horiz Garden 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-garden-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-keyboard-2x1",
    "label": "Horiz Keyboard 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-keyboard-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-keyboard-3x1",
    "label": "Horiz Keyboard 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-keyboard-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-keyboard-4x1",
    "label": "Horiz Keyboard 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-keyboard-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-lab-bench-2x1",
    "label": "Horiz Lab Bench 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-lab-bench-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-lab-bench-3x1",
    "label": "Horiz Lab Bench 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-lab-bench-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-lab-bench-4x1",
    "label": "Horiz Lab Bench 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-lab-bench-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-low-wall-2x1",
    "label": "Horiz Low Wall 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-low-wall-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-low-wall-3x1",
    "label": "Horiz Low Wall 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-low-wall-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-low-wall-4x1",
    "label": "Horiz Low Wall 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-low-wall-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-pallet-2x1",
    "label": "Horiz Pallet 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-pallet-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-pallet-3x1",
    "label": "Horiz Pallet 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-pallet-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-pallet-4x1",
    "label": "Horiz Pallet 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-pallet-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-panel-2x1",
    "label": "Horiz Panel 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-panel-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-panel-3x1",
    "label": "Horiz Panel 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-panel-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-panel-4x1",
    "label": "Horiz Panel 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-panel-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-pipe-2x1",
    "label": "Horiz Pipe 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-pipe-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-pipe-3x1",
    "label": "Horiz Pipe 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-pipe-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-pipe-4x1",
    "label": "Horiz Pipe 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-pipe-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-planter-2x1",
    "label": "Horiz Planter 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-planter-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-planter-3x1",
    "label": "Horiz Planter 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-planter-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-planter-4x1",
    "label": "Horiz Planter 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-planter-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-rail-2x1",
    "label": "Horiz Rail 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-rail-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-rail-3x1",
    "label": "Horiz Rail 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-rail-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-rail-4x1",
    "label": "Horiz Rail 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-rail-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-shelf-2x1",
    "label": "Horiz Shelf 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-shelf-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-shelf-3x1",
    "label": "Horiz Shelf 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-shelf-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-shelf-4x1",
    "label": "Horiz Shelf 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-shelf-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-sofa-2x1",
    "label": "Horiz Sofa 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-sofa-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-sofa-3x1",
    "label": "Horiz Sofa 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-sofa-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-sofa-4x1",
    "label": "Horiz Sofa 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-sofa-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-solar-2x1",
    "label": "Horiz Solar 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-solar-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-solar-3x1",
    "label": "Horiz Solar 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-solar-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-solar-4x1",
    "label": "Horiz Solar 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-solar-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-table-2x1",
    "label": "Horiz Table 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-table-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-table-3x1",
    "label": "Horiz Table 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-table-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-table-4x1",
    "label": "Horiz Table 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-table-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-tank-2x1",
    "label": "Horiz Tank 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-tank-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-tank-3x1",
    "label": "Horiz Tank 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-tank-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-tank-4x1",
    "label": "Horiz Tank 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-tank-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-vent-2x1",
    "label": "Horiz Vent 2x1",
    "category": "horiz",
    "width": 32,
    "height": 16,
    "filePath": "assets2/deco/horiz-vent-2x1.png",
    "align": "wall",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-vent-3x1",
    "label": "Horiz Vent 3x1",
    "category": "horiz",
    "width": 48,
    "height": 16,
    "filePath": "assets2/deco/horiz-vent-3x1.png",
    "align": "wall",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-vent-4x1",
    "label": "Horiz Vent 4x1",
    "category": "horiz",
    "width": 64,
    "height": 16,
    "filePath": "assets2/deco/horiz-vent-4x1.png",
    "align": "wall",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-air-3x3",
    "label": "Icon Air 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-air-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-alien-1x1",
    "label": "Icon Alien 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-alien-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-alien-2x2",
    "label": "Icon Alien 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-alien-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-alien-3x3",
    "label": "Icon Alien 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-alien-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-anchor-1x1",
    "label": "Icon Anchor 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-anchor-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-anchor-2x2",
    "label": "Icon Anchor 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-anchor-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-anchor-3x3",
    "label": "Icon Anchor 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-anchor-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-atom-2x2",
    "label": "Icon Atom 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-atom-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bag-1x1",
    "label": "Icon Bag 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-bag-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-battery-2x2",
    "label": "Icon Battery 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-battery-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bell-1x1",
    "label": "Icon Bell 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-bell-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bio-3x3",
    "label": "Icon Bio 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-bio-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bird-1x1",
    "label": "Icon Bird 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-bird-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bird-2x2",
    "label": "Icon Bird 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-bird-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bird-3x3",
    "label": "Icon Bird 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-bird-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-blueprint-3x3",
    "label": "Icon Blueprint 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-blueprint-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bolt-1x1",
    "label": "Icon Bolt 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-bolt-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-book-1x1",
    "label": "Icon Book 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-book-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bottle-1x1",
    "label": "Icon Bottle 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-bottle-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bottle-2x2",
    "label": "Icon Bottle 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-bottle-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bottle-3x3",
    "label": "Icon Bottle 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-bottle-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bug-2x2",
    "label": "Icon Bug 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-bug-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bug2-1x1",
    "label": "Icon Bug2 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-bug2-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bug2-2x2",
    "label": "Icon Bug2 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-bug2-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bug2-3x3",
    "label": "Icon Bug2 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-bug2-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-build-3x3",
    "label": "Icon Build 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-build-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cactus-1x1",
    "label": "Icon Cactus 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-cactus-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cactus-2x2",
    "label": "Icon Cactus 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-cactus-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cactus-3x3",
    "label": "Icon Cactus 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-cactus-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-calendar-2x2",
    "label": "Icon Calendar 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-calendar-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-camera-2x2",
    "label": "Icon Camera 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-camera-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-can-1x1",
    "label": "Icon Can 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-can-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-can-2x2",
    "label": "Icon Can 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-can-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-can-3x3",
    "label": "Icon Can 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-can-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cards-1x1",
    "label": "Icon Cards 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-cards-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cards-2x2",
    "label": "Icon Cards 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-cards-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cards-3x3",
    "label": "Icon Cards 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-cards-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cart-1x1",
    "label": "Icon Cart 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-cart-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cart-2x2",
    "label": "Icon Cart 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-cart-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cat-1x1",
    "label": "Icon Cat 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-cat-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cat-2x2",
    "label": "Icon Cat 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-cat-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cat-3x3",
    "label": "Icon Cat 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-cat-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chart-2x2",
    "label": "Icon Chart 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-chart-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chat-2x2",
    "label": "Icon Chat 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-chat-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-check-1x1",
    "label": "Icon Check 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-check-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-check-2x2",
    "label": "Icon Check 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-check-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-check-3x3",
    "label": "Icon Check 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-check-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chess-1x1",
    "label": "Icon Chess 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-chess-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chess-2x2",
    "label": "Icon Chess 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-chess-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chess-3x3",
    "label": "Icon Chess 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-chess-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chest-3x3",
    "label": "Icon Chest 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-chest-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-down-1x1",
    "label": "Icon Chevron Double Down 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-chevron-double-down-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-down-2x2",
    "label": "Icon Chevron Double Down 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-chevron-double-down-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-down-3x3",
    "label": "Icon Chevron Double Down 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-chevron-double-down-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-left-1x1",
    "label": "Icon Chevron Double Left 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-chevron-double-left-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-left-2x2",
    "label": "Icon Chevron Double Left 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-chevron-double-left-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-left-3x3",
    "label": "Icon Chevron Double Left 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-chevron-double-left-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-right-1x1",
    "label": "Icon Chevron Double Right 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-chevron-double-right-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-right-2x2",
    "label": "Icon Chevron Double Right 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-chevron-double-right-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-right-3x3",
    "label": "Icon Chevron Double Right 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-chevron-double-right-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-up-1x1",
    "label": "Icon Chevron Double Up 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-chevron-double-up-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-up-2x2",
    "label": "Icon Chevron Double Up 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-chevron-double-up-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-up-3x3",
    "label": "Icon Chevron Double Up 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-chevron-double-up-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-down-1x1",
    "label": "Icon Chevron Down 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-chevron-down-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-down-2x2",
    "label": "Icon Chevron Down 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-chevron-down-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-down-3x3",
    "label": "Icon Chevron Down 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-chevron-down-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-left-1x1",
    "label": "Icon Chevron Left 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-chevron-left-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-left-2x2",
    "label": "Icon Chevron Left 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-chevron-left-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-left-3x3",
    "label": "Icon Chevron Left 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-chevron-left-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-right-1x1",
    "label": "Icon Chevron Right 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-chevron-right-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-right-2x2",
    "label": "Icon Chevron Right 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-chevron-right-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-right-3x3",
    "label": "Icon Chevron Right 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-chevron-right-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-up-1x1",
    "label": "Icon Chevron Up 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-chevron-up-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-up-2x2",
    "label": "Icon Chevron Up 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-chevron-up-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-up-3x3",
    "label": "Icon Chevron Up 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-chevron-up-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-circuit-3x3",
    "label": "Icon Circuit 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-circuit-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-clock-2x2",
    "label": "Icon Clock 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-clock-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cloud-1x1",
    "label": "Icon Cloud 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-cloud-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-code-2x2",
    "label": "Icon Code 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-code-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-coffee-1x1",
    "label": "Icon Coffee 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-coffee-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-coffee-2x2",
    "label": "Icon Coffee 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-coffee-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-coffee-3x3",
    "label": "Icon Coffee 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-coffee-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-coin-3x3",
    "label": "Icon Coin 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-coin-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-compass-2x2",
    "label": "Icon Compass 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-compass-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cookie-1x1",
    "label": "Icon Cookie 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-cookie-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cookie-2x2",
    "label": "Icon Cookie 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-cookie-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cookie-3x3",
    "label": "Icon Cookie 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-cookie-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cpu-2x2",
    "label": "Icon Cpu 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-cpu-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cross-1x1",
    "label": "Icon Cross 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-cross-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cross-2x2",
    "label": "Icon Cross 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-cross-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cross-3x3",
    "label": "Icon Cross 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-cross-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-crown-3x3",
    "label": "Icon Crown 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-crown-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-crystal-3x3",
    "label": "Icon Crystal 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-crystal-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-diamond-3x3",
    "label": "Icon Diamond 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-diamond-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-dice-1x1",
    "label": "Icon Dice 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-dice-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-dice-2x2",
    "label": "Icon Dice 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-dice-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-dice-3x3",
    "label": "Icon Dice 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-dice-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-disk-2x2",
    "label": "Icon Disk 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-disk-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-dna-3x3",
    "label": "Icon Dna 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-dna-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-dog-1x1",
    "label": "Icon Dog 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-dog-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-dog-2x2",
    "label": "Icon Dog 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-dog-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-dog-3x3",
    "label": "Icon Dog 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-dog-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-drone-3x3",
    "label": "Icon Drone 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-drone-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-drop-1x1",
    "label": "Icon Drop 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-drop-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-earth-3x3",
    "label": "Icon Earth 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-earth-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-energy-3x3",
    "label": "Icon Energy 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-energy-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-eye-1x1",
    "label": "Icon Eye 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-eye-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-factory-3x3",
    "label": "Icon Factory 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-factory-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-file-2x2",
    "label": "Icon File 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-file-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-filter-2x2",
    "label": "Icon Filter 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-filter-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-fire-3x3",
    "label": "Icon Fire 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-fire-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-fish-1x1",
    "label": "Icon Fish 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-fish-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-fish-2x2",
    "label": "Icon Fish 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-fish-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-fish-3x3",
    "label": "Icon Fish 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-fish-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-flag-1x1",
    "label": "Icon Flag 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-flag-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-flame-1x1",
    "label": "Icon Flame 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-flame-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-folder-2x2",
    "label": "Icon Folder 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-folder-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-fox-1x1",
    "label": "Icon Fox 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-fox-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-fox-2x2",
    "label": "Icon Fox 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-fox-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-fox-3x3",
    "label": "Icon Fox 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-fox-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-gear-1x1",
    "label": "Icon Gear 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-gear-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-gem-1x1",
    "label": "Icon Gem 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-gem-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-gem-2x2",
    "label": "Icon Gem 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-gem-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-gem-3x3",
    "label": "Icon Gem 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-gem-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-ghost-1x1",
    "label": "Icon Ghost 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-ghost-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-ghost-2x2",
    "label": "Icon Ghost 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-ghost-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-ghost-3x3",
    "label": "Icon Ghost 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-ghost-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-gift-2x2",
    "label": "Icon Gift 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-gift-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-globe-2x2",
    "label": "Icon Globe 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-globe-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-hammer-1x1",
    "label": "Icon Hammer 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-hammer-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-headphones-2x2",
    "label": "Icon Headphones 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-headphones-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-heart-1x1",
    "label": "Icon Heart 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-heart-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-heart-2x2",
    "label": "Icon Heart 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-heart-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-heart-3x3",
    "label": "Icon Heart 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-heart-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-home-1x1",
    "label": "Icon Home 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-home-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-home-3x3",
    "label": "Icon Home 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-home-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-hourglass-1x1",
    "label": "Icon Hourglass 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-hourglass-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-hourglass-2x2",
    "label": "Icon Hourglass 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-hourglass-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-hourglass-3x3",
    "label": "Icon Hourglass 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-hourglass-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-icecream-1x1",
    "label": "Icon Icecream 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-icecream-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-icecream-2x2",
    "label": "Icon Icecream 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-icecream-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-icecream-3x3",
    "label": "Icon Icecream 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-icecream-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-image-2x2",
    "label": "Icon Image 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-image-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-infinity-1x1",
    "label": "Icon Infinity 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-infinity-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-infinity-2x2",
    "label": "Icon Infinity 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-infinity-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-infinity-3x3",
    "label": "Icon Infinity 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-infinity-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-info-2x2",
    "label": "Icon Info 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-info-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-joystick-1x1",
    "label": "Icon Joystick 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-joystick-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-joystick-2x2",
    "label": "Icon Joystick 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-joystick-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-joystick-3x3",
    "label": "Icon Joystick 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-joystick-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-key-1x1",
    "label": "Icon Key 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-key-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-lab-2x2",
    "label": "Icon Lab 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-lab-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-lab-3x3",
    "label": "Icon Lab 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-lab-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-leaf-1x1",
    "label": "Icon Leaf 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-leaf-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-link-2x2",
    "label": "Icon Link 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-link-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-lock-1x1",
    "label": "Icon Lock 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-lock-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-magnet-1x1",
    "label": "Icon Magnet 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-magnet-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-magnet-2x2",
    "label": "Icon Magnet 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-magnet-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-magnet-3x3",
    "label": "Icon Magnet 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-magnet-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-mail-1x1",
    "label": "Icon Mail 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-mail-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-map-2x2",
    "label": "Icon Map 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-map-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-medal-2x2",
    "label": "Icon Medal 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-medal-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-mic-2x2",
    "label": "Icon Mic 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-mic-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-minus-1x1",
    "label": "Icon Minus 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-minus-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-moon-1x1",
    "label": "Icon Moon 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-moon-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-mushroom-1x1",
    "label": "Icon Mushroom 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-mushroom-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-mushroom-2x2",
    "label": "Icon Mushroom 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-mushroom-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-mushroom-3x3",
    "label": "Icon Mushroom 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-mushroom-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-music-1x1",
    "label": "Icon Music 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-music-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-ore-1x1",
    "label": "Icon Ore 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-ore-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-ore-2x2",
    "label": "Icon Ore 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-ore-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-ore-3x3",
    "label": "Icon Ore 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-ore-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-pause-1x1",
    "label": "Icon Pause 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-pause-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-phone-2x2",
    "label": "Icon Phone 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-phone-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-pickaxe-1x1",
    "label": "Icon Pickaxe 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-pickaxe-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-pickaxe-2x2",
    "label": "Icon Pickaxe 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-pickaxe-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-pickaxe-3x3",
    "label": "Icon Pickaxe 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-pickaxe-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-pin-2x2",
    "label": "Icon Pin 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-pin-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-pizza-1x1",
    "label": "Icon Pizza 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-pizza-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-pizza-2x2",
    "label": "Icon Pizza 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-pizza-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-pizza-3x3",
    "label": "Icon Pizza 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-pizza-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-plane-3x3",
    "label": "Icon Plane 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-plane-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-play-1x1",
    "label": "Icon Play 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-play-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-plus-1x1",
    "label": "Icon Plus 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-plus-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-portal-3x3",
    "label": "Icon Portal 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-portal-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-potion-1x1",
    "label": "Icon Potion 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-potion-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-potion-2x2",
    "label": "Icon Potion 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-potion-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-potion-3x3",
    "label": "Icon Potion 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-potion-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-power-2x2",
    "label": "Icon Power 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-power-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-power-3x3",
    "label": "Icon Power 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-power-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-puzzle-1x1",
    "label": "Icon Puzzle 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-puzzle-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-puzzle-2x2",
    "label": "Icon Puzzle 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-puzzle-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-puzzle-3x3",
    "label": "Icon Puzzle 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-puzzle-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-radar-3x3",
    "label": "Icon Radar 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-radar-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-rainbow-1x1",
    "label": "Icon Rainbow 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-rainbow-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-rainbow-2x2",
    "label": "Icon Rainbow 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-rainbow-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-rainbow-3x3",
    "label": "Icon Rainbow 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-rainbow-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-ring-1x1",
    "label": "Icon Ring 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-ring-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-ring-2x2",
    "label": "Icon Ring 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-ring-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-ring-3x3",
    "label": "Icon Ring 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-ring-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-robot-1x1",
    "label": "Icon Robot 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-robot-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-robot-2x2",
    "label": "Icon Robot 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-robot-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-robot-3x3",
    "label": "Icon Robot 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-robot-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-rocket-3x3",
    "label": "Icon Rocket 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-rocket-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-satellite-3x3",
    "label": "Icon Satellite 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-satellite-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-scroll-1x1",
    "label": "Icon Scroll 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-scroll-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-scroll-2x2",
    "label": "Icon Scroll 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-scroll-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-scroll-3x3",
    "label": "Icon Scroll 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-scroll-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-search-2x2",
    "label": "Icon Search 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-search-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-seed-1x1",
    "label": "Icon Seed 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-seed-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-seed-2x2",
    "label": "Icon Seed 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-seed-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-seed-3x3",
    "label": "Icon Seed 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-seed-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-settings-3x3",
    "label": "Icon Settings 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-settings-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-shield-1x1",
    "label": "Icon Shield 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-shield-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-ship-3x3",
    "label": "Icon Ship 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-ship-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-shop-3x3",
    "label": "Icon Shop 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-shop-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-skull-3x3",
    "label": "Icon Skull 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-skull-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-snow-1x1",
    "label": "Icon Snow 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-snow-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-snow-2x2",
    "label": "Icon Snow 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-snow-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-snow-3x3",
    "label": "Icon Snow 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-snow-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-speaker-2x2",
    "label": "Icon Speaker 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-speaker-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-spiral-1x1",
    "label": "Icon Spiral 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-spiral-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-spiral-2x2",
    "label": "Icon Spiral 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-spiral-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-spiral-3x3",
    "label": "Icon Spiral 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-spiral-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-star-1x1",
    "label": "Icon Star 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-star-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-star-2x2",
    "label": "Icon Star 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-star-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-star-3x3",
    "label": "Icon Star 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-star-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-stop-1x1",
    "label": "Icon Stop 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-stop-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-sun-1x1",
    "label": "Icon Sun 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-sun-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-sword-1x1",
    "label": "Icon Sword 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-sword-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-tag-2x2",
    "label": "Icon Tag 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-tag-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-target-1x1",
    "label": "Icon Target 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-target-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-terminal-2x2",
    "label": "Icon Terminal 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-terminal-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-train-3x3",
    "label": "Icon Train 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-train-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-tree-1x1",
    "label": "Icon Tree 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-tree-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-tree-2x2",
    "label": "Icon Tree 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-tree-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-tree-3x3",
    "label": "Icon Tree 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-tree-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-trophy-2x2",
    "label": "Icon Trophy 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-trophy-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-truck-3x3",
    "label": "Icon Truck 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-truck-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-unlock-1x1",
    "label": "Icon Unlock 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-unlock-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-user-1x1",
    "label": "Icon User 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-user-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-user-3x3",
    "label": "Icon User 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-user-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-users-1x1",
    "label": "Icon Users 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-users-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-users-3x3",
    "label": "Icon Users 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-users-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-vault-3x3",
    "label": "Icon Vault 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-vault-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-virus-3x3",
    "label": "Icon Virus 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-virus-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-wand-1x1",
    "label": "Icon Wand 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-wand-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-wand-2x2",
    "label": "Icon Wand 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-wand-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-wand-3x3",
    "label": "Icon Wand 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-wand-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-warning-2x2",
    "label": "Icon Warning 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-warning-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-warning-3x3",
    "label": "Icon Warning 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-warning-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-water-3x3",
    "label": "Icon Water 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-water-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-wave-1x1",
    "label": "Icon Wave 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-wave-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-wave-2x2",
    "label": "Icon Wave 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-wave-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-wave-3x3",
    "label": "Icon Wave 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-wave-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-wifi-2x2",
    "label": "Icon Wifi 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-wifi-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-wrench-1x1",
    "label": "Icon Wrench 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-wrench-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-yinyang-1x1",
    "label": "Icon Yinyang 1x1",
    "category": "icon",
    "width": 16,
    "height": 16,
    "filePath": "assets/icons/icon-yinyang-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-yinyang-2x2",
    "label": "Icon Yinyang 2x2",
    "category": "icon",
    "width": 32,
    "height": 32,
    "filePath": "assets/icons/icon-yinyang-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-yinyang-3x3",
    "label": "Icon Yinyang 3x3",
    "category": "icon",
    "width": 48,
    "height": 48,
    "filePath": "assets/icons/icon-yinyang-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-airlock-3x2",
    "label": "Ind Airlock 3x2",
    "category": "indus",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/ind-airlock-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-assembler-4x4",
    "label": "Ind Assembler 4x4",
    "category": "indus",
    "width": 64,
    "height": 64,
    "filePath": "assets/deco/ind-assembler-4x4.png",
    "align": "floor",
    "tags": [
      "4x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-barrel-1x1",
    "label": "Ind Barrel 1x1",
    "category": "indus",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/ind-barrel-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-beam-2x1",
    "label": "Ind Beam 2x1",
    "category": "indus",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/ind-beam-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-board-3x2",
    "label": "Ind Board 3x2",
    "category": "indus",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/ind-board-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-boiler-2x2",
    "label": "Ind Boiler 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/ind-boiler-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-bolt-1x1",
    "label": "Ind Bolt 1x1",
    "category": "indus",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/ind-bolt-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-button-1x1",
    "label": "Ind Button 1x1",
    "category": "indus",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/ind-button-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-cabinet-2x2",
    "label": "Ind Cabinet 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/ind-cabinet-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-chimney-1x3",
    "label": "Ind Chimney 1x3",
    "category": "indus",
    "width": 16,
    "height": 48,
    "filePath": "assets/deco/ind-chimney-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-conduit-1x1",
    "label": "Ind Conduit 1x1",
    "category": "indus",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/ind-conduit-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-console-3x2",
    "label": "Ind Console 3x2",
    "category": "indus",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/ind-console-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-conveyor-2x1",
    "label": "Ind Conveyor 2x1",
    "category": "indus",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/ind-conveyor-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-cooling-3x3",
    "label": "Ind Cooling 3x3",
    "category": "indus",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/ind-cooling-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-core-4x4",
    "label": "Ind Core 4x4",
    "category": "indus",
    "width": 64,
    "height": 64,
    "filePath": "assets/deco/ind-core-4x4.png",
    "align": "floor",
    "tags": [
      "4x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-crane-1x3",
    "label": "Ind Crane 1x3",
    "category": "indus",
    "width": 16,
    "height": 48,
    "filePath": "assets/deco/ind-crane-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-crane-3x3",
    "label": "Ind Crane 3x3",
    "category": "indus",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/ind-crane-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-crate-2x1",
    "label": "Ind Crate 2x1",
    "category": "indus",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/ind-crate-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-crate-2x2",
    "label": "Ind Crate 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/ind-crate-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-door-2x2",
    "label": "Ind Door 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/ind-door-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-duct-2x1",
    "label": "Ind Duct 2x1",
    "category": "indus",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/ind-duct-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-fan-2x2",
    "label": "Ind Fan 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/ind-fan-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-furnace-3x2",
    "label": "Ind Furnace 3x2",
    "category": "indus",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/ind-furnace-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-gauge-1x1",
    "label": "Ind Gauge 1x1",
    "category": "indus",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/ind-gauge-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-gear-1x1",
    "label": "Ind Gear 1x1",
    "category": "indus",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/ind-gear-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-generator-2x2",
    "label": "Ind Generator 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/ind-generator-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-junction-2x1",
    "label": "Ind Junction 2x1",
    "category": "indus",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/ind-junction-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-ladder-1x2",
    "label": "Ind Ladder 1x2",
    "category": "indus",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/ind-ladder-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-lamp-1x2",
    "label": "Ind Lamp 1x2",
    "category": "indus",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/ind-lamp-1x2.png",
    "align": "wall",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-locker-1x2",
    "label": "Ind Locker 1x2",
    "category": "indus",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/ind-locker-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-motor-2x2",
    "label": "Ind Motor 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/ind-motor-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-panel-2x1",
    "label": "Ind Panel 2x1",
    "category": "indus",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/ind-panel-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-pipe-1x2",
    "label": "Ind Pipe 1x2",
    "category": "indus",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/ind-pipe-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-pipe-1x3",
    "label": "Ind Pipe 1x3",
    "category": "indus",
    "width": 16,
    "height": 48,
    "filePath": "assets/deco/ind-pipe-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-pipe-2x1",
    "label": "Ind Pipe 2x1",
    "category": "indus",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/ind-pipe-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-pipe-bank-3x2",
    "label": "Ind Pipe Bank 3x2",
    "category": "indus",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/ind-pipe-bank-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-pipe-cap-1x1",
    "label": "Ind Pipe Cap 1x1",
    "category": "indus",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/ind-pipe-cap-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-plant-4x4",
    "label": "Ind Plant 4x4",
    "category": "indus",
    "width": 64,
    "height": 64,
    "filePath": "assets/deco/ind-plant-4x4.png",
    "align": "floor",
    "tags": [
      "4x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-pump-1x2",
    "label": "Ind Pump 1x2",
    "category": "indus",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/ind-pump-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-rack-1x2",
    "label": "Ind Rack 1x2",
    "category": "indus",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/ind-rack-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-radiator-3x2",
    "label": "Ind Radiator 3x2",
    "category": "indus",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/ind-radiator-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-reactor-3x3",
    "label": "Ind Reactor 3x3",
    "category": "indus",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/ind-reactor-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-server-1x3",
    "label": "Ind Server 1x3",
    "category": "indus",
    "width": 16,
    "height": 48,
    "filePath": "assets/deco/ind-server-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-server-3x3",
    "label": "Ind Server 3x3",
    "category": "indus",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/ind-server-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-stack-1x2",
    "label": "Ind Stack 1x2",
    "category": "indus",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/ind-stack-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-storage-4x4",
    "label": "Ind Storage 4x4",
    "category": "indus",
    "width": 64,
    "height": 64,
    "filePath": "assets/deco/ind-storage-4x4.png",
    "align": "floor",
    "tags": [
      "4x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-tank-2x2",
    "label": "Ind Tank 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/ind-tank-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-terminal-1x2",
    "label": "Ind Terminal 1x2",
    "category": "indus",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/ind-terminal-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-valve-1x1",
    "label": "Ind Valve 1x1",
    "category": "indus",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/ind-valve-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-warning-2x1",
    "label": "Ind Warning 2x1",
    "category": "indus",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/ind-warning-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-assembler-2x2",
    "label": "Logi Assembler 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/logi-assembler-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-assembler-3x3",
    "label": "Logi Assembler 3x3",
    "category": "indus",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/logi-assembler-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-balancer-3x1",
    "label": "Logi Balancer 3x1",
    "category": "indus",
    "width": 48,
    "height": 16,
    "filePath": "assets/deco/logi-balancer-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-belt-1x2",
    "label": "Logi Belt 1x2",
    "category": "indus",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/logi-belt-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-belt-2x1",
    "label": "Logi Belt 2x1",
    "category": "indus",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/logi-belt-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-belt-3x1",
    "label": "Logi Belt 3x1",
    "category": "indus",
    "width": 48,
    "height": 16,
    "filePath": "assets/deco/logi-belt-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-buffer-2x2",
    "label": "Logi Buffer 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/logi-buffer-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-drill-1x2",
    "label": "Logi Drill 1x2",
    "category": "indus",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/logi-drill-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-drill-2x2",
    "label": "Logi Drill 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/logi-drill-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-drone-station-2x2",
    "label": "Logi Drone Station 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/logi-drone-station-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-extractor-2x2",
    "label": "Logi Extractor 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/logi-extractor-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-filter-2x2",
    "label": "Logi Filter 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/logi-filter-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-hopper-2x2",
    "label": "Logi Hopper 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/logi-hopper-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-loader-2x2",
    "label": "Logi Loader 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/logi-loader-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-merger-2x2",
    "label": "Logi Merger 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/logi-merger-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-pump-1x2",
    "label": "Logi Pump 1x2",
    "category": "indus",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/logi-pump-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-pump-2x2",
    "label": "Logi Pump 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/logi-pump-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-silo-2x2",
    "label": "Logi Silo 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/logi-silo-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-silo-2x3",
    "label": "Logi Silo 2x3",
    "category": "indus",
    "width": 32,
    "height": 48,
    "filePath": "assets/deco/logi-silo-2x3.png",
    "align": "floor",
    "tags": [
      "2x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-silo-3x3",
    "label": "Logi Silo 3x3",
    "category": "indus",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/logi-silo-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-smelter-2x2",
    "label": "Logi Smelter 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/logi-smelter-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-smelter-3x3",
    "label": "Logi Smelter 3x3",
    "category": "indus",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/logi-smelter-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-sorter-2x2",
    "label": "Logi Sorter 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/logi-sorter-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-sorter-3x3",
    "label": "Logi Sorter 3x3",
    "category": "indus",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/logi-sorter-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-splitter-2x2",
    "label": "Logi Splitter 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/logi-splitter-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-splitter-3x3",
    "label": "Logi Splitter 3x3",
    "category": "indus",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/logi-splitter-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-unloader-2x2",
    "label": "Logi Unloader 2x2",
    "category": "indus",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/logi-unloader-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-ash-1x1",
    "label": "Jar Ash 1x1",
    "category": "jar",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/jar-ash-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-crystal-1x1",
    "label": "Jar Crystal 1x1",
    "category": "jar",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/jar-crystal-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-empty-1x1",
    "label": "Jar Empty 1x1",
    "category": "jar",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/jar-empty-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-eye-1x1",
    "label": "Jar Eye 1x1",
    "category": "jar",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/jar-eye-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-gold-dust-1x1",
    "label": "Jar Gold Dust 1x1",
    "category": "jar",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/jar-gold-dust-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-goo-1x1",
    "label": "Jar Goo 1x1",
    "category": "jar",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/jar-goo-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-heart-1x1",
    "label": "Jar Heart 1x1",
    "category": "jar",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/jar-heart-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-ice-1x1",
    "label": "Jar Ice 1x1",
    "category": "jar",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/jar-ice-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-mite-1x1",
    "label": "Jar Mite 1x1",
    "category": "jar",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/jar-mite-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-oil-1x1",
    "label": "Jar Oil 1x1",
    "category": "jar",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/jar-oil-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-pollen-1x1",
    "label": "Jar Pollen 1x1",
    "category": "jar",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/jar-pollen-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-sand-1x1",
    "label": "Jar Sand 1x1",
    "category": "jar",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/jar-sand-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-spore-1x1",
    "label": "Jar Spore 1x1",
    "category": "jar",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/jar-spore-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-void-1x1",
    "label": "Jar Void 1x1",
    "category": "jar",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/jar-void-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-water-1x1",
    "label": "Jar Water 1x1",
    "category": "jar",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/jar-water-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-worm-1x1",
    "label": "Jar Worm 1x1",
    "category": "jar",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/jar-worm-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "key-bio-1x1",
    "label": "Key Bio 1x1",
    "category": "key",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/key-bio-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "key-card-1x1",
    "label": "Key Card 1x1",
    "category": "key",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/key-card-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "key-copper-1x1",
    "label": "Key Copper 1x1",
    "category": "key",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/key-copper-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "key-crystal-1x1",
    "label": "Key Crystal 1x1",
    "category": "key",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/key-crystal-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "key-eye-1x1",
    "label": "Key Eye 1x1",
    "category": "key",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/key-eye-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "key-gold-1x1",
    "label": "Key Gold 1x1",
    "category": "key",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/key-gold-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "key-heart-1x1",
    "label": "Key Heart 1x1",
    "category": "key",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/key-heart-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "key-ice-1x1",
    "label": "Key Ice 1x1",
    "category": "key",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/key-ice-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "key-master-1x1",
    "label": "Key Master 1x1",
    "category": "key",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/key-master-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "key-pixel-1x1",
    "label": "Key Pixel 1x1",
    "category": "key",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/key-pixel-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "key-rust-1x1",
    "label": "Key Rust 1x1",
    "category": "key",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/key-rust-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "key-sand-1x1",
    "label": "Key Sand 1x1",
    "category": "key",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/key-sand-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "key-skull-1x1",
    "label": "Key Skull 1x1",
    "category": "key",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/key-skull-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "key-spore-1x1",
    "label": "Key Spore 1x1",
    "category": "key",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/key-spore-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "key-temple-1x1",
    "label": "Key Temple 1x1",
    "category": "key",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/key-temple-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "key-void-1x1",
    "label": "Key Void 1x1",
    "category": "key",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/key-void-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "lever-bio-btn-1x1",
    "label": "Lever Bio Btn 1x1",
    "category": "lever",
    "width": 16,
    "height": 16,
    "filePath": "assets2/deco/lever-bio-btn-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "port-cyan-1x1",
    "label": "Port Cyan 1x1",
    "category": "port",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/port-cyan-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "port-factory-1x1",
    "label": "Port Factory 1x1",
    "category": "port",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/port-factory-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "port-fog-1x1",
    "label": "Port Fog 1x1",
    "category": "port",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/port-fog-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "port-garden-1x1",
    "label": "Port Garden 1x1",
    "category": "port",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/port-garden-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "port-gold-1x1",
    "label": "Port Gold 1x1",
    "category": "port",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/port-gold-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "port-green-1x1",
    "label": "Port Green 1x1",
    "category": "port",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/port-green-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "port-ice-1x1",
    "label": "Port Ice 1x1",
    "category": "port",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/port-ice-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "port-magma-1x1",
    "label": "Port Magma 1x1",
    "category": "port",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/port-magma-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "port-night-1x1",
    "label": "Port Night 1x1",
    "category": "port",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/port-night-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "port-ocean-1x1",
    "label": "Port Ocean 1x1",
    "category": "port",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/port-ocean-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "port-red-alert-1x1",
    "label": "Port Red Alert 1x1",
    "category": "port",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/port-red-alert-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "port-sand-1x1",
    "label": "Port Sand 1x1",
    "category": "port",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/port-sand-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "port-spore-1x1",
    "label": "Port Spore 1x1",
    "category": "port",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/port-spore-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "port-stars-1x1",
    "label": "Port Stars 1x1",
    "category": "port",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/port-stars-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "port-storm-1x1",
    "label": "Port Storm 1x1",
    "category": "port",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/port-storm-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "port-void-1x1",
    "label": "Port Void 1x1",
    "category": "port",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/port-void-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-cyan-2x2",
    "label": "Portal Cyan 2x2",
    "category": "portal",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/portal-cyan-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-cyan-3x3",
    "label": "Portal Cyan 3x3",
    "category": "portal",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/portal-cyan-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-gold-2x2",
    "label": "Portal Gold 2x2",
    "category": "portal",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/portal-gold-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-gold-3x3",
    "label": "Portal Gold 3x3",
    "category": "portal",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/portal-gold-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-ice-2x2",
    "label": "Portal Ice 2x2",
    "category": "portal",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/portal-ice-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-ice-3x3",
    "label": "Portal Ice 3x3",
    "category": "portal",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/portal-ice-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-magma-2x2",
    "label": "Portal Magma 2x2",
    "category": "portal",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/portal-magma-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-magma-3x3",
    "label": "Portal Magma 3x3",
    "category": "portal",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/portal-magma-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-pink-2x2",
    "label": "Portal Pink 2x2",
    "category": "portal",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/portal-pink-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-pink-3x3",
    "label": "Portal Pink 3x3",
    "category": "portal",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/portal-pink-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-sand-2x2",
    "label": "Portal Sand 2x2",
    "category": "portal",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/portal-sand-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-sand-3x3",
    "label": "Portal Sand 3x3",
    "category": "portal",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/portal-sand-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-spore-2x2",
    "label": "Portal Spore 2x2",
    "category": "portal",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/portal-spore-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-spore-3x3",
    "label": "Portal Spore 3x3",
    "category": "portal",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/portal-spore-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-void-2x2",
    "label": "Portal Void 2x2",
    "category": "portal",
    "width": 32,
    "height": 32,
    "filePath": "assets2/deco/portal-void-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-void-3x3",
    "label": "Portal Void 3x3",
    "category": "portal",
    "width": 48,
    "height": 48,
    "filePath": "assets2/deco/portal-void-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-assembler-arm-3x3",
    "label": "Probs Assembler Arm 3x3",
    "category": "probs",
    "width": 48,
    "height": 48,
    "filePath": "assets/block/probs-assembler-arm-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-bio-canister-1x1",
    "label": "Probs Bio Canister 1x1",
    "category": "probs",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/probs-bio-canister-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-biohazard-barrel-1x1",
    "label": "Probs Biohazard Barrel 1x1",
    "category": "probs",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/probs-biohazard-barrel-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-bioreactor-3x3",
    "label": "Probs Bioreactor 3x3",
    "category": "probs",
    "width": 48,
    "height": 48,
    "filePath": "assets/block/probs-bioreactor-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-console-3x3",
    "label": "Probs Console 3x3",
    "category": "probs",
    "width": 48,
    "height": 48,
    "filePath": "assets/block/probs-console-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-cooling-tower-3x3",
    "label": "Probs Cooling Tower 3x3",
    "category": "probs",
    "width": 48,
    "height": 48,
    "filePath": "assets/block/probs-cooling-tower-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-crate-1x1",
    "label": "Probs Crate 1x1",
    "category": "probs",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/probs-crate-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-crate-2x2",
    "label": "Probs Crate 2x2",
    "category": "probs",
    "width": 32,
    "height": 32,
    "filePath": "assets/block/probs-crate-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-crate-stack-4x4",
    "label": "Probs Crate Stack 4x4",
    "category": "probs",
    "width": 64,
    "height": 64,
    "filePath": "assets/block/probs-crate-stack-4x4.png",
    "align": "floor",
    "tags": [
      "4x4",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-data-node-1x1",
    "label": "Probs Data Node 1x1",
    "category": "probs",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/probs-data-node-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-door-2x2",
    "label": "Probs Door 2x2",
    "category": "probs",
    "width": 32,
    "height": 32,
    "filePath": "assets/block/probs-door-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-drone-dock-2x2",
    "label": "Probs Drone Dock 2x2",
    "category": "probs",
    "width": 32,
    "height": 32,
    "filePath": "assets/block/probs-drone-dock-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-fan-2x2",
    "label": "Probs Fan 2x2",
    "category": "probs",
    "width": 32,
    "height": 32,
    "filePath": "assets/block/probs-fan-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-fusion-core-4x4",
    "label": "Probs Fusion Core 4x4",
    "category": "probs",
    "width": 64,
    "height": 64,
    "filePath": "assets/block/probs-fusion-core-4x4.png",
    "align": "floor",
    "tags": [
      "4x4",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-gate-4x4",
    "label": "Probs Gate 4x4",
    "category": "probs",
    "width": 64,
    "height": 64,
    "filePath": "assets/block/probs-gate-4x4.png",
    "align": "floor",
    "tags": [
      "4x4",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-gene-sequencer-3x3",
    "label": "Probs Gene Sequencer 3x3",
    "category": "probs",
    "width": 48,
    "height": 48,
    "filePath": "assets/block/probs-gene-sequencer-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-growth-chamber-4x4",
    "label": "Probs Growth Chamber 4x4",
    "category": "probs",
    "width": 64,
    "height": 64,
    "filePath": "assets/block/probs-growth-chamber-4x4.png",
    "align": "floor",
    "tags": [
      "4x4",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-holo-projector-2x2",
    "label": "Probs Holo Projector 2x2",
    "category": "probs",
    "width": 32,
    "height": 32,
    "filePath": "assets/block/probs-holo-projector-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-incubator-2x2",
    "label": "Probs Incubator 2x2",
    "category": "probs",
    "width": 32,
    "height": 32,
    "filePath": "assets/block/probs-incubator-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-lab-bench-4x4",
    "label": "Probs Lab Bench 4x4",
    "category": "probs",
    "width": 64,
    "height": 64,
    "filePath": "assets/block/probs-lab-bench-4x4.png",
    "align": "floor",
    "tags": [
      "4x4",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-nutrient-tank-2x2",
    "label": "Probs Nutrient Tank 2x2",
    "category": "probs",
    "width": 32,
    "height": 32,
    "filePath": "assets/block/probs-nutrient-tank-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-pipe-junction-2x2",
    "label": "Probs Pipe Junction 2x2",
    "category": "probs",
    "width": 32,
    "height": 32,
    "filePath": "assets/block/probs-pipe-junction-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-power-junction-1x1",
    "label": "Probs Power Junction 1x1",
    "category": "probs",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/probs-power-junction-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-reactor-core-4x4",
    "label": "Probs Reactor Core 4x4",
    "category": "probs",
    "width": 64,
    "height": 64,
    "filePath": "assets/block/probs-reactor-core-4x4.png",
    "align": "floor",
    "tags": [
      "4x4",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-sample-tube-1x1",
    "label": "Probs Sample Tube 1x1",
    "category": "probs",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/probs-sample-tube-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-sensor-1x1",
    "label": "Probs Sensor 1x1",
    "category": "probs",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/probs-sensor-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-server-rack-2x2",
    "label": "Probs Server Rack 2x2",
    "category": "probs",
    "width": 32,
    "height": 32,
    "filePath": "assets/block/probs-server-rack-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-shelf-3x3",
    "label": "Probs Shelf 3x3",
    "category": "probs",
    "width": 48,
    "height": 48,
    "filePath": "assets/block/probs-shelf-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-spore-pod-1x1",
    "label": "Probs Spore Pod 1x1",
    "category": "probs",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/probs-spore-pod-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-stasis-pod-3x3",
    "label": "Probs Stasis Pod 3x3",
    "category": "probs",
    "width": 48,
    "height": 48,
    "filePath": "assets/block/probs-stasis-pod-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-vent-1x1",
    "label": "Probs Vent 1x1",
    "category": "probs",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/probs-vent-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-wall-light-1x1",
    "label": "Probs Wall Light 1x1",
    "category": "probs",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/probs-wall-light-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-window-2x2",
    "label": "Probs Window 2x2",
    "category": "probs",
    "width": 32,
    "height": 32,
    "filePath": "assets/block/probs-window-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-biohazard-1x1",
    "label": "Sign Biohazard 1x1",
    "category": "sign",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/sign-biohazard-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-biohazard-2x2",
    "label": "Sign Biohazard 2x2",
    "category": "sign",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/sign-biohazard-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-biohazard-3x3",
    "label": "Sign Biohazard 3x3",
    "category": "sign",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/sign-biohazard-3x3.png",
    "align": "wall",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-cold-1x1",
    "label": "Sign Cold 1x1",
    "category": "sign",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/sign-cold-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-cold-2x2",
    "label": "Sign Cold 2x2",
    "category": "sign",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/sign-cold-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-cold-3x3",
    "label": "Sign Cold 3x3",
    "category": "sign",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/sign-cold-3x3.png",
    "align": "wall",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-electric-1x1",
    "label": "Sign Electric 1x1",
    "category": "sign",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/sign-electric-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-electric-2x2",
    "label": "Sign Electric 2x2",
    "category": "sign",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/sign-electric-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-electric-3x3",
    "label": "Sign Electric 3x3",
    "category": "sign",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/sign-electric-3x3.png",
    "align": "wall",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-exit-1x1",
    "label": "Sign Exit 1x1",
    "category": "sign",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/sign-exit-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-exit-2x2",
    "label": "Sign Exit 2x2",
    "category": "sign",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/sign-exit-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-exit-3x3",
    "label": "Sign Exit 3x3",
    "category": "sign",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/sign-exit-3x3.png",
    "align": "wall",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-fire-1x1",
    "label": "Sign Fire 1x1",
    "category": "sign",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/sign-fire-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-fire-2x2",
    "label": "Sign Fire 2x2",
    "category": "sign",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/sign-fire-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-fire-3x3",
    "label": "Sign Fire 3x3",
    "category": "sign",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/sign-fire-3x3.png",
    "align": "wall",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-first-aid-1x1",
    "label": "Sign First Aid 1x1",
    "category": "sign",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/sign-first-aid-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-first-aid-2x2",
    "label": "Sign First Aid 2x2",
    "category": "sign",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/sign-first-aid-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-first-aid-3x3",
    "label": "Sign First Aid 3x3",
    "category": "sign",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/sign-first-aid-3x3.png",
    "align": "wall",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-flammable-1x1",
    "label": "Sign Flammable 1x1",
    "category": "sign",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/sign-flammable-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-flammable-2x2",
    "label": "Sign Flammable 2x2",
    "category": "sign",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/sign-flammable-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-flammable-3x3",
    "label": "Sign Flammable 3x3",
    "category": "sign",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/sign-flammable-3x3.png",
    "align": "wall",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-go-1x1",
    "label": "Sign Go 1x1",
    "category": "sign",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/sign-go-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-go-2x2",
    "label": "Sign Go 2x2",
    "category": "sign",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/sign-go-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-go-3x3",
    "label": "Sign Go 3x3",
    "category": "sign",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/sign-go-3x3.png",
    "align": "wall",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-info-1x1",
    "label": "Sign Info 1x1",
    "category": "sign",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/sign-info-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-info-2x2",
    "label": "Sign Info 2x2",
    "category": "sign",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/sign-info-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-info-3x3",
    "label": "Sign Info 3x3",
    "category": "sign",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/sign-info-3x3.png",
    "align": "wall",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-laser-1x1",
    "label": "Sign Laser 1x1",
    "category": "sign",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/sign-laser-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-laser-2x2",
    "label": "Sign Laser 2x2",
    "category": "sign",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/sign-laser-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-laser-3x3",
    "label": "Sign Laser 3x3",
    "category": "sign",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/sign-laser-3x3.png",
    "align": "wall",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-lock-1x1",
    "label": "Sign Lock 1x1",
    "category": "sign",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/sign-lock-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-lock-2x2",
    "label": "Sign Lock 2x2",
    "category": "sign",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/sign-lock-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-lock-3x3",
    "label": "Sign Lock 3x3",
    "category": "sign",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/sign-lock-3x3.png",
    "align": "wall",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-magnetic-1x1",
    "label": "Sign Magnetic 1x1",
    "category": "sign",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/sign-magnetic-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-magnetic-2x2",
    "label": "Sign Magnetic 2x2",
    "category": "sign",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/sign-magnetic-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-magnetic-3x3",
    "label": "Sign Magnetic 3x3",
    "category": "sign",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/sign-magnetic-3x3.png",
    "align": "wall",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-no-entry-1x1",
    "label": "Sign No Entry 1x1",
    "category": "sign",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/sign-no-entry-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-no-entry-2x2",
    "label": "Sign No Entry 2x2",
    "category": "sign",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/sign-no-entry-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-no-entry-3x3",
    "label": "Sign No Entry 3x3",
    "category": "sign",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/sign-no-entry-3x3.png",
    "align": "wall",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-radiation-1x1",
    "label": "Sign Radiation 1x1",
    "category": "sign",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/sign-radiation-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-radiation-2x2",
    "label": "Sign Radiation 2x2",
    "category": "sign",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/sign-radiation-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-radiation-3x3",
    "label": "Sign Radiation 3x3",
    "category": "sign",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/sign-radiation-3x3.png",
    "align": "wall",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-recycle-1x1",
    "label": "Sign Recycle 1x1",
    "category": "sign",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/sign-recycle-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-recycle-2x2",
    "label": "Sign Recycle 2x2",
    "category": "sign",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/sign-recycle-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-recycle-3x3",
    "label": "Sign Recycle 3x3",
    "category": "sign",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/sign-recycle-3x3.png",
    "align": "wall",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-skull-1x1",
    "label": "Sign Skull 1x1",
    "category": "sign",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/sign-skull-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-skull-2x2",
    "label": "Sign Skull 2x2",
    "category": "sign",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/sign-skull-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-skull-3x3",
    "label": "Sign Skull 3x3",
    "category": "sign",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/sign-skull-3x3.png",
    "align": "wall",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-stop-1x1",
    "label": "Sign Stop 1x1",
    "category": "sign",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/sign-stop-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-stop-2x2",
    "label": "Sign Stop 2x2",
    "category": "sign",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/sign-stop-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-stop-3x3",
    "label": "Sign Stop 3x3",
    "category": "sign",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/sign-stop-3x3.png",
    "align": "wall",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-toxic-1x1",
    "label": "Sign Toxic 1x1",
    "category": "sign",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/sign-toxic-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-toxic-2x2",
    "label": "Sign Toxic 2x2",
    "category": "sign",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/sign-toxic-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-toxic-3x3",
    "label": "Sign Toxic 3x3",
    "category": "sign",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/sign-toxic-3x3.png",
    "align": "wall",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-warning-1x1",
    "label": "Sign Warning 1x1",
    "category": "sign",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/sign-warning-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-warning-2x2",
    "label": "Sign Warning 2x2",
    "category": "sign",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/sign-warning-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-warning-3x3",
    "label": "Sign Warning 3x3",
    "category": "sign",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/sign-warning-3x3.png",
    "align": "wall",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-wifi-1x1",
    "label": "Sign Wifi 1x1",
    "category": "sign",
    "width": 16,
    "height": 16,
    "filePath": "assets2/icons/sign-wifi-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-wifi-2x2",
    "label": "Sign Wifi 2x2",
    "category": "sign",
    "width": 32,
    "height": 32,
    "filePath": "assets2/icons/sign-wifi-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-wifi-3x3",
    "label": "Sign Wifi 3x3",
    "category": "sign",
    "width": 48,
    "height": 48,
    "filePath": "assets2/icons/sign-wifi-3x3.png",
    "align": "wall",
    "tags": [
      "3x3",
      "icons"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-airlock-3x3",
    "label": "Probs Airlock 3x3",
    "category": "space",
    "width": 48,
    "height": 48,
    "filePath": "assets/block/probs-airlock-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-airlock-2x2",
    "label": "Space Airlock 2x2",
    "category": "space",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/space-airlock-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-airlock-3x3",
    "label": "Space Airlock 3x3",
    "category": "space",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/space-airlock-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-antenna-1x2",
    "label": "Space Antenna 1x2",
    "category": "space",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/space-antenna-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-antenna-2x2",
    "label": "Space Antenna 2x2",
    "category": "space",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/space-antenna-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-antenna-2x3",
    "label": "Space Antenna 2x3",
    "category": "space",
    "width": 32,
    "height": 48,
    "filePath": "assets/deco/space-antenna-2x3.png",
    "align": "floor",
    "tags": [
      "2x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-antenna-array-3x3",
    "label": "Space Antenna Array 3x3",
    "category": "space",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/space-antenna-array-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-boom-1x3",
    "label": "Space Boom 1x3",
    "category": "space",
    "width": 16,
    "height": 48,
    "filePath": "assets/deco/space-boom-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-cargo-2x2",
    "label": "Space Cargo 2x2",
    "category": "space",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/space-cargo-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-cargo-3x1",
    "label": "Space Cargo 3x1",
    "category": "space",
    "width": 48,
    "height": 16,
    "filePath": "assets/deco/space-cargo-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-dish-2x2",
    "label": "Space Dish 2x2",
    "category": "space",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/space-dish-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-dish-3x3",
    "label": "Space Dish 3x3",
    "category": "space",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/space-dish-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-dock-bay-4x2",
    "label": "Space Dock Bay 4x2",
    "category": "space",
    "width": 64,
    "height": 32,
    "filePath": "assets/deco/space-dock-bay-4x2.png",
    "align": "floor",
    "tags": [
      "4x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-dock-clamp-2x2",
    "label": "Space Dock Clamp 2x2",
    "category": "space",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/space-dock-clamp-2x2.png",
    "align": "wall",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-dock-clamp-3x2",
    "label": "Space Dock Clamp 3x2",
    "category": "space",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/space-dock-clamp-3x2.png",
    "align": "wall",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-dome-2x2",
    "label": "Space Dome 2x2",
    "category": "space",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/space-dome-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-dome-3x3",
    "label": "Space Dome 3x3",
    "category": "space",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/space-dome-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-fuel-1x2",
    "label": "Space Fuel 1x2",
    "category": "space",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/space-fuel-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-fuel-2x2",
    "label": "Space Fuel 2x2",
    "category": "space",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/space-fuel-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-habitat-2x2",
    "label": "Space Habitat 2x2",
    "category": "space",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/space-habitat-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-habitat-3x2",
    "label": "Space Habitat 3x2",
    "category": "space",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/space-habitat-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-habitat-4x2",
    "label": "Space Habitat 4x2",
    "category": "space",
    "width": 64,
    "height": 32,
    "filePath": "assets/deco/space-habitat-4x2.png",
    "align": "floor",
    "tags": [
      "4x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-navlight-1x1",
    "label": "Space Navlight 1x1",
    "category": "space",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/space-navlight-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-navlight-g-1x1",
    "label": "Space Navlight G 1x1",
    "category": "space",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/space-navlight-g-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-pedestal-1x2",
    "label": "Space Pedestal 1x2",
    "category": "space",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/space-pedestal-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-probe-1x1",
    "label": "Space Probe 1x1",
    "category": "space",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/space-probe-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-radiator-2x1",
    "label": "Space Radiator 2x1",
    "category": "space",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/space-radiator-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-radiator-3x1",
    "label": "Space Radiator 3x1",
    "category": "space",
    "width": 48,
    "height": 16,
    "filePath": "assets/deco/space-radiator-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-rcs-1x1",
    "label": "Space Rcs 1x1",
    "category": "space",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/space-rcs-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-rcs-2x1",
    "label": "Space Rcs 2x1",
    "category": "space",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/space-rcs-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-sat-2x2",
    "label": "Space Sat 2x2",
    "category": "space",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/space-sat-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-sat-3x3",
    "label": "Space Sat 3x3",
    "category": "space",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/space-sat-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-solar-2x2",
    "label": "Space Solar 2x2",
    "category": "space",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/space-solar-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-solar-3x1",
    "label": "Space Solar 3x1",
    "category": "space",
    "width": 48,
    "height": 16,
    "filePath": "assets/deco/space-solar-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-solar-3x3",
    "label": "Space Solar 3x3",
    "category": "space",
    "width": 48,
    "height": 48,
    "filePath": "assets/deco/space-solar-3x3.png",
    "align": "floor",
    "tags": [
      "3x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-starfield-2x2",
    "label": "Space Starfield 2x2",
    "category": "space",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/space-starfield-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-thruster-1x2",
    "label": "Space Thruster 1x2",
    "category": "space",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/space-thruster-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-thruster-2x1",
    "label": "Space Thruster 2x1",
    "category": "space",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/space-thruster-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "space-thruster-2x2",
    "label": "Space Thruster 2x2",
    "category": "space",
    "width": 32,
    "height": 32,
    "filePath": "assets/deco/space-thruster-2x2.png",
    "align": "floor",
    "tags": [
      "2x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-aquarium-1x2",
    "label": "Vert Aquarium 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-aquarium-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-aquarium-1x3",
    "label": "Vert Aquarium 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-aquarium-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-aquarium-1x4",
    "label": "Vert Aquarium 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-aquarium-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-barrels-1x2",
    "label": "Vert Barrels 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-barrels-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-barrels-1x3",
    "label": "Vert Barrels 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-barrels-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-barrels-1x4",
    "label": "Vert Barrels 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-barrels-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-bookshelf-1x2",
    "label": "Vert Bookshelf 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-bookshelf-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-bookshelf-1x3",
    "label": "Vert Bookshelf 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-bookshelf-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-bookshelf-1x4",
    "label": "Vert Bookshelf 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-bookshelf-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-cabinet-1x2",
    "label": "Vert Cabinet 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-cabinet-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-cabinet-1x3",
    "label": "Vert Cabinet 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-cabinet-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-cabinet-1x4",
    "label": "Vert Cabinet 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-cabinet-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-clock-1x2",
    "label": "Vert Clock 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-clock-1x2.png",
    "align": "wall",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-clock-1x3",
    "label": "Vert Clock 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-clock-1x3.png",
    "align": "wall",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-clock-1x4",
    "label": "Vert Clock 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-clock-1x4.png",
    "align": "wall",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-coat-rack-1x2",
    "label": "Vert Coat Rack 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-coat-rack-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-coat-rack-1x3",
    "label": "Vert Coat Rack 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-coat-rack-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-coat-rack-1x4",
    "label": "Vert Coat Rack 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-coat-rack-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-crates-1x2",
    "label": "Vert Crates 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-crates-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-crates-1x3",
    "label": "Vert Crates 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-crates-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-crates-1x4",
    "label": "Vert Crates 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-crates-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-data-pillar-1x2",
    "label": "Vert Data Pillar 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-data-pillar-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-data-pillar-1x3",
    "label": "Vert Data Pillar 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-data-pillar-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-data-pillar-1x4",
    "label": "Vert Data Pillar 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-data-pillar-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-flagpole-1x2",
    "label": "Vert Flagpole 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-flagpole-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-flagpole-1x3",
    "label": "Vert Flagpole 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-flagpole-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-flagpole-1x4",
    "label": "Vert Flagpole 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-flagpole-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-fountain-1x2",
    "label": "Vert Fountain 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-fountain-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-fountain-1x3",
    "label": "Vert Fountain 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-fountain-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-fountain-1x4",
    "label": "Vert Fountain 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-fountain-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-fridge-1x2",
    "label": "Vert Fridge 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-fridge-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-fridge-1x3",
    "label": "Vert Fridge 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-fridge-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-fridge-1x4",
    "label": "Vert Fridge 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-fridge-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-gene-vault-1x2",
    "label": "Vert Gene Vault 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-gene-vault-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-gene-vault-1x3",
    "label": "Vert Gene Vault 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-gene-vault-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-gene-vault-1x4",
    "label": "Vert Gene Vault 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-gene-vault-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-incubator-1x2",
    "label": "Vert Incubator 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-incubator-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-incubator-1x3",
    "label": "Vert Incubator 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-incubator-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-incubator-1x4",
    "label": "Vert Incubator 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-incubator-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-ladder-1x2",
    "label": "Vert Ladder 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-ladder-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-ladder-1x3",
    "label": "Vert Ladder 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-ladder-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-ladder-1x4",
    "label": "Vert Ladder 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-ladder-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-lamp-1x2",
    "label": "Vert Lamp 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-lamp-1x2.png",
    "align": "wall",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-lamp-1x3",
    "label": "Vert Lamp 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-lamp-1x3.png",
    "align": "wall",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-lamp-1x4",
    "label": "Vert Lamp 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-lamp-1x4.png",
    "align": "wall",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-locker-1x2",
    "label": "Vert Locker 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-locker-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-locker-1x3",
    "label": "Vert Locker 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-locker-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-locker-1x4",
    "label": "Vert Locker 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-locker-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-locker-red-1x2",
    "label": "Vert Locker Red 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-locker-red-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-locker-red-1x3",
    "label": "Vert Locker Red 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-locker-red-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-locker-red-1x4",
    "label": "Vert Locker Red 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-locker-red-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-pipe-1x2",
    "label": "Vert Pipe 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-pipe-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-pipe-1x3",
    "label": "Vert Pipe 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-pipe-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-pipe-1x4",
    "label": "Vert Pipe 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-pipe-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-plant-1x2",
    "label": "Vert Plant 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-plant-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-plant-1x3",
    "label": "Vert Plant 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-plant-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-plant-1x4",
    "label": "Vert Plant 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-plant-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-robot-1x2",
    "label": "Vert Robot 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-robot-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-robot-1x3",
    "label": "Vert Robot 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-robot-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-robot-1x4",
    "label": "Vert Robot 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-robot-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-safe-1x2",
    "label": "Vert Safe 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-safe-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-safe-1x3",
    "label": "Vert Safe 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-safe-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-safe-1x4",
    "label": "Vert Safe 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-safe-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-server-1x2",
    "label": "Vert Server 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-server-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-server-1x3",
    "label": "Vert Server 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-server-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-server-1x4",
    "label": "Vert Server 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-server-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-speaker-1x2",
    "label": "Vert Speaker 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-speaker-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-speaker-1x3",
    "label": "Vert Speaker 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-speaker-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-speaker-1x4",
    "label": "Vert Speaker 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-speaker-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-spore-tower-1x2",
    "label": "Vert Spore Tower 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-spore-tower-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-spore-tower-1x3",
    "label": "Vert Spore Tower 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-spore-tower-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-spore-tower-1x4",
    "label": "Vert Spore Tower 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-spore-tower-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-statue-1x2",
    "label": "Vert Statue 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-statue-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-statue-1x3",
    "label": "Vert Statue 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-statue-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-statue-1x4",
    "label": "Vert Statue 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-statue-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-tank-1x2",
    "label": "Vert Tank 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-tank-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-tank-1x3",
    "label": "Vert Tank 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-tank-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-tank-1x4",
    "label": "Vert Tank 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-tank-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-telescope-1x2",
    "label": "Vert Telescope 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-telescope-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-telescope-1x3",
    "label": "Vert Telescope 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-telescope-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-telescope-1x4",
    "label": "Vert Telescope 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-telescope-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-toolbox-1x2",
    "label": "Vert Toolbox 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-toolbox-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-toolbox-1x3",
    "label": "Vert Toolbox 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-toolbox-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-toolbox-1x4",
    "label": "Vert Toolbox 1x4",
    "category": "vert",
    "width": 16,
    "height": 64,
    "filePath": "assets2/deco/vert-toolbox-1x4.png",
    "align": "floor",
    "tags": [
      "1x4",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-umbrella-1x2",
    "label": "Vert Umbrella 1x2",
    "category": "vert",
    "width": 16,
    "height": 32,
    "filePath": "assets2/deco/vert-umbrella-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-umbrella-1x3",
    "label": "Vert Umbrella 1x3",
    "category": "vert",
    "width": 16,
    "height": 48,
    "filePath": "assets2/deco/vert-umbrella-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-floor-bronze-1x1",
    "label": "Tile Floor Bronze 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-floor-bronze-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-floor-check-1x1",
    "label": "Tile Floor Check 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-floor-check-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-floor-dirt-1x1",
    "label": "Tile Floor Dirt 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-floor-dirt-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-floor-dots-1x1",
    "label": "Tile Floor Dots 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-floor-dots-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-floor-grass-1x1",
    "label": "Tile Floor Grass 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-floor-grass-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-floor-lines-1x1",
    "label": "Tile Floor Lines 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-floor-lines-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-floor-plate-1x1",
    "label": "Tile Floor Plate 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-floor-plate-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-floor-tech-1x1",
    "label": "Tile Floor Tech 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-floor-tech-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-grating-1x1",
    "label": "Tile Grating 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-grating-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-grating-heavy-1x1",
    "label": "Tile Grating Heavy 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-grating-heavy-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-grating-vent-1x1",
    "label": "Tile Grating Vent 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-grating-vent-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-bronze-1x1",
    "label": "Tile Wall Bronze 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-wall-bronze-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-bronze-tile-1x1",
    "label": "Tile Wall Bronze Tile 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-wall-bronze-tile-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-check-1x1",
    "label": "Tile Wall Check 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-wall-check-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-console-1x1",
    "label": "Tile Wall Console 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-wall-console-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-dots-1x1",
    "label": "Tile Wall Dots 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-wall-dots-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-glass-1x1",
    "label": "Tile Wall Glass 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-wall-glass-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-light-1x1",
    "label": "Tile Wall Light 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-wall-light-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-lines-1x1",
    "label": "Tile Wall Lines 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-wall-lines-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-panel-1x1",
    "label": "Tile Wall Panel 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-wall-panel-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-plate-1x1",
    "label": "Tile Wall Plate 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-wall-plate-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-siding-1x1",
    "label": "Tile Wall Siding 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-wall-siding-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-steel-1x1",
    "label": "Tile Wall Steel 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-wall-steel-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-stripe-1x1",
    "label": "Tile Wall Stripe 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-wall-stripe-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-tech-1x1",
    "label": "Tile Wall Tech 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-wall-tech-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-vent-1x1",
    "label": "Tile Wall Vent 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-wall-vent-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-warning-1x1",
    "label": "Tile Wall Warning 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-wall-warning-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-window-1x1",
    "label": "Tile Wall Window 1x1",
    "category": "walls",
    "width": 16,
    "height": 16,
    "filePath": "assets/block/tile-wall-window-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "block"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-bay-4x2",
    "label": "Wide Bay 4x2",
    "category": "wide",
    "width": 64,
    "height": 32,
    "filePath": "assets/deco/wide-bay-4x2.png",
    "align": "floor",
    "tags": [
      "4x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-beam-3x1",
    "label": "Wide Beam 3x1",
    "category": "wide",
    "width": 48,
    "height": 16,
    "filePath": "assets/deco/wide-beam-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-beam-4x1",
    "label": "Wide Beam 4x1",
    "category": "wide",
    "width": 64,
    "height": 16,
    "filePath": "assets/deco/wide-beam-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-billboard-3x1",
    "label": "Wide Billboard 3x1",
    "category": "wide",
    "width": 48,
    "height": 16,
    "filePath": "assets/deco/wide-billboard-3x1.png",
    "align": "wall",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-billboard-4x2",
    "label": "Wide Billboard 4x2",
    "category": "wide",
    "width": 64,
    "height": 32,
    "filePath": "assets/deco/wide-billboard-4x2.png",
    "align": "wall",
    "tags": [
      "4x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-bridge-4x1",
    "label": "Wide Bridge 4x1",
    "category": "wide",
    "width": 64,
    "height": 16,
    "filePath": "assets/deco/wide-bridge-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-cable-3x1",
    "label": "Wide Cable 3x1",
    "category": "wide",
    "width": 48,
    "height": 16,
    "filePath": "assets/deco/wide-cable-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-console-3x1",
    "label": "Wide Console 3x1",
    "category": "wide",
    "width": 48,
    "height": 16,
    "filePath": "assets/deco/wide-console-3x1.png",
    "align": "wall",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-console-4x2",
    "label": "Wide Console 4x2",
    "category": "wide",
    "width": 64,
    "height": 32,
    "filePath": "assets/deco/wide-console-4x2.png",
    "align": "floor",
    "tags": [
      "4x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-console-alt-3x1",
    "label": "Wide Console Alt 3x1",
    "category": "wide",
    "width": 48,
    "height": 16,
    "filePath": "assets/deco/wide-console-alt-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-duct-3x1",
    "label": "Wide Duct 3x1",
    "category": "wide",
    "width": 48,
    "height": 16,
    "filePath": "assets/deco/wide-duct-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-gauges-3x2",
    "label": "Wide Gauges 3x2",
    "category": "wide",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/wide-gauges-3x2.png",
    "align": "wall",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-keys-3x1",
    "label": "Wide Keys 3x1",
    "category": "wide",
    "width": 48,
    "height": 16,
    "filePath": "assets/deco/wide-keys-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-ladder-1x3",
    "label": "Wide Ladder 1x3",
    "category": "wide",
    "width": 16,
    "height": 48,
    "filePath": "assets/deco/wide-ladder-1x3.png",
    "align": "floor",
    "tags": [
      "1x3",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-level-bar-3x1",
    "label": "Wide Level Bar 3x1",
    "category": "wide",
    "width": 48,
    "height": 16,
    "filePath": "assets/deco/wide-level-bar-3x1.png",
    "align": "wall",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-level-tank-2x1",
    "label": "Wide Level Tank 2x1",
    "category": "wide",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/wide-level-tank-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-level-vert-1x1",
    "label": "Wide Level Vert 1x1",
    "category": "wide",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/wide-level-vert-1x1.png",
    "align": "floor",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-level-vert-1x2",
    "label": "Wide Level Vert 1x2",
    "category": "wide",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/wide-level-vert-1x2.png",
    "align": "floor",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-manifold-3x2",
    "label": "Wide Manifold 3x2",
    "category": "wide",
    "width": 48,
    "height": 32,
    "filePath": "assets/deco/wide-manifold-3x2.png",
    "align": "floor",
    "tags": [
      "3x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-monitor-bank-4x2",
    "label": "Wide Monitor Bank 4x2",
    "category": "wide",
    "width": 64,
    "height": 32,
    "filePath": "assets/deco/wide-monitor-bank-4x2.png",
    "align": "floor",
    "tags": [
      "4x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-pipe-3x1",
    "label": "Wide Pipe 3x1",
    "category": "wide",
    "width": 48,
    "height": 16,
    "filePath": "assets/deco/wide-pipe-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-pipe-4x1",
    "label": "Wide Pipe 4x1",
    "category": "wide",
    "width": 64,
    "height": 16,
    "filePath": "assets/deco/wide-pipe-4x1.png",
    "align": "floor",
    "tags": [
      "4x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-pipe-coolant-3x1",
    "label": "Wide Pipe Coolant 3x1",
    "category": "wide",
    "width": 48,
    "height": 16,
    "filePath": "assets/deco/wide-pipe-coolant-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-rail-3x1",
    "label": "Wide Rail 3x1",
    "category": "wide",
    "width": 48,
    "height": 16,
    "filePath": "assets/deco/wide-rail-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-reactor-strip-4x2",
    "label": "Wide Reactor Strip 4x2",
    "category": "wide",
    "width": 64,
    "height": 32,
    "filePath": "assets/deco/wide-reactor-strip-4x2.png",
    "align": "floor",
    "tags": [
      "4x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-shelf-3x1",
    "label": "Wide Shelf 3x1",
    "category": "wide",
    "width": 48,
    "height": 16,
    "filePath": "assets/deco/wide-shelf-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-sign-2x1",
    "label": "Wide Sign 2x1",
    "category": "wide",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/wide-sign-2x1.png",
    "align": "wall",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-sign-danger-3x1",
    "label": "Wide Sign Danger 3x1",
    "category": "wide",
    "width": 48,
    "height": 16,
    "filePath": "assets/deco/wide-sign-danger-3x1.png",
    "align": "wall",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-sign-ok-2x1",
    "label": "Wide Sign Ok 2x1",
    "category": "wide",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/wide-sign-ok-2x1.png",
    "align": "wall",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-status-3x1",
    "label": "Wide Status 3x1",
    "category": "wide",
    "width": 48,
    "height": 16,
    "filePath": "assets/deco/wide-status-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-valve-1x1",
    "label": "Wide Valve 1x1",
    "category": "wide",
    "width": 16,
    "height": 16,
    "filePath": "assets/deco/wide-valve-1x1.png",
    "align": "wall",
    "tags": [
      "1x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-valve-1x2",
    "label": "Wide Valve 1x2",
    "category": "wide",
    "width": 16,
    "height": 32,
    "filePath": "assets/deco/wide-valve-1x2.png",
    "align": "wall",
    "tags": [
      "1x2",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-valve-2x1",
    "label": "Wide Valve 2x1",
    "category": "wide",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/wide-valve-2x1.png",
    "align": "wall",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-warning-2x1",
    "label": "Wide Warning 2x1",
    "category": "wide",
    "width": 32,
    "height": 16,
    "filePath": "assets/deco/wide-warning-2x1.png",
    "align": "floor",
    "tags": [
      "2x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-warning-3x1",
    "label": "Wide Warning 3x1",
    "category": "wide",
    "width": 48,
    "height": 16,
    "filePath": "assets/deco/wide-warning-3x1.png",
    "align": "floor",
    "tags": [
      "3x1",
      "deco"
    ],
    "description": "Decorative. No collision."
  }
];
var ICON_FILES = [
  {
    "id": "icons",
    "filePath": "./assets/icons/char-A-1x1.png"
  },
  {
    "id": "icon-arrow-back-1x1",
    "filePath": "assets/icons/icon-arrow-back-1x1.png"
  },
  {
    "id": "icon-arrow-back-2x2",
    "filePath": "assets/icons/icon-arrow-back-2x2.png"
  },
  {
    "id": "icon-arrow-back-3x3",
    "filePath": "assets/icons/icon-arrow-back-3x3.png"
  },
  {
    "id": "icon-arrow-bounce-1x1",
    "filePath": "assets/icons/icon-arrow-bounce-1x1.png"
  },
  {
    "id": "icon-arrow-bounce-2x2",
    "filePath": "assets/icons/icon-arrow-bounce-2x2.png"
  },
  {
    "id": "icon-arrow-bounce-3x3",
    "filePath": "assets/icons/icon-arrow-bounce-3x3.png"
  },
  {
    "id": "icon-arrow-circle-down-1x1",
    "filePath": "assets/icons/icon-arrow-circle-down-1x1.png"
  },
  {
    "id": "icon-arrow-circle-down-2x2",
    "filePath": "assets/icons/icon-arrow-circle-down-2x2.png"
  },
  {
    "id": "icon-arrow-circle-down-3x3",
    "filePath": "assets/icons/icon-arrow-circle-down-3x3.png"
  },
  {
    "id": "icon-arrow-circle-left-1x1",
    "filePath": "assets/icons/icon-arrow-circle-left-1x1.png"
  },
  {
    "id": "icon-arrow-circle-left-2x2",
    "filePath": "assets/icons/icon-arrow-circle-left-2x2.png"
  },
  {
    "id": "icon-arrow-circle-left-3x3",
    "filePath": "assets/icons/icon-arrow-circle-left-3x3.png"
  },
  {
    "id": "icon-arrow-circle-right-1x1",
    "filePath": "assets/icons/icon-arrow-circle-right-1x1.png"
  },
  {
    "id": "icon-arrow-circle-right-2x2",
    "filePath": "assets/icons/icon-arrow-circle-right-2x2.png"
  },
  {
    "id": "icon-arrow-circle-right-3x3",
    "filePath": "assets/icons/icon-arrow-circle-right-3x3.png"
  },
  {
    "id": "icon-arrow-circle-up-1x1",
    "filePath": "assets/icons/icon-arrow-circle-up-1x1.png"
  },
  {
    "id": "icon-arrow-circle-up-2x2",
    "filePath": "assets/icons/icon-arrow-circle-up-2x2.png"
  },
  {
    "id": "icon-arrow-circle-up-3x3",
    "filePath": "assets/icons/icon-arrow-circle-up-3x3.png"
  },
  {
    "id": "icon-arrow-collapse-1x1",
    "filePath": "assets/icons/icon-arrow-collapse-1x1.png"
  },
  {
    "id": "icon-arrow-collapse-2x2",
    "filePath": "assets/icons/icon-arrow-collapse-2x2.png"
  },
  {
    "id": "icon-arrow-collapse-3x3",
    "filePath": "assets/icons/icon-arrow-collapse-3x3.png"
  },
  {
    "id": "icon-arrow-double-down-1x1",
    "filePath": "assets/icons/icon-arrow-double-down-1x1.png"
  },
  {
    "id": "icon-arrow-double-down-2x2",
    "filePath": "assets/icons/icon-arrow-double-down-2x2.png"
  },
  {
    "id": "icon-arrow-double-down-3x3",
    "filePath": "assets/icons/icon-arrow-double-down-3x3.png"
  },
  {
    "id": "icon-arrow-double-left-1x1",
    "filePath": "assets/icons/icon-arrow-double-left-1x1.png"
  },
  {
    "id": "icon-arrow-double-left-2x2",
    "filePath": "assets/icons/icon-arrow-double-left-2x2.png"
  },
  {
    "id": "icon-arrow-double-left-3x3",
    "filePath": "assets/icons/icon-arrow-double-left-3x3.png"
  },
  {
    "id": "icon-arrow-double-right-1x1",
    "filePath": "assets/icons/icon-arrow-double-right-1x1.png"
  },
  {
    "id": "icon-arrow-double-right-2x2",
    "filePath": "assets/icons/icon-arrow-double-right-2x2.png"
  },
  {
    "id": "icon-arrow-double-right-3x3",
    "filePath": "assets/icons/icon-arrow-double-right-3x3.png"
  },
  {
    "id": "icon-arrow-double-up-1x1",
    "filePath": "assets/icons/icon-arrow-double-up-1x1.png"
  },
  {
    "id": "icon-arrow-double-up-2x2",
    "filePath": "assets/icons/icon-arrow-double-up-2x2.png"
  },
  {
    "id": "icon-arrow-double-up-3x3",
    "filePath": "assets/icons/icon-arrow-double-up-3x3.png"
  },
  {
    "id": "icon-arrow-down-1x1",
    "filePath": "assets/icons/icon-arrow-down-1x1.png"
  },
  {
    "id": "icon-arrow-down-2x2",
    "filePath": "assets/icons/icon-arrow-down-2x2.png"
  },
  {
    "id": "icon-arrow-down-3x3",
    "filePath": "assets/icons/icon-arrow-down-3x3.png"
  },
  {
    "id": "icon-arrow-down-left-1x1",
    "filePath": "assets/icons/icon-arrow-down-left-1x1.png"
  },
  {
    "id": "icon-arrow-down-left-2x2",
    "filePath": "assets/icons/icon-arrow-down-left-2x2.png"
  },
  {
    "id": "icon-arrow-down-left-3x3",
    "filePath": "assets/icons/icon-arrow-down-left-3x3.png"
  },
  {
    "id": "icon-arrow-down-right-1x1",
    "filePath": "assets/icons/icon-arrow-down-right-1x1.png"
  },
  {
    "id": "icon-arrow-down-right-2x2",
    "filePath": "assets/icons/icon-arrow-down-right-2x2.png"
  },
  {
    "id": "icon-arrow-down-right-3x3",
    "filePath": "assets/icons/icon-arrow-down-right-3x3.png"
  },
  {
    "id": "icon-arrow-enter-1x1",
    "filePath": "assets/icons/icon-arrow-enter-1x1.png"
  },
  {
    "id": "icon-arrow-enter-2x2",
    "filePath": "assets/icons/icon-arrow-enter-2x2.png"
  },
  {
    "id": "icon-arrow-enter-3x3",
    "filePath": "assets/icons/icon-arrow-enter-3x3.png"
  },
  {
    "id": "icon-arrow-expand-1x1",
    "filePath": "assets/icons/icon-arrow-expand-1x1.png"
  },
  {
    "id": "icon-arrow-expand-2x2",
    "filePath": "assets/icons/icon-arrow-expand-2x2.png"
  },
  {
    "id": "icon-arrow-expand-3x3",
    "filePath": "assets/icons/icon-arrow-expand-3x3.png"
  },
  {
    "id": "icon-arrow-fork-1x1",
    "filePath": "assets/icons/icon-arrow-fork-1x1.png"
  },
  {
    "id": "icon-arrow-fork-2x2",
    "filePath": "assets/icons/icon-arrow-fork-2x2.png"
  },
  {
    "id": "icon-arrow-fork-3x3",
    "filePath": "assets/icons/icon-arrow-fork-3x3.png"
  },
  {
    "id": "icon-arrow-left-1x1",
    "filePath": "assets/icons/icon-arrow-left-1x1.png"
  },
  {
    "id": "icon-arrow-left-2x2",
    "filePath": "assets/icons/icon-arrow-left-2x2.png"
  },
  {
    "id": "icon-arrow-left-3x3",
    "filePath": "assets/icons/icon-arrow-left-3x3.png"
  },
  {
    "id": "icon-arrow-left-right-1x1",
    "filePath": "assets/icons/icon-arrow-left-right-1x1.png"
  },
  {
    "id": "icon-arrow-left-right-2x2",
    "filePath": "assets/icons/icon-arrow-left-right-2x2.png"
  },
  {
    "id": "icon-arrow-left-right-3x3",
    "filePath": "assets/icons/icon-arrow-left-right-3x3.png"
  },
  {
    "id": "icon-arrow-merge-1x1",
    "filePath": "assets/icons/icon-arrow-merge-1x1.png"
  },
  {
    "id": "icon-arrow-merge-2x2",
    "filePath": "assets/icons/icon-arrow-merge-2x2.png"
  },
  {
    "id": "icon-arrow-merge-3x3",
    "filePath": "assets/icons/icon-arrow-merge-3x3.png"
  },
  {
    "id": "icon-arrow-redo-1x1",
    "filePath": "assets/icons/icon-arrow-redo-1x1.png"
  },
  {
    "id": "icon-arrow-redo-2x2",
    "filePath": "assets/icons/icon-arrow-redo-2x2.png"
  },
  {
    "id": "icon-arrow-redo-3x3",
    "filePath": "assets/icons/icon-arrow-redo-3x3.png"
  },
  {
    "id": "icon-arrow-right-1x1",
    "filePath": "assets/icons/icon-arrow-right-1x1.png"
  },
  {
    "id": "icon-arrow-right-2x2",
    "filePath": "assets/icons/icon-arrow-right-2x2.png"
  },
  {
    "id": "icon-arrow-right-3x3",
    "filePath": "assets/icons/icon-arrow-right-3x3.png"
  },
  {
    "id": "icon-arrow-rotate-ccw-1x1",
    "filePath": "assets/icons/icon-arrow-rotate-ccw-1x1.png"
  },
  {
    "id": "icon-arrow-rotate-ccw-2x2",
    "filePath": "assets/icons/icon-arrow-rotate-ccw-2x2.png"
  },
  {
    "id": "icon-arrow-rotate-ccw-3x3",
    "filePath": "assets/icons/icon-arrow-rotate-ccw-3x3.png"
  },
  {
    "id": "icon-arrow-rotate-cw-1x1",
    "filePath": "assets/icons/icon-arrow-rotate-cw-1x1.png"
  },
  {
    "id": "icon-arrow-rotate-cw-2x2",
    "filePath": "assets/icons/icon-arrow-rotate-cw-2x2.png"
  },
  {
    "id": "icon-arrow-rotate-cw-3x3",
    "filePath": "assets/icons/icon-arrow-rotate-cw-3x3.png"
  },
  {
    "id": "icon-arrow-shuffle-1x1",
    "filePath": "assets/icons/icon-arrow-shuffle-1x1.png"
  },
  {
    "id": "icon-arrow-shuffle-2x2",
    "filePath": "assets/icons/icon-arrow-shuffle-2x2.png"
  },
  {
    "id": "icon-arrow-shuffle-3x3",
    "filePath": "assets/icons/icon-arrow-shuffle-3x3.png"
  },
  {
    "id": "icon-arrow-sort-1x1",
    "filePath": "assets/icons/icon-arrow-sort-1x1.png"
  },
  {
    "id": "icon-arrow-sort-2x2",
    "filePath": "assets/icons/icon-arrow-sort-2x2.png"
  },
  {
    "id": "icon-arrow-sort-3x3",
    "filePath": "assets/icons/icon-arrow-sort-3x3.png"
  },
  {
    "id": "icon-arrow-trend-down-1x1",
    "filePath": "assets/icons/icon-arrow-trend-down-1x1.png"
  },
  {
    "id": "icon-arrow-trend-down-2x2",
    "filePath": "assets/icons/icon-arrow-trend-down-2x2.png"
  },
  {
    "id": "icon-arrow-trend-down-3x3",
    "filePath": "assets/icons/icon-arrow-trend-down-3x3.png"
  },
  {
    "id": "icon-arrow-trend-up-1x1",
    "filePath": "assets/icons/icon-arrow-trend-up-1x1.png"
  },
  {
    "id": "icon-arrow-trend-up-2x2",
    "filePath": "assets/icons/icon-arrow-trend-up-2x2.png"
  },
  {
    "id": "icon-arrow-trend-up-3x3",
    "filePath": "assets/icons/icon-arrow-trend-up-3x3.png"
  },
  {
    "id": "icon-arrow-undo-1x1",
    "filePath": "assets/icons/icon-arrow-undo-1x1.png"
  },
  {
    "id": "icon-arrow-undo-2x2",
    "filePath": "assets/icons/icon-arrow-undo-2x2.png"
  },
  {
    "id": "icon-arrow-undo-3x3",
    "filePath": "assets/icons/icon-arrow-undo-3x3.png"
  },
  {
    "id": "icon-arrow-up-1x1",
    "filePath": "assets/icons/icon-arrow-up-1x1.png"
  },
  {
    "id": "icon-arrow-up-2x2",
    "filePath": "assets/icons/icon-arrow-up-2x2.png"
  },
  {
    "id": "icon-arrow-up-3x3",
    "filePath": "assets/icons/icon-arrow-up-3x3.png"
  },
  {
    "id": "icon-arrow-up-down-1x1",
    "filePath": "assets/icons/icon-arrow-up-down-1x1.png"
  },
  {
    "id": "icon-arrow-up-down-2x2",
    "filePath": "assets/icons/icon-arrow-up-down-2x2.png"
  },
  {
    "id": "icon-arrow-up-down-3x3",
    "filePath": "assets/icons/icon-arrow-up-down-3x3.png"
  },
  {
    "id": "icon-arrow-up-left-1x1",
    "filePath": "assets/icons/icon-arrow-up-left-1x1.png"
  },
  {
    "id": "icon-arrow-up-left-2x2",
    "filePath": "assets/icons/icon-arrow-up-left-2x2.png"
  },
  {
    "id": "icon-arrow-up-left-3x3",
    "filePath": "assets/icons/icon-arrow-up-left-3x3.png"
  },
  {
    "id": "icon-arrow-up-right-1x1",
    "filePath": "assets/icons/icon-arrow-up-right-1x1.png"
  },
  {
    "id": "icon-arrow-up-right-2x2",
    "filePath": "assets/icons/icon-arrow-up-right-2x2.png"
  },
  {
    "id": "icon-arrow-up-right-3x3",
    "filePath": "assets/icons/icon-arrow-up-right-3x3.png"
  },
  {
    "id": "banner-atom-1x2",
    "filePath": "assets2/deco/banner-atom-1x2.png"
  },
  {
    "id": "banner-atom-1x3",
    "filePath": "assets2/deco/banner-atom-1x3.png"
  },
  {
    "id": "banner-atom-1x4",
    "filePath": "assets2/deco/banner-atom-1x4.png"
  },
  {
    "id": "banner-bio-1x2",
    "filePath": "assets2/deco/banner-bio-1x2.png"
  },
  {
    "id": "banner-bio-1x3",
    "filePath": "assets2/deco/banner-bio-1x3.png"
  },
  {
    "id": "banner-bio-1x4",
    "filePath": "assets2/deco/banner-bio-1x4.png"
  },
  {
    "id": "banner-blue-1x2",
    "filePath": "assets2/deco/banner-blue-1x2.png"
  },
  {
    "id": "banner-blue-1x3",
    "filePath": "assets2/deco/banner-blue-1x3.png"
  },
  {
    "id": "banner-blue-1x4",
    "filePath": "assets2/deco/banner-blue-1x4.png"
  },
  {
    "id": "banner-bolt-1x2",
    "filePath": "assets2/deco/banner-bolt-1x2.png"
  },
  {
    "id": "banner-bolt-1x3",
    "filePath": "assets2/deco/banner-bolt-1x3.png"
  },
  {
    "id": "banner-bolt-1x4",
    "filePath": "assets2/deco/banner-bolt-1x4.png"
  },
  {
    "id": "banner-diamond-1x2",
    "filePath": "assets2/deco/banner-diamond-1x2.png"
  },
  {
    "id": "banner-diamond-1x3",
    "filePath": "assets2/deco/banner-diamond-1x3.png"
  },
  {
    "id": "banner-diamond-1x4",
    "filePath": "assets2/deco/banner-diamond-1x4.png"
  },
  {
    "id": "banner-flame-1x2",
    "filePath": "assets2/deco/banner-flame-1x2.png"
  },
  {
    "id": "banner-flame-1x3",
    "filePath": "assets2/deco/banner-flame-1x3.png"
  },
  {
    "id": "banner-flame-1x4",
    "filePath": "assets2/deco/banner-flame-1x4.png"
  },
  {
    "id": "banner-gear-1x2",
    "filePath": "assets2/deco/banner-gear-1x2.png"
  },
  {
    "id": "banner-gear-1x3",
    "filePath": "assets2/deco/banner-gear-1x3.png"
  },
  {
    "id": "banner-gear-1x4",
    "filePath": "assets2/deco/banner-gear-1x4.png"
  },
  {
    "id": "banner-green-1x2",
    "filePath": "assets2/deco/banner-green-1x2.png"
  },
  {
    "id": "banner-green-1x3",
    "filePath": "assets2/deco/banner-green-1x3.png"
  },
  {
    "id": "banner-green-1x4",
    "filePath": "assets2/deco/banner-green-1x4.png"
  },
  {
    "id": "banner-red-1x2",
    "filePath": "assets2/deco/banner-red-1x2.png"
  },
  {
    "id": "banner-red-1x3",
    "filePath": "assets2/deco/banner-red-1x3.png"
  },
  {
    "id": "banner-red-1x4",
    "filePath": "assets2/deco/banner-red-1x4.png"
  },
  {
    "id": "banner-skull-1x2",
    "filePath": "assets2/deco/banner-skull-1x2.png"
  },
  {
    "id": "banner-skull-1x3",
    "filePath": "assets2/deco/banner-skull-1x3.png"
  },
  {
    "id": "banner-skull-1x4",
    "filePath": "assets2/deco/banner-skull-1x4.png"
  },
  {
    "id": "banner-spore-1x2",
    "filePath": "assets2/deco/banner-spore-1x2.png"
  },
  {
    "id": "banner-spore-1x3",
    "filePath": "assets2/deco/banner-spore-1x3.png"
  },
  {
    "id": "banner-spore-1x4",
    "filePath": "assets2/deco/banner-spore-1x4.png"
  },
  {
    "id": "banner-star-1x2",
    "filePath": "assets2/deco/banner-star-1x2.png"
  },
  {
    "id": "banner-star-1x3",
    "filePath": "assets2/deco/banner-star-1x3.png"
  },
  {
    "id": "banner-star-1x4",
    "filePath": "assets2/deco/banner-star-1x4.png"
  },
  {
    "id": "banner-tech-1x2",
    "filePath": "assets2/deco/banner-tech-1x2.png"
  },
  {
    "id": "banner-tech-1x3",
    "filePath": "assets2/deco/banner-tech-1x3.png"
  },
  {
    "id": "banner-tech-1x4",
    "filePath": "assets2/deco/banner-tech-1x4.png"
  },
  {
    "id": "banner-warning-1x2",
    "filePath": "assets2/deco/banner-warning-1x2.png"
  },
  {
    "id": "banner-warning-1x3",
    "filePath": "assets2/deco/banner-warning-1x3.png"
  },
  {
    "id": "banner-warning-1x4",
    "filePath": "assets2/deco/banner-warning-1x4.png"
  },
  {
    "id": "banner-wave-1x2",
    "filePath": "assets2/deco/banner-wave-1x2.png"
  },
  {
    "id": "banner-wave-1x3",
    "filePath": "assets2/deco/banner-wave-1x3.png"
  },
  {
    "id": "banner-wave-1x4",
    "filePath": "assets2/deco/banner-wave-1x4.png"
  },
  {
    "id": "beacon-alert-1x1",
    "filePath": "assets2/deco/beacon-alert-1x1.png"
  },
  {
    "id": "beacon-alert-1x2",
    "filePath": "assets2/deco/beacon-alert-1x2.png"
  },
  {
    "id": "beacon-alert-1x3",
    "filePath": "assets2/deco/beacon-alert-1x3.png"
  },
  {
    "id": "beacon-amber-1x1",
    "filePath": "assets2/deco/beacon-amber-1x1.png"
  },
  {
    "id": "beacon-amber-1x2",
    "filePath": "assets2/deco/beacon-amber-1x2.png"
  },
  {
    "id": "beacon-amber-1x3",
    "filePath": "assets2/deco/beacon-amber-1x3.png"
  },
  {
    "id": "beacon-bio-1x1",
    "filePath": "assets2/deco/beacon-bio-1x1.png"
  },
  {
    "id": "beacon-bio-1x2",
    "filePath": "assets2/deco/beacon-bio-1x2.png"
  },
  {
    "id": "beacon-bio-1x3",
    "filePath": "assets2/deco/beacon-bio-1x3.png"
  },
  {
    "id": "beacon-cyan-1x1",
    "filePath": "assets2/deco/beacon-cyan-1x1.png"
  },
  {
    "id": "beacon-cyan-1x2",
    "filePath": "assets2/deco/beacon-cyan-1x2.png"
  },
  {
    "id": "beacon-cyan-1x3",
    "filePath": "assets2/deco/beacon-cyan-1x3.png"
  },
  {
    "id": "beacon-ice-1x1",
    "filePath": "assets2/deco/beacon-ice-1x1.png"
  },
  {
    "id": "beacon-ice-1x2",
    "filePath": "assets2/deco/beacon-ice-1x2.png"
  },
  {
    "id": "beacon-ice-1x3",
    "filePath": "assets2/deco/beacon-ice-1x3.png"
  },
  {
    "id": "beacon-moth-1x1",
    "filePath": "assets2/deco/beacon-moth-1x1.png"
  },
  {
    "id": "beacon-moth-1x2",
    "filePath": "assets2/deco/beacon-moth-1x2.png"
  },
  {
    "id": "beacon-moth-1x3",
    "filePath": "assets2/deco/beacon-moth-1x3.png"
  },
  {
    "id": "beacon-rainbow-1x1",
    "filePath": "assets2/deco/beacon-rainbow-1x1.png"
  },
  {
    "id": "beacon-rainbow-1x2",
    "filePath": "assets2/deco/beacon-rainbow-1x2.png"
  },
  {
    "id": "beacon-rainbow-1x3",
    "filePath": "assets2/deco/beacon-rainbow-1x3.png"
  },
  {
    "id": "beacon-spore-1x1",
    "filePath": "assets2/deco/beacon-spore-1x1.png"
  },
  {
    "id": "beacon-spore-1x2",
    "filePath": "assets2/deco/beacon-spore-1x2.png"
  },
  {
    "id": "beacon-spore-1x3",
    "filePath": "assets2/deco/beacon-spore-1x3.png"
  },
  {
    "id": "beacon-strobe-1x1",
    "filePath": "assets2/deco/beacon-strobe-1x1.png"
  },
  {
    "id": "beacon-strobe-1x2",
    "filePath": "assets2/deco/beacon-strobe-1x2.png"
  },
  {
    "id": "beacon-strobe-1x3",
    "filePath": "assets2/deco/beacon-strobe-1x3.png"
  },
  {
    "id": "beacon-torch-1x1",
    "filePath": "assets2/deco/beacon-torch-1x1.png"
  },
  {
    "id": "beacon-torch-1x2",
    "filePath": "assets2/deco/beacon-torch-1x2.png"
  },
  {
    "id": "beacon-torch-1x3",
    "filePath": "assets2/deco/beacon-torch-1x3.png"
  },
  {
    "id": "bg-bio-membrane-1x1",
    "filePath": "assets2/block/bg-bio-membrane-1x1.png"
  },
  {
    "id": "bg-blueprint-1x1",
    "filePath": "assets2/block/bg-blueprint-1x1.png"
  },
  {
    "id": "bg-brick-dark-1x1",
    "filePath": "assets2/block/bg-brick-dark-1x1.png"
  },
  {
    "id": "bg-brick-red-1x1",
    "filePath": "assets2/block/bg-brick-red-1x1.png"
  },
  {
    "id": "bg-brick-white-1x1",
    "filePath": "assets2/block/bg-brick-white-1x1.png"
  },
  {
    "id": "bg-cables-1x1",
    "filePath": "assets2/block/bg-cables-1x1.png"
  },
  {
    "id": "bg-carbon-1x1",
    "filePath": "assets2/block/bg-carbon-1x1.png"
  },
  {
    "id": "bg-circuit-1x1",
    "filePath": "assets2/block/bg-circuit-1x1.png"
  },
  {
    "id": "bg-concrete-1x1",
    "filePath": "assets2/block/bg-concrete-1x1.png"
  },
  {
    "id": "bg-concrete-crack-1x1",
    "filePath": "assets2/block/bg-concrete-crack-1x1.png"
  },
  {
    "id": "bg-corrugated-1x1",
    "filePath": "assets2/block/bg-corrugated-1x1.png"
  },
  {
    "id": "bg-crate-face-1x1",
    "filePath": "assets2/block/bg-crate-face-1x1.png"
  },
  {
    "id": "bg-diamond-plate-1x1",
    "filePath": "assets2/block/bg-diamond-plate-1x1.png"
  },
  {
    "id": "bg-glass-block-1x1",
    "filePath": "assets2/block/bg-glass-block-1x1.png"
  },
  {
    "id": "bg-grime-1x1",
    "filePath": "assets2/block/bg-grime-1x1.png"
  },
  {
    "id": "bg-hex-1x1",
    "filePath": "assets2/block/bg-hex-1x1.png"
  },
  {
    "id": "bg-honeycomb-1x1",
    "filePath": "assets2/block/bg-honeycomb-1x1.png"
  },
  {
    "id": "bg-insulation-1x1",
    "filePath": "assets2/block/bg-insulation-1x1.png"
  },
  {
    "id": "bg-led-grid-1x1",
    "filePath": "assets2/block/bg-led-grid-1x1.png"
  },
  {
    "id": "bg-metal-bronze-1x1",
    "filePath": "assets2/block/bg-metal-bronze-1x1.png"
  },
  {
    "id": "bg-metal-dark-1x1",
    "filePath": "assets2/block/bg-metal-dark-1x1.png"
  },
  {
    "id": "bg-metal-plate-1x1",
    "filePath": "assets2/block/bg-metal-plate-1x1.png"
  },
  {
    "id": "bg-metal-rivet-1x1",
    "filePath": "assets2/block/bg-metal-rivet-1x1.png"
  },
  {
    "id": "bg-neon-1x1",
    "filePath": "assets2/block/bg-neon-1x1.png"
  },
  {
    "id": "bg-padded-1x1",
    "filePath": "assets2/block/bg-padded-1x1.png"
  },
  {
    "id": "bg-panel-screen-1x1",
    "filePath": "assets2/block/bg-panel-screen-1x1.png"
  },
  {
    "id": "bg-panel-steel-1x1",
    "filePath": "assets2/block/bg-panel-steel-1x1.png"
  },
  {
    "id": "bg-panel-warning-1x1",
    "filePath": "assets2/block/bg-panel-warning-1x1.png"
  },
  {
    "id": "bg-pipes-1x1",
    "filePath": "assets2/block/bg-pipes-1x1.png"
  },
  {
    "id": "bg-poster-1x1",
    "filePath": "assets2/block/bg-poster-1x1.png"
  },
  {
    "id": "bg-rust-1x1",
    "filePath": "assets2/block/bg-rust-1x1.png"
  },
  {
    "id": "bg-spore-1x1",
    "filePath": "assets2/block/bg-spore-1x1.png"
  },
  {
    "id": "bg-stars-1x1",
    "filePath": "assets2/block/bg-stars-1x1.png"
  },
  {
    "id": "bg-stone-1x1",
    "filePath": "assets2/block/bg-stone-1x1.png"
  },
  {
    "id": "bg-stripe-hazard-1x1",
    "filePath": "assets2/block/bg-stripe-hazard-1x1.png"
  },
  {
    "id": "bg-stripe-red-1x1",
    "filePath": "assets2/block/bg-stripe-red-1x1.png"
  },
  {
    "id": "bg-tile-green-1x1",
    "filePath": "assets2/block/bg-tile-green-1x1.png"
  },
  {
    "id": "bg-tile-lab-1x1",
    "filePath": "assets2/block/bg-tile-lab-1x1.png"
  },
  {
    "id": "bg-tile-white-1x1",
    "filePath": "assets2/block/bg-tile-white-1x1.png"
  },
  {
    "id": "bg-vent-1x1",
    "filePath": "assets2/block/bg-vent-1x1.png"
  },
  {
    "id": "bg-warning-band-1x1",
    "filePath": "assets2/block/bg-warning-band-1x1.png"
  },
  {
    "id": "bg-window-1x1",
    "filePath": "assets2/block/bg-window-1x1.png"
  },
  {
    "id": "bg-window-bars-1x1",
    "filePath": "assets2/block/bg-window-bars-1x1.png"
  },
  {
    "id": "bg-wood-1x1",
    "filePath": "assets2/block/bg-wood-1x1.png"
  },
  {
    "id": "block-acid-1x1",
    "filePath": "assets2/block/block-acid-1x1.png"
  },
  {
    "id": "block-asphalt-1x1",
    "filePath": "assets2/block/block-asphalt-1x1.png"
  },
  {
    "id": "block-bio-gel-1x1",
    "filePath": "assets2/block/block-bio-gel-1x1.png"
  },
  {
    "id": "block-brick-1x1",
    "filePath": "assets2/block/block-brick-1x1.png"
  },
  {
    "id": "block-bronze-1x1",
    "filePath": "assets2/block/block-bronze-1x1.png"
  },
  {
    "id": "block-carbon-1x1",
    "filePath": "assets2/block/block-carbon-1x1.png"
  },
  {
    "id": "block-ceramic-1x1",
    "filePath": "assets2/block/block-ceramic-1x1.png"
  },
  {
    "id": "block-checker-1x1",
    "filePath": "assets2/block/block-checker-1x1.png"
  },
  {
    "id": "block-circuit-1x1",
    "filePath": "assets2/block/block-circuit-1x1.png"
  },
  {
    "id": "block-cobble-1x1",
    "filePath": "assets2/block/block-cobble-1x1.png"
  },
  {
    "id": "block-concrete-1x1",
    "filePath": "assets2/block/block-concrete-1x1.png"
  },
  {
    "id": "block-copper-1x1",
    "filePath": "assets2/block/block-copper-1x1.png"
  },
  {
    "id": "block-crystal-1x1",
    "filePath": "assets2/block/block-crystal-1x1.png"
  },
  {
    "id": "block-diamond-1x1",
    "filePath": "assets2/block/block-diamond-1x1.png"
  },
  {
    "id": "block-dirt-1x1",
    "filePath": "assets2/block/block-dirt-1x1.png"
  },
  {
    "id": "block-glass-1x1",
    "filePath": "assets2/block/block-glass-1x1.png"
  },
  {
    "id": "block-gold-1x1",
    "filePath": "assets2/block/block-gold-1x1.png"
  },
  {
    "id": "block-grass-1x1",
    "filePath": "assets2/block/block-grass-1x1.png"
  },
  {
    "id": "block-grate-1x1",
    "filePath": "assets2/block/block-grate-1x1.png"
  },
  {
    "id": "block-gravel-1x1",
    "filePath": "assets2/block/block-gravel-1x1.png"
  },
  {
    "id": "block-hazard-1x1",
    "filePath": "assets2/block/block-hazard-1x1.png"
  },
  {
    "id": "block-hex-1x1",
    "filePath": "assets2/block/block-hex-1x1.png"
  },
  {
    "id": "block-ice-1x1",
    "filePath": "assets2/block/block-ice-1x1.png"
  },
  {
    "id": "block-lava-1x1",
    "filePath": "assets2/block/block-lava-1x1.png"
  },
  {
    "id": "block-marble-1x1",
    "filePath": "assets2/block/block-marble-1x1.png"
  },
  {
    "id": "block-mesh-1x1",
    "filePath": "assets2/block/block-mesh-1x1.png"
  },
  {
    "id": "block-moss-1x1",
    "filePath": "assets2/block/block-moss-1x1.png"
  },
  {
    "id": "block-obsidian-1x1",
    "filePath": "assets2/block/block-obsidian-1x1.png"
  },
  {
    "id": "block-padded-1x1",
    "filePath": "assets2/block/block-padded-1x1.png"
  },
  {
    "id": "block-plasma-1x1",
    "filePath": "assets2/block/block-plasma-1x1.png"
  },
  {
    "id": "block-rubber-1x1",
    "filePath": "assets2/block/block-rubber-1x1.png"
  },
  {
    "id": "block-rust-1x1",
    "filePath": "assets2/block/block-rust-1x1.png"
  },
  {
    "id": "block-sand-1x1",
    "filePath": "assets2/block/block-sand-1x1.png"
  },
  {
    "id": "block-snow-1x1",
    "filePath": "assets2/block/block-snow-1x1.png"
  },
  {
    "id": "block-solar-1x1",
    "filePath": "assets2/block/block-solar-1x1.png"
  },
  {
    "id": "block-steel-1x1",
    "filePath": "assets2/block/block-steel-1x1.png"
  },
  {
    "id": "block-steel-lite-1x1",
    "filePath": "assets2/block/block-steel-lite-1x1.png"
  },
  {
    "id": "block-tech-1x1",
    "filePath": "assets2/block/block-tech-1x1.png"
  },
  {
    "id": "block-vent-1x1",
    "filePath": "assets2/block/block-vent-1x1.png"
  },
  {
    "id": "block-void-1x1",
    "filePath": "assets2/block/block-void-1x1.png"
  },
  {
    "id": "block-warning-1x1",
    "filePath": "assets2/block/block-warning-1x1.png"
  },
  {
    "id": "block-water-1x1",
    "filePath": "assets2/block/block-water-1x1.png"
  },
  {
    "id": "block-wood-1x1",
    "filePath": "assets2/block/block-wood-1x1.png"
  },
  {
    "id": "bot-farm-1x1",
    "filePath": "assets2/deco/bot-farm-1x1.png"
  },
  {
    "id": "bot-farm-2x2",
    "filePath": "assets2/deco/bot-farm-2x2.png"
  },
  {
    "id": "bot-farm-3x3",
    "filePath": "assets2/deco/bot-farm-3x3.png"
  },
  {
    "id": "bot-haul-1x1",
    "filePath": "assets2/deco/bot-haul-1x1.png"
  },
  {
    "id": "bot-haul-2x2",
    "filePath": "assets2/deco/bot-haul-2x2.png"
  },
  {
    "id": "bot-haul-3x3",
    "filePath": "assets2/deco/bot-haul-3x3.png"
  },
  {
    "id": "bot-king-1x1",
    "filePath": "assets2/deco/bot-king-1x1.png"
  },
  {
    "id": "bot-king-2x2",
    "filePath": "assets2/deco/bot-king-2x2.png"
  },
  {
    "id": "bot-king-3x3",
    "filePath": "assets2/deco/bot-king-3x3.png"
  },
  {
    "id": "bot-medic-1x1",
    "filePath": "assets2/deco/bot-medic-1x1.png"
  },
  {
    "id": "bot-medic-2x2",
    "filePath": "assets2/deco/bot-medic-2x2.png"
  },
  {
    "id": "bot-medic-3x3",
    "filePath": "assets2/deco/bot-medic-3x3.png"
  },
  {
    "id": "bot-mine-1x1",
    "filePath": "assets2/deco/bot-mine-1x1.png"
  },
  {
    "id": "bot-mine-2x2",
    "filePath": "assets2/deco/bot-mine-2x2.png"
  },
  {
    "id": "bot-mine-3x3",
    "filePath": "assets2/deco/bot-mine-3x3.png"
  },
  {
    "id": "bot-pet-1x1",
    "filePath": "assets2/deco/bot-pet-1x1.png"
  },
  {
    "id": "bot-pet-2x2",
    "filePath": "assets2/deco/bot-pet-2x2.png"
  },
  {
    "id": "bot-pet-3x3",
    "filePath": "assets2/deco/bot-pet-3x3.png"
  },
  {
    "id": "bot-scan-1x1",
    "filePath": "assets2/deco/bot-scan-1x1.png"
  },
  {
    "id": "bot-scan-2x2",
    "filePath": "assets2/deco/bot-scan-2x2.png"
  },
  {
    "id": "bot-scan-3x3",
    "filePath": "assets2/deco/bot-scan-3x3.png"
  },
  {
    "id": "bot-sentry-1x1",
    "filePath": "assets2/deco/bot-sentry-1x1.png"
  },
  {
    "id": "bot-sentry-2x2",
    "filePath": "assets2/deco/bot-sentry-2x2.png"
  },
  {
    "id": "bot-sentry-3x3",
    "filePath": "assets2/deco/bot-sentry-3x3.png"
  },
  {
    "id": "bot-water-1x1",
    "filePath": "assets2/deco/bot-water-1x1.png"
  },
  {
    "id": "bot-water-2x2",
    "filePath": "assets2/deco/bot-water-2x2.png"
  },
  {
    "id": "bot-water-3x3",
    "filePath": "assets2/deco/bot-water-3x3.png"
  },
  {
    "id": "bot-weld-1x1",
    "filePath": "assets2/deco/bot-weld-1x1.png"
  },
  {
    "id": "bot-weld-2x2",
    "filePath": "assets2/deco/bot-weld-2x2.png"
  },
  {
    "id": "bot-weld-3x3",
    "filePath": "assets2/deco/bot-weld-3x3.png"
  },
  {
    "id": "char-0-1x1",
    "filePath": "assets/icons/char-0-1x1.png"
  },
  {
    "id": "char-0-2x2",
    "filePath": "assets/icons/char-0-2x2.png"
  },
  {
    "id": "char-1-1x1",
    "filePath": "assets/icons/char-1-1x1.png"
  },
  {
    "id": "char-1-2x2",
    "filePath": "assets/icons/char-1-2x2.png"
  },
  {
    "id": "char-2-1x1",
    "filePath": "assets/icons/char-2-1x1.png"
  },
  {
    "id": "char-2-2x2",
    "filePath": "assets/icons/char-2-2x2.png"
  },
  {
    "id": "char-3-1x1",
    "filePath": "assets/icons/char-3-1x1.png"
  },
  {
    "id": "char-3-2x2",
    "filePath": "assets/icons/char-3-2x2.png"
  },
  {
    "id": "char-4-1x1",
    "filePath": "assets/icons/char-4-1x1.png"
  },
  {
    "id": "char-4-2x2",
    "filePath": "assets/icons/char-4-2x2.png"
  },
  {
    "id": "char-5-1x1",
    "filePath": "assets/icons/char-5-1x1.png"
  },
  {
    "id": "char-5-2x2",
    "filePath": "assets/icons/char-5-2x2.png"
  },
  {
    "id": "char-6-1x1",
    "filePath": "assets/icons/char-6-1x1.png"
  },
  {
    "id": "char-6-2x2",
    "filePath": "assets/icons/char-6-2x2.png"
  },
  {
    "id": "char-7-1x1",
    "filePath": "assets/icons/char-7-1x1.png"
  },
  {
    "id": "char-7-2x2",
    "filePath": "assets/icons/char-7-2x2.png"
  },
  {
    "id": "char-8-1x1",
    "filePath": "assets/icons/char-8-1x1.png"
  },
  {
    "id": "char-8-2x2",
    "filePath": "assets/icons/char-8-2x2.png"
  },
  {
    "id": "char-9-1x1",
    "filePath": "assets/icons/char-9-1x1.png"
  },
  {
    "id": "char-9-2x2",
    "filePath": "assets/icons/char-9-2x2.png"
  },
  {
    "id": "char-A-1x1",
    "filePath": "assets/icons/char-A-1x1.png"
  },
  {
    "id": "char-A-2x2",
    "filePath": "assets/icons/char-A-2x2.png"
  },
  {
    "id": "char-B-1x1",
    "filePath": "assets/icons/char-B-1x1.png"
  },
  {
    "id": "char-B-2x2",
    "filePath": "assets/icons/char-B-2x2.png"
  },
  {
    "id": "char-C-1x1",
    "filePath": "assets/icons/char-C-1x1.png"
  },
  {
    "id": "char-C-2x2",
    "filePath": "assets/icons/char-C-2x2.png"
  },
  {
    "id": "char-D-1x1",
    "filePath": "assets/icons/char-D-1x1.png"
  },
  {
    "id": "char-D-2x2",
    "filePath": "assets/icons/char-D-2x2.png"
  },
  {
    "id": "char-E-1x1",
    "filePath": "assets/icons/char-E-1x1.png"
  },
  {
    "id": "char-E-2x2",
    "filePath": "assets/icons/char-E-2x2.png"
  },
  {
    "id": "char-F-1x1",
    "filePath": "assets/icons/char-F-1x1.png"
  },
  {
    "id": "char-F-2x2",
    "filePath": "assets/icons/char-F-2x2.png"
  },
  {
    "id": "char-G-1x1",
    "filePath": "assets/icons/char-G-1x1.png"
  },
  {
    "id": "char-G-2x2",
    "filePath": "assets/icons/char-G-2x2.png"
  },
  {
    "id": "char-H-1x1",
    "filePath": "assets/icons/char-H-1x1.png"
  },
  {
    "id": "char-H-2x2",
    "filePath": "assets/icons/char-H-2x2.png"
  },
  {
    "id": "char-I-1x1",
    "filePath": "assets/icons/char-I-1x1.png"
  },
  {
    "id": "char-I-2x2",
    "filePath": "assets/icons/char-I-2x2.png"
  },
  {
    "id": "char-J-1x1",
    "filePath": "assets/icons/char-J-1x1.png"
  },
  {
    "id": "char-J-2x2",
    "filePath": "assets/icons/char-J-2x2.png"
  },
  {
    "id": "char-K-1x1",
    "filePath": "assets/icons/char-K-1x1.png"
  },
  {
    "id": "char-K-2x2",
    "filePath": "assets/icons/char-K-2x2.png"
  },
  {
    "id": "char-L-1x1",
    "filePath": "assets/icons/char-L-1x1.png"
  },
  {
    "id": "char-L-2x2",
    "filePath": "assets/icons/char-L-2x2.png"
  },
  {
    "id": "char-M-1x1",
    "filePath": "assets/icons/char-M-1x1.png"
  },
  {
    "id": "char-M-2x2",
    "filePath": "assets/icons/char-M-2x2.png"
  },
  {
    "id": "char-N-1x1",
    "filePath": "assets/icons/char-N-1x1.png"
  },
  {
    "id": "char-N-2x2",
    "filePath": "assets/icons/char-N-2x2.png"
  },
  {
    "id": "char-O-1x1",
    "filePath": "assets/icons/char-O-1x1.png"
  },
  {
    "id": "char-O-2x2",
    "filePath": "assets/icons/char-O-2x2.png"
  },
  {
    "id": "char-P-1x1",
    "filePath": "assets/icons/char-P-1x1.png"
  },
  {
    "id": "char-P-2x2",
    "filePath": "assets/icons/char-P-2x2.png"
  },
  {
    "id": "char-Q-1x1",
    "filePath": "assets/icons/char-Q-1x1.png"
  },
  {
    "id": "char-Q-2x2",
    "filePath": "assets/icons/char-Q-2x2.png"
  },
  {
    "id": "char-R-1x1",
    "filePath": "assets/icons/char-R-1x1.png"
  },
  {
    "id": "char-R-2x2",
    "filePath": "assets/icons/char-R-2x2.png"
  },
  {
    "id": "char-S-1x1",
    "filePath": "assets/icons/char-S-1x1.png"
  },
  {
    "id": "char-S-2x2",
    "filePath": "assets/icons/char-S-2x2.png"
  },
  {
    "id": "char-sym-amp-1x1",
    "filePath": "assets/icons/char-sym-amp-1x1.png"
  },
  {
    "id": "char-sym-at-1x1",
    "filePath": "assets/icons/char-sym-at-1x1.png"
  },
  {
    "id": "char-sym-brace-l-1x1",
    "filePath": "assets/icons/char-sym-brace-l-1x1.png"
  },
  {
    "id": "char-sym-brace-r-1x1",
    "filePath": "assets/icons/char-sym-brace-r-1x1.png"
  },
  {
    "id": "char-sym-bslash-1x1",
    "filePath": "assets/icons/char-sym-bslash-1x1.png"
  },
  {
    "id": "char-sym-caret-1x1",
    "filePath": "assets/icons/char-sym-caret-1x1.png"
  },
  {
    "id": "char-sym-colon-1x1",
    "filePath": "assets/icons/char-sym-colon-1x1.png"
  },
  {
    "id": "char-sym-comma-1x1",
    "filePath": "assets/icons/char-sym-comma-1x1.png"
  },
  {
    "id": "char-sym-dollar-1x1",
    "filePath": "assets/icons/char-sym-dollar-1x1.png"
  },
  {
    "id": "char-sym-dot-1x1",
    "filePath": "assets/icons/char-sym-dot-1x1.png"
  },
  {
    "id": "char-sym-eq-1x1",
    "filePath": "assets/icons/char-sym-eq-1x1.png"
  },
  {
    "id": "char-sym-excl-1x1",
    "filePath": "assets/icons/char-sym-excl-1x1.png"
  },
  {
    "id": "char-sym-gt-1x1",
    "filePath": "assets/icons/char-sym-gt-1x1.png"
  },
  {
    "id": "char-sym-hash-1x1",
    "filePath": "assets/icons/char-sym-hash-1x1.png"
  },
  {
    "id": "char-sym-lbracket-1x1",
    "filePath": "assets/icons/char-sym-lbracket-1x1.png"
  },
  {
    "id": "char-sym-lparen-1x1",
    "filePath": "assets/icons/char-sym-lparen-1x1.png"
  },
  {
    "id": "char-sym-lt-1x1",
    "filePath": "assets/icons/char-sym-lt-1x1.png"
  },
  {
    "id": "char-sym-minus-1x1",
    "filePath": "assets/icons/char-sym-minus-1x1.png"
  },
  {
    "id": "char-sym-pct-1x1",
    "filePath": "assets/icons/char-sym-pct-1x1.png"
  },
  {
    "id": "char-sym-pipe-1x1",
    "filePath": "assets/icons/char-sym-pipe-1x1.png"
  },
  {
    "id": "char-sym-plus-1x1",
    "filePath": "assets/icons/char-sym-plus-1x1.png"
  },
  {
    "id": "char-sym-quest-1x1",
    "filePath": "assets/icons/char-sym-quest-1x1.png"
  },
  {
    "id": "char-sym-quote-1x1",
    "filePath": "assets/icons/char-sym-quote-1x1.png"
  },
  {
    "id": "char-sym-rbracket-1x1",
    "filePath": "assets/icons/char-sym-rbracket-1x1.png"
  },
  {
    "id": "char-sym-rparen-1x1",
    "filePath": "assets/icons/char-sym-rparen-1x1.png"
  },
  {
    "id": "char-sym-semi-1x1",
    "filePath": "assets/icons/char-sym-semi-1x1.png"
  },
  {
    "id": "char-sym-slash-1x1",
    "filePath": "assets/icons/char-sym-slash-1x1.png"
  },
  {
    "id": "char-sym-star-1x1",
    "filePath": "assets/icons/char-sym-star-1x1.png"
  },
  {
    "id": "char-sym-tilde-1x1",
    "filePath": "assets/icons/char-sym-tilde-1x1.png"
  },
  {
    "id": "char-sym-underscore-1x1",
    "filePath": "assets/icons/char-sym-underscore-1x1.png"
  },
  {
    "id": "char-T-1x1",
    "filePath": "assets/icons/char-T-1x1.png"
  },
  {
    "id": "char-T-2x2",
    "filePath": "assets/icons/char-T-2x2.png"
  },
  {
    "id": "char-U-1x1",
    "filePath": "assets/icons/char-U-1x1.png"
  },
  {
    "id": "char-U-2x2",
    "filePath": "assets/icons/char-U-2x2.png"
  },
  {
    "id": "char-V-1x1",
    "filePath": "assets/icons/char-V-1x1.png"
  },
  {
    "id": "char-V-2x2",
    "filePath": "assets/icons/char-V-2x2.png"
  },
  {
    "id": "char-W-1x1",
    "filePath": "assets/icons/char-W-1x1.png"
  },
  {
    "id": "char-W-2x2",
    "filePath": "assets/icons/char-W-2x2.png"
  },
  {
    "id": "char-X-1x1",
    "filePath": "assets/icons/char-X-1x1.png"
  },
  {
    "id": "char-X-2x2",
    "filePath": "assets/icons/char-X-2x2.png"
  },
  {
    "id": "char-Y-1x1",
    "filePath": "assets/icons/char-Y-1x1.png"
  },
  {
    "id": "char-Y-2x2",
    "filePath": "assets/icons/char-Y-2x2.png"
  },
  {
    "id": "char-Z-1x1",
    "filePath": "assets/icons/char-Z-1x1.png"
  },
  {
    "id": "char-Z-2x2",
    "filePath": "assets/icons/char-Z-2x2.png"
  },
  {
    "id": "emoji-alien-1x1",
    "filePath": "assets2/icons/emoji-alien-1x1.png"
  },
  {
    "id": "emoji-alien-2x2",
    "filePath": "assets2/icons/emoji-alien-2x2.png"
  },
  {
    "id": "emoji-alien-3x3",
    "filePath": "assets2/icons/emoji-alien-3x3.png"
  },
  {
    "id": "emoji-angel-1x1",
    "filePath": "assets2/icons/emoji-angel-1x1.png"
  },
  {
    "id": "emoji-angel-2x2",
    "filePath": "assets2/icons/emoji-angel-2x2.png"
  },
  {
    "id": "emoji-angel-3x3",
    "filePath": "assets2/icons/emoji-angel-3x3.png"
  },
  {
    "id": "emoji-angry-1x1",
    "filePath": "assets2/icons/emoji-angry-1x1.png"
  },
  {
    "id": "emoji-angry-2x2",
    "filePath": "assets2/icons/emoji-angry-2x2.png"
  },
  {
    "id": "emoji-angry-3x3",
    "filePath": "assets2/icons/emoji-angry-3x3.png"
  },
  {
    "id": "emoji-cat-1x1",
    "filePath": "assets2/icons/emoji-cat-1x1.png"
  },
  {
    "id": "emoji-cat-2x2",
    "filePath": "assets2/icons/emoji-cat-2x2.png"
  },
  {
    "id": "emoji-cat-3x3",
    "filePath": "assets2/icons/emoji-cat-3x3.png"
  },
  {
    "id": "emoji-cool-1x1",
    "filePath": "assets2/icons/emoji-cool-1x1.png"
  },
  {
    "id": "emoji-cool-2x2",
    "filePath": "assets2/icons/emoji-cool-2x2.png"
  },
  {
    "id": "emoji-cool-3x3",
    "filePath": "assets2/icons/emoji-cool-3x3.png"
  },
  {
    "id": "emoji-cry-1x1",
    "filePath": "assets2/icons/emoji-cry-1x1.png"
  },
  {
    "id": "emoji-cry-2x2",
    "filePath": "assets2/icons/emoji-cry-2x2.png"
  },
  {
    "id": "emoji-cry-3x3",
    "filePath": "assets2/icons/emoji-cry-3x3.png"
  },
  {
    "id": "emoji-dead-1x1",
    "filePath": "assets2/icons/emoji-dead-1x1.png"
  },
  {
    "id": "emoji-dead-2x2",
    "filePath": "assets2/icons/emoji-dead-2x2.png"
  },
  {
    "id": "emoji-dead-3x3",
    "filePath": "assets2/icons/emoji-dead-3x3.png"
  },
  {
    "id": "emoji-devil-1x1",
    "filePath": "assets2/icons/emoji-devil-1x1.png"
  },
  {
    "id": "emoji-devil-2x2",
    "filePath": "assets2/icons/emoji-devil-2x2.png"
  },
  {
    "id": "emoji-devil-3x3",
    "filePath": "assets2/icons/emoji-devil-3x3.png"
  },
  {
    "id": "emoji-grin-1x1",
    "filePath": "assets2/icons/emoji-grin-1x1.png"
  },
  {
    "id": "emoji-grin-2x2",
    "filePath": "assets2/icons/emoji-grin-2x2.png"
  },
  {
    "id": "emoji-grin-3x3",
    "filePath": "assets2/icons/emoji-grin-3x3.png"
  },
  {
    "id": "emoji-heart-eyes-1x1",
    "filePath": "assets2/icons/emoji-heart-eyes-1x1.png"
  },
  {
    "id": "emoji-heart-eyes-2x2",
    "filePath": "assets2/icons/emoji-heart-eyes-2x2.png"
  },
  {
    "id": "emoji-heart-eyes-3x3",
    "filePath": "assets2/icons/emoji-heart-eyes-3x3.png"
  },
  {
    "id": "emoji-kiss-1x1",
    "filePath": "assets2/icons/emoji-kiss-1x1.png"
  },
  {
    "id": "emoji-kiss-2x2",
    "filePath": "assets2/icons/emoji-kiss-2x2.png"
  },
  {
    "id": "emoji-kiss-3x3",
    "filePath": "assets2/icons/emoji-kiss-3x3.png"
  },
  {
    "id": "emoji-laugh-1x1",
    "filePath": "assets2/icons/emoji-laugh-1x1.png"
  },
  {
    "id": "emoji-laugh-2x2",
    "filePath": "assets2/icons/emoji-laugh-2x2.png"
  },
  {
    "id": "emoji-laugh-3x3",
    "filePath": "assets2/icons/emoji-laugh-3x3.png"
  },
  {
    "id": "emoji-love-1x1",
    "filePath": "assets2/icons/emoji-love-1x1.png"
  },
  {
    "id": "emoji-love-2x2",
    "filePath": "assets2/icons/emoji-love-2x2.png"
  },
  {
    "id": "emoji-love-3x3",
    "filePath": "assets2/icons/emoji-love-3x3.png"
  },
  {
    "id": "emoji-mindblown-1x1",
    "filePath": "assets2/icons/emoji-mindblown-1x1.png"
  },
  {
    "id": "emoji-mindblown-2x2",
    "filePath": "assets2/icons/emoji-mindblown-2x2.png"
  },
  {
    "id": "emoji-mindblown-3x3",
    "filePath": "assets2/icons/emoji-mindblown-3x3.png"
  },
  {
    "id": "emoji-money-1x1",
    "filePath": "assets2/icons/emoji-money-1x1.png"
  },
  {
    "id": "emoji-money-2x2",
    "filePath": "assets2/icons/emoji-money-2x2.png"
  },
  {
    "id": "emoji-money-3x3",
    "filePath": "assets2/icons/emoji-money-3x3.png"
  },
  {
    "id": "emoji-nerd-1x1",
    "filePath": "assets2/icons/emoji-nerd-1x1.png"
  },
  {
    "id": "emoji-nerd-2x2",
    "filePath": "assets2/icons/emoji-nerd-2x2.png"
  },
  {
    "id": "emoji-nerd-3x3",
    "filePath": "assets2/icons/emoji-nerd-3x3.png"
  },
  {
    "id": "emoji-nervous-1x1",
    "filePath": "assets2/icons/emoji-nervous-1x1.png"
  },
  {
    "id": "emoji-nervous-2x2",
    "filePath": "assets2/icons/emoji-nervous-2x2.png"
  },
  {
    "id": "emoji-nervous-3x3",
    "filePath": "assets2/icons/emoji-nervous-3x3.png"
  },
  {
    "id": "emoji-party-1x1",
    "filePath": "assets2/icons/emoji-party-1x1.png"
  },
  {
    "id": "emoji-party-2x2",
    "filePath": "assets2/icons/emoji-party-2x2.png"
  },
  {
    "id": "emoji-party-3x3",
    "filePath": "assets2/icons/emoji-party-3x3.png"
  },
  {
    "id": "emoji-robot-1x1",
    "filePath": "assets2/icons/emoji-robot-1x1.png"
  },
  {
    "id": "emoji-robot-2x2",
    "filePath": "assets2/icons/emoji-robot-2x2.png"
  },
  {
    "id": "emoji-robot-3x3",
    "filePath": "assets2/icons/emoji-robot-3x3.png"
  },
  {
    "id": "emoji-sad-1x1",
    "filePath": "assets2/icons/emoji-sad-1x1.png"
  },
  {
    "id": "emoji-sad-2x2",
    "filePath": "assets2/icons/emoji-sad-2x2.png"
  },
  {
    "id": "emoji-sad-3x3",
    "filePath": "assets2/icons/emoji-sad-3x3.png"
  },
  {
    "id": "emoji-shocked-1x1",
    "filePath": "assets2/icons/emoji-shocked-1x1.png"
  },
  {
    "id": "emoji-shocked-2x2",
    "filePath": "assets2/icons/emoji-shocked-2x2.png"
  },
  {
    "id": "emoji-shocked-3x3",
    "filePath": "assets2/icons/emoji-shocked-3x3.png"
  },
  {
    "id": "emoji-sick-1x1",
    "filePath": "assets2/icons/emoji-sick-1x1.png"
  },
  {
    "id": "emoji-sick-2x2",
    "filePath": "assets2/icons/emoji-sick-2x2.png"
  },
  {
    "id": "emoji-sick-3x3",
    "filePath": "assets2/icons/emoji-sick-3x3.png"
  },
  {
    "id": "emoji-skull-1x1",
    "filePath": "assets2/icons/emoji-skull-1x1.png"
  },
  {
    "id": "emoji-skull-2x2",
    "filePath": "assets2/icons/emoji-skull-2x2.png"
  },
  {
    "id": "emoji-skull-3x3",
    "filePath": "assets2/icons/emoji-skull-3x3.png"
  },
  {
    "id": "emoji-sleepy-1x1",
    "filePath": "assets2/icons/emoji-sleepy-1x1.png"
  },
  {
    "id": "emoji-sleepy-2x2",
    "filePath": "assets2/icons/emoji-sleepy-2x2.png"
  },
  {
    "id": "emoji-sleepy-3x3",
    "filePath": "assets2/icons/emoji-sleepy-3x3.png"
  },
  {
    "id": "emoji-smile-1x1",
    "filePath": "assets2/icons/emoji-smile-1x1.png"
  },
  {
    "id": "emoji-smile-2x2",
    "filePath": "assets2/icons/emoji-smile-2x2.png"
  },
  {
    "id": "emoji-smile-3x3",
    "filePath": "assets2/icons/emoji-smile-3x3.png"
  },
  {
    "id": "emoji-smirk-1x1",
    "filePath": "assets2/icons/emoji-smirk-1x1.png"
  },
  {
    "id": "emoji-smirk-2x2",
    "filePath": "assets2/icons/emoji-smirk-2x2.png"
  },
  {
    "id": "emoji-smirk-3x3",
    "filePath": "assets2/icons/emoji-smirk-3x3.png"
  },
  {
    "id": "emoji-star-eyes-1x1",
    "filePath": "assets2/icons/emoji-star-eyes-1x1.png"
  },
  {
    "id": "emoji-star-eyes-2x2",
    "filePath": "assets2/icons/emoji-star-eyes-2x2.png"
  },
  {
    "id": "emoji-star-eyes-3x3",
    "filePath": "assets2/icons/emoji-star-eyes-3x3.png"
  },
  {
    "id": "emoji-sunglasses-1x1",
    "filePath": "assets2/icons/emoji-sunglasses-1x1.png"
  },
  {
    "id": "emoji-sunglasses-2x2",
    "filePath": "assets2/icons/emoji-sunglasses-2x2.png"
  },
  {
    "id": "emoji-sunglasses-3x3",
    "filePath": "assets2/icons/emoji-sunglasses-3x3.png"
  },
  {
    "id": "emoji-thinking-1x1",
    "filePath": "assets2/icons/emoji-thinking-1x1.png"
  },
  {
    "id": "emoji-thinking-2x2",
    "filePath": "assets2/icons/emoji-thinking-2x2.png"
  },
  {
    "id": "emoji-thinking-3x3",
    "filePath": "assets2/icons/emoji-thinking-3x3.png"
  },
  {
    "id": "emoji-wink-1x1",
    "filePath": "assets2/icons/emoji-wink-1x1.png"
  },
  {
    "id": "emoji-wink-2x2",
    "filePath": "assets2/icons/emoji-wink-2x2.png"
  },
  {
    "id": "emoji-wink-3x3",
    "filePath": "assets2/icons/emoji-wink-3x3.png"
  },
  {
    "id": "fence-amber-1x1",
    "filePath": "assets2/deco/fence-amber-1x1.png"
  },
  {
    "id": "fence-amber-2x1",
    "filePath": "assets2/deco/fence-amber-2x1.png"
  },
  {
    "id": "fence-bio-1x1",
    "filePath": "assets2/deco/fence-bio-1x1.png"
  },
  {
    "id": "fence-cyan-1x1",
    "filePath": "assets2/deco/fence-cyan-1x1.png"
  },
  {
    "id": "fence-ice-1x1",
    "filePath": "assets2/deco/fence-ice-1x1.png"
  },
  {
    "id": "fence-magma-1x1",
    "filePath": "assets2/deco/fence-magma-1x1.png"
  },
  {
    "id": "fence-pink-1x1",
    "filePath": "assets2/deco/fence-pink-1x1.png"
  },
  {
    "id": "fence-red-1x1",
    "filePath": "assets2/deco/fence-red-1x1.png"
  },
  {
    "id": "fence-void-1x1",
    "filePath": "assets2/deco/fence-void-1x1.png"
  },
  {
    "id": "garden-bed-3x2",
    "filePath": "assets/deco/garden-bed-3x2.png"
  },
  {
    "id": "garden-bench-2x1",
    "filePath": "assets/deco/garden-bench-2x1.png"
  },
  {
    "id": "garden-bench-2x2",
    "filePath": "assets/deco/garden-bench-2x2.png"
  },
  {
    "id": "garden-bush-1x1",
    "filePath": "assets/deco/garden-bush-1x1.png"
  },
  {
    "id": "garden-climber-1x2",
    "filePath": "assets/deco/garden-climber-1x2.png"
  },
  {
    "id": "garden-composter-2x2",
    "filePath": "assets/deco/garden-composter-2x2.png"
  },
  {
    "id": "garden-crate-2x2",
    "filePath": "assets/deco/garden-crate-2x2.png"
  },
  {
    "id": "garden-crops-3x2",
    "filePath": "assets/deco/garden-crops-3x2.png"
  },
  {
    "id": "garden-fence-2x1",
    "filePath": "assets/deco/garden-fence-2x1.png"
  },
  {
    "id": "garden-fence-3x2",
    "filePath": "assets/deco/garden-fence-3x2.png"
  },
  {
    "id": "garden-fencepost-1x1",
    "filePath": "assets/deco/garden-fencepost-1x1.png"
  },
  {
    "id": "garden-flower-1x1",
    "filePath": "assets/deco/garden-flower-1x1.png"
  },
  {
    "id": "garden-flowerbed-2x1",
    "filePath": "assets/deco/garden-flowerbed-2x1.png"
  },
  {
    "id": "garden-fountain-1x3",
    "filePath": "assets/deco/garden-fountain-1x3.png"
  },
  {
    "id": "garden-fountain-2x2",
    "filePath": "assets/deco/garden-fountain-2x2.png"
  },
  {
    "id": "garden-fountain-3x3",
    "filePath": "assets/deco/garden-fountain-3x3.png"
  },
  {
    "id": "garden-gazebo-3x3",
    "filePath": "assets/deco/garden-gazebo-3x3.png"
  },
  {
    "id": "garden-greenhouse-3x2",
    "filePath": "assets/deco/garden-greenhouse-3x2.png"
  },
  {
    "id": "garden-greenhouse-3x3",
    "filePath": "assets/deco/garden-greenhouse-3x3.png"
  },
  {
    "id": "garden-greenhouse-4x4",
    "filePath": "assets/deco/garden-greenhouse-4x4.png"
  },
  {
    "id": "garden-hedge-2x1",
    "filePath": "assets/deco/garden-hedge-2x1.png"
  },
  {
    "id": "garden-herbs-1x1",
    "filePath": "assets/deco/garden-herbs-1x1.png"
  },
  {
    "id": "garden-lamp-1x2",
    "filePath": "assets/deco/garden-lamp-1x2.png"
  },
  {
    "id": "garden-lamp-1x3",
    "filePath": "assets/deco/garden-lamp-1x3.png"
  },
  {
    "id": "garden-lantern-1x1",
    "filePath": "assets/deco/garden-lantern-1x1.png"
  },
  {
    "id": "garden-obelisk-1x2",
    "filePath": "assets/deco/garden-obelisk-1x2.png"
  },
  {
    "id": "garden-orchard-3x3",
    "filePath": "assets/deco/garden-orchard-3x3.png"
  },
  {
    "id": "garden-park-4x4",
    "filePath": "assets/deco/garden-park-4x4.png"
  },
  {
    "id": "garden-path-2x1",
    "filePath": "assets/deco/garden-path-2x1.png"
  },
  {
    "id": "garden-patio-4x4",
    "filePath": "assets/deco/garden-patio-4x4.png"
  },
  {
    "id": "garden-pergola-3x2",
    "filePath": "assets/deco/garden-pergola-3x2.png"
  },
  {
    "id": "garden-pond-3x2",
    "filePath": "assets/deco/garden-pond-3x2.png"
  },
  {
    "id": "garden-pond-4x4",
    "filePath": "assets/deco/garden-pond-4x4.png"
  },
  {
    "id": "garden-pot-1x1",
    "filePath": "assets/deco/garden-pot-1x1.png"
  },
  {
    "id": "garden-rock-1x1",
    "filePath": "assets/deco/garden-rock-1x1.png"
  },
  {
    "id": "garden-rows-2x2",
    "filePath": "assets/deco/garden-rows-2x2.png"
  },
  {
    "id": "garden-sapling-1x1",
    "filePath": "assets/deco/garden-sapling-1x1.png"
  },
  {
    "id": "garden-shrubs-2x2",
    "filePath": "assets/deco/garden-shrubs-2x2.png"
  },
  {
    "id": "garden-table-2x2",
    "filePath": "assets/deco/garden-table-2x2.png"
  },
  {
    "id": "garden-tallpot-1x2",
    "filePath": "assets/deco/garden-tallpot-1x2.png"
  },
  {
    "id": "garden-tree-1x2",
    "filePath": "assets/deco/garden-tree-1x2.png"
  },
  {
    "id": "garden-tree-1x3",
    "filePath": "assets/deco/garden-tree-1x3.png"
  },
  {
    "id": "garden-trellis-1x2",
    "filePath": "assets/deco/garden-trellis-1x2.png"
  },
  {
    "id": "garden-trellis-1x3",
    "filePath": "assets/deco/garden-trellis-1x3.png"
  },
  {
    "id": "garden-trough-2x1",
    "filePath": "assets/deco/garden-trough-2x1.png"
  },
  {
    "id": "garden-well-2x2",
    "filePath": "assets/deco/garden-well-2x2.png"
  },
  {
    "id": "gem-amber-1x1",
    "filePath": "assets2/deco/gem-amber-1x1.png"
  },
  {
    "id": "gem-amber-2x2",
    "filePath": "assets2/deco/gem-amber-2x2.png"
  },
  {
    "id": "gem-cyan-1x1",
    "filePath": "assets2/deco/gem-cyan-1x1.png"
  },
  {
    "id": "gem-cyan-2x2",
    "filePath": "assets2/deco/gem-cyan-2x2.png"
  },
  {
    "id": "gem-gold-1x1",
    "filePath": "assets2/deco/gem-gold-1x1.png"
  },
  {
    "id": "gem-gold-2x2",
    "filePath": "assets2/deco/gem-gold-2x2.png"
  },
  {
    "id": "gem-ice-1x1",
    "filePath": "assets2/deco/gem-ice-1x1.png"
  },
  {
    "id": "gem-ice-2x2",
    "filePath": "assets2/deco/gem-ice-2x2.png"
  },
  {
    "id": "gem-leaf-1x1",
    "filePath": "assets2/deco/gem-leaf-1x1.png"
  },
  {
    "id": "gem-leaf-2x2",
    "filePath": "assets2/deco/gem-leaf-2x2.png"
  },
  {
    "id": "gem-rose-1x1",
    "filePath": "assets2/deco/gem-rose-1x1.png"
  },
  {
    "id": "gem-rose-2x2",
    "filePath": "assets2/deco/gem-rose-2x2.png"
  },
  {
    "id": "gem-ruby-1x1",
    "filePath": "assets2/deco/gem-ruby-1x1.png"
  },
  {
    "id": "gem-ruby-2x2",
    "filePath": "assets2/deco/gem-ruby-2x2.png"
  },
  {
    "id": "gem-void-1x1",
    "filePath": "assets2/deco/gem-void-1x1.png"
  },
  {
    "id": "gem-void-2x2",
    "filePath": "assets2/deco/gem-void-2x2.png"
  },
  {
    "id": "glyph-beetle-1x1",
    "filePath": "assets2/deco/glyph-beetle-1x1.png"
  },
  {
    "id": "glyph-beetle-2x2",
    "filePath": "assets2/deco/glyph-beetle-2x2.png"
  },
  {
    "id": "glyph-chip-1x1",
    "filePath": "assets2/deco/glyph-chip-1x1.png"
  },
  {
    "id": "glyph-chip-2x2",
    "filePath": "assets2/deco/glyph-chip-2x2.png"
  },
  {
    "id": "glyph-eye-1x1",
    "filePath": "assets2/deco/glyph-eye-1x1.png"
  },
  {
    "id": "glyph-eye-2x2",
    "filePath": "assets2/deco/glyph-eye-2x2.png"
  },
  {
    "id": "glyph-gate-1x1",
    "filePath": "assets2/deco/glyph-gate-1x1.png"
  },
  {
    "id": "glyph-gate-2x2",
    "filePath": "assets2/deco/glyph-gate-2x2.png"
  },
  {
    "id": "glyph-gear-sun-1x1",
    "filePath": "assets2/deco/glyph-gear-sun-1x1.png"
  },
  {
    "id": "glyph-gear-sun-2x2",
    "filePath": "assets2/deco/glyph-gear-sun-2x2.png"
  },
  {
    "id": "glyph-ladder-1x1",
    "filePath": "assets2/deco/glyph-ladder-1x1.png"
  },
  {
    "id": "glyph-ladder-2x2",
    "filePath": "assets2/deco/glyph-ladder-2x2.png"
  },
  {
    "id": "glyph-mask-1x1",
    "filePath": "assets2/deco/glyph-mask-1x1.png"
  },
  {
    "id": "glyph-mask-2x2",
    "filePath": "assets2/deco/glyph-mask-2x2.png"
  },
  {
    "id": "glyph-mountain-1x1",
    "filePath": "assets2/deco/glyph-mountain-1x1.png"
  },
  {
    "id": "glyph-mountain-2x2",
    "filePath": "assets2/deco/glyph-mountain-2x2.png"
  },
  {
    "id": "glyph-river-1x1",
    "filePath": "assets2/deco/glyph-river-1x1.png"
  },
  {
    "id": "glyph-river-2x2",
    "filePath": "assets2/deco/glyph-river-2x2.png"
  },
  {
    "id": "glyph-scarab-1x1",
    "filePath": "assets2/deco/glyph-scarab-1x1.png"
  },
  {
    "id": "glyph-scarab-2x2",
    "filePath": "assets2/deco/glyph-scarab-2x2.png"
  },
  {
    "id": "glyph-seed-1x1",
    "filePath": "assets2/deco/glyph-seed-1x1.png"
  },
  {
    "id": "glyph-seed-2x2",
    "filePath": "assets2/deco/glyph-seed-2x2.png"
  },
  {
    "id": "glyph-spiral-1x1",
    "filePath": "assets2/deco/glyph-spiral-1x1.png"
  },
  {
    "id": "glyph-spiral-2x2",
    "filePath": "assets2/deco/glyph-spiral-2x2.png"
  },
  {
    "id": "glyph-sun-1x1",
    "filePath": "assets2/deco/glyph-sun-1x1.png"
  },
  {
    "id": "glyph-sun-2x2",
    "filePath": "assets2/deco/glyph-sun-2x2.png"
  },
  {
    "id": "glyph-twin-moon-1x1",
    "filePath": "assets2/deco/glyph-twin-moon-1x1.png"
  },
  {
    "id": "glyph-twin-moon-2x2",
    "filePath": "assets2/deco/glyph-twin-moon-2x2.png"
  },
  {
    "id": "glyph-void-1x1",
    "filePath": "assets2/deco/glyph-void-1x1.png"
  },
  {
    "id": "glyph-void-2x2",
    "filePath": "assets2/deco/glyph-void-2x2.png"
  },
  {
    "id": "glyph-wave-1x1",
    "filePath": "assets2/deco/glyph-wave-1x1.png"
  },
  {
    "id": "glyph-wave-2x2",
    "filePath": "assets2/deco/glyph-wave-2x2.png"
  },
  {
    "id": "hatch-bio-1x2",
    "filePath": "assets2/deco/hatch-bio-1x2.png"
  },
  {
    "id": "hatch-bio-2x2",
    "filePath": "assets2/deco/hatch-bio-2x2.png"
  },
  {
    "id": "hatch-bronze-1x2",
    "filePath": "assets2/deco/hatch-bronze-1x2.png"
  },
  {
    "id": "hatch-bronze-2x2",
    "filePath": "assets2/deco/hatch-bronze-2x2.png"
  },
  {
    "id": "hatch-grate-1x2",
    "filePath": "assets2/deco/hatch-grate-1x2.png"
  },
  {
    "id": "hatch-grate-2x2",
    "filePath": "assets2/deco/hatch-grate-2x2.png"
  },
  {
    "id": "hatch-hazard-1x2",
    "filePath": "assets2/deco/hatch-hazard-1x2.png"
  },
  {
    "id": "hatch-hazard-2x2",
    "filePath": "assets2/deco/hatch-hazard-2x2.png"
  },
  {
    "id": "hatch-ice-1x2",
    "filePath": "assets2/deco/hatch-ice-1x2.png"
  },
  {
    "id": "hatch-ice-2x2",
    "filePath": "assets2/deco/hatch-ice-2x2.png"
  },
  {
    "id": "hatch-round-1x2",
    "filePath": "assets2/deco/hatch-round-1x2.png"
  },
  {
    "id": "hatch-round-2x2",
    "filePath": "assets2/deco/hatch-round-2x2.png"
  },
  {
    "id": "hatch-shutter-1x2",
    "filePath": "assets2/deco/hatch-shutter-1x2.png"
  },
  {
    "id": "hatch-shutter-2x2",
    "filePath": "assets2/deco/hatch-shutter-2x2.png"
  },
  {
    "id": "hatch-temple-1x2",
    "filePath": "assets2/deco/hatch-temple-1x2.png"
  },
  {
    "id": "hatch-temple-2x2",
    "filePath": "assets2/deco/hatch-temple-2x2.png"
  },
  {
    "id": "holo-biome-2x2",
    "filePath": "assets2/deco/holo-biome-2x2.png"
  },
  {
    "id": "holo-biome-3x3",
    "filePath": "assets2/deco/holo-biome-3x3.png"
  },
  {
    "id": "holo-cyan-2x2",
    "filePath": "assets2/deco/holo-cyan-2x2.png"
  },
  {
    "id": "holo-cyan-3x3",
    "filePath": "assets2/deco/holo-cyan-3x3.png"
  },
  {
    "id": "holo-ghost-2x2",
    "filePath": "assets2/deco/holo-ghost-2x2.png"
  },
  {
    "id": "holo-ghost-3x3",
    "filePath": "assets2/deco/holo-ghost-3x3.png"
  },
  {
    "id": "holo-map-2x2",
    "filePath": "assets2/deco/holo-map-2x2.png"
  },
  {
    "id": "holo-map-3x3",
    "filePath": "assets2/deco/holo-map-3x3.png"
  },
  {
    "id": "holo-playback-2x2",
    "filePath": "assets2/deco/holo-playback-2x2.png"
  },
  {
    "id": "holo-playback-3x3",
    "filePath": "assets2/deco/holo-playback-3x3.png"
  },
  {
    "id": "holo-portrait-2x2",
    "filePath": "assets2/deco/holo-portrait-2x2.png"
  },
  {
    "id": "holo-portrait-3x3",
    "filePath": "assets2/deco/holo-portrait-3x3.png"
  },
  {
    "id": "holo-warn-2x2",
    "filePath": "assets2/deco/holo-warn-2x2.png"
  },
  {
    "id": "holo-warn-3x3",
    "filePath": "assets2/deco/holo-warn-3x3.png"
  },
  {
    "id": "holo-waypoint-2x2",
    "filePath": "assets2/deco/holo-waypoint-2x2.png"
  },
  {
    "id": "holo-waypoint-3x3",
    "filePath": "assets2/deco/holo-waypoint-3x3.png"
  },
  {
    "id": "home-bathroom-4x4",
    "filePath": "assets/deco/home-bathroom-4x4.png"
  },
  {
    "id": "home-bathtub-3x2",
    "filePath": "assets/deco/home-bathtub-3x2.png"
  },
  {
    "id": "home-bathtub-3x3",
    "filePath": "assets/deco/home-bathtub-3x3.png"
  },
  {
    "id": "home-bed-2x2",
    "filePath": "assets/deco/home-bed-2x2.png"
  },
  {
    "id": "home-bed-3x2",
    "filePath": "assets/deco/home-bed-3x2.png"
  },
  {
    "id": "home-bed-3x3",
    "filePath": "assets/deco/home-bed-3x3.png"
  },
  {
    "id": "home-bedroom-4x4",
    "filePath": "assets/deco/home-bedroom-4x4.png"
  },
  {
    "id": "home-bench-2x1",
    "filePath": "assets/deco/home-bench-2x1.png"
  },
  {
    "id": "home-bookrow-2x1",
    "filePath": "assets/deco/home-bookrow-2x1.png"
  },
  {
    "id": "home-books-1x1",
    "filePath": "assets/deco/home-books-1x1.png"
  },
  {
    "id": "home-bookshelf-1x3",
    "filePath": "assets/deco/home-bookshelf-1x3.png"
  },
  {
    "id": "home-bookshelf-3x2",
    "filePath": "assets/deco/home-bookshelf-3x2.png"
  },
  {
    "id": "home-bookshelf-3x3",
    "filePath": "assets/deco/home-bookshelf-3x3.png"
  },
  {
    "id": "home-bottle-1x1",
    "filePath": "assets/deco/home-bottle-1x1.png"
  },
  {
    "id": "home-cabinet-1x2",
    "filePath": "assets/deco/home-cabinet-1x2.png"
  },
  {
    "id": "home-chair-2x2",
    "filePath": "assets/deco/home-chair-2x2.png"
  },
  {
    "id": "home-clock-1x1",
    "filePath": "assets/deco/home-clock-1x1.png"
  },
  {
    "id": "home-coatstand-1x2",
    "filePath": "assets/deco/home-coatstand-1x2.png"
  },
  {
    "id": "home-conduit-1x3",
    "filePath": "assets/deco/home-conduit-1x3.png"
  },
  {
    "id": "home-counter-3x2",
    "filePath": "assets/deco/home-counter-3x2.png"
  },
  {
    "id": "home-counter-3x3",
    "filePath": "assets/deco/home-counter-3x3.png"
  },
  {
    "id": "home-cushion-2x1",
    "filePath": "assets/deco/home-cushion-2x1.png"
  },
  {
    "id": "home-desk-3x2",
    "filePath": "assets/deco/home-desk-3x2.png"
  },
  {
    "id": "home-desk-3x3",
    "filePath": "assets/deco/home-desk-3x3.png"
  },
  {
    "id": "home-dining-4x4",
    "filePath": "assets/deco/home-dining-4x4.png"
  },
  {
    "id": "home-fireplace-3x3",
    "filePath": "assets/deco/home-fireplace-3x3.png"
  },
  {
    "id": "home-floorlamp-1x2",
    "filePath": "assets/deco/home-floorlamp-1x2.png"
  },
  {
    "id": "home-fridge-2x2",
    "filePath": "assets/deco/home-fridge-2x2.png"
  },
  {
    "id": "home-kitchen-4x4",
    "filePath": "assets/deco/home-kitchen-4x4.png"
  },
  {
    "id": "home-lamp-1x1",
    "filePath": "assets/deco/home-lamp-1x1.png"
  },
  {
    "id": "home-living-4x4",
    "filePath": "assets/deco/home-living-4x4.png"
  },
  {
    "id": "home-locker-1x3",
    "filePath": "assets/deco/home-locker-1x3.png"
  },
  {
    "id": "home-mirror-1x2",
    "filePath": "assets/deco/home-mirror-1x2.png"
  },
  {
    "id": "home-mug-1x1",
    "filePath": "assets/deco/home-mug-1x1.png"
  },
  {
    "id": "home-nightstand-1x2",
    "filePath": "assets/deco/home-nightstand-1x2.png"
  },
  {
    "id": "home-panel-1x3",
    "filePath": "assets/deco/home-panel-1x3.png"
  },
  {
    "id": "home-patio-4x4",
    "filePath": "assets/deco/home-patio-4x4.png"
  },
  {
    "id": "home-pillow-1x1",
    "filePath": "assets/deco/home-pillow-1x1.png"
  },
  {
    "id": "home-plant-1x1",
    "filePath": "assets/deco/home-plant-1x1.png"
  },
  {
    "id": "home-planter-2x1",
    "filePath": "assets/deco/home-planter-2x1.png"
  },
  {
    "id": "home-radiator-1x2",
    "filePath": "assets/deco/home-radiator-1x2.png"
  },
  {
    "id": "home-radiator-2x1",
    "filePath": "assets/deco/home-radiator-2x1.png"
  },
  {
    "id": "home-shelf-2x1",
    "filePath": "assets/deco/home-shelf-2x1.png"
  },
  {
    "id": "home-sidetable-2x2",
    "filePath": "assets/deco/home-sidetable-2x2.png"
  },
  {
    "id": "home-sink-2x2",
    "filePath": "assets/deco/home-sink-2x2.png"
  },
  {
    "id": "home-sofa-3x2",
    "filePath": "assets/deco/home-sofa-3x2.png"
  },
  {
    "id": "home-sofa-3x3",
    "filePath": "assets/deco/home-sofa-3x3.png"
  },
  {
    "id": "home-soundbar-2x1",
    "filePath": "assets/deco/home-soundbar-2x1.png"
  },
  {
    "id": "home-stool-1x1",
    "filePath": "assets/deco/home-stool-1x1.png"
  },
  {
    "id": "home-stove-2x2",
    "filePath": "assets/deco/home-stove-2x2.png"
  },
  {
    "id": "home-table-3x2",
    "filePath": "assets/deco/home-table-3x2.png"
  },
  {
    "id": "home-table-3x3",
    "filePath": "assets/deco/home-table-3x3.png"
  },
  {
    "id": "home-tallplant-1x2",
    "filePath": "assets/deco/home-tallplant-1x2.png"
  },
  {
    "id": "home-toilet-2x2",
    "filePath": "assets/deco/home-toilet-2x2.png"
  },
  {
    "id": "home-torchere-1x3",
    "filePath": "assets/deco/home-torchere-1x3.png"
  },
  {
    "id": "home-towelrail-2x1",
    "filePath": "assets/deco/home-towelrail-2x1.png"
  },
  {
    "id": "home-tree-1x3",
    "filePath": "assets/deco/home-tree-1x3.png"
  },
  {
    "id": "home-tv-2x2",
    "filePath": "assets/deco/home-tv-2x2.png"
  },
  {
    "id": "home-tv-3x2",
    "filePath": "assets/deco/home-tv-3x2.png"
  },
  {
    "id": "home-vase-1x2",
    "filePath": "assets/deco/home-vase-1x2.png"
  },
  {
    "id": "home-wardrobe-2x2",
    "filePath": "assets/deco/home-wardrobe-2x2.png"
  },
  {
    "id": "home-washer-2x2",
    "filePath": "assets/deco/home-washer-2x2.png"
  },
  {
    "id": "horiz-barrier-2x1",
    "filePath": "assets2/deco/horiz-barrier-2x1.png"
  },
  {
    "id": "horiz-barrier-3x1",
    "filePath": "assets2/deco/horiz-barrier-3x1.png"
  },
  {
    "id": "horiz-barrier-4x1",
    "filePath": "assets2/deco/horiz-barrier-4x1.png"
  },
  {
    "id": "horiz-battery-2x1",
    "filePath": "assets2/deco/horiz-battery-2x1.png"
  },
  {
    "id": "horiz-battery-3x1",
    "filePath": "assets2/deco/horiz-battery-3x1.png"
  },
  {
    "id": "horiz-battery-4x1",
    "filePath": "assets2/deco/horiz-battery-4x1.png"
  },
  {
    "id": "horiz-beam-2x1",
    "filePath": "assets2/deco/horiz-beam-2x1.png"
  },
  {
    "id": "horiz-beam-3x1",
    "filePath": "assets2/deco/horiz-beam-3x1.png"
  },
  {
    "id": "horiz-beam-4x1",
    "filePath": "assets2/deco/horiz-beam-4x1.png"
  },
  {
    "id": "horiz-bed-2x1",
    "filePath": "assets2/deco/horiz-bed-2x1.png"
  },
  {
    "id": "horiz-bed-3x1",
    "filePath": "assets2/deco/horiz-bed-3x1.png"
  },
  {
    "id": "horiz-bed-4x1",
    "filePath": "assets2/deco/horiz-bed-4x1.png"
  },
  {
    "id": "horiz-bench-2x1",
    "filePath": "assets2/deco/horiz-bench-2x1.png"
  },
  {
    "id": "horiz-bench-3x1",
    "filePath": "assets2/deco/horiz-bench-3x1.png"
  },
  {
    "id": "horiz-bench-4x1",
    "filePath": "assets2/deco/horiz-bench-4x1.png"
  },
  {
    "id": "horiz-bumper-2x1",
    "filePath": "assets2/deco/horiz-bumper-2x1.png"
  },
  {
    "id": "horiz-bumper-3x1",
    "filePath": "assets2/deco/horiz-bumper-3x1.png"
  },
  {
    "id": "horiz-bumper-4x1",
    "filePath": "assets2/deco/horiz-bumper-4x1.png"
  },
  {
    "id": "horiz-cables-2x1",
    "filePath": "assets2/deco/horiz-cables-2x1.png"
  },
  {
    "id": "horiz-cables-3x1",
    "filePath": "assets2/deco/horiz-cables-3x1.png"
  },
  {
    "id": "horiz-cables-4x1",
    "filePath": "assets2/deco/horiz-cables-4x1.png"
  },
  {
    "id": "horiz-console-2x1",
    "filePath": "assets2/deco/horiz-console-2x1.png"
  },
  {
    "id": "horiz-console-3x1",
    "filePath": "assets2/deco/horiz-console-3x1.png"
  },
  {
    "id": "horiz-console-4x1",
    "filePath": "assets2/deco/horiz-console-4x1.png"
  },
  {
    "id": "horiz-conveyor-2x1",
    "filePath": "assets2/deco/horiz-conveyor-2x1.png"
  },
  {
    "id": "horiz-conveyor-3x1",
    "filePath": "assets2/deco/horiz-conveyor-3x1.png"
  },
  {
    "id": "horiz-conveyor-4x1",
    "filePath": "assets2/deco/horiz-conveyor-4x1.png"
  },
  {
    "id": "horiz-counter-2x1",
    "filePath": "assets2/deco/horiz-counter-2x1.png"
  },
  {
    "id": "horiz-counter-3x1",
    "filePath": "assets2/deco/horiz-counter-3x1.png"
  },
  {
    "id": "horiz-counter-4x1",
    "filePath": "assets2/deco/horiz-counter-4x1.png"
  },
  {
    "id": "horiz-crates-2x1",
    "filePath": "assets2/deco/horiz-crates-2x1.png"
  },
  {
    "id": "horiz-crates-3x1",
    "filePath": "assets2/deco/horiz-crates-3x1.png"
  },
  {
    "id": "horiz-crates-4x1",
    "filePath": "assets2/deco/horiz-crates-4x1.png"
  },
  {
    "id": "horiz-desk-2x1",
    "filePath": "assets2/deco/horiz-desk-2x1.png"
  },
  {
    "id": "horiz-desk-3x1",
    "filePath": "assets2/deco/horiz-desk-3x1.png"
  },
  {
    "id": "horiz-desk-4x1",
    "filePath": "assets2/deco/horiz-desk-4x1.png"
  },
  {
    "id": "horiz-duct-2x1",
    "filePath": "assets2/deco/horiz-duct-2x1.png"
  },
  {
    "id": "horiz-duct-3x1",
    "filePath": "assets2/deco/horiz-duct-3x1.png"
  },
  {
    "id": "horiz-duct-4x1",
    "filePath": "assets2/deco/horiz-duct-4x1.png"
  },
  {
    "id": "horiz-fence-2x1",
    "filePath": "assets2/deco/horiz-fence-2x1.png"
  },
  {
    "id": "horiz-fence-3x1",
    "filePath": "assets2/deco/horiz-fence-3x1.png"
  },
  {
    "id": "horiz-fence-4x1",
    "filePath": "assets2/deco/horiz-fence-4x1.png"
  },
  {
    "id": "horiz-garden-2x1",
    "filePath": "assets2/deco/horiz-garden-2x1.png"
  },
  {
    "id": "horiz-garden-3x1",
    "filePath": "assets2/deco/horiz-garden-3x1.png"
  },
  {
    "id": "horiz-garden-4x1",
    "filePath": "assets2/deco/horiz-garden-4x1.png"
  },
  {
    "id": "horiz-keyboard-2x1",
    "filePath": "assets2/deco/horiz-keyboard-2x1.png"
  },
  {
    "id": "horiz-keyboard-3x1",
    "filePath": "assets2/deco/horiz-keyboard-3x1.png"
  },
  {
    "id": "horiz-keyboard-4x1",
    "filePath": "assets2/deco/horiz-keyboard-4x1.png"
  },
  {
    "id": "horiz-lab-bench-2x1",
    "filePath": "assets2/deco/horiz-lab-bench-2x1.png"
  },
  {
    "id": "horiz-lab-bench-3x1",
    "filePath": "assets2/deco/horiz-lab-bench-3x1.png"
  },
  {
    "id": "horiz-lab-bench-4x1",
    "filePath": "assets2/deco/horiz-lab-bench-4x1.png"
  },
  {
    "id": "horiz-low-wall-2x1",
    "filePath": "assets2/deco/horiz-low-wall-2x1.png"
  },
  {
    "id": "horiz-low-wall-3x1",
    "filePath": "assets2/deco/horiz-low-wall-3x1.png"
  },
  {
    "id": "horiz-low-wall-4x1",
    "filePath": "assets2/deco/horiz-low-wall-4x1.png"
  },
  {
    "id": "horiz-pallet-2x1",
    "filePath": "assets2/deco/horiz-pallet-2x1.png"
  },
  {
    "id": "horiz-pallet-3x1",
    "filePath": "assets2/deco/horiz-pallet-3x1.png"
  },
  {
    "id": "horiz-pallet-4x1",
    "filePath": "assets2/deco/horiz-pallet-4x1.png"
  },
  {
    "id": "horiz-panel-2x1",
    "filePath": "assets2/deco/horiz-panel-2x1.png"
  },
  {
    "id": "horiz-panel-3x1",
    "filePath": "assets2/deco/horiz-panel-3x1.png"
  },
  {
    "id": "horiz-panel-4x1",
    "filePath": "assets2/deco/horiz-panel-4x1.png"
  },
  {
    "id": "horiz-pipe-2x1",
    "filePath": "assets2/deco/horiz-pipe-2x1.png"
  },
  {
    "id": "horiz-pipe-3x1",
    "filePath": "assets2/deco/horiz-pipe-3x1.png"
  },
  {
    "id": "horiz-pipe-4x1",
    "filePath": "assets2/deco/horiz-pipe-4x1.png"
  },
  {
    "id": "horiz-planter-2x1",
    "filePath": "assets2/deco/horiz-planter-2x1.png"
  },
  {
    "id": "horiz-planter-3x1",
    "filePath": "assets2/deco/horiz-planter-3x1.png"
  },
  {
    "id": "horiz-planter-4x1",
    "filePath": "assets2/deco/horiz-planter-4x1.png"
  },
  {
    "id": "horiz-rail-2x1",
    "filePath": "assets2/deco/horiz-rail-2x1.png"
  },
  {
    "id": "horiz-rail-3x1",
    "filePath": "assets2/deco/horiz-rail-3x1.png"
  },
  {
    "id": "horiz-rail-4x1",
    "filePath": "assets2/deco/horiz-rail-4x1.png"
  },
  {
    "id": "horiz-shelf-2x1",
    "filePath": "assets2/deco/horiz-shelf-2x1.png"
  },
  {
    "id": "horiz-shelf-3x1",
    "filePath": "assets2/deco/horiz-shelf-3x1.png"
  },
  {
    "id": "horiz-shelf-4x1",
    "filePath": "assets2/deco/horiz-shelf-4x1.png"
  },
  {
    "id": "horiz-sofa-2x1",
    "filePath": "assets2/deco/horiz-sofa-2x1.png"
  },
  {
    "id": "horiz-sofa-3x1",
    "filePath": "assets2/deco/horiz-sofa-3x1.png"
  },
  {
    "id": "horiz-sofa-4x1",
    "filePath": "assets2/deco/horiz-sofa-4x1.png"
  },
  {
    "id": "horiz-solar-2x1",
    "filePath": "assets2/deco/horiz-solar-2x1.png"
  },
  {
    "id": "horiz-solar-3x1",
    "filePath": "assets2/deco/horiz-solar-3x1.png"
  },
  {
    "id": "horiz-solar-4x1",
    "filePath": "assets2/deco/horiz-solar-4x1.png"
  },
  {
    "id": "horiz-table-2x1",
    "filePath": "assets2/deco/horiz-table-2x1.png"
  },
  {
    "id": "horiz-table-3x1",
    "filePath": "assets2/deco/horiz-table-3x1.png"
  },
  {
    "id": "horiz-table-4x1",
    "filePath": "assets2/deco/horiz-table-4x1.png"
  },
  {
    "id": "horiz-tank-2x1",
    "filePath": "assets2/deco/horiz-tank-2x1.png"
  },
  {
    "id": "horiz-tank-3x1",
    "filePath": "assets2/deco/horiz-tank-3x1.png"
  },
  {
    "id": "horiz-tank-4x1",
    "filePath": "assets2/deco/horiz-tank-4x1.png"
  },
  {
    "id": "horiz-vent-2x1",
    "filePath": "assets2/deco/horiz-vent-2x1.png"
  },
  {
    "id": "horiz-vent-3x1",
    "filePath": "assets2/deco/horiz-vent-3x1.png"
  },
  {
    "id": "horiz-vent-4x1",
    "filePath": "assets2/deco/horiz-vent-4x1.png"
  },
  {
    "id": "icon-air-3x3",
    "filePath": "assets/icons/icon-air-3x3.png"
  },
  {
    "id": "icon-alien-1x1",
    "filePath": "assets/icons/icon-alien-1x1.png"
  },
  {
    "id": "icon-alien-2x2",
    "filePath": "assets/icons/icon-alien-2x2.png"
  },
  {
    "id": "icon-alien-3x3",
    "filePath": "assets/icons/icon-alien-3x3.png"
  },
  {
    "id": "icon-anchor-1x1",
    "filePath": "assets/icons/icon-anchor-1x1.png"
  },
  {
    "id": "icon-anchor-2x2",
    "filePath": "assets/icons/icon-anchor-2x2.png"
  },
  {
    "id": "icon-anchor-3x3",
    "filePath": "assets/icons/icon-anchor-3x3.png"
  },
  {
    "id": "icon-atom-2x2",
    "filePath": "assets/icons/icon-atom-2x2.png"
  },
  {
    "id": "icon-bag-1x1",
    "filePath": "assets/icons/icon-bag-1x1.png"
  },
  {
    "id": "icon-battery-2x2",
    "filePath": "assets/icons/icon-battery-2x2.png"
  },
  {
    "id": "icon-bell-1x1",
    "filePath": "assets/icons/icon-bell-1x1.png"
  },
  {
    "id": "icon-bio-3x3",
    "filePath": "assets/icons/icon-bio-3x3.png"
  },
  {
    "id": "icon-bird-1x1",
    "filePath": "assets/icons/icon-bird-1x1.png"
  },
  {
    "id": "icon-bird-2x2",
    "filePath": "assets/icons/icon-bird-2x2.png"
  },
  {
    "id": "icon-bird-3x3",
    "filePath": "assets/icons/icon-bird-3x3.png"
  },
  {
    "id": "icon-blueprint-3x3",
    "filePath": "assets/icons/icon-blueprint-3x3.png"
  },
  {
    "id": "icon-bolt-1x1",
    "filePath": "assets/icons/icon-bolt-1x1.png"
  },
  {
    "id": "icon-book-1x1",
    "filePath": "assets/icons/icon-book-1x1.png"
  },
  {
    "id": "icon-bottle-1x1",
    "filePath": "assets/icons/icon-bottle-1x1.png"
  },
  {
    "id": "icon-bottle-2x2",
    "filePath": "assets/icons/icon-bottle-2x2.png"
  },
  {
    "id": "icon-bottle-3x3",
    "filePath": "assets/icons/icon-bottle-3x3.png"
  },
  {
    "id": "icon-bug-2x2",
    "filePath": "assets/icons/icon-bug-2x2.png"
  },
  {
    "id": "icon-bug2-1x1",
    "filePath": "assets/icons/icon-bug2-1x1.png"
  },
  {
    "id": "icon-bug2-2x2",
    "filePath": "assets/icons/icon-bug2-2x2.png"
  },
  {
    "id": "icon-bug2-3x3",
    "filePath": "assets/icons/icon-bug2-3x3.png"
  },
  {
    "id": "icon-build-3x3",
    "filePath": "assets/icons/icon-build-3x3.png"
  },
  {
    "id": "icon-cactus-1x1",
    "filePath": "assets/icons/icon-cactus-1x1.png"
  },
  {
    "id": "icon-cactus-2x2",
    "filePath": "assets/icons/icon-cactus-2x2.png"
  },
  {
    "id": "icon-cactus-3x3",
    "filePath": "assets/icons/icon-cactus-3x3.png"
  },
  {
    "id": "icon-calendar-2x2",
    "filePath": "assets/icons/icon-calendar-2x2.png"
  },
  {
    "id": "icon-camera-2x2",
    "filePath": "assets/icons/icon-camera-2x2.png"
  },
  {
    "id": "icon-can-1x1",
    "filePath": "assets/icons/icon-can-1x1.png"
  },
  {
    "id": "icon-can-2x2",
    "filePath": "assets/icons/icon-can-2x2.png"
  },
  {
    "id": "icon-can-3x3",
    "filePath": "assets/icons/icon-can-3x3.png"
  },
  {
    "id": "icon-cards-1x1",
    "filePath": "assets/icons/icon-cards-1x1.png"
  },
  {
    "id": "icon-cards-2x2",
    "filePath": "assets/icons/icon-cards-2x2.png"
  },
  {
    "id": "icon-cards-3x3",
    "filePath": "assets/icons/icon-cards-3x3.png"
  },
  {
    "id": "icon-cart-1x1",
    "filePath": "assets/icons/icon-cart-1x1.png"
  },
  {
    "id": "icon-cart-2x2",
    "filePath": "assets/icons/icon-cart-2x2.png"
  },
  {
    "id": "icon-cat-1x1",
    "filePath": "assets/icons/icon-cat-1x1.png"
  },
  {
    "id": "icon-cat-2x2",
    "filePath": "assets/icons/icon-cat-2x2.png"
  },
  {
    "id": "icon-cat-3x3",
    "filePath": "assets/icons/icon-cat-3x3.png"
  },
  {
    "id": "icon-chart-2x2",
    "filePath": "assets/icons/icon-chart-2x2.png"
  },
  {
    "id": "icon-chat-2x2",
    "filePath": "assets/icons/icon-chat-2x2.png"
  },
  {
    "id": "icon-check-1x1",
    "filePath": "assets/icons/icon-check-1x1.png"
  },
  {
    "id": "icon-check-2x2",
    "filePath": "assets/icons/icon-check-2x2.png"
  },
  {
    "id": "icon-check-3x3",
    "filePath": "assets/icons/icon-check-3x3.png"
  },
  {
    "id": "icon-chess-1x1",
    "filePath": "assets/icons/icon-chess-1x1.png"
  },
  {
    "id": "icon-chess-2x2",
    "filePath": "assets/icons/icon-chess-2x2.png"
  },
  {
    "id": "icon-chess-3x3",
    "filePath": "assets/icons/icon-chess-3x3.png"
  },
  {
    "id": "icon-chest-3x3",
    "filePath": "assets/icons/icon-chest-3x3.png"
  },
  {
    "id": "icon-chevron-double-down-1x1",
    "filePath": "assets/icons/icon-chevron-double-down-1x1.png"
  },
  {
    "id": "icon-chevron-double-down-2x2",
    "filePath": "assets/icons/icon-chevron-double-down-2x2.png"
  },
  {
    "id": "icon-chevron-double-down-3x3",
    "filePath": "assets/icons/icon-chevron-double-down-3x3.png"
  },
  {
    "id": "icon-chevron-double-left-1x1",
    "filePath": "assets/icons/icon-chevron-double-left-1x1.png"
  },
  {
    "id": "icon-chevron-double-left-2x2",
    "filePath": "assets/icons/icon-chevron-double-left-2x2.png"
  },
  {
    "id": "icon-chevron-double-left-3x3",
    "filePath": "assets/icons/icon-chevron-double-left-3x3.png"
  },
  {
    "id": "icon-chevron-double-right-1x1",
    "filePath": "assets/icons/icon-chevron-double-right-1x1.png"
  },
  {
    "id": "icon-chevron-double-right-2x2",
    "filePath": "assets/icons/icon-chevron-double-right-2x2.png"
  },
  {
    "id": "icon-chevron-double-right-3x3",
    "filePath": "assets/icons/icon-chevron-double-right-3x3.png"
  },
  {
    "id": "icon-chevron-double-up-1x1",
    "filePath": "assets/icons/icon-chevron-double-up-1x1.png"
  },
  {
    "id": "icon-chevron-double-up-2x2",
    "filePath": "assets/icons/icon-chevron-double-up-2x2.png"
  },
  {
    "id": "icon-chevron-double-up-3x3",
    "filePath": "assets/icons/icon-chevron-double-up-3x3.png"
  },
  {
    "id": "icon-chevron-down-1x1",
    "filePath": "assets/icons/icon-chevron-down-1x1.png"
  },
  {
    "id": "icon-chevron-down-2x2",
    "filePath": "assets/icons/icon-chevron-down-2x2.png"
  },
  {
    "id": "icon-chevron-down-3x3",
    "filePath": "assets/icons/icon-chevron-down-3x3.png"
  },
  {
    "id": "icon-chevron-left-1x1",
    "filePath": "assets/icons/icon-chevron-left-1x1.png"
  },
  {
    "id": "icon-chevron-left-2x2",
    "filePath": "assets/icons/icon-chevron-left-2x2.png"
  },
  {
    "id": "icon-chevron-left-3x3",
    "filePath": "assets/icons/icon-chevron-left-3x3.png"
  },
  {
    "id": "icon-chevron-right-1x1",
    "filePath": "assets/icons/icon-chevron-right-1x1.png"
  },
  {
    "id": "icon-chevron-right-2x2",
    "filePath": "assets/icons/icon-chevron-right-2x2.png"
  },
  {
    "id": "icon-chevron-right-3x3",
    "filePath": "assets/icons/icon-chevron-right-3x3.png"
  },
  {
    "id": "icon-chevron-up-1x1",
    "filePath": "assets/icons/icon-chevron-up-1x1.png"
  },
  {
    "id": "icon-chevron-up-2x2",
    "filePath": "assets/icons/icon-chevron-up-2x2.png"
  },
  {
    "id": "icon-chevron-up-3x3",
    "filePath": "assets/icons/icon-chevron-up-3x3.png"
  },
  {
    "id": "icon-circuit-3x3",
    "filePath": "assets/icons/icon-circuit-3x3.png"
  },
  {
    "id": "icon-clock-2x2",
    "filePath": "assets/icons/icon-clock-2x2.png"
  },
  {
    "id": "icon-cloud-1x1",
    "filePath": "assets/icons/icon-cloud-1x1.png"
  },
  {
    "id": "icon-code-2x2",
    "filePath": "assets/icons/icon-code-2x2.png"
  },
  {
    "id": "icon-coffee-1x1",
    "filePath": "assets/icons/icon-coffee-1x1.png"
  },
  {
    "id": "icon-coffee-2x2",
    "filePath": "assets/icons/icon-coffee-2x2.png"
  },
  {
    "id": "icon-coffee-3x3",
    "filePath": "assets/icons/icon-coffee-3x3.png"
  },
  {
    "id": "icon-coin-3x3",
    "filePath": "assets/icons/icon-coin-3x3.png"
  },
  {
    "id": "icon-compass-2x2",
    "filePath": "assets/icons/icon-compass-2x2.png"
  },
  {
    "id": "icon-cookie-1x1",
    "filePath": "assets/icons/icon-cookie-1x1.png"
  },
  {
    "id": "icon-cookie-2x2",
    "filePath": "assets/icons/icon-cookie-2x2.png"
  },
  {
    "id": "icon-cookie-3x3",
    "filePath": "assets/icons/icon-cookie-3x3.png"
  },
  {
    "id": "icon-cpu-2x2",
    "filePath": "assets/icons/icon-cpu-2x2.png"
  },
  {
    "id": "icon-cross-1x1",
    "filePath": "assets/icons/icon-cross-1x1.png"
  },
  {
    "id": "icon-cross-2x2",
    "filePath": "assets/icons/icon-cross-2x2.png"
  },
  {
    "id": "icon-cross-3x3",
    "filePath": "assets/icons/icon-cross-3x3.png"
  },
  {
    "id": "icon-crown-3x3",
    "filePath": "assets/icons/icon-crown-3x3.png"
  },
  {
    "id": "icon-crystal-3x3",
    "filePath": "assets/icons/icon-crystal-3x3.png"
  },
  {
    "id": "icon-diamond-3x3",
    "filePath": "assets/icons/icon-diamond-3x3.png"
  },
  {
    "id": "icon-dice-1x1",
    "filePath": "assets/icons/icon-dice-1x1.png"
  },
  {
    "id": "icon-dice-2x2",
    "filePath": "assets/icons/icon-dice-2x2.png"
  },
  {
    "id": "icon-dice-3x3",
    "filePath": "assets/icons/icon-dice-3x3.png"
  },
  {
    "id": "icon-disk-2x2",
    "filePath": "assets/icons/icon-disk-2x2.png"
  },
  {
    "id": "icon-dna-3x3",
    "filePath": "assets/icons/icon-dna-3x3.png"
  },
  {
    "id": "icon-dog-1x1",
    "filePath": "assets/icons/icon-dog-1x1.png"
  },
  {
    "id": "icon-dog-2x2",
    "filePath": "assets/icons/icon-dog-2x2.png"
  },
  {
    "id": "icon-dog-3x3",
    "filePath": "assets/icons/icon-dog-3x3.png"
  },
  {
    "id": "icon-drone-3x3",
    "filePath": "assets/icons/icon-drone-3x3.png"
  },
  {
    "id": "icon-drop-1x1",
    "filePath": "assets/icons/icon-drop-1x1.png"
  },
  {
    "id": "icon-earth-3x3",
    "filePath": "assets/icons/icon-earth-3x3.png"
  },
  {
    "id": "icon-energy-3x3",
    "filePath": "assets/icons/icon-energy-3x3.png"
  },
  {
    "id": "icon-eye-1x1",
    "filePath": "assets/icons/icon-eye-1x1.png"
  },
  {
    "id": "icon-factory-3x3",
    "filePath": "assets/icons/icon-factory-3x3.png"
  },
  {
    "id": "icon-file-2x2",
    "filePath": "assets/icons/icon-file-2x2.png"
  },
  {
    "id": "icon-filter-2x2",
    "filePath": "assets/icons/icon-filter-2x2.png"
  },
  {
    "id": "icon-fire-3x3",
    "filePath": "assets/icons/icon-fire-3x3.png"
  },
  {
    "id": "icon-fish-1x1",
    "filePath": "assets/icons/icon-fish-1x1.png"
  },
  {
    "id": "icon-fish-2x2",
    "filePath": "assets/icons/icon-fish-2x2.png"
  },
  {
    "id": "icon-fish-3x3",
    "filePath": "assets/icons/icon-fish-3x3.png"
  },
  {
    "id": "icon-flag-1x1",
    "filePath": "assets/icons/icon-flag-1x1.png"
  },
  {
    "id": "icon-flame-1x1",
    "filePath": "assets/icons/icon-flame-1x1.png"
  },
  {
    "id": "icon-folder-2x2",
    "filePath": "assets/icons/icon-folder-2x2.png"
  },
  {
    "id": "icon-fox-1x1",
    "filePath": "assets/icons/icon-fox-1x1.png"
  },
  {
    "id": "icon-fox-2x2",
    "filePath": "assets/icons/icon-fox-2x2.png"
  },
  {
    "id": "icon-fox-3x3",
    "filePath": "assets/icons/icon-fox-3x3.png"
  },
  {
    "id": "icon-gear-1x1",
    "filePath": "assets/icons/icon-gear-1x1.png"
  },
  {
    "id": "icon-gem-1x1",
    "filePath": "assets/icons/icon-gem-1x1.png"
  },
  {
    "id": "icon-gem-2x2",
    "filePath": "assets/icons/icon-gem-2x2.png"
  },
  {
    "id": "icon-gem-3x3",
    "filePath": "assets/icons/icon-gem-3x3.png"
  },
  {
    "id": "icon-ghost-1x1",
    "filePath": "assets/icons/icon-ghost-1x1.png"
  },
  {
    "id": "icon-ghost-2x2",
    "filePath": "assets/icons/icon-ghost-2x2.png"
  },
  {
    "id": "icon-ghost-3x3",
    "filePath": "assets/icons/icon-ghost-3x3.png"
  },
  {
    "id": "icon-gift-2x2",
    "filePath": "assets/icons/icon-gift-2x2.png"
  },
  {
    "id": "icon-globe-2x2",
    "filePath": "assets/icons/icon-globe-2x2.png"
  },
  {
    "id": "icon-hammer-1x1",
    "filePath": "assets/icons/icon-hammer-1x1.png"
  },
  {
    "id": "icon-headphones-2x2",
    "filePath": "assets/icons/icon-headphones-2x2.png"
  },
  {
    "id": "icon-heart-1x1",
    "filePath": "assets/icons/icon-heart-1x1.png"
  },
  {
    "id": "icon-heart-2x2",
    "filePath": "assets/icons/icon-heart-2x2.png"
  },
  {
    "id": "icon-heart-3x3",
    "filePath": "assets/icons/icon-heart-3x3.png"
  },
  {
    "id": "icon-home-1x1",
    "filePath": "assets/icons/icon-home-1x1.png"
  },
  {
    "id": "icon-home-3x3",
    "filePath": "assets/icons/icon-home-3x3.png"
  },
  {
    "id": "icon-hourglass-1x1",
    "filePath": "assets/icons/icon-hourglass-1x1.png"
  },
  {
    "id": "icon-hourglass-2x2",
    "filePath": "assets/icons/icon-hourglass-2x2.png"
  },
  {
    "id": "icon-hourglass-3x3",
    "filePath": "assets/icons/icon-hourglass-3x3.png"
  },
  {
    "id": "icon-icecream-1x1",
    "filePath": "assets/icons/icon-icecream-1x1.png"
  },
  {
    "id": "icon-icecream-2x2",
    "filePath": "assets/icons/icon-icecream-2x2.png"
  },
  {
    "id": "icon-icecream-3x3",
    "filePath": "assets/icons/icon-icecream-3x3.png"
  },
  {
    "id": "icon-image-2x2",
    "filePath": "assets/icons/icon-image-2x2.png"
  },
  {
    "id": "icon-infinity-1x1",
    "filePath": "assets/icons/icon-infinity-1x1.png"
  },
  {
    "id": "icon-infinity-2x2",
    "filePath": "assets/icons/icon-infinity-2x2.png"
  },
  {
    "id": "icon-infinity-3x3",
    "filePath": "assets/icons/icon-infinity-3x3.png"
  },
  {
    "id": "icon-info-2x2",
    "filePath": "assets/icons/icon-info-2x2.png"
  },
  {
    "id": "icon-joystick-1x1",
    "filePath": "assets/icons/icon-joystick-1x1.png"
  },
  {
    "id": "icon-joystick-2x2",
    "filePath": "assets/icons/icon-joystick-2x2.png"
  },
  {
    "id": "icon-joystick-3x3",
    "filePath": "assets/icons/icon-joystick-3x3.png"
  },
  {
    "id": "icon-key-1x1",
    "filePath": "assets/icons/icon-key-1x1.png"
  },
  {
    "id": "icon-lab-2x2",
    "filePath": "assets/icons/icon-lab-2x2.png"
  },
  {
    "id": "icon-lab-3x3",
    "filePath": "assets/icons/icon-lab-3x3.png"
  },
  {
    "id": "icon-leaf-1x1",
    "filePath": "assets/icons/icon-leaf-1x1.png"
  },
  {
    "id": "icon-link-2x2",
    "filePath": "assets/icons/icon-link-2x2.png"
  },
  {
    "id": "icon-lock-1x1",
    "filePath": "assets/icons/icon-lock-1x1.png"
  },
  {
    "id": "icon-magnet-1x1",
    "filePath": "assets/icons/icon-magnet-1x1.png"
  },
  {
    "id": "icon-magnet-2x2",
    "filePath": "assets/icons/icon-magnet-2x2.png"
  },
  {
    "id": "icon-magnet-3x3",
    "filePath": "assets/icons/icon-magnet-3x3.png"
  },
  {
    "id": "icon-mail-1x1",
    "filePath": "assets/icons/icon-mail-1x1.png"
  },
  {
    "id": "icon-map-2x2",
    "filePath": "assets/icons/icon-map-2x2.png"
  },
  {
    "id": "icon-medal-2x2",
    "filePath": "assets/icons/icon-medal-2x2.png"
  },
  {
    "id": "icon-mic-2x2",
    "filePath": "assets/icons/icon-mic-2x2.png"
  },
  {
    "id": "icon-minus-1x1",
    "filePath": "assets/icons/icon-minus-1x1.png"
  },
  {
    "id": "icon-moon-1x1",
    "filePath": "assets/icons/icon-moon-1x1.png"
  },
  {
    "id": "icon-mushroom-1x1",
    "filePath": "assets/icons/icon-mushroom-1x1.png"
  },
  {
    "id": "icon-mushroom-2x2",
    "filePath": "assets/icons/icon-mushroom-2x2.png"
  },
  {
    "id": "icon-mushroom-3x3",
    "filePath": "assets/icons/icon-mushroom-3x3.png"
  },
  {
    "id": "icon-music-1x1",
    "filePath": "assets/icons/icon-music-1x1.png"
  },
  {
    "id": "icon-ore-1x1",
    "filePath": "assets/icons/icon-ore-1x1.png"
  },
  {
    "id": "icon-ore-2x2",
    "filePath": "assets/icons/icon-ore-2x2.png"
  },
  {
    "id": "icon-ore-3x3",
    "filePath": "assets/icons/icon-ore-3x3.png"
  },
  {
    "id": "icon-pause-1x1",
    "filePath": "assets/icons/icon-pause-1x1.png"
  },
  {
    "id": "icon-phone-2x2",
    "filePath": "assets/icons/icon-phone-2x2.png"
  },
  {
    "id": "icon-pickaxe-1x1",
    "filePath": "assets/icons/icon-pickaxe-1x1.png"
  },
  {
    "id": "icon-pickaxe-2x2",
    "filePath": "assets/icons/icon-pickaxe-2x2.png"
  },
  {
    "id": "icon-pickaxe-3x3",
    "filePath": "assets/icons/icon-pickaxe-3x3.png"
  },
  {
    "id": "icon-pin-2x2",
    "filePath": "assets/icons/icon-pin-2x2.png"
  },
  {
    "id": "icon-pizza-1x1",
    "filePath": "assets/icons/icon-pizza-1x1.png"
  },
  {
    "id": "icon-pizza-2x2",
    "filePath": "assets/icons/icon-pizza-2x2.png"
  },
  {
    "id": "icon-pizza-3x3",
    "filePath": "assets/icons/icon-pizza-3x3.png"
  },
  {
    "id": "icon-plane-3x3",
    "filePath": "assets/icons/icon-plane-3x3.png"
  },
  {
    "id": "icon-play-1x1",
    "filePath": "assets/icons/icon-play-1x1.png"
  },
  {
    "id": "icon-plus-1x1",
    "filePath": "assets/icons/icon-plus-1x1.png"
  },
  {
    "id": "icon-portal-3x3",
    "filePath": "assets/icons/icon-portal-3x3.png"
  },
  {
    "id": "icon-potion-1x1",
    "filePath": "assets/icons/icon-potion-1x1.png"
  },
  {
    "id": "icon-potion-2x2",
    "filePath": "assets/icons/icon-potion-2x2.png"
  },
  {
    "id": "icon-potion-3x3",
    "filePath": "assets/icons/icon-potion-3x3.png"
  },
  {
    "id": "icon-power-2x2",
    "filePath": "assets/icons/icon-power-2x2.png"
  },
  {
    "id": "icon-power-3x3",
    "filePath": "assets/icons/icon-power-3x3.png"
  },
  {
    "id": "icon-puzzle-1x1",
    "filePath": "assets/icons/icon-puzzle-1x1.png"
  },
  {
    "id": "icon-puzzle-2x2",
    "filePath": "assets/icons/icon-puzzle-2x2.png"
  },
  {
    "id": "icon-puzzle-3x3",
    "filePath": "assets/icons/icon-puzzle-3x3.png"
  },
  {
    "id": "icon-radar-3x3",
    "filePath": "assets/icons/icon-radar-3x3.png"
  },
  {
    "id": "icon-rainbow-1x1",
    "filePath": "assets/icons/icon-rainbow-1x1.png"
  },
  {
    "id": "icon-rainbow-2x2",
    "filePath": "assets/icons/icon-rainbow-2x2.png"
  },
  {
    "id": "icon-rainbow-3x3",
    "filePath": "assets/icons/icon-rainbow-3x3.png"
  },
  {
    "id": "icon-ring-1x1",
    "filePath": "assets/icons/icon-ring-1x1.png"
  },
  {
    "id": "icon-ring-2x2",
    "filePath": "assets/icons/icon-ring-2x2.png"
  },
  {
    "id": "icon-ring-3x3",
    "filePath": "assets/icons/icon-ring-3x3.png"
  },
  {
    "id": "icon-robot-1x1",
    "filePath": "assets/icons/icon-robot-1x1.png"
  },
  {
    "id": "icon-robot-2x2",
    "filePath": "assets/icons/icon-robot-2x2.png"
  },
  {
    "id": "icon-robot-3x3",
    "filePath": "assets/icons/icon-robot-3x3.png"
  },
  {
    "id": "icon-rocket-3x3",
    "filePath": "assets/icons/icon-rocket-3x3.png"
  },
  {
    "id": "icon-satellite-3x3",
    "filePath": "assets/icons/icon-satellite-3x3.png"
  },
  {
    "id": "icon-scroll-1x1",
    "filePath": "assets/icons/icon-scroll-1x1.png"
  },
  {
    "id": "icon-scroll-2x2",
    "filePath": "assets/icons/icon-scroll-2x2.png"
  },
  {
    "id": "icon-scroll-3x3",
    "filePath": "assets/icons/icon-scroll-3x3.png"
  },
  {
    "id": "icon-search-2x2",
    "filePath": "assets/icons/icon-search-2x2.png"
  },
  {
    "id": "icon-seed-1x1",
    "filePath": "assets/icons/icon-seed-1x1.png"
  },
  {
    "id": "icon-seed-2x2",
    "filePath": "assets/icons/icon-seed-2x2.png"
  },
  {
    "id": "icon-seed-3x3",
    "filePath": "assets/icons/icon-seed-3x3.png"
  },
  {
    "id": "icon-settings-3x3",
    "filePath": "assets/icons/icon-settings-3x3.png"
  },
  {
    "id": "icon-shield-1x1",
    "filePath": "assets/icons/icon-shield-1x1.png"
  },
  {
    "id": "icon-ship-3x3",
    "filePath": "assets/icons/icon-ship-3x3.png"
  },
  {
    "id": "icon-shop-3x3",
    "filePath": "assets/icons/icon-shop-3x3.png"
  },
  {
    "id": "icon-skull-3x3",
    "filePath": "assets/icons/icon-skull-3x3.png"
  },
  {
    "id": "icon-snow-1x1",
    "filePath": "assets/icons/icon-snow-1x1.png"
  },
  {
    "id": "icon-snow-2x2",
    "filePath": "assets/icons/icon-snow-2x2.png"
  },
  {
    "id": "icon-snow-3x3",
    "filePath": "assets/icons/icon-snow-3x3.png"
  },
  {
    "id": "icon-speaker-2x2",
    "filePath": "assets/icons/icon-speaker-2x2.png"
  },
  {
    "id": "icon-spiral-1x1",
    "filePath": "assets/icons/icon-spiral-1x1.png"
  },
  {
    "id": "icon-spiral-2x2",
    "filePath": "assets/icons/icon-spiral-2x2.png"
  },
  {
    "id": "icon-spiral-3x3",
    "filePath": "assets/icons/icon-spiral-3x3.png"
  },
  {
    "id": "icon-star-1x1",
    "filePath": "assets/icons/icon-star-1x1.png"
  },
  {
    "id": "icon-star-2x2",
    "filePath": "assets/icons/icon-star-2x2.png"
  },
  {
    "id": "icon-star-3x3",
    "filePath": "assets/icons/icon-star-3x3.png"
  },
  {
    "id": "icon-stop-1x1",
    "filePath": "assets/icons/icon-stop-1x1.png"
  },
  {
    "id": "icon-sun-1x1",
    "filePath": "assets/icons/icon-sun-1x1.png"
  },
  {
    "id": "icon-sword-1x1",
    "filePath": "assets/icons/icon-sword-1x1.png"
  },
  {
    "id": "icon-tag-2x2",
    "filePath": "assets/icons/icon-tag-2x2.png"
  },
  {
    "id": "icon-target-1x1",
    "filePath": "assets/icons/icon-target-1x1.png"
  },
  {
    "id": "icon-terminal-2x2",
    "filePath": "assets/icons/icon-terminal-2x2.png"
  },
  {
    "id": "icon-train-3x3",
    "filePath": "assets/icons/icon-train-3x3.png"
  },
  {
    "id": "icon-tree-1x1",
    "filePath": "assets/icons/icon-tree-1x1.png"
  },
  {
    "id": "icon-tree-2x2",
    "filePath": "assets/icons/icon-tree-2x2.png"
  },
  {
    "id": "icon-tree-3x3",
    "filePath": "assets/icons/icon-tree-3x3.png"
  },
  {
    "id": "icon-trophy-2x2",
    "filePath": "assets/icons/icon-trophy-2x2.png"
  },
  {
    "id": "icon-truck-3x3",
    "filePath": "assets/icons/icon-truck-3x3.png"
  },
  {
    "id": "icon-unlock-1x1",
    "filePath": "assets/icons/icon-unlock-1x1.png"
  },
  {
    "id": "icon-user-1x1",
    "filePath": "assets/icons/icon-user-1x1.png"
  },
  {
    "id": "icon-user-3x3",
    "filePath": "assets/icons/icon-user-3x3.png"
  },
  {
    "id": "icon-users-1x1",
    "filePath": "assets/icons/icon-users-1x1.png"
  },
  {
    "id": "icon-users-3x3",
    "filePath": "assets/icons/icon-users-3x3.png"
  },
  {
    "id": "icon-vault-3x3",
    "filePath": "assets/icons/icon-vault-3x3.png"
  },
  {
    "id": "icon-virus-3x3",
    "filePath": "assets/icons/icon-virus-3x3.png"
  },
  {
    "id": "icon-wand-1x1",
    "filePath": "assets/icons/icon-wand-1x1.png"
  },
  {
    "id": "icon-wand-2x2",
    "filePath": "assets/icons/icon-wand-2x2.png"
  },
  {
    "id": "icon-wand-3x3",
    "filePath": "assets/icons/icon-wand-3x3.png"
  },
  {
    "id": "icon-warning-2x2",
    "filePath": "assets/icons/icon-warning-2x2.png"
  },
  {
    "id": "icon-warning-3x3",
    "filePath": "assets/icons/icon-warning-3x3.png"
  },
  {
    "id": "icon-water-3x3",
    "filePath": "assets/icons/icon-water-3x3.png"
  },
  {
    "id": "icon-wave-1x1",
    "filePath": "assets/icons/icon-wave-1x1.png"
  },
  {
    "id": "icon-wave-2x2",
    "filePath": "assets/icons/icon-wave-2x2.png"
  },
  {
    "id": "icon-wave-3x3",
    "filePath": "assets/icons/icon-wave-3x3.png"
  },
  {
    "id": "icon-wifi-2x2",
    "filePath": "assets/icons/icon-wifi-2x2.png"
  },
  {
    "id": "icon-wrench-1x1",
    "filePath": "assets/icons/icon-wrench-1x1.png"
  },
  {
    "id": "icon-yinyang-1x1",
    "filePath": "assets/icons/icon-yinyang-1x1.png"
  },
  {
    "id": "icon-yinyang-2x2",
    "filePath": "assets/icons/icon-yinyang-2x2.png"
  },
  {
    "id": "icon-yinyang-3x3",
    "filePath": "assets/icons/icon-yinyang-3x3.png"
  },
  {
    "id": "ind-airlock-3x2",
    "filePath": "assets/deco/ind-airlock-3x2.png"
  },
  {
    "id": "ind-assembler-4x4",
    "filePath": "assets/deco/ind-assembler-4x4.png"
  },
  {
    "id": "ind-barrel-1x1",
    "filePath": "assets/deco/ind-barrel-1x1.png"
  },
  {
    "id": "ind-beam-2x1",
    "filePath": "assets/deco/ind-beam-2x1.png"
  },
  {
    "id": "ind-board-3x2",
    "filePath": "assets/deco/ind-board-3x2.png"
  },
  {
    "id": "ind-boiler-2x2",
    "filePath": "assets/deco/ind-boiler-2x2.png"
  },
  {
    "id": "ind-bolt-1x1",
    "filePath": "assets/deco/ind-bolt-1x1.png"
  },
  {
    "id": "ind-button-1x1",
    "filePath": "assets/deco/ind-button-1x1.png"
  },
  {
    "id": "ind-cabinet-2x2",
    "filePath": "assets/deco/ind-cabinet-2x2.png"
  },
  {
    "id": "ind-chimney-1x3",
    "filePath": "assets/deco/ind-chimney-1x3.png"
  },
  {
    "id": "ind-conduit-1x1",
    "filePath": "assets/deco/ind-conduit-1x1.png"
  },
  {
    "id": "ind-console-3x2",
    "filePath": "assets/deco/ind-console-3x2.png"
  },
  {
    "id": "ind-conveyor-2x1",
    "filePath": "assets/deco/ind-conveyor-2x1.png"
  },
  {
    "id": "ind-cooling-3x3",
    "filePath": "assets/deco/ind-cooling-3x3.png"
  },
  {
    "id": "ind-core-4x4",
    "filePath": "assets/deco/ind-core-4x4.png"
  },
  {
    "id": "ind-crane-1x3",
    "filePath": "assets/deco/ind-crane-1x3.png"
  },
  {
    "id": "ind-crane-3x3",
    "filePath": "assets/deco/ind-crane-3x3.png"
  },
  {
    "id": "ind-crate-2x1",
    "filePath": "assets/deco/ind-crate-2x1.png"
  },
  {
    "id": "ind-crate-2x2",
    "filePath": "assets/deco/ind-crate-2x2.png"
  },
  {
    "id": "ind-door-2x2",
    "filePath": "assets/deco/ind-door-2x2.png"
  },
  {
    "id": "ind-duct-2x1",
    "filePath": "assets/deco/ind-duct-2x1.png"
  },
  {
    "id": "ind-fan-2x2",
    "filePath": "assets/deco/ind-fan-2x2.png"
  },
  {
    "id": "ind-furnace-3x2",
    "filePath": "assets/deco/ind-furnace-3x2.png"
  },
  {
    "id": "ind-gauge-1x1",
    "filePath": "assets/deco/ind-gauge-1x1.png"
  },
  {
    "id": "ind-gear-1x1",
    "filePath": "assets/deco/ind-gear-1x1.png"
  },
  {
    "id": "ind-generator-2x2",
    "filePath": "assets/deco/ind-generator-2x2.png"
  },
  {
    "id": "ind-junction-2x1",
    "filePath": "assets/deco/ind-junction-2x1.png"
  },
  {
    "id": "ind-ladder-1x2",
    "filePath": "assets/deco/ind-ladder-1x2.png"
  },
  {
    "id": "ind-lamp-1x2",
    "filePath": "assets/deco/ind-lamp-1x2.png"
  },
  {
    "id": "ind-locker-1x2",
    "filePath": "assets/deco/ind-locker-1x2.png"
  },
  {
    "id": "ind-motor-2x2",
    "filePath": "assets/deco/ind-motor-2x2.png"
  },
  {
    "id": "ind-panel-2x1",
    "filePath": "assets/deco/ind-panel-2x1.png"
  },
  {
    "id": "ind-pipe-1x2",
    "filePath": "assets/deco/ind-pipe-1x2.png"
  },
  {
    "id": "ind-pipe-1x3",
    "filePath": "assets/deco/ind-pipe-1x3.png"
  },
  {
    "id": "ind-pipe-2x1",
    "filePath": "assets/deco/ind-pipe-2x1.png"
  },
  {
    "id": "ind-pipe-bank-3x2",
    "filePath": "assets/deco/ind-pipe-bank-3x2.png"
  },
  {
    "id": "ind-pipe-cap-1x1",
    "filePath": "assets/deco/ind-pipe-cap-1x1.png"
  },
  {
    "id": "ind-plant-4x4",
    "filePath": "assets/deco/ind-plant-4x4.png"
  },
  {
    "id": "ind-pump-1x2",
    "filePath": "assets/deco/ind-pump-1x2.png"
  },
  {
    "id": "ind-rack-1x2",
    "filePath": "assets/deco/ind-rack-1x2.png"
  },
  {
    "id": "ind-radiator-3x2",
    "filePath": "assets/deco/ind-radiator-3x2.png"
  },
  {
    "id": "ind-reactor-3x3",
    "filePath": "assets/deco/ind-reactor-3x3.png"
  },
  {
    "id": "ind-server-1x3",
    "filePath": "assets/deco/ind-server-1x3.png"
  },
  {
    "id": "ind-server-3x3",
    "filePath": "assets/deco/ind-server-3x3.png"
  },
  {
    "id": "ind-stack-1x2",
    "filePath": "assets/deco/ind-stack-1x2.png"
  },
  {
    "id": "ind-storage-4x4",
    "filePath": "assets/deco/ind-storage-4x4.png"
  },
  {
    "id": "ind-tank-2x2",
    "filePath": "assets/deco/ind-tank-2x2.png"
  },
  {
    "id": "ind-terminal-1x2",
    "filePath": "assets/deco/ind-terminal-1x2.png"
  },
  {
    "id": "ind-valve-1x1",
    "filePath": "assets/deco/ind-valve-1x1.png"
  },
  {
    "id": "ind-warning-2x1",
    "filePath": "assets/deco/ind-warning-2x1.png"
  },
  {
    "id": "logi-assembler-2x2",
    "filePath": "assets/deco/logi-assembler-2x2.png"
  },
  {
    "id": "logi-assembler-3x3",
    "filePath": "assets/deco/logi-assembler-3x3.png"
  },
  {
    "id": "logi-balancer-3x1",
    "filePath": "assets/deco/logi-balancer-3x1.png"
  },
  {
    "id": "logi-belt-1x2",
    "filePath": "assets/deco/logi-belt-1x2.png"
  },
  {
    "id": "logi-belt-2x1",
    "filePath": "assets/deco/logi-belt-2x1.png"
  },
  {
    "id": "logi-belt-3x1",
    "filePath": "assets/deco/logi-belt-3x1.png"
  },
  {
    "id": "logi-buffer-2x2",
    "filePath": "assets/deco/logi-buffer-2x2.png"
  },
  {
    "id": "logi-drill-1x2",
    "filePath": "assets/deco/logi-drill-1x2.png"
  },
  {
    "id": "logi-drill-2x2",
    "filePath": "assets/deco/logi-drill-2x2.png"
  },
  {
    "id": "logi-drone-station-2x2",
    "filePath": "assets/deco/logi-drone-station-2x2.png"
  },
  {
    "id": "logi-extractor-2x2",
    "filePath": "assets/deco/logi-extractor-2x2.png"
  },
  {
    "id": "logi-filter-2x2",
    "filePath": "assets/deco/logi-filter-2x2.png"
  },
  {
    "id": "logi-hopper-2x2",
    "filePath": "assets/deco/logi-hopper-2x2.png"
  },
  {
    "id": "logi-loader-2x2",
    "filePath": "assets/deco/logi-loader-2x2.png"
  },
  {
    "id": "logi-merger-2x2",
    "filePath": "assets/deco/logi-merger-2x2.png"
  },
  {
    "id": "logi-pump-1x2",
    "filePath": "assets/deco/logi-pump-1x2.png"
  },
  {
    "id": "logi-pump-2x2",
    "filePath": "assets/deco/logi-pump-2x2.png"
  },
  {
    "id": "logi-silo-2x2",
    "filePath": "assets/deco/logi-silo-2x2.png"
  },
  {
    "id": "logi-silo-2x3",
    "filePath": "assets/deco/logi-silo-2x3.png"
  },
  {
    "id": "logi-silo-3x3",
    "filePath": "assets/deco/logi-silo-3x3.png"
  },
  {
    "id": "logi-smelter-2x2",
    "filePath": "assets/deco/logi-smelter-2x2.png"
  },
  {
    "id": "logi-smelter-3x3",
    "filePath": "assets/deco/logi-smelter-3x3.png"
  },
  {
    "id": "logi-sorter-2x2",
    "filePath": "assets/deco/logi-sorter-2x2.png"
  },
  {
    "id": "logi-sorter-3x3",
    "filePath": "assets/deco/logi-sorter-3x3.png"
  },
  {
    "id": "logi-splitter-2x2",
    "filePath": "assets/deco/logi-splitter-2x2.png"
  },
  {
    "id": "logi-splitter-3x3",
    "filePath": "assets/deco/logi-splitter-3x3.png"
  },
  {
    "id": "logi-unloader-2x2",
    "filePath": "assets/deco/logi-unloader-2x2.png"
  },
  {
    "id": "jar-ash-1x1",
    "filePath": "assets2/deco/jar-ash-1x1.png"
  },
  {
    "id": "jar-crystal-1x1",
    "filePath": "assets2/deco/jar-crystal-1x1.png"
  },
  {
    "id": "jar-empty-1x1",
    "filePath": "assets2/deco/jar-empty-1x1.png"
  },
  {
    "id": "jar-eye-1x1",
    "filePath": "assets2/deco/jar-eye-1x1.png"
  },
  {
    "id": "jar-gold-dust-1x1",
    "filePath": "assets2/deco/jar-gold-dust-1x1.png"
  },
  {
    "id": "jar-goo-1x1",
    "filePath": "assets2/deco/jar-goo-1x1.png"
  },
  {
    "id": "jar-heart-1x1",
    "filePath": "assets2/deco/jar-heart-1x1.png"
  },
  {
    "id": "jar-ice-1x1",
    "filePath": "assets2/deco/jar-ice-1x1.png"
  },
  {
    "id": "jar-mite-1x1",
    "filePath": "assets2/deco/jar-mite-1x1.png"
  },
  {
    "id": "jar-oil-1x1",
    "filePath": "assets2/deco/jar-oil-1x1.png"
  },
  {
    "id": "jar-pollen-1x1",
    "filePath": "assets2/deco/jar-pollen-1x1.png"
  },
  {
    "id": "jar-sand-1x1",
    "filePath": "assets2/deco/jar-sand-1x1.png"
  },
  {
    "id": "jar-spore-1x1",
    "filePath": "assets2/deco/jar-spore-1x1.png"
  },
  {
    "id": "jar-void-1x1",
    "filePath": "assets2/deco/jar-void-1x1.png"
  },
  {
    "id": "jar-water-1x1",
    "filePath": "assets2/deco/jar-water-1x1.png"
  },
  {
    "id": "jar-worm-1x1",
    "filePath": "assets2/deco/jar-worm-1x1.png"
  },
  {
    "id": "key-bio-1x1",
    "filePath": "assets2/deco/key-bio-1x1.png"
  },
  {
    "id": "key-card-1x1",
    "filePath": "assets2/deco/key-card-1x1.png"
  },
  {
    "id": "key-copper-1x1",
    "filePath": "assets2/deco/key-copper-1x1.png"
  },
  {
    "id": "key-crystal-1x1",
    "filePath": "assets2/deco/key-crystal-1x1.png"
  },
  {
    "id": "key-eye-1x1",
    "filePath": "assets2/deco/key-eye-1x1.png"
  },
  {
    "id": "key-gold-1x1",
    "filePath": "assets2/deco/key-gold-1x1.png"
  },
  {
    "id": "key-heart-1x1",
    "filePath": "assets2/deco/key-heart-1x1.png"
  },
  {
    "id": "key-ice-1x1",
    "filePath": "assets2/deco/key-ice-1x1.png"
  },
  {
    "id": "key-master-1x1",
    "filePath": "assets2/deco/key-master-1x1.png"
  },
  {
    "id": "key-pixel-1x1",
    "filePath": "assets2/deco/key-pixel-1x1.png"
  },
  {
    "id": "key-rust-1x1",
    "filePath": "assets2/deco/key-rust-1x1.png"
  },
  {
    "id": "key-sand-1x1",
    "filePath": "assets2/deco/key-sand-1x1.png"
  },
  {
    "id": "key-skull-1x1",
    "filePath": "assets2/deco/key-skull-1x1.png"
  },
  {
    "id": "key-spore-1x1",
    "filePath": "assets2/deco/key-spore-1x1.png"
  },
  {
    "id": "key-temple-1x1",
    "filePath": "assets2/deco/key-temple-1x1.png"
  },
  {
    "id": "key-void-1x1",
    "filePath": "assets2/deco/key-void-1x1.png"
  },
  {
    "id": "lever-bio-btn-1x1",
    "filePath": "assets2/deco/lever-bio-btn-1x1.png"
  },
  {
    "id": "port-cyan-1x1",
    "filePath": "assets2/icons/port-cyan-1x1.png"
  },
  {
    "id": "port-factory-1x1",
    "filePath": "assets2/icons/port-factory-1x1.png"
  },
  {
    "id": "port-fog-1x1",
    "filePath": "assets2/icons/port-fog-1x1.png"
  },
  {
    "id": "port-garden-1x1",
    "filePath": "assets2/icons/port-garden-1x1.png"
  },
  {
    "id": "port-gold-1x1",
    "filePath": "assets2/icons/port-gold-1x1.png"
  },
  {
    "id": "port-green-1x1",
    "filePath": "assets2/icons/port-green-1x1.png"
  },
  {
    "id": "port-ice-1x1",
    "filePath": "assets2/icons/port-ice-1x1.png"
  },
  {
    "id": "port-magma-1x1",
    "filePath": "assets2/icons/port-magma-1x1.png"
  },
  {
    "id": "port-night-1x1",
    "filePath": "assets2/icons/port-night-1x1.png"
  },
  {
    "id": "port-ocean-1x1",
    "filePath": "assets2/icons/port-ocean-1x1.png"
  },
  {
    "id": "port-red-alert-1x1",
    "filePath": "assets2/icons/port-red-alert-1x1.png"
  },
  {
    "id": "port-sand-1x1",
    "filePath": "assets2/icons/port-sand-1x1.png"
  },
  {
    "id": "port-spore-1x1",
    "filePath": "assets2/icons/port-spore-1x1.png"
  },
  {
    "id": "port-stars-1x1",
    "filePath": "assets2/icons/port-stars-1x1.png"
  },
  {
    "id": "port-storm-1x1",
    "filePath": "assets2/icons/port-storm-1x1.png"
  },
  {
    "id": "port-void-1x1",
    "filePath": "assets2/icons/port-void-1x1.png"
  },
  {
    "id": "portal-cyan-2x2",
    "filePath": "assets2/deco/portal-cyan-2x2.png"
  },
  {
    "id": "portal-cyan-3x3",
    "filePath": "assets2/deco/portal-cyan-3x3.png"
  },
  {
    "id": "portal-gold-2x2",
    "filePath": "assets2/deco/portal-gold-2x2.png"
  },
  {
    "id": "portal-gold-3x3",
    "filePath": "assets2/deco/portal-gold-3x3.png"
  },
  {
    "id": "portal-ice-2x2",
    "filePath": "assets2/deco/portal-ice-2x2.png"
  },
  {
    "id": "portal-ice-3x3",
    "filePath": "assets2/deco/portal-ice-3x3.png"
  },
  {
    "id": "portal-magma-2x2",
    "filePath": "assets2/deco/portal-magma-2x2.png"
  },
  {
    "id": "portal-magma-3x3",
    "filePath": "assets2/deco/portal-magma-3x3.png"
  },
  {
    "id": "portal-pink-2x2",
    "filePath": "assets2/deco/portal-pink-2x2.png"
  },
  {
    "id": "portal-pink-3x3",
    "filePath": "assets2/deco/portal-pink-3x3.png"
  },
  {
    "id": "portal-sand-2x2",
    "filePath": "assets2/deco/portal-sand-2x2.png"
  },
  {
    "id": "portal-sand-3x3",
    "filePath": "assets2/deco/portal-sand-3x3.png"
  },
  {
    "id": "portal-spore-2x2",
    "filePath": "assets2/deco/portal-spore-2x2.png"
  },
  {
    "id": "portal-spore-3x3",
    "filePath": "assets2/deco/portal-spore-3x3.png"
  },
  {
    "id": "portal-void-2x2",
    "filePath": "assets2/deco/portal-void-2x2.png"
  },
  {
    "id": "portal-void-3x3",
    "filePath": "assets2/deco/portal-void-3x3.png"
  },
  {
    "id": "probs-assembler-arm-3x3",
    "filePath": "assets/block/probs-assembler-arm-3x3.png"
  },
  {
    "id": "probs-bio-canister-1x1",
    "filePath": "assets/block/probs-bio-canister-1x1.png"
  },
  {
    "id": "probs-biohazard-barrel-1x1",
    "filePath": "assets/block/probs-biohazard-barrel-1x1.png"
  },
  {
    "id": "probs-bioreactor-3x3",
    "filePath": "assets/block/probs-bioreactor-3x3.png"
  },
  {
    "id": "probs-console-3x3",
    "filePath": "assets/block/probs-console-3x3.png"
  },
  {
    "id": "probs-cooling-tower-3x3",
    "filePath": "assets/block/probs-cooling-tower-3x3.png"
  },
  {
    "id": "probs-crate-1x1",
    "filePath": "assets/block/probs-crate-1x1.png"
  },
  {
    "id": "probs-crate-2x2",
    "filePath": "assets/block/probs-crate-2x2.png"
  },
  {
    "id": "probs-crate-stack-4x4",
    "filePath": "assets/block/probs-crate-stack-4x4.png"
  },
  {
    "id": "probs-data-node-1x1",
    "filePath": "assets/block/probs-data-node-1x1.png"
  },
  {
    "id": "probs-door-2x2",
    "filePath": "assets/block/probs-door-2x2.png"
  },
  {
    "id": "probs-drone-dock-2x2",
    "filePath": "assets/block/probs-drone-dock-2x2.png"
  },
  {
    "id": "probs-fan-2x2",
    "filePath": "assets/block/probs-fan-2x2.png"
  },
  {
    "id": "probs-fusion-core-4x4",
    "filePath": "assets/block/probs-fusion-core-4x4.png"
  },
  {
    "id": "probs-gate-4x4",
    "filePath": "assets/block/probs-gate-4x4.png"
  },
  {
    "id": "probs-gene-sequencer-3x3",
    "filePath": "assets/block/probs-gene-sequencer-3x3.png"
  },
  {
    "id": "probs-growth-chamber-4x4",
    "filePath": "assets/block/probs-growth-chamber-4x4.png"
  },
  {
    "id": "probs-holo-projector-2x2",
    "filePath": "assets/block/probs-holo-projector-2x2.png"
  },
  {
    "id": "probs-incubator-2x2",
    "filePath": "assets/block/probs-incubator-2x2.png"
  },
  {
    "id": "probs-lab-bench-4x4",
    "filePath": "assets/block/probs-lab-bench-4x4.png"
  },
  {
    "id": "probs-nutrient-tank-2x2",
    "filePath": "assets/block/probs-nutrient-tank-2x2.png"
  },
  {
    "id": "probs-pipe-junction-2x2",
    "filePath": "assets/block/probs-pipe-junction-2x2.png"
  },
  {
    "id": "probs-power-junction-1x1",
    "filePath": "assets/block/probs-power-junction-1x1.png"
  },
  {
    "id": "probs-reactor-core-4x4",
    "filePath": "assets/block/probs-reactor-core-4x4.png"
  },
  {
    "id": "probs-sample-tube-1x1",
    "filePath": "assets/block/probs-sample-tube-1x1.png"
  },
  {
    "id": "probs-sensor-1x1",
    "filePath": "assets/block/probs-sensor-1x1.png"
  },
  {
    "id": "probs-server-rack-2x2",
    "filePath": "assets/block/probs-server-rack-2x2.png"
  },
  {
    "id": "probs-shelf-3x3",
    "filePath": "assets/block/probs-shelf-3x3.png"
  },
  {
    "id": "probs-spore-pod-1x1",
    "filePath": "assets/block/probs-spore-pod-1x1.png"
  },
  {
    "id": "probs-stasis-pod-3x3",
    "filePath": "assets/block/probs-stasis-pod-3x3.png"
  },
  {
    "id": "probs-vent-1x1",
    "filePath": "assets/block/probs-vent-1x1.png"
  },
  {
    "id": "probs-wall-light-1x1",
    "filePath": "assets/block/probs-wall-light-1x1.png"
  },
  {
    "id": "probs-window-2x2",
    "filePath": "assets/block/probs-window-2x2.png"
  },
  {
    "id": "sign-biohazard-1x1",
    "filePath": "assets2/icons/sign-biohazard-1x1.png"
  },
  {
    "id": "sign-biohazard-2x2",
    "filePath": "assets2/icons/sign-biohazard-2x2.png"
  },
  {
    "id": "sign-biohazard-3x3",
    "filePath": "assets2/icons/sign-biohazard-3x3.png"
  },
  {
    "id": "sign-cold-1x1",
    "filePath": "assets2/icons/sign-cold-1x1.png"
  },
  {
    "id": "sign-cold-2x2",
    "filePath": "assets2/icons/sign-cold-2x2.png"
  },
  {
    "id": "sign-cold-3x3",
    "filePath": "assets2/icons/sign-cold-3x3.png"
  },
  {
    "id": "sign-electric-1x1",
    "filePath": "assets2/icons/sign-electric-1x1.png"
  },
  {
    "id": "sign-electric-2x2",
    "filePath": "assets2/icons/sign-electric-2x2.png"
  },
  {
    "id": "sign-electric-3x3",
    "filePath": "assets2/icons/sign-electric-3x3.png"
  },
  {
    "id": "sign-exit-1x1",
    "filePath": "assets2/icons/sign-exit-1x1.png"
  },
  {
    "id": "sign-exit-2x2",
    "filePath": "assets2/icons/sign-exit-2x2.png"
  },
  {
    "id": "sign-exit-3x3",
    "filePath": "assets2/icons/sign-exit-3x3.png"
  },
  {
    "id": "sign-fire-1x1",
    "filePath": "assets2/icons/sign-fire-1x1.png"
  },
  {
    "id": "sign-fire-2x2",
    "filePath": "assets2/icons/sign-fire-2x2.png"
  },
  {
    "id": "sign-fire-3x3",
    "filePath": "assets2/icons/sign-fire-3x3.png"
  },
  {
    "id": "sign-first-aid-1x1",
    "filePath": "assets2/icons/sign-first-aid-1x1.png"
  },
  {
    "id": "sign-first-aid-2x2",
    "filePath": "assets2/icons/sign-first-aid-2x2.png"
  },
  {
    "id": "sign-first-aid-3x3",
    "filePath": "assets2/icons/sign-first-aid-3x3.png"
  },
  {
    "id": "sign-flammable-1x1",
    "filePath": "assets2/icons/sign-flammable-1x1.png"
  },
  {
    "id": "sign-flammable-2x2",
    "filePath": "assets2/icons/sign-flammable-2x2.png"
  },
  {
    "id": "sign-flammable-3x3",
    "filePath": "assets2/icons/sign-flammable-3x3.png"
  },
  {
    "id": "sign-go-1x1",
    "filePath": "assets2/icons/sign-go-1x1.png"
  },
  {
    "id": "sign-go-2x2",
    "filePath": "assets2/icons/sign-go-2x2.png"
  },
  {
    "id": "sign-go-3x3",
    "filePath": "assets2/icons/sign-go-3x3.png"
  },
  {
    "id": "sign-info-1x1",
    "filePath": "assets2/icons/sign-info-1x1.png"
  },
  {
    "id": "sign-info-2x2",
    "filePath": "assets2/icons/sign-info-2x2.png"
  },
  {
    "id": "sign-info-3x3",
    "filePath": "assets2/icons/sign-info-3x3.png"
  },
  {
    "id": "sign-laser-1x1",
    "filePath": "assets2/icons/sign-laser-1x1.png"
  },
  {
    "id": "sign-laser-2x2",
    "filePath": "assets2/icons/sign-laser-2x2.png"
  },
  {
    "id": "sign-laser-3x3",
    "filePath": "assets2/icons/sign-laser-3x3.png"
  },
  {
    "id": "sign-lock-1x1",
    "filePath": "assets2/icons/sign-lock-1x1.png"
  },
  {
    "id": "sign-lock-2x2",
    "filePath": "assets2/icons/sign-lock-2x2.png"
  },
  {
    "id": "sign-lock-3x3",
    "filePath": "assets2/icons/sign-lock-3x3.png"
  },
  {
    "id": "sign-magnetic-1x1",
    "filePath": "assets2/icons/sign-magnetic-1x1.png"
  },
  {
    "id": "sign-magnetic-2x2",
    "filePath": "assets2/icons/sign-magnetic-2x2.png"
  },
  {
    "id": "sign-magnetic-3x3",
    "filePath": "assets2/icons/sign-magnetic-3x3.png"
  },
  {
    "id": "sign-no-entry-1x1",
    "filePath": "assets2/icons/sign-no-entry-1x1.png"
  },
  {
    "id": "sign-no-entry-2x2",
    "filePath": "assets2/icons/sign-no-entry-2x2.png"
  },
  {
    "id": "sign-no-entry-3x3",
    "filePath": "assets2/icons/sign-no-entry-3x3.png"
  },
  {
    "id": "sign-radiation-1x1",
    "filePath": "assets2/icons/sign-radiation-1x1.png"
  },
  {
    "id": "sign-radiation-2x2",
    "filePath": "assets2/icons/sign-radiation-2x2.png"
  },
  {
    "id": "sign-radiation-3x3",
    "filePath": "assets2/icons/sign-radiation-3x3.png"
  },
  {
    "id": "sign-recycle-1x1",
    "filePath": "assets2/icons/sign-recycle-1x1.png"
  },
  {
    "id": "sign-recycle-2x2",
    "filePath": "assets2/icons/sign-recycle-2x2.png"
  },
  {
    "id": "sign-recycle-3x3",
    "filePath": "assets2/icons/sign-recycle-3x3.png"
  },
  {
    "id": "sign-skull-1x1",
    "filePath": "assets2/icons/sign-skull-1x1.png"
  },
  {
    "id": "sign-skull-2x2",
    "filePath": "assets2/icons/sign-skull-2x2.png"
  },
  {
    "id": "sign-skull-3x3",
    "filePath": "assets2/icons/sign-skull-3x3.png"
  },
  {
    "id": "sign-stop-1x1",
    "filePath": "assets2/icons/sign-stop-1x1.png"
  },
  {
    "id": "sign-stop-2x2",
    "filePath": "assets2/icons/sign-stop-2x2.png"
  },
  {
    "id": "sign-stop-3x3",
    "filePath": "assets2/icons/sign-stop-3x3.png"
  },
  {
    "id": "sign-toxic-1x1",
    "filePath": "assets2/icons/sign-toxic-1x1.png"
  },
  {
    "id": "sign-toxic-2x2",
    "filePath": "assets2/icons/sign-toxic-2x2.png"
  },
  {
    "id": "sign-toxic-3x3",
    "filePath": "assets2/icons/sign-toxic-3x3.png"
  },
  {
    "id": "sign-warning-1x1",
    "filePath": "assets2/icons/sign-warning-1x1.png"
  },
  {
    "id": "sign-warning-2x2",
    "filePath": "assets2/icons/sign-warning-2x2.png"
  },
  {
    "id": "sign-warning-3x3",
    "filePath": "assets2/icons/sign-warning-3x3.png"
  },
  {
    "id": "sign-wifi-1x1",
    "filePath": "assets2/icons/sign-wifi-1x1.png"
  },
  {
    "id": "sign-wifi-2x2",
    "filePath": "assets2/icons/sign-wifi-2x2.png"
  },
  {
    "id": "sign-wifi-3x3",
    "filePath": "assets2/icons/sign-wifi-3x3.png"
  },
  {
    "id": "probs-airlock-3x3",
    "filePath": "assets/block/probs-airlock-3x3.png"
  },
  {
    "id": "space-airlock-2x2",
    "filePath": "assets/deco/space-airlock-2x2.png"
  },
  {
    "id": "space-airlock-3x3",
    "filePath": "assets/deco/space-airlock-3x3.png"
  },
  {
    "id": "space-antenna-1x2",
    "filePath": "assets/deco/space-antenna-1x2.png"
  },
  {
    "id": "space-antenna-2x2",
    "filePath": "assets/deco/space-antenna-2x2.png"
  },
  {
    "id": "space-antenna-2x3",
    "filePath": "assets/deco/space-antenna-2x3.png"
  },
  {
    "id": "space-antenna-array-3x3",
    "filePath": "assets/deco/space-antenna-array-3x3.png"
  },
  {
    "id": "space-boom-1x3",
    "filePath": "assets/deco/space-boom-1x3.png"
  },
  {
    "id": "space-cargo-2x2",
    "filePath": "assets/deco/space-cargo-2x2.png"
  },
  {
    "id": "space-cargo-3x1",
    "filePath": "assets/deco/space-cargo-3x1.png"
  },
  {
    "id": "space-dish-2x2",
    "filePath": "assets/deco/space-dish-2x2.png"
  },
  {
    "id": "space-dish-3x3",
    "filePath": "assets/deco/space-dish-3x3.png"
  },
  {
    "id": "space-dock-bay-4x2",
    "filePath": "assets/deco/space-dock-bay-4x2.png"
  },
  {
    "id": "space-dock-clamp-2x2",
    "filePath": "assets/deco/space-dock-clamp-2x2.png"
  },
  {
    "id": "space-dock-clamp-3x2",
    "filePath": "assets/deco/space-dock-clamp-3x2.png"
  },
  {
    "id": "space-dome-2x2",
    "filePath": "assets/deco/space-dome-2x2.png"
  },
  {
    "id": "space-dome-3x3",
    "filePath": "assets/deco/space-dome-3x3.png"
  },
  {
    "id": "space-fuel-1x2",
    "filePath": "assets/deco/space-fuel-1x2.png"
  },
  {
    "id": "space-fuel-2x2",
    "filePath": "assets/deco/space-fuel-2x2.png"
  },
  {
    "id": "space-habitat-2x2",
    "filePath": "assets/deco/space-habitat-2x2.png"
  },
  {
    "id": "space-habitat-3x2",
    "filePath": "assets/deco/space-habitat-3x2.png"
  },
  {
    "id": "space-habitat-4x2",
    "filePath": "assets/deco/space-habitat-4x2.png"
  },
  {
    "id": "space-navlight-1x1",
    "filePath": "assets/deco/space-navlight-1x1.png"
  },
  {
    "id": "space-navlight-g-1x1",
    "filePath": "assets/deco/space-navlight-g-1x1.png"
  },
  {
    "id": "space-pedestal-1x2",
    "filePath": "assets/deco/space-pedestal-1x2.png"
  },
  {
    "id": "space-probe-1x1",
    "filePath": "assets/deco/space-probe-1x1.png"
  },
  {
    "id": "space-radiator-2x1",
    "filePath": "assets/deco/space-radiator-2x1.png"
  },
  {
    "id": "space-radiator-3x1",
    "filePath": "assets/deco/space-radiator-3x1.png"
  },
  {
    "id": "space-rcs-1x1",
    "filePath": "assets/deco/space-rcs-1x1.png"
  },
  {
    "id": "space-rcs-2x1",
    "filePath": "assets/deco/space-rcs-2x1.png"
  },
  {
    "id": "space-sat-2x2",
    "filePath": "assets/deco/space-sat-2x2.png"
  },
  {
    "id": "space-sat-3x3",
    "filePath": "assets/deco/space-sat-3x3.png"
  },
  {
    "id": "space-solar-2x2",
    "filePath": "assets/deco/space-solar-2x2.png"
  },
  {
    "id": "space-solar-3x1",
    "filePath": "assets/deco/space-solar-3x1.png"
  },
  {
    "id": "space-solar-3x3",
    "filePath": "assets/deco/space-solar-3x3.png"
  },
  {
    "id": "space-starfield-2x2",
    "filePath": "assets/deco/space-starfield-2x2.png"
  },
  {
    "id": "space-thruster-1x2",
    "filePath": "assets/deco/space-thruster-1x2.png"
  },
  {
    "id": "space-thruster-2x1",
    "filePath": "assets/deco/space-thruster-2x1.png"
  },
  {
    "id": "space-thruster-2x2",
    "filePath": "assets/deco/space-thruster-2x2.png"
  },
  {
    "id": "vert-aquarium-1x2",
    "filePath": "assets2/deco/vert-aquarium-1x2.png"
  },
  {
    "id": "vert-aquarium-1x3",
    "filePath": "assets2/deco/vert-aquarium-1x3.png"
  },
  {
    "id": "vert-aquarium-1x4",
    "filePath": "assets2/deco/vert-aquarium-1x4.png"
  },
  {
    "id": "vert-barrels-1x2",
    "filePath": "assets2/deco/vert-barrels-1x2.png"
  },
  {
    "id": "vert-barrels-1x3",
    "filePath": "assets2/deco/vert-barrels-1x3.png"
  },
  {
    "id": "vert-barrels-1x4",
    "filePath": "assets2/deco/vert-barrels-1x4.png"
  },
  {
    "id": "vert-bookshelf-1x2",
    "filePath": "assets2/deco/vert-bookshelf-1x2.png"
  },
  {
    "id": "vert-bookshelf-1x3",
    "filePath": "assets2/deco/vert-bookshelf-1x3.png"
  },
  {
    "id": "vert-bookshelf-1x4",
    "filePath": "assets2/deco/vert-bookshelf-1x4.png"
  },
  {
    "id": "vert-cabinet-1x2",
    "filePath": "assets2/deco/vert-cabinet-1x2.png"
  },
  {
    "id": "vert-cabinet-1x3",
    "filePath": "assets2/deco/vert-cabinet-1x3.png"
  },
  {
    "id": "vert-cabinet-1x4",
    "filePath": "assets2/deco/vert-cabinet-1x4.png"
  },
  {
    "id": "vert-clock-1x2",
    "filePath": "assets2/deco/vert-clock-1x2.png"
  },
  {
    "id": "vert-clock-1x3",
    "filePath": "assets2/deco/vert-clock-1x3.png"
  },
  {
    "id": "vert-clock-1x4",
    "filePath": "assets2/deco/vert-clock-1x4.png"
  },
  {
    "id": "vert-coat-rack-1x2",
    "filePath": "assets2/deco/vert-coat-rack-1x2.png"
  },
  {
    "id": "vert-coat-rack-1x3",
    "filePath": "assets2/deco/vert-coat-rack-1x3.png"
  },
  {
    "id": "vert-coat-rack-1x4",
    "filePath": "assets2/deco/vert-coat-rack-1x4.png"
  },
  {
    "id": "vert-crates-1x2",
    "filePath": "assets2/deco/vert-crates-1x2.png"
  },
  {
    "id": "vert-crates-1x3",
    "filePath": "assets2/deco/vert-crates-1x3.png"
  },
  {
    "id": "vert-crates-1x4",
    "filePath": "assets2/deco/vert-crates-1x4.png"
  },
  {
    "id": "vert-data-pillar-1x2",
    "filePath": "assets2/deco/vert-data-pillar-1x2.png"
  },
  {
    "id": "vert-data-pillar-1x3",
    "filePath": "assets2/deco/vert-data-pillar-1x3.png"
  },
  {
    "id": "vert-data-pillar-1x4",
    "filePath": "assets2/deco/vert-data-pillar-1x4.png"
  },
  {
    "id": "vert-flagpole-1x2",
    "filePath": "assets2/deco/vert-flagpole-1x2.png"
  },
  {
    "id": "vert-flagpole-1x3",
    "filePath": "assets2/deco/vert-flagpole-1x3.png"
  },
  {
    "id": "vert-flagpole-1x4",
    "filePath": "assets2/deco/vert-flagpole-1x4.png"
  },
  {
    "id": "vert-fountain-1x2",
    "filePath": "assets2/deco/vert-fountain-1x2.png"
  },
  {
    "id": "vert-fountain-1x3",
    "filePath": "assets2/deco/vert-fountain-1x3.png"
  },
  {
    "id": "vert-fountain-1x4",
    "filePath": "assets2/deco/vert-fountain-1x4.png"
  },
  {
    "id": "vert-fridge-1x2",
    "filePath": "assets2/deco/vert-fridge-1x2.png"
  },
  {
    "id": "vert-fridge-1x3",
    "filePath": "assets2/deco/vert-fridge-1x3.png"
  },
  {
    "id": "vert-fridge-1x4",
    "filePath": "assets2/deco/vert-fridge-1x4.png"
  },
  {
    "id": "vert-gene-vault-1x2",
    "filePath": "assets2/deco/vert-gene-vault-1x2.png"
  },
  {
    "id": "vert-gene-vault-1x3",
    "filePath": "assets2/deco/vert-gene-vault-1x3.png"
  },
  {
    "id": "vert-gene-vault-1x4",
    "filePath": "assets2/deco/vert-gene-vault-1x4.png"
  },
  {
    "id": "vert-incubator-1x2",
    "filePath": "assets2/deco/vert-incubator-1x2.png"
  },
  {
    "id": "vert-incubator-1x3",
    "filePath": "assets2/deco/vert-incubator-1x3.png"
  },
  {
    "id": "vert-incubator-1x4",
    "filePath": "assets2/deco/vert-incubator-1x4.png"
  },
  {
    "id": "vert-ladder-1x2",
    "filePath": "assets2/deco/vert-ladder-1x2.png"
  },
  {
    "id": "vert-ladder-1x3",
    "filePath": "assets2/deco/vert-ladder-1x3.png"
  },
  {
    "id": "vert-ladder-1x4",
    "filePath": "assets2/deco/vert-ladder-1x4.png"
  },
  {
    "id": "vert-lamp-1x2",
    "filePath": "assets2/deco/vert-lamp-1x2.png"
  },
  {
    "id": "vert-lamp-1x3",
    "filePath": "assets2/deco/vert-lamp-1x3.png"
  },
  {
    "id": "vert-lamp-1x4",
    "filePath": "assets2/deco/vert-lamp-1x4.png"
  },
  {
    "id": "vert-locker-1x2",
    "filePath": "assets2/deco/vert-locker-1x2.png"
  },
  {
    "id": "vert-locker-1x3",
    "filePath": "assets2/deco/vert-locker-1x3.png"
  },
  {
    "id": "vert-locker-1x4",
    "filePath": "assets2/deco/vert-locker-1x4.png"
  },
  {
    "id": "vert-locker-red-1x2",
    "filePath": "assets2/deco/vert-locker-red-1x2.png"
  },
  {
    "id": "vert-locker-red-1x3",
    "filePath": "assets2/deco/vert-locker-red-1x3.png"
  },
  {
    "id": "vert-locker-red-1x4",
    "filePath": "assets2/deco/vert-locker-red-1x4.png"
  },
  {
    "id": "vert-pipe-1x2",
    "filePath": "assets2/deco/vert-pipe-1x2.png"
  },
  {
    "id": "vert-pipe-1x3",
    "filePath": "assets2/deco/vert-pipe-1x3.png"
  },
  {
    "id": "vert-pipe-1x4",
    "filePath": "assets2/deco/vert-pipe-1x4.png"
  },
  {
    "id": "vert-plant-1x2",
    "filePath": "assets2/deco/vert-plant-1x2.png"
  },
  {
    "id": "vert-plant-1x3",
    "filePath": "assets2/deco/vert-plant-1x3.png"
  },
  {
    "id": "vert-plant-1x4",
    "filePath": "assets2/deco/vert-plant-1x4.png"
  },
  {
    "id": "vert-robot-1x2",
    "filePath": "assets2/deco/vert-robot-1x2.png"
  },
  {
    "id": "vert-robot-1x3",
    "filePath": "assets2/deco/vert-robot-1x3.png"
  },
  {
    "id": "vert-robot-1x4",
    "filePath": "assets2/deco/vert-robot-1x4.png"
  },
  {
    "id": "vert-safe-1x2",
    "filePath": "assets2/deco/vert-safe-1x2.png"
  },
  {
    "id": "vert-safe-1x3",
    "filePath": "assets2/deco/vert-safe-1x3.png"
  },
  {
    "id": "vert-safe-1x4",
    "filePath": "assets2/deco/vert-safe-1x4.png"
  },
  {
    "id": "vert-server-1x2",
    "filePath": "assets2/deco/vert-server-1x2.png"
  },
  {
    "id": "vert-server-1x3",
    "filePath": "assets2/deco/vert-server-1x3.png"
  },
  {
    "id": "vert-server-1x4",
    "filePath": "assets2/deco/vert-server-1x4.png"
  },
  {
    "id": "vert-speaker-1x2",
    "filePath": "assets2/deco/vert-speaker-1x2.png"
  },
  {
    "id": "vert-speaker-1x3",
    "filePath": "assets2/deco/vert-speaker-1x3.png"
  },
  {
    "id": "vert-speaker-1x4",
    "filePath": "assets2/deco/vert-speaker-1x4.png"
  },
  {
    "id": "vert-spore-tower-1x2",
    "filePath": "assets2/deco/vert-spore-tower-1x2.png"
  },
  {
    "id": "vert-spore-tower-1x3",
    "filePath": "assets2/deco/vert-spore-tower-1x3.png"
  },
  {
    "id": "vert-spore-tower-1x4",
    "filePath": "assets2/deco/vert-spore-tower-1x4.png"
  },
  {
    "id": "vert-statue-1x2",
    "filePath": "assets2/deco/vert-statue-1x2.png"
  },
  {
    "id": "vert-statue-1x3",
    "filePath": "assets2/deco/vert-statue-1x3.png"
  },
  {
    "id": "vert-statue-1x4",
    "filePath": "assets2/deco/vert-statue-1x4.png"
  },
  {
    "id": "vert-tank-1x2",
    "filePath": "assets2/deco/vert-tank-1x2.png"
  },
  {
    "id": "vert-tank-1x3",
    "filePath": "assets2/deco/vert-tank-1x3.png"
  },
  {
    "id": "vert-tank-1x4",
    "filePath": "assets2/deco/vert-tank-1x4.png"
  },
  {
    "id": "vert-telescope-1x2",
    "filePath": "assets2/deco/vert-telescope-1x2.png"
  },
  {
    "id": "vert-telescope-1x3",
    "filePath": "assets2/deco/vert-telescope-1x3.png"
  },
  {
    "id": "vert-telescope-1x4",
    "filePath": "assets2/deco/vert-telescope-1x4.png"
  },
  {
    "id": "vert-toolbox-1x2",
    "filePath": "assets2/deco/vert-toolbox-1x2.png"
  },
  {
    "id": "vert-toolbox-1x3",
    "filePath": "assets2/deco/vert-toolbox-1x3.png"
  },
  {
    "id": "vert-toolbox-1x4",
    "filePath": "assets2/deco/vert-toolbox-1x4.png"
  },
  {
    "id": "vert-umbrella-1x2",
    "filePath": "assets2/deco/vert-umbrella-1x2.png"
  },
  {
    "id": "vert-umbrella-1x3",
    "filePath": "assets2/deco/vert-umbrella-1x3.png"
  },
  {
    "id": "tile-floor-bronze-1x1",
    "filePath": "assets/block/tile-floor-bronze-1x1.png"
  },
  {
    "id": "tile-floor-check-1x1",
    "filePath": "assets/block/tile-floor-check-1x1.png"
  },
  {
    "id": "tile-floor-dirt-1x1",
    "filePath": "assets/block/tile-floor-dirt-1x1.png"
  },
  {
    "id": "tile-floor-dots-1x1",
    "filePath": "assets/block/tile-floor-dots-1x1.png"
  },
  {
    "id": "tile-floor-grass-1x1",
    "filePath": "assets/block/tile-floor-grass-1x1.png"
  },
  {
    "id": "tile-floor-lines-1x1",
    "filePath": "assets/block/tile-floor-lines-1x1.png"
  },
  {
    "id": "tile-floor-plate-1x1",
    "filePath": "assets/block/tile-floor-plate-1x1.png"
  },
  {
    "id": "tile-floor-tech-1x1",
    "filePath": "assets/block/tile-floor-tech-1x1.png"
  },
  {
    "id": "tile-grating-1x1",
    "filePath": "assets/block/tile-grating-1x1.png"
  },
  {
    "id": "tile-grating-heavy-1x1",
    "filePath": "assets/block/tile-grating-heavy-1x1.png"
  },
  {
    "id": "tile-grating-vent-1x1",
    "filePath": "assets/block/tile-grating-vent-1x1.png"
  },
  {
    "id": "tile-wall-bronze-1x1",
    "filePath": "assets/block/tile-wall-bronze-1x1.png"
  },
  {
    "id": "tile-wall-bronze-tile-1x1",
    "filePath": "assets/block/tile-wall-bronze-tile-1x1.png"
  },
  {
    "id": "tile-wall-check-1x1",
    "filePath": "assets/block/tile-wall-check-1x1.png"
  },
  {
    "id": "tile-wall-console-1x1",
    "filePath": "assets/block/tile-wall-console-1x1.png"
  },
  {
    "id": "tile-wall-dots-1x1",
    "filePath": "assets/block/tile-wall-dots-1x1.png"
  },
  {
    "id": "tile-wall-glass-1x1",
    "filePath": "assets/block/tile-wall-glass-1x1.png"
  },
  {
    "id": "tile-wall-light-1x1",
    "filePath": "assets/block/tile-wall-light-1x1.png"
  },
  {
    "id": "tile-wall-lines-1x1",
    "filePath": "assets/block/tile-wall-lines-1x1.png"
  },
  {
    "id": "tile-wall-panel-1x1",
    "filePath": "assets/block/tile-wall-panel-1x1.png"
  },
  {
    "id": "tile-wall-plate-1x1",
    "filePath": "assets/block/tile-wall-plate-1x1.png"
  },
  {
    "id": "tile-wall-siding-1x1",
    "filePath": "assets/block/tile-wall-siding-1x1.png"
  },
  {
    "id": "tile-wall-steel-1x1",
    "filePath": "assets/block/tile-wall-steel-1x1.png"
  },
  {
    "id": "tile-wall-stripe-1x1",
    "filePath": "assets/block/tile-wall-stripe-1x1.png"
  },
  {
    "id": "tile-wall-tech-1x1",
    "filePath": "assets/block/tile-wall-tech-1x1.png"
  },
  {
    "id": "tile-wall-vent-1x1",
    "filePath": "assets/block/tile-wall-vent-1x1.png"
  },
  {
    "id": "tile-wall-warning-1x1",
    "filePath": "assets/block/tile-wall-warning-1x1.png"
  },
  {
    "id": "tile-wall-window-1x1",
    "filePath": "assets/block/tile-wall-window-1x1.png"
  },
  {
    "id": "wide-bay-4x2",
    "filePath": "assets/deco/wide-bay-4x2.png"
  },
  {
    "id": "wide-beam-3x1",
    "filePath": "assets/deco/wide-beam-3x1.png"
  },
  {
    "id": "wide-beam-4x1",
    "filePath": "assets/deco/wide-beam-4x1.png"
  },
  {
    "id": "wide-billboard-3x1",
    "filePath": "assets/deco/wide-billboard-3x1.png"
  },
  {
    "id": "wide-billboard-4x2",
    "filePath": "assets/deco/wide-billboard-4x2.png"
  },
  {
    "id": "wide-bridge-4x1",
    "filePath": "assets/deco/wide-bridge-4x1.png"
  },
  {
    "id": "wide-cable-3x1",
    "filePath": "assets/deco/wide-cable-3x1.png"
  },
  {
    "id": "wide-console-3x1",
    "filePath": "assets/deco/wide-console-3x1.png"
  },
  {
    "id": "wide-console-4x2",
    "filePath": "assets/deco/wide-console-4x2.png"
  },
  {
    "id": "wide-console-alt-3x1",
    "filePath": "assets/deco/wide-console-alt-3x1.png"
  },
  {
    "id": "wide-duct-3x1",
    "filePath": "assets/deco/wide-duct-3x1.png"
  },
  {
    "id": "wide-gauges-3x2",
    "filePath": "assets/deco/wide-gauges-3x2.png"
  },
  {
    "id": "wide-keys-3x1",
    "filePath": "assets/deco/wide-keys-3x1.png"
  },
  {
    "id": "wide-ladder-1x3",
    "filePath": "assets/deco/wide-ladder-1x3.png"
  },
  {
    "id": "wide-level-bar-3x1",
    "filePath": "assets/deco/wide-level-bar-3x1.png"
  },
  {
    "id": "wide-level-tank-2x1",
    "filePath": "assets/deco/wide-level-tank-2x1.png"
  },
  {
    "id": "wide-level-vert-1x1",
    "filePath": "assets/deco/wide-level-vert-1x1.png"
  },
  {
    "id": "wide-level-vert-1x2",
    "filePath": "assets/deco/wide-level-vert-1x2.png"
  },
  {
    "id": "wide-manifold-3x2",
    "filePath": "assets/deco/wide-manifold-3x2.png"
  },
  {
    "id": "wide-monitor-bank-4x2",
    "filePath": "assets/deco/wide-monitor-bank-4x2.png"
  },
  {
    "id": "wide-pipe-3x1",
    "filePath": "assets/deco/wide-pipe-3x1.png"
  },
  {
    "id": "wide-pipe-4x1",
    "filePath": "assets/deco/wide-pipe-4x1.png"
  },
  {
    "id": "wide-pipe-coolant-3x1",
    "filePath": "assets/deco/wide-pipe-coolant-3x1.png"
  },
  {
    "id": "wide-rail-3x1",
    "filePath": "assets/deco/wide-rail-3x1.png"
  },
  {
    "id": "wide-reactor-strip-4x2",
    "filePath": "assets/deco/wide-reactor-strip-4x2.png"
  },
  {
    "id": "wide-shelf-3x1",
    "filePath": "assets/deco/wide-shelf-3x1.png"
  },
  {
    "id": "wide-sign-2x1",
    "filePath": "assets/deco/wide-sign-2x1.png"
  },
  {
    "id": "wide-sign-danger-3x1",
    "filePath": "assets/deco/wide-sign-danger-3x1.png"
  },
  {
    "id": "wide-sign-ok-2x1",
    "filePath": "assets/deco/wide-sign-ok-2x1.png"
  },
  {
    "id": "wide-status-3x1",
    "filePath": "assets/deco/wide-status-3x1.png"
  },
  {
    "id": "wide-valve-1x1",
    "filePath": "assets/deco/wide-valve-1x1.png"
  },
  {
    "id": "wide-valve-1x2",
    "filePath": "assets/deco/wide-valve-1x2.png"
  },
  {
    "id": "wide-valve-2x1",
    "filePath": "assets/deco/wide-valve-2x1.png"
  },
  {
    "id": "wide-warning-2x1",
    "filePath": "assets/deco/wide-warning-2x1.png"
  },
  {
    "id": "wide-warning-3x1",
    "filePath": "assets/deco/wide-warning-3x1.png"
  }
];

// src/register.ts
var MENU_OBJECT_ID = "icons";
var MIRROR_SUFFIX2 = "~mirrored";
function structureTypeFor(modId, itemId, mirrored = false) {
  return `${modId}:item/${itemId}${mirrored ? MIRROR_SUFFIX2 : ""}`;
}
function registerIconStructures(buildList, spriteIds) {
  const modId = buildList.modId;
  for (const item of buildList.catalogueItems) {
    for (const mirrored of [
      false,
      true
    ]) {
      const typeId = structureTypeFor(modId, item.id, mirrored);
      const isMenu = !mirrored && item.id == MENU_OBJECT_ID;
      const spriteId = spriteIds[item.id] ?? typeId;
      const def = buildStructureDefinition({
        id: typeId,
        name: item.label,
        spriteId,
        renderSize: {
          width: item.width,
          height: item.height
        },
        def: {
          nameKey: isMenu ? item.label : void 0,
          description: isMenu ? item.description : void 0,
          categoryKey: "blocks",
          order: 0,
          buildModes: [
            {
              type: "single"
            },
            {
              type: "line",
              directions: [
                "horizontal",
                "vertical"
              ]
            },
            {
              type: "rectangle"
            }
          ]
        },
        defaultData: {
          itemId: item.id,
          mirrored,
          align: item.align ?? "floor",
          width: item.width,
          height: item.height,
          spriteId
        }
      });
      const custumDraw = buildCustumDraw(item);
      sandkit.api.structures.register({
        // alwaysUnlocked: true,
        // rejectWhenBlocked: false,
        hideFromBuildMenu: false,
        ...def,
        draw: custumDraw
      });
      if (isMenu) {
        sandkit.api.player.buildings.unlockByType(typeId);
      }
    }
  }
}

// src/main.ts
var MOD_ID = "sandustry.icons";
var MENU_ID = "icons";
async function main() {
  const api = sandkit.api;
  const spriteIds = await loadSpriteMap(MOD_ID, ICON_FILES);
  const buildList = createBuildList({
    modId: MOD_ID,
    menuId: MENU_ID,
    menuLabel: "Icons",
    categories: ICON_CATEGORIES,
    catalogueItems: ICON_ITEMS,
    selectedId: ICON_ITEMS.find((i) => i.id !== MENU_ID)?.id
  });
  registerIconStructures(buildList, spriteIds);
  createPickerOverlay({
    list: buildList,
    title: "Pick icon",
    pickerId: `${MOD_ID}/picker`,
    // Sprites are loaded under `sandustry.icons:<id>` (see loadSpriteMap), not
    // the structure-type id `sandustry.icons:item/<id>`. Resolve them here so
    // the picker swatches show the correct art.
    spriteIdFor: (item) => spriteIds[item.id]
  });
  api.ui?.toast?.(`Sandustry Icons \u2014 ${ICON_ITEMS.length} objects loaded`, {});
  console.log(`[${MOD_ID}] loaded ${ICON_ITEMS.length} catalogue entries`);
}
try {
  findOrphanedObjects(MOD_ID);
  pruneStaleBuildings(MOD_ID);
  void main();
} catch (e) {
  console.error(e instanceof Error ? e.stack : e);
  console.error(e);
}
