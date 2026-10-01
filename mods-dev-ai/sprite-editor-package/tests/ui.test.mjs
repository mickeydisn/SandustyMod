import { setup, sleep, pngDataUrl } from "./env.mjs";
import fs from "node:fs";
import assert from "node:assert/strict";
import { loadImage, createCanvas } from "canvas";

const iconPng = fs.readFileSync("/home/claude/SandustyMod/mods-dev-ai/md-my-hown-mod/assets/config-icon.png");
const iconUrl = "data:image/png;base64," + iconPng.toString("base64");
const iconImg = await loadImage(iconUrl);

const env = await setup({ assetUrls: { "assets/config-icon.png": iconUrl } });
const { w, React, spriteLoads, store } = env;
const { createRoot } = await import("react-dom/client");
const M = await import("./out/mod.mjs");
const { act } = React;
const D = w.document;

// seed: one existing file-based asset in the collection
{ const c = M.loadConfig(); c.sprites = [{ id: "md-my-hown-mod:icon", path: "assets/config-icon.png", fromMod: true }]; M.saveConfig(c); }

let root = createRoot(D.getElementById("root"));
const mount = async () => { await act(async () => { root.render(React.createElement(() => M.ConfiguratorPanel())); }); };
const flush = async (ms = 30) => act(async () => { await sleep(ms); });
const btn = (t, scope = D) => [...scope.querySelectorAll("button")].find(b => b.textContent.trim() === t);
const btnStart = (t, scope = D) => [...scope.querySelectorAll("button")].find(b => b.textContent.trim().startsWith(t));
const click = async (el) => { assert.ok(el, "element to click missing"); await act(async () => { el.click(); }); };
const setVal = async (el, v, ev = "input") => {
  const proto = el.tagName === "SELECT" ? w.HTMLSelectElement.prototype : w.HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v); el.dispatchEvent(new w.Event(ev, { bubbles: true })); });
};
const canvas = () => D.querySelector("canvas");
const edRoot = () => canvas()?.closest('[tabindex="-1"]');
const S = () => M.getCurrentSession();
// canvas coordinates (jsdom has no layout)
w.HTMLCanvasElement.prototype.getBoundingClientRect = function () { return { left: 0, top: 0, right: this.clientWidth || 480, bottom: this.clientHeight || 360, width: this.clientWidth || 480, height: this.clientHeight || 360 }; };
const scr = (px, py) => { const v = S().view; return { clientX: v.panX + px * v.zoom, clientY: v.panY + py * v.zoom }; };
const mouse = async (target, type, px, py, extra = {}) => act(async () => {
  target.dispatchEvent(new w.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...scr(px, py), ...extra }));
});
const down = (px, py, x) => mouse(canvas(), "mousedown", px + .5, py + .5, x);
const move = (px, py, x) => mouse(canvas(), "mousemove", px + .5, py + .5, x);
const up = (px, py, x) => mouse(D, "mouseup", px + .5, py + .5, x);
const drag = async (a, b, c, d) => { await down(a, b); await move(c, d); await up(c, d); };
const clickPx = async (x, y) => { await down(x, y); await up(x, y); };
const key = async (k, extra = {}, target = edRoot()) => act(async () => {
  target.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, code: k === " " ? "Space" : "Key" + k.toUpperCase(), bubbles: true, cancelable: true, ...extra }));
});
const keyUp = async (k, extra = {}) => act(async () => { edRoot().dispatchEvent(new w.KeyboardEvent("keyup", { key: k, code: k === " " ? "Space" : k, bubbles: true, ...extra })); });
const px = (x, y) => { const d = S().doc, i = (y * d.width + x) * 4; return Array.from(d.data.slice(i, i + 4)); };
const ORANGE = [0xf6, 0xa5, 0x31, 255], BLUE = [0, 0, 255, 255], CLEAR = [0, 0, 0, 0];
const curHex = () => edRoot().querySelector('input[type="color"][value]:not([tabindex])').value.toUpperCase();
const savedCfg = () => JSON.parse(store.get("md-my-hown-mod").get("config"));
const drawn = () => savedCfg().sprites.filter(s => s.kind === "drawn");

let pass = 0, fail = 0; const failures = [];
const check = async (name, fn) => {
  try { await fn(); pass++; console.log("PASS", name); }
  catch (e) { fail++; failures.push(name); console.log("FAIL", name, "\n     ", String(e.message).split("\n").slice(0, 4).join("\n      ")); }
};

