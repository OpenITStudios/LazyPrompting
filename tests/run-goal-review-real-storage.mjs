import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {WorkspaceRegistry} from '../src/runtime/workspace-registry.mjs';
import {PromptOutbox} from '../src/prompt/prompt-outbox.mjs';
import {CheckpointStore} from '../src/supervisor/checkpoint-store.mjs';
import {createSchedulerFileLease} from '../src/prompt/scheduler-file-lease.mjs';
import {GoalReviewReconciliation} from '../src/prompt/goal-review-reconciliation.mjs';

// Real durable stores, but fake approved host and fake GitHub HEAD. No browser.
const BASE='a'.repeat(40),HEAD='b'.repeat(40),REPO='OpenITStudios/Example';
let checks=0;
const eq=(x,y,m)=>{assert.deepEqual(x,y,m);checks++};
async function fixture(fail=null){
 const dir=await mkdtemp(join(tmpdir(),'lp-real-store-'));
 const w='workspace-01',s='session-01',t='task-01',g='goal-01';
 const registry=new WorkspaceRegistry(join(dir,'registry.json'));
 const outbox=new PromptOutbox(join(dir,'outbox.json'));
 const store=new CheckpointStore(join(dir,'checkpoint.json'));
 eq((await registry.register(0,{workspaceId:w,sessionId:s,taskIds:[t],status:'READY',
  repository:REPO,branch:'Local',headSha:BASE,contextRevision:1})).ok,true,'real register');
 const r=await outbox.reserve({workspaceId:w,sessionId:s,taskId:t,
  contextRevision:1,prompt:'Inspect code',promptLimit:5});
 eq(r.reserved,true,'real reserve');
 eq((await outbox.ack({workspaceId:w,promptId:r.promptId,
  hostReceipt:{responseHandle:'handle-01'}})).acknowledged,true,'real ack');
 await store.initialize({version:0,goalId:g,goalHash:'goal-hash',
  phase:'READY',headSha:BASE,workspaceId:w,sessionId:s});
 eq((await store.apply({type:'RESERVE',goalId:g,expectedVersion:0,taskId:t})).ok,true,'reserve checkpoint');
 eq((await store.apply({type:'DISPATCH_ACK',goalId:g,expectedVersion:1,
  taskId:t,receiptId:'dispatch-01'})).ok,true,'ack checkpoint');
 let failOnce=fail,turns=0;
 const review={inspectUnderLease:async()=>{turns++;return {
  status:'REVIEWED',requiresDurableHostReconciliation:true,
  feedbackVerified:true,workerFeedbackHash:'c'.repeat(64),
  goalId:g,workspaceId:w,sessionId:s,taskId:t,promptId:r.promptId,
  responseHandle:'handle-01',responseId:'response-01',contextRevision:1,
  checkpointVersion:2,source:{repository:REPO,branch:'Local',baseSha:BASE,
   headSha:HEAD,qa:'PASS',acceptancePassed:false},
  decision:{state:'READY',reason:'AUTHORIZED_NEXT_ACTION'}}}};
 const wrap=(obj,method,stage)=>Object.assign(Object.create(obj),{
  [method]:async(...args)=>{const result=await obj[method](...args);
   if(failOnce===stage){failOnce=null;throw Error('SIMULATED_CRASH')}return result}
 });
 const make=()=>new GoalReviewReconciliation({review,
  registry:wrap(registry,'mutate','REGISTRY'),
  outbox:wrap(outbox,'reconcile','OUTBOX'),
  checkpointStore:wrap(store,'apply','CHECKPOINT'),
  withLease:createSchedulerFileLease(join(dir,'scheduler.lease')),
  readHead:async()=>({repository:REPO,branch:'Local',headSha:HEAD}),
  authorize:async x=>({...x,trusted:true,source:'NATIVE_HOST'})});
 return {dir,w,make,registry,outbox,store,get turns(){return turns},
  cleanup:()=>rm(dir,{recursive:true,force:true})};
}
for(const fail of [null,'REGISTRY','OUTBOX','CHECKPOINT']){
 const f=await fixture(fail);try{
  const x=await f.make().apply({workspaceId:f.w});
  eq(x.status,fail?'RECONCILE_REQUIRED':'RECONCILED','review outcome');
  eq(x.nextPromptAllowed,false,'never enables send');
  const resumed=await f.make().recover({workspaceId:f.w});
  eq(resumed.status,fail?'RECONCILED':'ALREADY_RECONCILED','restart identity');
  const cp=await f.store.read(),w=(await f.registry.read()).workspaces[0],
   item=(await f.outbox.read()).items[0];
  eq(cp.phase,'READY','checkpoint ready');
  eq(cp.headSha,HEAD,'checkpoint HEAD');
  eq(w.headSha,HEAD,'workspace HEAD');
  eq(cp.lastReview.reviewId,w.lastGoalReviewId,'exact review receipt');
  eq(cp.lastReview.workerFeedbackHash,'c'.repeat(64),'worker provenance');
  eq(item.state,'RESPONSE_VERIFIED','outbox released');
  eq(item.responseId,'response-01','response ID');
  eq((await f.outbox.pending(f.w)).length,0,'no duplicate pending');
  eq(f.turns,1,'no duplicate review');
 }finally{await f.cleanup()}
}
console.log('Real storage goal review: PASS ('+checks+' assertions; synthetic host/HEAD)');
