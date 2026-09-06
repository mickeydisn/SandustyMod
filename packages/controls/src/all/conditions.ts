import { registerBaseStructure } from "../all/structures.ts";
import type { SignalBus } from "../all/signal-bus.ts";
import type { StructureLike } from "../types.ts";

export type CompareOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "truthy"
  | "falsy";

export interface ConditionRule {
  path: string;
  op: CompareOp;
  value?: unknown;
}

/** Options for a condition tile: it reads a config path each tick and signals the result. */
export interface ConditionOptions {
  modId: string;
  typeId: string;
  name: string;
  record: { getPath(path: string): unknown; sync(): void };
  rule: ConditionRule;
  intervalMs?: number;
  signalBus?: SignalBus;
  spriteId?: string;
}

export function evaluateCondition(
  rule: ConditionRule,
  current: unknown,
): boolean {
  switch (rule.op) {
    case "truthy":
      return Boolean(current) && current !== 0 && current !== "";
    case "falsy":
      return !current || current === 0 || current === "";
    case "eq":
      return current === rule.value;
    case "neq":
      return current !== rule.value;
    case "gt":
      return Number(current) > Number(rule.value);
    case "gte":
      return Number(current) >= Number(rule.value);
    case "lt":
      return Number(current) < Number(rule.value);
    case "lte":
      return Number(current) <= Number(rule.value);
    default:
      return false;
  }
}

/** Register a world tile that compares a config path each tick and emits its signal. */
export function registerConditionTile(options: ConditionOptions): void {
  const typeId = options.typeId;
  const intervalMs = options.intervalMs ?? 120;

  registerBaseStructure({
    id: typeId,
    name: options.name,
    spriteId: options.spriteId ?? typeId,
    description: `Signal on when ${options.rule.path} ${options.rule.op} ${
      String(options.rule.value ?? "")
    }`,
    defaultData: { kind: "condition", path: options.rule.path, signal: false },
  });

  const process = (structure: StructureLike) => {
    options.record.sync();
    const current = options.record.getPath(options.rule.path);
    const on = evaluateCondition(options.rule, current);
    structure.data.signal = on;
    structure.data.value = current;
    options.signalBus?.emit(structure, on);
  };

  if (options.signalBus) {
    options.signalBus.registerProcessing(typeId, intervalMs, process);
  } else {
    sandkit.api.structures.processing.register(typeId, { intervalMs, process });
  }
}
