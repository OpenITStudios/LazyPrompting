// Synthetic source contract. Authored in ChatGPT/GitHub; never a Windows or live ChatGPT test.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {runInNewContext} from "node:vm";
const base=new URL("../apps/desktop/browser-extension/chatgpt-composer/",import.meta.url);
const read=async name=>readFile(new URL(name,base),"utf8");
const manifest=JSON.parse(await read("manifest.json"));
assert.equal(manifest.name,"LazyPrompting Companion");
assert.deepEqual(manifest.permissions,["storage"]);
assert.deepEqual(manifest.host_permissions,["https://chatgpt.com/*"]);
assert.equal(manifest.content_scripts.length,1);
assert.deepEqual(manifest.content_scripts[0].js,
 ["companion/core.js","companion/compact-history.js","companion/limit-notice.js","companion/toolbar.js"]);
assert.deepEqual(manifest.content_scripts[0].css,["companion/toolbar.css"]);
assert.equal(manifest.content_scripts[0].all_frames,false);
assert.ok(!manifest.background&&!manifest.action&&!manifest.externally_connectable);
const core=await read("companion/core.js");
const compact=await read("companion/compact-history.js");
const notice=await read("companion/limit-notice.js");
const toolbar=await read("companion/toolbar.js");
const css=await read("companion/toolbar.css");
const sandbox={URL,CSS:{supports:(property,value)=>
 property==="content-visibility"&&value==="auto"}};
runInNewContext(core,sandbox,{timeout:1000});
runInNewContext(compact,sandbox,{timeout:1000});
runInNewContext(notice,sandbox,{timeout:1000});
const LN=sandbox.__lpCompanionLimit;
assert.ok(Object.isFrozen(LN));
assert.equal(LN.classify("This conversation has reached its maximum length"),"CHAT_LENGTH_POSSIBLE");
assert.equal(LN.classify("You've reached the maximum length for this conversation"),"CHAT_LENGTH_POSSIBLE");
assert.equal(LN.classify("You've reached the GPT-6 thinking limit"),"USAGE_CAP_POSSIBLE");
assert.equal(LN.classify("You have reached your usage limit"),"USAGE_CAP_POSSIBLE");
assert.equal(LN.classify("A user described a usage limit in their essay"),null);
assert.equal(LN.classify("X".repeat(361)),null);
assert.equal(LN.observe({querySelectorAll:()=>[{
 textContent:"This conversation has reached its maximum length",closest:()=>null
 }]})?.status,"CHAT_LENGTH_POSSIBLE");
assert.equal(LN.observe({querySelectorAll:()=>[{
 textContent:"This conversation has reached its maximum length",closest:()=>({})
 }]}),null);
const C=sandbox.__lpCompanionCore;
const M=sandbox.__lpCompactHistory;
assert.ok(Object.isFrozen(M));
assert.ok(Object.isFrozen(C));
const chat="12345678-abcd-4def-9012-123456789abc";
assert.equal(C.safeChatId("https://chatgpt.com/c/"+chat),chat);
for(const bad of [
 "http://chatgpt.com/c/"+chat,"https://chatgpt.com.evil/c/"+chat,
 "https://chatgpt.com/","https://chatgpt.com/c/"+chat+"?temporary-chat=true",
 "https://chatgpt.com/c/"+chat+"?temporary_chat=false",
 "https://chatgpt.com/c/short","https://chatgpt.com/c/"+chat+"/extra"
])assert.equal(C.safeChatId(bad),null,bad);
assert.equal(C.safeReviewUrl("https://example.org/a?x=1"),"https://example.org/a?x=1");
for(const bad of ["http://example.com","javascript:alert(1)","https://user:pass@example.com",
 "https://localhost/api","https://127.0.0.1/internal","https://10.0.0.1/a"])
 assert.equal(C.safeReviewUrl(bad),null,bad);
