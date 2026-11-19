// Static browser UX regression guards; not a Svelte build or Windows QA.
// Focus: preserve the approved app shell while keeping the real WebView2
// the dominant surface with optional browser/AI panels.
import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const app=readFileSync(fileURLToPath(new URL("../App.svelte",import.meta.url)),"utf8");
const css=readFileSync(fileURLToPath(new URL("../app.css",import.meta.url)),"utf8");
function verifyBrowserLayout(source,style) {
 const need=(text,reason)=>assert.ok(source.includes(text),reason);
 need('class="lp-topbar"',"approved topbar preserved");
 need('class="lp-sidebar"',"approved workspace sidebar preserved");
 need('data-testid="focus-toggle"',"approved Focus preserved");
 need('data-testid="connection-status-header"',"approved Connections preserved");
 need('workspaceState.workspaces as w',"ten-workspace navigation preserved");
 need('class="lp-empty"',"closed-browser empty state preserved");
 need('onclick={()=>openLocalPreview()}',"browser-open action preserved");
 need('class="lp-browser-tabs"',"single browser tab strip");
 need('class="lp-browser-toolbar"',"conventional navigation toolbar");
 need('class="lp-browser-address lp-browser-omnibox"',"address/search retained");
 need('class="lp-browser-tool-panel"',"optional utilities/AI panel");
 need('class="lp-browser-page" bind:this={viewerElement}',"native measured page retained");
 need('browserPanel[current.id]?"lp-browser-content has-panel"',"optional panel layout switch");
 need('browserPanel[current.id]==="activity"',"Work activity view exists");
 need('class="lp-work-summary"',"bounded work summary");
 need('data-testid="work-diagnostics-toggle"',"technical details are optional");
 need('showIncludesHide:true',"native mount owns its single visibility pass");
 need('new ResizeObserver(queueViewerResize)',"resizes coalesce");
 need('window.requestAnimationFrame',"one pending frame");
 need('window.cancelAnimationFrame(viewerResizeFrame)',"cleanup cancels frame");
 need('{#if showDiagnostics}',"diagnostics mount on demand");
 assert.ok(source.indexOf('class="lp-work-summary"')<source.indexOf('{#if showDiagnostics}')&&
   source.indexOf('{#if showDiagnostics}')<source.indexOf('aria-label="Goal lifecycle display-only status"'),
   "technical lifecycle data must be behind the diagnostic gate");
 need('browserPanel[current.id]==="menu"',"browser menu exists");
 need('onclick={()=>browserAction("back")}',"back uses old native owner");
 need('onclick={()=>browserAction("forward")}',"forward uses old native owner");
 need('onclick={()=>browserAction("reload")}',"reload uses old native owner");
 need('onclick={()=>openTab()}',"new tab stays native");
 need('onclick={()=>toggleBrowserPanel("permissions")}',"site permissions accessible");
 need('onclick={()=>toggleBrowserPanel("downloads")}',"download controls accessible");
 need('onclick={()=>toggleBrowserPanel("library")}',"history/bookmarks accessible");
 need('onclick={()=>toggleBrowserPanel("activity")}',"Activity is explicit");
 need('onclick={saveTabs}',"tab sessions remain available");
 need('onclick={restoreTabs}',"saved tab restore remains available");
 need('onclick={allowObservation}',"one-shot observation remains gated");
 need('onclick={prepareNextDraft}',"manual continuation remains in UI");
 need('aria-label="Close browser panel"',"one obvious panel dismissal");
 const show=source.slice(source.indexOf('async function showWorkspace('),source.indexOf('async function openLocalPreview('));
 assert.ok(!show.includes('refreshSavedTabs(id)')&&show.includes('if(observationOpen[id])void refreshObservation(id)'),
   "only selected tab and opened observation state are eagerly read");
 const tabs=source.indexOf('class="lp-browser-tabs"');
 const toolbar=source.indexOf('class="lp-browser-toolbar"');
 const page=source.indexOf('class="lp-browser-page" bind:this={viewerElement}');
 const panel=source.indexOf('class="lp-browser-tool-panel"');
 const activity=source.indexOf('aria-label="Goal lifecycle display-only status"');
 const permissions=source.indexOf('aria-label="Browser site permissions"');
 assert.ok(tabs>=0&&tabs<toolbar&&toolbar<page&&page<panel&&
   panel<activity&&panel<permissions,
   "advanced diagnostic/permission UI must not stack before native page");
 assert.equal(source.split('bind:this={viewerElement}').length-1,1,
   "one native WebView2 bounds owner");
 assert.ok(style.includes('.lp-browser-content{display:flex;')&&
   style.includes('.lp-browser-tool-panel{')&&
   style.includes('@media(max-width:760px)'),
   "responsive sibling panel; not floating over native WebView2");
 assert.ok(!source.includes('tools.browser.navigate('),
   "AI/browser effect remains outside presentation");
}
test("browser interior is page-first without disturbing approved outer shell",()=>{
 verifyBrowserLayout(app,css);
});
test("negative source changes fail browser-only layout guard",()=>{
 assert.throws(()=>verifyBrowserLayout(
   app.replace('class="lp-browser-tool-panel"','class="missing-panel"'),css));
 assert.throws(()=>verifyBrowserLayout(
   app.replace('class="lp-browser-page" bind:this={viewerElement}',
     'class="lp-browser-page"'),css));
 assert.throws(()=>verifyBrowserLayout(
   app,css.replaceAll('.lp-browser-tool-panel{','.removed-panel{')));
});

test("native event listeners remain guarded by Tauri host detection",()=>{
 const pattern=/refreshPendingManualHandoff\(selected\);\s*\}\s*void listen</;
 assert.ok(!pattern.test(app),"never subscribe to native events outside nativeDesktop");
 assert.ok(app.includes('if(nativeDesktop){')&&app.includes('void listen<'),
   "browser event subscriptions still exist and are host-gated");
 const regression=app.replace('void refreshPendingManualHandoff(selected);',
   'void refreshPendingManualHandoff(selected);\n  }');
 assert.ok(pattern.test(regression),"negative fixture detects premature guard close");
});
