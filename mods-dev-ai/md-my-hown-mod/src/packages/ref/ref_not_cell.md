# Unlock & discovery

## api.discoveries
    - addElementByType(elementType)
    - addTerrainByType(terrainType)

## api.tech
    - conservatory.appendUnlock(techId, unlocks)
    - isResearchedById(techId)
    - isLockedById(techId)
    - setLockedById(techId, locked)

# Terrain id lookup

## api.terrains
    - getTypeById(terrainId)
    - getIdByType(terrainType)

# Element id lookup

## api.elements
    - addInteractionInfo(elementTypeOrId, interaction)
    - getTypeById(elementId)
    - getIdByType(elementType)
    - getNameByType(elementType)

## api.collector
    - getValueByType(elementType)

# Structure instance ops

## api.structures
    - registerVariant(baseStructureTypeOrId, variant, options?)
    - forEachOfType(structureTypeOrId, callback)
    - getTypeById(structureId)
    - isType(structure, structureId)
    - isLockedByType(structureType)
    - mapValueToSpritesheetIndex(value, thresholds)
    - setSpritesheetIndex(structure, index)
    - setSpritesheetIndexByValue(structure, value, thresholds)
    - update(structure, options?)
    - updateData(structure, partial, options?)
## api.structures.processing

## api.building
    - selectStructure(structureTypeOrId)

## api.energy
    - registerType(structureId, type, options?)
    - consume(amount, options?)

## api.structureBehaviors
    - registerConveyorType(structureId, options?)
## api.signals
    - targets.register(structureTypeOrId, apply)
    - interactables.register(structureTypeOrId, handler)
    - registerSenderType(structureId, getOutput?)

## api.player.buildings
    - unlockById(structureId)
    - removeById(structureId)

## api.blueprints
    - serializeStructures(structures)
    - localizeStructures(structures)

# Item, upgrade & projectile state

## api.items
    - createById(itemId)
spriteMounts
    - isActiveById(itemId, itemType?)

## api.upgrades
    - getLevelById(itemId, upgradeId)
    - getAvailableLevelById(itemId, upgradeId)
    - setLevelById(itemId, upgradeId, level)

## api.projectiles
    - createBlueprintById(projectileId)
    - getById(projectileId)
    - remove(projectile)

## api.authorization
    - canUseTool(player, isFlamethrower?)

# Entity lifecycle

## api.entities
    - getById(entityId)
    - getAllByType(entityTypeId)
    - remove(entityId)
    - launch(entityId, angleRadians, speed?)
    - startCapture(entityId)
    - collect(entityId)

# Player movement & inventory

## api.player
    - setVelocity(velocityX, velocityY)
    - setMovementSpeedMultiplier(multiplier)
    - setMovementMode(mode)
    - inventory.hasById(itemId)
    - inventory.addById(itemId)

# Config, storage & assets

## api.gameConfig
    - get(key)

## api.settings
    - get(fieldId)
    - onChange(callback)
## api.storage
    - ensure(modId)
    - get(modId, key)
    - set(modId, key, value)
    - remove(modId, key)
    - local.get(key)
    - local.set(key, value)
    - local.remove(key)
## api.shared.buffers
    - ensure(key, config)
    - get(key)

## api.assets
    - getUrl(relativePath)
    - getSelectedProvider(kind)
    - setSelectedProvider(kind, providerId)

# Core services & event plumbing

## api.hooks
    - intercept(hookId, callback, options?)
    - modify(hookId, callback, options?)
## api.events
    - on(eventId, callback)
    - emit(eventId, payload)
## api.input
    - getBoundKeys(bindingId)
    - getDisplayKey(bindingId, defaultLabel?)
    - triggerBinding(bindingId)
    - pressBinding(bindingId)
    - releaseBinding(bindingId)

## api.progression
    - complete({ domain: "tutorial", grantNormalUnlocks? } | { domain: "objective", id })
## api.random
    - int(min, max)
    - float(min, max)
## api.sprites
    - load(spriteId, path, options?)
    - loadFromMod(spriteId, relativePath, options?)
    - getById(spriteId)
    - rotateAllForPlayer(angleRadians)

## api.action
    - setCustomData(data)
## api.cooldown
    - start(cooldown)
    - isReady(cooldown, durationOverrideMs?)
## api.resources
    - refresh(resourceId)
    - adjustEnergy(amount, options?)
## api.tools.grabber
    - setSize(size)
## api.schedule
    - nextTick(callback)
## api.grid
    - mutate(callback)
## api.pickups
    - remove(pickup)
    - pickUp(pickup)
    - getById(pickupId)

# Audio, camera & focus

## api.sound
    - play(soundId, options?)
    - playActive(soundId, options?)
    - playLayers(layers, options?)
    - stopBySoundId(soundId)

## api.ui.navigation
    - useFocusable(options)
    - useFocusScope(options)
    - getControllerFocusClass(focused)

## api.camera
    - setFocusAtWorld(worldX, worldY)
    - releaseFocus(options?)

# Session & mod lifecycle

## api.mods
    - getProviders(kind)

## api.game
    - start(options?)
## api.maps
    - start(mapId)

## api.rendering
    - withOverlayContext(callback)

## api.workers
    - setPostUpdateEnabled(enabled)

# Factory metrics

## api.factory
    - getProcessCount(processId)
    - getProcessRate(processId)

# Localisation

## api.i18n
    - t(key, params?)
    - register(locale, translations)
    - hasTranslation(key, locale?)
    - setLocale(locale)
    - formatNumber(value, options?)
    - joinKey(...parts)
    - createTranslatable(key, fallback)
    - setGlobal(key, value)
    - getGlobal(key)
    - removeGlobal(key)
    - formatKeyForDisplay(keyCode)

# UI, dialogs & components

## api.ui
    - update(componentId, options?)
    - showTooltip(data)
    - toast(message, options?)
    - alert(message, title?)
    - confirm(message, title?)
    - prompt(message, defaultValue?, placeholder?, title?, allowCopy?)
    - select(options, opts?)
    - useRefresh(componentIds)
    - useGameEvent(eventId, handler)
    - inject(componentId, Component)
## api.ui.regions
    -     mount(regionId, mountId, options)
    -     setVisible(regionId, visible)
## api.ui.overrides
    -     register(componentId, wrapper)
## api.ui.hotbar
    - createBankSource(options)
    - selectAction(action)
    - getSlotKeyLabel(bindingId)
## api.ui.components
    - ActionSlot(props)
    - Panel(props)
    - Button(props)

