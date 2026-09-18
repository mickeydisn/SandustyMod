/**
 * Channel Pads — placement limit, lifecycle relinking and the step trigger.
 *
 * `building:place` runs before the structure exists, so `count >= 2` is the
 * third attempt. Detection is a 50 ms poll of the player's cell collision.
 */
import { api, channelFromId, channelFromStructure, listChannel, toast } from "./api.ts";
import {
    CHANNELS,
    COOLDOWN_MS,
    KEY,
    LOG,
    MAX_PER_CHANNEL,
    MOD,
    PAD_IDS,
    STEP_INTERVAL_MS,
} from "./constants.ts";
import { relink } from "./pads.ts";
import { runtime } from "./state.ts";
import { nowMs, standingOn, teleportTo } from "./world.ts";
import type { HookContext, PlacedEvent, PlacePayload, RemovedEvent } from "./types.ts";

/** Cancel placement of a third pad on a channel. */
export function registerLimitHook(): void {
    api.hooks.intercept(
        "building:place",
        (payload, ctx: HookContext) => {
            try {
                const p = payload as PlacePayload | null;
                const ch = channelFromId(p?.structureId ?? p?.structureType ?? p?.id);
                if (ch == null) return;
                if (listChannel(ch).length < MAX_PER_CHANNEL) return;
                toast(KEY.toastFull, { channel: ch });
                ctx?.cancel?.();
            } catch (err) {
                console.warn(`${LOG} place intercept`, err);
            }
        },
        { structureTypes: PAD_IDS },
    );
}

/** Relink a channel whenever one of its pads is placed or removed. */
export function registerLifecycle(): void {
    api.events.on("building:placed", (payload) => {
        try {
            const e = payload as PlacedEvent;
            const structure = e?.structure;
            const ch = channelFromStructure(structure) ??
                channelFromId(e?.structureId ?? structure?.type);
            if (ch == null) return;
            relink(ch, "placed");
        } catch (err) {
            console.warn(`${LOG} placed`, err);
        }
    });

    api.events.on("building:removed", (payload) => {
        try {
            const e = payload as RemovedEvent;
            const ch = channelFromId(e?.structureId ?? e?.structure?.type);
            if (ch == null) return;
            relink(ch, "removed");
        } catch (err) {
            console.warn(`${LOG} removed`, err);
        }
    });
}

/**
 * Poll the player's position. After a jump the landing pad is ignored until
 * the player walks off it, then the shared cooldown gates further jumps.
 */
export function registerStep(): void {
    api.triggers.register(`${MOD}:step`, {
        intervalMs: STEP_INTERVAL_MS,
        callback: () => {
            try {
                const skip = runtime.skipUntilLeave;
                if (skip) {
                    const still = listChannel(skip.ch).some(
                        (pad) => pad.x === skip.x && pad.y === skip.y && standingOn(pad),
                    );
                    if (still) return;
                    runtime.skipUntilLeave = null;
                }

                const now = nowMs();
                for (let ch = 0; ch < CHANNELS; ch++) {
                    if (now - (runtime.lastJumpAt[ch] ?? 0) < COOLDOWN_MS) continue;

                    const pads = listChannel(ch);
                    if (pads.length !== MAX_PER_CHANNEL) continue;

                    for (let i = 0; i < MAX_PER_CHANNEL; i++) {
                        const here = pads[i];
                        const there = pads[MAX_PER_CHANNEL - 1 - i];
                        if (!standingOn(here)) continue;
                        teleportTo(there, ch);
                        return;
                    }
                }
            } catch (err) {
                console.warn(`${LOG} step`, err);
            }
        },
    });
}
