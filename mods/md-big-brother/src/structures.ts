/**
 * Big Brother — registration and runtime wiring.
 *
 * Everything the host must be told about: i18n strings, camera/screen
 * structures, the one-camera-per-channel limit, click-to-swing interaction,
 * placement lifecycle and the capture tick.
 */
import { api, channelFromId, listType, toast } from "./api.ts";
import { CAPTURE_MS, KEY, LOG, MAX_CAMERAS, MOD, TILE_PX } from "./constants.ts";
import { captureAll, captureChannel, paintNoSignal } from "./feeds.ts";
import { corners, tileShape } from "./geometry.ts";
import { drawCamera, drawScreen, paintOverlay } from "./render.ts";
import { runtime } from "./state.ts";
import type {
    CamStructure,
    HookContext,
    PlacedEvent,
    PlacePayload,
    RemovedEvent,
} from "./types.ts";

/** Last capture tick, throttles capture inside `frame:render`. */
let lastCaptureMs = 0;

/** English strings; per-channel names are added for every active channel. */
export function registerI18n(): void {
    const en: Record<string, string> = {
        [KEY.pack]: "Big Brother",
        [KEY.camDesc]: "Click to swing the capture corner. One camera per channel.",
        [KEY.screenDesc]: "Draws that channel's live feed. Place as many as you want.",
        [KEY.toastCamFull]: "Channel {channel} already has a camera.",
        [KEY.toastCorner]: "Channel {channel} · {corner}",
        [KEY.toastWaiting]: "Channel {channel} camera online. Place a screen.",
        [KEY.tooltipCam]: "Channel {channel} · {corner}",
        [KEY.tooltipScreen]: "Channel {channel} screen",
    };
    for (let ch = 0; ch < runtime.channels; ch++) {
        en[KEY.camName(ch)] = `Camera ${ch}`;
        en[KEY.screenName(ch)] = `Screen ${ch}`;
    }
    api.i18n.register("en", en);
}

/** Repaint a camera's sprite to match its stored corner. */
function paintCameraSprite(camera: CamStructure): void {
    const corner = (camera.data?.corner ?? 0) % 4;
    try {
        api.structures.setSpritesheetIndex(camera, corner);
    } catch {
        try {
            api.structures.setSpritesheetIndexAtCell?.(camera.x, camera.y, corner);
        } catch {
            /* ignore */
        }
    }
}

/** Register one camera + one screen structure per channel and unlock them. */
export function registerStructures(): void {
    for (let ch = 0; ch < runtime.channels; ch++) {
        api.structures.register({
            id: runtime.camIds[ch],
            nameKey: KEY.camName(ch),
            descriptionKey: KEY.camDesc,
            categoryKey: "camera",
            order: 0,
            buildModes: [{ type: "single" }],
            shape: tileShape(1),
            defaultData: { channel: ch, corner: 0, cornerName: "top-left" },
            copyData: ["channel", "corner", "cornerName"],
            render: {
                imageName: `${MOD}.cam.${ch}`,
                size: { width: TILE_PX, height: TILE_PX },
                spritesheet: { frameSize: { width: TILE_PX, height: TILE_PX } },
            },
            tooltipHover: {
                type: "custom",
                dataFieldMessage: {
                    messageKey: KEY.tooltipCam,
                    fields: [
                        { param: "channel", field: "channel", fallback: ch },
                        { param: "corner", field: "cornerName", fallback: "top-left" },
                    ],
                },
            },
            draw: drawCamera,
        });

        api.structures.register({
            id: runtime.screenIds[ch],
            nameKey: KEY.screenName(ch),
            descriptionKey: KEY.screenDesc,
            categoryKey: "camera",
            order: 0,
            buildModes: [{ type: "single" }],
            shape: tileShape(runtime.zoneTiles),
            defaultData: { channel: ch },
            copyData: ["channel"],
            hideFromBuildMenu: true, // this hide the strucutre from the menu, custum picker will be used
            render: {
                imageName: `${MOD}.screen`,
                size: { width: runtime.feedPx, height: runtime.feedPx },
            },
            tooltipHover: {
                type: "custom",
                dataFieldMessage: {
                    messageKey: KEY.tooltipScreen,
                    fields: [{ param: "channel", field: "channel", fallback: ch }],
                },
            },
            draw: drawScreen,
        });

        try {
            api.player.buildings.unlockById(runtime.camIds[ch]);
            api.player.buildings.unlockById(runtime.screenIds[ch]);
        } catch {
            api.player.buildings.add?.(runtime.camIds[ch]);
            api.player.buildings.add?.(runtime.screenIds[ch]);
        }
    }
}

