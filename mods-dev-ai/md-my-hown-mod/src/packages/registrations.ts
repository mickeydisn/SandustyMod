/**
 * Registration: the half of the wrapper that needs the handler.
 *
 * Everything here turns a stored process into something the engine can run, so
 * it imports `handler/custom-process` and `handler/excavation-option`. That is
 * precisely what `mysandkit.ts` cannot do, which is why these are separate
 * files rather than one: the split is the cycle-breaker, not an accident of
 * organisation.
 *
 * Nothing inside `handler/` imports this module, so the dependency still points
 * one way.
 */
import { compileExcavationProfile } from "../handler/excavation-option/index.ts";
import {
    type ContactReactionConfig,
    type ElementConfig,
    type InteractionConfig,
    type ItemConfig,
    LOG,
    MOD_ID,
    type ProcessingConfig,
    type RecipeConfig,
    type StructureConfig,
} from "../constants.ts";
import { compileEntryProcess } from "../handler/custom-process/index.ts";
import { placementConfigPayload, placementConfigProblem } from "../config/placement.ts";
import {
    api,
    type CompiledItemAction,
    g,
    resolveElementRef,
    resolveTerrainRef,
    setItemActionCompiler,
} from "./mysandkit.ts";

/**
 * Hand the wrapper the one thing it cannot build for itself.
 *
 * Runs at module load, which is why importing this module is part of boot: it is
 * what makes `api.items.register` work. Done here rather than at the call site
 * so a missing compiler throws with a message that says what to do, instead of
 * registering an item that can never be used.
 */
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

/**
 * Recipe body per machine. See `doc/doc-artifacts/doc.api/shared/api.recipes.md`:
 *   planterBox → { input, output, chance? }   shaker → { input, outputsAbove[], outputsBelow[] }
 *   kineticPress → { input, minimumDownwardVelocity, outputs[] }   others → { input, outputs[] }
 */
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
    // handlerKey is a UI/code concern — never forward it to the engine.
    // The engine definition is `{ structureType, intervalMs, process }`; there is
    // no per-instance registration, so `structures.addProcessor` is not a real API
    // and is no longer called.
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
    // The engine signature is `register(id, definition)` — the **id is a label for
    // the registration**, and `structureType` belongs inside the definition.
    //
    // This used to be `register(structureType, rest)`, which reads plausibly and
    // is wrong twice over: it passed the structure type where the id belongs, and
    // destructured `structureType` *out* of `rest`, so the definition the engine
    // received had no `structureType` at all. The engine then threw
    //     Structure "undefined" must be registered before its processing.
    // and the tick never ran. Offline tests missed it because the stubbed
    // `processing.register` never looks at the definition.
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

// ── Extra register surfaces ────────────────────────────────────────────────

export function registerTerrain(def: import("../constants.ts").TerrainConfig): void {
    try {
        const id = String(def.id);
        const out: Record<string, unknown> = { ...def, id };
        if (def.name && !def.nameKey) out.nameKey = `terrains|${id}|name`;
        g()?.api?.terrains?.register?.(out);
    } catch (e) {
        console.error(`${LOG} terrains.register failed`, def.id, e);
    }
}

export function registerTech(def: import("../constants.ts").TechConfig): void {
    try {
        const id = String(def.id);
        const { parentId, preferredPosition, ...body } = def as any;
        const apiTech = g()?.api?.tech;
        if (!apiTech) return;
        if (typeof apiTech.registerDefinition === "function") {
            apiTech.registerDefinition(id, body);
        } else if (typeof apiTech.addDefinition === "function") {
            apiTech.addDefinition(id, body);
        }
        if (parentId != null && typeof apiTech.registerNode === "function") {
            try {
                apiTech.registerNode(id, body, { parentId, preferredPosition });
            } catch (e) {
                console.warn(`${LOG} tech.registerNode failed`, id, e);
            }
        }
    } catch (e) {
        console.error(`${LOG} tech.register failed`, def.id, e);
    }
}

