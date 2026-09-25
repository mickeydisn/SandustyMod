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
    cursor: "grab",
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

export const tabActive: React.CSSProperties = {
    ...tab,
    background: "rgba(70, 100, 160, 0.9)",
    borderColor: "rgba(160, 190, 230, 0.6)",
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

export const toolbar: React.CSSProperties = {
    display: "flex",
    gap: 6,
    flexWrap: "wrap",
    marginBottom: 8,
};

export const hint: React.CSSProperties = {
    fontSize: 11,
    color: "#8890a8",
    marginTop: 4,
};

export const minimizedChip: React.CSSProperties = {
    ...panelChrome,
    padding: "8px 14px",
    cursor: "pointer",
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

export const warnBox: React.CSSProperties = {
    ...hint,
    background: "rgba(90, 70, 20, 0.35)",
    border: "1px solid rgba(200, 160, 60, 0.4)",
    borderRadius: 4,
    padding: "5px 8px",
    color: "#e8d49a",
};
