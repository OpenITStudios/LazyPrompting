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
 ["companion/core.js","companion/compact-history.js","companion/history-visibility.js",
  "companion/limit-notice.js","companion/usage-meter-signal.js","companion/settings.js","companion/new-chat.js","companion/status-resolver.js","companion/toolbar.js"]);
assert.deepEqual(manifest.content_scripts[0].css,["companion/toolbar.css"]);
assert.equal(manifest.content_scripts[0].all_frames,false);
assert.ok(!manifest.background&&!manifest.action&&!manifest.externally_connectable);
const core=await read("companion/core.js");
const compact=await read("companion/compact-history.js");
const notice=await read("companion/limit-notice.js");
const history=await read("companion/history-visibility.js");
const usage=await read("companion/usage-meter-signal.js");
const settings=await read("companion/settings.js");
const rolloverSource=await read("companion/new-chat.js");
const statusSource=await read("companion/status-resolver.js");
const toolbar=await read("companion/toolbar.js");
const css=await read("companion/toolbar.css");
const sandbox={URL,CSS:{supports:(property,value)=>
 property==="content-visibility"&&value==="auto"}};
runInNewContext(core,sandbox,{timeout:1000});
runInNewContext(compact,sandbox,{timeout:1000});
runInNewContext(notice,sandbox,{timeout:1000});
runInNewContext(history,sandbox,{timeout:1000});
runInNewContext(usage,sandbox,{timeout:1000});
runInNewContext(settings,sandbox,{timeout:1000});
runInNewContext(rolloverSource,sandbox,{timeout:1000});
runInNewContext(statusSource,sandbox,{timeout:1000});
// One pure priority owner — conflicting states never stack status chips.
const P=sandbox.__lpCompanionStatusResolver;
assert.ok(Object.isFrozen(P));
const statusInput={tokens:3_850_000,soon:3_600_000,switchAt:4_000_000};
const picked=patch=>P.resolve({...statusInput,...patch});
assert.equal(picked({}).id,"soon");
assert.equal(picked({tokens:4_200_000}).id,"switch");
assert.equal(picked({tokens:null}).id,"none");
assert.equal(picked({meterLimit:true,responseError:true,notice:"USAGE_CAP_POSSIBLE",
 tokens:4_500_000}).id,"limit");
assert.equal(picked({responseError:true,notice:"CHAT_LENGTH_POSSIBLE",
 tokens:4_500_000}).id,"error");