export function registerUpgradeCategory(
    def: import("../constants.ts").UpgradeCategoryConfig,
): void {
    try {
        const { onUpgradeKey, id: _id, ...rest } = def as any;
        // The engine rejects a category that has no id and no localised name:
        //     if (!t.id || !t.name && !t.nameKey)
        //         throw new Error("Upgrade category requires an id and localized name.");
        // Dropping `id` here meant *every* category registration threw, so the
        // id is forwarded and a name is derived when the author supplied none.
        const body: Record<string, unknown> = { ...rest, id: def.id };
        if (!body.name && !body.nameKey) {
            body.name = def.id;
            body.nameKey = `upgrades|${def.id}|name`;
        }
        g()?.api?.upgrades?.registerCategory?.(body);
    } catch (e) {
        console.error(`${LOG} upgrades.registerCategory failed`, def.id, e);
    }
}

export function registerUpgrade(def: import("../constants.ts").UpgradeConfig): void {
    try {
        const { id: _id, ...rest } = def as Record<string, unknown>;
        // `onUpgrade` is a real top-level field of `upgrades.register` and the
        // engine reads it — a callback, like `ItemDefinition.handleAction`. The mod
        // stores a *reference* to a process; a config still on the old `onUpgradeKey`
        // spelling holds no program at all, and all 7 upgrade actions are then
        // unreachable in-game. That is the author's entry to fix, not a silent gap
        // this layer should paper over.
        const compiled = compileEntryProcess(rest, "upgrade");
        if (compiled.skipped.length) {
            console.warn(`${LOG} upgrade ${def.id}: unknown action ${compiled.skipped.join(", ")}`);
        }
        g()?.api?.upgrades?.register?.({ ...rest, onUpgrade: compiled.fn });
    } catch (e) {
        console.error(`${LOG} upgrades.register failed`, def.id, e);
    }
}

/**
 * `input.registerBinding(bindingId, defaultKeys, definition)`. The engine's
 * `handlers` is a function pair JSON cannot hold, so keys are stored and
 * compiled here.
 */
export function registerInputBinding(
    def: import("../constants.ts").InputBindingConfig,
): void {
    try {
        const input = g()?.api?.input;
        if (!input?.registerBinding) {
            console.warn(`${LOG} input.registerBinding unavailable — ${def.id} stored only`);
            return;
        }
        // a binding with neither handler would be inert; the engine still
        // accepts it, so register with an empty pair rather than skipping
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

        input.registerBinding(
            def.id,
            def.defaultKeys ?? [],
            definition as never,
        );
    } catch (e) {
        console.error(`${LOG} input.registerBinding failed`, def.id, e);
    }
}

export function registerProjectile(def: import("../constants.ts").ProjectileConfig): void {
    try {
        const out: Record<string, unknown> = { ...def };
        // getOptions is required by engine — synthesize from static options if needed
        if (typeof out.getOptions !== "function") {
            const opts = def.options ?? {};
            out.getOptions = () => ({ ...opts });
        }
        if (!out.sprite || !(out.sprite as any).id) {
            out.sprite = { id: `${def.id}-sprite`, ...(def.sprite as object || {}) };
        }
        g()?.api?.projectiles?.register?.(out);
    } catch (e) {
        console.error(`${LOG} projectiles.register failed`, def.id, e);
    }
}

export function registerEnergyType(def: import("../constants.ts").EnergyTypeConfig): void {
    try {
        // api.energy.registerType accepts only "conductor" | "storage". Guard here so a
        // hand-edited / imported config with a bogus role is skipped loudly instead of
        // being forwarded to the engine.
        const type = def.type;
        if (type !== "conductor" && type !== "storage") {
            console.warn(
                `${LOG} energy ${def.id}: invalid type "${
                    String(type)
                }" — must be conductor|storage. Skip.`,
            );
            return;
        }
        g()?.api?.energy?.registerType?.(def.structureId, type, def.options ?? {});
    } catch (e) {
        console.error(`${LOG} energy.registerType failed`, def.id, e);
    }
}

