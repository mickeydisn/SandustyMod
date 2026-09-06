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
  console.log("WWWWW= itemIdFromType", modId, type, prefix);
  if (!type.startsWith(prefix)) return null;
  let id = type.slice(prefix.length);
  console.log("WWWWW= startsWith", id);
  if (id.endsWith(MIRROR_SUFFIX)) id = id.slice(0, -MIRROR_SUFFIX.length);
  console.log("WWWWW= moror", id);
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
  const listeners = {
    select: /* @__PURE__ */ new Set(),
    place: /* @__PURE__ */ new Set(),
    remove: /* @__PURE__ */ new Set(),
    category: /* @__PURE__ */ new Set(),
    mirror: /* @__PURE__ */ new Set()
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
  } catch (err) {
    console.warn("[picker-overlay] could not persist selection", err);
  }
}

// ../../packages/catalogue/src/picker/react.ts
function h(type, props, ...children) {
  return sandkit.react.createElement(type, props, ...children);
}

// ../../packages/catalogue/src/picker/scroll.ts
var position = 0;
var pending = false;
function rememberScroll(value) {
  if (!Number.isFinite(value) || value < 0) return;
  position = value;
}
function requestScrollRestore() {
  pending = true;
}
function applyScroll(node) {
  if (!node || !pending) return false;
  pending = false;
  node.scrollTop = position;
  return true;
}
function resetScroll() {
  position = 0;
  pending = true;
}

// ../../packages/catalogue/src/picker/overlay.ts
var TOOLTIP_DELAY_MS = 120;
function createPickerOverlay(options) {
  const list = options.list;
  const pickerId = options.pickerId ?? `${list.modId}/picker`;
  const slot = options.slot ?? "hotbar";
  const title = options.title ?? "Pick item";
  const maxHeight = options.maxHeight ?? 400;
  const syncIntervalMs = options.syncIntervalMs ?? 1e3;
  let pickerState = null;
  let repaint = null;
  const search = "";
  let tooltip = null;
  let tooltipTimer = null;
  let timer = null;
  let unsubscribe = null;
  let registered = false;
  if (options.persistSelection !== false) restorePickerState(list);
  const unlockTypes = options.unlockTypes ?? ((types) => {
    for (const type of types) sandkit.api.player.buildings.unlockByType(type);
  });
  const clearTooltip = () => {
    if (tooltipTimer) clearTimeout(tooltipTimer);
    tooltipTimer = null;
    if (!tooltip) return;
    tooltip = null;
    repaint?.();
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
      repaint?.();
    }, TOOLTIP_DELAY_MS);
  };
  const ctx = () => ({
    list,
    selected: list.getSelected(),
    mirrored: list.isMirrored(),
    categoryId: list.getCategory(),
    search,
    repaint: () => repaint?.()
  });
  const selectItem = (item) => {
    list.setSelected(item.id);
    list.setCategory(item.category);
    const mirrored = list.isMirrored();
    const type = list.structureType(item.id, mirrored);
    unlockTypes([
      type,
      list.structureType(item.id, !mirrored)
    ]);
    options.onSelect?.(item, mirrored);
    list.applyToBuildTool();
    if (options.persistSelection !== false) persistSelection(list);
    repaint?.();
  };
  const expand = () => {
    if (!pickerState?.minimized) return;
    requestScrollRestore();
    pickerState = {
      minimized: false
    };
    repaint?.();
  };
  const minimize = () => {
    if (!pickerState || pickerState.minimized) return;
    clearTooltip();
    pickerState = {
      minimized: true
    };
    repaint?.();
  };
  const close = () => {
    clearTooltip();
    pickerState = null;
    repaint?.();
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
      scope: pickerId,
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
    const SWATCH_BOX = 34;
    const MAX_SWATCH_ZOOM = 4;
    function swatchZoom(width, height, box = SWATCH_BOX) {
      const longest = Math.max(width, height);
      if (longest <= 0) return 1;
      return Math.max(1, Math.min(MAX_SWATCH_ZOOM, Math.floor(box / longest)));
    }
    const zoom = swatchZoom(props.item.width, props.item.height);
    return h(FocusableButton, {
      id: `${pickerId}-item-${props.item.id}`,
      onHoverStart: (rect) => {
        const extra = "Hello";
        scheduleTooltip(`${props.item.label} \u2014 ${props.item.width}\xD7${props.item.height}${extra}`, rect);
      },
      onHoverEnd: clearTooltip,
      onActivate: () => selectItem(props.item),
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
    sandkit.react.useEffect(() => {
      repaint = () => bump((n) => n + 1);
      return () => {
        if (repaint) repaint = null;
      };
    }, []);
    if (!pickerState) return null;
    const selected = list.getSelected();
    const categoryId = list.getCategory() || list.categories[0]?.id || "";
    function filterItems(items, options2) {
      const q = options2.query.trim().toLowerCase();
      return items.filter((item) => {
        if (item.category !== options2.categoryId) return false;
        if (options2.itemFilter && !options2.itemFilter(item)) return false;
        if (!q) return true;
        const hay = `${item.label} ${item.id} ${item.description ?? ""} ${(item.tags ?? []).join(" ")}`.toLowerCase();
        return hay.includes(q);
      });
    }
    const visible = filterItems(list.catalogueItems, {
      categoryId,
      query: search,
      itemFilter: options.itemFilter
    });
    if (pickerState.minimized) {
      const src = selected ? spriteSrc(selected) : void 0;
      return h("div", {
        className: "pointer-events-auto flex items-center gap-2 bg-black bg-opacity-75 border border-slate-700 rounded px-3 py-2 ui-box text-slate-300",
        onClick: expand
      }, h("span", {
        className: "text-white text-xs opacity-70"
      }, title), h(FocusableButton, {
        id: `${pickerId}-selected`,
        onActivate: expand,
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
    return h(
      "div",
      {
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
      },
      h("div", {
        className: "px-4 py-2 border-b border-slate-800 flex items-center justify-between"
      }, h("span", {
        className: "text-white text-xs opacity-70"
      }, title), h("div", {
        className: "flex items-center gap-2"
      }, h(FocusableButton, {
        id: `${pickerId}-mirror`,
        onActivate: () => {
          const next = !list.isMirrored();
          list.setMirrored(next);
          const item = list.getSelected();
          if (item) {
            const type = list.structureType(item.id, next);
            unlockTypes([
              type
            ]);
            sandkit.api.building?.selectStructure(type);
          }
          if (options.persistSelection !== false) {
            persistSelection(list);
          }
          repaint?.();
        },
        className: `text-xs px-2 py-0.5 border rounded ${list.isMirrored() ? "text-[#ffe700] border-yellow-400" : "text-slate-300 border-slate-600"}`,
        children: `${list.isMirrored() ? "\u2611" : "\u2610"} Mirrored`
      }), h(FocusableButton, {
        id: `${pickerId}-minimize`,
        onActivate: minimize,
        className: "text-xs px-2 py-0.5 text-white bg-black border border-slate-600 rounded",
        children: "Minimize \u25BE"
      }))),
      /*
      options.search !== false
        ? h(
          "div",
          { className: "px-4 py-2 border-b border-slate-800" },
          h("input", {
            type: "search",
            placeholder: "Search…",
            value: search,
            className:
              "w-full text-xs bg-black border border-slate-700 rounded px-2 py-1 text-white",
            onInput: (event: { currentTarget: { value: string } }) => {
              search = event.currentTarget.value;
              repaint?.();
            },
          }),
        )
        : null,
      */
      options.renderHeaderExtra ? options.renderHeaderExtra(ctx()) : null,
      tooltip ? h("div", {
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
      }) : null,
      h("div", {
        // className: "flex flex-wrap gap-1 px-4 py-2 border-b border-slate-800",
        className: "flex flex-row flex-wrap "
      }, h("div", {
        // className: "flex flex-wrap gap-1 px-4 py-2 border-b border-slate-800",
        className: "grid grid-cols-4 overflow-y-auto  gap-1 px-4 py-2 border-b border-slate-800",
        style: {
          height: `18vh`
        }
      }, list.categories.filter((cat) => list.countIn(cat.id) > 0).map((cat) => h(FocusableButton, {
        key: cat.id,
        id: `${pickerId}-cat-${cat.id}`,
        onActivate: () => {
          list.setCategory(cat.id);
          const next = !list.isMirrored();
          const item = list.itemsInCategory(cat.id)[0];
          if (item) {
            const type = list.structureType(item.id, next);
            unlockTypes([
              type
            ]);
            sandkit.api.building?.selectStructure(type);
          }
          if (options.persistSelection !== false) {
            persistSelection(list);
          }
          resetScroll();
          repaint?.();
        },
        className: `text-xs px-2 py-0.5 rounded border w-[100px] ${cat.id === categoryId ? "text-[#ffe700] border-yellow-400" : "text-slate-400 border-slate-600"}`,
        children: `${cat.label} ${list.countIn(cat.id)}`
      }))), h("div", {
        className: "min-h-0 flex-1 px-4 py-2  overflow-y-auto",
        style: {
          height: `18vh`
        },
        onScroll: (event) => {
          rememberScroll(event.currentTarget.scrollTop);
        },
        ref: (node) => applyScroll(node)
      }, h("div", {
        className: "flex flex-wrap gap-1.5"
      }, visible.map((item) => h(ObjectSwatch, {
        key: item.id,
        item,
        selected: item.id === selected?.id
      })))))
    );
  };
  const selectedModType = () => {
    const selected = sandkit.api.action.getSelected?.();
    const building = sandkit.enums.ActionType.Building;
    console.log("WWWWW= selectedModType", selected, building);
    if (!selected || !building) {
      console.log("WWWWW= selectedModType: no selected or no building");
      return void 0;
    }
    if (selected.type !== building) {
      console.log("WWWWW= selectedModType: not building", selected.types, building);
      return void 0;
    }
    const id = selected.id;
    if (!id || !id.startsWith(`${list.modId}:`)) {
      console.log("WWWWW= selectedModType: not mod", id);
      return void 0;
    }
    const type = itemIdFromType(list.modId, id);
    console.log("WWWWW= selectedModType: type", type);
    return type ? type : void 0;
  };
  const sync = () => {
    const type = selectedModType();
    console.log("WWWWW=  sync picker overlay", type, pickerState);
    if (type && !pickerState) {
      const itemId = itemIdFromType(list.modId, type);
      if (itemId) {
        list.setSelected(itemId);
        pickerState = {
          minimized: true
        };
        repaint?.();
      }
      return;
    }
    if (type && pickerState) {
      const itemId = itemIdFromType(list.modId, type);
      if (itemId && itemId !== list.getSelected()?.id) {
        list.setSelected(itemId);
        repaint?.();
      }
      return;
    }
    if (!type && pickerState) {
      close();
    }
  };
  const install = () => {
    console.log("install picker overlay");
    if (registered) return;
    sandkit.api.ui.overlays.register(slot, pickerId, () => h(Picker, null));
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
    "id": "arraw_1",
    "label": "Araw_1"
  },
  {
    "id": "arraw_2",
    "label": "Araw_2"
  },
  {
    "id": "arraw_3",
    "label": "Araw_3"
  },
  {
    "id": "banner__",
    "label": "Bnner__"
  },
  {
    "id": "beacon_1",
    "label": "Bacon_1"
  },
  {
    "id": "beacon__",
    "label": "Bacon__"
  },
  {
    "id": "bg_1",
    "label": "B_1"
  },
  {
    "id": "block_1",
    "label": "Bock_1"
  },
  {
    "id": "bot_1",
    "label": "Bt_1"
  },
  {
    "id": "bot_2",
    "label": "Bt_2"
  },
  {
    "id": "bot_3",
    "label": "Bt_3"
  },
  {
    "id": "cable_1",
    "label": "Cble_1"
  },
  {
    "id": "char_1",
    "label": "Car_1"
  },
  {
    "id": "char_2",
    "label": "Car_2"
  },
  {
    "id": "core_1",
    "label": "Cre_1"
  },
  {
    "id": "core_2",
    "label": "Cre_2"
  },
  {
    "id": "crew__",
    "label": "Cew__"
  },
  {
    "id": "debris_1",
    "label": "Dbris_1"
  },
  {
    "id": "egg_1",
    "label": "Eg_1"
  },
  {
    "id": "emoji_1",
    "label": "Eoji_1"
  },
  {
    "id": "emoji_2",
    "label": "Eoji_2"
  },
  {
    "id": "emoji_3",
    "label": "Eoji_3"
  },
  {
    "id": "fence_1",
    "label": "Fnce_1"
  },
  {
    "id": "fence__",
    "label": "Fnce__"
  },
  {
    "id": "flora_1",
    "label": "Fora_1"
  },
  {
    "id": "garden_1",
    "label": "Grden_1"
  },
  {
    "id": "garden_2",
    "label": "Grden_2"
  },
  {
    "id": "garden_3",
    "label": "Grden_3"
  },
  {
    "id": "garden__",
    "label": "Grden__"
  },
  {
    "id": "gem_1",
    "label": "Gm_1"
  },
  {
    "id": "gem_2",
    "label": "Gm_2"
  },
  {
    "id": "glyph_1",
    "label": "Gyph_1"
  },
  {
    "id": "glyph_2",
    "label": "Gyph_2"
  },
  {
    "id": "hatch_2",
    "label": "Htch_2"
  },
  {
    "id": "hatch__",
    "label": "Htch__"
  },
  {
    "id": "holo_2",
    "label": "Hlo_2"
  },
  {
    "id": "holo_3",
    "label": "Hlo_3"
  },
  {
    "id": "home_1",
    "label": "Hme_1"
  },
  {
    "id": "home_2",
    "label": "Hme_2"
  },
  {
    "id": "home_3",
    "label": "Hme_3"
  },
  {
    "id": "home__",
    "label": "Hme__"
  },
  {
    "id": "horiz__",
    "label": "Hriz__"
  },
  {
    "id": "icon_1",
    "label": "Ion_1"
  },
  {
    "id": "icon_2",
    "label": "Ion_2"
  },
  {
    "id": "icon_3",
    "label": "Ion_3"
  },
  {
    "id": "indus_1",
    "label": "Idus_1"
  },
  {
    "id": "indus_2",
    "label": "Idus_2"
  },
  {
    "id": "indus_3",
    "label": "Idus_3"
  },
  {
    "id": "indus__",
    "label": "Idus__"
  },
  {
    "id": "jar_1",
    "label": "Jr_1"
  },
  {
    "id": "key_1",
    "label": "Ky_1"
  },
  {
    "id": "lever_1",
    "label": "Lver_1"
  },
  {
    "id": "pipe_1",
    "label": "Ppe_1"
  },
  {
    "id": "pipe_2",
    "label": "Ppe_2"
  },
  {
    "id": "pod_1",
    "label": "Pd_1"
  },
  {
    "id": "pod_2",
    "label": "Pd_2"
  },
  {
    "id": "port_1",
    "label": "Prt_1"
  },
  {
    "id": "portal_2",
    "label": "Prtal_2"
  },
  {
    "id": "portal_3",
    "label": "Prtal_3"
  },
  {
    "id": "probs_1",
    "label": "Pobs_1"
  },
  {
    "id": "probs_2",
    "label": "Pobs_2"
  },
  {
    "id": "probs_3",
    "label": "Pobs_3"
  },
  {
    "id": "probs__",
    "label": "Pobs__"
  },
  {
    "id": "sensor_1",
    "label": "Snsor_1"
  },
  {
    "id": "sign_1",
    "label": "Sgn_1"
  },
  {
    "id": "sign_2",
    "label": "Sgn_2"
  },
  {
    "id": "sign_3",
    "label": "Sgn_3"
  },
  {
    "id": "space_1",
    "label": "Sace_1"
  },
  {
    "id": "space_2",
    "label": "Sace_2"
  },
  {
    "id": "space_3",
    "label": "Sace_3"
  },
  {
    "id": "space__",
    "label": "Sace__"
  },
  {
    "id": "tele_2",
    "label": "Tle_2"
  },
  {
    "id": "tele_3",
    "label": "Tle_3"
  },
  {
    "id": "totem__",
    "label": "Ttem__"
  },
  {
    "id": "vert__",
    "label": "Vrt__"
  },
  {
    "id": "walls_1",
    "label": "Wlls_1"
  },
  {
    "id": "wide_1",
    "label": "Wde_1"
  },
  {
    "id": "wide__",
    "label": "Wde__"
  }
];
var ICON_ITEMS = [
  {
    "id": "icons",
    "label": "Icons",
    "category": "glyphs",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-A-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-back-1x1",
    "label": "Icon Arrow Back 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-back-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-bounce-1x1",
    "label": "Icon Arrow Bounce 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-bounce-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-down-1x1",
    "label": "Icon Arrow Circle Down 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-circle-down-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-left-1x1",
    "label": "Icon Arrow Circle Left 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-circle-left-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-right-1x1",
    "label": "Icon Arrow Circle Right 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-circle-right-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-up-1x1",
    "label": "Icon Arrow Circle Up 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-circle-up-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-collapse-1x1",
    "label": "Icon Arrow Collapse 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-collapse-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-down-1x1",
    "label": "Icon Arrow Double Down 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-double-down-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-left-1x1",
    "label": "Icon Arrow Double Left 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-double-left-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-right-1x1",
    "label": "Icon Arrow Double Right 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-double-right-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-up-1x1",
    "label": "Icon Arrow Double Up 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-double-up-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-down-1x1",
    "label": "Icon Arrow Down 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-down-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-down-left-1x1",
    "label": "Icon Arrow Down Left 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-down-left-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-down-right-1x1",
    "label": "Icon Arrow Down Right 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-down-right-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-enter-1x1",
    "label": "Icon Arrow Enter 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-enter-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-expand-1x1",
    "label": "Icon Arrow Expand 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-expand-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-fork-1x1",
    "label": "Icon Arrow Fork 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-fork-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-left-1x1",
    "label": "Icon Arrow Left 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-left-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-left-right-1x1",
    "label": "Icon Arrow Left Right 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-left-right-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-merge-1x1",
    "label": "Icon Arrow Merge 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-merge-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-redo-1x1",
    "label": "Icon Arrow Redo 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-redo-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-right-1x1",
    "label": "Icon Arrow Right 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-right-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-rotate-ccw-1x1",
    "label": "Icon Arrow Rotate Ccw 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-rotate-ccw-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-rotate-cw-1x1",
    "label": "Icon Arrow Rotate Cw 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-rotate-cw-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-shuffle-1x1",
    "label": "Icon Arrow Shuffle 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-shuffle-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-sort-1x1",
    "label": "Icon Arrow Sort 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-sort-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-trend-down-1x1",
    "label": "Icon Arrow Trend Down 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-trend-down-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-trend-up-1x1",
    "label": "Icon Arrow Trend Up 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-trend-up-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-undo-1x1",
    "label": "Icon Arrow Undo 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-undo-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-1x1",
    "label": "Icon Arrow Up 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-up-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-down-1x1",
    "label": "Icon Arrow Up Down 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-up-down-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-left-1x1",
    "label": "Icon Arrow Up Left 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-up-left-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-right-1x1",
    "label": "Icon Arrow Up Right 1x1",
    "category": "arraw_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-arrow-up-right-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-back-2x2",
    "label": "Icon Arrow Back 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-back-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-bounce-2x2",
    "label": "Icon Arrow Bounce 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-bounce-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-down-2x2",
    "label": "Icon Arrow Circle Down 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-circle-down-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-left-2x2",
    "label": "Icon Arrow Circle Left 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-circle-left-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-right-2x2",
    "label": "Icon Arrow Circle Right 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-circle-right-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-up-2x2",
    "label": "Icon Arrow Circle Up 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-circle-up-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-collapse-2x2",
    "label": "Icon Arrow Collapse 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-collapse-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-down-2x2",
    "label": "Icon Arrow Double Down 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-double-down-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-left-2x2",
    "label": "Icon Arrow Double Left 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-double-left-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-right-2x2",
    "label": "Icon Arrow Double Right 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-double-right-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-up-2x2",
    "label": "Icon Arrow Double Up 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-double-up-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-down-2x2",
    "label": "Icon Arrow Down 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-down-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-down-left-2x2",
    "label": "Icon Arrow Down Left 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-down-left-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-down-right-2x2",
    "label": "Icon Arrow Down Right 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-down-right-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-enter-2x2",
    "label": "Icon Arrow Enter 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-enter-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-expand-2x2",
    "label": "Icon Arrow Expand 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-expand-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-fork-2x2",
    "label": "Icon Arrow Fork 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-fork-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-left-2x2",
    "label": "Icon Arrow Left 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-left-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-left-right-2x2",
    "label": "Icon Arrow Left Right 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-left-right-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-merge-2x2",
    "label": "Icon Arrow Merge 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-merge-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-redo-2x2",
    "label": "Icon Arrow Redo 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-redo-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-right-2x2",
    "label": "Icon Arrow Right 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-right-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-rotate-ccw-2x2",
    "label": "Icon Arrow Rotate Ccw 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-rotate-ccw-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-rotate-cw-2x2",
    "label": "Icon Arrow Rotate Cw 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-rotate-cw-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-shuffle-2x2",
    "label": "Icon Arrow Shuffle 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-shuffle-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-sort-2x2",
    "label": "Icon Arrow Sort 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-sort-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-trend-down-2x2",
    "label": "Icon Arrow Trend Down 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-trend-down-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-trend-up-2x2",
    "label": "Icon Arrow Trend Up 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-trend-up-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-undo-2x2",
    "label": "Icon Arrow Undo 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-undo-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-2x2",
    "label": "Icon Arrow Up 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-up-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-down-2x2",
    "label": "Icon Arrow Up Down 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-up-down-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-left-2x2",
    "label": "Icon Arrow Up Left 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-up-left-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-right-2x2",
    "label": "Icon Arrow Up Right 2x2",
    "category": "arraw_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-arrow-up-right-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-back-3x3",
    "label": "Icon Arrow Back 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-back-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-bounce-3x3",
    "label": "Icon Arrow Bounce 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-bounce-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-down-3x3",
    "label": "Icon Arrow Circle Down 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-circle-down-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-left-3x3",
    "label": "Icon Arrow Circle Left 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-circle-left-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-right-3x3",
    "label": "Icon Arrow Circle Right 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-circle-right-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-circle-up-3x3",
    "label": "Icon Arrow Circle Up 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-circle-up-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-collapse-3x3",
    "label": "Icon Arrow Collapse 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-collapse-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-down-3x3",
    "label": "Icon Arrow Double Down 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-double-down-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-left-3x3",
    "label": "Icon Arrow Double Left 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-double-left-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-right-3x3",
    "label": "Icon Arrow Double Right 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-double-right-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-double-up-3x3",
    "label": "Icon Arrow Double Up 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-double-up-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-down-3x3",
    "label": "Icon Arrow Down 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-down-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-down-left-3x3",
    "label": "Icon Arrow Down Left 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-down-left-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-down-right-3x3",
    "label": "Icon Arrow Down Right 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-down-right-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-enter-3x3",
    "label": "Icon Arrow Enter 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-enter-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-expand-3x3",
    "label": "Icon Arrow Expand 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-expand-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-fork-3x3",
    "label": "Icon Arrow Fork 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-fork-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-left-3x3",
    "label": "Icon Arrow Left 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-left-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-left-right-3x3",
    "label": "Icon Arrow Left Right 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-left-right-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-merge-3x3",
    "label": "Icon Arrow Merge 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-merge-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-redo-3x3",
    "label": "Icon Arrow Redo 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-redo-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-right-3x3",
    "label": "Icon Arrow Right 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-right-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-rotate-ccw-3x3",
    "label": "Icon Arrow Rotate Ccw 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-rotate-ccw-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-rotate-cw-3x3",
    "label": "Icon Arrow Rotate Cw 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-rotate-cw-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-shuffle-3x3",
    "label": "Icon Arrow Shuffle 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-shuffle-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-sort-3x3",
    "label": "Icon Arrow Sort 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-sort-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-trend-down-3x3",
    "label": "Icon Arrow Trend Down 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-trend-down-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-trend-up-3x3",
    "label": "Icon Arrow Trend Up 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-trend-up-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-undo-3x3",
    "label": "Icon Arrow Undo 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-undo-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-3x3",
    "label": "Icon Arrow Up 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-up-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-down-3x3",
    "label": "Icon Arrow Up Down 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-up-down-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-left-3x3",
    "label": "Icon Arrow Up Left 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-up-left-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-arrow-up-right-3x3",
    "label": "Icon Arrow Up Right 3x3",
    "category": "arraw_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-arrow-up-right-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-atom-1x2",
    "label": "Banner Atom 1x2",
    "category": "banner__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/banner-atom-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-atom-1x3",
    "label": "Banner Atom 1x3",
    "category": "banner__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/banner-atom-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-atom-1x4",
    "label": "Banner Atom 1x4",
    "category": "banner__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/banner-atom-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-bio-1x2",
    "label": "Banner Bio 1x2",
    "category": "banner__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/banner-bio-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-bio-1x3",
    "label": "Banner Bio 1x3",
    "category": "banner__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/banner-bio-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-bio-1x4",
    "label": "Banner Bio 1x4",
    "category": "banner__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/banner-bio-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-blue-1x2",
    "label": "Banner Blue 1x2",
    "category": "banner__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/banner-blue-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-blue-1x3",
    "label": "Banner Blue 1x3",
    "category": "banner__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/banner-blue-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-blue-1x4",
    "label": "Banner Blue 1x4",
    "category": "banner__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/banner-blue-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-bolt-1x2",
    "label": "Banner Bolt 1x2",
    "category": "banner__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/banner-bolt-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-bolt-1x3",
    "label": "Banner Bolt 1x3",
    "category": "banner__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/banner-bolt-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-bolt-1x4",
    "label": "Banner Bolt 1x4",
    "category": "banner__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/banner-bolt-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-diamond-1x2",
    "label": "Banner Diamond 1x2",
    "category": "banner__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/banner-diamond-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-diamond-1x3",
    "label": "Banner Diamond 1x3",
    "category": "banner__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/banner-diamond-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-diamond-1x4",
    "label": "Banner Diamond 1x4",
    "category": "banner__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/banner-diamond-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-flame-1x2",
    "label": "Banner Flame 1x2",
    "category": "banner__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/banner-flame-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-flame-1x3",
    "label": "Banner Flame 1x3",
    "category": "banner__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/banner-flame-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-flame-1x4",
    "label": "Banner Flame 1x4",
    "category": "banner__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/banner-flame-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-gear-1x2",
    "label": "Banner Gear 1x2",
    "category": "banner__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/banner-gear-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-gear-1x3",
    "label": "Banner Gear 1x3",
    "category": "banner__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/banner-gear-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-gear-1x4",
    "label": "Banner Gear 1x4",
    "category": "banner__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/banner-gear-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-green-1x2",
    "label": "Banner Green 1x2",
    "category": "banner__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/banner-green-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-green-1x3",
    "label": "Banner Green 1x3",
    "category": "banner__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/banner-green-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-green-1x4",
    "label": "Banner Green 1x4",
    "category": "banner__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/banner-green-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-red-1x2",
    "label": "Banner Red 1x2",
    "category": "banner__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/banner-red-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-red-1x3",
    "label": "Banner Red 1x3",
    "category": "banner__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/banner-red-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-red-1x4",
    "label": "Banner Red 1x4",
    "category": "banner__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/banner-red-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-skull-1x2",
    "label": "Banner Skull 1x2",
    "category": "banner__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/banner-skull-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-skull-1x3",
    "label": "Banner Skull 1x3",
    "category": "banner__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/banner-skull-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-skull-1x4",
    "label": "Banner Skull 1x4",
    "category": "banner__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/banner-skull-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-spore-1x2",
    "label": "Banner Spore 1x2",
    "category": "banner__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/banner-spore-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-spore-1x3",
    "label": "Banner Spore 1x3",
    "category": "banner__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/banner-spore-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-spore-1x4",
    "label": "Banner Spore 1x4",
    "category": "banner__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/banner-spore-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-star-1x2",
    "label": "Banner Star 1x2",
    "category": "banner__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/banner-star-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-star-1x3",
    "label": "Banner Star 1x3",
    "category": "banner__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/banner-star-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-star-1x4",
    "label": "Banner Star 1x4",
    "category": "banner__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/banner-star-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-tech-1x2",
    "label": "Banner Tech 1x2",
    "category": "banner__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/banner-tech-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-tech-1x3",
    "label": "Banner Tech 1x3",
    "category": "banner__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/banner-tech-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-tech-1x4",
    "label": "Banner Tech 1x4",
    "category": "banner__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/banner-tech-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-warning-1x2",
    "label": "Banner Warning 1x2",
    "category": "banner__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/banner-warning-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-warning-1x3",
    "label": "Banner Warning 1x3",
    "category": "banner__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/banner-warning-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-warning-1x4",
    "label": "Banner Warning 1x4",
    "category": "banner__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/banner-warning-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-wave-1x2",
    "label": "Banner Wave 1x2",
    "category": "banner__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/banner-wave-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-wave-1x3",
    "label": "Banner Wave 1x3",
    "category": "banner__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/banner-wave-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "banner-wave-1x4",
    "label": "Banner Wave 1x4",
    "category": "banner__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/banner-wave-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-alert-1x2",
    "label": "Beacon Alert 1x2",
    "category": "beacon__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/beacon-alert-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-alert-1x3",
    "label": "Beacon Alert 1x3",
    "category": "beacon__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/beacon-alert-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-amber-1x2",
    "label": "Beacon Amber 1x2",
    "category": "beacon__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/beacon-amber-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-amber-1x3",
    "label": "Beacon Amber 1x3",
    "category": "beacon__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/beacon-amber-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-bio-1x2",
    "label": "Beacon Bio 1x2",
    "category": "beacon__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/beacon-bio-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-bio-1x3",
    "label": "Beacon Bio 1x3",
    "category": "beacon__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/beacon-bio-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-cyan-1x2",
    "label": "Beacon Cyan 1x2",
    "category": "beacon__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/beacon-cyan-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-cyan-1x3",
    "label": "Beacon Cyan 1x3",
    "category": "beacon__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/beacon-cyan-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-ice-1x2",
    "label": "Beacon Ice 1x2",
    "category": "beacon__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/beacon-ice-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-ice-1x3",
    "label": "Beacon Ice 1x3",
    "category": "beacon__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/beacon-ice-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-moth-1x2",
    "label": "Beacon Moth 1x2",
    "category": "beacon__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/beacon-moth-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-moth-1x3",
    "label": "Beacon Moth 1x3",
    "category": "beacon__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/beacon-moth-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-rainbow-1x2",
    "label": "Beacon Rainbow 1x2",
    "category": "beacon__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/beacon-rainbow-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-rainbow-1x3",
    "label": "Beacon Rainbow 1x3",
    "category": "beacon__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/beacon-rainbow-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-spore-1x2",
    "label": "Beacon Spore 1x2",
    "category": "beacon__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/beacon-spore-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-spore-1x3",
    "label": "Beacon Spore 1x3",
    "category": "beacon__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/beacon-spore-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-strobe-1x2",
    "label": "Beacon Strobe 1x2",
    "category": "beacon__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/beacon-strobe-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-strobe-1x3",
    "label": "Beacon Strobe 1x3",
    "category": "beacon__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/beacon-strobe-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-torch-1x2",
    "label": "Beacon Torch 1x2",
    "category": "beacon__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/beacon-torch-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-torch-1x3",
    "label": "Beacon Torch 1x3",
    "category": "beacon__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/beacon-torch-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-alert-1x1",
    "label": "Beacon Alert 1x1",
    "category": "beacon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/beacon-alert-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-amber-1x1",
    "label": "Beacon Amber 1x1",
    "category": "beacon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/beacon-amber-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-bio-1x1",
    "label": "Beacon Bio 1x1",
    "category": "beacon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/beacon-bio-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-cyan-1x1",
    "label": "Beacon Cyan 1x1",
    "category": "beacon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/beacon-cyan-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-ice-1x1",
    "label": "Beacon Ice 1x1",
    "category": "beacon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/beacon-ice-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-moth-1x1",
    "label": "Beacon Moth 1x1",
    "category": "beacon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/beacon-moth-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-rainbow-1x1",
    "label": "Beacon Rainbow 1x1",
    "category": "beacon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/beacon-rainbow-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-spore-1x1",
    "label": "Beacon Spore 1x1",
    "category": "beacon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/beacon-spore-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-strobe-1x1",
    "label": "Beacon Strobe 1x1",
    "category": "beacon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/beacon-strobe-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "beacon-torch-1x1",
    "label": "Beacon Torch 1x1",
    "category": "beacon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/beacon-torch-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-bio-membrane-1x1",
    "label": "Bg Bio Membrane 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-bio-membrane-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-blueprint-1x1",
    "label": "Bg Blueprint 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-blueprint-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-brick-dark-1x1",
    "label": "Bg Brick Dark 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-brick-dark-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-brick-red-1x1",
    "label": "Bg Brick Red 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-brick-red-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-brick-white-1x1",
    "label": "Bg Brick White 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-brick-white-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-cables-1x1",
    "label": "Bg Cables 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-cables-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-carbon-1x1",
    "label": "Bg Carbon 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-carbon-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-circuit-1x1",
    "label": "Bg Circuit 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-circuit-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-concrete-1x1",
    "label": "Bg Concrete 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-concrete-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-concrete-crack-1x1",
    "label": "Bg Concrete Crack 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-concrete-crack-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-corrugated-1x1",
    "label": "Bg Corrugated 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-corrugated-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-crate-face-1x1",
    "label": "Bg Crate Face 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-crate-face-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-diamond-plate-1x1",
    "label": "Bg Diamond Plate 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-diamond-plate-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-glass-block-1x1",
    "label": "Bg Glass Block 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-glass-block-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-grime-1x1",
    "label": "Bg Grime 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-grime-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-hex-1x1",
    "label": "Bg Hex 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-hex-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-honeycomb-1x1",
    "label": "Bg Honeycomb 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-honeycomb-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-insulation-1x1",
    "label": "Bg Insulation 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-insulation-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-led-grid-1x1",
    "label": "Bg Led Grid 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-led-grid-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-metal-bronze-1x1",
    "label": "Bg Metal Bronze 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-metal-bronze-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-metal-dark-1x1",
    "label": "Bg Metal Dark 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-metal-dark-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-metal-plate-1x1",
    "label": "Bg Metal Plate 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-metal-plate-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-metal-rivet-1x1",
    "label": "Bg Metal Rivet 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-metal-rivet-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-neon-1x1",
    "label": "Bg Neon 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-neon-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-padded-1x1",
    "label": "Bg Padded 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-padded-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-panel-screen-1x1",
    "label": "Bg Panel Screen 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-panel-screen-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-panel-steel-1x1",
    "label": "Bg Panel Steel 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-panel-steel-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-panel-warning-1x1",
    "label": "Bg Panel Warning 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-panel-warning-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-pipes-1x1",
    "label": "Bg Pipes 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-pipes-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-poster-1x1",
    "label": "Bg Poster 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-poster-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-rust-1x1",
    "label": "Bg Rust 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-rust-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-spore-1x1",
    "label": "Bg Spore 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-spore-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-stars-1x1",
    "label": "Bg Stars 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-stars-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-stone-1x1",
    "label": "Bg Stone 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-stone-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-stripe-hazard-1x1",
    "label": "Bg Stripe Hazard 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-stripe-hazard-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-stripe-red-1x1",
    "label": "Bg Stripe Red 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-stripe-red-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-tile-green-1x1",
    "label": "Bg Tile Green 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-tile-green-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-tile-lab-1x1",
    "label": "Bg Tile Lab 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-tile-lab-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-tile-white-1x1",
    "label": "Bg Tile White 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-tile-white-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-vent-1x1",
    "label": "Bg Vent 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-vent-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-warning-band-1x1",
    "label": "Bg Warning Band 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-warning-band-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-window-1x1",
    "label": "Bg Window 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-window-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-window-bars-1x1",
    "label": "Bg Window Bars 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-window-bars-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "bg-wood-1x1",
    "label": "Bg Wood 1x1",
    "category": "bg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bg-wood-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-acid-1x1",
    "label": "Block Acid 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-acid-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-asphalt-1x1",
    "label": "Block Asphalt 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-asphalt-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-bio-gel-1x1",
    "label": "Block Bio Gel 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-bio-gel-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-brick-1x1",
    "label": "Block Brick 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-brick-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-bronze-1x1",
    "label": "Block Bronze 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-bronze-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-carbon-1x1",
    "label": "Block Carbon 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-carbon-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-ceramic-1x1",
    "label": "Block Ceramic 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-ceramic-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-checker-1x1",
    "label": "Block Checker 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-checker-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-circuit-1x1",
    "label": "Block Circuit 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-circuit-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-cobble-1x1",
    "label": "Block Cobble 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-cobble-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-concrete-1x1",
    "label": "Block Concrete 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-concrete-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-copper-1x1",
    "label": "Block Copper 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-copper-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-crystal-1x1",
    "label": "Block Crystal 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-crystal-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-diamond-1x1",
    "label": "Block Diamond 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-diamond-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-dirt-1x1",
    "label": "Block Dirt 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-dirt-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-glass-1x1",
    "label": "Block Glass 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-glass-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-gold-1x1",
    "label": "Block Gold 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-gold-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-grass-1x1",
    "label": "Block Grass 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-grass-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-grate-1x1",
    "label": "Block Grate 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-grate-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-gravel-1x1",
    "label": "Block Gravel 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-gravel-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-hazard-1x1",
    "label": "Block Hazard 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-hazard-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-hex-1x1",
    "label": "Block Hex 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-hex-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-ice-1x1",
    "label": "Block Ice 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-ice-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-lava-1x1",
    "label": "Block Lava 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-lava-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-marble-1x1",
    "label": "Block Marble 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-marble-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-mesh-1x1",
    "label": "Block Mesh 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-mesh-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-moss-1x1",
    "label": "Block Moss 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-moss-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-obsidian-1x1",
    "label": "Block Obsidian 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-obsidian-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-padded-1x1",
    "label": "Block Padded 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-padded-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-plasma-1x1",
    "label": "Block Plasma 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-plasma-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-rubber-1x1",
    "label": "Block Rubber 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-rubber-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-rust-1x1",
    "label": "Block Rust 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-rust-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-sand-1x1",
    "label": "Block Sand 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-sand-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-snow-1x1",
    "label": "Block Snow 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-snow-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-solar-1x1",
    "label": "Block Solar 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-solar-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-steel-1x1",
    "label": "Block Steel 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-steel-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-steel-lite-1x1",
    "label": "Block Steel Lite 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-steel-lite-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-tech-1x1",
    "label": "Block Tech 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-tech-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-vent-1x1",
    "label": "Block Vent 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-vent-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-void-1x1",
    "label": "Block Void 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-void-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-warning-1x1",
    "label": "Block Warning 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-warning-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-water-1x1",
    "label": "Block Water 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-water-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "block-wood-1x1",
    "label": "Block Wood 1x1",
    "category": "block_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/block-wood-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-farm-1x1",
    "label": "Bot Farm 1x1",
    "category": "bot_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bot-farm-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-haul-1x1",
    "label": "Bot Haul 1x1",
    "category": "bot_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bot-haul-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-king-1x1",
    "label": "Bot King 1x1",
    "category": "bot_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bot-king-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-medic-1x1",
    "label": "Bot Medic 1x1",
    "category": "bot_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bot-medic-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-mine-1x1",
    "label": "Bot Mine 1x1",
    "category": "bot_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bot-mine-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-pet-1x1",
    "label": "Bot Pet 1x1",
    "category": "bot_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bot-pet-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-scan-1x1",
    "label": "Bot Scan 1x1",
    "category": "bot_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bot-scan-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-sentry-1x1",
    "label": "Bot Sentry 1x1",
    "category": "bot_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bot-sentry-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-water-1x1",
    "label": "Bot Water 1x1",
    "category": "bot_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bot-water-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-weld-1x1",
    "label": "Bot Weld 1x1",
    "category": "bot_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/bot-weld-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-farm-2x2",
    "label": "Bot Farm 2x2",
    "category": "bot_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/bot-farm-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-haul-2x2",
    "label": "Bot Haul 2x2",
    "category": "bot_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/bot-haul-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-king-2x2",
    "label": "Bot King 2x2",
    "category": "bot_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/bot-king-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-medic-2x2",
    "label": "Bot Medic 2x2",
    "category": "bot_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/bot-medic-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-mine-2x2",
    "label": "Bot Mine 2x2",
    "category": "bot_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/bot-mine-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-pet-2x2",
    "label": "Bot Pet 2x2",
    "category": "bot_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/bot-pet-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-scan-2x2",
    "label": "Bot Scan 2x2",
    "category": "bot_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/bot-scan-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-sentry-2x2",
    "label": "Bot Sentry 2x2",
    "category": "bot_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/bot-sentry-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-water-2x2",
    "label": "Bot Water 2x2",
    "category": "bot_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/bot-water-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-weld-2x2",
    "label": "Bot Weld 2x2",
    "category": "bot_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/bot-weld-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-farm-3x3",
    "label": "Bot Farm 3x3",
    "category": "bot_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/bot-farm-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-haul-3x3",
    "label": "Bot Haul 3x3",
    "category": "bot_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/bot-haul-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-king-3x3",
    "label": "Bot King 3x3",
    "category": "bot_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/bot-king-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-medic-3x3",
    "label": "Bot Medic 3x3",
    "category": "bot_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/bot-medic-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-mine-3x3",
    "label": "Bot Mine 3x3",
    "category": "bot_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/bot-mine-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-pet-3x3",
    "label": "Bot Pet 3x3",
    "category": "bot_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/bot-pet-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-scan-3x3",
    "label": "Bot Scan 3x3",
    "category": "bot_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/bot-scan-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-sentry-3x3",
    "label": "Bot Sentry 3x3",
    "category": "bot_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/bot-sentry-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-water-3x3",
    "label": "Bot Water 3x3",
    "category": "bot_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/bot-water-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "bot-weld-3x3",
    "label": "Bot Weld 3x3",
    "category": "bot_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/bot-weld-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "cable-brick-1x1",
    "label": "Cable Brick 1x1",
    "category": "cable_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/cable-brick-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "cable-clip-1x1",
    "label": "Cable Clip 1x1",
    "category": "cable_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/cable-clip-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "cable-coil-1x1",
    "label": "Cable Coil 1x1",
    "category": "cable_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/cable-coil-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "cable-copper-1x1",
    "label": "Cable Copper 1x1",
    "category": "cable_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/cable-copper-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "cable-data-1x1",
    "label": "Cable Data 1x1",
    "category": "cable_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/cable-data-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "cable-fiber-1x1",
    "label": "Cable Fiber 1x1",
    "category": "cable_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/cable-fiber-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "cable-fuse-1x1",
    "label": "Cable Fuse 1x1",
    "category": "cable_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/cable-fuse-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "cable-gold-1x1",
    "label": "Cable Gold 1x1",
    "category": "cable_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/cable-gold-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "cable-ground-1x1",
    "label": "Cable Ground 1x1",
    "category": "cable_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/cable-ground-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "cable-ice-port-1x1",
    "label": "Cable Ice Port 1x1",
    "category": "cable_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/cable-ice-port-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "cable-nerve-1x1",
    "label": "Cable Nerve 1x1",
    "category": "cable_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/cable-nerve-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "cable-nub-1x1",
    "label": "Cable Nub 1x1",
    "category": "cable_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/cable-nub-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "cable-spark-1x1",
    "label": "Cable Spark 1x1",
    "category": "cable_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/cable-spark-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "cable-split-1x1",
    "label": "Cable Split 1x1",
    "category": "cable_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/cable-split-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "cable-triple-1x1",
    "label": "Cable Triple 1x1",
    "category": "cable_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/cable-triple-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "cable-void-1x1",
    "label": "Cable Void 1x1",
    "category": "cable_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/cable-void-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-0-1x1",
    "label": "Char 0 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-0-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-1-1x1",
    "label": "Char 1 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-1-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-2-1x1",
    "label": "Char 2 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-2-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-3-1x1",
    "label": "Char 3 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-3-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-4-1x1",
    "label": "Char 4 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-4-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-5-1x1",
    "label": "Char 5 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-5-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-6-1x1",
    "label": "Char 6 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-6-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-7-1x1",
    "label": "Char 7 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-7-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-8-1x1",
    "label": "Char 8 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-8-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-9-1x1",
    "label": "Char 9 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-9-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-A-1x1",
    "label": "Char A 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-A-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-B-1x1",
    "label": "Char B 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-B-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-C-1x1",
    "label": "Char C 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-C-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-D-1x1",
    "label": "Char D 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-D-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-E-1x1",
    "label": "Char E 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-E-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-F-1x1",
    "label": "Char F 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-F-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-G-1x1",
    "label": "Char G 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-G-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-H-1x1",
    "label": "Char H 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-H-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-I-1x1",
    "label": "Char I 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-I-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-J-1x1",
    "label": "Char J 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-J-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-K-1x1",
    "label": "Char K 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-K-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-L-1x1",
    "label": "Char L 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-L-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-M-1x1",
    "label": "Char M 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-M-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-N-1x1",
    "label": "Char N 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-N-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-O-1x1",
    "label": "Char O 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-O-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-P-1x1",
    "label": "Char P 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-P-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-Q-1x1",
    "label": "Char Q 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-Q-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-R-1x1",
    "label": "Char R 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-R-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-S-1x1",
    "label": "Char S 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-S-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-amp-1x1",
    "label": "Char Sym Amp 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-amp-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-at-1x1",
    "label": "Char Sym At 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-at-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-brace-l-1x1",
    "label": "Char Sym Brace L 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-brace-l-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-brace-r-1x1",
    "label": "Char Sym Brace R 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-brace-r-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-bslash-1x1",
    "label": "Char Sym Bslash 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-bslash-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-caret-1x1",
    "label": "Char Sym Caret 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-caret-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-colon-1x1",
    "label": "Char Sym Colon 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-colon-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-comma-1x1",
    "label": "Char Sym Comma 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-comma-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-dollar-1x1",
    "label": "Char Sym Dollar 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-dollar-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-dot-1x1",
    "label": "Char Sym Dot 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-dot-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-eq-1x1",
    "label": "Char Sym Eq 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-eq-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-excl-1x1",
    "label": "Char Sym Excl 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-excl-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-gt-1x1",
    "label": "Char Sym Gt 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-gt-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-hash-1x1",
    "label": "Char Sym Hash 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-hash-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-lbracket-1x1",
    "label": "Char Sym Lbracket 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-lbracket-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-lparen-1x1",
    "label": "Char Sym Lparen 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-lparen-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-lt-1x1",
    "label": "Char Sym Lt 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-lt-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-minus-1x1",
    "label": "Char Sym Minus 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-minus-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-pct-1x1",
    "label": "Char Sym Pct 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-pct-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-pipe-1x1",
    "label": "Char Sym Pipe 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-pipe-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-plus-1x1",
    "label": "Char Sym Plus 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-plus-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-quest-1x1",
    "label": "Char Sym Quest 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-quest-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-quote-1x1",
    "label": "Char Sym Quote 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-quote-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-rbracket-1x1",
    "label": "Char Sym Rbracket 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-rbracket-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-rparen-1x1",
    "label": "Char Sym Rparen 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-rparen-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-semi-1x1",
    "label": "Char Sym Semi 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-semi-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-slash-1x1",
    "label": "Char Sym Slash 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-slash-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-star-1x1",
    "label": "Char Sym Star 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-star-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-tilde-1x1",
    "label": "Char Sym Tilde 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-tilde-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-sym-underscore-1x1",
    "label": "Char Sym Underscore 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-sym-underscore-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-T-1x1",
    "label": "Char T 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-T-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-U-1x1",
    "label": "Char U 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-U-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-V-1x1",
    "label": "Char V 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-V-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-W-1x1",
    "label": "Char W 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-W-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-X-1x1",
    "label": "Char X 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-X-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-Y-1x1",
    "label": "Char Y 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-Y-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-Z-1x1",
    "label": "Char Z 1x1",
    "category": "char_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/char-Z-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-0-2x2",
    "label": "Char 0 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-0-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-1-2x2",
    "label": "Char 1 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-1-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-2-2x2",
    "label": "Char 2 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-2-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-3-2x2",
    "label": "Char 3 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-3-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-4-2x2",
    "label": "Char 4 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-4-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-5-2x2",
    "label": "Char 5 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-5-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-6-2x2",
    "label": "Char 6 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-6-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-7-2x2",
    "label": "Char 7 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-7-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-8-2x2",
    "label": "Char 8 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-8-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-9-2x2",
    "label": "Char 9 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-9-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-A-2x2",
    "label": "Char A 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-A-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-B-2x2",
    "label": "Char B 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-B-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-C-2x2",
    "label": "Char C 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-C-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-D-2x2",
    "label": "Char D 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-D-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-E-2x2",
    "label": "Char E 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-E-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-F-2x2",
    "label": "Char F 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-F-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-G-2x2",
    "label": "Char G 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-G-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-H-2x2",
    "label": "Char H 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-H-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-I-2x2",
    "label": "Char I 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-I-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-J-2x2",
    "label": "Char J 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-J-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-K-2x2",
    "label": "Char K 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-K-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-L-2x2",
    "label": "Char L 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-L-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-M-2x2",
    "label": "Char M 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-M-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-N-2x2",
    "label": "Char N 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-N-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-O-2x2",
    "label": "Char O 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-O-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-P-2x2",
    "label": "Char P 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-P-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-Q-2x2",
    "label": "Char Q 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-Q-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-R-2x2",
    "label": "Char R 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-R-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-S-2x2",
    "label": "Char S 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-S-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-T-2x2",
    "label": "Char T 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-T-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-U-2x2",
    "label": "Char U 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-U-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-V-2x2",
    "label": "Char V 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-V-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-W-2x2",
    "label": "Char W 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-W-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-X-2x2",
    "label": "Char X 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-X-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-Y-2x2",
    "label": "Char Y 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-Y-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "char-Z-2x2",
    "label": "Char Z 2x2",
    "category": "char_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/char-Z-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-coil-1x1",
    "label": "Core Coil 1x1",
    "category": "core_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/core-coil-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-copper-1x1",
    "label": "Core Copper 1x1",
    "category": "core_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/core-copper-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-fusion-1x1",
    "label": "Core Fusion 1x1",
    "category": "core_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/core-fusion-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-ice-1x1",
    "label": "Core Ice 1x1",
    "category": "core_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/core-ice-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-leaf-1x1",
    "label": "Core Leaf 1x1",
    "category": "core_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/core-leaf-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-magma-1x1",
    "label": "Core Magma 1x1",
    "category": "core_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/core-magma-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-prism-1x1",
    "label": "Core Prism 1x1",
    "category": "core_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/core-prism-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-sand-1x1",
    "label": "Core Sand 1x1",
    "category": "core_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/core-sand-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-spark-1x1",
    "label": "Core Spark 1x1",
    "category": "core_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/core-spark-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-spore-1x1",
    "label": "Core Spore 1x1",
    "category": "core_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/core-spore-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-tesla-1x1",
    "label": "Core Tesla 1x1",
    "category": "core_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/core-tesla-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-void-1x1",
    "label": "Core Void 1x1",
    "category": "core_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/core-void-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-coil-2x2",
    "label": "Core Coil 2x2",
    "category": "core_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/core-coil-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-copper-2x2",
    "label": "Core Copper 2x2",
    "category": "core_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/core-copper-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-fusion-2x2",
    "label": "Core Fusion 2x2",
    "category": "core_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/core-fusion-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-ice-2x2",
    "label": "Core Ice 2x2",
    "category": "core_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/core-ice-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-leaf-2x2",
    "label": "Core Leaf 2x2",
    "category": "core_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/core-leaf-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-magma-2x2",
    "label": "Core Magma 2x2",
    "category": "core_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/core-magma-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-prism-2x2",
    "label": "Core Prism 2x2",
    "category": "core_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/core-prism-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-sand-2x2",
    "label": "Core Sand 2x2",
    "category": "core_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/core-sand-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-spark-2x2",
    "label": "Core Spark 2x2",
    "category": "core_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/core-spark-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-spore-2x2",
    "label": "Core Spore 2x2",
    "category": "core_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/core-spore-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-tesla-2x2",
    "label": "Core Tesla 2x2",
    "category": "core_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/core-tesla-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "core-void-2x2",
    "label": "Core Void 2x2",
    "category": "core_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/core-void-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "crew-boss-1x2",
    "label": "Crew Boss 1x2",
    "category": "crew__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/crew-boss-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "crew-boss-1x3",
    "label": "Crew Boss 1x3",
    "category": "crew__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/crew-boss-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "crew-botanist-1x2",
    "label": "Crew Botanist 1x2",
    "category": "crew__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/crew-botanist-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "crew-botanist-1x3",
    "label": "Crew Botanist 1x3",
    "category": "crew__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/crew-botanist-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "crew-cook-1x2",
    "label": "Crew Cook 1x2",
    "category": "crew__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/crew-cook-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "crew-cook-1x3",
    "label": "Crew Cook 1x3",
    "category": "crew__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/crew-cook-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "crew-engineer-1x2",
    "label": "Crew Engineer 1x2",
    "category": "crew__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/crew-engineer-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "crew-engineer-1x3",
    "label": "Crew Engineer 1x3",
    "category": "crew__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/crew-engineer-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "crew-miner-1x2",
    "label": "Crew Miner 1x2",
    "category": "crew__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/crew-miner-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "crew-miner-1x3",
    "label": "Crew Miner 1x3",
    "category": "crew__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/crew-miner-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "crew-priest-1x2",
    "label": "Crew Priest 1x2",
    "category": "crew__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/crew-priest-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "crew-priest-1x3",
    "label": "Crew Priest 1x3",
    "category": "crew__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/crew-priest-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "crew-ranger-1x2",
    "label": "Crew Ranger 1x2",
    "category": "crew__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/crew-ranger-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "crew-ranger-1x3",
    "label": "Crew Ranger 1x3",
    "category": "crew__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/crew-ranger-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "crew-scout-1x2",
    "label": "Crew Scout 1x2",
    "category": "crew__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/crew-scout-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "crew-scout-1x3",
    "label": "Crew Scout 1x3",
    "category": "crew__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/crew-scout-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "debris-anchor-1x1",
    "label": "Debris Anchor 1x1",
    "category": "debris_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/debris-anchor-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "debris-banner-torn-1x1",
    "label": "Debris Banner Torn 1x1",
    "category": "debris_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/debris-banner-torn-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "debris-bone-pile-1x1",
    "label": "Debris Bone Pile 1x1",
    "category": "debris_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/debris-bone-pile-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "debris-brick-1x1",
    "label": "Debris Brick 1x1",
    "category": "debris_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/debris-brick-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "debris-circuit-1x1",
    "label": "Debris Circuit 1x1",
    "category": "debris_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/debris-circuit-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "debris-column-1x1",
    "label": "Debris Column 1x1",
    "category": "debris_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/debris-column-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "debris-crate-bit-1x1",
    "label": "Debris Crate Bit 1x1",
    "category": "debris_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/debris-crate-bit-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "debris-gear-1x1",
    "label": "Debris Gear 1x1",
    "category": "debris_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/debris-gear-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "debris-ice-shard-1x1",
    "label": "Debris Ice Shard 1x1",
    "category": "debris_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/debris-ice-shard-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "debris-mask-bit-1x1",
    "label": "Debris Mask Bit 1x1",
    "category": "debris_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/debris-mask-bit-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "debris-mosaic-1x1",
    "label": "Debris Mosaic 1x1",
    "category": "debris_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/debris-mosaic-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "debris-pipe-bit-1x1",
    "label": "Debris Pipe Bit 1x1",
    "category": "debris_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/debris-pipe-bit-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "debris-sand-drift-1x1",
    "label": "Debris Sand Drift 1x1",
    "category": "debris_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/debris-sand-drift-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "debris-statue-head-1x1",
    "label": "Debris Statue Head 1x1",
    "category": "debris_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/debris-statue-head-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "debris-tile-1x1",
    "label": "Debris Tile 1x1",
    "category": "debris_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/debris-tile-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "debris-urn-1x1",
    "label": "Debris Urn 1x1",
    "category": "debris_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/debris-urn-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "egg-crack-1x1",
    "label": "Egg Crack 1x1",
    "category": "egg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/egg-crack-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "egg-crystal-1x1",
    "label": "Egg Crystal 1x1",
    "category": "egg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/egg-crystal-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "egg-cyan-1x1",
    "label": "Egg Cyan 1x1",
    "category": "egg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/egg-cyan-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "egg-gold-1x1",
    "label": "Egg Gold 1x1",
    "category": "egg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/egg-gold-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "egg-ice-1x1",
    "label": "Egg Ice 1x1",
    "category": "egg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/egg-ice-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "egg-jelly-1x1",
    "label": "Egg Jelly 1x1",
    "category": "egg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/egg-jelly-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "egg-magma-1x1",
    "label": "Egg Magma 1x1",
    "category": "egg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/egg-magma-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "egg-nest-1x1",
    "label": "Egg Nest 1x1",
    "category": "egg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/egg-nest-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "egg-pink-1x1",
    "label": "Egg Pink 1x1",
    "category": "egg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/egg-pink-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "egg-royal-1x1",
    "label": "Egg Royal 1x1",
    "category": "egg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/egg-royal-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "egg-sand-1x1",
    "label": "Egg Sand 1x1",
    "category": "egg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/egg-sand-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "egg-spore-1x1",
    "label": "Egg Spore 1x1",
    "category": "egg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/egg-spore-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "egg-spot-1x1",
    "label": "Egg Spot 1x1",
    "category": "egg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/egg-spot-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "egg-tiny-1x1",
    "label": "Egg Tiny 1x1",
    "category": "egg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/egg-tiny-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "egg-twin-1x1",
    "label": "Egg Twin 1x1",
    "category": "egg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/egg-twin-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "egg-void-1x1",
    "label": "Egg Void 1x1",
    "category": "egg_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/egg-void-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-alien-1x1",
    "label": "Emoji Alien 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-alien-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-angel-1x1",
    "label": "Emoji Angel 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-angel-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-angry-1x1",
    "label": "Emoji Angry 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-angry-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-cat-1x1",
    "label": "Emoji Cat 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-cat-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-cool-1x1",
    "label": "Emoji Cool 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-cool-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-cry-1x1",
    "label": "Emoji Cry 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-cry-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-dead-1x1",
    "label": "Emoji Dead 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-dead-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-devil-1x1",
    "label": "Emoji Devil 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-devil-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-grin-1x1",
    "label": "Emoji Grin 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-grin-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-heart-eyes-1x1",
    "label": "Emoji Heart Eyes 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-heart-eyes-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-kiss-1x1",
    "label": "Emoji Kiss 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-kiss-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-laugh-1x1",
    "label": "Emoji Laugh 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-laugh-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-love-1x1",
    "label": "Emoji Love 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-love-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-mindblown-1x1",
    "label": "Emoji Mindblown 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-mindblown-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-money-1x1",
    "label": "Emoji Money 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-money-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-nerd-1x1",
    "label": "Emoji Nerd 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-nerd-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-nervous-1x1",
    "label": "Emoji Nervous 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-nervous-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-party-1x1",
    "label": "Emoji Party 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-party-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-robot-1x1",
    "label": "Emoji Robot 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-robot-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sad-1x1",
    "label": "Emoji Sad 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-sad-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-shocked-1x1",
    "label": "Emoji Shocked 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-shocked-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sick-1x1",
    "label": "Emoji Sick 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-sick-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-skull-1x1",
    "label": "Emoji Skull 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-skull-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sleepy-1x1",
    "label": "Emoji Sleepy 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-sleepy-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-smile-1x1",
    "label": "Emoji Smile 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-smile-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-smirk-1x1",
    "label": "Emoji Smirk 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-smirk-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-star-eyes-1x1",
    "label": "Emoji Star Eyes 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-star-eyes-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sunglasses-1x1",
    "label": "Emoji Sunglasses 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-sunglasses-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-thinking-1x1",
    "label": "Emoji Thinking 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-thinking-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-wink-1x1",
    "label": "Emoji Wink 1x1",
    "category": "emoji_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/emoji-wink-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-alien-2x2",
    "label": "Emoji Alien 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-alien-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-angel-2x2",
    "label": "Emoji Angel 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-angel-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-angry-2x2",
    "label": "Emoji Angry 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-angry-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-cat-2x2",
    "label": "Emoji Cat 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-cat-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-cool-2x2",
    "label": "Emoji Cool 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-cool-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-cry-2x2",
    "label": "Emoji Cry 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-cry-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-dead-2x2",
    "label": "Emoji Dead 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-dead-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-devil-2x2",
    "label": "Emoji Devil 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-devil-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-grin-2x2",
    "label": "Emoji Grin 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-grin-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-heart-eyes-2x2",
    "label": "Emoji Heart Eyes 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-heart-eyes-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-kiss-2x2",
    "label": "Emoji Kiss 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-kiss-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-laugh-2x2",
    "label": "Emoji Laugh 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-laugh-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-love-2x2",
    "label": "Emoji Love 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-love-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-mindblown-2x2",
    "label": "Emoji Mindblown 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-mindblown-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-money-2x2",
    "label": "Emoji Money 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-money-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-nerd-2x2",
    "label": "Emoji Nerd 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-nerd-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-nervous-2x2",
    "label": "Emoji Nervous 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-nervous-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-party-2x2",
    "label": "Emoji Party 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-party-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-robot-2x2",
    "label": "Emoji Robot 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-robot-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sad-2x2",
    "label": "Emoji Sad 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-sad-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-shocked-2x2",
    "label": "Emoji Shocked 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-shocked-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sick-2x2",
    "label": "Emoji Sick 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-sick-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-skull-2x2",
    "label": "Emoji Skull 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-skull-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sleepy-2x2",
    "label": "Emoji Sleepy 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-sleepy-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-smile-2x2",
    "label": "Emoji Smile 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-smile-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-smirk-2x2",
    "label": "Emoji Smirk 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-smirk-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-star-eyes-2x2",
    "label": "Emoji Star Eyes 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-star-eyes-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sunglasses-2x2",
    "label": "Emoji Sunglasses 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-sunglasses-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-thinking-2x2",
    "label": "Emoji Thinking 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-thinking-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-wink-2x2",
    "label": "Emoji Wink 2x2",
    "category": "emoji_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/emoji-wink-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-alien-3x3",
    "label": "Emoji Alien 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-alien-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-angel-3x3",
    "label": "Emoji Angel 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-angel-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-angry-3x3",
    "label": "Emoji Angry 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-angry-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-cat-3x3",
    "label": "Emoji Cat 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-cat-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-cool-3x3",
    "label": "Emoji Cool 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-cool-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-cry-3x3",
    "label": "Emoji Cry 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-cry-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-dead-3x3",
    "label": "Emoji Dead 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-dead-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-devil-3x3",
    "label": "Emoji Devil 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-devil-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-grin-3x3",
    "label": "Emoji Grin 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-grin-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-heart-eyes-3x3",
    "label": "Emoji Heart Eyes 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-heart-eyes-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-kiss-3x3",
    "label": "Emoji Kiss 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-kiss-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-laugh-3x3",
    "label": "Emoji Laugh 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-laugh-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-love-3x3",
    "label": "Emoji Love 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-love-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-mindblown-3x3",
    "label": "Emoji Mindblown 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-mindblown-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-money-3x3",
    "label": "Emoji Money 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-money-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-nerd-3x3",
    "label": "Emoji Nerd 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-nerd-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-nervous-3x3",
    "label": "Emoji Nervous 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-nervous-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-party-3x3",
    "label": "Emoji Party 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-party-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-robot-3x3",
    "label": "Emoji Robot 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-robot-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sad-3x3",
    "label": "Emoji Sad 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-sad-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-shocked-3x3",
    "label": "Emoji Shocked 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-shocked-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sick-3x3",
    "label": "Emoji Sick 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-sick-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-skull-3x3",
    "label": "Emoji Skull 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-skull-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sleepy-3x3",
    "label": "Emoji Sleepy 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-sleepy-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-smile-3x3",
    "label": "Emoji Smile 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-smile-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-smirk-3x3",
    "label": "Emoji Smirk 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-smirk-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-star-eyes-3x3",
    "label": "Emoji Star Eyes 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-star-eyes-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-sunglasses-3x3",
    "label": "Emoji Sunglasses 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-sunglasses-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-thinking-3x3",
    "label": "Emoji Thinking 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-thinking-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "emoji-wink-3x3",
    "label": "Emoji Wink 3x3",
    "category": "emoji_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/emoji-wink-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "fence-amber-2x1",
    "label": "Fence Amber 2x1",
    "category": "fence__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/fence-amber-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "fence-amber-1x1",
    "label": "Fence Amber 1x1",
    "category": "fence_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/fence-amber-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "fence-bio-1x1",
    "label": "Fence Bio 1x1",
    "category": "fence_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/fence-bio-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "fence-cyan-1x1",
    "label": "Fence Cyan 1x1",
    "category": "fence_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/fence-cyan-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "fence-ice-1x1",
    "label": "Fence Ice 1x1",
    "category": "fence_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/fence-ice-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "fence-magma-1x1",
    "label": "Fence Magma 1x1",
    "category": "fence_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/fence-magma-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "fence-pink-1x1",
    "label": "Fence Pink 1x1",
    "category": "fence_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/fence-pink-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "fence-red-1x1",
    "label": "Fence Red 1x1",
    "category": "fence_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/fence-red-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "fence-void-1x1",
    "label": "Fence Void 1x1",
    "category": "fence_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/fence-void-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "flora-blue-shroom-1x1",
    "label": "Flora Blue Shroom 1x1",
    "category": "flora_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/flora-blue-shroom-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "flora-cave-moss-1x1",
    "label": "Flora Cave Moss 1x1",
    "category": "flora_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/flora-cave-moss-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "flora-cluster-1x1",
    "label": "Flora Cluster 1x1",
    "category": "flora_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/flora-cluster-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "flora-crystal-bloom-1x1",
    "label": "Flora Crystal Bloom 1x1",
    "category": "flora_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/flora-crystal-bloom-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "flora-glow-root-1x1",
    "label": "Flora Glow Root 1x1",
    "category": "flora_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/flora-glow-root-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "flora-glowcap-1x1",
    "label": "Flora Glowcap 1x1",
    "category": "flora_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/flora-glowcap-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "flora-ice-flower-1x1",
    "label": "Flora Ice Flower 1x1",
    "category": "flora_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/flora-ice-flower-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "flora-night-cap-1x1",
    "label": "Flora Night Cap 1x1",
    "category": "flora_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/flora-night-cap-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "flora-pink-shroom-1x1",
    "label": "Flora Pink Shroom 1x1",
    "category": "flora_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/flora-pink-shroom-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "flora-puffball-1x1",
    "label": "Flora Puffball 1x1",
    "category": "flora_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/flora-puffball-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "flora-sand-cactus-1x1",
    "label": "Flora Sand Cactus 1x1",
    "category": "flora_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/flora-sand-cactus-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "flora-shelf-1x1",
    "label": "Flora Shelf 1x1",
    "category": "flora_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/flora-shelf-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "flora-spore-fern-1x1",
    "label": "Flora Spore Fern 1x1",
    "category": "flora_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/flora-spore-fern-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "flora-tall-fungus-1x1",
    "label": "Flora Tall Fungus 1x1",
    "category": "flora_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/flora-tall-fungus-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "flora-tiny-tree-1x1",
    "label": "Flora Tiny Tree 1x1",
    "category": "flora_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/flora-tiny-tree-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "flora-vine-sprout-1x1",
    "label": "Flora Vine Sprout 1x1",
    "category": "flora_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/flora-vine-sprout-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-bed-3x2",
    "label": "Garden Bed 3x2",
    "category": "garden__",
    "width": 48,
    "height": 32,
    "filePath": "assets/garden-bed-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-bench-2x1",
    "label": "Garden Bench 2x1",
    "category": "garden__",
    "width": 32,
    "height": 16,
    "filePath": "assets/garden-bench-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-climber-1x2",
    "label": "Garden Climber 1x2",
    "category": "garden__",
    "width": 16,
    "height": 32,
    "filePath": "assets/garden-climber-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-crops-3x2",
    "label": "Garden Crops 3x2",
    "category": "garden__",
    "width": 48,
    "height": 32,
    "filePath": "assets/garden-crops-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-fence-2x1",
    "label": "Garden Fence 2x1",
    "category": "garden__",
    "width": 32,
    "height": 16,
    "filePath": "assets/garden-fence-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-fence-3x2",
    "label": "Garden Fence 3x2",
    "category": "garden__",
    "width": 48,
    "height": 32,
    "filePath": "assets/garden-fence-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-flowerbed-2x1",
    "label": "Garden Flowerbed 2x1",
    "category": "garden__",
    "width": 32,
    "height": 16,
    "filePath": "assets/garden-flowerbed-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-fountain-1x3",
    "label": "Garden Fountain 1x3",
    "category": "garden__",
    "width": 16,
    "height": 48,
    "filePath": "assets/garden-fountain-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-greenhouse-3x2",
    "label": "Garden Greenhouse 3x2",
    "category": "garden__",
    "width": 48,
    "height": 32,
    "filePath": "assets/garden-greenhouse-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-greenhouse-4x4",
    "label": "Garden Greenhouse 4x4",
    "category": "garden__",
    "width": 64,
    "height": 64,
    "filePath": "assets/garden-greenhouse-4x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-hedge-2x1",
    "label": "Garden Hedge 2x1",
    "category": "garden__",
    "width": 32,
    "height": 16,
    "filePath": "assets/garden-hedge-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-lamp-1x2",
    "label": "Garden Lamp 1x2",
    "category": "garden__",
    "width": 16,
    "height": 32,
    "filePath": "assets/garden-lamp-1x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-lamp-1x3",
    "label": "Garden Lamp 1x3",
    "category": "garden__",
    "width": 16,
    "height": 48,
    "filePath": "assets/garden-lamp-1x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-obelisk-1x2",
    "label": "Garden Obelisk 1x2",
    "category": "garden__",
    "width": 16,
    "height": 32,
    "filePath": "assets/garden-obelisk-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-park-4x4",
    "label": "Garden Park 4x4",
    "category": "garden__",
    "width": 64,
    "height": 64,
    "filePath": "assets/garden-park-4x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-path-2x1",
    "label": "Garden Path 2x1",
    "category": "garden__",
    "width": 32,
    "height": 16,
    "filePath": "assets/garden-path-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-patio-4x4",
    "label": "Garden Patio 4x4",
    "category": "garden__",
    "width": 64,
    "height": 64,
    "filePath": "assets/garden-patio-4x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-pergola-3x2",
    "label": "Garden Pergola 3x2",
    "category": "garden__",
    "width": 48,
    "height": 32,
    "filePath": "assets/garden-pergola-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-pond-3x2",
    "label": "Garden Pond 3x2",
    "category": "garden__",
    "width": 48,
    "height": 32,
    "filePath": "assets/garden-pond-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-pond-4x4",
    "label": "Garden Pond 4x4",
    "category": "garden__",
    "width": 64,
    "height": 64,
    "filePath": "assets/garden-pond-4x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-tallpot-1x2",
    "label": "Garden Tallpot 1x2",
    "category": "garden__",
    "width": 16,
    "height": 32,
    "filePath": "assets/garden-tallpot-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-tree-1x2",
    "label": "Garden Tree 1x2",
    "category": "garden__",
    "width": 16,
    "height": 32,
    "filePath": "assets/garden-tree-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-tree-1x3",
    "label": "Garden Tree 1x3",
    "category": "garden__",
    "width": 16,
    "height": 48,
    "filePath": "assets/garden-tree-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-trellis-1x2",
    "label": "Garden Trellis 1x2",
    "category": "garden__",
    "width": 16,
    "height": 32,
    "filePath": "assets/garden-trellis-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-trellis-1x3",
    "label": "Garden Trellis 1x3",
    "category": "garden__",
    "width": 16,
    "height": 48,
    "filePath": "assets/garden-trellis-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-trough-2x1",
    "label": "Garden Trough 2x1",
    "category": "garden__",
    "width": 32,
    "height": 16,
    "filePath": "assets/garden-trough-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-bush-1x1",
    "label": "Garden Bush 1x1",
    "category": "garden_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/garden-bush-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-fencepost-1x1",
    "label": "Garden Fencepost 1x1",
    "category": "garden_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/garden-fencepost-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-flower-1x1",
    "label": "Garden Flower 1x1",
    "category": "garden_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/garden-flower-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-herbs-1x1",
    "label": "Garden Herbs 1x1",
    "category": "garden_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/garden-herbs-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-lantern-1x1",
    "label": "Garden Lantern 1x1",
    "category": "garden_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/garden-lantern-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-pot-1x1",
    "label": "Garden Pot 1x1",
    "category": "garden_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/garden-pot-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-rock-1x1",
    "label": "Garden Rock 1x1",
    "category": "garden_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/garden-rock-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-sapling-1x1",
    "label": "Garden Sapling 1x1",
    "category": "garden_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/garden-sapling-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-bench-2x2",
    "label": "Garden Bench 2x2",
    "category": "garden_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/garden-bench-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-composter-2x2",
    "label": "Garden Composter 2x2",
    "category": "garden_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/garden-composter-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-crate-2x2",
    "label": "Garden Crate 2x2",
    "category": "garden_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/garden-crate-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-fountain-2x2",
    "label": "Garden Fountain 2x2",
    "category": "garden_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/garden-fountain-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-rows-2x2",
    "label": "Garden Rows 2x2",
    "category": "garden_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/garden-rows-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-shrubs-2x2",
    "label": "Garden Shrubs 2x2",
    "category": "garden_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/garden-shrubs-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-table-2x2",
    "label": "Garden Table 2x2",
    "category": "garden_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/garden-table-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-well-2x2",
    "label": "Garden Well 2x2",
    "category": "garden_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/garden-well-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-fountain-3x3",
    "label": "Garden Fountain 3x3",
    "category": "garden_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/garden-fountain-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-gazebo-3x3",
    "label": "Garden Gazebo 3x3",
    "category": "garden_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/garden-gazebo-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-greenhouse-3x3",
    "label": "Garden Greenhouse 3x3",
    "category": "garden_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/garden-greenhouse-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "garden-orchard-3x3",
    "label": "Garden Orchard 3x3",
    "category": "garden_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/garden-orchard-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-amber-1x1",
    "label": "Gem Amber 1x1",
    "category": "gem_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/gem-amber-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-cyan-1x1",
    "label": "Gem Cyan 1x1",
    "category": "gem_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/gem-cyan-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-gold-1x1",
    "label": "Gem Gold 1x1",
    "category": "gem_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/gem-gold-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-ice-1x1",
    "label": "Gem Ice 1x1",
    "category": "gem_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/gem-ice-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-leaf-1x1",
    "label": "Gem Leaf 1x1",
    "category": "gem_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/gem-leaf-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-rose-1x1",
    "label": "Gem Rose 1x1",
    "category": "gem_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/gem-rose-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-ruby-1x1",
    "label": "Gem Ruby 1x1",
    "category": "gem_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/gem-ruby-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-void-1x1",
    "label": "Gem Void 1x1",
    "category": "gem_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/gem-void-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-amber-2x2",
    "label": "Gem Amber 2x2",
    "category": "gem_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/gem-amber-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-cyan-2x2",
    "label": "Gem Cyan 2x2",
    "category": "gem_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/gem-cyan-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-gold-2x2",
    "label": "Gem Gold 2x2",
    "category": "gem_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/gem-gold-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-ice-2x2",
    "label": "Gem Ice 2x2",
    "category": "gem_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/gem-ice-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-leaf-2x2",
    "label": "Gem Leaf 2x2",
    "category": "gem_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/gem-leaf-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-rose-2x2",
    "label": "Gem Rose 2x2",
    "category": "gem_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/gem-rose-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-ruby-2x2",
    "label": "Gem Ruby 2x2",
    "category": "gem_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/gem-ruby-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "gem-void-2x2",
    "label": "Gem Void 2x2",
    "category": "gem_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/gem-void-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-beetle-1x1",
    "label": "Glyph Beetle 1x1",
    "category": "glyph_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/glyph-beetle-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-chip-1x1",
    "label": "Glyph Chip 1x1",
    "category": "glyph_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/glyph-chip-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-eye-1x1",
    "label": "Glyph Eye 1x1",
    "category": "glyph_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/glyph-eye-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-gate-1x1",
    "label": "Glyph Gate 1x1",
    "category": "glyph_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/glyph-gate-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-gear-sun-1x1",
    "label": "Glyph Gear Sun 1x1",
    "category": "glyph_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/glyph-gear-sun-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-ladder-1x1",
    "label": "Glyph Ladder 1x1",
    "category": "glyph_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/glyph-ladder-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-mask-1x1",
    "label": "Glyph Mask 1x1",
    "category": "glyph_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/glyph-mask-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-mountain-1x1",
    "label": "Glyph Mountain 1x1",
    "category": "glyph_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/glyph-mountain-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-river-1x1",
    "label": "Glyph River 1x1",
    "category": "glyph_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/glyph-river-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-scarab-1x1",
    "label": "Glyph Scarab 1x1",
    "category": "glyph_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/glyph-scarab-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-seed-1x1",
    "label": "Glyph Seed 1x1",
    "category": "glyph_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/glyph-seed-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-spiral-1x1",
    "label": "Glyph Spiral 1x1",
    "category": "glyph_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/glyph-spiral-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-sun-1x1",
    "label": "Glyph Sun 1x1",
    "category": "glyph_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/glyph-sun-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-twin-moon-1x1",
    "label": "Glyph Twin Moon 1x1",
    "category": "glyph_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/glyph-twin-moon-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-void-1x1",
    "label": "Glyph Void 1x1",
    "category": "glyph_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/glyph-void-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-wave-1x1",
    "label": "Glyph Wave 1x1",
    "category": "glyph_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/glyph-wave-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-beetle-2x2",
    "label": "Glyph Beetle 2x2",
    "category": "glyph_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/glyph-beetle-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-chip-2x2",
    "label": "Glyph Chip 2x2",
    "category": "glyph_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/glyph-chip-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-eye-2x2",
    "label": "Glyph Eye 2x2",
    "category": "glyph_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/glyph-eye-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-gate-2x2",
    "label": "Glyph Gate 2x2",
    "category": "glyph_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/glyph-gate-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-gear-sun-2x2",
    "label": "Glyph Gear Sun 2x2",
    "category": "glyph_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/glyph-gear-sun-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-ladder-2x2",
    "label": "Glyph Ladder 2x2",
    "category": "glyph_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/glyph-ladder-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-mask-2x2",
    "label": "Glyph Mask 2x2",
    "category": "glyph_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/glyph-mask-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-mountain-2x2",
    "label": "Glyph Mountain 2x2",
    "category": "glyph_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/glyph-mountain-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-river-2x2",
    "label": "Glyph River 2x2",
    "category": "glyph_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/glyph-river-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-scarab-2x2",
    "label": "Glyph Scarab 2x2",
    "category": "glyph_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/glyph-scarab-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-seed-2x2",
    "label": "Glyph Seed 2x2",
    "category": "glyph_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/glyph-seed-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-spiral-2x2",
    "label": "Glyph Spiral 2x2",
    "category": "glyph_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/glyph-spiral-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-sun-2x2",
    "label": "Glyph Sun 2x2",
    "category": "glyph_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/glyph-sun-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-twin-moon-2x2",
    "label": "Glyph Twin Moon 2x2",
    "category": "glyph_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/glyph-twin-moon-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-void-2x2",
    "label": "Glyph Void 2x2",
    "category": "glyph_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/glyph-void-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "glyph-wave-2x2",
    "label": "Glyph Wave 2x2",
    "category": "glyph_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/glyph-wave-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-bio-1x2",
    "label": "Hatch Bio 1x2",
    "category": "hatch__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/hatch-bio-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-bronze-1x2",
    "label": "Hatch Bronze 1x2",
    "category": "hatch__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/hatch-bronze-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-grate-1x2",
    "label": "Hatch Grate 1x2",
    "category": "hatch__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/hatch-grate-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-hazard-1x2",
    "label": "Hatch Hazard 1x2",
    "category": "hatch__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/hatch-hazard-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-ice-1x2",
    "label": "Hatch Ice 1x2",
    "category": "hatch__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/hatch-ice-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-round-1x2",
    "label": "Hatch Round 1x2",
    "category": "hatch__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/hatch-round-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-shutter-1x2",
    "label": "Hatch Shutter 1x2",
    "category": "hatch__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/hatch-shutter-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-temple-1x2",
    "label": "Hatch Temple 1x2",
    "category": "hatch__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/hatch-temple-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-bio-2x2",
    "label": "Hatch Bio 2x2",
    "category": "hatch_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/hatch-bio-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-bronze-2x2",
    "label": "Hatch Bronze 2x2",
    "category": "hatch_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/hatch-bronze-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-grate-2x2",
    "label": "Hatch Grate 2x2",
    "category": "hatch_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/hatch-grate-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-hazard-2x2",
    "label": "Hatch Hazard 2x2",
    "category": "hatch_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/hatch-hazard-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-ice-2x2",
    "label": "Hatch Ice 2x2",
    "category": "hatch_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/hatch-ice-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-round-2x2",
    "label": "Hatch Round 2x2",
    "category": "hatch_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/hatch-round-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-shutter-2x2",
    "label": "Hatch Shutter 2x2",
    "category": "hatch_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/hatch-shutter-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "hatch-temple-2x2",
    "label": "Hatch Temple 2x2",
    "category": "hatch_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/hatch-temple-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-biome-2x2",
    "label": "Holo Biome 2x2",
    "category": "holo_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/holo-biome-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-cyan-2x2",
    "label": "Holo Cyan 2x2",
    "category": "holo_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/holo-cyan-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-ghost-2x2",
    "label": "Holo Ghost 2x2",
    "category": "holo_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/holo-ghost-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-map-2x2",
    "label": "Holo Map 2x2",
    "category": "holo_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/holo-map-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-playback-2x2",
    "label": "Holo Playback 2x2",
    "category": "holo_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/holo-playback-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-portrait-2x2",
    "label": "Holo Portrait 2x2",
    "category": "holo_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/holo-portrait-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-warn-2x2",
    "label": "Holo Warn 2x2",
    "category": "holo_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/holo-warn-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-waypoint-2x2",
    "label": "Holo Waypoint 2x2",
    "category": "holo_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/holo-waypoint-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-biome-3x3",
    "label": "Holo Biome 3x3",
    "category": "holo_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/holo-biome-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-cyan-3x3",
    "label": "Holo Cyan 3x3",
    "category": "holo_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/holo-cyan-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-ghost-3x3",
    "label": "Holo Ghost 3x3",
    "category": "holo_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/holo-ghost-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-map-3x3",
    "label": "Holo Map 3x3",
    "category": "holo_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/holo-map-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-playback-3x3",
    "label": "Holo Playback 3x3",
    "category": "holo_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/holo-playback-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-portrait-3x3",
    "label": "Holo Portrait 3x3",
    "category": "holo_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/holo-portrait-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-warn-3x3",
    "label": "Holo Warn 3x3",
    "category": "holo_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/holo-warn-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "holo-waypoint-3x3",
    "label": "Holo Waypoint 3x3",
    "category": "holo_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/holo-waypoint-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bathroom-4x4",
    "label": "Home Bathroom 4x4",
    "category": "home__",
    "width": 64,
    "height": 64,
    "filePath": "assets/home-bathroom-4x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bathtub-3x2",
    "label": "Home Bathtub 3x2",
    "category": "home__",
    "width": 48,
    "height": 32,
    "filePath": "assets/home-bathtub-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bed-3x2",
    "label": "Home Bed 3x2",
    "category": "home__",
    "width": 48,
    "height": 32,
    "filePath": "assets/home-bed-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bedroom-4x4",
    "label": "Home Bedroom 4x4",
    "category": "home__",
    "width": 64,
    "height": 64,
    "filePath": "assets/home-bedroom-4x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bench-2x1",
    "label": "Home Bench 2x1",
    "category": "home__",
    "width": 32,
    "height": 16,
    "filePath": "assets/home-bench-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bookrow-2x1",
    "label": "Home Bookrow 2x1",
    "category": "home__",
    "width": 32,
    "height": 16,
    "filePath": "assets/home-bookrow-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bookshelf-1x3",
    "label": "Home Bookshelf 1x3",
    "category": "home__",
    "width": 16,
    "height": 48,
    "filePath": "assets/home-bookshelf-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bookshelf-3x2",
    "label": "Home Bookshelf 3x2",
    "category": "home__",
    "width": 48,
    "height": 32,
    "filePath": "assets/home-bookshelf-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-cabinet-1x2",
    "label": "Home Cabinet 1x2",
    "category": "home__",
    "width": 16,
    "height": 32,
    "filePath": "assets/home-cabinet-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-coatstand-1x2",
    "label": "Home Coatstand 1x2",
    "category": "home__",
    "width": 16,
    "height": 32,
    "filePath": "assets/home-coatstand-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-conduit-1x3",
    "label": "Home Conduit 1x3",
    "category": "home__",
    "width": 16,
    "height": 48,
    "filePath": "assets/home-conduit-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-counter-3x2",
    "label": "Home Counter 3x2",
    "category": "home__",
    "width": 48,
    "height": 32,
    "filePath": "assets/home-counter-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-cushion-2x1",
    "label": "Home Cushion 2x1",
    "category": "home__",
    "width": 32,
    "height": 16,
    "filePath": "assets/home-cushion-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-desk-3x2",
    "label": "Home Desk 3x2",
    "category": "home__",
    "width": 48,
    "height": 32,
    "filePath": "assets/home-desk-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-dining-4x4",
    "label": "Home Dining 4x4",
    "category": "home__",
    "width": 64,
    "height": 64,
    "filePath": "assets/home-dining-4x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-floorlamp-1x2",
    "label": "Home Floorlamp 1x2",
    "category": "home__",
    "width": 16,
    "height": 32,
    "filePath": "assets/home-floorlamp-1x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-kitchen-4x4",
    "label": "Home Kitchen 4x4",
    "category": "home__",
    "width": 64,
    "height": 64,
    "filePath": "assets/home-kitchen-4x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-living-4x4",
    "label": "Home Living 4x4",
    "category": "home__",
    "width": 64,
    "height": 64,
    "filePath": "assets/home-living-4x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-locker-1x3",
    "label": "Home Locker 1x3",
    "category": "home__",
    "width": 16,
    "height": 48,
    "filePath": "assets/home-locker-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-mirror-1x2",
    "label": "Home Mirror 1x2",
    "category": "home__",
    "width": 16,
    "height": 32,
    "filePath": "assets/home-mirror-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-nightstand-1x2",
    "label": "Home Nightstand 1x2",
    "category": "home__",
    "width": 16,
    "height": 32,
    "filePath": "assets/home-nightstand-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-panel-1x3",
    "label": "Home Panel 1x3",
    "category": "home__",
    "width": 16,
    "height": 48,
    "filePath": "assets/home-panel-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-patio-4x4",
    "label": "Home Patio 4x4",
    "category": "home__",
    "width": 64,
    "height": 64,
    "filePath": "assets/home-patio-4x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-planter-2x1",
    "label": "Home Planter 2x1",
    "category": "home__",
    "width": 32,
    "height": 16,
    "filePath": "assets/home-planter-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-radiator-1x2",
    "label": "Home Radiator 1x2",
    "category": "home__",
    "width": 16,
    "height": 32,
    "filePath": "assets/home-radiator-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-radiator-2x1",
    "label": "Home Radiator 2x1",
    "category": "home__",
    "width": 32,
    "height": 16,
    "filePath": "assets/home-radiator-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-shelf-2x1",
    "label": "Home Shelf 2x1",
    "category": "home__",
    "width": 32,
    "height": 16,
    "filePath": "assets/home-shelf-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-sofa-3x2",
    "label": "Home Sofa 3x2",
    "category": "home__",
    "width": 48,
    "height": 32,
    "filePath": "assets/home-sofa-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-soundbar-2x1",
    "label": "Home Soundbar 2x1",
    "category": "home__",
    "width": 32,
    "height": 16,
    "filePath": "assets/home-soundbar-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-table-3x2",
    "label": "Home Table 3x2",
    "category": "home__",
    "width": 48,
    "height": 32,
    "filePath": "assets/home-table-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-tallplant-1x2",
    "label": "Home Tallplant 1x2",
    "category": "home__",
    "width": 16,
    "height": 32,
    "filePath": "assets/home-tallplant-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-torchere-1x3",
    "label": "Home Torchere 1x3",
    "category": "home__",
    "width": 16,
    "height": 48,
    "filePath": "assets/home-torchere-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-towelrail-2x1",
    "label": "Home Towelrail 2x1",
    "category": "home__",
    "width": 32,
    "height": 16,
    "filePath": "assets/home-towelrail-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-tree-1x3",
    "label": "Home Tree 1x3",
    "category": "home__",
    "width": 16,
    "height": 48,
    "filePath": "assets/home-tree-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-tv-3x2",
    "label": "Home Tv 3x2",
    "category": "home__",
    "width": 48,
    "height": 32,
    "filePath": "assets/home-tv-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-vase-1x2",
    "label": "Home Vase 1x2",
    "category": "home__",
    "width": 16,
    "height": 32,
    "filePath": "assets/home-vase-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-books-1x1",
    "label": "Home Books 1x1",
    "category": "home_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/home-books-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bottle-1x1",
    "label": "Home Bottle 1x1",
    "category": "home_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/home-bottle-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-clock-1x1",
    "label": "Home Clock 1x1",
    "category": "home_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/home-clock-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-lamp-1x1",
    "label": "Home Lamp 1x1",
    "category": "home_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/home-lamp-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-mug-1x1",
    "label": "Home Mug 1x1",
    "category": "home_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/home-mug-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-pillow-1x1",
    "label": "Home Pillow 1x1",
    "category": "home_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/home-pillow-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-plant-1x1",
    "label": "Home Plant 1x1",
    "category": "home_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/home-plant-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-stool-1x1",
    "label": "Home Stool 1x1",
    "category": "home_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/home-stool-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bed-2x2",
    "label": "Home Bed 2x2",
    "category": "home_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/home-bed-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-chair-2x2",
    "label": "Home Chair 2x2",
    "category": "home_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/home-chair-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-fridge-2x2",
    "label": "Home Fridge 2x2",
    "category": "home_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/home-fridge-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-sidetable-2x2",
    "label": "Home Sidetable 2x2",
    "category": "home_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/home-sidetable-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-sink-2x2",
    "label": "Home Sink 2x2",
    "category": "home_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/home-sink-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-stove-2x2",
    "label": "Home Stove 2x2",
    "category": "home_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/home-stove-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-toilet-2x2",
    "label": "Home Toilet 2x2",
    "category": "home_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/home-toilet-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-tv-2x2",
    "label": "Home Tv 2x2",
    "category": "home_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/home-tv-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-wardrobe-2x2",
    "label": "Home Wardrobe 2x2",
    "category": "home_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/home-wardrobe-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-washer-2x2",
    "label": "Home Washer 2x2",
    "category": "home_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/home-washer-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bathtub-3x3",
    "label": "Home Bathtub 3x3",
    "category": "home_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/home-bathtub-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bed-3x3",
    "label": "Home Bed 3x3",
    "category": "home_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/home-bed-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-bookshelf-3x3",
    "label": "Home Bookshelf 3x3",
    "category": "home_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/home-bookshelf-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-counter-3x3",
    "label": "Home Counter 3x3",
    "category": "home_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/home-counter-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-desk-3x3",
    "label": "Home Desk 3x3",
    "category": "home_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/home-desk-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-fireplace-3x3",
    "label": "Home Fireplace 3x3",
    "category": "home_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/home-fireplace-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-sofa-3x3",
    "label": "Home Sofa 3x3",
    "category": "home_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/home-sofa-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "home-table-3x3",
    "label": "Home Table 3x3",
    "category": "home_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/home-table-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-barrier-2x1",
    "label": "Horiz Barrier 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-barrier-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-barrier-3x1",
    "label": "Horiz Barrier 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-barrier-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-barrier-4x1",
    "label": "Horiz Barrier 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-barrier-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-battery-2x1",
    "label": "Horiz Battery 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-battery-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-battery-3x1",
    "label": "Horiz Battery 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-battery-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-battery-4x1",
    "label": "Horiz Battery 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-battery-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-beam-2x1",
    "label": "Horiz Beam 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-beam-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-beam-3x1",
    "label": "Horiz Beam 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-beam-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-beam-4x1",
    "label": "Horiz Beam 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-beam-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-bed-2x1",
    "label": "Horiz Bed 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-bed-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-bed-3x1",
    "label": "Horiz Bed 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-bed-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-bed-4x1",
    "label": "Horiz Bed 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-bed-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-bench-2x1",
    "label": "Horiz Bench 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-bench-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-bench-3x1",
    "label": "Horiz Bench 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-bench-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-bench-4x1",
    "label": "Horiz Bench 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-bench-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-bumper-2x1",
    "label": "Horiz Bumper 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-bumper-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-bumper-3x1",
    "label": "Horiz Bumper 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-bumper-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-bumper-4x1",
    "label": "Horiz Bumper 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-bumper-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-cables-2x1",
    "label": "Horiz Cables 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-cables-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-cables-3x1",
    "label": "Horiz Cables 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-cables-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-cables-4x1",
    "label": "Horiz Cables 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-cables-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-console-2x1",
    "label": "Horiz Console 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-console-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-console-3x1",
    "label": "Horiz Console 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-console-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-console-4x1",
    "label": "Horiz Console 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-console-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-conveyor-2x1",
    "label": "Horiz Conveyor 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-conveyor-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-conveyor-3x1",
    "label": "Horiz Conveyor 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-conveyor-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-conveyor-4x1",
    "label": "Horiz Conveyor 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-conveyor-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-counter-2x1",
    "label": "Horiz Counter 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-counter-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-counter-3x1",
    "label": "Horiz Counter 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-counter-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-counter-4x1",
    "label": "Horiz Counter 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-counter-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-crates-2x1",
    "label": "Horiz Crates 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-crates-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-crates-3x1",
    "label": "Horiz Crates 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-crates-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-crates-4x1",
    "label": "Horiz Crates 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-crates-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-desk-2x1",
    "label": "Horiz Desk 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-desk-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-desk-3x1",
    "label": "Horiz Desk 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-desk-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-desk-4x1",
    "label": "Horiz Desk 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-desk-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-duct-2x1",
    "label": "Horiz Duct 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-duct-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-duct-3x1",
    "label": "Horiz Duct 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-duct-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-duct-4x1",
    "label": "Horiz Duct 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-duct-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-fence-2x1",
    "label": "Horiz Fence 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-fence-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-fence-3x1",
    "label": "Horiz Fence 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-fence-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-fence-4x1",
    "label": "Horiz Fence 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-fence-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-garden-2x1",
    "label": "Horiz Garden 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-garden-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-garden-3x1",
    "label": "Horiz Garden 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-garden-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-garden-4x1",
    "label": "Horiz Garden 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-garden-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-keyboard-2x1",
    "label": "Horiz Keyboard 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-keyboard-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-keyboard-3x1",
    "label": "Horiz Keyboard 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-keyboard-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-keyboard-4x1",
    "label": "Horiz Keyboard 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-keyboard-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-lab-bench-2x1",
    "label": "Horiz Lab Bench 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-lab-bench-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-lab-bench-3x1",
    "label": "Horiz Lab Bench 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-lab-bench-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-lab-bench-4x1",
    "label": "Horiz Lab Bench 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-lab-bench-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-low-wall-2x1",
    "label": "Horiz Low Wall 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-low-wall-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-low-wall-3x1",
    "label": "Horiz Low Wall 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-low-wall-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-low-wall-4x1",
    "label": "Horiz Low Wall 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-low-wall-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-pallet-2x1",
    "label": "Horiz Pallet 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-pallet-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-pallet-3x1",
    "label": "Horiz Pallet 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-pallet-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-pallet-4x1",
    "label": "Horiz Pallet 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-pallet-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-panel-2x1",
    "label": "Horiz Panel 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-panel-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-panel-3x1",
    "label": "Horiz Panel 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-panel-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-panel-4x1",
    "label": "Horiz Panel 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-panel-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-pipe-2x1",
    "label": "Horiz Pipe 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-pipe-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-pipe-3x1",
    "label": "Horiz Pipe 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-pipe-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-pipe-4x1",
    "label": "Horiz Pipe 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-pipe-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-planter-2x1",
    "label": "Horiz Planter 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-planter-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-planter-3x1",
    "label": "Horiz Planter 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-planter-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-planter-4x1",
    "label": "Horiz Planter 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-planter-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-rail-2x1",
    "label": "Horiz Rail 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-rail-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-rail-3x1",
    "label": "Horiz Rail 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-rail-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-rail-4x1",
    "label": "Horiz Rail 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-rail-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-shelf-2x1",
    "label": "Horiz Shelf 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-shelf-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-shelf-3x1",
    "label": "Horiz Shelf 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-shelf-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-shelf-4x1",
    "label": "Horiz Shelf 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-shelf-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-sofa-2x1",
    "label": "Horiz Sofa 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-sofa-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-sofa-3x1",
    "label": "Horiz Sofa 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-sofa-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-sofa-4x1",
    "label": "Horiz Sofa 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-sofa-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-solar-2x1",
    "label": "Horiz Solar 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-solar-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-solar-3x1",
    "label": "Horiz Solar 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-solar-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-solar-4x1",
    "label": "Horiz Solar 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-solar-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-table-2x1",
    "label": "Horiz Table 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-table-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-table-3x1",
    "label": "Horiz Table 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-table-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-table-4x1",
    "label": "Horiz Table 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-table-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-tank-2x1",
    "label": "Horiz Tank 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-tank-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-tank-3x1",
    "label": "Horiz Tank 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-tank-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-tank-4x1",
    "label": "Horiz Tank 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-tank-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-vent-2x1",
    "label": "Horiz Vent 2x1",
    "category": "horiz__",
    "width": 32,
    "height": 16,
    "filePath": "assets2/horiz-vent-2x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-vent-3x1",
    "label": "Horiz Vent 3x1",
    "category": "horiz__",
    "width": 48,
    "height": 16,
    "filePath": "assets2/horiz-vent-3x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "horiz-vent-4x1",
    "label": "Horiz Vent 4x1",
    "category": "horiz__",
    "width": 64,
    "height": 16,
    "filePath": "assets2/horiz-vent-4x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-alien-1x1",
    "label": "Icon Alien 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-alien-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-anchor-1x1",
    "label": "Icon Anchor 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-anchor-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bag-1x1",
    "label": "Icon Bag 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-bag-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bell-1x1",
    "label": "Icon Bell 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-bell-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bird-1x1",
    "label": "Icon Bird 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-bird-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bolt-1x1",
    "label": "Icon Bolt 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-bolt-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-book-1x1",
    "label": "Icon Book 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-book-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bottle-1x1",
    "label": "Icon Bottle 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-bottle-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bug2-1x1",
    "label": "Icon Bug2 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-bug2-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cactus-1x1",
    "label": "Icon Cactus 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-cactus-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-can-1x1",
    "label": "Icon Can 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-can-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cards-1x1",
    "label": "Icon Cards 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-cards-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cart-1x1",
    "label": "Icon Cart 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-cart-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cat-1x1",
    "label": "Icon Cat 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-cat-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-check-1x1",
    "label": "Icon Check 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-check-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chess-1x1",
    "label": "Icon Chess 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-chess-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-down-1x1",
    "label": "Icon Chevron Double Down 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-chevron-double-down-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-left-1x1",
    "label": "Icon Chevron Double Left 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-chevron-double-left-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-right-1x1",
    "label": "Icon Chevron Double Right 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-chevron-double-right-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-up-1x1",
    "label": "Icon Chevron Double Up 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-chevron-double-up-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-down-1x1",
    "label": "Icon Chevron Down 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-chevron-down-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-left-1x1",
    "label": "Icon Chevron Left 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-chevron-left-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-right-1x1",
    "label": "Icon Chevron Right 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-chevron-right-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-up-1x1",
    "label": "Icon Chevron Up 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-chevron-up-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cloud-1x1",
    "label": "Icon Cloud 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-cloud-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-coffee-1x1",
    "label": "Icon Coffee 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-coffee-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cookie-1x1",
    "label": "Icon Cookie 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-cookie-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cross-1x1",
    "label": "Icon Cross 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-cross-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-dice-1x1",
    "label": "Icon Dice 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-dice-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-dog-1x1",
    "label": "Icon Dog 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-dog-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-drop-1x1",
    "label": "Icon Drop 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-drop-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-eye-1x1",
    "label": "Icon Eye 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-eye-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-fish-1x1",
    "label": "Icon Fish 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-fish-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-flag-1x1",
    "label": "Icon Flag 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-flag-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-flame-1x1",
    "label": "Icon Flame 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-flame-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-fox-1x1",
    "label": "Icon Fox 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-fox-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-gear-1x1",
    "label": "Icon Gear 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-gear-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-gem-1x1",
    "label": "Icon Gem 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-gem-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-ghost-1x1",
    "label": "Icon Ghost 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-ghost-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-hammer-1x1",
    "label": "Icon Hammer 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-hammer-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-heart-1x1",
    "label": "Icon Heart 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-heart-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-home-1x1",
    "label": "Icon Home 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-home-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-hourglass-1x1",
    "label": "Icon Hourglass 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-hourglass-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-icecream-1x1",
    "label": "Icon Icecream 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-icecream-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-infinity-1x1",
    "label": "Icon Infinity 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-infinity-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-joystick-1x1",
    "label": "Icon Joystick 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-joystick-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-key-1x1",
    "label": "Icon Key 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-key-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-leaf-1x1",
    "label": "Icon Leaf 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-leaf-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-lock-1x1",
    "label": "Icon Lock 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-lock-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-magnet-1x1",
    "label": "Icon Magnet 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-magnet-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-mail-1x1",
    "label": "Icon Mail 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-mail-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-minus-1x1",
    "label": "Icon Minus 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-minus-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-moon-1x1",
    "label": "Icon Moon 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-moon-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-mushroom-1x1",
    "label": "Icon Mushroom 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-mushroom-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-music-1x1",
    "label": "Icon Music 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-music-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-ore-1x1",
    "label": "Icon Ore 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-ore-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-pause-1x1",
    "label": "Icon Pause 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-pause-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-pickaxe-1x1",
    "label": "Icon Pickaxe 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-pickaxe-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-pizza-1x1",
    "label": "Icon Pizza 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-pizza-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-play-1x1",
    "label": "Icon Play 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-play-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-plus-1x1",
    "label": "Icon Plus 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-plus-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-potion-1x1",
    "label": "Icon Potion 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-potion-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-puzzle-1x1",
    "label": "Icon Puzzle 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-puzzle-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-rainbow-1x1",
    "label": "Icon Rainbow 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-rainbow-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-ring-1x1",
    "label": "Icon Ring 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-ring-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-robot-1x1",
    "label": "Icon Robot 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-robot-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-scroll-1x1",
    "label": "Icon Scroll 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-scroll-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-seed-1x1",
    "label": "Icon Seed 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-seed-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-shield-1x1",
    "label": "Icon Shield 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-shield-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-snow-1x1",
    "label": "Icon Snow 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-snow-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-spiral-1x1",
    "label": "Icon Spiral 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-spiral-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-star-1x1",
    "label": "Icon Star 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-star-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-stop-1x1",
    "label": "Icon Stop 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-stop-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-sun-1x1",
    "label": "Icon Sun 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-sun-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-sword-1x1",
    "label": "Icon Sword 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-sword-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-target-1x1",
    "label": "Icon Target 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-target-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-tree-1x1",
    "label": "Icon Tree 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-tree-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-unlock-1x1",
    "label": "Icon Unlock 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-unlock-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-user-1x1",
    "label": "Icon User 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-user-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-users-1x1",
    "label": "Icon Users 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-users-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-wand-1x1",
    "label": "Icon Wand 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-wand-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-wave-1x1",
    "label": "Icon Wave 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-wave-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-wrench-1x1",
    "label": "Icon Wrench 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-wrench-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-yinyang-1x1",
    "label": "Icon Yinyang 1x1",
    "category": "icon_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/icon-yinyang-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-alien-2x2",
    "label": "Icon Alien 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-alien-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-anchor-2x2",
    "label": "Icon Anchor 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-anchor-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-atom-2x2",
    "label": "Icon Atom 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-atom-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-battery-2x2",
    "label": "Icon Battery 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-battery-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bird-2x2",
    "label": "Icon Bird 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-bird-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bottle-2x2",
    "label": "Icon Bottle 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-bottle-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bug-2x2",
    "label": "Icon Bug 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-bug-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bug2-2x2",
    "label": "Icon Bug2 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-bug2-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cactus-2x2",
    "label": "Icon Cactus 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-cactus-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-calendar-2x2",
    "label": "Icon Calendar 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-calendar-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-camera-2x2",
    "label": "Icon Camera 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-camera-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-can-2x2",
    "label": "Icon Can 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-can-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cards-2x2",
    "label": "Icon Cards 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-cards-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cart-2x2",
    "label": "Icon Cart 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-cart-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cat-2x2",
    "label": "Icon Cat 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-cat-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chart-2x2",
    "label": "Icon Chart 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-chart-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chat-2x2",
    "label": "Icon Chat 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-chat-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-check-2x2",
    "label": "Icon Check 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-check-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chess-2x2",
    "label": "Icon Chess 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-chess-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-down-2x2",
    "label": "Icon Chevron Double Down 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-chevron-double-down-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-left-2x2",
    "label": "Icon Chevron Double Left 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-chevron-double-left-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-right-2x2",
    "label": "Icon Chevron Double Right 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-chevron-double-right-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-up-2x2",
    "label": "Icon Chevron Double Up 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-chevron-double-up-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-down-2x2",
    "label": "Icon Chevron Down 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-chevron-down-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-left-2x2",
    "label": "Icon Chevron Left 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-chevron-left-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-right-2x2",
    "label": "Icon Chevron Right 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-chevron-right-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-up-2x2",
    "label": "Icon Chevron Up 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-chevron-up-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-clock-2x2",
    "label": "Icon Clock 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-clock-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-code-2x2",
    "label": "Icon Code 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-code-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-coffee-2x2",
    "label": "Icon Coffee 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-coffee-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-compass-2x2",
    "label": "Icon Compass 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-compass-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cookie-2x2",
    "label": "Icon Cookie 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-cookie-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cpu-2x2",
    "label": "Icon Cpu 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-cpu-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cross-2x2",
    "label": "Icon Cross 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-cross-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-dice-2x2",
    "label": "Icon Dice 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-dice-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-disk-2x2",
    "label": "Icon Disk 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-disk-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-dog-2x2",
    "label": "Icon Dog 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-dog-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-file-2x2",
    "label": "Icon File 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-file-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-filter-2x2",
    "label": "Icon Filter 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-filter-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-fish-2x2",
    "label": "Icon Fish 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-fish-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-folder-2x2",
    "label": "Icon Folder 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-folder-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-fox-2x2",
    "label": "Icon Fox 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-fox-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-gem-2x2",
    "label": "Icon Gem 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-gem-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-ghost-2x2",
    "label": "Icon Ghost 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-ghost-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-gift-2x2",
    "label": "Icon Gift 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-gift-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-globe-2x2",
    "label": "Icon Globe 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-globe-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-headphones-2x2",
    "label": "Icon Headphones 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-headphones-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-heart-2x2",
    "label": "Icon Heart 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-heart-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-hourglass-2x2",
    "label": "Icon Hourglass 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-hourglass-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-icecream-2x2",
    "label": "Icon Icecream 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-icecream-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-image-2x2",
    "label": "Icon Image 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-image-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-infinity-2x2",
    "label": "Icon Infinity 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-infinity-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-info-2x2",
    "label": "Icon Info 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-info-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-joystick-2x2",
    "label": "Icon Joystick 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-joystick-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-lab-2x2",
    "label": "Icon Lab 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-lab-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-link-2x2",
    "label": "Icon Link 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-link-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-magnet-2x2",
    "label": "Icon Magnet 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-magnet-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-map-2x2",
    "label": "Icon Map 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-map-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-medal-2x2",
    "label": "Icon Medal 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-medal-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-mic-2x2",
    "label": "Icon Mic 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-mic-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-mushroom-2x2",
    "label": "Icon Mushroom 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-mushroom-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-ore-2x2",
    "label": "Icon Ore 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-ore-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-phone-2x2",
    "label": "Icon Phone 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-phone-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-pickaxe-2x2",
    "label": "Icon Pickaxe 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-pickaxe-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-pin-2x2",
    "label": "Icon Pin 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-pin-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-pizza-2x2",
    "label": "Icon Pizza 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-pizza-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-potion-2x2",
    "label": "Icon Potion 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-potion-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-power-2x2",
    "label": "Icon Power 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-power-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-puzzle-2x2",
    "label": "Icon Puzzle 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-puzzle-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-rainbow-2x2",
    "label": "Icon Rainbow 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-rainbow-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-ring-2x2",
    "label": "Icon Ring 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-ring-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-robot-2x2",
    "label": "Icon Robot 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-robot-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-scroll-2x2",
    "label": "Icon Scroll 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-scroll-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-search-2x2",
    "label": "Icon Search 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-search-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-seed-2x2",
    "label": "Icon Seed 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-seed-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-snow-2x2",
    "label": "Icon Snow 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-snow-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-speaker-2x2",
    "label": "Icon Speaker 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-speaker-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-spiral-2x2",
    "label": "Icon Spiral 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-spiral-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-star-2x2",
    "label": "Icon Star 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-star-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-tag-2x2",
    "label": "Icon Tag 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-tag-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-terminal-2x2",
    "label": "Icon Terminal 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-terminal-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-tree-2x2",
    "label": "Icon Tree 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-tree-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-trophy-2x2",
    "label": "Icon Trophy 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-trophy-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-wand-2x2",
    "label": "Icon Wand 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-wand-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-warning-2x2",
    "label": "Icon Warning 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-warning-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-wave-2x2",
    "label": "Icon Wave 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-wave-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-wifi-2x2",
    "label": "Icon Wifi 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-wifi-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-yinyang-2x2",
    "label": "Icon Yinyang 2x2",
    "category": "icon_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/icon-yinyang-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-air-3x3",
    "label": "Icon Air 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-air-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-alien-3x3",
    "label": "Icon Alien 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-alien-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-anchor-3x3",
    "label": "Icon Anchor 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-anchor-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bio-3x3",
    "label": "Icon Bio 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-bio-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bird-3x3",
    "label": "Icon Bird 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-bird-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-blueprint-3x3",
    "label": "Icon Blueprint 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-blueprint-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bottle-3x3",
    "label": "Icon Bottle 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-bottle-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-bug2-3x3",
    "label": "Icon Bug2 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-bug2-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-build-3x3",
    "label": "Icon Build 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-build-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cactus-3x3",
    "label": "Icon Cactus 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-cactus-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-can-3x3",
    "label": "Icon Can 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-can-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cards-3x3",
    "label": "Icon Cards 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-cards-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cat-3x3",
    "label": "Icon Cat 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-cat-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-check-3x3",
    "label": "Icon Check 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-check-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chess-3x3",
    "label": "Icon Chess 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-chess-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chest-3x3",
    "label": "Icon Chest 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-chest-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-down-3x3",
    "label": "Icon Chevron Double Down 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-chevron-double-down-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-left-3x3",
    "label": "Icon Chevron Double Left 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-chevron-double-left-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-right-3x3",
    "label": "Icon Chevron Double Right 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-chevron-double-right-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-double-up-3x3",
    "label": "Icon Chevron Double Up 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-chevron-double-up-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-down-3x3",
    "label": "Icon Chevron Down 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-chevron-down-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-left-3x3",
    "label": "Icon Chevron Left 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-chevron-left-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-right-3x3",
    "label": "Icon Chevron Right 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-chevron-right-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-chevron-up-3x3",
    "label": "Icon Chevron Up 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-chevron-up-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-circuit-3x3",
    "label": "Icon Circuit 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-circuit-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-coffee-3x3",
    "label": "Icon Coffee 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-coffee-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-coin-3x3",
    "label": "Icon Coin 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-coin-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cookie-3x3",
    "label": "Icon Cookie 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-cookie-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-cross-3x3",
    "label": "Icon Cross 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-cross-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-crown-3x3",
    "label": "Icon Crown 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-crown-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-crystal-3x3",
    "label": "Icon Crystal 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-crystal-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-diamond-3x3",
    "label": "Icon Diamond 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-diamond-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-dice-3x3",
    "label": "Icon Dice 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-dice-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-dna-3x3",
    "label": "Icon Dna 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-dna-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-dog-3x3",
    "label": "Icon Dog 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-dog-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-drone-3x3",
    "label": "Icon Drone 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-drone-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-earth-3x3",
    "label": "Icon Earth 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-earth-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-energy-3x3",
    "label": "Icon Energy 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-energy-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-factory-3x3",
    "label": "Icon Factory 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-factory-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-fire-3x3",
    "label": "Icon Fire 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-fire-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-fish-3x3",
    "label": "Icon Fish 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-fish-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-fox-3x3",
    "label": "Icon Fox 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-fox-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-gem-3x3",
    "label": "Icon Gem 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-gem-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-ghost-3x3",
    "label": "Icon Ghost 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-ghost-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-heart-3x3",
    "label": "Icon Heart 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-heart-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-home-3x3",
    "label": "Icon Home 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-home-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-hourglass-3x3",
    "label": "Icon Hourglass 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-hourglass-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-icecream-3x3",
    "label": "Icon Icecream 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-icecream-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-infinity-3x3",
    "label": "Icon Infinity 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-infinity-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-joystick-3x3",
    "label": "Icon Joystick 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-joystick-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-lab-3x3",
    "label": "Icon Lab 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-lab-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-magnet-3x3",
    "label": "Icon Magnet 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-magnet-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-mushroom-3x3",
    "label": "Icon Mushroom 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-mushroom-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-ore-3x3",
    "label": "Icon Ore 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-ore-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-pickaxe-3x3",
    "label": "Icon Pickaxe 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-pickaxe-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-pizza-3x3",
    "label": "Icon Pizza 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-pizza-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-plane-3x3",
    "label": "Icon Plane 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-plane-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-portal-3x3",
    "label": "Icon Portal 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-portal-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-potion-3x3",
    "label": "Icon Potion 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-potion-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-power-3x3",
    "label": "Icon Power 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-power-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-puzzle-3x3",
    "label": "Icon Puzzle 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-puzzle-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-radar-3x3",
    "label": "Icon Radar 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-radar-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-rainbow-3x3",
    "label": "Icon Rainbow 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-rainbow-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-ring-3x3",
    "label": "Icon Ring 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-ring-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-robot-3x3",
    "label": "Icon Robot 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-robot-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-rocket-3x3",
    "label": "Icon Rocket 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-rocket-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-satellite-3x3",
    "label": "Icon Satellite 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-satellite-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-scroll-3x3",
    "label": "Icon Scroll 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-scroll-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-seed-3x3",
    "label": "Icon Seed 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-seed-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-settings-3x3",
    "label": "Icon Settings 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-settings-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-ship-3x3",
    "label": "Icon Ship 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-ship-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-shop-3x3",
    "label": "Icon Shop 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-shop-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-skull-3x3",
    "label": "Icon Skull 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-skull-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-snow-3x3",
    "label": "Icon Snow 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-snow-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-spiral-3x3",
    "label": "Icon Spiral 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-spiral-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-star-3x3",
    "label": "Icon Star 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-star-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-train-3x3",
    "label": "Icon Train 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-train-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-tree-3x3",
    "label": "Icon Tree 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-tree-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-truck-3x3",
    "label": "Icon Truck 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-truck-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-user-3x3",
    "label": "Icon User 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-user-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-users-3x3",
    "label": "Icon Users 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-users-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-vault-3x3",
    "label": "Icon Vault 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-vault-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-virus-3x3",
    "label": "Icon Virus 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-virus-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-wand-3x3",
    "label": "Icon Wand 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-wand-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-warning-3x3",
    "label": "Icon Warning 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-warning-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-water-3x3",
    "label": "Icon Water 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-water-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-wave-3x3",
    "label": "Icon Wave 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-wave-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "icon-yinyang-3x3",
    "label": "Icon Yinyang 3x3",
    "category": "icon_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/icon-yinyang-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-airlock-3x2",
    "label": "Ind Airlock 3x2",
    "category": "indus__",
    "width": 48,
    "height": 32,
    "filePath": "assets/ind-airlock-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-assembler-4x4",
    "label": "Ind Assembler 4x4",
    "category": "indus__",
    "width": 64,
    "height": 64,
    "filePath": "assets/ind-assembler-4x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-beam-2x1",
    "label": "Ind Beam 2x1",
    "category": "indus__",
    "width": 32,
    "height": 16,
    "filePath": "assets/ind-beam-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-board-3x2",
    "label": "Ind Board 3x2",
    "category": "indus__",
    "width": 48,
    "height": 32,
    "filePath": "assets/ind-board-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-chimney-1x3",
    "label": "Ind Chimney 1x3",
    "category": "indus__",
    "width": 16,
    "height": 48,
    "filePath": "assets/ind-chimney-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-console-3x2",
    "label": "Ind Console 3x2",
    "category": "indus__",
    "width": 48,
    "height": 32,
    "filePath": "assets/ind-console-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-conveyor-2x1",
    "label": "Ind Conveyor 2x1",
    "category": "indus__",
    "width": 32,
    "height": 16,
    "filePath": "assets/ind-conveyor-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-core-4x4",
    "label": "Ind Core 4x4",
    "category": "indus__",
    "width": 64,
    "height": 64,
    "filePath": "assets/ind-core-4x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-crane-1x3",
    "label": "Ind Crane 1x3",
    "category": "indus__",
    "width": 16,
    "height": 48,
    "filePath": "assets/ind-crane-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-crate-2x1",
    "label": "Ind Crate 2x1",
    "category": "indus__",
    "width": 32,
    "height": 16,
    "filePath": "assets/ind-crate-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-duct-2x1",
    "label": "Ind Duct 2x1",
    "category": "indus__",
    "width": 32,
    "height": 16,
    "filePath": "assets/ind-duct-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-furnace-3x2",
    "label": "Ind Furnace 3x2",
    "category": "indus__",
    "width": 48,
    "height": 32,
    "filePath": "assets/ind-furnace-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-junction-2x1",
    "label": "Ind Junction 2x1",
    "category": "indus__",
    "width": 32,
    "height": 16,
    "filePath": "assets/ind-junction-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-ladder-1x2",
    "label": "Ind Ladder 1x2",
    "category": "indus__",
    "width": 16,
    "height": 32,
    "filePath": "assets/ind-ladder-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-lamp-1x2",
    "label": "Ind Lamp 1x2",
    "category": "indus__",
    "width": 16,
    "height": 32,
    "filePath": "assets/ind-lamp-1x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-locker-1x2",
    "label": "Ind Locker 1x2",
    "category": "indus__",
    "width": 16,
    "height": 32,
    "filePath": "assets/ind-locker-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-panel-2x1",
    "label": "Ind Panel 2x1",
    "category": "indus__",
    "width": 32,
    "height": 16,
    "filePath": "assets/ind-panel-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-pipe-1x2",
    "label": "Ind Pipe 1x2",
    "category": "indus__",
    "width": 16,
    "height": 32,
    "filePath": "assets/ind-pipe-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-pipe-1x3",
    "label": "Ind Pipe 1x3",
    "category": "indus__",
    "width": 16,
    "height": 48,
    "filePath": "assets/ind-pipe-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-pipe-2x1",
    "label": "Ind Pipe 2x1",
    "category": "indus__",
    "width": 32,
    "height": 16,
    "filePath": "assets/ind-pipe-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-pipe-bank-3x2",
    "label": "Ind Pipe Bank 3x2",
    "category": "indus__",
    "width": 48,
    "height": 32,
    "filePath": "assets/ind-pipe-bank-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-plant-4x4",
    "label": "Ind Plant 4x4",
    "category": "indus__",
    "width": 64,
    "height": 64,
    "filePath": "assets/ind-plant-4x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-pump-1x2",
    "label": "Ind Pump 1x2",
    "category": "indus__",
    "width": 16,
    "height": 32,
    "filePath": "assets/ind-pump-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-rack-1x2",
    "label": "Ind Rack 1x2",
    "category": "indus__",
    "width": 16,
    "height": 32,
    "filePath": "assets/ind-rack-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-radiator-3x2",
    "label": "Ind Radiator 3x2",
    "category": "indus__",
    "width": 48,
    "height": 32,
    "filePath": "assets/ind-radiator-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-server-1x3",
    "label": "Ind Server 1x3",
    "category": "indus__",
    "width": 16,
    "height": 48,
    "filePath": "assets/ind-server-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-stack-1x2",
    "label": "Ind Stack 1x2",
    "category": "indus__",
    "width": 16,
    "height": 32,
    "filePath": "assets/ind-stack-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-storage-4x4",
    "label": "Ind Storage 4x4",
    "category": "indus__",
    "width": 64,
    "height": 64,
    "filePath": "assets/ind-storage-4x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-terminal-1x2",
    "label": "Ind Terminal 1x2",
    "category": "indus__",
    "width": 16,
    "height": 32,
    "filePath": "assets/ind-terminal-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-warning-2x1",
    "label": "Ind Warning 2x1",
    "category": "indus__",
    "width": 32,
    "height": 16,
    "filePath": "assets/ind-warning-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-balancer-3x1",
    "label": "Logi Balancer 3x1",
    "category": "indus__",
    "width": 48,
    "height": 16,
    "filePath": "assets/logi-balancer-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-belt-1x2",
    "label": "Logi Belt 1x2",
    "category": "indus__",
    "width": 16,
    "height": 32,
    "filePath": "assets/logi-belt-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-belt-2x1",
    "label": "Logi Belt 2x1",
    "category": "indus__",
    "width": 32,
    "height": 16,
    "filePath": "assets/logi-belt-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-belt-3x1",
    "label": "Logi Belt 3x1",
    "category": "indus__",
    "width": 48,
    "height": 16,
    "filePath": "assets/logi-belt-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-drill-1x2",
    "label": "Logi Drill 1x2",
    "category": "indus__",
    "width": 16,
    "height": 32,
    "filePath": "assets/logi-drill-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-pump-1x2",
    "label": "Logi Pump 1x2",
    "category": "indus__",
    "width": 16,
    "height": 32,
    "filePath": "assets/logi-pump-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-silo-2x3",
    "label": "Logi Silo 2x3",
    "category": "indus__",
    "width": 32,
    "height": 48,
    "filePath": "assets/logi-silo-2x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-barrel-1x1",
    "label": "Ind Barrel 1x1",
    "category": "indus_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/ind-barrel-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-bolt-1x1",
    "label": "Ind Bolt 1x1",
    "category": "indus_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/ind-bolt-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-button-1x1",
    "label": "Ind Button 1x1",
    "category": "indus_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/ind-button-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-conduit-1x1",
    "label": "Ind Conduit 1x1",
    "category": "indus_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/ind-conduit-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-gauge-1x1",
    "label": "Ind Gauge 1x1",
    "category": "indus_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/ind-gauge-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-gear-1x1",
    "label": "Ind Gear 1x1",
    "category": "indus_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/ind-gear-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-pipe-cap-1x1",
    "label": "Ind Pipe Cap 1x1",
    "category": "indus_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/ind-pipe-cap-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-valve-1x1",
    "label": "Ind Valve 1x1",
    "category": "indus_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/ind-valve-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-boiler-2x2",
    "label": "Ind Boiler 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/ind-boiler-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-cabinet-2x2",
    "label": "Ind Cabinet 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/ind-cabinet-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-crate-2x2",
    "label": "Ind Crate 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/ind-crate-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-door-2x2",
    "label": "Ind Door 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/ind-door-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-fan-2x2",
    "label": "Ind Fan 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/ind-fan-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-generator-2x2",
    "label": "Ind Generator 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/ind-generator-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-motor-2x2",
    "label": "Ind Motor 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/ind-motor-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-tank-2x2",
    "label": "Ind Tank 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/ind-tank-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-assembler-2x2",
    "label": "Logi Assembler 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/logi-assembler-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-buffer-2x2",
    "label": "Logi Buffer 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/logi-buffer-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-drill-2x2",
    "label": "Logi Drill 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/logi-drill-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-drone-station-2x2",
    "label": "Logi Drone Station 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/logi-drone-station-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-extractor-2x2",
    "label": "Logi Extractor 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/logi-extractor-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-filter-2x2",
    "label": "Logi Filter 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/logi-filter-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-hopper-2x2",
    "label": "Logi Hopper 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/logi-hopper-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-loader-2x2",
    "label": "Logi Loader 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/logi-loader-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-merger-2x2",
    "label": "Logi Merger 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/logi-merger-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-pump-2x2",
    "label": "Logi Pump 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/logi-pump-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-silo-2x2",
    "label": "Logi Silo 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/logi-silo-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-smelter-2x2",
    "label": "Logi Smelter 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/logi-smelter-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-sorter-2x2",
    "label": "Logi Sorter 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/logi-sorter-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-splitter-2x2",
    "label": "Logi Splitter 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/logi-splitter-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-unloader-2x2",
    "label": "Logi Unloader 2x2",
    "category": "indus_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/logi-unloader-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-cooling-3x3",
    "label": "Ind Cooling 3x3",
    "category": "indus_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/ind-cooling-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-crane-3x3",
    "label": "Ind Crane 3x3",
    "category": "indus_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/ind-crane-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-reactor-3x3",
    "label": "Ind Reactor 3x3",
    "category": "indus_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/ind-reactor-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "ind-server-3x3",
    "label": "Ind Server 3x3",
    "category": "indus_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/ind-server-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-assembler-3x3",
    "label": "Logi Assembler 3x3",
    "category": "indus_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/logi-assembler-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-silo-3x3",
    "label": "Logi Silo 3x3",
    "category": "indus_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/logi-silo-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-smelter-3x3",
    "label": "Logi Smelter 3x3",
    "category": "indus_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/logi-smelter-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-sorter-3x3",
    "label": "Logi Sorter 3x3",
    "category": "indus_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/logi-sorter-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "logi-splitter-3x3",
    "label": "Logi Splitter 3x3",
    "category": "indus_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/logi-splitter-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-ash-1x1",
    "label": "Jar Ash 1x1",
    "category": "jar_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/jar-ash-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-crystal-1x1",
    "label": "Jar Crystal 1x1",
    "category": "jar_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/jar-crystal-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-empty-1x1",
    "label": "Jar Empty 1x1",
    "category": "jar_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/jar-empty-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-eye-1x1",
    "label": "Jar Eye 1x1",
    "category": "jar_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/jar-eye-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-gold-dust-1x1",
    "label": "Jar Gold Dust 1x1",
    "category": "jar_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/jar-gold-dust-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-goo-1x1",
    "label": "Jar Goo 1x1",
    "category": "jar_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/jar-goo-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-heart-1x1",
    "label": "Jar Heart 1x1",
    "category": "jar_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/jar-heart-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-ice-1x1",
    "label": "Jar Ice 1x1",
    "category": "jar_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/jar-ice-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-mite-1x1",
    "label": "Jar Mite 1x1",
    "category": "jar_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/jar-mite-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-oil-1x1",
    "label": "Jar Oil 1x1",
    "category": "jar_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/jar-oil-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-pollen-1x1",
    "label": "Jar Pollen 1x1",
    "category": "jar_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/jar-pollen-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-sand-1x1",
    "label": "Jar Sand 1x1",
    "category": "jar_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/jar-sand-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-spore-1x1",
    "label": "Jar Spore 1x1",
    "category": "jar_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/jar-spore-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-void-1x1",
    "label": "Jar Void 1x1",
    "category": "jar_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/jar-void-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-water-1x1",
    "label": "Jar Water 1x1",
    "category": "jar_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/jar-water-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "jar-worm-1x1",
    "label": "Jar Worm 1x1",
    "category": "jar_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/jar-worm-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "key-bio-1x1",
    "label": "Key Bio 1x1",
    "category": "key_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/key-bio-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "key-card-1x1",
    "label": "Key Card 1x1",
    "category": "key_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/key-card-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "key-copper-1x1",
    "label": "Key Copper 1x1",
    "category": "key_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/key-copper-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "key-crystal-1x1",
    "label": "Key Crystal 1x1",
    "category": "key_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/key-crystal-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "key-eye-1x1",
    "label": "Key Eye 1x1",
    "category": "key_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/key-eye-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "key-gold-1x1",
    "label": "Key Gold 1x1",
    "category": "key_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/key-gold-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "key-heart-1x1",
    "label": "Key Heart 1x1",
    "category": "key_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/key-heart-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "key-ice-1x1",
    "label": "Key Ice 1x1",
    "category": "key_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/key-ice-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "key-master-1x1",
    "label": "Key Master 1x1",
    "category": "key_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/key-master-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "key-pixel-1x1",
    "label": "Key Pixel 1x1",
    "category": "key_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/key-pixel-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "key-rust-1x1",
    "label": "Key Rust 1x1",
    "category": "key_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/key-rust-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "key-sand-1x1",
    "label": "Key Sand 1x1",
    "category": "key_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/key-sand-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "key-skull-1x1",
    "label": "Key Skull 1x1",
    "category": "key_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/key-skull-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "key-spore-1x1",
    "label": "Key Spore 1x1",
    "category": "key_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/key-spore-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "key-temple-1x1",
    "label": "Key Temple 1x1",
    "category": "key_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/key-temple-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "key-void-1x1",
    "label": "Key Void 1x1",
    "category": "key_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/key-void-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "lever-bio-btn-1x1",
    "label": "Lever Bio Btn 1x1",
    "category": "lever_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/lever-bio-btn-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-cap-1x1",
    "label": "Pipe Cap 1x1",
    "category": "pipe_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pipe-cap-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-cap-ice-1x1",
    "label": "Pipe Cap Ice 1x1",
    "category": "pipe_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pipe-cap-ice-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-I-1x1",
    "label": "Pipe I 1x1",
    "category": "pipe_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pipe-I-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-I-glass-1x1",
    "label": "Pipe I Glass 1x1",
    "category": "pipe_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pipe-I-glass-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-I-ice-1x1",
    "label": "Pipe I Ice 1x1",
    "category": "pipe_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pipe-I-ice-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-I-magma-1x1",
    "label": "Pipe I Magma 1x1",
    "category": "pipe_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pipe-I-magma-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-I-sand-1x1",
    "label": "Pipe I Sand 1x1",
    "category": "pipe_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pipe-I-sand-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-I-spore-1x1",
    "label": "Pipe I Spore 1x1",
    "category": "pipe_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pipe-I-spore-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-L-1x1",
    "label": "Pipe L 1x1",
    "category": "pipe_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pipe-L-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-L-ice-1x1",
    "label": "Pipe L Ice 1x1",
    "category": "pipe_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pipe-L-ice-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-L-magma-1x1",
    "label": "Pipe L Magma 1x1",
    "category": "pipe_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pipe-L-magma-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-T-1x1",
    "label": "Pipe T 1x1",
    "category": "pipe_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pipe-T-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-T-copper-1x1",
    "label": "Pipe T Copper 1x1",
    "category": "pipe_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pipe-T-copper-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-T-sand-1x1",
    "label": "Pipe T Sand 1x1",
    "category": "pipe_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pipe-T-sand-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-X-1x1",
    "label": "Pipe X 1x1",
    "category": "pipe_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pipe-X-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-X-spore-1x1",
    "label": "Pipe X Spore 1x1",
    "category": "pipe_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pipe-X-spore-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-cap-2x2",
    "label": "Pipe Cap 2x2",
    "category": "pipe_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pipe-cap-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-cap-ice-2x2",
    "label": "Pipe Cap Ice 2x2",
    "category": "pipe_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pipe-cap-ice-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-I-2x2",
    "label": "Pipe I 2x2",
    "category": "pipe_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pipe-I-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-I-glass-2x2",
    "label": "Pipe I Glass 2x2",
    "category": "pipe_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pipe-I-glass-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-I-ice-2x2",
    "label": "Pipe I Ice 2x2",
    "category": "pipe_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pipe-I-ice-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-I-magma-2x2",
    "label": "Pipe I Magma 2x2",
    "category": "pipe_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pipe-I-magma-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-I-sand-2x2",
    "label": "Pipe I Sand 2x2",
    "category": "pipe_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pipe-I-sand-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-I-spore-2x2",
    "label": "Pipe I Spore 2x2",
    "category": "pipe_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pipe-I-spore-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-L-2x2",
    "label": "Pipe L 2x2",
    "category": "pipe_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pipe-L-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-L-ice-2x2",
    "label": "Pipe L Ice 2x2",
    "category": "pipe_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pipe-L-ice-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-L-magma-2x2",
    "label": "Pipe L Magma 2x2",
    "category": "pipe_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pipe-L-magma-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-T-2x2",
    "label": "Pipe T 2x2",
    "category": "pipe_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pipe-T-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-T-copper-2x2",
    "label": "Pipe T Copper 2x2",
    "category": "pipe_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pipe-T-copper-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-T-sand-2x2",
    "label": "Pipe T Sand 2x2",
    "category": "pipe_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pipe-T-sand-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-X-2x2",
    "label": "Pipe X 2x2",
    "category": "pipe_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pipe-X-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pipe-X-spore-2x2",
    "label": "Pipe X Spore 2x2",
    "category": "pipe_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pipe-X-spore-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-algae-1x1",
    "label": "Pod Algae 1x1",
    "category": "pod_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pod-algae-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-berry-1x1",
    "label": "Pod Berry 1x1",
    "category": "pod_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pod-berry-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-crystal-1x1",
    "label": "Pod Crystal 1x1",
    "category": "pod_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pod-crystal-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-ice-1x1",
    "label": "Pod Ice 1x1",
    "category": "pod_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pod-ice-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-pollen-1x1",
    "label": "Pod Pollen 1x1",
    "category": "pod_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pod-pollen-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-root-1x1",
    "label": "Pod Root 1x1",
    "category": "pod_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pod-root-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-sand-1x1",
    "label": "Pod Sand 1x1",
    "category": "pod_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pod-sand-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-shroom-1x1",
    "label": "Pod Shroom 1x1",
    "category": "pod_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pod-shroom-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-spore-1x1",
    "label": "Pod Spore 1x1",
    "category": "pod_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pod-spore-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-thorn-1x1",
    "label": "Pod Thorn 1x1",
    "category": "pod_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pod-thorn-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-twin-1x1",
    "label": "Pod Twin 1x1",
    "category": "pod_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pod-twin-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-vine-1x1",
    "label": "Pod Vine 1x1",
    "category": "pod_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/pod-vine-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-algae-2x2",
    "label": "Pod Algae 2x2",
    "category": "pod_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pod-algae-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-berry-2x2",
    "label": "Pod Berry 2x2",
    "category": "pod_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pod-berry-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-crystal-2x2",
    "label": "Pod Crystal 2x2",
    "category": "pod_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pod-crystal-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-ice-2x2",
    "label": "Pod Ice 2x2",
    "category": "pod_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pod-ice-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-pollen-2x2",
    "label": "Pod Pollen 2x2",
    "category": "pod_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pod-pollen-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-root-2x2",
    "label": "Pod Root 2x2",
    "category": "pod_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pod-root-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-sand-2x2",
    "label": "Pod Sand 2x2",
    "category": "pod_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pod-sand-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-shroom-2x2",
    "label": "Pod Shroom 2x2",
    "category": "pod_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pod-shroom-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-spore-2x2",
    "label": "Pod Spore 2x2",
    "category": "pod_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pod-spore-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-thorn-2x2",
    "label": "Pod Thorn 2x2",
    "category": "pod_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pod-thorn-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-twin-2x2",
    "label": "Pod Twin 2x2",
    "category": "pod_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pod-twin-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "pod-vine-2x2",
    "label": "Pod Vine 2x2",
    "category": "pod_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/pod-vine-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "port-cyan-1x1",
    "label": "Port Cyan 1x1",
    "category": "port_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/port-cyan-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "port-factory-1x1",
    "label": "Port Factory 1x1",
    "category": "port_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/port-factory-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "port-fog-1x1",
    "label": "Port Fog 1x1",
    "category": "port_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/port-fog-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "port-garden-1x1",
    "label": "Port Garden 1x1",
    "category": "port_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/port-garden-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "port-gold-1x1",
    "label": "Port Gold 1x1",
    "category": "port_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/port-gold-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "port-green-1x1",
    "label": "Port Green 1x1",
    "category": "port_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/port-green-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "port-ice-1x1",
    "label": "Port Ice 1x1",
    "category": "port_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/port-ice-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "port-magma-1x1",
    "label": "Port Magma 1x1",
    "category": "port_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/port-magma-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "port-night-1x1",
    "label": "Port Night 1x1",
    "category": "port_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/port-night-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "port-ocean-1x1",
    "label": "Port Ocean 1x1",
    "category": "port_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/port-ocean-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "port-red-alert-1x1",
    "label": "Port Red Alert 1x1",
    "category": "port_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/port-red-alert-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "port-sand-1x1",
    "label": "Port Sand 1x1",
    "category": "port_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/port-sand-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "port-spore-1x1",
    "label": "Port Spore 1x1",
    "category": "port_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/port-spore-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "port-stars-1x1",
    "label": "Port Stars 1x1",
    "category": "port_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/port-stars-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "port-storm-1x1",
    "label": "Port Storm 1x1",
    "category": "port_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/port-storm-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "port-void-1x1",
    "label": "Port Void 1x1",
    "category": "port_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/port-void-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-cyan-2x2",
    "label": "Portal Cyan 2x2",
    "category": "portal_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/portal-cyan-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-gold-2x2",
    "label": "Portal Gold 2x2",
    "category": "portal_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/portal-gold-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-ice-2x2",
    "label": "Portal Ice 2x2",
    "category": "portal_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/portal-ice-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-magma-2x2",
    "label": "Portal Magma 2x2",
    "category": "portal_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/portal-magma-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-pink-2x2",
    "label": "Portal Pink 2x2",
    "category": "portal_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/portal-pink-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-sand-2x2",
    "label": "Portal Sand 2x2",
    "category": "portal_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/portal-sand-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-spore-2x2",
    "label": "Portal Spore 2x2",
    "category": "portal_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/portal-spore-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-void-2x2",
    "label": "Portal Void 2x2",
    "category": "portal_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/portal-void-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-cyan-3x3",
    "label": "Portal Cyan 3x3",
    "category": "portal_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/portal-cyan-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-gold-3x3",
    "label": "Portal Gold 3x3",
    "category": "portal_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/portal-gold-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-ice-3x3",
    "label": "Portal Ice 3x3",
    "category": "portal_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/portal-ice-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-magma-3x3",
    "label": "Portal Magma 3x3",
    "category": "portal_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/portal-magma-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-pink-3x3",
    "label": "Portal Pink 3x3",
    "category": "portal_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/portal-pink-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-sand-3x3",
    "label": "Portal Sand 3x3",
    "category": "portal_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/portal-sand-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-spore-3x3",
    "label": "Portal Spore 3x3",
    "category": "portal_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/portal-spore-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "portal-void-3x3",
    "label": "Portal Void 3x3",
    "category": "portal_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/portal-void-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-crate-stack-4x4",
    "label": "Probs Crate Stack 4x4",
    "category": "probs__",
    "width": 64,
    "height": 64,
    "filePath": "assets/probs-crate-stack-4x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-fusion-core-4x4",
    "label": "Probs Fusion Core 4x4",
    "category": "probs__",
    "width": 64,
    "height": 64,
    "filePath": "assets/probs-fusion-core-4x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-gate-4x4",
    "label": "Probs Gate 4x4",
    "category": "probs__",
    "width": 64,
    "height": 64,
    "filePath": "assets/probs-gate-4x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-growth-chamber-4x4",
    "label": "Probs Growth Chamber 4x4",
    "category": "probs__",
    "width": 64,
    "height": 64,
    "filePath": "assets/probs-growth-chamber-4x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-lab-bench-4x4",
    "label": "Probs Lab Bench 4x4",
    "category": "probs__",
    "width": 64,
    "height": 64,
    "filePath": "assets/probs-lab-bench-4x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-reactor-core-4x4",
    "label": "Probs Reactor Core 4x4",
    "category": "probs__",
    "width": 64,
    "height": 64,
    "filePath": "assets/probs-reactor-core-4x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-bio-canister-1x1",
    "label": "Probs Bio Canister 1x1",
    "category": "probs_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/probs-bio-canister-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-biohazard-barrel-1x1",
    "label": "Probs Biohazard Barrel 1x1",
    "category": "probs_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/probs-biohazard-barrel-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-crate-1x1",
    "label": "Probs Crate 1x1",
    "category": "probs_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/probs-crate-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-data-node-1x1",
    "label": "Probs Data Node 1x1",
    "category": "probs_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/probs-data-node-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-power-junction-1x1",
    "label": "Probs Power Junction 1x1",
    "category": "probs_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/probs-power-junction-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-sample-tube-1x1",
    "label": "Probs Sample Tube 1x1",
    "category": "probs_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/probs-sample-tube-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-sensor-1x1",
    "label": "Probs Sensor 1x1",
    "category": "probs_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/probs-sensor-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-spore-pod-1x1",
    "label": "Probs Spore Pod 1x1",
    "category": "probs_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/probs-spore-pod-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-vent-1x1",
    "label": "Probs Vent 1x1",
    "category": "probs_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/probs-vent-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-wall-light-1x1",
    "label": "Probs Wall Light 1x1",
    "category": "probs_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/probs-wall-light-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-crate-2x2",
    "label": "Probs Crate 2x2",
    "category": "probs_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/probs-crate-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-door-2x2",
    "label": "Probs Door 2x2",
    "category": "probs_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/probs-door-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-drone-dock-2x2",
    "label": "Probs Drone Dock 2x2",
    "category": "probs_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/probs-drone-dock-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-fan-2x2",
    "label": "Probs Fan 2x2",
    "category": "probs_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/probs-fan-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-holo-projector-2x2",
    "label": "Probs Holo Projector 2x2",
    "category": "probs_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/probs-holo-projector-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-incubator-2x2",
    "label": "Probs Incubator 2x2",
    "category": "probs_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/probs-incubator-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-nutrient-tank-2x2",
    "label": "Probs Nutrient Tank 2x2",
    "category": "probs_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/probs-nutrient-tank-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-pipe-junction-2x2",
    "label": "Probs Pipe Junction 2x2",
    "category": "probs_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/probs-pipe-junction-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-server-rack-2x2",
    "label": "Probs Server Rack 2x2",
    "category": "probs_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/probs-server-rack-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-window-2x2",
    "label": "Probs Window 2x2",
    "category": "probs_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/probs-window-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-assembler-arm-3x3",
    "label": "Probs Assembler Arm 3x3",
    "category": "probs_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/probs-assembler-arm-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-bioreactor-3x3",
    "label": "Probs Bioreactor 3x3",
    "category": "probs_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/probs-bioreactor-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-console-3x3",
    "label": "Probs Console 3x3",
    "category": "probs_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/probs-console-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-cooling-tower-3x3",
    "label": "Probs Cooling Tower 3x3",
    "category": "probs_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/probs-cooling-tower-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-gene-sequencer-3x3",
    "label": "Probs Gene Sequencer 3x3",
    "category": "probs_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/probs-gene-sequencer-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-shelf-3x3",
    "label": "Probs Shelf 3x3",
    "category": "probs_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/probs-shelf-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-stasis-pod-3x3",
    "label": "Probs Stasis Pod 3x3",
    "category": "probs_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/probs-stasis-pod-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "sensor-alarm-1x1",
    "label": "Sensor Alarm 1x1",
    "category": "sensor_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sensor-alarm-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "sensor-beacon-eye-1x1",
    "label": "Sensor Beacon Eye 1x1",
    "category": "sensor_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sensor-beacon-eye-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-biohazard-1x1",
    "label": "Sign Biohazard 1x1",
    "category": "sign_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sign-biohazard-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-cold-1x1",
    "label": "Sign Cold 1x1",
    "category": "sign_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sign-cold-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-electric-1x1",
    "label": "Sign Electric 1x1",
    "category": "sign_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sign-electric-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-exit-1x1",
    "label": "Sign Exit 1x1",
    "category": "sign_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sign-exit-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-fire-1x1",
    "label": "Sign Fire 1x1",
    "category": "sign_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sign-fire-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-first-aid-1x1",
    "label": "Sign First Aid 1x1",
    "category": "sign_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sign-first-aid-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-flammable-1x1",
    "label": "Sign Flammable 1x1",
    "category": "sign_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sign-flammable-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-go-1x1",
    "label": "Sign Go 1x1",
    "category": "sign_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sign-go-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-info-1x1",
    "label": "Sign Info 1x1",
    "category": "sign_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sign-info-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-laser-1x1",
    "label": "Sign Laser 1x1",
    "category": "sign_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sign-laser-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-lock-1x1",
    "label": "Sign Lock 1x1",
    "category": "sign_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sign-lock-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-magnetic-1x1",
    "label": "Sign Magnetic 1x1",
    "category": "sign_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sign-magnetic-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-no-entry-1x1",
    "label": "Sign No Entry 1x1",
    "category": "sign_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sign-no-entry-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-radiation-1x1",
    "label": "Sign Radiation 1x1",
    "category": "sign_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sign-radiation-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-recycle-1x1",
    "label": "Sign Recycle 1x1",
    "category": "sign_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sign-recycle-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-skull-1x1",
    "label": "Sign Skull 1x1",
    "category": "sign_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sign-skull-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-stop-1x1",
    "label": "Sign Stop 1x1",
    "category": "sign_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sign-stop-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-toxic-1x1",
    "label": "Sign Toxic 1x1",
    "category": "sign_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sign-toxic-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-warning-1x1",
    "label": "Sign Warning 1x1",
    "category": "sign_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sign-warning-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-wifi-1x1",
    "label": "Sign Wifi 1x1",
    "category": "sign_1",
    "width": 16,
    "height": 16,
    "filePath": "assets2/sign-wifi-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-biohazard-2x2",
    "label": "Sign Biohazard 2x2",
    "category": "sign_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/sign-biohazard-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-cold-2x2",
    "label": "Sign Cold 2x2",
    "category": "sign_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/sign-cold-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-electric-2x2",
    "label": "Sign Electric 2x2",
    "category": "sign_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/sign-electric-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-exit-2x2",
    "label": "Sign Exit 2x2",
    "category": "sign_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/sign-exit-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-fire-2x2",
    "label": "Sign Fire 2x2",
    "category": "sign_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/sign-fire-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-first-aid-2x2",
    "label": "Sign First Aid 2x2",
    "category": "sign_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/sign-first-aid-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-flammable-2x2",
    "label": "Sign Flammable 2x2",
    "category": "sign_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/sign-flammable-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-go-2x2",
    "label": "Sign Go 2x2",
    "category": "sign_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/sign-go-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-info-2x2",
    "label": "Sign Info 2x2",
    "category": "sign_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/sign-info-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-laser-2x2",
    "label": "Sign Laser 2x2",
    "category": "sign_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/sign-laser-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-lock-2x2",
    "label": "Sign Lock 2x2",
    "category": "sign_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/sign-lock-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-magnetic-2x2",
    "label": "Sign Magnetic 2x2",
    "category": "sign_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/sign-magnetic-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-no-entry-2x2",
    "label": "Sign No Entry 2x2",
    "category": "sign_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/sign-no-entry-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-radiation-2x2",
    "label": "Sign Radiation 2x2",
    "category": "sign_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/sign-radiation-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-recycle-2x2",
    "label": "Sign Recycle 2x2",
    "category": "sign_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/sign-recycle-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-skull-2x2",
    "label": "Sign Skull 2x2",
    "category": "sign_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/sign-skull-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-stop-2x2",
    "label": "Sign Stop 2x2",
    "category": "sign_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/sign-stop-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-toxic-2x2",
    "label": "Sign Toxic 2x2",
    "category": "sign_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/sign-toxic-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-warning-2x2",
    "label": "Sign Warning 2x2",
    "category": "sign_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/sign-warning-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-wifi-2x2",
    "label": "Sign Wifi 2x2",
    "category": "sign_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/sign-wifi-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-biohazard-3x3",
    "label": "Sign Biohazard 3x3",
    "category": "sign_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/sign-biohazard-3x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-cold-3x3",
    "label": "Sign Cold 3x3",
    "category": "sign_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/sign-cold-3x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-electric-3x3",
    "label": "Sign Electric 3x3",
    "category": "sign_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/sign-electric-3x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-exit-3x3",
    "label": "Sign Exit 3x3",
    "category": "sign_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/sign-exit-3x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-fire-3x3",
    "label": "Sign Fire 3x3",
    "category": "sign_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/sign-fire-3x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-first-aid-3x3",
    "label": "Sign First Aid 3x3",
    "category": "sign_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/sign-first-aid-3x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-flammable-3x3",
    "label": "Sign Flammable 3x3",
    "category": "sign_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/sign-flammable-3x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-go-3x3",
    "label": "Sign Go 3x3",
    "category": "sign_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/sign-go-3x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-info-3x3",
    "label": "Sign Info 3x3",
    "category": "sign_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/sign-info-3x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-laser-3x3",
    "label": "Sign Laser 3x3",
    "category": "sign_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/sign-laser-3x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-lock-3x3",
    "label": "Sign Lock 3x3",
    "category": "sign_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/sign-lock-3x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-magnetic-3x3",
    "label": "Sign Magnetic 3x3",
    "category": "sign_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/sign-magnetic-3x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-no-entry-3x3",
    "label": "Sign No Entry 3x3",
    "category": "sign_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/sign-no-entry-3x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-radiation-3x3",
    "label": "Sign Radiation 3x3",
    "category": "sign_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/sign-radiation-3x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-recycle-3x3",
    "label": "Sign Recycle 3x3",
    "category": "sign_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/sign-recycle-3x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-skull-3x3",
    "label": "Sign Skull 3x3",
    "category": "sign_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/sign-skull-3x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-stop-3x3",
    "label": "Sign Stop 3x3",
    "category": "sign_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/sign-stop-3x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-toxic-3x3",
    "label": "Sign Toxic 3x3",
    "category": "sign_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/sign-toxic-3x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-warning-3x3",
    "label": "Sign Warning 3x3",
    "category": "sign_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/sign-warning-3x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "sign-wifi-3x3",
    "label": "Sign Wifi 3x3",
    "category": "sign_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/sign-wifi-3x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-antenna-1x2",
    "label": "Space Antenna 1x2",
    "category": "space__",
    "width": 16,
    "height": 32,
    "filePath": "assets/space-antenna-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-antenna-2x3",
    "label": "Space Antenna 2x3",
    "category": "space__",
    "width": 32,
    "height": 48,
    "filePath": "assets/space-antenna-2x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-boom-1x3",
    "label": "Space Boom 1x3",
    "category": "space__",
    "width": 16,
    "height": 48,
    "filePath": "assets/space-boom-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-cargo-3x1",
    "label": "Space Cargo 3x1",
    "category": "space__",
    "width": 48,
    "height": 16,
    "filePath": "assets/space-cargo-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-dock-bay-4x2",
    "label": "Space Dock Bay 4x2",
    "category": "space__",
    "width": 64,
    "height": 32,
    "filePath": "assets/space-dock-bay-4x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-dock-clamp-3x2",
    "label": "Space Dock Clamp 3x2",
    "category": "space__",
    "width": 48,
    "height": 32,
    "filePath": "assets/space-dock-clamp-3x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-fuel-1x2",
    "label": "Space Fuel 1x2",
    "category": "space__",
    "width": 16,
    "height": 32,
    "filePath": "assets/space-fuel-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-habitat-3x2",
    "label": "Space Habitat 3x2",
    "category": "space__",
    "width": 48,
    "height": 32,
    "filePath": "assets/space-habitat-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-habitat-4x2",
    "label": "Space Habitat 4x2",
    "category": "space__",
    "width": 64,
    "height": 32,
    "filePath": "assets/space-habitat-4x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-pedestal-1x2",
    "label": "Space Pedestal 1x2",
    "category": "space__",
    "width": 16,
    "height": 32,
    "filePath": "assets/space-pedestal-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-radiator-2x1",
    "label": "Space Radiator 2x1",
    "category": "space__",
    "width": 32,
    "height": 16,
    "filePath": "assets/space-radiator-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-radiator-3x1",
    "label": "Space Radiator 3x1",
    "category": "space__",
    "width": 48,
    "height": 16,
    "filePath": "assets/space-radiator-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-rcs-2x1",
    "label": "Space Rcs 2x1",
    "category": "space__",
    "width": 32,
    "height": 16,
    "filePath": "assets/space-rcs-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-solar-3x1",
    "label": "Space Solar 3x1",
    "category": "space__",
    "width": 48,
    "height": 16,
    "filePath": "assets/space-solar-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-thruster-1x2",
    "label": "Space Thruster 1x2",
    "category": "space__",
    "width": 16,
    "height": 32,
    "filePath": "assets/space-thruster-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-thruster-2x1",
    "label": "Space Thruster 2x1",
    "category": "space__",
    "width": 32,
    "height": 16,
    "filePath": "assets/space-thruster-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-navlight-1x1",
    "label": "Space Navlight 1x1",
    "category": "space_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/space-navlight-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-navlight-g-1x1",
    "label": "Space Navlight G 1x1",
    "category": "space_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/space-navlight-g-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-probe-1x1",
    "label": "Space Probe 1x1",
    "category": "space_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/space-probe-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-rcs-1x1",
    "label": "Space Rcs 1x1",
    "category": "space_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/space-rcs-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-airlock-2x2",
    "label": "Space Airlock 2x2",
    "category": "space_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/space-airlock-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-antenna-2x2",
    "label": "Space Antenna 2x2",
    "category": "space_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/space-antenna-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-cargo-2x2",
    "label": "Space Cargo 2x2",
    "category": "space_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/space-cargo-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-dish-2x2",
    "label": "Space Dish 2x2",
    "category": "space_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/space-dish-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-dock-clamp-2x2",
    "label": "Space Dock Clamp 2x2",
    "category": "space_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/space-dock-clamp-2x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-dome-2x2",
    "label": "Space Dome 2x2",
    "category": "space_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/space-dome-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-fuel-2x2",
    "label": "Space Fuel 2x2",
    "category": "space_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/space-fuel-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-habitat-2x2",
    "label": "Space Habitat 2x2",
    "category": "space_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/space-habitat-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-sat-2x2",
    "label": "Space Sat 2x2",
    "category": "space_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/space-sat-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-solar-2x2",
    "label": "Space Solar 2x2",
    "category": "space_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/space-solar-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-starfield-2x2",
    "label": "Space Starfield 2x2",
    "category": "space_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/space-starfield-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-thruster-2x2",
    "label": "Space Thruster 2x2",
    "category": "space_2",
    "width": 32,
    "height": 32,
    "filePath": "assets/space-thruster-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "probs-airlock-3x3",
    "label": "Probs Airlock 3x3",
    "category": "space_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/probs-airlock-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-airlock-3x3",
    "label": "Space Airlock 3x3",
    "category": "space_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/space-airlock-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-antenna-array-3x3",
    "label": "Space Antenna Array 3x3",
    "category": "space_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/space-antenna-array-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-dish-3x3",
    "label": "Space Dish 3x3",
    "category": "space_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/space-dish-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-dome-3x3",
    "label": "Space Dome 3x3",
    "category": "space_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/space-dome-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-sat-3x3",
    "label": "Space Sat 3x3",
    "category": "space_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/space-sat-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "space-solar-3x3",
    "label": "Space Solar 3x3",
    "category": "space_3",
    "width": 48,
    "height": 48,
    "filePath": "assets/space-solar-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tele-cyan-2x2",
    "label": "Tele Cyan 2x2",
    "category": "tele_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/tele-cyan-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tele-ice-2x2",
    "label": "Tele Ice 2x2",
    "category": "tele_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/tele-ice-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tele-magma-2x2",
    "label": "Tele Magma 2x2",
    "category": "tele_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/tele-magma-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tele-mirror-2x2",
    "label": "Tele Mirror 2x2",
    "category": "tele_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/tele-mirror-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tele-sand-2x2",
    "label": "Tele Sand 2x2",
    "category": "tele_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/tele-sand-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tele-spore-2x2",
    "label": "Tele Spore 2x2",
    "category": "tele_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/tele-spore-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tele-temple-2x2",
    "label": "Tele Temple 2x2",
    "category": "tele_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/tele-temple-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tele-void-2x2",
    "label": "Tele Void 2x2",
    "category": "tele_2",
    "width": 32,
    "height": 32,
    "filePath": "assets2/tele-void-2x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tele-cyan-3x3",
    "label": "Tele Cyan 3x3",
    "category": "tele_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/tele-cyan-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tele-ice-3x3",
    "label": "Tele Ice 3x3",
    "category": "tele_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/tele-ice-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tele-magma-3x3",
    "label": "Tele Magma 3x3",
    "category": "tele_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/tele-magma-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tele-mirror-3x3",
    "label": "Tele Mirror 3x3",
    "category": "tele_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/tele-mirror-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tele-sand-3x3",
    "label": "Tele Sand 3x3",
    "category": "tele_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/tele-sand-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tele-spore-3x3",
    "label": "Tele Spore 3x3",
    "category": "tele_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/tele-spore-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tele-temple-3x3",
    "label": "Tele Temple 3x3",
    "category": "tele_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/tele-temple-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tele-void-3x3",
    "label": "Tele Void 3x3",
    "category": "tele_3",
    "width": 48,
    "height": 48,
    "filePath": "assets2/tele-void-3x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "totem-bio-1x2",
    "label": "Totem Bio 1x2",
    "category": "totem__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/totem-bio-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "totem-bio-1x3",
    "label": "Totem Bio 1x3",
    "category": "totem__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/totem-bio-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "totem-bot-1x2",
    "label": "Totem Bot 1x2",
    "category": "totem__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/totem-bot-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "totem-bot-1x3",
    "label": "Totem Bot 1x3",
    "category": "totem__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/totem-bot-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "totem-eye-1x2",
    "label": "Totem Eye 1x2",
    "category": "totem__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/totem-eye-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "totem-eye-1x3",
    "label": "Totem Eye 1x3",
    "category": "totem__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/totem-eye-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "totem-gold-1x2",
    "label": "Totem Gold 1x2",
    "category": "totem__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/totem-gold-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "totem-gold-1x3",
    "label": "Totem Gold 1x3",
    "category": "totem__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/totem-gold-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "totem-ice-1x2",
    "label": "Totem Ice 1x2",
    "category": "totem__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/totem-ice-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "totem-ice-1x3",
    "label": "Totem Ice 1x3",
    "category": "totem__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/totem-ice-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "totem-sand-1x2",
    "label": "Totem Sand 1x2",
    "category": "totem__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/totem-sand-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "totem-sand-1x3",
    "label": "Totem Sand 1x3",
    "category": "totem__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/totem-sand-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "totem-skull-1x2",
    "label": "Totem Skull 1x2",
    "category": "totem__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/totem-skull-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "totem-skull-1x3",
    "label": "Totem Skull 1x3",
    "category": "totem__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/totem-skull-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "totem-void-1x2",
    "label": "Totem Void 1x2",
    "category": "totem__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/totem-void-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "totem-void-1x3",
    "label": "Totem Void 1x3",
    "category": "totem__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/totem-void-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-aquarium-1x2",
    "label": "Vert Aquarium 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-aquarium-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-aquarium-1x3",
    "label": "Vert Aquarium 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-aquarium-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-aquarium-1x4",
    "label": "Vert Aquarium 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-aquarium-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-barrels-1x2",
    "label": "Vert Barrels 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-barrels-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-barrels-1x3",
    "label": "Vert Barrels 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-barrels-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-barrels-1x4",
    "label": "Vert Barrels 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-barrels-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-bookshelf-1x2",
    "label": "Vert Bookshelf 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-bookshelf-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-bookshelf-1x3",
    "label": "Vert Bookshelf 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-bookshelf-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-bookshelf-1x4",
    "label": "Vert Bookshelf 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-bookshelf-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-cabinet-1x2",
    "label": "Vert Cabinet 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-cabinet-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-cabinet-1x3",
    "label": "Vert Cabinet 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-cabinet-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-cabinet-1x4",
    "label": "Vert Cabinet 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-cabinet-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-clock-1x2",
    "label": "Vert Clock 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-clock-1x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-clock-1x3",
    "label": "Vert Clock 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-clock-1x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-clock-1x4",
    "label": "Vert Clock 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-clock-1x4.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-coat-rack-1x2",
    "label": "Vert Coat Rack 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-coat-rack-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-coat-rack-1x3",
    "label": "Vert Coat Rack 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-coat-rack-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-coat-rack-1x4",
    "label": "Vert Coat Rack 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-coat-rack-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-crates-1x2",
    "label": "Vert Crates 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-crates-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-crates-1x3",
    "label": "Vert Crates 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-crates-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-crates-1x4",
    "label": "Vert Crates 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-crates-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-data-pillar-1x2",
    "label": "Vert Data Pillar 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-data-pillar-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-data-pillar-1x3",
    "label": "Vert Data Pillar 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-data-pillar-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-data-pillar-1x4",
    "label": "Vert Data Pillar 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-data-pillar-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-flagpole-1x2",
    "label": "Vert Flagpole 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-flagpole-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-flagpole-1x3",
    "label": "Vert Flagpole 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-flagpole-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-flagpole-1x4",
    "label": "Vert Flagpole 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-flagpole-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-fountain-1x2",
    "label": "Vert Fountain 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-fountain-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-fountain-1x3",
    "label": "Vert Fountain 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-fountain-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-fountain-1x4",
    "label": "Vert Fountain 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-fountain-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-fridge-1x2",
    "label": "Vert Fridge 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-fridge-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-fridge-1x3",
    "label": "Vert Fridge 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-fridge-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-fridge-1x4",
    "label": "Vert Fridge 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-fridge-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-gene-vault-1x2",
    "label": "Vert Gene Vault 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-gene-vault-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-gene-vault-1x3",
    "label": "Vert Gene Vault 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-gene-vault-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-gene-vault-1x4",
    "label": "Vert Gene Vault 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-gene-vault-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-incubator-1x2",
    "label": "Vert Incubator 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-incubator-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-incubator-1x3",
    "label": "Vert Incubator 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-incubator-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-incubator-1x4",
    "label": "Vert Incubator 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-incubator-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-ladder-1x2",
    "label": "Vert Ladder 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-ladder-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-ladder-1x3",
    "label": "Vert Ladder 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-ladder-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-ladder-1x4",
    "label": "Vert Ladder 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-ladder-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-lamp-1x2",
    "label": "Vert Lamp 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-lamp-1x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-lamp-1x3",
    "label": "Vert Lamp 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-lamp-1x3.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-lamp-1x4",
    "label": "Vert Lamp 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-lamp-1x4.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-locker-1x2",
    "label": "Vert Locker 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-locker-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-locker-1x3",
    "label": "Vert Locker 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-locker-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-locker-1x4",
    "label": "Vert Locker 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-locker-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-locker-red-1x2",
    "label": "Vert Locker Red 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-locker-red-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-locker-red-1x3",
    "label": "Vert Locker Red 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-locker-red-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-locker-red-1x4",
    "label": "Vert Locker Red 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-locker-red-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-pipe-1x2",
    "label": "Vert Pipe 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-pipe-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-pipe-1x3",
    "label": "Vert Pipe 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-pipe-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-pipe-1x4",
    "label": "Vert Pipe 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-pipe-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-plant-1x2",
    "label": "Vert Plant 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-plant-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-plant-1x3",
    "label": "Vert Plant 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-plant-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-plant-1x4",
    "label": "Vert Plant 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-plant-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-robot-1x2",
    "label": "Vert Robot 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-robot-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-robot-1x3",
    "label": "Vert Robot 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-robot-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-robot-1x4",
    "label": "Vert Robot 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-robot-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-safe-1x2",
    "label": "Vert Safe 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-safe-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-safe-1x3",
    "label": "Vert Safe 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-safe-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-safe-1x4",
    "label": "Vert Safe 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-safe-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-server-1x2",
    "label": "Vert Server 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-server-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-server-1x3",
    "label": "Vert Server 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-server-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-server-1x4",
    "label": "Vert Server 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-server-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-speaker-1x2",
    "label": "Vert Speaker 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-speaker-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-speaker-1x3",
    "label": "Vert Speaker 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-speaker-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-speaker-1x4",
    "label": "Vert Speaker 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-speaker-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-spore-tower-1x2",
    "label": "Vert Spore Tower 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-spore-tower-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-spore-tower-1x3",
    "label": "Vert Spore Tower 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-spore-tower-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-spore-tower-1x4",
    "label": "Vert Spore Tower 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-spore-tower-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-statue-1x2",
    "label": "Vert Statue 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-statue-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-statue-1x3",
    "label": "Vert Statue 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-statue-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-statue-1x4",
    "label": "Vert Statue 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-statue-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-tank-1x2",
    "label": "Vert Tank 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-tank-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-tank-1x3",
    "label": "Vert Tank 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-tank-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-tank-1x4",
    "label": "Vert Tank 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-tank-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-telescope-1x2",
    "label": "Vert Telescope 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-telescope-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-telescope-1x3",
    "label": "Vert Telescope 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-telescope-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-telescope-1x4",
    "label": "Vert Telescope 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-telescope-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-toolbox-1x2",
    "label": "Vert Toolbox 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-toolbox-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-toolbox-1x3",
    "label": "Vert Toolbox 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-toolbox-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-toolbox-1x4",
    "label": "Vert Toolbox 1x4",
    "category": "vert__",
    "width": 16,
    "height": 64,
    "filePath": "assets2/vert-toolbox-1x4.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-umbrella-1x2",
    "label": "Vert Umbrella 1x2",
    "category": "vert__",
    "width": 16,
    "height": 32,
    "filePath": "assets2/vert-umbrella-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "vert-umbrella-1x3",
    "label": "Vert Umbrella 1x3",
    "category": "vert__",
    "width": 16,
    "height": 48,
    "filePath": "assets2/vert-umbrella-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-floor-bronze-1x1",
    "label": "Tile Floor Bronze 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-floor-bronze-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-floor-check-1x1",
    "label": "Tile Floor Check 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-floor-check-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-floor-dirt-1x1",
    "label": "Tile Floor Dirt 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-floor-dirt-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-floor-dots-1x1",
    "label": "Tile Floor Dots 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-floor-dots-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-floor-grass-1x1",
    "label": "Tile Floor Grass 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-floor-grass-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-floor-lines-1x1",
    "label": "Tile Floor Lines 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-floor-lines-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-floor-plate-1x1",
    "label": "Tile Floor Plate 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-floor-plate-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-floor-tech-1x1",
    "label": "Tile Floor Tech 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-floor-tech-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-grating-1x1",
    "label": "Tile Grating 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-grating-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-grating-heavy-1x1",
    "label": "Tile Grating Heavy 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-grating-heavy-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-grating-vent-1x1",
    "label": "Tile Grating Vent 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-grating-vent-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-bronze-1x1",
    "label": "Tile Wall Bronze 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-wall-bronze-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-bronze-tile-1x1",
    "label": "Tile Wall Bronze Tile 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-wall-bronze-tile-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-check-1x1",
    "label": "Tile Wall Check 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-wall-check-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-console-1x1",
    "label": "Tile Wall Console 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-wall-console-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-dots-1x1",
    "label": "Tile Wall Dots 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-wall-dots-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-glass-1x1",
    "label": "Tile Wall Glass 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-wall-glass-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-light-1x1",
    "label": "Tile Wall Light 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-wall-light-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-lines-1x1",
    "label": "Tile Wall Lines 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-wall-lines-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-panel-1x1",
    "label": "Tile Wall Panel 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-wall-panel-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-plate-1x1",
    "label": "Tile Wall Plate 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-wall-plate-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-siding-1x1",
    "label": "Tile Wall Siding 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-wall-siding-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-steel-1x1",
    "label": "Tile Wall Steel 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-wall-steel-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-stripe-1x1",
    "label": "Tile Wall Stripe 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-wall-stripe-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-tech-1x1",
    "label": "Tile Wall Tech 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-wall-tech-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-vent-1x1",
    "label": "Tile Wall Vent 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-wall-vent-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-warning-1x1",
    "label": "Tile Wall Warning 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-wall-warning-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "tile-wall-window-1x1",
    "label": "Tile Wall Window 1x1",
    "category": "walls_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/tile-wall-window-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-bay-4x2",
    "label": "Wide Bay 4x2",
    "category": "wide__",
    "width": 64,
    "height": 32,
    "filePath": "assets/wide-bay-4x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-beam-3x1",
    "label": "Wide Beam 3x1",
    "category": "wide__",
    "width": 48,
    "height": 16,
    "filePath": "assets/wide-beam-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-beam-4x1",
    "label": "Wide Beam 4x1",
    "category": "wide__",
    "width": 64,
    "height": 16,
    "filePath": "assets/wide-beam-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-billboard-3x1",
    "label": "Wide Billboard 3x1",
    "category": "wide__",
    "width": 48,
    "height": 16,
    "filePath": "assets/wide-billboard-3x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-billboard-4x2",
    "label": "Wide Billboard 4x2",
    "category": "wide__",
    "width": 64,
    "height": 32,
    "filePath": "assets/wide-billboard-4x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-bridge-4x1",
    "label": "Wide Bridge 4x1",
    "category": "wide__",
    "width": 64,
    "height": 16,
    "filePath": "assets/wide-bridge-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-cable-3x1",
    "label": "Wide Cable 3x1",
    "category": "wide__",
    "width": 48,
    "height": 16,
    "filePath": "assets/wide-cable-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-console-3x1",
    "label": "Wide Console 3x1",
    "category": "wide__",
    "width": 48,
    "height": 16,
    "filePath": "assets/wide-console-3x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-console-4x2",
    "label": "Wide Console 4x2",
    "category": "wide__",
    "width": 64,
    "height": 32,
    "filePath": "assets/wide-console-4x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-console-alt-3x1",
    "label": "Wide Console Alt 3x1",
    "category": "wide__",
    "width": 48,
    "height": 16,
    "filePath": "assets/wide-console-alt-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-duct-3x1",
    "label": "Wide Duct 3x1",
    "category": "wide__",
    "width": 48,
    "height": 16,
    "filePath": "assets/wide-duct-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-gauges-3x2",
    "label": "Wide Gauges 3x2",
    "category": "wide__",
    "width": 48,
    "height": 32,
    "filePath": "assets/wide-gauges-3x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-keys-3x1",
    "label": "Wide Keys 3x1",
    "category": "wide__",
    "width": 48,
    "height": 16,
    "filePath": "assets/wide-keys-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-ladder-1x3",
    "label": "Wide Ladder 1x3",
    "category": "wide__",
    "width": 16,
    "height": 48,
    "filePath": "assets/wide-ladder-1x3.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-level-bar-3x1",
    "label": "Wide Level Bar 3x1",
    "category": "wide__",
    "width": 48,
    "height": 16,
    "filePath": "assets/wide-level-bar-3x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-level-tank-2x1",
    "label": "Wide Level Tank 2x1",
    "category": "wide__",
    "width": 32,
    "height": 16,
    "filePath": "assets/wide-level-tank-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-level-vert-1x2",
    "label": "Wide Level Vert 1x2",
    "category": "wide__",
    "width": 16,
    "height": 32,
    "filePath": "assets/wide-level-vert-1x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-manifold-3x2",
    "label": "Wide Manifold 3x2",
    "category": "wide__",
    "width": 48,
    "height": 32,
    "filePath": "assets/wide-manifold-3x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-monitor-bank-4x2",
    "label": "Wide Monitor Bank 4x2",
    "category": "wide__",
    "width": 64,
    "height": 32,
    "filePath": "assets/wide-monitor-bank-4x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-pipe-3x1",
    "label": "Wide Pipe 3x1",
    "category": "wide__",
    "width": 48,
    "height": 16,
    "filePath": "assets/wide-pipe-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-pipe-4x1",
    "label": "Wide Pipe 4x1",
    "category": "wide__",
    "width": 64,
    "height": 16,
    "filePath": "assets/wide-pipe-4x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-pipe-coolant-3x1",
    "label": "Wide Pipe Coolant 3x1",
    "category": "wide__",
    "width": 48,
    "height": 16,
    "filePath": "assets/wide-pipe-coolant-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-rail-3x1",
    "label": "Wide Rail 3x1",
    "category": "wide__",
    "width": 48,
    "height": 16,
    "filePath": "assets/wide-rail-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-reactor-strip-4x2",
    "label": "Wide Reactor Strip 4x2",
    "category": "wide__",
    "width": 64,
    "height": 32,
    "filePath": "assets/wide-reactor-strip-4x2.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-shelf-3x1",
    "label": "Wide Shelf 3x1",
    "category": "wide__",
    "width": 48,
    "height": 16,
    "filePath": "assets/wide-shelf-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-sign-2x1",
    "label": "Wide Sign 2x1",
    "category": "wide__",
    "width": 32,
    "height": 16,
    "filePath": "assets/wide-sign-2x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-sign-danger-3x1",
    "label": "Wide Sign Danger 3x1",
    "category": "wide__",
    "width": 48,
    "height": 16,
    "filePath": "assets/wide-sign-danger-3x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-sign-ok-2x1",
    "label": "Wide Sign Ok 2x1",
    "category": "wide__",
    "width": 32,
    "height": 16,
    "filePath": "assets/wide-sign-ok-2x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-status-3x1",
    "label": "Wide Status 3x1",
    "category": "wide__",
    "width": 48,
    "height": 16,
    "filePath": "assets/wide-status-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-valve-1x2",
    "label": "Wide Valve 1x2",
    "category": "wide__",
    "width": 16,
    "height": 32,
    "filePath": "assets/wide-valve-1x2.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-valve-2x1",
    "label": "Wide Valve 2x1",
    "category": "wide__",
    "width": 32,
    "height": 16,
    "filePath": "assets/wide-valve-2x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-warning-2x1",
    "label": "Wide Warning 2x1",
    "category": "wide__",
    "width": 32,
    "height": 16,
    "filePath": "assets/wide-warning-2x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-warning-3x1",
    "label": "Wide Warning 3x1",
    "category": "wide__",
    "width": 48,
    "height": 16,
    "filePath": "assets/wide-warning-3x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-level-vert-1x1",
    "label": "Wide Level Vert 1x1",
    "category": "wide_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/wide-level-vert-1x1.png",
    "align": "floor",
    "description": "Decorative. No collision."
  },
  {
    "id": "wide-valve-1x1",
    "label": "Wide Valve 1x1",
    "category": "wide_1",
    "width": 16,
    "height": 16,
    "filePath": "assets/wide-valve-1x1.png",
    "align": "wall",
    "description": "Decorative. No collision."
  }
];
var ICON_FILES = [
  {
    "id": "icons",
    "filePath": "assets/char-A-1x1.png"
  },
  {
    "id": "icon-arrow-back-1x1",
    "filePath": "assets/icon-arrow-back-1x1.png"
  },
  {
    "id": "icon-arrow-bounce-1x1",
    "filePath": "assets/icon-arrow-bounce-1x1.png"
  },
  {
    "id": "icon-arrow-circle-down-1x1",
    "filePath": "assets/icon-arrow-circle-down-1x1.png"
  },
  {
    "id": "icon-arrow-circle-left-1x1",
    "filePath": "assets/icon-arrow-circle-left-1x1.png"
  },
  {
    "id": "icon-arrow-circle-right-1x1",
    "filePath": "assets/icon-arrow-circle-right-1x1.png"
  },
  {
    "id": "icon-arrow-circle-up-1x1",
    "filePath": "assets/icon-arrow-circle-up-1x1.png"
  },
  {
    "id": "icon-arrow-collapse-1x1",
    "filePath": "assets/icon-arrow-collapse-1x1.png"
  },
  {
    "id": "icon-arrow-double-down-1x1",
    "filePath": "assets/icon-arrow-double-down-1x1.png"
  },
  {
    "id": "icon-arrow-double-left-1x1",
    "filePath": "assets/icon-arrow-double-left-1x1.png"
  },
  {
    "id": "icon-arrow-double-right-1x1",
    "filePath": "assets/icon-arrow-double-right-1x1.png"
  },
  {
    "id": "icon-arrow-double-up-1x1",
    "filePath": "assets/icon-arrow-double-up-1x1.png"
  },
  {
    "id": "icon-arrow-down-1x1",
    "filePath": "assets/icon-arrow-down-1x1.png"
  },
  {
    "id": "icon-arrow-down-left-1x1",
    "filePath": "assets/icon-arrow-down-left-1x1.png"
  },
  {
    "id": "icon-arrow-down-right-1x1",
    "filePath": "assets/icon-arrow-down-right-1x1.png"
  },
  {
    "id": "icon-arrow-enter-1x1",
    "filePath": "assets/icon-arrow-enter-1x1.png"
  },
  {
    "id": "icon-arrow-expand-1x1",
    "filePath": "assets/icon-arrow-expand-1x1.png"
  },
  {
    "id": "icon-arrow-fork-1x1",
    "filePath": "assets/icon-arrow-fork-1x1.png"
  },
  {
    "id": "icon-arrow-left-1x1",
    "filePath": "assets/icon-arrow-left-1x1.png"
  },
  {
    "id": "icon-arrow-left-right-1x1",
    "filePath": "assets/icon-arrow-left-right-1x1.png"
  },
  {
    "id": "icon-arrow-merge-1x1",
    "filePath": "assets/icon-arrow-merge-1x1.png"
  },
  {
    "id": "icon-arrow-redo-1x1",
    "filePath": "assets/icon-arrow-redo-1x1.png"
  },
  {
    "id": "icon-arrow-right-1x1",
    "filePath": "assets/icon-arrow-right-1x1.png"
  },
  {
    "id": "icon-arrow-rotate-ccw-1x1",
    "filePath": "assets/icon-arrow-rotate-ccw-1x1.png"
  },
  {
    "id": "icon-arrow-rotate-cw-1x1",
    "filePath": "assets/icon-arrow-rotate-cw-1x1.png"
  },
  {
    "id": "icon-arrow-shuffle-1x1",
    "filePath": "assets/icon-arrow-shuffle-1x1.png"
  },
  {
    "id": "icon-arrow-sort-1x1",
    "filePath": "assets/icon-arrow-sort-1x1.png"
  },
  {
    "id": "icon-arrow-trend-down-1x1",
    "filePath": "assets/icon-arrow-trend-down-1x1.png"
  },
  {
    "id": "icon-arrow-trend-up-1x1",
    "filePath": "assets/icon-arrow-trend-up-1x1.png"
  },
  {
    "id": "icon-arrow-undo-1x1",
    "filePath": "assets/icon-arrow-undo-1x1.png"
  },
  {
    "id": "icon-arrow-up-1x1",
    "filePath": "assets/icon-arrow-up-1x1.png"
  },
  {
    "id": "icon-arrow-up-down-1x1",
    "filePath": "assets/icon-arrow-up-down-1x1.png"
  },
  {
    "id": "icon-arrow-up-left-1x1",
    "filePath": "assets/icon-arrow-up-left-1x1.png"
  },
  {
    "id": "icon-arrow-up-right-1x1",
    "filePath": "assets/icon-arrow-up-right-1x1.png"
  },
  {
    "id": "icon-arrow-back-2x2",
    "filePath": "assets/icon-arrow-back-2x2.png"
  },
  {
    "id": "icon-arrow-bounce-2x2",
    "filePath": "assets/icon-arrow-bounce-2x2.png"
  },
  {
    "id": "icon-arrow-circle-down-2x2",
    "filePath": "assets/icon-arrow-circle-down-2x2.png"
  },
  {
    "id": "icon-arrow-circle-left-2x2",
    "filePath": "assets/icon-arrow-circle-left-2x2.png"
  },
  {
    "id": "icon-arrow-circle-right-2x2",
    "filePath": "assets/icon-arrow-circle-right-2x2.png"
  },
  {
    "id": "icon-arrow-circle-up-2x2",
    "filePath": "assets/icon-arrow-circle-up-2x2.png"
  },
  {
    "id": "icon-arrow-collapse-2x2",
    "filePath": "assets/icon-arrow-collapse-2x2.png"
  },
  {
    "id": "icon-arrow-double-down-2x2",
    "filePath": "assets/icon-arrow-double-down-2x2.png"
  },
  {
    "id": "icon-arrow-double-left-2x2",
    "filePath": "assets/icon-arrow-double-left-2x2.png"
  },
  {
    "id": "icon-arrow-double-right-2x2",
    "filePath": "assets/icon-arrow-double-right-2x2.png"
  },
  {
    "id": "icon-arrow-double-up-2x2",
    "filePath": "assets/icon-arrow-double-up-2x2.png"
  },
  {
    "id": "icon-arrow-down-2x2",
    "filePath": "assets/icon-arrow-down-2x2.png"
  },
  {
    "id": "icon-arrow-down-left-2x2",
    "filePath": "assets/icon-arrow-down-left-2x2.png"
  },
  {
    "id": "icon-arrow-down-right-2x2",
    "filePath": "assets/icon-arrow-down-right-2x2.png"
  },
  {
    "id": "icon-arrow-enter-2x2",
    "filePath": "assets/icon-arrow-enter-2x2.png"
  },
  {
    "id": "icon-arrow-expand-2x2",
    "filePath": "assets/icon-arrow-expand-2x2.png"
  },
  {
    "id": "icon-arrow-fork-2x2",
    "filePath": "assets/icon-arrow-fork-2x2.png"
  },
  {
    "id": "icon-arrow-left-2x2",
    "filePath": "assets/icon-arrow-left-2x2.png"
  },
  {
    "id": "icon-arrow-left-right-2x2",
    "filePath": "assets/icon-arrow-left-right-2x2.png"
  },
  {
    "id": "icon-arrow-merge-2x2",
    "filePath": "assets/icon-arrow-merge-2x2.png"
  },
  {
    "id": "icon-arrow-redo-2x2",
    "filePath": "assets/icon-arrow-redo-2x2.png"
  },
  {
    "id": "icon-arrow-right-2x2",
    "filePath": "assets/icon-arrow-right-2x2.png"
  },
  {
    "id": "icon-arrow-rotate-ccw-2x2",
    "filePath": "assets/icon-arrow-rotate-ccw-2x2.png"
  },
  {
    "id": "icon-arrow-rotate-cw-2x2",
    "filePath": "assets/icon-arrow-rotate-cw-2x2.png"
  },
  {
    "id": "icon-arrow-shuffle-2x2",
    "filePath": "assets/icon-arrow-shuffle-2x2.png"
  },
  {
    "id": "icon-arrow-sort-2x2",
    "filePath": "assets/icon-arrow-sort-2x2.png"
  },
  {
    "id": "icon-arrow-trend-down-2x2",
    "filePath": "assets/icon-arrow-trend-down-2x2.png"
  },
  {
    "id": "icon-arrow-trend-up-2x2",
    "filePath": "assets/icon-arrow-trend-up-2x2.png"
  },
  {
    "id": "icon-arrow-undo-2x2",
    "filePath": "assets/icon-arrow-undo-2x2.png"
  },
  {
    "id": "icon-arrow-up-2x2",
    "filePath": "assets/icon-arrow-up-2x2.png"
  },
  {
    "id": "icon-arrow-up-down-2x2",
    "filePath": "assets/icon-arrow-up-down-2x2.png"
  },
  {
    "id": "icon-arrow-up-left-2x2",
    "filePath": "assets/icon-arrow-up-left-2x2.png"
  },
  {
    "id": "icon-arrow-up-right-2x2",
    "filePath": "assets/icon-arrow-up-right-2x2.png"
  },
  {
    "id": "icon-arrow-back-3x3",
    "filePath": "assets/icon-arrow-back-3x3.png"
  },
  {
    "id": "icon-arrow-bounce-3x3",
    "filePath": "assets/icon-arrow-bounce-3x3.png"
  },
  {
    "id": "icon-arrow-circle-down-3x3",
    "filePath": "assets/icon-arrow-circle-down-3x3.png"
  },
  {
    "id": "icon-arrow-circle-left-3x3",
    "filePath": "assets/icon-arrow-circle-left-3x3.png"
  },
  {
    "id": "icon-arrow-circle-right-3x3",
    "filePath": "assets/icon-arrow-circle-right-3x3.png"
  },
  {
    "id": "icon-arrow-circle-up-3x3",
    "filePath": "assets/icon-arrow-circle-up-3x3.png"
  },
  {
    "id": "icon-arrow-collapse-3x3",
    "filePath": "assets/icon-arrow-collapse-3x3.png"
  },
  {
    "id": "icon-arrow-double-down-3x3",
    "filePath": "assets/icon-arrow-double-down-3x3.png"
  },
  {
    "id": "icon-arrow-double-left-3x3",
    "filePath": "assets/icon-arrow-double-left-3x3.png"
  },
  {
    "id": "icon-arrow-double-right-3x3",
    "filePath": "assets/icon-arrow-double-right-3x3.png"
  },
  {
    "id": "icon-arrow-double-up-3x3",
    "filePath": "assets/icon-arrow-double-up-3x3.png"
  },
  {
    "id": "icon-arrow-down-3x3",
    "filePath": "assets/icon-arrow-down-3x3.png"
  },
  {
    "id": "icon-arrow-down-left-3x3",
    "filePath": "assets/icon-arrow-down-left-3x3.png"
  },
  {
    "id": "icon-arrow-down-right-3x3",
    "filePath": "assets/icon-arrow-down-right-3x3.png"
  },
  {
    "id": "icon-arrow-enter-3x3",
    "filePath": "assets/icon-arrow-enter-3x3.png"
  },
  {
    "id": "icon-arrow-expand-3x3",
    "filePath": "assets/icon-arrow-expand-3x3.png"
  },
  {
    "id": "icon-arrow-fork-3x3",
    "filePath": "assets/icon-arrow-fork-3x3.png"
  },
  {
    "id": "icon-arrow-left-3x3",
    "filePath": "assets/icon-arrow-left-3x3.png"
  },
  {
    "id": "icon-arrow-left-right-3x3",
    "filePath": "assets/icon-arrow-left-right-3x3.png"
  },
  {
    "id": "icon-arrow-merge-3x3",
    "filePath": "assets/icon-arrow-merge-3x3.png"
  },
  {
    "id": "icon-arrow-redo-3x3",
    "filePath": "assets/icon-arrow-redo-3x3.png"
  },
  {
    "id": "icon-arrow-right-3x3",
    "filePath": "assets/icon-arrow-right-3x3.png"
  },
  {
    "id": "icon-arrow-rotate-ccw-3x3",
    "filePath": "assets/icon-arrow-rotate-ccw-3x3.png"
  },
  {
    "id": "icon-arrow-rotate-cw-3x3",
    "filePath": "assets/icon-arrow-rotate-cw-3x3.png"
  },
  {
    "id": "icon-arrow-shuffle-3x3",
    "filePath": "assets/icon-arrow-shuffle-3x3.png"
  },
  {
    "id": "icon-arrow-sort-3x3",
    "filePath": "assets/icon-arrow-sort-3x3.png"
  },
  {
    "id": "icon-arrow-trend-down-3x3",
    "filePath": "assets/icon-arrow-trend-down-3x3.png"
  },
  {
    "id": "icon-arrow-trend-up-3x3",
    "filePath": "assets/icon-arrow-trend-up-3x3.png"
  },
  {
    "id": "icon-arrow-undo-3x3",
    "filePath": "assets/icon-arrow-undo-3x3.png"
  },
  {
    "id": "icon-arrow-up-3x3",
    "filePath": "assets/icon-arrow-up-3x3.png"
  },
  {
    "id": "icon-arrow-up-down-3x3",
    "filePath": "assets/icon-arrow-up-down-3x3.png"
  },
  {
    "id": "icon-arrow-up-left-3x3",
    "filePath": "assets/icon-arrow-up-left-3x3.png"
  },
  {
    "id": "icon-arrow-up-right-3x3",
    "filePath": "assets/icon-arrow-up-right-3x3.png"
  },
  {
    "id": "banner-atom-1x2",
    "filePath": "assets2/banner-atom-1x2.png"
  },
  {
    "id": "banner-atom-1x3",
    "filePath": "assets2/banner-atom-1x3.png"
  },
  {
    "id": "banner-atom-1x4",
    "filePath": "assets2/banner-atom-1x4.png"
  },
  {
    "id": "banner-bio-1x2",
    "filePath": "assets2/banner-bio-1x2.png"
  },
  {
    "id": "banner-bio-1x3",
    "filePath": "assets2/banner-bio-1x3.png"
  },
  {
    "id": "banner-bio-1x4",
    "filePath": "assets2/banner-bio-1x4.png"
  },
  {
    "id": "banner-blue-1x2",
    "filePath": "assets2/banner-blue-1x2.png"
  },
  {
    "id": "banner-blue-1x3",
    "filePath": "assets2/banner-blue-1x3.png"
  },
  {
    "id": "banner-blue-1x4",
    "filePath": "assets2/banner-blue-1x4.png"
  },
  {
    "id": "banner-bolt-1x2",
    "filePath": "assets2/banner-bolt-1x2.png"
  },
  {
    "id": "banner-bolt-1x3",
    "filePath": "assets2/banner-bolt-1x3.png"
  },
  {
    "id": "banner-bolt-1x4",
    "filePath": "assets2/banner-bolt-1x4.png"
  },
  {
    "id": "banner-diamond-1x2",
    "filePath": "assets2/banner-diamond-1x2.png"
  },
  {
    "id": "banner-diamond-1x3",
    "filePath": "assets2/banner-diamond-1x3.png"
  },
  {
    "id": "banner-diamond-1x4",
    "filePath": "assets2/banner-diamond-1x4.png"
  },
  {
    "id": "banner-flame-1x2",
    "filePath": "assets2/banner-flame-1x2.png"
  },
  {
    "id": "banner-flame-1x3",
    "filePath": "assets2/banner-flame-1x3.png"
  },
  {
    "id": "banner-flame-1x4",
    "filePath": "assets2/banner-flame-1x4.png"
  },
  {
    "id": "banner-gear-1x2",
    "filePath": "assets2/banner-gear-1x2.png"
  },
  {
    "id": "banner-gear-1x3",
    "filePath": "assets2/banner-gear-1x3.png"
  },
  {
    "id": "banner-gear-1x4",
    "filePath": "assets2/banner-gear-1x4.png"
  },
  {
    "id": "banner-green-1x2",
    "filePath": "assets2/banner-green-1x2.png"
  },
  {
    "id": "banner-green-1x3",
    "filePath": "assets2/banner-green-1x3.png"
  },
  {
    "id": "banner-green-1x4",
    "filePath": "assets2/banner-green-1x4.png"
  },
  {
    "id": "banner-red-1x2",
    "filePath": "assets2/banner-red-1x2.png"
  },
  {
    "id": "banner-red-1x3",
    "filePath": "assets2/banner-red-1x3.png"
  },
  {
    "id": "banner-red-1x4",
    "filePath": "assets2/banner-red-1x4.png"
  },
  {
    "id": "banner-skull-1x2",
    "filePath": "assets2/banner-skull-1x2.png"
  },
  {
    "id": "banner-skull-1x3",
    "filePath": "assets2/banner-skull-1x3.png"
  },
  {
    "id": "banner-skull-1x4",
    "filePath": "assets2/banner-skull-1x4.png"
  },
  {
    "id": "banner-spore-1x2",
    "filePath": "assets2/banner-spore-1x2.png"
  },
  {
    "id": "banner-spore-1x3",
    "filePath": "assets2/banner-spore-1x3.png"
  },
  {
    "id": "banner-spore-1x4",
    "filePath": "assets2/banner-spore-1x4.png"
  },
  {
    "id": "banner-star-1x2",
    "filePath": "assets2/banner-star-1x2.png"
  },
  {
    "id": "banner-star-1x3",
    "filePath": "assets2/banner-star-1x3.png"
  },
  {
    "id": "banner-star-1x4",
    "filePath": "assets2/banner-star-1x4.png"
  },
  {
    "id": "banner-tech-1x2",
    "filePath": "assets2/banner-tech-1x2.png"
  },
  {
    "id": "banner-tech-1x3",
    "filePath": "assets2/banner-tech-1x3.png"
  },
  {
    "id": "banner-tech-1x4",
    "filePath": "assets2/banner-tech-1x4.png"
  },
  {
    "id": "banner-warning-1x2",
    "filePath": "assets2/banner-warning-1x2.png"
  },
  {
    "id": "banner-warning-1x3",
    "filePath": "assets2/banner-warning-1x3.png"
  },
  {
    "id": "banner-warning-1x4",
    "filePath": "assets2/banner-warning-1x4.png"
  },
  {
    "id": "banner-wave-1x2",
    "filePath": "assets2/banner-wave-1x2.png"
  },
  {
    "id": "banner-wave-1x3",
    "filePath": "assets2/banner-wave-1x3.png"
  },
  {
    "id": "banner-wave-1x4",
    "filePath": "assets2/banner-wave-1x4.png"
  },
  {
    "id": "beacon-alert-1x2",
    "filePath": "assets2/beacon-alert-1x2.png"
  },
  {
    "id": "beacon-alert-1x3",
    "filePath": "assets2/beacon-alert-1x3.png"
  },
  {
    "id": "beacon-amber-1x2",
    "filePath": "assets2/beacon-amber-1x2.png"
  },
  {
    "id": "beacon-amber-1x3",
    "filePath": "assets2/beacon-amber-1x3.png"
  },
  {
    "id": "beacon-bio-1x2",
    "filePath": "assets2/beacon-bio-1x2.png"
  },
  {
    "id": "beacon-bio-1x3",
    "filePath": "assets2/beacon-bio-1x3.png"
  },
  {
    "id": "beacon-cyan-1x2",
    "filePath": "assets2/beacon-cyan-1x2.png"
  },
  {
    "id": "beacon-cyan-1x3",
    "filePath": "assets2/beacon-cyan-1x3.png"
  },
  {
    "id": "beacon-ice-1x2",
    "filePath": "assets2/beacon-ice-1x2.png"
  },
  {
    "id": "beacon-ice-1x3",
    "filePath": "assets2/beacon-ice-1x3.png"
  },
  {
    "id": "beacon-moth-1x2",
    "filePath": "assets2/beacon-moth-1x2.png"
  },
  {
    "id": "beacon-moth-1x3",
    "filePath": "assets2/beacon-moth-1x3.png"
  },
  {
    "id": "beacon-rainbow-1x2",
    "filePath": "assets2/beacon-rainbow-1x2.png"
  },
  {
    "id": "beacon-rainbow-1x3",
    "filePath": "assets2/beacon-rainbow-1x3.png"
  },
  {
    "id": "beacon-spore-1x2",
    "filePath": "assets2/beacon-spore-1x2.png"
  },
  {
    "id": "beacon-spore-1x3",
    "filePath": "assets2/beacon-spore-1x3.png"
  },
  {
    "id": "beacon-strobe-1x2",
    "filePath": "assets2/beacon-strobe-1x2.png"
  },
  {
    "id": "beacon-strobe-1x3",
    "filePath": "assets2/beacon-strobe-1x3.png"
  },
  {
    "id": "beacon-torch-1x2",
    "filePath": "assets2/beacon-torch-1x2.png"
  },
  {
    "id": "beacon-torch-1x3",
    "filePath": "assets2/beacon-torch-1x3.png"
  },
  {
    "id": "beacon-alert-1x1",
    "filePath": "assets2/beacon-alert-1x1.png"
  },
  {
    "id": "beacon-amber-1x1",
    "filePath": "assets2/beacon-amber-1x1.png"
  },
  {
    "id": "beacon-bio-1x1",
    "filePath": "assets2/beacon-bio-1x1.png"
  },
  {
    "id": "beacon-cyan-1x1",
    "filePath": "assets2/beacon-cyan-1x1.png"
  },
  {
    "id": "beacon-ice-1x1",
    "filePath": "assets2/beacon-ice-1x1.png"
  },
  {
    "id": "beacon-moth-1x1",
    "filePath": "assets2/beacon-moth-1x1.png"
  },
  {
    "id": "beacon-rainbow-1x1",
    "filePath": "assets2/beacon-rainbow-1x1.png"
  },
  {
    "id": "beacon-spore-1x1",
    "filePath": "assets2/beacon-spore-1x1.png"
  },
  {
    "id": "beacon-strobe-1x1",
    "filePath": "assets2/beacon-strobe-1x1.png"
  },
  {
    "id": "beacon-torch-1x1",
    "filePath": "assets2/beacon-torch-1x1.png"
  },
  {
    "id": "bg-bio-membrane-1x1",
    "filePath": "assets2/bg-bio-membrane-1x1.png"
  },
  {
    "id": "bg-blueprint-1x1",
    "filePath": "assets2/bg-blueprint-1x1.png"
  },
  {
    "id": "bg-brick-dark-1x1",
    "filePath": "assets2/bg-brick-dark-1x1.png"
  },
  {
    "id": "bg-brick-red-1x1",
    "filePath": "assets2/bg-brick-red-1x1.png"
  },
  {
    "id": "bg-brick-white-1x1",
    "filePath": "assets2/bg-brick-white-1x1.png"
  },
  {
    "id": "bg-cables-1x1",
    "filePath": "assets2/bg-cables-1x1.png"
  },
  {
    "id": "bg-carbon-1x1",
    "filePath": "assets2/bg-carbon-1x1.png"
  },
  {
    "id": "bg-circuit-1x1",
    "filePath": "assets2/bg-circuit-1x1.png"
  },
  {
    "id": "bg-concrete-1x1",
    "filePath": "assets2/bg-concrete-1x1.png"
  },
  {
    "id": "bg-concrete-crack-1x1",
    "filePath": "assets2/bg-concrete-crack-1x1.png"
  },
  {
    "id": "bg-corrugated-1x1",
    "filePath": "assets2/bg-corrugated-1x1.png"
  },
  {
    "id": "bg-crate-face-1x1",
    "filePath": "assets2/bg-crate-face-1x1.png"
  },
  {
    "id": "bg-diamond-plate-1x1",
    "filePath": "assets2/bg-diamond-plate-1x1.png"
  },
  {
    "id": "bg-glass-block-1x1",
    "filePath": "assets2/bg-glass-block-1x1.png"
  },
  {
    "id": "bg-grime-1x1",
    "filePath": "assets2/bg-grime-1x1.png"
  },
  {
    "id": "bg-hex-1x1",
    "filePath": "assets2/bg-hex-1x1.png"
  },
  {
    "id": "bg-honeycomb-1x1",
    "filePath": "assets2/bg-honeycomb-1x1.png"
  },
  {
    "id": "bg-insulation-1x1",
    "filePath": "assets2/bg-insulation-1x1.png"
  },
  {
    "id": "bg-led-grid-1x1",
    "filePath": "assets2/bg-led-grid-1x1.png"
  },
  {
    "id": "bg-metal-bronze-1x1",
    "filePath": "assets2/bg-metal-bronze-1x1.png"
  },
  {
    "id": "bg-metal-dark-1x1",
    "filePath": "assets2/bg-metal-dark-1x1.png"
  },
  {
    "id": "bg-metal-plate-1x1",
    "filePath": "assets2/bg-metal-plate-1x1.png"
  },
  {
    "id": "bg-metal-rivet-1x1",
    "filePath": "assets2/bg-metal-rivet-1x1.png"
  },
  {
    "id": "bg-neon-1x1",
    "filePath": "assets2/bg-neon-1x1.png"
  },
  {
    "id": "bg-padded-1x1",
    "filePath": "assets2/bg-padded-1x1.png"
  },
  {
    "id": "bg-panel-screen-1x1",
    "filePath": "assets2/bg-panel-screen-1x1.png"
  },
  {
    "id": "bg-panel-steel-1x1",
    "filePath": "assets2/bg-panel-steel-1x1.png"
  },
  {
    "id": "bg-panel-warning-1x1",
    "filePath": "assets2/bg-panel-warning-1x1.png"
  },
  {
    "id": "bg-pipes-1x1",
    "filePath": "assets2/bg-pipes-1x1.png"
  },
  {
    "id": "bg-poster-1x1",
    "filePath": "assets2/bg-poster-1x1.png"
  },
  {
    "id": "bg-rust-1x1",
    "filePath": "assets2/bg-rust-1x1.png"
  },
  {
    "id": "bg-spore-1x1",
    "filePath": "assets2/bg-spore-1x1.png"
  },
  {
    "id": "bg-stars-1x1",
    "filePath": "assets2/bg-stars-1x1.png"
  },
  {
    "id": "bg-stone-1x1",
    "filePath": "assets2/bg-stone-1x1.png"
  },
  {
    "id": "bg-stripe-hazard-1x1",
    "filePath": "assets2/bg-stripe-hazard-1x1.png"
  },
  {
    "id": "bg-stripe-red-1x1",
    "filePath": "assets2/bg-stripe-red-1x1.png"
  },
  {
    "id": "bg-tile-green-1x1",
    "filePath": "assets2/bg-tile-green-1x1.png"
  },
  {
    "id": "bg-tile-lab-1x1",
    "filePath": "assets2/bg-tile-lab-1x1.png"
  },
  {
    "id": "bg-tile-white-1x1",
    "filePath": "assets2/bg-tile-white-1x1.png"
  },
  {
    "id": "bg-vent-1x1",
    "filePath": "assets2/bg-vent-1x1.png"
  },
  {
    "id": "bg-warning-band-1x1",
    "filePath": "assets2/bg-warning-band-1x1.png"
  },
  {
    "id": "bg-window-1x1",
    "filePath": "assets2/bg-window-1x1.png"
  },
  {
    "id": "bg-window-bars-1x1",
    "filePath": "assets2/bg-window-bars-1x1.png"
  },
  {
    "id": "bg-wood-1x1",
    "filePath": "assets2/bg-wood-1x1.png"
  },
  {
    "id": "block-acid-1x1",
    "filePath": "assets2/block-acid-1x1.png"
  },
  {
    "id": "block-asphalt-1x1",
    "filePath": "assets2/block-asphalt-1x1.png"
  },
  {
    "id": "block-bio-gel-1x1",
    "filePath": "assets2/block-bio-gel-1x1.png"
  },
  {
    "id": "block-brick-1x1",
    "filePath": "assets2/block-brick-1x1.png"
  },
  {
    "id": "block-bronze-1x1",
    "filePath": "assets2/block-bronze-1x1.png"
  },
  {
    "id": "block-carbon-1x1",
    "filePath": "assets2/block-carbon-1x1.png"
  },
  {
    "id": "block-ceramic-1x1",
    "filePath": "assets2/block-ceramic-1x1.png"
  },
  {
    "id": "block-checker-1x1",
    "filePath": "assets2/block-checker-1x1.png"
  },
  {
    "id": "block-circuit-1x1",
    "filePath": "assets2/block-circuit-1x1.png"
  },
  {
    "id": "block-cobble-1x1",
    "filePath": "assets2/block-cobble-1x1.png"
  },
  {
    "id": "block-concrete-1x1",
    "filePath": "assets2/block-concrete-1x1.png"
  },
  {
    "id": "block-copper-1x1",
    "filePath": "assets2/block-copper-1x1.png"
  },
  {
    "id": "block-crystal-1x1",
    "filePath": "assets2/block-crystal-1x1.png"
  },
  {
    "id": "block-diamond-1x1",
    "filePath": "assets2/block-diamond-1x1.png"
  },
  {
    "id": "block-dirt-1x1",
    "filePath": "assets2/block-dirt-1x1.png"
  },
  {
    "id": "block-glass-1x1",
    "filePath": "assets2/block-glass-1x1.png"
  },
  {
    "id": "block-gold-1x1",
    "filePath": "assets2/block-gold-1x1.png"
  },
  {
    "id": "block-grass-1x1",
    "filePath": "assets2/block-grass-1x1.png"
  },
  {
    "id": "block-grate-1x1",
    "filePath": "assets2/block-grate-1x1.png"
  },
  {
    "id": "block-gravel-1x1",
    "filePath": "assets2/block-gravel-1x1.png"
  },
  {
    "id": "block-hazard-1x1",
    "filePath": "assets2/block-hazard-1x1.png"
  },
  {
    "id": "block-hex-1x1",
    "filePath": "assets2/block-hex-1x1.png"
  },
  {
    "id": "block-ice-1x1",
    "filePath": "assets2/block-ice-1x1.png"
  },
  {
    "id": "block-lava-1x1",
    "filePath": "assets2/block-lava-1x1.png"
  },
  {
    "id": "block-marble-1x1",
    "filePath": "assets2/block-marble-1x1.png"
  },
  {
    "id": "block-mesh-1x1",
    "filePath": "assets2/block-mesh-1x1.png"
  },
  {
    "id": "block-moss-1x1",
    "filePath": "assets2/block-moss-1x1.png"
  },
  {
    "id": "block-obsidian-1x1",
    "filePath": "assets2/block-obsidian-1x1.png"
  },
  {
    "id": "block-padded-1x1",
    "filePath": "assets2/block-padded-1x1.png"
  },
  {
    "id": "block-plasma-1x1",
    "filePath": "assets2/block-plasma-1x1.png"
  },
  {
    "id": "block-rubber-1x1",
    "filePath": "assets2/block-rubber-1x1.png"
  },
  {
    "id": "block-rust-1x1",
    "filePath": "assets2/block-rust-1x1.png"
  },
  {
    "id": "block-sand-1x1",
    "filePath": "assets2/block-sand-1x1.png"
  },
  {
    "id": "block-snow-1x1",
    "filePath": "assets2/block-snow-1x1.png"
  },
  {
    "id": "block-solar-1x1",
    "filePath": "assets2/block-solar-1x1.png"
  },
  {
    "id": "block-steel-1x1",
    "filePath": "assets2/block-steel-1x1.png"
  },
  {
    "id": "block-steel-lite-1x1",
    "filePath": "assets2/block-steel-lite-1x1.png"
  },
  {
    "id": "block-tech-1x1",
    "filePath": "assets2/block-tech-1x1.png"
  },
  {
    "id": "block-vent-1x1",
    "filePath": "assets2/block-vent-1x1.png"
  },
  {
    "id": "block-void-1x1",
    "filePath": "assets2/block-void-1x1.png"
  },
  {
    "id": "block-warning-1x1",
    "filePath": "assets2/block-warning-1x1.png"
  },
  {
    "id": "block-water-1x1",
    "filePath": "assets2/block-water-1x1.png"
  },
  {
    "id": "block-wood-1x1",
    "filePath": "assets2/block-wood-1x1.png"
  },
  {
    "id": "bot-farm-1x1",
    "filePath": "assets2/bot-farm-1x1.png"
  },
  {
    "id": "bot-haul-1x1",
    "filePath": "assets2/bot-haul-1x1.png"
  },
  {
    "id": "bot-king-1x1",
    "filePath": "assets2/bot-king-1x1.png"
  },
  {
    "id": "bot-medic-1x1",
    "filePath": "assets2/bot-medic-1x1.png"
  },
  {
    "id": "bot-mine-1x1",
    "filePath": "assets2/bot-mine-1x1.png"
  },
  {
    "id": "bot-pet-1x1",
    "filePath": "assets2/bot-pet-1x1.png"
  },
  {
    "id": "bot-scan-1x1",
    "filePath": "assets2/bot-scan-1x1.png"
  },
  {
    "id": "bot-sentry-1x1",
    "filePath": "assets2/bot-sentry-1x1.png"
  },
  {
    "id": "bot-water-1x1",
    "filePath": "assets2/bot-water-1x1.png"
  },
  {
    "id": "bot-weld-1x1",
    "filePath": "assets2/bot-weld-1x1.png"
  },
  {
    "id": "bot-farm-2x2",
    "filePath": "assets2/bot-farm-2x2.png"
  },
  {
    "id": "bot-haul-2x2",
    "filePath": "assets2/bot-haul-2x2.png"
  },
  {
    "id": "bot-king-2x2",
    "filePath": "assets2/bot-king-2x2.png"
  },
  {
    "id": "bot-medic-2x2",
    "filePath": "assets2/bot-medic-2x2.png"
  },
  {
    "id": "bot-mine-2x2",
    "filePath": "assets2/bot-mine-2x2.png"
  },
  {
    "id": "bot-pet-2x2",
    "filePath": "assets2/bot-pet-2x2.png"
  },
  {
    "id": "bot-scan-2x2",
    "filePath": "assets2/bot-scan-2x2.png"
  },
  {
    "id": "bot-sentry-2x2",
    "filePath": "assets2/bot-sentry-2x2.png"
  },
  {
    "id": "bot-water-2x2",
    "filePath": "assets2/bot-water-2x2.png"
  },
  {
    "id": "bot-weld-2x2",
    "filePath": "assets2/bot-weld-2x2.png"
  },
  {
    "id": "bot-farm-3x3",
    "filePath": "assets2/bot-farm-3x3.png"
  },
  {
    "id": "bot-haul-3x3",
    "filePath": "assets2/bot-haul-3x3.png"
  },
  {
    "id": "bot-king-3x3",
    "filePath": "assets2/bot-king-3x3.png"
  },
  {
    "id": "bot-medic-3x3",
    "filePath": "assets2/bot-medic-3x3.png"
  },
  {
    "id": "bot-mine-3x3",
    "filePath": "assets2/bot-mine-3x3.png"
  },
  {
    "id": "bot-pet-3x3",
    "filePath": "assets2/bot-pet-3x3.png"
  },
  {
    "id": "bot-scan-3x3",
    "filePath": "assets2/bot-scan-3x3.png"
  },
  {
    "id": "bot-sentry-3x3",
    "filePath": "assets2/bot-sentry-3x3.png"
  },
  {
    "id": "bot-water-3x3",
    "filePath": "assets2/bot-water-3x3.png"
  },
  {
    "id": "bot-weld-3x3",
    "filePath": "assets2/bot-weld-3x3.png"
  },
  {
    "id": "cable-brick-1x1",
    "filePath": "assets2/cable-brick-1x1.png"
  },
  {
    "id": "cable-clip-1x1",
    "filePath": "assets2/cable-clip-1x1.png"
  },
  {
    "id": "cable-coil-1x1",
    "filePath": "assets2/cable-coil-1x1.png"
  },
  {
    "id": "cable-copper-1x1",
    "filePath": "assets2/cable-copper-1x1.png"
  },
  {
    "id": "cable-data-1x1",
    "filePath": "assets2/cable-data-1x1.png"
  },
  {
    "id": "cable-fiber-1x1",
    "filePath": "assets2/cable-fiber-1x1.png"
  },
  {
    "id": "cable-fuse-1x1",
    "filePath": "assets2/cable-fuse-1x1.png"
  },
  {
    "id": "cable-gold-1x1",
    "filePath": "assets2/cable-gold-1x1.png"
  },
  {
    "id": "cable-ground-1x1",
    "filePath": "assets2/cable-ground-1x1.png"
  },
  {
    "id": "cable-ice-port-1x1",
    "filePath": "assets2/cable-ice-port-1x1.png"
  },
  {
    "id": "cable-nerve-1x1",
    "filePath": "assets2/cable-nerve-1x1.png"
  },
  {
    "id": "cable-nub-1x1",
    "filePath": "assets2/cable-nub-1x1.png"
  },
  {
    "id": "cable-spark-1x1",
    "filePath": "assets2/cable-spark-1x1.png"
  },
  {
    "id": "cable-split-1x1",
    "filePath": "assets2/cable-split-1x1.png"
  },
  {
    "id": "cable-triple-1x1",
    "filePath": "assets2/cable-triple-1x1.png"
  },
  {
    "id": "cable-void-1x1",
    "filePath": "assets2/cable-void-1x1.png"
  },
  {
    "id": "char-0-1x1",
    "filePath": "assets/char-0-1x1.png"
  },
  {
    "id": "char-1-1x1",
    "filePath": "assets/char-1-1x1.png"
  },
  {
    "id": "char-2-1x1",
    "filePath": "assets/char-2-1x1.png"
  },
  {
    "id": "char-3-1x1",
    "filePath": "assets/char-3-1x1.png"
  },
  {
    "id": "char-4-1x1",
    "filePath": "assets/char-4-1x1.png"
  },
  {
    "id": "char-5-1x1",
    "filePath": "assets/char-5-1x1.png"
  },
  {
    "id": "char-6-1x1",
    "filePath": "assets/char-6-1x1.png"
  },
  {
    "id": "char-7-1x1",
    "filePath": "assets/char-7-1x1.png"
  },
  {
    "id": "char-8-1x1",
    "filePath": "assets/char-8-1x1.png"
  },
  {
    "id": "char-9-1x1",
    "filePath": "assets/char-9-1x1.png"
  },
  {
    "id": "char-A-1x1",
    "filePath": "assets/char-A-1x1.png"
  },
  {
    "id": "char-B-1x1",
    "filePath": "assets/char-B-1x1.png"
  },
  {
    "id": "char-C-1x1",
    "filePath": "assets/char-C-1x1.png"
  },
  {
    "id": "char-D-1x1",
    "filePath": "assets/char-D-1x1.png"
  },
  {
    "id": "char-E-1x1",
    "filePath": "assets/char-E-1x1.png"
  },
  {
    "id": "char-F-1x1",
    "filePath": "assets/char-F-1x1.png"
  },
  {
    "id": "char-G-1x1",
    "filePath": "assets/char-G-1x1.png"
  },
  {
    "id": "char-H-1x1",
    "filePath": "assets/char-H-1x1.png"
  },
  {
    "id": "char-I-1x1",
    "filePath": "assets/char-I-1x1.png"
  },
  {
    "id": "char-J-1x1",
    "filePath": "assets/char-J-1x1.png"
  },
  {
    "id": "char-K-1x1",
    "filePath": "assets/char-K-1x1.png"
  },
  {
    "id": "char-L-1x1",
    "filePath": "assets/char-L-1x1.png"
  },
  {
    "id": "char-M-1x1",
    "filePath": "assets/char-M-1x1.png"
  },
  {
    "id": "char-N-1x1",
    "filePath": "assets/char-N-1x1.png"
  },
  {
    "id": "char-O-1x1",
    "filePath": "assets/char-O-1x1.png"
  },
  {
    "id": "char-P-1x1",
    "filePath": "assets/char-P-1x1.png"
  },
  {
    "id": "char-Q-1x1",
    "filePath": "assets/char-Q-1x1.png"
  },
  {
    "id": "char-R-1x1",
    "filePath": "assets/char-R-1x1.png"
  },
  {
    "id": "char-S-1x1",
    "filePath": "assets/char-S-1x1.png"
  },
  {
    "id": "char-sym-amp-1x1",
    "filePath": "assets/char-sym-amp-1x1.png"
  },
  {
    "id": "char-sym-at-1x1",
    "filePath": "assets/char-sym-at-1x1.png"
  },
  {
    "id": "char-sym-brace-l-1x1",
    "filePath": "assets/char-sym-brace-l-1x1.png"
  },
  {
    "id": "char-sym-brace-r-1x1",
    "filePath": "assets/char-sym-brace-r-1x1.png"
  },
  {
    "id": "char-sym-bslash-1x1",
    "filePath": "assets/char-sym-bslash-1x1.png"
  },
  {
    "id": "char-sym-caret-1x1",
    "filePath": "assets/char-sym-caret-1x1.png"
  },
  {
    "id": "char-sym-colon-1x1",
    "filePath": "assets/char-sym-colon-1x1.png"
  },
  {
    "id": "char-sym-comma-1x1",
    "filePath": "assets/char-sym-comma-1x1.png"
  },
  {
    "id": "char-sym-dollar-1x1",
    "filePath": "assets/char-sym-dollar-1x1.png"
  },
  {
    "id": "char-sym-dot-1x1",
    "filePath": "assets/char-sym-dot-1x1.png"
  },
  {
    "id": "char-sym-eq-1x1",
    "filePath": "assets/char-sym-eq-1x1.png"
  },
  {
    "id": "char-sym-excl-1x1",
    "filePath": "assets/char-sym-excl-1x1.png"
  },
  {
    "id": "char-sym-gt-1x1",
    "filePath": "assets/char-sym-gt-1x1.png"
  },
  {
    "id": "char-sym-hash-1x1",
    "filePath": "assets/char-sym-hash-1x1.png"
  },
  {
    "id": "char-sym-lbracket-1x1",
    "filePath": "assets/char-sym-lbracket-1x1.png"
  },
  {
    "id": "char-sym-lparen-1x1",
    "filePath": "assets/char-sym-lparen-1x1.png"
  },
  {
    "id": "char-sym-lt-1x1",
    "filePath": "assets/char-sym-lt-1x1.png"
  },
  {
    "id": "char-sym-minus-1x1",
    "filePath": "assets/char-sym-minus-1x1.png"
  },
  {
    "id": "char-sym-pct-1x1",
    "filePath": "assets/char-sym-pct-1x1.png"
  },
  {
    "id": "char-sym-pipe-1x1",
    "filePath": "assets/char-sym-pipe-1x1.png"
  },
  {
    "id": "char-sym-plus-1x1",
    "filePath": "assets/char-sym-plus-1x1.png"
  },
  {
    "id": "char-sym-quest-1x1",
    "filePath": "assets/char-sym-quest-1x1.png"
  },
  {
    "id": "char-sym-quote-1x1",
    "filePath": "assets/char-sym-quote-1x1.png"
  },
  {
    "id": "char-sym-rbracket-1x1",
    "filePath": "assets/char-sym-rbracket-1x1.png"
  },
  {
    "id": "char-sym-rparen-1x1",
    "filePath": "assets/char-sym-rparen-1x1.png"
  },
  {
    "id": "char-sym-semi-1x1",
    "filePath": "assets/char-sym-semi-1x1.png"
  },
  {
    "id": "char-sym-slash-1x1",
    "filePath": "assets/char-sym-slash-1x1.png"
  },
  {
    "id": "char-sym-star-1x1",
    "filePath": "assets/char-sym-star-1x1.png"
  },
  {
    "id": "char-sym-tilde-1x1",
    "filePath": "assets/char-sym-tilde-1x1.png"
  },
  {
    "id": "char-sym-underscore-1x1",
    "filePath": "assets/char-sym-underscore-1x1.png"
  },
  {
    "id": "char-T-1x1",
    "filePath": "assets/char-T-1x1.png"
  },
  {
    "id": "char-U-1x1",
    "filePath": "assets/char-U-1x1.png"
  },
  {
    "id": "char-V-1x1",
    "filePath": "assets/char-V-1x1.png"
  },
  {
    "id": "char-W-1x1",
    "filePath": "assets/char-W-1x1.png"
  },
  {
    "id": "char-X-1x1",
    "filePath": "assets/char-X-1x1.png"
  },
  {
    "id": "char-Y-1x1",
    "filePath": "assets/char-Y-1x1.png"
  },
  {
    "id": "char-Z-1x1",
    "filePath": "assets/char-Z-1x1.png"
  },
  {
    "id": "char-0-2x2",
    "filePath": "assets/char-0-2x2.png"
  },
  {
    "id": "char-1-2x2",
    "filePath": "assets/char-1-2x2.png"
  },
  {
    "id": "char-2-2x2",
    "filePath": "assets/char-2-2x2.png"
  },
  {
    "id": "char-3-2x2",
    "filePath": "assets/char-3-2x2.png"
  },
  {
    "id": "char-4-2x2",
    "filePath": "assets/char-4-2x2.png"
  },
  {
    "id": "char-5-2x2",
    "filePath": "assets/char-5-2x2.png"
  },
  {
    "id": "char-6-2x2",
    "filePath": "assets/char-6-2x2.png"
  },
  {
    "id": "char-7-2x2",
    "filePath": "assets/char-7-2x2.png"
  },
  {
    "id": "char-8-2x2",
    "filePath": "assets/char-8-2x2.png"
  },
  {
    "id": "char-9-2x2",
    "filePath": "assets/char-9-2x2.png"
  },
  {
    "id": "char-A-2x2",
    "filePath": "assets/char-A-2x2.png"
  },
  {
    "id": "char-B-2x2",
    "filePath": "assets/char-B-2x2.png"
  },
  {
    "id": "char-C-2x2",
    "filePath": "assets/char-C-2x2.png"
  },
  {
    "id": "char-D-2x2",
    "filePath": "assets/char-D-2x2.png"
  },
  {
    "id": "char-E-2x2",
    "filePath": "assets/char-E-2x2.png"
  },
  {
    "id": "char-F-2x2",
    "filePath": "assets/char-F-2x2.png"
  },
  {
    "id": "char-G-2x2",
    "filePath": "assets/char-G-2x2.png"
  },
  {
    "id": "char-H-2x2",
    "filePath": "assets/char-H-2x2.png"
  },
  {
    "id": "char-I-2x2",
    "filePath": "assets/char-I-2x2.png"
  },
  {
    "id": "char-J-2x2",
    "filePath": "assets/char-J-2x2.png"
  },
  {
    "id": "char-K-2x2",
    "filePath": "assets/char-K-2x2.png"
  },
  {
    "id": "char-L-2x2",
    "filePath": "assets/char-L-2x2.png"
  },
  {
    "id": "char-M-2x2",
    "filePath": "assets/char-M-2x2.png"
  },
  {
    "id": "char-N-2x2",
    "filePath": "assets/char-N-2x2.png"
  },
  {
    "id": "char-O-2x2",
    "filePath": "assets/char-O-2x2.png"
  },
  {
    "id": "char-P-2x2",
    "filePath": "assets/char-P-2x2.png"
  },
  {
    "id": "char-Q-2x2",
    "filePath": "assets/char-Q-2x2.png"
  },
  {
    "id": "char-R-2x2",
    "filePath": "assets/char-R-2x2.png"
  },
  {
    "id": "char-S-2x2",
    "filePath": "assets/char-S-2x2.png"
  },
  {
    "id": "char-T-2x2",
    "filePath": "assets/char-T-2x2.png"
  },
  {
    "id": "char-U-2x2",
    "filePath": "assets/char-U-2x2.png"
  },
  {
    "id": "char-V-2x2",
    "filePath": "assets/char-V-2x2.png"
  },
  {
    "id": "char-W-2x2",
    "filePath": "assets/char-W-2x2.png"
  },
  {
    "id": "char-X-2x2",
    "filePath": "assets/char-X-2x2.png"
  },
  {
    "id": "char-Y-2x2",
    "filePath": "assets/char-Y-2x2.png"
  },
  {
    "id": "char-Z-2x2",
    "filePath": "assets/char-Z-2x2.png"
  },
  {
    "id": "core-coil-1x1",
    "filePath": "assets2/core-coil-1x1.png"
  },
  {
    "id": "core-copper-1x1",
    "filePath": "assets2/core-copper-1x1.png"
  },
  {
    "id": "core-fusion-1x1",
    "filePath": "assets2/core-fusion-1x1.png"
  },
  {
    "id": "core-ice-1x1",
    "filePath": "assets2/core-ice-1x1.png"
  },
  {
    "id": "core-leaf-1x1",
    "filePath": "assets2/core-leaf-1x1.png"
  },
  {
    "id": "core-magma-1x1",
    "filePath": "assets2/core-magma-1x1.png"
  },
  {
    "id": "core-prism-1x1",
    "filePath": "assets2/core-prism-1x1.png"
  },
  {
    "id": "core-sand-1x1",
    "filePath": "assets2/core-sand-1x1.png"
  },
  {
    "id": "core-spark-1x1",
    "filePath": "assets2/core-spark-1x1.png"
  },
  {
    "id": "core-spore-1x1",
    "filePath": "assets2/core-spore-1x1.png"
  },
  {
    "id": "core-tesla-1x1",
    "filePath": "assets2/core-tesla-1x1.png"
  },
  {
    "id": "core-void-1x1",
    "filePath": "assets2/core-void-1x1.png"
  },
  {
    "id": "core-coil-2x2",
    "filePath": "assets2/core-coil-2x2.png"
  },
  {
    "id": "core-copper-2x2",
    "filePath": "assets2/core-copper-2x2.png"
  },
  {
    "id": "core-fusion-2x2",
    "filePath": "assets2/core-fusion-2x2.png"
  },
  {
    "id": "core-ice-2x2",
    "filePath": "assets2/core-ice-2x2.png"
  },
  {
    "id": "core-leaf-2x2",
    "filePath": "assets2/core-leaf-2x2.png"
  },
  {
    "id": "core-magma-2x2",
    "filePath": "assets2/core-magma-2x2.png"
  },
  {
    "id": "core-prism-2x2",
    "filePath": "assets2/core-prism-2x2.png"
  },
  {
    "id": "core-sand-2x2",
    "filePath": "assets2/core-sand-2x2.png"
  },
  {
    "id": "core-spark-2x2",
    "filePath": "assets2/core-spark-2x2.png"
  },
  {
    "id": "core-spore-2x2",
    "filePath": "assets2/core-spore-2x2.png"
  },
  {
    "id": "core-tesla-2x2",
    "filePath": "assets2/core-tesla-2x2.png"
  },
  {
    "id": "core-void-2x2",
    "filePath": "assets2/core-void-2x2.png"
  },
  {
    "id": "crew-boss-1x2",
    "filePath": "assets2/crew-boss-1x2.png"
  },
  {
    "id": "crew-boss-1x3",
    "filePath": "assets2/crew-boss-1x3.png"
  },
  {
    "id": "crew-botanist-1x2",
    "filePath": "assets2/crew-botanist-1x2.png"
  },
  {
    "id": "crew-botanist-1x3",
    "filePath": "assets2/crew-botanist-1x3.png"
  },
  {
    "id": "crew-cook-1x2",
    "filePath": "assets2/crew-cook-1x2.png"
  },
  {
    "id": "crew-cook-1x3",
    "filePath": "assets2/crew-cook-1x3.png"
  },
  {
    "id": "crew-engineer-1x2",
    "filePath": "assets2/crew-engineer-1x2.png"
  },
  {
    "id": "crew-engineer-1x3",
    "filePath": "assets2/crew-engineer-1x3.png"
  },
  {
    "id": "crew-miner-1x2",
    "filePath": "assets2/crew-miner-1x2.png"
  },
  {
    "id": "crew-miner-1x3",
    "filePath": "assets2/crew-miner-1x3.png"
  },
  {
    "id": "crew-priest-1x2",
    "filePath": "assets2/crew-priest-1x2.png"
  },
  {
    "id": "crew-priest-1x3",
    "filePath": "assets2/crew-priest-1x3.png"
  },
  {
    "id": "crew-ranger-1x2",
    "filePath": "assets2/crew-ranger-1x2.png"
  },
  {
    "id": "crew-ranger-1x3",
    "filePath": "assets2/crew-ranger-1x3.png"
  },
  {
    "id": "crew-scout-1x2",
    "filePath": "assets2/crew-scout-1x2.png"
  },
  {
    "id": "crew-scout-1x3",
    "filePath": "assets2/crew-scout-1x3.png"
  },
  {
    "id": "debris-anchor-1x1",
    "filePath": "assets2/debris-anchor-1x1.png"
  },
  {
    "id": "debris-banner-torn-1x1",
    "filePath": "assets2/debris-banner-torn-1x1.png"
  },
  {
    "id": "debris-bone-pile-1x1",
    "filePath": "assets2/debris-bone-pile-1x1.png"
  },
  {
    "id": "debris-brick-1x1",
    "filePath": "assets2/debris-brick-1x1.png"
  },
  {
    "id": "debris-circuit-1x1",
    "filePath": "assets2/debris-circuit-1x1.png"
  },
  {
    "id": "debris-column-1x1",
    "filePath": "assets2/debris-column-1x1.png"
  },
  {
    "id": "debris-crate-bit-1x1",
    "filePath": "assets2/debris-crate-bit-1x1.png"
  },
  {
    "id": "debris-gear-1x1",
    "filePath": "assets2/debris-gear-1x1.png"
  },
  {
    "id": "debris-ice-shard-1x1",
    "filePath": "assets2/debris-ice-shard-1x1.png"
  },
  {
    "id": "debris-mask-bit-1x1",
    "filePath": "assets2/debris-mask-bit-1x1.png"
  },
  {
    "id": "debris-mosaic-1x1",
    "filePath": "assets2/debris-mosaic-1x1.png"
  },
  {
    "id": "debris-pipe-bit-1x1",
    "filePath": "assets2/debris-pipe-bit-1x1.png"
  },
  {
    "id": "debris-sand-drift-1x1",
    "filePath": "assets2/debris-sand-drift-1x1.png"
  },
  {
    "id": "debris-statue-head-1x1",
    "filePath": "assets2/debris-statue-head-1x1.png"
  },
  {
    "id": "debris-tile-1x1",
    "filePath": "assets2/debris-tile-1x1.png"
  },
  {
    "id": "debris-urn-1x1",
    "filePath": "assets2/debris-urn-1x1.png"
  },
  {
    "id": "egg-crack-1x1",
    "filePath": "assets2/egg-crack-1x1.png"
  },
  {
    "id": "egg-crystal-1x1",
    "filePath": "assets2/egg-crystal-1x1.png"
  },
  {
    "id": "egg-cyan-1x1",
    "filePath": "assets2/egg-cyan-1x1.png"
  },
  {
    "id": "egg-gold-1x1",
    "filePath": "assets2/egg-gold-1x1.png"
  },
  {
    "id": "egg-ice-1x1",
    "filePath": "assets2/egg-ice-1x1.png"
  },
  {
    "id": "egg-jelly-1x1",
    "filePath": "assets2/egg-jelly-1x1.png"
  },
  {
    "id": "egg-magma-1x1",
    "filePath": "assets2/egg-magma-1x1.png"
  },
  {
    "id": "egg-nest-1x1",
    "filePath": "assets2/egg-nest-1x1.png"
  },
  {
    "id": "egg-pink-1x1",
    "filePath": "assets2/egg-pink-1x1.png"
  },
  {
    "id": "egg-royal-1x1",
    "filePath": "assets2/egg-royal-1x1.png"
  },
  {
    "id": "egg-sand-1x1",
    "filePath": "assets2/egg-sand-1x1.png"
  },
  {
    "id": "egg-spore-1x1",
    "filePath": "assets2/egg-spore-1x1.png"
  },
  {
    "id": "egg-spot-1x1",
    "filePath": "assets2/egg-spot-1x1.png"
  },
  {
    "id": "egg-tiny-1x1",
    "filePath": "assets2/egg-tiny-1x1.png"
  },
  {
    "id": "egg-twin-1x1",
    "filePath": "assets2/egg-twin-1x1.png"
  },
  {
    "id": "egg-void-1x1",
    "filePath": "assets2/egg-void-1x1.png"
  },
  {
    "id": "emoji-alien-1x1",
    "filePath": "assets2/emoji-alien-1x1.png"
  },
  {
    "id": "emoji-angel-1x1",
    "filePath": "assets2/emoji-angel-1x1.png"
  },
  {
    "id": "emoji-angry-1x1",
    "filePath": "assets2/emoji-angry-1x1.png"
  },
  {
    "id": "emoji-cat-1x1",
    "filePath": "assets2/emoji-cat-1x1.png"
  },
  {
    "id": "emoji-cool-1x1",
    "filePath": "assets2/emoji-cool-1x1.png"
  },
  {
    "id": "emoji-cry-1x1",
    "filePath": "assets2/emoji-cry-1x1.png"
  },
  {
    "id": "emoji-dead-1x1",
    "filePath": "assets2/emoji-dead-1x1.png"
  },
  {
    "id": "emoji-devil-1x1",
    "filePath": "assets2/emoji-devil-1x1.png"
  },
  {
    "id": "emoji-grin-1x1",
    "filePath": "assets2/emoji-grin-1x1.png"
  },
  {
    "id": "emoji-heart-eyes-1x1",
    "filePath": "assets2/emoji-heart-eyes-1x1.png"
  },
  {
    "id": "emoji-kiss-1x1",
    "filePath": "assets2/emoji-kiss-1x1.png"
  },
  {
    "id": "emoji-laugh-1x1",
    "filePath": "assets2/emoji-laugh-1x1.png"
  },
  {
    "id": "emoji-love-1x1",
    "filePath": "assets2/emoji-love-1x1.png"
  },
  {
    "id": "emoji-mindblown-1x1",
    "filePath": "assets2/emoji-mindblown-1x1.png"
  },
  {
    "id": "emoji-money-1x1",
    "filePath": "assets2/emoji-money-1x1.png"
  },
  {
    "id": "emoji-nerd-1x1",
    "filePath": "assets2/emoji-nerd-1x1.png"
  },
  {
    "id": "emoji-nervous-1x1",
    "filePath": "assets2/emoji-nervous-1x1.png"
  },
  {
    "id": "emoji-party-1x1",
    "filePath": "assets2/emoji-party-1x1.png"
  },
  {
    "id": "emoji-robot-1x1",
    "filePath": "assets2/emoji-robot-1x1.png"
  },
  {
    "id": "emoji-sad-1x1",
    "filePath": "assets2/emoji-sad-1x1.png"
  },
  {
    "id": "emoji-shocked-1x1",
    "filePath": "assets2/emoji-shocked-1x1.png"
  },
  {
    "id": "emoji-sick-1x1",
    "filePath": "assets2/emoji-sick-1x1.png"
  },
  {
    "id": "emoji-skull-1x1",
    "filePath": "assets2/emoji-skull-1x1.png"
  },
  {
    "id": "emoji-sleepy-1x1",
    "filePath": "assets2/emoji-sleepy-1x1.png"
  },
  {
    "id": "emoji-smile-1x1",
    "filePath": "assets2/emoji-smile-1x1.png"
  },
  {
    "id": "emoji-smirk-1x1",
    "filePath": "assets2/emoji-smirk-1x1.png"
  },
  {
    "id": "emoji-star-eyes-1x1",
    "filePath": "assets2/emoji-star-eyes-1x1.png"
  },
  {
    "id": "emoji-sunglasses-1x1",
    "filePath": "assets2/emoji-sunglasses-1x1.png"
  },
  {
    "id": "emoji-thinking-1x1",
    "filePath": "assets2/emoji-thinking-1x1.png"
  },
  {
    "id": "emoji-wink-1x1",
    "filePath": "assets2/emoji-wink-1x1.png"
  },
  {
    "id": "emoji-alien-2x2",
    "filePath": "assets2/emoji-alien-2x2.png"
  },
  {
    "id": "emoji-angel-2x2",
    "filePath": "assets2/emoji-angel-2x2.png"
  },
  {
    "id": "emoji-angry-2x2",
    "filePath": "assets2/emoji-angry-2x2.png"
  },
  {
    "id": "emoji-cat-2x2",
    "filePath": "assets2/emoji-cat-2x2.png"
  },
  {
    "id": "emoji-cool-2x2",
    "filePath": "assets2/emoji-cool-2x2.png"
  },
  {
    "id": "emoji-cry-2x2",
    "filePath": "assets2/emoji-cry-2x2.png"
  },
  {
    "id": "emoji-dead-2x2",
    "filePath": "assets2/emoji-dead-2x2.png"
  },
  {
    "id": "emoji-devil-2x2",
    "filePath": "assets2/emoji-devil-2x2.png"
  },
  {
    "id": "emoji-grin-2x2",
    "filePath": "assets2/emoji-grin-2x2.png"
  },
  {
    "id": "emoji-heart-eyes-2x2",
    "filePath": "assets2/emoji-heart-eyes-2x2.png"
  },
  {
    "id": "emoji-kiss-2x2",
    "filePath": "assets2/emoji-kiss-2x2.png"
  },
  {
    "id": "emoji-laugh-2x2",
    "filePath": "assets2/emoji-laugh-2x2.png"
  },
  {
    "id": "emoji-love-2x2",
    "filePath": "assets2/emoji-love-2x2.png"
  },
  {
    "id": "emoji-mindblown-2x2",
    "filePath": "assets2/emoji-mindblown-2x2.png"
  },
  {
    "id": "emoji-money-2x2",
    "filePath": "assets2/emoji-money-2x2.png"
  },
  {
    "id": "emoji-nerd-2x2",
    "filePath": "assets2/emoji-nerd-2x2.png"
  },
  {
    "id": "emoji-nervous-2x2",
    "filePath": "assets2/emoji-nervous-2x2.png"
  },
  {
    "id": "emoji-party-2x2",
    "filePath": "assets2/emoji-party-2x2.png"
  },
  {
    "id": "emoji-robot-2x2",
    "filePath": "assets2/emoji-robot-2x2.png"
  },
  {
    "id": "emoji-sad-2x2",
    "filePath": "assets2/emoji-sad-2x2.png"
  },
  {
    "id": "emoji-shocked-2x2",
    "filePath": "assets2/emoji-shocked-2x2.png"
  },
  {
    "id": "emoji-sick-2x2",
    "filePath": "assets2/emoji-sick-2x2.png"
  },
  {
    "id": "emoji-skull-2x2",
    "filePath": "assets2/emoji-skull-2x2.png"
  },
  {
    "id": "emoji-sleepy-2x2",
    "filePath": "assets2/emoji-sleepy-2x2.png"
  },
  {
    "id": "emoji-smile-2x2",
    "filePath": "assets2/emoji-smile-2x2.png"
  },
  {
    "id": "emoji-smirk-2x2",
    "filePath": "assets2/emoji-smirk-2x2.png"
  },
  {
    "id": "emoji-star-eyes-2x2",
    "filePath": "assets2/emoji-star-eyes-2x2.png"
  },
  {
    "id": "emoji-sunglasses-2x2",
    "filePath": "assets2/emoji-sunglasses-2x2.png"
  },
  {
    "id": "emoji-thinking-2x2",
    "filePath": "assets2/emoji-thinking-2x2.png"
  },
  {
    "id": "emoji-wink-2x2",
    "filePath": "assets2/emoji-wink-2x2.png"
  },
  {
    "id": "emoji-alien-3x3",
    "filePath": "assets2/emoji-alien-3x3.png"
  },
  {
    "id": "emoji-angel-3x3",
    "filePath": "assets2/emoji-angel-3x3.png"
  },
  {
    "id": "emoji-angry-3x3",
    "filePath": "assets2/emoji-angry-3x3.png"
  },
  {
    "id": "emoji-cat-3x3",
    "filePath": "assets2/emoji-cat-3x3.png"
  },
  {
    "id": "emoji-cool-3x3",
    "filePath": "assets2/emoji-cool-3x3.png"
  },
  {
    "id": "emoji-cry-3x3",
    "filePath": "assets2/emoji-cry-3x3.png"
  },
  {
    "id": "emoji-dead-3x3",
    "filePath": "assets2/emoji-dead-3x3.png"
  },
  {
    "id": "emoji-devil-3x3",
    "filePath": "assets2/emoji-devil-3x3.png"
  },
  {
    "id": "emoji-grin-3x3",
    "filePath": "assets2/emoji-grin-3x3.png"
  },
  {
    "id": "emoji-heart-eyes-3x3",
    "filePath": "assets2/emoji-heart-eyes-3x3.png"
  },
  {
    "id": "emoji-kiss-3x3",
    "filePath": "assets2/emoji-kiss-3x3.png"
  },
  {
    "id": "emoji-laugh-3x3",
    "filePath": "assets2/emoji-laugh-3x3.png"
  },
  {
    "id": "emoji-love-3x3",
    "filePath": "assets2/emoji-love-3x3.png"
  },
  {
    "id": "emoji-mindblown-3x3",
    "filePath": "assets2/emoji-mindblown-3x3.png"
  },
  {
    "id": "emoji-money-3x3",
    "filePath": "assets2/emoji-money-3x3.png"
  },
  {
    "id": "emoji-nerd-3x3",
    "filePath": "assets2/emoji-nerd-3x3.png"
  },
  {
    "id": "emoji-nervous-3x3",
    "filePath": "assets2/emoji-nervous-3x3.png"
  },
  {
    "id": "emoji-party-3x3",
    "filePath": "assets2/emoji-party-3x3.png"
  },
  {
    "id": "emoji-robot-3x3",
    "filePath": "assets2/emoji-robot-3x3.png"
  },
  {
    "id": "emoji-sad-3x3",
    "filePath": "assets2/emoji-sad-3x3.png"
  },
  {
    "id": "emoji-shocked-3x3",
    "filePath": "assets2/emoji-shocked-3x3.png"
  },
  {
    "id": "emoji-sick-3x3",
    "filePath": "assets2/emoji-sick-3x3.png"
  },
  {
    "id": "emoji-skull-3x3",
    "filePath": "assets2/emoji-skull-3x3.png"
  },
  {
    "id": "emoji-sleepy-3x3",
    "filePath": "assets2/emoji-sleepy-3x3.png"
  },
  {
    "id": "emoji-smile-3x3",
    "filePath": "assets2/emoji-smile-3x3.png"
  },
  {
    "id": "emoji-smirk-3x3",
    "filePath": "assets2/emoji-smirk-3x3.png"
  },
  {
    "id": "emoji-star-eyes-3x3",
    "filePath": "assets2/emoji-star-eyes-3x3.png"
  },
  {
    "id": "emoji-sunglasses-3x3",
    "filePath": "assets2/emoji-sunglasses-3x3.png"
  },
  {
    "id": "emoji-thinking-3x3",
    "filePath": "assets2/emoji-thinking-3x3.png"
  },
  {
    "id": "emoji-wink-3x3",
    "filePath": "assets2/emoji-wink-3x3.png"
  },
  {
    "id": "fence-amber-2x1",
    "filePath": "assets2/fence-amber-2x1.png"
  },
  {
    "id": "fence-amber-1x1",
    "filePath": "assets2/fence-amber-1x1.png"
  },
  {
    "id": "fence-bio-1x1",
    "filePath": "assets2/fence-bio-1x1.png"
  },
  {
    "id": "fence-cyan-1x1",
    "filePath": "assets2/fence-cyan-1x1.png"
  },
  {
    "id": "fence-ice-1x1",
    "filePath": "assets2/fence-ice-1x1.png"
  },
  {
    "id": "fence-magma-1x1",
    "filePath": "assets2/fence-magma-1x1.png"
  },
  {
    "id": "fence-pink-1x1",
    "filePath": "assets2/fence-pink-1x1.png"
  },
  {
    "id": "fence-red-1x1",
    "filePath": "assets2/fence-red-1x1.png"
  },
  {
    "id": "fence-void-1x1",
    "filePath": "assets2/fence-void-1x1.png"
  },
  {
    "id": "flora-blue-shroom-1x1",
    "filePath": "assets2/flora-blue-shroom-1x1.png"
  },
  {
    "id": "flora-cave-moss-1x1",
    "filePath": "assets2/flora-cave-moss-1x1.png"
  },
  {
    "id": "flora-cluster-1x1",
    "filePath": "assets2/flora-cluster-1x1.png"
  },
  {
    "id": "flora-crystal-bloom-1x1",
    "filePath": "assets2/flora-crystal-bloom-1x1.png"
  },
  {
    "id": "flora-glow-root-1x1",
    "filePath": "assets2/flora-glow-root-1x1.png"
  },
  {
    "id": "flora-glowcap-1x1",
    "filePath": "assets2/flora-glowcap-1x1.png"
  },
  {
    "id": "flora-ice-flower-1x1",
    "filePath": "assets2/flora-ice-flower-1x1.png"
  },
  {
    "id": "flora-night-cap-1x1",
    "filePath": "assets2/flora-night-cap-1x1.png"
  },
  {
    "id": "flora-pink-shroom-1x1",
    "filePath": "assets2/flora-pink-shroom-1x1.png"
  },
  {
    "id": "flora-puffball-1x1",
    "filePath": "assets2/flora-puffball-1x1.png"
  },
  {
    "id": "flora-sand-cactus-1x1",
    "filePath": "assets2/flora-sand-cactus-1x1.png"
  },
  {
    "id": "flora-shelf-1x1",
    "filePath": "assets2/flora-shelf-1x1.png"
  },
  {
    "id": "flora-spore-fern-1x1",
    "filePath": "assets2/flora-spore-fern-1x1.png"
  },
  {
    "id": "flora-tall-fungus-1x1",
    "filePath": "assets2/flora-tall-fungus-1x1.png"
  },
  {
    "id": "flora-tiny-tree-1x1",
    "filePath": "assets2/flora-tiny-tree-1x1.png"
  },
  {
    "id": "flora-vine-sprout-1x1",
    "filePath": "assets2/flora-vine-sprout-1x1.png"
  },
  {
    "id": "garden-bed-3x2",
    "filePath": "assets/garden-bed-3x2.png"
  },
  {
    "id": "garden-bench-2x1",
    "filePath": "assets/garden-bench-2x1.png"
  },
  {
    "id": "garden-climber-1x2",
    "filePath": "assets/garden-climber-1x2.png"
  },
  {
    "id": "garden-crops-3x2",
    "filePath": "assets/garden-crops-3x2.png"
  },
  {
    "id": "garden-fence-2x1",
    "filePath": "assets/garden-fence-2x1.png"
  },
  {
    "id": "garden-fence-3x2",
    "filePath": "assets/garden-fence-3x2.png"
  },
  {
    "id": "garden-flowerbed-2x1",
    "filePath": "assets/garden-flowerbed-2x1.png"
  },
  {
    "id": "garden-fountain-1x3",
    "filePath": "assets/garden-fountain-1x3.png"
  },
  {
    "id": "garden-greenhouse-3x2",
    "filePath": "assets/garden-greenhouse-3x2.png"
  },
  {
    "id": "garden-greenhouse-4x4",
    "filePath": "assets/garden-greenhouse-4x4.png"
  },
  {
    "id": "garden-hedge-2x1",
    "filePath": "assets/garden-hedge-2x1.png"
  },
  {
    "id": "garden-lamp-1x2",
    "filePath": "assets/garden-lamp-1x2.png"
  },
  {
    "id": "garden-lamp-1x3",
    "filePath": "assets/garden-lamp-1x3.png"
  },
  {
    "id": "garden-obelisk-1x2",
    "filePath": "assets/garden-obelisk-1x2.png"
  },
  {
    "id": "garden-park-4x4",
    "filePath": "assets/garden-park-4x4.png"
  },
  {
    "id": "garden-path-2x1",
    "filePath": "assets/garden-path-2x1.png"
  },
  {
    "id": "garden-patio-4x4",
    "filePath": "assets/garden-patio-4x4.png"
  },
  {
    "id": "garden-pergola-3x2",
    "filePath": "assets/garden-pergola-3x2.png"
  },
  {
    "id": "garden-pond-3x2",
    "filePath": "assets/garden-pond-3x2.png"
  },
  {
    "id": "garden-pond-4x4",
    "filePath": "assets/garden-pond-4x4.png"
  },
  {
    "id": "garden-tallpot-1x2",
    "filePath": "assets/garden-tallpot-1x2.png"
  },
  {
    "id": "garden-tree-1x2",
    "filePath": "assets/garden-tree-1x2.png"
  },
  {
    "id": "garden-tree-1x3",
    "filePath": "assets/garden-tree-1x3.png"
  },
  {
    "id": "garden-trellis-1x2",
    "filePath": "assets/garden-trellis-1x2.png"
  },
  {
    "id": "garden-trellis-1x3",
    "filePath": "assets/garden-trellis-1x3.png"
  },
  {
    "id": "garden-trough-2x1",
    "filePath": "assets/garden-trough-2x1.png"
  },
  {
    "id": "garden-bush-1x1",
    "filePath": "assets/garden-bush-1x1.png"
  },
  {
    "id": "garden-fencepost-1x1",
    "filePath": "assets/garden-fencepost-1x1.png"
  },
  {
    "id": "garden-flower-1x1",
    "filePath": "assets/garden-flower-1x1.png"
  },
  {
    "id": "garden-herbs-1x1",
    "filePath": "assets/garden-herbs-1x1.png"
  },
  {
    "id": "garden-lantern-1x1",
    "filePath": "assets/garden-lantern-1x1.png"
  },
  {
    "id": "garden-pot-1x1",
    "filePath": "assets/garden-pot-1x1.png"
  },
  {
    "id": "garden-rock-1x1",
    "filePath": "assets/garden-rock-1x1.png"
  },
  {
    "id": "garden-sapling-1x1",
    "filePath": "assets/garden-sapling-1x1.png"
  },
  {
    "id": "garden-bench-2x2",
    "filePath": "assets/garden-bench-2x2.png"
  },
  {
    "id": "garden-composter-2x2",
    "filePath": "assets/garden-composter-2x2.png"
  },
  {
    "id": "garden-crate-2x2",
    "filePath": "assets/garden-crate-2x2.png"
  },
  {
    "id": "garden-fountain-2x2",
    "filePath": "assets/garden-fountain-2x2.png"
  },
  {
    "id": "garden-rows-2x2",
    "filePath": "assets/garden-rows-2x2.png"
  },
  {
    "id": "garden-shrubs-2x2",
    "filePath": "assets/garden-shrubs-2x2.png"
  },
  {
    "id": "garden-table-2x2",
    "filePath": "assets/garden-table-2x2.png"
  },
  {
    "id": "garden-well-2x2",
    "filePath": "assets/garden-well-2x2.png"
  },
  {
    "id": "garden-fountain-3x3",
    "filePath": "assets/garden-fountain-3x3.png"
  },
  {
    "id": "garden-gazebo-3x3",
    "filePath": "assets/garden-gazebo-3x3.png"
  },
  {
    "id": "garden-greenhouse-3x3",
    "filePath": "assets/garden-greenhouse-3x3.png"
  },
  {
    "id": "garden-orchard-3x3",
    "filePath": "assets/garden-orchard-3x3.png"
  },
  {
    "id": "gem-amber-1x1",
    "filePath": "assets2/gem-amber-1x1.png"
  },
  {
    "id": "gem-cyan-1x1",
    "filePath": "assets2/gem-cyan-1x1.png"
  },
  {
    "id": "gem-gold-1x1",
    "filePath": "assets2/gem-gold-1x1.png"
  },
  {
    "id": "gem-ice-1x1",
    "filePath": "assets2/gem-ice-1x1.png"
  },
  {
    "id": "gem-leaf-1x1",
    "filePath": "assets2/gem-leaf-1x1.png"
  },
  {
    "id": "gem-rose-1x1",
    "filePath": "assets2/gem-rose-1x1.png"
  },
  {
    "id": "gem-ruby-1x1",
    "filePath": "assets2/gem-ruby-1x1.png"
  },
  {
    "id": "gem-void-1x1",
    "filePath": "assets2/gem-void-1x1.png"
  },
  {
    "id": "gem-amber-2x2",
    "filePath": "assets2/gem-amber-2x2.png"
  },
  {
    "id": "gem-cyan-2x2",
    "filePath": "assets2/gem-cyan-2x2.png"
  },
  {
    "id": "gem-gold-2x2",
    "filePath": "assets2/gem-gold-2x2.png"
  },
  {
    "id": "gem-ice-2x2",
    "filePath": "assets2/gem-ice-2x2.png"
  },
  {
    "id": "gem-leaf-2x2",
    "filePath": "assets2/gem-leaf-2x2.png"
  },
  {
    "id": "gem-rose-2x2",
    "filePath": "assets2/gem-rose-2x2.png"
  },
  {
    "id": "gem-ruby-2x2",
    "filePath": "assets2/gem-ruby-2x2.png"
  },
  {
    "id": "gem-void-2x2",
    "filePath": "assets2/gem-void-2x2.png"
  },
  {
    "id": "glyph-beetle-1x1",
    "filePath": "assets2/glyph-beetle-1x1.png"
  },
  {
    "id": "glyph-chip-1x1",
    "filePath": "assets2/glyph-chip-1x1.png"
  },
  {
    "id": "glyph-eye-1x1",
    "filePath": "assets2/glyph-eye-1x1.png"
  },
  {
    "id": "glyph-gate-1x1",
    "filePath": "assets2/glyph-gate-1x1.png"
  },
  {
    "id": "glyph-gear-sun-1x1",
    "filePath": "assets2/glyph-gear-sun-1x1.png"
  },
  {
    "id": "glyph-ladder-1x1",
    "filePath": "assets2/glyph-ladder-1x1.png"
  },
  {
    "id": "glyph-mask-1x1",
    "filePath": "assets2/glyph-mask-1x1.png"
  },
  {
    "id": "glyph-mountain-1x1",
    "filePath": "assets2/glyph-mountain-1x1.png"
  },
  {
    "id": "glyph-river-1x1",
    "filePath": "assets2/glyph-river-1x1.png"
  },
  {
    "id": "glyph-scarab-1x1",
    "filePath": "assets2/glyph-scarab-1x1.png"
  },
  {
    "id": "glyph-seed-1x1",
    "filePath": "assets2/glyph-seed-1x1.png"
  },
  {
    "id": "glyph-spiral-1x1",
    "filePath": "assets2/glyph-spiral-1x1.png"
  },
  {
    "id": "glyph-sun-1x1",
    "filePath": "assets2/glyph-sun-1x1.png"
  },
  {
    "id": "glyph-twin-moon-1x1",
    "filePath": "assets2/glyph-twin-moon-1x1.png"
  },
  {
    "id": "glyph-void-1x1",
    "filePath": "assets2/glyph-void-1x1.png"
  },
  {
    "id": "glyph-wave-1x1",
    "filePath": "assets2/glyph-wave-1x1.png"
  },
  {
    "id": "glyph-beetle-2x2",
    "filePath": "assets2/glyph-beetle-2x2.png"
  },
  {
    "id": "glyph-chip-2x2",
    "filePath": "assets2/glyph-chip-2x2.png"
  },
  {
    "id": "glyph-eye-2x2",
    "filePath": "assets2/glyph-eye-2x2.png"
  },
  {
    "id": "glyph-gate-2x2",
    "filePath": "assets2/glyph-gate-2x2.png"
  },
  {
    "id": "glyph-gear-sun-2x2",
    "filePath": "assets2/glyph-gear-sun-2x2.png"
  },
  {
    "id": "glyph-ladder-2x2",
    "filePath": "assets2/glyph-ladder-2x2.png"
  },
  {
    "id": "glyph-mask-2x2",
    "filePath": "assets2/glyph-mask-2x2.png"
  },
  {
    "id": "glyph-mountain-2x2",
    "filePath": "assets2/glyph-mountain-2x2.png"
  },
  {
    "id": "glyph-river-2x2",
    "filePath": "assets2/glyph-river-2x2.png"
  },
  {
    "id": "glyph-scarab-2x2",
    "filePath": "assets2/glyph-scarab-2x2.png"
  },
  {
    "id": "glyph-seed-2x2",
    "filePath": "assets2/glyph-seed-2x2.png"
  },
  {
    "id": "glyph-spiral-2x2",
    "filePath": "assets2/glyph-spiral-2x2.png"
  },
  {
    "id": "glyph-sun-2x2",
    "filePath": "assets2/glyph-sun-2x2.png"
  },
  {
    "id": "glyph-twin-moon-2x2",
    "filePath": "assets2/glyph-twin-moon-2x2.png"
  },
  {
    "id": "glyph-void-2x2",
    "filePath": "assets2/glyph-void-2x2.png"
  },
  {
    "id": "glyph-wave-2x2",
    "filePath": "assets2/glyph-wave-2x2.png"
  },
  {
    "id": "hatch-bio-1x2",
    "filePath": "assets2/hatch-bio-1x2.png"
  },
  {
    "id": "hatch-bronze-1x2",
    "filePath": "assets2/hatch-bronze-1x2.png"
  },
  {
    "id": "hatch-grate-1x2",
    "filePath": "assets2/hatch-grate-1x2.png"
  },
  {
    "id": "hatch-hazard-1x2",
    "filePath": "assets2/hatch-hazard-1x2.png"
  },
  {
    "id": "hatch-ice-1x2",
    "filePath": "assets2/hatch-ice-1x2.png"
  },
  {
    "id": "hatch-round-1x2",
    "filePath": "assets2/hatch-round-1x2.png"
  },
  {
    "id": "hatch-shutter-1x2",
    "filePath": "assets2/hatch-shutter-1x2.png"
  },
  {
    "id": "hatch-temple-1x2",
    "filePath": "assets2/hatch-temple-1x2.png"
  },
  {
    "id": "hatch-bio-2x2",
    "filePath": "assets2/hatch-bio-2x2.png"
  },
  {
    "id": "hatch-bronze-2x2",
    "filePath": "assets2/hatch-bronze-2x2.png"
  },
  {
    "id": "hatch-grate-2x2",
    "filePath": "assets2/hatch-grate-2x2.png"
  },
  {
    "id": "hatch-hazard-2x2",
    "filePath": "assets2/hatch-hazard-2x2.png"
  },
  {
    "id": "hatch-ice-2x2",
    "filePath": "assets2/hatch-ice-2x2.png"
  },
  {
    "id": "hatch-round-2x2",
    "filePath": "assets2/hatch-round-2x2.png"
  },
  {
    "id": "hatch-shutter-2x2",
    "filePath": "assets2/hatch-shutter-2x2.png"
  },
  {
    "id": "hatch-temple-2x2",
    "filePath": "assets2/hatch-temple-2x2.png"
  },
  {
    "id": "holo-biome-2x2",
    "filePath": "assets2/holo-biome-2x2.png"
  },
  {
    "id": "holo-cyan-2x2",
    "filePath": "assets2/holo-cyan-2x2.png"
  },
  {
    "id": "holo-ghost-2x2",
    "filePath": "assets2/holo-ghost-2x2.png"
  },
  {
    "id": "holo-map-2x2",
    "filePath": "assets2/holo-map-2x2.png"
  },
  {
    "id": "holo-playback-2x2",
    "filePath": "assets2/holo-playback-2x2.png"
  },
  {
    "id": "holo-portrait-2x2",
    "filePath": "assets2/holo-portrait-2x2.png"
  },
  {
    "id": "holo-warn-2x2",
    "filePath": "assets2/holo-warn-2x2.png"
  },
  {
    "id": "holo-waypoint-2x2",
    "filePath": "assets2/holo-waypoint-2x2.png"
  },
  {
    "id": "holo-biome-3x3",
    "filePath": "assets2/holo-biome-3x3.png"
  },
  {
    "id": "holo-cyan-3x3",
    "filePath": "assets2/holo-cyan-3x3.png"
  },
  {
    "id": "holo-ghost-3x3",
    "filePath": "assets2/holo-ghost-3x3.png"
  },
  {
    "id": "holo-map-3x3",
    "filePath": "assets2/holo-map-3x3.png"
  },
  {
    "id": "holo-playback-3x3",
    "filePath": "assets2/holo-playback-3x3.png"
  },
  {
    "id": "holo-portrait-3x3",
    "filePath": "assets2/holo-portrait-3x3.png"
  },
  {
    "id": "holo-warn-3x3",
    "filePath": "assets2/holo-warn-3x3.png"
  },
  {
    "id": "holo-waypoint-3x3",
    "filePath": "assets2/holo-waypoint-3x3.png"
  },
  {
    "id": "home-bathroom-4x4",
    "filePath": "assets/home-bathroom-4x4.png"
  },
  {
    "id": "home-bathtub-3x2",
    "filePath": "assets/home-bathtub-3x2.png"
  },
  {
    "id": "home-bed-3x2",
    "filePath": "assets/home-bed-3x2.png"
  },
  {
    "id": "home-bedroom-4x4",
    "filePath": "assets/home-bedroom-4x4.png"
  },
  {
    "id": "home-bench-2x1",
    "filePath": "assets/home-bench-2x1.png"
  },
  {
    "id": "home-bookrow-2x1",
    "filePath": "assets/home-bookrow-2x1.png"
  },
  {
    "id": "home-bookshelf-1x3",
    "filePath": "assets/home-bookshelf-1x3.png"
  },
  {
    "id": "home-bookshelf-3x2",
    "filePath": "assets/home-bookshelf-3x2.png"
  },
  {
    "id": "home-cabinet-1x2",
    "filePath": "assets/home-cabinet-1x2.png"
  },
  {
    "id": "home-coatstand-1x2",
    "filePath": "assets/home-coatstand-1x2.png"
  },
  {
    "id": "home-conduit-1x3",
    "filePath": "assets/home-conduit-1x3.png"
  },
  {
    "id": "home-counter-3x2",
    "filePath": "assets/home-counter-3x2.png"
  },
  {
    "id": "home-cushion-2x1",
    "filePath": "assets/home-cushion-2x1.png"
  },
  {
    "id": "home-desk-3x2",
    "filePath": "assets/home-desk-3x2.png"
  },
  {
    "id": "home-dining-4x4",
    "filePath": "assets/home-dining-4x4.png"
  },
  {
    "id": "home-floorlamp-1x2",
    "filePath": "assets/home-floorlamp-1x2.png"
  },
  {
    "id": "home-kitchen-4x4",
    "filePath": "assets/home-kitchen-4x4.png"
  },
  {
    "id": "home-living-4x4",
    "filePath": "assets/home-living-4x4.png"
  },
  {
    "id": "home-locker-1x3",
    "filePath": "assets/home-locker-1x3.png"
  },
  {
    "id": "home-mirror-1x2",
    "filePath": "assets/home-mirror-1x2.png"
  },
  {
    "id": "home-nightstand-1x2",
    "filePath": "assets/home-nightstand-1x2.png"
  },
  {
    "id": "home-panel-1x3",
    "filePath": "assets/home-panel-1x3.png"
  },
  {
    "id": "home-patio-4x4",
    "filePath": "assets/home-patio-4x4.png"
  },
  {
    "id": "home-planter-2x1",
    "filePath": "assets/home-planter-2x1.png"
  },
  {
    "id": "home-radiator-1x2",
    "filePath": "assets/home-radiator-1x2.png"
  },
  {
    "id": "home-radiator-2x1",
    "filePath": "assets/home-radiator-2x1.png"
  },
  {
    "id": "home-shelf-2x1",
    "filePath": "assets/home-shelf-2x1.png"
  },
  {
    "id": "home-sofa-3x2",
    "filePath": "assets/home-sofa-3x2.png"
  },
  {
    "id": "home-soundbar-2x1",
    "filePath": "assets/home-soundbar-2x1.png"
  },
  {
    "id": "home-table-3x2",
    "filePath": "assets/home-table-3x2.png"
  },
  {
    "id": "home-tallplant-1x2",
    "filePath": "assets/home-tallplant-1x2.png"
  },
  {
    "id": "home-torchere-1x3",
    "filePath": "assets/home-torchere-1x3.png"
  },
  {
    "id": "home-towelrail-2x1",
    "filePath": "assets/home-towelrail-2x1.png"
  },
  {
    "id": "home-tree-1x3",
    "filePath": "assets/home-tree-1x3.png"
  },
  {
    "id": "home-tv-3x2",
    "filePath": "assets/home-tv-3x2.png"
  },
  {
    "id": "home-vase-1x2",
    "filePath": "assets/home-vase-1x2.png"
  },
  {
    "id": "home-books-1x1",
    "filePath": "assets/home-books-1x1.png"
  },
  {
    "id": "home-bottle-1x1",
    "filePath": "assets/home-bottle-1x1.png"
  },
  {
    "id": "home-clock-1x1",
    "filePath": "assets/home-clock-1x1.png"
  },
  {
    "id": "home-lamp-1x1",
    "filePath": "assets/home-lamp-1x1.png"
  },
  {
    "id": "home-mug-1x1",
    "filePath": "assets/home-mug-1x1.png"
  },
  {
    "id": "home-pillow-1x1",
    "filePath": "assets/home-pillow-1x1.png"
  },
  {
    "id": "home-plant-1x1",
    "filePath": "assets/home-plant-1x1.png"
  },
  {
    "id": "home-stool-1x1",
    "filePath": "assets/home-stool-1x1.png"
  },
  {
    "id": "home-bed-2x2",
    "filePath": "assets/home-bed-2x2.png"
  },
  {
    "id": "home-chair-2x2",
    "filePath": "assets/home-chair-2x2.png"
  },
  {
    "id": "home-fridge-2x2",
    "filePath": "assets/home-fridge-2x2.png"
  },
  {
    "id": "home-sidetable-2x2",
    "filePath": "assets/home-sidetable-2x2.png"
  },
  {
    "id": "home-sink-2x2",
    "filePath": "assets/home-sink-2x2.png"
  },
  {
    "id": "home-stove-2x2",
    "filePath": "assets/home-stove-2x2.png"
  },
  {
    "id": "home-toilet-2x2",
    "filePath": "assets/home-toilet-2x2.png"
  },
  {
    "id": "home-tv-2x2",
    "filePath": "assets/home-tv-2x2.png"
  },
  {
    "id": "home-wardrobe-2x2",
    "filePath": "assets/home-wardrobe-2x2.png"
  },
  {
    "id": "home-washer-2x2",
    "filePath": "assets/home-washer-2x2.png"
  },
  {
    "id": "home-bathtub-3x3",
    "filePath": "assets/home-bathtub-3x3.png"
  },
  {
    "id": "home-bed-3x3",
    "filePath": "assets/home-bed-3x3.png"
  },
  {
    "id": "home-bookshelf-3x3",
    "filePath": "assets/home-bookshelf-3x3.png"
  },
  {
    "id": "home-counter-3x3",
    "filePath": "assets/home-counter-3x3.png"
  },
  {
    "id": "home-desk-3x3",
    "filePath": "assets/home-desk-3x3.png"
  },
  {
    "id": "home-fireplace-3x3",
    "filePath": "assets/home-fireplace-3x3.png"
  },
  {
    "id": "home-sofa-3x3",
    "filePath": "assets/home-sofa-3x3.png"
  },
  {
    "id": "home-table-3x3",
    "filePath": "assets/home-table-3x3.png"
  },
  {
    "id": "horiz-barrier-2x1",
    "filePath": "assets2/horiz-barrier-2x1.png"
  },
  {
    "id": "horiz-barrier-3x1",
    "filePath": "assets2/horiz-barrier-3x1.png"
  },
  {
    "id": "horiz-barrier-4x1",
    "filePath": "assets2/horiz-barrier-4x1.png"
  },
  {
    "id": "horiz-battery-2x1",
    "filePath": "assets2/horiz-battery-2x1.png"
  },
  {
    "id": "horiz-battery-3x1",
    "filePath": "assets2/horiz-battery-3x1.png"
  },
  {
    "id": "horiz-battery-4x1",
    "filePath": "assets2/horiz-battery-4x1.png"
  },
  {
    "id": "horiz-beam-2x1",
    "filePath": "assets2/horiz-beam-2x1.png"
  },
  {
    "id": "horiz-beam-3x1",
    "filePath": "assets2/horiz-beam-3x1.png"
  },
  {
    "id": "horiz-beam-4x1",
    "filePath": "assets2/horiz-beam-4x1.png"
  },
  {
    "id": "horiz-bed-2x1",
    "filePath": "assets2/horiz-bed-2x1.png"
  },
  {
    "id": "horiz-bed-3x1",
    "filePath": "assets2/horiz-bed-3x1.png"
  },
  {
    "id": "horiz-bed-4x1",
    "filePath": "assets2/horiz-bed-4x1.png"
  },
  {
    "id": "horiz-bench-2x1",
    "filePath": "assets2/horiz-bench-2x1.png"
  },
  {
    "id": "horiz-bench-3x1",
    "filePath": "assets2/horiz-bench-3x1.png"
  },
  {
    "id": "horiz-bench-4x1",
    "filePath": "assets2/horiz-bench-4x1.png"
  },
  {
    "id": "horiz-bumper-2x1",
    "filePath": "assets2/horiz-bumper-2x1.png"
  },
  {
    "id": "horiz-bumper-3x1",
    "filePath": "assets2/horiz-bumper-3x1.png"
  },
  {
    "id": "horiz-bumper-4x1",
    "filePath": "assets2/horiz-bumper-4x1.png"
  },
  {
    "id": "horiz-cables-2x1",
    "filePath": "assets2/horiz-cables-2x1.png"
  },
  {
    "id": "horiz-cables-3x1",
    "filePath": "assets2/horiz-cables-3x1.png"
  },
  {
    "id": "horiz-cables-4x1",
    "filePath": "assets2/horiz-cables-4x1.png"
  },
  {
    "id": "horiz-console-2x1",
    "filePath": "assets2/horiz-console-2x1.png"
  },
  {
    "id": "horiz-console-3x1",
    "filePath": "assets2/horiz-console-3x1.png"
  },
  {
    "id": "horiz-console-4x1",
    "filePath": "assets2/horiz-console-4x1.png"
  },
  {
    "id": "horiz-conveyor-2x1",
    "filePath": "assets2/horiz-conveyor-2x1.png"
  },
  {
    "id": "horiz-conveyor-3x1",
    "filePath": "assets2/horiz-conveyor-3x1.png"
  },
  {
    "id": "horiz-conveyor-4x1",
    "filePath": "assets2/horiz-conveyor-4x1.png"
  },
  {
    "id": "horiz-counter-2x1",
    "filePath": "assets2/horiz-counter-2x1.png"
  },
  {
    "id": "horiz-counter-3x1",
    "filePath": "assets2/horiz-counter-3x1.png"
  },
  {
    "id": "horiz-counter-4x1",
    "filePath": "assets2/horiz-counter-4x1.png"
  },
  {
    "id": "horiz-crates-2x1",
    "filePath": "assets2/horiz-crates-2x1.png"
  },
  {
    "id": "horiz-crates-3x1",
    "filePath": "assets2/horiz-crates-3x1.png"
  },
  {
    "id": "horiz-crates-4x1",
    "filePath": "assets2/horiz-crates-4x1.png"
  },
  {
    "id": "horiz-desk-2x1",
    "filePath": "assets2/horiz-desk-2x1.png"
  },
  {
    "id": "horiz-desk-3x1",
    "filePath": "assets2/horiz-desk-3x1.png"
  },
  {
    "id": "horiz-desk-4x1",
    "filePath": "assets2/horiz-desk-4x1.png"
  },
  {
    "id": "horiz-duct-2x1",
    "filePath": "assets2/horiz-duct-2x1.png"
  },
  {
    "id": "horiz-duct-3x1",
    "filePath": "assets2/horiz-duct-3x1.png"
  },
  {
    "id": "horiz-duct-4x1",
    "filePath": "assets2/horiz-duct-4x1.png"
  },
  {
    "id": "horiz-fence-2x1",
    "filePath": "assets2/horiz-fence-2x1.png"
  },
  {
    "id": "horiz-fence-3x1",
    "filePath": "assets2/horiz-fence-3x1.png"
  },
  {
    "id": "horiz-fence-4x1",
    "filePath": "assets2/horiz-fence-4x1.png"
  },
  {
    "id": "horiz-garden-2x1",
    "filePath": "assets2/horiz-garden-2x1.png"
  },
  {
    "id": "horiz-garden-3x1",
    "filePath": "assets2/horiz-garden-3x1.png"
  },
  {
    "id": "horiz-garden-4x1",
    "filePath": "assets2/horiz-garden-4x1.png"
  },
  {
    "id": "horiz-keyboard-2x1",
    "filePath": "assets2/horiz-keyboard-2x1.png"
  },
  {
    "id": "horiz-keyboard-3x1",
    "filePath": "assets2/horiz-keyboard-3x1.png"
  },
  {
    "id": "horiz-keyboard-4x1",
    "filePath": "assets2/horiz-keyboard-4x1.png"
  },
  {
    "id": "horiz-lab-bench-2x1",
    "filePath": "assets2/horiz-lab-bench-2x1.png"
  },
  {
    "id": "horiz-lab-bench-3x1",
    "filePath": "assets2/horiz-lab-bench-3x1.png"
  },
  {
    "id": "horiz-lab-bench-4x1",
    "filePath": "assets2/horiz-lab-bench-4x1.png"
  },
  {
    "id": "horiz-low-wall-2x1",
    "filePath": "assets2/horiz-low-wall-2x1.png"
  },
  {
    "id": "horiz-low-wall-3x1",
    "filePath": "assets2/horiz-low-wall-3x1.png"
  },
  {
    "id": "horiz-low-wall-4x1",
    "filePath": "assets2/horiz-low-wall-4x1.png"
  },
  {
    "id": "horiz-pallet-2x1",
    "filePath": "assets2/horiz-pallet-2x1.png"
  },
  {
    "id": "horiz-pallet-3x1",
    "filePath": "assets2/horiz-pallet-3x1.png"
  },
  {
    "id": "horiz-pallet-4x1",
    "filePath": "assets2/horiz-pallet-4x1.png"
  },
  {
    "id": "horiz-panel-2x1",
    "filePath": "assets2/horiz-panel-2x1.png"
  },
  {
    "id": "horiz-panel-3x1",
    "filePath": "assets2/horiz-panel-3x1.png"
  },
  {
    "id": "horiz-panel-4x1",
    "filePath": "assets2/horiz-panel-4x1.png"
  },
  {
    "id": "horiz-pipe-2x1",
    "filePath": "assets2/horiz-pipe-2x1.png"
  },
  {
    "id": "horiz-pipe-3x1",
    "filePath": "assets2/horiz-pipe-3x1.png"
  },
  {
    "id": "horiz-pipe-4x1",
    "filePath": "assets2/horiz-pipe-4x1.png"
  },
  {
    "id": "horiz-planter-2x1",
    "filePath": "assets2/horiz-planter-2x1.png"
  },
  {
    "id": "horiz-planter-3x1",
    "filePath": "assets2/horiz-planter-3x1.png"
  },
  {
    "id": "horiz-planter-4x1",
    "filePath": "assets2/horiz-planter-4x1.png"
  },
  {
    "id": "horiz-rail-2x1",
    "filePath": "assets2/horiz-rail-2x1.png"
  },
  {
    "id": "horiz-rail-3x1",
    "filePath": "assets2/horiz-rail-3x1.png"
  },
  {
    "id": "horiz-rail-4x1",
    "filePath": "assets2/horiz-rail-4x1.png"
  },
  {
    "id": "horiz-shelf-2x1",
    "filePath": "assets2/horiz-shelf-2x1.png"
  },
  {
    "id": "horiz-shelf-3x1",
    "filePath": "assets2/horiz-shelf-3x1.png"
  },
  {
    "id": "horiz-shelf-4x1",
    "filePath": "assets2/horiz-shelf-4x1.png"
  },
  {
    "id": "horiz-sofa-2x1",
    "filePath": "assets2/horiz-sofa-2x1.png"
  },
  {
    "id": "horiz-sofa-3x1",
    "filePath": "assets2/horiz-sofa-3x1.png"
  },
  {
    "id": "horiz-sofa-4x1",
    "filePath": "assets2/horiz-sofa-4x1.png"
  },
  {
    "id": "horiz-solar-2x1",
    "filePath": "assets2/horiz-solar-2x1.png"
  },
  {
    "id": "horiz-solar-3x1",
    "filePath": "assets2/horiz-solar-3x1.png"
  },
  {
    "id": "horiz-solar-4x1",
    "filePath": "assets2/horiz-solar-4x1.png"
  },
  {
    "id": "horiz-table-2x1",
    "filePath": "assets2/horiz-table-2x1.png"
  },
  {
    "id": "horiz-table-3x1",
    "filePath": "assets2/horiz-table-3x1.png"
  },
  {
    "id": "horiz-table-4x1",
    "filePath": "assets2/horiz-table-4x1.png"
  },
  {
    "id": "horiz-tank-2x1",
    "filePath": "assets2/horiz-tank-2x1.png"
  },
  {
    "id": "horiz-tank-3x1",
    "filePath": "assets2/horiz-tank-3x1.png"
  },
  {
    "id": "horiz-tank-4x1",
    "filePath": "assets2/horiz-tank-4x1.png"
  },
  {
    "id": "horiz-vent-2x1",
    "filePath": "assets2/horiz-vent-2x1.png"
  },
  {
    "id": "horiz-vent-3x1",
    "filePath": "assets2/horiz-vent-3x1.png"
  },
  {
    "id": "horiz-vent-4x1",
    "filePath": "assets2/horiz-vent-4x1.png"
  },
  {
    "id": "icon-alien-1x1",
    "filePath": "assets/icon-alien-1x1.png"
  },
  {
    "id": "icon-anchor-1x1",
    "filePath": "assets/icon-anchor-1x1.png"
  },
  {
    "id": "icon-bag-1x1",
    "filePath": "assets/icon-bag-1x1.png"
  },
  {
    "id": "icon-bell-1x1",
    "filePath": "assets/icon-bell-1x1.png"
  },
  {
    "id": "icon-bird-1x1",
    "filePath": "assets/icon-bird-1x1.png"
  },
  {
    "id": "icon-bolt-1x1",
    "filePath": "assets/icon-bolt-1x1.png"
  },
  {
    "id": "icon-book-1x1",
    "filePath": "assets/icon-book-1x1.png"
  },
  {
    "id": "icon-bottle-1x1",
    "filePath": "assets/icon-bottle-1x1.png"
  },
  {
    "id": "icon-bug2-1x1",
    "filePath": "assets/icon-bug2-1x1.png"
  },
  {
    "id": "icon-cactus-1x1",
    "filePath": "assets/icon-cactus-1x1.png"
  },
  {
    "id": "icon-can-1x1",
    "filePath": "assets/icon-can-1x1.png"
  },
  {
    "id": "icon-cards-1x1",
    "filePath": "assets/icon-cards-1x1.png"
  },
  {
    "id": "icon-cart-1x1",
    "filePath": "assets/icon-cart-1x1.png"
  },
  {
    "id": "icon-cat-1x1",
    "filePath": "assets/icon-cat-1x1.png"
  },
  {
    "id": "icon-check-1x1",
    "filePath": "assets/icon-check-1x1.png"
  },
  {
    "id": "icon-chess-1x1",
    "filePath": "assets/icon-chess-1x1.png"
  },
  {
    "id": "icon-chevron-double-down-1x1",
    "filePath": "assets/icon-chevron-double-down-1x1.png"
  },
  {
    "id": "icon-chevron-double-left-1x1",
    "filePath": "assets/icon-chevron-double-left-1x1.png"
  },
  {
    "id": "icon-chevron-double-right-1x1",
    "filePath": "assets/icon-chevron-double-right-1x1.png"
  },
  {
    "id": "icon-chevron-double-up-1x1",
    "filePath": "assets/icon-chevron-double-up-1x1.png"
  },
  {
    "id": "icon-chevron-down-1x1",
    "filePath": "assets/icon-chevron-down-1x1.png"
  },
  {
    "id": "icon-chevron-left-1x1",
    "filePath": "assets/icon-chevron-left-1x1.png"
  },
  {
    "id": "icon-chevron-right-1x1",
    "filePath": "assets/icon-chevron-right-1x1.png"
  },
  {
    "id": "icon-chevron-up-1x1",
    "filePath": "assets/icon-chevron-up-1x1.png"
  },
  {
    "id": "icon-cloud-1x1",
    "filePath": "assets/icon-cloud-1x1.png"
  },
  {
    "id": "icon-coffee-1x1",
    "filePath": "assets/icon-coffee-1x1.png"
  },
  {
    "id": "icon-cookie-1x1",
    "filePath": "assets/icon-cookie-1x1.png"
  },
  {
    "id": "icon-cross-1x1",
    "filePath": "assets/icon-cross-1x1.png"
  },
  {
    "id": "icon-dice-1x1",
    "filePath": "assets/icon-dice-1x1.png"
  },
  {
    "id": "icon-dog-1x1",
    "filePath": "assets/icon-dog-1x1.png"
  },
  {
    "id": "icon-drop-1x1",
    "filePath": "assets/icon-drop-1x1.png"
  },
  {
    "id": "icon-eye-1x1",
    "filePath": "assets/icon-eye-1x1.png"
  },
  {
    "id": "icon-fish-1x1",
    "filePath": "assets/icon-fish-1x1.png"
  },
  {
    "id": "icon-flag-1x1",
    "filePath": "assets/icon-flag-1x1.png"
  },
  {
    "id": "icon-flame-1x1",
    "filePath": "assets/icon-flame-1x1.png"
  },
  {
    "id": "icon-fox-1x1",
    "filePath": "assets/icon-fox-1x1.png"
  },
  {
    "id": "icon-gear-1x1",
    "filePath": "assets/icon-gear-1x1.png"
  },
  {
    "id": "icon-gem-1x1",
    "filePath": "assets/icon-gem-1x1.png"
  },
  {
    "id": "icon-ghost-1x1",
    "filePath": "assets/icon-ghost-1x1.png"
  },
  {
    "id": "icon-hammer-1x1",
    "filePath": "assets/icon-hammer-1x1.png"
  },
  {
    "id": "icon-heart-1x1",
    "filePath": "assets/icon-heart-1x1.png"
  },
  {
    "id": "icon-home-1x1",
    "filePath": "assets/icon-home-1x1.png"
  },
  {
    "id": "icon-hourglass-1x1",
    "filePath": "assets/icon-hourglass-1x1.png"
  },
  {
    "id": "icon-icecream-1x1",
    "filePath": "assets/icon-icecream-1x1.png"
  },
  {
    "id": "icon-infinity-1x1",
    "filePath": "assets/icon-infinity-1x1.png"
  },
  {
    "id": "icon-joystick-1x1",
    "filePath": "assets/icon-joystick-1x1.png"
  },
  {
    "id": "icon-key-1x1",
    "filePath": "assets/icon-key-1x1.png"
  },
  {
    "id": "icon-leaf-1x1",
    "filePath": "assets/icon-leaf-1x1.png"
  },
  {
    "id": "icon-lock-1x1",
    "filePath": "assets/icon-lock-1x1.png"
  },
  {
    "id": "icon-magnet-1x1",
    "filePath": "assets/icon-magnet-1x1.png"
  },
  {
    "id": "icon-mail-1x1",
    "filePath": "assets/icon-mail-1x1.png"
  },
  {
    "id": "icon-minus-1x1",
    "filePath": "assets/icon-minus-1x1.png"
  },
  {
    "id": "icon-moon-1x1",
    "filePath": "assets/icon-moon-1x1.png"
  },
  {
    "id": "icon-mushroom-1x1",
    "filePath": "assets/icon-mushroom-1x1.png"
  },
  {
    "id": "icon-music-1x1",
    "filePath": "assets/icon-music-1x1.png"
  },
  {
    "id": "icon-ore-1x1",
    "filePath": "assets/icon-ore-1x1.png"
  },
  {
    "id": "icon-pause-1x1",
    "filePath": "assets/icon-pause-1x1.png"
  },
  {
    "id": "icon-pickaxe-1x1",
    "filePath": "assets/icon-pickaxe-1x1.png"
  },
  {
    "id": "icon-pizza-1x1",
    "filePath": "assets/icon-pizza-1x1.png"
  },
  {
    "id": "icon-play-1x1",
    "filePath": "assets/icon-play-1x1.png"
  },
  {
    "id": "icon-plus-1x1",
    "filePath": "assets/icon-plus-1x1.png"
  },
  {
    "id": "icon-potion-1x1",
    "filePath": "assets/icon-potion-1x1.png"
  },
  {
    "id": "icon-puzzle-1x1",
    "filePath": "assets/icon-puzzle-1x1.png"
  },
  {
    "id": "icon-rainbow-1x1",
    "filePath": "assets/icon-rainbow-1x1.png"
  },
  {
    "id": "icon-ring-1x1",
    "filePath": "assets/icon-ring-1x1.png"
  },
  {
    "id": "icon-robot-1x1",
    "filePath": "assets/icon-robot-1x1.png"
  },
  {
    "id": "icon-scroll-1x1",
    "filePath": "assets/icon-scroll-1x1.png"
  },
  {
    "id": "icon-seed-1x1",
    "filePath": "assets/icon-seed-1x1.png"
  },
  {
    "id": "icon-shield-1x1",
    "filePath": "assets/icon-shield-1x1.png"
  },
  {
    "id": "icon-snow-1x1",
    "filePath": "assets/icon-snow-1x1.png"
  },
  {
    "id": "icon-spiral-1x1",
    "filePath": "assets/icon-spiral-1x1.png"
  },
  {
    "id": "icon-star-1x1",
    "filePath": "assets/icon-star-1x1.png"
  },
  {
    "id": "icon-stop-1x1",
    "filePath": "assets/icon-stop-1x1.png"
  },
  {
    "id": "icon-sun-1x1",
    "filePath": "assets/icon-sun-1x1.png"
  },
  {
    "id": "icon-sword-1x1",
    "filePath": "assets/icon-sword-1x1.png"
  },
  {
    "id": "icon-target-1x1",
    "filePath": "assets/icon-target-1x1.png"
  },
  {
    "id": "icon-tree-1x1",
    "filePath": "assets/icon-tree-1x1.png"
  },
  {
    "id": "icon-unlock-1x1",
    "filePath": "assets/icon-unlock-1x1.png"
  },
  {
    "id": "icon-user-1x1",
    "filePath": "assets/icon-user-1x1.png"
  },
  {
    "id": "icon-users-1x1",
    "filePath": "assets/icon-users-1x1.png"
  },
  {
    "id": "icon-wand-1x1",
    "filePath": "assets/icon-wand-1x1.png"
  },
  {
    "id": "icon-wave-1x1",
    "filePath": "assets/icon-wave-1x1.png"
  },
  {
    "id": "icon-wrench-1x1",
    "filePath": "assets/icon-wrench-1x1.png"
  },
  {
    "id": "icon-yinyang-1x1",
    "filePath": "assets/icon-yinyang-1x1.png"
  },
  {
    "id": "icon-alien-2x2",
    "filePath": "assets/icon-alien-2x2.png"
  },
  {
    "id": "icon-anchor-2x2",
    "filePath": "assets/icon-anchor-2x2.png"
  },
  {
    "id": "icon-atom-2x2",
    "filePath": "assets/icon-atom-2x2.png"
  },
  {
    "id": "icon-battery-2x2",
    "filePath": "assets/icon-battery-2x2.png"
  },
  {
    "id": "icon-bird-2x2",
    "filePath": "assets/icon-bird-2x2.png"
  },
  {
    "id": "icon-bottle-2x2",
    "filePath": "assets/icon-bottle-2x2.png"
  },
  {
    "id": "icon-bug-2x2",
    "filePath": "assets/icon-bug-2x2.png"
  },
  {
    "id": "icon-bug2-2x2",
    "filePath": "assets/icon-bug2-2x2.png"
  },
  {
    "id": "icon-cactus-2x2",
    "filePath": "assets/icon-cactus-2x2.png"
  },
  {
    "id": "icon-calendar-2x2",
    "filePath": "assets/icon-calendar-2x2.png"
  },
  {
    "id": "icon-camera-2x2",
    "filePath": "assets/icon-camera-2x2.png"
  },
  {
    "id": "icon-can-2x2",
    "filePath": "assets/icon-can-2x2.png"
  },
  {
    "id": "icon-cards-2x2",
    "filePath": "assets/icon-cards-2x2.png"
  },
  {
    "id": "icon-cart-2x2",
    "filePath": "assets/icon-cart-2x2.png"
  },
  {
    "id": "icon-cat-2x2",
    "filePath": "assets/icon-cat-2x2.png"
  },
  {
    "id": "icon-chart-2x2",
    "filePath": "assets/icon-chart-2x2.png"
  },
  {
    "id": "icon-chat-2x2",
    "filePath": "assets/icon-chat-2x2.png"
  },
  {
    "id": "icon-check-2x2",
    "filePath": "assets/icon-check-2x2.png"
  },
  {
    "id": "icon-chess-2x2",
    "filePath": "assets/icon-chess-2x2.png"
  },
  {
    "id": "icon-chevron-double-down-2x2",
    "filePath": "assets/icon-chevron-double-down-2x2.png"
  },
  {
    "id": "icon-chevron-double-left-2x2",
    "filePath": "assets/icon-chevron-double-left-2x2.png"
  },
  {
    "id": "icon-chevron-double-right-2x2",
    "filePath": "assets/icon-chevron-double-right-2x2.png"
  },
  {
    "id": "icon-chevron-double-up-2x2",
    "filePath": "assets/icon-chevron-double-up-2x2.png"
  },
  {
    "id": "icon-chevron-down-2x2",
    "filePath": "assets/icon-chevron-down-2x2.png"
  },
  {
    "id": "icon-chevron-left-2x2",
    "filePath": "assets/icon-chevron-left-2x2.png"
  },
  {
    "id": "icon-chevron-right-2x2",
    "filePath": "assets/icon-chevron-right-2x2.png"
  },
  {
    "id": "icon-chevron-up-2x2",
    "filePath": "assets/icon-chevron-up-2x2.png"
  },
  {
    "id": "icon-clock-2x2",
    "filePath": "assets/icon-clock-2x2.png"
  },
  {
    "id": "icon-code-2x2",
    "filePath": "assets/icon-code-2x2.png"
  },
  {
    "id": "icon-coffee-2x2",
    "filePath": "assets/icon-coffee-2x2.png"
  },
  {
    "id": "icon-compass-2x2",
    "filePath": "assets/icon-compass-2x2.png"
  },
  {
    "id": "icon-cookie-2x2",
    "filePath": "assets/icon-cookie-2x2.png"
  },
  {
    "id": "icon-cpu-2x2",
    "filePath": "assets/icon-cpu-2x2.png"
  },
  {
    "id": "icon-cross-2x2",
    "filePath": "assets/icon-cross-2x2.png"
  },
  {
    "id": "icon-dice-2x2",
    "filePath": "assets/icon-dice-2x2.png"
  },
  {
    "id": "icon-disk-2x2",
    "filePath": "assets/icon-disk-2x2.png"
  },
  {
    "id": "icon-dog-2x2",
    "filePath": "assets/icon-dog-2x2.png"
  },
  {
    "id": "icon-file-2x2",
    "filePath": "assets/icon-file-2x2.png"
  },
  {
    "id": "icon-filter-2x2",
    "filePath": "assets/icon-filter-2x2.png"
  },
  {
    "id": "icon-fish-2x2",
    "filePath": "assets/icon-fish-2x2.png"
  },
  {
    "id": "icon-folder-2x2",
    "filePath": "assets/icon-folder-2x2.png"
  },
  {
    "id": "icon-fox-2x2",
    "filePath": "assets/icon-fox-2x2.png"
  },
  {
    "id": "icon-gem-2x2",
    "filePath": "assets/icon-gem-2x2.png"
  },
  {
    "id": "icon-ghost-2x2",
    "filePath": "assets/icon-ghost-2x2.png"
  },
  {
    "id": "icon-gift-2x2",
    "filePath": "assets/icon-gift-2x2.png"
  },
  {
    "id": "icon-globe-2x2",
    "filePath": "assets/icon-globe-2x2.png"
  },
  {
    "id": "icon-headphones-2x2",
    "filePath": "assets/icon-headphones-2x2.png"
  },
  {
    "id": "icon-heart-2x2",
    "filePath": "assets/icon-heart-2x2.png"
  },
  {
    "id": "icon-hourglass-2x2",
    "filePath": "assets/icon-hourglass-2x2.png"
  },
  {
    "id": "icon-icecream-2x2",
    "filePath": "assets/icon-icecream-2x2.png"
  },
  {
    "id": "icon-image-2x2",
    "filePath": "assets/icon-image-2x2.png"
  },
  {
    "id": "icon-infinity-2x2",
    "filePath": "assets/icon-infinity-2x2.png"
  },
  {
    "id": "icon-info-2x2",
    "filePath": "assets/icon-info-2x2.png"
  },
  {
    "id": "icon-joystick-2x2",
    "filePath": "assets/icon-joystick-2x2.png"
  },
  {
    "id": "icon-lab-2x2",
    "filePath": "assets/icon-lab-2x2.png"
  },
  {
    "id": "icon-link-2x2",
    "filePath": "assets/icon-link-2x2.png"
  },
  {
    "id": "icon-magnet-2x2",
    "filePath": "assets/icon-magnet-2x2.png"
  },
  {
    "id": "icon-map-2x2",
    "filePath": "assets/icon-map-2x2.png"
  },
  {
    "id": "icon-medal-2x2",
    "filePath": "assets/icon-medal-2x2.png"
  },
  {
    "id": "icon-mic-2x2",
    "filePath": "assets/icon-mic-2x2.png"
  },
  {
    "id": "icon-mushroom-2x2",
    "filePath": "assets/icon-mushroom-2x2.png"
  },
  {
    "id": "icon-ore-2x2",
    "filePath": "assets/icon-ore-2x2.png"
  },
  {
    "id": "icon-phone-2x2",
    "filePath": "assets/icon-phone-2x2.png"
  },
  {
    "id": "icon-pickaxe-2x2",
    "filePath": "assets/icon-pickaxe-2x2.png"
  },
  {
    "id": "icon-pin-2x2",
    "filePath": "assets/icon-pin-2x2.png"
  },
  {
    "id": "icon-pizza-2x2",
    "filePath": "assets/icon-pizza-2x2.png"
  },
  {
    "id": "icon-potion-2x2",
    "filePath": "assets/icon-potion-2x2.png"
  },
  {
    "id": "icon-power-2x2",
    "filePath": "assets/icon-power-2x2.png"
  },
  {
    "id": "icon-puzzle-2x2",
    "filePath": "assets/icon-puzzle-2x2.png"
  },
  {
    "id": "icon-rainbow-2x2",
    "filePath": "assets/icon-rainbow-2x2.png"
  },
  {
    "id": "icon-ring-2x2",
    "filePath": "assets/icon-ring-2x2.png"
  },
  {
    "id": "icon-robot-2x2",
    "filePath": "assets/icon-robot-2x2.png"
  },
  {
    "id": "icon-scroll-2x2",
    "filePath": "assets/icon-scroll-2x2.png"
  },
  {
    "id": "icon-search-2x2",
    "filePath": "assets/icon-search-2x2.png"
  },
  {
    "id": "icon-seed-2x2",
    "filePath": "assets/icon-seed-2x2.png"
  },
  {
    "id": "icon-snow-2x2",
    "filePath": "assets/icon-snow-2x2.png"
  },
  {
    "id": "icon-speaker-2x2",
    "filePath": "assets/icon-speaker-2x2.png"
  },
  {
    "id": "icon-spiral-2x2",
    "filePath": "assets/icon-spiral-2x2.png"
  },
  {
    "id": "icon-star-2x2",
    "filePath": "assets/icon-star-2x2.png"
  },
  {
    "id": "icon-tag-2x2",
    "filePath": "assets/icon-tag-2x2.png"
  },
  {
    "id": "icon-terminal-2x2",
    "filePath": "assets/icon-terminal-2x2.png"
  },
  {
    "id": "icon-tree-2x2",
    "filePath": "assets/icon-tree-2x2.png"
  },
  {
    "id": "icon-trophy-2x2",
    "filePath": "assets/icon-trophy-2x2.png"
  },
  {
    "id": "icon-wand-2x2",
    "filePath": "assets/icon-wand-2x2.png"
  },
  {
    "id": "icon-warning-2x2",
    "filePath": "assets/icon-warning-2x2.png"
  },
  {
    "id": "icon-wave-2x2",
    "filePath": "assets/icon-wave-2x2.png"
  },
  {
    "id": "icon-wifi-2x2",
    "filePath": "assets/icon-wifi-2x2.png"
  },
  {
    "id": "icon-yinyang-2x2",
    "filePath": "assets/icon-yinyang-2x2.png"
  },
  {
    "id": "icon-air-3x3",
    "filePath": "assets/icon-air-3x3.png"
  },
  {
    "id": "icon-alien-3x3",
    "filePath": "assets/icon-alien-3x3.png"
  },
  {
    "id": "icon-anchor-3x3",
    "filePath": "assets/icon-anchor-3x3.png"
  },
  {
    "id": "icon-bio-3x3",
    "filePath": "assets/icon-bio-3x3.png"
  },
  {
    "id": "icon-bird-3x3",
    "filePath": "assets/icon-bird-3x3.png"
  },
  {
    "id": "icon-blueprint-3x3",
    "filePath": "assets/icon-blueprint-3x3.png"
  },
  {
    "id": "icon-bottle-3x3",
    "filePath": "assets/icon-bottle-3x3.png"
  },
  {
    "id": "icon-bug2-3x3",
    "filePath": "assets/icon-bug2-3x3.png"
  },
  {
    "id": "icon-build-3x3",
    "filePath": "assets/icon-build-3x3.png"
  },
  {
    "id": "icon-cactus-3x3",
    "filePath": "assets/icon-cactus-3x3.png"
  },
  {
    "id": "icon-can-3x3",
    "filePath": "assets/icon-can-3x3.png"
  },
  {
    "id": "icon-cards-3x3",
    "filePath": "assets/icon-cards-3x3.png"
  },
  {
    "id": "icon-cat-3x3",
    "filePath": "assets/icon-cat-3x3.png"
  },
  {
    "id": "icon-check-3x3",
    "filePath": "assets/icon-check-3x3.png"
  },
  {
    "id": "icon-chess-3x3",
    "filePath": "assets/icon-chess-3x3.png"
  },
  {
    "id": "icon-chest-3x3",
    "filePath": "assets/icon-chest-3x3.png"
  },
  {
    "id": "icon-chevron-double-down-3x3",
    "filePath": "assets/icon-chevron-double-down-3x3.png"
  },
  {
    "id": "icon-chevron-double-left-3x3",
    "filePath": "assets/icon-chevron-double-left-3x3.png"
  },
  {
    "id": "icon-chevron-double-right-3x3",
    "filePath": "assets/icon-chevron-double-right-3x3.png"
  },
  {
    "id": "icon-chevron-double-up-3x3",
    "filePath": "assets/icon-chevron-double-up-3x3.png"
  },
  {
    "id": "icon-chevron-down-3x3",
    "filePath": "assets/icon-chevron-down-3x3.png"
  },
  {
    "id": "icon-chevron-left-3x3",
    "filePath": "assets/icon-chevron-left-3x3.png"
  },
  {
    "id": "icon-chevron-right-3x3",
    "filePath": "assets/icon-chevron-right-3x3.png"
  },
  {
    "id": "icon-chevron-up-3x3",
    "filePath": "assets/icon-chevron-up-3x3.png"
  },
  {
    "id": "icon-circuit-3x3",
    "filePath": "assets/icon-circuit-3x3.png"
  },
  {
    "id": "icon-coffee-3x3",
    "filePath": "assets/icon-coffee-3x3.png"
  },
  {
    "id": "icon-coin-3x3",
    "filePath": "assets/icon-coin-3x3.png"
  },
  {
    "id": "icon-cookie-3x3",
    "filePath": "assets/icon-cookie-3x3.png"
  },
  {
    "id": "icon-cross-3x3",
    "filePath": "assets/icon-cross-3x3.png"
  },
  {
    "id": "icon-crown-3x3",
    "filePath": "assets/icon-crown-3x3.png"
  },
  {
    "id": "icon-crystal-3x3",
    "filePath": "assets/icon-crystal-3x3.png"
  },
  {
    "id": "icon-diamond-3x3",
    "filePath": "assets/icon-diamond-3x3.png"
  },
  {
    "id": "icon-dice-3x3",
    "filePath": "assets/icon-dice-3x3.png"
  },
  {
    "id": "icon-dna-3x3",
    "filePath": "assets/icon-dna-3x3.png"
  },
  {
    "id": "icon-dog-3x3",
    "filePath": "assets/icon-dog-3x3.png"
  },
  {
    "id": "icon-drone-3x3",
    "filePath": "assets/icon-drone-3x3.png"
  },
  {
    "id": "icon-earth-3x3",
    "filePath": "assets/icon-earth-3x3.png"
  },
  {
    "id": "icon-energy-3x3",
    "filePath": "assets/icon-energy-3x3.png"
  },
  {
    "id": "icon-factory-3x3",
    "filePath": "assets/icon-factory-3x3.png"
  },
  {
    "id": "icon-fire-3x3",
    "filePath": "assets/icon-fire-3x3.png"
  },
  {
    "id": "icon-fish-3x3",
    "filePath": "assets/icon-fish-3x3.png"
  },
  {
    "id": "icon-fox-3x3",
    "filePath": "assets/icon-fox-3x3.png"
  },
  {
    "id": "icon-gem-3x3",
    "filePath": "assets/icon-gem-3x3.png"
  },
  {
    "id": "icon-ghost-3x3",
    "filePath": "assets/icon-ghost-3x3.png"
  },
  {
    "id": "icon-heart-3x3",
    "filePath": "assets/icon-heart-3x3.png"
  },
  {
    "id": "icon-home-3x3",
    "filePath": "assets/icon-home-3x3.png"
  },
  {
    "id": "icon-hourglass-3x3",
    "filePath": "assets/icon-hourglass-3x3.png"
  },
  {
    "id": "icon-icecream-3x3",
    "filePath": "assets/icon-icecream-3x3.png"
  },
  {
    "id": "icon-infinity-3x3",
    "filePath": "assets/icon-infinity-3x3.png"
  },
  {
    "id": "icon-joystick-3x3",
    "filePath": "assets/icon-joystick-3x3.png"
  },
  {
    "id": "icon-lab-3x3",
    "filePath": "assets/icon-lab-3x3.png"
  },
  {
    "id": "icon-magnet-3x3",
    "filePath": "assets/icon-magnet-3x3.png"
  },
  {
    "id": "icon-mushroom-3x3",
    "filePath": "assets/icon-mushroom-3x3.png"
  },
  {
    "id": "icon-ore-3x3",
    "filePath": "assets/icon-ore-3x3.png"
  },
  {
    "id": "icon-pickaxe-3x3",
    "filePath": "assets/icon-pickaxe-3x3.png"
  },
  {
    "id": "icon-pizza-3x3",
    "filePath": "assets/icon-pizza-3x3.png"
  },
  {
    "id": "icon-plane-3x3",
    "filePath": "assets/icon-plane-3x3.png"
  },
  {
    "id": "icon-portal-3x3",
    "filePath": "assets/icon-portal-3x3.png"
  },
  {
    "id": "icon-potion-3x3",
    "filePath": "assets/icon-potion-3x3.png"
  },
  {
    "id": "icon-power-3x3",
    "filePath": "assets/icon-power-3x3.png"
  },
  {
    "id": "icon-puzzle-3x3",
    "filePath": "assets/icon-puzzle-3x3.png"
  },
  {
    "id": "icon-radar-3x3",
    "filePath": "assets/icon-radar-3x3.png"
  },
  {
    "id": "icon-rainbow-3x3",
    "filePath": "assets/icon-rainbow-3x3.png"
  },
  {
    "id": "icon-ring-3x3",
    "filePath": "assets/icon-ring-3x3.png"
  },
  {
    "id": "icon-robot-3x3",
    "filePath": "assets/icon-robot-3x3.png"
  },
  {
    "id": "icon-rocket-3x3",
    "filePath": "assets/icon-rocket-3x3.png"
  },
  {
    "id": "icon-satellite-3x3",
    "filePath": "assets/icon-satellite-3x3.png"
  },
  {
    "id": "icon-scroll-3x3",
    "filePath": "assets/icon-scroll-3x3.png"
  },
  {
    "id": "icon-seed-3x3",
    "filePath": "assets/icon-seed-3x3.png"
  },
  {
    "id": "icon-settings-3x3",
    "filePath": "assets/icon-settings-3x3.png"
  },
  {
    "id": "icon-ship-3x3",
    "filePath": "assets/icon-ship-3x3.png"
  },
  {
    "id": "icon-shop-3x3",
    "filePath": "assets/icon-shop-3x3.png"
  },
  {
    "id": "icon-skull-3x3",
    "filePath": "assets/icon-skull-3x3.png"
  },
  {
    "id": "icon-snow-3x3",
    "filePath": "assets/icon-snow-3x3.png"
  },
  {
    "id": "icon-spiral-3x3",
    "filePath": "assets/icon-spiral-3x3.png"
  },
  {
    "id": "icon-star-3x3",
    "filePath": "assets/icon-star-3x3.png"
  },
  {
    "id": "icon-train-3x3",
    "filePath": "assets/icon-train-3x3.png"
  },
  {
    "id": "icon-tree-3x3",
    "filePath": "assets/icon-tree-3x3.png"
  },
  {
    "id": "icon-truck-3x3",
    "filePath": "assets/icon-truck-3x3.png"
  },
  {
    "id": "icon-user-3x3",
    "filePath": "assets/icon-user-3x3.png"
  },
  {
    "id": "icon-users-3x3",
    "filePath": "assets/icon-users-3x3.png"
  },
  {
    "id": "icon-vault-3x3",
    "filePath": "assets/icon-vault-3x3.png"
  },
  {
    "id": "icon-virus-3x3",
    "filePath": "assets/icon-virus-3x3.png"
  },
  {
    "id": "icon-wand-3x3",
    "filePath": "assets/icon-wand-3x3.png"
  },
  {
    "id": "icon-warning-3x3",
    "filePath": "assets/icon-warning-3x3.png"
  },
  {
    "id": "icon-water-3x3",
    "filePath": "assets/icon-water-3x3.png"
  },
  {
    "id": "icon-wave-3x3",
    "filePath": "assets/icon-wave-3x3.png"
  },
  {
    "id": "icon-yinyang-3x3",
    "filePath": "assets/icon-yinyang-3x3.png"
  },
  {
    "id": "ind-airlock-3x2",
    "filePath": "assets/ind-airlock-3x2.png"
  },
  {
    "id": "ind-assembler-4x4",
    "filePath": "assets/ind-assembler-4x4.png"
  },
  {
    "id": "ind-beam-2x1",
    "filePath": "assets/ind-beam-2x1.png"
  },
  {
    "id": "ind-board-3x2",
    "filePath": "assets/ind-board-3x2.png"
  },
  {
    "id": "ind-chimney-1x3",
    "filePath": "assets/ind-chimney-1x3.png"
  },
  {
    "id": "ind-console-3x2",
    "filePath": "assets/ind-console-3x2.png"
  },
  {
    "id": "ind-conveyor-2x1",
    "filePath": "assets/ind-conveyor-2x1.png"
  },
  {
    "id": "ind-core-4x4",
    "filePath": "assets/ind-core-4x4.png"
  },
  {
    "id": "ind-crane-1x3",
    "filePath": "assets/ind-crane-1x3.png"
  },
  {
    "id": "ind-crate-2x1",
    "filePath": "assets/ind-crate-2x1.png"
  },
  {
    "id": "ind-duct-2x1",
    "filePath": "assets/ind-duct-2x1.png"
  },
  {
    "id": "ind-furnace-3x2",
    "filePath": "assets/ind-furnace-3x2.png"
  },
  {
    "id": "ind-junction-2x1",
    "filePath": "assets/ind-junction-2x1.png"
  },
  {
    "id": "ind-ladder-1x2",
    "filePath": "assets/ind-ladder-1x2.png"
  },
  {
    "id": "ind-lamp-1x2",
    "filePath": "assets/ind-lamp-1x2.png"
  },
  {
    "id": "ind-locker-1x2",
    "filePath": "assets/ind-locker-1x2.png"
  },
  {
    "id": "ind-panel-2x1",
    "filePath": "assets/ind-panel-2x1.png"
  },
  {
    "id": "ind-pipe-1x2",
    "filePath": "assets/ind-pipe-1x2.png"
  },
  {
    "id": "ind-pipe-1x3",
    "filePath": "assets/ind-pipe-1x3.png"
  },
  {
    "id": "ind-pipe-2x1",
    "filePath": "assets/ind-pipe-2x1.png"
  },
  {
    "id": "ind-pipe-bank-3x2",
    "filePath": "assets/ind-pipe-bank-3x2.png"
  },
  {
    "id": "ind-plant-4x4",
    "filePath": "assets/ind-plant-4x4.png"
  },
  {
    "id": "ind-pump-1x2",
    "filePath": "assets/ind-pump-1x2.png"
  },
  {
    "id": "ind-rack-1x2",
    "filePath": "assets/ind-rack-1x2.png"
  },
  {
    "id": "ind-radiator-3x2",
    "filePath": "assets/ind-radiator-3x2.png"
  },
  {
    "id": "ind-server-1x3",
    "filePath": "assets/ind-server-1x3.png"
  },
  {
    "id": "ind-stack-1x2",
    "filePath": "assets/ind-stack-1x2.png"
  },
  {
    "id": "ind-storage-4x4",
    "filePath": "assets/ind-storage-4x4.png"
  },
  {
    "id": "ind-terminal-1x2",
    "filePath": "assets/ind-terminal-1x2.png"
  },
  {
    "id": "ind-warning-2x1",
    "filePath": "assets/ind-warning-2x1.png"
  },
  {
    "id": "logi-balancer-3x1",
    "filePath": "assets/logi-balancer-3x1.png"
  },
  {
    "id": "logi-belt-1x2",
    "filePath": "assets/logi-belt-1x2.png"
  },
  {
    "id": "logi-belt-2x1",
    "filePath": "assets/logi-belt-2x1.png"
  },
  {
    "id": "logi-belt-3x1",
    "filePath": "assets/logi-belt-3x1.png"
  },
  {
    "id": "logi-drill-1x2",
    "filePath": "assets/logi-drill-1x2.png"
  },
  {
    "id": "logi-pump-1x2",
    "filePath": "assets/logi-pump-1x2.png"
  },
  {
    "id": "logi-silo-2x3",
    "filePath": "assets/logi-silo-2x3.png"
  },
  {
    "id": "ind-barrel-1x1",
    "filePath": "assets/ind-barrel-1x1.png"
  },
  {
    "id": "ind-bolt-1x1",
    "filePath": "assets/ind-bolt-1x1.png"
  },
  {
    "id": "ind-button-1x1",
    "filePath": "assets/ind-button-1x1.png"
  },
  {
    "id": "ind-conduit-1x1",
    "filePath": "assets/ind-conduit-1x1.png"
  },
  {
    "id": "ind-gauge-1x1",
    "filePath": "assets/ind-gauge-1x1.png"
  },
  {
    "id": "ind-gear-1x1",
    "filePath": "assets/ind-gear-1x1.png"
  },
  {
    "id": "ind-pipe-cap-1x1",
    "filePath": "assets/ind-pipe-cap-1x1.png"
  },
  {
    "id": "ind-valve-1x1",
    "filePath": "assets/ind-valve-1x1.png"
  },
  {
    "id": "ind-boiler-2x2",
    "filePath": "assets/ind-boiler-2x2.png"
  },
  {
    "id": "ind-cabinet-2x2",
    "filePath": "assets/ind-cabinet-2x2.png"
  },
  {
    "id": "ind-crate-2x2",
    "filePath": "assets/ind-crate-2x2.png"
  },
  {
    "id": "ind-door-2x2",
    "filePath": "assets/ind-door-2x2.png"
  },
  {
    "id": "ind-fan-2x2",
    "filePath": "assets/ind-fan-2x2.png"
  },
  {
    "id": "ind-generator-2x2",
    "filePath": "assets/ind-generator-2x2.png"
  },
  {
    "id": "ind-motor-2x2",
    "filePath": "assets/ind-motor-2x2.png"
  },
  {
    "id": "ind-tank-2x2",
    "filePath": "assets/ind-tank-2x2.png"
  },
  {
    "id": "logi-assembler-2x2",
    "filePath": "assets/logi-assembler-2x2.png"
  },
  {
    "id": "logi-buffer-2x2",
    "filePath": "assets/logi-buffer-2x2.png"
  },
  {
    "id": "logi-drill-2x2",
    "filePath": "assets/logi-drill-2x2.png"
  },
  {
    "id": "logi-drone-station-2x2",
    "filePath": "assets/logi-drone-station-2x2.png"
  },
  {
    "id": "logi-extractor-2x2",
    "filePath": "assets/logi-extractor-2x2.png"
  },
  {
    "id": "logi-filter-2x2",
    "filePath": "assets/logi-filter-2x2.png"
  },
  {
    "id": "logi-hopper-2x2",
    "filePath": "assets/logi-hopper-2x2.png"
  },
  {
    "id": "logi-loader-2x2",
    "filePath": "assets/logi-loader-2x2.png"
  },
  {
    "id": "logi-merger-2x2",
    "filePath": "assets/logi-merger-2x2.png"
  },
  {
    "id": "logi-pump-2x2",
    "filePath": "assets/logi-pump-2x2.png"
  },
  {
    "id": "logi-silo-2x2",
    "filePath": "assets/logi-silo-2x2.png"
  },
  {
    "id": "logi-smelter-2x2",
    "filePath": "assets/logi-smelter-2x2.png"
  },
  {
    "id": "logi-sorter-2x2",
    "filePath": "assets/logi-sorter-2x2.png"
  },
  {
    "id": "logi-splitter-2x2",
    "filePath": "assets/logi-splitter-2x2.png"
  },
  {
    "id": "logi-unloader-2x2",
    "filePath": "assets/logi-unloader-2x2.png"
  },
  {
    "id": "ind-cooling-3x3",
    "filePath": "assets/ind-cooling-3x3.png"
  },
  {
    "id": "ind-crane-3x3",
    "filePath": "assets/ind-crane-3x3.png"
  },
  {
    "id": "ind-reactor-3x3",
    "filePath": "assets/ind-reactor-3x3.png"
  },
  {
    "id": "ind-server-3x3",
    "filePath": "assets/ind-server-3x3.png"
  },
  {
    "id": "logi-assembler-3x3",
    "filePath": "assets/logi-assembler-3x3.png"
  },
  {
    "id": "logi-silo-3x3",
    "filePath": "assets/logi-silo-3x3.png"
  },
  {
    "id": "logi-smelter-3x3",
    "filePath": "assets/logi-smelter-3x3.png"
  },
  {
    "id": "logi-sorter-3x3",
    "filePath": "assets/logi-sorter-3x3.png"
  },
  {
    "id": "logi-splitter-3x3",
    "filePath": "assets/logi-splitter-3x3.png"
  },
  {
    "id": "jar-ash-1x1",
    "filePath": "assets2/jar-ash-1x1.png"
  },
  {
    "id": "jar-crystal-1x1",
    "filePath": "assets2/jar-crystal-1x1.png"
  },
  {
    "id": "jar-empty-1x1",
    "filePath": "assets2/jar-empty-1x1.png"
  },
  {
    "id": "jar-eye-1x1",
    "filePath": "assets2/jar-eye-1x1.png"
  },
  {
    "id": "jar-gold-dust-1x1",
    "filePath": "assets2/jar-gold-dust-1x1.png"
  },
  {
    "id": "jar-goo-1x1",
    "filePath": "assets2/jar-goo-1x1.png"
  },
  {
    "id": "jar-heart-1x1",
    "filePath": "assets2/jar-heart-1x1.png"
  },
  {
    "id": "jar-ice-1x1",
    "filePath": "assets2/jar-ice-1x1.png"
  },
  {
    "id": "jar-mite-1x1",
    "filePath": "assets2/jar-mite-1x1.png"
  },
  {
    "id": "jar-oil-1x1",
    "filePath": "assets2/jar-oil-1x1.png"
  },
  {
    "id": "jar-pollen-1x1",
    "filePath": "assets2/jar-pollen-1x1.png"
  },
  {
    "id": "jar-sand-1x1",
    "filePath": "assets2/jar-sand-1x1.png"
  },
  {
    "id": "jar-spore-1x1",
    "filePath": "assets2/jar-spore-1x1.png"
  },
  {
    "id": "jar-void-1x1",
    "filePath": "assets2/jar-void-1x1.png"
  },
  {
    "id": "jar-water-1x1",
    "filePath": "assets2/jar-water-1x1.png"
  },
  {
    "id": "jar-worm-1x1",
    "filePath": "assets2/jar-worm-1x1.png"
  },
  {
    "id": "key-bio-1x1",
    "filePath": "assets2/key-bio-1x1.png"
  },
  {
    "id": "key-card-1x1",
    "filePath": "assets2/key-card-1x1.png"
  },
  {
    "id": "key-copper-1x1",
    "filePath": "assets2/key-copper-1x1.png"
  },
  {
    "id": "key-crystal-1x1",
    "filePath": "assets2/key-crystal-1x1.png"
  },
  {
    "id": "key-eye-1x1",
    "filePath": "assets2/key-eye-1x1.png"
  },
  {
    "id": "key-gold-1x1",
    "filePath": "assets2/key-gold-1x1.png"
  },
  {
    "id": "key-heart-1x1",
    "filePath": "assets2/key-heart-1x1.png"
  },
  {
    "id": "key-ice-1x1",
    "filePath": "assets2/key-ice-1x1.png"
  },
  {
    "id": "key-master-1x1",
    "filePath": "assets2/key-master-1x1.png"
  },
  {
    "id": "key-pixel-1x1",
    "filePath": "assets2/key-pixel-1x1.png"
  },
  {
    "id": "key-rust-1x1",
    "filePath": "assets2/key-rust-1x1.png"
  },
  {
    "id": "key-sand-1x1",
    "filePath": "assets2/key-sand-1x1.png"
  },
  {
    "id": "key-skull-1x1",
    "filePath": "assets2/key-skull-1x1.png"
  },
  {
    "id": "key-spore-1x1",
    "filePath": "assets2/key-spore-1x1.png"
  },
  {
    "id": "key-temple-1x1",
    "filePath": "assets2/key-temple-1x1.png"
  },
  {
    "id": "key-void-1x1",
    "filePath": "assets2/key-void-1x1.png"
  },
  {
    "id": "lever-bio-btn-1x1",
    "filePath": "assets2/lever-bio-btn-1x1.png"
  },
  {
    "id": "pipe-cap-1x1",
    "filePath": "assets2/pipe-cap-1x1.png"
  },
  {
    "id": "pipe-cap-ice-1x1",
    "filePath": "assets2/pipe-cap-ice-1x1.png"
  },
  {
    "id": "pipe-I-1x1",
    "filePath": "assets2/pipe-I-1x1.png"
  },
  {
    "id": "pipe-I-glass-1x1",
    "filePath": "assets2/pipe-I-glass-1x1.png"
  },
  {
    "id": "pipe-I-ice-1x1",
    "filePath": "assets2/pipe-I-ice-1x1.png"
  },
  {
    "id": "pipe-I-magma-1x1",
    "filePath": "assets2/pipe-I-magma-1x1.png"
  },
  {
    "id": "pipe-I-sand-1x1",
    "filePath": "assets2/pipe-I-sand-1x1.png"
  },
  {
    "id": "pipe-I-spore-1x1",
    "filePath": "assets2/pipe-I-spore-1x1.png"
  },
  {
    "id": "pipe-L-1x1",
    "filePath": "assets2/pipe-L-1x1.png"
  },
  {
    "id": "pipe-L-ice-1x1",
    "filePath": "assets2/pipe-L-ice-1x1.png"
  },
  {
    "id": "pipe-L-magma-1x1",
    "filePath": "assets2/pipe-L-magma-1x1.png"
  },
  {
    "id": "pipe-T-1x1",
    "filePath": "assets2/pipe-T-1x1.png"
  },
  {
    "id": "pipe-T-copper-1x1",
    "filePath": "assets2/pipe-T-copper-1x1.png"
  },
  {
    "id": "pipe-T-sand-1x1",
    "filePath": "assets2/pipe-T-sand-1x1.png"
  },
  {
    "id": "pipe-X-1x1",
    "filePath": "assets2/pipe-X-1x1.png"
  },
  {
    "id": "pipe-X-spore-1x1",
    "filePath": "assets2/pipe-X-spore-1x1.png"
  },
  {
    "id": "pipe-cap-2x2",
    "filePath": "assets2/pipe-cap-2x2.png"
  },
  {
    "id": "pipe-cap-ice-2x2",
    "filePath": "assets2/pipe-cap-ice-2x2.png"
  },
  {
    "id": "pipe-I-2x2",
    "filePath": "assets2/pipe-I-2x2.png"
  },
  {
    "id": "pipe-I-glass-2x2",
    "filePath": "assets2/pipe-I-glass-2x2.png"
  },
  {
    "id": "pipe-I-ice-2x2",
    "filePath": "assets2/pipe-I-ice-2x2.png"
  },
  {
    "id": "pipe-I-magma-2x2",
    "filePath": "assets2/pipe-I-magma-2x2.png"
  },
  {
    "id": "pipe-I-sand-2x2",
    "filePath": "assets2/pipe-I-sand-2x2.png"
  },
  {
    "id": "pipe-I-spore-2x2",
    "filePath": "assets2/pipe-I-spore-2x2.png"
  },
  {
    "id": "pipe-L-2x2",
    "filePath": "assets2/pipe-L-2x2.png"
  },
  {
    "id": "pipe-L-ice-2x2",
    "filePath": "assets2/pipe-L-ice-2x2.png"
  },
  {
    "id": "pipe-L-magma-2x2",
    "filePath": "assets2/pipe-L-magma-2x2.png"
  },
  {
    "id": "pipe-T-2x2",
    "filePath": "assets2/pipe-T-2x2.png"
  },
  {
    "id": "pipe-T-copper-2x2",
    "filePath": "assets2/pipe-T-copper-2x2.png"
  },
  {
    "id": "pipe-T-sand-2x2",
    "filePath": "assets2/pipe-T-sand-2x2.png"
  },
  {
    "id": "pipe-X-2x2",
    "filePath": "assets2/pipe-X-2x2.png"
  },
  {
    "id": "pipe-X-spore-2x2",
    "filePath": "assets2/pipe-X-spore-2x2.png"
  },
  {
    "id": "pod-algae-1x1",
    "filePath": "assets2/pod-algae-1x1.png"
  },
  {
    "id": "pod-berry-1x1",
    "filePath": "assets2/pod-berry-1x1.png"
  },
  {
    "id": "pod-crystal-1x1",
    "filePath": "assets2/pod-crystal-1x1.png"
  },
  {
    "id": "pod-ice-1x1",
    "filePath": "assets2/pod-ice-1x1.png"
  },
  {
    "id": "pod-pollen-1x1",
    "filePath": "assets2/pod-pollen-1x1.png"
  },
  {
    "id": "pod-root-1x1",
    "filePath": "assets2/pod-root-1x1.png"
  },
  {
    "id": "pod-sand-1x1",
    "filePath": "assets2/pod-sand-1x1.png"
  },
  {
    "id": "pod-shroom-1x1",
    "filePath": "assets2/pod-shroom-1x1.png"
  },
  {
    "id": "pod-spore-1x1",
    "filePath": "assets2/pod-spore-1x1.png"
  },
  {
    "id": "pod-thorn-1x1",
    "filePath": "assets2/pod-thorn-1x1.png"
  },
  {
    "id": "pod-twin-1x1",
    "filePath": "assets2/pod-twin-1x1.png"
  },
  {
    "id": "pod-vine-1x1",
    "filePath": "assets2/pod-vine-1x1.png"
  },
  {
    "id": "pod-algae-2x2",
    "filePath": "assets2/pod-algae-2x2.png"
  },
  {
    "id": "pod-berry-2x2",
    "filePath": "assets2/pod-berry-2x2.png"
  },
  {
    "id": "pod-crystal-2x2",
    "filePath": "assets2/pod-crystal-2x2.png"
  },
  {
    "id": "pod-ice-2x2",
    "filePath": "assets2/pod-ice-2x2.png"
  },
  {
    "id": "pod-pollen-2x2",
    "filePath": "assets2/pod-pollen-2x2.png"
  },
  {
    "id": "pod-root-2x2",
    "filePath": "assets2/pod-root-2x2.png"
  },
  {
    "id": "pod-sand-2x2",
    "filePath": "assets2/pod-sand-2x2.png"
  },
  {
    "id": "pod-shroom-2x2",
    "filePath": "assets2/pod-shroom-2x2.png"
  },
  {
    "id": "pod-spore-2x2",
    "filePath": "assets2/pod-spore-2x2.png"
  },
  {
    "id": "pod-thorn-2x2",
    "filePath": "assets2/pod-thorn-2x2.png"
  },
  {
    "id": "pod-twin-2x2",
    "filePath": "assets2/pod-twin-2x2.png"
  },
  {
    "id": "pod-vine-2x2",
    "filePath": "assets2/pod-vine-2x2.png"
  },
  {
    "id": "port-cyan-1x1",
    "filePath": "assets2/port-cyan-1x1.png"
  },
  {
    "id": "port-factory-1x1",
    "filePath": "assets2/port-factory-1x1.png"
  },
  {
    "id": "port-fog-1x1",
    "filePath": "assets2/port-fog-1x1.png"
  },
  {
    "id": "port-garden-1x1",
    "filePath": "assets2/port-garden-1x1.png"
  },
  {
    "id": "port-gold-1x1",
    "filePath": "assets2/port-gold-1x1.png"
  },
  {
    "id": "port-green-1x1",
    "filePath": "assets2/port-green-1x1.png"
  },
  {
    "id": "port-ice-1x1",
    "filePath": "assets2/port-ice-1x1.png"
  },
  {
    "id": "port-magma-1x1",
    "filePath": "assets2/port-magma-1x1.png"
  },
  {
    "id": "port-night-1x1",
    "filePath": "assets2/port-night-1x1.png"
  },
  {
    "id": "port-ocean-1x1",
    "filePath": "assets2/port-ocean-1x1.png"
  },
  {
    "id": "port-red-alert-1x1",
    "filePath": "assets2/port-red-alert-1x1.png"
  },
  {
    "id": "port-sand-1x1",
    "filePath": "assets2/port-sand-1x1.png"
  },
  {
    "id": "port-spore-1x1",
    "filePath": "assets2/port-spore-1x1.png"
  },
  {
    "id": "port-stars-1x1",
    "filePath": "assets2/port-stars-1x1.png"
  },
  {
    "id": "port-storm-1x1",
    "filePath": "assets2/port-storm-1x1.png"
  },
  {
    "id": "port-void-1x1",
    "filePath": "assets2/port-void-1x1.png"
  },
  {
    "id": "portal-cyan-2x2",
    "filePath": "assets2/portal-cyan-2x2.png"
  },
  {
    "id": "portal-gold-2x2",
    "filePath": "assets2/portal-gold-2x2.png"
  },
  {
    "id": "portal-ice-2x2",
    "filePath": "assets2/portal-ice-2x2.png"
  },
  {
    "id": "portal-magma-2x2",
    "filePath": "assets2/portal-magma-2x2.png"
  },
  {
    "id": "portal-pink-2x2",
    "filePath": "assets2/portal-pink-2x2.png"
  },
  {
    "id": "portal-sand-2x2",
    "filePath": "assets2/portal-sand-2x2.png"
  },
  {
    "id": "portal-spore-2x2",
    "filePath": "assets2/portal-spore-2x2.png"
  },
  {
    "id": "portal-void-2x2",
    "filePath": "assets2/portal-void-2x2.png"
  },
  {
    "id": "portal-cyan-3x3",
    "filePath": "assets2/portal-cyan-3x3.png"
  },
  {
    "id": "portal-gold-3x3",
    "filePath": "assets2/portal-gold-3x3.png"
  },
  {
    "id": "portal-ice-3x3",
    "filePath": "assets2/portal-ice-3x3.png"
  },
  {
    "id": "portal-magma-3x3",
    "filePath": "assets2/portal-magma-3x3.png"
  },
  {
    "id": "portal-pink-3x3",
    "filePath": "assets2/portal-pink-3x3.png"
  },
  {
    "id": "portal-sand-3x3",
    "filePath": "assets2/portal-sand-3x3.png"
  },
  {
    "id": "portal-spore-3x3",
    "filePath": "assets2/portal-spore-3x3.png"
  },
  {
    "id": "portal-void-3x3",
    "filePath": "assets2/portal-void-3x3.png"
  },
  {
    "id": "probs-crate-stack-4x4",
    "filePath": "assets/probs-crate-stack-4x4.png"
  },
  {
    "id": "probs-fusion-core-4x4",
    "filePath": "assets/probs-fusion-core-4x4.png"
  },
  {
    "id": "probs-gate-4x4",
    "filePath": "assets/probs-gate-4x4.png"
  },
  {
    "id": "probs-growth-chamber-4x4",
    "filePath": "assets/probs-growth-chamber-4x4.png"
  },
  {
    "id": "probs-lab-bench-4x4",
    "filePath": "assets/probs-lab-bench-4x4.png"
  },
  {
    "id": "probs-reactor-core-4x4",
    "filePath": "assets/probs-reactor-core-4x4.png"
  },
  {
    "id": "probs-bio-canister-1x1",
    "filePath": "assets/probs-bio-canister-1x1.png"
  },
  {
    "id": "probs-biohazard-barrel-1x1",
    "filePath": "assets/probs-biohazard-barrel-1x1.png"
  },
  {
    "id": "probs-crate-1x1",
    "filePath": "assets/probs-crate-1x1.png"
  },
  {
    "id": "probs-data-node-1x1",
    "filePath": "assets/probs-data-node-1x1.png"
  },
  {
    "id": "probs-power-junction-1x1",
    "filePath": "assets/probs-power-junction-1x1.png"
  },
  {
    "id": "probs-sample-tube-1x1",
    "filePath": "assets/probs-sample-tube-1x1.png"
  },
  {
    "id": "probs-sensor-1x1",
    "filePath": "assets/probs-sensor-1x1.png"
  },
  {
    "id": "probs-spore-pod-1x1",
    "filePath": "assets/probs-spore-pod-1x1.png"
  },
  {
    "id": "probs-vent-1x1",
    "filePath": "assets/probs-vent-1x1.png"
  },
  {
    "id": "probs-wall-light-1x1",
    "filePath": "assets/probs-wall-light-1x1.png"
  },
  {
    "id": "probs-crate-2x2",
    "filePath": "assets/probs-crate-2x2.png"
  },
  {
    "id": "probs-door-2x2",
    "filePath": "assets/probs-door-2x2.png"
  },
  {
    "id": "probs-drone-dock-2x2",
    "filePath": "assets/probs-drone-dock-2x2.png"
  },
  {
    "id": "probs-fan-2x2",
    "filePath": "assets/probs-fan-2x2.png"
  },
  {
    "id": "probs-holo-projector-2x2",
    "filePath": "assets/probs-holo-projector-2x2.png"
  },
  {
    "id": "probs-incubator-2x2",
    "filePath": "assets/probs-incubator-2x2.png"
  },
  {
    "id": "probs-nutrient-tank-2x2",
    "filePath": "assets/probs-nutrient-tank-2x2.png"
  },
  {
    "id": "probs-pipe-junction-2x2",
    "filePath": "assets/probs-pipe-junction-2x2.png"
  },
  {
    "id": "probs-server-rack-2x2",
    "filePath": "assets/probs-server-rack-2x2.png"
  },
  {
    "id": "probs-window-2x2",
    "filePath": "assets/probs-window-2x2.png"
  },
  {
    "id": "probs-assembler-arm-3x3",
    "filePath": "assets/probs-assembler-arm-3x3.png"
  },
  {
    "id": "probs-bioreactor-3x3",
    "filePath": "assets/probs-bioreactor-3x3.png"
  },
  {
    "id": "probs-console-3x3",
    "filePath": "assets/probs-console-3x3.png"
  },
  {
    "id": "probs-cooling-tower-3x3",
    "filePath": "assets/probs-cooling-tower-3x3.png"
  },
  {
    "id": "probs-gene-sequencer-3x3",
    "filePath": "assets/probs-gene-sequencer-3x3.png"
  },
  {
    "id": "probs-shelf-3x3",
    "filePath": "assets/probs-shelf-3x3.png"
  },
  {
    "id": "probs-stasis-pod-3x3",
    "filePath": "assets/probs-stasis-pod-3x3.png"
  },
  {
    "id": "sensor-alarm-1x1",
    "filePath": "assets2/sensor-alarm-1x1.png"
  },
  {
    "id": "sensor-beacon-eye-1x1",
    "filePath": "assets2/sensor-beacon-eye-1x1.png"
  },
  {
    "id": "sign-biohazard-1x1",
    "filePath": "assets2/sign-biohazard-1x1.png"
  },
  {
    "id": "sign-cold-1x1",
    "filePath": "assets2/sign-cold-1x1.png"
  },
  {
    "id": "sign-electric-1x1",
    "filePath": "assets2/sign-electric-1x1.png"
  },
  {
    "id": "sign-exit-1x1",
    "filePath": "assets2/sign-exit-1x1.png"
  },
  {
    "id": "sign-fire-1x1",
    "filePath": "assets2/sign-fire-1x1.png"
  },
  {
    "id": "sign-first-aid-1x1",
    "filePath": "assets2/sign-first-aid-1x1.png"
  },
  {
    "id": "sign-flammable-1x1",
    "filePath": "assets2/sign-flammable-1x1.png"
  },
  {
    "id": "sign-go-1x1",
    "filePath": "assets2/sign-go-1x1.png"
  },
  {
    "id": "sign-info-1x1",
    "filePath": "assets2/sign-info-1x1.png"
  },
  {
    "id": "sign-laser-1x1",
    "filePath": "assets2/sign-laser-1x1.png"
  },
  {
    "id": "sign-lock-1x1",
    "filePath": "assets2/sign-lock-1x1.png"
  },
  {
    "id": "sign-magnetic-1x1",
    "filePath": "assets2/sign-magnetic-1x1.png"
  },
  {
    "id": "sign-no-entry-1x1",
    "filePath": "assets2/sign-no-entry-1x1.png"
  },
  {
    "id": "sign-radiation-1x1",
    "filePath": "assets2/sign-radiation-1x1.png"
  },
  {
    "id": "sign-recycle-1x1",
    "filePath": "assets2/sign-recycle-1x1.png"
  },
  {
    "id": "sign-skull-1x1",
    "filePath": "assets2/sign-skull-1x1.png"
  },
  {
    "id": "sign-stop-1x1",
    "filePath": "assets2/sign-stop-1x1.png"
  },
  {
    "id": "sign-toxic-1x1",
    "filePath": "assets2/sign-toxic-1x1.png"
  },
  {
    "id": "sign-warning-1x1",
    "filePath": "assets2/sign-warning-1x1.png"
  },
  {
    "id": "sign-wifi-1x1",
    "filePath": "assets2/sign-wifi-1x1.png"
  },
  {
    "id": "sign-biohazard-2x2",
    "filePath": "assets2/sign-biohazard-2x2.png"
  },
  {
    "id": "sign-cold-2x2",
    "filePath": "assets2/sign-cold-2x2.png"
  },
  {
    "id": "sign-electric-2x2",
    "filePath": "assets2/sign-electric-2x2.png"
  },
  {
    "id": "sign-exit-2x2",
    "filePath": "assets2/sign-exit-2x2.png"
  },
  {
    "id": "sign-fire-2x2",
    "filePath": "assets2/sign-fire-2x2.png"
  },
  {
    "id": "sign-first-aid-2x2",
    "filePath": "assets2/sign-first-aid-2x2.png"
  },
  {
    "id": "sign-flammable-2x2",
    "filePath": "assets2/sign-flammable-2x2.png"
  },
  {
    "id": "sign-go-2x2",
    "filePath": "assets2/sign-go-2x2.png"
  },
  {
    "id": "sign-info-2x2",
    "filePath": "assets2/sign-info-2x2.png"
  },
  {
    "id": "sign-laser-2x2",
    "filePath": "assets2/sign-laser-2x2.png"
  },
  {
    "id": "sign-lock-2x2",
    "filePath": "assets2/sign-lock-2x2.png"
  },
  {
    "id": "sign-magnetic-2x2",
    "filePath": "assets2/sign-magnetic-2x2.png"
  },
  {
    "id": "sign-no-entry-2x2",
    "filePath": "assets2/sign-no-entry-2x2.png"
  },
  {
    "id": "sign-radiation-2x2",
    "filePath": "assets2/sign-radiation-2x2.png"
  },
  {
    "id": "sign-recycle-2x2",
    "filePath": "assets2/sign-recycle-2x2.png"
  },
  {
    "id": "sign-skull-2x2",
    "filePath": "assets2/sign-skull-2x2.png"
  },
  {
    "id": "sign-stop-2x2",
    "filePath": "assets2/sign-stop-2x2.png"
  },
  {
    "id": "sign-toxic-2x2",
    "filePath": "assets2/sign-toxic-2x2.png"
  },
  {
    "id": "sign-warning-2x2",
    "filePath": "assets2/sign-warning-2x2.png"
  },
  {
    "id": "sign-wifi-2x2",
    "filePath": "assets2/sign-wifi-2x2.png"
  },
  {
    "id": "sign-biohazard-3x3",
    "filePath": "assets2/sign-biohazard-3x3.png"
  },
  {
    "id": "sign-cold-3x3",
    "filePath": "assets2/sign-cold-3x3.png"
  },
  {
    "id": "sign-electric-3x3",
    "filePath": "assets2/sign-electric-3x3.png"
  },
  {
    "id": "sign-exit-3x3",
    "filePath": "assets2/sign-exit-3x3.png"
  },
  {
    "id": "sign-fire-3x3",
    "filePath": "assets2/sign-fire-3x3.png"
  },
  {
    "id": "sign-first-aid-3x3",
    "filePath": "assets2/sign-first-aid-3x3.png"
  },
  {
    "id": "sign-flammable-3x3",
    "filePath": "assets2/sign-flammable-3x3.png"
  },
  {
    "id": "sign-go-3x3",
    "filePath": "assets2/sign-go-3x3.png"
  },
  {
    "id": "sign-info-3x3",
    "filePath": "assets2/sign-info-3x3.png"
  },
  {
    "id": "sign-laser-3x3",
    "filePath": "assets2/sign-laser-3x3.png"
  },
  {
    "id": "sign-lock-3x3",
    "filePath": "assets2/sign-lock-3x3.png"
  },
  {
    "id": "sign-magnetic-3x3",
    "filePath": "assets2/sign-magnetic-3x3.png"
  },
  {
    "id": "sign-no-entry-3x3",
    "filePath": "assets2/sign-no-entry-3x3.png"
  },
  {
    "id": "sign-radiation-3x3",
    "filePath": "assets2/sign-radiation-3x3.png"
  },
  {
    "id": "sign-recycle-3x3",
    "filePath": "assets2/sign-recycle-3x3.png"
  },
  {
    "id": "sign-skull-3x3",
    "filePath": "assets2/sign-skull-3x3.png"
  },
  {
    "id": "sign-stop-3x3",
    "filePath": "assets2/sign-stop-3x3.png"
  },
  {
    "id": "sign-toxic-3x3",
    "filePath": "assets2/sign-toxic-3x3.png"
  },
  {
    "id": "sign-warning-3x3",
    "filePath": "assets2/sign-warning-3x3.png"
  },
  {
    "id": "sign-wifi-3x3",
    "filePath": "assets2/sign-wifi-3x3.png"
  },
  {
    "id": "space-antenna-1x2",
    "filePath": "assets/space-antenna-1x2.png"
  },
  {
    "id": "space-antenna-2x3",
    "filePath": "assets/space-antenna-2x3.png"
  },
  {
    "id": "space-boom-1x3",
    "filePath": "assets/space-boom-1x3.png"
  },
  {
    "id": "space-cargo-3x1",
    "filePath": "assets/space-cargo-3x1.png"
  },
  {
    "id": "space-dock-bay-4x2",
    "filePath": "assets/space-dock-bay-4x2.png"
  },
  {
    "id": "space-dock-clamp-3x2",
    "filePath": "assets/space-dock-clamp-3x2.png"
  },
  {
    "id": "space-fuel-1x2",
    "filePath": "assets/space-fuel-1x2.png"
  },
  {
    "id": "space-habitat-3x2",
    "filePath": "assets/space-habitat-3x2.png"
  },
  {
    "id": "space-habitat-4x2",
    "filePath": "assets/space-habitat-4x2.png"
  },
  {
    "id": "space-pedestal-1x2",
    "filePath": "assets/space-pedestal-1x2.png"
  },
  {
    "id": "space-radiator-2x1",
    "filePath": "assets/space-radiator-2x1.png"
  },
  {
    "id": "space-radiator-3x1",
    "filePath": "assets/space-radiator-3x1.png"
  },
  {
    "id": "space-rcs-2x1",
    "filePath": "assets/space-rcs-2x1.png"
  },
  {
    "id": "space-solar-3x1",
    "filePath": "assets/space-solar-3x1.png"
  },
  {
    "id": "space-thruster-1x2",
    "filePath": "assets/space-thruster-1x2.png"
  },
  {
    "id": "space-thruster-2x1",
    "filePath": "assets/space-thruster-2x1.png"
  },
  {
    "id": "space-navlight-1x1",
    "filePath": "assets/space-navlight-1x1.png"
  },
  {
    "id": "space-navlight-g-1x1",
    "filePath": "assets/space-navlight-g-1x1.png"
  },
  {
    "id": "space-probe-1x1",
    "filePath": "assets/space-probe-1x1.png"
  },
  {
    "id": "space-rcs-1x1",
    "filePath": "assets/space-rcs-1x1.png"
  },
  {
    "id": "space-airlock-2x2",
    "filePath": "assets/space-airlock-2x2.png"
  },
  {
    "id": "space-antenna-2x2",
    "filePath": "assets/space-antenna-2x2.png"
  },
  {
    "id": "space-cargo-2x2",
    "filePath": "assets/space-cargo-2x2.png"
  },
  {
    "id": "space-dish-2x2",
    "filePath": "assets/space-dish-2x2.png"
  },
  {
    "id": "space-dock-clamp-2x2",
    "filePath": "assets/space-dock-clamp-2x2.png"
  },
  {
    "id": "space-dome-2x2",
    "filePath": "assets/space-dome-2x2.png"
  },
  {
    "id": "space-fuel-2x2",
    "filePath": "assets/space-fuel-2x2.png"
  },
  {
    "id": "space-habitat-2x2",
    "filePath": "assets/space-habitat-2x2.png"
  },
  {
    "id": "space-sat-2x2",
    "filePath": "assets/space-sat-2x2.png"
  },
  {
    "id": "space-solar-2x2",
    "filePath": "assets/space-solar-2x2.png"
  },
  {
    "id": "space-starfield-2x2",
    "filePath": "assets/space-starfield-2x2.png"
  },
  {
    "id": "space-thruster-2x2",
    "filePath": "assets/space-thruster-2x2.png"
  },
  {
    "id": "probs-airlock-3x3",
    "filePath": "assets/probs-airlock-3x3.png"
  },
  {
    "id": "space-airlock-3x3",
    "filePath": "assets/space-airlock-3x3.png"
  },
  {
    "id": "space-antenna-array-3x3",
    "filePath": "assets/space-antenna-array-3x3.png"
  },
  {
    "id": "space-dish-3x3",
    "filePath": "assets/space-dish-3x3.png"
  },
  {
    "id": "space-dome-3x3",
    "filePath": "assets/space-dome-3x3.png"
  },
  {
    "id": "space-sat-3x3",
    "filePath": "assets/space-sat-3x3.png"
  },
  {
    "id": "space-solar-3x3",
    "filePath": "assets/space-solar-3x3.png"
  },
  {
    "id": "tele-cyan-2x2",
    "filePath": "assets2/tele-cyan-2x2.png"
  },
  {
    "id": "tele-ice-2x2",
    "filePath": "assets2/tele-ice-2x2.png"
  },
  {
    "id": "tele-magma-2x2",
    "filePath": "assets2/tele-magma-2x2.png"
  },
  {
    "id": "tele-mirror-2x2",
    "filePath": "assets2/tele-mirror-2x2.png"
  },
  {
    "id": "tele-sand-2x2",
    "filePath": "assets2/tele-sand-2x2.png"
  },
  {
    "id": "tele-spore-2x2",
    "filePath": "assets2/tele-spore-2x2.png"
  },
  {
    "id": "tele-temple-2x2",
    "filePath": "assets2/tele-temple-2x2.png"
  },
  {
    "id": "tele-void-2x2",
    "filePath": "assets2/tele-void-2x2.png"
  },
  {
    "id": "tele-cyan-3x3",
    "filePath": "assets2/tele-cyan-3x3.png"
  },
  {
    "id": "tele-ice-3x3",
    "filePath": "assets2/tele-ice-3x3.png"
  },
  {
    "id": "tele-magma-3x3",
    "filePath": "assets2/tele-magma-3x3.png"
  },
  {
    "id": "tele-mirror-3x3",
    "filePath": "assets2/tele-mirror-3x3.png"
  },
  {
    "id": "tele-sand-3x3",
    "filePath": "assets2/tele-sand-3x3.png"
  },
  {
    "id": "tele-spore-3x3",
    "filePath": "assets2/tele-spore-3x3.png"
  },
  {
    "id": "tele-temple-3x3",
    "filePath": "assets2/tele-temple-3x3.png"
  },
  {
    "id": "tele-void-3x3",
    "filePath": "assets2/tele-void-3x3.png"
  },
  {
    "id": "totem-bio-1x2",
    "filePath": "assets2/totem-bio-1x2.png"
  },
  {
    "id": "totem-bio-1x3",
    "filePath": "assets2/totem-bio-1x3.png"
  },
  {
    "id": "totem-bot-1x2",
    "filePath": "assets2/totem-bot-1x2.png"
  },
  {
    "id": "totem-bot-1x3",
    "filePath": "assets2/totem-bot-1x3.png"
  },
  {
    "id": "totem-eye-1x2",
    "filePath": "assets2/totem-eye-1x2.png"
  },
  {
    "id": "totem-eye-1x3",
    "filePath": "assets2/totem-eye-1x3.png"
  },
  {
    "id": "totem-gold-1x2",
    "filePath": "assets2/totem-gold-1x2.png"
  },
  {
    "id": "totem-gold-1x3",
    "filePath": "assets2/totem-gold-1x3.png"
  },
  {
    "id": "totem-ice-1x2",
    "filePath": "assets2/totem-ice-1x2.png"
  },
  {
    "id": "totem-ice-1x3",
    "filePath": "assets2/totem-ice-1x3.png"
  },
  {
    "id": "totem-sand-1x2",
    "filePath": "assets2/totem-sand-1x2.png"
  },
  {
    "id": "totem-sand-1x3",
    "filePath": "assets2/totem-sand-1x3.png"
  },
  {
    "id": "totem-skull-1x2",
    "filePath": "assets2/totem-skull-1x2.png"
  },
  {
    "id": "totem-skull-1x3",
    "filePath": "assets2/totem-skull-1x3.png"
  },
  {
    "id": "totem-void-1x2",
    "filePath": "assets2/totem-void-1x2.png"
  },
  {
    "id": "totem-void-1x3",
    "filePath": "assets2/totem-void-1x3.png"
  },
  {
    "id": "vert-aquarium-1x2",
    "filePath": "assets2/vert-aquarium-1x2.png"
  },
  {
    "id": "vert-aquarium-1x3",
    "filePath": "assets2/vert-aquarium-1x3.png"
  },
  {
    "id": "vert-aquarium-1x4",
    "filePath": "assets2/vert-aquarium-1x4.png"
  },
  {
    "id": "vert-barrels-1x2",
    "filePath": "assets2/vert-barrels-1x2.png"
  },
  {
    "id": "vert-barrels-1x3",
    "filePath": "assets2/vert-barrels-1x3.png"
  },
  {
    "id": "vert-barrels-1x4",
    "filePath": "assets2/vert-barrels-1x4.png"
  },
  {
    "id": "vert-bookshelf-1x2",
    "filePath": "assets2/vert-bookshelf-1x2.png"
  },
  {
    "id": "vert-bookshelf-1x3",
    "filePath": "assets2/vert-bookshelf-1x3.png"
  },
  {
    "id": "vert-bookshelf-1x4",
    "filePath": "assets2/vert-bookshelf-1x4.png"
  },
  {
    "id": "vert-cabinet-1x2",
    "filePath": "assets2/vert-cabinet-1x2.png"
  },
  {
    "id": "vert-cabinet-1x3",
    "filePath": "assets2/vert-cabinet-1x3.png"
  },
  {
    "id": "vert-cabinet-1x4",
    "filePath": "assets2/vert-cabinet-1x4.png"
  },
  {
    "id": "vert-clock-1x2",
    "filePath": "assets2/vert-clock-1x2.png"
  },
  {
    "id": "vert-clock-1x3",
    "filePath": "assets2/vert-clock-1x3.png"
  },
  {
    "id": "vert-clock-1x4",
    "filePath": "assets2/vert-clock-1x4.png"
  },
  {
    "id": "vert-coat-rack-1x2",
    "filePath": "assets2/vert-coat-rack-1x2.png"
  },
  {
    "id": "vert-coat-rack-1x3",
    "filePath": "assets2/vert-coat-rack-1x3.png"
  },
  {
    "id": "vert-coat-rack-1x4",
    "filePath": "assets2/vert-coat-rack-1x4.png"
  },
  {
    "id": "vert-crates-1x2",
    "filePath": "assets2/vert-crates-1x2.png"
  },
  {
    "id": "vert-crates-1x3",
    "filePath": "assets2/vert-crates-1x3.png"
  },
  {
    "id": "vert-crates-1x4",
    "filePath": "assets2/vert-crates-1x4.png"
  },
  {
    "id": "vert-data-pillar-1x2",
    "filePath": "assets2/vert-data-pillar-1x2.png"
  },
  {
    "id": "vert-data-pillar-1x3",
    "filePath": "assets2/vert-data-pillar-1x3.png"
  },
  {
    "id": "vert-data-pillar-1x4",
    "filePath": "assets2/vert-data-pillar-1x4.png"
  },
  {
    "id": "vert-flagpole-1x2",
    "filePath": "assets2/vert-flagpole-1x2.png"
  },
  {
    "id": "vert-flagpole-1x3",
    "filePath": "assets2/vert-flagpole-1x3.png"
  },
  {
    "id": "vert-flagpole-1x4",
    "filePath": "assets2/vert-flagpole-1x4.png"
  },
  {
    "id": "vert-fountain-1x2",
    "filePath": "assets2/vert-fountain-1x2.png"
  },
  {
    "id": "vert-fountain-1x3",
    "filePath": "assets2/vert-fountain-1x3.png"
  },
  {
    "id": "vert-fountain-1x4",
    "filePath": "assets2/vert-fountain-1x4.png"
  },
  {
    "id": "vert-fridge-1x2",
    "filePath": "assets2/vert-fridge-1x2.png"
  },
  {
    "id": "vert-fridge-1x3",
    "filePath": "assets2/vert-fridge-1x3.png"
  },
  {
    "id": "vert-fridge-1x4",
    "filePath": "assets2/vert-fridge-1x4.png"
  },
  {
    "id": "vert-gene-vault-1x2",
    "filePath": "assets2/vert-gene-vault-1x2.png"
  },
  {
    "id": "vert-gene-vault-1x3",
    "filePath": "assets2/vert-gene-vault-1x3.png"
  },
  {
    "id": "vert-gene-vault-1x4",
    "filePath": "assets2/vert-gene-vault-1x4.png"
  },
  {
    "id": "vert-incubator-1x2",
    "filePath": "assets2/vert-incubator-1x2.png"
  },
  {
    "id": "vert-incubator-1x3",
    "filePath": "assets2/vert-incubator-1x3.png"
  },
  {
    "id": "vert-incubator-1x4",
    "filePath": "assets2/vert-incubator-1x4.png"
  },
  {
    "id": "vert-ladder-1x2",
    "filePath": "assets2/vert-ladder-1x2.png"
  },
  {
    "id": "vert-ladder-1x3",
    "filePath": "assets2/vert-ladder-1x3.png"
  },
  {
    "id": "vert-ladder-1x4",
    "filePath": "assets2/vert-ladder-1x4.png"
  },
  {
    "id": "vert-lamp-1x2",
    "filePath": "assets2/vert-lamp-1x2.png"
  },
  {
    "id": "vert-lamp-1x3",
    "filePath": "assets2/vert-lamp-1x3.png"
  },
  {
    "id": "vert-lamp-1x4",
    "filePath": "assets2/vert-lamp-1x4.png"
  },
  {
    "id": "vert-locker-1x2",
    "filePath": "assets2/vert-locker-1x2.png"
  },
  {
    "id": "vert-locker-1x3",
    "filePath": "assets2/vert-locker-1x3.png"
  },
  {
    "id": "vert-locker-1x4",
    "filePath": "assets2/vert-locker-1x4.png"
  },
  {
    "id": "vert-locker-red-1x2",
    "filePath": "assets2/vert-locker-red-1x2.png"
  },
  {
    "id": "vert-locker-red-1x3",
    "filePath": "assets2/vert-locker-red-1x3.png"
  },
  {
    "id": "vert-locker-red-1x4",
    "filePath": "assets2/vert-locker-red-1x4.png"
  },
  {
    "id": "vert-pipe-1x2",
    "filePath": "assets2/vert-pipe-1x2.png"
  },
  {
    "id": "vert-pipe-1x3",
    "filePath": "assets2/vert-pipe-1x3.png"
  },
  {
    "id": "vert-pipe-1x4",
    "filePath": "assets2/vert-pipe-1x4.png"
  },
  {
    "id": "vert-plant-1x2",
    "filePath": "assets2/vert-plant-1x2.png"
  },
  {
    "id": "vert-plant-1x3",
    "filePath": "assets2/vert-plant-1x3.png"
  },
  {
    "id": "vert-plant-1x4",
    "filePath": "assets2/vert-plant-1x4.png"
  },
  {
    "id": "vert-robot-1x2",
    "filePath": "assets2/vert-robot-1x2.png"
  },
  {
    "id": "vert-robot-1x3",
    "filePath": "assets2/vert-robot-1x3.png"
  },
  {
    "id": "vert-robot-1x4",
    "filePath": "assets2/vert-robot-1x4.png"
  },
  {
    "id": "vert-safe-1x2",
    "filePath": "assets2/vert-safe-1x2.png"
  },
  {
    "id": "vert-safe-1x3",
    "filePath": "assets2/vert-safe-1x3.png"
  },
  {
    "id": "vert-safe-1x4",
    "filePath": "assets2/vert-safe-1x4.png"
  },
  {
    "id": "vert-server-1x2",
    "filePath": "assets2/vert-server-1x2.png"
  },
  {
    "id": "vert-server-1x3",
    "filePath": "assets2/vert-server-1x3.png"
  },
  {
    "id": "vert-server-1x4",
    "filePath": "assets2/vert-server-1x4.png"
  },
  {
    "id": "vert-speaker-1x2",
    "filePath": "assets2/vert-speaker-1x2.png"
  },
  {
    "id": "vert-speaker-1x3",
    "filePath": "assets2/vert-speaker-1x3.png"
  },
  {
    "id": "vert-speaker-1x4",
    "filePath": "assets2/vert-speaker-1x4.png"
  },
  {
    "id": "vert-spore-tower-1x2",
    "filePath": "assets2/vert-spore-tower-1x2.png"
  },
  {
    "id": "vert-spore-tower-1x3",
    "filePath": "assets2/vert-spore-tower-1x3.png"
  },
  {
    "id": "vert-spore-tower-1x4",
    "filePath": "assets2/vert-spore-tower-1x4.png"
  },
  {
    "id": "vert-statue-1x2",
    "filePath": "assets2/vert-statue-1x2.png"
  },
  {
    "id": "vert-statue-1x3",
    "filePath": "assets2/vert-statue-1x3.png"
  },
  {
    "id": "vert-statue-1x4",
    "filePath": "assets2/vert-statue-1x4.png"
  },
  {
    "id": "vert-tank-1x2",
    "filePath": "assets2/vert-tank-1x2.png"
  },
  {
    "id": "vert-tank-1x3",
    "filePath": "assets2/vert-tank-1x3.png"
  },
  {
    "id": "vert-tank-1x4",
    "filePath": "assets2/vert-tank-1x4.png"
  },
  {
    "id": "vert-telescope-1x2",
    "filePath": "assets2/vert-telescope-1x2.png"
  },
  {
    "id": "vert-telescope-1x3",
    "filePath": "assets2/vert-telescope-1x3.png"
  },
  {
    "id": "vert-telescope-1x4",
    "filePath": "assets2/vert-telescope-1x4.png"
  },
  {
    "id": "vert-toolbox-1x2",
    "filePath": "assets2/vert-toolbox-1x2.png"
  },
  {
    "id": "vert-toolbox-1x3",
    "filePath": "assets2/vert-toolbox-1x3.png"
  },
  {
    "id": "vert-toolbox-1x4",
    "filePath": "assets2/vert-toolbox-1x4.png"
  },
  {
    "id": "vert-umbrella-1x2",
    "filePath": "assets2/vert-umbrella-1x2.png"
  },
  {
    "id": "vert-umbrella-1x3",
    "filePath": "assets2/vert-umbrella-1x3.png"
  },
  {
    "id": "tile-floor-bronze-1x1",
    "filePath": "assets/tile-floor-bronze-1x1.png"
  },
  {
    "id": "tile-floor-check-1x1",
    "filePath": "assets/tile-floor-check-1x1.png"
  },
  {
    "id": "tile-floor-dirt-1x1",
    "filePath": "assets/tile-floor-dirt-1x1.png"
  },
  {
    "id": "tile-floor-dots-1x1",
    "filePath": "assets/tile-floor-dots-1x1.png"
  },
  {
    "id": "tile-floor-grass-1x1",
    "filePath": "assets/tile-floor-grass-1x1.png"
  },
  {
    "id": "tile-floor-lines-1x1",
    "filePath": "assets/tile-floor-lines-1x1.png"
  },
  {
    "id": "tile-floor-plate-1x1",
    "filePath": "assets/tile-floor-plate-1x1.png"
  },
  {
    "id": "tile-floor-tech-1x1",
    "filePath": "assets/tile-floor-tech-1x1.png"
  },
  {
    "id": "tile-grating-1x1",
    "filePath": "assets/tile-grating-1x1.png"
  },
  {
    "id": "tile-grating-heavy-1x1",
    "filePath": "assets/tile-grating-heavy-1x1.png"
  },
  {
    "id": "tile-grating-vent-1x1",
    "filePath": "assets/tile-grating-vent-1x1.png"
  },
  {
    "id": "tile-wall-bronze-1x1",
    "filePath": "assets/tile-wall-bronze-1x1.png"
  },
  {
    "id": "tile-wall-bronze-tile-1x1",
    "filePath": "assets/tile-wall-bronze-tile-1x1.png"
  },
  {
    "id": "tile-wall-check-1x1",
    "filePath": "assets/tile-wall-check-1x1.png"
  },
  {
    "id": "tile-wall-console-1x1",
    "filePath": "assets/tile-wall-console-1x1.png"
  },
  {
    "id": "tile-wall-dots-1x1",
    "filePath": "assets/tile-wall-dots-1x1.png"
  },
  {
    "id": "tile-wall-glass-1x1",
    "filePath": "assets/tile-wall-glass-1x1.png"
  },
  {
    "id": "tile-wall-light-1x1",
    "filePath": "assets/tile-wall-light-1x1.png"
  },
  {
    "id": "tile-wall-lines-1x1",
    "filePath": "assets/tile-wall-lines-1x1.png"
  },
  {
    "id": "tile-wall-panel-1x1",
    "filePath": "assets/tile-wall-panel-1x1.png"
  },
  {
    "id": "tile-wall-plate-1x1",
    "filePath": "assets/tile-wall-plate-1x1.png"
  },
  {
    "id": "tile-wall-siding-1x1",
    "filePath": "assets/tile-wall-siding-1x1.png"
  },
  {
    "id": "tile-wall-steel-1x1",
    "filePath": "assets/tile-wall-steel-1x1.png"
  },
  {
    "id": "tile-wall-stripe-1x1",
    "filePath": "assets/tile-wall-stripe-1x1.png"
  },
  {
    "id": "tile-wall-tech-1x1",
    "filePath": "assets/tile-wall-tech-1x1.png"
  },
  {
    "id": "tile-wall-vent-1x1",
    "filePath": "assets/tile-wall-vent-1x1.png"
  },
  {
    "id": "tile-wall-warning-1x1",
    "filePath": "assets/tile-wall-warning-1x1.png"
  },
  {
    "id": "tile-wall-window-1x1",
    "filePath": "assets/tile-wall-window-1x1.png"
  },
  {
    "id": "wide-bay-4x2",
    "filePath": "assets/wide-bay-4x2.png"
  },
  {
    "id": "wide-beam-3x1",
    "filePath": "assets/wide-beam-3x1.png"
  },
  {
    "id": "wide-beam-4x1",
    "filePath": "assets/wide-beam-4x1.png"
  },
  {
    "id": "wide-billboard-3x1",
    "filePath": "assets/wide-billboard-3x1.png"
  },
  {
    "id": "wide-billboard-4x2",
    "filePath": "assets/wide-billboard-4x2.png"
  },
  {
    "id": "wide-bridge-4x1",
    "filePath": "assets/wide-bridge-4x1.png"
  },
  {
    "id": "wide-cable-3x1",
    "filePath": "assets/wide-cable-3x1.png"
  },
  {
    "id": "wide-console-3x1",
    "filePath": "assets/wide-console-3x1.png"
  },
  {
    "id": "wide-console-4x2",
    "filePath": "assets/wide-console-4x2.png"
  },
  {
    "id": "wide-console-alt-3x1",
    "filePath": "assets/wide-console-alt-3x1.png"
  },
  {
    "id": "wide-duct-3x1",
    "filePath": "assets/wide-duct-3x1.png"
  },
  {
    "id": "wide-gauges-3x2",
    "filePath": "assets/wide-gauges-3x2.png"
  },
  {
    "id": "wide-keys-3x1",
    "filePath": "assets/wide-keys-3x1.png"
  },
  {
    "id": "wide-ladder-1x3",
    "filePath": "assets/wide-ladder-1x3.png"
  },
  {
    "id": "wide-level-bar-3x1",
    "filePath": "assets/wide-level-bar-3x1.png"
  },
  {
    "id": "wide-level-tank-2x1",
    "filePath": "assets/wide-level-tank-2x1.png"
  },
  {
    "id": "wide-level-vert-1x2",
    "filePath": "assets/wide-level-vert-1x2.png"
  },
  {
    "id": "wide-manifold-3x2",
    "filePath": "assets/wide-manifold-3x2.png"
  },
  {
    "id": "wide-monitor-bank-4x2",
    "filePath": "assets/wide-monitor-bank-4x2.png"
  },
  {
    "id": "wide-pipe-3x1",
    "filePath": "assets/wide-pipe-3x1.png"
  },
  {
    "id": "wide-pipe-4x1",
    "filePath": "assets/wide-pipe-4x1.png"
  },
  {
    "id": "wide-pipe-coolant-3x1",
    "filePath": "assets/wide-pipe-coolant-3x1.png"
  },
  {
    "id": "wide-rail-3x1",
    "filePath": "assets/wide-rail-3x1.png"
  },
  {
    "id": "wide-reactor-strip-4x2",
    "filePath": "assets/wide-reactor-strip-4x2.png"
  },
  {
    "id": "wide-shelf-3x1",
    "filePath": "assets/wide-shelf-3x1.png"
  },
  {
    "id": "wide-sign-2x1",
    "filePath": "assets/wide-sign-2x1.png"
  },
  {
    "id": "wide-sign-danger-3x1",
    "filePath": "assets/wide-sign-danger-3x1.png"
  },
  {
    "id": "wide-sign-ok-2x1",
    "filePath": "assets/wide-sign-ok-2x1.png"
  },
  {
    "id": "wide-status-3x1",
    "filePath": "assets/wide-status-3x1.png"
  },
  {
    "id": "wide-valve-1x2",
    "filePath": "assets/wide-valve-1x2.png"
  },
  {
    "id": "wide-valve-2x1",
    "filePath": "assets/wide-valve-2x1.png"
  },
  {
    "id": "wide-warning-2x1",
    "filePath": "assets/wide-warning-2x1.png"
  },
  {
    "id": "wide-warning-3x1",
    "filePath": "assets/wide-warning-3x1.png"
  },
  {
    "id": "wide-level-vert-1x1",
    "filePath": "assets/wide-level-vert-1x1.png"
  },
  {
    "id": "wide-valve-1x1",
    "filePath": "assets/wide-valve-1x1.png"
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
