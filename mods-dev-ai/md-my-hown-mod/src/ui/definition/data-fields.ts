


export type DataFieldValue = number | boolean | string;


export interface ElementDataField {
    
    name: string;
    
    slot: number;
    default: number;
}


export interface StructureDataField {
    key: string;
    type: "number" | "bool" | "string";
    default: DataFieldValue;
}


export const ELEMENT_DATA_SLOTS = 4 as const;


export function elementSlotKey(slot: number): string {
    return `field${slot}`;
}


export interface DataFieldProblem {
    
    row: number;
    reason: string;
}


export function elementFieldsToRecord(
    rows: readonly ElementDataField[],
): { record: Record<string, number>; problems: DataFieldProblem[] } {
    const record: Record<string, number> = {};
    const problems: DataFieldProblem[] = [];
    const seen = new Map<number, string>();

    for (const [row, f] of (rows ?? []).entries()) {
        const label = f.name?.trim() || `slot ${f.slot}`;
        const slot = Number(f.slot);
        if (!Number.isInteger(slot) || slot < 1 || slot > ELEMENT_DATA_SLOTS) {
            problems.push({ row, reason: `slot must be 1–${ELEMENT_DATA_SLOTS}` });
            continue;
        }
        const first = seen.get(slot);
        if (first) {
            
            
            
            problems.push({
                row,
                reason: `slot ${slot} is already used by "${first}" — a slot holds one number`,
            });
            continue;
        }
        const value = Number(f.default);
        if (!Number.isFinite(value)) {
            problems.push({ row, reason: "default must be a number" });
            continue;
        }
        if (!Number.isInteger(value)) {
            
            
            problems.push({ row, reason: "default must be a whole number" });
            continue;
        }
        seen.set(slot, label);
        record[elementSlotKey(slot)] = value;
    }
    return { record, problems };
}


export function elementRecordToFields(raw: unknown): ElementDataField[] {
    if (typeof raw !== "object" || raw === null) return [];
    const out: ElementDataField[] = [];
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        const m = /^field([1-4])$/.exec(key);
        if (!m) continue;
        const n = Number(value);
        out.push({ name: "", slot: Number(m[1]), default: Number.isFinite(n) ? n : 0 });
    }
    return out.sort((a, b) => a.slot - b.slot);
}


export function structureFieldsToRecord(
    rows: readonly StructureDataField[],
): { record: Record<string, DataFieldValue>; problems: DataFieldProblem[] } {
    const record: Record<string, DataFieldValue> = {};
    const problems: DataFieldProblem[] = [];
    for (const [row, f] of (rows ?? []).entries()) {
        const key = f.key?.trim();
        if (!key) {
            problems.push({ row, reason: "a key is required" });
            continue;
        }
        if (key in record) {
            problems.push({ row, reason: `"${key}" is declared twice` });
            continue;
        }
        record[key] = coerceDataValue(f.type, f.default);
    }
    return { record, problems };
}


export function coerceDataValue(
    type: StructureDataField["type"],
    raw: unknown,
): DataFieldValue {
    if (type === "number") {
        const n = Number(raw);
        return Number.isFinite(n) ? n : 0;
    }
    if (type === "bool") {
        if (typeof raw === "string") return raw.trim().toLowerCase() === "true";
        return Boolean(raw);
    }
    return raw == null ? "" : String(raw);
}


export function structureRecordToFields(raw: unknown): StructureDataField[] {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return [];
    const out: StructureDataField[] = [];
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (value !== null && typeof value === "object") continue;
        out.push({
            key,
            type: typeof value === "number"
                ? "number"
                : typeof value === "boolean"
                ? "bool"
                : "string",
            
            
            
            default: (value ?? "") as DataFieldValue,
        });
    }
    return out;
}
