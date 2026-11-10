import assert from "node:assert/strict";
import {CodexPreviewTools} from "../src/transport/codex-preview-tools.mjs";

const tools = new CodexPreviewTools();
const request = {
  method: "item/tool/call",
  params: {threadId: "thread-1", turnId: "turn-1", callId: "call-1",
    tool: "lazyprompting_open_preview", arguments: {}}
};
try {
  assert.equal(tools.receive({...request, params: {
    ...request.params, arguments: {workspaceId: "workspace-02", url: "https://example.com"}
  }}).success, false);
  const result = tools.receive(request);
  const {token, action} = tools.peek("thread-1", "turn-1");
  assert.equal(action, "open");
  assert.equal(tools.peek("thread-1", "turn-2"), null);
  assert.equal(tools.claim("thread-2", "turn-1", token, true), false);
  assert.equal(tools.claim("thread-1", "turn-2", token, true), false);
  assert.equal(tools.answer("thread-1", "turn-1", token, {ok: true}), false);
  assert.equal(tools.claim("thread-1", "turn-1", token, true), true);
  assert.equal(tools.claim("thread-1", "turn-1", token, true), false);
  assert.equal(tools.answer("thread-1", "turn-1", token, {ok: true}), true);
  assert.equal(tools.answer("thread-1", "turn-1", token, {ok: true}), false);
  assert.equal((await result).success, true);
  assert.equal(tools.receive(request).success, false);

  const denied = tools.receive({...request, params: {
    ...request.params, tool: "lazyprompting_read_preview", callId: "call-2"
  }});
  const declined = tools.peek("thread-1", "turn-1");
  assert.equal(tools.claim("thread-1", "turn-1", declined.token, false), false);
  assert.equal((await denied).success, false);

  const cancelled = tools.receive({...request, params: {
    ...request.params, tool: "lazyprompting_close_preview", callId: "call-3"
  }});
  tools.cancel("thread-1");
  assert.equal((await cancelled).success, false);
  const disconnected = tools.receive({...request, params: {...request.params, turnId: "turn-2"}});
  const beforeDisconnect = tools.peek("thread-1", "turn-2");
  tools.close();
  assert.equal(tools.claim("thread-1", "turn-2", beforeDisconnect.token, true), false);
  assert.equal((await disconnected).success, false);
} finally {
  tools.close();
}
console.log("Codex preview tool scope, one-use claims, denial and cancellation passed");
