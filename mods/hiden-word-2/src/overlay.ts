/**
 * Ghost Lens overlay — minimal banner only.
 * Full configuration lives in the Map Viewer tool (mapViewer.ts).
 */

import { LOG, OVERLAY_ID } from "./constants.ts";
import { api } from "./api.ts";
import { isLensSelected } from "./lens.ts";
import { runtime } from "./state.ts";

declare const sandkit: { react: any };
const react = sandkit.react;
const h = (
  type: unknown,
  props: Record<string, unknown> | null,
  ...children: unknown[]
): unknown => react.createElement(type, props, ...children);

function injectStyles(): void {
  if (document.getElementById("hw-lens-banner-style")) return;
  const style = document.createElement("style");
  style.id = "hw-lens-banner-style";
  style.textContent = `
    .hw-lens-banner {
      position: fixed; left: 50%; transform: translateX(-50%);
      bottom: 6.5em; z-index: 1000;
      padding: 6px 12px; border-radius: 6px;
      background: rgba(10, 10, 16, 0.88); border: 1px solid #445;
      color: #9cf; font-size: 12px; pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

function LensBanner(): unknown {
  const [, bump] = react.useState(0) as [unknown, (fn: (n: number) => number) => void];
  react.useEffect(() => {
    const unsub = api.events.on("action:changed", () => bump((n) => n + 1));
    return () => {
      try {
        unsub();
      } catch { /* */ }
    };
  }, []);
  if (!isLensSelected()) return null;
  return h(
    "div",
    { className: "hw-lens-banner" },
    `Ghost Lens — ${runtime.width}×${runtime.height} · use Map Viewer for config`,
  );
}

export function registerParamsOverlay(): void {
  injectStyles();
  try {
    api.ui.overlays.register("hotbar", OVERLAY_ID, () => LensBanner());
  } catch (err) {
    console.warn(`${LOG} lens banner overlay failed`, err);
  }
}
