import { compileExcavationProfile } from "../handler/excavation-option/index.ts";
import {
    type ContactReactionConfig,
    type ElementConfig,
    type EnergyTypeConfig,
    type ExcavationProfileConfig,
    type InputBindingConfig,
    type InteractionConfig,
    type ItemConfig,
    LOG,
    MOD_ID,
    type PlacementConfigConfig,
    type ProcessingConfig,
    type ProjectileConfig,
    type RecipeConfig,
    type SignalConfig,
    type SpriteConfig,
    type StructureBehaviorConfig,
    type StructureConfig,
    type TechConfig,
    type TerrainConfig,
    type TriggerConfig,
    type UpgradeCategoryConfig,
    type UpgradeConfig,
} from "../constants.ts";
import { compileEntryProcess } from "../handler/custom-process/index.ts";
import { placementConfigPayload, placementConfigProblem } from "../config/placement.ts";
import {
    api,
    type CompiledItemAction,
    resolveElementRef,
    resolveTerrainRef,
    setItemActionCompiler,
} from "./mysandkit.ts";

setItemActionCompiler(
    (def) => compileEntryProcess(def, "itemAction") as unknown as CompiledItemAction,
);

const RECIPE_MACHINES = new Set([
    "planterBox",
    "shaker",
    "kineticPress",
    "condenser",
    "steamDryer",
    "synthesizer",
    "snowmaker",
    "smelter",
]);

function resolveRecipeBody(r: RecipeConfig, machine: string): Record<string, unknown> {
    const body: Record<string, unknown> = { ...r };
    delete body.id;
    delete body.kind;
    delete body.structureType;
    delete body.structureId;
    delete body.chance;

    const mapOut = (arr: unknown) => {
        if (!Array.isArray(arr)) return [];
        return arr
            .filter((o) => o && typeof o === "object")
            .map((o: any) => ({
                elementType: resolveElementRef(o.elementType),
                chance: typeof o.chance === "number" ? o.chance : 1,
            }));
    };

    body.input = resolveElementRef(body.input as any);

    if (machine === "planterBox") {
        body.output = resolveElementRef(body.output as any);
        const ch = Number((r as any).chance);
        if (Number.isFinite(ch)) body.chance = ch;
        delete body.outputs;
        delete body.outputsAbove;
        delete body.outputsBelow;
        delete body.minimumDownwardVelocity;
        return body;
    }
    if (machine === "shaker") {
        delete body.output;
        delete body.outputs;
        delete body.minimumDownwardVelocity;
        body.outputsAbove = mapOut((body as any).outputsAbove);
        body.outputsBelow = mapOut((body as any).outputsBelow);
        return body;
    }

    delete body.output;
    delete body.outputsAbove;
    delete body.outputsBelow;
    body.outputs = mapOut((body as any).outputs);
    if (machine === "kineticPress") {
        const mv = Number((body as any).minimumDownwardVelocity);
        body.minimumDownwardVelocity = Number.isFinite(mv) && mv >= 0 ? mv : 0;
    } else {
        delete body.minimumDownwardVelocity;
    }
    return body;
}

export function registerRecipe(r: RecipeConfig): void {
    let machine = String(r.kind || "structure");
    if (machine === "grower" || machine === "planter") machine = "planterBox";
    if (!RECIPE_MACHINES.has(machine)) {
        machine = String(r.structureType ?? machine);
    }
    if (!RECIPE_MACHINES.has(machine)) {
        console.warn(
            `${LOG} recipe ${r.id}: "${r.kind}" is not a supported machine id ` +
                `(use one of: ${[...RECIPE_MACHINES].join(", ")})`,
        );
        return;
    }
    const body = resolveRecipeBody(r, machine);
    api.structures.recipes.register(machine, body);
}

export function registerProcessing(p: ProcessingConfig): void {
    const { id, handlerKey: _hk, ...rest } = p as
        & Record<string, unknown>
        & ProcessingConfig;
    const { structureType } = rest as { structureType?: string };
    if (structureType === undefined) {
        console.warn(`${LOG} processing ${id}: missing structureType`);
        return;
    }
    if (typeof rest.process !== "function") {
        console.warn(
            `${LOG} processing ${id}: process() not a function (JSON cannot store callbacks). Skip.`,
        );
        return;
    }

    api.structures.processing.register(id ?? `${structureType}:process`, rest);
}

export function registerContact(c: ContactReactionConfig): void {
    api.reactions.registerContact({
        inputA: resolveElementRef(c.inputA),
        inputB: resolveElementRef(c.inputB),
        outputA: resolveElementRef(c.outputA),
        outputB: resolveElementRef(c.outputB),
        orientation: c.orientation,
    });
}

