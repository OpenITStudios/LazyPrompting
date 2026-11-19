import assert from "node:assert/strict";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {PromptOutbox} from "../src/prompt/prompt-outbox.mjs";
import {assertCodexTaskOutboxScope,assessIndependentGoalChatScopes} from "../src/transport/goal-outbox-scope.mjs";
import {runReadOnlyGoal} from "../src/transport/goal-codex-runner.mjs";
import {fingerprintGoalRunScope} from "../src/transport/goal-run-scope.mjs";

test("resume reads the exact acknowledged turn and holds an unacknowledged sibling", async t=>{
 const cwd=await mkdtemp(join(tmpdir(),"lp-goal-recovery-"));
 t.after(()=>rm(cwd,{recursive:true,force:true}));
 const baseSha="a".repeat(40);
 const deadline=Date.now()+90_000;
 const tasks=["known","uncertain"].map((criterion,i)=>({
  id:`task-${i+1}`,criterion,threadId:`thread-${i+1}`,state:"RUNNING",turns:[]
 }));
 const dataDir=join(cwd,"run");
 const receipts=[];
 for(const task of tasks){
  const box=new PromptOutbox(join(dataDir,task.id+".json"));
  const entry=await box.reserve({workspaceId:task.id,sessionId:task.threadId,
   taskId:task.id+"-turn-1",contextRevision:0,prompt:"initial",promptLimit:2,singleDispatchPerTask:true});
  receipts.push(entry.promptId);
 }
 const known=new PromptOutbox(join(dataDir,"task-1.json"));
 await known.ack({workspaceId:"task-1",promptId:receipts[0],hostReceipt:{responseHandle:"turn-original"}});
 const reportPath=join(dataDir,"report.json");
 const execution={executable:join(cwd,"codex"),cwd,dataDir,
   objective:"Review both tasks",acceptance:["known","uncertain"],baseSha,
   limits:{maxActiveTasks:2,maxTurnsPerTask:2,wallMinutes:30},stopFile:join(cwd,"stop")};
 const scopeFingerprint=fingerprintGoalRunScope(execution);
 await writeFile(reportPath,JSON.stringify({baseSha,deadline,mode:"READ_ONLY",
   scopeFingerprintVersion:1,scopeFingerprint,state:"RUNNING",revision:3,tasks}));
 const dispatched=[];
 let last="turn-original";
 const server={
  async initialize(){},
  async close(){},
  async startThread(){assert.fail("unexpected replacement thread");},
  async ensureThread(thread){assert.equal(thread,"thread-1");},
  async startTurn(thread,prompt){dispatched.push({thread,prompt});last="turn-follow-up";return {turn:{id:last}};},
  async listRecentTurns(thread,limit){
   assert.equal(thread,"thread-1");
   assert.equal(limit,20);
   return {data:[{id:"nested-turn",status:"completed"},{id:last,status:"completed"}]};
  },
  async listRecentTurnItems(thread,turn){
   assert.equal(thread,"thread-1");
   return {data:[{turnId:turn,item:{type:"agentMessage",text:"result for "+turn}}]};
  }
 };
 const report=await runReadOnlyGoal({...execution,resume:true,hostEpoch:"replacement-host"},
   {newServer:()=>server,resolveOptions:async()=>[]});
 assert.equal(report.state,"NEEDS_ATTENTION");
 assert.equal(report.deadline,deadline);
 assert.equal(report.hostEpoch,"replacement-host");
 assert.equal(report.tasks[0].state,"REVIEWED");
 assert.deepEqual(report.tasks[0].turns.map(turn=>turn.turnId),["turn-original","turn-follow-up"]);
 assert.equal(report.tasks[1].state,"RECONCILE_REQUIRED");
 assert.equal(dispatched.length,1);
 assert.match(dispatched[0].prompt,/Continue the same read-only goal/);
 const saved=JSON.parse(await readFile(reportPath,"utf8"));
 assert.ok(saved.revision>3);
 assert.equal((await known.read()).items.length,2);
});

test("a rejected turn read keeps the goal task polling instead of failing it", async t=>{
 const cwd=await mkdtemp(join(tmpdir(),"lp-goal-transport-"));
 t.after(()=>rm(cwd,{recursive:true,force:true}));
 const baseSha="b".repeat(40);
 const dataDir=join(cwd,"run");
 let reads=0;
 const server={
  async initialize(){},
  async close(){},
  async startThread(){return {thread:{id:"thread-1"}}},
  async ensureThread(){},
  async startTurn(){return {turn:{id:"turn-1"}}},
  async listRecentTurns(){
   reads++;
   if(reads===1) throw new Error("CODEX_RPC_REJECTED");
   return {data:[{id:"turn-1",status:"completed"}]};
  },
  async listRecentTurnItems(thread,turn){
   return {data:[{turnId:turn,item:{type:"agentMessage",text:"observed result"}}]};
  }
 };
 const report=await runReadOnlyGoal({
  executable:join(cwd,"codex"),cwd,dataDir,objective:"Review the repository",
  acceptance:["report the marker"],baseSha,limits:{maxActiveTasks:1,maxTurnsPerTask:1,wallMinutes:1},
  stopFile:join(cwd,"stop")
 },{newServer:()=>server,resolveOptions:async()=>[]});
 assert.ok(reads>=2);
 assert.equal(report.tasks[0].state,"REVIEWED");
 assert.equal(report.tasks[0].turns[0].turnId,"turn-1");
 assert.equal(report.state,"REVIEW_COMPLETE");
});

