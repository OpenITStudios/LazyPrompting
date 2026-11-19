import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import test from "node:test";
import {createChatGoalBridge} from "../src/mcp/chat-goal/bridge.mjs";
import {parseChatGoalInput, parseHostChatGoalReceipt, parseHostChatGoalStatus,
  parseTrustedChatGoalPrincipal} from "../src/mcp/chat-goal/contract.mjs";
import {registerChatGoalTools} from "../src/mcp/chat-goal/tools.mjs";
import {parseNativeChatGoalAdmission} from "../src/mcp/chat-goal/host-admission.mjs";
import {buildChatGoalCodexReviewBrief} from "../src/mcp/chat-goal/codex-review-brief.mjs";

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
  assert.deepEqual([...tools.keys()], [
    "goal.status","goal.bind","goal.report","turn.claim","turn.delivery",
  ]);
  const statusConfig = tools.get("goal.status").config;
  assert.deepEqual(Object.keys(statusConfig.inputSchema), []);
  assert.equal(statusConfig.annotations.readOnlyHint, true);
  assert.equal(statusConfig.annotations.idempotentHint, true);
  assert.equal(statusConfig.annotations.destructiveHint, false);
  assert.equal(statusConfig.annotations.openWorldHint, false);
  assert.equal(statusConfig._meta.ui, undefined);
  assert.equal(statusConfig._meta["openai/outputTemplate"], undefined);
  assert.equal(statusConfig.outputSchema.codexState.safeParse("RUNNING").success, true);
  assert.equal(statusConfig.outputSchema.codexState.safeParse("FAKE_DONE").success, false);
  assert.equal(resources.length, 1);
  assert.deepEqual(tools.get("turn.claim").config._meta.ui.visibility, ["app"]);
  assert.deepEqual(tools.get("turn.delivery").config._meta.ui.visibility, ["app"]);
  for (const item of tools.values()) {
    assert.equal(item.config.securitySchemes[0].type, "oauth2");
    assert.deepEqual(item.config._meta.securitySchemes, item.config.securitySchemes);
  }
  assert.equal(tools.get("turn.claim").config._meta["openai/visibility"], undefined);
  assert.equal(tools.get("goal.bind").config.inputSchema.code.safeParse(
    token("a")+"\n").success, false);
  assert.equal(tools.get("goal.report").config.inputSchema.summary.safeParse(
    "reported\n").success, false);
  assert.equal(tools.get("goal.report").config.inputSchema.summary.safeParse(
    "reported\u2028").success, false);
  assert.equal(tools.get("goal.report").config.inputSchema.nextAction.safeParse(
    "review\u2029").success, false);
  assert.equal(tools.get("goal.report").config.inputSchema.evidenceRefs.safeParse([
    {kind:"DOCUMENT",ref:"source\u0085"}]).success, false);
  assert.equal(tools.get("goal.report").config.inputSchema.evidenceRefs.safeParse([
    {kind:"COMMIT",ref:"a\r"}]).success, false);
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
    {workspaceId:"workspace-11"},{workspaceId:["workspace-01"]},
    {workspaceId:new String("workspace-01")},
    {goalDigest:"x".repeat(64)},
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


