# Public mod api — `sandkit.api` (main thread)

Generated from `__pakages/__other/sandkit/src/sandkit/api/*.d.ts`. Do not edit by hand —
run `deno run -A tools/extract-public-api.ts`.

Public `sandkit.api` members take only your own arguments: the engine
context is captured once and closed over by the host composer.

## `api.assets`

`sandkit.api.assets` — mod asset URLs and asset provider selection. Main thread only.

| call | returns | notes |
|---|---|---|
| `getUrl(relativePath: string): string` | `string` | Resolves a path under the mod folder to a loadable URL. |
| `getSelectedProvider(kind: string): AssetProviderV1 | null` | `AssetProviderV1 | null` | Returns the selected provider for an asset kind, or null. |
| `selectProvider(kind: string, providerId: string | null): boolean` | `boolean` | Selects a provider for an asset kind. Returns true on success. |

<details><summary>Types</summary>

**`AssetProviderV1`** — Describes a mod or pack that supplies assets for a kind.

- `id`: ``${string}:${string}:${string}``
- `kind`: `string`
- `localId?`: `string`
- `modId?`: `number`
- `modName`: `string`

</details>

## `api.authorization`

`sandkit.api.authorization` — player permission checks for build, grab, and tools. Main thread only.

| call | returns | notes |
|---|---|---|
| `canBuildAtCell(...args: CellCoordinates): boolean` | `boolean` | Return true when the player may place a structure at the cell. |
| `canGrabAtCell(...args: CellCoordinates): boolean` | `boolean` | Return true when the player may grab at the cell. |
| `canUseTool(player: Player, isFlamethrower?: boolean): boolean` | `boolean` | Return true when the player may use a tool. |
| `canUseToolAtCell(...args: [...CellCoordinates, isFlamethrower?: boolean]): boolean` | `boolean` | Return true when the player may use a tool at the cell. |
| `getZoneIdAtCell(...args: CellCoordinates): number` | `number` | Return the authorization zone id at the cell. |
| `getPlayerZoneId(): number` | `number` | Return the authorization zone id for the player. |

## `api.blueprints`

Structure blueprint serialize and localize helpers. Available as `sandkit.api.blueprints`.

| call | returns | notes |
|---|---|---|
| `serializeStructures(structures: readonly structures.Structure[]): BlueprintStructure[]` | `BlueprintStructure[]` | Serialize live structure instances into blueprint records. |
| `localizeStructures(structures: readonly BlueprintStructure[]): BlueprintStructure[]` | `BlueprintStructure[]` | Localize blueprint structure records for placement. |

<details><summary>Types</summary>

**`BlueprintStructure`** — Serialized structure entry used in blueprints.

- `x`: `number`
- `y`: `number`

</details>

## `api.building`

`sandkit.api.building` — structure placement and built-in structure types. Main thread only.

| call | returns | notes |
|---|---|---|
| `getSnappedPositionAtCell(...args: CellCoordinates): Vector2` | `Vector2` | Return the snapped world position for placement at the cell. |
| `isBlockedAtCell(...args: CellCoordinates): boolean` | `boolean` | Return true when placement is blocked at the cell. |
| `cancelPlacement(): void` | `void` | Cancel the current structure placement preview. |
| `selectStructure(structureTypeOrId: StructureType | shared.api.structures.StructureRef): shared.api.structures.StructureRef | null` | `shared.api.structures.StructureRef | null` | Select a structure for placement by type or id. |

## `api.camera`

`sandkit.api.camera` — camera focus and follow control. Main thread only.

| call | returns | notes |
|---|---|---|
| `snapToPlayer(): void` | `void` | Snap the camera to the player position. |
| `setFocusAtWorld(worldX: number, worldY: number): boolean` | `boolean` | Move camera focus to world coordinates. |
| `releaseFocus(options?: { durationMs?: number; }): boolean` | `boolean` | Release scripted focus and return control to the player. ```ts const released = api.camera.releaseFocus({ durationMs: 250 }); ``` |

## `api.collector`

`sandkit.api.collector` — collector structure value and pickup handling. Main thread only.

| call | returns | notes |
|---|---|---|
| `getValueFromCellId(cellId: CellId): number` | `number` | Returns the collector value for a cell id. |
| `getValueByType(elementType: shared.api.elements.ElementType): number` | `number` | Returns the collector value for an element type. |
| `isCellIdCollectable(cellId: CellId): boolean` | `boolean` | Returns true when the cell id can be collected. |
| `isCellIdCollectableForSprite(cellId: CellId): boolean` | `boolean` | Returns true when the cell id can be collected for sprite display. |
| `notifyPickupAtCell(...args: CellCoordinates): void` | `void` | Notifies collector logic that a pickup happened at the cell. |

## `api.constants`

Physics skip modes used with element skip-physics fields. `sandkit.api.constants` — shared numeric constants for mod API use. Main thread only.

## `api.cooldown`

`sandkit.api.cooldown` — reusable cooldown timers for abilities and items. Main thread only.

| call | returns | notes |
|---|---|---|
| `check(cooldown: Cooldown, overrideTime?: number): boolean` | `boolean` | Starts the cooldown when ready and returns true; otherwise returns false. |
| `isReady(cooldown: Cooldown, overrideTime?: number): boolean` | `boolean` | Returns true when the cooldown has elapsed. |

<details><summary>Types</summary>

**`Cooldown`** — Cooldown state object passed to {@link check} and {@link isReady}.

- `last`: `number` — Timestamp when the cooldown was last triggered (game time).
- `time`: `number` — Cooldown duration in milliseconds.

</details>

## `api.discoveries`

`sandkit.api.discoveries` — unlock element and terrain entries in the discovery log. Main thread only.

| call | returns | notes |
|---|---|---|
| `addElementByType(elementType: shared.api.elements.ElementType): void` | `void` | Marks an element type as discovered for the player. |
| `addTerrainByType(terrainType: shared.api.terrains.TerrainType): void` | `void` | Marks a terrain type as discovered for the player. |

## `api.effects`

`sandkit.api.effects` — visual effects, particles, and lasers at world positions. Main thread only. Temporary lights live under {@link lights.temporary}.

| call | returns | notes |
|---|---|---|
| `createAtWorld( effectId: string, worldX: number, worldY: number, options?: EffectOptions, ): void` | `void` | Creates a named screen effect at world coordinates. |
| `createEffectAtWorld( effectId: string, worldX: number, worldY: number, options?: EffectOptions, ): void` | `void` |  |
| `createLightAtWorld( worldX: number, worldY: number, options?: TemporaryLightOptions, ): { lightId: number | null; index?: number | null; }` | `{ lightId: number | null; index?: number | null; }` |  |
| `createDistortionWaveAtWorld(worldX: number, worldY: number, options?: DistortionEffectOptions): void` | `void` | Creates a distortion wave effect at world coordinates. ```ts api.effects.createDistortionWaveAtWorld(worldX, worldY, { style: "implode", }); ``` |
| `createLaserAtWorld( startWorldX: number, startWorldY: number, endWorldX: number, endWorldY: number, options?: LaserEffectOptions, ): LaserEffectHandle` | `LaserEffectHandle` | Creates a laser beam between two world points. Returns a handle to destroy it. |
| `removeLightById(lightId: number): void` | `void` |  |

**Aliases**

- `EffectOptions` → `shared.api.effects.EffectOptions`
- `TemporaryLightOptions` → `shared.api.effects.TemporaryLightOptions`
- `ParticleEffectOptions` → `shared.api.effects.ParticleEffectOptions`
- `createParticlesAtWorld` → `shared.api.effects.createParticlesAtWorld`

<details><summary>Types</summary>

**`LaserEffectOptions`** — Options for laser beam effects.

- `width?`: `number` — Beam width in pixels.
- `brightness?`: `number` — Beam brightness multiplier.
- `color?`: `number` — Beam color as a packed integer.
- `glow?`: `boolean` — When true, draws a glow around the beam.

**`LaserEffectHandle`** — Handle returned by createLaserAtWorld.


**`DistortionEffectOptions`** — Options for distortion wave effects.

- `style?`: `"implode" | "explode"` — Distortion style: implode or explode.
- `duration?`: `number` — Effect duration in seconds.
- `maxRadius?`: `number` — Maximum radius of the wave.
- `intensity?`: `number` — Visual intensity of the distortion.
- `color?`: `[number, number, number, number]` — RGBA color components for the effect.

</details>

## `api.elements`

`sandkit.api.elements` — register elements and read or change cells on the main thread. Main thread only.

| call | returns | notes |
|---|---|---|
| `getRegisteredTypes(): ElementType[]` | `ElementType[]` | Returns all registered element type ids. |
| `register(definition: ElementDefinition): { elementType: ElementType; }` | `{ elementType: ElementType; }` | Registers a new element and returns its assigned type id. |
| `updateDefinition(elementTypeOrId: ElementRef, partial: Partial<ElementDefinition>): void` | `void` | Updates fields on an existing element definition. ```ts api.elements.updateDefinition("exampleElement", { showInFilterPicker: false, }); ``` |
| `addInteractionInfo(elementTypeOrId: ElementRef, interaction: Interaction): void` | `void` | Adds an interaction entry to an element definition. |
| `getNameByType(elementType: ElementType): string` | `string` | Returns the display name for an element type. |
| `findFreeCellInStructure(structureCellX: number, structureCellY: number, structureSizeCells: number): Vector2 | null` | `Vector2 | null` | Finds a free cell inside a structure footprint, or null. |
| `createAtCell(...args: [...CellCoordinates, elementTypeOrId: ElementRef, options?: ElementCreateOptions]): void` | `void` | Create an element at a cell. Main-entry writes are deferred; reads see the old grid. ```ts api.elements.createAtCell(cellX, cellY, "water", { durationTicks: 60, }); ``` ```ts api.elements.createAtCell(cellX, cellY, "steam", { durationTicks: 120, }); ``` |
| `createAtCellWhenIdle(...args: [...CellCoordinates, elementTypeOrId: ElementRef, options?: ElementCreateOptions]): void` | `void` |  |
| `replaceAtCell(...args: [...CellCoordinates, elementTypeOrId: ElementRef, options?: ElementCreateOptions]): void` | `void` | Replace the element at a cell. Main-entry writes are deferred; reads see the old grid. |
| `replaceAtCellWhenIdle(...args: [...CellCoordinates, elementTypeOrId: ElementRef, options?: ElementCreateOptions]): void` | `void` |  |
| `removeAtCell(...args: [...CellCoordinates, options?: ElementRemovalOptions]): void` | `void` | Remove the element at a cell. Main-entry writes are deferred; reads see the old grid. |
| `removeAtCellWhenIdle(...args: [...CellCoordinates, options?: ElementRemovalOptions]): void` | `void` |  |
| `teleportBetweenCells(fromCellX: number, fromCellY: number, toCellX: number, toCellY: number): void` | `void` | Move an element between cells. Main-entry writes are deferred; reads see the old grid. |
| `teleportBetweenCellsWhenIdle(fromCellX: number, fromCellY: number, toCellX: number, toCellY: number): void` | `void` |  |
| `setVelocityAtCell(...args: [...CellCoordinates, velocity: Vector2]): void` | `void` | Set particle velocity at a cell. Main-entry writes are deferred; reads see the old grid. ```ts api.elements.setVelocityAtCell(cellX, cellY, { x: 0, y: -120 }); ``` |
| `setVelocityAtCellWhenIdle(...args: [...CellCoordinates, velocity: Vector2]): void` | `void` |  |
| `addParticleVelocityAtCell(...args: [...CellCoordinates, velocity: Vector2, maxSpeedCellsPerSecond?: number]): void` | `void` | Add velocity to a particle at a cell. Main-entry writes are deferred; reads see the old grid. ```ts api.elements.addParticleVelocityAtCell( cellX, cellY, { x: 4, y: -8 }, 120, ); ``` |
| `addParticleVelocityAtCellWhenIdle(...args: [...CellCoordinates, velocity: Vector2, maxSpeedCellsPerSecond?: number]): void` | `void` |  |
| `convertToParticleAtCell(...args: [...CellCoordinates, velocity: Vector2]): void` | `void` | Convert a cell element to a particle. Main-entry writes are deferred; reads see the old grid. ```ts api.elements.convertToParticleAtCell( cellX, cellY, { x: 0, y: -120 }, ); ``` |
| `convertToParticleAtCellWhenIdle(...args: [...CellCoordinates, velocity: Vector2]): void` | `void` |  |
| `convertFromParticleAtCell(...args: CellCoordinates): void` | `void` | Convert a particle back to a solid element. Main-entry writes are deferred; reads see the old grid. |
| `convertFromParticleAtCellWhenIdle(...args: CellCoordinates): void` | `void` |  |
| `setDataFieldAtCell(...args: [...CellCoordinates, fieldNumber: 1 | 2 | 3 | 4, value: number]): void` | `void` | Set a data field on the element at a cell. Main-entry writes are deferred; reads see the old grid. |
| `setDataFieldAtCellWhenIdle(...args: [...CellCoordinates, fieldNumber: 1 | 2 | 3 | 4, value: number]): void` | `void` |  |
| `refreshColorAtCell(...args: CellCoordinates): void` | `void` | Refresh the rendered color at a cell. Main-entry writes are deferred; reads see the old grid. |
| `refreshColorAtCellWhenIdle(...args: CellCoordinates): void` | `void` |  |
| `setPhysicsAtCell(...args: [...CellCoordinates, physicsState: number]): void` | `void` | Set the physics skip mode at a cell. Main-entry writes are deferred; reads see the old grid. |
| `setPhysicsAtCellWhenIdle(...args: [...CellCoordinates, physicsState: number]): void` | `void` |  |
| `setDurationAtCell(...args: [...CellCoordinates, durationTicks: number, options?: { updateMax?: boolean; }]): void` | `void` | Set element duration at a cell. Main-entry writes are deferred; reads see the old grid. ```ts api.elements.setDurationAtCell( cellX, cellY, 120, { updateMax: true }, ); ``` |
| `setDurationAtCellWhenIdle(...args: [...CellCoordinates, durationTicks: number, options?: { updateMax?: boolean; }]): void` | `void` |  |

**Aliases**

