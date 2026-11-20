// Read-only source-graph regression, not Rust compile or native ChatGPT QA.
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const read=path=>readFileSync(resolve(root,path),"utf8");
const bookmark=read("apps/desktop/src-tauri/src/chat_bookmarks.rs");
const main=read("apps/desktop/src-tauri/src/main.rs");
const pipe=read("apps/desktop/src-tauri/src/browser_mcp_pipe.rs");
const stdio=read("apps/desktop/src-tauri/src/mcp_stdio_host.rs");
const ui=read("apps/desktop/src/App.svelte");
const css=read("apps/desktop/src/app.css");
const handoff=read("apps/desktop/src-tauri/src/chat_manual_handoff.rs");
const summary=read("apps/desktop/src/app/browser-work-summary.mjs");
let checks=0;
function yes(ok,reason){assert.ok(ok,reason);checks++;}

yes(main.includes("mod chat_bookmarks;"),"native module connected");
for(const name of ["chat_bookmark_status","save_chat_bookmark",
 "restore_chat_bookmark","forget_chat_bookmark"]){
 yes(main.includes("chat_bookmarks::"+name),"Tauri route for "+name);
 yes(ui.includes('invoke("'+name+'"') || ui.includes('>("'+name+'"'),"user-visible callback for "+name);
 yes(!stdio.includes('chat_bookmarks::'+name),"bookmark stays outside installed MCP catalog");
}
yes(bookmark.includes('webview.label() != "main"'),"only main window can bookmark");
yes(bookmark.includes('url.host_str() != Some("chatgpt.com")'),"exact ChatGPT host");
yes(bookmark.includes('url.scheme() != "https"'),"TLS only");
yes(bookmark.includes('url.query().is_some()'),"query excluded, including temporary chat");
yes(bookmark.includes('url.fragment().is_some()'),"fragment excluded");
yes(bookmark.includes('id.len() != 36'),"UUID conversation path");
yes(bookmark.includes('read_at(&root, &id)?.ok_or_else'),"read-only existing bookmark is required to restore");
yes(bookmark.includes('BOOKMARK_ACTIVE_PAGE_PROTECTED'),"active page cannot be silently replaced");
yes(bookmark.includes('BOOKMARK_ALREADY_BOUND'),"no cross-workspace saved conversation alias");
yes(bookmark.includes('MoveFileExW'),"Windows atomic source publish");
yes(bookmark.includes('BOOKMARK_INVALID'),"corrupt persisted input rejected");
yes(bookmark.includes('sessionVerified":false'),"navigation is not account/session attestation");
yes(!bookmark.includes('document.querySelector') && !bookmark.includes('document.cookie') &&
    !bookmark.includes('chatgpt-send-candidate'),"no ChatGPT page extraction");
const start=pipe.indexOf('value["manualChatAction"]');
const end=pipe.indexOf('value["fixtureAction"]',start);
yes(start>0&&end>start,"manual chat action has a distinct branch");
const manual=pipe.slice(start,end);
yes(manual.indexOf("chat_manual_handoff::prepare")>=0&&
 manual.indexOf("chat_manual_handoff::prepare")<manual.indexOf("leases.authorize"),
 "reject malformed handoff before acquiring lease");
yes(manual.includes('tauri::EventTarget::webview("main")')&&
 manual.includes('"workspace-chat-draft"'),"manual draft is presented only to the main app webview");
yes(manual.indexOf('"workspace-chat-draft"')>manual.indexOf("leases.authorize"),
 "manual draft event is emitted only after native workspace lease admission");
yes(ui.includes('listen<ManualDraftReceipt>("workspace-chat-draft"')&&
 ui.includes("acceptManualDraft(payload)"),"desktop subscribes to authenticated native preview");
yes(ui.includes("receipt.sent!==false")&&ui.includes("receipt.sessionVerified!==false")&&
 ui.includes("receipt.resultVerified!==false")&&ui.includes("receipt.nextPromptAllowed!==false"),
 "desktop rejects falsely authorized or verified preview receipts");
yes(ui.includes("navigator.clipboard?.writeText")&&ui.includes("manualDraftArea?.select()"),
 "copy has an operator-selected fallback");
yes(ui.includes("readonly value={manualDrafts[current.id]}")&&
 ui.includes("onclick={dismissManualDraft}"),"review panel cannot edit or send the prompt");
