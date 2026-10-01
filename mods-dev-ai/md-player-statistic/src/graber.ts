import { api, safe } from "@sandmd/ui";
import { bumpKpi } from "./buffer.ts";
import { GRABBER_ITEM_ID, LOG } from "./constants.ts";

/**
 * Grabber tracking — how many times the grabber was used, and what it picked
 * up, broken down by resource.
 *
 * ## There is no grabber event and no grabber hook
 *
 * `api.hooks` has no grabber id (the full list is building / projectile /
 * input / player / progression / teleport / vacuum hooks). `item:use` — the
 * obvious candidate — is emitted from the **ability/use-definition** resolver:
 *
 * ```js
 * const f = { itemId: t.id, useId: i, kind: o.kind, baseline: c, prepared: u };
 * ```
 *
 * `o.kind` is `"instant" | "sustained" | "chargeThenFire"`, so it only fires for
 * items that declare *uses* — abilities with an energy cost. The grabber is a
 * plain tool with `energyCost: 0` and no use definition, which is why an
 * `itemIds: ["grabber"]` filter alone records nothing.
 *
 * ## Three independent signals, debounced together
 *
 * A use is recorded if **any** of these fires:
 *
 * | Signal                             | Mechanism                              |
 * | ---------------------------------- | -------------------------------------- |
 * | `action:start` hook                | fires when the grabber action begins   |
 * | `item:use` hook                    | kept in case a build adds a use def    |
 * | `api.tools.grabber.isLoaded()` poll | rises when the grabber holds a selection |
 *
 * The first two can both fire for one grab, and the poll can catch the same
 * grab again, so every signal funnels through `noteGrabberUse()`, which
 * **debounces within {@link USE_DEBOUNCE_MS}**. One grab counts once however
 * many signals saw it, while a burst of real grabs still counts each.
 *
 * Collection attribution uses a **latched held-tool state**, not a short time
 * window — see `isGrabberHeld`. An earlier version gated on "a grab happened in
 * the last 1.5s", which dropped every collection landing outside that window and
 * left `graber_elements` at 0 while `graber_uses` counted fine.
 */

/** One grab must not be counted twice by two different signals. */
const USE_DEBOUNCE_MS = 350;

/** `isLoaded()` poll cadence. */
const POLL_MS = 400;

let lastUseAt = 0;
let wasLoaded = false;
let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * How long a grabber "held" latch survives without a refresh. Generous,
 * because it only exists to stop the latch sticking after the mod loses track
 * of the tool; it is not the attribution window.
 */
const HELD_LATCH_MS = 30_000;

let grabberHeldAt = 0;

/**
 * True while the grabber is the tool in use.
 *
 * This is a **latched state**, not a short window. An earlier version gated
 * collection on "a grab happened in the last 1.5s", which silently dropped
 * every collection that landed outside that window — and `graber_elements`
 * stayed at 0 even though `graber_uses` counted fine. The latch is set by
 * `action:start` (which reliably fires with the real tool id) and cleared when
 * a *different* action starts, so collection no longer depends on whether the
 * collection happens before or after the use was counted.
 */
function isGrabberHeld(): boolean {
    return Date.now() - grabberHeldAt <= HELD_LATCH_MS;
}

/** Record the tool the player switched to; clears the latch if it is not the grabber. */
function noteHeldTool(toolId: string): void {
    if (toolId === GRABBER_ITEM_ID) {
        grabberHeldAt = Date.now();
    } else if (grabberHeldAt !== 0) {
        grabberHeldAt = 0;
    }
}

/**
 * Record one grabber use and open the attribution window.
 *
 * Debounced, so two signals reporting the same grab within
 * {@link USE_DEBOUNCE_MS} collapse into a single count.
 */
export function noteGrabberUse(): void {
    const now = Date.now();
    if (now - lastUseAt < USE_DEBOUNCE_MS) return;
    lastUseAt = now;
    // A detected use is itself evidence the grabber is in use, so arm the
    // held-tool latch here. Without this a grab seen only by the isLoaded()
    // poll counted towards graber_uses but left the latch closed, dropping
    // every collection in that grab and leaving graber_elements at 0.
    grabberHeldAt = now;
    bumpKpi("graber_uses");
}

/**
 * Sub-key for one collected resource. Includes `sourceKind` so terrain and
 * structure pickups of the same resource id do not merge into a single row.
 */
export function grabberResourceKey(resourceId: string, sourceKind: string): string {
    return sourceKind ? `${resourceId} (${sourceKind})` : resourceId;
}

/** Record one grabber collection. */
export function recordGrabberCollection(
    resourceId: string,
    amount: number,
    sourceKind = "",
): void {
    bumpKpi("graber_resources", grabberResourceKey(resourceId, sourceKind), amount);
}

/**
 * Name the thing actually standing in a cell at the moment of collection.
 *
 * `resource:collection:prepare` fires **before** the collection is committed,
 * which is the only point where the cell still holds the element — after
 * `resource:collected` the cell is already cleared and there is nothing left to
 * read. `sourceKind` says which lookup applies: a structure grab has no
 * element, so terrain/element lookup is skipped.
 */
