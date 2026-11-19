import assert from "node:assert/strict";
import test from "node:test";
import {createChatGoalBridge} from "../src/mcp/chat-goal/bridge.mjs";
import {parseChatGoalInput, parseHostChatGoalReceipt} from "../src/mcp/chat-goal/contract.mjs";
import {registerChatGoalTools} from "../src/mcp/chat-goal/tools.mjs";

const token = c => c.repeat(48);
const caller = {signedIn: true};
const principal = {subjectId: "account-1", connectionId: "connection-1", chatSessionHint: "session-1"};
const makeBridge = (invoke, authenticate = async extra => extra?.signedIn ? principal : null) =>
  createChatGoalBridge({authenticate, invoke});

test("strict tool contract refuses forged authority, invalid scope and excessive model data", () => {
  assert.equal(parseChatGoalInput("goal.bind", {code: token("a"), approved: true}), null);
  assert.equal(parseChatGoalInput("goal.bind", {code: token("a"), workspaceId: "workspace-01"}), null);
  assert.equal(parseChatGoalInput("goal.report", {receipt: token("a"), outcome: "DONE",
    summary: "done", evidenceRefs: []}), null);
  assert.equal(parseChatGoalInput("goal.report", {receipt: token("a"), outcome: "CONTINUE",
    summary: "x".repeat(601), evidenceRefs: []}), null);
  assert.equal(parseChatGoalInput("goal.report", {receipt: token("a"), outcome: "CONTINUE",
    summary: "reported", evidenceRefs: [{kind: "QA_RECEIPT", ref: "r", verified: true}]}), null);
  assert.equal(parseChatGoalInput("turn.delivery", {delivery: token("a"), outcome: "verified"}), null);
  assert.ok(parseChatGoalInput("goal.report", {receipt: token("a"), outcome: "DONE_PROPOSED",
    summary: "Proposed done", evidenceRefs: []}));
});

test("no standalone bridge or unauthenticated tool can reach a native effect", async () => {
  assert.throws(() => createChatGoalBridge(), /TRUSTED_HOST_REQUIRED/);
  let calls = 0;
  const bridge = makeBridge(async () => { calls++; return {state: "BOUND"}; });
  const response = await bridge.call("goal.bind", {code: token("b")}, {});
  assert.equal(response.structuredContent.code, "AUTHENTICATION_REQUIRED");
  assert.equal(calls, 0);
  assert.equal((await bridge.call("goal.bind", {code: token("b"), force: true}, caller))
    .structuredContent.code, "INVALID_INPUT");
  assert.equal(calls, 0);
});

test("host-issued claim stays outside model-visible content and cannot become a model authorization", async () => {
  const calls = [];
  const bridge = makeBridge(async request => {
    calls.push(request);
    return {state: "NEXT_TURN_READY", nextClaim: token("c")};
  });
  const result = await bridge.call("goal.bind", {code: token("a")}, caller);
  assert.equal(result.structuredContent.status, "NEXT_TURN_READY");
  assert.equal(result.structuredContent.qa, "NOT_VERIFIED");
  assert.equal(result._meta.nextClaim, token("c"));
  assert.ok(!JSON.stringify(result.content).includes(token("c")));
  assert.ok(!JSON.stringify(result.structuredContent).includes(token("c")));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].principal, principal);
  assert.deepEqual(calls[0].input, {code: token("a")});
});

test("model DONE proposal is not promoted to verified work or a second prompt", async () => {
  const bridge = makeBridge(async () => ({state: "REVIEW_REQUIRED"}));
  const result = await bridge.call("goal.report", {receipt: token("a"),
    outcome: "DONE_PROPOSED", summary: "Source reviewed", evidenceRefs: []}, caller);
  assert.equal(result.structuredContent.status, "REVIEW_REQUIRED");
  assert.equal(result.structuredContent.qa, "NOT_VERIFIED");
  assert.equal(result._meta, undefined);
});

test("only a widget claim may expose one prompt; host must atomically reserve", async () => {
  const secretPrompt = "Review the source and report only the verified SHA.";
  const bridge = makeBridge(async () => ({
    state: "CLAIMED", prompt: secretPrompt, delivery: token("d"),
  }));
  const result = await bridge.call("turn.claim", {claim: token("c")}, caller);
  assert.equal(result.structuredContent.status, "CLAIMED");
  assert.equal(result._meta.prompt, secretPrompt);
  assert.equal(result._meta.delivery, token("d"));
  assert.ok(!JSON.stringify(result.content).includes(secretPrompt));
  assert.ok(!JSON.stringify(result.structuredContent).includes(secretPrompt));
  assert.equal(parseHostChatGoalReceipt("turn.claim", {state: "CLAIMED",
    prompt: secretPrompt, delivery: token("d"), qa: "PASSED"}), null);
});

test("lost native response is held without retry, even for accepted UI delivery", async () => {
  let calls = 0;
  const bridge = makeBridge(async () => {
    calls++;
    throw Error("pipe disconnected after a possible effect");
  });
  const result = await bridge.call("turn.delivery", {
    delivery: token("d"), outcome: "accepted",
  }, caller);
  assert.equal(result.structuredContent.code, "HOST_OUTCOME_UNCERTAIN");
  assert.equal(calls, 1);
  assert.equal(result._meta, undefined);
});

test("native response cannot grant arbitrary states, prompt fields or fake QA", async () => {
  assert.equal(parseHostChatGoalReceipt("goal.report", {state: "DONE"}), null);
  assert.equal(parseHostChatGoalReceipt("goal.report", {
    state: "NEXT_TURN_READY", nextClaim: token("c"), prompt: "unverified",
  }), null);
  assert.equal(parseHostChatGoalReceipt("turn.delivery", {
    state: "DELIVERY_RECORDED", deliveryVerified: true,
  }), null);
  const bridge = makeBridge(async () => ({state: "DONE"}));
  assert.equal((await bridge.call("goal.report", {receipt: token("a"),
    outcome: "CONTINUE", summary: "Continue", evidenceRefs: []}, caller))
    .structuredContent.code, "HOST_RECEIPT_INVALID");
});

test("registration stays separate from production entrypoint and keeps widget operations private", async () => {
  const tools = new Map();
  const resources = [];
  const server = {
    registerTool: (name, config, handler) => tools.set(name, {config, handler}),
    registerResource: (...args) => resources.push(args),
  };
  const bridge = makeBridge(async () => ({state: "BOUND"}));
  registerChatGoalTools(server, {bridge, widgetHtml: "<!doctype html><p id='status'>Goal</p>"});
  assert.deepEqual([...tools.keys()], ["goal.bind", "goal.report", "turn.claim", "turn.delivery"]);
  assert.equal(resources.length, 1);
  assert.deepEqual(tools.get("turn.claim").config._meta.ui.visibility, ["app"]);
  assert.deepEqual(tools.get("turn.delivery").config._meta.ui.visibility, ["app"]);
  for (const item of tools.values())
    assert.equal(item.config.securitySchemes[0].type, "oauth2");
  assert.equal((await tools.get("goal.bind").handler({code: token("a")}, caller))
    .structuredContent.status, "BOUND");
  assert.throws(() => registerChatGoalTools(server, {bridge}), /AUTHENTICATED_REGISTRATION_REQUIRED/);
});
