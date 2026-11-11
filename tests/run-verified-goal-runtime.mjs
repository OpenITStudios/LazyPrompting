import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createVerifiedGoalRuntime} from '../src/prompt/verified-goal-runtime.mjs';
import {WorkspaceRegistry} from '../src/runtime/workspace-registry.mjs';
import {PromptOutbox} from '../src/prompt/prompt-outbox.mjs';
import {CheckpointStore} from '../src/supervisor/checkpoint-store.mjs';

// Full source composition over actual durable owners. External host, source
// and QA evidence are synthetic; no ChatGPT and no network requests.
const BASE='a'.repeat(40),HEAD='b'.repeat(40),REPO='OpenITStudios/Example';
let checks=0;
const eq=(x,y,m)=>{assert.deepEqual(x,y,m);checks++};
async function fixture({missingReceipt=false,untrusted=false}={}){
 const dir=await mkdtemp(join(tmpdir(),'lp-verified-runtime-'));
 const paths={registryPath:join(dir,'registry.json'),outboxPath:join(dir,'outbox.json'),
  checkpointPath:join(dir,'checkpoint.json'),schedulerLeasePath:join(dir,'scheduler.lease')};
 const registry=new WorkspaceRegistry(paths.registryPath),outbox=new PromptOutbox(paths.outboxPath),
  checkpoint=new CheckpointStore(paths.checkpointPath);
 const workspaceId='workspace-01',sessionId='session-01',taskId='task-01',goalId='goal-01';
 eq((await registry.register(0,{workspaceId,sessionId,taskIds:[taskId],
  repository:REPO,branch:'Local',headSha:BASE,status:'READY',contextRevision:1})).ok,true,'workspace registered');
 const prompt=await outbox.reserve({workspaceId,sessionId,taskId,
  prompt:'Inspect UV',promptLimit:4,contextRevision:1});
 eq(prompt.reserved,true,'prompt reserved');
 await outbox.ack({workspaceId,promptId:prompt.promptId,hostReceipt:{responseHandle:'handle-01'}});
 await checkpoint.initialize({version:0,goalId,goalHash:'hash-01',phase:'READY',
  headSha:BASE,workspaceId,sessionId,iteration:0,elapsedMinutes:1,
  modelTokensUsed:0,noProgress:0,transportApproved:true});
 await checkpoint.apply({type:'RESERVE',goalId,expectedVersion:0,taskId});
 await checkpoint.apply({type:'DISPATCH_ACK',goalId,expectedVersion:1,
  taskId,receiptId:'receipt-01'});
 const identity={goalId,workspaceId,sessionId,taskId,promptId:prompt.promptId,
  responseHandle:'handle-01',responseId:'response-01',contextRevision:1,
  repository:REPO,branch:'Local',baseSha:BASE};
 let reviewCalls=0,resultCalls=0,sourceCalls=0;
 const host={
  readGoal:async()=>({id:goalId,repository:REPO,branch:'Local',
   allowedActions:['Inspect UV'],preserve:[],maxIterations:6,
   maxMinutes:120,maxModelTokens:10000}),
  readIdentity:async()=>({...identity,allowedActions:['Inspect UV']}),
  readResult:async()=>{resultCalls++;return {schemaVersion:1,...identity,
   provider:'CODEX_APP_SERVER',outcome:'CONTINUE',summary:'UV needs inspection',
   nextAction:{action:'Inspect UV',owner:'UV generator',proof:'Run UV checks'},
   evidenceRefs:[{kind:'COMMIT',ref:HEAD}]};},
  verifyResult:async({identity:scope,fingerprint,provider})=>({...scope,fingerprint,provider,
   trusted:!untrusted,source:'TRUSTED_HOST',transportVerified:true,
   operatorScopeApproved:true,status:'TURN_COMPLETED'}),
  verifyTurn:async()=>({...identity,verified:true,source:'TRUSTED_HOST',status:'TURN_COMPLETED'}),
  sourceFactory:async()=>({scope:{repository:REPO,branch:'Local'},
   changesSince:async()=>{sourceCalls++;return {repository:REPO,branch:'Local',
    baseSha:BASE,headSha:HEAD,changed:true,
    commits:[{sha:HEAD,summary:'Improve UV geometry'}]};}}),
  receiptFactory:async()=>({scope:{repository:REPO,branch:'Local'},
   reconcile:async()=>({verified:true,reason:'TRUSTED_RECEIPT',
    repository:REPO,branch:'Local',headSha:HEAD,changed:true,
    qa:'PASS',acceptancePassed:false})}),
  readHead:async()=>({repository:REPO,branch:'Local',headSha:HEAD}),
  authorize:async data=>({...data,trusted:true,source:'NATIVE_HOST'})
 };
 const make=()=>createVerifiedGoalRuntime({paths,host});
 return {dir,paths,host,make,workspaceId,registry,outbox,checkpoint,
  get resultCalls(){return resultCalls},get sourceCalls(){return sourceCalls},
  get reviewCalls(){return reviewCalls},cleanup:()=>rm(dir,{recursive:true,force:true})};
}
{
 const f=await fixture();try{
  const a=await f.make().reconcile({workspaceId:f.workspaceId,
   receipt:{id:'qa-01'},proposal:{outcome:'DONE'}});
  eq(a.status,'RECONCILED','full exact-source composition');
  eq(a.phase,'READY','not falsely complete');
  eq(a.nextPromptAllowed,false,'no dispatch');
  const cp=await f.checkpoint.read(),w=(await f.registry.read()).workspaces[0];
  eq(cp.headSha,HEAD,'verified HEAD committed');
  eq(cp.lastReview.reviewId,w.lastGoalReviewId,'registry checkpoint consistent');
  eq(cp.lastReview.workerFeedbackHash.length,64,'worker attestation persisted');
  eq((await f.outbox.pending(f.workspaceId)).length,0,'outbox released');
  eq((await f.make().recover({workspaceId:f.workspaceId})).status,'ALREADY_RECONCILED','restart no-op');
  eq(f.resultCalls,1,'one worker result read');
  eq(f.sourceCalls,1,'one GitHub range check');
 }finally{await f.cleanup()}
}
{
 const f=await fixture();try{
  const a=await f.make().reconcile({workspaceId:f.workspaceId});
  eq(a.status,'REVIEW_REQUIRED','missing external QA receipt requires review');
  eq(a.reason,'TRUSTED_MILESTONE_RECEIPT_MISSING','reason explicit');
  eq(a.workerReport.summary,'UV needs inspection','verified summary preserved');
  eq((await f.checkpoint.read()).phase,'WAITING','no checkpoint mutation');
  eq((await f.outbox.pending(f.workspaceId)).length,1,'original result pending');
 }finally{await f.cleanup()}
}
{
 const f=await fixture({untrusted:true});try{
  const a=await f.make().reconcile({workspaceId:f.workspaceId,receipt:{id:'qa-01'}});
  eq(a.status,'REVIEW_REQUIRED','host attestation denied');
  eq(a.reason,'WORKER_RESULT_ATTESTATION_MISMATCH','provenance failure explicit');
  eq(f.sourceCalls,0,'no GitHub read without authenticated result');
  eq((await f.checkpoint.read()).phase,'WAITING','no side effect');
 }finally{await f.cleanup()}
}
{
 const f=await fixture();try{
  eq((await f.make().reconcile({workspaceId:'workspace-11'})).reason,
   'INVALID_WORKSPACE_ID','reject wrong workspace');
  eq((await f.checkpoint.read()).phase,'WAITING','wrong scope does not mutate');
  assert.throws(()=>createVerifiedGoalRuntime({paths:{...f.paths,
   outboxPath:f.paths.registryPath},host:f.host}),/STORAGE_COLLISION/);checks++;
  assert.throws(()=>createVerifiedGoalRuntime({paths:{...f.paths,
   registryPath:'relative.json'},host:f.host}),/ABSOLUTE/);checks++;
  assert.throws(()=>createVerifiedGoalRuntime({paths:f.paths,host:{}}),/TRUSTED_GOAL_RUNTIME_HOST_REQUIRED/);checks++;
 }finally{await f.cleanup()}
}
console.log('Verified goal runtime real-store integration: PASS ('+checks+' assertions; synthetic external host)');