export function registerInteraction(ix: InteractionConfig): void {
    const el = resolveElementRef(ix.elementId);
    if (el === undefined || el === null) {
        console.warn(`${LOG} interaction ${ix.id}: bad elementId`);
        return;
    }
    api.elements.addInteractionInfo(el as string | number, ix.interaction);
}

export function registerTerrain(def: TerrainConfig): void {
    try {
        const id = String(def.id);
        const out: Record<string, unknown> = { ...def, id };
        if (def.name && !def.nameKey) out.nameKey = `terrains|${id}|name`;
        api.terrains.register(out);
    } catch (e) {
        console.error(`${LOG} terrains.register failed`, def.id, e);
    }
}

export function registerTech(def: TechConfig): void {
    try {
        const id = String(def.id);
        const { parentId, preferredPosition, ...body } = def as any;
        if (!api.tech.registerDefinition(id, body)) {
            console.warn(`${LOG} tech ${def.id}: no registerDefinition on this build`);
            return;
        }
        if (parentId != null) {
            api.tech.registerNode(id, body, { parentId, preferredPosition });
        }
    } catch (e) {
        console.error(`${LOG} tech.register failed`, def.id, e);
    }
}

export function registerUpgradeCategory(
    def: UpgradeCategoryConfig,
): void {
    try {
        const { onUpgradeKey, id: _id, ...rest } = def as any;

        const body: Record<string, unknown> = { ...rest, id: def.id };
        if (!body.name && !body.nameKey) {
            body.name = def.id;
            body.nameKey = `upgrades|${def.id}|name`;
        }
        api.upgrades.registerCategory(body);
    } catch (e) {
        console.error(`${LOG} upgrades.registerCategory failed`, def.id, e);
    }
}

export function registerUpgrade(def: UpgradeConfig): void {
    try {
        const { id: _id, ...rest } = def as Record<string, unknown>;

        const compiled = compileEntryProcess(rest, "upgrade");
        if (compiled.skipped.length) {
            console.warn(`${LOG} upgrade ${def.id}: unknown action ${compiled.skipped.join(", ")}`);
        }
        api.upgrades.register({ ...rest, onUpgrade: compiled.fn });
    } catch (e) {
        console.error(`${LOG} upgrades.register failed`, def.id, e);
    }
}

export function registerInputBinding(
    def: InputBindingConfig,
): void {
    try {
        const handlers: Record<string, Function> = {};
        if (typeof def.onDownKey === "function") handlers.down = def.onDownKey;
        if (typeof def.onUpKey === "function") handlers.up = def.onUpKey;

        const definition: Record<string, unknown> = {
            displayName: def.displayName,
            category: def.category,
            handlers,
        };
        if (def.displayNameKey) definition.displayNameKey = def.displayNameKey;
        if (def.subsection) definition.subsection = def.subsection;

        api.input.registerBinding(
            def.id,
            def.defaultKeys ?? [],
            definition as never,
        );
    } catch (e) {
        console.error(`${LOG} input.registerBinding failed`, def.id, e);
    }
}

export function registerProjectile(def: ProjectileConfig): void {
    try {
        const out: Record<string, unknown> = { ...def };

        if (typeof out.getOptions !== "function") {
            const opts = def.options ?? {};
            out.getOptions = () => ({ ...opts });
        }
        if (!out.sprite || !(out.sprite as any).id) {
            out.sprite = { id: `${def.id}-sprite`, ...(def.sprite as object || {}) };
        }
        api.projectiles.register(out);
    } catch (e) {
        console.error(`${LOG} projectiles.register failed`, def.id, e);
    }
}

export function registerEnergyType(def: EnergyTypeConfig): void {
    try {
        const type = def.type;
        if (type !== "conductor" && type !== "storage") {
            console.warn(
                `${LOG} energy ${def.id}: invalid type "${
                    String(type)
                }" — must be conductor|storage. Skip.`,
            );
            return;
        }
        api.energy.registerType(
            def.structureId,
            type as "conductor" | "storage",
            def.options ?? {},
        );
    } catch (e) {
        console.error(`${LOG} energy.registerType failed`, def.id, e);
    }
}