const fakeTurn={getAttribute:k=>k==="data-testid"?"conversation-turn-99":null};
assert.equal(C.turnMarker(fakeTurn),"conversation-turn-99");
assert.equal(C.turnMarker(null),null);
const turnRoot={querySelectorAll:s=>s.includes("data-testid^=")?[fakeTurn]:[]};
assert.equal(C.turns(turnRoot).length,1);
assert.equal(C.turns({querySelectorAll:()=>[]}).length,0);
assert.equal(C.normalizeNote("  decision  "),"decision");
assert.ok(C.normalizeNote("x".repeat(1000)).length<=160);
assert.equal(C.storageKey(chat),"lp-companion-notes:"+chat);
const notes=C.normalizeNotes([
 {id:"note-1",note:" operator decision ",marker:"conversation-turn-1",at:1},
 {id:"note-1",note:"duplicate",marker:null,at:2},
 {id:"note-2",note:"valid",marker:null,at:3},
 {id:"bad",note:"",marker:null,at:4},
 {id:"big",note:"x".repeat(200),marker:null,at:5}
]);
assert.equal(notes.length,2);
assert.equal(notes[0].note,"operator decision");
// A tiny inert DOM fixture: verification of selection/streaming/last-8
// exclusions without loading ChatGPT, measuring real memory or using WebView2.
function turn(height=140){
 const classes=new Set(),styles=new Map();
 return {
  classList:{
   add:key=>classes.add(key),remove:key=>classes.delete(key),
   contains:key=>classes.has(key)
  },
  style:{
   setProperty:(key,value)=>styles.set(key,value),
   removeProperty:key=>styles.delete(key),
   getPropertyValue:key=>styles.get(key)??""
  },
  contains(other){return other===this;},
  querySelector:()=>null,
  getBoundingClientRect:()=>({height})
 };
}
const oldTurns=Array.from({length:14},()=>turn());
const root={
 querySelectorAll(selector){
  if(selector.includes("data-testid^="))return oldTurns;
  if(selector==="."+M.CLASS)return oldTurns.filter(el=>el.classList.contains(M.CLASS));
  return [];
 }
};
const applied=M.apply(root,{enabled:true});
assert.equal(applied.status,"ACTIVE");
assert.equal(applied.optimized,14-M.KEEP_RECENT);
assert.equal(applied.loaded,14);
assert.ok(oldTurns.slice(0,6).every(x=>x.classList.contains(M.CLASS)));
assert.ok(oldTurns.slice(-8).every(x=>!x.classList.contains(M.CLASS)));
assert.equal(oldTurns[0].style.getPropertyValue("--lp-compact-turn-height"),"140px");
assert.equal(C.turns(root).length,14);
assert.equal(C.turns(root,4).length,4);
assert.equal(M.key(chat),"lp-companion-compact-v1:"+chat);
const selected=oldTurns[0];
const protectedResult=M.apply(root,{enabled:true,activeElement:selected});
assert.equal(protectedResult.optimized,5);
assert.equal(selected.classList.contains(M.CLASS),false);
const streaming=oldTurns[1];
streaming.querySelector=key=>key==="[data-start]"?{}:null;
const streamResult=M.apply(root,{enabled:true});
assert.equal(streamResult.optimized,5);
assert.equal(streaming.classList.contains(M.CLASS),false);
const off=M.apply(root,{enabled:false});
assert.equal(off.status,"OFF");
assert.ok(oldTurns.every(x=>!x.classList.contains(M.CLASS)));
assert.ok(oldTurns.every(x=>!x.style.getPropertyValue("--lp-compact-turn-height")));
sandbox.CSS.supports=()=>false;
const unavailable=M.apply(root,{enabled:true});
assert.equal(unavailable.status,"UNSUPPORTED");
assert.equal(unavailable.optimized,0);
sandbox.CSS.supports=()=>true;
const oversized=Array.from({length:M.MAX_LOADED+1},()=>turn());
const largeRoot={querySelectorAll(selector){
 if(selector.includes("data-testid^="))return oversized;
 if(selector==="."+M.CLASS)return oversized.filter(x=>x.classList.contains(M.CLASS));
 return [];
}};
assert.equal(M.apply(largeRoot,{enabled:true}).status,"BOUNDED_HOLD");
assert.ok(oversized.every(x=>!x.classList.contains(M.CLASS)));
// Layout work is bounded to one small batch, with no permanently held
// element map and no undisclosed memory-saved percentage.
const many=Array.from({length:68},()=>turn());
const batchRoot={querySelectorAll(selector){
 if(selector.includes("data-testid^="))return many;
 if(selector==="."+M.CLASS)return many.filter(x=>x.classList.contains(M.CLASS));
 return [];
}};
const first=M.apply(batchRoot,{enabled:true});
assert.equal(first.status,"ACTIVE");
assert.equal(first.optimized,M.MAX_BATCH);
assert.equal(first.pending,68-M.KEEP_RECENT-M.MAX_BATCH);
const second=M.apply(batchRoot,{enabled:true});
assert.equal(second.optimized,68-M.KEEP_RECENT);
assert.equal(second.pending,0);
assert.equal(M.reset(batchRoot),68-M.KEEP_RECENT);
assert.ok(many.every(x=>!x.classList.contains(M.CLASS)));
assert.ok(many.every(x=>!x.style.getPropertyValue("--lp-compact-turn-height")));
assert.ok(css.includes("content-visibility:auto"));
assert.ok(css.includes("contain-intrinsic-size:auto var(--lp-compact-turn-height)"));
assert.ok(!css.includes("article{content-visibility")); // No global ChatGPT styling.
assert.ok(toolbar.includes("toggleCompact"));
assert.ok(toolbar.includes("New Chat by 4M"));
assert.ok(toolbar.includes("refreshLimitNotice()"));
assert.ok(toolbar.includes("if(H)H.mount(bar,panel)"));
assert.ok(toolbar.includes("if(H)void H.sync(id)"));
assert.ok(toolbar.includes("H?.preferCompact===true"));
assert.ok(toolbar.includes("Possible chat-length limit"));
assert.ok(css.includes(".lp-companion-limit"));
assert.ok(toolbar.includes("3.2M advises a checkpoint"));
assert.ok(toolbar.includes("4M blocks native Send once"));
assert.ok(css.includes(".lp-companion-target"));
assert.ok(toolbar.includes("compactEnabled=false"));
assert.ok(toolbar.includes("cancelCompactBatch()"));
assert.ok(toolbar.includes("result.pending>0&&compactTimer===null"));
assert.ok(!toolbar.includes("setInterval("));
assert.ok(toolbar.includes("M.reset(document)"));
assert.ok(toolbar.includes("readNotes(id),chrome.storage.local.get(M.key(id))"));
assert.ok(toolbar.includes("compactToggle.setAttribute(\"aria-pressed\""));
assert.ok(!toolbar.includes("memorySavedPercent"));
// Source guards: no transcript extraction, private endpoints, token/cookie/session access,
// independent send, background polling, or unsolicited network fetch.
for(const [name,src] of [["core",core],["compact",compact],["limit",notice],["toolbar",toolbar]]){
 for(const forbidden of ["backend-api","/api/auth/session","document.cookie",
  "window.fetch","XMLHttpRequest","innerText","responseText","data-message-author-role",
  "chrome.tabs","chrome.webRequest","setInterval("]){
  assert.ok(!src.includes(forbidden),name+" must not use "+forbidden);
 }
}
assert.ok(toolbar.includes('document.execCommand?.("copy")'));
assert.ok(toolbar.includes("Operator notes"));
assert.ok(toolbar.includes("Source opened for manual review"));
assert.ok(toolbar.includes("Not all chat tokens")||core.includes("virtualized"));
assert.ok(toolbar.includes("createObjectURL")&&toolbar.includes("revokeObjectURL"));
assert.ok(css.includes("@media(max-width:520px)"));
const rust=await readFile(new URL("../apps/desktop/src-tauri/src/embedded_webview.rs",import.meta.url),"utf8");
for(const file of manifest.content_scripts[0].js.concat(manifest.content_scripts[0].css))
 assert.ok(rust.includes('chatgpt-composer/'+file+'").as_slice()'),"native byte pin for "+file);
const bundled=JSON.parse(await readFile(
 new URL("../apps/desktop/src-tauri/tauri.gateway.conf.json",import.meta.url),"utf8"));
for(const f of ["manifest.json",...manifest.content_scripts[0].js,...manifest.content_scripts[0].css])
 assert.equal(bundled.bundle.resources["../browser-extension/chatgpt-composer/"+f],
  "companion/"+f,"NSIS asset mismatch "+f);
assert.ok(rust.includes('directory.join("companion")'));
assert.ok(rust.includes('LAZY_OPERATOR_COMPOSER_ENABLE'));
const catalog=await readFile(new URL("../apps/desktop/src-tauri/src/mcp_capabilities.rs",import.meta.url),"utf8");
const pipe=await readFile(new URL("../apps/desktop/src-tauri/src/browser_mcp_pipe.rs",import.meta.url),"utf8");
assert.ok(catalog.includes('"workspace_chat.rollover_status"'));
assert.ok(pipe.includes('value["chatRolloverAction"]'));
assert.ok(pipe.includes("rollover_status_for_mcp"));
assert.ok(!pipe.includes("APPROVE_CHAT_ROLLOVER"));
console.log("Companion source-contract assertions passed (not Windows/WebView2 or ChatGPT QA)");
