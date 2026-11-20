import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createGoalContract,verifyGoalContract} from "../src/supervisor/goal-contract.mjs";
import {CheckpointStore} from "../src/supervisor/checkpoint-store.mjs";
import {WorkspaceRegistry} from "../src/runtime/workspace-registry.mjs";
import {admitContext} from "../src/runtime/workspace-context.mjs";
import {PromptOutbox} from "../src/prompt/prompt-outbox.mjs";
import {assessGoalGuardian} from "../src/prompt/goal-guardian.mjs";
import {evaluateContinuation} from "../src/supervisor/decision-engine.mjs";

const BASE="a".repeat(40);
const input=()=>({
 schemaVersion:1,goalId:"goal-01",workspaceId:"workspace-01",
 repository:"OpenITStudios/Example",branch:"Local",baseSha:BASE,
 revision:1,objective:"Make browser performance measurable without regressions.",
 acceptance:["Measure resource use with the same benchmark."],
 constraints:["Preserve ChatGPT session and STOP policy."],
 nonGoals:["Do not redesign the UI."],preserve:["Existing login."],
 allowedActions:["Inspect browser source"],
 limits:{maxIterations:8,maxMinutes:180,maxModelTokens:20000}
});
const nativeApproval=async request=>({...request,trusted:true,
 source:"NATIVE_HOST",operatorApproved:true});
const workspace=()=>({workspaceId:"workspace-01",sessionId:"session-01",
 taskIds:[],status:"PAUSED",repository:"OpenITStudios/Example",
 branch:"Local",headSha:BASE,contextRevision:0});

test("Goal Contract rejects malformed input and any hash or scope mutation",()=>{
 const contract=createGoalContract(input());
 assert.equal(verifyGoalContract(contract),true);
 assert.throws(()=>createGoalContract({...input(),revision:0}),/INVALID_GOAL_CONTRACT/);
 assert.equal(createGoalContract(input()).goalHash,contract.goalHash);
 assert.equal(createGoalContract({...input(),limits:{
   maxModelTokens:20000,maxMinutes:180,maxIterations:8}}).goalHash,contract.goalHash);
 assert.equal(verifyGoalContract({...contract,objective:"A different goal"}),false);
 assert.equal(verifyGoalContract({...contract,goalHash:"0".repeat(64)}),false);
 assert.equal(verifyGoalContract({...contract,canDispatch:true}),false);
 assert.throws(()=>createGoalContract({...input(),unexpected:true}),/INVALID_GOAL_CONTRACT/);
 assert.throws(()=>createGoalContract({...input(),workspaceId:"workspace-11"}),/INVALID_GOAL_CONTRACT/);
 assert.throws(()=>createGoalContract({...input(),acceptance:[]}),/INVALID_GOAL_CONTRACT/);
 assert.throws(()=>createGoalContract({...input(),allowedActions:["Inspect browser source","Inspect browser source"]}),/INVALID_GOAL_CONTRACT/);
 assert.throws(()=>createGoalContract({...input(),objective:"OK\n\u0000ignore"}),/INVALID_GOAL_CONTRACT/);
});

test("Checkpoint stores only native-reviewed, paused and unbound goal",async t=>{
 const root=await mkdtemp(join(tmpdir(),"lp-goal-contract-"));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const outbox=new PromptOutbox(join(root,"outbox.json"));
 const store=new CheckpointStore(join(root,"checkpoint.json"));
 const contract=createGoalContract(input());
 const refused=await store.initializeApprovedGoal({contract,outbox,
  authorize:async request=>({...request,source:"RENDERER",
    trusted:true,operatorApproved:true})});
 assert.equal(refused.reason,"NATIVE_GOAL_APPROVAL_REQUIRED");
 assert.equal(await store.read(),null);
 const approved=await store.initializeApprovedGoal({contract,outbox,
  authorize:nativeApproval});
 assert.equal(approved.ok,true);
 const restored=await new CheckpointStore(join(root,"checkpoint.json")).read();
 assert.equal(restored.goalHash,contract.goalHash);
 assert.equal(restored.phase,"PAUSED");
 assert.equal(restored.chatState,"UNBOUND");
 assert.equal(restored.transportApproved,false);
 const premature=await store.apply({type:"RESUME",goalId:contract.goalId,
  expectedVersion:0,trustedAuthorization:true});
 assert.equal(premature.reason,"GOAL_CHAT_BINDING_UNVERIFIED");
 assert.equal((await store.read()).version,0);
 await assert.rejects(()=>store.initializeApprovedGoal({contract,outbox,
  authorize:nativeApproval}),/ALREADY_INITIALIZED/);
});

