
type CSS = Record<string, string | number | undefined>;

export const C = {
    bg: "#121218",
    panel: "#1b1b24",
    panel2: "#22222d",
    border: "#34343f",
    text: "#eae8f2",
    muted: "#9694a6",
    accent: "#f6a531",
    accentDim: "#7a5722",
    accent2: "#62d6c4",
    danger: "#e2585d",
    checkA: "#2a2a33",
    checkB: "#20202a",
};

const mono = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export const win: CSS = {
    position: "fixed",
    zIndex: 100001, 
    display: "flex",
    flexDirection: "column",
    background: C.bg,
    color: C.text,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    boxShadow: "0 12px 40px rgba(0,0,0,0.65)",
    fontFamily: mono,
    fontSize: 12,
    userSelect: "none",
    overflow: "hidden",
    outline: "none",
    pointerEvents: "auto",
};

export const header: CSS = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    background: C.panel,
    borderBottom: `1px solid ${C.border}`,
    cursor: "grab",
    flexShrink: 0,
};

export const body: CSS = { display: "flex", flex: 1, minHeight: 0 };

export const aside: CSS = {
    width: 184,
    flexShrink: 0,
    background: C.panel,
    borderRight: `1px solid ${C.border}`,
    overflowY: "auto",
};

export const section: CSS = { padding: 10, borderBottom: `1px solid ${C.border}` };

export const h3: CSS = {
    margin: "0 0 8px 0",
    fontSize: 10,
    color: C.muted,
    fontWeight: 600,
    letterSpacing: 0.5,
    textTransform: "uppercase",
};

export const toolGrid: CSS = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 };

export const btn: CSS = {
    fontFamily: mono,
    fontSize: 11,
    background: C.panel2,
    color: C.text,
    border: `1px solid ${C.border}`,
    borderRadius: 0,
    padding: "6px 6px",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
};

export const btnActive: CSS = {
    ...btn,
    background: C.accentDim,
    border: `1px solid ${C.accent}`,
    color: "#ffd9a0",
};
export const btnPrimary: CSS = {
    ...btn,
    background: "#2d6a54",
    border: "1px solid #5fbf95",
    color: "#eafff5",
};
export const btnDanger: CSS = {
    ...btn,
    background: "#7a2f33",
    border: `1px solid ${C.danger}`,
    color: "#ffe9ea",
};

export const check: CSS = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: C.muted,
    cursor: "pointer",
    marginTop: 6,
};

export const canvasWrap: CSS = {
    position: "relative",
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    background: "#141419",
};

export const footer: CSS = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "4px 10px",
    background: C.panel,
    borderTop: `1px solid ${C.border}`,
    color: C.muted,
    fontSize: 11,
    flexShrink: 0,
    whiteSpace: "nowrap",
    overflow: "hidden",
};

export const textInput: CSS = {
    background: "#0e0e14",
    color: C.text,
    border: `1px solid ${C.border}`,
    borderRadius: 3,
    padding: "3px 6px",
    fontFamily: mono,
    fontSize: 12,
    outline: "none",
    minWidth: 0,
};

export const palette: CSS = { display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4 };

export const swatch: CSS = {
    width: "100%",
    aspectRatio: "1 / 1",
    border: `1px solid ${C.border}`,
    cursor: "pointer",
    boxSizing: "border-box",
};

export const bar: CSS = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    background: "#3a2a12",
    borderBottom: `1px solid ${C.accentDim}`,
    color: "#ffd9a0",
    flexShrink: 0,
};
