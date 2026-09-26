/**
 * Inline styles for the movable / minimizable config panel.
 * Self-contained so the mod does not depend on external CSS.
 */

export const panelRoot: React.CSSProperties = {
    position: "fixed",
    right: 16,
    bottom: 16,
    zIndex: 100000,
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    fontSize: 13,
    color: "#e8e8e8",
    userSelect: "none",
    pointerEvents: "auto",
};

/**
 * Where the open panel sits: a near-fullscreen overlay, centred.
 *
 * `90vw`/`90vh` with `5vw`/`5vh` of margin on every side, so it is centred
 * whatever the viewport is. The open panel is deliberately *not* draggable — a
 * window that can be shoved to a screen corner is not an overlay, and at this
 * size dragging it could only ever put it somewhere useless. Dragging belongs
 * to the minimised chip, which is small and wants to be parked out of the way.
 */
export const overlayBox: React.CSSProperties = {
    width: "90vw",
    height: "90vh",
    left: "5vw",
    top: "5vh",
    right: "auto",
    bottom: "auto",
    maxWidth: "100vw",
    maxHeight: "100vh",
};

export const panelChrome: React.CSSProperties = {
    background: "rgba(18, 20, 28, 0.94)",
    border: "1px solid rgba(120, 140, 180, 0.45)",
    borderRadius: 8,
    boxShadow: "0 8px 28px rgba(0,0,0,0.55)",
    overflow: "hidden",
    minWidth: 280,
    display: "flex",
    flexDirection: "column",
};

export const titleBar: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    background: "linear-gradient(180deg, rgba(50,60,90,0.9), rgba(30,36,55,0.95))",
    // The open panel is a fixed overlay, so there is nothing to grab. Only the
    // minimised chip takes a drag, and it carries its own cursor.
    cursor: "default",
    borderBottom: "1px solid rgba(100,120,160,0.35)",
};

export const titleText: React.CSSProperties = {
    flex: 1,
    fontWeight: 600,
    letterSpacing: 0.3,
    fontSize: 13,
};

export const btn: React.CSSProperties = {
    background: "rgba(70, 90, 130, 0.7)",
    border: "1px solid rgba(140, 160, 200, 0.4)",
    color: "#eef",
    borderRadius: 4,
    padding: "2px 8px",
    cursor: "pointer",
    fontSize: 12,
    lineHeight: "18px",
};

export const btnDanger: React.CSSProperties = {
    ...btn,
    background: "rgba(140, 50, 50, 0.75)",
    border: "1px solid rgba(200, 100, 100, 0.45)",
};

export const btnPrimary: React.CSSProperties = {
    ...btn,
    background: "rgba(50, 110, 90, 0.8)",
    border: "1px solid rgba(100, 180, 140, 0.45)",
};

export const body: React.CSSProperties = {
    padding: 10,
    overflow: "auto",
    maxHeight: "70vh",
};

export const tabs: React.CSSProperties = {
    display: "flex",
    gap: 4,
    marginBottom: 10,
    flexWrap: "wrap",
};

export const tab: React.CSSProperties = {
    ...btn,
    background: "rgba(40, 48, 70, 0.8)",
};

export const list: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
};

export const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 8px",
    background: "rgba(30, 34, 48, 0.85)",
    borderRadius: 6,
    border: "1px solid rgba(80, 95, 130, 0.35)",
};

export const rowId: React.CSSProperties = {
    flex: 1,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

export const form: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 8,
};

export const label: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    fontSize: 12,
    color: "#b8c0d0",
};

export const input: React.CSSProperties = {
    background: "rgba(12, 14, 22, 0.9)",
    border: "1px solid rgba(100, 120, 160, 0.45)",
    borderRadius: 4,
    color: "#eef",
    padding: "5px 8px",
    fontSize: 13,
    outline: "none",
};

export const textarea: React.CSSProperties = {
    ...input,
    minHeight: 120,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 11,
    resize: "vertical",
};

export const hint: React.CSSProperties = {
    fontSize: 11,
    color: "#8890a8",
    marginTop: 4,
};

export const minimizedChip: React.CSSProperties = {
    ...panelChrome,
    padding: "8px 14px",
    // The one draggable thing in this panel, so it is the one thing with a
    // grab cursor. It both drags (to park it) and clicks (to open it).
    cursor: "grab",
    touchAction: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
    background: "rgba(30, 60, 120, 0.95)",
    border: "1px solid rgba(120, 170, 255, 0.7)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.45)",
    fontSize: 13,
    fontWeight: 600,
    color: "#e8f0ff",
};