export function registerExcavationProfile(
    def: import("../constants.ts").ExcavationProfileConfig,
): void {
    try {
        // registerProfile(id, { pattern?, power, options?, terrainRules? }) — terrainRules
        // was previously dropped on the floor, making per-terrain dig rules unreachable.
        const { id, power, pattern, options, terrainRules } = def as typeof def & {
            terrainRules?: unknown;
        };
        // `power` and `options` come from the chosen **ExcavationOption** when there
        // is one, and from the entry's own fields when there is not. The option owns
        // exactly those two keys and nothing else, which is why `pattern` and
        // `terrainRules` below are read straight off the entry: a preset has no
        // opinion about the shape of a dig or what sandstone becomes. See
        // `../handler/excavation-option/compile.ts`.
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
            // cellType → TerrainRef, outputElementType → ElementRef. Both accept a
            // string id, but we upgrade to numeric handles when the runtime knows them.
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
        g()?.api?.excavation?.registerProfile?.(id, payload);
    } catch (e) {
        console.error(`${LOG} excavation.registerProfile failed`, def.id, e);
    }
}

/** Register one structure behaviour. This build exposes the split API; the grouped name is probed first. */
export function registerStructureBehavior(
    def: import("../constants.ts").StructureBehaviorConfig,
): void {
    try {
        const api = g()?.api;
        if (!api) {
            console.warn(`${LOG} sandkit api unavailable`);
            return;
        }
        const kind = String(def.kind || "").toLowerCase();
        const payload = def.definition ?? def;
        const grouped = (api as { structureBehaviors?: Record<string, unknown> })
            .structureBehaviors;
        if (kind === "conveyor") {
            const id = String((payload as { id?: string })?.id ?? def.id);
            // The engine forwards `options` to the workers untouched, so it is
            // passed through whole rather than picked apart here.
            const options = (payload as { options?: unknown })?.options ?? payload;
            if (typeof grouped?.registerConveyorType === "function") {
                (grouped.registerConveyorType as (a: string, b: unknown) => void)(
                    id,
                    options,
                );
            } else if (typeof api.conveyors?.registerType === "function") {
                api.conveyors.registerType(id, options);
            } else {
                console.warn(`${LOG} no conveyor registration method`, def.id);
            }
        } else if (kind === "launcher") {
            if (typeof grouped?.registerLauncherType === "function") {
                (grouped.registerLauncherType as (a: unknown) => void)(payload);
            } else if (typeof api.launchers?.registerType === "function") {
                api.launchers.registerType(payload);
            } else {
                console.warn(`${LOG} no launcher registration method`, def.id);
            }
        } else {
            console.warn(`${LOG} unknown structure behavior kind`, def.kind);
        }
    } catch (e) {
        console.error(`${LOG} structureBehaviors failed`, def.id, e);
    }
}

/**
 * Register one structure's **placement hotbar fields**.
 *
 * `structures.registerPlacementConfig({ structureId, fields })` — the widgets the
 * player adjusts while holding the building, before placing it.
 *
 * Two things are worth stating because both are ways this call silently fails,
 * and both have already happened to a mod that shipped them:
 *
 * 1. **The payload is `{ structureId, fields }` and nothing else.** There is no
 *    `maxCount`. The engine's body (bundel 88861) opens with
 *    `if (!t.structureId || !t.fields.length) throw …` — so a call carrying
 *    `{ structureId, maxCount }` throws, and a `try {} catch {}` around it turns
 *    that into a config that does not exist and a player who sees no widget and
 *    no reason. Hence the pre-flight below: nothing reaches the engine unchecked.
 *
 * 2. **The check is `structureId` + a non-empty `fields`, not a count.** A
 *    placement config is the hotbar field list. It does not cap how many of a
 *    structure may be placed — the engine's `maxCount` is gated behind
 *    `structureType === GloomEmitter` (bundel 5251) and is unreachable from a mod.
 *
 * The rules themselves live in `../config/placement.ts` and are shared with the
 * panel, so a save the panel accepts and a boot the game accepts cannot disagree.
 */
