/**
 * Astro Life — main-thread runtime.
 *
 * Registers the four Life Seed elements and an editable attraction-matrix
 * panel section. See README.md for the algorithm; see worker-extra.ts for
 * the simulation this configures.
 *
 * Integration: call `registerLifeSeedElements()` once alongside this mod's
 * existing element registration, and `mountLifeMatrixPanel()` once
 * alongside the existing `mountPanel()` call.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// -----------------------------------------------------------------------------
// Ambient SDK surface — see the matching note in worker-extra.ts. Delete if
// your project already declares these globally.
// -----------------------------------------------------------------------------
declare const sandkit: any;

import { LIFE_SEED_IDS, DEFAULT_LIFE_MATRIX } from "./worker-extra";

const MOD_ID = "astro.seeds";

function safe<T>(fn: () => T, fallback: T | null = null): T | null {
	try {
		return fn();
	} catch {
		return fallback;
	}
}

// =============================================================================
// Element registration
// =============================================================================

interface LifeColorDef {
	readonly id: string;
	readonly name: string;
	/** Approximate RGB, used both for the element's own color and its panel swatch. */
	readonly rgb: readonly [number, number, number];
}

export const LIFE_COLORS: readonly LifeColorDef[] = [
	{ id: LIFE_SEED_IDS[0], name: "Ruby", rgb: [220, 50, 70] },
	{ id: LIFE_SEED_IDS[1], name: "Sapphire", rgb: [60, 110, 230] },
	{ id: LIFE_SEED_IDS[2], name: "Emerald", rgb: [60, 200, 110] },
	{ id: LIFE_SEED_IDS[3], name: "Topaz", rgb: [230, 180, 50] },
];

/**
 * Registers the four Life Seed elements. Matter type Powder, density 0 —
 * the SAME choice this mod already made for astroCopperCrystal (switched
 * from Static to Solid/density-0 specifically so `swapCells` works
 * reliably; see that element's own history). Static elements generally
 * can't be moved by `swapCells` at all, which would break the whole
 * simulation, and any nonzero density lets gravity dominate over the
 * attraction forces — density 0 keeps gravity's pull minimal so the
 * matrix, not the floor, decides where a swarm ends up.
 */
export function registerLifeSeedElements(): void {
	const MatterType = safe(() => sandkit.enums?.MatterType) ?? {};
	const MT_POWDER = MatterType.Powder ?? 8;

	for (const color of LIFE_COLORS) {
		const nameKey = `${color.id}|name`;
		const descriptionKey = `${color.id}|description`;

		safe(() =>
			sandkit.api.i18n.register("en", {
				[nameKey]: `${color.name} Life Seed`,
				[descriptionKey]: `A ${color.name.toLowerCase()} mote — part of the Astro Life particle swarm. Reacts to every other Life Seed color per the attraction matrix (Alt+A panel).`,
			}),
		);

		const [r, g, b] = color.rgb;
		const result = safe(() =>
			sandkit.api.elements.register({
				id: color.id,
				nameKey,
				descriptionKey,
				colors: {
					variants: [
						[r, g, b],
						[Math.max(0, r - 25), Math.max(0, g - 25), Math.max(0, b - 25)],
						[Math.min(255, r + 20), Math.min(255, g + 20), Math.min(255, b + 20)],
					],
				},
				density: 0,
				metaColor: (r << 16) | (g << 8) | b,
				matterType: MT_POWDER,
			}),
		);

		if (!result) {
			console.error(`[${MOD_ID}] life seed "${color.id}" failed to register`);
			continue;
		}

		safe(() => sandkit.api.discoveries.addElementByType((result as { elementType: number }).elementType));
	}
}

// =============================================================================
// Shared JSON config — reuses the astroJson buffer this mod already creates
// for columnForce, plus the astroConfig uint16 buffer's change-counter slot.
// =============================================================================

const JSON_BUF_LENGTH = 2048;
const JSON_COUNTER_INDEX = 7;

export interface LifeMatrixState {
	weights: number[][];
	rangeN: number;
	maxK: number;
	momentumBonus: number;
	diagonals: boolean;
}

const state: LifeMatrixState = {
	weights: DEFAULT_LIFE_MATRIX.map((row) => [...row]),
	rangeN: 8,
	maxK: 2,
	momentumBonus: 15,
	diagonals: true,
};