- `ElementType` → `shared.api.elements.ElementType`
- `ElementId` → `shared.api.elements.ElementId`
- `ElementRef` → `shared.api.elements.ElementRef`
- `MatterType` → `shared.api.elements.MatterType`
- `ElementDefinition` → `shared.api.elements.ElementDefinition`
- `ElementCreateOptions` → `shared.api.elements.ElementCreateOptions`
- `ElementRemovalOptions` → `shared.api.elements.ElementRemovalOptions`
- `getIdByType` → `shared.api.elements.getIdByType`
- `getTypeById` → `shared.api.elements.getTypeById`
- `getTypeFromId` → `shared.api.elements.getTypeFromId`
- `getDefinitionByType` → `shared.api.elements.getDefinitionByType`
- `getTypeAtCell` → `shared.api.elements.getTypeAtCell`
- `getResolvedTypeAtCell` → `shared.api.elements.getResolvedTypeAtCell`
- `getResolvedTypeFromCellId` → `shared.api.elements.getResolvedTypeFromCellId`
- `getInfoAtCell` → `shared.api.elements.getInfoAtCell`
- `getMatterTypeAtCell` → `shared.api.elements.getMatterTypeAtCell`
- `isTypeAtCell` → `shared.api.elements.isTypeAtCell`
- `isFreeFallingAtCell` → `shared.api.elements.isFreeFallingAtCell`
- `getVelocityAtCell` → `shared.api.elements.getVelocityAtCell`
- `getDataFieldAtCell` → `shared.api.elements.getDataFieldAtCell`
- `Interaction` → `InteractionDestroyer | InteractionStructure | InteractionEntity | InteractionFlammable | InteractionMeltable | InteractionFreezable | InteractionCustom`

<details><summary>Types</summary>

**`InteractionStructureMetadata`** — Optional tooltip metadata on structure interactions.

- `textKey?`: `string` — i18n key for custom interaction label text.
- `crossedOutWhen?`: `{ dataField: number; equals: number; }` — Hide the label when a data field matches a value.
- `visibleWhen?`: `{ dataField: number; equals: number; }` — Show the label only when a data field matches a value.
- `onlyWhenTranslated?`: `boolean` — Require the text key to exist in the active locale.

**`InteractionDestroyer`** — Interaction that destroys specific items.

- `kind`: `"destroyer";   items: readonly string[];`

**`InteractionStructure`** — Interaction that affects specific structures.

- `kind`: `"structure";   structures: readonly string[];`

**`InteractionEntity`** — Interaction that affects specific entities.

- `kind`: `"entity";   entities: readonly string[];`

**`InteractionFlammable`** — Interaction that marks the element as flammable.

- `kind`: `"flammable"`

**`InteractionMeltable`** — Interaction that marks the element as meltable.

- `kind`: `"meltable"`

**`InteractionFreezable`** — Interaction that marks the element as freezable.

- `kind`: `"freezable"`

**`InteractionCustom`** — Interaction handled by custom mod logic and tooltip text.

- `kind`: `"custom"`

</details>

## `api.energy`

`sandkit.api.energy` — structure energy networks, storage, and consumption. Main thread only.

| call | returns | notes |
|---|---|---|
| `registerType(structureId: string, type: 'conductor' | 'storage', options?: EnergyRegisterTypeOptions): void` | `void` | Registers an energy type on a structure as conductor or storage. |
| `addAtCell(...args: [...CellCoordinates, amount: number, options?: EnergyAddOptions]): number` | `number` | Adds energy at a cell. Returns the amount actually added. |
| `consume(amount: number, options?: { allOrNothing?: boolean; }): number` | `number` | Consumes energy from the global pool. Returns the amount consumed. |
| `consumeExcludingNetworkAtCell(...args: [...CellCoordinates, amount: number]): number` | `number` | Consumes energy from networks other than the one at the cell. |
| `getNetworkAtCell(...args: CellCoordinates): { x: number; y: number; type: string; }[]` | `{ x: number; y: number; type: string; }[]` | Returns energy network nodes connected at the cell. ```ts const network = api.energy.getNetworkAtCell(cellX, cellY); for (const entry of network) { useNetworkCell(entry.cellX, entry.cellY, entry.type); } ``` |
| `getNetworkFreeCapacityAtCell(...args: CellCoordinates): number` | `number` | Returns free storage capacity in the network at the cell. |

<details><summary>Types</summary>

**`EnergyRegisterTypeOptions`** — Options for {@link registerType}.

- `capacity?`: `number` — Maximum stored energy for storage nodes.
- `energyType?`: `string` — Energy type id when multiple networks exist.

**`EnergyAddOptions`** — Options for {@link addAtCell}.

- `energyType?`: `string` — Energy type id when multiple networks exist.

</details>

## `api.entities`

Entity spawn, capture, and lifecycle helpers. Available as `sandkit.api.entities`.

| call | returns | notes |
|---|---|---|
| `getById(entityId: number): Entity | undefined` | `Entity | undefined` | Return one live entity by runtime id. |
| `getAllByType(entityTypeId: string): Entity[]` | `Entity[]` | Return all live entities of one type. |
| `spawnAtWorld(entityTypeId: string, worldX: number, worldY: number): Entity` | `Entity` | Spawn an entity at world position. |
| `remove(entityId: number): void` | `void` | Remove an entity from the world. |
| `launch(entityId: number, angleRadians: number, speed?: number): void` | `void` | Launch an entity with angle and optional speed. |
| `startCapture(entityId: number): void` | `void` | Start capture for an entity (for example vacuum capture). |
| `collect(entityId: number): void` | `void` | Collect an entity (for example into inventory or storage). |

<details><summary>Types</summary>

**`Entity`** — Active entity instance in the world.

- `id`: `number`
- `x`: `number`
- `y`: `number`
- `targetX?`: `number`
- `targetY?`: `number`

</details>

## `api.events`

`sandkit.api.events` — subscribe to and emit named game events. Main thread only. The `events` object is frozen; do not replace `on` or `emit`.

| call | returns | notes |
|---|---|---|
| `on(eventId: K, callback: (payload: EventPayload<K>) => void): () => void` | `() => void` | Subscribes to an event. Returns an unsubscribe function. ```ts const unsubscribe = api.events.on("item:used", (payload) => { if (payload.itemId !== "laser") return; spawnSparklesAtCell(payload.cellX, payload.cellY); }); ``` ```ts api.events.on("frame:render", () => { drawOverlay(); }); ``` ```ts api.events.on("scene:game:started", () => { initializeGameScene(); }); ``` ```ts api.events.on("earlyAccess:completed", (payload) => { onEarlyAccessCompleted(payload); }); ``` ```ts api.events.on("terrain:destroyed", (payload) => { onTerrainDestroyed(payload.cellX, payload.cellY, payload.cellType); }); ``` ```ts api.events.on("fog:cellRevealed", (payload) => { onFogCellRevealed(payload.cellX, payload.cellY); }); ``` ```ts api.events.on("upgrade:levelSelected", (payload) => { onLevelSelected(payload.itemId, payload.upgradeId, payload.level); }); ``` ```ts api.events.on("building:placed", (payload) => { onBuildingPlaced(payload.structure, payload.x, payload.y); }); ``` ```ts api.events.on("building:removed", (payload) => { onBuildingRemoved(payload.structureId, payload.x, payload.y); }); ``` ```ts api.events.on("structures:placed", (payload) => { onStructuresPlaced(payload.structures); }); ``` ```ts api.events.on("structures:removed", (payload) => { onStructuresRemoved(payload.removed, payload.byMove); }); ``` ```ts api.events.on("structures:moved", (payload) => { onStructuresMoved(payload.moved, payload.failedToPlace); }); ``` ```ts api.events.on("game:ready", () => { initializeExample(); }); ``` ```ts api.events.on("game:started", () => { startExample(); }); ``` ```ts api.events.on("tutorial:stepChanged", (payload) => { onTutorialStepChanged(payload.step); }); ``` ```ts api.events.on("tutorial:completed", (payload) => { onTutorialCompleted(payload.skipped); }); ``` ```ts api.events.on("tech:unlocked", (payload) => { onTechUnlocked(payload.techId, payload.suppressMusic); }); ``` ```ts api.events.on("worldItem:pickedUp", (payload) => { onPickup(payload.worldItemId, payload.type); }); ``` ```ts api.events.on("resource:collected", (payload) => { onResourceCollected(payload.resourceId, payload.amount); }); ``` |
| `emit(eventId: K, payload: EventPayload<K>): void` | `void` | Emits an event with a payload to all subscribers. |

**Aliases**

- `EventId` → `LooseString<keyof EventPayloadMap>`

<details><summary>Types</summary>

**`PlayerCollisionPreparePayload`** — Mutable payload for `player:collision:prepare`. Listeners may change `maxStepCells` (clamped 1–8) and phasing flags.

- `phaseThroughTerrain`: `boolean` — When true, terrain collision is skipped this sub-step.
- `phaseThroughStructures`: `boolean` — When true, structure collision is skipped this sub-step.
- `maxStepCells`: `number` — Max cells the player can step up when blocked horizontally (1–8).

**`EventPayloadMap`** — Known event payloads. Unlisted ids still use `unknown`.


</details>

## `api.excavation`

`sandkit.api.excavation` — register custom excavation tool dig profiles. Main thread only.

| call | returns | notes |
|---|---|---|
| `registerProfile(id: string, definition: ExcavationProfileDefinitionV1): void` | `void` | Registers an excavation profile by id. ```ts const profileId = "example:voidGun"; const duneType = api.terrains.getTypeById("dune"); const sandType = api.elements.getTypeById("sand"); api.excavation.registerProfile(profileId, { power: 8, terrainRules: [ { cellType: duneType, outputElementType: sandType, }, ], }); api.hooks.modify("excavation:prepare", (args) => { if ( args.sourceKind !== "projectile" || args.sourceId !== "implosionGun" ) { return; } args.profileId = profileId; }); ``` |

<details><summary>Types</summary>

**`ExcavationProfileDefinitionV1`** — Excavation tool profile definition.

- `pattern?`: `number[][]` — Dig pattern grid; non-zero cells are removed.
- `power`: `number` — Dig strength applied to matched cells. Clamped to 0–1000.
- `options?`: `ExcavationProfileOptions` — Optional profile-specific excavation flags.
- `terrainRules?`: `readonly ExcavationTerrainRule[]` — Per-terrain output and damage rules.

**`ExcavationProfileOptions`** — Options attached to an excavation profile definition.

- `fromGun?`: `boolean`
- `fromRocketExplosion?`: `boolean`
- `fromDrill?`: `boolean`
- `useLiteralOutVelocity?`: `boolean`
- `destroyNonDestructible?`: `boolean`
- `forceRemoveAll?`: `boolean`
- `drillTierDamage?`: `number` — Clamped to 0–1000 when set.

**`ExcavationTerrainRule`** — Terrain match rule within an excavation profile.

- `cellType`: `terrains.TerrainRef` — Terrain cell type to match.
- `terrainType?`: `terrains.TerrainRef`
- `damage?`: `number` — Damage applied when this rule matches.
- `outputElementType?`: `elements.ElementRef` — Element type produced when this terrain is excavated.

</details>

## `api.factory`

Factory progression level and process counters. Available as `sandkit.api.factory`.

| call | returns | notes |
|---|---|---|
| `getLevel(): number` | `number` | Return the current factory level. |
| `getProcessCount(processId: FactoryProcessId): number` | `number` | Return completed count for a factory process. |
| `getProcessRate(processId: FactoryProcessId): number` | `number` | Return completion rate for a factory process. |

**Aliases**

- `FactoryProcessId` → `| "shakeWetSand" | "pressBurntResidue" | "growFlowers" | "condenseFlorin"`

## `api.fire`

`sandkit.api.fire` — ignite and burn elements at grid cells. Main thread only.

| call | returns | notes |
|---|---|---|
| `canBurnElementAtCell(...args: CellCoordinates): boolean` | `boolean` | Returns true when the element at the cell can burn. |
| `burnElementAtCell(...args: CellCoordinates): void` | `void` | Burn the element at the cell. Main-entry writes are deferred; reads see the old grid. |
| `burnElementAtCellWhenIdle(...args: CellCoordinates): void` | `void` |  |

## `api.game`

Game session start helpers. Available as `sandkit.api.game`.

| call | returns | notes |
|---|---|---|
| `start(options?: GameStartOptions): void` | `void` | Start or restart the game session. ```ts api.game.start({ skipIntro: true }); ``` |

<details><summary>Types</summary>

**`GameStartOptions`** — Options for {@link start}.

- `skipIntro?`: `boolean` — When true, skip the intro sequence.

</details>

## `api.grid`

`sandkit.api.grid` — grid cell queries, deferred mutations, and iteration. Main thread only.

| call | returns | notes |
|---|---|---|
| `mutate(callback: (writer: GridMutationWriter) => void): void` | `void` | Run deferred grid mutations on the main thread. Reads see the old grid until mutations apply. ```ts api.grid.mutate((writer) => { if (api.terrains.isTypeAtCell(cellX, cellY, "ice")) { writer.elements.replaceAtCell(cellX, cellY, "water"); } }); ``` ```ts const waterType = api.elements.getTypeById("water"); api.events.on("item:used", ({ itemId, cellX, cellY }) => { if (itemId !== "laser") return; api.grid.mutate((writer) => { if (!api.terrains.isTypeAtCell(cellX, cellY, "ice")) return; writer.elements.replaceAtCell(cellX, cellY, waterType); }); }); ``` |
| `revealFogAtCell(...args: CellCoordinates): void` | `void` | Reveal fog of war at a cell. |
| `redrawAroundCell(...args: [...CellCoordinates, rangeCells: number]): void` | `void` | Request redraw around a cell. |
| `forEachCellInCircle(centerCellX: number, centerCellY: number, radiusCells: number, callback: (...args: CellCoordinates) => void): void` | `void` | Calls the callback for each cell inside a circle. |
| `forEachCellInRectangle(...args: [...CellCoordinates, widthCells: number, heightCells: number, callback: (...args: CellCoordinates) => void]): void` | `void` | Calls the callback for each cell in a rectangle. |
| `forEachCellInRect(...args: [...CellCoordinates, widthCells: number, heightCells: number, callback: (...args: CellCoordinates) => void]): void` | `void` |  |

**Aliases**

