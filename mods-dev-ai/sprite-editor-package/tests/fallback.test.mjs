import { setup, pngDataUrl } from "./env.mjs";
import assert from "node:assert/strict";
const url = pngDataUrl(16,16,c=>{c.fillStyle="#f00";c.fillRect(0,0,4,4);});
let n=0, ok=(name)=>console.log("PASS",name);
{ // A: game accepts data URLs
  const env = await setup(); const M = await import("./out/mod.mjs");
  const r = await M.registerDataUrlSprite("m:a", url, {});
  assert.deepEqual([r.ok,r.via],[true,"data-url"]); assert.equal(env.spriteLoads.length,1); ok("data URL accepted -> 1 load call");
}
{ // B: game rejects data URLs -> blob fallback
  const env = await setup({rejectDataUrls:true}); const M = await import("./out/mod.mjs");
  const r = await M.registerDataUrlSprite("m:b", url, {frameWidth:16});
  assert.deepEqual([r.ok,r.via],[true,"blob-url"]);
  assert.ok(env.spriteLoads[0].path.startsWith("data:") && env.spriteLoads[1].path.startsWith("blob:"));
  assert.deepEqual(env.spriteLoads[1].opts,{frameWidth:16}); ok("data URL rejected -> blob URL fallback, options forwarded");
  const r2 = await M.registerDataUrlSprite("m:b", url, {}); assert.ok(r2.ok); ok("re-save of same id works (blob released)");
}
{ // C: game rejects everything / no sprites api -> never throws
  const env = await setup(); env.api.sprites.load = async()=>{ throw new Error("nope"); };
  const M = await import("./out/mod.mjs");
  const r = await M.registerDataUrlSprite("m:c", url, {}); assert.equal(r.ok,false); assert.match(r.error,/nope/); ok("total failure -> {ok:false,error}, no throw");
  delete env.api.sprites.load; const r2 = await M.registerDataUrlSprite("m:c", url); assert.equal(r2.ok,false); ok("sprites.load missing -> handled");
}
{ // D: load resolves but sprite not actually registered (getById null) -> reported as not ok
  const env = await setup(); env.api.sprites.load = async()=>{}; const M = await import("./out/mod.mjs");
  const r = await M.registerDataUrlSprite("m:d", url, {}); assert.equal(r.ok,false); ok("silent no-op load is detected via getById");
}
process.exit(0);
