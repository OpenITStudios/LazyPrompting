import assert from "node:assert/strict";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {PromptOutbox} from "../src/prompt/prompt-outbox.mjs";
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