- `getCellIdAtCell` → `shared.api.grid.getCellIdAtCell`
- `isCellEmptyAtCell` → `shared.api.grid.isCellEmptyAtCell`
- `isTerrainAtCell` → `shared.api.grid.isTerrainAtCell`
- `reportActivityAtCell` → `shared.api.grid.reportActivityAtCell`
- `excavateAtCell` → `shared.api.grid.excavateAtCell`
- `getDimensions` → `shared.api.grid.getDimensions`
- `ExcavateOptions` → `shared.api.grid.ExcavateOptions`
- `CellId` → `shared.api.grid.CellId`
- `GridDimensions` → `shared.api.grid.GridDimensions`

<details><summary>Types</summary>

**`GridMutationWriter`** — Deferred element and terrain mutations passed to {@link mutate}.

- `elements`: `GridMutationWriterElements` — Element cell mutations inside a {@link mutate} callback.
- `terrains`: `GridMutationWriterTerrains` — Terrain cell mutations inside a {@link mutate} callback.

**`GridMutationWriterElements`** — Element writers available on {@link GridMutationWriter.elements}.


**`GridMutationWriterTerrains`** — Terrain writers available on {@link GridMutationWriter.terrains}.


</details>

## `api.hooks`

`sandkit.api.hooks` — intercept and modify internal game hook points. Main thread only.

| call | returns | notes |
|---|---|---|
| `intercept( hookId: K, callback: (args: InterceptHookArgs<K>, context: HookContext) => void, options?: InterceptHookOptions<K>, ): () => void` | `() => void` | Registers an intercept hook. Returns an unsubscribe function. ```ts const unsubscribe = api.hooks.intercept( "item:use", (args, context) => { args.prepared.energyCost = Number(args.baseline.energyCost) * 2; if (args.prepared.energyCost > 1000) { context.cancel(); } }, { itemIds: ["laser"], priority: 0 }, ); ``` ```ts api.hooks.intercept("teleport:effect:create", (args, context) => { context.cancel(); }); ``` ```ts api.hooks.intercept("action:start", (args, context) => { if (args.action?.id === "example") context.cancel(); }); ``` ```ts api.hooks.intercept("input:keyDown", (args, context) => { if (args.code === "KeyK") context.cancel(); }); ``` ```ts api.hooks.intercept("input:keyUp", (args, context) => { if (args.code === "KeyK") context.cancel(); }); ``` ```ts api.hooks.intercept("placePoints:suppress", (args, context) => { if (args.type === "exampleStructure") context.cancel(); }); ``` ```ts api.hooks.intercept( "placePoints:directionalArrows:suppress", (args, context) => { if (args.type === "exampleStructure") context.cancel(); }, ); ``` ```ts const unsubscribe = api.hooks.intercept( "entity:update", (args) => { if (args.phase !== "normal") return; args.entity.targetX = args.playerWorldX; args.entity.targetY = args.playerWorldY; }, { entityTypes: ["lumling"], priority: 0 }, ); ``` ```ts api.hooks.intercept("building:place", (args, context) => { if (args.structureId === "exampleStructure") context.cancel(); }); ``` ```ts api.hooks.intercept("building:clearShape", (args, context) => { if (args.structure.data?.protected) context.cancel(); }); ``` ```ts api.hooks.intercept("input:scroll", (args, context) => { if (args.deltaY !== 0) context.cancel(); }); ``` ```ts api.hooks.intercept("input:boostDown", (args, context) => { context.cancel(); }); ``` ```ts api.hooks.intercept("input:descendDown", (args, context) => { context.cancel(); }); ``` ```ts api.hooks.intercept("input:escape", (args, context) => { context.cancel(); }); ``` ```ts api.hooks.intercept("interactable:suppressHover", (args, context) => { if (args.type === "exampleStructure") context.cancel(); }); ``` ```ts api.hooks.intercept("fire:element:ignite", (args, context) => { if (args.elementType === exampleElementType) context.cancel(); }); ``` ```ts api.hooks.intercept( "projectile:fire:overStructure", (args, context) => { if (args.projectile.type === "exampleProjectile") context.cancel(); }, ); ``` ```ts api.hooks.intercept("projectile:hit", (args, context) => { if (args.projectile.type === "exampleProjectile") context.cancel(); }); ``` ```ts api.hooks.intercept("player:position:commit", (args) => { args.velocityX *= 0.5; args.velocityY *= 0.5; }); ``` ```ts api.hooks.intercept("progression:purchase", (args, context) => { if (args.id === "exampleTech") context.cancel(); }); ``` |
| `modify( hookId: K, callback: (args: ModifyHookArgs<K>) => void, options?: ModifyHookOptions, ): () => void` | `() => void` | Registers a modifier hook. Returns an unsubscribe function. ```ts const unsubscribe = api.hooks.modify( "excavation:prepare", (args) => { if (args.sourceId !== "implosionGun") return; args.profileId = "example:voidGun"; args.patternDiameterCells = 21; args.drillTierDamage = 8; }, { priority: 0 }, ); ``` ```ts const unsubscribe = api.hooks.modify( "locator:scan:prepare", (args) => { const target = findNearestTarget(args.originWorldX, args.originWorldY); args.hasTarget = target !== null; if (!target) { args.noTargetToast = "No example target was found."; args.noTargetToastKey = "mods|example|noTarget"; return; } args.targetCellX = target.cellX; args.targetCellY = target.cellY; args.outerTint[0] = 103; args.outerTint[1] = 232; args.outerTint[2] = 249; args.triangulationLensOverride = true; }, { priority: 0 }, ); ``` ```ts const vacuumPattern = [ [0, 1, 0], [1, 1, 1], [0, 1, 0], ]; const unsubscribe = api.hooks.modify( "vacuum:prepare", (args) => { const target = api.input.getMousePositionAtCell(); args.targetCellX = target.x; args.targetCellY = target.y; args.pattern = vacuumPattern; }, { priority: 0 }, ); ``` ```ts const unsubscribe = api.hooks.modify( "vacuum:element:prepare", (args) => { if (args.matterType !== sandkit.enums.MatterType.Liquid) return; args.collectable = true; args.visibleInPicker = true; }, { priority: 0 }, ); ``` ```ts api.hooks.modify("player:movement:prepare", (args) => { args.horizontalMaxSpeed *= 1.25; }); ``` ```ts api.hooks.modify("building:placementLimit:prepare", (args) => { args.maxCount = args.maxCount === null ? 10 : args.maxCount + 10; }); ``` ```ts api.hooks.modify("fluxEmanator:processing:prepare", (args) => { args.speedMultiplier *= 2; }); ``` ```ts api.hooks.modify("render:pipes:prepare", (args) => { args.layer = "foreground"; }); ``` ```ts api.hooks.modify("structures:moved:prepare", (args) => { prepareMovedStructures(args.moved, args.failedToPlace); }); ``` ```ts api.hooks.modify("structures:removed:prepare", (args) => { prepareRemovedStructures(args.removed, args.byMove); }); ``` ```ts api.hooks.modify("weapon:reload:prepare", (args) => { args.reloadMs *= 0.8; }, { weaponIds: ["exampleWeapon"] }); ``` ```ts api.hooks.modify("projectile:travel:prepare", (args) => { args.collidesWithStructures = false; }, { projectileTypes: ["exampleProjectile"] }); ``` ```ts api.hooks.modify("projectile:impact:prepare", (args) => { args.radiusCells = 8; }, { projectileTypes: ["exampleProjectile"] }); ``` ```ts api.hooks.modify("player:collision:prepare", (args) => { args.maxStepCells = 4; }); ``` ```ts api.hooks.modify("trigger:schedule:prepare", (args) => { args.intervalMs *= 0.5; }, { triggerIds: ["pump"] }); ``` ```ts api.hooks.modify("progression:cost:prepare", (args) => { if (args.currencyId === "gold") args.amount *= 0.9; }); ``` ```ts api.hooks.modify("resource:collection:prepare", (args) => { args.amount *= 2; }, { resourceIds: ["fluxite"] }); ``` ```ts api.hooks.modify("resource:delivery:prepare", (args) => { args.mode = "collection"; }, { resourceIds: ["fluxite"] }); ``` ```ts api.hooks.modify("resource:balance:prepare", (args) => { args.balance += api.storage.get("example", "gold") ?? 0; }, { resourceIds: ["gold"] }); ``` ```ts api.hooks.modify("gold:removal:prepare", (args) => { const banked = api.storage.get("example", "gold") ?? 0; args.shortfall = Math.max(0, args.shortfall - banked); }); ``` ```ts api.hooks.modify("gold:removal:settle", (args) => { const banked = api.storage.get("example", "gold") ?? 0; const covered = Math.min(banked, args.shortfall); api.storage.set("example", "gold", banked - covered); args.shortfall -= covered; }); ``` |

**Aliases**

- `InterceptHookId` → `LooseString< | "item:use" | "teleport:effect:create" | "teleport:effect" | "action:start" | "action:intercept" | "input:keyDown" | "input:keydown" | "input:keyUp" | "input:keyup" | "placePoints:suppress" | "placePoints:isSuppressed" | "placePoints:directionalArrows:suppress" | "placePoints:directionalArrows:isSuppressed" | "entity:update" | "building:place" | "building:clearShape" | "input:scroll" | "input:boostDown" | "input:boost-down" | "input:descendDown" | "input:descend-down" | "input:escape" | "interactable:suppressHover" | "fire:element:ignite" | "projectile:fire:overStructure" | "projectile:hit" | "player:position:commit" | "progression:purchase" >`
- `ModifyHookId` → `LooseString< | "excavation:prepare" | "locator:scan:prepare" | "vacuum:prepare" | "vacuum:element:prepare" | "player:movement:prepare" | "player:movement" | "building:placementLimit:prepare" | "building:placementLimit" | "building:placement-limit" | "fluxEmanator:processing:prepare" | "fluxEmanator:processing" | "flux-emanator:processing" | "render:pipes:prepare" | "render:pipes" | "structures:moved:prepare" | "structures:removed:prepare" | "weapon:reload:prepare" | "projectile:travel:prepare" | "projectile:impact:prepare" | "player:collision:prepare" | "trigger:schedule:prepare" | "progression:cost:prepare" | "resource:collection:prepare" | "resource:delivery:prepare" | "resource:balance:prepare" | "gold:removal:prepare" | "gold:removal:settle" >`

<details><summary>Types</summary>

**`HookContext`** — Context passed to intercept hook callbacks.

- `cancelled`: `boolean` — True after {@link cancel} was called on this context.

**`HookOptions`** — Options shared by intercept and modify hooks.

- `priority?`: `number` — Run this hook before others with lower priority.

**`ModifyHookOptions`** — Options for {@link modify}.

- `weaponIds?`: `string[]; priority?: number`

**`InterceptHookMap`** — Intercept hook argument shapes keyed by hook id.


**`ModifierHookMap`** — Modify hook argument shapes keyed by hook id.


</details>

## `api.i18n`

`sandkit.api.i18n` — translations, locales, and display strings for mods. Main thread only.

| call | returns | notes |
|---|---|---|
| `t(key: string, params?: Record<string, string | number>): string` | `string` | Translates a key with optional parameter substitution. ```ts const message = api.i18n.t("mods|example|count", { count: 3, }); ``` |
| `register(locale: Locale, translations: Record<string, string>): void` | `void` | Registers translation strings for a locale. ```ts api.i18n.register("en", { "mods|example|title": "Example", }); ``` |
| `getLocale(): Locale` | `Locale` | Returns the active locale code. |
| `hasTranslation(key: string, locale?: Locale): boolean` | `boolean` | Returns true when a translation exists for the key. |
| `setLocale(locale: Locale): Promise<void>` | `Promise<void>` | Sets the active locale. |
| `getLanguages(): { code: Locale; nativeName: string; englishName: string; enabled: boolean; }[]` | `{ code: Locale; nativeName: string; englishName: string; enabled: boolean; }[]` | Returns metadata for all known languages. |
| `getAvailableLocales(): Locale[]` | `Locale[]` | Returns locale codes that have registered translations. |
| `formatNumber(value: number, options?: I18nNumberFormatOptions): string` | `string` | Formats a number for the active locale. ```ts const formatted = api.i18n.formatNumber(1234.5, { maximumFractionDigits: 1, }); ``` |
| `joinKey(...parts: string[]): string` | `string` | Joins key parts into a single translation key. |
| `key(...parts: string[]): string` | `string` |  |
| `getName(definition: { nameKey?: string; name?: string; }): string` | `string` | Returns the display name from a definition with nameKey or name. ```ts const name = api.i18n.getName({ name: "Example Machine", nameKey: "structures|exampleMachine|name", }); ``` |
| `getDescription(definition: { descriptionKey?: string; description?: string; }): string` | `string` | Returns the description from a definition with descriptionKey or description. |
| `createTranslatable(key: string, fallback: string): { __translatable: true; key: string; fallback: string; }` | `{ __translatable: true; key: string; fallback: string; }` | Creates a translatable string object with a fallback. |
| `translatable(key: string, fallback: string): { __translatable: true; key: string; fallback: string; }` | `{ __translatable: true; key: string; fallback: string; }` |  |
| `setGlobal(key: string, value: string | (() => string)): void` | `void` | Sets a global string or lazy resolver used in translations. |
| `getGlobal(key: string): string | undefined` | `string | undefined` | Returns a global translation helper value. |
| `removeGlobal(key: string): void` | `void` | Removes a global translation helper value. |
| `clearGlobal(key: string): void` | `void` |  |
| `getGlobals(): Record<string, string>` | `Record<string, string>` | Returns all global translation helper values. |
| `formatKeyForDisplay(keyCode: string): string` | `string` | Formats a key code for display in UI. |

**Aliases**

- `Locale` → `LooseString<"en">`

<details><summary>Types</summary>

**`I18nNumberFormatOptions`** — Number format options for {@link formatNumber}.

- `minimumFractionDigits?`: `number` — Minimum fraction digits.
- `maximumFractionDigits?`: `number` — Maximum fraction digits.
- `useGrouping?`: `boolean` — When true, use grouping separators.

</details>

## `api.input`

`sandkit.api.input` — key bindings, mouse position, and modifier keys. Main thread only.

