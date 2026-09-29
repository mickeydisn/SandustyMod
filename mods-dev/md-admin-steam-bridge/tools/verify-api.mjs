#!/usr/bin/env node
/**
 * verify-api.mjs — check that the engine calls a mod makes actually exist.
 *
 * Reads a list of `namespace.method` strings and reports, for each, whether it is
 * present in (a) the shipped typings and (b) the LIVE game over CDP.
 *
 *   node verify-api.mjs elements.getResolvedTypeAtCell grid.mutate …
 *   node verify-api.mjs --file list.txt
 */
import { readFile } from "node:fs/promises";

const PORT = process.env.CDP_PORT || "9222";
const TYPINGS = process.env.TYPINGS ||
  "/Users/mickey/MyCode/GitHub/SandustyMod/__pakages/__other/sandkit/src/sandkit/api";

// ── what the mod actually calls ───────────────────────────────────────────────
const args = process.argv.slice(2);
const list = args[0] === "--file"
  ? (await readFile(args[1], "utf8")).split("\n").map((s) => s.trim()).filter(Boolean)
  : args;

if (!list.length) {
    console.error("usage: verify-api.mjs <ns.method>… | --file <path>");
    process.exit(1);
}

// ── (a) static: grep the .d.ts files ──────────────────────────────────────────
const files = await readDir(TYPINGS);
const blob = (await Promise.all(
  files.filter((f) => f.endsWith(".d.ts")).map((f) => readFile(`${TYPINGS}/${f}`, "utf8"))
)).join("\n");

function inTypings(dotted) {
  const [ns, ...rest] = dotted.split(".");
  const member = rest.join(".");
  // The typings are per-namespace files; match a declaration of the member there.
  const nsFile = files.find((f) => f === `${ns}.d.ts`);
  if (!nsFile) return { ok: false, why: "no typings file" };
  const src = blobs.get(nsFile);
  const re = new RegExp(`\\b${member.split(".").join("\\\\.")}\\b`);
  return { ok: re.test(src), why: nsFile };
}

async function readDir(p) {
  const { readdir } = await import("node:fs/promises");
  return await readdir(p);
}
const blobs = new Map();
for (const f of files.filter((f) => f.endsWith(".d.ts"))) {
  blobs.set(f, await readFile(`${TYPINGS}/${f}`, "utf8"));
}

// ── (b) live: ask the running game ────────────────────────────────────────────
let live = null;
try {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const targets = await res.json();
  const page = targets.find((t) => t.type === "page" && !t.url.startsWith("devtools://"));
  if (page) {
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) {
        const { resolve, reject } = pending.get(m.id);
        pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      }
    });
    await new Promise((r) => ws.addEventListener("open", r, { once: true }));
    const send = (method, params) =>
      new Promise((resolve, reject) => {
        const i = ++id;
        pending.set(i, { resolve, reject });
        ws.send(JSON.stringify({ id: i, method, params }));
      });
    // The game exposes its api on the mod sandbox; ask the page for a generic probe.
    const r = await send("Runtime.evaluate", {
      expression: `(() => {
        const req = ${JSON.stringify(list)};
        const out = {};
        for (const d of req) {
          const parts = d.split(".");
          let node = globalThis.sandkit?.api;
          for (const p of parts) {
            if (node == null) break;
            node = node[p];
          }
          out[d] = typeof node;
        }
        return JSON.stringify(out);
      })()`,
      returnByValue: true,
    });
    live = JSON.parse(r.result.value);
    ws.close();
  }
} catch (e) {
  console.error(`(live check unavailable: ${e.message})\n`);
}

// ── report ────────────────────────────────────────────────────────────────────
console.log("CALL".padEnd(42) + "TYPINGS".padEnd(10) + "LIVE");
console.log("-".repeat(64));
let bad = 0;
for (const d of list) {
  const t = inTypings(d);
  const l = live ? live[d] : "n/a";
  const liveOk = l === "function";
  if (!t.ok || (live && !liveOk)) bad++;
  const mark = (b) => (b === false ? "MISSING" : b === true ? "ok" : "-");
  console.log(
    d.padEnd(42) + mark(t.ok).padEnd(10) + `${l}${live && !liveOk ? "  ← NOT IN GAME" : ""}`,
  );
}
console.log(`\n${list.length - bad}/${list.length} resolved cleanly.`);
if (bad && live === null) console.log("Start the game with a debug port to get live confirmation.");
