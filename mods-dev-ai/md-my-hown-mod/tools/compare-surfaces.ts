/**
 * compare-surfaces.ts — Phase 0: reconcile the three sandkit api surfaces.
 *
 * There is more than one `api` in this project and they are NOT the same thing:
 *
 *   1. `sandkit.api`         — the PUBLIC mod api (context-free). Declared in
 *                              __pakages/__other/sandkit/src/sandkit/api/*.d.ts
 *   2. `sandkit.engine.api`  — the engine escape hatch (context-first). Shipped
 *                              in the bundle as the `Dt` object in 46781.js
 *   3. `sandkit.api` (worker)— the worker-thread variant, for worker.ts mods
 *
 * The mod's entry is main.js, so surface 1 is what the mod is supposed to use.
 * This tool reports where the three disagree, which is the version drift that
 * makes blind trust in any single one of them unsafe.
 *
 * Usage: deno run -A tools/compare-surfaces.ts
 */

const HERE = new URL(".", import.meta.url).pathname;
const REPO = HERE.replace(/\/$/, "").split("/").slice(0, -3).join("/") + "/";
const ROOT = HERE.replace(/\/tools\/$/, "") + "/";
const D = (p: string) => `${REPO}${p}`;

const PUBLIC_API_DTS = D("__pakages/__other/sandkit/src/sandkit/api/sandkit-api.d.ts");
const WORKER_API_DTS =
    D("__pakages/__other/sandkit/src/worker/sandkit-api.d.ts");
const INDEX_JSON = `${ROOT}doc-bundel/api-index.json`;

async function readNs(path: string): Promise<Set<string>> {
    const text = await Deno.readTextFile(path);
    const out = new Set<string>();
    for (const m of text.matchAll(/^\s{2}([A-Za-z0-9_$]+):\s*typeof import/gm)) {
        out.add(m[1]);
    }
    return out;
}

/** does this identifier appear anywhere in the shipped main-thread bundle? */
async function inBundle(name: string): Promise<string[]> {
    const cmd = new Deno.Command("rg", {
        args: ["-l", `--no-messages`, name, `${D("__bundel/modules/bundel.js")}`],
        stdout: "piped",
        stderr: "null",
    });
    const { code, stdout } = await cmd.output();
    if (code !== 0) return [];
    return new TextDecoder().decode(stdout).trim().split("\n").filter(Boolean);
}

if (import.meta.main) {
    const engine = new Set(
        Object.keys(
            JSON.parse(await Deno.readTextFile(INDEX_JSON)).index,
        ),
    );
    const pub = await readNs(PUBLIC_API_DTS);
    const worker = await readNs(WORKER_API_DTS);

    const rel = (s: Set<string>) => [...s].sort();
    const diff = (a: Set<string>, b: Set<string>) => rel(a).filter((x) => !b.has(x));

    console.log("=== surface sizes ===");
    console.log(`sandkit.api          (public, .d.ts) : ${pub.size}`);
    console.log(`sandkit.engine.api   (bundle Dt)    : ${engine.size}`);
    console.log(`sandkit.api (worker) (.d.ts)         : ${worker.size}`);

    console.log("\n=== public .d.ts namespaces NOT in the shipped bundle ===");
    const missing = diff(pub, engine);
    console.log(`(${missing.length})`);
    for (const n of missing) {
        const hits = await inBundle(n);
        console.log(`  ${n.padEnd(22)} ${hits.length ? "partial: " + hits[0] : "ABSENT from bundle"}`);
    }

    console.log("\n=== bundle engine namespaces NOT declared in the public .d.ts ===");
    const extra = diff(engine, pub);
    console.log(`(${extra.length}) ${extra.join(" ")}`);

    console.log("\n=== public namespaces the mod actually calls ===");
    const modText: string[] = [];
    await (async function walk(dir: string) {
        for await (const e of Deno.readDir(dir)) {
            const p = `${dir}/${e.name}`;
            if (e.isDirectory) await walk(p);
            else if (e.name.endsWith(".ts")) {
                modText.push(await Deno.readTextFile(p));
            }
        }
    })(`${ROOT}src`);
    const used = new Set<string>();
    for (const t of modText) {
        // Only real host-api access counts. The mod also has its OWN module
        // imported as `./api.ts`, so a bare `api.foo` is a local import, not the
        // game. Requiring a preceding `.` (i.e. `g()?.api?.x` / `sandkit.api.x`)
        // excludes those without dropping genuine host calls.
        for (const m of t.matchAll(/\.api\??\.([A-Za-z0-9_$]+)/g)) used.add(m[1]);
    }
    const sorted = [...used].sort();
    const inPub = sorted.filter((n) => pub.has(n));
    const notPub = sorted.filter((n) => !pub.has(n));
    const notBundle = sorted.filter((n) => !engine.has(n));
    console.log(`called: ${sorted.length}`);
    console.log(`  in public .d.ts (${inPub.length}) : ${inPub.join(" ")}`);
    console.log(`  NOT in public .d.ts (${notPub.length}) : ${notPub.join(" ")}`);
    console.log(`  NOT in shipped bundle (${notBundle.length}) : ${notBundle.join(" ")}`);
}