| call | returns | notes |
|---|---|---|
| `registerBinding(bindingId: BindingId, defaultKeys: KeyCode[], definition: InputBindingDefinition): BindingId` | `BindingId` | Register a key binding and return its binding id. ```ts api.input.registerBinding("ExampleToggle", ["KeyO"], { displayName: "Toggle example", displayNameKey: "mods|example|toggle", subsection: { title: "Example controls", titleKey: "mods|example|controlsTitle", description: "Bindings installed by the example mod.", descriptionKey: "mods|example|controlsDescription", }, handlers: { down: toggleExample }, }); ``` |
| `getMouseCellPosition(): { x: number; y: number; }` | `{ x: number; y: number; }` | Return the mouse position in cell coordinates. |
| `getBoundKeys(bindingId: BindingId): KeyCode[]` | `KeyCode[]` | Return the keys currently bound to a binding id. Session `input.keys` is keyed by `KeyboardEvent.code`. Modifier aliases (`Shift`, `Alt`, `Control`, `Meta`) expand to `ShiftLeft` / `ShiftRight` and the same for the other modifiers. |
| `getDisplayKey(bindingId: BindingId, defaultLabel?: string): string` | `string` | Return a display label for the bound key. |
| `triggerBinding(bindingId: BindingId): void` | `void` | Fire the binding down handler as if the key was pressed. |
| `pressBinding(bindingId: BindingId): void` | `void` | Fire the binding down handler without a matching release. |
| `releaseBinding(bindingId: BindingId): void` | `void` | Fire the binding up handler. |
| `resetMouseState(): void` | `void` | Clear internal mouse button state. |
| `isCtrlHeld(): boolean` | `boolean` | Return true when Ctrl is held. |
| `isAltHeld(): boolean` | `boolean` | Return true when Alt is held. |

**Aliases**

- `KeyCode` → `LooseString< | "Shift" | "Alt" | "Control" | "Meta" | "ShiftLeft" | "ShiftRight" | "AltLeft" | "AltRight" | "ControlLeft" | "ControlRight" | "MetaLeft" | "MetaRight" >`

<details><summary>Types</summary>

**`BindingId`** — Binding id. Vanilla {@link KeyBindingEnum} names autocomplete; custom ids are allowed.


**`InputBindingHandlers`** — Handlers invoked when a binding is pressed or released.

- `down?`: `() => void` — Called when the binding is pressed.
- `up?`: `() => void` — Called when the binding is released.

**`InputBindingDefinition`** — Definition for a registered input binding.

- `displayName`: `string` — Display name shown in settings.
- `displayNameKey?`: `string` — i18n key for the display name (overrides displayName when set).
- `category`: `string` — Settings category for grouping.
- `handlers`: `InputBindingHandlers` — Press and release handlers.

</details>

## `api.items`

`sandkit.api.items` — register custom inventory items and query active items. Main thread only.

| call | returns | notes |
|---|---|---|
| `register(definition: ItemDefinition): void` | `void` | Registers a new item definition. |
| `updateDefinition(itemId: ItemId, partial: Partial<ItemDefinition>): void` | `void` | Updates fields on an existing item definition. ```ts api.items.updateDefinition("exampleTool", { name: "Updated Example Tool", }); ``` |
| `getDefinitionById(itemId: ItemId): ItemDefinition | undefined` | `ItemDefinition | undefined` | Returns the item definition for an id, or undefined. |
| `createFromId(itemId: ItemId): ModItem` | `ModItem` | Creates a runtime item instance from an id. |
| `getActive(): ItemDefinition | undefined` | `ItemDefinition | undefined` | Returns the item definition for the active hotbar slot. |
| `isActiveById(itemId: ItemId, itemType?: ItemType): boolean` | `boolean` | Returns true when the given item is the active hotbar item. |

**Aliases**

- `ItemId` → `ItemIdEnum | LooseString<never>`
- `ItemType` → `ItemTypeEnum | TaggedNumber<"itemType">`
- `ModItem` → `unknown`

<details><summary>Types</summary>

**`ItemDefinition`** — Definition for a mod-registered inventory item.

- `handleAction?`: `(state: State, action: Action) => unknown` — Handles item use actions.
- `afterRender?`: `(state: State) => void` — Called after the item is rendered each frame.

</details>

## `api.lights`

`sandkit.api.lights` — temporary lights and persistent world lights. Main thread only.

**Aliases**

- `vfx` → `temporary`
- `TemporaryLightOptions` → `shared.api.effects.TemporaryLightOptions`
- `PersistentLightHandle` → `unknown`

<details><summary>Types</summary>

**`TemporaryLightHandle`** — Handle returned from {@link temporary.createAtWorld}.

- `lightId`: `number | null` — Assigned temporary light id, or null when creation failed.
- `index`: `number | null`

**`PersistentLightOptions`** — Options for persistent world lights.

- `brightness?`: `number` — Light brightness multiplier.
- `size?`: `number` — Light radius in pixels.
- `color?`: `[number, number, number, number]` — RGBA color components.

</details>

## `api.lights.persistent`

Lights that persist in the world save.

| call | returns | notes |
|---|---|---|
| `createAtWorld(worldX: number, worldY: number, options?: PersistentLightOptions): PersistentLightHandle` | `PersistentLightHandle` | Create a persistent light at world coordinates. ```ts const light = api.lights.persistent.createAtWorld( worldX, worldY, { brightness: 1, size: 80 }, ); ``` |
| `removeAtWorld(worldX: number, worldY: number): void` | `void` | Remove the persistent light at world coordinates. |
| `fadeAtWorld(worldX: number, worldY: number, durationMs?: number): void` | `void` | Fade out the persistent light at world coordinates over durationMs. |
| `markDirty(): void` | `void` | Mark persistent lights dirty so they are saved on the next flush. |

## `api.lights.temporary`

Short-lived visual effect lights.

| call | returns | notes |
|---|---|---|
| `createAtWorld(worldX: number, worldY: number, options?: TemporaryLightOptions): TemporaryLightHandle` | `TemporaryLightHandle` | Create a temporary light at world coordinates. ```ts const light = api.lights.temporary.createAtWorld(worldX, worldY, { brightness: 1, durationMs: 250, size: 80, }); const lightId = light.lightId; ``` ```ts api.lights.temporary.createAtWorld(worldX, worldY, { durationTicks: 15, }); ``` ```ts api.lights.temporary.createAtWorld(worldX, worldY, { durationMs: 250, }); ``` |
| `removeById(lightId: number): void` | `void` | Remove a temporary light by its id. ```ts if (light.lightId !== null) { api.lights.temporary.removeById(light.lightId); } ``` |

## `api.maps`

| call | returns | notes |
|---|---|---|
| `getAvailable(): readonly Readonly<AvailableMapV1>[]` | `readonly Readonly<AvailableMapV1>[]` | Return maps the player can start. |
| `start(mapId: string): boolean` | `boolean` | Start a map by id. Return true when start succeeds. |
| `getArtifactLocations(): readonly ArtifactLocation[]` | `readonly ArtifactLocation[]` | Return artifact marker locations for the active map. ```ts api.events.on("game:ready", () => { api.maps.getArtifactLocations().forEach(({ cellX, cellY, name }) => { addMarker(cellX, cellY, name); }); }); ``` |

**Aliases**

- `getActive` → `shared.api.maps.getActive`
- `ActiveMapV1` → `shared.api.maps.ActiveMapV1`

<details><summary>Types</summary>

**`ArtifactLocation`** — Artifact location entry from {@link getArtifactLocations}.

- `cellX`: `number`
- `cellY`: `number`
- `name`: `string`

**`AvailableMapV1`** — Available map entry shape.

- `id`: `string` — Map identifier passed to {@link start}.
- `name?`: `string` — Display name or translation key.

</details>

## `api.mods`

Mod asset provider lookup. Available as `sandkit.api.mods`.

| call | returns | notes |
|---|---|---|
| `getProviders(kind: string): readonly AssetProviderV1[]` | `readonly AssetProviderV1[]` | Return asset providers registered for a kind string. |

**Aliases**

- `AssetProviderV1` → `assets.AssetProviderV1 }`

## `api.patterns`

| call | returns | notes |
|---|---|---|
| `createCircle(size: number): number[][]` | `number[][]` | Build a circular excavation pattern matrix for the given size. |
| `excavateAtCell(...args: [...CellCoordinates, pattern: number[][], outVelocity: Vector2, power: number, options?: PatternExcavateOptions]): void` | `void` | Excavate at a cell using a pattern matrix and output velocity. ```ts api.patterns.excavateAtCell( cellX, cellY, api.patterns.createCircle(5), { x: 0, y: -120 }, 2, ); ``` ```ts api.patterns.excavateAtCell( cellX, cellY, pattern, { x: 0, y: -1 }, 10, ); ``` |

**Aliases**

- `PatternExcavateOptions` → `shared.api.world.ExcavateOptions`

## `api.pickups`

World pickups — spawn, collect, and query pickup instances. Available as `sandkit.api.pickups`.

| call | returns | notes |
|---|---|---|
| `spawnAtWorld(type: PickupType, worldX: number, worldY: number, data?: Record<string, unknown>, light?: WorldItemLight): WorldItem` | `WorldItem` | Spawn a pickup at world position. |
| `remove(pickup: WorldItem): void` | `void` | Remove a pickup instance from the world. |
| `destroy(pickup: WorldItem): void` | `void` |  |
| `pickUp(pickup: WorldItem): boolean` | `boolean` | Pick up a world item into inventory. |
| `getAll(): WorldItem[]` | `WorldItem[]` | Return all active pickups. |
| `getById(pickupId: number): WorldItem | undefined` | `WorldItem | undefined` | Return a pickup by numeric id. |

**Aliases**

- `PickupType` → `PickupTypeEnum`
- `WorldItemType` → `PickupType`

<details><summary>Types</summary>

**`WorldItemLight`** — Optional point light attached when spawning a pickup.

- `brightness?`: `number` — Light brightness multiplier. Default 1.
- `size?`: `number` — Light radius in world pixels. Default 100.
- `color?`: `[number, number, number] | [number, number, number, number]` — RGB or RGBA color components in 0–1 range.

**`WorldItem`** — Active world pickup instance.

- `id`: `number`
- `x`: `number`
- `y`: `number`
- `type`: `PickupType`
- `data`: `Record<string, unknown>`

</details>

## `api.pipes`

Pipe network queries and enablement at grid cells. Available as `sandkit.api.pipes`.

| call | returns | notes |
|---|---|---|
| `isAtCell(...args: CellCoordinates): boolean` | `boolean` | Return true when a pipe occupies the cell. |
| `isEnabledAtCell(...args: CellCoordinates): boolean` | `boolean` | Return true when pipe flow is enabled at the cell. |
| `getConnectedVentsAtCell(...args: CellCoordinates): readonly PipeVentCell[]` | `readonly PipeVentCell[]` | Return connected liquid vent cell positions for the pipe at a cell. |
| `setEnabledAtCell(...args: [...CellCoordinates, enabled: boolean]): void` | `void` | Enable or disable pipe flow at a cell. |

<details><summary>Types</summary>

**`PipeVentCell`** — Connected vent cell position.

- `cellX`: `number`
- `cellY`: `number`

</details>

## `api.player`

| call | returns | notes |
|---|---|---|
| `setPositionAtWorld(worldX: number, worldY: number): void` | `void` | Set the player world position. |
| `setWorldPosition(worldX: number, worldY: number): void` | `void` |  |
| `setVelocity(velocityX: number, velocityY: number): void` | `void` | Set the player velocity. |
| `setMovementSpeedMultiplier(multiplier: number): void` | `void` | Set the movement speed multiplier. Vanilla Sprint Boost (Shift burst + meter) only runs when this value is exactly `1`. |
| `setMovementMode(mode: 'normal' | 'hover'): boolean` | `boolean` | Set movement mode to normal or hover. |
| `isOnGround(): boolean` | `boolean` | Return true when the player is on ground. Tests solid cells 1 pixel below the hitbox. Do not use `player.onGround` on the store snapshot — that flag is not updated during play. |
| `teleportToGround(): void` | `void` | Move the player down until ground is found. |
| `isPositionClearAtWorld(worldX: number, worldY: number): boolean` | `boolean` | Return true when the world position has no collision. |
| `isWorldPositionClear(worldX: number, worldY: number): boolean` | `boolean` |  |

**Aliases**

- `getPositionAtWorld` → `shared.api.player.getPositionAtWorld`
- `isCollidingWithCell` → `shared.api.player.isCollidingWithCell`
- `isWithinRadiusOfCell` → `shared.api.player.isWithinRadiusOfCell`
- `getWorldPosition` → `shared.api.player.getWorldPosition`

## `api.player.buildings`

Player building unlock helpers.

| call | returns | notes |
|---|---|---|
| `unlockById(structureId: string): void` | `void` | Unlock a structure type for building. |
| `unlockByType(structureId: string): void` | `void` |  |
| `removeById(structureId: string): void` | `void` | Remove a structure unlock from the player. |

## `api.player.inventory`

Player inventory helpers.

| call | returns | notes |
|---|---|---|
| `addById(itemId: string): void` | `void` | Add an item to inventory by item id. |
| `addFromId(itemId: string): void` | `void` |  |

## `api.processing`

| call | returns | notes |
|---|---|---|
| `registerGrower(definition: PlanterBoxRecipeDefinitionV1): void` | `void` | Register a planter box grower recipe. |
| `registerShaker(definition: ShakerRecipeDefinitionV1): void` | `void` | Register a shaker recipe. |
| `registerKineticPress(definition: KineticPressRecipeDefinitionV1): void` | `void` | Register a kinetic press recipe. |

<details><summary>Types</summary>

**`WeightedRecipeOutput`** — Weighted element output entry shared by machine recipes.

- `elementType`: `elements.ElementType` — Output element type (1–255).
- `chance`: `number` — Output probability from 0 to 1.

**`PlanterBoxRecipeDefinitionV1`** — Planter box grower recipe definition.

- `input`: `elements.ElementType` — Input element type placed on the grower.
- `output`: `elements.ElementType` — Output element type produced by the grower.
- `chance?`: `number` — Success chance from 0 to 1. Default 1.

**`ShakerRecipeDefinitionV1`** — Shaker recipe definition.

- `input`: `elements.ElementType` — Input element type dropped on the shaker.
- `outputsAbove`: `WeightedRecipeOutput[]` — Weighted outputs ejected upward.
- `outputsBelow`: `WeightedRecipeOutput[]` — Weighted outputs ejected downward.

**`KineticPressRecipeDefinitionV1`** — Kinetic press recipe definition.

- `input`: `elements.ElementType` — Input element type processed by the press.
- `minimumDownwardVelocity`: `number` — Minimum downward velocity required to trigger the press.
- `outputs`: `WeightedRecipeOutput[]` — Weighted outputs produced by the press.

</details>

## `api.progression`