let cfgBuf: Uint16Array | null = null;
let jsonBuf: Uint8Array | null = null;

/**
 * Call once at main-thread startup, AFTER this mod's own `astroConfig` /
 * `astroJson` buffers exist (it re-requires the same buffers rather than
 * creating them, so ordering only matters relative to whichever file
 * creates them first).
 */
export function bindLifeMatrixBuffers(existingCfgBuf: Uint16Array | null, existingJsonBuf: Uint8Array | null): void {
	cfgBuf = existingCfgBuf;
	jsonBuf = existingJsonBuf;
}

function readJsonBuffer(): string {
	if (!jsonBuf) return "";
	try {
		const end = jsonBuf.indexOf(0);
		const bytes = jsonBuf.slice(0, end === -1 ? jsonBuf.length : end);
		return new TextDecoder().decode(bytes);
	} catch (e) {
		console.error(`[${MOD_ID}] readJsonBuffer failed:`, e);
		return "";
	}
}

/**
 * Merges `{ lifeMatrix: state }` into whatever's already in the JSON
 * buffer (preserving an existing `columnForce` key rather than clobbering
 * it) and bumps the change counter so the worker's cache invalidates.
 */
function writeLifeMatrixJson(): void {
	if (!jsonBuf) {
		console.warn(`[${MOD_ID}] astroJson buffer unavailable — life matrix not persisted`);
		return;
	}
	let existing: Record<string, unknown> = {};
	try {
		const raw = readJsonBuffer();
		if (raw) existing = JSON.parse(raw);
	} catch {
		existing = {};
	}

	const merged = { ...existing, lifeMatrix: state };
	const text = JSON.stringify(merged);
	const bytes = new TextEncoder().encode(text);

	if (bytes.length + 1 > JSON_BUF_LENGTH) {
		console.error(`[${MOD_ID}] life matrix JSON too large (${bytes.length} bytes, max ${JSON_BUF_LENGTH - 1})`);
		return;
	}

	jsonBuf.fill(0);
	jsonBuf.set(bytes, 0);

	if (cfgBuf) {
		cfgBuf[JSON_COUNTER_INDEX] = ((cfgBuf[JSON_COUNTER_INDEX] ?? 0) + 1) % 65535;
	}
}

// =============================================================================
// Panel section
// =============================================================================
// Uses the same `sandkit.react` + `h(...)` primitives the existing panel
// already relies on. Styling here is intentionally plain inline objects —
// swap for this mod's real `toggleStyle` / `btnStyle` / `C` (color/theme)
// helpers when merging into the actual panel component, so this section
// matches the existing look instead of standing out.

const React = safe(() => sandkit.react);
const h = React ? (React as any).createElement : null;

function cellStyle(): Record<string, string> {
	return {
		width: "34px",
		textAlign: "center",
		fontSize: "10px",
		background: "#1a1a1a",
		color: "#ddd",
		border: "1px solid #333",
		borderRadius: "3px",
		padding: "2px 0",
	};
}

function labelStyle(rgb: readonly [number, number, number]): Record<string, string> {
	return {
		fontSize: "10px",
		color: `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`,
		width: "56px",
		textAlign: "right",
		paddingRight: "4px",
	};
}

interface MatrixCellProps {
	rowIndex: number;
	colIndex: number;
	onChange: () => void;
}

function MatrixCell({ rowIndex, colIndex, onChange }: MatrixCellProps) {
	const value = state.weights[rowIndex][colIndex];
	return h(
		"input",
		{
			type: "number",
			value,
			style: cellStyle(),
			onChange: (e: { target: { value: string } }) => {
				const n = Number(e.target.value);
				state.weights[rowIndex][colIndex] = Number.isFinite(n) ? n : 0;
				onChange();
			},
		},
		null,
	);
}

interface KnobStepperProps {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	onChange: (v: number) => void;
}