test("Codex task outboxes cannot authorize ordinary ChatGPT workspace actions",()=>{
 const taskId="task-1",workspaceId="workspace-01";
 const clean={schemaVersion:1,items:[]};
 assert.deepEqual(assertCodexTaskOutboxScope({state:clean,taskId}),{
  kind:"CODEX_TASK",taskId,chatWorkspaceBound:false,
  nextChatPromptAllowed:false
 });
 const cross=assessIndependentGoalChatScopes({taskId,workspaceId});
 assert.equal(cross.valid,true);
 assert.equal(cross.separateActors,true);
 assert.equal(cross.chatBindingVerified,false);
 assert.equal(cross.canSendToConsumerChat,false);
 for(const wrong of ["task-0","task-9","workspace-01","../task-1"])
  assert.throws(()=>assertCodexTaskOutboxScope({
   state:clean,taskId:wrong
  }),/GOAL_TASK_OUTBOX_SCOPE_INVALID/);
 assert.equal(assessIndependentGoalChatScopes({
  taskId,workspaceId:"task-1"
 }).valid,false);
 assert.throws(()=>assertCodexTaskOutboxScope({
  state:{schemaVersion:1,items:[{workspaceId}]},taskId
 }),/GOAL_TASK_OUTBOX_SCOPE_MISMATCH/);
 for(const foreign of [
  {browserActions:[{workspaceId,state:"VERIFIED"}]},
  {operatorChatAttempts:[{workspaceId,state:"REVIEWED_UNVERIFIED"}]}
 ])assert.throws(()=>assertCodexTaskOutboxScope({
  state:{schemaVersion:1,items:[],...foreign},taskId
 }),/GOAL_TASK_OUTBOX_CROSS_SURFACE_CONTAMINATION/);
});


for(const fixture of [
 {label:"complete",control:null,turns:1,state:"NEEDS_ATTENTION",task:"REVIEWED"},
 {label:"stop",control:"stop",turns:2,state:"STOPPED",task:"STOPPED"},
 {label:"pause",control:"pause",turns:2,state:"NEEDS_ATTENTION",task:"PAUSED"},
 {label:"late-stop",control:"late-stop",turns:1,state:"STOPPED",task:"REVIEWED"}
]){
 test("failed Codex teardown preserves STOP and a durable attention report: "+fixture.label,async t=>{
  const cwd=await mkdtemp(join(tmpdir(),"lp-close-"+fixture.label+"-"));
  t.after(()=>rm(cwd,{recursive:true,force:true}));
  const stopFile=join(cwd,"STOP"),dataDir=join(cwd,"run");
  let starts=0;
  const execution={executable:join(cwd,"codex"),cwd,dataDir,stopFile,
   objective:"Read-only lifecycle",acceptance:["One known response"],
   baseSha:"c".repeat(40),
   limits:{maxActiveTasks:1,maxTurnsPerTask:fixture.turns,wallMinutes:1}};
  const server={
   async initialize(){},
   async close(){
    if(fixture.control==="late-stop")await writeFile(stopFile,"stopped");
    throw Error("SYNTHETIC_CLOSE_FAILED");
   },
   async startThread(){return {thread:{id:"thread-1"}};},
   async ensureThread(threadId){assert.equal(threadId,"thread-1");},
   async startTurn(){starts++;return {turn:{id:"turn-"+starts}};},
   async listRecentTurns(){return {data:[{id:"turn-1",status:"completed"}]};},
   async listRecentTurnItems(){
    if(fixture.control && fixture.control!=="late-stop")
     await writeFile(stopFile+(fixture.control==="pause"?".pause":""),fixture.control);
    return {data:[{turnId:"turn-1",item:{type:"agentMessage",text:"Read-only finding"}}]};
   }
  };
  const report=await runReadOnlyGoal(execution,{
   resolveOptions:async()=>[],newServer:()=>server});
  const stored=JSON.parse(await readFile(join(dataDir,"report.json"),"utf8"));
  assert.equal(report.state,fixture.state);
  assert.equal(stored.state,fixture.state);
  assert.equal(stored.reason,"GOAL_SERVER_CLOSE_UNCONFIRMED");
  assert.equal(stored.tasks[0].state,fixture.task);
  assert.equal(stored.revision,report.revision);
  assert.equal(starts,1,"cleanup never dispatches another turn");
  const box=new PromptOutbox(join(dataDir,"task-1.json"));
  const outbox=await box.read();
  assert.equal(outbox.items.length,1);
  assert.equal(outbox.items[0].responseHandle,"turn-1");
  assert.equal(outbox.items[0].responseId,"turn-1");
  assert.deepEqual(await box.pending("task-1"),[]);
  const frozen=await readFile(join(dataDir,"report.json"),"utf8");
  let newWorker=false;
  const restart=runReadOnlyGoal({...execution,resume:true,hostEpoch:"retry-host"},{
   resolveOptions:async()=>{newWorker=true;return []},
   newServer:()=>{newWorker=true;throw Error("REPLAY_FORBIDDEN");}
  });
  if(fixture.state==="STOPPED") {
   await assert.rejects(()=>restart,/GOAL_ALREADY_TERMINAL/);
  } else {
   await assert.rejects(()=>restart,/GOAL_CLOSE_RECONCILE_REQUIRED/);
  }
  assert.equal(newWorker,false,"unconfirmed close cannot start another worker");
  assert.equal(await readFile(join(dataDir,"report.json"),"utf8"),frozen);
  assert.deepEqual(await box.read(),outbox);
  assert.deepEqual(await box.pending("task-1"),[]);
 });
}