| call | returns | notes |
|---|---|---|
| `complete(request: ProgressionCompletionRequestV1): boolean` | `boolean` | Mark a progression step complete. Return true when completion succeeds. ```ts const completed = api.progression.complete({ domain: "objective", id: "all", }); ``` |

<details><summary>Types</summary>

**`ProgressionCompletionRequestV1`** — Progression completion request shape.

- `id`: `string` — Progression step or quest identifier.

</details>

## `api.projectiles`

Projectile definitions, spawning, and lifecycle. Available as `sandkit.api.projectiles`.

| call | returns | notes |
|---|---|---|
| `register(definition: ProjectileDefinition): void` | `void` | Register a projectile definition. |
| `getDefinitionById(projectileId: string): ProjectileDefinition | undefined` | `ProjectileDefinition | undefined` | Return a projectile definition by string id. |
| `createBlueprintFromId(projectileId: string): ProjectileBlueprint` | `ProjectileBlueprint` | Build a spawn blueprint from a projectile string id. |
| `getAll(): Projectile[]` | `Projectile[]` | Return all active projectiles. |
| `getById(projectileId: number): Projectile | undefined` | `Projectile | undefined` | Return a projectile by numeric id. |
| `remove(projectile: Projectile): void` | `void` | Remove a projectile from the world. |
| `spawnAtWorld(worldX: number, worldY: number, angle: number, blueprint: ProjectileBlueprint): Projectile` | `Projectile` | Spawn a projectile at world position with angle and blueprint. |

<details><summary>Types</summary>

**`ProjectileDefinition`** — Mod-registered projectile definition.

- `id`: `string`
- `sprite`: `{`
- `getOptions`: `() => Record<string, unknown>` — Returns spawn-time physics and visual options.
- `getModData?`: `(state: unknown, projectile: Projectile) => Record<string, unknown>` — Optional per-projectile mutable data factory.

**`ProjectileBlueprint`** — Blueprint used to spawn a projectile.

- `opts`: `Record<string, unknown>`
- `type`: `unknown`

**`Projectile`** — Active projectile instance.

- `id`: `number`
- `x`: `number`
- `y`: `number`

</details>

## `api.random`

Deterministic game random number helpers. Available as `sandkit.api.random`.

| call | returns | notes |
|---|---|---|
| `int(min: number, max: number): number` | `number` | Return a random integer in the inclusive range. |
| `float(min: number, max: number): number` | `number` | Return a random float in the inclusive range. |

## `api.raycast`

| call | returns | notes |
|---|---|---|
| `castFromWorld(startWorldX: number, startWorldY: number, angle: number, maxDistance: number): Vector2 & { distance: number; } | null` | `Vector2 & { distance: number; } | null` | Cast a ray from world position. Return hit point and distance, or null. |

## `api.reactions`

| call | returns | notes |
|---|---|---|
| `registerContact(definition: ContactRecipeDefinitionV1): void` | `void` | Register a contact reaction between elements. ```ts api.reactions.registerContact({ inputA: "water", inputB: "examplePowder", outputA: "steam", outputB: null, orientation: "any", }); ``` |

<details><summary>Types</summary>

**`ContactRecipeDefinitionV1`** — Contact reaction recipe definition.

- `inputA`: `elements.ElementType` — First reacting element type.
- `inputB`: `elements.ElementType` — Second reacting element type.
- `outputA`: `elements.ElementType | null` — Element type produced from input A, or null for no output.
- `outputB`: `elements.ElementType | null` — Element type produced from input B, or null for no output.
- `orientation?`: `"any" | "stacked"` — Contact layout requirement. Default `"any"`.

</details>

## `api.rendering`

| call | returns | notes |
|---|---|---|
| `getDrawPositionAtCell(...args: CellCoordinates): Vector2` | `Vector2` | Return screen draw position for a grid cell. |
| `getDrawPositionAtWorld(worldX: number, worldY: number): Vector2` | `Vector2` | Return screen draw position for a world-space point. ```ts api.events.on("frame:render", () => { const drawPos = api.rendering.getDrawPositionAtWorld(worldX, worldY); drawMarker(drawPos.x, drawPos.y); }); ``` |
| `getGridMetrics(): { cellSize: number; snapGridCellSize: number; }` | `{ cellSize: number; snapGridCellSize: number; }` | Return cell size and snap grid metrics. ```ts const { cellSize, snapGridCellSize } = api.rendering.getGridMetrics(); ``` |
| `getOverlayViewportSize(): { width: number; height: number; }` | `{ width: number; height: number; }` | Return overlay viewport width and height in pixels. |
| `withOverlayContext(callback: (context: CanvasRenderingContext2D) => T): T` | `T` | Run a callback with the overlay canvas context. ```ts api.rendering.withOverlayContext((context) => { context.fillRect(0, 0, 16, 16); }); ``` |

## `api.resources`

| call | returns | notes |
|---|---|---|
| `collectFluxiteAtCell(...args: CellCoordinates): void` | `void` | Collect fluxite at the given cell. |
| `updateEnergy(amount: number, options?: { deferUi?: boolean; }): void` | `void` | Update stored energy by amount with optional UI deferral. ```ts api.resources.adjustEnergy(100, { deferUi: true }); ``` |

## `api.scene`

| call | returns | notes |
|---|---|---|
| `getActive(): SceneEnum` | `SceneEnum` | Return the active scene. |

**Aliases**

- `Scene` → `SceneEnum`

## `api.schedule`

Deferred callback scheduling on the next tick. Available as `sandkit.api.schedule`.

| call | returns | notes |
|---|---|---|
| `nextTick(callback: () => void): void` | `void` | Run a callback on the next game tick. ```ts api.schedule.nextTick(() => { runDeferredWork(); }); ``` |

## `api.settings`

Game settings read and change notifications. Available as `sandkit.api.settings`.

| call | returns | notes |
|---|---|---|
| `get(fieldId: FieldId): ConfigValueV1 | undefined` | `ConfigValueV1 | undefined` | Return a settings field value by id. |
| `getAll(): Readonly<Record<string, ConfigValueV1>>` | `Readonly<Record<string, ConfigValueV1>>` | Return all settings as a read-only map. |
| `onChange(callback: (values: Readonly<Record<string, ConfigValueV1>>) => void): () => void` | `() => void` | Subscribe to settings changes. Return an unsubscribe function. ```ts const unsubscribe = api.settings.onChange((values) => { applySettings(values); }); ``` |

**Aliases**

- `FieldId` → `LooseString<never>`
- `ConfigValueV1` → `string | number | boolean | null`

## `api.shared`

**Aliases**

- `SharedArray` → `sharedApi.api.shared.SharedArray`
- `SharedArrayType` → `sharedApi.api.shared.SharedArrayType`

## `api.shared.buffers`

Shared buffer ensure and lookup.

| call | returns | notes |
|---|---|---|
| `ensure(key: string, config: { type: SharedArrayType; length: number; }): SharedArray` | `SharedArray` | Create or return a named shared buffer with type and length. ```ts const counts = api.shared.buffers.ensure("counts", { type: "uint32", length: 4, }); ``` |
| `create(key: string, config: { type: SharedArrayType; length: number; }): SharedArray` | `SharedArray` |  |

**Aliases**

- `get` → `sharedApi.api.shared.buffers.get`

## `api.signals`

Signal target registration for structures. Available as `sandkit.api.signals`. ```ts api.signals.interactables.register("exampleLever", (structure) => { structure.data.on = !structure.data.on; api.structures.update(structure); }); ``` ```ts api.signals.registerSenderType("exampleSensor", (structure) => { return structure.data.charge >= structure.data.threshold; }); ``` ```ts api.structures.forEachOfType("exampleSensor", (structure) => { api.signals.setOutputAtCell(structure.x, structure.y, structure.data.active); }); ```

**Aliases**

- `StructureType` → `unknown /** Structure instance in the world. */ export type Structure = unknown /** Payload delivered to a signal target handler. */ export type SignalTargetPayloadV1 = unknown }`

## `api.signals.targets`

Signal target registration for structure types.

| call | returns | notes |
|---|---|---|
| `register(structureTypeOrId: string | StructureType, apply: (structure: Structure, payload: SignalTargetPayloadV1) => void): void` | `void` | Register a handler when a signal targets a structure type. ```ts api.signals.targets.register("exampleMachine", (structure, payload) => { api.structures.processing.setEnabledAtCell(structure.x, structure.y, payload.combined); }); ``` |

## `api.sound`

Sound playback, layers, and stop controls. Available as `sandkit.api.sound`.

| call | returns | notes |
|---|---|---|
| `play(soundId: string, options?: SoundOptions): SoundHandle` | `SoundHandle` | Play a sound by id with optional options. |
| `playActive(soundId: string, options?: SoundOptions): SoundHandle` | `SoundHandle` | Play a sound on the active sound channel. |
| `playLayers(layers: SoundLayer[], options?: SoundLayersOptions): SoundHandle[]` | `SoundHandle[]` | Play multiple sound layers with shared options. |
| `calculateDistanceOptionsAtWorld(worldX: number, worldY: number, baseVolume?: number): SoundOptions` | `SoundOptions` | Build distance-based volume options for a world position. |
| `stopBySoundId(soundId: string): void` | `void` | Stop a sound by id. |
| `stopById(soundId: string): void` | `void` |  |
| `stopActive(): void` | `void` | Stop the active sound channel. |
| `stopAll(): void` | `void` | Stop all playing sounds. |

<details><summary>Types</summary>

**`SoundHandle`** — Handle returned from a play call.


**`SoundLayer`** — One layer in a layered sound.

- `soundId`: `string` — Sound id for this layer.
- `volume?`: `number` — Layer volume multiplier.
- `delay?`: `number` — Delay in milliseconds before this layer plays.
- `playbackRate?`: `number` — Playback rate for this layer.

**`SoundOptions`** — Options passed to sound play helpers.

- `volume?`: `number` — Volume multiplier (0–1 typical).
- `playbackRate?`: `number` — Playback rate multiplier.
- `position?`: `{ x: number; y: number }` — World position for distance attenuation.
- `loop?`: `boolean` — When true, loop until stopped.
- `rateLimitKey?`: `string` — Key used with rateLimitMs to dedupe rapid replays.
- `rateLimitMs?`: `number` — Minimum ms between plays with the same rateLimitKey.

**`SoundLayersOptions`** — Shared options for {@link playLayers}.

- `position?`: `{ x: number; y: number }` — World position applied to all layers.
- `volume?`: `number` — Volume multiplier applied to all layers.
- `rateLimitKey?`: `string` — Key used with rateLimitMs to dedupe rapid replays.
- `rateLimitMs?`: `number` — Minimum ms between plays with the same rateLimitKey.

</details>

## `api.sprites`

Sprite load, lookup, and player mod sprite transforms. Available as `sandkit.api.sprites`.

| call | returns | notes |
|---|---|---|
| `load(spriteId: string, path: string, options?: SpriteLoadOptions): Promise<void>` | `Promise<void>` | Load a sprite from a URL path. |
| `loadFromMod(spriteId: string, relativePath: string, options?: SpriteLoadOptions): Promise<void>` | `Promise<void>` | Load a sprite from the calling mod folder. |
| `getById(spriteId: string): LoadedSprite | undefined` | `LoadedSprite | undefined` | Return a loaded sprite by id. |
| `hideAllPlayerModSprites(): void` | `void` | Hide all player mod-attached sprites. |
| `rotatePlayerModSprites(angle: number): void` | `void` | Rotate all player mod-attached sprites by angle. |

<details><summary>Types</summary>

**`LoadedSprite`** — Loaded sprite handle (runtime texture or display object).


</details>

## `api.storage`

Per-mod persistent storage and local session storage. Available as `sandkit.api.storage`.

| call | returns | notes |
|---|---|---|
| `ensure(modId: string): JsonObjectV1` | `JsonObjectV1` | Ensure storage exists for a mod id. |
| `get(modId: string, key: string): JsonValueV1 | undefined` | `JsonValueV1 | undefined` | Read a value from mod storage by key. |
| `set(modId: string, key: string, value: JsonValueV1): void` | `void` | Write a value to mod storage by key. |
| `remove(modId: string, key: string): void` | `void` | Remove a key from mod storage. |

## `api.storage.local`

Local session storage without mod id scope.

| call | returns | notes |
|---|---|---|
| `get(key: string): JsonValueV1 | undefined` | `JsonValueV1 | undefined` | Read a local storage value by key. |
| `set(key: string, value: JsonValueV1): void` | `void` | Write a local storage value by key. |
| `remove(key: string): void` | `void` | Remove a local storage key. |

## `api.structureBehaviors`

| call | returns | notes |
|---|---|---|
| `registerConveyorType(structureId: string, options?: { transportOffset?: Vector2; velocity?: Vector2; maxTransportDistance?: number; transportHeight?: number; runWith?: 'left' | 'right'; skipQueued?: boolean; }): void` | `void` | Register conveyor behavior for a structure type. ```ts api.structureBehaviors.registerConveyorType( "exampleConveyor", { runWith: "right" }, ); ``` |
| `registerLauncherType(definition: { upType: string; leftType: string; rightType: string; velocity: [number, number]; softDropVelocity: number; runTickSharedBufferKey?: string; }): void` | `void` | Register launcher behavior for up, left, and right launcher types. |

## `api.structures`

