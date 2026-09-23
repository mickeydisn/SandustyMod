/**
 * mdadmin — panel styling.
 *
 * A single `Record<string, StyleObj>` so the individual entries need no casts.
 */
import type { StyleObj } from "./types.ts";

export const COLORS = {
    bg: "rgba(10,12,18,0.92)",
    border: "#263043",
    accent: "#ffe700",
    text: "#cdd6e0",
    dim: "#76808f",
    danger: "#ff6b6b",
};

export const styles: Record<string, StyleObj> = {
    panel: {
        position: "fixed",
        right: "16px",
        bottom: "16px",
        width: "430px",
        maxWidth: "92vw",
        maxHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: "10px",
        color: COLORS.text,
        font: "12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        zIndex: 9000,
    },
    header: {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 10px",
        borderBottom: `1px solid ${COLORS.border}`,
        color: COLORS.accent,
        letterSpacing: "0.06em",
        flexWrap: "wrap",
    },
    button: {
        background: "#1a2130",
        color: COLORS.text,
        border: `1px solid ${COLORS.border}`,
        borderRadius: "5px",
        padding: "3px 8px",
        cursor: "pointer",
        font: "inherit",
    },
    danger: {
        background: "#2a1520",
        color: COLORS.danger,
        border: `1px solid ${COLORS.danger}`,
        borderRadius: "5px",
        padding: "2px 7px",
        cursor: "pointer",
        font: "inherit",
    },
    list: { overflowY: "auto", padding: "4px 6px" },
    row: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "4px 6px",
        borderBottom: `1px solid ${COLORS.border}`,
    },
    swatch: {
        width: "10px",
        height: "10px",
        borderRadius: "2px",
        flexShrink: 0,
    },
    grow: {
        flex: 1,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    footer: {
        padding: "6px 10px",
        color: COLORS.dim,
        borderTop: `1px solid ${COLORS.border}`,
    },
};