export function registerPlacementConfig(
    def: import("../constants.ts").PlacementConfigConfig,
): void {
    const problem = placementConfigProblem(def);
    if (problem) {
        // The engine's own wording, so the boot log and the panel read alike.
        console.error(`${LOG} placement config "${def?.id ?? "?"}" rejected: ${problem}`);
        return;
    }
    try {
        const api = g()?.api;
        if (!api) {
            console.warn(`${LOG} sandkit api unavailable`);
            return;
        }
        const structures = api.structures as {
            registerPlacementConfig?: (definition: unknown) => unknown;
        } | undefined;
        if (typeof structures?.registerPlacementConfig !== "function") {
            console.warn(`${LOG} no registerPlacementConfig on this build`, def.id);
            return;
        }
        structures.registerPlacementConfig(placementConfigPayload(def));
    } catch (e) {
        // Reachable: the engine throws *after* its own checks on anything the
        // pre-flight does not model, and a partial registration can throw too.
        console.error(`${LOG} placement config failed`, def.id, e);
    }
}

export function registerSignal(
    def: import("../constants.ts").SignalConfig,
    handler?: Function,
): void {
    try {
        const kind = String(def.kind || "targets").toLowerCase();
        const sig = g()?.api?.signals;
        if (!sig) return;
        if (!handler) {
            console.warn(`${LOG} signal ${def.id}: no handler — stored only`);
            return;
        }
        if (kind === "targets") {
            sig.targets?.register?.(def.target, handler);
        } else if (kind === "interactables") {
            sig.interactables?.register?.(def.target, handler);
        } else if (kind === "sendertype" || kind === "sender") {
            sig.registerSenderType?.(def.target, handler);
        } else {
            console.warn(`${LOG} signal ${def.id}: unknown kind ${def.kind}`);
        }
    } catch (e) {
        console.error(`${LOG} signals.register failed`, def.id, e);
    }
}

export function registerTrigger(
    def: import("../constants.ts").TriggerConfig,
    handler?: Function,
): void {
    try {
        const tid = def.triggerId || def.id;
        if (!handler) {
            console.warn(`${LOG} trigger ${def.id}: no handler — stored only`);
            return;
        }
        g()?.api?.triggers?.register?.(tid, {
            interval: def.interval ?? 60,
            sequentialRuns: def.sequentialRuns ?? 1,
            extra: def.extra ?? {},
            callback: handler,
        });
    } catch (e) {
        console.error(`${LOG} triggers.register failed`, def.id, e);
    }
}

export async function registerSprite(def: import("../constants.ts").SpriteConfig): Promise<void> {
    try {
        const sprites = g()?.api?.sprites;
        if (!sprites) return;
        const opts = def.options ?? {};
        // A drawn sprite is a base64 PNG in `source`, not a file. Handing it to
        // `loadFromMod` would look for a mod asset at that string and fail
        // silently, leaving the id registered with no texture.
        //
        // Imported here rather than at the top: the editor pulls in `api.ts`,
        // which reads `sandkit.api` at module load, and most callers of this
        // module are not in a host at all — the config tests and the migration
        // tools. A static import made those fail to load for a code path they
        // never take. It also keeps the editor off the boot path for the
        // overwhelmingly common config that has no drawn sprites in it.
        if (typeof def.source === "string" && def.source.startsWith("data:")) {
            const { registerDataUrlSprite } = await import(
                "../sprite-editor/register.ts"
            );
            await registerDataUrlSprite(def.id, def.source, opts);
            return;
        }
        if (def.path && (def.fromMod !== false)) {
            await sprites.loadFromMod?.(def.id, def.path, opts);
        } else if (def.source || def.path) {
            await sprites.load?.(def.id, def.source ?? def.path, opts);
        } else {
            console.warn(`${LOG} sprite ${def.id}: need path or source`);
        }
    } catch (e) {
        console.error(`${LOG} sprites.load failed`, def.id, e);
    }
}
