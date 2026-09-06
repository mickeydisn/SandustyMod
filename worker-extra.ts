/**
 * Astro Life — worker-side runtime.
 *
 * A discrete adaptation of Particle Life (https://sandbox-science.com/particle-life)
 * for a grid-based falling-sand engine: no floating point per cell, no
 * vectors, movement only ever a run of adjacent-cell swaps. See README.md
 * for the full derivation of every design choice below — this file is the
 * runtime, not the explanation.
 *
 * Integration: see `registerLifeSeedDispatch` at the bottom. Call it once
 * at worker startup, alongside this mod's existing seed dispatch hook.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// -----------------------------------------------------------------------------
// Ambient SDK surface. This mod's real source almost certainly already
// declares `sandkit` globally (the existing bundle references it freely) —
// delete this line if so. Kept here only so this file type-checks standalone.
// -----------------------------------------------------------------------------
declare const sandkit: any;

export const MOD_ID = "astro.seeds";

/** Element ids for the shipped Life Seed colors, in attraction-matrix order. */
export const LIFE_SEED_IDS = [
	`${MOD_ID}:life-seed-ruby`,
	`${MOD_ID}:life-seed-sapphire`,
	`${MOD_ID}:life-seed-emerald`,
	`${MOD_ID}:life-seed-topaz`,
] as const;

/** Index into LIFE_SEED_IDS / the attraction matrix. */
export type LifeColorIndex = number;

// =============================================================================
// Grid primitives
// =============================================================================
// Kept local and minimal rather than importing this mod's existing `Grid`
// module, since this file is meant to be gradually merged into the real
// source tree — swap these for the real `Grid.isType` / `Grid.isEmpty` /
// `Grid.read` / `Grid.write` / `Grid.swapInto` once wired in; the
// signatures below intentionally mirror them.

function isTypeAt(x: number, y: number, t: number | null): boolean {
	if (t == null) return false;
	try {
		return sandkit.api.elements.isTypeAtCell(x, y, t) === true;
	} catch {
		return false;
	}
}

function isEmptyAt(x: number, y: number): boolean {
	try {
		if (typeof sandkit.api.world?.isCellEmptyAtCell === "function") {
			return sandkit.api.world.isCellEmptyAtCell(x, y) === true;
		}
	} catch {
		/* fall through to element-based check */
	}
	try {
		const t = sandkit.api.elements.getTypeAtCell(x, y);
		return t == null || t === 0;
	} catch {
		return false;
	}
}

function readField(x: number, y: number, field: number): number {
	try {
		const v = sandkit.api.elements.getDataFieldAtCell(x, y, field);
		return typeof v === "number" && v >= 0 ? v : 0;
	} catch {
		return 0;
	}
}

function writeField(x: number, y: number, field: number, value: number): void {
	try {
		sandkit.api.elements.setDataFieldAtCell(x, y, field, value);
	} catch {
		/* best-effort; a missed write just costs one tick of momentum */
	}
}

function swapAdjacent(x: number, y: number, nx: number, ny: number): { x: number; y: number } | null {
	try {
		if (sandkit.api.elements.swapCells?.(x, y, nx, ny) === true) return { x: nx, y: ny };
	} catch {
		/* try the fallback below */
	}
	try {
		if (sandkit.api.elements.moveBetweenCells?.(x, y, nx, ny) === true) return { x: nx, y: ny };
	} catch {
		/* give up — caller stops the step loop */
	}
	return null;
}

function resolveType(id: string): number | null {
	try {
		const t = sandkit.api.elements.getTypeFromId(id);
		return typeof t === "number" ? t : null;
	} catch {
		return null;
	}
}

function clamp(v: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, v));
}

// =============================================================================
// Momentum — discrete stand-in for velocity + friction (README §3)
// =============================================================================
// Reuses this mod's existing ASTRO_FIELD.VX (2) / VY (3) — declared in the
// current source but never written to anywhere. Each field holds the
// PREVIOUS tick's chosen step on that axis, one of {-1, 0, 1}, stored
// offset by +1 (0, 1, 2) so it fits the unsigned data-field range.

