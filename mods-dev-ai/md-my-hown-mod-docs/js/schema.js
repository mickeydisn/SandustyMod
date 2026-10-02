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
  "getVelocity": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "findFreeCell": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "setVelocity": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "vx",
      "label": "Velocity X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "vy",
      "label": "Velocity Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "addVelocity": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "vx",
      "label": "Velocity X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "vy",
      "label": "Velocity Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "maxSpeed",
      "label": "Max speed",
      "type": "number",
      "hint": "cells/second. 0 = no clamp.",
      "def": "0",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "setDuration": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "ticks",
      "label": "Ticks",
      "type": "number",
      "hint": "",
      "def": "60",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "rearm",
      "label": "Rearm",
      "type": "bool",
      "hint": "also raise the maximum, so it fires again next cycle",
      "def": "false",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "teleportElement": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "tx",
      "label": "Move X",
      "type": "number",
      "hint": "",
      "def": "0",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "ty",
      "label": "Move Y",
      "type": "number",
      "hint": "1 = one cell down",
      "def": "1",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "toParticle": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "vx",
      "label": "Velocity X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "vy",
      "label": "Velocity Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "durationTicks",
      "label": "Lifetime",
      "type": "number",
      "hint": "ticks before it expires. 0 = permanent.",
      "def": "0",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "density",
      "label": "Density",
      "type": "number",
      "hint": "overrides the element's density. 0 = its own.",
      "def": "0",
      "required": false,
      "options": [],
      "content": "element"
    },
    {
      "key": "freeFalling",
      "label": "Free-falling",
      "type": "bool",
      "hint": "spawn already falling rather than resting",
      "def": "false",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "element",
      "label": "Element",
      "type": "select",
      "hint": "[element picker]",
      "def": "",
      "required": true,
      "options": [],
      "content": "element"
    },
    {
      "key": "structure",
      "label": "Structure",
      "type": "select",
      "hint": "[structure picker]",
      "def": "",
      "required": true,
      "options": [],
      "content": "structure"
    },
    {
      "key": "terrain",
      "label": "Terrain",
      "type": "select",
      "hint": "[terrain picker]",
      "def": "",
      "required": true,
      "options": [],
      "content": "terrain"
    }
  ],
  "readElement": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "mx",
      "label": "Matrix X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "my",
      "label": "Matrix Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "element",
      "label": "element",
      "type": "select",
      "hint": "[element picker]",
      "def": "",
      "required": true,
      "options": [],
      "content": "element"
    }
  ],
  "countElements": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "element",
      "label": "element",
      "type": "select",
      "hint": "[element picker]",
      "def": "",
      "required": true,
      "options": [],
      "content": "element"
    }
  ],
  "countEmpty": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "replaceElement": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "element",
      "label": "element",
      "type": "select",
      "hint": "[element picker]",
      "def": "",
      "required": true,
      "options": [],
      "content": "element"
    }
  ],
  "removeElement": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "element",
      "label": "element",
      "type": "select",
      "hint": "[element picker]",
      "def": "",
      "required": true,
      "options": [],
      "content": "element"
    }
  ],
  "createElement": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "element",
      "label": "element",
      "type": "select",
      "hint": "[element picker]",
      "def": "",
      "required": true,
      "options": [],
      "content": "element"
    }
  ],
  "emptyCells": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "transformElement": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "from",
      "label": "From element",
      "type": "text",
      "hint": "only cells holding this are changed. Leave blank for any.",
      "def": "",
      "required": false,
      "options": [],
      "content": "element"
    },
    {
      "key": "to",
      "label": "To element",
      "type": "text",
      "hint": "what they become",
      "def": "",
      "required": true,
      "options": [],
      "content": "element"
    },
    {
      "key": "key",
      "label": "Key",
      "type": "text",
      "hint": "the data-bag key",
      "def": "",
      "required": true,
      "options": [],
      "content": null
    },
    {
      "key": "value",
      "label": "Value",
      "type": "text",
      "hint": "written as text",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "numberValue",
      "label": "Number value",
      "type": "number",
      "hint": "written as a number. Leave blank to use Value.",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "propagateToWorkers",
      "label": "Send to workers",
      "type": "bool",
      "hint": "instance data lives on Main; set this if a worker must see it now",
      "def": "false",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "removeCells",
      "label": "Remove cells too",
      "type": "bool",
      "hint": "also remove the terrain under it",
      "def": "false",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "skipVisuals",
      "label": "Skip visuals",
      "type": "bool",
      "hint": "no teardown effect",
      "def": "false",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "structureType": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "hasStructure": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "isStructureType": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "structure",
      "label": "structure",
      "type": "select",
      "hint": "[structure picker]",
      "def": "",
      "required": true,
      "options": [],
      "content": "structure"
    }
  ],
  "isMyType": [],
  "isBlockedByPlayer": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "isLauncher": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "isStructureEnabled": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "countStructures": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "structureData": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "key",
      "label": "Key",
      "type": "text",
      "hint": "the data-bag key",
      "def": "",
      "required": true,
      "options": [],
      "content": null
    }
  ],
  "mapSpritesheetValue": [
    {
      "key": "value2",
      "label": "Value",
      "type": "number",
      "hint": "the value to map",
      "def": "0",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "thresholds",
      "label": "Thresholds",
      "type": "text",
      "hint": "comma-separated, ascending. e.g. 25,50,75",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "buildStructure": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "structure",
      "label": "structure",
      "type": "select",
      "hint": "[structure picker]",
      "def": "",
      "required": true,
      "options": [],
      "content": "structure"
    }
  ],
  "removeStructure": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "removeStructures": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "preserveUnselectable",
      "label": "Only unselectable",
      "type": "bool",
      "hint": "skip structures a player can currently select",
      "def": "false",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "setStructureEnabled": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "enabled",
      "label": "Enabled",
      "type": "bool",
      "hint": "the state to switch to",
      "def": "true",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "setSpritesheetIndex": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "index",
      "label": "Frame",
      "type": "number",
      "hint": "the frame to show",
      "def": "0",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "setSpritesheetByValue": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "value2",
      "label": "Value",
      "type": "number",
      "hint": "the value to map",
      "def": "0",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "thresholds",
      "label": "Thresholds",
      "type": "text",
      "hint": "comma-separated, ascending. e.g. 25,50,75",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "setStructureData": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "pushStructure": [
    {
      "key": "propagateToWorkers",
      "label": "Send to workers",
      "type": "bool",
      "hint": "instance data lives on Main; set this if a worker must see it now",
      "def": "false",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "skipShadow",
      "label": "Skip shadow",
      "type": "bool",
      "hint": "no shadow update around the changed cell",
      "def": "false",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "terrainType": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "hasTerrain": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "isTerrainType": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "terrain",
      "label": "terrain",
      "type": "select",
      "hint": "[terrain picker]",
      "def": "",
      "required": true,
      "options": [],
      "content": "terrain"
    }
  ],
  "terrainHitPoints": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "terrainTypeHandle": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "countTerrain": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "createTerrain": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "terrain",
      "label": "terrain",
      "type": "select",
      "hint": "[terrain picker]",
      "def": "",
      "required": true,
      "options": [],
      "content": "terrain"
    }
  ],
  "replaceTerrain": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "terrain",
      "label": "terrain",
      "type": "select",
      "hint": "[terrain picker]",
      "def": "",
      "required": true,
      "options": [],
      "content": "terrain"
    }
  ],
  "removeTerrain": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "skipShadow",
      "label": "Skip shadow",
      "type": "bool",
      "hint": "no shadow update around the changed cell",
      "def": "false",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "damageTerrain": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "damage",
      "label": "Damage",
      "type": "number",
      "hint": "hit points to remove",
      "def": "1",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "setTerrainHitPoints": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "hitPoints",
      "label": "Hit points",
      "type": "number",
      "hint": "the health to set. 0 destroys the terrain.",
      "def": "0",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "logicAny": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "element",
      "label": "element",
      "type": "select",
      "hint": "[element picker]",
      "def": "",
      "required": true,
      "options": [],
      "content": "element"
    }
  ],
  "logicAll": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "element",
      "label": "element",
      "type": "select",
      "hint": "[element picker]",
      "def": "",
      "required": true,
      "options": [],
      "content": "element"
    }
  ],
  "logicCount": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "element",
      "label": "element",
      "type": "select",
      "hint": "[element picker]",
      "def": "",
      "required": true,
      "options": [],
      "content": "element"
    }
  ],
  "logicSum": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "logicForEach": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "size",
      "label": "Region size",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "footprint",
      "label": "Whole footprint",
      "type": "bool",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "mx",
      "label": "Matrix X",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "my",
      "label": "Matrix Y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "to",
      "label": "Write element",
      "type": "select",
      "hint": "written at every cell in the range",
      "def": "",
      "required": true,
      "options": [],
      "content": "element"
    },
    {
      "key": "when",
      "label": "…but only cells holding",
      "type": "select",
      "hint": "leave blank to write every cell, whatever is there",
      "def": "",
      "required": false,
      "options": [],
      "content": "element"
    }
  ],
  "noop": [],
  "itemDefault": [
    {
      "key": "power",
      "label": "Power",
      "type": "number",
      "hint": "",
      "def": "5",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "processorNoop": [],
  "energyDefault": [
    {
      "key": "capacity",
      "label": "Capacity",
      "type": "number",
      "hint": "",
      "def": "1000",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "energyBank": [
    {
      "key": "capacity",
      "label": "Capacity",
      "type": "number",
      "hint": "",
      "def": "100000",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "energyWire": [
    {
      "key": "capacity",
      "label": "Capacity",
      "type": "number",
      "hint": "",
      "def": "200",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "energyConductor": [
    {
      "key": "capacity",
      "label": "Capacity",
      "type": "number",
      "hint": "",
      "def": "0",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "energyNetwork": [
    {
      "key": "energyType",
      "label": "Energy type",
      "type": "text",
      "hint": "network name to join",
      "def": "",
      "required": true,
      "options": [],
      "content": null
    }
  ],
  "triggerScan": [
    {
      "key": "radius",
      "label": "Radius",
      "type": "number",
      "hint": "",
      "def": "3",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "randomInt": [
    {
      "key": "min",
      "label": "Lowest",
      "type": "number",
      "hint": "inclusive",
      "def": "0",
      "required": true,
      "options": [],
      "content": null
    },
    {
      "key": "max",
      "label": "Highest",
      "type": "number",
      "hint": "inclusive. A max below min answers the min.",
      "def": "0",
      "required": true,
      "options": [],
      "content": null
    }
  ],
  "compare": [
    {
      "key": "left",
      "label": "Left",
      "type": "text",
      "hint": "a number, or {{aVariable}} from an earlier step",
      "def": "",
      "required": true,
      "options": [],
      "content": null
    },
    {
      "key": "op",
      "label": "Test",
      "type": "select",
      "hint": "",
      "def": "gte",
      "required": true,
      "options": [
        "eq",
        "ne",
        "gt",
        "gte",
        "lt",
        "lte"
      ],
      "content": null
    },
    {
      "key": "right",
      "label": "Right",
      "type": "number",
      "hint": "",
      "def": "0",
      "required": true,
      "options": [],
      "content": null
    }
  ],
  "math": [
    {
      "key": "left",
      "label": "Left",
      "type": "text",
      "hint": "a number, or {{aVariable}} from an earlier step",
      "def": "",
      "required": true,
      "options": [],
      "content": null
    },
    {
      "key": "op",
      "label": "Operation",
      "type": "select",
      "hint": "",
      "def": "add",
      "required": true,
      "options": [
        "add",
        "sub",
        "mul",
        "div"
      ],
      "content": null
    },
    {
      "key": "right",
      "label": "Right",
      "type": "number",
      "hint": "",
      "def": "1",
      "required": true,
      "options": [],
      "content": null
    }
  ],
  "signalLog": [],
  "signalOutput": [
    {
      "key": "value",
      "label": "Output",
      "type": "bool",
      "hint": "",
      "def": "false",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "structureInspect": [],
  "isElementAtCell": [
    {
      "key": "dx",
      "label": "Offset X",
      "type": "number",
      "hint": "",
      "def": "0",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "dy",
      "label": "Offset Y",
      "type": "number",
      "hint": "",
      "def": "0",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "element",
      "label": "element",
      "type": "select",
      "hint": "[element picker]",
      "def": "",
      "required": true,
      "options": [],
      "content": "element"
    }
  ],
  "structureReadData": [
    {
      "key": "field",
      "label": "Data field",
      "type": "text",
      "hint": "key on the structure's data object",
      "def": "",
      "required": true,
      "options": [],
      "content": null
    }
  ],
  "structureWriteData": [
    {
      "key": "field",
      "label": "Data field",
      "type": "text",
      "hint": "",
      "def": "",
      "required": true,
      "options": [],
      "content": null
    },
    {
      "key": "value",
      "label": "Value",
      "type": "text",
      "hint": "",
      "def": "",
      "required": true,
      "options": [],
      "content": null
    }
  ],
  "readDataField": [
    {
      "key": "slot",
      "label": "Data slot",
      "type": "select",
      "hint": "",
      "def": "1",
      "required": true,
      "options": [],
      "content": null
    }
  ],
  "writeDataField": [
    {
      "key": "slot",
      "label": "Data slot",
      "type": "select",
      "hint": "",
      "def": "1",
      "required": true,
      "options": [],
      "content": null
    },
    {
      "key": "slotValue",
      "label": "Value",
      "type": "text",
      "hint": "a number, or {{aVariable}} from an earlier step. Rounded to a whole number.",
      "def": "",
      "required": true,
      "options": [],
      "content": null
    }
  ],
  "bufferRead": [
    {
      "key": "path",
      "label": "Buffer path",
      "type": "text",
      "hint": "a path declared in Content → Buffer",
      "def": "",
      "required": true,
      "options": [],
      "content": "buffer"
    }
  ],
  "bufferWrite": [
    {
      "key": "path",
      "label": "Buffer path",
      "type": "text",
      "hint": "a path declared in Content → Buffer",
      "def": "",
      "required": true,
      "options": [],
      "content": "buffer"
    },
    {
      "key": "value",
      "label": "Value",
      "type": "text",
      "hint": "a literal, or {{aVariable}} from an earlier step",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "bufferIncrement": [
    {
      "key": "path",
      "label": "Buffer path",
      "type": "text",
      "hint": "a **number** path from Content → Buffer — a bool or string slot is not a counter",
      "def": "",
      "required": true,
      "options": [],
      "content": "buffer"
    },
    {
      "key": "delta",
      "label": "Amount",
      "type": "number",
      "hint": "",
      "def": "1",
      "required": true,
      "options": [],
      "content": null
    }
  ],
  "triggerLog": [],
  "triggerTick": [],
  "toast": [
    {
      "key": "text",
      "label": "Text",
      "type": "text",
      "hint": "",
      "def": "Hello",
      "required": true,
      "options": [],
      "content": null
    }
  ],
  "particles": [
    {
      "key": "name",
      "label": "Effect",
      "type": "text",
      "hint": "effect name",
      "def": "",
      "required": true,
      "options": [],
      "content": null
    },
    {
      "key": "count",
      "label": "Count",
      "type": "number",
      "hint": "",
      "def": "1",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "itemExcavate": [
    {
      "key": "profileId",
      "label": "Excavation profile",
      "type": "text",
      "hint": "falls back to the item's excavationProfileId",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "power",
      "label": "Power",
      "type": "number",
      "hint": "",
      "def": "10",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "itemShoot": [
    {
      "key": "projectileId",
      "label": "Projectile",
      "type": "text",
      "hint": "falls back to the item's projectileId",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "power",
      "label": "Power",
      "type": "number",
      "hint": "",
      "def": "5",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "speed",
      "label": "Speed",
      "type": "number",
      "hint": "",
      "def": "20",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "processorLog": [],
  "processorLift": [
    {
      "key": "x",
      "label": "Cell x",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    },
    {
      "key": "y",
      "label": "Cell y",
      "type": "number",
      "hint": "",
      "def": "",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "processorConvert": [
    {
      "key": "to",
      "label": "Output element",
      "type": "text",
      "hint": "element id committed into the cell",
      "def": "",
      "required": true,
      "options": [],
      "content": "element"
    },
    {
      "key": "chance",
      "label": "Chance",
      "type": "number",
      "hint": "",
      "def": "1",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "processorCount": [],
  "energyGenerateWhileHeld": [
    {
      "key": "energyType",
      "label": "Energy type",
      "type": "text",
      "hint": "",
      "def": "",
      "required": true,
      "options": [],
      "content": null
    },
    {
      "key": "amountPerRun",
      "label": "Amount per run",
      "type": "number",
      "hint": "",
      "def": "1",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "energyConsumePerRun": [
    {
      "key": "energyType",
      "label": "Energy type",
      "type": "text",
      "hint": "",
      "def": "",
      "required": true,
      "options": [],
      "content": null
    },
    {
      "key": "amountPerRun",
      "label": "Amount per run",
      "type": "number",
      "hint": "",
      "def": "1",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "techAppendUnlock": [
    {
      "key": "techId",
      "label": "Tech node",
      "type": "text",
      "hint": "",
      "def": "",
      "required": true,
      "options": [],
      "content": null
    }
  ],
  "techSetUpgradeLevel": [
    {
      "key": "itemId",
      "label": "Item",
      "type": "text",
      "hint": "",
      "def": "",
      "required": true,
      "options": [],
      "content": null
    },
    {
      "key": "level",
      "label": "Level",
      "type": "number",
      "hint": "",
      "def": "1",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "techGrantItem": [
    {
      "key": "itemId",
      "label": "Item",
      "type": "text",
      "hint": "",
      "def": "",
      "required": true,
      "options": [],
      "content": null
    },
    {
      "key": "count",
      "label": "Count",
      "type": "number",
      "hint": "",
      "def": "1",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "upgradeCountLevel": [
    {
      "key": "field",
      "label": "Data field",
      "type": "text",
      "hint": "",
      "def": "mdLevel",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "upgradeLog": [],
  "upgradeScale": [
    {
      "key": "field",
      "label": "Numeric field",
      "type": "text",
      "hint": "",
      "def": "",
      "required": true,
      "options": [],
      "content": null
    },
    {
      "key": "factor",
      "label": "Factor",
      "type": "number",
      "hint": "",
      "def": "1.1",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "upgradeAdd": [
    {
      "key": "field",
      "label": "Numeric field",
      "type": "text",
      "hint": "",
      "def": "",
      "required": true,
      "options": [],
      "content": null
    },
    {
      "key": "amount",
      "label": "Amount",
      "type": "number",
      "hint": "",
      "def": "1",
      "required": false,
      "options": [],
      "content": null
    }
  ],
  "logArgs": [],
  "identity": [],
  "logBuildingPayload": [],
  "if": [
    {
      "key": "var",
      "label": "When variable is true",
      "type": "text",
      "hint": "process tag",
      "def": "",
      "required": true,
      "options": [],
      "content": null
    }
  ]
}
  const ACTIONS = {
    act: ["addVelocity", "buildStructure", "createElement", "createTerrain", "damageTerrain", "itemExcavate", "itemShoot", "mapSpritesheetValue", "processorConvert", "processorLift", "pushStructure", "removeStructure", "removeStructures", "removeTerrain", "replaceElement", "replaceTerrain", "setDuration", "setSpritesheetByValue", "setSpritesheetIndex", "setStructureData", "setStructureEnabled", "setTerrainHitPoints", "setVelocity", "teleportElement", "toParticle"],
    block: ["if"],
    connect: ["energyBank", "energyConductor", "energyConsumePerRun", "energyDefault", "energyGenerateWhileHeld", "energyNetwork", "energyWire", "identity", "logArgs", "logBuildingPayload", "techAppendUnlock", "techGrantItem", "techSetUpgradeLevel"],
    decide: ["itemDefault", "noop", "processorNoop", "upgradeScale"],
    feel: ["particles", "toast", "upgradeLog"],
    logic: ["logicAll", "logicAny", "logicCount", "logicForEach", "var"],
    remember: ["bufferIncrement", "bufferWrite", "processorCount", "processorLog", "structureWriteData", "triggerTick", "upgradeAdd", "upgradeCountLevel", "writeDataField"],
    sense: ["bufferRead", "countElements", "countStructures", "countTerrain", "emptyCells", "findFreeCell", "getVelocity", "hasStructure", "hasTerrain", "isBlockedByPlayer", "isLauncher", "isMyType", "isStructureEnabled", "isStructureType", "isTerrainType", "readElement", "signalLog", "structureData", "structureInspect", "structureReadData", "structureType", "terrainHitPoints", "terrainType", "terrainTypeHandle", "triggerLog", "triggerScan"],
  };

  const ACTION_DOCS = {
  "bufferRead": "Reads a shared buffer slot. Set `path`. Bind the result with `as`.",
  "bufferWrite": "Writes a value to a shared buffer slot. Set `path` and `value`.",
  "bufferIncrement": "Adds `delta` to a shared counter, clamped. Set `path` and `delta`.",
  "signalOutput": "Publishes this structure's signal output. Set `value` in options.",
  "energyConsumePerRun": "Draws `amount` from the shared power pool. Set `amount` in options.",
  "energyGenerateWhileHeld": "Adds power to the network here. Set `amount` in options.",
  "techAppendUnlock": "Adds structures to a tech node. Set `techId` and `structures` in options.",
  "techGrantItem": "Gives the player an item. Set `itemId` and `count` in options.",
  "techSetUpgradeLevel": "Sets an upgrade level. Set `itemId`, `upgradeId` and `level` in options.",
  "energyDefault": "Storage node descriptor: capacity 1000. Override `capacity` in options.",
  "energyBank": "Storage node descriptor: capacity 100000 — a large buffer.",
  "energyWire": "Storage node descriptor: capacity 200 — a small buffer between machines.",
  "energyConductor": "Conductor descriptor: capacity 0. Forwards energy without holding any.",
  "energyNetwork": "Joins the network named by `energyType` in options.",
  "itemDefault": "Baseline item options (power 5). Use as a base for a tool or weapon.",
  "randomInt": "A random whole number from `min` to `max`, inclusive. Set both.",
  "math": "`left op right`, where op is + - * or /. Division rounds to the nearest whole number. Set both values.",
  "compare": "Compares `left` and `right` with `op`. Answers 1 or 0. Set the options.",
  "noop": "Always true. Makes an unconditional process explicit.",
  "upgradeScale": "Maps a stored value through thresholds. Set `thresholds` in options.",
  "structureWriteData": "Writes one key into this instance's saved data. Set `key` / `value` in options.",
  "triggerTick": "Increments this instance's tick counter. Set `key` in options.",
  "upgradeCountLevel": "Increments a level counter on the upgraded item. Set `key` in options.",
  "upgradeAdd": "Adds `amount` to a numeric field. Set `key` and `amount` in options.",
  "processorCount": "Increments a counter on this instance. Set `key` in options.",
  "structureType": "Reads the type of the structure at a cell and returns the engine's own handle for it. Feed it back into Is structure type — do not compare it to an id by hand.",
  "hasStructure": "True when a structure has been built at the cell. Bind it with As.",
  "isStructureType": "True when the cell holds a structure of the given type. Accepts an id or a handle from Structure type.",
  "isMyType": "True when **this** structure is of the given type. No offsets — it asks about the instance the process is running on.",
  "isBlockedByPlayer": "True when a player has blocked building at the cell.",
  "isLauncher": "True when the cell is a structure launcher.",
  "isStructureEnabled": "True when processing is enabled at the cell. Bind it to gate later steps.",
  "countStructures": "Counts structures in the region. Bind it to check a footprint is clear before building.",
  "structureData": "Reads one key from the structure's saved data and returns it. Bind it with As. Returns the empty string when the key is absent.",
  "buildStructure": "Builds a structure of the given type at the cell.",
  "removeStructure": "Removes the structure at the cell. Use Remove structures to clear a whole region in one call.",
  "removeStructures": "Removes every structure in the region with a single engine call. Prefer this to Remove structure over an area.",
  "setStructureEnabled": "Enables or disables processing at the cell.",
  "setSpritesheetIndex": "Sets this instance's spritesheet frame. Bind a number to it for a gauge.",
  "setSpritesheetByValue": "Sets the frame by mapping a value onto a threshold list — the progress bar. Thresholds are comma-separated, ascending.",
  "setStructureData": "Writes one key into the structure's saved data, through the engine. Use Number value for a numeric field.",
  "pushStructure": "Pushes this structure's data to the engine. Only needed after an action that edits the data bag in place.",
  "mapSpritesheetValue": "Maps a value onto a threshold list and returns the frame index the engine would pick. Thresholds are comma-separated, ascending.",
  "terrainType": "Reads the terrain id at a cell. Empty means no terrain. Bind it with As.",
  "hasTerrain": "True when the cell holds terrain. Bind it with As.",
  "isTerrainType": "True when the cell holds terrain of the given type. Accepts an id or a handle from Terrain type.",
  "terrainHitPoints": "Reads the terrain's hit points at a cell. Returns -1 when there are none. Bind it to watch a wall wear down.",
  "terrainTypeHandle": "Reads the engine's own numeric handle for the terrain at a cell. Returns -1 when there is none.",
  "countTerrain": "Counts cells holding terrain in the region. Bind it to size a footprint.",
  "createTerrain": "Creates terrain of the given type in empty cells. One atomic batch.",
  "replaceTerrain": "Replaces terrain in every cell of the region. One atomic batch.",
  "removeTerrain": "Removes terrain from every cell of the region. One atomic batch.",
  "damageTerrain": "Damages terrain in the region. Per-cell, so a large area can half-apply.",
  "setTerrainHitPoints": "Sets the terrain's hit points in the region. Use it to repair a wall.",
  "readElement": "Reads the element at the cell and returns its id. Bind it with As, then use {{name}} in a later step.",
  "readDataField": "Reads data slot N (1–4) at the cell and returns the number. Bind it with As. The slot is the number from the element's Data fields list.",
  "writeDataField": "Writes a number into data slot N (1–4) at the cell. Set `slot` (1–4) and `value`.",
  "countElements": "Counts cells holding `element` in the region. Returns a number — bind it with As to compare against a threshold.",
  "countEmpty": "Counts cells in the region that hold neither element nor terrain. This is the free space.",
  "replaceElement": "Writes `element` over every cell in the region, replacing what was there.",
  "createElement": "Writes `element` into every **empty** cell in the region, leaving anything already there alone.",
  "emptyCells": "Removes the element from every occupied cell in the region.",
  "removeElement": "Removes the element from every cell in the region that holds `element`. Leave the element blank to empty every non-empty cell.",
  "transformElement": "Where the region holds `from`, writes `to`. Leave `from` blank to convert whatever element is there.",
  "logicAny": "fn(size?, element, …) → true when **any** cell in the range holds that element. Bind the answer with the step's As field.",
  "logicAll": "fn(size?, element, …) → true when **all** cells in the range hold that element.",
  "logicCount": "fn(size?, element, …) → how **many** cells in the range hold that element. Bind the number with the step's As field.",
  "logicSum": "fn(size?, …) → the total terrain hit points in the range. A cell with no terrain counts as 0.",
  "logicForEach": "fn(size?, to, …) → writes an element at **every** cell in the range. Set `when` to only touch cells already holding another element.",
  "itemExcavate": "Digs at this position. Set `damage` and `velocity` in options.",
  "itemShoot": "Fires a projectile. Set `projectileId` and `velocity` in options.",
  "processorLog": "Logs the structure and cell context on every run. Use to confirm wiring.",
  "processorNoop": "Does nothing. Keeps the interval alive without side effects.",
  "processorLift": "Copies the cell above the structure down to the cell below.",
  "processorConvert": "Replaces the cell above with one fixed element. Set `to` in options.",
  "structureInspect": "Reports what the clicked structure is, without changing anything.",
  "structureReadData": "Reads one key out of the instance's own data bag. Set `key` in options.",
  "triggerScan": "Logs a rectangle of cells around this position. Set `width` / `height` in options.",
  "signalLog": "Logs the raw payload. Use to see what a call site actually delivers.",
  "triggerLog": "Logs the raw payload of a timed tick.",
  "isElementAtCell": "fn(dx?, dy?) → true when the offset cell holds `element`. Bind the answer with the step's As field, then read it as {{name}}.",
  "toast": "Shows a message. Set `text` in options.",
  "particles": "Emits particles here. Set `count` in options.",
  "upgradeLog": "Prints the upgraded item and these options. Safe to leave on while testing.",
  "getVelocity": "Reads the particle speed at the first cell of the region and returns it. Bind it with As. Returns -1 when there is no particle to measure.",
  "findFreeCell": "Finds a free cell within `size` cells of the structure. Returns its index as a number, or -1 when the whole area is occupied.",
  "setVelocity": "Sets the particle velocity (vx, vy) on every cell in the region. Only affects particles — use toParticle to turn a cell into one first.",
  "addVelocity": "Adds (vx, vy) to the particle velocity in the region. Set maxSpeed to clamp the result in cells per second.",
  "setDuration": "Sets the remaining duration in ticks for every cell in the region. Set rearm to also raise the maximum, so it fires again next cycle.",
  "teleportElement": "Moves everything in the region by the (tx, ty) offset. ty: 1 moves it down one cell. Cells that would land on something are not moved.",
  "toParticle": "Turns every cell in the region into a particle moving at (vx, vy). This is what actually launches material — setVelocity alone will not move sand.",
  "if": "Control-flow block. Set options.var to a process variable name; then[] runs when that var is truthy, else[] when falsy.",
  "identity": "Modifier pass-through: returns the value unchanged.",
  "logArgs": "Modifier: logs hook arguments for debugging.",
  "logBuildingPayload": "Logs the building placement payload."
}

  const ACTION_APIS = {
  "addVelocity": [
    "sandkit.api.elements"
  ],
  "buildStructure": [
    "sandkit.api.structures"
  ],
  "createElement": [
    "sandkit.api.elements",
    "sandkit.api.grid"
  ],
  "createTerrain": [
    "sandkit.api.terrains",
    "sandkit.api.grid"
  ],
  "damageTerrain": [
    "sandkit.api.terrains"
  ],
  "itemExcavate": [
    "sandkit.api.excavation",
    "sandkit.api.grid"
  ],
  "itemShoot": [
    "sandkit.api.projectiles"
  ],
  "mapSpritesheetValue": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "processorConvert": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "processorLift": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "pushStructure": [
    "sandkit.api.structures"
  ],
  "removeStructure": [
    "sandkit.api.structures"
  ],
  "removeStructures": [
    "sandkit.api.structures"
  ],
  "removeTerrain": [
    "sandkit.api.terrains",
    "sandkit.api.grid"
  ],
  "replaceElement": [
    "sandkit.api.elements",
    "sandkit.api.grid"
  ],
  "replaceTerrain": [
    "sandkit.api.terrains",
    "sandkit.api.grid"
  ],
  "setDuration": [
    "sandkit.api.elements"
  ],
  "setSpritesheetByValue": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "setSpritesheetIndex": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
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
  "teleportElement": [
    "sandkit.api.elements",
    "sandkit.api.grid"
  ],
  "toParticle": [
    "sandkit.api.elements"
  ],
  "if": [],
  "energyBank": [
    "sandkit.api.energy",
    "sandkit.api.tech",
    "sandkit.api.items",
    "sandkit.api.signals"
  ],
  "energyConductor": [
    "sandkit.api.energy",
    "sandkit.api.tech",
    "sandkit.api.items",
    "sandkit.api.signals"
  ],
  "energyConsumePerRun": [
    "sandkit.api.energy"
  ],
  "energyDefault": [
    "sandkit.api.energy",
    "sandkit.api.tech",
    "sandkit.api.items",
    "sandkit.api.signals"
  ],
  "energyGenerateWhileHeld": [
    "sandkit.api.energy"
  ],
  "energyNetwork": [
    "sandkit.api.energy"
  ],
  "energyWire": [
    "sandkit.api.energy",
    "sandkit.api.tech",
    "sandkit.api.items",
    "sandkit.api.signals"
  ],
  "identity": [
    "sandkit.api.energy",
    "sandkit.api.tech",
    "sandkit.api.items",
    "sandkit.api.signals"
  ],
  "logArgs": [
    "sandkit.api.energy",
    "sandkit.api.tech",
    "sandkit.api.items",
    "sandkit.api.signals"
  ],
  "logBuildingPayload": [
    "sandkit.api.energy",
    "sandkit.api.tech",
    "sandkit.api.items",
    "sandkit.api.signals"
  ],
  "techAppendUnlock": [
    "sandkit.api.tech"
  ],
  "techGrantItem": [
    "sandkit.api.items",
    "sandkit.api.tech"
  ],
  "techSetUpgradeLevel": [
    "sandkit.api.tech",
    "sandkit.api.upgrades"
  ],
  "itemDefault": [],
  "noop": [],
  "processorNoop": [],
  "upgradeScale": [],
  "particles": [
    "sandkit.api.effects"
  ],
  "toast": [
    "sandkit.api.ui"
  ],
  "upgradeLog": [
    "sandkit.api.ui",
    "sandkit.api.effects"
  ],
  "logicAll": [
    "sandkit.api.elements",
    "sandkit.api.grid"
  ],
  "logicAny": [
    "sandkit.api.elements",
    "sandkit.api.grid"
  ],
  "logicCount": [
    "sandkit.api.elements",
    "sandkit.api.grid"
  ],
  "logicForEach": [
    "sandkit.api.elements",
    "sandkit.api.grid"
  ],
  "var": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.terrains"
  ],
  "bufferIncrement": [
    "mod.buffers"
  ],
  "bufferWrite": [
    "mod.buffers"
  ],
  "processorCount": [
    "sandkit.api.structures",
    "mod.buffers"
  ],
  "processorLog": [
    "sandkit.api.structures",
    "mod.buffers"
  ],
  "structureWriteData": [
    "sandkit.api.structures",
    "mod.buffers"
  ],
  "triggerTick": [
    "sandkit.api.structures",
    "mod.buffers"
  ],
  "upgradeAdd": [
    "sandkit.api.structures",
    "mod.buffers"
  ],
  "upgradeCountLevel": [
    "sandkit.api.structures",
    "mod.buffers"
  ],
  "writeDataField": [
    "sandkit.api.structures",
    "mod.buffers"
  ],
  "bufferRead": [
    "mod.buffers"
  ],
  "countElements": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "countStructures": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "countTerrain": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "emptyCells": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "findFreeCell": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "getVelocity": [
    "sandkit.api.elements"
  ],
  "hasStructure": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "hasTerrain": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "isBlockedByPlayer": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "isLauncher": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "isMyType": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "isStructureEnabled": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "isStructureType": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "isTerrainType": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "readElement": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "signalLog": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "structureData": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "structureInspect": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "structureReadData": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "structureType": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "terrainHitPoints": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "terrainType": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "terrainTypeHandle": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "triggerLog": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ],
  "triggerScan": [
    "sandkit.api.elements",
    "sandkit.api.grid",
    "sandkit.api.structures",
    "sandkit.api.terrains"
  ]
}

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
    MENU_GROUPS, COLLECTIONS, FIELDS, ACTION_PARAMS, ACTIONS, ACTION_DOCS, ACTION_APIS, roleOf, emptyConfig,
  };
})();