function describeCell(
    cellX: unknown,
    cellY: unknown,
    sourceKind: string,
): string | null {
    if (sourceKind === "structure") return "structure";
    if (typeof cellX !== "number" || typeof cellY !== "number") return null;

    const elType = safe(() => api.elements?.getTypeAtCell?.(cellX, cellY));
    if (typeof elType === "number" && elType >= 0) {
        const elId = safe(() => api.elements?.getIdByType?.(elType));
        if (elId) return String(elId);
    }

    const terrainType = safe(() => api.terrains?.getTypeAtCell?.(cellX, cellY));
    if (typeof terrainType === "number" && terrainType >= 0) {
        const tId = safe(() => api.terrains?.getIdByType?.(terrainType));
        if (tId) return String(tId);
    }

    return sourceKind || null;
}

// —— Element pre-cache ——
//
// `resource:collection:prepare` is **not** on the grabber's path. The scraped
// `jojo5.quickgrab` patches show the grabber filling its own slot matrix
// directly (`matrix[b + 2]` occupancy, `shared.sim.elementData.type[...]` for
// the element, terrain type otherwise) — that `prepare` hook lives in the
// `resource:collection` helper the *vacuum* uses. So the only grabber signal is
// `resource:collected`, and by then the cell is already emptied, which is why
// `graber_elements` stayed at 0.
//
// So the element is read **before** it disappears: while the grabber is held, a
// slow tick snapshots the element in a bounded window around the cursor (the
// grabber grabs under the cursor), and the collection event resolves from that
// snapshot. Only documented APIs are used — `input.getMouseCellPosition`,
// `tools.grabber.getSize`, `elements.getTypeAtCell`.

const CACHE_TICK_MS = 200;
/** Side of the square snapshotted around the cursor, regardless of brush size. */
const CACHE_SIDE = 13;
/** Hard cap on cached cells so a large brush cannot grow the map without bound. */
const CACHE_MAX_CELLS = 400;

const elementCache = new Map<string, string>();
let cacheTimer: ReturnType<typeof setInterval> | null = null;

function cellKey(x: number, y: number): string {
    return `${x},${y}`;
}

/** Snapshot the element id around the cursor while the grabber is held. */
function tickElementCache(): void {
    const cursor = safe(() =>
        api.input?.getMouseCellPosition?.() as
            | { x?: number; y?: number }
            | undefined
    );
    const cx = cursor?.x;
    const cy = cursor?.y;
    if (typeof cx !== "number" || typeof cy !== "number") return;

    const half = Math.floor(CACHE_SIDE / 2);
    let n = 0;
    for (let dy = -half; dy <= half && n < CACHE_MAX_CELLS; dy++) {
        for (let dx = -half; dx <= half && n < CACHE_MAX_CELLS; dx++) {
            const x = cx + dx;
            const y = cy + dy;
            const key = cellKey(x, y);
            const elType = safe(() => api.elements?.getTypeAtCell?.(x, y));
            if (typeof elType === "number" && elType >= 0) {
                const id = safe(() => api.elements?.getIdByType?.(elType));
                if (id) {
                    elementCache.set(key, String(id));
                    n++;
                    continue;
                }
            }
            const terrainType = safe(() => api.terrains?.getTypeAtCell?.(x, y));
            if (typeof terrainType === "number" && terrainType >= 0) {
                const id = safe(() => api.terrains?.getIdByType?.(terrainType));
                if (id) {
                    elementCache.set(key, String(id));
                    n++;
                }
            }
        }
    }
}

function startElementCache(): void {
    stopElementCache();
    cacheTimer = setInterval(() => {
        if (!isGrabberHeld()) {
            elementCache.clear();
            return;
        }
        tickElementCache();
    }, CACHE_TICK_MS);
}

function stopElementCache(): void {
    if (cacheTimer != null) {
        clearInterval(cacheTimer);
        cacheTimer = null;
    }
    elementCache.clear();
}

/** Element id cached for a cell, if the grabber was over it recently. */
function cachedElement(cellX: unknown, cellY: unknown): string | null {
    if (typeof cellX !== "number" || typeof cellY !== "number") return null;
    return elementCache.get(cellKey(cellX, cellY)) ?? null;
}

/** Record what was physically grabbed: element id plus amount. */
export function recordGrabbedElement(label: string, amount: number): void {
    bumpKpi("graber_elements", label, amount);
}

// —— Vacuum ——
//
// The vacuum has its own dedicated hooks, so unlike the grabber it needs no
// polling and no attribution window.
//
// - `vacuum:prepare` fires **once per activation** and carries the head
//   `pattern`, so it yields both a use count and the head size in cells.
// - `vacuum:element:prepare` fires **per element considered**, which is far too
//   frequent to count raw (same problem as the collision hook), so it is not
//   used.

const VACUUM_DEBOUNCE_MS = 250;
let lastVacuumAt = 0;