const FIELD_VX = 2;
const FIELD_VY = 3;

interface Momentum {
	readonly dx: -1 | 0 | 1;
	readonly dy: -1 | 0 | 1;
}

function readMomentum(x: number, y: number): Momentum {
	const dx = clamp(readField(x, y, FIELD_VX) - 1, -1, 1) as -1 | 0 | 1;
	const dy = clamp(readField(x, y, FIELD_VY) - 1, -1, 1) as -1 | 0 | 1;
	return { dx, dy };
}

function writeMomentum(x: number, y: number, dx: number, dy: number): void {
	writeField(x, y, FIELD_VX, clamp(dx, -1, 1) + 1);
	writeField(x, y, FIELD_VY, clamp(dy, -1, 1) + 1);
}

// =============================================================================
// The 8 compass headings
// =============================================================================

export interface Heading {
	readonly name: string;
	readonly dx: -1 | 0 | 1;
	readonly dy: -1 | 0 | 1;
}

export const HEADINGS: readonly Heading[] = [
	{ name: "N", dx: 0, dy: -1 },
	{ name: "NE", dx: 1, dy: -1 },
	{ name: "E", dx: 1, dy: 0 },
	{ name: "SE", dx: 1, dy: 1 },
	{ name: "S", dx: 0, dy: 1 },
	{ name: "SW", dx: -1, dy: 1 },
	{ name: "W", dx: -1, dy: 0 },
	{ name: "NW", dx: -1, dy: -1 },
];

const CARDINAL_HEADINGS: readonly Heading[] = HEADINGS.filter((h) => h.dx === 0 || h.dy === 0);

// =============================================================================
// Attraction matrix + config
// =============================================================================

export interface LifeMatrixConfig {
	/** typeIds[i] is the resolved numeric element type for color index i (null if that color's element failed to register). */
	typeIds: (number | null)[];
	/** weights[i][j]: how strongly color i is attracted (+) or repelled (-) by color j. Roughly -100..100 by convention, unbounded in practice. */
	weights: number[][];
	/** How many cells out a direction probe looks before giving up. */
	rangeN: number;
	/** How many adjacent-cell swaps to commit once a direction wins, per tick. */
	maxK: number;
	/** Flat score bonus for continuing the same heading as last tick; penalty for reversing it. 0 disables momentum. */
	momentumBonus: number;
	/** Survey all 8 headings, or just the 4 cardinal ones (cheaper, blockier motion). */
	diagonals: boolean;
}

export const DEFAULT_LIFE_MATRIX: number[][] = [
	// Ruby  Sapphire Emerald  Topaz
	[-20, 70, 10, -60], // Ruby
	[-60, -20, 70, 10], // Sapphire
	[10, -60, -20, 70], // Emerald
	[70, 10, -60, -20], // Topaz
];

const DEFAULT_CONFIG: Omit<LifeMatrixConfig, "typeIds"> = {
	weights: DEFAULT_LIFE_MATRIX,
	rangeN: 8,
	maxK: 2,
	momentumBonus: 15,
	diagonals: true,
};

interface RawLifeMatrixJson {
	weights?: unknown;
	rangeN?: unknown;
	maxK?: unknown;
	momentumBonus?: unknown;
	diagonals?: unknown;
}

function isValidWeightMatrix(v: unknown, size: number): v is number[][] {
	if (!Array.isArray(v) || v.length !== size) return false;
	return v.every((row) => Array.isArray(row) && row.length === size && row.every((n) => typeof n === "number" && Number.isFinite(n)));
}

let cachedCounter = -1;
let cachedConfig: LifeMatrixConfig | null = null;

/**
 * Reads `{ lifeMatrix: {...} }` out of the SAME shared JSON buffer this mod
 * already uses for columnForce config (`astroJson`), keyed off the SAME
 * change counter for cache invalidation — see README §6. Pass this mod's
 * real helpers for the two callbacks; nothing here allocates a new buffer.
 */