| call | returns | notes |
|---|---|---|
| `register(definition: SandkitStructureDefinition, options?: { useRawShape?: boolean; }): void` | `void` | Register a new structure definition. ```ts api.structures.register({ id: "exampleJunction", name: "Example Junction", nameKey: "structures|exampleJunction|name", description: "Links two fixed-span endpoints.", descriptionKey: "structures|exampleJunction|description", categoryKey: "logistics", buildModes: [{ type: "line", directions: ["horizontal", "vertical"], spanTiles: 4, }], linkedClearance: "allOrNothing", tooltipHover, variants: [{ id: "exampleJunction", angles: [-180, -90, 0, 90, 180], }], render: { imageName: "exampleJunction", size: { width: 16, height: 16 }, }, }); ``` |
| `updateDefinition(structureTypeOrId: StructureRef, partial: Partial<SandkitStructureDefinition>, options?: { useRawShape?: boolean; }): void` | `void` | Patch fields on an existing structure definition. ```ts api.structures.updateDefinition("exampleJunction", { buildModes: [{ type: "line", directions: ["horizontal", "vertical"], spanTiles: 6, }], }); ``` |
| `registerVariant(baseStructureTypeOrId: StructureRef, variant: { id: StructureRef; angles: number[]; }, options?: { addBuildMode?: unknown; }): void` | `void` | Add a rotated variant to a base structure type. ```ts api.structures.registerVariant( "exampleStructure", { id: "exampleStructureVertical", angles: [-90, 90], }, { addBuildMode: { type: "line", directions: ["vertical"], spanTiles: 4, }, }, ); ``` |
| `addVariant(baseStructureTypeOrId: StructureRef, variant: { id: StructureRef; angles: number[]; }, options?: { addBuildMode?: unknown; }): void` | `void` |  |
| `registerPlacementConfig(definition: PlacementConfigDefinition): void` | `void` | Register placement rules for a structure. ```ts api.structures.registerPlacementConfig({ structureId: "exampleStructure", fields: [ { type: "integer", id: "channel", label: "Channel", default: 1, min: 1, max: 8, }, { type: "choice", id: "mode", labelKey: "structures|exampleStructure|mode", default: "input", options: [ { value: "input", label: "Input" }, { value: "output", labelKey: "structures|exampleStructure|output" }, ], }, ], }); ``` |
| `getAvailableTypes(): Set<StructureRef>` | `Set<StructureRef>` | Return structure types available for building. |
| `getUnlockedTypes(): Set<StructureRef>` | `Set<StructureRef>` |  |
| `isBlockedByPlayerAtCell(...args: CellCoordinates): boolean` | `boolean` | Return true when the player blocks building at the cell. |
| `isLauncherAtCell(...args: CellCoordinates): boolean` | `boolean` | Return true when a launcher structure is at the cell. |
| `isLockedByType(structureType: StructureRef): boolean` | `boolean` | Return structure lock state for a type. Official docs list {@link isUnlockedByType} as a deprecated alias of this function (same implementation and return value; names differ only). |
| `isUnlockedByType(structureType: StructureRef): boolean` | `boolean` |  |
| `mapValueToSpritesheetIndex(value: number, thresholds: number[]): number` | `number` | Map a numeric value through thresholds to a spritesheet index. ```ts const index = api.structures.mapValueToSpritesheetIndex( pressure, [0, 25, 50, 75], ); ``` |
| `buildAtCell(...args: [...CellCoordinates, structureTypeOrId: StructureRef, options?: StructureBuildOptions]): void` | `void` | Build a structure at a cell. Main-thread writes are deferred. |
| `buildAtCellWhenIdle(...args: [...CellCoordinates, structureTypeOrId: StructureRef, options?: StructureBuildOptions]): void` | `void` |  |
| `removeAtCell(...args: [...CellCoordinates, options?: StructureRemovalOptions]): void` | `void` | Remove a structure at a cell. Main-thread writes are deferred. |
| `removeAtCellWhenIdle(...args: [...CellCoordinates, options?: StructureRemovalOptions]): void` | `void` |  |
| `removeBetweenCells(startCellX: number, startCellY: number, endCellX: number, endCellY: number, options?: StructureBulkRemovalOptions): void` | `void` | Remove structures between two cells. Main-thread writes are deferred. |
| `removeBetweenCellsWhenIdle(startCellX: number, startCellY: number, endCellX: number, endCellY: number, options?: StructureBulkRemovalOptions): void` | `void` |  |
| `removeAtCells(positions: Vector2[], options?: StructureBulkRemovalOptions): void` | `void` | Remove structures at many cells. Main-thread writes are deferred. ```ts api.structures.removeAtCells([ { x: firstCellX, y: firstCellY }, { x: secondCellX, y: secondCellY }, ]); ``` |
| `removeAtCellsWhenIdle(positions: Vector2[], options?: StructureBulkRemovalOptions): void` | `void` |  |
| `addProcessor(structureId: StructureRef, definition: StructureProcessorDefinitionV1): void` | `void` |  |

**Aliases**

- `forEachOfType` → `shared.api.structures.forEachOfType`
- `getAtCell` → `shared.api.structures.getAtCell`
- `getDefinitionByType` → `shared.api.structures.getDefinitionByType`
- `getTypeById` → `shared.api.structures.getTypeById`
- `hasBuiltAtCell` → `shared.api.structures.hasBuiltAtCell`
- `isType` → `shared.api.structures.isType`
- `isTypeAtCell` → `shared.api.structures.isTypeAtCell`
- `setSpritesheetIndex` → `shared.api.structures.setSpritesheetIndex`
- `setSpritesheetIndexAtCell` → `shared.api.structures.setSpritesheetIndexAtCell`
- `setSpritesheetIndexByValue` → `shared.api.structures.setSpritesheetIndexByValue`
- `setSpritesheetIndexByValueAtCell` → `shared.api.structures.setSpritesheetIndexByValueAtCell`
- `update` → `shared.api.structures.update`
- `updateData` → `shared.api.structures.updateData`
- `Structure` → `shared.api.structures.Structure`
- `StructureType` → `shared.api.structures.StructureType`
- `StructureId` → `shared.api.structures.StructureId`
- `StructureRef` → `shared.api.structures.StructureRef`
- `getTypeFromId` → `shared.api.structures.getTypeFromId`
- `setData` → `shared.api.structures.setData`
- `PlacementConfigField` → `| PlacementConfigIntegerField | PlacementConfigChoiceField`
- `PlanterBoxRecipeDefinitionV1` → `processingApi.PlanterBoxRecipeDefinitionV1`
- `ShakerRecipeDefinitionV1` → `processingApi.ShakerRecipeDefinitionV1`
- `KineticPressRecipeDefinitionV1` → `processingApi.KineticPressRecipeDefinitionV1`

<details><summary>Types</summary>

**`StructureBuildMode`** — Build mode entry for a structure definition.

- `type`: `string`
- `directions?`: `string[]`
- `spanTiles?`: `number` — Fixed span length in tiles for line-linked structures.

**`StructureVariant`** — Rotated variant entry for a structure definition.

- `id`: `StructureRef`
- `angles`: `number[]`

**`StructureTooltipHover`** — Custom hover tooltip driven by structure `data` fields. ```ts tooltipHover: { type: "custom", dataFieldMessage: { message: "Mode {mode}; channel {channel}.", messageKey: "mods|example|machineTooltip", fields: [ { param: "mode", field: "mode", valueLabels: { input: "Receiving", output: "Sending" }, valueKeys: { input: "mods|example|receiving", output: "mods|example|sending", }, }, { param: "channel", field: "channel", fallback: 1, round: true }, ], }, } ```

- `type`: `"custom"`
- `dataFieldMessage`: `{`

**`StructureTooltipHoverField`** — One interpolated field in a {@link StructureTooltipHover} message.

- `param`: `string`
- `field`: `string`
- `fallback?`: `string | number`
- `round?`: `boolean`
- `valueLabels?`: `Record<string, string>`
- `valueKeys?`: `Record<string, string>`

**`StructureSpritesheet`** — Spritesheet animation on a structure render block.

- `frameSize`: `{ width: number; height: number }`
- `frames`: `number`
- `intervalMs`: `number`
- `rowDataField?`: `string` — When set, frame row follows this structure `data` field.

**`StructureRenderUi`** — Hotbar / build-menu UI sprite settings.

- `imageName?`: `string`
- `size?`: `{ width: number; height: number }`
- `offset?`: `{ x: number; y: number }`
- `outline?`: `boolean`
- `width?`: `string`
- `height?`: `string`
- `clipToBounds?`: `boolean`

**`StructureRender`** — Render settings for a structure definition.

- `imageName?`: `string`
- `size?`: `{ width: number; height: number }`
- `offset?`: `{ x: number; y: number }`
- `z?`: `number`
- `ambienceGroup?`: `string`
- `ui?`: `StructureRenderUi`
- `spritesheet?`: `StructureSpritesheet`

**`SandkitStructureDefinition`** — Full structure definition registered with the game.

- `id`: `StructureId`
- `name?`: `string`
- `nameKey?`: `string`
- `description?`: `string`
- `descriptionKey?`: `string`
- `categoryKey?`: `string`
- `order?`: `number`
- `buildModes?`: `StructureBuildMode[]`
- `shape?`: `number[][]`
- `variants?`: `StructureVariant[]`
- `render?`: `StructureRender`
- `defaultData?`: `Record<string, unknown>`
- `linkedClearance?`: `string` — Linked placement clearance mode (for example `"allOrNothing"`).
- `tooltipHover?`: `StructureTooltipHover` — Custom hover tooltip over the built structure.
- `rejectWhenBlocked?`: `boolean` — Reject placement when the footprint is blocked.
- `alwaysUnlocked?`: `boolean` — Show in the build menu without research unlock.
- `descriptionParams?`: `Record<string, string | number>` — Values interpolated into the structure description string.

**`StructureBuildOptions`** — Options passed to {@link buildAtCell}.


**`StructureRemovalOptions`** — Options passed to {@link removeAtCell}.

- `removeCells?`: `boolean` — Also remove underlying terrain cells in the footprint.
- `skipVisuals?`: `boolean` — Skip visual teardown effects.

**`StructureBulkRemovalOptions`** — Options passed to bulk structure removal helpers.

- `removeCells?`: `boolean`
- `skipVisuals?`: `boolean`
- `preserveUnselectable?`: `boolean` — When set, only remove structures at these positions.
- `onlyPositions?`: `Vector2[]`

**`StructureProcessingContext`** — Context passed to structure processing callbacks.


**`StructureProcessorDefinitionV1`**

- `intervalMs`: `number` — Tick interval in milliseconds. Must be > 0.
- `process`: `(structure: Structure, context: StructureProcessingContext) => void` — Synchronous callback invoked for each structure instance.

**`PlacementConfigIntegerField`** — Integer placement field with optional bounds.

- `type`: `"integer"`
- `id`: `string`
- `labelKey`: `string`
- `min?`: `number`
- `max?`: `number`
- `default?`: `number`

**`PlacementConfigChoiceField`** — Choice placement field with labeled options.

- `type`: `"choice"`
- `id`: `string`
- `labelKey`: `string`
- `options`: `readonly {`

**`PlacementConfigDefinition`** — Placement rule definition for a structure type.

- `structureId`: `StructureId`
- `fields`: `PlacementConfigField[]`

**`WeightedRefineryRecipeDefinitionV1`** — Weighted refinery recipe definition shape.

- `input`: `processingApi.WeightedRecipeOutput["elementType"]`
- `outputs`: `processingApi.WeightedRecipeOutput[]`

**`StructureProcessingDefinitionV1`** — Custom structure processing definition shape.

- `structureType`: `StructureRef`
- `intervalMs`: `number`
- `process`: `(structure: Structure, context: StructureProcessingContext) => void`

</details>

## `api.structures.processing`

Per-structure processing enablement and registration.

| call | returns | notes |
|---|---|---|
| `register(id: StructureId, definition: StructureProcessingDefinitionV1): void` | `void` | Register a custom processing definition by id. ```ts api.structures.processing.register( "exampleStructure:process", { structureType: "exampleStructure", intervalMs: 250, process: (structure, context) => { const empty = context.isCellEmptyAtCell( structure.x, structure.y, ); }, }, ); ``` |
| `setEnabledAtCell(...args: [...CellCoordinates, enabled: boolean]): boolean` | `boolean` | Enable or disable processing at a cell. |
| `setEnabledAt(...args: [...CellCoordinates, enabled: boolean]): boolean` | `boolean` |  |

**Aliases**

- `isEnabledAtCell` → `shared.api.structures.processing.isEnabledAtCell`
- `isEnabledAt` → `shared.api.structures.processing.isEnabledAt`

## `api.structures.recipes`

Structure recipe registration by machine kind.

| call | returns | notes |
|---|---|---|
| `register(id: 'planterBox', definition: PlanterBoxRecipeDefinitionV1): void` | `void` | Register a planter box recipe. ```ts api.structures.recipes.register("kineticPress", { input: "sand", outputs: [ { elementType: "compressedSand", chance: 1 }, ], minimumDownwardVelocityCellsPerSecond: 20, }); ``` |
| `register(id: 'shaker', definition: ShakerRecipeDefinitionV1): void` | `void` | Register a shaker recipe. |
| `register(id: 'kineticPress', definition: KineticPressRecipeDefinitionV1): void` | `void` | Register a kinetic press recipe. |
| `register(id: 'condenser' | 'steamDryer' | 'synthesizer' | 'snowmaker' | 'smelter', definition: WeightedRefineryRecipeDefinitionV1): void` | `void` | Register a weighted refinery machine recipe. |

## `api.tech`

Tech tree definitions, nodes, and lock state. Available as `sandkit.api.tech`.

| call | returns | notes |
|---|---|---|
| `getDefinitionById(techId: TechGridId): TechDefinition | undefined` | `TechDefinition | undefined` | Return a tech definition by string id. |
| `updateDefinition(techId: TechGridId, updates: Partial<TechDefinition>): void` | `void` | Patch fields on an existing tech definition. ```ts api.tech.updateDefinition("exampleTech", { cost: 200, }); ``` |
| `registerDefinition(techId: TechGridId, definition: TechDefinition): void` | `void` | Register a new tech definition by id. ```ts api.tech.registerDefinition("exampleTech", { name: "Example research", nameKey: "mods|example|techName", description: "Unlocks the example machine.", descriptionKey: "mods|example|techDescription", cost: 100, }); ``` |
| `addDefinition(techId: TechGridId, definition: TechDefinition): void` | `void` |  |
| `registerNode(techId: TechGridId, definition: TechDefinition, options: { parentId: TechGridId; preferredPosition?: TechGridPosition; }): TechGridPosition` | `TechGridPosition` | Register a tech node on the grid with parent and position options. ```ts const position = api.tech.registerNode( "exampleTech", techDefinition, { parentId: parentTechId }, ); ``` |
| `isLockedById(techId: TechGridId): boolean` | `boolean` | Return true when a tech entry is locked. |
| `setLockedById(techId: TechGridId, locked: boolean): void` | `void` | Set locked state for a tech entry by id. |
| `isResearchedById(techId: TechGridId): boolean` | `boolean` | Return true when a tech entry has been researched. |

**Aliases**

- `TechGridId` → `TechEnum | LooseString<never> | TaggedNumber<"tech">`

<details><summary>Types</summary>

**`TechDefinition`** — Tech definition shape.

