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
    { key:"content", label:"Content", hint:"What the player sees",
      items:[
        {key:"terrains", label:"Terrains", color:"#a08060"},
        {key:"elements", label:"Elements", color:"#6b9eff"},
        {key:"structures", label:"Structures", color:"#5ec4a0"},
        {key:"placementConfigs", label:"Placement fields", color:"#70a090"},
        {key:"structureBehaviors", label:"Behaviours", color:"#60b0a0"},
        {key:"signals", label:"Signals", color:"#f5b880"},
        {key:"items", label:"Items", color:"#b794f4"},
        {key:"excavationProfiles", label:"Excavation profiles", color:"#90b0a0"},
        {key:"projectiles", label:"Projectiles", color:"#b0a0e0"},
        {key:"buffers", label:"Buffer", color:"#8fbc8f"},
      ]},
    { key:"production", label:"Production", hint:"How things transform",
      items:[
        {key:"contacts", label:"Contact reactions", color:"#e8b84a"},
        {key:"recipes", label:"Machine recipes", color:"#e07a5f"},
      ]},
    { key:"tech", label:"Tech", hint:"Research & upgrades",
      items:[
        {key:"unlockNodes", label:"Unlock nodes", color:"#7aa2f7"},
        {key:"techs", label:"Tech nodes", color:"#5b8def"},
        {key:"upgrades", label:"Upgrades", color:"#c084fc"},
        {key:"upgradeCategories", label:"Upgrade categories", color:"#a78b9a"},
      ]},
    { key:"actions", label:"Actions", hint:"Player, clock & programs",
      items:[
        {key:"triggers", label:"Triggers", color:"#f0a070"},
        {key:"inputBindings", label:"Input bindings", color:"#c97a5c"},
        {key:"processing", label:"ProcessorLink", color:"#d64550"},
        {key:"modifiers", label:"Hook modifiers", color:"#e89870"},
        {key:"processes", label:"Program", color:"#fbbf24", blocky:true},
      ]},
    { key:"energy", label:"Energy", hint:"Power",
      items:[
        {key:"energyNetworks", label:"Networks", color:"#2dd4bf"},
        {key:"energyTypes", label:"Energy types", color:"#14b8a6"},
      ]},
    { key:"assets", label:"Assets", hint:"Images",
      items:[
        {key:"sprites", label:"Sprites", color:"#7ec8e3"},
      ]},
  ];
  const COLLECTIONS = MENU_GROUPS.flatMap(g => g.items);
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
    MENU_GROUPS, COLLECTIONS, FIELDS, FIELD_SECTIONS, SECTION_ORDER, ACTION_PARAMS, ACTIONS, ACTION_DOCS, ACTION_APIS, ACTION_FAMILIES, roleOf, emptyConfig,
  };
})();
