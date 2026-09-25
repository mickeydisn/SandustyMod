/**
 * md-take-video v3.0 — same capture path as irishbruse.selection-capture GIF,
 * encode as WebM instead of GIF.
 *
 * Capture (identical to the GIF mod):
 *   waitTicks(ticksPerFrame) → unpause sim → nextTick × N → pause
 *   wait frame:render → composite gameCanvas + dynamic2D + overlay → ImageData
 *
 * Encode:
 *   put each ImageData on a canvas → captureStream(fps) with correct duration
 *   hold each frame for delayMs so the WebM timeline matches real duration
 *
 * F7 panel · C marquee · Lock · Start/Stop · Save
 */
(() => {
  "use strict";

  // --- embedded webm-muxer (Vanilagy) ---
  "use strict";var WebMMuxer=(()=>{var t=Object.defineProperty,e=Object.getOwnPropertyDescriptor,i=Object.getOwnPropertyNames,s=Object.prototype.hasOwnProperty,a=(t,e,i)=>{if(!e.has(t))throw TypeError("Cannot "+i)},r=(t,e,i)=>(a(t,e,"read from private field"),i?i.call(t):e.get(t)),n=(t,e,i)=>{if(e.has(t))throw TypeError("Cannot add the same private member more than once");e instanceof WeakSet?e.add(t):e.set(t,i)},h=(t,e,i,s)=>(a(t,e,"write to private field"),s?s.call(t,i):e.set(t,i),i),o=(t,e,i)=>(a(t,e,"access private method"),i),d={};((e,i)=>{for(var s in i)t(e,s,{get:i[s],enumerable:!0})})(d,{ArrayBufferTarget:()=>I,FileSystemWritableFileStreamTarget:()=>B,Muxer:()=>Ue,StreamTarget:()=>x,SubtitleEncoder:()=>He});var l,u,c,f,w,p,m,b,g,y,k,v,M,E,W,T,S,U=class{constructor(t){this.value=t}},C=class{constructor(t){this.value=t}},A=t=>t<256?1:t<65536?2:t<1<<24?3:t<2**32?4:t<2**40?5:6,L=(t,e,i)=>{let s=0;for(let a=e;a<i;a++){let e=7-(7&a);s<<=1,s|=(t[Math.floor(a/8)]&1<<e)>>e}return s},z=(Symbol("isTarget"),class{}),I=class extends z{constructor(){super(...arguments),this.buffer=null}},x=class extends z{constructor(t){if(super(),this.options=t,"object"!=typeof t)throw new TypeError("StreamTarget requires an options object to be passed to its constructor.");if(t.onData){if("function"!=typeof t.onData)throw new TypeError("options.onData, when provided, must be a function.");if(t.onData.length<2)throw new TypeError("options.onData, when provided, must be a function that takes in at least two arguments (data and position). Ignoring the position argument, which specifies the byte offset at which the data is to be written, can lead to broken outputs.")}if(t.onHeader&&"function"!=typeof t.onHeader)throw new TypeError("options.onHeader, when provided, must be a function.");if(t.onCluster&&"function"!=typeof t.onCluster)throw new TypeError("options.onCluster, when provided, must be a function.");if(void 0!==t.chunked&&"boolean"!=typeof t.chunked)throw new TypeError("options.chunked, when provided, must be a boolean.");if(void 0!==t.chunkSize&&(!Number.isInteger(t.chunkSize)||t.chunkSize<=0))throw new TypeError("options.chunkSize, when provided, must be a positive integer.")}},B=class extends z{constructor(t,e){if(super(),this.stream=t,this.options=e,!(t instanceof FileSystemWritableFileStream))throw new TypeError("FileSystemWritableFileStreamTarget requires a FileSystemWritableFileStream instance.");if(void 0!==e&&"object"!=typeof e)throw new TypeError("FileSystemWritableFileStreamTarget's options, when provided, must be an object.");if(e&&void 0!==e.chunkSize&&(!Number.isInteger(e.chunkSize)||e.chunkSize<=0))throw new TypeError("options.chunkSize, when provided, must be a positive integer")}},N=class{constructor(){n(this,c),n(this,w),n(this,m),n(this,g),n(this,k),this.pos=0,n(this,l,new Uint8Array(8)),n(this,u,new DataView(r(this,l).buffer)),this.offsets=new WeakMap,this.dataOffsets=new WeakMap}seek(t){this.pos=t}writeEBMLVarInt(t,e=(t=>{if(t<127)return 1;if(t<16383)return 2;if(t<2097151)return 3;if(t<268435455)return 4;if(t<2**35-1)return 5;if(t<2**42-1)return 6;throw new Error("EBML VINT size not supported "+t)})(t)){let i=0;switch(e){case 1:r(this,u).setUint8(i++,128|t);break;case 2:r(this,u).setUint8(i++,64|t>>8),r(this,u).setUint8(i++,t);break;case 3:r(this,u).setUint8(i++,32|t>>16),r(this,u).setUint8(i++,t>>8),r(this,u).setUint8(i++,t);break;case 4:r(this,u).setUint8(i++,16|t>>24),r(this,u).setUint8(i++,t>>16),r(this,u).setUint8(i++,t>>8),r(this,u).setUint8(i++,t);break;case 5:r(this,u).setUint8(i++,8|t/2**32&7),r(this,u).setUint8(i++,t>>24),r(this,u).setUint8(i++,t>>16),r(this,u).setUint8(i++,t>>8),r(this,u).setUint8(i++,t);break;case 6:r(this,u).setUint8(i++,4|t/2**40&3),r(this,u).setUint8(i++,t/2**32|0),r(this,u).setUint8(i++,t>>24),r(this,u).setUint8(i++,t>>16),r(this,u).setUint8(i++,t>>8),r(this,u).setUint8(i++,t);break;default:throw new Error("Bad EBML VINT size "+e)}this.write(r(this,l).subarray(0,i))}writeEBML(t){if(null!==t)if(t instanceof Uint8Array)this.write(t);else if(Array.isArray(t))for(let e of t)this.writeEBML(e);else if(this.offsets.set(t,this.pos),o(this,g,y).call(this,t.id),Array.isArray(t.data)){let e=this.pos,i=-1===t.size?1:t.size??4;-1===t.size?o(this,c,f).call(this,255):this.seek(this.pos+i);let s=this.pos;if(this.dataOffsets.set(t,s),this.writeEBML(t.data),-1!==t.size){let t=this.pos-s,a=this.pos;this.seek(e),this.writeEBMLVarInt(t,i),this.seek(a)}}else if("number"==typeof t.data){let e=t.size??A(t.data);this.writeEBMLVarInt(e),o(this,g,y).call(this,t.data,e)}else"string"==typeof t.data?(this.writeEBMLVarInt(t.data.length),o(this,k,v).call(this,t.data)):t.data instanceof Uint8Array?(this.writeEBMLVarInt(t.data.byteLength,t.size),this.write(t.data)):t.data instanceof U?(this.writeEBMLVarInt(4),o(this,w,p).call(this,t.data.value)):t.data instanceof C&&(this.writeEBMLVarInt(8),o(this,m,b).call(this,t.data.value))}};l=new WeakMap,u=new WeakMap,c=new WeakSet,f=function(t){r(this,u).setUint8(0,t),this.write(r(this,l).subarray(0,1))},w=new WeakSet,p=function(t){r(this,u).setFloat32(0,t,!1),this.write(r(this,l).subarray(0,4))},m=new WeakSet,b=function(t){r(this,u).setFloat64(0,t,!1),this.write(r(this,l))},g=new WeakSet,y=function(t,e=A(t)){let i=0;switch(e){case 6:r(this,u).setUint8(i++,t/2**40|0);case 5:r(this,u).setUint8(i++,t/2**32|0);case 4:r(this,u).setUint8(i++,t>>24);case 3:r(this,u).setUint8(i++,t>>16);case 2:r(this,u).setUint8(i++,t>>8);case 1:r(this,u).setUint8(i++,t);break;default:throw new Error("Bad UINT size "+e)}this.write(r(this,l).subarray(0,i))},k=new WeakSet,v=function(t){this.write(new Uint8Array(t.split("").map((t=>t.charCodeAt(0)))))};var V,j,F,R,$=class extends N{constructor(t){super(),n(this,T),n(this,M,void 0),n(this,E,new ArrayBuffer(65536)),n(this,W,new Uint8Array(r(this,E))),h(this,M,t)}write(t){o(this,T,S).call(this,this.pos+t.byteLength),r(this,W).set(t,this.pos),this.pos+=t.byteLength}finalize(){o(this,T,S).call(this,this.pos),r(this,M).buffer=r(this,E).slice(0,this.pos)}};M=new WeakMap,E=new WeakMap,W=new WeakMap,T=new WeakSet,S=function(t){let e=r(this,E).byteLength;for(;e<t;)e*=2;if(e===r(this,E).byteLength)return;let i=new ArrayBuffer(e),s=new Uint8Array(i);s.set(r(this,W),0),h(this,E,i),h(this,W,s)};var O,D,H,P=class extends N{constructor(t){super(),this.target=t,n(this,V,!1),n(this,j,void 0),n(this,F,void 0),n(this,R,void 0)}write(t){if(!r(this,V))return;let e=this.pos;if(e<r(this,F)){if(e+t.byteLength<=r(this,F))return;t=t.subarray(r(this,F)-e),e=0}let i=e+t.byteLength-r(this,F),s=r(this,j).byteLength;for(;s<i;)s*=2;if(s!==r(this,j).byteLength){let t=new Uint8Array(s);t.set(r(this,j),0),h(this,j,t)}r(this,j).set(t,e-r(this,F)),h(this,R,Math.max(r(this,R),e+t.byteLength))}startTrackingWrites(){h(this,V,!0),h(this,j,new Uint8Array(1024)),h(this,F,this.pos),h(this,R,this.pos)}getTrackedWrites(){if(!r(this,V))throw new Error("Can't get tracked writes since nothing was tracked.");let t={data:r(this,j).subarray(0,r(this,R)-r(this,F)),start:r(this,F),end:r(this,R)};return h(this,j,void 0),h(this,V,!1),t}};V=new WeakMap,j=new WeakMap,F=new WeakMap,R=new WeakMap;var q=class extends P{constructor(t,e){super(t),n(this,O,[]),n(this,D,0),n(this,H,void 0),h(this,H,e)}write(t){super.write(t),r(this,O).push({data:t.slice(),start:this.pos}),this.pos+=t.byteLength}flush(){if(0===r(this,O).length)return;let t=[],e=[...r(this,O)].sort(((t,e)=>t.start-e.start));t.push({start:e[0].start,size:e[0].data.byteLength});for(let i=1;i<e.length;i++){let s=t[t.length-1],a=e[i];a.start<=s.start+s.size?s.size=Math.max(s.size,a.start+a.data.byteLength-s.start):t.push({start:a.start,size:a.data.byteLength})}for(let e of t){e.data=new Uint8Array(e.size);for(let t of r(this,O))e.start<=t.start&&t.start<e.start+e.size&&e.data.set(t.data,t.start-e.start);if(r(this,H)&&e.start<r(this,D))throw new Error("Internal error: Monotonicity violation.");this.target.options.onData?.(e.data,e.start),h(this,D,e.start+e.data.byteLength)}r(this,O).length=0}finalize(){}};O=new WeakMap,D=new WeakMap,H=new WeakMap;var _,G,J,K,Q,X,Y,Z,tt,et,it,st,at=class extends P{constructor(t,e){if(super(t),n(this,Q),n(this,Y),n(this,tt),n(this,it),n(this,_,void 0),n(this,G,[]),n(this,J,0),n(this,K,void 0),h(this,_,t.options?.chunkSize??16777216),h(this,K,e),!Number.isInteger(r(this,_))||r(this,_)<1024)throw new Error("Invalid StreamTarget options: chunkSize must be an integer not smaller than 1024.")}write(t){super.write(t),o(this,Q,X).call(this,t,this.pos),o(this,it,st).call(this),this.pos+=t.byteLength}finalize(){o(this,it,st).call(this,!0)}};_=new WeakMap,G=new WeakMap,J=new WeakMap,K=new WeakMap,Q=new WeakSet,X=function(t,e){let i=r(this,G).findIndex((t=>t.start<=e&&e<t.start+r(this,_)));-1===i&&(i=o(this,tt,et).call(this,e));let s=r(this,G)[i],a=e-s.start,n=t.subarray(0,Math.min(r(this,_)-a,t.byteLength));s.data.set(n,a);let h={start:a,end:a+n.byteLength};if(o(this,Y,Z).call(this,s,h),0===s.written[0].start&&s.written[0].end===r(this,_)&&(s.shouldFlush=!0),r(this,G).length>2){for(let t=0;t<r(this,G).length-1;t++)r(this,G)[t].shouldFlush=!0;o(this,it,st).call(this)}n.byteLength<t.byteLength&&o(this,Q,X).call(this,t.subarray(n.byteLength),e+n.byteLength)},Y=new WeakSet,Z=function(t,e){let i=0,s=t.written.length-1,a=-1;for(;i<=s;){let r=Math.floor(i+(s-i+1)/2);t.written[r].start<=e.start?(i=r+1,a=r):s=r-1}for(t.written.splice(a+1,0,e),(-1===a||t.written[a].end<e.start)&&a++;a<t.written.length-1&&t.written[a].end>=t.written[a+1].start;)t.written[a].end=Math.max(t.written[a].end,t.written[a+1].end),t.written.splice(a+1,1)},tt=new WeakSet,et=function(t){let e={start:Math.floor(t/r(this,_))*r(this,_),data:new Uint8Array(r(this,_)),written:[],shouldFlush:!1};return r(this,G).push(e),r(this,G).sort(((t,e)=>t.start-e.start)),r(this,G).indexOf(e)},it=new WeakSet,st=function(t=!1){for(let e=0;e<r(this,G).length;e++){let i=r(this,G)[e];if(i.shouldFlush||t){for(let t of i.written){if(r(this,K)&&i.start+t.start<r(this,J))throw new Error("Internal error: Monotonicity violation.");this.target.options.onData?.(i.data.subarray(t.start,t.end),i.start+t.start),h(this,J,i.start+t.end)}r(this,G).splice(e--,1)}}};var rt,nt,ht,ot,dt,lt,ut,ct,ft,wt,pt,mt,bt,gt,yt,kt,vt,Mt,Et,Wt,Tt,St,Ut,Ct,At,Lt,zt,It,xt,Bt,Nt,Vt,jt,Ft,Rt,$t,Ot,Dt,Ht,Pt,qt,_t,Gt,Jt,Kt,Qt,Xt,Yt,Zt,te,ee,ie,se,ae,re,ne,he,oe,de,le,ue,ce,fe,we,pe,me,be,ge,ye,ke,ve,Me=class extends at{constructor(t,e){super(new x({onData:(e,i)=>t.stream.write({type:"write",data:e,position:i}),chunked:!0,chunkSize:t.options?.chunkSize}),e)}},Ee=32768,We=4096,Te="https://github.com/Vanilagy/webm-muxer",Se=["strict","offset","permissive"],Ue=class{constructor(t){n(this,Lt),n(this,It),n(this,Bt),n(this,Vt),n(this,Ft),n(this,$t),n(this,Dt),n(this,Pt),n(this,_t),n(this,Jt),n(this,Qt),n(this,Yt),n(this,te),n(this,ie),n(this,ae),n(this,ne),n(this,oe),n(this,le),n(this,ce),n(this,we),n(this,me),n(this,ge),n(this,ke),n(this,rt,void 0),n(this,nt,void 0),n(this,ht,void 0),n(this,ot,void 0),n(this,dt,void 0),n(this,lt,void 0),n(this,ut,void 0),n(this,ct,void 0),n(this,ft,void 0),n(this,wt,void 0),n(this,pt,void 0),n(this,mt,void 0),n(this,bt,void 0),n(this,gt,void 0),n(this,yt,0),n(this,kt,[]),n(this,vt,[]),n(this,Mt,[]),n(this,Et,void 0),n(this,Wt,void 0),n(this,Tt,-1),n(this,St,-1),n(this,Ut,-1),n(this,Ct,void 0),n(this,At,!1),o(this,Lt,zt).call(this,t),h(this,rt,{type:"webm",firstTimestampBehavior:"strict",...t}),this.target=t.target;let e=!!r(this,rt).streaming;if(t.target instanceof I)h(this,nt,new $(t.target));else if(t.target instanceof x)h(this,nt,t.target.options?.chunked?new at(t.target,e):new q(t.target,e));else{if(!(t.target instanceof B))throw new Error(`Invalid target: ${t.target}`);h(this,nt,new Me(t.target,e))}o(this,It,xt).call(this)}addVideoChunk(t,e,i){if(!(t instanceof EncodedVideoChunk))throw new TypeError("addVideoChunk's first argument (chunk) must be of type EncodedVideoChunk.");if(e&&"object"!=typeof e)throw new TypeError("addVideoChunk's second argument (meta), when provided, must be an object.");if(void 0!==i&&(!Number.isFinite(i)||i<0))throw new TypeError("addVideoChunk's third argument (timestamp), when provided, must be a non-negative real number.");let s=new Uint8Array(t.byteLength);t.copyTo(s),this.addVideoChunkRaw(s,t.type,i??t.timestamp,e)}addVideoChunkRaw(t,e,i,s){if(!(t instanceof Uint8Array))throw new TypeError("addVideoChunkRaw's first argument (data) must be an instance of Uint8Array.");if("key"!==e&&"delta"!==e)throw new TypeError("addVideoChunkRaw's second argument (type) must be either 'key' or 'delta'.");if(!Number.isFinite(i)||i<0)throw new TypeError("addVideoChunkRaw's third argument (timestamp) must be a non-negative real number.");if(s&&"object"!=typeof s)throw new TypeError("addVideoChunkRaw's fourth argument (meta), when provided, must be an object.");if(o(this,ke,ve).call(this),!r(this,rt).video)throw new Error("No video track declared.");void 0===r(this,Et)&&h(this,Et,i),s&&o(this,te,ee).call(this,s);let a=o(this,ne,he).call(this,t,e,i,1);for("V_VP9"===r(this,rt).video.codec&&o(this,ie,se).call(this,a),h(this,Tt,a.timestamp);r(this,vt).length>0&&r(this,vt)[0].timestamp<=a.timestamp;){let t=r(this,vt).shift();o(this,le,ue).call(this,t,!1)}!r(this,rt).audio||a.timestamp<=r(this,St)?o(this,le,ue).call(this,a,!0):r(this,kt).push(a),o(this,ae,re).call(this),o(this,Qt,Xt).call(this)}addAudioChunk(t,e,i){if(!(t instanceof EncodedAudioChunk))throw new TypeError("addAudioChunk's first argument (chunk) must be of type EncodedAudioChunk.");if(e&&"object"!=typeof e)throw new TypeError("addAudioChunk's second argument (meta), when provided, must be an object.");if(void 0!==i&&(!Number.isFinite(i)||i<0))throw new TypeError("addAudioChunk's third argument (timestamp), when provided, must be a non-negative real number.");let s=new Uint8Array(t.byteLength);t.copyTo(s),this.addAudioChunkRaw(s,t.type,i??t.timestamp,e)}addAudioChunkRaw(t,e,i,s){if(!(t instanceof Uint8Array))throw new TypeError("addAudioChunkRaw's first argument (data) must be an instance of Uint8Array.");if("key"!==e&&"delta"!==e)throw new TypeError("addAudioChunkRaw's second argument (type) must be either 'key' or 'delta'.");if(!Number.isFinite(i)||i<0)throw new TypeError("addAudioChunkRaw's third argument (timestamp) must be a non-negative real number.");if(s&&"object"!=typeof s)throw new TypeError("addAudioChunkRaw's fourth argument (meta), when provided, must be an object.");if(o(this,ke,ve).call(this),!r(this,rt).audio)throw new Error("No audio track declared.");void 0===r(this,Wt)&&h(this,Wt,i),s?.decoderConfig&&(r(this,rt).streaming?h(this,wt,o(this,ce,fe).call(this,s.decoderConfig.description)):o(this,we,pe).call(this,r(this,wt),s.decoderConfig.description));let a=o(this,ne,he).call(this,t,e,i,2);for(h(this,St,a.timestamp);r(this,kt).length>0&&r(this,kt)[0].timestamp<=a.timestamp;){let t=r(this,kt).shift();o(this,le,ue).call(this,t,!0)}!r(this,rt).video||a.timestamp<=r(this,Tt)?o(this,le,ue).call(this,a,!r(this,rt).video):r(this,vt).push(a),o(this,ae,re).call(this),o(this,Qt,Xt).call(this)}addSubtitleChunk(t,e,i){if("object"!=typeof t||!t)throw new TypeError("addSubtitleChunk's first argument (chunk) must be an object.");if(!(t.body instanceof Uint8Array))throw new TypeError("body must be an instance of Uint8Array.");if(!Number.isFinite(t.timestamp)||t.timestamp<0)throw new TypeError("timestamp must be a non-negative real number.");if(!Number.isFinite(t.duration)||t.duration<0)throw new TypeError("duration must be a non-negative real number.");if(t.additions&&!(t.additions instanceof Uint8Array))throw new TypeError("additions, when present, must be an instance of Uint8Array.");if("object"!=typeof e)throw new TypeError("addSubtitleChunk's second argument (meta) must be an object.");if(o(this,ke,ve).call(this),!r(this,rt).subtitles)throw new Error("No subtitle track declared.");e?.decoderConfig&&(r(this,rt).streaming?h(this,pt,o(this,ce,fe).call(this,e.decoderConfig.description)):o(this,we,pe).call(this,r(this,pt),e.decoderConfig.description));let s=o(this,ne,he).call(this,t.body,"key",i??t.timestamp,3,t.duration,t.additions);h(this,Ut,s.timestamp),r(this,Mt).push(s),o(this,ae,re).call(this),o(this,Qt,Xt).call(this)}finalize(){if(r(this,At))throw new Error("Cannot finalize a muxer more than once.");for(;r(this,kt).length>0;)o(this,le,ue).call(this,r(this,kt).shift(),!0);for(;r(this,vt).length>0;)o(this,le,ue).call(this,r(this,vt).shift(),!0);for(;r(this,Mt).length>0&&r(this,Mt)[0].timestamp<=r(this,yt);)o(this,le,ue).call(this,r(this,Mt).shift(),!1);if(r(this,rt).streaming||o(this,ge,ye).call(this),r(this,nt).writeEBML(r(this,mt)),!r(this,rt).streaming){let t=r(this,nt).pos,e=r(this,nt).pos-r(this,Yt,Zt);r(this,nt).seek(r(this,nt).offsets.get(r(this,ht))+4),r(this,nt).writeEBMLVarInt(e,6),r(this,ut).data=new C(r(this,yt)),r(this,nt).seek(r(this,nt).offsets.get(r(this,ut))),r(this,nt).writeEBML(r(this,ut)),r(this,dt).data[0].data[1].data=r(this,nt).offsets.get(r(this,mt))-r(this,Yt,Zt),r(this,dt).data[1].data[1].data=r(this,nt).offsets.get(r(this,ot))-r(this,Yt,Zt),r(this,dt).data[2].data[1].data=r(this,nt).offsets.get(r(this,lt))-r(this,Yt,Zt),r(this,nt).seek(r(this,nt).offsets.get(r(this,dt))),r(this,nt).writeEBML(r(this,dt)),r(this,nt).seek(t)}o(this,Qt,Xt).call(this),r(this,nt).finalize(),h(this,At,!0)}};rt=new WeakMap,nt=new WeakMap,ht=new WeakMap,ot=new WeakMap,dt=new WeakMap,lt=new WeakMap,ut=new WeakMap,ct=new WeakMap,ft=new WeakMap,wt=new WeakMap,pt=new WeakMap,mt=new WeakMap,bt=new WeakMap,gt=new WeakMap,yt=new WeakMap,kt=new WeakMap,vt=new WeakMap,Mt=new WeakMap,Et=new WeakMap,Wt=new WeakMap,Tt=new WeakMap,St=new WeakMap,Ut=new WeakMap,Ct=new WeakMap,At=new WeakMap,Lt=new WeakSet,zt=function(t){if("object"!=typeof t)throw new TypeError("The muxer requires an options object to be passed to its constructor.");if(!(t.target instanceof z))throw new TypeError("The target must be provided and an instance of Target.");if(t.video){if("string"!=typeof t.video.codec)throw new TypeError(`Invalid video codec: ${t.video.codec}. Must be a string.`);if(!Number.isInteger(t.video.width)||t.video.width<=0)throw new TypeError(`Invalid video width: ${t.video.width}. Must be a positive integer.`);if(!Number.isInteger(t.video.height)||t.video.height<=0)throw new TypeError(`Invalid video height: ${t.video.height}. Must be a positive integer.`);if(void 0!==t.video.frameRate&&(!Number.isFinite(t.video.frameRate)||t.video.frameRate<=0))throw new TypeError(`Invalid video frame rate: ${t.video.frameRate}. Must be a positive number.`);if(void 0!==t.video.alpha&&"boolean"!=typeof t.video.alpha)throw new TypeError(`Invalid video alpha: ${t.video.alpha}. Must be a boolean.`)}if(t.audio){if("string"!=typeof t.audio.codec)throw new TypeError(`Invalid audio codec: ${t.audio.codec}. Must be a string.`);if(!Number.isInteger(t.audio.numberOfChannels)||t.audio.numberOfChannels<=0)throw new TypeError(`Invalid number of audio channels: ${t.audio.numberOfChannels}. Must be a positive integer.`);if(!Number.isInteger(t.audio.sampleRate)||t.audio.sampleRate<=0)throw new TypeError(`Invalid audio sample rate: ${t.audio.sampleRate}. Must be a positive integer.`);if(void 0!==t.audio.bitDepth&&(!Number.isInteger(t.audio.bitDepth)||t.audio.bitDepth<=0))throw new TypeError(`Invalid audio bit depth: ${t.audio.bitDepth}. Must be a positive integer.`)}if(t.subtitles&&"string"!=typeof t.subtitles.codec)throw new TypeError(`Invalid subtitles codec: ${t.subtitles.codec}. Must be a string.`);if(void 0!==t.type&&!["webm","matroska"].includes(t.type))throw new TypeError(`Invalid type: ${t.type}. Must be 'webm' or 'matroska'.`);if(t.firstTimestampBehavior&&!Se.includes(t.firstTimestampBehavior))throw new TypeError(`Invalid first timestamp behavior: ${t.firstTimestampBehavior}`);if(void 0!==t.streaming&&"boolean"!=typeof t.streaming)throw new TypeError(`Invalid streaming option: ${t.streaming}. Must be a boolean.`)},It=new WeakSet,xt=function(){r(this,nt)instanceof P&&r(this,nt).target.options.onHeader&&r(this,nt).startTrackingWrites(),o(this,Bt,Nt).call(this),r(this,rt).streaming||o(this,$t,Ot).call(this),o(this,Dt,Ht).call(this),o(this,Vt,jt).call(this),o(this,Ft,Rt).call(this),r(this,rt).streaming||(o(this,Pt,qt).call(this),o(this,_t,Gt).call(this)),o(this,Jt,Kt).call(this),o(this,Qt,Xt).call(this)},Bt=new WeakSet,Nt=function(){let t={id:440786851,data:[{id:17030,data:1},{id:17143,data:1},{id:17138,data:4},{id:17139,data:8},{id:17026,data:r(this,rt).type??"webm"},{id:17031,data:2},{id:17029,data:2}]};r(this,nt).writeEBML(t)},Vt=new WeakSet,jt=function(){h(this,ft,{id:236,size:4,data:new Uint8Array(We)}),h(this,wt,{id:236,size:4,data:new Uint8Array(We)}),h(this,pt,{id:236,size:4,data:new Uint8Array(We)})},Ft=new WeakSet,Rt=function(){h(this,ct,{id:21936,data:[{id:21937,data:2},{id:21946,data:2},{id:21947,data:2},{id:21945,data:0}]})},$t=new WeakSet,Ot=function(){const t=new Uint8Array([28,83,187,107]),e=new Uint8Array([21,73,169,102]),i=new Uint8Array([22,84,174,107]);h(this,dt,{id:290298740,data:[{id:19899,data:[{id:21419,data:t},{id:21420,size:5,data:0}]},{id:19899,data:[{id:21419,data:e},{id:21420,size:5,data:0}]},{id:19899,data:[{id:21419,data:i},{id:21420,size:5,data:0}]}]})},Dt=new WeakSet,Ht=function(){let t={id:17545,data:new C(0)};h(this,ut,t);let e={id:357149030,data:[{id:2807729,data:1e6},{id:19840,data:Te},{id:22337,data:Te},r(this,rt).streaming?null:t]};h(this,ot,e)},Pt=new WeakSet,qt=function(){let t={id:374648427,data:[]};h(this,lt,t),r(this,rt).video&&t.data.push({id:174,data:[{id:215,data:1},{id:29637,data:1},{id:131,data:1},{id:134,data:r(this,rt).video.codec},r(this,ft),r(this,rt).video.frameRate?{id:2352003,data:1e9/r(this,rt).video.frameRate}:null,{id:224,data:[{id:176,data:r(this,rt).video.width},{id:186,data:r(this,rt).video.height},r(this,rt).video.alpha?{id:21440,data:1}:null,r(this,ct)]}]}),r(this,rt).audio&&(h(this,wt,r(this,rt).streaming?r(this,wt)||null:{id:236,size:4,data:new Uint8Array(We)}),t.data.push({id:174,data:[{id:215,data:2},{id:29637,data:2},{id:131,data:2},{id:134,data:r(this,rt).audio.codec},r(this,wt),{id:225,data:[{id:181,data:new U(r(this,rt).audio.sampleRate)},{id:159,data:r(this,rt).audio.numberOfChannels},r(this,rt).audio.bitDepth?{id:25188,data:r(this,rt).audio.bitDepth}:null]}]})),r(this,rt).subtitles&&t.data.push({id:174,data:[{id:215,data:3},{id:29637,data:3},{id:131,data:17},{id:134,data:r(this,rt).subtitles.codec},r(this,pt)]})},_t=new WeakSet,Gt=function(){let t={id:408125543,size:r(this,rt).streaming?-1:6,data:[r(this,rt).streaming?null:r(this,dt),r(this,ot),r(this,lt)]};if(h(this,ht,t),r(this,nt).writeEBML(t),r(this,nt)instanceof P&&r(this,nt).target.options.onHeader){let{data:t,start:e}=r(this,nt).getTrackedWrites();r(this,nt).target.options.onHeader(t,e)}},Jt=new WeakSet,Kt=function(){h(this,mt,{id:475249515,data:[]})},Qt=new WeakSet,Xt=function(){r(this,nt)instanceof q&&r(this,nt).flush()},Yt=new WeakSet,Zt=function(){return r(this,nt).dataOffsets.get(r(this,ht))},te=new WeakSet,ee=function(t){if(t.decoderConfig){if(t.decoderConfig.colorSpace){let e=t.decoderConfig.colorSpace;if(h(this,Ct,e),r(this,ct).data=[{id:21937,data:{rgb:1,bt709:1,bt470bg:5,smpte170m:6}[e.matrix]},{id:21946,data:{bt709:1,smpte170m:6,"iec61966-2-1":13}[e.transfer]},{id:21947,data:{bt709:1,bt470bg:5,smpte170m:6}[e.primaries]},{id:21945,data:[1,2][Number(e.fullRange)]}],!r(this,rt).streaming){let t=r(this,nt).pos;r(this,nt).seek(r(this,nt).offsets.get(r(this,ct))),r(this,nt).writeEBML(r(this,ct)),r(this,nt).seek(t)}}t.decoderConfig.description&&(r(this,rt).streaming?h(this,ft,o(this,ce,fe).call(this,t.decoderConfig.description)):o(this,we,pe).call(this,r(this,ft),t.decoderConfig.description))}},ie=new WeakSet,se=function(t){if("key"!==t.type)return;if(!r(this,Ct))return;let e=0;if(2!==L(t.data,0,2))return;e+=2;let i=(L(t.data,e+1,e+2)<<1)+L(t.data,e+0,e+1);e+=2,3===i&&e++;let s=L(t.data,e+0,e+1);if(e++,s)return;let a=L(t.data,e+0,e+1);if(e++,0!==a)return;e+=2;let n=L(t.data,e+0,e+24);if(e+=24,4817730!==n)return;i>=2&&e++;let h={rgb:7,bt709:2,bt470bg:1,smpte170m:3}[r(this,Ct).matrix];((t,e,i,s)=>{for(let a=e;a<i;a++){let e=Math.floor(a/8),r=t[e],n=7-(7&a);r&=~(1<<n),r|=(s&1<<i-a-1)>>i-a-1<<n,t[e]=r}})(t.data,e+0,e+3,h)},ae=new WeakSet,re=function(){let t=Math.min(r(this,rt).video?r(this,Tt):1/0,r(this,rt).audio?r(this,St):1/0),e=r(this,Mt);for(;e.length>0&&e[0].timestamp<=t;)o(this,le,ue).call(this,e.shift(),!r(this,rt).video&&!r(this,rt).audio)},ne=new WeakSet,he=function(t,e,i,s,a,r){return{data:t,additions:r,type:e,timestamp:o(this,oe,de).call(this,i,s),duration:a,trackNumber:s}},oe=new WeakSet,de=function(t,e){let i=r(this,1===e?Tt:2===e?St:Ut);if(3!==e){let s=r(this,1===e?Et:Wt);if("strict"===r(this,rt).firstTimestampBehavior&&-1===i&&0!==t)throw new Error(`The first chunk for your media track must have a timestamp of 0 (received ${t}). Non-zero first timestamps are often caused by directly piping frames or audio data from a MediaStreamTrack into the encoder. Their timestamps are typically relative to the age of the document, which is probably what you want.\n\nIf you want to offset all timestamps of a track such that the first one is zero, set firstTimestampBehavior: 'offset' in the options.\nIf you want to allow non-zero first timestamps, set firstTimestampBehavior: 'permissive'.\n`);"offset"===r(this,rt).firstTimestampBehavior&&(t-=s)}if(t<i)throw new Error(`Timestamps must be monotonically increasing (went from ${i} to ${t}).`);if(t<0)throw new Error(`Timestamps must be non-negative (received ${t}).`);return t},le=new WeakSet,ue=function(t,e){r(this,rt).streaming&&!r(this,lt)&&(o(this,Pt,qt).call(this),o(this,_t,Gt).call(this));let i=Math.floor(t.timestamp/1e3),s=e&&"key"===t.type&&i-r(this,gt)>=1e3;r(this,bt)&&!s||o(this,me,be).call(this,i);let a=i-r(this,gt);if(a<0)return;if(a>=Ee)throw new Error("Current Matroska cluster exceeded its maximum allowed length of 32768 milliseconds. In order to produce a correct WebM file, you must pass in a key frame at least every 32768 milliseconds.");let n=new Uint8Array(4),d=new DataView(n.buffer);if(d.setUint8(0,128|t.trackNumber),d.setInt16(1,a,!1),void 0!==t.duration||t.additions){let e=Math.floor(t.duration/1e3),i={id:160,data:[{id:161,data:[n,t.data]},void 0!==t.duration?{id:155,data:e}:null,t.additions?{id:30113,data:t.additions}:null]};r(this,nt).writeEBML(i)}else{d.setUint8(3,Number("key"===t.type)<<7);let e={id:163,data:[n,t.data]};r(this,nt).writeEBML(e)}h(this,yt,Math.max(r(this,yt),i))},ce=new WeakSet,fe=function(t){return{id:25506,size:4,data:new Uint8Array(t)}},we=new WeakSet,pe=function(t,e){let i=r(this,nt).pos;r(this,nt).seek(r(this,nt).offsets.get(t));let s=6+e.byteLength,a=We-s;if(a<0){let t=e.byteLength+a;e=e instanceof ArrayBuffer?e.slice(0,t):e.buffer.slice(0,t),a=0}t=[o(this,ce,fe).call(this,e),{id:236,size:4,data:new Uint8Array(a)}],r(this,nt).writeEBML(t),r(this,nt).seek(i)},me=new WeakSet,be=function(t){r(this,bt)&&!r(this,rt).streaming&&o(this,ge,ye).call(this),r(this,nt)instanceof P&&r(this,nt).target.options.onCluster&&r(this,nt).startTrackingWrites(),h(this,bt,{id:524531317,size:r(this,rt).streaming?-1:5,data:[{id:231,data:t}]}),r(this,nt).writeEBML(r(this,bt)),h(this,gt,t);let e=r(this,nt).offsets.get(r(this,bt))-r(this,Yt,Zt);r(this,mt).data.push({id:187,data:[{id:179,data:t},r(this,rt).video?{id:183,data:[{id:247,data:1},{id:241,data:e}]}:null,r(this,rt).audio?{id:183,data:[{id:247,data:2},{id:241,data:e}]}:null]})},ge=new WeakSet,ye=function(){let t=r(this,nt).pos-r(this,nt).dataOffsets.get(r(this,bt)),e=r(this,nt).pos;if(r(this,nt).seek(r(this,nt).offsets.get(r(this,bt))+4),r(this,nt).writeEBMLVarInt(t,5),r(this,nt).seek(e),r(this,nt)instanceof P&&r(this,nt).target.options.onCluster){let{data:t,start:e}=r(this,nt).getTrackedWrites();r(this,nt).target.options.onCluster(t,e,r(this,gt))}},ke=new WeakSet,ve=function(){if(r(this,At))throw new Error("Cannot add new video or audio chunks after the file has been finalized.")};var Ce,Ae,Le,ze,Ie,xe,Be,Ne,Ve,je,Fe=/(?:(.+?)\n)?((?:\d{2}:)?\d{2}:\d{2}.\d{3})\s+-->\s+((?:\d{2}:)?\d{2}:\d{2}.\d{3})/g,Re=/^WEBVTT.*?\n{2}/,$e=/(?:(\d{2}):)?(\d{2}):(\d{2}).(\d{3})/,Oe=/<(?:(\d{2}):)?(\d{2}):(\d{2}).(\d{3})>/g,De=new TextEncoder,He=class{constructor(t){n(this,xe),n(this,Ne),n(this,Ce,void 0),n(this,Ae,void 0),n(this,Le,!1),n(this,ze,void 0),n(this,Ie,!1),h(this,Ce,t)}configure(t){if("webvtt"!==t.codec)throw new Error("Codec must be 'webvtt'.");h(this,Ae,t)}encode(t){if(!r(this,Ae))throw new Error("Encoder not configured.");let e;if(t=t.replace("\r\n","\n").replace("\r","\n"),Fe.lastIndex=0,!r(this,Le)){if(!Re.test(t)){let t=new Error("WebVTT preamble incorrect.");throw r(this,Ce).error(t),t}e=Fe.exec(t);let i=t.slice(0,e?.index??t.length).trimEnd();if(!i){let t=new Error("No WebVTT preamble provided.");throw r(this,Ce).error(t),t}h(this,ze,De.encode(i)),h(this,Le,!0),e&&(t=t.slice(e.index),Fe.lastIndex=0)}for(;e=Fe.exec(t);){let i=t.slice(0,e.index),s=e[1]||"",a=e.index+e[0].length,n=t.indexOf("\n",a)+1,d=t.slice(a,n).trim(),l=t.indexOf("\n\n",a);-1===l&&(l=t.length);let u=o(this,xe,Be).call(this,e[2]),c=o(this,xe,Be).call(this,e[3])-u,f=t.slice(n,l),w=`${d}\n${s}\n${i}`;Oe.lastIndex=0,f=f.replace(Oe,(t=>{let e=o(this,xe,Be).call(this,t.slice(1,-1))-u;return`<${o(this,Ne,Ve).call(this,e)}>`})),t=t.slice(l).trimStart(),Fe.lastIndex=0;let p={body:De.encode(f),additions:""===w.trim()?void 0:De.encode(w),timestamp:1e3*u,duration:1e3*c},m={};r(this,Ie)||(m.decoderConfig={description:r(this,ze)},h(this,Ie,!0)),r(this,Ce).output(p,m)}}};return Ce=new WeakMap,Ae=new WeakMap,Le=new WeakMap,ze=new WeakMap,Ie=new WeakMap,xe=new WeakSet,Be=function(t){let e=$e.exec(t);if(!e)throw new Error("Expected match.");return 36e5*Number(e[1]||"0")+6e4*Number(e[2])+1e3*Number(e[3])+Number(e[4])},Ne=new WeakSet,Ve=function(t){let e=Math.floor(t/36e5),i=Math.floor(t%36e5/6e4),s=Math.floor(t%6e4/1e3),a=t%1e3;return e.toString().padStart(2,"0")+":"+i.toString().padStart(2,"0")+":"+s.toString().padStart(2,"0")+"."+a.toString().padStart(3,"0")},je=d,((a,r,n,h)=>{if(r&&"object"==typeof r||"function"==typeof r)for(let o of i(r))s.call(a,o)||o===n||t(a,o,{get:()=>r[o],enumerable:!(h=e(r,o))||h.enumerable});return a})(t({},"__esModule",{value:!0}),je)})();"object"==typeof module&&"object"==typeof module.exports&&Object.assign(module.exports,WebMMuxer);
  if(typeof WebMMuxer!=='undefined')globalThis.WebMMuxer=WebMMuxer;
  
  // --- end webm-muxer ---


  const MOD_ID = "md-take-video";
  const VERSION = "3.5.0";
  const LOG = `[${MOD_ID}]`;

  const SIM_MS_PER_TICK = 20;
  const MIN_TICKS = 1;
  const MAX_TICKS = 30;
  const MIN_FRAMES = 2;
  const MAX_FRAMES_SAFETY = 20000; // hard ceiling only (~hours at 1 tick) — start/stop is free
  const WORKER_SET_PAUSED = 54;
  const FALLBACK_SKY = "#3d6b78";
  const GREENSCREEN = "#00ff00";
  const MARQUEE_CONTENT_INSET_CELLS = 1;
  const DEFAULT_BLOCK_PADDING = 1;
  const STORAGE_SETTINGS = `${MOD_ID}.capture-settings`;

  const VIDEO_MIME_CANDIDATES = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];

  function safe(fn, fallback = null) {
    try { return fn(); } catch { return fallback; }
  }
  function clamp(n, min, max) {
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
  }
  function clampInt(n, min, max) { return clamp(Math.round(n), min, max); }
  /** Allowed render scales: 1, 1/2, 1/4 (down), optional 2 (up). */
  const SCALE_CHOICES = [1, 0.5, 0.25, 2];
  function clampScale(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return 1;
    // snap to nearest allowed
    let best = SCALE_CHOICES[0];
    let bestD = Math.abs(n - best);
    for (const c of SCALE_CHOICES) {
      const d = Math.abs(n - c);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }
  function log(...a) { console.log(LOG, ...a); }
  function warn(...a) { console.warn(LOG, ...a); }

  function readSetting(name, fallback) {
    const api = sandkit.api;
    const d = safe(() => api.settings.get(name));
    if (d !== undefined && d !== null) return d;
    const n = safe(() => api.settings.get(`${MOD_ID}.${name}`));
    if (n !== undefined && n !== null) return n;
    return fallback;
  }
  function isEnabled() {
    const v = readSetting("enabled", true);
    return v === true || v === "true" || v === 1;
  }
  function countdownSeconds() {
    return clampInt(Number(readSetting("countdownSeconds", 2)), 0, 10);
  }
  function pickMimeType() {
    if (typeof MediaRecorder === "undefined") return null;
    for (const m of VIDEO_MIME_CANDIDATES) {
      if (MediaRecorder.isTypeSupported(m)) return m;
    }
    return "";
  }
  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  function captureFilename(ext, frames, durationMs) {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    return `sandustry-${stamp}_${frames}f_${(durationMs / 1000).toFixed(1)}s.${ext}`;
  }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  function isAbortError(e) {
    return e && (e.name === "AbortError" || e.message === "Aborted");
  }
  function throwIfAborted(signal) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  }

  function getSession() { return sandkit.state?.session ?? null; }
  function getGameCanvas() {
    const rendering = getSession()?.rendering;
    return rendering?.canvas ?? rendering?.pixi?.app?.canvas ?? rendering?.pixi?.app?.view ?? null;
  }
  function getDynamic2DCanvas() {
    const context = getSession()?.rendering?.pixi?.dynamic2D?.context;
    return context?.canvas ?? null;
  }
  function getOverlayCanvas() {
    const overlay = getSession()?.rendering?.overlayCanvas;
    if (!overlay || overlay.width <= 0 || overlay.height <= 0) return null;
    return overlay;
  }
  function setSimulationPaused(paused) {
    const session = getSession();
    if (session) session.paused = paused;
    const environment = sandkit.state?.environment;
    const manager = environment?.multithreading?.simulation?.manager;
    if (!manager?.postMessage) return;
    try { manager.postMessage([WORKER_SET_PAUSED, paused]); }
    catch (error) { warn("SetPaused worker message failed:", error); }
  }

  function getMarqueeCustomData() {
    const data = getSession()?.action?.customData;
    if (!data || typeof data !== "object") return null;
    return data;
  }
  function isFinitePoint(point) {
    return point !== undefined && Number.isFinite(point.x) && Number.isFinite(point.y);
  }
  function boundsFromPoints(points) {
    if (points.length === 0) return null;
    let minX = points[0].x, minY = points[0].y, maxX = points[0].x, maxY = points[0].y;
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
  }
  function boundsFromMarquee(start, end) {
    return {
      minX: Math.min(start.x, end.x), minY: Math.min(start.y, end.y),
      maxX: Math.max(start.x, end.x), maxY: Math.max(start.y, end.y),
    };
  }
  function boundsFromStructures(structures, snap) {
    const points = [];
    for (const structure of structures) {
      const origin = structure.originalPos;
      if (!isFinitePoint(origin)) continue;
      points.push(origin);
      points.push({ x: origin.x + snap - 1, y: origin.y + snap - 1 });
    }
    return boundsFromPoints(points);
  }
  function insetBounds(bounds, margin) {
    return { minX: bounds.minX + margin, minY: bounds.minY + margin, maxX: bounds.maxX - margin, maxY: bounds.maxY - margin };
  }
  function expandBounds(bounds, margin) {
    return { minX: bounds.minX - margin, minY: bounds.minY - margin, maxX: bounds.maxX + margin, maxY: bounds.maxY + margin };
  }
  function applyBlockPadding(bounds, paddingCells) {
    if (paddingCells === 0) return bounds;
    if (paddingCells > 0) return expandBounds(bounds, paddingCells);
    return insetBounds(bounds, -paddingCells);
  }
  function getSelectionCellBounds(api, blockPadding = DEFAULT_BLOCK_PADDING) {
    const data = getMarqueeCustomData();
    if (!data?.marqueeSelected) return null;
    const snap = safe(() => api.rendering.getGridMetrics().snapGridCellSize) ||
      safe(() => sandkit.api.rendering.getGridMetrics().snapGridCellSize) || 4;
    const structureBounds = data.selectedStructures?.length
      ? boundsFromStructures(data.selectedStructures, snap) : null;
    const marqueeBounds = isFinitePoint(data.start) && isFinitePoint(data.end)
      ? boundsFromMarquee(data.start, data.end) : null;
    let core = null;
    if (structureBounds) core = structureBounds;
    else if (marqueeBounds) core = insetBounds(marqueeBounds, MARQUEE_CONTENT_INSET_CELLS);
    if (!core) return null;
    const paddingCells = Math.round(blockPadding) * Math.max(1, Math.round(snap));
    return applyBlockPadding(core, paddingCells);
  }
  function resolveCaptureBounds(api, locked, blockPadding) {
    if (locked) return locked;
    return getSelectionCellBounds(api, blockPadding);
  }
  function screenRectFromCellCorners(topLeft, bottomRightExclusive) {
    if (!Number.isFinite(topLeft?.x) || !Number.isFinite(topLeft?.y) ||
        !Number.isFinite(bottomRightExclusive?.x) || !Number.isFinite(bottomRightExclusive?.y)) return null;
    const x = Math.floor(topLeft.x);
    const y = Math.floor(topLeft.y);
    const right = Math.floor(bottomRightExclusive.x) - 1;
    const bottom = Math.floor(bottomRightExclusive.y) - 1;
    const width = right - x + 1;
    const height = bottom - y + 1;
    if (width <= 0 || height <= 0) return null;
    return { x, y, width, height };
  }
  function getSelectionScreenRect(api, bounds) {
    return screenRectFromCellCorners(
      api.rendering.getDrawPositionAtCell(bounds.minX, bounds.minY),
      api.rendering.getDrawPositionAtCell(bounds.maxX + 1, bounds.maxY + 1)
    );
  }
  function clipRectToCanvas(rect, canvasW, canvasH) {
    const x0 = Math.max(0, rect.x);
    const y0 = Math.max(0, rect.y);
    const x1 = Math.min(canvasW, rect.x + rect.width);
    const y1 = Math.min(canvasH, rect.y + rect.height);
    const width = x1 - x0;
    const height = y1 - y0;
    if (width <= 0 || height <= 0) return null;
    return { x: x0, y: y0, width, height };
  }

  let cropScratch = null;
  let scaleScratch = null;
  function scratchCanvas(slot, width, height) {
    const previous = slot === "crop" ? cropScratch : scaleScratch;
    const canvas = previous ?? document.createElement("canvas");
    if (slot === "crop") cropScratch = canvas;
    else scaleScratch = canvas;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    return canvas;
  }

  function backgroundNodes(pixi) {
    const nodes = [];
    for (const node of [pixi?.mountainsSprite, pixi?.treesSmallSprite, pixi?.treesSprite, pixi?.bgL04Sprite, pixi?.bgL04Extension, pixi?.edgeMist?.sprite]) {
      if (node) nodes.push(node);
    }
    return nodes;
  }
  function applyCaptureLook(look) {
    const restores = [];
    if (look?.greenscreen) {
      const pixi = getSession()?.rendering?.pixi;
      const previousBody = document.body.style.backgroundColor;
      if (pixi) {
        const nodes = backgroundNodes(pixi);
        const visibility = nodes.map((node) => node.visible !== false);
        const layer = pixi.mountainsSprite?.parent;
        const previousFilters = layer?.filters ?? null;
        for (const node of nodes) node.visible = false;
        pixi.toggleSkyFilter?.(false);
        restores.push(() => {
          nodes.forEach((node, i) => { node.visible = visibility[i]; });
          if (layer) layer.filters = previousFilters;
          else pixi.toggleSkyFilter?.(previousFilters != null && previousFilters.length > 0);
        });
      }
      document.body.style.backgroundColor = GREENSCREEN;
      restores.push(() => { document.body.style.backgroundColor = previousBody; });
    }
    let restored = false;
    return () => {
      if (restored) return;
      restored = true;
      for (let i = restores.length - 1; i >= 0; i--) restores[i]();
    };
  }

  /** Exact selection-capture composite: sky → gameCanvas → dynamic2D → overlay */
  function rasterizeSelection(api, bounds, scale, look) {
    const screenRect = getSelectionScreenRect(api, bounds);
    if (!screenRect) { warn("could not map cell bounds to screen"); return null; }
    const dynamicCanvas = getDynamic2DCanvas();
    if (!dynamicCanvas) { warn("dynamic2D canvas missing"); return null; }
    const clip = clipRectToCanvas(screenRect, dynamicCanvas.width, dynamicCanvas.height);
    if (!clip) { warn("selection off-screen", { screenRect }); return null; }
    const out = scratchCanvas("crop", clip.width, clip.height);
    const ctx = out.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = look?.greenscreen ? GREENSCREEN : FALLBACK_SKY;
    ctx.fillRect(0, 0, out.width, out.height);

    const gameCanvas = getGameCanvas();
    if (gameCanvas && gameCanvas.width > 0 && gameCanvas.height > 0) {
      try {
        ctx.drawImage(gameCanvas, clip.x, clip.y, clip.width, clip.height, 0, 0, clip.width, clip.height);
      } catch (error) { warn("WebGL backdrop draw failed:", error); }
    }
    try {
      ctx.drawImage(dynamicCanvas, clip.x, clip.y, clip.width, clip.height, 0, 0, clip.width, clip.height);
    } catch (error) {
      console.error(LOG, "dynamic2D draw failed:", error);
      return null;
    }
    const overlayCanvas = getOverlayCanvas();
    if (overlayCanvas) {
      try {
        ctx.drawImage(overlayCanvas, clip.x, clip.y, clip.width, clip.height, 0, 0, clip.width, clip.height);
      } catch (error) { warn("overlay draw failed:", error); }
    }
    const pixelScale = Math.max(1, Math.round(scale));
    if (pixelScale === 1) return out;
    const scaled = scratchCanvas("scale", out.width * pixelScale, out.height * pixelScale);
    const scaledCtx = scaled.getContext("2d");
    if (!scaledCtx) return out;
    scaledCtx.imageSmoothingEnabled = false;
    scaledCtx.drawImage(out, 0, 0, scaled.width, scaled.height);
    return scaled;
  }

  function rasterizeOnPaint(api, bounds, scale, onPaint, look) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let timeoutId = 0;
      const finish = (fn) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        fn();
      };
      const unsubscribe = api.events.on("frame:render", () => {
        unsubscribe();
        onPaint?.();
        queueMicrotask(() => {
          finish(() => {
            try { resolve(rasterizeSelection(api, bounds, scale, look)); }
            catch (error) { reject(error); }
          });
        });
      });
      timeoutId = window.setTimeout(() => {
        unsubscribe();
        finish(() => reject(new Error("paint wait timed out")));
      }, 2000);
    });
  }

  function snapshotOnPaint(api, bounds, onPaint, look) {
    return rasterizeOnPaint(api, bounds, 1, onPaint, look).then((canvas) => {
      if (!canvas) return null;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      return ctx.getImageData(0, 0, canvas.width, canvas.height);
    });
  }

  async function captureVideoFrame(api, bounds, look) {
    if (getSession()?.paused === true) setSimulationPaused(false);
    const snap = () => snapshotOnPaint(api, bounds, () => setSimulationPaused(true), look);
    try { return await snap(); }
    catch (error) {
      warn("paint wait failed, retry:", error);
      setSimulationPaused(false);
      try { return await snap(); }
      catch (retryError) { warn("paint wait failed:", retryError); return null; }
    }
  }

  function waitTicks(api, count, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
      let left = count;
      const timeoutId = setTimeout(() => {
        setSimulationPaused(true);
        reject(new Error("tick wait timed out"));
      }, 15000);
      const onAbort = () => {
        clearTimeout(timeoutId);
        reject(new DOMException("Aborted", "AbortError"));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
      const step = () => {
        if (signal?.aborted) return;
        left -= 1;
        if (left <= 0) {
          clearTimeout(timeoutId);
          signal?.removeEventListener("abort", onAbort);
          setSimulationPaused(true);
          resolve();
          return;
        }
        api.schedule.nextTick(step);
      };
      api.schedule.nextTick(step);
      setSimulationPaused(false);
    });
  }

  /** Scale ImageData by factor. Always nearest-neighbor (pixel art). */
  function scaleImageDataByFactor(image, factor) {
    const f = Number(factor);
    if (!Number.isFinite(f) || f <= 0 || Math.abs(f - 1) < 1e-6) return image;
    const outW = Math.max(1, Math.round(image.width * f));
    const outH = Math.max(1, Math.round(image.height * f));
    if (outW === image.width && outH === image.height) return image;
    const src = scratchCanvas("crop", image.width, image.height);
    const srcCtx = src.getContext("2d", { willReadFrequently: true });
    if (!srcCtx) return image;
    srcCtx.putImageData(image, 0, 0);
    const out = scratchCanvas("scale", outW, outH);
    const outCtx = out.getContext("2d", { willReadFrequently: true });
    if (!outCtx) return image;
    outCtx.imageSmoothingEnabled = false;
    outCtx.drawImage(src, 0, 0, outW, outH);
    return outCtx.getImageData(0, 0, outW, outH);
  }

  function rgbKey(r, g, b) {
    return (r << 16) | (g << 8) | b;
  }

  /**
   * Palette from the first frame (most frequent colours, capped at maxColors).
   * Looks far better on Sandustry than a fixed RGB grid.
   */
  function extractPalette(image, maxColors) {
    const maxC = clampInt(maxColors, 16, 1024);
    const counts = new Map();
    const d = image.data;
    // subsample if huge for speed
    const step = d.length > 2_000_000 ? 8 : d.length > 500_000 ? 4 : 4;
    for (let i = 0; i < d.length; i += step) {
      if (d[i + 3] < 8) continue;
      const k = rgbKey(d[i], d[i + 1], d[i + 2]);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    let entries = [...counts.entries()];
    if (entries.length > maxC) {
      entries.sort((a, b) => b[1] - a[1]);
      entries = entries.slice(0, maxC);
    }
    return entries.map(([k]) => [(k >> 16) & 255, (k >> 8) & 255, k & 255]);
  }

  /** Map every pixel to nearest palette colour (cache exact RGB hits). */
  function quantizeToPalette(image, palette) {
    if (!palette || !palette.length) return image;
    const exact = new Map();
    for (let i = 0; i < palette.length; i++) {
      const [r, g, b] = palette[i];
      exact.set(rgbKey(r, g, b), i);
    }
    const out = new ImageData(image.width, image.height);
    const s = image.data;
    const d = out.data;
    const n = palette.length;
    for (let i = 0; i < s.length; i += 4) {
      const r = s[i], g = s[i + 1], b = s[i + 2], a = s[i + 3];
      d[i + 3] = a;
      if (a < 8) {
        d[i] = d[i + 1] = d[i + 2] = 0;
        continue;
      }
      const k = rgbKey(r, g, b);
      let idx = exact.get(k);
      if (idx === undefined) {
        let best = 0;
        let bestD = 1e15;
        for (let p = 0; p < n; p++) {
          const pr = palette[p][0], pg = palette[p][1], pb = palette[p][2];
          const dr = r - pr, dg = g - pg, db = b - pb;
          const dist = dr * dr + dg * dg + db * db;
          if (dist < bestD) {
            bestD = dist;
            best = p;
            if (dist === 0) break;
          }
        }
        idx = best;
        exact.set(k, idx);
      }
      const col = palette[idx];
      d[i] = col[0];
      d[i + 1] = col[1];
      d[i + 2] = col[2];
    }
    return out;
  }


  /**
   * Optional final pass: decode the recorded WebM and re-encode at a lower
   * bitrate / optional extra downscale. Cuts size a lot for Discord.
   */
  async function recompressBlob(blob, opts = {}) {
    const targetMbps = clamp(opts.bitrateMbps ?? 1.5, 0.4, 12);
    const extraScale = opts.extraScale ?? 1; // 1 or 0.5
    const mime = pickMimeType() || "video/webm";

    const url = URL.createObjectURL(blob);
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;

    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error("video load timeout")), 20000);
      video.onloadeddata = () => { clearTimeout(t); resolve(); };
      video.onerror = () => { clearTimeout(t); reject(new Error("video load failed")); };
    });

    const vw = video.videoWidth || 0;
    const vh = video.videoHeight || 0;
    if (vw < 2 || vh < 2) {
      URL.revokeObjectURL(url);
      return blob; // give up, return original
    }

    const outW = Math.max(2, Math.round(vw * extraScale) & ~1); // even dims help some encoders
    const outH = Math.max(2, Math.round(vh * extraScale) & ~1);
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) {
      URL.revokeObjectURL(url);
      return blob;
    }
    ctx.imageSmoothingEnabled = extraScale < 1;

    const stream = canvas.captureStream(0);
    const track = stream.getVideoTracks()[0];
    const bitrate = Math.round(targetMbps * 1e6);
    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate });
    } catch {
      recorder = new MediaRecorder(stream, { videoBitsPerSecond: bitrate });
    }
    const chunks = [];
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };
    const stopped = new Promise((resolve) => { recorder.onstop = () => resolve(); });
    recorder.start(200);

    // Drive frames off rAF while video plays
    video.currentTime = 0;
    try { await video.play(); } catch { /* autoplay policies — still try */ }

    const duration = (Number.isFinite(video.duration) && video.duration > 0)
      ? video.duration
      : 0;
    const fps = 30;
    const frameInterval = 1000 / fps;
    let last = 0;
    const deadline = performance.now() + Math.max(duration * 1000 + 2000, 5000);

    await new Promise((resolve) => {
      const tick = () => {
        if (video.ended || video.paused && video.currentTime > 0.05 && duration && video.currentTime >= duration - 0.05) {
          resolve();
          return;
        }
        if (performance.now() > deadline) {
          resolve();
          return;
        }
        const now = performance.now();
        if (now - last >= frameInterval - 1) {
          last = now;
          try {
            ctx.drawImage(video, 0, 0, outW, outH);
            if (track && typeof track.requestFrame === "function") track.requestFrame();
          } catch { /* ignore */ }
        }
        if (!video.ended) requestAnimationFrame(tick);
        else resolve();
      };
      // If play didn't start, step manually via currentTime
      if (video.paused) {
        const step = async () => {
          const stepSec = 1 / fps;
          while (video.currentTime < (duration || 1) - stepSec / 2) {
            video.currentTime = Math.min((duration || 1), video.currentTime + stepSec);
            await new Promise((r) => {
              video.onseeked = () => r();
              setTimeout(r, 50);
            });
            try {
              ctx.drawImage(video, 0, 0, outW, outH);
              if (track && typeof track.requestFrame === "function") track.requestFrame();
            } catch { /* ignore */ }
            await sleep(frameInterval * 0.5);
          }
          resolve();
        };
        void step();
      } else {
        requestAnimationFrame(tick);
      }
    });

    try { video.pause(); } catch { /* ignore */ }
    await sleep(80);
    try { recorder.requestData?.(); } catch { /* ignore */ }
    try { recorder.stop(); } catch { /* ignore */ }
    await stopped;
    try { stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    URL.revokeObjectURL(url);

    const out = new Blob(chunks, { type: recorder.mimeType || mime });
    if (!out.size || out.size >= blob.size * 0.98) {
      // no win — keep original
      return blob;
    }
    log("recompress", { from: blob.size, to: out.size, ratio: (out.size / blob.size).toFixed(2) });
    return out;
  }


  /**
   * Stream encode: same per-frame capture as the GIF mod, but never keep a
   * frame array. Each ImageData is drawn once into MediaRecorder then dropped.
   * RAM stays ~1 frame + encoder buffers. File size driven by bitrate.
   */

  /**
   * Capture = GIF-mod path (waitTicks + 3-layer composite).
   * Store each frame as a JPEG blob (cheap RAM), then offline-encode to WebM
   * with a HARD sleep(delayMs) between every requestFrame so the timeline is
   * frameCount * delayMs — not "all frames packed into 4 seconds".
   */


  /**
   * Scan full frame vs previous; return bounding box of pixels that changed
   * (channel delta > tol). null = identical; "full" = too much changed.
   */
  function findDirtyRect(prev, next, tol) {
    if (!prev || !next || prev.width !== next.width || prev.height !== next.height) {
      return "full";
    }
    const w = next.width;
    const h = next.height;
    const a = prev.data;
    const b = next.data;
    const t = tol ?? 8;
    let minX = w, minY = h, maxX = -1, maxY = -1;
    // stride 4 through all pixels — sand changes are local, still fast enough
    for (let y = 0; y < h; y++) {
      const row = y * w * 4;
      for (let x = 0; x < w; x++) {
        const i = row + x * 4;
        if (
          Math.abs(a[i] - b[i]) > t ||
          Math.abs(a[i + 1] - b[i + 1]) > t ||
          Math.abs(a[i + 2] - b[i + 2]) > t
        ) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null; // no change
    // pad 1px to avoid edge seams
    minX = Math.max(0, minX - 1);
    minY = Math.max(0, minY - 1);
    maxX = Math.min(w - 1, maxX + 1);
    maxY = Math.min(h - 1, maxY + 1);
    const rw = maxX - minX + 1;
    const rh = maxY - minY + 1;
    // if >40% of pixels dirty, cheaper to store full frame
    if (rw * rh > w * h * 0.4) return "full";
    return { x: minX, y: minY, w: rw, h: rh };
  }

  function cropImageData(src, rect) {
    const out = new ImageData(rect.w, rect.h);
    const s = src.data;
    const d = out.data;
    const sw = src.width;
    for (let y = 0; y < rect.h; y++) {
      const srcOff = ((rect.y + y) * sw + rect.x) * 4;
      const dstOff = y * rect.w * 4;
      d.set(s.subarray(srcOff, srcOff + rect.w * 4), dstOff);
    }
    return out;
  }

  /** PNG — no JPEG mosquito noise on pixel art */
  function imageDataToPngBlob(image) {
    return new Promise((resolve) => {
      const c = scratchCanvas("scale", image.width, image.height);
      const cx = c.getContext("2d", { alpha: false });
      if (!cx) { resolve(null); return; }
      cx.imageSmoothingEnabled = false;
      cx.putImageData(image, 0, 0);
      c.toBlob((b) => resolve(b), "image/png");
    });
  }


  function evenDim(n) {
    n = Math.max(2, Math.round(n));
    return n % 2 === 0 ? n : n + 1;
  }

  function pickVideoCodec() {
    if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") return null;
    // Prefer VP9, fall back VP8 — both work in Chromium/Electron
    const candidates = [
      { codec: "vp09.00.10.08", mux: "V_VP9" },
      { codec: "vp8", mux: "V_VP8" },
    ];
    for (const c of candidates) {
      try {
        // isConfigSupported is async; we do a sync heuristic and confirm later
        if (c) return c;
      } catch { /* ignore */ }
    }
    return candidates[0];
  }

  /**
   * WebCodecs + webm-muxer: each frame gets an explicit timestamp (µs).
   * This is what actually fixes the "always ~4s" MediaRecorder bug.
   */
  async function encodeFramesWebCodecs(frames, delayMs, bitrateMbps, signal, speed) {
    if (!frames.length) return null;
    if (typeof VideoEncoder === "undefined") {
      throw new Error("WebCodecs VideoEncoder unavailable in this runtime");
    }
    const WMM = globalThis.WebMMuxer;
    if (!WMM || !WMM.Muxer || !WMM.ArrayBufferTarget) {
      throw new Error("webm-muxer failed to load");
    }

    // Reconstruct full frames from: full JPEG | delta patch | identical ref
    const spd = clamp(speed ?? 1, 1, 8);
    const playDelayMs = Math.max(1, delayMs / spd);

    const base = frames.find((f) => f && f.kind === "full" && f.blob) || frames.find((f) => f && f.blob);
    if (!base) throw new Error("no base frame");
    const srcW = base.width;
    const srcH = base.height;
    const w = evenDim(srcW);
    const h = evenDim(srcH);

    const rebuildCanvas = document.createElement("canvas");
    rebuildCanvas.width = srcW;
    rebuildCanvas.height = srcH;
    const rebuildCtx = rebuildCanvas.getContext("2d", { alpha: false, willReadFrequently: true });
    rebuildCtx.imageSmoothingEnabled = false;
    rebuildCtx.imageSmoothingQuality = "low";

    const imgLoader = new Image();
    const loadBlobToImg = (blob) =>
      new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        imgLoader.onload = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        imgLoader.onerror = (e) => {
          URL.revokeObjectURL(url);
          reject(e);
        };
        imgLoader.src = url;
      });

    // Materialize each timeline frame as a drawn canvas state → list of bitmaps later
    const resolved = []; // will hold { canvas snapshot via blob or we'll draw live }
    // Actually we rebuild into rebuildCanvas and snapshot to JPEG only when needed —
    // for encode we createImageBitmap(rebuildCanvas) each step after applying patch.

    const fps = clamp(1000 / playDelayMs, 1, 120);
    const bitrate = Math.round(clamp(bitrateMbps, 0.5, 12) * 1e6);
    const durationUs = Math.round(playDelayMs * 1000);

    // Resolve codec support
    let chosen = null;
    const tryList = [
      { codec: "vp09.00.10.08", mux: "V_VP9" },
      { codec: "vp8", mux: "V_VP8" },
    ];
    for (const c of tryList) {
      try {
        const support = await VideoEncoder.isConfigSupported({
          codec: c.codec,
          width: w,
          height: h,
          bitrate,
          framerate: fps,
        });
        if (support?.supported) {
          chosen = c;
          break;
        }
      } catch { /* ignore */ }
    }
    if (!chosen) chosen = tryList[tryList.length - 1];

    const target = new WMM.ArrayBufferTarget();
    const muxer = new WMM.Muxer({
      target,
      video: {
        codec: chosen.mux,
        width: w,
        height: h,
        frameRate: fps,
      },
    });

    let encodeError = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => {
        try {
          muxer.addVideoChunk(chunk, meta);
        } catch (e) {
          encodeError = e;
        }
      },
      error: (e) => {
        encodeError = e;
        warn("VideoEncoder error", e);
      },
    });

    encoder.configure({
      codec: chosen.codec,
      width: w,
      height: h,
      bitrate,
      framerate: fps,
      latencyMode: "quality",
      // Prefer intra refresh for sharp pixel edges when supported
      avc: undefined,
    });

    // Even-sized output canvas for VideoFrame
    const draw = document.createElement("canvas");
    draw.width = w;
    draw.height = h;
    const dctx = draw.getContext("2d", { alpha: false });
    dctx.imageSmoothingEnabled = false;

    let applied = 0;
    for (let i = 0; i < frames.length; i++) {
      throwIfAborted(signal);
      if (encodeError) throw encodeError;

      const f = frames[i];
      if (!f) continue;

      if (f.kind === "full" && f.blob) {
        await loadBlobToImg(f.blob);
        rebuildCtx.drawImage(imgLoader, 0, 0, srcW, srcH);
      } else if (f.kind === "delta" && f.blob && f.rect) {
        await loadBlobToImg(f.blob);
        rebuildCtx.drawImage(
          imgLoader,
          0, 0, f.rect.w, f.rect.h,
          f.rect.x, f.rect.y, f.rect.w, f.rect.h
        );
      } else if (f.kind === "same") {
        // canvas already holds previous picture — nothing to draw
      } else if (f.blob) {
        // legacy full blob without kind
        await loadBlobToImg(f.blob);
        rebuildCtx.drawImage(imgLoader, 0, 0, srcW, srcH);
      }

      dctx.fillStyle = "#000";
      dctx.fillRect(0, 0, w, h);
      dctx.drawImage(rebuildCanvas, 0, 0, srcW, srcH, 0, 0, w, h);

      const bitmap = await createImageBitmap(draw);
      const timestamp = applied * durationUs;
      const frame = new VideoFrame(bitmap, {
        timestamp,
        duration: durationUs,
      });
      const keyFrame = applied === 0 || applied % Math.max(1, Math.round(fps * 0.5)) === 0;
      encoder.encode(frame, { keyFrame });
      frame.close();
      bitmap.close();
      applied += 1;

      while (encoder.encodeQueueSize > 4) {
        await sleep(8);
        throwIfAborted(signal);
      }

      if (applied === 1 || applied % 30 === 0) {
        log(`encoded ${applied}/${frames.length} @ ${spd}x`);
      }
    }

    await encoder.flush();
    encoder.close();
    if (encodeError) throw encodeError;

    muxer.finalize();
    const buffer = target.buffer;
    if (!buffer || buffer.byteLength < 64) {
      throw new Error("muxer produced empty buffer");
    }

    const blob = new Blob([buffer], { type: "video/webm" });
    return {
      blob,
      mime: "video/webm",
      width: w,
      height: h,
      frames: frames.length,
      durationMs: frames.length * playDelayMs,
      codec: chosen.codec,
      speed: spd,
    };
  }


  async function recordSelectionVideo(api, options) {
    const ticksPerFrame = clampInt(options.ticksPerFrame, MIN_TICKS, MAX_TICKS);
    const delayMs = Math.max(SIM_MS_PER_TICK, ticksPerFrame * SIM_MS_PER_TICK);
    const look = { greenscreen: !!options.greenscreen, showMouse: !!options.showMouse };
    const bounds = options.bounds;
    if (!bounds) {
      warn("no video bounds");
      return { status: "no-selection" };
    }

    const wasPaused = getSession()?.paused === true;
    const scale = clampScale(options.scale ?? 1);
    const safetyCap = clampInt(options.maxFrames ?? MAX_FRAMES_SAFETY, MIN_FRAMES, MAX_FRAMES_SAFETY);
    const bitrateMbps = clamp(options.bitrateMbps ?? 2, 0.5, 12);
    const speed = clamp(options.speed ?? 1, 1, 8);
    const pixelArt = options.pixelArt !== false;
    const maxPalette = clampInt(options.maxPalette ?? 256, 64, 1024);
    let palette = null;
    const playDelayMs = Math.max(1, delayMs / speed);
    const durationUs = Math.round(playDelayMs * 1000);
    const fps = clamp(1000 / playDelayMs, 1, 120);

    if (typeof VideoEncoder === "undefined") {
      api.ui.toast("WebCodecs missing — cannot encode reliable video");
      return { status: "failed", frames: 0 };
    }
    const WMM = globalThis.WebMMuxer;
    if (!WMM || !WMM.Muxer || !WMM.ArrayBufferTarget) {
      api.ui.toast("webm-muxer missing");
      return { status: "failed", frames: 0 };
    }

    log("record start (stream WebCodecs)", {
      bounds, ticksPerFrame, delayMs, playDelayMs, scale, bitrateMbps, speed, pixelArt, maxPalette,
    });

    const restoreLook = applyCaptureLook(look);
    let status = null;
    let frameCount = 0;
    let encoder = null;
    let muxer = null;
    let target = null;
    let encodeError = null;
    let encodeWidth = 0;
    let encodeHeight = 0;
    let chosen = null;
    let draw = null;
    let dctx = null;

    async function ensureEncoder(imgData) {
      if (encoder) return;
      encodeWidth = evenDim(imgData.width);
      encodeHeight = evenDim(imgData.height);
      const bitrate = Math.round(bitrateMbps * 1e6);

      const tryList = [
        { codec: "vp09.00.10.08", mux: "V_VP9" },
        { codec: "vp8", mux: "V_VP8" },
      ];
      for (const c of tryList) {
        try {
          const support = await VideoEncoder.isConfigSupported({
            codec: c.codec,
            width: encodeWidth,
            height: encodeHeight,
            bitrate,
            framerate: fps,
          });
          if (support?.supported) {
            chosen = c;
            break;
          }
        } catch { /* ignore */ }
      }
      if (!chosen) chosen = tryList[tryList.length - 1];

      target = new WMM.ArrayBufferTarget();
      muxer = new WMM.Muxer({
        target,
        video: {
          codec: chosen.mux,
          width: encodeWidth,
          height: encodeHeight,
          frameRate: fps,
        },
      });

      encoder = new VideoEncoder({
        output: (chunk, meta) => {
          try {
            muxer.addVideoChunk(chunk, meta);
          } catch (e) {
            encodeError = e;
          }
        },
        error: (e) => {
          encodeError = e;
          warn("VideoEncoder error", e);
        },
      });
      encoder.configure({
        codec: chosen.codec,
        width: encodeWidth,
        height: encodeHeight,
        bitrate,
        framerate: fps,
        latencyMode: "quality",
      });

      draw = document.createElement("canvas");
      draw.width = encodeWidth;
      draw.height = encodeHeight;
      dctx = draw.getContext("2d", { alpha: false });
      dctx.imageSmoothingEnabled = false;

      log("encoder live", {
        size: `${encodeWidth}x${encodeHeight}`,
        codec: chosen.codec,
        fps,
        playDelayMs,
      });
    }

    async function encodeOne(imgData, index) {
      await ensureEncoder(imgData);
      if (encodeError) throw encodeError;

      dctx.fillStyle = "#000";
      dctx.fillRect(0, 0, encodeWidth, encodeHeight);
      // putImageData only works 1:1 — draw via temp if size differs
      if (imgData.width === encodeWidth && imgData.height === encodeHeight) {
        dctx.putImageData(imgData, 0, 0);
      } else {
        const tmp = scratchCanvas("crop", imgData.width, imgData.height);
        const tctx = tmp.getContext("2d", { willReadFrequently: true });
        tctx.putImageData(imgData, 0, 0);
        dctx.imageSmoothingEnabled = false;
        dctx.drawImage(tmp, 0, 0, encodeWidth, encodeHeight);
      }

      const bitmap = await createImageBitmap(draw);
      const frame = new VideoFrame(bitmap, {
        timestamp: index * durationUs,
        duration: durationUs,
      });
      const keyFrame = index === 0 || index % Math.max(1, Math.round(fps * 0.5)) === 0;
      encoder.encode(frame, { keyFrame });
      frame.close();
      bitmap.close();

      while (encoder.encodeQueueSize > 2) {
        await sleep(4);
      }
    }

    try {
      for (let i = 0; i < safetyCap; i++) {
        throwIfAborted(options.signal);
        if (i > 0) {
          await waitTicks(api, ticksPerFrame, options.signal);
          throwIfAborted(options.signal);
        }

        const cropFrame = await captureVideoFrame(api, bounds, look);
        throwIfAborted(options.signal);
        if (!cropFrame) {
          if (i === 0) {
            status = "out-of-view";
            break;
          }
          warn(`frame ${i + 1} missing — stop`);
          break;
        }

        let scaled = scaleImageDataByFactor(cropFrame, scale);
        if (pixelArt) {
          if (!palette) {
            palette = extractPalette(scaled, maxPalette);
            log("palette from frame 0", { colors: palette.length, max: maxPalette });
          }
          scaled = quantizeToPalette(scaled, palette);
        }

        // Stream straight into WebCodecs — no frame list in RAM
        await encodeOne(scaled, frameCount);
        frameCount += 1;

        options.onFrame?.(
          frameCount,
          frameCount,
          delayMs,
          0,
          frameCount,
          { full: frameCount, delta: 0, same: 0 }
        );

        if (frameCount === 1 || frameCount % 30 === 0) {
          log(`streamed frame ${frameCount}`);
        }

        if (options.shouldStop?.()) break;
        if (encodeError) throw encodeError;
      }
    } catch (error) {
      if (isAbortError(error)) status = "cancelled";
      else {
        console.error(LOG, "record threw:", error);
        status = "failed";
      }
    } finally {
      restoreLook();
      setSimulationPaused(wasPaused);
    }

    if (status === "out-of-view" || status === "cancelled" || status === "failed") {
      try {
        encoder?.close();
      } catch { /* ignore */ }
      return { status, frames: frameCount };
    }
    if (frameCount < 1 || !encoder || !muxer) {
      return { status: "failed", frames: 0 };
    }

    options.onEncodeStart?.();
    api.ui.toast(`Finalizing ${frameCount} frames…`);

    try {
      await encoder.flush();
      encoder.close();
      if (encodeError) throw encodeError;
      muxer.finalize();
      const buffer = target.buffer;
      if (!buffer || buffer.byteLength < 64) {
        return { status: "failed", frames: frameCount };
      }
      const blob = new Blob([buffer], { type: "video/webm" });
      const durationMs = frameCount * playDelayMs;
      log("video ready (stream)", {
        frames: frameCount,
        bytes: blob.size,
        durationMs,
        codec: chosen?.codec,
      });
      return {
        status: "ok",
        blob,
        mime: "video/webm",
        width: encodeWidth,
        height: encodeHeight,
        frames: frameCount,
        durationMs,
        codec: chosen?.codec,
        speed,
      };
    } catch (error) {
      if (isAbortError(error)) return { status: "cancelled", frames: frameCount };
      console.error(LOG, "finalize threw:", error);
      api.ui.toast(`Encode failed: ${error?.message || error}`);
      return { status: "failed", frames: frameCount };
    }
  }

  function loadLocalSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_SETTINGS);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }
  function saveLocalSettings(s) {
    try { localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(s)); } catch { /* ignore */ }
  }
  function defaultLocalSettings() {
    return {
      ticksPerFrame: 1, scale: 1, blockPadding: DEFAULT_BLOCK_PADDING,
      lockedBounds: null, bitrateMbps: Number(readSetting("videoBitrateMbps", 2)) || 2,
      speed: 1,
      pixelArt: true,
      maxPalette: 256,
      compressPass: false,
      greenscreen: false,
    };
  }

  const React = sandkit.react;
  const { useState, useEffect, useRef, useCallback } = React;
  const h = React.createElement;

  const BINDINGS = {
    togglePanel: `${MOD_ID}.togglePanel`,
    startStop: `${MOD_ID}.startStop`,
  };
  const live = (() => {
    const key = `${MOD_ID}:live`;
    const root = globalThis;
    return root[key] ?? (root[key] = {
      open: false, setOpen: null, bindingsInstalled: false, startStop: null, stopFlag: false,
    });
  })();

  const FIELD = "w-full min-w-[8rem] px-2 py-1.5 text-sm bg-black/50 text-slate-200 border border-slate-600 rounded focus:border-amber-400 focus:outline-none disabled:opacity-50";
  const BTN = "px-3 py-1.5 text-sm font-medium rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed";
  const BTN_PRIMARY = `${BTN} bg-amber-500/90 text-black border-amber-400 hover:bg-amber-400`;
  const BTN_DANGER = `${BTN} bg-red-600/80 text-white border-red-500 hover:bg-red-500`;
  const BTN_GHOST = `${BTN} bg-slate-800/80 text-slate-200 border-slate-600 hover:bg-slate-700`;

  function Row({ label, children }) {
    return h("div", { className: "flex items-center justify-between gap-3 py-1.5", style: { minHeight: 32 } },
      h("span", { className: "text-xs text-slate-400 shrink-0 w-32" }, label),
      h("div", { className: "flex-1 flex items-center justify-end gap-2" }, children));
  }
  function NumberField({ value, min, max, step, disabled, onChange }) {
    return h("input", {
      type: "number", className: FIELD, style: { maxWidth: 88 },
      value, min, max, step: step ?? 1, disabled,
      onChange: (e) => onChange(Number(e.target.value)),
    });
  }
  function formatDuration(ms) { return `${(Math.max(0, ms) / 1000).toFixed(1)}s`; }
  function formatBytes(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  }

  function Panel() {
    const [open, setOpen] = useState(() => live.open);
    const [local, setLocal] = useState(() => ({ ...defaultLocalSettings(), ...(loadLocalSettings() || {}) }));
    const [phase, setPhase] = useState("idle");
    const [countdownLeft, setCountdownLeft] = useState(null);
    const [progress, setProgress] = useState(null);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const abortRef = useRef(null);
    const stopFlagRef = useRef(false);

    useEffect(() => { live.setOpen = setOpen; live.open = open; }, [open]);
    useEffect(() => { saveLocalSettings(local); }, [local]);
    const patch = useCallback((p) => setLocal((c) => ({ ...c, ...p })), []);
    const busy = phase === "countdown" || phase === "recording" || phase === "encoding";
    const delayMs = Math.max(SIM_MS_PER_TICK, local.ticksPerFrame * SIM_MS_PER_TICK);

    function lockArea() {
      if (busy) return;
      const api = sandkit.api;
      const bounds = getSelectionCellBounds(api, local.blockPadding);
      if (!bounds) { api.ui.toast("No selection — press C, drag a box, then Lock"); return; }
      patch({ lockedBounds: bounds });
      api.ui.toast("Capture area locked");
    }
    function clearLock() {
      if (busy) return;
      patch({ lockedBounds: null });
      sandkit.api.ui.toast("Capture area cleared");
    }

    async function startRecord() {
      if (busy || phase === "review") return;
      const api = sandkit.api;
      if (!isEnabled()) { api.ui.toast("Mod disabled"); return; }
      const bounds = resolveCaptureBounds(api, local.lockedBounds, local.blockPadding);
      if (!bounds) { api.ui.toast("No selection — press C, drag, or Lock area"); return; }
      if (typeof MediaRecorder === "undefined") { api.ui.toast("MediaRecorder unavailable"); return; }

      setError(null); setResult(null); setProgress(null);
      stopFlagRef.current = false; live.stopFlag = false;
      const ac = new AbortController();
      abortRef.current = ac;

      const cd = countdownSeconds();
      if (cd > 0) {
        setPhase("countdown");
        for (let i = cd; i > 0; i--) {
          if (ac.signal.aborted) { setPhase("idle"); setCountdownLeft(null); return; }
          setCountdownLeft(i);
          api.ui.toast(`Recording in ${i}…`);
          await sleep(1000);
        }
        setCountdownLeft(null);
      }
      if (ac.signal.aborted) { setPhase("idle"); return; }

      setPhase("recording");
      api.ui.toast("Recording (sim ticks)…");

      const res = await recordSelectionVideo(api, {
        bounds,
        ticksPerFrame: local.ticksPerFrame,
        scale: local.scale,
        greenscreen: local.greenscreen,
        bitrateMbps: local.bitrateMbps,
        speed: local.speed || 1,
        pixelArt: local.pixelArt !== false,
        maxPalette: local.maxPalette || 256,
        compressPass: local.compressPass === true,
        signal: ac.signal,
        shouldStop: () => stopFlagRef.current || live.stopFlag,
        onFrame: (n, total, delay) => {
          const spd = local.speed || 1;
          setProgress({
            frames: total,
            durationMs: (total * delay) / spd,
            delayMs: delay,
            speed: spd,
          });
        },
        onEncodeStart: () => {
          // stream already encoded — brief finalize only
          setProgress((p) => (p ? { ...p, encoding: true } : { encoding: true }));
        },
      });
      abortRef.current = null;

      if (res.status === "ok") {
        let final = res;
        if (local.compressPass === true && res.blob) {
          setPhase("encoding");
          api.ui.toast("Optional compress…");
          try {
            const smaller = await recompressBlob(res.blob, {
              bitrateMbps: Math.max(0.8, (local.bitrateMbps || 2) * 0.65),
              extraScale: 1,
            });
            if (smaller && smaller.size > 0 && smaller.size < res.blob.size) {
              final = { ...res, blob: smaller, mime: smaller.type || res.mime };
              log("compress saved", { before: res.blob.size, after: smaller.size });
            }
          } catch (e) {
            warn("compress pass failed, keeping original", e);
          }
        }
        setResult(final);
        setPhase("review");
        api.ui.toast(`Ready — ${final.frames} frames · ${formatDuration(final.durationMs)} · ${formatBytes(final.blob.size)}`);
      } else if (res.status === "cancelled") {
        setPhase("idle"); api.ui.toast("Cancelled");
      } else if (res.status === "no-selection" || res.status === "out-of-view") {
        setError(res.status); setPhase("idle"); api.ui.toast("Selection off-screen or missing");
      } else {
        setError(res.status || "failed"); setPhase("idle"); api.ui.toast("Record failed");
      }
    }

    function stopRecord() {
      stopFlagRef.current = true;
      live.stopFlag = true;
      sandkit.api.ui.toast("Stopping after current frame…");
    }
    function cancelAll() {
      stopFlagRef.current = true; live.stopFlag = true;
      abortRef.current?.abort(); abortRef.current = null;
      setPhase("idle"); setCountdownLeft(null); setProgress(null); setResult(null); setError(null);
    }
    function saveVideo() {
      if (!result?.blob) return;
      const name = captureFilename("webm", result.frames, result.durationMs);
      downloadBlob(result.blob, name);
      sandkit.api.ui.toast(`Saved ${name} · ${result.frames} frames · ${formatBytes(result.blob.size)}`);
    }
    function discardReview() { setResult(null); setPhase("idle"); }

    live.startStop = () => {
      if (phase === "recording" || phase === "countdown") stopRecord();
      else if (phase === "idle") void startRecord();
    };

    if (!open) return null;

    const statusText = (() => {
      if (phase === "idle") return "Idle — GIF capture path → WebM encode";
      if (phase === "countdown") return `Countdown: ${countdownLeft}…`;
      if (phase === "recording" && progress)
        return `● REC  ${progress.frames} frames  ·  ~${formatDuration(progress.durationMs)} @ ${progress.speed || 1}x (stream encode, low RAM)`;
      if (phase === "recording") return "● REC…";
      if (phase === "encoding") return `Finalizing ${progress?.frames ?? "?"} frames…`;
      if (phase === "review" && result)
        return `Review  ${result.frames} frames  ·  ${formatDuration(result.durationMs)}  ·  ${formatBytes(result.blob.size)}  ·  ${result.width}×${result.height}`;
      return "—";
    })();

    return h("div", {
      className: "pointer-events-auto",
      style: { position: "fixed", top: 72, right: 16, width: 360, zIndex: 99990, fontFamily: "system-ui, sans-serif" },
    }, h("div", {
      className: "rounded-lg border border-slate-600 shadow-2xl overflow-hidden",
      style: { background: "rgba(12,16,24,0.94)", backdropFilter: "blur(8px)" },
    },
      h("div", {
        className: "flex items-center justify-between px-3 py-2 border-b border-slate-700",
        style: { background: "rgba(0,0,0,0.35)" },
      },
        h("div", { className: "flex items-center gap-2" },
          h("span", { className: "text-amber-400 font-semibold text-sm" }, "Take Video"),
          h("span", { className: "text-[10px] text-slate-500" }, `v${VERSION}`)
        ),
        h("button", {
          type: "button", className: BTN_GHOST, style: { padding: "2px 8px", fontSize: 12 },
          onClick: () => { live.open = false; setOpen(false); },
        }, "✕")
      ),
      h("div", { className: "px-3 py-2 text-slate-200" },
        h("div", {
          className: "text-xs mb-2 px-2 py-1.5 rounded leading-snug",
          style: {
            background: phase === "recording" ? "rgba(185,28,28,0.35)"
              : phase === "encoding" ? "rgba(30,64,175,0.4)"
              : phase === "countdown" ? "rgba(180,120,0,0.35)"
              : phase === "review" ? "rgba(22,101,52,0.35)"
              : "rgba(30,41,59,0.6)",
          },
        }, statusText),
        error && h("div", { className: "text-xs text-red-400 mb-2" }, String(error)),

        h(Row, { label: "Capture area" },
          h("button", { type: "button", className: BTN_GHOST, disabled: busy, onClick: lockArea }, local.lockedBounds ? "Re-lock" : "Lock"),
          h("button", { type: "button", className: BTN_GHOST, disabled: busy || !local.lockedBounds, onClick: clearLock }, "Clear")
        ),
        local.lockedBounds && h("div", { className: "text-[10px] text-slate-500 text-right -mt-1 mb-1" },
          `Locked ${local.lockedBounds.maxX - local.lockedBounds.minX + 1}×${local.lockedBounds.maxY - local.lockedBounds.minY + 1} cells`),

        h(Row, { label: "Ticks / capture" },
          h(NumberField, {
            value: local.ticksPerFrame, min: MIN_TICKS, max: MAX_TICKS, disabled: busy,
            onChange: (v) => patch({ ticksPerFrame: clampInt(v, MIN_TICKS, MAX_TICKS) }),
          })
        ),
        h("div", { className: "text-[10px] text-slate-500 text-right -mt-1 mb-1" },
          `sim advances ${local.ticksPerFrame} tick(s) between captures · ${delayMs}ms · ~${(1000 / delayMs).toFixed(0)} frames/s in video`),

        h(Row, { label: "Render scale" },
          h("select", {
            className: FIELD,
            style: { maxWidth: 120 },
            disabled: busy,
            value: String(local.scale),
            onChange: (e) => patch({ scale: clampScale(Number(e.target.value)) }),
          },
            h("option", { value: "1" }, "1× (native)"),
            h("option", { value: "0.5" }, "½ (half)"),
            h("option", { value: "0.25" }, "¼ (quarter)"),
            h("option", { value: "2" }, "2× (upscale)")
          )
        ),
        h("div", { className: "text-[10px] text-slate-500 text-right -mt-1 mb-1" },
          "½ / ¼ = fewer pixels → much smaller file"),

        h(Row, { label: "Play speed" },
          h("select", {
            className: FIELD,
            style: { maxWidth: 120 },
            disabled: busy,
            value: String(local.speed || 1),
            onChange: (e) => patch({ speed: clamp(Number(e.target.value), 1, 8) }),
          },
            h("option", { value: "1" }, "1× normal"),
            h("option", { value: "2" }, "2× faster"),
            h("option", { value: "3" }, "3× faster"),
            h("option", { value: "4" }, "4× faster"),
            h("option", { value: "6" }, "6× faster"),
            h("option", { value: "8" }, "8× faster")
          )
        ),
        h("div", { className: "text-[10px] text-slate-500 text-right -mt-1 mb-1" },
          "Shortens video timeline (same captures, less duration)"),

        h(Row, { label: "Bitrate Mb/s" },
          h(NumberField, {
            value: local.bitrateMbps, min: 0.5, max: 12, step: 0.5, disabled: busy,
            onChange: (v) => patch({ bitrateMbps: clamp(v, 0.5, 12) }),
          })
        ),
        h(Row, { label: "Pixel art mode" },
          h("input", {
            type: "checkbox",
            disabled: busy,
            checked: local.pixelArt !== false,
            onChange: (e) => patch({ pixelArt: !!e.target.checked }),
          })
        ),
        h(Row, { label: "Palette size" },
          h("select", {
            className: FIELD,
            style: { maxWidth: 140 },
            disabled: busy || local.pixelArt === false,
            value: String(local.maxPalette || 256),
            onChange: (e) => patch({ maxPalette: clampInt(Number(e.target.value), 64, 1024) }),
          },
            h("option", { value: "64" }, "64 colours"),
            h("option", { value: "128" }, "128 colours"),
            h("option", { value: "256" }, "256 colours"),
            h("option", { value: "512" }, "512 colours"),
            h("option", { value: "1024" }, "1024 colours")
          )
        ),
        h("div", { className: "text-[10px] text-slate-500 text-right -mt-1 mb-1" },
          "From 1st frame · nearest map · stream encode (low RAM)"),

        h(Row, { label: "Compress pass" },
          h("input", {
            type: "checkbox",
            disabled: busy,
            checked: !!local.compressPass,
            onChange: (e) => patch({ compressPass: !!e.target.checked }),
          })
        ),
        h("div", { className: "text-[10px] text-slate-500 text-right -mt-1 mb-1" },
          "Optional extra re-encode (off = correct duration)"),
        h(Row, { label: "Padding" },
          h(NumberField, {
            value: local.blockPadding, min: -8, max: 16, disabled: busy,
            onChange: (v) => patch({ blockPadding: clampInt(v, -8, 16) }),
          })
        ),

        h("div", { className: "flex flex-wrap gap-2 pt-2 mt-1 border-t border-slate-700" },
          phase === "idle" && h("button", { type: "button", className: BTN_PRIMARY, onClick: () => void startRecord() }, "● Start record"),
          (phase === "countdown" || phase === "recording") && h("button", { type: "button", className: BTN_DANGER, onClick: stopRecord }, "■ Stop"),
          (phase === "countdown" || phase === "recording") && h("button", { type: "button", className: BTN_GHOST, onClick: cancelAll }, "Cancel"),
          phase === "review" && h("button", { type: "button", className: BTN_PRIMARY, onClick: saveVideo }, "Save video"),
          phase === "review" && h("button", { type: "button", className: BTN_GHOST, onClick: discardReview }, "Discard")
        ),
        h("div", { className: "text-[10px] text-slate-500 pt-2" },
          "Capture = GIF path. Encode = WebCodecs + WebM muxer (real timestamps).")
      )
    ));
  }

  let previewUnsub = null;
  function installPreviewOutline() {
    if (previewUnsub) return;
    const api = sandkit.api;
    previewUnsub = api.events.on("frame:render", () => {
      if (!live.open) return;
      const settings = loadLocalSettings() || defaultLocalSettings();
      const bounds = resolveCaptureBounds(api, settings.lockedBounds, settings.blockPadding ?? 1);
      if (!bounds) return;
      const screen = getSelectionScreenRect(api, bounds);
      if (!screen) return;
      safe(() => {
        api.rendering.withOverlayContext((ctx) => {
          ctx.save();
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(screen.x + 0.5, screen.y + 0.5, screen.width - 1, screen.height - 1);
          ctx.restore();
        });
      });
    });
  }
  function removePreviewOutline() {
    if (previewUnsub) {
      try { previewUnsub(); } catch { /* ignore */ }
      previewUnsub = null;
    }
  }

  function installBindings() {
    if (live.bindingsInstalled) return;
    live.bindingsInstalled = true;
    const api = sandkit.api;
    const category = "Take Video";
    api.input.registerBinding(BINDINGS.togglePanel, ["F7"], {
      displayName: "Toggle Take Video panel",
      displayNameKey: "Toggle Take Video panel",
      category,
      handlers: {
        down: () => {
          live.open = !live.open;
          if (live.setOpen) live.setOpen(live.open);
          else safe(() => api.ui.overlays.update("global"));
        },
      },
    });
    api.input.registerBinding(BINDINGS.startStop, [], {
      displayName: "Start/Stop video record",
      displayNameKey: "Start/Stop video record",
      category,
      handlers: {
        down: () => { if (typeof live.startStop === "function") live.startStop(); },
      },
    });
  }

  let overlayCleanup = null;
  function main() {
    if (!isEnabled()) return;
    log(`v${VERSION} loading — GIF capture path → WebM encode`);
    installBindings();
    installPreviewOutline();
    overlayCleanup = sandkit.api.ui.inject(`${MOD_ID}:panel`, Panel);
    safe(() => sandkit.api.ui.overlays.update("global"));
    sandkit.api.ui.toast(`Take Video v${VERSION} — F7`);
  }
  function teardown() {
    live.stopFlag = true;
    removePreviewOutline();
    if (typeof overlayCleanup === "function") {
      try { overlayCleanup(); } catch { /* ignore */ }
      overlayCleanup = null;
    }
    live.open = false;
    live.setOpen = null;
  }

  let started = false;
  function applyEnabled(enabled) {
    if (enabled && !started) {
      started = true;
      try { main(); }
      catch (e) { warn("main failed", e); teardown(); started = false; }
    } else if (!enabled && started) {
      teardown(); started = false;
    }
  }
  applyEnabled(isEnabled());
  let last = isEnabled();
  setInterval(() => {
    const now = isEnabled();
    if (now !== last) { last = now; applyEnabled(now); }
  }, 800);
})();
