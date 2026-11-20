import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {handleNativeWorkspaceGoal} from "../src/prompt/native-workspace-goal.mjs";
import {PromptOutbox} from "../src/prompt/prompt-outbox.mjs";
import {CapabilityRouter} from "../src/gateway/capability-router.mjs";

const sha="a".repeat(40);
const proposal=(workspaceId="workspace-01")=>({
 workspaceId,repository:"OpenITStudios/Example",branch:"Local",
 baseSha:sha,objective:"Improve browser efficiency with bounded evidence.",
 acceptance:["Compare resource metrics without regressing browser controls."],
 constraints:["Preserve native STOP."],nonGoals:[],
 preserve:["Keep existing ChatGPT conversation identity."],
 allowedActions:["Inspect source"],
 limits:{maxIterations:6,maxMinutes:120,maxModelTokens:12000}
});
const approval=contract=>({
 source:"NATIVE_HOST",trusted:true,operatorApproved:true,
 operation:"APPROVE_GOAL",goalId:contract.goalId,
 workspaceId:contract.workspaceId,goalHash:contract.goalHash,
 revision:contract.revision,repository:contract.repository,
 branch:contract.branch,baseSha:contract.baseSha
});
const call=(action,dataDir,payload)=>
 handleNativeWorkspaceGoal({action,dataDir,payload});

test("native-private goal is operator reviewed, durable and never dispatched",async t=>{
 const root=await mkdtemp(join(tmpdir(),"lp-native-goal-"));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const empty=await call("status",root,{workspaceId:"workspace-01"});
 assert.equal(empty.phase,"UNINITIALIZED");
 assert.equal(empty.goalId,null);
 assert.equal(empty.nextPromptAllowed,false);
 const prepared=await call("preview",root,{
  goalId:"goal-01",request:proposal()
 });
 assert.equal(prepared.source,"NATIVE_WORKSPACE_GOAL_PREVIEW");
 const contract=prepared.contract;
 assert.equal(contract.goalId,"goal-01");
 assert.equal(contract.revision,1);
 assert.equal(contract.goalHash.length,64);
 assert.equal((await call("status",root,{workspaceId:"workspace-01"})).phase,
  "UNINITIALIZED","preview is read-only");
 await assert.rejects(()=>call("commit",root,{
  contract,approval:{...approval(contract),source:"MODEL"}
 }),/NATIVE_GOAL_APPROVAL_REQUIRED/);
 await assert.rejects(()=>call("commit",root,{
  contract,approval:{...approval(contract),goalHash:"f".repeat(64)}
 }),/NATIVE_GOAL_APPROVAL_REQUIRED/);
 const stored=await call("commit",root,{contract,approval:approval(contract)});
 assert.equal(stored.phase,"PAUSED");
 assert.equal(stored.chatState,"UNBOUND");
 assert.equal(stored.operatorApproved,true);
 assert.equal(stored.sourceVerified,false);
 assert.equal(stored.chatTurnVerified,false);
 assert.equal(stored.nextPromptAllowed,false);
 assert.equal(stored.qa,"NOT_EXECUTED");
 assert.deepEqual(await call("status",root,{workspaceId:"workspace-01"}),stored,
  "restart-style read uses the same canonical checkpoint");
 const duplicate=await call("preview",root,{goalId:"goal-02",request:proposal()});
 assert.equal(duplicate.reason,"GOAL_ALREADY_EXISTS");
 await assert.rejects(()=>call("commit",root,{contract,approval:approval(contract)}),
  /ALREADY_INITIALIZED/);
 assert.equal((await call("status",root,{workspaceId:"workspace-02"})).phase,
  "UNINITIALIZED","second workspace cannot read first goal");
 for(const wrong of [
  {action:"status",dataDir:root,payload:{workspaceId:"workspace-11"}},
  {action:"preview",dataDir:root,payload:{goalId:"bad",request:{...proposal(),approved:true}}},
  {action:"commit",dataDir:root,payload:{contract:{...contract,objective:"changed"},
   approval:approval(contract)}}
 ])await assert.rejects(()=>handleNativeWorkspaceGoal(wrong));
});

test("unsettled outbox effect blocks checkpoint approval before any send",async t=>{
 const root=await mkdtemp(join(tmpdir(),"lp-native-goal-hold-"));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const outbox=new PromptOutbox(join(root,"outbox.json"));
 const pending=await outbox.reserve({workspaceId:"workspace-03",
  sessionId:"session-03",taskId:"task-03",contextRevision:0,
  prompt:"Synthetic pending intent; not sent",promptLimit:3});
 assert.equal(pending.reserved,true);
 const preview=await call("preview",root,{
  goalId:"goal-03",request:proposal("workspace-03")});
 // A preview may display an unchanged proposal, but no approval can commit.
 if(preview.contract) {
  const value=await call("commit",root,{
   contract:preview.contract,approval:approval(preview.contract)});
  assert.equal(value.reason,"GOAL_OUTBOX_NOT_QUIESCENT");
 }else{
  assert.equal(preview.reason,"GOAL_OUTBOX_NOT_QUIESCENT");
 }
 assert.equal((await call("status",root,{workspaceId:"workspace-03"})).phase,
  "UNINITIALIZED");
});

test("Code Mode combines native-scoped goal health with a pure status read",async()=>{
 const root=await mkdtemp(join(tmpdir(),"lp-native-goal-code-mode-"));
 try{
  const preview=await call("preview",root,{
   goalId:"goal-05",request:proposal("workspace-05")});
  const status=await call("commit",root,{
   contract:preview.contract,approval:approval(preview.contract)});
  const gateway=new CapabilityRouter();
  try{
   const code=[
    "const g=await tools.workspace_goal.status();",
    "const s=await tools.supervisor.status();",
    "return {phase:g.phase,revision:g.goalRevision,",
    "review:g.requiresReconciliation,qa:g.qa,",
    "next:g.nextPromptAllowed,backend:s.gateway};"
   ].join("\n");
   const result=await gateway.executeNativeCode(code,
    null,null,null,null,null,null,null,null,null,null,status);
   assert.equal(result.status,"OK",JSON.stringify(result));
   assert.equal(result.structuredContent.toolCalls,2);
   const individual=(await gateway.invoke("supervisor.status",{})).structuredContent;
   assert.deepEqual(result.structuredContent.value,{
    phase:"PAUSED",revision:1,review:false,qa:"NOT_EXECUTED",
    next:false,backend:individual.gateway
   });
   // This is only a source-fixture round-trip comparison, not a token claim.
   const outerRoundTrips={separate:2,composed:1};
   assert.equal(outerRoundTrips.separate-outerRoundTrips.composed,1);
   assert.equal((await gateway.invoke("code_mode.execute",{code})).code,
    "CODE_MODE_CAPABILITY_DENIED");
   const forged=await gateway.executeNativeCode(code,
    null,null,null,null,null,null,null,null,null,null,
    {...status,nextPromptAllowed:true});
   assert.equal(forged.code,"CODE_MODE_WORKSPACE_GOAL_INVALID");
   const wrong=await gateway.executeNativeCode(code,
    null,null,null,null,null,null,null,null,null,null,
    {...status,workspaceId:"workspace-11"});
   assert.equal(wrong.code,"CODE_MODE_WORKSPACE_GOAL_INVALID");
  }finally{await gateway.close();}
 }finally{await rm(root,{recursive:true,force:true});}
});