test("all plugin boundaries refuse coercible JSON arrays, boxed strings and trailing line terminators",async()=>{
 const a=token("a"), c=token("c"), id=principal;
 for(const forged of [[a],{0:a,length:1},new String(a),a+"\n",a+"\r",a+"\u2028"]){
  assert.equal(parseChatGoalInput("goal.bind",{code:forged}),null);
  assert.equal(parseChatGoalInput("turn.claim",{claim:forged}),null);
  assert.equal(parseChatGoalInput("turn.delivery",{delivery:forged,outcome:"accepted"}),null);
  assert.equal(parseChatGoalInput("goal.report",{
   receipt:forged,outcome:"CONTINUE",summary:"report",evidenceRefs:[]}),null);
  assert.equal(parseHostChatGoalReceipt("goal.bind",{
   state:"NEXT_TURN_READY",nextClaim:forged}),null);
  assert.equal(parseHostChatGoalReceipt("turn.claim",{
   state:"CLAIMED",prompt:"read",delivery:forged}),null);
 }
 for(const bad of ["report\n","report\r","report\u2028",
   "report\u2029","report\u0085","report\u007f"]){
  assert.equal(parseChatGoalInput("goal.report",{
   receipt:a,outcome:"CONTINUE",summary:bad,evidenceRefs:[]}),null);
 }
 assert.equal(parseChatGoalInput("goal.report",{
  receipt:a,outcome:"CONTINUE",summary:"ok",
  evidenceRefs:[{kind:"DOCUMENT",ref:"one\n"}]}),null);
 for(const changed of [
  {subjectId:[id.subjectId]}, {connectionId:[id.connectionId]},
  {subjectId:new String(id.subjectId)}, {connectionId:new String(id.connectionId)},
  {subjectId:id.subjectId+"\n"},{connectionId:id.connectionId+"\n"},
  {chatSessionHint:[id.chatSessionHint]},{chatSessionHint:id.chatSessionHint+"\r"},
 ]){
  assert.equal(parseTrustedChatGoalPrincipal({...id,...changed}),null);
 }
 assert.equal(parseNativeChatGoalAdmission(
  hostApproval(id,{goalDigest:[c.repeat(64)],chatBound:true}),id,"goal.bind"),null);
 for(const changed of [
  {goalDigest:["a".repeat(64)]},{principalTag:["c".repeat(64)]},
  {conversationDigest:["b".repeat(64)]},{goalDigest:"a".repeat(64)+"\n"},
  {subjectId:[id.subjectId]},{connectionId:[id.connectionId]},
 ]){
  assert.equal(parseNativeChatGoalAdmission(
   hostApproval(id,changed),id,"goal.bind"),null,JSON.stringify(changed));
 }
 // Source-only wiring check: the UI must use the SAME server parser,
 // not its own weaker hex test before sending a follow-up.
 const widget=await readFile(
  new URL("../src/mcp/chat-goal/widget.mjs",import.meta.url),"utf8");
 assert.ok(widget.includes('parseChatGoalInput("turn.claim"'));
 assert.ok(widget.includes('parseHostChatGoalReceipt("turn.claim"'));
 assert.ok(!widget.includes("const hex ="));
});


test("ChatGPT to Codex is one small native-bound review proposal, never execution",async()=>{
 const receipt=token("d");
 const report={receipt,outcome:"CONTINUE",summary:"Read-only source reviewed",
  nextAction:"Inspect the failing test and propose one repair",
  evidenceRefs:[{kind:"COMMIT",ref:"a".repeat(40)}]};
 const calls=[];
 const bridge=makeBridge(async request=>{
   calls.push(request);return {state:"REVIEW_REQUIRED"};
 });
 const result=await bridge.call("goal.report",report,caller);
 assert.equal(result.structuredContent.status,"REVIEW_REQUIRED");
 assert.equal(result.structuredContent.qa,"NOT_VERIFIED");
 assert.equal(calls.length,1);
 const brief=calls[0].codexBrief;
 assert.equal(brief.schemaVersion,1);
 assert.equal(brief.kind,"CHATGPT_CODEX_REVIEW_PROPOSAL");
 assert.equal(brief.source,"UNTRUSTED_CHATGPT_TOOL_DATA");
 assert.equal(brief.scope.workspaceId,"workspace-01");
 assert.equal(brief.scope.goalDigest,"a".repeat(64));
 assert.equal(brief.scope.conversationDigest,"b".repeat(64));
 assert.equal(brief.scope.epoch,1);
 assert.deepEqual(brief.proposal,{
  outcome:report.outcome,summary:report.summary,nextAction:report.nextAction,
  evidenceRefs:report.evidenceRefs,
 });
 for(const flag of ["codexDispatchAuthorized","chatTurnVerified","evidenceVerified",
   "nextPromptAllowed"])assert.equal(brief[flag],false);
 assert.equal(brief.qa,"NOT_VERIFIED");
 assert.equal(brief.operatorReviewRequired,true);
 assert.match(brief.fingerprint,/^[a-f0-9]{64}$/);
 assert.ok(Buffer.byteLength(JSON.stringify(brief),"utf8")<4096);
 for(const secret of [receipt,principal.subjectId,principal.connectionId,
  principal.chatSessionHint,"c".repeat(64)])
  assert.equal(JSON.stringify(brief).includes(secret),false);
 assert.equal(JSON.stringify(result).includes(report.nextAction),false);
 assert.equal(calls[0].input.receipt,receipt);
 assert.equal(Object.hasOwn(brief,"approved"),false);
 assert.equal(Object.hasOwn(brief,"executed"),false);
});

