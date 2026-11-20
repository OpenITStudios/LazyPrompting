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
assert.deepEqual(manifest.content_scripts[0].js,["companion/core.js","companion/toolbar.js"]);
assert.deepEqual(manifest.content_scripts[0].css,["companion/toolbar.css"]);
assert.equal(manifest.content_scripts[0].all_frames,false);
assert.ok(!manifest.background&&!manifest.action&&!manifest.externally_connectable);
const core=await read("companion/core.js");
const toolbar=await read("companion/toolbar.js");
const css=await read("companion/toolbar.css");
const sandbox={URL};
runInNewContext(core,sandbox,{timeout:1000});
const C=sandbox.__lpCompanionCore;
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
// Source guards: no transcript extraction, private endpoints, token/cookie/session access,
// independent send, background polling, or unsolicited network fetch.
for(const [name,src] of [["core",core],["toolbar",toolbar]]){
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
const catalog=await readFile(new URL("../apps/desktop/src-tauri/src/mcp_capabilities.rs",import.meta.url),"utf8");
const pipe=await readFile(new URL("../apps/desktop/src-tauri/src/browser_mcp_pipe.rs",import.meta.url),"utf8");
assert.ok(catalog.includes('"workspace_chat.rollover_status"'));
assert.ok(pipe.includes('value["chatRolloverAction"]'));
assert.ok(pipe.includes("rollover_status_for_mcp"));
assert.ok(!pipe.includes("APPROVE_CHAT_ROLLOVER"));
console.log("Companion source-contract assertions passed (not Windows/WebView2 or ChatGPT QA)");
