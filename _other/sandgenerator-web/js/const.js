export const WIDTH = 320;
export const HEIGHT = 320;

export const CANVA_SCALE = 4;

export const CANVA_HEIGHT = HEIGHT * CANVA_SCALE;
export const CANVA_WIDTH = WIDTH * CANVA_SCALE;

export const itemsColorB = {
  sky: "#ffffff",
  rock: "#aaaaaa",
  tunnel: "#993300",
  cave: "#000000",
  fluxBorder: "#660066",

  empty: "#ffffff", //Empty	Empty	N/A
  Bedrock: "#aaaaaa", //Bedrock	N/A	N/A

  Fog: "#993300", //Fog	SandSoil	N/A
  CaveSandsoil: "#000000", //SandSoil	SandSoil	N/A

  SurfaceWater: "#6600ff", //Water	SandSoil	N/A
  FogWater: "#9966ff", //FogWater	SandSoil	N/A
  FogLava: "#ff6600", //FogLava	SandSoil	N/A

  Ice: "#66ccff", //Ice	Empty	N/A
  CaveFrostBed: "#99ffff", //FrostBed	SandSoil	N/A

  Fluxite: "#af00e0", //Fluxite	SandSoil	N/A

  Crackstone: "#cd8b8b", //Crackstone	SandSoil	N/A
  SporeSoil: "#ffff00", //SporeSoil	SandSoil	N/A
  RedsandSoil: "#ff5500", //RedsandSoil	SandSoil	N/A "#ff0000",

  Grass: "#00ff00", //Grass	SandSoil	N/A
  Moss: "#00e000", //Moss	SandSoil	N/A

  Scoria: "#260000", //Scoria	SandSoil	N/A
  GoldSoil: "#7f7f00", //GoldSoil	SandSoil	Drops gold; Element spawned by flowers

  Divider: "#006600", //Divider	SandSoil	The weird burnable walls in the artifact rooms
  RevealedFog: "#990000", //Empty	SandSoil	N/A
  AlternateFog: "#333333", //Fog	: "#a6a6a6", //N/A
  BedrockFog: "#666666", //Fog	Bedrock	N/A

  RevealedFogWater: "#0000ff", //Water	SandSoil	I think it's just surface water...

  JetpackFog: "#ff0099", //Fog	FogJetpackBlock	It's fancy fog to show the jetpack is blocked
  JetpackFogWater: "#6666ff", //FogWater	FogJetpackBlock	N/A
  JetpackFrostBed: "#ccffff", //FrostBed	FogJetpackBlock	N/A
};

export const itemsID_FIX = {
  empty: 0,
  sky: 1,
  rock: 2,
  tunnel: 3,
  cave: 4,
  fluxBorder: 5,
};

export const itemsId = Object.fromEntries(
  Object.entries(itemsColorB).map(([k, _], idx) => {
    const value = itemsID_FIX[k] !== undefined ? itemsID_FIX[k] : (32 + idx);
    return [k, value];
  }),
);

export const itemsIdName = Object.fromEntries(
  Object.entries(itemsId).map(([k, v]) => {
    return [v, k];
  }),
);

export const itemsIdColor = Object.fromEntries(
  Object.entries(itemsColorB).map(([k, v]) => {
    return [itemsId[k], v];
  }),
);

console.log(itemsId);
