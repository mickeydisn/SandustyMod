import { Profile } from "./types.ts";
import { ElementTypeInWorker as ElementType } from "../elementResolve.ts";
import { forceEntries, WaterCfg } from "./config.ts";

import { Crystallization } from "../action/crystallize.ts";
import { Grow } from "../action/grow.ts";
import { Move } from "../action/move.ts";

export function profileGold(): Profile {
  return {
    id: "astroSeed-in-gold",
    seedType: ElementType.astroSeed,
    liquidType: ElementType.liquidGold,
    crystalType: ElementType.astroGoldCrystal,
    growAge: () => 40,
    moves: [Move.side(15), Move.down(20)],
    grow: [Grow.ageAlways()],
    crystallization: [Crystallization.disk(1)],
  };
}

export function profileCopper(): Profile {
  return {
    id: "astroSeed-in-copper",
    seedType: ElementType.astroSeed,
    liquidType: ElementType.liquidCopper,
    crystalType: ElementType.astroCopperCrystal,
    growAge: () => 10,
    moves: [
      Move.up(0),
      Move.side(15),
      Move.down(35),
    ],
    grow: [
      Grow.blockOnWater(),
      Grow.instantChance(0),
      Grow.ageOnFloor(60),
      Grow.ageOnWall(70),
      Grow.ageOnAir(30),
      Grow.ageOnCrystal(100),
    ],
    crystallization: [Crystallization.cross(1)],
  };
}

export function profileGoldPowder(): Profile {
  return {
    id: "astroGold-in-water",
    seedType: ElementType.astroGoldPowder,
    liquidType: ElementType.water,
    crystalType: ElementType.astroGoldCrystal,
    growAge: () => 10,
    moves: [
      Move.up(8),
      Move.side(8),
      Move.down(8),
      Move.columnForce({
        rateFn: -80,
        matchTypes: [],
        directions: ["top", "bottom", "sides"],
        rangeNFn: 8,
        maxKFn: 1,
        freeTypes: [],
        excludeTypes: [],
      }),
      Move.columnForce({
        rateFn: -10,
        matchTypes: [ElementType.astroGoldPowder],
        directions: ["top", "bottom", "sides", "cross"],
        rangeNFn: 2,
        maxKFn: 1,
        freeTypes: [],
        excludeTypes: [],
      }),
      Move.columnForce({
        rateFn: 90,
        matchTypes: [ElementType.astroCopperPowder],
        directions: ["top", "bottom", "sides", "cross"],
        rangeNFn: 6,
        maxKFn: 1,
        freeTypes: [],
        excludeTypes: [],
      }),
    ],
    grow: [],
    crystallization: [],
  };
}

export function profileCopperPowder(): Profile {
  return {
    id: "astroCopper-in-water",
    seedType: ElementType.astroCopperPowder,
    liquidType: ElementType.water,
    crystalType: ElementType.astroCopperCrystal,
    growAge: () => 10,
    moves: [
      Move.up(5),
      Move.side(5),
      Move.down(5),
      Move.columnForce({
        rateFn: -80,
        matchTypes: [],
        directions: ["top", "bottom", "sides"],
        rangeNFn: 8,
        maxKFn: 1,
        freeTypes: [],
        excludeTypes: [],
      }),
      Move.columnForce({
        rateFn: 30,
        matchTypes: [ElementType.astroGoldPowder],
        directions: ["top", "bottom", "sides", "cross"],
        rangeNFn: 2,
        maxKFn: 1,
        freeTypes: [],
        excludeTypes: [],
      }),
      Move.columnForce({
        rateFn: -20,
        matchTypes: [ElementType.astroCopperPowder],
        directions: ["top", "bottom", "sides", "cross"],
        rangeNFn: 4,
        maxKFn: 1,
        freeTypes: [],
        excludeTypes: [],
      }),
    ],
    grow: [],
    crystallization: [],
  };
}

export function profileWater(): Profile {
  return {
    id: "water",
    seedType: ElementType.astroSeed,
    liquidType: ElementType.water,
    crystalType: ElementType.astroWaterCrystal,
    growAge: () => WaterCfg.crystalGrowAge(),
    moves: [
      ...(WaterCfg.stepForceMove()
        ? forceEntries().map((e) => {
          console.log("forceEntries", e);
          return Move.columnForce({
            rateFn: e.rateFn,
            matchTypes: e.matchTypes,
            directions: e.directions,
            rangeNFn: e.rangeNFn,
            maxKFn: e.maxKFn,
            freeTypes: e.freeTypes,
            excludeTypes: e.excludeTypes,
          });
        })
        : []),
      ...(WaterCfg.stepMove()
        ? [
          Move.up(WaterCfg.moveFloat),
          Move.side(WaterCfg.moveSide),
          Move.down(WaterCfg.moveSink),
        ]
        : []),
    ],
    grow: WaterCfg.stepGrow()
      ? [
        Grow.instantChance(WaterCfg.growInstantTouch),
        Grow.ageOnFloor(WaterCfg.growOnFloor),
        Grow.ageOnWall(WaterCfg.growOnWall),
        Grow.ageOnAir(WaterCfg.growOnAir),
        Grow.ageOnCrystal(WaterCfg.growOnCrystal),
        Grow.ageOnSurround(WaterCfg.growIfSurround, WaterCfg.growSurroundMin),
      ]
      : [],
    crystallization: WaterCfg.stepCrystalisation()
      ? [
        Crystallization.fromShapeIndex(
          WaterCfg.crystalShape,
          WaterCfg.crystalRadius,
        ),
      ]
      : [],
  };
}

export const PROFILES: Record<string, () => Profile> = {
  gold: profileGold,
  copper: profileCopper,
  water: profileWater,
  gInWater: profileGoldPowder,
  cInWater: profileCopperPowder,
};

export const profiles: (() => Profile)[] = Object.values(PROFILES);
