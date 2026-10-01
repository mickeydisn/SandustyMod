import test from "node:test";
import assert from "node:assert/strict";
import * as E from "./out/engine.mjs";

const RED=[255,0,0,255], BLUE=[0,0,255,255];
const px=(d,x,y)=>Array.from(E.getPixel(d,x,y));

test("createDoc / setPixel / bounds", ()=>{
  const d=E.createDoc(16,16);
  E.setPixel(d,3,4,...RED); assert.deepEqual(px(d,3,4),RED);
  E.setPixel(d,-1,0,...RED); E.setPixel(d,16,0,...RED); E.setPixel(d,0,16,...RED); // ignored
  assert.equal(E.scanPalette(d).colors.length,1);
});

test("bresenham has no gaps and hits both ends", ()=>{
  const pts=E.lineCells(0,0,15,7);
  assert.deepEqual(pts[0],[0,0]); assert.deepEqual(pts.at(-1),[15,7]);
  for(let i=1;i<pts.length;i++){ assert.ok(Math.abs(pts[i][0]-pts[i-1][0])<=1 && Math.abs(pts[i][1]-pts[i-1][1])<=1); }
  assert.equal(E.lineCells(5,5,5,5).length,1);
  const back=E.lineCells(10,3,2,9); assert.deepEqual(back[0],[10,3]); assert.deepEqual(back.at(-1),[2,9]);
});

test("flood fill: fills region only, respects walls, no-op on same colour", ()=>{
  const d=E.createDoc(16,16);
  E.drawRect(d,0,0,15,15,false,BLUE);            // frame
  E.drawRect(d,8,1,8,14,true,BLUE);              // wall splitting the inside
  assert.equal(E.floodFill(d,2,2,RED),true);
  assert.deepEqual(px(d,2,2),RED); assert.deepEqual(px(d,7,14),RED);
  assert.deepEqual(px(d,12,5),[0,0,0,0]);        // other side untouched
  assert.deepEqual(px(d,8,5),BLUE);              // wall untouched
  assert.equal(E.floodFill(d,2,2,RED),false);    // already that colour
  assert.equal(E.floodFill(d,99,99,RED),false);  // out of bounds
});

test("rect outline / filled / lock-square clamping", ()=>{
  const d=E.createDoc(16,16);
  E.drawRect(d,2,2,5,4,false,RED);
  assert.deepEqual(px(d,2,2),RED); assert.deepEqual(px(d,5,4),RED); assert.deepEqual(px(d,3,3),[0,0,0,0]);
  E.drawRect(d,8,8,10,10,true,BLUE); assert.deepEqual(px(d,9,9),BLUE);
  // drag right/down by (10,3) with lock => 10x10 square, but clamp at sprite edge
  assert.deepEqual(E.constrainRectEnd(d,2,2,12,5,true),[12,12]);
  assert.deepEqual(E.constrainRectEnd(d,10,2,15,5,true),[15,7]);   // 5 wide -> 5 tall
  assert.deepEqual(E.constrainRectEnd(d,10,10,40,40,true),[15,15]);// clamped by edge
  assert.deepEqual(E.constrainRectEnd(d,4,4,-3,-9,false),[0,0]);   // clamped, not square
  assert.deepEqual(E.constrainRectEnd(d,4,4,0,0,true),[0,0]);      // negative direction
});

test("insertTile copies the tile on its left, shifts the right part", ()=>{
  let d=E.createDoc(32,16);
  E.setPixel(d,1,1,...RED);      // tile 0
  E.setPixel(d,17,1,...BLUE);    // tile 1
  const n=E.insertTile(d,16);    // between tile0 and tile1
  assert.equal(n.width,48);
  assert.deepEqual(px(n,1,1),RED);       // tile 0 unchanged
  assert.deepEqual(px(n,17,1),RED);      // NEW tile = copy of tile 0
  assert.deepEqual(px(n,33,1),BLUE);     // old tile 1 shifted by 16
  assert.equal(d.width,32);              // input not mutated
  const front=E.insertTile(d,0);         // at the very start -> transparent
  assert.equal(front.width,48); assert.deepEqual(px(front,1,1),[0,0,0,0]); assert.deepEqual(px(front,17,1),RED);
  const end=E.insertTile(d,32);          // at the end -> copy of last tile
  assert.equal(end.width,48); assert.deepEqual(px(end,33,1),BLUE);
});

