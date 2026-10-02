import { LOG, type RecipeConfig } from "../../constants.ts";
import { api, resolveElementRef } from "../../packages/mysandkit.ts";
import { registerEach, type RegisterContext } from "../registry.ts";

/** Every machine id the engine accepts a recipe body for. */
const MACHINES = new Set([
    "planterBox",
    "shaker",
    "kineticPress",
    "condenser",
    "steamDryer",
    "synthesizer",
    "snowmaker",
    "smelter",
]);

/** Map a recipe's own vocabulary onto the machine id the engine knows. */
function machineOf(r: RecipeConfig): string {
    let machine = String(r.kind || "structure");
    if (machine === "grower" || machine === "planter") machine = "planterBox";
    if (MACHINES.has(machine)) return machine;
    return String(r.structureType ?? machine);
}

function mapOut(arr: unknown): { elementType: unknown; chance: number }[] {
    if (!Array.isArray(arr)) return [];
    return arr
        .filter((o) => o && typeof o === "object")
        .map((o: any) => ({
            elementType: resolveElementRef(o.elementType),
            chance: typeof o.chance === "number" ? o.chance : 1,
        }));
}

function resolveBody(r: RecipeConfig, machine: string): Record<string, unknown> {
    const body: Record<string, unknown> = { ...r };
    delete body.id;
    delete body.kind;
    delete body.structureType;
    delete body.structureId;
    delete body.chance;

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

export function registerRecipes({ config }: RegisterContext): number {
    return registerEach(config.recipes, "recipes", (r) => {
        const machine = machineOf(r);
        if (!MACHINES.has(machine)) {
            console.warn(
                `${LOG} recipe ${r.id}: "${r.kind}" is not a supported machine id ` +
                    `(use one of: ${[...MACHINES].join(", ")})`,
            );
            return;
        }
        api.structures.recipes.register(machine, resolveBody(r, machine));
    });
}