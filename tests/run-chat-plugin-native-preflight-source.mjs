// Source-level wiring assertions only. Not a Rust build or Windows runtime test.
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
const read=async path=>readFile(new URL("../"+path,import.meta.url),"utf8");
const native=await read("apps/desktop/src-tauri/src/chat_plugin_preflight.rs");
const review=await read("apps/desktop/src-tauri/src/chat_plugin_codex_review.rs");
const main=await read("apps/desktop/src-tauri/src/main.rs");
const goals=await read("apps/desktop/src-tauri/src/goal_runs.rs");
const bookmarks=await read("apps/desktop/src-tauri/src/chat_bookmarks.rs");
const ui=await read("apps/desktop/src/App.svelte");
assert.ok(main.includes("mod chat_plugin_preflight;"));
assert.ok(main.includes("mod chat_plugin_codex_review;"));
assert.ok(main.includes("chat_plugin_preflight::chat_plugin_scope_preflight"));
assert.ok(main.includes("chat_plugin_preflight::chat_plugin_pending_status"));
assert.ok(native.includes('webview.label() != "main"'));
assert.ok(native.includes("goal_runs::chat_plugin_source_preflight"));
assert.ok(native.includes("chat_bookmarks::plugin_chat_digest"));
assert.ok(native.includes("CHAT_PLUGIN_SOURCE_RECONCILE_REQUIRED"));
assert.ok(native.includes('"operatorChatApproved":false'));
assert.ok(native.includes('"pluginAuthorized":false'));
assert.ok(native.includes('"chatSessionVerified":false'));
assert.ok(native.includes('"nextPromptAllowed":false'));
assert.ok(native.includes('"sent":false'));
const sourcePreflightOnly=native.slice(
 native.indexOf("pub(crate) async fn chat_plugin_scope_preflight("),
 native.indexOf("fn project_pending_status("));
assert.ok(!sourcePreflightOnly.includes("chat_plugin_intent_outbox("));
// The new on-demand status route is deliberately read-only; never
// admit reserve, bind, hold, release, claim or delivery mutations.
assert.ok(native.includes('gateway.chat_plugin_intent_outbox('));
assert.ok(native.includes('&app, "pending", json!({"workspaceId":workspace_id})'));
assert.ok(native.includes('webview.label() != "main"'));
assert.ok(native.includes('pluginAuthorized":false'));
assert.ok(native.includes('safeToRetry":false'));
assert.ok(native.includes('autoReleaseAllowed":false'));
assert.ok(native.includes('nextPromptAllowed":false'));
assert.ok(native.includes('CHAT_PLUGIN_PENDING_STATUS_INVALID'));
assert.ok(!native.includes("operator_confirmation::confirm("));
assert.ok(!native.includes("sendMessage("));
assert.ok(goals.includes("code_mode_status_at(root, run_id)?"));
assert.ok(goals.includes('status["state"] == "REVIEW_COMPLETE"'));
assert.ok(goals.includes('["status", "--porcelain", "--untracked-files=all"]'));
assert.ok(goals.includes("CHAT_PLUGIN_CODEX_SOURCE_CHANGED"));
assert.ok(bookmarks.includes("verify_operator_chat_target(app, workspace, &actual)?"));
assert.ok(ui.includes('"chat_plugin_scope_preflight"'));
assert.ok(ui.includes("checkPluginGoalScope(run.runId)"));
assert.ok(ui.includes("Plugin scope check is read-only."));
assert.ok(ui.includes('"chat_plugin_pending_status"'));
assert.ok(ui.includes("refreshChatPluginHold(current.id)"));
assert.ok(ui.includes("Check plugin hold"));
assert.ok(ui.includes("Plugin intent recovery without WebView"));
assert.ok(ui.includes('{#if !mountedSlots.includes(current.id)}'));
assert.ok(native.includes('"hold":raw["active"].as_u64() == Some(1)'));
assert.ok(ui.includes("Plugin hold status unavailable. Do not retry"));
assert.ok(ui.includes("safeToRetry!==false"));
assert.ok(ui.includes("autoReleaseAllowed!==false"));
console.log("ChatGPT plugin native source preflight wiring verified");

// Source-only assertions; these do NOT execute Rust or prove ChatGPT.
// The receiver is deliberately NOT a Tauri/public MCP command.
assert.ok(review.includes("pub(crate) fn inspect_chat_plugin_codex_review("));
assert.ok(review.includes("goal_runs::chat_plugin_source_preflight(app, run_id)"));
assert.ok(review.includes("chat_bookmarks::plugin_chat_digest(app, workspace_id)"));
assert.ok(review.includes("serde_json::to_vec(&core)"));
assert.ok(review.includes("FINGERPRINT_DOMAIN"));
assert.ok(review.includes("reportReceiptVerified"));
assert.ok(review.includes('"codexDispatchAuthorized":false'));
assert.ok(review.includes('"workerExecuted":false'));
assert.ok(review.includes('"nextPromptAllowed":false'));
assert.ok(!review.includes("#[tauri::command]"));
assert.ok(!main.includes("chat_plugin_codex_review::inspect_chat_plugin_codex_review,"));
assert.ok(!review.includes("sendMessage("));
assert.ok(!review.includes("Command::new("));
