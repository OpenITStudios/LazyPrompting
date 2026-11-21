/* Single-source Helium/WebView2 manifest contract, authored not run. */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {heliumManifest} from "../scripts/package-helium-companion.mjs";
const read=async path=>readFile(new URL("../"+path,import.meta.url),"utf8");
const canonical="apps/desktop/browser-extension/chatgpt-composer/";
const source=JSON.parse(await read(canonical+"manifest.json"));
const helium=heliumManifest(source);
assert.deepEqual(helium,source);
assert.equal(helium.name,"LazyPrompting Companion");
assert.deepEqual(helium.permissions,["storage"]);
assert.deepEqual(helium.host_permissions,["https://chatgpt.com/*"]);
assert.equal(helium.action,undefined);
assert.equal(helium.options_page,undefined);
assert.equal(helium.background,undefined);
assert.deepEqual(helium.content_scripts[0].js,[
 "companion/core.js",
 "companion/compact-history.js",
 "companion/history-visibility.js",
 "companion/limit-notice.js",
 "companion/usage-meter-signal.js",
 "companion/settings.js",
 "companion/new-chat.js",
 "companion/toolbar.js"
]);
assert.deepEqual(helium.content_scripts[0].css,["companion/toolbar.css"]);
for(const asset of [...helium.content_scripts[0].js,...helium.content_scripts[0].css]){
 const body=await read(canonical+asset);
 assert.ok(body.length>50,"missing shared file "+asset);
}
const packageSource=await read("scripts/package-helium-companion.mjs");
assert.ok(packageSource.includes("return input;"));
assert.ok(packageSource.includes("manifest.content_scripts[0].js"));
assert.ok(!packageSource.includes("compact-controller.js"));
assert.ok(!packageSource.includes("standalone-meter.js"));
const settings=await read(canonical+"companion/settings.js");
const toolbar=await read(canonical+"companion/toolbar.js");
const visible=await read(canonical+"companion/history-visibility.js");
assert.ok(settings.includes("3_600_000")&&settings.includes("4_000_000"));
assert.ok(toolbar.includes("Context Warnings"));
assert.ok(toolbar.includes("Compact History"));
assert.ok(toolbar.includes("Settings"));
assert.ok(toolbar.includes('button("",newChat,"New Chat")'));
assert.ok(toolbar.includes("appIcon()"));
assert.ok(toolbar.includes('C.mutationNeedsRefresh(records,"monitor")'));
assert.ok((await read(canonical+"companion/new-chat.js")).includes('C.mutationNeedsRefresh(records,"rollover")'));
assert.ok((await read(canonical+"companion/new-chat.js")).includes("if(!api||busy||starting||!tabNonce())return;"));

assert.ok(toolbar.includes("R.begin(current)"));
assert.ok(toolbar.includes("!event?.isTrusted"));
const rollover=await read(canonical+"companion/new-chat.js");
assert.ok(rollover.includes('globalThis.location.assign("https://chatgpt.com/")'));
assert.ok(rollover.includes('button[data-testid="delete-conversation-confirm-button"]'));
assert.ok(rollover.includes('phase:"DELETE_ATTEMPTED"'));
assert.ok(rollover.includes("if(!sawFirstSend(record.nonce))return;"));
assert.ok(!rollover.includes("backend-api"));
const toolbarCss=await read(canonical+"companion/toolbar.css");
assert.ok(toolbarCss.includes(".lp-new-chat"));
assert.ok(toolbarCss.includes(".lp-metric"));
assert.ok(toolbarCss.includes(".lp-brand svg"));
assert.ok(toolbarCss.includes(".lp-settings-icon"));

assert.ok(toolbar.includes("Limit hit"));
assert.ok(toolbar.includes('label="Error";level="error"'));
assert.ok(toolbar.includes("control.click()"));
const notice=await read(canonical+"companion/limit-notice.js");
assert.ok(notice.includes("observeLatestError,isGenerating,retryControl"));
assert.ok(visible.includes("Show earlier messages"));
assert.ok(!toolbar.includes("Bookmark"));
console.log("Helium shares the canonical WebView2 extension source (source-only assertion).");