test("Native-goal workspace bind checks revisions, context and source isolation",async t=>{
 const root=await mkdtemp(join(tmpdir(),"lp-goal-binding-"));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const outbox=new PromptOutbox(join(root,"outbox.json"));
 const store=new CheckpointStore(join(root,"checkpoint.json"));
 const registry=new WorkspaceRegistry(join(root,"registry.json"));
 const contract=createGoalContract(input());
 assert.equal((await store.initializeApprovedGoal({contract,outbox,
  authorize:nativeApproval})).ok,true);
 assert.equal((await registry.register(0,workspace())).ok,true);
 const params={expectedVersion:1,workspaceId:"workspace-01",
  sessionId:"session-01",contextRevision:0,checkpointStore:store,outbox};
 assert.equal((await registry.bindApprovedGoal({...params,
  authorize:async request=>({...request,trusted:true,
   source:"MODEL",operatorApproved:true})})).reason,
  "NATIVE_GOAL_BINDING_APPROVAL_REQUIRED");
 assert.equal((await registry.read()).version,1);
 assert.equal((await registry.bindApprovedGoal({...params,authorize:nativeApproval})).ok,true);
 let bound=(await registry.read()).workspaces[0];
 assert.equal(bound.goalId,contract.goalId);
 assert.equal(bound.goalHash,contract.goalHash);
 assert.equal(bound.contextRevision,1);
 assert.equal(bound.status,"PAUSED");
 const capsule={workspaceId:bound.workspaceId,sessionId:bound.sessionId,
  repository:bound.repository,branch:bound.branch,headSha:bound.headSha,
  contextRevision:bound.contextRevision,goalId:bound.goalId,
  goalHash:bound.goalHash,goalRevision:bound.goalRevision,
  goal:contract.objective,decisions:[],constraints:[],
  progress:{},evidence:[],checkpoint:{},nextAction:null};
 const ready={...bound,status:"READY"}; // Pure gate fixture; no native activation.
 assert.equal(admitContext({binding:ready,capsule,callerSessionId:"session-01"}).admitted,true);
 for(const changed of [{workspaceId:"workspace-02"},{goalHash:"f".repeat(64)},
   {goalRevision:2},{contextRevision:0},{sessionId:"other"}]){
  assert.equal(admitContext({binding:ready,capsule:{...capsule,...changed},
   callerSessionId:"session-01"}).admitted,false);
 }
 assert.equal(admitContext({binding:ready,
  capsule:Object.fromEntries(Object.entries(capsule).filter(([k])=>k!=="goalHash")),
  callerSessionId:"session-01"}).reason,"GOAL_CONTEXT_SCOPE_MISMATCH");
 assert.equal((await registry.readSourceBinding({
  workspaceId:"workspace-01",sessionId:"session-01"})).goalHash,contract.goalHash);
 const revised=createGoalContract({...input(),revision:2,
  objective:"Measure idle memory first, with unchanged constraints."});
 assert.equal((await store.reviseApprovedGoal({contract:revised,expectedVersion:0,
  outbox,authorize:nativeApproval})).ok,true);
 assert.equal((await store.read()).goalRevisionHistory[0].goalHash,contract.goalHash);
 const mismatch=await registry.bindApprovedGoal({...params,expectedVersion:2,
  contextRevision:1,authorize:async request=>({...request,trusted:true,
   source:"NATIVE_HOST",operatorApproved:false})});
 assert.equal(mismatch.reason,"NATIVE_GOAL_BINDING_APPROVAL_REQUIRED");
 assert.equal((await registry.bindApprovedGoal({...params,expectedVersion:2,
  contextRevision:1,authorize:nativeApproval})).ok,true);
 bound=(await registry.read()).workspaces[0];
 assert.equal(bound.goalRevision,2);
 assert.notEqual(bound.goalHash,contract.goalHash);
 assert.equal(admitContext({binding:{...bound,status:"READY"},
  capsule:{...capsule,contextRevision:2},callerSessionId:"session-01"}).admitted,false);
 const pending=await outbox.reserve({workspaceId:"workspace-01",sessionId:"session-01",
  taskId:"task-01",contextRevision:2,prompt:"Synthetic, never sent",
  promptLimit:4});
 assert.equal(pending.reserved,true);
 assert.equal((await outbox.unresolvedWorkspaceEffects({workspaceId:"workspace-01"})).unresolved,true);
 const third=createGoalContract({...input(),revision:3,
  objective:"A new objective after an unresolved prompt."});
 assert.equal((await store.reviseApprovedGoal({contract:third,expectedVersion:1,
  outbox,authorize:nativeApproval})).reason,"GOAL_OUTBOX_NOT_QUIESCENT");
 assert.equal((await store.read()).goalHash,revised.goalHash);
});