/** Cells covered by the vacuum head from its `pattern` matrix. */
function patternCells(pattern: unknown): number {
    if (!Array.isArray(pattern)) return 0;
    let n = 0;
    for (const row of pattern) if (Array.isArray(row)) n += row.length;
    return n;
}

/** Record one vacuum activation and the head size it fired with. */
export function noteVacuumUse(cells: number): void {
    const now = Date.now();
    if (now - lastVacuumAt < VACUUM_DEBOUNCE_MS) return;
    lastVacuumAt = now;
    bumpKpi("vacuum_uses");
    if (cells > 0) bumpKpi("vacuum_cells", null, cells);
}

/**
 * Poll `grabber.isLoaded()`. The grabber holds a selection between grabbing and
 * depositing, so the rising edge is a grab. This is the one signal backed by a
 * documented API rather than a hook, so it is the safety net for the other two.
 */
function startLoadedPoll(): void {
    stopLoadedPoll();
    wasLoaded = safe(() => api.tools?.grabber?.isLoaded?.() === true, false) === true;
    pollTimer = setInterval(() => {
        const loaded = safe(
            () => api.tools?.grabber?.isLoaded?.() === true,
            false,
        ) === true;
        if (loaded && !wasLoaded) {
            noteGrabberUse();
        } else if (
            // Arm the latch from `isActive()` too, without counting a use. This
            // warms the element cache while the tool is merely held, so the
            // *first* grab of a session has its cells snapshotted — otherwise
            // the cache only fills after the first use, which is too late for it.
            safe(() => api.tools?.grabber?.isActive?.() === true, false) === true
        ) {
            grabberHeldAt = Date.now();
        }
        wasLoaded = loaded;
    }, POLL_MS);
}

function stopLoadedPoll(): void {
    if (pollTimer != null) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
    wasLoaded = false;
}

/**
 * Wire grabber tracking.
 *
 * `on` is the mod's event binder; `bindHook` tracks an `api.hooks.*`
 * unsubscribe so hooks are released alongside the event listeners on disable.
 */
export function bindGrabber(
    on: (event: string, cb: (p: any) => void) => void,
    bindHook: (unsub: () => void) => void,
): void {
    // 1. Action start — the primary hook signal for a tool use.
    const actionStartUnsub = safe(() =>
        api.hooks?.intercept?.("action:start", (args: any) => {
            const id = String(args?.action?.id ?? "");
            noteHeldTool(id);
            if (id === GRABBER_ITEM_ID) noteGrabberUse();
        })
    );
    if (typeof actionStartUnsub === "function") bindHook(actionStartUnsub as () => void);

    // 2. Item use — inert today (see the header note) but correct if a build
    //    ever gives the grabber a use definition.
    const itemUseUnsub = safe(() =>
        api.hooks?.intercept?.(
            "item:use",
            (args: any) => {
                const id = String(args?.itemId ?? "");
                noteHeldTool(id);
                if (id === GRABBER_ITEM_ID) noteGrabberUse();
            },
            { itemIds: [GRABBER_ITEM_ID], priority: 0 },
        )
    );
    if (typeof itemUseUnsub === "function") bindHook(itemUseUnsub as () => void);

    // 3. Snapshot the element under the cursor while the grabber is held, so the
    //    `resource:collected` event can resolve it — the cell is already empty
    //    by the time that event fires.
    startElementCache();

    // 4. Which resource the engine credited, plus the element it came from.
    on("resource:collected", (p) => {
        if (!isGrabberHeld()) return; // grabber is not the tool in use
        const id = String(p?.resourceId ?? "unknown");
        const amount = typeof p?.amount === "number" && p.amount > 0 ? p.amount : 1;
        const sourceKind = typeof p?.sourceKind === "string" ? p.sourceKind : "";
        recordGrabberCollection(id, amount, sourceKind);

        // Cache first, then the live cell (a collection can resolve either way),
        // then the resourceId — never drop the row silently.
        const label = cachedElement(p?.cellX, p?.cellY) ??
            describeCell(p?.cellX, p?.cellY, sourceKind) ??
            (p?.resourceId ? String(p.resourceId) : null);
        if (label) recordGrabbedElement(label, amount);
    });

    // 4. Vacuum: one `vacuum:prepare` per activation, plus the head size.
    const vacuumHook = safe(() =>
        api.hooks?.modify?.("vacuum:prepare", (args: any) => {
            noteVacuumUse(patternCells(args?.pattern));
        })
    );
    if (typeof vacuumHook === "function") bindHook(vacuumHook as () => void);

    // 5. Poll the documented `isLoaded()` state — the guaranteed grabber signal.
    startLoadedPoll();

    console.log(
        `${LOG} grabber tracking bound (action:start=${
            typeof actionStartUnsub === "function" ? "on" : "off"
        }, item:use=${typeof itemUseUnsub === "function" ? "on" : "off"}, ` +
            `elementCache=on, vacuum=${typeof vacuumHook === "function" ? "on" : "off"}, ` +
            `isLoaded poll=on)`,
    );
}

/** Release the grabber poll and cache alongside the mod's other teardown. */
export function unbindGrabber(): void {
    stopLoadedPoll();
    stopElementCache();
}
