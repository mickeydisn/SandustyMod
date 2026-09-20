export function injectViewerStyles(): void {
  if (document.getElementById("hwv-style")) return;
  const style = document.createElement("style");
  style.id = "hwv-style";
  style.textContent = `
    .hwv-root {
      position: fixed; inset: 0; z-index: 9000;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.55); pointer-events: auto;
      font-family: inherit;
    }
    .hwv-frame {
      position: relative; width: 80vw; height: 80vh; max-width: 1400px;
      display: flex; flex-direction: row;
      background: rgba(12, 12, 18, 0.97);
      border: 1px solid #456; border-radius: 10px;
      overflow: hidden; box-shadow: 0 12px 48px rgba(0,0,0,0.5);
      color: #ddd; font-size: 12px;
    }
    .hwv-close {
      position: absolute; top: 8px; right: 10px; z-index: 5;
      width: 28px; height: 28px; line-height: 26px; text-align: center;
      background: #322; border: 1px solid #644; border-radius: 4px;
      color: #fcc; font-size: 16px; cursor: pointer; padding: 0;
    }
    .hwv-close:hover { background: #533; }
    .hwv-side {
      width: 340px; min-width: 280px; max-width: 40%;
      overflow-y: auto; padding: 12px 14px;
      border-right: 1px solid #334; box-sizing: border-box;
    }
    .hwv-side h2 { margin: 0 0 8px; font-size: 14px; color: #9cf; }
    .hwv-group {
      margin: 12px 0 4px; padding: 4px 0;
      color: #fc6; font-weight: bold; font-size: 12px;
      letter-spacing: 0.06em; border-bottom: 1px solid #543;
      text-transform: uppercase;
    }
    .hwv-details {
      border: 1px solid #334; border-radius: 4px; margin: 6px 0;
      background: rgba(0,0,0,0.2);
    }
    .hwv-details > summary {
      cursor: pointer; padding: 6px 8px; color: #9cf; font-weight: bold;
      list-style: none; display: flex; align-items: center; gap: 8px;
      user-select: none;
    }
    .hwv-details > summary::-webkit-details-marker { display: none; }
    .hwv-details > summary::before { content: "▸"; color: #678; width: 12px; }
    .hwv-details[open] > summary::before { content: "▾"; }
    .hwv-details-body { padding: 4px 8px 8px; border-top: 1px solid #334; }
    .hwv-row {
      display: flex; align-items: center; gap: 6px; margin: 3px 0; flex-wrap: wrap;
    }
    .hwv-row label { flex: 0 0 100px; color: #aaa; font-size: 11px; }
    .hwv-row input[type="number"], .hwv-row input[type="text"], .hwv-row select {
      background: #111; color: #eee; border: 1px solid #445;
      border-radius: 3px; padding: 3px 6px; font: inherit; min-width: 72px;
    }
    .hwv-row select { flex: 1; min-width: 120px; }
    .hwv-row input[type="text"] { flex: 1; }
    .hwv-row input[type="checkbox"] { width: 15px; height: 15px; }
    .hwv-mini { color: #778; font-size: 10px; }
    .hwv-btns { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
    .hwv-btn {
      background: #234; border: 1px solid #456; color: #cde;
      border-radius: 4px; padding: 5px 10px; cursor: pointer; font: inherit;
    }
    .hwv-btn:hover { background: #345; }
    .hwv-btn-primary { background: #246; border-color: #48a; }
    .hwv-map {
      flex: 1; display: flex; flex-direction: column;
      min-width: 0; padding: 10px 12px; background: #0a0a10;
    }
    .hwv-map-title {
      display: flex; justify-content: space-between; align-items: center;
      gap: 8px; margin-bottom: 6px; color: #9ab; font-size: 11px; flex-wrap: wrap;
    }
    .hwv-viewport {
      flex: 1; position: relative; overflow: hidden;
      border: 1px solid #333; background: #121218;
      border-radius: 4px; cursor: grab; min-height: 200px;
    }
    .hwv-viewport.hwv-dragging { cursor: grabbing; }
    .hwv-viewport canvas {
      image-rendering: pixelated; image-rendering: crisp-edges;
      position: absolute; left: 50%; top: 50%;
      transform-origin: center center;
      max-width: none; max-height: none;
      border: 1px solid #2a2a33; background: #1a1a22;
    }
    .hwv-hint { font-size: 10px; color: #667; margin-top: 4px; }
    .hwv-legend { display: flex; flex-wrap: wrap; gap: 4px 8px; margin-top: 8px; }
    .hwv-legend span { display: flex; align-items: center; gap: 3px; font-size: 10px; color: #99a; }
    .hwv-swatch {
      width: 12px; height: 12px; border-radius: 2px; border: 1px solid #556;
      display: inline-block; flex-shrink: 0;
    }
    .hwv-mod {
      border: 1px solid #334; border-radius: 4px; margin: 6px 0;
      background: rgba(0,0,0,0.25); cursor: grab;
    }
    .hwv-mod.hwv-dragging-mod { opacity: 0.6; border-color: #6af; }
    .hwv-mod-head {
      display: flex; align-items: center; gap: 6px; padding: 6px 8px;
      background: rgba(40,50,70,0.4);
    }
    .hwv-mod-kind {
      font-size: 10px; padding: 1px 6px; border-radius: 8px;
      background: #345; color: #cdf;
    }
    .hwv-mod-kind-wall { background: #353; }
    .hwv-mod-kind-form { background: #335; }
    .hwv-mod-kind-liquid { background: #246; }
    .hwv-mod-body { padding: 6px 8px; border-top: 1px solid #334; }
    .hwv-tag-row { display: flex; align-items: center; gap: 8px; margin: 4px 0; flex-wrap: wrap; }
    .hwv-focus { outline: 1px solid #6af; }
  `;
  document.head.appendChild(style);
}
