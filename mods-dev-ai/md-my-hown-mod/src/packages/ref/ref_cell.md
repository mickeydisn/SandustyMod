## api.authorization
    - canBuildAtCell(cellX, cellY)
    - canGrabAtCell(cellX, cellY)
    - canUseToolAtCell(cellX, cellY, isFlamethrower?)
    - getZoneIdAtCell(cellX, cellY)
## api.building
    - getSnappedPositionAtCell(cellX, cellY)
    - isBlockedAtCell(cellX, cellY)
## api.collector
    - getValueFromCellId(cellId)
    - isCellIdCollectable(cellId)
    - isCellIdCollectableForSprite(cellId)
    - notifyPickupAtCell(cellX, cellY)
## api.energy
    - addAtCell(cellX, cellY, amount, options?)
    - consumeExcludingNetworkAtCell(cellX, cellY, amount)
    - getNetworkAtCell(cellX, cellY)
    - getNetworkFreeCapacityAtCell(cellX, cellY)
## api.input
    - getMousePositionAtCell()
## api.patterns
    - createCircle(diameterCells)
    - excavateAtCell(cellX, cellY, pattern, outVelocity, power, options?)
## api.player
    - isCollidingWithCell(cellX, cellY)
    - isWithinRadiusOfCell(cellX, cellY, radiusCells)
## api.utils
    - getCoordinatesBetweenCells(pointA, pointB)
## api.elements
    - getTypeAtCell(cellX, cellY)
    - getResolvedTypeAtCell(cellX, cellY)
    - getResolvedTypeFromCellId(cellId)
    - getInfoAtCell(cellX, cellY)
    - getMatterTypeAtCell(cellX, cellY)
    - isTypeAtCell(cellX, cellY, elementTypeOrId)
    - isFreeFallingAtCell(cellX, cellY)
    - findFreeCellInStructure(structureCellX, structureCellY, structureSizeCells)
    - createAtCell(cellX, cellY, elementTypeOrId, options?)
    - replaceAtCell(cellX, cellY, elementTypeOrId, options?)
    - removeAtCell(cellX, cellY, options?)
    - teleportBetweenCells(fromCellX, fromCellY, toCellX, toCellY)
    - getVelocityAtCell(cellX, cellY)
    - setVelocityAtCell(cellX, cellY, velocity)
    - addParticleVelocityAtCell(cellX, cellY, velocity, maxSpeedCellsPerSecond?)
    - convertToParticleAtCell(cellX, cellY, velocity)
    - convertFromParticleAtCell(cellX, cellY)
    - getDataFieldAtCell(cellX, cellY, dataFieldNumber)
    - setDataFieldAtCell(cellX, cellY, dataFieldNumber, value)
    - refreshColorAtCell(cellX, cellY)
    - setPhysicsAtCell(cellX, cellY, physicsState)
    - setDurationAtCell(cellX, cellY, durationTicks, options?)
## api.fire
    - canBurnElementAtCell(cellX, cellY)
    - burnElementAtCell(cellX, cellY)
## api.resources
    - collectFluxiteAtCell(cellX, cellY)
## api.signals
    - setOutputAtCell(cellX, cellY, on)
## api.structures
    - getAtCell(cellX, cellY)
    - hasBuiltAtCell(cellX, cellY)
    - isBlockedByPlayerAtCell(cellX, cellY)
    - isLauncherAtCell(cellX, cellY)
    - isTypeAtCell(cellX, cellY, structureId)
    - setSpritesheetIndexAtCell(cellX, cellY, index)
    - setSpritesheetIndexByValueAtCell(cellX, cellY, value, thresholds)
    - buildAtCell(cellX, cellY, structureTypeOrId, options?)
    - removeAtCell(cellX, cellY, options?)
    - removeBetweenCells(startCellX, startCellY, endCellX, endCellY, options?)
    - removeAtCells(positions, options?)
## api.structures.processing
    - isEnabledAtCell(cellX, cellY)
    - setEnabledAtCell(cellX, cellY, enabled)
## api.terrains
    - getTypeAtCell(cellX, cellY)
    - getDataAtCell(cellX, cellY)
    - isAtCell(cellX, cellY)
    - isTypeAtCell(cellX, cellY, terrainId)
    - isCellIdTerrain(cellId)
    - createAtCell(cellX, cellY, terrainTypeOrId, options?)
    - replaceAtCell(cellX, cellY, terrainTypeOrId, options?)
    - removeAtCell(cellX, cellY, options?)
    - damageAtCell(cellX, cellY, damage)
    - meltAtCell(cellX, cellY)
    - setHitPointsAtCell(cellX, cellY, hitPoints)
## api.grid
    - getCellIdAtCell(cellX, cellY)
    - isCellEmptyAtCell(cellX, cellY)
    - isTerrainAtCell(cellX, cellY)
    - reportActivityAtCell(cellX, cellY)
    - excavateAtCell(cellX, cellY, outVelocity, damage, options?)
    - revealFogAtCell(cellX, cellY)
    - redrawAroundCell(cellX, cellY, rangeCells)
    - forEachCellInRectangle(cellX, cellY, widthCells, heightCells, callback)
    - forEachCellInCircle(centerCellX, centerCellY, radiusCells, callback)
## api.pipes
    - isAtCell(cellX, cellY)
    - isEnabledAtCell(cellX, cellY)
    - getConnectedVentsAtCell(cellX, cellY)
    - setEnabledAtCell(cellX, cellY, enabled)
## api.rendering
    - getDrawPositionAtCell(cellX, cellY)

----

## api.player
    - setPositionAtWorld(worldX, worldY)
    - isPositionClearAtWorld(worldX, worldY)

## api.projectiles
    - spawnAtWorld(worldX, worldY, angleRadians, blueprint)

## api.raycast
    - castAtWorld(startWorldX, startWorldY, angleRadians, maxDistanceWorldPixels)
## api.entities
    - spawnAtWorld(entityTypeId, worldX, worldY)
## api.lights.temporary
    - createAtWorld(worldX, worldY, options?)
    - removeById(lightId)
## api.lights.persistent
    - createAtWorld(worldX, worldY, options?)
    - removeAtWorld(worldX, worldY)
    - fadeAtWorld(worldX, worldY, durationMs?)
## api.sound
    - calculateDistanceOptionsAtWorld(worldX, worldY, baseVolume?)
## api.pickups
    - spawnAtWorld(type, worldX, worldY, data?, light?)
## api.rendering
    - getDrawPositionAtWorld(worldX, worldY)

## api.effects
    - createDistortionWaveAtWorld(worldX, worldY, options?)
    - createAtWorld(effectId, worldX, worldY, options?)
    - createLaserAtWorld(startWorldX, startWorldY, endWorldX, endWorldY, options?)
    - createParticlesAtWorld(worldX, worldY, options?)

---

## api.utils
    - getDistance(pointA, pointB)
    - getDirection(pointA, pointB)
    - getAngle(pointA, pointB)