assert.equal(picked({responseError:true,retryAvailable:true}).retry,true);
assert.equal(picked({responseError:true,retryAvailable:false}).retry,false);
assert.equal(picked({notice:"USAGE_CAP_POSSIBLE",tokens:4_500_000}).id,"possible-usage");
assert.equal(picked({notice:"CHAT_LENGTH_POSSIBLE"}).id,"possible-chat");
assert.equal(picked({newChatUnavailable:true}).id,"newchat-error");
assert.equal(picked({cleanupStatus:"OLD_CHAT_RETAINED"}).id,"soon");
assert.equal(picked({cleanupStatus:"OLD_CHAT_RETAINED",tokens:null}).id,"cleanup-retained");
assert.equal(picked({cleanupStatus:"OLD_CHAT_DELETE_UNVERIFIED",tokens:null}).id,"cleanup-unknown");
assert.equal(picked({responseError:true,retryAvailable:true,notice:"USAGE_CAP_POSSIBLE"}).id,"error");
assert.equal(P.resolve({}).id,"none");
assert.equal(P.resolve({...statusInput,responseError:true}).id,"error");
assert.equal(P.resolve(statusInput).id,"soon");
const LN=sandbox.__lpCompanionLimit;
assert.ok(Object.isFrozen(LN));
assert.equal(LN.classify("This conversation has reached its maximum length"),"CHAT_LENGTH_POSSIBLE");
assert.equal(LN.classify("You've reached the maximum length for this conversation"),"CHAT_LENGTH_POSSIBLE");
assert.equal(LN.classify("You've reached the GPT-6 thinking limit"),"USAGE_CAP_POSSIBLE");
assert.equal(LN.classify("You have reached your usage limit"),"USAGE_CAP_POSSIBLE");
assert.equal(LN.classify("A user described a usage limit in their essay"),null);
for(const message of [
 "There was an error generating a response",
 "Something went wrong",
 "A network error occurred",
 "Error in message stream",
 "Terjadi kesalahan saat membuat respons"
]) assert.equal(LN.classify(message),"RESPONSE_ERROR_POSSIBLE",message);
assert.equal(LN.classify("Our team is reviewing an error report"),null);
// Native error only in latest mounted ChatGPT turn; never replay an old error.
const errorMarker={disabled:false,getClientRects:()=>[{}]};
const lastErrored={querySelectorAll:q=>q.includes("response-error")?[errorMarker]:[]};
const lastNormal={querySelectorAll:()=>[]};
const errorRoot=latest=>({querySelectorAll:q=>q.startsWith('main [data-testid^=')?[latest]:[]});
assert.equal(LN.observeLatestError(errorRoot(lastErrored)),true);
assert.equal(LN.observeLatestError(errorRoot(lastNormal)),false);
// Unknown, ambiguous, or busy page must not expose a retry control.
const regenerate={disabled:false,getClientRects:()=>[{}],closest:()=>null};
const uniqueRetry={querySelectorAll:q=>q.includes('regenerate-button')?[regenerate]:[]};
const doubleRetry={querySelectorAll:q=>q.includes('regenerate-button')?[regenerate,regenerate]:[]};
const generating={querySelectorAll:q=>q.includes('stop-button')?[regenerate]:[]};
assert.equal(LN.retryControl(uniqueRetry),regenerate);
assert.equal(LN.retryControl(doubleRetry),null);
assert.equal(LN.retryControl(generating),null);
assert.equal(LN.observe({querySelectorAll:q=>q.includes('role="alert"')?
 [{textContent:"Something went wrong",closest:()=>null}]:[]})?.status,
 "RESPONSE_ERROR_POSSIBLE");
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
// Observer workload regression: message-stream DOM churn is not
// a reason to repeatedly query all turns, storage or the meter.
function mutationTarget({owned=false,turn=false,meter=false,nav=false}={}){
 return {nodeType:1,closest(selector){
  if(selector.includes("#lp-companion")&&owned)return {};
  if(selector.includes("#chatgpt-usage-overlay")&&meter)return {};
  if(selector.includes("[data-testid^=")&&turn)return {};
  if(selector.includes('[role="navigation"]')&&nav)return {};
  if(selector==="main,body,html")return {};
  return null;
 }};
}
const change=(target,addedNodes=[])=>({type:"childList",target,addedNodes,removedNodes:[]});
assert.equal(C.mutationNeedsRefresh([], "monitor"),false);
assert.equal(C.mutationNeedsRefresh([change(mutationTarget({owned:true}))]),false);
assert.equal(C.mutationNeedsRefresh([change(mutationTarget({turn:true}))]),false);
assert.equal(C.mutationNeedsRefresh([change(mutationTarget({meter:true}))]),true);
assert.equal(C.mutationNeedsRefresh([change(mutationTarget({nav:true}))],"rollover"),true);
assert.equal(C.mutationNeedsRefresh([change(mutationTarget())],"monitor"),true);
assert.equal(C.mutationNeedsRefresh([change(mutationTarget(),[
 {nodeType:1,matches:q=>q.startsWith("#lp-companion"),closest:()=>null}])]),false);