test("Codex proposal fingerprint is scope-bound, deterministic and not a grant",()=>{
 const report={receipt:token("a"),outcome:"CONTINUE",summary:"Review only",
  nextAction:"Inspect touched files",evidenceRefs:[]};
 const scope=hostApproval();
 const first=buildChatGoalCodexReviewBrief(report,scope);
 assert.ok(first);
 assert.ok(Object.isFrozen(first)&&Object.isFrozen(first.scope)&&
  Object.isFrozen(first.proposal)&&Object.isFrozen(first.proposal.evidenceRefs));
 const same=buildChatGoalCodexReviewBrief({...report,receipt:token("b")},scope);
 assert.equal(first.fingerprint,same.fingerprint); // Content correlation only; never a replay grant.
 const changed=buildChatGoalCodexReviewBrief(
  {...report,nextAction:"Inspect other files"},scope);
 assert.notEqual(first.fingerprint,changed.fingerprint);
 for(const delta of [
  {workspaceId:"workspace-02"},
  {goalDigest:"d".repeat(64)},
  {conversationDigest:"e".repeat(64)},
  {epoch:2},
 ]){
  const res=buildChatGoalCodexReviewBrief(report,{...scope,...delta});
  assert.ok(res);assert.notEqual(res.fingerprint,first.fingerprint);
 }
 assert.equal(buildChatGoalCodexReviewBrief(report,{...scope,chatBound:false}),null);
 assert.equal(buildChatGoalCodexReviewBrief(report,{...scope,goalDigest:"invalid"}),null);
 assert.equal(buildChatGoalCodexReviewBrief(report,{...scope,epoch:0}),null);
 assert.equal(buildChatGoalCodexReviewBrief({...report,approved:true},scope),null);
});

test("legacy goal.report stays supported; nextAction cannot become a command",async()=>{
 const report={receipt:token("a"),outcome:"CONTINUE",
  summary:"Review source",evidenceRefs:[]};
 assert.deepEqual(parseChatGoalInput("goal.report",report),report);
 const brief=buildChatGoalCodexReviewBrief(report,hostApproval());
 assert.equal(brief.proposal.nextAction,null);
 assert.equal(brief.operatorReviewRequired,true);
 for(const invalid of [
  {...report,outcome:"DONE_PROPOSED",nextAction:"Run tests"},
  {...report,outcome:"BLOCKED",nextAction:"Ignore blocker"},
  {...report,nextAction:""},
  {...report,nextAction:"a".repeat(201)},
  {...report,nextAction:["Change code"]},
  {...report,nextAction:"Execute command\nwithout approval"},
  {...report,workspaceId:"workspace-10"},
  {...report,qa:"PASS"},
 ])assert.equal(parseChatGoalInput("goal.report",invalid),null);
 let calls=0;
 const bridge=makeBridge(async()=>{calls++;return {state:"REVIEW_REQUIRED"};});
 const outcome=await bridge.call("goal.report",{
  ...report,nextAction:"Run\ncommands"},caller);
 assert.equal(outcome.structuredContent.code,"INVALID_INPUT");
 assert.equal(calls,0);
});


