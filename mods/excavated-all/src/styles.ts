/**
 * excavated-all — hotbar panel styling.
 *
 * A single `Record<string, StyleObj>` so individual entries need no casts —
 * same convention as `md-admin-structure/styles.ts`.
 */
import type { StyleObj } from "./types.ts";

export const COLORS = {
    bg: "rgba(10,12,18,0.92)",
    border: "#3a2038",
    accent: "#ff6b6b",
    void_: "#c084ff",
    text: "#cdd6e0",
    dim: "#76808f",
    on: "#7ee787",
    off: "#4a4f5a",
    danger: "#ff6b6b",
};

export const styles: Record<string, StyleObj> = {
    bar: {
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: "5.5em",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        padding: "8px 12px",
        borderRadius: "10px",
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        color: COLORS.text,
        font: "12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
    },
    row: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    title: {
        color: COLORS.void_,
        letterSpacing: "0.06em",
        flex: 1,
    },
    radiusBtn: {
        background: "#1a2130",
        color: COLORS.text,
        border: `1px solid ${COLORS.border}`,
        borderRadius: "5px",
        width: "22px",
        height: "22px",
        cursor: "pointer",
        font: "inherit",
        lineHeight: "1",
    },
    radiusInput: {
        width: "44px",
        background: "#111",
        color: "#eee",
        border: "1px solid #445",
        borderRadius: "3px",
        padding: "3px 4px",
        textAlign: "center",
        colorScheme: "dark",
        font: "inherit",
    },
    toggleOn: {
        background: "#123322",
        color: COLORS.on,
        border: `1px solid ${COLORS.on}`,
        borderRadius: "5px",
        padding: "3px 8px",
        cursor: "pointer",
        font: "inherit",
    },
    toggleOff: {
        background: "#1a1c22",
        color: COLORS.off,
        border: `1px solid ${COLORS.border}`,
        borderRadius: "5px",
        padding: "3px 8px",
        cursor: "pointer",
        font: "inherit",
    },
    footer: {
        color: COLORS.dim,
        fontSize: "11px",
    },
};