assert.equal(C.mutationNeedsRefresh(Array.from({length:40},()=>change(mutationTarget({turn:true})))),true);

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
const V=sandbox.__lpHistoryVisibility;
const U=sandbox.__lpCompanionUsageSignal;
const S=sandbox.__lpCompanionSettings;
assert.ok(Object.isFrozen(V)&&Object.isFrozen(U)&&Object.isFrozen(S));
assert.equal(S.KEY,"lp-companion-settings-v2");
assert.deepEqual([...S.CHOICES],["1","3","5","10","25","unlimited","custom"]);
assert.equal(S.visibleTurns(S.DEFAULTS),20); // ten exchanges, up to 20 turn nodes
assert.equal(S.visibleTurns(S.normalize({history:"unlimited"})),Infinity);
assert.equal(S.visibleTurns(S.normalize({compact:false})),Infinity);
assert.equal(S.visibleTurns(S.normalize({history:"custom",custom:31})),62);
assert.equal(S.normalize({soon:5_000_000,switchAt:4_000_000}).soon,3_600_000);
assert.equal(S.normalize({soon:5_000_000,switchAt:4_000_000}).switchAt,4_000_000);
assert.equal(S.fromMillions("3.6"),3_600_000);
assert.equal(S.fromMillions("4"),4_000_000);
assert.equal(S.fromMillions("no"),null);
for(const [input,expected] of [
 ["This chat is about 1,511,340 tokens — estimate",1_511_340],
 ["~1.51M tokens",1_510_000],["35.7K",35_700],["This chat: ~4.44M tokens",4_440_000]
])assert.equal(U.parse(input),expected,input);
for(const input of ["",null,"~1000M","not a number","4M and more"])
 assert.equal(U.parse(input),null);
assert.equal(U.format(1_511_340),"~1.51M");
assert.equal(U.format(null),"—");
const tokenElement={
 getAttribute:name=>name==="title"?"This chat is about 1,511,340 tokens — estimate":null,
 querySelector:name=>name===".cgum-val"?{textContent:"~1.51M tokens"}:null
};
const meterOverlay={
 querySelector:name=>name===".cgum-tokens"?tokenElement:
  name===".cgum-hit"?{textContent:"Limit hit · GPT"}:null
};
const meterDocument={querySelector:name=>name==="#chatgpt-usage-overlay"?meterOverlay:null};
assert.equal(U.observe(meterDocument).tokens,1_511_340);
assert.equal(U.observe(meterDocument).limit,true);
assert.equal(U.observe({querySelector:()=>null}),null);
const R=sandbox.__lpCompanionNewChat;
assert.ok(Object.isFrozen(R));
assert.equal(R.PENDING_KEY,"lp-companion-new-chat-pending-v1");
const nonce="11111111-1111-4111-8111-111111111111";
const pending={version:1,phase:"AWAIT_CHAT_B",oldId:chat,nonce,startedAt:1700000000000};
assert.equal(R.validPending(pending,1700000000600),true);
assert.equal(R.validPending({...pending,phase:"DELETE_ATTEMPTED"},1700000000600),false);
assert.equal(R.validPending(pending,1700000000000+20*60*1000+1),false);
assert.equal(R.matchesOldHref("/c/"+chat,chat),true);
assert.equal(R.matchesOldHref("https://chatgpt.com/c/"+chat,chat),true);
assert.equal(R.matchesOldHref("https://evil.example/c/"+chat,chat),false);
assert.equal(R.matchesOldHref("/c/"+chat+"?x=1",chat),false);
const options={getClientRects:()=>[{}],isConnected:true};
const anchor={getAttribute:k=>k==="href"?"/c/"+chat:null,
 closest:()=>({}),getClientRects:()=>[{}],isConnected:true,parentElement:null};
const row={parentElement:null,matches:()=>false,
 querySelectorAll:q=>q.startsWith('button[data-testid^=')?[options]:
  q==="a[href]"?[anchor]:[]};
