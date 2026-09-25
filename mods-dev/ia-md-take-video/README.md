# Take Video (`md-take-video`)

`md-take-video` · v3.5.0 · **dev**

Record a **locked C-selection** (or live marquee) as a **compressed WebM/MP4** video you can drop
straight into Discord.

> The shipped entry is the **self-contained `main.js`** at the mod root — it has no Deno/modkit
> dependency, so the folder can be dropped into the game's `mods/` directory as-is. `src/` holds the
> constants used by the game build and documents the lifecycle expected by the `md-admin-clean`
> template.

## Features

- **F7** opens the capture panel; **C** drags a marquee (same selection model as the Screenshot/GIF
  mod).
- Lock the region (recommended) so camera movement doesn't change the crop.
- Live encode with **MediaRecorder** — set FPS (5–60), scale (1/½/¼ … 4 nearest-neighbour), bitrate.
- Countdown before REC, then **Start / Stop** from the panel (start/stop is unbound by default and
  rebindable in Controls).
- **Review** step: trim start/end (ms), then _Save video_ (trimmed) or _Save full_.
- Output: `sandustry-YYYYMMDD-HHMMSS.webm` via an `<a download>` link.

### Why MediaRecorder (not GIF / not ffmpeg-in-browser)

| Approach                     | Size       | CPU                                | Discord    | Notes                           |
| ---------------------------- | ---------- | ---------------------------------- | ---------- | ------------------------------- |
| GIF (modern-gif)             | Very large | High (palette + all frames in RAM) | OK/heavy   | What the reference mod does     |
| Frame dump + wasm ffmpeg     | Medium     | Very high                          | Excellent  | Complex, slow to start          |
| **MediaRecorder → WebM VP9** | **Small**  | **Low (hardware when available)**  | **Native** | **Chosen** — encodes on the fly |

Preferred MIME order: `video/webm;codecs=vp9` → `video/webm;codecs=vp8` → `video/webm` →
`video/mp4`. Default bitrate 2 Mbps (configurable 1–12); Discord's practical limit is ~25 MB for
free users, so a 30 s clip at 2 Mbps is ~7.5 MB.

## Package dependencies

**None.** The entry is a single self-contained `main.js`; it talks to the game through the global
`sandkit` object only. There are no `@sandmd/*` runtime imports (the `src/` stubs exist for a future
workspace build).

## Sandkit API used

| Area              | Calls                                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Input             | `input.registerBinding` (F7 toggle; start/stop unbound)                                                                    |
| Overlay rendering | `events.on("frame:render")`, `rendering.getGridMetrics`, `rendering.getDrawPositionAtCell`, `rendering.withOverlayContext` |
| UI                | `ui.inject`, `ui.overlays.update`, `ui.toast`                                                                              |
| Settings          | `settings.get` (reads `md-take-video.*` with a bare-name fallback)                                                         |
| Scheduling        | `schedule.nextTick`                                                                                                        |
| Host handles      | `sandkit.react`, `sandkit.state`                                                                                           |

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

Camera drift while recording letterboxes into the locked canvas size instead of resizing the encoder
mid-stream (avoids broken WebM).

## Settings

Uses the shared settings pattern (see `mods-dev` / `mods-progress`): `configSchema` in
`modinfo.json` → typed `SETTINGS` → `readSettings` / `onSettingsChange` from `@sandmd/modkit`
(pub mods read `api.settings` directly). Disabling a mod runs a prune/orphan/storage cleanup
over everything prefixed with its id.

Per-key values for this mod:
[`doc/doc_ia/MOD_SETTINGS.md`](../../doc/doc_ia/MOD_SETTINGS.md#ia-md-take-video).

## Limitations

- **Trim** is chunk-based (≈250 ms granularity) — re-encode externally (ffmpeg) for frame-perfect
  cuts.
- Requires a runtime with **MediaRecorder** + canvas capture (Electron/Chromium Sandustry builds).
- Selection must be on-screen; if the locked region leaves the viewport, frames may go black.

## Credits

- Selection / marquee geometry: adapted from **irishbruse.selection-capture**
- Mod structure: **md-admin-clean** (`mickeydisn/SandustyMod`)
- API: [sandustry.com/sandkit.html](https://sandustry.com/sandkit.html)

---

Layout and build details for every mod live in
[`doc/doc_ia/MOD_LAYOUT.md`](../../doc/doc_ia/MOD_LAYOUT.md) and
[`doc/doc_ia/MOD_BUILD.md`](../../doc/doc_ia/MOD_BUILD.md).