yes(css.includes(".lp-manual-handoff textarea"),"manual draft panel has bounded desktop layout");
for(const handler of ["saveChatBookmark","reopenChatBookmark","forgetChatBookmark"]){
 yes(ui.includes("onclick={"+handler+"}"),"explicit UI action: "+handler);
}
yes(css.includes(".lp-chat-bookmark-actions"),"desktop recovery layout");
// A URL-only, native-operator deletion workflow must reuse the existing
// bookmark and PromptOutbox. Source wiring is not Windows/ChatGPT QA.
const host=read("apps/desktop/src-tauri/src/gateway_session.rs");
const gateway=read("src/gateway/mcp-gateway.mjs");
const chatCleanupRead=["review_previous_chat_cleanup","settle_previous_chat_cleanup"];
for(const name of chatCleanupRead){
 yes(main.includes("chat_bookmarks::"+name),"main-owned Tauri cleanup route "+name);
 yes(ui.includes('"'+name+'"'),"user-operated Work cleanup action "+name);
 yes(!stdio.includes(name),"no destructive cleanup MCP capability "+name);
}
yes(bookmark.includes("cleanup_candidate: Option<CleanupCandidate>"),
 "old-chat candidate belongs to existing bookmark owner");
yes(bookmark.includes("fn cleanup_candidate_at(")&&
 bookmark.includes("fn settle_cleanup_at("),"previous/current URL CAS and local resolution");
yes(bookmark.includes("BOOKMARK_PREVIOUS_CLEANUP_PENDING"),
 "pending cleanup cannot silently be overwritten or forgotten");
yes(bookmark.includes("fn cleanup_effects_clear(")&&
 host.includes("fn cleanup_pending_effects(")&&
 gateway.includes('"lazyprompting/workspaceCleanupPending"'),
 "native cleanup reuses canonical outbox via authenticated gateway");
yes(gateway.includes("store.unresolvedWorkspaceEffects({workspaceId:p.workspaceId})"),
 "all pending effects, not only chat sends, block deletion review");
yes(handoff.includes("fn cleanup_has_pending(")&&handoff.includes("self.drafts.try_lock()")&&
 bookmark.includes("drafts.cleanup_has_pending(workspace)?"),
 "pending native manual drafts and busy review lock block cleanup/switch safely");
yes(bookmark.includes("BOOKMARK_PAGE_CHANGED")&&
 bookmark.includes("chat_url(&live).as_deref()!=Some(url.as_str())"),
 "bookmark rechecks protected Chat B URL after the canonical pending-effect preflight");
yes(handoff.includes("fn cleanup_guard_denies_pending_drafts_and_busy_owner()"),
 "Rust negative fixture checks pending drafts and reverse lock contention");
yes(summary.includes('cleanupState==="PENDING_REVIEW"')&&
 summary.includes('chatState==="FULL_CONFIRMED"')&&
 summary.includes('oldChatReviewed'),
 "one presentation owner derives rollover and cleanup steps");
yes(ui.includes('await tabAction("open_support_tab",undefined,old)')&&
 ui.includes("if(!closed)cleanupNotice[id]")&&
 ui.includes('loc.source==="NATIVE_TAB_REGISTRY"')&&
 ui.includes("loc.tabId===reviewTab")&&
 ui.includes('loc.url===previous||loc.url==="https://chatgpt.com/"'),
 "support-tab review and closure report actual tab-controller result");
yes(ui.includes("rolloverRefreshQueued[id]"),
 "busy status hydration has a queued read rather than a stale result");
yes(css.includes(".lp-work-summary-step"),
 "single conversation stage indicator is styled without a second dashboard");
yes(bookmark.includes("crate::operator_confirmation::confirm("),
 "separate native user confirmation");
yes(bookmark.includes("serverDeletionVerified")&&
 !bookmark.includes('serverDeletionVerified":true'),
 "no claim of ChatGPT server deletion verification");
yes(bookmark.includes('action=="REPORTED_DELETED"')&&
 bookmark.includes('action=="KEEP"'),
 "delete report and keep remain distinct");
yes(bookmark.includes('let _lock = LOCK.lock()')&&
 bookmark.includes('if switching { cleanup_effects_clear(&app,&id)?; }'),
 "switch checks canonical outbox while the bookmark owner is locked");
yes(bookmark.includes("fn previous_chat_cleanup_is_scoped_local_and_persistent()"),
 "Rust regression covers URL scope, cleanup persistence, Keep and local report");
yes(ui.includes("Review and open old chat")&&
 ui.includes("I deleted old chat")&&ui.includes("Keep previous chat"),
 "Work offers operator-controlled cleanup");
yes(ui.includes('onclick={()=>settlePreviousChatCleanup("KEEP")}')&&
 ui.includes('onclick={()=>settlePreviousChatCleanup("REPORTED_DELETED")}'),
 "cleanup UI does not automatically issue a deletion action");
yes(!ui.includes('fetch("/backend-api')&&
 !bookmark.includes('/backend-api/'),
 "no ChatGPT private API delete transport");

yes(read("docs/operations/current-state.md").includes("This is the **single active continuation owner**"),
 "canonical active status file remains the single continuation owner");
console.log("Chat bookmark/handoff source graph: PASS ("+checks+
 " checks; no Rust compilation, browser use or ChatGPT acceptance)");