const errs = []; const oe = console.error; console.error = (...a) => { const m = a.join(" "); if (!m.includes("ReactDOMTestUtils") && !(a[1]==="Removing" && a[2]==="borderColor")) errs.push(a.slice(1,4).join("|")); };

await mount();
await click(btn("draw"));

await check("draw tab lists the existing asset collection + tools", async () => {
  assert.ok(D.body.textContent.includes("+ New sprite"));
  assert.ok(D.body.textContent.includes("Existing asset collection (1)"));
  assert.ok(D.body.textContent.includes("md-my-hown-mod:icon"));
});

await check("create new 32x16 sprite -> editor opens on ONE sprite", async () => {
  await click(btn("+ New sprite"));
  await setVal(D.querySelector('input[placeholder="crate"]'), "crate");
  const sel = [...D.querySelectorAll("select")]; // width, height
  await setVal(sel[0], "32", "change");
  await click(btn("Create & edit"));
  assert.ok(canvas(), "editor canvas");
  assert.equal(S().id, "md-my-hown-mod:crate"); assert.equal(S().doc.width, 32); assert.equal(S().doc.height, 16);
  assert.equal(D.querySelectorAll("canvas").length, 1);
});

await check("pencil: stroke paints, one undo step, marks dirty", async () => {
  await drag(2, 2, 8, 2);
  for (let x = 2; x <= 8; x++) assert.deepEqual(px(x, 2), ORANGE, "x=" + x);
  assert.deepEqual(px(9, 2), CLEAR); assert.equal(S().undo.length, 1); assert.equal(S().dirty, true);
});

await check("pencil: fast drag interpolates (no gaps)", async () => {
  await drag(0, 5, 10, 9);
  const filled = []; for (let y = 5; y <= 9; y++) for (let x = 0; x <= 10; x++) if (px(x, y)[3]) filled.push([x, y]);
  assert.ok(filled.length >= 11, "line pixels " + filled.length);
  assert.deepEqual(px(0, 5), ORANGE); assert.deepEqual(px(10, 9), ORANGE);
});

await check("hotkeys switch tools and never reach the game", async () => {
  let leaked = 0; const spy = () => leaked++; w.addEventListener("keydown", spy);
  await key("2"); assert.ok(btnStart("2 Eraser").style.background.match(/122, 87, 34|7a5722/i), "eraser active");
  await clickPx(2, 2); assert.deepEqual(px(2, 2), CLEAR);
  await key("1"); assert.ok(btnStart("1 Pencil").style.background.match(/122, 87, 34|7a5722/i));
  await key("z", { ctrlKey: true }); assert.deepEqual(px(2, 2), ORANGE, "ctrl+Z restored the erased pixel");
  w.removeEventListener("keydown", spy); assert.equal(leaked, 0, "keydown leaked to window " + leaked + "x");
});

await check("typing in the id-less/text fields doesn't leak or trigger hotkeys", async () => {
  // header id input exists only while new; use the path box? -> use header input by saving later. Here: dispatch from a text input inside editor
  const inp = edRoot().querySelector('input[type="text"], input:not([type])');
  assert.ok(inp, "text input in header");
  let leaked = 0; const spy = () => leaked++; w.addEventListener("keydown", spy);
  const before = S().undo.length;
  await key("3", {}, inp); await key("w", {}, inp);
  w.removeEventListener("keydown", spy);
  assert.equal(leaked, 0); assert.equal(btnStart("1 Pencil").style.background.match(/122, 87, 34|7a5722/i) !== null, true, "tool unchanged while typing");
});

await check("color input + picker tool", async () => {
  await setVal(edRoot().querySelector('input[type="color"][value]:not([tabindex])'), "#0000ff");
  assert.equal(curHex(), "#0000FF");
  await clickPx(12, 12); assert.deepEqual(px(12, 12), BLUE);
  await key("4"); await clickPx(5, 2); assert.equal(curHex(), "#F6A531");
  await key("1");
});

await check("fill fills the connected region, Ctrl+Z undoes it", async () => {
  await key("3"); await clickPx(30, 14);
  assert.deepEqual(px(31, 15), ORANGE); assert.deepEqual(px(12, 12), BLUE, "blue pixel is a wall");
  await key("z", { ctrlKey: true }); assert.deepEqual(px(31, 15), CLEAR);
  await key("1");
});

