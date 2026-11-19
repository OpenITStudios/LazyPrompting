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
 // Codex is the normal operator: keep controls available but unmounted
 // until the human explicitly requests them.
 need('let showBrowserControls=$state(false)',"browser chrome starts closed");
 need('data-testid="operator-browser-tools-toggle"',"one manual browser fallback");
 need('data-testid="operator-work-toggle"',"manual work/recovery independent of chrome");
 need('{#if mountedSlots.includes(current.id)&&showBrowserControls}\n     <div class="lp-browser-tabs"',
   "tab strip is not mounted by default");
 need('{#if mountedSlots.includes(current.id)&&showBrowserControls}\n     <div class="lp-browser-toolbar"',
   "address and navigation are not mounted by default");
 need('if(newDraft && workspaceState.selectedId===id && mountedSlots.includes(id))',
   "accepted manual draft reveals work review in selected mounted view");
 need('case "ADDRESS":focusBrowserAddress();break;',
   "Ctrl+L uses the same address fallback");
 need('onclick={focusBrowserAddress}>Edit address</button>',
   "failed navigation also reveals the address bar");
 need('function focusBrowserAddress(){',"one address focus owner");
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

test("negative UI regression cannot re-enable default browser chrome",()=>{
 assert.throws(()=>verifyBrowserLayout(
  app.replace("let showBrowserControls=$state(false)",
   "let showBrowserControls=$state(true)"),css));
 assert.throws(()=>verifyBrowserLayout(
  app.replace('{#if mountedSlots.includes(current.id)&&showBrowserControls}\n     <div class="lp-browser-toolbar"',
   '{#if mountedSlots.includes(current.id)}\n     <div class="lp-browser-toolbar"'),css));
 assert.throws(()=>verifyBrowserLayout(
  app.replace('data-testid="operator-work-toggle"',
   'data-testid="operator-hidden-work-toggle"'),css));
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

const nativeBrowser=readFileSync(
 fileURLToPath(new URL("../../src-tauri/src/embedded_webview.rs",import.meta.url)),"utf8"
);
test("native mount retains the all-workspace visibility safety contract",()=>{
 const start=nativeBrowser.indexOf("pub async fn mount_embedded_view(");
 const end=nativeBrowser.indexOf("// Resize only the current native view",start);
 assert.ok(start>=0&&end>start,"native mount exists before resize owner");
 const mount=nativeBrowser.slice(start,end);
 assert.ok(mount.includes("tabs.hide(&window, &id)?;")&&
  mount.includes("revoke_workspace_grants(window.app_handle(), &id)")&&
  mount.includes("view.show()")&&
  mount.includes("tabs.restore(&window, &workspace_id"),
  "native mount must hide other main/support tabs and revoke stale grants");
 const withoutHide=mount.replace("tabs.hide(&window, &id)?;","/* missing */");
 assert.ok(!withoutHide.includes("tabs.hide(&window, &id)?;"),
  "negative fixture invalidates the required mount hide operation");
});

const nativeSupportTabs=readFileSync(
 fileURLToPath(new URL("../../src-tauri/src/browser_support_tabs.rs",import.meta.url)),"utf8"
);
test("low-end shell removes decorative effects but retains navigation and focus",()=>{
 assert.ok(!/\bbox-shadow\s*:/.test(css)&&!/\bbackdrop-filter\s*:/.test(css),
  "no painted shadows or blur in the app shell");
 assert.ok(!/transition\s*:\s*(?!none\b)/.test(css),
  "no cosmetic hover transitions by default");
 assert.ok(css.includes("border-top:2px solid #1683ff")&&
  css.includes("outline:1px solid #2768a6")&&
  css.includes(".lp-app button:focus-visible"),
  "active tab and keyboard focus remain visible");
 assert.ok(app.includes('aria-label={`${w.name}, ${workspaceStatus(w)}`}')&&
  app.includes('{#if workspaceStatus(w)==="Open"}'),
  "closed status is accessible but no empty status ornament renders");
 const withShadow=css+"\n.fake{box-shadow:0 18px 48px #0009}";
 assert.ok(/\bbox-shadow\s*:/.test(withShadow),"negative fixture catches shadow");
});
function ownedSection(source,start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,"native tab control owner found");
 return source.slice(a,b);
}
test("hidden WebView2 support tabs use LOW targets and active view restores NORMAL",()=>{
 const restore=ownedSection(nativeSupportTabs,"pub(crate) fn restore(","pub(crate) fn close_workspace(");
 const open=ownedSection(nativeSupportTabs,"pub(crate) async fn open_support_tab(","pub(crate) fn select_browser_tab(");
 const close=ownedSection(nativeSupportTabs,"pub(crate) fn close_support_tab(","// Code Mode projects");
 assert.ok(restore.includes("set_memory_saving(&main, true)")&&
  restore.includes("set_memory_saving(&v, false)"),
  "return to support view lowers hidden main target");
 assert.ok(open.includes("set_memory_saving(&home, true)")&&
  open.includes("set_memory_saving(&v, true)")&&
  open.includes("set_memory_saving(&tab, false)"),
  "opening support tab lowers both hidden main/old support and normalizes selected tab");
 assert.ok(close.includes("set_memory_saving(&home, false)"),
  "closing selected support tab restores normal main target");
 const missing=open.replace("set_memory_saving(&home, true)","removed");
 assert.ok(!missing.includes("set_memory_saving(&home, true)"),
  "negative fixture catches a removed LOW hint");
 assert.ok(!nativeSupportTabs.includes("TrySuspendAsync"),
  "no accidental renderer suspension during ChatGPT or supporting-page work");
});

test("WebView2 LOW/NORMAL target is live-read and idempotent, never cached",()=>{
 const owner=nativeBrowser.slice(
  nativeBrowser.indexOf("// Compare the live WebView2 memory target"),
  nativeBrowser.indexOf("pub(crate) fn label_for("));
 assert.ok(owner.includes("fn memory_target_needs_update(")&&
  owner.includes("MemoryUsageTargetLevel(&mut observed)")&&
  owner.includes("if memory_target_needs_update(actual, level)")&&
  owner.includes("SetMemoryUsageTargetLevel(level)"),
  "native memory hint reads live level before writing");
 assert.ok(!owner.includes("static mut")&&!owner.includes("HashMap"),
  "no stale Rust cache across WebView2 view recreation");
 assert.ok(owner.includes(".ok()")&&owner.includes(".map(|_| observed)"),
  "failed getter does not suppress the best-effort setter");
 assert.ok(!owner.includes("TrySuspend")&&!owner.includes("EmptyWorkingSet"),
  "no silent JS suspension or artificial working-set trimming");
});

const memoryProfiler=readFileSync(
 fileURLToPath(new URL("../../src-tauri/src/browser_memory.rs",import.meta.url)),"utf8"
);
test("on-demand memory probe is read-only, bounded and not a polling control",()=>{
 assert.ok(app.includes('onclick={inspectBrowserMemory}')&&
  app.indexOf('onclick={inspectBrowserMemory}')>app.indexOf('{#if showDiagnostics}'),
  "memory UI only exists inside explicit advanced diagnostics");
 assert.ok(!app.includes("setInterval(inspectBrowserMemory")&&
  !app.includes("setTimeout(inspectBrowserMemory"),
  "no background memory monitor");
 assert.ok(memoryProfiler.includes('caller.label() != "main"')&&
  memoryProfiler.includes("MAX_PROCESSES: u32 = 128")&&
  memoryProfiler.includes("COM_ACK_TIMEOUT"),
  "native command limited to main-window operator");
 assert.ok(memoryProfiler.includes("GetProcessInfos()")&&
  memoryProfiler.includes("GetProcessMemoryInfo(")&&
  memoryProfiler.includes("PROCESS_QUERY_LIMITED_INFORMATION"),
  "profile PIDs come from WebView2 and OS memory is read-only");
 assert.ok(memoryProfiler.includes("private_commit_mib: complete.then(")&&
  memoryProfiler.includes("status: if complete { \"COMPLETE\" } else { \"PARTIAL\" }"),
  "unreadable processes cannot yield a false complete total");
 assert.ok(!memoryProfiler.includes("TerminateProcess(")&&
  !memoryProfiler.includes("EmptyWorkingSet(")&&
  !memoryProfiler.includes("TrySuspend("),
  "no hidden process control");
 assert.ok(!memoryProfiler.includes("pub pid:")&&
  !memoryProfiler.includes("pub url:"),
  "PIDs and private page URLs never leave native host");
});
