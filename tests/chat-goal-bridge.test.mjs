import assert from "node:assert/strict";
import test from "node:test";
import {createChatGoalBridge} from "../src/mcp/chat-goal/bridge.mjs";
import {parseChatGoalInput, parseHostChatGoalReceipt} from "../src/mcp/chat-goal/contract.mjs";
import {registerChatGoalTools} from "../src/mcp/chat-goal/tools.mjs";
import {parseNativeChatGoalAdmission} from "../src/mcp/chat-goal/host-admission.mjs";

const token = c => c.repeat(48);
const caller = {signedIn: true};
const principal = {subjectId: "account-1", connectionId: "connection-1", chatSessionHint: "session-1"};
const hostApproval = (p=principal, overrides={}) => ({
  schemaVersion:1,source:"NATIVE_APPROVED_CHAT_GOAL",
  subjectId:p.subjectId,connectionId:p.connectionId,
  workspaceId:"workspace-01",goalDigest:"a".repeat(64),
  conversationDigest:"b".repeat(64),principalTag:"c".repeat(64),
  epoch:1,operatorApproved:true,stopped:false,chatBound:true,
  ...overrides,
});
const makeBridge = (invoke,
  authenticate = async extra => extra?.signedIn ? principal : null,
  authorize = async ({principal: p}) => hostApproval(p)) =>
  createChatGoalBridge({authenticate, authorize, invoke});

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

test("native-host prompt accepts bounded multi-line instructions without a 600-character cap", () => {
  const prompt = "Review source\r\n" + "read-only context\n".repeat(90);
  const receipt = parseHostChatGoalReceipt("turn.claim", {
    state: "CLAIMED", prompt, delivery: token("d"),
  });
  assert.equal(receipt?.prompt, prompt);
  assert.equal(parseHostChatGoalReceipt("turn.claim", {
    state: "CLAIMED", prompt: "a".repeat(12001), delivery: token("d"),
  }), null);
  assert.equal(parseHostChatGoalReceipt("turn.claim", {
    state: "CLAIMED", prompt: "a\u0000b", delivery: token("d"),
  }), null);
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
  assert.equal(calls[0].admission.workspaceId,"workspace-01");
  assert.equal(calls[0].admission.goalDigest,"a".repeat(64));
  assert.equal(calls[0].admission.chatBound,true);
  assert.equal(Object.hasOwn(calls[0].admission,"operatorApproved"),false);
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
  assert.equal(result.structuredContent.status, "RECONCILE_REQUIRED");
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
  assert.equal((await bridge.call("goal.report", {receipt: token("a"),
    outcome: "CONTINUE", summary: "Continue", evidenceRefs: []}, caller))
    .structuredContent.status, "RECONCILE_REQUIRED");
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
  for (const item of tools.values()) {
    assert.equal(item.config.securitySchemes[0].type, "oauth2");
    assert.deepEqual(item.config._meta.securitySchemes, item.config.securitySchemes);
  }
  assert.equal(tools.get("turn.claim").config._meta["openai/visibility"], undefined);
  assert.equal((await tools.get("goal.bind").handler({code: token("a")}, caller))
    .structuredContent.status, "BOUND");
  assert.throws(() => registerChatGoalTools(server, {bridge}), /AUTHENTICATED_REGISTRATION_REQUIRED/);
});


test("OAuth authentication is insufficient without native authorization", async () => {
  let invocations=0, checks=0;
  assert.throws(() => createChatGoalBridge({
    authenticate:async()=>principal,
    invoke:async()=>{invocations++;return {state:"BOUND"};},
  }),/TRUSTED_HOST_REQUIRED/);
  const bridge=createChatGoalBridge({
    authenticate:async()=>principal,
    authorize:async()=>{checks++;return null;},
    invoke:async()=>{invocations++;return {state:"BOUND"};},
  });
  const result=await bridge.call("goal.bind",{code:token("a")},caller);
  assert.equal(result.structuredContent.code,"NATIVE_SCOPE_UNVERIFIED");
  assert.equal(result.structuredContent.status,"REVIEW_REQUIRED");
  assert.equal(invocations,0);
  assert.equal(checks,1);
  assert.equal(result._meta,undefined);
});

test("wrong principal/scope/approval/STOP/malformed native admission denies every effect", async () => {
  const rejected=[
    {source:"MCP_MODEL_ASSERTION"},
    {schemaVersion:2},{subjectId:"other-account"},
    {connectionId:"another-connection"},
    {workspaceId:"workspace-11"},{goalDigest:"x".repeat(64)},
    {conversationDigest:"0".repeat(64)},{principalTag:"z".repeat(64)},
    {epoch:0},{operatorApproved:false},{stopped:true},
    {chatBound:"true"},{modelApproved:true},
  ];
  for(const change of rejected){
    let calls=0;
    const bridge=makeBridge(async()=>{calls++;return {state:"BOUND"};},
      async()=>principal,
      async()=>hostApproval(principal,change));
    const result=await bridge.call("goal.bind",{code:token("a")},caller);
    assert.equal(result.structuredContent.code,"NATIVE_SCOPE_UNVERIFIED",
      JSON.stringify(change));
    assert.equal(calls,0);
  }
  const scope=hostApproval();
  assert.equal(parseNativeChatGoalAdmission(scope,{...principal,subjectId:"forged"},"goal.bind"),null);
});

test("unbound ChatGPT conversation cannot claim, report or deliver", async () => {
  let called=0;
  const authorize=async ({principal:p})=>hostApproval(p,{chatBound:false});
  const invoke=async()=>{called++;return {state:"CLAIMED",prompt:"hello",delivery:token("d")}};
  const bridge=makeBridge(invoke,async()=>principal,authorize);
  for(const [name,args] of [
    ["goal.report",{receipt:token("a"),outcome:"DONE_PROPOSED",summary:"done",evidenceRefs:[]}],
    ["turn.claim",{claim:token("a")}],
    ["turn.delivery",{delivery:token("a"),outcome:"accepted"}],
  ]){
    const result=await bridge.call(name,args,caller);
    assert.equal(result.structuredContent.code,"NATIVE_SCOPE_UNVERIFIED",name);
  }
  assert.equal(called,0);
  const bind=await bridge.call("goal.bind",{code:token("a")},caller);
  assert.equal(bind.structuredContent.code,"HOST_RECEIPT_INVALID");
  assert.equal(called,1);
  // A non-correlated account bind must never hand the widget a prompt claim.
  const suspicious=makeBridge(async()=>({state:"NEXT_TURN_READY",nextClaim:token("c")}),
    async()=>principal,authorize);
  const denied=await suspicious.call("goal.bind",{code:token("a")},caller);
  assert.equal(denied.structuredContent.code,"HOST_RECEIPT_INVALID");
  assert.equal(denied._meta,undefined);
});

test("native authorization exceptions do not trigger effects or model retries",async()=>{
  let calls=0;
  const bridge=makeBridge(async()=>{calls++;return {state:"BOUND"};},
    async()=>principal,
    async()=>{throw Error("Native STOP state unavailable");});
  const res=await bridge.call("goal.bind",{code:token("a")},caller);
  assert.equal(res.structuredContent.code,"NATIVE_ADMISSION_UNAVAILABLE");
  assert.equal(res.structuredContent.status,"REVIEW_REQUIRED");
  assert.equal(calls,0);
});
