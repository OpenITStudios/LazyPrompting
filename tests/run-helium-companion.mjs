// Source-only fixtures, NOT a real Helium browser acceptance test.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {runInNewContext} from "node:vm";
import {heliumManifest} from "../scripts/package-helium-companion.mjs";
const read=async p=>readFile(new URL("../"+p,import.meta.url),"utf8");
const canonical=JSON.parse(await read("apps/desktop/browser-extension/chatgpt-composer/manifest.json"));
const generated=heliumManifest(canonical),cs=generated.content_scripts[0];
assert.equal(generated.name,"LazyPrompting Companion (Helium)");
assert.deepEqual(generated.permissions,["storage"]);
assert.deepEqual(generated.host_permissions,["https://chatgpt.com/*"]);
assert.ok(!generated.background&&!generated.action&&!generated.externally_connectable);
assert.deepEqual(cs.js,["companion/core.js","companion/compact-history.js",
 "companion/limit-notice.js","companion/standalone-meter.js","companion/toolbar.js"]);
assert.deepEqual(cs.css,["companion/toolbar.css","companion/standalone-meter.css"]);
const src=await read("apps/desktop/browser-extension/helium/standalone-meter.js");
const css=await read("apps/desktop/browser-extension/helium/standalone-meter.css");
const sandbox={Intl}; sandbox.globalThis=sandbox;
runInNewContext(src,sandbox,{timeout:1000});
const H=sandbox.__lpHeliumMeter;
assert.ok(Object.isFrozen(H));assert.equal(H.preferCompact,true);
for(const [s,n] of [["Chat ~3.60M",3600000],["4,441,883",4441883],["0",0]])
 assert.equal(H.parse(s),n,s);
for(const s of ["-2","4.444M","100000001","junk","0x20","4,41,883"])
 assert.equal(H.parse(s),null,s);
for(const [n,s] of [[0,"UNKNOWN"],[3199999,"TRACKED"],[3200000,"CHECKPOINT"],
 [3600000,"MOVE_SOON"],[4000000,"STOP_PLAN"]])assert.equal(H.stage(n),s);
assert.equal(H.key("abc"),"lp-helium-reported-tokens:abc");
assert.ok(css.includes("#lp-companion"));
const toolbar=await read("apps/desktop/browser-extension/chatgpt-composer/companion/toolbar.js");
assert.ok(toolbar.includes("if(H)H.mount(bar,panel)"));
assert.ok(toolbar.includes("if(H)void H.sync(id)"));
assert.ok(toolbar.includes('className:"lp-meter-strip"'));
assert.ok(src.includes("chat.append(readout)"));
assert.ok(toolbar.includes("H?.preferCompact===true"));
assert.ok(toolbar.includes('H?"Helium advisory: enter a manual estimate above.'));
assert.ok(src.includes("revision++;busy=true;render();"));
assert.ok(!JSON.stringify(canonical).includes("standalone-meter.js"));
for(const s of ["backend-api","document.cookie","window.fetch","XMLHttpRequest",
 "innerText","responseText","setInterval("])assert.ok(!src.includes(s),s);
console.log("Helium source contract authored; Helium/Windows runtime not executed.");