- `name?`: `string` — Plain display name (when not using {@link nameKey}).
- `nameKey?`: `string` — Display name translation key.
- `description?`: `string` — Plain description (when not using {@link descriptionKey}).
- `descriptionKey?`: `string` — Description translation key.
- `cost?`: `number` — Research cost.
- `currencyType?`: `string` — Currency used for {@link cost} (for example `"gold"`).
- `branch?`: `string` — Tech tree branch id (often copied from the parent node).
- `unlocks?`: `{` — Content unlocked when this tech is researched.
- `requires?`: `readonly string[]` — Prerequisite tech ids.

**`TechGridPosition`** — Position on the tech grid.

- `x`: `number`
- `y`: `number`

**`ConservatoryUnlocks`** — Unlock payload for {@link conservatory.appendUnlock}.

- `structures?`: `readonly string[]` — Structure ids to unlock.
- `items?`: `readonly string[]` — Item ids to unlock.

</details>

## `api.tech.conservatory`

Conservatory unlock wiring for built-in tech nodes.

| call | returns | notes |
|---|---|---|
| `appendUnlock(techId: TechGridId, unlocks: ConservatoryUnlocks): void` | `void` | Append structure or item unlocks to a conservatory tech node. ```ts api.tech.conservatory.appendUnlock(sandkit.enums.Tech.SignalDevices, { structures: ["exampleSensor"], }); ``` |

## `api.terrains`

| call | returns | notes |
|---|---|---|
| `register(definition: TerrainDefinition): { cellType: TerrainType; }` | `{ cellType: TerrainType; }` | Register a new terrain definition. |
| `updateDefinition(cellTypeOrId: TerrainRef, partial: Partial<TerrainDefinition>): void` | `void` | Patch fields on an existing terrain definition. |
| `createAtCell(...args: [...CellCoordinates, terrainTypeOrId: TerrainRef, options?: TerrainMutationOptions]): void` | `void` | Create terrain at a cell. Main-entry writes are deferred; reads see the old grid. |
| `createAtCellWhenIdle(...args: [...CellCoordinates, terrainTypeOrId: TerrainRef, options?: TerrainMutationOptions]): void` | `void` |  |
| `replaceAtCell(...args: [...CellCoordinates, terrainTypeOrId: TerrainRef, options?: TerrainMutationOptions]): void` | `void` | Replace terrain at a cell. Main-entry writes are deferred; reads see the old grid. |
| `replaceAtCellWhenIdle(...args: [...CellCoordinates, terrainTypeOrId: TerrainRef, options?: TerrainMutationOptions]): void` | `void` |  |
| `removeAtCell(...args: [...CellCoordinates, options?: TerrainMutationOptions]): void` | `void` | Remove terrain at a cell. Main-entry writes are deferred; reads see the old grid. |
| `removeAtCellWhenIdle(...args: [...CellCoordinates, options?: TerrainMutationOptions]): void` | `void` |  |
| `setHitPointsAtCell(...args: [...CellCoordinates, hitPoints: number]): void` | `void` | Set terrain hit points at a cell. Main-entry writes are deferred; reads see the old grid. |
| `setHpAtCell(...args: [...CellCoordinates, hitPoints: number]): boolean` | `boolean` |  |
| `setHpAtCellWhenIdle(...args: [...CellCoordinates, hitPoints: number]): void` | `void` |  |

**Aliases**

- `getIdByType` → `shared.api.terrains.getIdByType`
- `getTypeById` → `shared.api.terrains.getTypeById`
- `getTypeFromId` → `shared.api.terrains.getTypeFromId`
- `getDefinitionByType` → `shared.api.terrains.getDefinitionByType`
- `getTypeAtCell` → `shared.api.terrains.getTypeAtCell`
- `getDataAtCell` → `shared.api.terrains.getDataAtCell`
- `isAtCell` → `shared.api.terrains.isAtCell`
- `isTypeAtCell` → `shared.api.terrains.isTypeAtCell`
- `isCellIdTerrain` → `shared.api.terrains.isCellIdTerrain`
- `damageAtCell` → `shared.api.terrains.damageAtCell`
- `TerrainMutationOptions` → `shared.api.terrains.TerrainMutationOptions`
- `TerrainType` → `shared.api.terrains.TerrainType`
- `TerrainId` → `shared.api.terrains.TerrainId`
- `TerrainRef` → `shared.api.terrains.TerrainRef`
- `TerrainDataAtCell` → `shared.api.terrains.TerrainDataAtCell`

<details><summary>Types</summary>

**`TerrainDefinition`** — Terrain definition shape with typed element interactions.

- `interactions?`: `readonly elements.Interaction[]` — Tooltip interactions shown for this terrain.

</details>

## `api.time`

Game time in milliseconds and tick counter. Available as `sandkit.api.time`.

| call | returns | notes |
|---|---|---|
| `getTimeMs(): number` | `number` | Return elapsed game time in milliseconds. |
| `getTick(): number` | `number` | Return the current simulation tick number. |

## `api.tools`

Tool-specific API helpers. Available as `sandkit.api.tools`.

## `api.tools.grabber`

Grabber tool size and state.

| call | returns | notes |
|---|---|---|
| `setSize(size: number): void` | `void` | Set grabber radius size. |
| `getSize(): number` | `number` | Return current grabber radius size. |
| `isActive(): boolean` | `boolean` | Return true when grabber tool is active. |
| `isLoaded(): boolean` | `boolean` | Return true when grabber holds elements. |

## `api.triggers`

Interval-based main-thread trigger registration. Available as `sandkit.api.triggers`.

| call | returns | notes |
|---|---|---|
| `register(triggerId: string, definition: MainTriggerDefinition): void` | `void` | Register a repeating trigger with interval and callback. ```ts api.triggers.register("example:update", { intervalMs: 250, callback: (trigger, deltaTimeMs) => { updateExample(trigger, deltaTimeMs); }, }); ``` |

<details><summary>Types</summary>

**`MainTriggerDefinition`** — Main-thread trigger definition shape.

- `interval`: `number` — Interval between callbacks in simulation ticks.
- `callback`: `() => void` — Called each time the trigger fires.

</details>

## `api.ui`

```ts const slot = sandkit.react.createElement( api.ui.components.ActionSlot, { source, slotIndex: 0, keyLabel: "1" }, ); ``` ```ts const button = sandkit.react.createElement( api.ui.components.Button, { onClick: openPanel }, "Open", ); ``` ```ts const panel = sandkit.react.createElement( api.ui.components.Panel, { title: "Options" }, "Panel content", ); ``` ```ts const source = api.ui.hotbar.createBankSource({ bankOffset: 1, minimumBankCount: 2, }); ``` ```ts const hotbar = api.ui.hotbar.useHotbar(); console.log( hotbar.bankCount, hotbar.activeBankIndex, hotbar.activeSlotIndex, ); ``` ```ts const overrideHandle = api.ui.overrides.register( "resources", (Original) => sandkit.react.createElement( sandkit.react.Fragment, null, sandkit.react.createElement(Original), sandkit.react.createElement(ResourceAddon), ), ); ``` ```ts const mountHandle = api.ui.regions.mount( "hotbar", "extra-actions", { placement: "docked", order: 0, render: () => sandkit.react.createElement(ExtraActions), }, ); ``` ```ts mountHandle.update({ order: 10, render: () => sandkit.react.createElement(UpdatedActions), }); ``` ```ts const selected = await api.ui.select( [ { label: "Sand", value: "sand" }, { label: "Fluxite", value: "fluxite" }, ], { title: "Select element", defaultValue: "sand", buttonLabel: "Choose" }, ); ``` ```ts api.ui.useGameEvent("resource:collected", (payload) => { console.log(payload.resourceId, payload.amount); }); ```

| call | returns | notes |
|---|---|---|
| `update(componentId: ComponentId, options?: ComponentUpdateOptions): void` | `void` | Update a registered UI component by id. |
| `openPauseMenu(): void` | `void` | Open the pause menu. |
| `showTooltip(data: TooltipData): void` | `void` | Show a tooltip with the given data. |
| `alert(message: LocalizedText, title?: LocalizedText): Promise<void>` | `Promise<void>` | Show an alert dialog. ```ts await api.ui.alert( { key: "mods|example|details" }, { key: "mods|example|title" }, ); ``` |
| `confirm(message: LocalizedText, title?: LocalizedText): Promise<boolean>` | `Promise<boolean>` | Show a confirm dialog. ```ts const confirmed = await api.ui.confirm( { key: "mods|example|confirm" }, ); ``` |
| `prompt(message: LocalizedText, defaultValue?: string, placeholder?: LocalizedText, title?: LocalizedText, allowCopy?: boolean): Promise<string | null>` | `Promise<string | null>` | Show a prompt dialog. ```ts const value = await api.ui.prompt( { key: "mods|example|enterValue" }, "", ); ``` |
| `inject(componentId: ComponentId, component: ComponentType<Record<string, never>>): () => void` | `() => void` | Mount a React component by id. |

**Aliases**

- `toast` → `shared.api.ui.toast`
- `LocalizedText` → `shared.api.ui.LocalizedText`
- `ToastOptions` → `shared.api.ui.ToastOptions`
- `OverlaySlot` → `LooseString<"hotbar" | "global">`
- `ComponentId` → `ComponentIdEnum | LooseString<never>`
- `ComponentUpdateOptions` → `Record<string, unknown>`
- `TooltipData` → `TooltipMessageData`

<details><summary>Types</summary>

**`TooltipMessageData`** — Message tooltip with localized body text.

- `type`: `'message'` — Discriminator for tooltip renderer selection.
- `text`: `LocalizedText` — Message body as localized text.

**`Focusable`** — Focusable element state from useFocusable.


**`FocusOptions`** — Options for useFocusable registration.


</details>

## `api.ui.navigation`

Controller focus and scope navigation hooks.

| call | returns | notes |
|---|---|---|
| `useFocusable(options: FocusOptions): Focusable<T>` | `Focusable<T>` | React hook for a focusable UI element in a scope. ```ts const focusable = api.ui.navigation.useFocusable({ id: "example-button", scope: "example-scope", onActivate: openExample, }); ``` |
| `useFocusScope(options: { readonly id: string; readonly active: boolean; readonly priority?: number; readonly defaultId?: string; readonly onBack?: (() => boolean | void); }): void` | `void` | React hook to register a focus scope with back handling. ```ts api.ui.navigation.useFocusScope({ id: "example-scope", active: true, priority: 10, }); ``` |
| `controllerFocusClass(focused: boolean): string` | `string` | Return CSS class for controller focus ring state. |

## `api.ui.overlays`

Overlay slot registration and updates.

| call | returns | notes |
|---|---|---|
| `register(slot: OverlaySlot, overlayId: string, render: () => ReactNode): void` | `void` | Register a render function in an overlay slot. |
| `unregister(slot: OverlaySlot, overlayId: string): void` | `void` | Remove an overlay from a slot. |
| `update(slot: OverlaySlot): void` | `void` | Request a re-render for all overlays in a slot. |

## `api.upgrades`

Upgrade categories, definitions, and level queries. Available as `sandkit.api.upgrades`.

| call | returns | notes |
|---|---|---|
| `registerCategory(definition: UpgradeCategoryDefinition): void` | `void` | Register an upgrade category. |
| `register(definition: UpgradeDefinition): void` | `void` | Register an upgrade definition. |
| `updateDefinition(itemId: string, upgradeId: string, partial: Partial<UpgradeDefinition>): void` | `void` | Patch fields on an existing upgrade definition. |
| `getLevelById(itemId: string, upgradeId: string): number` | `number` | Return the current purchased level for an upgrade. |
| `getAvailableLevelById(itemId: string, upgradeId: string): number` | `number` | Return the maximum available level for an upgrade. |
| `setLevelById(itemId: string, upgradeId: string, level: number): void` | `void` | Set the purchased level for an upgrade. |

<details><summary>Types</summary>

**`UpgradeDefinition`** — Upgrade definition registered for an item.

- `itemId`: `string`
- `itemNameKey?`: `string`
- `categoryId?`: `string`
- `upgrade`: `{`

**`UpgradeCategoryDefinition`** — Upgrade category definition shape.

- `id`: `string` — Category identifier referenced by upgrades.
- `nameKey?`: `string` — Display name translation key.

</details>

## `api.utils`

| call | returns | notes |
|---|---|---|
| `getDistance(pointA: Vector2, pointB: Vector2): number` | `number` | Return distance between two points. |
| `getDirection(pointA: Vector2, pointB: Vector2): Vector2` | `Vector2` | Return normalized direction from point A to point B. |
| `getAngle(pointA: Vector2, pointB: Vector2): number` | `number` | Return angle in radians from point A to point B. |
| `getCoordinatesBetweenCells(pointA: Vector2, pointB: Vector2): Vector2[]` | `Vector2[]` | Return grid cells along a line between two points. |
| `getCoordinatesBetweenPoints(pointA: Vector2, pointB: Vector2): Vector2[]` | `Vector2[]` |  |

## `api.workers`

Worker thread post-update scheduling control. Available as `sandkit.api.workers`.

| call | returns | notes |
|---|---|---|
| `setPostUpdateEnabled(enabled: boolean): void` | `void` | Enable or disable worker post-update callbacks. |

## `api.world`

| call | returns | notes |
|---|---|---|
| `runWhenSimulationIdle(callback: () => void): void` | `void` |  |
| `redrawAroundCellWhenIdle(...args: [...CellCoordinates, range: number]): void` | `void` |  |

**Aliases**

- `getCellIdAtCell` → `grid.getCellIdAtCell`
- `isCellEmptyAtCell` → `grid.isCellEmptyAtCell`
- `isTerrainAtCell` → `grid.isTerrainAtCell`
- `reportActivityAtCell` → `grid.reportActivityAtCell`
- `excavateAtCell` → `grid.excavateAtCell`
- `getDimensions` → `grid.getDimensions`
- `ExcavateOptions` → `grid.ExcavateOptions`
- `CellId` → `grid.CellId`
- `GridDimensions` → `grid.GridDimensions`
- `revealFogAtCell` → `grid.revealFogAtCell`
- `WorldItemType` → `pickupsNs.WorldItemType`
- `PickupType` → `pickupsNs.PickupType`
- `WorldItemLight` → `pickupsNs.WorldItemLight`
- `WorldItem` → `pickupsNs.WorldItem`

## `api.world.pickups`

**Aliases**