function KnobStepper({ label, value, min, max, step, onChange }: KnobStepperProps) {
	const apply = (delta: number) => onChange(Math.max(min, Math.min(max, value + delta)));
	return h(
		"div",
		{ style: { display: "flex", gap: "4px", alignItems: "center", marginTop: "4px" } },
		h("span", { style: { flex: 1, color: "#999", fontSize: "10px" } }, label),
		h("button", { style: cellStyle(), onClick: () => apply(-step) }, "\u2212"),
		h("div", { style: { width: "28px", textAlign: "center", fontSize: "10px" } }, String(value)),
		h("button", { style: cellStyle(), onClick: () => apply(step) }, "+"),
	);
}

/** Scatters `count` random-colored life seeds in a rough circle around a world cell. Handy for testing without a full brush UI. */
function sprinkleLifeSeeds(cx: number, cy: number, radius: number, count: number): void {
	const types = LIFE_COLORS.map((c) => safe(() => sandkit.api.elements.getTypeFromId(c.id)));
	for (let i = 0; i < count; i++) {
		const angle = Math.random() * Math.PI * 2;
		const r = Math.random() * radius;
		const x = Math.round(cx + Math.cos(angle) * r);
		const y = Math.round(cy + Math.sin(angle) * r);
		const type = types[Math.floor(Math.random() * types.length)];
		if (type == null) continue;
		safe(() => sandkit.api.elements.createAtCellWhenIdle(x, y, type));
	}
}

function AstroLifePanelSection() {
	const [, bump] = (React as any).useState(0);
	const redraw = () => {
		writeLifeMatrixJson();
		bump((v: number) => v + 1);
	};

	const header = h(
		"div",
		{ style: { display: "flex", marginBottom: "2px" } },
		h("div", { style: { width: "56px" } }),
		...LIFE_COLORS.map((c) => h("div", { style: { ...cellStyle(), border: "none", color: `rgb(${c.rgb.join(",")})` } }, c.name.slice(0, 3))),
	);

	const rows = LIFE_COLORS.map((rowColor, rowIndex) =>
		h(
			"div",
			{ key: rowColor.id, style: { display: "flex", gap: "2px", marginBottom: "2px" } },
			h("div", { style: labelStyle(rowColor.rgb) }, rowColor.name),
			...LIFE_COLORS.map((_c, colIndex) => h(MatrixCell, { rowIndex, colIndex, onChange: redraw })),
		),
	);

	return h(
		"div",
		{ style: { marginTop: "8px", borderTop: "1px solid #333", paddingTop: "6px" } },
		h("div", { style: { fontSize: "11px", color: "#aaa", marginBottom: "4px" } }, "Astro Life \u2014 attraction matrix (row attracted to column)"),
		header,
		...rows,
		h(KnobStepper, {
			label: "Range",
			value: state.rangeN,
			min: 1,
			max: 20,
			step: 1,
			onChange: (v: number) => {
				state.rangeN = v;
				redraw();
			},
		}),
		h(KnobStepper, {
			label: "Step count",
			value: state.maxK,
			min: 0,
			max: 6,
			step: 1,
			onChange: (v: number) => {
				state.maxK = v;
				redraw();
			},
		}),
		h(KnobStepper, {
			label: "Momentum",
			value: state.momentumBonus,
			min: 0,
			max: 100,
			step: 5,
			onChange: (v: number) => {
				state.momentumBonus = v;
				redraw();
			},
		}),
		h(
			"button",
			{
				style: { ...cellStyle(), width: "auto", padding: "4px 8px", marginTop: "6px" },
				onClick: () => {
					const pos = safe(() => sandkit.api.input.getMouseCellPosition());
					if (!pos) return;
					sprinkleLifeSeeds(pos.x, pos.y, 12, 40);
				},
			},
			"Sprinkle 40 seeds at cursor",
		),
	);
}

/**
 * Mounts the Astro Life section as its own panel. Call once. If you'd
 * rather it appear INSIDE the existing Alt+A panel instead of as a
 * separate window, render `AstroLifePanelSection` from within that
 * panel's own component tree instead of calling this.
 */
export function mountLifeMatrixPanel(): void {
	if (!React || !h) {
		console.warn(`[${MOD_ID}] sandkit.react missing — Astro Life panel skipped`);
		return;
	}
	const dispose = safe(() => sandkit.api.ui.inject?.("astro-life-panel", AstroLifePanelSection));
	if (!dispose) console.warn(`[${MOD_ID}] Astro Life panel injection failed`);
}