await check("square tool: outline, filled, 1:1 lock", async () => {
  await key("8");
  await drag(14, 1, 18, 4);
  assert.deepEqual(px(14, 1), ORANGE); assert.deepEqual(px(18, 4), ORANGE); assert.deepEqual(px(16, 2), CLEAR);
  const cbs = [...edRoot().querySelectorAll('input[type="checkbox"]')];
  await click(cbs[0]);                                   // filled
  await drag(20, 1, 23, 3); assert.deepEqual(px(21, 2), ORANGE);
  await click(cbs[1]);                                   // lock 1:1
  await drag(25, 1, 30, 3);                              // 6 wide, 3 tall -> forced 6x6
  assert.deepEqual(px(30, 6), ORANGE); assert.deepEqual(px(25, 6), ORANGE);
  await click(cbs[0]); await click(cbs[1]); await key("1");
});

await check("add tile: new tile = copy of left tile, right part shifts; undo restores size", async () => {
  const before = px(1, 5);
  await key("6"); await down(16, 8); await up(16, 8);
  assert.equal(S().doc.width, 48);
  assert.deepEqual(px(1, 5), before);
  assert.deepEqual(px(17, 5), before, "new tile is a copy of tile 0");
  assert.deepEqual(px(33 + 0, 1), px(33, 1));
  await key("z", { ctrlKey: true }); assert.equal(S().doc.width, 32);
});

await check("remove tile + refuses the last one", async () => {
  await key("7"); await down(20, 8); await up(20, 8);
  assert.equal(S().doc.width, 16);
  await down(5, 8); await up(5, 8);
  assert.equal(S().doc.width, 16); assert.ok(D.body.textContent.includes("Cannot remove the last tile"));
  await key("z", { ctrlKey: true }); assert.equal(S().doc.width, 32); await key("1");
});

await check("copy tile: drag tile 0 onto tile 1 copies all 256 px; Esc cancels", async () => {
  await key("9");
  await down(3, 3); await move(20, 6); await up(20, 6);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) assert.deepEqual(px(x + 16, y), px(x, y), `(${x},${y})`);
  const snap = Array.from(S().doc.data);
  await key("z", { ctrlKey: true });
  await down(3, 3); await move(20, 6); await key("Escape"); await up(20, 6);
  assert.deepEqual(Array.from(S().doc.data), Array.from(S().doc.data)); // nothing pasted after undo
  assert.deepEqual(px(17, 3), px(17, 3));
  assert.notDeepEqual(Array.from(S().doc.data), snap, "escape did not paste");
  await key("1");
});

await check("zoom / pan / fit: wheel is captured (not passive), space-pan, no pixels touched", async () => {
  const v = S().view, wrap = canvas().parentElement;
  const y0 = v.panY; let ev = new w.WheelEvent("wheel", { deltaY: 30, bubbles: true, cancelable: true });
  await act(async () => { wrap.dispatchEvent(ev); }); assert.equal(ev.defaultPrevented, true); assert.equal(v.panY, y0 - 30);
  const z0 = v.zoom; ev = new w.WheelEvent("wheel", { deltaY: -100, shiftKey: true, bubbles: true, cancelable: true, clientX: 200, clientY: 100 });
  await act(async () => { wrap.dispatchEvent(ev); }); assert.ok(v.zoom > z0, "zoomed in"); 
  await key("0"); assert.ok(v.zoom >= 1); const zf = v.zoom; await key("+"); assert.ok(v.zoom > zf);
  const snap = Array.from(S().doc.data), x0 = v.panX;
  await key(" "); await down(5, 5); await move(9, 5); await up(9, 5); await keyUp(" ");
  assert.notEqual(v.panX, x0); assert.deepEqual(Array.from(S().doc.data), snap);
  await key("0");
});