- `spawnAtWorld` → `pickupsNs.spawnAtWorld`
- `destroy` → `pickupsNs.destroy`
- `pickUp` → `pickupsNs.pickUp`
- `getAll` → `pickupsNs.getAll`
- `getById` → `pickupsNs.getById`
- `remove` → `pickupsNs.remove`


---

# Worker api — `sandkit.api` (worker thread)

Generated from `__pakages/__other/sandkit/src/worker/*.d.ts`. Do not edit by hand —
run `deno run -A tools/extract-public-api.ts`.

Public `sandkit.api` members take only your own arguments: the engine
context is captured once and closed over by the host composer.

## `api.effects`

Worker-thread `sandkit.api.effects` — world-space visual effects on workers. Temporary lights live under {@link lights.temporary}, not here.

| call | returns | notes |
|---|---|---|
| `createAtWorld( effectId: string, worldX: number, worldY: number, options?: EffectOptions, ): void` | `void` | Spawn a named screen-space or world effect. |
| `createEffectAtWorld( effectId: string, worldX: number, worldY: number, options?: EffectOptions, ): void` | `void` |  |

**Aliases**

- `EffectOptions` → `shared.api.effects.EffectOptions`
- `ParticleEffectOptions` → `shared.api.effects.ParticleEffectOptions`
- `createParticlesAtWorld` → `shared.api.effects.createParticlesAtWorld`

## `api.elements`

Worker-thread `sandkit.api.elements` — shared reads plus immediate grid mutations. Worker-entry mutations apply immediately. Main thread defers matching helpers in `sandkit.api.elements`. `sandkit.api.elements`.

| call | returns | notes |
|---|---|---|
| `createAtCell( ...args: [...CellCoordinates, elementTypeOrId: ElementRef, options?: ElementCreateOptions] ): void` | `void` | Create an element at a cell immediately on this worker. ```ts api.elements.createAtCell(cellX, cellY, "water", { durationTicks: 60, }); ``` |
| `replaceAtCell( ...args: [...CellCoordinates, elementTypeOrId: ElementRef, options?: ElementCreateOptions] ): void` | `void` | Replace the element at a cell immediately on this worker. |
| `removeAtCell( ...args: [...CellCoordinates, options?: ElementRemovalOptions] ): void` | `void` | Remove the element at a cell immediately on this worker. |
| `moveBetweenCells( fromCellX: number, fromCellY: number, toCellX: number, toCellY: number ): boolean` | `boolean` | Move an element between cells immediately on this worker. |
| `teleportBetweenCells( fromCellX: number, fromCellY: number, toCellX: number, toCellY: number ): void` | `void` | Teleport an element between cells immediately on this worker. |
| `swapBetweenCells( firstCellX: number, firstCellY: number, secondCellX: number, secondCellY: number ): boolean` | `boolean` | Swap elements between two cells immediately on this worker. |
| `swapCells( firstCellX: number, firstCellY: number, secondCellX: number, secondCellY: number ): boolean` | `boolean` |  |
| `markMovementBlockedByIndex(elementIndex: number): void` | `void` | Mark an element index as movement-blocked for this tick. |
| `markMovementBlockedByElementIndex(elementIndex: number): void` | `void` |  |
| `setVelocityAtCell(...args: [...CellCoordinates, velocity: Vector2]): boolean` | `boolean` | Set particle velocity at a cell immediately on this worker. |
| `addParticleVelocityAtCell( ...args: [...CellCoordinates, velocity: Vector2, maxSpeedCellsPerSecond?: number] ): boolean` | `boolean` | Add velocity to a particle at a cell immediately on this worker. |
| `convertToParticleAtCell(...args: [...CellCoordinates, velocity: Vector2]): boolean` | `boolean` | Convert a cell element to a particle immediately on this worker. |
| `convertFromParticleAtCell(...args: CellCoordinates): boolean` | `boolean` | Convert a particle back to a solid element immediately on this worker. |
| `setDataFieldAtCell( ...args: [...CellCoordinates, fieldNumber: 1 | 2 | 3 | 4, value: number] ): boolean` | `boolean` | Set a data field on the element at a cell immediately on this worker. |
| `refreshColorAtCell(...args: CellCoordinates): void` | `void` | Refresh the rendered color at a cell immediately on this worker. |
| `setPhysicsAtCell(...args: [...CellCoordinates, physicsState: number]): void` | `void` | Set the physics skip mode at a cell immediately on this worker. |
| `setDurationAtCell( ...args: [...CellCoordinates, durationTicks: number, options?: { updateMax?: boolean; }] ): boolean` | `boolean` | Set element duration at a cell immediately on this worker. ```ts const updated = api.elements.setDurationAtCell( cellX, cellY, 120, { updateMax: true }, ); ``` |

**Aliases**

- `ElementType` → `shared.api.elements.ElementType`
- `ElementId` → `shared.api.elements.ElementId`
- `ElementRef` → `shared.api.elements.ElementRef`
- `MatterType` → `shared.api.elements.MatterType`
- `ElementDefinition` → `shared.api.elements.ElementDefinition`
- `ElementCreateOptions` → `shared.api.elements.ElementCreateOptions`
- `ElementRemovalOptions` → `shared.api.elements.ElementRemovalOptions`
- `getIdByType` → `shared.api.elements.getIdByType`
- `getTypeById` → `shared.api.elements.getTypeById`
- `getTypeFromId` → `shared.api.elements.getTypeFromId`
- `getDefinitionByType` → `shared.api.elements.getDefinitionByType`
- `getTypeAtCell` → `shared.api.elements.getTypeAtCell`
- `getResolvedTypeAtCell` → `shared.api.elements.getResolvedTypeAtCell`
- `getResolvedTypeFromCellId` → `shared.api.elements.getResolvedTypeFromCellId`
- `getInfoAtCell` → `shared.api.elements.getInfoAtCell`
- `getMatterTypeAtCell` → `shared.api.elements.getMatterTypeAtCell`
- `isTypeAtCell` → `shared.api.elements.isTypeAtCell`
- `isFreeFallingAtCell` → `shared.api.elements.isFreeFallingAtCell`
- `getVelocityAtCell` → `shared.api.elements.getVelocityAtCell`
- `getDataFieldAtCell` → `shared.api.elements.getDataFieldAtCell`

## `api.events`

Worker-thread `sandkit.api.events` — subscribe to and emit worker-scoped events.

| call | returns | notes |
|---|---|---|
| `on( eventId: K, callback: (payload: EventPayload<K>) => void, options?: EventOnOptions<K>, ): () => void` | `() => void` | Subscribe to a worker event. Returns an unsubscribe function. ```ts api.events.on( "element:moved", (payload) => handleElementMoved(payload), { guard: { elementType } }, ); ``` ```ts api.events.on( "terrain:updated", (payload) => { handleTerrainUpdate(payload); }, { guard: { terrainType } }, ); ``` ```ts api.events.on("worker:update:post", (payload) => { runPostUpdate(payload); }); ``` |
| `emit( eventId: K, payload: EventPayload<K>, options?: EventEmitOptions, ): void` | `void` | Emit a worker event with a payload to subscribers. |

**Aliases**

- `EventId` → `LooseString<keyof EventPayloadMap>`

<details><summary>Types</summary>

**`EventGuard`** — Guard filter for worker events.

- `elementType?`: `sharedElements.ElementType` — Required when subscribing to `element:moved`. Optional on emit.
- `terrainType?`: `number` — Required when subscribing to `terrain:updated`. Optional on emit.

**`EventEmitOptions`** — Options for {@link emit}.

- `guard?`: `EventGuard`

**`EventPayloadMap`** — Known worker event payloads. Unlisted ids still use `unknown`.


</details>

## `api.fire`

Worker-thread `sandkit.api.fire` — ignite and burn elements at grid cells. Worker burns are immediate. Main thread defers burns with `burnElementAtCell`.

| call | returns | notes |
|---|---|---|
| `canBurnElementAtCell(...args: CellCoordinates): boolean` | `boolean` | Return true when the element at the cell can burn. |
| `burnElementAtCell(...args: CellCoordinates): boolean` | `boolean` | Burn the element at the cell immediately on this worker. |

## `api.grid`

Worker-thread `sandkit.api.grid` — grid reads, activity, and excavation. Worker mutations are immediate. Main thread defers grid writes through `api.grid.mutate`.

**Aliases**

- `getCellIdAtCell` → `sharedGrid.getCellIdAtCell`
- `isCellEmptyAtCell` → `sharedGrid.isCellEmptyAtCell`
- `isTerrainAtCell` → `sharedGrid.isTerrainAtCell`
- `reportActivityAtCell` → `sharedGrid.reportActivityAtCell`
- `excavateAtCell` → `sharedGrid.excavateAtCell`
- `getDimensions` → `sharedGrid.getDimensions`
- `ExcavateOptions` → `sharedGrid.ExcavateOptions`
- `CellId` → `sharedGrid.CellId`
- `GridDimensions` → `sharedGrid.GridDimensions`

## `api.hooks`

Worker-thread `sandkit.api.hooks` — intercept and modify simulation hook points.

| call | returns | notes |
|---|---|---|
| `intercept( hookId: K, callback: (args: InterceptHookArgs<K>, context: HookContext) => void, options?: InterceptHookOptions<K>, ): () => void` | `() => void` | Register an intercept hook on this worker. Returns an unsubscribe function. ```ts api.hooks.intercept("cell:process", handleCell, { guard: { elementType }, }); ``` ```ts api.hooks.intercept("element:update", handleUpdate, { guard: { elementType }, }); ``` ```ts api.hooks.intercept("element:move", (args, context) => { handleElementMove(args, context); }); ``` ```ts api.hooks.intercept( "element:move:blocked", (args, context) => { handleBlockedMovement(args, context); }, { guard: { elementType } }, ); ``` ```ts api.hooks.intercept( "element:duration:expire", (args, context) => { handleDurationExpiry(args, context); }, { guard: { elementType } }, ); ``` ```ts api.hooks.intercept("fire:element:burn", (args, context) => { handleElementBurn(args, context); }); ``` ```ts api.hooks.intercept("shaker:elementOn", (args, context) => { handleShakerElement(args, context); }); ``` |
| `modify( hookId: K, callback: (args: ModifyHookArgs<K>) => void, options?: ModifyHookOptions, ): () => void` | `() => void` | Register a modifier hook on this worker. Returns an unsubscribe function. ```ts api.hooks.modify("example:prepare", (args) => { args.value *= 2; }); ``` |

**Aliases**

- `ElementGuardedInterceptHookId` → `| "cell:process" | "element:update" | "element:move:blocked" | "element:blocked" | "element:duration:expire" | "element:duration"`
- `InterceptHookId` → `LooseString< | ElementGuardedInterceptHookId | "element:move" | "fire:element:burn" | "shaker:elementOn" >`
- `ModifyHookId` → `LooseString<string>`
- `ModifyHookMap` → `Record<string, unknown>`

<details><summary>Types</summary>

**`HookContext`** — Context passed to intercept hook callbacks.

- `cancelled`: `boolean` — True after {@link cancel} was called on this context.

**`HookGuard`** — Guard filter for worker hook registration.

- `elementType?`: `sharedElements.ElementType` — Required for element-scoped intercept hooks and optional on emit.
- `terrainType?`: `number` — Required for terrain-scoped event guards; optional on emit.

**`ModifyHookOptions`** — Options for {@link modify}.

- `guard?`: `HookGuard`
- `priority?`: `number`

**`InterceptHookMap`** — Intercept hook argument shapes keyed by hook id.


</details>

## `api.lights`

Worker-thread `sandkit.api.lights` — temporary visual effect lights.

## `api.lights.temporary`

Short-lived visual effect lights.

| call | returns | notes |
|---|---|---|
| `createAtWorld( worldX: number, worldY: number, options?: TemporaryLightOptions, ): TemporaryLightHandle` | `TemporaryLightHandle` | Create a temporary light at world coordinates. ```ts const light = api.lights.temporary.createAtWorld(worldX, worldY, { durationTicks: 15, }); const lightId = light.lightId; ``` |

**Aliases**

- `TemporaryLightOptions` → `shared.api.effects.TemporaryLightOptions`

<details><summary>Types</summary>

**`TemporaryLightHandle`** — Handle returned by {@link createAtWorld}.

- `lightId`: `number | null` — Runtime light id, or null when the pool is full.
- `index?`: `number | null`

</details>

## `api.main`

Worker thread only. `sandkit.api.main` — send events to the main thread. larger `sandkit.api` surface; do not assume parity.

| call | returns | notes |
|---|---|---|
| `emitEvent(eventId: string, payload: Payload): void` | `void` | Emit a custom event on the main thread. |

## `api.shared`

Worker thread only. `sandkit.api.shared` — shared memory buffers for workers. Workers **require** buffers created on the main thread. Main thread only **gets** existing buffers. See {@link shared} for the shared base declarations. main-thread `sandkit.api.shared`.

**Aliases**

- `SharedArray` → `sharedApi.api.shared.SharedArray`
- `SharedArrayType` → `sharedApi.api.shared.SharedArrayType`

## `api.shared.buffers`

Named shared memory buffers for worker threads.

| call | returns | notes |
|---|---|---|
| `require(key: string, config: { type: SharedArrayType; length: number; }): SharedArray` | `SharedArray` | Attach to a named shared buffer on this worker. The buffer must already exist on the main thread with the same {@link SharedArrayType} and length as `config`. ```ts const counts = api.shared.buffers.require("counts", { type: "uint32", length: 4, }); ``` |

**Aliases**

- `get` → `sharedApi.api.shared.buffers.get`

## `api.worker`

Worker thread only. `sandkit.api.worker` — identity of the current simulation worker. main-thread APIs.

| call | returns | notes |
|---|---|---|
| `getIndex(): number` | `number` | Return the zero-based index of this worker in the worker pool. |
| `getCount(): number` | `number` | Return the total number of simulation workers. |

## `api.world`

**Aliases**

- `getCellIdAtCell` → `grid.getCellIdAtCell`
- `isCellEmptyAtCell` → `grid.isCellEmptyAtCell`
- `isTerrainAtCell` → `grid.isTerrainAtCell`
- `reportActivityAtCell` → `grid.reportActivityAtCell`
- `excavateAtCell` → `grid.excavateAtCell`
- `getDimensions` → `grid.getDimensions`
- `ExcavateOptions` → `grid.ExcavateOptions`
- `CellId` → `grid.CellId`
- `GridDimensions` → `grid.GridDimensions`
