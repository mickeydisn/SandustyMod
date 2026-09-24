# Take Video (`md-take-video`)

Record a **locked C-selection** (or live marquee) as a **compressed WebM/MP4** video you can drop straight into Discord.

Built from the **md-admin-clean** template pattern and the selection/crop model of **irishbruse.selection-capture**, with the heavy GIF path replaced by **MediaRecorder** streaming encode.

## Why MediaRecorder (not GIF / not ffmpeg-in-browser)

| Approach | Size | CPU | Discord | Notes |
| --- | --- | --- | --- | --- |
| GIF (modern-gif) | Very large | High (palette + all frames in RAM) | OK but heavy | What the reference mod does |
| Frame dump + wasm ffmpeg | Medium | Very high | Excellent | Complex, slow to start |
| **MediaRecorder → WebM VP9** | **Small** | **Low (hardware when available)** | **Native** | **Chosen** — encodes on the fly |

Preferred MIME order:

1. `video/webm;codecs=vp9` (best compression)
2. `video/webm;codecs=vp8`
3. `video/webm`
4. `video/mp4` (if the runtime exposes it)

Bitrate defaults to **4 Mbps** (configurable 1–20). Discord’s practical limit is ~25 MB for free users / 50–500 MB with Nitro — at 4 Mbps a 30 s clip is ~15 MB.

## Usage

1. Enable the mod (Settings → Mods).
2. Press **F7** to open the panel.
3. Press **C**, drag a marquee (same as the Screenshot/GIF mod).
4. **Lock** the area (optional but recommended so camera moves don’t change the crop).
5. Set **FPS** (5–60), **Scale** (1–4 nearest-neighbour), **Bitrate**.
6. **Start record** → optional countdown → **Stop**.
7. In **Review**: adjust trim start/end (ms), **Save video** (trimmed) or **Save full**.

Bindings (rebindable in Controls):

- **Toggle Take Video panel** — default `F7`
- **Start/Stop video record** — unbound by default (use the panel)

## Files

```
md-take-video/
├── modinfo.json      # Workshop / game manifest
├── main.js           # Entry (self-contained)
├── README.md
└── src/
    ├── modinfo.json
    └── constants.ts  # MOD_ID, SETTINGS mirror (for future deno/modkit build)
```

No build step required — drop the folder into the game’s `mods/` directory (or upload via Workshop after adding `preview.png`).

## Capture pipeline (on the fly)

```
frame:render
    → map cell bounds → screen rect → clip on dynamic2D / game canvas
    → drawImage into a fixed offscreen canvas (locked size)
    → canvas.captureStream(fps)
    → MediaRecorder (timeslice 250 ms) → chunk list
Stop → Blob(chunks)
Trim → subset of chunks by timestamp (best-effort; keyframe-aligned)
Save → <a download> sandustry-YYYYMMDD-HHMMSS.webm
```

Camera drift while recording letterboxes into the locked canvas size instead of resizing the encoder mid-stream (avoids broken WebM).

## Config schema (`Options → Mods`)

| Key | Default | Meaning |
| --- | --- | --- |
| `enabled` | true | Master switch |
| `countdownSeconds` | 2 | Delay before REC |
| `defaultFps` | 30 | Initial FPS in the panel |
| `videoBitrateMbps` | 4 | Target bitrate |

Panel values (FPS, scale, lock, bitrate) also persist in `localStorage` under `md-take-video.capture-settings`.

## Limitations

- **Trim** is chunk-based (≈250 ms granularity). For frame-perfect cuts, re-encode externally (e.g. ffmpeg).
- Requires a runtime with **MediaRecorder** + canvas capture (Electron/Chromium builds of Sandustry).
- Selection must be on-screen; if the locked region leaves the viewport, frames may go black until it returns.

## Credits

- Selection / marquee geometry: adapted from **irishbruse.selection-capture**
- Mod structure: **md-admin-clean** (`mickeydisn/SandustyMod`)
- API: [sandustry.com/sandkit.html](https://sandustry.com/sandkit.html)
