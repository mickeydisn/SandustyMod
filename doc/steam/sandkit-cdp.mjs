#!/usr/bin/env node
/**
 * sandkit-cdp — talk to a running Sandustry game over the Chrome DevTools Protocol.
 *
 * The game is an Electron app. Launch it with `--remote-debugging-port=9222`
 * and this script attaches to the renderer, so you can evaluate expressions in
 * the page and stream the console.
 *
 * Usage:
 *   node sandkit-cdp.mjs eval '<expression>'      evaluate an expression, print the result
 *   node sandkit-cdp.mjs log [ms]                  stream console output (default 15000ms)
 *   node sandkit-cdp.mjs file '<path>'             evaluate a JS file as the expression
 */
const PORT = process.env.CDP_PORT || "9222";
const PROBE = `(() => {
  const el = document.querySelectorAll("*");
  for (const e of el) {
    if (Object.keys(e).some((k) => k.startsWith("__reactContainer$"))) return "ok";
  }
  return "no-root";
})()`;

async function attach({ waitMs = 0 } = {}) {
  // Mods boot within a second or two of the window opening, so a `log` run
  // usually has to attach *before* the game is fully up. Poll until it answers.
  const deadline = Date.now() + waitMs;
  for (;;) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const targets = await res.json();
      // Skip the DevTools window itself; we want the game page.
      const page = targets.find((t) =>
        t.type === "page" && !t.url.startsWith("devtools://")
      );
      if (page) return page;
    } catch {
      // not listening yet
    }
    if (Date.now() > deadline) {
      throw new Error(
        "no Sandustry page found — is the game running with --remote-debugging-port?",
      );
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  const events = [];
  const listeners = [];

  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      return;
    }
    events.push(msg);
    for (const fn of listeners) fn(msg);
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  const ready = new Promise((r) => ws.addEventListener("open", r, { once: true }));

  return { ws, send, events, on: (fn) => listeners.push(fn), ready };
}

function render(msg) {
  if (msg.method === "Runtime.consoleAPICalled") {
    const text = msg.params.args
      .map((a) => a.value ?? a.description ?? JSON.stringify(a.preview ?? {}))
      .join(" ");
    return `[${msg.params.type}] ${text}`;
  }
  if (msg.method === "Runtime.exceptionThrown") {
    const d = msg.params.exceptionDetails;
    return `[EXCEPTION] ${d.text} ${d.exception?.description ?? ""}`;
  }
  return null;
}

const [cmd, ...rest] = process.argv.slice(2);
const page = await attach({ waitMs: Number(process.env.CDP_WAIT_MS || 0) });
const cdp = connect(page.webSocketDebuggerUrl);
await cdp.ready;
await cdp.send("Runtime.enable");
await cdp.send("Page.enable");

if (cmd === "eval" || cmd === "file") {
  const src = cmd === "file"
    ? await (await import("node:fs/promises")).readFile(rest[0], "utf8")
    : rest.join(" ");
  const r = await cdp.send("Runtime.evaluate", {
    expression: src,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    console.error(`EXCEPTION: ${d.text} ${d.exception?.description ?? ""}`);
    process.exitCode = 1;
  } else {
    const v = r.result.value;
    console.log(typeof v === "string" ? v : JSON.stringify(v, null, 2));
  }
  cdp.ws.close();
} else if (cmd === "log") {
  const ms = Number(rest[0] || 15000);
  cdp.on((msg) => {
    const line = render(msg);
    if (line) console.log(line);
  });
  console.log(`--- streaming console for ${ms}ms (Ctrl+C to stop) ---`);
  await new Promise((r) => setTimeout(r, ms));
  cdp.ws.close();
} else if (cmd === "reload") {
  await cdp.send("Page.reload", { ignoreCache: true });
  console.log("page reloaded");
  cdp.ws.close();
} else {
  console.log("usage: sandkit-cdp.mjs eval|log|reload|file");
  cdp.ws.close();
}