// React namespace for CSSProperties typing without importing React at runtime
declare namespace React {
    type CSSProperties = Record<string, string | number | undefined>;
}

export const select: React.CSSProperties = {
    ...input,
    cursor: "pointer",
};

// ── Grouped navigation & form chrome (v0.2 UI) ──────────────────────────────

export const groupNav: React.CSSProperties = {
    display: "flex",
    gap: 4,
    padding: "6px 8px 0 8px",
    flexWrap: "wrap",
};

export const chip: React.CSSProperties = {
    background: "rgba(32, 38, 56, 0.9)",
    border: "1px solid rgba(90, 105, 140, 0.45)",
    color: "#c8d2e6",
    borderRadius: 10,
    padding: "3px 10px",
    cursor: "pointer",
    fontSize: 12,
    lineHeight: "16px",
};

export const chipActive: React.CSSProperties = {
    ...chip,
    background: "rgba(64, 96, 160, 0.95)",
    borderColor: "rgba(150, 185, 240, 0.75)",
    color: "#eef4ff",
    fontWeight: 600,
};

export const chipCount: React.CSSProperties = {
    marginLeft: 6,
    fontSize: 10,
    opacity: 0.75,
    fontVariantNumeric: "tabular-nums",
};

export const subNav: React.CSSProperties = {
    display: "flex",
    gap: 4,
    padding: "6px 8px",
    flexWrap: "wrap",
    borderBottom: "1px solid rgba(90, 105, 140, 0.3)",
};

export const screenHead: React.CSSProperties = {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    padding: "8px 10px 0 10px",
};

export const screenTitle: React.CSSProperties = {
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: 0.2,
};

export const screenBlurb: React.CSSProperties = {
    fontSize: 11,
    color: "#8a93aa",
    flex: 1,
};

export const sectionBox: React.CSSProperties = {
    marginTop: 10,
    borderTop: "1px solid rgba(90, 105, 140, 0.3)",
    paddingTop: 8,
};

export const sectionTitle: React.CSSProperties = {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    color: "#7f8ca8",
    marginBottom: 6,
};

export const fieldGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px 10px",
};

export const fieldCell: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    fontSize: 12,
    color: "#b8c0d0",
    minWidth: 0,
};

export const fieldCellWide: React.CSSProperties = {
    ...fieldCell,
    gridColumn: "1 / -1",
};

export const inputError: React.CSSProperties = {
    ...input,
    borderColor: "rgba(230, 110, 110, 0.85)",
};

export const errorText: React.CSSProperties = {
    fontSize: 10,
    color: "#ff9b9b",
};

export const hintBelow: React.CSSProperties = {
    fontSize: 10,
    color: "#79829a",
};

export const footerBar: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 8,
    borderTop: "1px solid rgba(90, 105, 140, 0.3)",
};

export const footerStatus: React.CSSProperties = {
    flex: 1,
    fontSize: 11,
};

export const emptyState: React.CSSProperties = {
    padding: "14px 10px",
    fontSize: 12,
    color: "#8a93aa",
    background: "rgba(26, 30, 44, 0.7)",
    border: "1px dashed rgba(90, 105, 140, 0.5)",
    borderRadius: 6,
    textAlign: "center",
};

export const listScroll: React.CSSProperties = {
    maxHeight: 150,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    paddingRight: 2,
};

export const outputsRow: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "1fr 84px 26px",
    gap: 6,
    marginBottom: 6,
};

export const requiredMark: React.CSSProperties = {
    color: "#ffb0b0",
    marginLeft: 2,
};

export const shapeGridBox: React.CSSProperties = {
    display: "inline-flex",
    flexDirection: "column",
    gap: 2,
    padding: 4,
    background: "rgba(0,0,0,0.28)",
    border: "1px solid rgba(120,170,255,0.35)",
    borderRadius: 6,
};

export const shapeRow: React.CSSProperties = {
    display: "flex",
    gap: 2,
};

export const shapeCellOn: React.CSSProperties = {
    width: 26,
    height: 26,
    padding: 0,
    cursor: "pointer",
    background: "rgba(120,190,255,0.92)",
    border: "1px solid rgba(180,220,255,0.9)",
    borderRadius: 3,
};

export const shapeCellOff: React.CSSProperties = {
    width: 26,
    height: 26,
    padding: 0,
    cursor: "pointer",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(120,170,255,0.35)",
    borderRadius: 3,
};

