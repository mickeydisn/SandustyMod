/**
 * Channel Pads — pad registry: painting, relinking and structure registration.
 *
 * Each channel is one 1×1 pad structure; its `pad-{n}.png` has two frames —
 * index 0 idle, index 1 linked. A channel is "linked" when it has two pads.
 */
import { api, listChannel, toast } from "./api.ts";
import {
    CHANNELS,
    KEY,
    MAX_PER_CHANNEL,
    MOD,
    ORDER_BASE,
    PAD_SIZE_PX,
    padId,
} from "./constants.ts";
import { flash } from "./world.ts";
import type { PadStructure } from "./types.ts";

/**
 * Repaint one channel: stamp `channel`/`mates` on every pad and set the
 * idle/linked sprite frame. Returns the channel's pads.
 */
export function paint(ch: number): PadStructure[] {
    const pads = listChannel(ch);
    const linked = pads.length === MAX_PER_CHANNEL;
    for (const pad of pads) {
        try {
            api.structures.updateData(
                pad,
                { channel: ch, mates: pads.length },
                { propagateToWorkers: true },
            );
        } catch {
            /* ignore */
        }

        const frame = linked ? 1 : 0;
        try {
            api.structures.setSpritesheetIndex(pad, frame);
        } catch {
            try {
                api.structures.setSpritesheetIndexAtCell?.(pad.x, pad.y, frame);
            } catch {
                /* ignore */
            }
        }
    }
    return pads;
}

/** Repaint a channel and toast the resulting link state. */
export function relink(ch: number, reason: "placed" | "removed"): void {
    const pads = paint(ch);
    if (reason === "placed" && pads.length === MAX_PER_CHANNEL) {
        flash(pads[0].x, pads[0].y, ch);
        flash(pads[1].x, pads[1].y, ch);
        toast(KEY.toastLinked, { channel: ch });
    } else if (reason === "placed" && pads.length === 1) {
        toast(KEY.toastWaiting, { channel: ch });
    } else if (reason === "removed" && pads.length === 1) {
        toast(KEY.toastUnpaired, { channel: ch });
    }
}

/** English strings; one pad name per channel. */
export function registerI18n(): void {
    const en: Record<string, string> = {
        [KEY.pack]: "Channel Pads",
        [KEY.padDesc]: "Walk onto a linked pad to teleport to its twin. Only two pads per channel.",
        [KEY.toastFull]: "Channel {channel} already has two pads.",
        [KEY.toastLinked]: "Channel {channel} linked.",
        [KEY.toastWaiting]: "Channel {channel} waiting for a twin.",
        [KEY.toastUnpaired]: "Channel {channel} unpaired.",
        [KEY.toastFail]: "Channel {channel} could not fold.",
        [KEY.tooltip]: "Channel {channel} · {mates}/2",
    };
    for (let ch = 0; ch < CHANNELS; ch++) en[KEY.padName(ch)] = `Channel Pad ${ch}`;
    api.i18n.register("en", en);
}

/** Register one pad structure per channel and unlock it. */
export function registerPads(): void {
    for (let ch = 0; ch < CHANNELS; ch++) {
        const id = padId(ch);
        api.structures.register({
            id,
            nameKey: KEY.padName(ch),
            descriptionKey: KEY.padDesc,
            categoryKey: "logistics",
            order: ORDER_BASE + ch,
            buildModes: [{ type: "single" }],
            shape: [[1]],
            defaultData: { channel: ch, mates: 0 },
            copyData: ["channel"],
            render: {
                imageName: `${MOD}.img.${ch}`,
                size: { width: PAD_SIZE_PX, height: PAD_SIZE_PX },
            },
            spritesheet: { frameSize: { width: PAD_SIZE_PX, height: PAD_SIZE_PX } },
            tooltipHover: {
                type: "custom",
                dataFieldMessage: {
                    messageKey: KEY.tooltip,
                    fields: [
                        { param: "channel", field: "channel", fallback: ch },
                        { param: "mates", field: "mates", fallback: 0 },
                    ],
                },
            },
        });

        try {
            api.player.buildings.unlockById(id);
        } catch {
            api.player.buildings.add?.(id);
        }
    }
}
