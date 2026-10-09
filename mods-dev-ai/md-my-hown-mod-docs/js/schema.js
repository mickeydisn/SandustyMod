/** Exhaustive schema — fields + actions with params (from handler-registry) */
window.MD_SCHEMA = (function () {
  const ROLE_COLOR = { sense:"#6b9eff", decide:"#c084fc", act:"#f87171", remember:"#34d399", feel:"#fbbf24", connect:"#2dd4bf", logic:"#fb923c", block:"#e879f9" };
  const ROLE_LABELS = { sense:"Sense", decide:"Decide", act:"Act", remember:"Remember", feel:"Feel", connect:"Connect", logic:"Logic", block:"Block" };
  const SLOTS = ["signal","trigger","processing","upgrade","modifier","itemAction"];
  const MATTER = ["Solid","Liquid","Particle","Gas","Static","Slushy","Wisp","Powder"];
  const CATEGORIES = ["blocks","logistics","production","economy","logic","fluids","lighting","special","misc","thermal"];
  const RECIPE_KINDS = ["grower","planterBox","shaker","kineticPress","condenser","steamDryer","synthesizer","snowmaker","smelter","structure"];
  const BUILD_MODES = ["single","singleDirectional","line","launcherRectUp","launcherRectSide","rectangle","rectangleDirectional"];
  const MENU_GROUPS = [
    { key:"memory", label:"Memory", hint:"Shared process values",
      doc:"Buffers store named values every process in this mod can read and write. Use them as shared state between signals, processing, and items — not world content the player sees.",
      items:[
        {key:"buffers", label:"Buffer", color:"#8fbc8f",
          doc:"A path-keyed store (bool or string). Processes use bufferRead / bufferWrite / bufferIncrement. Declare paths here so Program steps can pick them as ⌗buffer tags."},
      ]},
    { key:"elements", label:"Elements", hint:"World matter & reactions",
      doc:"Matter the simulation moves and transforms: terrains (solid cells), elements (sand, fluids, gases), and the rules that change them (behaviours, contact reactions, machine recipes).",
      items:[
        {key:"terrains", label:"Terrains", color:"#a08060",
          doc:"Static or diggable ground cells. HP, colours, excavation drops, and flags (fog, flammable, building). Distinct from elements: terrains sit under the particle simulation."},
        {key:"elements", label:"Elements", color:"#6b9eff",
          doc:"Simulated matter types (solid, liquid, gas, particle…). Density, colour, duration, flammability, and interactions. IDs become ⌗element tags in programs."},
        {key:"structureBehaviors", label:"Behaviours", color:"#60b0a0", nest:1,
          doc:"Behaviour definitions attached under elements/structures in the mod panel. Describe custom per-tick or event behaviour hooks linked to content."},
        {key:"contacts", label:"Contact reactions", color:"#e8b84a", nest:1,
          doc:"When two element types touch, produce outputs or side effects. Pair element A/B with result rules — the contact reaction graph of the world."},
        {key:"recipes", label:"Machine recipes", color:"#e07a5f", nest:1,
          doc:"Inputs → outputs for processing structures (growers, presses, converters). Kind selects the machine family; link to a structure via process or recipe id."},
      ]},
    { key:"structures", label:"Structures", hint:"Buildings & process links",
      doc:"Placeable buildings: footprint, unlock, render, and the programs that run when they process or receive signals. ProcessorLink ties a structure type to a processing pipeline.",
      items:[
        {key:"structures", label:"Structures", color:"#5ec4a0",
          doc:"Building definitions: id, shape, category, unlock node, render, default data. The id is the ⌗structure content tag used by build/query actions."},
        {key:"placementConfigs", label:"Placement fields", color:"#70a090", nest:1,
          doc:"Hotbar / placement UI fields for structures (widgets under Structures in the game panel). Not peer content — they qualify how a structure is placed."},
        {key:"signals", label:"Signals", color:"#f5b880", nest:1,
          doc:"Signal wiring for structures: targets, modes, and how outputs connect. Used with Interact:PROG (scope signal)."},
        {key:"programV2", label:"Interact:PROG", color:"#ffe700", nest:1, defaultScope:"signal", menuId:"prog-signal",
          doc:"Program v2 steps that call mysandkit.api.* when the structure’s signal / interact path runs. Scope is fixed to signal for this list."},
        {key:"processing", label:"ProcessorLink", color:"#d64550",
          doc:"Links a structure type to a processing pipeline (grower, shaker, kinetic press, custom). Points at processing definitions and Program v2 processing scope."},
        {key:"programV2", label:"Processing:PROG", color:"#fbbf24", nest:1, defaultScope:"processing", menuId:"prog-processing",
          doc:"Program v2 for the processing tick of a structure. Scope processing — drag mysandkit api calls that run each process cycle."},
      ]},
    { key:"action", label:"Action", hint:"Items & input",
      doc:"Player tools and input: items (weapons, tools), excavation and projectile data, key bindings, and programs that fire on trigger input.",
      items:[
        {key:"items", label:"Items", color:"#b794f4",
          doc:"Holdable items: sprite, cooldown, category, optional handler / process id. Unlocked via tech or inventory grants."},
        {key:"excavationProfiles", label:"Excavation profiles", color:"#90b0a0", nest:1,
          doc:"How an item digs: radius, filters, strength. Referenced by items and by itemExcavate / grid.excavate helpers."},
        {key:"projectiles", label:"Projectiles", color:"#b0a0e0", nest:1,
          doc:"Projectile blueprints for shooting items: speed, gravity, impact. Used by itemShoot / projectiles.spawnAtWorld."},
        {key:"inputBindings", label:"Input bindings", color:"#c97a5c",
          doc:"Map keys / buttons to actions or programs. Pair with Processing:PROG (trigger scope) for input-driven logic."},
        {key:"programV2", label:"Processing:PROG", color:"#ffe700", nest:1, defaultScope:"trigger", menuId:"prog-trigger",
          doc:"Program v2 with scope trigger — runs from input bindings / trigger call sites. Same store as other Program v2 entries, filtered by scope."},
      ]},
    { key:"tech", label:"Tech", hint:"Research & upgrades",
      doc:"Research tree and item upgrades: tech nodes unlock content; upgrade categories group per-item upgrade tracks.",
      items:[
        {key:"techs", label:"Tech nodes", color:"#5b8def",
          doc:"Research definitions: cost, prerequisites, unlocks (structures, items, recipes). Register via tech API."},
        {key:"unlockNodes", label:"Unlock nodes", color:"#7aa2f7", nest:1,
          doc:"Unlock node ids referenced by structures (unlockNode field) and tech unlock lists. The gate between research and build menu."},
        {key:"upgradeCategories", label:"Upgrade categories", color:"#a78b9a",
          doc:"Groups of upgrades under an item (e.g. damage, capacity). Categories organise the upgrade UI."},
        {key:"upgrades", label:"Upgrades", color:"#c084fc", nest:1,
          doc:"Single upgrade levels: item id, upgrade id, effects. setLevelById / Program v2 upgrades.* can change levels at runtime."},
      ]},
    { key:"actions", label:"Actions", hint:"Triggers, hooks & programs",
      doc:"Time-based triggers, engine hook modifiers, and legacy HandlerAction programs (role-based catalogue). Prefer Program v2 (mysandkit) for new work.",
      items:[
        {key:"triggers", label:"Triggers", color:"#f0a070",
          doc:"Clock / interval triggers that start a process on a schedule or event. Scope often pairs with Program entries."},
        {key:"modifiers", label:"Hook modifiers", color:"#e89870",
          doc:"Intercept or modify engine hooks (kind intercept/modify). Advanced; enable carefully."},
        {key:"processes", label:"Program", color:"#fbbf24",
          doc:"Legacy HandlerAction programs: sense/decide/act steps from the mod’s action registry. Scope selects the call site (signal, processing, itemAction, …)."},
      ]},
    { key:"energy", label:"Energy", hint:"Power",
      doc:"Power networks and energy type definitions for structures that consume or produce energy.",
      items:[
        {key:"energyNetworks", label:"Networks", color:"#2dd4bf",
          doc:"Named energy networks structures can join. Conductors and consumers reference these ids."},
        {key:"energyTypes", label:"Energy types", color:"#14b8a6",
          doc:"Kinds of energy (units, colours, behaviour). Used when adding/consuming energy at cells."},
      ]},
    { key:"sprites", label:"Sprites", hint:"Assets",
      doc:"Image assets loaded for structures, items, and UI. Register paths and ids used by render configs.",
      items:[
        {key:"sprites", label:"Sprites", color:"#7ec8e3",
          doc:"Sprite entries: id, path, load options. Referenced from structure render and item sprite fields."},
      ]},
  ];

  const COLLECTIONS = (() => {
    const seen = new Set();
    const out = [];
    MENU_GROUPS.forEach((g) => {
      g.items.forEach((i) => {
        if (seen.has(i.key)) return;
        seen.add(i.key);
        out.push(i);
      });
    });
    return out;
  })();
  const FIELDS = {
    elements: [["id","ID","text",{required:true}],["name","Name","text",{}],["nameKey","Name key","text",{}],["description","Description","text",{}],["descriptionKey","Description key","text",{}],["matterType","Matter type","select",{options:MATTER}],["density","Density","number",{}],["metaColor","Meta color","text",{hint:"0xRRGGBB"}],["materialId","Material id","number",{}],["duration","Duration (s)","number",{}],["flammable","Flammable","bool",{}],["isGrabbable","Grabbable","bool",{}],["isTransportable","Transportable","bool",{}],["hidden","Hidden","bool",{}],["visibleInPicker","Visible in picker","bool",{}],["colors","Colors (JSON)","json",{hint:"{ variants: [[r,g,b,a],\u2026] }"}],["durationRandom","Duration random (JSON)","json",{hint:"{min,max}"}],["defaultDataFields","Default data fields (JSON)","json",{}],["interactions","Interactions (JSON)","json",{}]],
    terrains: [["id","ID","text",{required:true}],["name","Name","text",{}],["nameKey","Name key","text",{}],["description","Description","text",{}],["hp","HP","number",{}],["materialId","Material id","number",{}],["metaColor","Meta color","text",{}],["colorHSL","Color HSL (JSON)","json",{}],["colorPattern","Color pattern (JSON)","json",{}],["colorGradient","Color gradient (JSON)","json",{}],["output","Output drop (JSON)","json",{hint:"{elementType, chance}"}],["background","Background (JSON)","json",{}],["backgroundElementType","Background element","text",{}],["fog","Fog","bool",{}],["flammable","Flammable","bool",{}],["noShadow","No shadow","bool",{}],["isBuilding","Is building","bool",{}],["excavationRequirements","Excavation requirements (JSON)","json",{}],["interactions","Interactions (JSON)","json",{}]],
    structures: [["id","ID","text",{required:true}],["name","Name","text",{}],["nameKey","Name key","text",{}],["description","Description","text",{}],["descriptionKey","Description key","text",{}],["categoryKey","Category","select",{options:CATEGORIES}],["order","Order","number",{}],["unlockNode","Unlock node","text",{required:true}],["hideFromBuildMenu","Hide from build menu","bool",{}],["alwaysUnlocked","Always unlocked","bool",{}],["disallowPick","Disallow pick","bool",{}],["maxPlaced","Max placed","number",{}],["blockGridType","Block grid type","text",{}],["shape","Shape matrix (JSON)","json",{hint:"number[][] 1=occupied"}],["buildModes","Build modes (JSON)","json",{hint:"[{type, directions?}]"}],["variants","Variants (JSON)","json",{hint:"[{id, angles}]"}],["render","Render (JSON)","json",{hint:"{imageName, size, offset, ui, spritesheet}"}],["drawKey","Draw key","text",{}],["defaultData","Default data (JSON)","json",{}],["copyData","Copy data","bool",{}],["rejectWhenBlocked","Reject when blocked","bool",{}],["altOriginOffsetY","Alt origin offset Y","number",{}],["tooltipHover","Tooltip hover (JSON)","json",{}],["registerOptions","Register options (JSON)","json",{}]],
    items: [["id","ID","text",{required:true}],["name","Name","text",{}],["nameKey","Name key","text",{}],["description","Description","text",{}],["descriptionKey","Description key","text",{}],["itemType","Item type","select",{options:["Weapon", "Tool", "Consumable", "Mod"]}],["type","Type alias","text",{}],["categoryKey","Category","text",{}],["sprite","Sprite (JSON)","json",{required:true,hint:"{id, type, mount?}"}],["cooldown","Cooldown","number",{}],["handlerKey","Handler / process id","text",{}],["hideFromBuildMenu","Hide from menu","bool",{}]],
    sprites: [["id","ID","text",{required:true}],["path","Path (mod-relative)","text",{}],["source","Source URL","text",{}],["fromMod","From mod","bool",{}],["options","Options (JSON)","json",{}]],
    buffers: [["id","ID","text",{required:true}],["value","Initial value","text",{}],["numberValue","Initial number","number",{}]],
    contacts: [["id","ID","text",{required:true}],["inputA","Input A","text",{required:true}],["inputB","Input B","text",{required:true}],["outputA","Output A","text",{}],["outputB","Output B","text",{}],["orientation","Orientation","text",{}]],
    recipes: [["id","ID","text",{required:true}],["kind","Kind","select",{options:RECIPE_KINDS}],["structureType","Structure type","text",{}],["input","Input element","text",{}],["output","Output element","text",{}],["chance","Chance 0\u20131","number",{}],["outputs","Outputs (JSON)","json",{}],["outputsAbove","Outputs above (JSON)","json",{}],["outputsBelow","Outputs below (JSON)","json",{}],["minimumDownwardVelocity","Min downward velocity","number",{}]],
    processing: [["id","ID","text",{required:true}],["structureType","Structure type","text",{}],["intervalMs","Interval (ms)","number",{}],["processId","Process id","text",{}],["handlerKey","Handler key","text",{}]],
    techs: [["id","ID","text",{required:true}],["name","Name","text",{}],["nameKey","Name key","text",{}],["description","Description","text",{}],["descriptionKey","Description key","text",{}],["cost","Cost (JSON)","json",{}],["requires","Requires (JSON)","json",{}],["unlocks","Unlocks (JSON)","json",{}]],
    unlockNodes: [["id","ID","text",{required:true}],["name","Name","text",{}],["description","Description","text",{}]],
    upgrades: [["id","ID","text",{required:true}],["name","Name","text",{}],["category","Category","text",{}],["maxLevel","Max level","number",{}],["processId","Process id","text",{}],["handlerKey","Handler key","text",{}],["costs","Costs (JSON)","json",{}],["targets","Targets (JSON)","json",{}]],
    upgradeCategories: [["id","ID","text",{required:true}],["name","Name","text",{}],["order","Order","number",{}]],
    triggers: [["id","ID","text",{required:true}],["triggerId","Trigger id","text",{}],["interval","Interval","number",{}],["sequentialRuns","Sequential runs","number",{}],["handlerKey","Handler / process","text",{}],["extra","Extra (JSON)","json",{}]],
    signals: [["id","ID","text",{required:true}],["kind","Kind","select",{options:["targets", "interactables", "senderType"]}],["target","Target","text",{required:true}],["handlerKey","Handler / process","text",{}],["processId","Process id","text",{}]],
    modifiers: [["id","ID","text",{required:true}],["hookId","Hook id","text",{required:true}],["kind","Kind","select",{options:["intercept", "modify"]}],["handlerKey","Handler / process","text",{}],["processId","Process id","text",{}],["enabled","Enabled","bool",{}],["notes","Notes","text",{}],["options","Options (JSON)","json",{}]],
    inputBindings: [["id","ID","text",{required:true}],["displayName","Display name","text",{required:true}],["displayNameKey","Display name key","text",{}],["category","Category","text",{required:true}],["defaultKeys","Default keys (JSON)","json",{hint:"[\"KeyO\"]"}],["onDownKey","On down handler","text",{}],["onUpKey","On up handler","text",{}],["subsection","Subsection (JSON)","json",{}]],
    energyNetworks: [["id","ID","text",{required:true}],["name","Name","text",{}],["description","Description","text",{}]],
    energyTypes: [["id","ID","text",{required:true}],["name","Name","text",{}],["network","Network","text",{}]],
    projectiles: [["id","ID","text",{required:true}],["name","Name","text",{}],["sprite","Sprite","text",{}],["options","Options (JSON)","json",{}]],
    excavationProfiles: [["id","ID","text",{required:true}],["name","Name","text",{}],["options","Options (JSON)","json",{}]],
    structureBehaviors: [["id","ID","text",{required:true}],["structureId","Structure id","text",{}],["behavior","Behavior (JSON)","json",{}]],
    placementConfigs: [["id","ID","text",{required:true}],["structureId","Structure id","text",{required:true}],["fields","Fields (JSON)","json",{required:true,hint:"[{id, kind, \u2026}]"}]],
    processes: [["id","ID","text",{required:true}],["name","Name","text",{}],["scope","Scope (slot)","select",{options:SLOTS,required:true}],["doc","Documentation","text",{}],["derived","Derived","bool",{}],["derivedFrom","Derived from","text",{}]],
    programV2: [["id","ID","text",{required:true}],["name","Name","text",{}],["scope","Scope (slot)","select",{options:SLOTS,required:true}],["doc","Documentation","text",{}]],
  };
  const ACTION_PARAMS = {
  "addVelocity": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "maxSpeed",
      "label": "Max speed",
      "type": "number"
    },
    {
      "key": "ticks",
      "label": "Ticks",
      "type": "number"
    },
    {
      "key": "rearm",
      "label": "Rearm",
      "type": "bool"
    }
  ],
  "bufferIncrement": [
    {
      "key": "path",
      "label": "Buffer path",
      "type": "text"
    },
    {
      "key": "delta",
      "label": "Amount",
      "type": "number"
    }
  ],
  "bufferRead": [
    {
      "key": "path",
      "label": "Buffer path",
      "type": "text"
    },
    {
      "key": "path",
      "label": "Buffer path",
      "type": "text"
    },
    {
      "key": "value",
      "label": "Value",
      "type": "text"
    }
  ],
  "bufferWrite": [
    {
      "key": "path",
      "label": "Buffer path",
      "type": "text"
    },
    {
      "key": "value",
      "label": "Value",
      "type": "text"
    },
    {
      "key": "path",
      "label": "Buffer path",
      "type": "text"
    },
    {
      "key": "delta",
      "label": "Amount",
      "type": "number"
    }
  ],
  "buildStructure": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "preserveUnselectable",
      "label": "Only unselectable",
      "type": "bool"
    }
  ],
  "cell": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "compare": [
    {
      "key": "left",
      "label": "Left",
      "type": "text"
    },
    {
      "key": "op",
      "label": "Test",
      "type": "select"
    },
    {
      "key": "right",
      "label": "Right",
      "type": "number"
    }
  ],
  "countElements": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "countEmpty": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "countStructures": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "key",
      "label": "Key",
      "type": "text"
    }
  ],
  "countTerrain": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "createElement": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "createTerrain": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "skipShadow",
      "label": "Skip shadow",
      "type": "bool"
    }
  ],
  "damageTerrain": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "damage",
      "label": "Damage",
      "type": "number"
    },
    {
      "key": "hitPoints",
      "label": "Hit points",
      "type": "number"
    }
  ],
  "emptyCells": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "energyBank": [
    {
      "key": "capacity",
      "label": "Capacity",
      "type": "number"
    },
    {
      "key": "capacity",
      "label": "Capacity",
      "type": "number"
    },
    {
      "key": "capacity",
      "label": "Capacity",
      "type": "number"
    },
    {
      "key": "energyType",
      "label": "Energy type",
      "type": "text"
    }
  ],
  "energyConductor": [
    {
      "key": "capacity",
      "label": "Capacity",
      "type": "number"
    },
    {
      "key": "energyType",
      "label": "Energy type",
      "type": "text"
    },
    {
      "key": "power",
      "label": "Power",
      "type": "number"
    }
  ],
  "energyConsumePerRun": [
    {
      "key": "energyType",
      "label": "Energy type",
      "type": "text"
    },
    {
      "key": "amountPerRun",
      "label": "Amount per run",
      "type": "number"
    },
    {
      "key": "energyType",
      "label": "Energy type",
      "type": "text"
    },
    {
      "key": "amountPerRun",
      "label": "Amount per run",
      "type": "number"
    }
  ],
  "energyDefault": [
    {
      "key": "capacity",
      "label": "Capacity",
      "type": "number"
    },
    {
      "key": "capacity",
      "label": "Capacity",
      "type": "number"
    },
    {
      "key": "capacity",
      "label": "Capacity",
      "type": "number"
    },
    {
      "key": "capacity",
      "label": "Capacity",
      "type": "number"
    }
  ],
  "energyGenerateWhileHeld": [
    {
      "key": "energyType",
      "label": "Energy type",
      "type": "text"
    },
    {
      "key": "amountPerRun",
      "label": "Amount per run",
      "type": "number"
    }
  ],
  "energyNetwork": [
    {
      "key": "energyType",
      "label": "Energy type",
      "type": "text"
    },
    {
      "key": "power",
      "label": "Power",
      "type": "number"
    }
  ],
  "energyWire": [
    {
      "key": "capacity",
      "label": "Capacity",
      "type": "number"
    },
    {
      "key": "capacity",
      "label": "Capacity",
      "type": "number"
    },
    {
      "key": "energyType",
      "label": "Energy type",
      "type": "text"
    },
    {
      "key": "power",
      "label": "Power",
      "type": "number"
    }
  ],
  "findFreeCell": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "size",
      "label": "Search size",
      "type": "number"
    }
  ],
  "getVelocity": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "size",
      "label": "Search size",
      "type": "number"
    }
  ],
  "hasStructure": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "hasTerrain": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "identity": [],
  "isBlockedByPlayer": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "isElementAtCell": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    }
  ],
  "isLauncher": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "isMyType": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "isStructureEnabled": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "key",
      "label": "Key",
      "type": "text"
    }
  ],
  "isStructureType": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "isTerrainType": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "itemDefault": [
    {
      "key": "power",
      "label": "Power",
      "type": "number"
    }
  ],
  "itemExcavate": [
    {
      "key": "profileId",
      "label": "Excavation profile",
      "type": "text"
    },
    {
      "key": "power",
      "label": "Power",
      "type": "number"
    }
  ],
  "itemShoot": [
    {
      "key": "projectileId",
      "label": "Projectile",
      "type": "text"
    },
    {
      "key": "power",
      "label": "Power",
      "type": "number"
    },
    {
      "key": "speed",
      "label": "Speed",
      "type": "number"
    }
  ],
  "logArgs": [],
  "logBuildingPayload": [],
  "logicAll": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "logicAny": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "logicCount": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "logicForEach": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "to",
      "label": "Write element",
      "type": "select"
    },
    {
      "key": "when",
      "label": "\u2026but only cells holding",
      "type": "select"
    }
  ],
  "logicSum": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "to",
      "label": "Write element",
      "type": "select"
    },
    {
      "key": "when",
      "label": "\u2026but only cells holding",
      "type": "select"
    }
  ],
  "mapSpritesheetValue": [
    {
      "key": "value2",
      "label": "Value",
      "type": "number"
    },
    {
      "key": "thresholds",
      "label": "Thresholds",
      "type": "text"
    }
  ],
  "math": [
    {
      "key": "left",
      "label": "Left",
      "type": "text"
    },
    {
      "key": "op",
      "label": "Operation",
      "type": "select"
    },
    {
      "key": "right",
      "label": "Right",
      "type": "number"
    },
    {
      "key": "left",
      "label": "Left",
      "type": "text"
    },
    {
      "key": "op",
      "label": "Test",
      "type": "select"
    }
  ],
  "noop": [
    {
      "key": "field",
      "label": "Numeric field",
      "type": "text"
    },
    {
      "key": "factor",
      "label": "Factor",
      "type": "number"
    }
  ],
  "particles": [
    {
      "key": "name",
      "label": "Effect",
      "type": "text"
    },
    {
      "key": "count",
      "label": "Count",
      "type": "number"
    }
  ],
  "processorConvert": [
    {
      "key": "to",
      "label": "Output element",
      "type": "text"
    },
    {
      "key": "chance",
      "label": "Chance",
      "type": "number"
    }
  ],
  "processorCount": [],
  "processorLift": [
    {
      "key": "x",
      "label": "Cell x",
      "type": "number"
    },
    {
      "key": "y",
      "label": "Cell y",
      "type": "number"
    },
    {
      "key": "to",
      "label": "Output element",
      "type": "text"
    },
    {
      "key": "chance",
      "label": "Chance",
      "type": "number"
    }
  ],
  "processorLog": [
    {
      "key": "x",
      "label": "Cell x",
      "type": "number"
    },
    {
      "key": "y",
      "label": "Cell y",
      "type": "number"
    },
    {
      "key": "to",
      "label": "Output element",
      "type": "text"
    }
  ],
  "processorNoop": [
    {
      "key": "x",
      "label": "Cell x",
      "type": "number"
    },
    {
      "key": "y",
      "label": "Cell y",
      "type": "number"
    },
    {
      "key": "to",
      "label": "Output element",
      "type": "text"
    },
    {
      "key": "chance",
      "label": "Chance",
      "type": "number"
    }
  ],
  "pushStructure": [
    {
      "key": "propagateToWorkers",
      "label": "Send to workers",
      "type": "bool"
    },
    {
      "key": "value2",
      "label": "Value",
      "type": "number"
    },
    {
      "key": "thresholds",
      "label": "Thresholds",
      "type": "text"
    }
  ],
  "randomInt": [
    {
      "key": "min",
      "label": "Lowest",
      "type": "number"
    },
    {
      "key": "max",
      "label": "Highest",
      "type": "number"
    }
  ],
  "readDataField": [
    {
      "key": "slot",
      "label": "Data slot",
      "type": "select"
    },
    {
      "key": "slot",
      "label": "Data slot",
      "type": "select"
    },
    {
      "key": "slotValue",
      "label": "Value",
      "type": "text"
    }
  ],
  "readElement": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "slot",
      "label": "Data slot",
      "type": "select"
    }
  ],
  "removeElement": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "from",
      "label": "From element",
      "type": "text"
    },
    {
      "key": "to",
      "label": "To element",
      "type": "text"
    }
  ],
  "removeStructure": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "preserveUnselectable",
      "label": "Only unselectable",
      "type": "bool"
    },
    {
      "key": "enabled",
      "label": "Enabled",
      "type": "bool"
    }
  ],
  "removeStructures": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "preserveUnselectable",
      "label": "Only unselectable",
      "type": "bool"
    },
    {
      "key": "enabled",
      "label": "Enabled",
      "type": "bool"
    }
  ],
  "removeTerrain": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "skipShadow",
      "label": "Skip shadow",
      "type": "bool"
    },
    {
      "key": "damage",
      "label": "Damage",
      "type": "number"
    },
    {
      "key": "hitPoints",
      "label": "Hit points",
      "type": "number"
    }
  ],
  "replaceElement": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "replaceTerrain": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "skipShadow",
      "label": "Skip shadow",
      "type": "bool"
    },
    {
      "key": "damage",
      "label": "Damage",
      "type": "number"
    }
  ],
  "setDuration": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "ticks",
      "label": "Ticks",
      "type": "number"
    },
    {
      "key": "rearm",
      "label": "Rearm",
      "type": "bool"
    },
    {
      "key": "tx",
      "label": "Move X",
      "type": "number"
    },
    {
      "key": "ty",
      "label": "Move Y",
      "type": "number"
    }
  ],
  "setSpritesheetByValue": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "value2",
      "label": "Value",
      "type": "number"
    },
    {
      "key": "thresholds",
      "label": "Thresholds",
      "type": "text"
    }
  ],
  "setSpritesheetIndex": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "index",
      "label": "Frame",
      "type": "number"
    },
    {
      "key": "value2",
      "label": "Value",
      "type": "number"
    },
    {
      "key": "thresholds",
      "label": "Thresholds",
      "type": "text"
    }
  ],
  "setStructureData": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "propagateToWorkers",
      "label": "Send to workers",
      "type": "bool"
    }
  ],
  "setStructureEnabled": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "enabled",
      "label": "Enabled",
      "type": "bool"
    },
    {
      "key": "index",
      "label": "Frame",
      "type": "number"
    },
    {
      "key": "value2",
      "label": "Value",
      "type": "number"
    }
  ],
  "setTerrainHitPoints": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "hitPoints",
      "label": "Hit points",
      "type": "number"
    }
  ],
  "setVelocity": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "maxSpeed",
      "label": "Max speed",
      "type": "number"
    },
    {
      "key": "ticks",
      "label": "Ticks",
      "type": "number"
    },
    {
      "key": "rearm",
      "label": "Rearm",
      "type": "bool"
    }
  ],
  "signalLog": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    }
  ],
  "signalOutput": [
    {
      "key": "value",
      "label": "Output",
      "type": "bool"
    }
  ],
  "structure": [
    {
      "key": "x",
      "label": "Cell x",
      "type": "number"
    },
    {
      "key": "y",
      "label": "Cell y",
      "type": "number"
    },
    {
      "key": "to",
      "label": "Output element",
      "type": "text"
    }
  ],
  "structureData": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "key",
      "label": "Key",
      "type": "text"
    }
  ],
  "structureInspect": [
    {
      "key": "field",
      "label": "Data field",
      "type": "text"
    },
    {
      "key": "radius",
      "label": "Radius",
      "type": "number"
    }
  ],
  "structureReadData": [
    {
      "key": "field",
      "label": "Data field",
      "type": "text"
    },
    {
      "key": "radius",
      "label": "Radius",
      "type": "number"
    }
  ],
  "structureType": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "structureWriteData": [
    {
      "key": "field",
      "label": "Data field",
      "type": "text"
    },
    {
      "key": "value",
      "label": "Value",
      "type": "text"
    },
    {
      "key": "field",
      "label": "Data field",
      "type": "text"
    },
    {
      "key": "field",
      "label": "Numeric field",
      "type": "text"
    },
    {
      "key": "amount",
      "label": "Amount",
      "type": "number"
    }
  ],
  "techAppendUnlock": [
    {
      "key": "techId",
      "label": "Tech node",
      "type": "text"
    }
  ],
  "techGrantItem": [
    {
      "key": "itemId",
      "label": "Item",
      "type": "text"
    },
    {
      "key": "count",
      "label": "Count",
      "type": "number"
    }
  ],
  "techSetUpgradeLevel": [
    {
      "key": "itemId",
      "label": "Item",
      "type": "text"
    },
    {
      "key": "level",
      "label": "Level",
      "type": "number"
    }
  ],
  "teleportElement": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "tx",
      "label": "Move X",
      "type": "number"
    },
    {
      "key": "ty",
      "label": "Move Y",
      "type": "number"
    }
  ],
  "terrainHitPoints": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "terrainType": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "terrainTypeHandle": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "toParticle": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    }
  ],
  "toast": [
    {
      "key": "text",
      "label": "Text",
      "type": "text"
    }
  ],
  "transformElement": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "from",
      "label": "From element",
      "type": "text"
    },
    {
      "key": "to",
      "label": "To element",
      "type": "text"
    }
  ],
  "triggerLog": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    }
  ],
  "triggerScan": [
    {
      "key": "radius",
      "label": "Radius",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    }
  ],
  "triggerTick": [
    {
      "key": "field",
      "label": "Data field",
      "type": "text"
    },
    {
      "key": "field",
      "label": "Numeric field",
      "type": "text"
    },
    {
      "key": "amount",
      "label": "Amount",
      "type": "number"
    }
  ],
  "upgradeAdd": [
    {
      "key": "field",
      "label": "Numeric field",
      "type": "text"
    },
    {
      "key": "amount",
      "label": "Amount",
      "type": "number"
    }
  ],
  "upgradeCountLevel": [
    {
      "key": "field",
      "label": "Data field",
      "type": "text"
    },
    {
      "key": "field",
      "label": "Numeric field",
      "type": "text"
    },
    {
      "key": "amount",
      "label": "Amount",
      "type": "number"
    }
  ],
  "upgradeLog": [],
  "upgradeScale": [
    {
      "key": "field",
      "label": "Numeric field",
      "type": "text"
    },
    {
      "key": "factor",
      "label": "Factor",
      "type": "number"
    }
  ],
  "writeDataField": [
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool"
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number"
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number"
    },
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number"
    },
    {
      "key": "slot",
      "label": "Data slot",
      "type": "select"
    },
    {
      "key": "slotValue",
      "label": "Value",
      "type": "text"
    }
  ],
  "if": [
    {
      "key": "var",
      "label": "When variable is true",
      "type": "text"
    }
  ]
}
  const ACTIONS = {
  "act": [
    "addVelocity",
    "buildStructure",
    "createElement",
    "createTerrain",
    "damageTerrain",
    "emptyCells",
    "itemExcavate",
    "itemShoot",
    "processorConvert",
    "processorLift",
    "processorLog",
    "processorNoop",
    "pushStructure",
    "removeElement",
    "removeStructure",
    "removeStructures",
    "removeTerrain",
    "replaceElement",
    "replaceTerrain",
    "setDuration",
    "setSpritesheetByValue",
    "setSpritesheetIndex",
    "setStructureData",
    "setStructureEnabled",
    "setTerrainHitPoints",
    "setVelocity",
    "structure",
    "teleportElement",
    "toParticle",
    "transformElement",
    "writeDataField"
  ],
  "remember": [
    "bufferIncrement",
    "bufferRead",
    "bufferWrite",
    "processorCount",
    "structureWriteData",
    "triggerTick",
    "upgradeAdd",
    "upgradeCountLevel"
  ],
  "logic": [
    "cell",
    "logicAll",
    "logicAny",
    "logicCount",
    "logicForEach",
    "logicSum"
  ],
  "decide": [
    "compare",
    "math",
    "noop",
    "randomInt",
    "upgradeScale"
  ],
  "sense": [
    "countElements",
    "countEmpty",
    "countStructures",
    "countTerrain",
    "findFreeCell",
    "getVelocity",
    "hasStructure",
    "hasTerrain",
    "isBlockedByPlayer",
    "isElementAtCell",
    "isLauncher",
    "isMyType",
    "isStructureEnabled",
    "isStructureType",
    "isTerrainType",
    "mapSpritesheetValue",
    "readDataField",
    "readElement",
    "signalLog",
    "structureData",
    "structureInspect",
    "structureReadData",
    "structureType",
    "terrainHitPoints",
    "terrainType",
    "terrainTypeHandle",
    "triggerLog",
    "triggerScan"
  ],
  "connect": [
    "energyBank",
    "energyConductor",
    "energyConsumePerRun",
    "energyDefault",
    "energyGenerateWhileHeld",
    "energyNetwork",
    "energyWire",
    "identity",
    "itemDefault",
    "logArgs",
    "logBuildingPayload",
    "signalOutput",
    "techAppendUnlock",
    "techGrantItem",
    "techSetUpgradeLevel"
  ],
  "feel": [
    "particles",
    "toast",
    "upgradeLog"
  ],
  "block": [
    "if"
  ]
}

  const ACTION_DOCS = {
  "addVelocity": "Adds (vx, vy) to the particle velocity in the region. Set maxSpeed to clamp the result in cells per second.",
  "bufferIncrement": "Adds `delta` to a shared counter, clamped. Set `path` and `delta`.",
  "bufferRead": "Reads a shared buffer slot. Set `path`. Bind the result with `as`.",
  "bufferWrite": "Writes a value to a shared buffer slot. Set `path` and `value`.",
  "buildStructure": "Builds a structure of the given type at the cell.",
  "cell": "fn(size?, element, \u2026) \u2192 true when **any** cell in the range holds that element. Bind the answer with the step's As field.",
  "compare": "Compares `left` and `right` with `op`. Answers 1 or 0. Set the options.",
  "countElements": "Counts cells holding `element` in the region. Returns a number \u2014 bind it with As to compare against a threshold.",
  "countEmpty": "Counts cells in the region that hold neither element nor terrain. This is the free space.",
  "countStructures": "Counts structures in the region. Bind it to check a footprint is clear before building.",
  "countTerrain": "Counts cells holding terrain in the region. Bind it to size a footprint.",
  "createElement": "Writes `element` into every **empty** cell in the region, leaving anything already there alone.",
  "createTerrain": "Creates terrain of the given type in empty cells. One atomic batch.",
  "damageTerrain": "Damages terrain in the region. Per-cell, so a large area can half-apply.",
  "emptyCells": "Removes the element from every occupied cell in the region.",
  "energyBank": "Storage node descriptor: capacity 100000 \u2014 a large buffer.",
  "energyConductor": "Conductor descriptor: capacity 0. Forwards energy without holding any.",
  "energyConsumePerRun": "Draws `amount` from the shared power pool. Set `amount` in options.",
  "energyDefault": "Storage node descriptor: capacity 1000. Override `capacity` in options.",
  "energyGenerateWhileHeld": "Adds power to the network here. Set `amount` in options.",
  "energyNetwork": "Joins the network named by `energyType` in options.",
  "energyWire": "Storage node descriptor: capacity 200 \u2014 a small buffer between machines.",
  "findFreeCell": "Finds a free cell within `size` cells of the structure. Returns its index as a number, or -1 when the whole area is occupied.",
  "getVelocity": "Reads the particle speed at the first cell of the region and returns it. Bind it with As. Returns -1 when there is no particle to measure.",
  "hasStructure": "True when a structure has been built at the cell. Bind it with As.",
  "hasTerrain": "True when the cell holds terrain. Bind it with As.",
  "identity": "Modifier: returns the args untouched. Proves a modify hook is wired.",
  "isBlockedByPlayer": "True when a player has blocked building at the cell.",
  "isElementAtCell": "fn(dx?, dy?) \u2192 true when the offset cell holds `element`. Bind the answer with the step's As field, then read it as {{name}}.",
  "isLauncher": "True when the cell is a structure launcher.",
  "isMyType": "True when **this** structure is of the given type. No offsets \u2014 it asks about the instance the process is running on.",
  "isStructureEnabled": "True when processing is enabled at the cell. Bind it to gate later steps.",
  "isStructureType": "True when the cell holds a structure of the given type. Accepts an id or a handle from Structure type.",
  "isTerrainType": "True when the cell holds terrain of the given type. Accepts an id or a handle from Terrain type.",
  "itemDefault": "Baseline item options (power 5). Use as a base for a tool or weapon.",
  "itemExcavate": "Digs at this position. Set `damage` and `velocity` in options.",
  "itemShoot": "Fires a projectile. Set `projectileId` and `velocity` in options.",
  "logArgs": "Modifier: prints whatever the hook passed in. Use to discover hook names.",
  "logBuildingPayload": "Modifier: prints a building-placement-shaped payload. Useful while wiring.",
  "logicAll": "fn(size?, element, \u2026) \u2192 true when **all** cells in the range hold that element.",
  "logicAny": "fn(size?, element, \u2026) \u2192 true when **any** cell in the range holds that element. Bind the answer with the step's As field.",
  "logicCount": "fn(size?, element, \u2026) \u2192 how **many** cells in the range hold that element. Bind the number with the step's As field.",
  "logicForEach": "fn(size?, to, \u2026) \u2192 writes an element at **every** cell in the range. Set `when` to only touch cells already holding another element.",
  "logicSum": "fn(size?, \u2026) \u2192 the total terrain hit points in the range. A cell with no terrain counts as 0.",
  "mapSpritesheetValue": "Maps a value onto a threshold list and returns the frame index the engine would pick. Thresholds are comma-separated, ascending.",
  "math": "`left op right`, where op is + - * or /. Division rounds to the nearest whole number. Set both values.",
  "noop": "Always true. Makes an unconditional process explicit.",
  "particles": "Emits particles here. Set `count` in options.",
  "processorConvert": "Replaces the cell above with one fixed element. Set `to` in options.",
  "processorCount": "Increments a counter on this instance. Set `key` in options.",
  "processorLift": "Copies the cell above the structure down to the cell below.",
  "processorLog": "Logs the structure and cell context on every run. Use to confirm wiring.",
  "processorNoop": "Does nothing. Keeps the interval alive without side effects.",
  "pushStructure": "Pushes this structure's data to the engine. Only needed after an action that edits the data bag in place.",
  "randomInt": "A random whole number from `min` to `max`, inclusive. Set both.",
  "readDataField": "Reads data slot N (1\u20134) at the cell and returns the number. Bind it with As. The slot is the number from the element's Data fields list.",
  "readElement": "Reads the element at the cell and returns its id. Bind it with As, then use {{name}} in a later step.",
  "removeElement": "Removes the element from every cell in the region that holds `element`. Leave the element blank to empty every non-empty cell.",
  "removeStructure": "Removes the structure at the cell. Use Remove structures to clear a whole region in one call.",
  "removeStructures": "Removes every structure in the region with a single engine call. Prefer this to Remove structure over an area.",
  "removeTerrain": "Removes terrain from every cell of the region. One atomic batch.",
  "replaceElement": "Writes `element` over every cell in the region, replacing what was there.",
  "replaceTerrain": "Replaces terrain in every cell of the region. One atomic batch.",
  "setDuration": "Sets the remaining duration in ticks for every cell in the region. Set rearm to also raise the maximum, so it fires again next cycle.",
  "setSpritesheetByValue": "Sets the frame by mapping a value onto a threshold list \u2014 the progress bar. Thresholds are comma-separated, ascending.",
  "setSpritesheetIndex": "Sets this instance's spritesheet frame. Bind a number to it for a gauge.",
  "setStructureData": "Writes one key into the structure's saved data, through the engine. Use Number value for a numeric field.",
  "setStructureEnabled": "Enables or disables processing at the cell.",
  "setTerrainHitPoints": "Sets the terrain's hit points in the region. Use it to repair a wall.",
  "setVelocity": "Sets the particle velocity (vx, vy) on every cell in the region. Only affects particles \u2014 use toParticle to turn a cell into one first.",
  "signalLog": "Logs the raw payload. Use to see what a call site actually delivers.",
  "signalOutput": "Publishes this structure's signal output. Set `value` in options.",
  "structure": "Logs the structure and cell context on every run. Use to confirm wiring.",
  "structureData": "Reads one key from the structure's saved data and returns it. Bind it with As. Returns the empty string when the key is absent.",
  "structureInspect": "Reports what the clicked structure is, without changing anything.",
  "structureReadData": "Reads one key out of the instance's own data bag. Set `key` in options.",
  "structureType": "Reads the type of the structure at a cell and returns the engine's own handle for it. Feed it back into Is structure type \u2014 do not compare it to an id by hand.",
  "structureWriteData": "Writes one key into this instance's saved data. Set `key` / `value` in options.",
  "techAppendUnlock": "Adds structures to a tech node. Set `techId` and `structures` in options.",
  "techGrantItem": "Gives the player an item. Set `itemId` and `count` in options.",
  "techSetUpgradeLevel": "Sets an upgrade level. Set `itemId`, `upgradeId` and `level` in options.",
  "teleportElement": "Moves everything in the region by the (tx, ty) offset. ty: 1 moves it down one cell. Cells that would land on something are not moved.",
  "terrainHitPoints": "Reads the terrain's hit points at a cell. Returns -1 when there are none. Bind it to watch a wall wear down.",
  "terrainType": "Reads the terrain id at a cell. Empty means no terrain. Bind it with As.",
  "terrainTypeHandle": "Reads the engine's own numeric handle for the terrain at a cell. Returns -1 when there is none.",
  "toParticle": "Turns every cell in the region into a particle moving at (vx, vy). This is what actually launches material \u2014 setVelocity alone will not move sand.",
  "toast": "Shows a message. Set `text` in options.",
  "transformElement": "Where the region holds `from`, writes `to`. Leave `from` blank to convert whatever element is there.",
  "triggerLog": "Logs the raw payload of a timed tick.",
  "triggerScan": "Logs a rectangle of cells around this position. Set `width` / `height` in options.",
  "triggerTick": "Increments this instance's tick counter. Set `key` in options.",
  "upgradeAdd": "Adds `amount` to a numeric field. Set `key` and `amount` in options.",
  "upgradeCountLevel": "Increments a level counter on the upgraded item. Set `key` in options.",
  "upgradeLog": "Prints the upgraded item and these options. Safe to leave on while testing.",
  "upgradeScale": "Maps a stored value through thresholds. Set `thresholds` in options.",
  "writeDataField": "Writes a number into data slot N (1\u20134) at the cell. Set `slot` (1\u20134) and `value`.",
  "if": "Control-flow block. options.var is a process tag; then[] when truthy, else[] when falsy."
}

  const ACTION_APIS = {
  "addVelocity": [
    "sandkit.api.elements"
  ],
  "bufferIncrement": [
    "mod.buffers"
  ],
  "bufferRead": [
    "mod.buffers"
  ],
  "bufferWrite": [
    "mod.buffers"
  ],
  "buildStructure": [
    "sandkit.api.structures"
  ],
  "cell": [
    "sandkit.api.elements"
  ],
  "compare": [],
  "countElements": [
    "sandkit.api.elements"
  ],
  "countEmpty": [
    "sandkit.api.elements"
  ],
  "countStructures": [
    "sandkit.api.structures"
  ],
  "countTerrain": [
    "sandkit.api.terrains"
  ],
  "createElement": [
    "sandkit.api.elements"
  ],
  "createTerrain": [
    "sandkit.api.terrains"
  ],
  "damageTerrain": [
    "sandkit.api.terrains"
  ],
  "emptyCells": [
    "sandkit.api.elements"
  ],
  "energyBank": [],
  "energyConductor": [],
  "energyConsumePerRun": [
    "sandkit.api.energy"
  ],
  "energyDefault": [],
  "energyGenerateWhileHeld": [
    "sandkit.api.energy"
  ],
  "energyNetwork": [],
  "energyWire": [],
  "findFreeCell": [
    "sandkit.api.elements"
  ],
  "getVelocity": [
    "sandkit.api.elements"
  ],
  "hasStructure": [
    "sandkit.api.structures"
  ],
  "hasTerrain": [
    "sandkit.api.terrains"
  ],
  "identity": [],
  "isBlockedByPlayer": [
    "sandkit.api.structures"
  ],
  "isElementAtCell": [],
  "isLauncher": [
    "sandkit.api.structures"
  ],
  "isMyType": [
    "sandkit.api.structures"
  ],
  "isStructureEnabled": [
    "sandkit.api.structures"
  ],
  "isStructureType": [
    "sandkit.api.structures"
  ],
  "isTerrainType": [
    "sandkit.api.terrains"
  ],
  "itemDefault": [],
  "itemExcavate": [
    "sandkit.api.grid"
  ],
  "itemShoot": [
    "sandkit.api.projectiles"
  ],
  "logArgs": [],
  "logBuildingPayload": [],
  "logicAll": [
    "sandkit.api.elements"
  ],
  "logicAny": [
    "sandkit.api.elements"
  ],
  "logicCount": [
    "sandkit.api.elements"
  ],
  "logicForEach": [
    "sandkit.api.elements"
  ],
  "logicSum": [
    "sandkit.api.elements"
  ],
  "mapSpritesheetValue": [
    "sandkit.api.structures"
  ],
  "math": [],
  "noop": [],
  "particles": [
    "sandkit.api.effects"
  ],
  "processorConvert": [],
  "processorCount": [],
  "processorLift": [],
  "processorLog": [],
  "processorNoop": [],
  "pushStructure": [
    "sandkit.api.structures"
  ],
  "randomInt": [
    "sandkit.api.random"
  ],
  "readDataField": [
    "sandkit.api.elements"
  ],
  "readElement": [
    "sandkit.api.elements"
  ],
  "removeElement": [
    "sandkit.api.elements"
  ],
  "removeStructure": [
    "sandkit.api.structures"
  ],
  "removeStructures": [
    "sandkit.api.structures"
  ],
  "removeTerrain": [
    "sandkit.api.terrains"
  ],
  "replaceElement": [
    "sandkit.api.elements"
  ],
  "replaceTerrain": [
    "sandkit.api.terrains"
  ],
  "setDuration": [
    "sandkit.api.elements"
  ],
  "setSpritesheetByValue": [
    "sandkit.api.structures"
  ],
  "setSpritesheetIndex": [
    "sandkit.api.structures"
  ],
  "setStructureData": [
    "sandkit.api.structures"
  ],
  "setStructureEnabled": [
    "sandkit.api.structures"
  ],
  "setTerrainHitPoints": [
    "sandkit.api.terrains"
  ],
  "setVelocity": [
    "sandkit.api.elements"
  ],
  "signalLog": [],
  "signalOutput": [
    "sandkit.api.signals"
  ],
  "structure": [],
  "structureData": [
    "sandkit.api.structures"
  ],
  "structureInspect": [],
  "structureReadData": [],
  "structureType": [
    "sandkit.api.structures"
  ],
  "structureWriteData": [],
  "techAppendUnlock": [
    "sandkit.api.tech"
  ],
  "techGrantItem": [
    "sandkit.api.player"
  ],
  "techSetUpgradeLevel": [
    "sandkit.api.upgrades"
  ],
  "teleportElement": [
    "sandkit.api.elements"
  ],
  "terrainHitPoints": [
    "sandkit.api.terrains"
  ],
  "terrainType": [
    "sandkit.api.terrains"
  ],
  "terrainTypeHandle": [
    "sandkit.api.terrains"
  ],
  "toParticle": [
    "sandkit.api.elements"
  ],
  "toast": [
    "sandkit.api.ui"
  ],
  "transformElement": [
    "sandkit.api.elements"
  ],
  "triggerLog": [],
  "triggerScan": [],
  "triggerTick": [],
  "upgradeAdd": [],
  "upgradeCountLevel": [],
  "upgradeLog": [],
  "upgradeScale": [],
  "writeDataField": [
    "sandkit.api.elements"
  ],
  "if": []
}

  const ACTION_FAMILIES = {
  "api/elements": {
    "api": "sandkit.api.elements",
    "title": "Elements \u2014 read/write cells & matter",
    "keys": [
      "addVelocity",
      "countElements",
      "countEmpty",
      "createElement",
      "emptyCells",
      "findFreeCell",
      "getVelocity",
      "readDataField",
      "readElement",
      "removeElement",
      "replaceElement",
      "setDuration",
      "setVelocity",
      "teleportElement",
      "toParticle",
      "transformElement",
      "writeDataField"
    ]
  },
  "api/structures": {
    "api": "sandkit.api.structures",
    "title": "Structures \u2014 place, query, data",
    "keys": [
      "buildStructure",
      "countStructures",
      "hasStructure",
      "isBlockedByPlayer",
      "isLauncher",
      "isMyType",
      "isStructureEnabled",
      "isStructureType",
      "mapSpritesheetValue",
      "pushStructure",
      "removeStructure",
      "removeStructures",
      "setSpritesheetByValue",
      "setSpritesheetIndex",
      "setStructureData",
      "setStructureEnabled",
      "structureData",
      "structureType"
    ]
  },
  "api/terrains": {
    "api": "sandkit.api.terrains",
    "title": "Terrains \u2014 create, damage, query",
    "keys": [
      "countTerrain",
      "createTerrain",
      "damageTerrain",
      "hasTerrain",
      "isTerrainType",
      "removeTerrain",
      "replaceTerrain",
      "setTerrainHitPoints",
      "terrainHitPoints",
      "terrainType",
      "terrainTypeHandle"
    ]
  },
  "api/grid": {
    "api": "sandkit.api.grid",
    "title": "Grid \u2014 excavation / cell ops",
    "keys": [
      "itemExcavate"
    ]
  },
  "api/energy": {
    "api": "sandkit.api.energy",
    "title": "Energy",
    "keys": [
      "energyConsumePerRun",
      "energyGenerateWhileHeld"
    ]
  },
  "api/signals": {
    "api": "sandkit.api.signals",
    "title": "Signals",
    "keys": [
      "signalOutput"
    ]
  },
  "api/tech": {
    "api": "sandkit.api.tech",
    "title": "Tech",
    "keys": [
      "techAppendUnlock"
    ]
  },
  "api/player": {
    "api": "sandkit.api.player",
    "title": "Player / items",
    "keys": [
      "techGrantItem"
    ]
  },
  "api/upgrades": {
    "api": "sandkit.api.upgrades",
    "title": "Upgrades",
    "keys": [
      "techSetUpgradeLevel"
    ]
  },
  "api/projectiles": {
    "api": "sandkit.api.projectiles",
    "title": "Projectiles",
    "keys": [
      "itemShoot"
    ]
  },
  "api/effects": {
    "api": "sandkit.api.effects",
    "title": "Effects",
    "keys": [
      "particles"
    ]
  },
  "api/ui": {
    "api": "sandkit.api.ui",
    "title": "UI",
    "keys": [
      "toast"
    ]
  },
  "api/random": {
    "api": "sandkit.api.random",
    "title": "Random",
    "keys": [
      "randomInt"
    ]
  },
  "custom/buffer": {
    "api": "mod.buffers",
    "title": "Buffers (mod shared state)",
    "keys": [
      "bufferIncrement",
      "bufferRead",
      "bufferWrite"
    ]
  },
  "logic/logic": {
    "api": "logic walks",
    "title": "Logic \u2014 range any/all/count/sum/forEach",
    "keys": [
      "cell",
      "logicAll",
      "logicAny",
      "logicCount",
      "logicForEach",
      "logicSum"
    ]
  },
  "engine/sense": {
    "api": "engine role",
    "title": "Engine \u00b7 Sense",
    "keys": [
      "isElementAtCell",
      "signalLog",
      "structureInspect",
      "structureReadData",
      "triggerLog",
      "triggerScan"
    ]
  },
  "engine/decide": {
    "api": "engine role",
    "title": "Engine \u00b7 Decide",
    "keys": [
      "compare",
      "math",
      "noop",
      "upgradeScale"
    ]
  },
  "engine/remember": {
    "api": "engine role",
    "title": "Engine \u00b7 Remember",
    "keys": [
      "processorCount",
      "structureWriteData",
      "triggerTick",
      "upgradeAdd",
      "upgradeCountLevel"
    ]
  },
  "engine/feel": {
    "api": "engine role",
    "title": "Engine \u00b7 Feel",
    "keys": [
      "upgradeLog"
    ]
  },
  "engine/connect": {
    "api": "engine role",
    "title": "Engine \u00b7 Connect",
    "keys": [
      "energyBank",
      "energyConductor",
      "energyDefault",
      "energyNetwork",
      "energyWire",
      "identity",
      "itemDefault",
      "logArgs",
      "logBuildingPayload"
    ]
  },
  "engine/processors": {
    "api": "engine role",
    "title": "Engine \u00b7 Processors",
    "keys": [
      "processorConvert",
      "processorLift",
      "processorLog",
      "processorNoop",
      "structure"
    ]
  }
};

  const FIELD_SECTIONS = {
    "programV2": {
      "id": "Identity",
      "name": "Identity",
      "scope": "Identity",
      "doc": "Identity"
    },
    "processes": {
      "id": "Identity",
      "name": "Identity",
      "scope": "Identity",
      "doc": "Identity",
      "derived": "Meta",
      "derivedFrom": "Meta"
    },
  "structures": {
    "shapeJson": "Placement",
    "shape": "Placement",
    "descriptionParamsJson": "Identity",
    "descriptionParams": "Identity",
    "linkedClearance": "Placement",
    "categoryKey": "Placement",
    "buildModesJson": "Placement",
    "buildModes": "Placement",
    "rejectWhenBlocked": "Placement",
    "unlockNode": "Flags",
    "tooltipHoverJson": "Render",
    "tooltipHover": "Render",
    "variantsJson": "Render",
    "variants": "Render",
    "imageName": "Render",
    "drawKey": "Render",
    "blockGridType": "Grid",
    "skipCopyData": "Grid",
    "copyData": "Grid",
    "defaultDataJson": "Grid",
    "defaultData": "Grid",
    "dataFieldsJson": "Grid",
    "defaultDataFields": "Grid",
    "name": "Identity",
    "description": "Identity",
    "descriptionKey": "Identity",
    "order": "Placement",
    "dirH": "Placement",
    "dirV": "Placement",
    "dirD": "Placement",
    "hideFromBuildMenu": "Flags",
    "disallowPick": "Flags",
    "id": "Identity"
  },
  "elements": {
    "flammableOn": "Flammable",
    "flammableOutputId": "Flammable",
    "flammableOutputChance": "Flammable",
    "flammableInheritsDuration": "Flammable",
    "flammableDurationMin": "Flammable",
    "flammableDurationMax": "Flammable",
    "collectableOn": "Collectable",
    "collectableValue": "Collectable",
    "dataFieldsJson": "Data",
    "defaultDataFields": "Data",
    "matterType": "Physics",
    "metaColor": "Appearance",
    "colorsJson": "Appearance",
    "name": "Identity",
    "description": "Identity",
    "descriptionKey": "Identity",
    "density": "Physics",
    "horizontalSpeed": "Physics",
    "duration": "Physics",
    "durationRandomMin": "Physics",
    "durationRandomMax": "Physics",
    "isTransportable": "Behaviour",
    "isGrabbable": "Behaviour",
    "visibleInPicker": "Behaviour",
    "id": "Identity"
  },
  "terrains": {
    "colorHSLOn": "Colour",
    "excavationRequirements": "Tile",
    "interactionsJson": "Tile",
    "metaColor": "Tile",
    "outputElement": "Tile",
    "materialId": "Tile",
    "name": "Identity",
    "nameKey": "Identity",
    "colorHSLHue": "Colour",
    "colorHSLSaturation": "Colour",
    "colorHSLLightness": "Colour",
    "hp": "Tile",
    "outputChance": "Tile",
    "flammable": "Flags",
    "id": "Identity"
  },
  "items": {
    "itemType": "Item",
    "excavationProfileId": "Item",
    "projectileId": "Item",
    "spriteId": "Sprite",
    "spriteType": "Sprite",
    "name": "Identity",
    "description": "Identity",
    "descriptionKey": "Identity",
    "cooldownMs": "Item",
    "energyCost": "Item",
    "hideFromBuildMenu": "Flags",
    "id": "Identity"
  },
  "recipes": {
    "machine": "Recipe",
    "outputElement": "Outputs",
    "outputs": "Outputs",
    "outputsAbove": "Outputs",
    "outputsBelow": "Outputs",
    "outputChance": "Outputs",
    "minVelocity": "Outputs",
    "id": "Identity"
  },
  "signals": {
    "kind": "Signal",
    "target": "Signal",
    "id": "Identity"
  },
  "triggers": {
    "extraJson": "Timing",
    "interval": "Timing",
    "sequentialRuns": "Timing",
    "id": "Identity"
  },
  "techs": {
    "currencyType": "Research",
    "currencyTypeCustom": "Research",
    "branch": "Research",
    "branchCustom": "Research",
    "parentId": "Research",
    "requires": "Research",
    "unlockStructures": "Unlocks",
    "unlockItems": "Unlocks",
    "name": "Identity",
    "cost": "Research",
    "description": "Research",
    "descriptionKey": "Research",
    "id": "Identity"
  },
  "upgrades": {
    "itemId": "Upgrade",
    "categoryId": "Upgrade",
    "costsJson": "Upgrade",
    "itemNameKey": "Upgrade",
    "upgradeNameKey": "Upgrade",
    "upgradeId": "Upgrade",
    "maxLevel": "Upgrade",
    "oneOff": "Upgrade",
    "id": "Identity"
  },
  "processing": {
    "structureType": "Target",
    "intervalMs": "Timing",
    "id": "Identity"
  }
};
  const SECTION_ORDER = {
    "programV2": ["Identity", "Other"],
    "processes": ["Identity", "Meta", "Other"],
  "structures": [
    "Identity",
    "Placement",
    "Flags",
    "Render",
    "Grid",
    "Other"
  ],
  "elements": [
    "Identity",
    "Physics",
    "Appearance",
    "Behaviour",
    "Flammable",
    "Collectable",
    "Data",
    "Other"
  ],
  "terrains": [
    "Identity",
    "Colour",
    "Tile",
    "Flags",
    "Other"
  ],
  "items": [
    "Identity",
    "Item",
    "Sprite",
    "Flags",
    "Other"
  ],
  "recipes": [
    "Identity",
    "Recipe",
    "Outputs",
    "Other"
  ],
  "signals": [
    "Identity",
    "Signal",
    "Other"
  ],
  "triggers": [
    "Identity",
    "Timing",
    "Other"
  ],
  "techs": [
    "Identity",
    "Research",
    "Unlocks",
    "Other"
  ],
  "upgrades": [
    "Identity",
    "Upgrade",
    "Other"
  ],
  "processing": [
    "Identity",
    "Target",
    "Timing",
    "Other"
  ]
};

  
  const PROGRAM_V2_FAMILIES = {
  "elements": {
    "title": "api.elements",
    "api": "mysandkit.api.elements",
    "keys": [
      "elements.updateDefinition",
      "elements.addInteractionInfo",
      "elements.addElementToDiscoveries",
      "elements.getTypeById",
      "elements.getRegisteredTypes",
      "elements.getDefinitionByType",
      "elements.getIdByType",
      "elements.getNameByType",
      "elements.getResolvedTypeAtCell",
      "elements.getTypeAtCell",
      "elements.getTypeFromId",
      "elements.isTypeAtCell",
      "elements.setVelocityAtCell",
      "elements.addParticleVelocityAtCell",
      "elements.setDurationAtCell",
      "elements.removeAtCell",
      "elements.removeAtCellWhenIdle",
      "elements.convertToParticleAtCell",
      "elements.getDataFieldAtCell",
      "elements.setDataFieldAtCell",
      "elements.getVelocityAtCell",
      "elements.teleportBetweenCells",
      "elements.findFreeCellInStructure"
    ]
  },
  "structures": {
    "title": "api.structures",
    "api": "mysandkit.api.structures",
    "keys": [
      "structures.updateDefinition",
      "structures.getRegisteredTypes",
      "structures.getUnlockedTypes",
      "structures.getTypeName",
      "structures.getAll",
      "structures.getRegistered",
      "structures.list",
      "structures.includes",
      "structures.getAtCell",
      "structures.hasBuiltAtCell",
      "structures.isTypeAtCell",
      "structures.isType",
      "structures.isBlockedByPlayerAtCell",
      "structures.isLauncherAtCell",
      "structures.buildAtCell",
      "structures.removeAtCell",
      "structures.removeAtCells",
      "structures.update",
      "structures.updateData",
      "structures.setSpritesheetIndex",
      "structures.setSpritesheetIndexAtCell",
      "structures.setSpritesheetIndexByValue",
      "structures.setSpritesheetIndexByValueAtCell",
      "structures.mapValueToSpritesheetIndex",
      "structures.processing.isEnabledAtCell",
      "structures.processing.setEnabledAtCell",
      "structures.addVariant",
      "structures.getAvailableTypes",
      "structures.getDefinitionByType",
      "structures.getIdByType",
      "structures.getTypeById",
      "structures.countOfType"
    ]
  },
  "terrains": {
    "title": "api.terrains",
    "api": "mysandkit.api.terrains",
    "keys": [
      "terrains.getDataAtCell",
      "terrains.getHitPointsAtCell",
      "terrains.getTypeAtCell",
      "terrains.isAtCell",
      "terrains.isTypeAtCell",
      "terrains.isCellIdTerrain",
      "terrains.damageAtCell",
      "terrains.setHitPointsAtCell",
      "terrains.getTypeById",
      "terrains.updateDefinition",
      "terrains.getIdByType",
      "terrains.getDefinitionByType"
    ]
  },
  "grid": {
    "title": "api.grid",
    "api": "mysandkit.api.grid",
    "keys": [
      "grid.isCellEmptyAtCell",
      "grid.isTerrainAtCell",
      "grid.reportActivityAtCell",
      "grid.excavateAtCell"
    ]
  },
  "energy": {
    "title": "api.energy",
    "api": "mysandkit.api.energy",
    "keys": [
      "energy.addAtCell",
      "energy.consume"
    ]
  },
  "items": {
    "title": "api.items",
    "api": "mysandkit.api.items",
    "keys": [
      "items.updateDefinition",
      "items.getRegisteredIds",
      "items.getDefinitionById",
      "items.getRegistered",
      "items.getAll",
      "items.list"
    ]
  },
  "player": {
    "title": "api.player",
    "api": "mysandkit.api.player",
    "keys": [
      "player.inventory.addById",
      "player.buildings.unlockById",
      "player.buildings.removeById"
    ]
  },
  "projectiles": {
    "title": "api.projectiles",
    "api": "mysandkit.api.projectiles",
    "keys": [
      "projectiles.createBlueprintFromId",
      "projectiles.spawnAtWorld"
    ]
  },
  "tech": {
    "title": "api.tech",
    "api": "mysandkit.api.tech",
    "keys": [
      "tech.updateDefinition",
      "tech.conservatory.appendUnlock"
    ]
  },
  "upgrades": {
    "title": "api.upgrades",
    "api": "mysandkit.api.upgrades",
    "keys": [
      "upgrades.updateDefinition",
      "upgrades.setLevelById"
    ]
  },
  "signals": {
    "title": "api.signals",
    "api": "mysandkit.api.signals",
    "keys": [
      "signals.setOutputAtCell"
    ]
  },
  "effects": {
    "title": "api.effects",
    "api": "mysandkit.api.effects",
    "keys": [
      "effects.createParticlesAtWorld",
      "effects.includes"
    ]
  },
  "ui": {
    "title": "api.ui",
    "api": "mysandkit.api.ui",
    "keys": [
      "ui.toast"
    ]
  },
  "sprites": {
    "title": "api.sprites",
    "api": "mysandkit.api.sprites",
    "keys": [
      "sprites.load",
      "sprites.loadFromMod",
      "sprites.namespace",
      "sprites.getRegistered",
      "sprites.getLoaded",
      "sprites.getAll",
      "sprites.list"
    ]
  },
  "storage": {
    "title": "api.storage",
    "api": "mysandkit.api.storage",
    "keys": [
      "storage.ensure",
      "storage.set",
      "storage.remove",
      "storage.ensureFor",
      "storage.removeFor"
    ]
  },
  "settings": {
    "title": "api.settings",
    "api": "mysandkit.api.settings",
    "keys": [
      "settings.get"
    ]
  },
  "random": {
    "title": "api.random",
    "api": "mysandkit.api.random",
    "keys": [
      "random.int"
    ]
  },
  "rendering": {
    "title": "api.rendering",
    "api": "mysandkit.api.rendering",
    "keys": [
      "rendering.getGridMetrics",
      "rendering.getDrawPositionAtCell"
    ]
  },
  "assets": {
    "title": "api.assets",
    "api": "mysandkit.api.assets",
    "keys": [
      "assets.getUrl"
    ]
  },
  "hooks": {
    "title": "api.hooks",
    "api": "mysandkit.api.hooks",
    "keys": [
      "hooks.hasHooks"
    ]
  },
  "api": {
    "title": "api (root)",
    "api": "mysandkit.api",
    "keys": [
      "toast"
    ]
  },
  "input": {
    "title": "api.input",
    "api": "mysandkit.api.input",
    "keys": [
      "input.getMouseCellPosition"
    ]
  }
};
  const PROGRAM_V2_PARAMS = {
  "toast": [
    {
      "key": "msg",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "msg"
    },
    {
      "key": "opts",
      "optional": true,
      "type": "json",
      "ts": "Record<string",
      "def": "",
      "content": null,
      "label": "opts"
    },
    {
      "key": "unknown",
      "optional": false,
      "type": "text",
      "ts": "unknown>"
    }
  ],
  "storage.ensure": [],
  "storage.set": [
    {
      "key": "key",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "key"
    },
    {
      "key": "value",
      "optional": false,
      "type": "text",
      "ts": "unknown",
      "def": "",
      "content": null,
      "label": "value"
    }
  ],
  "storage.remove": [
    {
      "key": "key",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "key"
    }
  ],
  "storage.ensureFor": [
    {
      "key": "modId",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "modId"
    }
  ],
  "storage.removeFor": [
    {
      "key": "modId",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "modId"
    },
    {
      "key": "key",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "key"
    }
  ],
  "settings.get": [
    {
      "key": "fieldId",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "fieldId"
    }
  ],
  "rendering.getGridMetrics": [],
  "rendering.getDrawPositionAtCell": [
    {
      "key": "cell",
      "label": "cell (cx, cy)",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "cx",
        "cy"
      ]
    }
  ],
  "elements.updateDefinition": [
    {
      "key": "idOrType",
      "optional": false,
      "type": "number",
      "ts": "string | number",
      "def": "",
      "content": null,
      "label": "idOrType"
    },
    {
      "key": "partial",
      "optional": false,
      "type": "json",
      "ts": "Record<string",
      "def": "",
      "content": null,
      "label": "partial"
    },
    {
      "key": "unknown",
      "optional": false,
      "type": "text",
      "ts": "unknown>"
    }
  ],
  "elements.addInteractionInfo": [
    {
      "key": "idOrType",
      "optional": false,
      "type": "number",
      "ts": "string | number",
      "def": "",
      "content": null,
      "label": "idOrType"
    },
    {
      "key": "interaction",
      "optional": false,
      "type": "text",
      "ts": "unknown",
      "def": "",
      "content": null,
      "label": "interaction"
    }
  ],
  "elements.addElementToDiscoveries": [
    {
      "key": "elementType",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": "element",
      "label": "elementType"
    }
  ],
  "elements.getTypeById": [
    {
      "key": "id",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "id"
    }
  ],
  "elements.getRegisteredTypes": [],
  "elements.getDefinitionByType": [
    {
      "key": "t",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "t"
    }
  ],
  "elements.getIdByType": [
    {
      "key": "t",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "t"
    }
  ],
  "elements.getNameByType": [
    {
      "key": "t",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "t"
    }
  ],
  "elements.getResolvedTypeAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    }
  ],
  "elements.getTypeAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    }
  ],
  "elements.getTypeFromId": [
    {
      "key": "id",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "id"
    }
  ],
  "elements.isTypeAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "type",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "type"
    }
  ],
  "elements.setVelocityAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "velocity",
      "optional": false,
      "type": "number",
      "ts": "{ x: number; y: number }",
      "def": "",
      "content": null,
      "label": "velocity"
    }
  ],
  "elements.addParticleVelocityAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "velocity",
      "optional": false,
      "type": "number",
      "ts": "{ x: number; y: number }",
      "def": "",
      "content": null,
      "label": "velocity"
    },
    {
      "key": "maxSpeed",
      "optional": true,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "maxSpeed"
    }
  ],
  "elements.setDurationAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "n",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "n"
    },
    {
      "key": "opts",
      "optional": true,
      "type": "bool",
      "ts": "{ updateMax?: boolean }",
      "def": "",
      "content": null,
      "label": "opts"
    }
  ],
  "elements.removeAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "options",
      "optional": true,
      "type": "text",
      "ts": "unknown",
      "def": "",
      "content": null,
      "label": "options"
    }
  ],
  "elements.removeAtCellWhenIdle": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "options",
      "optional": true,
      "type": "text",
      "ts": "unknown",
      "def": "",
      "content": null,
      "label": "options"
    }
  ],
  "elements.convertToParticleAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "velocity",
      "optional": false,
      "type": "number",
      "ts": "{ x: number; y: number }",
      "def": "",
      "content": null,
      "label": "velocity"
    },
    {
      "key": "options",
      "optional": true,
      "type": "text",
      "ts": "unknown",
      "def": "",
      "content": null,
      "label": "options"
    }
  ],
  "elements.getDataFieldAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "field",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "field"
    }
  ],
  "elements.setDataFieldAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "field",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "field"
    },
    {
      "key": "value",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "value"
    }
  ],
  "elements.getVelocityAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    }
  ],
  "elements.teleportBetweenCells": [
    {
      "key": "fromX",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "fromX"
    },
    {
      "key": "fromY",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "fromY"
    },
    {
      "key": "toX",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "toX"
    },
    {
      "key": "toY",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "toY"
    }
  ],
  "elements.findFreeCellInStructure": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "size",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "size"
    }
  ],
  "grid.isCellEmptyAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    }
  ],
  "grid.isTerrainAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    }
  ],
  "grid.reportActivityAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    }
  ],
  "grid.excavateAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "outVelocity",
      "optional": false,
      "type": "json",
      "ts": "Record<string",
      "def": "",
      "content": null,
      "label": "outVelocity"
    },
    {
      "key": "number",
      "optional": false,
      "type": "text",
      "ts": "number>"
    },
    {
      "key": "damage",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "damage"
    },
    {
      "key": "opts",
      "optional": true,
      "type": "json",
      "ts": "Record<string",
      "def": "",
      "content": null,
      "label": "opts"
    },
    {
      "key": "unknown",
      "optional": false,
      "type": "text",
      "ts": "unknown>"
    }
  ],
  "player.inventory.addById": [
    {
      "key": "itemId",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "itemId"
    },
    {
      "key": "amount",
      "optional": true,
      "type": "text",
      "ts": "unknown",
      "def": "1",
      "content": null,
      "label": "amount"
    }
  ],
  "player.buildings.unlockById": [
    {
      "key": "structureId",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": "structure",
      "label": "structureId"
    }
  ],
  "player.buildings.removeById": [
    {
      "key": "structureId",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": "structure",
      "label": "structureId"
    }
  ],
  "structures.updateDefinition": [
    {
      "key": "idOrType",
      "optional": false,
      "type": "number",
      "ts": "string | number",
      "def": "",
      "content": null,
      "label": "idOrType"
    },
    {
      "key": "partial",
      "optional": false,
      "type": "json",
      "ts": "Record<string",
      "def": "",
      "content": null,
      "label": "partial"
    },
    {
      "key": "unknown",
      "optional": false,
      "type": "text",
      "ts": "unknown>"
    },
    {
      "key": "options",
      "optional": true,
      "type": "bool",
      "ts": "{ useRawShape?: boolean }",
      "def": "",
      "content": null,
      "label": "options"
    }
  ],
  "structures.getRegisteredTypes": [],
  "structures.getUnlockedTypes": [],
  "structures.getTypeName": [
    {
      "key": "t",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "t"
    }
  ],
  "structures.getAll": [],
  "structures.getRegistered": [],
  "structures.list": [],
  "structures.includes": [
    {
      "key": "idOrType",
      "optional": false,
      "type": "number",
      "ts": "string | number",
      "def": "",
      "content": null,
      "label": "idOrType"
    }
  ],
  "structures.getAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    }
  ],
  "structures.hasBuiltAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    }
  ],
  "structures.isTypeAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "ref",
      "optional": false,
      "type": "number",
      "ts": "string | number",
      "def": "",
      "content": null,
      "label": "ref"
    }
  ],
  "structures.isType": [
    {
      "key": "structure",
      "optional": false,
      "type": "text",
      "ts": "unknown",
      "def": "",
      "content": "structure",
      "label": "structure"
    },
    {
      "key": "ref",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "ref"
    }
  ],
  "structures.isBlockedByPlayerAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    }
  ],
  "structures.isLauncherAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    }
  ],
  "structures.buildAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "ref",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "ref"
    },
    {
      "key": "options",
      "optional": true,
      "type": "text",
      "ts": "unknown",
      "def": "",
      "content": null,
      "label": "options"
    }
  ],
  "structures.removeAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "options",
      "optional": true,
      "type": "text",
      "ts": "unknown",
      "def": "",
      "content": null,
      "label": "options"
    }
  ],
  "structures.removeAtCells": [
    {
      "key": "positions",
      "optional": false,
      "type": "number",
      "ts": "{ x: number; y: number }[]",
      "def": "",
      "content": null,
      "label": "positions"
    },
    {
      "key": "options",
      "optional": true,
      "type": "text",
      "ts": "unknown",
      "def": "",
      "content": null,
      "label": "options"
    }
  ],
  "structures.update": [
    {
      "key": "structure",
      "optional": false,
      "type": "text",
      "ts": "unknown",
      "def": "",
      "content": "structure",
      "label": "structure"
    },
    {
      "key": "options",
      "optional": true,
      "type": "text",
      "ts": "unknown",
      "def": "",
      "content": null,
      "label": "options"
    }
  ],
  "structures.updateData": [
    {
      "key": "structure",
      "optional": false,
      "type": "text",
      "ts": "unknown",
      "def": "",
      "content": "structure",
      "label": "structure"
    },
    {
      "key": "partial",
      "optional": false,
      "type": "json",
      "ts": "Record<string",
      "def": "",
      "content": null,
      "label": "partial"
    },
    {
      "key": "unknown",
      "optional": false,
      "type": "text",
      "ts": "unknown>"
    },
    {
      "key": "options",
      "optional": true,
      "type": "text",
      "ts": "unknown",
      "def": "",
      "content": null,
      "label": "options"
    }
  ],
  "structures.setSpritesheetIndex": [
    {
      "key": "structure",
      "optional": false,
      "type": "text",
      "ts": "unknown",
      "def": "",
      "content": "structure",
      "label": "structure"
    },
    {
      "key": "index",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "index"
    }
  ],
  "structures.setSpritesheetIndexAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "index",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "index"
    }
  ],
  "structures.setSpritesheetIndexByValue": [
    {
      "key": "structure",
      "optional": false,
      "type": "text",
      "ts": "unknown",
      "def": "",
      "content": "structure",
      "label": "structure"
    },
    {
      "key": "value",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "value"
    },
    {
      "key": "thresholds",
      "optional": false,
      "type": "number",
      "ts": "number[]",
      "def": "",
      "content": null,
      "label": "thresholds"
    }
  ],
  "structures.setSpritesheetIndexByValueAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "value",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "value"
    },
    {
      "key": "thresholds",
      "optional": false,
      "type": "number",
      "ts": "number[]",
      "def": "",
      "content": null,
      "label": "thresholds"
    }
  ],
  "structures.mapValueToSpritesheetIndex": [
    {
      "key": "value",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "value"
    },
    {
      "key": "thresholds",
      "optional": false,
      "type": "number",
      "ts": "number[]",
      "def": "",
      "content": null,
      "label": "thresholds"
    }
  ],
  "structures.processing.isEnabledAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    }
  ],
  "structures.processing.setEnabledAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "enabled",
      "optional": false,
      "type": "bool",
      "ts": "boolean",
      "def": "",
      "content": null,
      "label": "enabled"
    }
  ],
  "structures.addVariant": [
    {
      "key": "base",
      "optional": false,
      "type": "number",
      "ts": "string | number",
      "def": "",
      "content": null,
      "label": "base"
    },
    {
      "key": "variant",
      "optional": false,
      "type": "text",
      "ts": "unknown",
      "def": "",
      "content": null,
      "label": "variant"
    },
    {
      "key": "options",
      "optional": true,
      "type": "text",
      "ts": "unknown",
      "def": "",
      "content": null,
      "label": "options"
    }
  ],
  "structures.getAvailableTypes": [],
  "structures.getDefinitionByType": [
    {
      "key": "ref",
      "optional": false,
      "type": "number",
      "ts": "number | string",
      "def": "",
      "content": null,
      "label": "ref"
    }
  ],
  "structures.getIdByType": [
    {
      "key": "t",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "t"
    }
  ],
  "structures.getTypeById": [
    {
      "key": "id",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "id"
    }
  ],
  "structures.countOfType": [
    {
      "key": "ref",
      "optional": false,
      "type": "number",
      "ts": "number | string",
      "def": "",
      "content": null,
      "label": "ref"
    }
  ],
  "items.updateDefinition": [
    {
      "key": "idOrType",
      "optional": false,
      "type": "number",
      "ts": "string | number",
      "def": "",
      "content": null,
      "label": "idOrType"
    },
    {
      "key": "partial",
      "optional": false,
      "type": "json",
      "ts": "Record<string",
      "def": "",
      "content": null,
      "label": "partial"
    },
    {
      "key": "unknown",
      "optional": false,
      "type": "text",
      "ts": "unknown>"
    }
  ],
  "items.getRegisteredIds": [],
  "items.getDefinitionById": [
    {
      "key": "id",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "id"
    }
  ],
  "items.getRegistered": [],
  "items.getAll": [],
  "items.list": [],
  "tech.updateDefinition": [
    {
      "key": "id",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "id"
    },
    {
      "key": "partial",
      "optional": false,
      "type": "json",
      "ts": "Record<string",
      "def": "",
      "content": null,
      "label": "partial"
    },
    {
      "key": "unknown",
      "optional": false,
      "type": "text",
      "ts": "unknown>"
    }
  ],
  "tech.conservatory.appendUnlock": [
    {
      "key": "techId",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "techId"
    },
    {
      "key": "unlocks",
      "optional": false,
      "type": "json",
      "ts": "Record<string",
      "def": "",
      "content": null,
      "label": "unlocks"
    },
    {
      "key": "unknown",
      "optional": false,
      "type": "text",
      "ts": "unknown>"
    }
  ],
  "terrains.getDataAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    }
  ],
  "terrains.getHitPointsAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    }
  ],
  "terrains.getTypeAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    }
  ],
  "terrains.isAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    }
  ],
  "terrains.isTypeAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "id",
      "optional": false,
      "type": "number",
      "ts": "string | number",
      "def": "",
      "content": null,
      "label": "id"
    }
  ],
  "terrains.isCellIdTerrain": [
    {
      "key": "cellId",
      "optional": false,
      "type": "text",
      "ts": "unknown",
      "def": "",
      "content": null,
      "label": "cellId"
    }
  ],
  "terrains.damageAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "damage",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "damage"
    }
  ],
  "terrains.setHitPointsAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "hitPoints",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "hitPoints"
    }
  ],
  "terrains.getTypeById": [
    {
      "key": "id",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "id"
    }
  ],
  "terrains.updateDefinition": [
    {
      "key": "idOrType",
      "optional": false,
      "type": "number",
      "ts": "string | number",
      "def": "",
      "content": null,
      "label": "idOrType"
    },
    {
      "key": "partial",
      "optional": false,
      "type": "json",
      "ts": "Record<string",
      "def": "",
      "content": null,
      "label": "partial"
    },
    {
      "key": "unknown",
      "optional": false,
      "type": "text",
      "ts": "unknown>"
    }
  ],
  "terrains.getIdByType": [
    {
      "key": "t",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "t"
    }
  ],
  "terrains.getDefinitionByType": [
    {
      "key": "t",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "t"
    }
  ],
  "upgrades.updateDefinition": [
    {
      "key": "itemId",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "itemId"
    },
    {
      "key": "upgradeId",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "upgradeId"
    },
    {
      "key": "partial",
      "optional": false,
      "type": "json",
      "ts": "Record<string",
      "def": "",
      "content": null,
      "label": "partial"
    },
    {
      "key": "unknown",
      "optional": false,
      "type": "text",
      "ts": "unknown>"
    }
  ],
  "upgrades.setLevelById": [
    {
      "key": "itemId",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "itemId"
    },
    {
      "key": "upgradeId",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "upgradeId"
    },
    {
      "key": "level",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "level"
    }
  ],
  "ui.toast": [
    {
      "key": "message",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "message"
    }
  ],
  "hooks.hasHooks": [],
  "assets.getUrl": [
    {
      "key": "path",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "path"
    }
  ],
  "sprites.load": [
    {
      "key": "id",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "id"
    },
    {
      "key": "path",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "path"
    },
    {
      "key": "options",
      "optional": true,
      "type": "json",
      "ts": "Record<string",
      "def": "",
      "content": null,
      "label": "options"
    },
    {
      "key": "unknown",
      "optional": false,
      "type": "text",
      "ts": "unknown>"
    }
  ],
  "sprites.loadFromMod": [
    {
      "key": "id",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "id"
    },
    {
      "key": "path",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "path"
    },
    {
      "key": "options",
      "optional": true,
      "type": "json",
      "ts": "Record<string",
      "def": "",
      "content": null,
      "label": "options"
    },
    {
      "key": "unknown",
      "optional": false,
      "type": "text",
      "ts": "unknown>"
    }
  ],
  "sprites.namespace": [],
  "sprites.getRegistered": [],
  "sprites.getLoaded": [],
  "sprites.getAll": [],
  "sprites.list": [],
  "input.getMouseCellPosition": [],
  "signals.setOutputAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "value",
      "optional": false,
      "type": "bool",
      "ts": "boolean",
      "def": "",
      "content": null,
      "label": "value"
    }
  ],
  "energy.addAtCell": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "amount",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "amount"
    }
  ],
  "energy.consume": [
    {
      "key": "amount",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "amount"
    },
    {
      "key": "options",
      "optional": true,
      "type": "json",
      "ts": "Record<string",
      "def": "",
      "content": null,
      "label": "options"
    },
    {
      "key": "unknown",
      "optional": false,
      "type": "text",
      "ts": "unknown>"
    }
  ],
  "effects.createParticlesAtWorld": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "options",
      "optional": false,
      "type": "number",
      "ts": "{ count?: number; [key: string]: unknown }",
      "def": "",
      "content": null,
      "label": "options"
    }
  ],
  "effects.includes": [
    {
      "key": "effect",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "effect"
    }
  ],
  "projectiles.createBlueprintFromId": [
    {
      "key": "id",
      "optional": false,
      "type": "text",
      "ts": "string",
      "def": "",
      "content": null,
      "label": "id"
    }
  ],
  "projectiles.spawnAtWorld": [
    {
      "key": "cell",
      "label": "cell",
      "type": "cell",
      "optional": false,
      "ts": "{ x: number, y: number }",
      "def": "",
      "content": null,
      "keys": [
        "x",
        "y"
      ]
    },
    {
      "key": "angle",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "angle"
    },
    {
      "key": "blueprint",
      "optional": false,
      "type": "text",
      "ts": "unknown",
      "def": "",
      "content": null,
      "label": "blueprint"
    }
  ],
  "random.int": [
    {
      "key": "min",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "min"
    },
    {
      "key": "max",
      "optional": false,
      "type": "number",
      "ts": "number",
      "def": "",
      "content": null,
      "label": "max"
    }
  ]
};
  const PROGRAM_V2_DOCS = {
  "toast": "mysandkit api.toast(msg: string, opts?: Record<string, unknown>) \u2192 unknown",
  "storage.ensure": "mysandkit api.storage.ensure() \u2192 unknown",
  "storage.set": "mysandkit api.storage.set(key: string, value: unknown) \u2192 unknown",
  "storage.remove": "mysandkit api.storage.remove(key: string) \u2192 unknown",
  "storage.ensureFor": "mysandkit api.storage.ensureFor(modId: string) \u2192 unknown",
  "storage.removeFor": "mysandkit api.storage.removeFor(modId: string, key: string) \u2192 unknown",
  "settings.get": "mysandkit api.settings.get(fieldId: string) \u2192 unknown",
  "rendering.getGridMetrics": "mysandkit api.rendering.getGridMetrics() \u2192 unknown",
  "rendering.getDrawPositionAtCell": "mysandkit api.rendering.getDrawPositionAtCell(cx: number, cy: number) \u2192 unknown",
  "elements.updateDefinition": "mysandkit api.elements.updateDefinition(idOrType: string | number, partial: Record<string, unknown>) \u2192 unknown",
  "elements.addInteractionInfo": "mysandkit api.elements.addInteractionInfo(idOrType: string | number, interaction: unknown) \u2192 unknown",
  "elements.addElementToDiscoveries": "mysandkit api.elements.addElementToDiscoveries(elementType: number) \u2192 unknown",
  "elements.getTypeById": "mysandkit api.elements.getTypeById(id: string) \u2192 number | undefined",
  "elements.getRegisteredTypes": "mysandkit api.elements.getRegisteredTypes() \u2192 number[]",
  "elements.getDefinitionByType": "mysandkit api.elements.getDefinitionByType(t: number) \u2192 Record<string, unknown> | undefined",
  "elements.getIdByType": "mysandkit api.elements.getIdByType(t: number) \u2192 string | undefined",
  "elements.getNameByType": "mysandkit api.elements.getNameByType(t: number) \u2192 string | undefined",
  "elements.getResolvedTypeAtCell": "mysandkit api.elements.getResolvedTypeAtCell(x: number, y: number) \u2192 number | undefined",
  "elements.getTypeAtCell": "mysandkit api.elements.getTypeAtCell(x: number, y: number) \u2192 number | null",
  "elements.getTypeFromId": "mysandkit api.elements.getTypeFromId(id: string) \u2192 number | null",
  "elements.isTypeAtCell": "mysandkit api.elements.isTypeAtCell(x: number, y: number, type: number) \u2192 boolean",
  "elements.setVelocityAtCell": "mysandkit api.elements.setVelocityAtCell(x: number,\n            y: number,\n            velocity: { x: number; y: number },) \u2192 boolean",
  "elements.addParticleVelocityAtCell": "mysandkit api.elements.addParticleVelocityAtCell(x: number,\n            y: number,\n            velocity: { x: number; y: number },\n            maxSpeed?: number,) \u2192 boolean",
  "elements.setDurationAtCell": "mysandkit api.elements.setDurationAtCell(x: number,\n            y: number,\n            n: number,\n            opts?: { updateMax?: boolean },) \u2192 boolean",
  "elements.removeAtCell": "mysandkit api.elements.removeAtCell(x: number, y: number, options?: unknown) \u2192 boolean",
  "elements.removeAtCellWhenIdle": "mysandkit api.elements.removeAtCellWhenIdle(x: number, y: number, options?: unknown) \u2192 boolean",
  "elements.convertToParticleAtCell": "mysandkit api.elements.convertToParticleAtCell(x: number,\n            y: number,\n            velocity: { x: number; y: number },\n            options?: unknown,) \u2192 boolean",
  "elements.getDataFieldAtCell": "mysandkit api.elements.getDataFieldAtCell(x: number, y: number, field: number) \u2192 number | null",
  "elements.setDataFieldAtCell": "mysandkit api.elements.setDataFieldAtCell(x: number,\n            y: number,\n            field: number,\n            value: number,) \u2192 void",
  "elements.getVelocityAtCell": "mysandkit api.elements.getVelocityAtCell(x: number, y: number) \u2192 unknown",
  "elements.teleportBetweenCells": "mysandkit api.elements.teleportBetweenCells(fromX: number,\n            fromY: number,\n            toX: number,\n            toY: number,) \u2192 boolean",
  "elements.findFreeCellInStructure": "mysandkit api.elements.findFreeCellInStructure(x: number,\n            y: number,\n            size: number,) \u2192 unknown",
  "grid.isCellEmptyAtCell": "mysandkit api.grid.isCellEmptyAtCell(x: number, y: number) \u2192 boolean | undefined",
  "grid.isTerrainAtCell": "mysandkit api.grid.isTerrainAtCell(x: number, y: number) \u2192 boolean",
  "grid.reportActivityAtCell": "mysandkit api.grid.reportActivityAtCell(x: number, y: number) \u2192 void",
  "grid.excavateAtCell": "mysandkit api.grid.excavateAtCell(x: number,\n            y: number,\n            outVelocity: Record<string, number>,\n            damage: number,\n            opts?: Record<string, unknown>,) \u2192 void",
  "player.inventory.addById": "mysandkit api.player.inventory.addById(itemId: string,\n                amount = 1,) \u2192 boolean",
  "player.buildings.unlockById": "mysandkit api.player.buildings.unlockById(structureId: string) \u2192 boolean",
  "player.buildings.removeById": "mysandkit api.player.buildings.removeById(structureId: string) \u2192 boolean",
  "structures.updateDefinition": "mysandkit api.structures.updateDefinition(idOrType: string | number,\n            partial: Record<string, unknown>,\n            options?: { useRawShape?: boolean },) \u2192 void",
  "structures.getRegisteredTypes": "mysandkit api.structures.getRegisteredTypes() \u2192 number[]",
  "structures.getUnlockedTypes": "mysandkit api.structures.getUnlockedTypes() \u2192 number[]",
  "structures.getTypeName": "mysandkit api.structures.getTypeName(t: number) \u2192 string | undefined",
  "structures.getAll": "mysandkit api.structures.getAll() \u2192 Record<string, unknown>[]",
  "structures.getRegistered": "mysandkit api.structures.getRegistered() \u2192 Record<string, unknown>[]",
  "structures.list": "mysandkit api.structures.list() \u2192 Record<string, unknown>[]",
  "structures.includes": "mysandkit api.structures.includes(idOrType: string | number) \u2192 boolean",
  "structures.getAtCell": "mysandkit api.structures.getAtCell(x: number, y: number) \u2192 Record<string, unknown> | null",
  "structures.hasBuiltAtCell": "mysandkit api.structures.hasBuiltAtCell(x: number, y: number) \u2192 boolean",
  "structures.isTypeAtCell": "mysandkit api.structures.isTypeAtCell(x: number, y: number, ref: string | number) \u2192 boolean",
  "structures.isType": "mysandkit api.structures.isType(structure: unknown, ref: string) \u2192 boolean",
  "structures.isBlockedByPlayerAtCell": "mysandkit api.structures.isBlockedByPlayerAtCell(x: number, y: number) \u2192 boolean",
  "structures.isLauncherAtCell": "mysandkit api.structures.isLauncherAtCell(x: number, y: number) \u2192 boolean",
  "structures.buildAtCell": "mysandkit api.structures.buildAtCell(x: number, y: number, ref: string, options?: unknown) \u2192 boolean",
  "structures.removeAtCell": "mysandkit api.structures.removeAtCell(x: number, y: number, options?: unknown) \u2192 boolean",
  "structures.removeAtCells": "mysandkit api.structures.removeAtCells(positions: { x: number; y: number }[],\n            options?: unknown,) \u2192 boolean",
  "structures.update": "mysandkit api.structures.update(structure: unknown, options?: unknown) \u2192 boolean",
  "structures.updateData": "mysandkit api.structures.updateData(structure: unknown,\n            partial: Record<string, unknown>,\n            options?: unknown,) \u2192 boolean",
  "structures.setSpritesheetIndex": "mysandkit api.structures.setSpritesheetIndex(structure: unknown, index: number) \u2192 boolean",
  "structures.setSpritesheetIndexAtCell": "mysandkit api.structures.setSpritesheetIndexAtCell(x: number, y: number, index: number) \u2192 boolean",
  "structures.setSpritesheetIndexByValue": "mysandkit api.structures.setSpritesheetIndexByValue(structure: unknown,\n            value: number,\n            thresholds: number[],) \u2192 boolean",
  "structures.setSpritesheetIndexByValueAtCell": "mysandkit api.structures.setSpritesheetIndexByValueAtCell(x: number,\n            y: number,\n            value: number,\n            thresholds: number[],) \u2192 boolean",
  "structures.mapValueToSpritesheetIndex": "mysandkit api.structures.mapValueToSpritesheetIndex(value: number, thresholds: number[]) \u2192 number",
  "structures.processing.isEnabledAtCell": "mysandkit api.structures.processing.isEnabledAtCell(x: number, y: number) \u2192 boolean",
  "structures.processing.setEnabledAtCell": "mysandkit api.structures.processing.setEnabledAtCell(x: number, y: number, enabled: boolean) \u2192 boolean",
  "structures.addVariant": "mysandkit api.structures.addVariant(base: string | number, variant: unknown, options?: unknown) \u2192 void",
  "structures.getAvailableTypes": "mysandkit api.structures.getAvailableTypes() \u2192 Set<number | string>",
  "structures.getDefinitionByType": "mysandkit api.structures.getDefinitionByType(ref: number | string) \u2192 Record<string, unknown> | undefined",
  "structures.getIdByType": "mysandkit api.structures.getIdByType(t: number) \u2192 string | undefined",
  "structures.getTypeById": "mysandkit api.structures.getTypeById(id: string) \u2192 number | string",
  "structures.countOfType": "mysandkit api.structures.countOfType(ref: number | string) \u2192 number | null",
  "items.updateDefinition": "mysandkit api.items.updateDefinition(idOrType: string | number, partial: Record<string, unknown>) \u2192 void",
  "items.getRegisteredIds": "mysandkit api.items.getRegisteredIds() \u2192 string[]",
  "items.getDefinitionById": "mysandkit api.items.getDefinitionById(id: string) \u2192 Record<string, unknown> | undefined",
  "items.getRegistered": "mysandkit api.items.getRegistered() \u2192 Record<string, unknown>[]",
  "items.getAll": "mysandkit api.items.getAll() \u2192 Record<string, unknown>[]",
  "items.list": "mysandkit api.items.list() \u2192 Record<string, unknown>[]",
  "tech.updateDefinition": "mysandkit api.tech.updateDefinition(id: string, partial: Record<string, unknown>) \u2192 void",
  "tech.conservatory.appendUnlock": "mysandkit api.tech.conservatory.appendUnlock(techId: string, unlocks: Record<string, unknown>) \u2192 boolean",
  "terrains.getDataAtCell": "mysandkit api.terrains.getDataAtCell(x: number, y: number) \u2192 Record<string, unknown> | null",
  "terrains.getHitPointsAtCell": "mysandkit api.terrains.getHitPointsAtCell(x: number, y: number) \u2192 number | null",
  "terrains.getTypeAtCell": "mysandkit api.terrains.getTypeAtCell(x: number, y: number) \u2192 number | null",
  "terrains.isAtCell": "mysandkit api.terrains.isAtCell(x: number, y: number) \u2192 boolean",
  "terrains.isTypeAtCell": "mysandkit api.terrains.isTypeAtCell(x: number, y: number, id: string | number) \u2192 boolean",
  "terrains.isCellIdTerrain": "mysandkit api.terrains.isCellIdTerrain(cellId: unknown) \u2192 boolean",
  "terrains.damageAtCell": "mysandkit api.terrains.damageAtCell(x: number, y: number, damage: number) \u2192 boolean",
  "terrains.setHitPointsAtCell": "mysandkit api.terrains.setHitPointsAtCell(x: number, y: number, hitPoints: number) \u2192 boolean",
  "terrains.getTypeById": "mysandkit api.terrains.getTypeById(id: string) \u2192 number | null",
  "terrains.updateDefinition": "mysandkit api.terrains.updateDefinition(idOrType: string | number, partial: Record<string, unknown>) \u2192 void",
  "terrains.getIdByType": "mysandkit api.terrains.getIdByType(t: number) \u2192 string | undefined",
  "terrains.getDefinitionByType": "mysandkit api.terrains.getDefinitionByType(t: number) \u2192 Record<string, unknown> | undefined",
  "upgrades.updateDefinition": "mysandkit api.upgrades.updateDefinition(itemId: string,\n            upgradeId: string,\n            partial: Record<string, unknown>,) \u2192 void",
  "upgrades.setLevelById": "mysandkit api.upgrades.setLevelById(itemId: string, upgradeId: string, level: number) \u2192 void",
  "ui.toast": "mysandkit api.ui.toast(message: string) \u2192 void",
  "hooks.hasHooks": "mysandkit api.hooks.hasHooks() \u2192 boolean",
  "assets.getUrl": "mysandkit api.assets.getUrl(path: string) \u2192 string | undefined",
  "sprites.load": "mysandkit api.sprites.load(id: string, path: string, options?: Record<string, unknown>) \u2192 unknown",
  "sprites.loadFromMod": "mysandkit api.sprites.loadFromMod(id: string, path: string, options?: Record<string, unknown>) \u2192 unknown",
  "sprites.namespace": "mysandkit api.sprites.namespace() \u2192 string | undefined",
  "sprites.getRegistered": "mysandkit api.sprites.getRegistered() \u2192 string[]",
  "sprites.getLoaded": "mysandkit api.sprites.getLoaded() \u2192 string[]",
  "sprites.getAll": "mysandkit api.sprites.getAll() \u2192 string[]",
  "sprites.list": "mysandkit api.sprites.list() \u2192 string[]",
  "input.getMouseCellPosition": "mysandkit api.input.getMouseCellPosition() \u2192 unknown",
  "signals.setOutputAtCell": "mysandkit api.signals.setOutputAtCell(x: number, y: number, value: boolean) \u2192 void",
  "energy.addAtCell": "mysandkit api.energy.addAtCell(x: number, y: number, amount: number) \u2192 void",
  "energy.consume": "mysandkit api.energy.consume(amount: number, options?: Record<string, unknown>) \u2192 number",
  "effects.createParticlesAtWorld": "mysandkit api.effects.createParticlesAtWorld(x: number,\n            y: number,\n            options: { count?: number; [key: string]: unknown },) \u2192 void",
  "effects.includes": "mysandkit api.effects.includes(effect: string) \u2192 boolean",
  "projectiles.createBlueprintFromId": "mysandkit api.projectiles.createBlueprintFromId(id: string) \u2192 unknown",
  "projectiles.spawnAtWorld": "mysandkit api.projectiles.spawnAtWorld(x: number, y: number, angle: number, blueprint: unknown) \u2192 void",
  "random.int": "mysandkit api.random.int(min: number, max: number) \u2192 number | undefined"
};
  const PROGRAM_V2_RETURNS = {
  "toast": "unknown",
  "storage.ensure": "unknown",
  "storage.set": "unknown",
  "storage.remove": "unknown",
  "storage.ensureFor": "unknown",
  "storage.removeFor": "unknown",
  "settings.get": "unknown",
  "rendering.getGridMetrics": "unknown",
  "rendering.getDrawPositionAtCell": "unknown",
  "elements.updateDefinition": "unknown",
  "elements.addInteractionInfo": "unknown",
  "elements.addElementToDiscoveries": "unknown",
  "elements.getTypeById": "number | undefined",
  "elements.getRegisteredTypes": "number[]",
  "elements.getDefinitionByType": "Record<string, unknown> | undefined",
  "elements.getIdByType": "string | undefined",
  "elements.getNameByType": "string | undefined",
  "elements.getResolvedTypeAtCell": "number | undefined",
  "elements.getTypeAtCell": "number | null",
  "elements.getTypeFromId": "number | null",
  "elements.isTypeAtCell": "boolean",
  "elements.setVelocityAtCell": "boolean",
  "elements.addParticleVelocityAtCell": "boolean",
  "elements.setDurationAtCell": "boolean",
  "elements.removeAtCell": "boolean",
  "elements.removeAtCellWhenIdle": "boolean",
  "elements.convertToParticleAtCell": "boolean",
  "elements.getDataFieldAtCell": "number | null",
  "elements.setDataFieldAtCell": "void",
  "elements.getVelocityAtCell": "unknown",
  "elements.teleportBetweenCells": "boolean",
  "elements.findFreeCellInStructure": "unknown",
  "grid.isCellEmptyAtCell": "boolean | undefined",
  "grid.isTerrainAtCell": "boolean",
  "grid.reportActivityAtCell": "void",
  "grid.excavateAtCell": "void",
  "player.inventory.addById": "boolean",
  "player.buildings.unlockById": "boolean",
  "player.buildings.removeById": "boolean",
  "structures.updateDefinition": "void",
  "structures.getRegisteredTypes": "number[]",
  "structures.getUnlockedTypes": "number[]",
  "structures.getTypeName": "string | undefined",
  "structures.getAll": "Record<string, unknown>[]",
  "structures.getRegistered": "Record<string, unknown>[]",
  "structures.list": "Record<string, unknown>[]",
  "structures.includes": "boolean",
  "structures.getAtCell": "Record<string, unknown> | null",
  "structures.hasBuiltAtCell": "boolean",
  "structures.isTypeAtCell": "boolean",
  "structures.isType": "boolean",
  "structures.isBlockedByPlayerAtCell": "boolean",
  "structures.isLauncherAtCell": "boolean",
  "structures.buildAtCell": "boolean",
  "structures.removeAtCell": "boolean",
  "structures.removeAtCells": "boolean",
  "structures.update": "boolean",
  "structures.updateData": "boolean",
  "structures.setSpritesheetIndex": "boolean",
  "structures.setSpritesheetIndexAtCell": "boolean",
  "structures.setSpritesheetIndexByValue": "boolean",
  "structures.setSpritesheetIndexByValueAtCell": "boolean",
  "structures.mapValueToSpritesheetIndex": "number",
  "structures.processing.isEnabledAtCell": "boolean",
  "structures.processing.setEnabledAtCell": "boolean",
  "structures.addVariant": "void",
  "structures.getAvailableTypes": "Set<number | string>",
  "structures.getDefinitionByType": "Record<string, unknown> | undefined",
  "structures.getIdByType": "string | undefined",
  "structures.getTypeById": "number | string",
  "structures.countOfType": "number | null",
  "items.updateDefinition": "void",
  "items.getRegisteredIds": "string[]",
  "items.getDefinitionById": "Record<string, unknown> | undefined",
  "items.getRegistered": "Record<string, unknown>[]",
  "items.getAll": "Record<string, unknown>[]",
  "items.list": "Record<string, unknown>[]",
  "tech.updateDefinition": "void",
  "tech.conservatory.appendUnlock": "boolean",
  "terrains.getDataAtCell": "Record<string, unknown> | null",
  "terrains.getHitPointsAtCell": "number | null",
  "terrains.getTypeAtCell": "number | null",
  "terrains.isAtCell": "boolean",
  "terrains.isTypeAtCell": "boolean",
  "terrains.isCellIdTerrain": "boolean",
  "terrains.damageAtCell": "boolean",
  "terrains.setHitPointsAtCell": "boolean",
  "terrains.getTypeById": "number | null",
  "terrains.updateDefinition": "void",
  "terrains.getIdByType": "string | undefined",
  "terrains.getDefinitionByType": "Record<string, unknown> | undefined",
  "upgrades.updateDefinition": "void",
  "upgrades.setLevelById": "void",
  "ui.toast": "void",
  "hooks.hasHooks": "boolean",
  "assets.getUrl": "string | undefined",
  "sprites.load": "unknown",
  "sprites.loadFromMod": "unknown",
  "sprites.namespace": "string | undefined",
  "sprites.getRegistered": "string[]",
  "sprites.getLoaded": "string[]",
  "sprites.getAll": "string[]",
  "sprites.list": "string[]",
  "input.getMouseCellPosition": "unknown",
  "signals.setOutputAtCell": "void",
  "energy.addAtCell": "void",
  "energy.consume": "number",
  "effects.createParticlesAtWorld": "void",
  "effects.includes": "boolean",
  "projectiles.createBlueprintFromId": "unknown",
  "projectiles.spawnAtWorld": "void",
  "random.int": "number | undefined"
};
  const PROGRAM_V2_META = {
  "toast": {
    "cell": false,
    "returns": false,
    "returnType": "unknown"
  },
  "storage.ensure": {
    "cell": false,
    "returns": false,
    "returnType": "unknown"
  },
  "storage.set": {
    "cell": false,
    "returns": false,
    "returnType": "unknown"
  },
  "storage.remove": {
    "cell": false,
    "returns": false,
    "returnType": "unknown"
  },
  "storage.ensureFor": {
    "cell": false,
    "returns": false,
    "returnType": "unknown"
  },
  "storage.removeFor": {
    "cell": false,
    "returns": false,
    "returnType": "unknown"
  },
  "settings.get": {
    "cell": false,
    "returns": false,
    "returnType": "unknown"
  },
  "rendering.getGridMetrics": {
    "cell": false,
    "returns": false,
    "returnType": "unknown"
  },
  "rendering.getDrawPositionAtCell": {
    "cell": true,
    "returns": false,
    "returnType": "unknown"
  },
  "elements.updateDefinition": {
    "cell": false,
    "returns": false,
    "returnType": "unknown"
  },
  "elements.addInteractionInfo": {
    "cell": false,
    "returns": false,
    "returnType": "unknown"
  },
  "elements.addElementToDiscoveries": {
    "cell": false,
    "returns": false,
    "returnType": "unknown"
  },
  "elements.getTypeById": {
    "cell": false,
    "returns": true,
    "returnType": "number | undefined"
  },
  "elements.getRegisteredTypes": {
    "cell": false,
    "returns": true,
    "returnType": "number[]"
  },
  "elements.getDefinitionByType": {
    "cell": false,
    "returns": true,
    "returnType": "Record<string, unknown> | undefined"
  },
  "elements.getIdByType": {
    "cell": false,
    "returns": true,
    "returnType": "string | undefined"
  },
  "elements.getNameByType": {
    "cell": false,
    "returns": true,
    "returnType": "string | undefined"
  },
  "elements.getResolvedTypeAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "number | undefined"
  },
  "elements.getTypeAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "number | null"
  },
  "elements.getTypeFromId": {
    "cell": false,
    "returns": true,
    "returnType": "number | null"
  },
  "elements.isTypeAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "elements.setVelocityAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "elements.addParticleVelocityAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "elements.setDurationAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "elements.removeAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "elements.removeAtCellWhenIdle": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "elements.convertToParticleAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "elements.getDataFieldAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "number | null"
  },
  "elements.setDataFieldAtCell": {
    "cell": true,
    "returns": false,
    "returnType": "void"
  },
  "elements.getVelocityAtCell": {
    "cell": true,
    "returns": false,
    "returnType": "unknown"
  },
  "elements.teleportBetweenCells": {
    "cell": false,
    "returns": true,
    "returnType": "boolean"
  },
  "elements.findFreeCellInStructure": {
    "cell": true,
    "returns": false,
    "returnType": "unknown"
  },
  "grid.isCellEmptyAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean | undefined"
  },
  "grid.isTerrainAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "grid.reportActivityAtCell": {
    "cell": true,
    "returns": false,
    "returnType": "void"
  },
  "grid.excavateAtCell": {
    "cell": true,
    "returns": false,
    "returnType": "void"
  },
  "player.inventory.addById": {
    "cell": false,
    "returns": true,
    "returnType": "boolean"
  },
  "player.buildings.unlockById": {
    "cell": false,
    "returns": true,
    "returnType": "boolean"
  },
  "player.buildings.removeById": {
    "cell": false,
    "returns": true,
    "returnType": "boolean"
  },
  "structures.updateDefinition": {
    "cell": false,
    "returns": false,
    "returnType": "void"
  },
  "structures.getRegisteredTypes": {
    "cell": false,
    "returns": true,
    "returnType": "number[]"
  },
  "structures.getUnlockedTypes": {
    "cell": false,
    "returns": true,
    "returnType": "number[]"
  },
  "structures.getTypeName": {
    "cell": false,
    "returns": true,
    "returnType": "string | undefined"
  },
  "structures.getAll": {
    "cell": false,
    "returns": true,
    "returnType": "Record<string, unknown>[]"
  },
  "structures.getRegistered": {
    "cell": false,
    "returns": true,
    "returnType": "Record<string, unknown>[]"
  },
  "structures.list": {
    "cell": false,
    "returns": true,
    "returnType": "Record<string, unknown>[]"
  },
  "structures.includes": {
    "cell": false,
    "returns": true,
    "returnType": "boolean"
  },
  "structures.getAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "Record<string, unknown> | null"
  },
  "structures.hasBuiltAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "structures.isTypeAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "structures.isType": {
    "cell": false,
    "returns": true,
    "returnType": "boolean"
  },
  "structures.isBlockedByPlayerAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "structures.isLauncherAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "structures.buildAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "structures.removeAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "structures.removeAtCells": {
    "cell": false,
    "returns": true,
    "returnType": "boolean"
  },
  "structures.update": {
    "cell": false,
    "returns": true,
    "returnType": "boolean"
  },
  "structures.updateData": {
    "cell": false,
    "returns": true,
    "returnType": "boolean"
  },
  "structures.setSpritesheetIndex": {
    "cell": false,
    "returns": true,
    "returnType": "boolean"
  },
  "structures.setSpritesheetIndexAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "structures.setSpritesheetIndexByValue": {
    "cell": false,
    "returns": true,
    "returnType": "boolean"
  },
  "structures.setSpritesheetIndexByValueAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "structures.mapValueToSpritesheetIndex": {
    "cell": false,
    "returns": true,
    "returnType": "number"
  },
  "structures.processing.isEnabledAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "structures.processing.setEnabledAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "structures.addVariant": {
    "cell": false,
    "returns": false,
    "returnType": "void"
  },
  "structures.getAvailableTypes": {
    "cell": false,
    "returns": true,
    "returnType": "Set<number | string>"
  },
  "structures.getDefinitionByType": {
    "cell": false,
    "returns": true,
    "returnType": "Record<string, unknown> | undefined"
  },
  "structures.getIdByType": {
    "cell": false,
    "returns": true,
    "returnType": "string | undefined"
  },
  "structures.getTypeById": {
    "cell": false,
    "returns": true,
    "returnType": "number | string"
  },
  "structures.countOfType": {
    "cell": false,
    "returns": true,
    "returnType": "number | null"
  },
  "items.updateDefinition": {
    "cell": false,
    "returns": false,
    "returnType": "void"
  },
  "items.getRegisteredIds": {
    "cell": false,
    "returns": true,
    "returnType": "string[]"
  },
  "items.getDefinitionById": {
    "cell": false,
    "returns": true,
    "returnType": "Record<string, unknown> | undefined"
  },
  "items.getRegistered": {
    "cell": false,
    "returns": true,
    "returnType": "Record<string, unknown>[]"
  },
  "items.getAll": {
    "cell": false,
    "returns": true,
    "returnType": "Record<string, unknown>[]"
  },
  "items.list": {
    "cell": false,
    "returns": true,
    "returnType": "Record<string, unknown>[]"
  },
  "tech.updateDefinition": {
    "cell": false,
    "returns": false,
    "returnType": "void"
  },
  "tech.conservatory.appendUnlock": {
    "cell": false,
    "returns": true,
    "returnType": "boolean"
  },
  "terrains.getDataAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "Record<string, unknown> | null"
  },
  "terrains.getHitPointsAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "number | null"
  },
  "terrains.getTypeAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "number | null"
  },
  "terrains.isAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "terrains.isTypeAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "terrains.isCellIdTerrain": {
    "cell": false,
    "returns": true,
    "returnType": "boolean"
  },
  "terrains.damageAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "terrains.setHitPointsAtCell": {
    "cell": true,
    "returns": true,
    "returnType": "boolean"
  },
  "terrains.getTypeById": {
    "cell": false,
    "returns": true,
    "returnType": "number | null"
  },
  "terrains.updateDefinition": {
    "cell": false,
    "returns": false,
    "returnType": "void"
  },
  "terrains.getIdByType": {
    "cell": false,
    "returns": true,
    "returnType": "string | undefined"
  },
  "terrains.getDefinitionByType": {
    "cell": false,
    "returns": true,
    "returnType": "Record<string, unknown> | undefined"
  },
  "upgrades.updateDefinition": {
    "cell": false,
    "returns": false,
    "returnType": "void"
  },
  "upgrades.setLevelById": {
    "cell": false,
    "returns": false,
    "returnType": "void"
  },
  "ui.toast": {
    "cell": false,
    "returns": false,
    "returnType": "void"
  },
  "hooks.hasHooks": {
    "cell": false,
    "returns": true,
    "returnType": "boolean"
  },
  "assets.getUrl": {
    "cell": false,
    "returns": true,
    "returnType": "string | undefined"
  },
  "sprites.load": {
    "cell": false,
    "returns": false,
    "returnType": "unknown"
  },
  "sprites.loadFromMod": {
    "cell": false,
    "returns": false,
    "returnType": "unknown"
  },
  "sprites.namespace": {
    "cell": false,
    "returns": true,
    "returnType": "string | undefined"
  },
  "sprites.getRegistered": {
    "cell": false,
    "returns": true,
    "returnType": "string[]"
  },
  "sprites.getLoaded": {
    "cell": false,
    "returns": true,
    "returnType": "string[]"
  },
  "sprites.getAll": {
    "cell": false,
    "returns": true,
    "returnType": "string[]"
  },
  "sprites.list": {
    "cell": false,
    "returns": true,
    "returnType": "string[]"
  },
  "input.getMouseCellPosition": {
    "cell": false,
    "returns": false,
    "returnType": "unknown"
  },
  "signals.setOutputAtCell": {
    "cell": true,
    "returns": false,
    "returnType": "void"
  },
  "energy.addAtCell": {
    "cell": true,
    "returns": false,
    "returnType": "void"
  },
  "energy.consume": {
    "cell": false,
    "returns": true,
    "returnType": "number"
  },
  "effects.createParticlesAtWorld": {
    "cell": true,
    "returns": false,
    "returnType": "void"
  },
  "effects.includes": {
    "cell": false,
    "returns": true,
    "returnType": "boolean"
  },
  "projectiles.createBlueprintFromId": {
    "cell": false,
    "returns": false,
    "returnType": "unknown"
  },
  "projectiles.spawnAtWorld": {
    "cell": true,
    "returns": false,
    "returnType": "void"
  },
  "random.int": {
    "cell": false,
    "returns": true,
    "returnType": "number | undefined"
  }
};

  function roleOf(key) {
    if (key === "if") return "block";
    for (const [r, keys] of Object.entries(ACTIONS)) {
      if (keys.includes(key)) return r;
    }
    return "act";
  }
  function emptyConfig() {
    const c = { version: 1 };
    COLLECTIONS.forEach((col) => { c[col.key] = []; });
    // also collections not in menu but in ModConfig
    ["interactions","energyTypes"].forEach(k => { if (!c[k]) c[k]=[]; });
    return c;
  }
  return {
    ROLE_COLOR, ROLE_LABELS, SLOTS, MATTER, CATEGORIES, RECIPE_KINDS, BUILD_MODES,
    MENU_GROUPS, COLLECTIONS, FIELDS, FIELD_SECTIONS, SECTION_ORDER, ACTION_PARAMS, ACTIONS, ACTION_DOCS, ACTION_APIS, ACTION_FAMILIES, PROGRAM_V2_FAMILIES, PROGRAM_V2_PARAMS, PROGRAM_V2_DOCS, PROGRAM_V2_RETURNS, PROGRAM_V2_META, roleOf, emptyConfig,
  };
})();