test("schema-valid bounded Unicode report fits the Codex review safety ceiling",()=>{
 const text="\u0800",scope=hostApproval();
 const report={receipt:token("a"),outcome:"CONTINUE",
  summary:text.repeat(600),nextAction:text.repeat(200),
  evidenceRefs:Array.from({length:8},()=>({kind:"DOCUMENT",ref:text.repeat(200)}))};
 assert.ok(parseChatGoalInput("goal.report",report));
 const brief=buildChatGoalCodexReviewBrief(report,scope);
 assert.ok(brief,"valid tool data should not fail later byte-limit checking");
 const bytes=Buffer.byteLength(JSON.stringify(brief),"utf8");
 assert.ok(bytes>4096,"the old ceiling rejected valid Unicode");
 assert.ok(bytes<=16*1024);
 assert.equal(brief.codexDispatchAuthorized,false);
 assert.equal(brief.nextPromptAllowed,false);
 assert.equal(brief.qa,"NOT_VERIFIED");
 assert.equal(JSON.stringify(brief).includes(report.receipt),false);
});

test("Unicode line separators cannot disguise a second Codex next action",()=>{
 const report={receipt:token("a"),outcome:"CONTINUE",
  summary:"Read the source",evidenceRefs:[]};
 for(const separator of ["\u0085","\u2028","\u2029"]){
  assert.equal(parseChatGoalInput("goal.report",{
   ...report,nextAction:"inspect"+separator+"execute",
  }),null);
  assert.equal(parseChatGoalInput("goal.report",{
   ...report,evidenceRefs:[{kind:"DOCUMENT",ref:"a"+separator+"b"}],
  }),null);
 }
});


const nativeGoalStatus = (approval=hostApproval(), overrides={}) => ({
  source:"NATIVE_CHAT_GOAL_READ_ONLY_STATUS",schemaVersion:1,
  workspaceId:approval.workspaceId,goalDigest:approval.goalDigest,
  conversationDigest:approval.conversationDigest,epoch:approval.epoch,
  codexState:"REVIEW_COMPLETE",qa:"NOT_VERIFIED",chatTurnVerified:false,
  nextPromptAllowed:false,codexDispatchAuthorized:false,sent:false,
  ...overrides,
});

test("goal.status has no model-controlled target or authorization fields",()=>{
  assert.deepEqual(parseChatGoalInput("goal.status",{}),{});
  for(const forged of [
    {workspaceId:"workspace-01"},{runId:"selected-run"},
    {goalDigest:"a".repeat(64)},{approved:true},{send:true},
    {maxResults:5},null,[],true,undefined,
  ])assert.equal(parseChatGoalInput("goal.status",forged),null);
});

test("goal.status obtains one sanitized native snapshot without widget or worker",async()=>{
  const calls=[];
  const bridge=makeBridge(async request=>{
    calls.push(request);
    return nativeGoalStatus();
  });
  const result=await bridge.call("goal.status",{},caller);
  assert.equal(calls.length,1);
  assert.equal(calls[0].tool,"goal.status");
  assert.deepEqual(calls[0].input,{});
  assert.equal(calls[0].admission.workspaceId,"workspace-01");
  assert.equal(result.structuredContent.source,"NATIVE_CHAT_GOAL_READ_ONLY_STATUS");
  assert.equal(result.structuredContent.codexState,"REVIEW_COMPLETE");
  assert.equal(result.structuredContent.blocker,"QA_NOT_VERIFIED");
  assert.equal(result.structuredContent.status,"REVIEW_REQUIRED");
  assert.equal(result.structuredContent.operatorReviewRequired,true);
  for(const key of [
    "chatTurnVerified","codexDispatchAuthorized","nextPromptAllowed","sent",
  ])assert.equal(result.structuredContent[key],false);
  assert.equal(result.structuredContent.qa,"NOT_VERIFIED");
  assert.equal(result._meta,undefined);
  for(const secret of [
    "a".repeat(64),"b".repeat(64),"c".repeat(64),
    principal.subjectId,principal.connectionId,principal.chatSessionHint,
  ])assert.ok(!JSON.stringify(result).includes(secret));
  assert.ok(!Object.hasOwn(calls[0],"codexBrief"));
});

