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
yes(read("docs/operations/current-state.md").length<18000,"single active checkpoint below repo limit");
console.log("Chat bookmark/handoff source graph: PASS ("+checks+
 " checks; no Rust compilation, browser use or ChatGPT acceptance)");