export function lifeMatrixConfig(readSharedJson: () => string, changeCounter: () => number): LifeMatrixConfig {
	const counter = changeCounter();
	if (counter === cachedCounter && cachedConfig) return cachedConfig;
	cachedCounter = counter;

	const typeIds = LIFE_SEED_IDS.map((id) => resolveType(id));

	let raw: RawLifeMatrixJson = {};
	try {
		const text = readSharedJson();
		if (text) {
			const obj = JSON.parse(text);
			if (obj && typeof obj === "object" && obj.lifeMatrix && typeof obj.lifeMatrix === "object") {
				raw = obj.lifeMatrix as RawLifeMatrixJson;
			}
		}
	} catch {
		/* malformed config — fall back to defaults below, don't throw into the sim loop */
	}

	const weights = isValidWeightMatrix(raw.weights, typeIds.length) ? raw.weights : DEFAULT_CONFIG.weights;

	cachedConfig = {
		typeIds,
		weights,
		rangeN: typeof raw.rangeN === "number" ? Math.max(1, raw.rangeN) : DEFAULT_CONFIG.rangeN,
		maxK: typeof raw.maxK === "number" ? Math.max(0, raw.maxK) : DEFAULT_CONFIG.maxK,
		momentumBonus: typeof raw.momentumBonus === "number" ? Math.max(0, raw.momentumBonus) : DEFAULT_CONFIG.momentumBonus,
		diagonals: typeof raw.diagonals === "boolean" ? raw.diagonals : DEFAULT_CONFIG.diagonals,
	};
	return cachedConfig;
}

// =============================================================================
// The core algorithm — see README §3 for why each step exists.
// =============================================================================

interface ProbeHit {
	readonly colorIndex: LifeColorIndex;
	readonly dist: number;
}

interface DirectionScore {
	readonly heading: Heading;
	readonly score: number;
}

/**
 * Distance weight for a hit `dist` cells away within a probe of length
 * `rangeN`. Linear and integer-only — the discrete stand-in for Particle
 * Life's tent-shaped force curve (README §3): closer counts for more,
 * nothing beyond rangeN counts at all.
 */
export function weightForDistance(dist: number, rangeN: number): number {
	return Math.max(0, rangeN - dist + 1);
}

/**
 * One line-of-sight probe: walk `heading` out to `rangeN` cells and return
 * the first life-seed cell found (any color), or null if the ray hits
 * something else first (blocked) or runs out of range.
 */
function probeHeading(x: number, y: number, heading: Heading, rangeN: number, typeIds: (number | null)[]): ProbeHit | null {
	for (let dist = 1; dist <= rangeN; dist++) {
		const px = x + heading.dx * dist;
		const py = y + heading.dy * dist;
		if (isEmptyAt(px, py)) continue; // keep looking past open space
		for (let c = 0; c < typeIds.length; c++) {
			if (isTypeAt(px, py, typeIds[c])) return { colorIndex: c, dist };
		}
		return null; // hit something that isn't a life seed — ray blocked here
	}
	return null;
}

/** Scores every heading for this seed; returns the best one, or null if nothing beats zero. */
function chooseHeading(x: number, y: number, myColor: LifeColorIndex, cfg: LifeMatrixConfig, momentum: Momentum): DirectionScore | null {
	const headings = cfg.diagonals ? HEADINGS : CARDINAL_HEADINGS;
	let best: DirectionScore | null = null;

	for (const heading of headings) {
		const hit = probeHeading(x, y, heading, cfg.rangeN, cfg.typeIds);
		let score = 0;

		if (hit) {
			const weight = weightForDistance(hit.dist, cfg.rangeN);
			const affinity = cfg.weights[myColor]?.[hit.colorIndex] ?? 0;
			score = affinity * weight;
		}

		if (cfg.momentumBonus > 0 && (momentum.dx || momentum.dy)) {
			if (heading.dx === momentum.dx && heading.dy === momentum.dy) {
				score += cfg.momentumBonus;
			} else if (heading.dx === -momentum.dx && heading.dy === -momentum.dy) {
				score -= cfg.momentumBonus;
			}
		}

		if (!best || score > best.score) best = { heading, score };
	}

	return best && best.score > 0 ? best : null;
}