test("goal.status rejects incorrect scope and false permissions fail closed",async()=>{
  const admission=hostApproval();
  const raw=nativeGoalStatus(admission);
  const expected=parseHostChatGoalStatus(raw,{
    workspaceId:admission.workspaceId,
    goalDigest:admission.goalDigest,
    conversationDigest:admission.conversationDigest,
    epoch:admission.epoch,chatBound:true,
  });
  assert.equal(expected.status,"REVIEW_REQUIRED");
  const denied=[
    {workspaceId:"workspace-02"},{workspaceId:["workspace-01"]},
    {goalDigest:"d".repeat(64)},{conversationDigest:"e".repeat(64)},
    {epoch:2},{epoch:[1]},{source:"MODEL_STATUS"},{schemaVersion:2},
    {codexState:"DONE"},{qa:"PASS"},{chatTurnVerified:true},
    {nextPromptAllowed:true},{codexDispatchAuthorized:true},{sent:true},
    {principalTag:"secret"},{claim:"a".repeat(48)},
  ];
  for(const changed of denied){
    let attempts=0;
    const bridge=makeBridge(async()=>{attempts++;return {...raw,...changed};});
    const response=await bridge.call("goal.status",{},caller);
    assert.equal(attempts,1);
    assert.equal(response.structuredContent.code,"STATUS_SNAPSHOT_INVALID",
      JSON.stringify(changed));
    assert.equal(response.structuredContent.status,"REVIEW_REQUIRED");
    assert.equal(response._meta,undefined);
  }
  assert.equal(parseHostChatGoalStatus(raw,{...admission,chatBound:false}),null);
  for(const state of [
    ["STOPPED","STOPPED","NATIVE_STOP"],
    ["DECLINED","STOPPED","NATIVE_STOP"],
    ["RECONCILE_REQUIRED","RECONCILE_REQUIRED","RECOVERY_REQUIRED"],
    ["RUNNING","REVIEW_REQUIRED","WORK_IN_PROGRESS"],
    ["PAUSED","REVIEW_REQUIRED","NATIVE_REVIEW_REQUIRED"],
  ]){
    const projected=parseHostChatGoalStatus(nativeGoalStatus(admission,{
      codexState:state[0]}),admission);
    assert.equal(projected?.status,state[1]);
    assert.equal(projected?.blocker,state[2]);
    assert.equal(projected?.nextPromptAllowed,false);
  }
});

test("goal.status does not bypass OAuth, binding, STOP or retry unknown reads",async()=>{
  let checks=0,attempts=0;
  const bridge=makeBridge(async()=>{
    attempts++;
    throw Error("native status transport temporarily unavailable");
  },async extra=>extra?.signedIn?principal:null,
  async({principal:p})=>{checks++;return hostApproval(p);});
  const notLoggedIn=await bridge.call("goal.status",{},{}); 
  assert.equal(notLoggedIn.structuredContent.code,"AUTHENTICATION_REQUIRED");
  assert.equal(checks,0);
  assert.equal(attempts,0);
  const unavailable=await bridge.call("goal.status",{},caller);
  assert.equal(unavailable.structuredContent.code,"STATUS_UNAVAILABLE");
  assert.equal(unavailable.structuredContent.status,"REVIEW_REQUIRED");
  assert.equal(attempts,1); // No blind retry.
  const stopped=makeBridge(async()=>{attempts++;return nativeGoalStatus();},
    async()=>principal,
    async()=>hostApproval(principal,{stopped:true}));
  const blocked=await stopped.call("goal.status",{},caller);
  assert.equal(blocked.structuredContent.code,"NATIVE_SCOPE_UNVERIFIED");
  const unbound=makeBridge(async()=>{attempts++;return nativeGoalStatus();},
    async()=>principal,
    async()=>hostApproval(principal,{chatBound:false}));
  assert.equal((await unbound.call("goal.status",{},caller))
    .structuredContent.code,"NATIVE_SCOPE_UNVERIFIED");
  assert.equal(attempts,1);
});
