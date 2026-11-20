import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {nextChatWatchDelay,selectChatWatch,CHAT_WATCH_MAX_MS} from "../apps/desktop/src/app/chat-status-watch.mjs";
import {projectBrowserWorkSummary} from "../apps/desktop/src/app/browser-work-summary.mjs";
import {createWorkspaceState,applyWorkspaceAction,listVisibleWorkspaces,readWorkspaceState} from "../apps/desktop/src/app/workspace-controller.mjs";
let state=createWorkspaceState();
assert.equal(state.workspaces.length,10);
assert.equal(state.workspaces[0].activity,"UNKNOWN");
assert.equal(state.workspaces[0].name,"Browser 01");
const apply=action=>{const result=applyWorkspaceAction(state,{...action,expectedRevision:state.revision});assert.equal(result.status,"APPLIED");state=result.state;};
apply({type:"SELECT",workspaceId:"workspace-10"});
apply({type:"SET_PROJECT_NAME",workspaceId:"workspace-10",projectName:"Map CTF"});
assert.equal(state.workspaces[9].name,"Browser 10 - Map CTF");
apply({type:"FILTER",filter:"CTF"});
assert.deepEqual(listVisibleWorkspaces(state).map(w=>w.id),["workspace-10"]);
assert.equal(state.selectedId,"workspace-10");
apply({type:"CONFIRM_SETUP",workspaceId:"workspace-10",confirmed:true});
assert.equal(state.workspaces[9].setupConfirmed,true);
assert.equal(state.workspaces[9].connection,"NOT_CONNECTED");
assert.equal(applyWorkspaceAction(state,{type:"CONFIRM_SETUP",workspaceId:"workspace-10",confirmed:"yes",expectedRevision:state.revision}).status,"REJECTED");
apply({type:"VIEW_MODE",mode:"grid"});
apply({type:"FOCUS",focus:true});
assert.equal(state.mode,"grid");assert.equal(state.focus,true);
const stale=applyWorkspaceAction(state,{type:"SELECT",workspaceId:"workspace-01",expectedRevision:0});
assert.equal(stale.status,"REJECTED");assert.equal(stale.reason,"STALE_REVISION");
assert.equal(applyWorkspaceAction(state,{type:"SELECT",workspaceId:"workspace-99",expectedRevision:state.revision}).status,"REJECTED");
assert.equal(applyWorkspaceAction(state,{type:"RENAME",workspaceId:"workspace-10",name:" ",expectedRevision:state.revision}).status,"REJECTED");
const snapshot=readWorkspaceState(state);snapshot.workspaces[0].name="Changed";
assert.notEqual(state.workspaces[0].name,"Changed");
// One read-only stage projection. Native source still owns all admissions.
const flow=options=>projectBrowserWorkSummary({
 hasSavedChat:true,chatState:"ACTIVE",cleanupState:"NONE",
 sendStatus:"NO_PENDING",...options});
assert.equal(flow({chatState:"FULL_CONFIRMED"}).step,"Recover");
assert.equal(flow({chatState:"LONG_CHAT_ADVISORY"}).step,"Prepare");
assert.equal(flow({rolloverPrepared:true}).step,"Recover");
assert.equal(flow({chatState:"UNBOUND"}).step,"Bind");
assert.equal(flow({cleanupState:"PENDING_REVIEW"}).step,"Cleanup");
assert.equal(flow({cleanupState:"PENDING_REVIEW",oldChatReviewed:true}).title,
 "Delete old chat manually");