test("removeTile shifts left, refuses the last tile", ()=>{
  let d=E.createDoc(48,16);
  E.setPixel(d,1,1,...RED); E.setPixel(d,17,1,...BLUE); E.setPixel(d,33,1,[0,255,0,255].at(0),255,0,255);
  const n=E.removeTile(d,1);
  assert.equal(n.width,32); assert.deepEqual(px(n,1,1),RED); assert.deepEqual(px(n,17,1),[0,255,0,255]);
  assert.equal(E.removeTile(E.createDoc(16,16),0),null);
  assert.equal(E.removeTile(d,9),null);  // out of range
  // sprite with a partial last tile (20px wide)
  const p=E.createDoc(20,16); assert.equal(E.removeTile(p,1).width,16);
});

test("extract/paste tile round trip, clipped at edges", ()=>{
  const d=E.createDoc(32,16);
  E.drawRect(d,0,0,15,15,true,RED);
  const t=E.extractTile(d,0,0);
  E.pasteTile(d,1,0,t);
  assert.deepEqual(px(d,20,8),RED);
  const edge=E.extractTile(d,1,0); assert.equal(edge.length,16*16*4);
  // tile outside the sprite (row 1 of a 16px-high sprite) is transparent
  assert.ok(E.extractTile(d,0,1).every(v=>v===0));
  E.pasteTile(d,0,5,t);  // fully outside: must not throw or change anything
});

test("recolor + palette (transparent ignored, sorted by hue, counts)", ()=>{
  const d=E.createDoc(16,16);
  E.drawRect(d,0,0,3,0,true,RED); E.setPixel(d,0,1,...BLUE);
  const pal=E.scanPalette(d); assert.equal(pal.colors.length,2); assert.equal(pal.counts["#FF0000"],4);
  assert.ok(E.recolor(d,"#FF0000","#00FF00")); assert.deepEqual(px(d,2,0),[0,255,0,255]);
  assert.equal(E.recolor(d,"#FF0000","#00FF00"),false);        // nothing left
  assert.equal(E.recolor(d,"#00FF00","#00FF00"),false);        // same colour
  // merge: recolour green -> blue collapses the palette to one swatch
  E.recolor(d,"#00FF00","#0000FF"); assert.equal(E.scanPalette(d).colors.length,1);
  // pixels with alpha 0 are never recoloured
  const t=E.createDoc(16,16); assert.equal(E.recolor(t,"#000000","#FFFFFF"),false);
});

test("undo: pixel strokes and structural (size) changes restore exactly", ()=>{
  const s=E.newSession("m:t",E.createDoc(16,16));
  const before=E.snapshotOf(s.doc);
  E.setPixel(s.doc,1,1,...RED); E.pushUndo(s,before);
  assert.equal(s.dirty,true);
  const ins=E.snapshotOf(s.doc); const grown=E.insertTile(s.doc,16); E.pushUndo(s,ins); s.doc=grown;
  assert.equal(s.doc.width,32);
  assert.ok(E.undoStep(s)); assert.equal(s.doc.width,16); assert.deepEqual(px(s.doc,1,1),RED);
  assert.ok(E.undoStep(s)); assert.deepEqual(px(s.doc,1,1),[0,0,0,0]);
  assert.equal(E.undoStep(s),false);
  for(let i=0;i<80;i++) E.pushUndo(s); assert.equal(s.undo.length,E.UNDO_LIMIT);
});

test("frameCount / hex helpers", ()=>{
  assert.equal(E.frameCount(E.createDoc(16,16)),1); assert.equal(E.frameCount(E.createDoc(48,16)),3); assert.equal(E.frameCount(E.createDoc(20,16)),2);
  assert.equal(E.rgbToHex(255,0,10),"#FF000A"); assert.deepEqual(E.hexToRgb("#0a0b0c"),{r:10,g:11,b:12});
});
