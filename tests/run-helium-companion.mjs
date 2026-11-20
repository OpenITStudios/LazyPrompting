/* Authored source checks only: Helium/ChatGPT/Windows NOT_EXECUTED. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {runInNewContext} from "node:vm";
import {heliumManifest} from "../scripts/package-helium-companion.mjs";
const read=async path=>readFile(new URL("../"+path,import.meta.url),"utf8");
const manifest=heliumManifest();
assert.equal(manifest.manifest_version,3);
assert.equal(manifest.name,"LazyPrompting Compact History (Helium)");
assert.deepEqual(manifest.permissions,[]);
assert.deepEqual(manifest.host_permissions,["https://chatgpt.com/*"]);
assert.equal(manifest.action,undefined);
assert.equal(manifest.options_page,undefined);
assert.equal(manifest.background,undefined);
assert.deepEqual(manifest.content_scripts[0].js,[
 "companion/core.js","companion/compact-history.js",
 "companion/usage-meter-signal.js","companion/compact-controller.js"]);
assert.deepEqual(manifest.content_scripts[0].css,["companion/compact.css"]);
const signal=await read("apps/desktop/browser-extension/helium/usage-meter-signal.js");
const controller=await read("apps/desktop/browser-extension/helium/compact-controller.js");
const style=await read("apps/desktop/browser-extension/helium/compact.css");
const env={};env.globalThis=env;
runInNewContext(signal,env,{timeout:1000});
const U=env.__lpHeliumUsageSignal;
assert.ok(Object.isFrozen(U));
for(const [input,result] of [
 ["This chat is about 1,511,340 tokens — estimate",1511340],
 ["~1.51M tokens",1510000],["35.7K",35700],
 ["This chat: ~4.44M tokens",4440000]
])assert.equal(U.parse(input),result,input);
for(const input of ["",null,"4M and something","unknown",
 "This chat is about 4M tokens","~1000M","~1.5M extra"])
 assert.equal(U.parse(input),null,String(input));
for(const [n,stage] of [
 [0,"UNKNOWN"],[3199999,"NORMAL"],[3200000,"CHECKPOINT"],
 [3600000,"PREPARE"],[4000000,"STOP"]
])assert.equal(U.stage(n),stage);
let badge=null;
const seg={
 getAttribute:name=>name==="title"?"This chat is about 1,511,340 tokens — estimate":null,
 querySelector:selector=>selector===".lp-helium-turn-count"?badge:
  selector===".cgum-val"?{textContent:"~1.51M tokens"}:null,
 append:node=>{badge=node;}
};
const doc={
 querySelector:selector=>selector==="#chatgpt-usage-overlay .cgum-tokens"?seg:null,
 createElement:()=>({setAttribute(){},textContent:"",title:""})
};
assert.equal(U.observe(doc)?.tokens,1511340);
assert.equal(U.decorate(doc,48),true);
assert.equal(badge.textContent,"48 pesan termuat");
assert.equal(U.decorate(doc,52),true);
assert.equal(badge.textContent,"52 pesan termuat");
assert.equal(U.decorate(doc,3001),true);
assert.equal(badge.textContent,"3000+ pesan termuat");
assert.equal(U.observe({querySelector:()=>null}),null);
assert.equal(U.decorate({querySelector:()=>null},12),false);
assert.ok(controller.includes("M.apply(document,{enabled:true"));
assert.ok(controller.includes("U.decorate(document,loaded)"));
assert.ok(controller.includes("U.observe(document)"));
assert.ok(!controller.includes("chrome.storage"));
assert.ok(!controller.includes("createUI()"));
assert.ok(style.includes("content-visibility:auto"));
assert.ok(style.includes(".lp-helium-turn-count"));
const native=JSON.parse(await read("apps/desktop/browser-extension/chatgpt-composer/manifest.json"));
assert.deepEqual(native.permissions,["storage"]);
assert.ok(native.content_scripts[0].js.includes("companion/toolbar.js"));
const packageSource=await read("scripts/package-helium-companion.mjs");
assert.ok(!packageSource.includes("standalone-meter.js"));
assert.ok(!packageSource.includes("popup/popup.html"));
for(const src of [signal,controller]){
 for(const forbidden of [
  "backend-api","/api/auth/session","document.cookie","window.fetch",
  "XMLHttpRequest","responseText","innerText","setInterval("
 ])assert.ok(!src.includes(forbidden),"forbidden transport: "+forbidden);
}
console.log("Helium compact addon SOURCE_CHECK authored; Helium runtime NOT_EXECUTED.");