/**
 * Runs one tick of Particle Life for a single seed cell: pick the
 * best-scoring heading, commit up to `maxK` adjacent-cell swaps that way,
 * update momentum. Call this from a per-tick dispatch hook — see
 * `registerLifeSeedDispatch` below.
 */
export function stepLifeSeed(x: number, y: number, myColor: LifeColorIndex, cfg: LifeMatrixConfig): void {
	if (cfg.typeIds.length === 0) return;

	const momentum = readMomentum(x, y);
	const choice = chooseHeading(x, y, myColor, cfg, momentum);
	if (!choice) {
		writeMomentum(x, y, 0, 0);
		return;
	}

	let cx = x;
	let cy = y;
	let steps = 0;
	while (steps < cfg.maxK) {
		const nx = cx + choice.heading.dx;
		const ny = cy + choice.heading.dy;
		// A non-empty destination is the hard-core repulsion term, for
		// free — two solid cells can't occupy the same space, so the
		// engine's own physics stops the collapse Particle Life has to
		// hand-code (README §3).
		if (!isEmptyAt(nx, ny)) break;
		const moved = swapAdjacent(cx, cy, nx, ny);
		if (!moved) break;
		cx = moved.x;
		cy = moved.y;
		steps++;
	}

	writeMomentum(cx, cy, choice.heading.dx, choice.heading.dy);
	if (cx !== x || cy !== y) writeMomentum(x, y, 0, 0); // old cell no longer holds this seed
}

// =============================================================================
// Dispatch registration
// =============================================================================

export interface RegisterLifeSeedDispatchOptions {
	/** Reads the raw JSON string out of the astroJson shared buffer. */
	readSharedJson: () => string;
	/** Reads the change-counter slot used to invalidate the matrix cache. */
	changeCounter: () => number;
}

/**
 * Registers one `element:update` interceptor per resolved life-seed color.
 * Deliberately mirrors this mod's OWN existing `dispatchSeed` pattern
 * (element:update + setPhysicsAtCell + cancel) rather than `element:moved`:
 * a resting seed that chose to stay put last tick still needs to
 * re-evaluate every tick — an orbiting cluster has to keep recomputing
 * even between individual cell moves, or it would freeze the instant it
 * stops moving for one tick. `element:moved` alone can't do that; this
 * mod already solved exactly that problem for the main astro-seed pipeline,
 * so this file reuses the same solution rather than reinventing a weaker one.
 */
export function registerLifeSeedDispatch(opts: RegisterLifeSeedDispatchOptions): void {
	const typeIds = LIFE_SEED_IDS.map((id) => resolveType(id));

	typeIds.forEach((type, colorIndex) => {
		if (type == null) {
			console.warn(`[${MOD_ID}] life seed color ${colorIndex} (${LIFE_SEED_IDS[colorIndex]}) not registered — skipping dispatch`);
			return;
		}
		try {
			sandkit.api.hooks.intercept(
				"element:update",
				(payload: { x: number; y: number; elementType: number }, cancel: { cancel: () => void }) => {
					try {
						if (payload.elementType !== type) return false;
						sandkit.api.elements.setPhysicsAtCell(payload.x, payload.y, 1);
						cancel.cancel();
						const cfg = lifeMatrixConfig(opts.readSharedJson, opts.changeCounter);
						stepLifeSeed(payload.x, payload.y, colorIndex, cfg);
						return true;
					} catch (e) {
						console.error(`[${MOD_ID}] life seed element:update handler failed:`, e);
						return false;
					}
				},
				{ guard: { elementType: type } },
			);
			console.log(`[${MOD_ID}] life seed dispatch ok for color ${colorIndex} (${LIFE_SEED_IDS[colorIndex]})`);
		} catch (e) {
			console.error(`[${MOD_ID}] life seed dispatch registration failed for color ${colorIndex}:`, e);
		}
	});
}