assert.equal(flow({cleanupState:"PENDING_REVIEW",hasDraft:true}).step,"Reconcile");
assert.equal(flow({cleanupState:"PENDING_REVIEW",sendStatus:"UNKNOWN"}).step,"Reconcile");
assert.equal(flow({cleanupState:"PENDING_REVIEW",sendStatus:"REVIEW_REQUIRED"}).step,"Reconcile");
assert.equal(flow({cleanupState:"PENDING_REVIEW",sendStatus:"AMBIGUOUS_HOLD"}).kind,"hold");
assert.equal(flow({cleanupState:"NONE"}).step,"Monitor");
assert.equal(flow({hasSavedChat:false,chatState:"UNBOUND"}).step,"Bind");
// Source wiring checks are authored; they are not installed Windows QA.
const ui=await readFile(new URL("../apps/desktop/src/App.svelte",import.meta.url),"utf8");
// Codex-first shell keeps the WebView and human recovery, but does not
// mount browser chrome by default. These are source wiring checks, not runtime
// or visual evidence.
assert.match(ui,/let showBrowserControls=\$state\(false\)/);
assert.match(ui,/\{#if mountedSlots\.includes\(current\.id\)&&showBrowserControls\}\s*<div class="lp-browser-tabs"/);
assert.match(ui,/\{#if mountedSlots\.includes\(current\.id\)&&showBrowserControls\}\s*<div class="lp-browser-toolbar"/);
assert.ok(ui.includes('data-testid="operator-work-toggle"'));
assert.ok(ui.includes('data-testid="operator-browser-tools-toggle"'));
assert.ok(ui.includes('aria-expanded={showBrowserControls}'));
assert.ok(ui.includes('onclick={()=>toggleBrowserPanel("activity")}'));
assert.ok(ui.includes('if(newDraft && workspaceState.selectedId===id && mountedSlots.includes(id))'));
assert.ok(ui.includes('browserPanel[id]="activity";'));
assert.ok(ui.includes('case "ADDRESS":focusBrowserAddress();break;'));
assert.ok(ui.includes('onclick={focusBrowserAddress}>Edit address</button>'));
assert.ok(ui.includes('function focusBrowserAddress(){'));
assert.ok(ui.includes('if(!showBrowserControls)'));
assert.ok(ui.includes('onclick={confirmHeldOperatorReview}'));
assert.ok(ui.includes('onclick={recoverInterruptedOutbox}'));
assert.ok(ui.includes('onclick={saveChatBookmark}'));
assert.ok(ui.includes('"chat_rollover_status"'));
assert.ok(ui.includes('"update_chat_rollover"'));
assert.ok(ui.includes('if(!await updateChatRollover("PREPARE_ROLLOVER"))return;'));
assert.ok(ui.includes("Prepare New Chat + copy Codex request"));
assert.ok(ui.includes('onclick={()=>updateChatRollover("CANCEL_ROLLOVER")}'));
assert.ok(ui.includes("rolloverStatuses[id]?.sendBlocked===true"));
assert.ok(ui.includes('onclick={copyCodexRecoveryRequest}'));
assert.ok(ui.includes('onclick={()=>updateChatRollover("CONFIRM_FULL")}'));
assert.ok(ui.includes('rolloverStatuses[current.id]?.state==="FULL_CONFIRMED"'));
assert.ok(ui.includes("This chat was marked full")||ui.includes("Chat marked full."));
const rolloverNative=await readFile(new URL(
 "../apps/desktop/src-tauri/src/chat_bookmarks.rs",import.meta.url),"utf8");
const sendNative=await readFile(new URL(
 "../apps/desktop/src-tauri/src/chat_operator_send.rs",import.meta.url),"utf8");
assert.ok(rolloverNative.includes("fn ensure_send_allowed_at("));
assert.ok(rolloverNative.includes("fn queue_operator_send_if_active("));
assert.ok(rolloverNative.includes("fn full_chat_guard_survives_new_bookmark_and_keeps_previous_history()"));
assert.ok(rolloverNative.includes("BOOKMARK_ROLLOVER_NOT_PREPARED"));
assert.ok(rolloverNative.includes("CHAT_CLEANUP_REVIEW_REQUIRED"));
assert.ok(rolloverNative.includes("mark_cleanup_reviewed_at(&root,&workspace_id,&latest,&previous)"));
assert.ok(rolloverNative.includes('record.rollover_prepared = true'));
assert.ok(rolloverNative.includes("OPERATOR_ROLLOVER_PREPARED"));
assert.ok(rolloverNative.includes('CHAT_LONG_ADVISORY_TOKENS: u32 = 1_000_000'));
assert.ok(rolloverNative.includes("full_chat_digests"));
assert.ok(rolloverNative.includes("CHAT_ESTIMATE_MAX: u32 = 100_000_000"));
assert.ok(rolloverNative.includes("pub(crate) fn rollover_status_for_mcp("));
assert.ok(ui.includes('maxlength="9" placeholder="e.g. 1130000"'));
assert.ok(sendNative.includes("chat_bookmarks::verify_operator_send_target("));
assert.ok(sendNative.includes("chat_bookmarks::queue_operator_send_if_active("));
assert.ok(!ui.includes("/backend-api/conversation/")&&
 !rolloverNative.includes("/backend-api/conversation/"));

assert.ok(!ui.includes('auto_continue') && !ui.includes('invoke("workspace_chat.submit"'));
// Previous Chat Cleanup is only a native reviewed Work action.
assert.ok(ui.includes('rolloverStatuses[current.id]?.cleanupState==="PENDING_REVIEW"'));
assert.ok(ui.includes('"review_previous_chat_cleanup"'));
assert.ok(ui.includes('"settle_previous_chat_cleanup"'));
assert.ok(ui.includes('onclick={reviewPreviousChatCleanup}'));
assert.ok(ui.includes('onclick={()=>settlePreviousChatCleanup("REPORTED_DELETED")}'));
assert.ok(ui.includes('onclick={()=>settlePreviousChatCleanup("KEEP")}'));
assert.ok(ui.includes('await tabAction("open_support_tab",undefined,old)'));
assert.ok(ui.includes('if(!closed)cleanupNotice[id]'));
assert.ok(ui.includes('loc.tabId===reviewTab'));
assert.ok(ui.includes('loc.url===previous||loc.url==="https://chatgpt.com/"'));
assert.ok(ui.includes('if(cleanupReviewTab[id]===tabId)delete cleanupReviewTab[id]'));
assert.ok(ui.includes("copyReviewedOldChatUrl"));
assert.ok(ui.includes('workSummary.step'));
assert.ok(ui.includes('rolloverRefreshQueued[id]'));
assert.ok(ui.includes('serverDeletionVerified!==false'));
const cleanupBookmarks=await readFile(new URL(
 "../apps/desktop/src-tauri/src/chat_bookmarks.rs",import.meta.url),"utf8");
const cleanupGateway=await readFile(new URL(
 "../src/gateway/mcp-gateway.mjs",import.meta.url),"utf8");
const cleanupSession=await readFile(new URL(
 "../apps/desktop/src-tauri/src/gateway_session.rs",import.meta.url),"utf8");
assert.ok(cleanupBookmarks.includes("cleanup_candidate: Option<CleanupCandidate>"));
assert.ok(cleanupBookmarks.includes("BOOKMARK_PREVIOUS_CLEANUP_PENDING"));
assert.ok(cleanupBookmarks.includes("cleanup_effects_clear(&app,&id)?;"));
assert.ok(cleanupGateway.includes('lazyprompting/workspaceCleanupPending'));
assert.ok(cleanupGateway.includes("unresolvedWorkspaceEffects({workspaceId:p.workspaceId})"));
assert.ok(cleanupSession.includes("fn cleanup_pending_effects("));
const manualHandoff=await readFile(new URL(
 "../apps/desktop/src-tauri/src/chat_manual_handoff.rs",import.meta.url),"utf8");
assert.ok(manualHandoff.includes("fn cleanup_has_pending("));
assert.ok(manualHandoff.includes("self.drafts.try_lock()"));
assert.ok(cleanupBookmarks.includes("drafts.cleanup_has_pending(workspace)?"));
assert.ok(cleanupBookmarks.includes("BOOKMARK_PAGE_CHANGED"));
assert.ok(cleanupBookmarks.includes('chat_url(&live).as_deref()!=Some(url.as_str())'));
assert.ok(manualHandoff.includes("fn cleanup_guard_denies_pending_drafts_and_busy_owner()"));
assert.ok(!ui.includes("lazyprompting/workspaceCleanupPending"));

const native=await readFile(new URL("../apps/desktop/src-tauri/src/lightpanda_controls.rs",import.meta.url),"utf8");
for(const control of ["open","index","close","toggle_checkbox","fill_search"]){
 assert.ok(ui.includes(`operateOfflinePreview("${control}")`));
}
assert.ok(ui.includes('"lightpanda_preview_action"'));
assert.ok(ui.includes('"lightpanda_preview"'));
assert.ok(ui.includes("do not repeat the action"));
assert.ok(ui.includes("Local Lightpanda test page only"));
assert.ok(native.includes('webview.label() != "main"'));
assert.ok(native.includes("operator_confirmation::confirm("));
assert.ok(native.includes("PreviewFixtureAction::ToggleCheckbox"));
assert.ok(native.includes("PreviewFixtureAction::FillSearch"));
assert.ok(!ui.includes("LP.clickNode"));
assert.ok(!ui.includes("LP.fillNode"));
// Adaptive UI-control polling is pure policy: no tokens, no idle watcher.
// All cases below are authored, not executed on the user's Windows PC.
assert.equal(nextChatWatchDelay("WAITING",0,0),3000);
assert.equal(nextChatWatchDelay("WAITING",1,3000),6000);
assert.equal(nextChatWatchDelay("WAITING",9,3000),30000);
assert.equal(nextChatWatchDelay("GENERATING",0,0),5000);
assert.equal(nextChatWatchDelay("GENERATING",1,0),10000);
assert.equal(nextChatWatchDelay("GENERATING",7,0),30000);
assert.equal(nextChatWatchDelay("POSSIBLY_COMPLETED",0,0),null);
assert.equal(nextChatWatchDelay("ERROR",0,0),null);
assert.equal(nextChatWatchDelay("UNKNOWN",0,0),null);
assert.equal(nextChatWatchDelay("WAITING",0,CHAT_WATCH_MAX_MS),null);
assert.equal(nextChatWatchDelay("WAITING",0,CHAT_WATCH_MAX_MS-500),500);
assert.equal(nextChatWatchDelay("WAITING",-1,0),null);

const now=1000000;
const a={startedAt:now-1000,dueAt:now-100,checks:1};
const b={startedAt:now-1000,dueAt:now+1500,checks:1};
const active={"workspace-01":a,"workspace-02":b};
assert.equal(selectChatWatch({watches:active,mounted:[],nowMs:now}),null);
assert.deepEqual(selectChatWatch({watches:active,mounted:["workspace-01","workspace-02"],nowMs:now}),
 {workspaceId:"workspace-01",delayMs:0,expired:false});
assert.deepEqual(selectChatWatch({watches:active,mounted:["workspace-01","workspace-02"],
 nowMs:now,lastPolledAtMs:now-1000}),
 {workspaceId:"workspace-01",delayMs:1000,expired:false});
assert.deepEqual(selectChatWatch({watches:active,mounted:["workspace-01","workspace-02"],
 nowMs:now,checking:{"workspace-01":true}}),
 {workspaceId:"workspace-02",delayMs:1500,expired:false});
assert.equal(selectChatWatch({watches:active,mounted:["workspace-01"],
 nowMs:now,sending:{"workspace-01":true}}),null);
assert.deepEqual(selectChatWatch({watches:{"workspace-01":a,"workspace-11":a},
 mounted:["workspace-01","workspace-11"],nowMs:now}),
 {workspaceId:"workspace-01",delayMs:0,expired:false});
const expired={startedAt:now-CHAT_WATCH_MAX_MS,
 dueAt:now+1000,checks:5};
assert.deepEqual(selectChatWatch({watches:{"workspace-01":expired},
 mounted:["workspace-01"],nowMs:now,lastPolledAtMs:now}),
 {workspaceId:"workspace-01",delayMs:0,expired:true});
assert.equal(selectChatWatch({watches:{},mounted:["workspace-01"],nowMs:now}),null);
assert.equal(selectChatWatch({watches:active,mounted:["workspace-01"],nowMs:-1}),null);
assert.ok(ui.includes("scheduleChatWatch=refreshChatWatchTimer"));
assert.ok(ui.includes("document.hidden"));
assert.ok(ui.includes('document.addEventListener("visibilitychange"'));
assert.ok(ui.includes('document.removeEventListener("visibilitychange"'));
assert.ok(ui.includes("window.clearTimeout(chatWatchTimer)"));
assert.ok(ui.includes("chatWatchInFlight=true"));
assert.ok(ui.includes("nextChatWatchDelay(receipt.state,watch.checks+1"));
assert.ok(ui.includes("No automatic response was sent."));
assert.ok(!ui.includes("window.setInterval("));
// The native operator-pasted reply must be the only source-level
// owner of durable manual-review release; no frontend status hint may
// call the gateway review RPC or fabricate verified ChatGPT delivery.
const handoff=await readFile(new URL(
 "../apps/desktop/src-tauri/src/chat_manual_handoff.rs",import.meta.url),"utf8");
const session=await readFile(new URL(
 "../apps/desktop/src-tauri/src/gateway_session.rs",import.meta.url),"utf8");
const main=await readFile(new URL(
 "../apps/desktop/src-tauri/src/main.rs",import.meta.url),"utf8");
const gateway=await readFile(new URL(
 "../src/gateway/mcp-gateway.mjs",import.meta.url),"utf8");
assert.ok(handoff.includes("fn advance_with_review("));
assert.ok(handoff.includes("review()?;"));
assert.ok(handoff.includes("pending_operator_chat_send("));
assert.ok(handoff.includes("review_operator_chat_send("));
assert.ok(handoff.includes("confirm_operator_chat_review("));
assert.ok(handoff.includes("fn operator_attempt_projection("));
assert.ok(handoff.includes("fn operator_chat_attempt_status("));
assert.ok(handoff.includes("fn native_operator_attempt_projection_has_no_private_digest_or_false_verification()"));
assert.ok(session.includes("fn pending_operator_chat_send("));
assert.ok(session.includes("fn review_operator_chat_send("));
assert.ok(gateway.includes('req.method==="lazyprompting/operatorChatReview"&&native'));
assert.ok(gateway.includes('req.method==="lazyprompting/operatorChatPending"&&native'));
assert.ok(main.includes("chat_manual_handoff::confirm_operator_chat_review,"));
assert.ok(main.includes("chat_manual_handoff::operator_chat_attempt_status,"));
assert.ok(ui.includes('"confirm_operator_chat_review"'));
assert.ok(ui.includes("I reviewed this chat"));
assert.ok(ui.includes("Refresh send status"));
assert.ok(ui.includes('reason.includes("OUTBOX_LOCK_BUSY")'));
assert.ok(ui.includes("Check interrupted-state recovery before another attempt"));
assert.ok(ui.includes("Send attempt:"));
assert.ok(ui.includes('"operator_chat_attempt_status"'));
assert.ok(ui.includes('if(browserPanel[id]==="activity")void refreshOperatorAttemptStatus(id)'));
assert.ok(!ui.includes('pending["promptDigest"]'));
assert.ok(!ui.includes('invoke("lazyprompting/operatorChatReview"'));
// One native-only interruption recovery path. No renderer-supplied
// ownerToken, no public MCP access, and no response extraction.
const outboxSource=await readFile(new URL(
 "../src/prompt/prompt-outbox.mjs",import.meta.url),"utf8");
assert.ok(outboxSource.includes("async inspectInterruptedLock()"));
assert.ok(outboxSource.includes("async recoverInterruptedLock("));
assert.ok(outboxSource.includes("process.kill(owner.pid,0)"));
assert.ok(outboxSource.includes('await rmdir(this.lock)'));
assert.ok(!ui.includes('invoke("lazyprompting/operatorChatLock"'));
assert.ok(ui.includes('"recover_interrupted_operator_outbox"'));
assert.ok(ui.includes("Recover interrupted outbox lock"));
assert.ok(main.includes("chat_manual_handoff::recover_interrupted_operator_outbox"));
assert.ok(handoff.includes("fn recover_interrupted_operator_outbox("));
assert.ok(session.includes("fn operator_chat_lock("));
assert.ok(gateway.includes('req.method==="lazyprompting/operatorChatLock"&&native'));
console.log("Desktop UI and adaptive ChatGPT control-only watch fixtures authored");