/** Cancel placement of a camera once its channel already has one. */
export function registerLimit(): void {
    api.hooks.intercept(
        "building:place",
        (payload, ctx: HookContext) => {
            try {
                const p = payload as PlacePayload | null;
                const id = p?.structureId ?? p?.structureType ?? p?.id;
                const ch = channelFromId(id, runtime.camIds);
                if (ch == null) return;
                if (listType(runtime.camIds[ch]).length < MAX_CAMERAS) return;
                toast(KEY.toastCamFull, { channel: ch });
                ctx?.cancel?.();
            } catch (err) {
                console.warn(`${LOG} place intercept`, err);
            }
        },
        { structureTypes: runtime.camIds },
    );
}

/** Click a camera to cycle the capture corner (TL → TR → BR → BL). */
export function registerInteract(): void {
    for (let ch = 0; ch < runtime.channels; ch++) {
        api.signals.interactables.register(runtime.camIds[ch], (camera) => {
            try {
                const list = corners();
                const next = ((camera.data?.corner ?? 0) + 1) % list.length;
                const name = list[next].name;
                api.structures.updateData(
                    camera,
                    { channel: ch, corner: next, cornerName: name },
                    { propagateToWorkers: true },
                );
                paintCameraSprite(camera);
                toast(KEY.toastCorner, { channel: ch, corner: name });
                captureChannel(ch);
            } catch (err) {
                console.warn(`${LOG} interact`, err);
            }
        });
    }
}

/** Stamp channel data on placement, NO SIGNAL on camera removal, capture on tick. */
export function registerLifecycle(): void {
    api.events.on("building:placed", (payload) => {
        try {
            const e = payload as PlacedEvent;
            const structure = e?.structure;
            const id = e?.structureId ?? structure?.type;

            const camCh = channelFromId(id, runtime.camIds);
            if (camCh != null) {
                const camera = structure ?? listType(runtime.camIds[camCh])[0];
                if (camera) {
                    const corner = camera.data?.corner ?? 0;
                    api.structures.updateData(
                        camera,
                        {
                            channel: camCh,
                            corner,
                            cornerName: corners()[corner % 4].name,
                        },
                        { propagateToWorkers: true },
                    );
                    paintCameraSprite(camera);
                }
                toast(KEY.toastWaiting, { channel: camCh });
                captureChannel(camCh);
            }

            const screenCh = channelFromId(id, runtime.screenIds);
            if (screenCh != null) captureChannel(screenCh);
        } catch (err) {
            console.warn(`${LOG} placed`, err);
        }
    });

    // When the last camera of a channel is removed the feed must flip back to
    // NO SIGNAL immediately — without this the screen keeps the frozen last
    // frame until the next throttled capture notices the camera is gone (and
    // `hadCopy` bookkeeping could skip the repaint entirely).
    api.events.on("building:removed", (payload) => {
        try {
            const e = payload as RemovedEvent;
            const structure = e?.structure;
            const id = e?.structureId ?? structure?.type;
            const ch = channelFromId(id, runtime.camIds) ??
                (structure?.data?.channel as number | undefined ?? null);
            if (ch == null || ch < 0 || ch >= runtime.channels) return;
            // `building:removed` may fire before the structure list updates, so
            // exclude the just-removed instance when deciding if a camera
            // remains. Otherwise the feed would keep the frozen last frame.
            const remaining = listType(runtime.camIds[ch]).filter((cam) =>
                !(structure && cam.x === structure.x && cam.y === structure.y)
            );
            if (remaining.length === 0) {
                runtime.hadCopy[ch] = false;
                const feed = runtime.feeds[ch];
                const ctx = feed?.getContext("2d", { willReadFrequently: true }) ?? null;
                if (ctx) paintNoSignal(ctx, ch);
            } else {
                captureChannel(ch);
            }
        } catch (err) {
            console.warn(`${LOG} removed`, err);
        }
    });

    // Capture reads the LIVE world map, so it is throttled to ~10 fps here
    // instead of running on every frame.
    api.events.on("frame:render", () => {
        paintOverlay();
        const now = Date.now();
        if (now - lastCaptureMs < CAPTURE_MS) return;
        lastCaptureMs = now;
        captureAll();
    });
}

/** Background trigger: keeps feeds fresh even between render frames. */
export function registerCapture(): void {
    api.triggers.register(`${MOD}:capture`, {
        // This engine build's scheduler reads `interval`.
        interval: CAPTURE_MS,
        intervalMs: CAPTURE_MS,
        callback: () => {
            try {
                captureAll();
            } catch (err) {
                console.warn(`${LOG} capture`, err);
            }
        },
    });
}
