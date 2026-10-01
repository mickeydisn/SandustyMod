// Shared jsdom + fake-sandkit environment
import { JSDOM } from "jsdom";
import { createCanvas, loadImage, ImageData as NCImageData } from "canvas";
import fs from "node:fs";
import React from "react";

export async function setup(opts = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, {
    pretendToBeVisual: true, resources: "usable", url: "http://localhost/",
  });
  const w = dom.window;
  for (const k of ["window","document","navigator","HTMLElement","HTMLCanvasElement","Image","ImageData","FileReader","Blob","File",
    "Event","MouseEvent","KeyboardEvent","WheelEvent","Node","MutationObserver","CustomEvent"]) {
    try { Object.defineProperty(globalThis, k, { value: w[k] ?? globalThis[k], configurable: true, writable: true }); } catch {}
  }
  globalThis.ImageData = NCImageData; w.ImageData = NCImageData;
  globalThis.window = w; globalThis.document = w.document;
  globalThis.requestAnimationFrame = w.requestAnimationFrame.bind(w);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  let blobN = 0; const blobs = new Map();
  w.URL.createObjectURL = (b) => { const u = "blob:fake/" + (++blobN); blobs.set(u, b); return u; };
  w.URL.revokeObjectURL = (u) => blobs.delete(u);
  globalThis.URL.createObjectURL = w.URL.createObjectURL; globalThis.URL.revokeObjectURL = w.URL.revokeObjectURL;
  // jsdom's Image can only decode blob: URLs we hand it via a data URL
  const origSrc = Object.getOwnPropertyDescriptor(w.HTMLImageElement.prototype, "src");
  Object.defineProperty(w.HTMLImageElement.prototype, "src", {
    configurable: true, get() { return origSrc.get.call(this); },
    set(v) {
      if (typeof v === "string" && v.startsWith("blob:fake/")) {
        const b = blobs.get(v);
        b.arrayBuffer().then(ab => origSrc.set.call(this, "data:" + (b.type || "image/png") + ";base64," + Buffer.from(ab).toString("base64")));
      } else origSrc.set.call(this, v);
    },
  });

  // ---- fake game api ----
  const store = new Map();                 // modId -> Map
  const spriteLoads = [];                  // {id,path,opts}
  const loaded = new Set();
  const toasts = [];
  const assetUrls = opts.assetUrls ?? {};
  const api = {
    storage: {
      ensure(m) { if (!store.has(m)) store.set(m, new Map()); },
      get(m, k) { const v = store.get(m)?.get(k); return v === undefined ? undefined : JSON.parse(v); },   // JSON boundary like real storage
      set(m, k, v) { if (!store.has(m)) store.set(m, new Map()); store.get(m).set(k, JSON.stringify(v)); },
      remove(m, k) { store.get(m)?.delete(k); },
    },
    sprites: {
      async load(id, path, o) {
        spriteLoads.push({ id, path, opts: o });
        if (opts.rejectDataUrls && String(path).startsWith("data:")) throw new Error("data URLs not supported");
        loaded.add(id);
      },
      async loadFromMod(id, path, o) { spriteLoads.push({ id, path, opts: o, fromMod: true }); loaded.add(id); },
      getById(id) { return loaded.has(id) ? { id } : null; },
    },
    assets: { getUrl: (p) => assetUrls[p] ?? "mod://" + p },
    ui: { toast: (m) => toasts.push(m), overlays: {}, },
    items: { isActiveById: () => true, register() {} },
    i18n: { register() {} },
    elements: { register() { return {}; } }, structures: { register() {} },
    hooks: { intercept() { return () => {}; }, modify() { return () => {}; } },
    events: { on() {} },
  };
  globalThis.sandkit = { api, react: React, enums: {} };
  return { dom, w, api, store, spriteLoads, loaded, toasts, React, createCanvas, loadImage };
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
export function pngDataUrl(width, height, paint) {
  const c = createCanvas(width, height); const ctx = c.getContext("2d"); paint?.(ctx); return c.toDataURL("image/png");
}
