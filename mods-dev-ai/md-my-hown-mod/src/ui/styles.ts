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