anchor.parentElement=row;
const sidebar={querySelectorAll:q=>q==="a[href]"?[anchor]:[]};
assert.equal(R.locateOldRow(sidebar,chat)?.options,options);
assert.equal(R.locateOldRow({querySelectorAll:()=>[anchor,anchor]},chat),null);
assert.equal(R.locateOldRow(sidebar,"ffffffff-ffff-4fff-8fff-ffffffffffff"),null);
assert.ok(rolloverSource.includes('phase:"DELETE_ATTEMPTED"'));
assert.ok(rolloverSource.includes('"OLD_CHAT_DELETE_UNVERIFIED"'));
assert.ok(rolloverSource.includes("noConflictingDialog(document)"));
assert.ok(rolloverSource.includes("uniqueVisible(dialog,CONFIRM_SELECTOR)"));
assert.ok(rolloverSource.includes("currentSavedChat()===newId"));
assert.ok(rolloverSource.includes('const SENT_KEY="lp-companion-new-chat-first-send-v1"'));
assert.ok(rolloverSource.includes("if(!sawFirstSend(record.nonce))return;"));
assert.ok(rolloverSource.includes("age<=5*60*1000"));
assert.ok(rolloverSource.includes("starting=false"));
assert.ok(rolloverSource.includes("if(!api||busy||starting)return;"));
assert.ok(rolloverSource.includes("sessionStorage.removeItem(SENT_KEY)"));
assert.ok(rolloverSource.includes('document.addEventListener("keydown",noteComposeAction,true)'));
assert.ok(rolloverSource.includes('document.addEventListener("submit",noteComposeAction,true)'));
assert.ok(rolloverSource.includes('event?.isTrusted'));
assert.ok(!rolloverSource.includes("setInterval("));
assert.ok(css.includes("content-visibility:auto"));
assert.ok(css.includes(".lp-history-hidden{display:none!important}"));
assert.ok(css.includes("#lp-companion-settings.lp-settings-panel"));
assert.ok(toolbar.includes("Context "));
assert.ok(toolbar.includes("Chat "));
assert.ok(statusSource.includes('status("limit","Limit hit"'));
assert.ok(toolbar.includes("New chat soon"));
assert.ok(toolbar.includes('function appIcon()'));
assert.ok(toolbar.includes('brand.setAttribute("aria-label","LazyPrompting")'));
assert.ok(toolbar.includes('async function newChat(event)'));
assert.ok(toolbar.includes('button("",newChat,"New Chat")'));
assert.ok(toolbar.includes("R.begin(current)"));
assert.ok(toolbar.includes("!event?.isTrusted"));
assert.ok(toolbar.includes('document.addEventListener("lp-companion-new-chat-state"'));
assert.ok(toolbar.includes('C.safeChatId(location.href)!==current'));
assert.ok(toolbar.includes('strip.append(appIcon()'));
assert.ok(toolbar.includes("chatMetric,statusSpacer,status,newButton,settingsButton"));
assert.ok(css.includes(".lp-status-spacer{flex:1 1 auto"));
assert.ok(css.includes("width:100%;max-width:660px"));
assert.ok(css.includes(".lp-metric"));
assert.ok(css.includes(".lp-context-dot"));
assert.ok(css.includes(".lp-new-chat"));
assert.ok(css.includes(".lp-settings-icon"));
assert.ok(css.includes("@container(max-width:390px)"));
assert.ok(!toolbar.includes('el("span","lp-brand","LP")'));
assert.ok(!toolbar.includes('chrome.tabs.remove'));
assert.ok(!toolbar.includes('Delete Old Chat'));

assert.ok(toolbar.includes("Switch chat"));
assert.ok(toolbar.includes("Keep visible"));
assert.ok(toolbar.includes("Custom…"));
assert.ok(toolbar.includes('const M=globalThis.__lpCompactHistory'));
assert.ok(toolbar.includes("H.apply(document,"));
assert.ok(toolbar.includes("M.apply(document,opts)"));
assert.ok(toolbar.includes('C.mutationNeedsRefresh(records,"monitor")'));
assert.ok(toolbar.includes("context.textContent!==tokenText"));
assert.ok(toolbar.includes("chats.textContent!==count.label"));
assert.ok(toolbar.includes("statusText.textContent!==chosen.label"));
assert.ok(toolbar.includes("newChatErrorFor=chatId"));
assert.ok(toolbar.includes("P.resolve({"));
assert.ok(toolbar.includes("bar.dataset.statusKind=chosen.id"));
assert.ok(!toolbar.includes("window.postMessage("));
assert.ok(statusSource.includes('status("error","Error","error"'));
assert.ok(toolbar.includes('retryButton=button("Retry",retryGeneration'));
assert.ok(toolbar.includes("control.click()"));
assert.ok(toolbar.includes("lastRetryKey===key"));
assert.ok(toolbar.includes("!event?.isTrusted"));
assert.ok(core.includes("node.matches?.(SIGNAL)||node.querySelector?.(SIGNAL)"));
assert.ok(rolloverSource.includes("if(!api||busy||starting||!tabNonce())return;"));
assert.ok(rolloverSource.includes('C.mutationNeedsRefresh(records,"rollover")'));
assert.ok(rolloverSource.includes("void api.get(RESULT_KEY).then"));