// ── Bundled asset library picker ──────────────────────────────────────────────

export const libSearch: React.CSSProperties = {
    ...input,
    marginBottom: 6,
};

export const libGrid: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: 4,
    maxHeight: 190,
    overflowY: "auto",
    padding: 5,
    background: "rgba(0,0,0,0.28)",
    border: "1px solid rgba(120,170,255,0.35)",
    borderRadius: 6,
};

export const libTile: React.CSSProperties = {
    width: 62,
    padding: "3px 2px",
    cursor: "pointer",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(120,170,255,0.35)",
    borderRadius: 4,
    color: "#cfe0ff",
    font: "10px/1.25 system-ui,sans-serif",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

export const libTileActive: React.CSSProperties = {
    ...libTile,
    background: "rgba(120,190,255,0.28)",
    border: "1px solid rgba(180,220,255,0.95)",
    color: "#ffffff",
};

// ── Handlers tab ────────────────────────────────────────────────────────────

/** A boxed group of rows (one handler type, or the warning block). */
export const card: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    padding: 8,
    background: "rgba(18, 24, 40, 0.6)",
    border: "1px solid rgba(120, 160, 220, 0.25)",
    borderRadius: 4,
};

/**
 * "There is nothing here yet, and here is what to do about it."
 *
 * Used where a reference field has an empty option list, and by the advanced
 * box when an entry has no preserved fields. Deliberately informational rather
 * than alarming — nothing is wrong, there is just nothing to show.
 */
export const emptyBox: React.CSSProperties = {
    padding: "8px 10px",
    fontSize: 12,
    lineHeight: "17px",
    color: "rgba(220, 228, 245, 0.8)",
    background: "rgba(30, 38, 58, 0.5)",
    border: "1px dashed rgba(120, 160, 220, 0.35)",
    borderRadius: 4,
};

/** Small non-interactive label: scope, slot, usage counts. */
export const tagChip: React.CSSProperties = {
    display: "inline-block",
    padding: "1px 6px",
    fontSize: 10,
    lineHeight: "15px",
    color: "#cfe0ff",
    background: "rgba(90, 120, 190, 0.22)",
    border: "1px solid rgba(120, 160, 220, 0.3)",
    borderRadius: 3,
    whiteSpace: "nowrap",
};

/** Monospace identifier. */
export const codeKey: React.CSSProperties = {
    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
    fontSize: 12,
    color: "#ffe9a8",
};

/** Inset area holding a form or explanatory text. */
export const noteBox: React.CSSProperties = {
    padding: 8,
    background: "rgba(10, 14, 26, 0.55)",
    border: "1px solid rgba(120, 160, 220, 0.18)",
    borderRadius: 3,
};

/** Preformatted JSON snippet. */
export const codeBlock: React.CSSProperties = {
    margin: "6px 0 0 0",
    padding: 6,
    fontFamily: "ui-monospace, Menlo, Consolas, monospace",
    fontSize: 11,
    color: "#b8ffd0",
    background: "rgba(0, 0, 0, 0.35)",
    borderRadius: 3,
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
};

// ── Asset preview ───────────────────────────────────────────────────────────

/**
 * Nearest-neighbour scaling.
 *
 * `image-rendering: pixelated` is the whole trick: without it a 16×16 sprite
 * scaled to 32px is bilinearly smoothed into a blur, and you cannot tell one
 * icon from another. `crisp-edges` is the older alias some engines still want.
 */
export const spritePixel: React.CSSProperties = {
    imageRendering: "pixelated",
    width: 32,
    height: 32,
    display: "block",
};

/** Icon name under a tile thumbnail. */
export const libTileName: React.CSSProperties = {
    marginTop: 2,
    fontSize: 9,
    color: "rgba(220, 230, 255, 0.75)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 68,
};

/** Row holding the magnified preview of the selected asset. */
export const spritePreviewRow: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    padding: 6,
    background: "rgba(0, 0, 0, 0.3)",
    borderRadius: 3,
    // A checkerboard makes transparency in the art visible instead of guessed.
    backgroundImage:
        "linear-gradient(45deg, #2a2a2a 25%, transparent 25%), linear-gradient(-45deg, #2a2a2a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2a2a2a 75%), linear-gradient(-45deg, transparent 75%, #2a2a2a 75%)",
    backgroundSize: "8px 8px",
    backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
};