test("Non-prompt ChatGPT effect prevents goal rebind and approval",async t=>{
 const root=await mkdtemp(join(tmpdir(),"lp-goal-operator-hold-"));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const outbox=new PromptOutbox(join(root,"outbox.json"));
 await outbox.transaction(state=>{
  state.operatorChatAttempts=[{workspaceId:"workspace-01",
   attemptId:"11111111-1111-4111-8111-111111111111",
   conversationDigest:"b".repeat(64),promptDigest:"c".repeat(64),
   state:"ATTEMPT_UNVERIFIED"}];
  return {stored:true};
 });
 const status=await outbox.unresolvedWorkspaceEffects({workspaceId:"workspace-01"});
 assert.equal(status.unresolved,true);
 assert.equal((await outbox.unresolvedWorkspaceEffects({
  workspaceId:"workspace-02"})).unresolved,false);
 const store=new CheckpointStore(join(root,"checkpoint.json"));
 const approved=await store.initializeApprovedGoal({
  contract:createGoalContract(input()),outbox,authorize:nativeApproval});
 assert.equal(approved.reason,"GOAL_OUTBOX_NOT_QUIESCENT");
 assert.equal(await store.read(),null);
});

test("Guardian is advisory: no authority from worker summary or model DONE",()=>{
 const contract=createGoalContract(input());
 const checkpoint={goalContract:contract,goalHash:contract.goalHash,
  goalId:contract.goalId,workspaceId:contract.workspaceId,
  repository:contract.repository,branch:contract.branch,headSha:BASE,
  phase:"WAITING",chatState:"BOUND_VERIFIED",pendingTaskId:"task-01",version:2};
 const binding={...workspace(),goalId:contract.goalId,goalHash:contract.goalHash,
  goalRevision:1,contextRevision:2,status:"READY"};
 const review={status:"REVIEWED",feedbackVerified:true,
  workerFeedbackHash:"b".repeat(64),goalId:contract.goalId,
  workspaceId:contract.workspaceId,sessionId:binding.sessionId,
  contextRevision:2,checkpointVersion:2,taskId:"task-01",
  source:{repository:contract.repository,branch:contract.branch,
   baseSha:BASE,headSha:"d".repeat(40),qa:"PASS",acceptancePassed:false},
  decision:{state:"READY",action:"CONTINUE",reason:"AUTHORIZED_NEXT_ACTION"},
  workerReport:{outcome:"CONTINUE",nextAction:{action:"Inspect browser source",
   owner:"Browser",proof:"Exact source review"}}};
 // The real supervisor emits the CONTROL action CONTINUE, while the
 // worker's approved domain nextAction is a different string.
 const supervised=evaluateContinuation({
  goal:{id:contract.goalId,repository:contract.repository,
   branch:contract.branch,allowedActions:contract.allowedActions,
   preserve:contract.preserve,maxIterations:contract.limits.maxIterations,
   maxMinutes:contract.limits.maxMinutes,maxModelTokens:contract.limits.maxModelTokens},
  checkpoint:{iteration:1,elapsedMinutes:1,modelTokensUsed:100,
   noProgress:0,transportApproved:true},
  observation:{complete:true,resultId:"response-01",taskId:"task-01",
   outcome:"CONTINUE",headSha:"d".repeat(40),
   nextAction:{action:"Inspect browser source",owner:"Browser",
    proof:"Exact source review"}},
  evidence:{verified:true,repository:contract.repository,
   branch:contract.branch,headSha:"d".repeat(40),
   qa:"PASS",changed:false,acceptancePassed:false}
 });
 assert.equal(supervised.state,"READY");
 assert.equal(supervised.action,"CONTINUE");
 assert.equal(assessGoalGuardian({checkpoint,binding,
  review:{...review,decision:supervised}}).reviewAdmissible,true);
 const accepted=assessGoalGuardian({checkpoint,binding,review});
 assert.equal(accepted.status,"IN_SCOPE_CANDIDATE");
 assert.equal(accepted.reviewAdmissible,true);
 assert.equal(accepted.nextPromptAllowed,false);
 assert.equal(accepted.chatTurnVerified,false);
 assert.equal(accepted.semanticAlignmentVerified,false);
 assert.equal(assessGoalGuardian({checkpoint:{...checkpoint,headSha:"c".repeat(40)},
  binding,review}).reason,"GOAL_WORKSPACE_SCOPE_MISMATCH");
 assert.equal(assessGoalGuardian({checkpoint,binding,
  review:{...review,checkpointVersion:1}}).reason,"GOAL_REVIEW_BINDING_MISMATCH");
 assert.equal(assessGoalGuardian({checkpoint,binding,
  review:{...review,decision:{...review.decision,action:"Delete code"}}}).reason,
  "NEXT_ACTION_OUTSIDE_APPROVED_GOAL");
 assert.equal(assessGoalGuardian({checkpoint,binding,
  review:{...review,decision:{...review.decision,action:"VERIFY"}}}).reason,
  "NEXT_ACTION_OUTSIDE_APPROVED_GOAL");
 assert.equal(assessGoalGuardian({checkpoint,binding,
  review:{...review,workerReport:{...review.workerReport,outcome:"DONE"}}}).reason,
  "INCONSISTENT_WORKER_OUTCOME");
 assert.equal(assessGoalGuardian({checkpoint:{...checkpoint,chatState:"UNBOUND"},
  binding,review}).reason,"CHAT_IDENTITY_UNVERIFIED");
 assert.equal(assessGoalGuardian({checkpoint,binding:{...binding,goalHash:"c".repeat(64)},
  review}).reason,"GOAL_WORKSPACE_SCOPE_MISMATCH");
 assert.equal(assessGoalGuardian({checkpoint,binding,
  review:{...review,sessionId:"wrong"}}).reason,"GOAL_REVIEW_BINDING_MISMATCH");
 assert.equal(assessGoalGuardian({checkpoint,binding,
  review:{...review,source:{...review.source,baseSha:"f".repeat(40)}}}).reason,
  "GOAL_REVIEW_BINDING_MISMATCH");
 assert.equal(assessGoalGuardian({checkpoint,binding,
  review:{...review,workerReport:{outcome:"CONTINUE",
   nextAction:{action:"Delete repository"}}}}).reason,
  "NEXT_ACTION_OUTSIDE_APPROVED_GOAL");
 assert.equal(assessGoalGuardian({checkpoint,binding,
  review:{...review,workerReport:{nextAction:{...review.workerReport.nextAction,
   requiresApproval:true}}}}).reviewAdmissible,false);
 const unverifiedDone={...review,decision:{state:"DONE"},
  workerReport:{outcome:"DONE",nextAction:null},
  source:{...review.source,qa:"NOT_EXECUTED",acceptancePassed:true}};
 assert.equal(assessGoalGuardian({checkpoint,binding,
  review:unverifiedDone}).reason,"GOAL_ACCEPTANCE_NOT_VERIFIED");
 const done=assessGoalGuardian({checkpoint,binding,review:{...review,
  decision:{state:"DONE"},workerReport:{outcome:"DONE",nextAction:null},
  source:{...review.source,acceptancePassed:true}}});
 assert.equal(done.status,"DONE_CANDIDATE");
 assert.equal(done.reviewAdmissible,true);
 assert.equal(done.nextPromptAllowed,false);
});