assert.ok(toolbar.includes("store.set({[S.KEY]:next})"));
assert.ok(toolbar.includes("S.fromMillions(editSoon.value)"));
assert.ok(toolbar.includes("S.fromMillions(editSwitch.value)"));
assert.ok(!toolbar.includes("Bookmark"));
assert.ok(!toolbar.includes("Export notes"));
assert.ok(!toolbar.includes("Chat ~3."));
assert.ok(!toolbar.includes("3.2M"));
assert.ok(!toolbar.includes("setInterval("));
// Source-only permissions: no private ChatGPT API, transcript extraction,
// prompt sending, response interception, telemetry or polling.
for(const [name,src] of [
 ["core",core],["compact",compact],["history",history],
 ["limit",notice],["usage",usage],["settings",settings],
 ["rollover",rolloverSource],["status",statusSource],["toolbar",toolbar]
]){
 for(const forbidden of ["backend-api","/api/auth/session","document.cookie",
  "window.fetch","XMLHttpRequest","innerText","responseText","data-message-author-role",
  "chrome.tabs","chrome.webRequest","setInterval("]){
  assert.ok(!src.includes(forbidden),name+" must not use "+forbidden);
 }
}
// Native WebView2 status observer must use the same latest-turn boundary.
const operatorStatusRust=await readFile(new URL("../apps/desktop/src-tauri/src/chat_operator_send.rs",import.meta.url),"utf8");
assert.ok(operatorStatusRust.includes('const selectors=['));
assert.ok(operatorStatusRust.includes('pub(crate) async fn operator_companion_status('));
assert.ok(operatorStatusRust.includes('verify_operator_chat_target('));
assert.ok(operatorStatusRust.includes("bar?.dataset.statusKind??null"));
assert.ok(operatorStatusRust.includes('value["href"].as_str()? != expected_url'));
assert.ok(operatorStatusRust.includes('"nextPromptAllowed":false'));
assert.ok(!operatorStatusRust.includes("window.postMessage"));
assert.ok(operatorStatusRust.includes('latest=turns[turns.length-1]'));
assert.ok(operatorStatusRust.includes('const el=latest.querySelector(selector)'));
assert.ok(!operatorStatusRust.includes('error:visible([\'[data-testid="conversation-turn-error"]'));
// Work presentation combines native plugin and app-wide Codex summaries
// only through existing validated native invoke paths; no second scheduler.
const appWork=await readFile(new URL("../apps/desktop/src/App.svelte",import.meta.url),"utf8");
const workProjection=await readFile(new URL("../apps/desktop/src/app/browser-work-summary.mjs",import.meta.url),"utf8");
assert.ok(appWork.includes('void refreshChatPluginHold(id);'));
assert.ok(appWork.includes('void refreshNativeCodexGoals();'));
assert.ok(appWork.includes('const integratedWorkSignals=$derived(projectIntegratedWorkSignals({'));
assert.ok(appWork.includes('pluginStatus:pluginHoldDiagnostic[current.id]??null'));
assert.ok(appWork.includes('nativeCodexGoalReadStatus="AVAILABLE"'));
assert.ok(workProjection.includes('nextPromptAllowed:false'));
assert.ok(workProjection.includes('chatBound:false'));
assert.ok(!appWork.includes('window.postMessage("LP_WORK_GRANT"'));
const mainRust=await readFile(new URL("../apps/desktop/src-tauri/src/main.rs",import.meta.url),"utf8");
assert.ok(mainRust.includes("chat_operator_send::operator_companion_status"));
const workApp=await readFile(new URL("../apps/desktop/src/App.svelte",import.meta.url),"utf8");
assert.ok(workApp.includes('void refreshCompanionSignal(id);'));
assert.ok(workApp.includes('"operator_companion_status",{workspaceId:id}'));
assert.ok(workApp.includes('companionSignal:companionSignals[current.id]??"NOT_CHECKED"'));
assert.ok(workApp.includes('if(payload.tabId==="main"){'));
assert.ok(workApp.includes('companionEpoch[payload.workspaceId]=(companionEpoch[payload.workspaceId]??0)+1'));
assert.ok(workApp.includes('if(mountedSlots.includes(id)&&(companionEpoch[id]??0)===epoch)'));
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