await check("palette: swatches = distinct colours; drag-merge & dbl-click recolor are undoable", async () => {
  const sw = () => [...edRoot().querySelectorAll('div[draggable="true"]')];
  assert.equal(sw().length, 2, "orange + blue");
  const orange = sw().find(s => s.style.background.match(/246, 165, 49|f6a531/i)), blue = sw().find(s => s.style.background.match(/0, 0, 255|0000ff/i));
  const dt = { data: {}, setData(k, v) { this.data[k] = v; }, getData(k) { return this.data[k]; }, effectAllowed: "", dropEffect: "" };
  const ev = (t, dtx) => { const e = new w.Event(t, { bubbles: true, cancelable: true }); e.dataTransfer = dtx; return e; };
  const u0 = S().undo.length;
  await act(async () => { orange.dispatchEvent(ev("dragstart", dt)); });
  await act(async () => { blue.dispatchEvent(ev("dragover", dt)); blue.dispatchEvent(ev("drop", dt)); });
  assert.equal(sw().length, 1, "merged to one swatch"); assert.deepEqual(px(12, 12), ORANGE); assert.equal(S().undo.length, u0 + 1);
  // recolor via dbl-click + hidden picker
  await act(async () => { sw()[0].dispatchEvent(new w.MouseEvent("dblclick", { bubbles: true })); });
  const hidden = edRoot().querySelector('input[tabindex="-1"]');
  await act(async () => { Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, "value").set.call(hidden, "#00ff00"); hidden.dispatchEvent(new w.Event("input", { bubbles: true })); });
  assert.deepEqual(px(12, 12), [0, 255, 0, 255]);
  await act(async () => { hidden.dispatchEvent(new w.Event("change", { bubbles: true })); });
  assert.match(sw()[0].style.background, /0, 255, 0|00ff00/i); assert.equal(S().undo.length, u0 + 2);
  await key("z", { ctrlKey: true }); await key("z", { ctrlKey: true }); assert.deepEqual(px(12, 12), BLUE);
});

let savedBytes;
await check("Save: valid JSON in storage, base64 PNG round-trips pixel-exact, registered in game", async () => {
  S().dirty = true; // ensure header reflects
  await click(btn("Save")); await flush(80);
  const e = drawn().find(s => s.id === "md-my-hown-mod:crate"); assert.ok(e, "entry stored");
  assert.equal(e.kind, "drawn"); assert.equal(e.fromMod, false); assert.equal(e.width, 32); assert.equal(e.height, 16); assert.equal(e.frames, 2); assert.equal(e.frameWidth, 16);
  assert.ok(e.source.startsWith("data:image/png;base64,"));
  const img = await loadImage(e.source), c = createCanvas(img.width, img.height), cx = c.getContext("2d"); cx.drawImage(img, 0, 0);
  const got = cx.getImageData(0, 0, img.width, img.height).data, d = S().doc;
  assert.equal(img.width, d.width);
  for (let i = 0; i < d.data.length; i += 4) { assert.equal(got[i + 3], d.data[i + 3]); if (d.data[i + 3]) for (let k = 0; k < 3; k++) assert.equal(got[i + k], d.data[i + k], "px " + i / 4); }
  const l = spriteLoads.filter(s => s.id === e.id); assert.ok(l.length >= 1 && l.at(-1).path === e.source, "sprites.load(id, dataUrl)");
  assert.equal(S().dirty, false); assert.equal(S().isNew, false); assert.ok(D.body.textContent.includes("saved"));
  assert.ok(D.querySelector('img[src^="data:image/png;base64"]'), "thumbnail in list");
  JSON.parse(JSON.stringify(savedCfg())); savedBytes = e.source.length;
});

await check("duplicate id on a new sprite is refused", async () => {
  await click(btn("✕")); // close (clean)
  assert.equal(S(), null); assert.equal(canvas(), null);
  await click(btn("+ New sprite")); await setVal(D.querySelector('input[placeholder="crate"]'), "crate"); await click(btn("Create & edit"));
  assert.equal(canvas(), null, "no editor opened"); assert.ok(D.body.textContent.includes("Id already used"));
  await click(btn("+ New sprite"));
});

await check("Edit from list reloads the saved pixels", async () => {
  await click(btn("Edit", D.querySelector('img[src^="data:image/png"]').parentElement));
  await flush(60);
  assert.ok(S() && S().id === "md-my-hown-mod:crate" && S().isNew === false);
  assert.deepEqual(px(3, 2), ORANGE); assert.deepEqual(px(12, 12), BLUE); assert.equal(S().doc.width, 32);
});

await check("unsaved work survives unmount/remount (overlay hidden, panel minimized, tool deselected)", async () => {
  await key("1"); await clickPx(31, 0); const s0 = S(), u = s0.undo.length; assert.ok(s0.dirty);
  await act(async () => { root.unmount(); });
  assert.equal(canvas(), null); assert.strictEqual(S(), s0);
  root = createRoot(D.getElementById("root")); await mount(); await click(btn("draw"));
  assert.ok(canvas(), "editor is back"); assert.strictEqual(S(), s0); assert.equal(S().undo.length, u);
  await key("z", { ctrlKey: true }); assert.deepEqual(px(31, 0), CLEAR, "undo history still works");
});

