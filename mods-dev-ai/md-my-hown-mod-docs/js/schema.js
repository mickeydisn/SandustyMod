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
    { key:"actions", label:"Actions", hint:"Player & clock",
      items:[
        {key:"triggers", label:"Triggers", color:"#f0a070"},
        {key:"inputBindings", label:"Input bindings", color:"#c97a5c"},
        {key:"processing", label:"Processors", color:"#d64550"},
        {key:"modifiers", label:"Hook modifiers", color:"#e89870"},
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
    { key:"handlers", label:"Handlers", hint:"Runnable programs",
      items:[
        {key:"processes", label:"Processes", color:"#fbbf24", blocky:true},
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
    "addVelocity": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"],["vx","Velocity X","number"],["vy","Velocity Y","number"],["maxSpeed","Max speed","number"]],
    "bufferIncrement": [["path","Buffer path","text"],["delta","Amount","number"]],
    "bufferRead": [["path","Buffer path","text"]],
    "bufferWrite": [["path","Buffer path","text"],["value","Value","text"]],
    "buildStructure": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "countElements": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "countStructures": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "countTerrain": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "createElement": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "createTerrain": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "damageTerrain": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"],["damage","Damage","number"]],
    "emptyCells": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"],["from","From element","text"],["to","To element","text"],["key","Key","text"],["value","Value","text"],["numberValue","Number value","number"],["propagateToWorkers","Send to workers","bool"]],
    "energyBank": [["capacity","Capacity","number"]],
    "energyConductor": [["capacity","Capacity","number"]],
    "energyConsumePerRun": [["energyType","Energy type","text"],["amountPerRun","Amount per run","number"]],
    "energyDefault": [["capacity","Capacity","number"]],
    "energyGenerateWhileHeld": [["energyType","Energy type","text"],["amountPerRun","Amount per run","number"]],
    "energyNetwork": [["energyType","Energy type","text"]],
    "energyWire": [["capacity","Capacity","number"]],
    "findFreeCell": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "getVelocity": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "hasStructure": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "hasTerrain": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "identity": [],
    "isBlockedByPlayer": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "isLauncher": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "isMyType": [],
    "isStructureEnabled": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "isStructureType": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "isTerrainType": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "itemDefault": [["power","Power","number"]],
    "itemExcavate": [["profileId","Excavation profile","text"],["power","Power","number"]],
    "itemShoot": [["projectileId","Projectile","text"],["power","Power","number"],["speed","Speed","number"]],
    "logArgs": [],
    "logBuildingPayload": [],
    "logicAll": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "logicAny": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "logicCount": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "logicForEach": [["to","Write element","select"],["when","…but only cells holding","select"]],
    "mapSpritesheetValue": [["value2","Value","number"],["thresholds","Thresholds","text"]],
    "noop": [],
    "particles": [["name","Effect","text"],["count","Count","number"]],
    "processorConvert": [["to","Output element","text"],["chance","Chance","number"]],
    "processorCount": [],
    "processorLift": [["x","Cell x","number"],["y","Cell y","number"]],
    "processorLog": [],
    "processorNoop": [],
    "pushStructure": [["propagateToWorkers","Send to workers","bool"],["skipShadow","Skip shadow","bool"]],
    "readElement": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"],["mx","Matrix X","number"],["my","Matrix Y","number"]],
    "removeStructure": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "removeStructures": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"],["preserveUnselectable","Only unselectable","bool"]],
    "removeTerrain": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"],["skipShadow","Skip shadow","bool"]],
    "replaceElement": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "replaceTerrain": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "setDuration": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"],["ticks","Ticks","number"],["rearm","Rearm","bool"]],
    "setSpritesheetByValue": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"],["value2","Value","number"],["thresholds","Thresholds","text"]],
    "setSpritesheetIndex": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"],["index","Frame","number"]],
    "setStructureData": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "setStructureEnabled": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"],["enabled","Enabled","bool"]],
    "setTerrainHitPoints": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"],["hitPoints","Hit points","number"]],
    "setVelocity": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"],["vx","Velocity X","number"],["vy","Velocity Y","number"]],
    "signalLog": [["value","Output","bool"]],
    "structureData": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"],["key","Key","text"]],
    "structureInspect": [["dx","Offset X","number"],["dy","Offset Y","number"]],
    "structureReadData": [["field","Data field","text"]],
    "structureType": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "structureWriteData": [["field","Data field","text"],["value","Value","text"],["slot","Data slot","select"]],
    "techAppendUnlock": [["techId","Tech node","text"]],
    "techGrantItem": [["itemId","Item","text"],["count","Count","number"]],
    "techSetUpgradeLevel": [["itemId","Item","text"],["level","Level","number"]],
    "teleportElement": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"],["tx","Move X","number"],["ty","Move Y","number"]],
    "terrainHitPoints": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "terrainType": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "terrainTypeHandle": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"]],
    "toParticle": [["dx","Offset X","number"],["dy","Offset Y","number"],["size","Region size","number"],["footprint","My whole footprint","bool"],["vx","Velocity X","number"],["vy","Velocity Y","number"],["durationTicks","Lifetime","number"],["density","Density","number"],["freeFalling","Free-falling","bool"]],
    "toast": [["text","Text","text"]],
    "triggerLog": [],
    "triggerScan": [["radius","Radius","number"],["min","Lowest","number"],["max","Highest","number"],["left","Left","text"]],
    "triggerTick": [],
    "upgradeAdd": [["field","Numeric field","text"],["amount","Amount","number"]],
    "upgradeCountLevel": [["field","Data field","text"]],
    "upgradeLog": [],
    "upgradeScale": [["field","Numeric field","text"],["factor","Factor","number"]],
    "var": [],
    "writeDataField": [["slot","Data slot","select"],["slotValue","Value","text"]],
    "if": [["condition","Condition (var/expr)","text"]],
  };
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
    MENU_GROUPS, COLLECTIONS, FIELDS, ACTION_PARAMS, ACTIONS, roleOf, emptyConfig,
  };
})();