export function registerExcavationProfile(
    def: ExcavationProfileConfig,
): void {
    try {
        const { id, power, pattern, options, terrainRules } = def as typeof def & {
            terrainRules?: unknown;
        };

        const { patch, key, problem } = compileExcavationProfile(def as Record<string, unknown>);
        if (problem) {
            console.warn(`${LOG} excavation profile ${id}: ${problem} — using the stored power`);
        } else if (key) {
            console.log(`${LOG} excavation profile ${id}: power and flags from ${key}`);
        }
        const payload: Record<string, unknown> = {
            power: patch.power ?? power,
            options: patch.options ?? options,
            pattern,
        };
        if (Array.isArray(terrainRules) && terrainRules.length > 0) {
            payload.terrainRules = terrainRules.map((raw) => {
                const r = (raw ?? {}) as Record<string, unknown>;
                const cellType = resolveTerrainRef(
                    (r.cellType ?? r.terrainType) as string | number | undefined,
                );
                const out: Record<string, unknown> = {};
                if (cellType !== undefined && cellType !== null) out.cellType = cellType;
                if (r.damage !== undefined) out.damage = r.damage;
                const el = resolveElementRef(
                    r.outputElementType as string | number | undefined,
                );
                if (el !== undefined && el !== null) out.outputElementType = el;
                return out;
            });
        }
        api.excavation.registerProfile(id, payload);
    } catch (e) {
        console.error(`${LOG} excavation.registerProfile failed`, def.id, e);
    }
}

export function registerStructureBehavior(
    def: StructureBehaviorConfig,
): void {
    try {
        const kind = String(def.kind || "").toLowerCase();
        const payload = def.definition ?? def;
        if (kind === "conveyor") {
            const id = String((payload as { id?: string })?.id ?? def.id);

            const options = (payload as { options?: unknown })?.options ?? payload;
            if (!api.structureBehaviors.registerConveyorType(id, options)) {
                console.warn(`${LOG} no conveyor registration method`, def.id);
            }
        } else if (kind === "launcher") {
            if (!api.structureBehaviors.registerLauncherType(payload)) {
                console.warn(`${LOG} no launcher registration method`, def.id);
            }
        } else {
            console.warn(`${LOG} unknown structure behavior kind`, def.kind);
        }
    } catch (e) {
        console.error(`${LOG} structureBehaviors failed`, def.id, e);
    }
}

export function registerPlacementConfig(
    def: PlacementConfigConfig,
): void {
    const problem = placementConfigProblem(def);
    if (problem) {
        console.error(
            `${LOG} placement config "${def?.id ?? "?"}" rejected — ${problem.message}`,
        );
        return;
    }
    try {
        if (!api.structures.registerPlacementConfig(placementConfigPayload(def))) {
            console.warn(`${LOG} no registerPlacementConfig on this build`, def.id);
        }
    } catch (e) {
        console.error(`${LOG} placement config failed`, def.id, e);
    }
}

export function registerSignal(
    def: SignalConfig,
    handler?: Function,
): void {
    try {
        const kind = String(def.kind || "targets").toLowerCase();
        if (!handler) {
            console.warn(`${LOG} signal ${def.id}: no handler — stored only`);
            return;
        }
        const asKind = kind === "targets" || kind === "interactables"
            ? kind
            : kind === "sendertype" || kind === "sender"
            ? "sender"
            : null;
        if (asKind === null) {
            console.warn(`${LOG} signal ${def.id}: unknown kind ${def.kind}`);
            return;
        }
        if (
            !api.signals.registerTarget(
                asKind,
                def.target,
                handler as (...args: unknown[]) => unknown,
            )
        ) {
            console.warn(`${LOG} signal ${def.id}: no ${asKind}.register on this build`);
        }
    } catch (e) {
        console.error(`${LOG} signals.register failed`, def.id, e);
    }
}

export function registerTrigger(
    def: TriggerConfig,
    handler?: Function,
): void {
    try {
        const tid = def.triggerId || def.id;
        if (!handler) {
            console.warn(`${LOG} trigger ${def.id}: no handler — stored only`);
            return;
        }
        api.triggers.register(tid, {
            interval: def.interval ?? 60,
            sequentialRuns: def.sequentialRuns ?? 1,
            extra: def.extra ?? {},
            callback: handler,
        });
    } catch (e) {
        console.error(`${LOG} triggers.register failed`, def.id, e);
    }
}

export async function registerSprite(def: SpriteConfig): Promise<void> {
    try {
        const opts = def.options ?? {};

        if (typeof def.source === "string" && def.source.startsWith("data:")) {
            const { registerDataUrlSprite } = await import(
                "../sprite-editor/register.ts"
            );
            await registerDataUrlSprite(def.id, def.source, opts);
            return;
        }
        if (def.path && (def.fromMod !== false)) {
            await api.sprites.loadFromMod(def.id, def.path, opts);
        } else {
            const source = def.source ?? def.path;
            if (source === undefined) {
                console.warn(`${LOG} sprite ${def.id}: need path or source`);
                return;
            }
            await api.sprites.load(def.id, source, opts);
        }
    } catch (e) {
        console.error(`${LOG} sprites.load failed`, def.id, e);
    }
}