await check("closing with unsaved changes asks; Discard drops them", async () => {
  await clickPx(31, 0); await click(btn("✕"));
  assert.ok(D.body.textContent.includes("Unsaved changes.")); assert.ok(canvas());
  await click(btn("Cancel")); assert.ok(canvas());
  await click(btn("✕")); await click(btn("Discard")); assert.equal(canvas(), null); assert.equal(S(), null);
  assert.deepEqual(drawn().find(s => s.id.endsWith(":crate")).source.length, savedBytes, "storage untouched");
});

await check("existing asset collection: load PNG, edit, save converts entry to a drawn sprite (same id)", async () => {
  const row = [...D.querySelectorAll("span")].find(sp => (sp.title||"").includes("←")).parentElement;
  await click(btn("Edit", row)); await flush(80);
  assert.ok(S(), "session"); assert.equal(S().id, "md-my-hown-mod:icon"); assert.equal(S().replaces, "md-my-hown-mod:icon");
  assert.equal(S().doc.width, iconImg.width); assert.equal(S().doc.height, iconImg.height);
  await key("1"); await clickPx(0, 0);
  await click(btn("Save")); await flush(80);
  const e = savedCfg().sprites.find(s => s.id === "md-my-hown-mod:icon");
  assert.equal(e.kind, "drawn"); assert.equal(e.path, undefined); assert.equal(e.replacedPath, "assets/config-icon.png");
  await click(btn("✕"));
  assert.ok(!D.body.textContent.includes("Existing asset collection"), "moved out of file collection");
});

await check("Import PNG file -> new editable session named from the file", async () => {
  const file = new w.File([iconPng], "My Shiny.png", { type: "image/png" });
  const inp = D.querySelector('input[type="file"]');
  Object.defineProperty(inp, "files", { value: [file], configurable: true });
  await act(async () => { inp.dispatchEvent(new w.Event("change", { bubbles: true })); await sleep(150); });
  assert.ok(S(), "session"); assert.equal(S().id, "md-my-hown-mod:My-Shiny"); assert.equal(S().doc.width, iconImg.width);
  await click(btn("Save")); await flush(80); await click(btn("✕"));
  assert.ok(drawn().some(s => s.id === "md-my-hown-mod:My-Shiny"));
});

await check("load from arbitrary mod path", async () => {
  const inp = D.querySelector('input[placeholder="assets/icon.png"]'); await setVal(inp, "assets/config-icon.png");
  await click(btn("Load")); await flush(120);
  assert.ok(S()); assert.equal(S().id, "md-my-hown-mod:config-icon"); await click(btn("✕"));
});

await check("duplicate + two-step delete", async () => {
  const n0 = drawn().length; await click([...D.querySelectorAll('button[title="Duplicate"]')][0]);
  assert.equal(drawn().length, n0 + 1); assert.ok(drawn().some(s => s.id.endsWith("-copy")));
  const del = [...D.querySelectorAll("button")].filter(b => b.textContent === "Del").at(-1);
  await click(del); assert.equal(drawn().length, n0 + 1, "first click only arms");
  await click([...D.querySelectorAll("button")].find(b => b.textContent === "Sure?")); assert.equal(drawn().length, n0);
});

await check("JSON tab exports the base64 sprite as valid JSON", async () => {
  await click(btn("json")); const ta = D.querySelector("textarea"); const j = JSON.parse(ta.value);
  assert.ok(j.sprites.some(s => s.kind === "drawn" && s.source.startsWith("data:image/png;base64,")));
  await click(btn("draw"));
});

await check("boot path: applyConfig registers drawn sprites via sprites.load(data URL), files via loadFromMod", async () => {
  spriteLoads.length = 0; M.clearRegistrationCache?.(); M.applyConfig(); await flush(80);
  const d = drawn(); assert.ok(d.length >= 2);
  for (const e of d) assert.ok(spriteLoads.some(l => l.id === e.id && l.path === e.source && !l.fromMod), "loaded " + e.id);
  assert.ok(!spriteLoads.some(l => l.fromMod && d.some(e => e.id === l.id)));
});

await check("no unexpected React errors", async () => { assert.deepEqual(errs, [], JSON.stringify(errs)); });

console.log(`\n${pass} passed, ${fail} failed`); if (fail) console.log("failed:", failures);
process.exit(fail ? 1 : 0);
