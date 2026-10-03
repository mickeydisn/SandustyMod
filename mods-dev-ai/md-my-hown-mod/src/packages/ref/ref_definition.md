## api.input
    - registerBinding(bindingId, defaultKeys, definition)
## api.items
    - register(definition)
    - updateDefinition(itemId, partial)
    - getDefinitionById(itemId)
## api.projectiles
    - register(definition)
    - getDefinitionById(projectileId)
## api.elements
    - register(definition)
    - updateDefinition(elementTypeOrId, partial)
    - getDefinitionByType(elementType)
## api.i18n
    - getName(definition) / getDescription(definition)
## api.structureBehaviors
    - registerLauncherType(definition)
## api.structures
    - recipes.register(id, definition)
    - register(definition, options?)
    - updateDefinition(structureTypeOrId, partial, options?)
    - registerPlacementConfig(definition)
    - getDefinitionByType(structureType)
## api.structures.processing
    - register(id, definition)
## api.tech
    - getDefinitionById(techId)
    - updateDefinition(techId, partial)
    - registerDefinition(techId, definition)
    - registerNode(techId, definition, options)
## api.terrains
    - register(definition)
    - updateDefinition(terrainTypeOrId, partial)
    - getDefinitionByType(terrainType)
## api.triggers
    - register(triggerId, definition)
## api.excavation
    - registerProfile(id, definition)
## api.reactions
    - registerContact(definition)
## api.upgrades
    - registerCategory(definition)
    - register(definition)
    - updateDefinition(itemId, upgradeId, partial)

