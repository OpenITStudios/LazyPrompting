import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {GoalReviewReconciliation} from '../src/prompt/goal-review-reconciliation.mjs';
import {transitionCheckpoint} from '../src/supervisor/checkpoint-transition.mjs';

const BASE='a'.repeat(40),HEAD='b'.repeat(40),WS='workspace-01';
const REPO='OpenITStudios/A-MIVUBI-Blockbench',BRANCH='chatgpt-dev';
let assertions=0;
const eq=(x,y,message)=>{assert.deepEqual(x,y,message);assertions++;};
const yes=(x,message)=>{assert.ok(x,message);assertions++;};

async function fixture({done=false,changed=true,badAuth=false,badHead=false,
  fault=null,checkpointChange={},workspaceChange={},itemChange={},reviewChange={}}={}){
  const dir=await mkdtemp(join(tmpdir(),'lp-goal-review-'));
  const cpath=join(dir,'checkpoint.json'),rpath=join(dir,'registry.json'),opath=join(dir,'outbox.json');
  const goalId='goal-01',taskId='task-01',sessionId='session-01',promptId='prompt-01',
    responseId='response-01',responseHandle='handle-01';
  let externalHead=badHead?BASE:changed?HEAD:BASE, failAt=fault, prepares=0,sends=0,revision=0;
  const checkpoint={version:2,goalId,goalHash:'hash-01',headSha:BASE,
    phase:'WAITING',pendingTaskId:taskId,workspaceId:WS,sessionId,
    iteration:1,modelTokensUsed:10,elapsedMinutes:1,noProgress:0,...checkpointChange};
  const workspace={workspaceId:WS,sessionId,repository:REPO,branch:BRANCH,headSha:BASE,
    status:'READY',contextRevision:3,taskIds:[taskId],...workspaceChange};
  const item={workspaceId:WS,sessionId,taskId,contextRevision:3,
    promptId,responseHandle,state:'ACKNOWLEDGED',...itemChange};
  const read=async p=>JSON.parse(await readFile(p,'utf8'));
  const save=async(p,x)=>writeFile(p,JSON.stringify(x)+'\n');
  await Promise.all([save(cpath,checkpoint),save(rpath,{version:4,workspaces:[workspace]}),
    save(opath,{items:[item]})]);
  const checkpointStore={
    read:()=>read(cpath),
    apply:async event=>{
      const prior=await read(cpath),next=transitionCheckpoint(prior,event);
      if(!next.ok)return next;
      if(event.type==='REVIEW_PREPARE')prepares++;
      await save(cpath,next.checkpoint);
      if(failAt==='AFTER_PREPARE'&&event.type==='REVIEW_PREPARE'){failAt=null;throw Error('SIMULATED_CRASH');}
      if(failAt==='AFTER_COMMIT'&&event.type==='REVIEW_COMMIT'){failAt=null;throw Error('SIMULATED_CRASH');}
      return next;
    }
  };
  const registry={
    read:()=>read(rpath),
    mutate:async(expectedVersion,change)=>{
      const prior=await read(rpath);
      if(prior.version!==expectedVersion)return {ok:false};
      const next=change(structuredClone(prior));
      await save(rpath,next);
      if(failAt==='AFTER_REGISTRY'){failAt=null;throw Error('SIMULATED_CRASH');}
      return {ok:true,version:next.version};
    }
  };
  const outbox={
    read:()=>read(opath),
    reconcile:async({workspaceId,promptId,responseId,verified})=>{
      eq(verified,true,'outbox only reconciles trusted completion');
      const data=await read(opath);
      const x=data.items.find(x=>x.workspaceId===workspaceId&&x.promptId===promptId);
      if(!x||x.state!=='ACKNOWLEDGED')throw Error('OUTBOX_STATE_MISMATCH');
      x.state='RESPONSE_VERIFIED';x.responseId=responseId;
      await save(opath,data);
      if(failAt==='AFTER_OUTBOX'){failAt=null;throw Error('SIMULATED_CRASH');}
      return {completed:true};
    }
  };
  const proposal={outcome:done?'DONE':'CONTINUE',nextAction:{action:'Check UV',owner:'UV',proof:'UV tests'}};
  const actualDecision={state:done?'DONE':'READY',reason:done?'ACCEPTANCE_VERIFIED':'AUTHORIZED_NEXT_ACTION'};
  const progress={repository:REPO,branch:BRANCH,baseSha:BASE,headSha:changed?HEAD:BASE,
    qa:'PASS',acceptancePassed:done,changed};
  const reviewer={inspectUnderLease:async()=>{
    return {status:'REVIEWED',requiresDurableHostReconciliation:true,
      goalId,workspaceId:WS,sessionId,taskId,promptId,responseHandle,responseId,
      contextRevision:3,checkpointVersion:2,
      source:{...progress,...reviewChange.source},
      decision:{...actualDecision,...reviewChange.decision}};
  }};
  const authority=async args=>badAuth?{trusted:false}:{...args,trusted:true,source:'NATIVE_HOST'};
  const readHead=async()=>({repository:REPO,branch:BRANCH,headSha:externalHead});
  const withLease=async cb=>{revision++;await mkdir(join(dir,'lease'));try{return await cb();}
    finally{await rm(join(dir,'lease'),{recursive:true,force:true});}};
  const make=()=>new GoalReviewReconciliation({review:reviewer,registry,outbox,
    checkpointStore,readHead,authorize:authority,withLease});
  return {dir,make,checkpointStore,registry,outbox,proposal,
    setHead:x=>{externalHead=x},get prepares(){return prepares},get sessions(){return revision},
    get sends(){return sends},dispose:()=>rm(dir,{recursive:true,force:true})};
}

for(const broken of ['AFTER_PREPARE','AFTER_REGISTRY','AFTER_OUTBOX','AFTER_COMMIT']){
  const f=await fixture({fault:broken});
  try{
    const a=await f.make().apply({workspaceId:WS});
    eq(a.status,'RECONCILE_REQUIRED','failure at '+broken+' holds instead of dispatch');
    eq(a.nextPromptAllowed,false,'uncertain '+broken+' never sends');
    const recovered=await f.make().recover({workspaceId:WS});
    eq(['RECONCILED','ALREADY_RECONCILED'].includes(recovered.status),true,
      'restart recovers '+broken);
    eq(recovered.nextPromptAllowed,false,'recovery cannot dispatch');
    const cp=await f.checkpointStore.read(),reg=await f.registry.read(),out=await f.outbox.read();
    eq(cp.phase,'READY','checkpoint ready after recovery');
    eq(reg.workspaces[0].headSha,HEAD,'registry advanced after recovery');
    eq(out.items[0].state,'RESPONSE_VERIFIED','outbox released exactly once');
    eq(cp.lastReview.responseId,'response-01','exact response journaled');
    eq(f.prepares,1,'only one durable prepare');
  }finally{await f.dispose();}
}
{
  const f=await fixture();try{
    const a=await f.make().apply({workspaceId:WS});
    eq(a.status,'RECONCILED','happy path reconciles');
    eq(a.phase,'READY','nonterminal goal returns ready');
    eq(a.nextPromptAllowed,false,'no auto-send capability');
    const repeat=await f.make().recover({workspaceId:WS});
    eq(repeat.status,'ALREADY_RECONCILED','replay is a read-only no-op');
    eq(f.prepares,1,'one durable transition only');
    eq(f.sends,0,'no transport invoked');
  }finally{await f.dispose();}
}
{
  const f=await fixture({done:true});try{
    const a=await f.make().apply({workspaceId:WS});
    eq(a.phase,'DONE','verified accepted goal ends DONE');
    eq((await f.checkpointStore.read()).lastReview.acceptancePassed,true,'acceptance persisted');
  }finally{await f.dispose();}
}
for(const [name,params,expected] of [
  ['wrong goal',{checkpointChange:{goalId:'goal-sibling'}},'CHECKPOINT_MOVED_SINCE_REVIEW'],
  ['paused checkpoint',{checkpointChange:{phase:'PAUSED'}},'CHECKPOINT_MOVED_SINCE_REVIEW'],
  ['wrong pending task',{checkpointChange:{pendingTaskId:'other-task'}},'CHECKPOINT_MOVED_SINCE_REVIEW'],
  ['wrong version',{checkpointChange:{version:3}},'CHECKPOINT_MOVED_SINCE_REVIEW'],
  ['wrong workspace session',{workspaceChange:{sessionId:'sibling-session'}},'WORKSPACE_BINDING_MOVED'],
  ['wrong workspace branch',{workspaceChange:{branch:'main'}},'WORKSPACE_BINDING_MOVED'],
  ['wrong prompt receipt',{itemChange:{responseHandle:'other-handle'}},'PROMPT_BINDING_MOVED'],
  ['unacknowledged prompt',{itemChange:{state:'RESERVED'}},'PROMPT_BINDING_MOVED'],
  ['no authority',{badAuth:true},'NATIVE_AUTHORIZATION_OR_HEAD_MISMATCH'],
  ['unmatched github head',{badHead:true},'NATIVE_AUTHORIZATION_OR_HEAD_MISMATCH'],
  ['unsupported DONE evidence',{reviewChange:{decision:{state:'DONE'},source:{qa:'NOT_EXECUTED',acceptancePassed:true}}},'GOAL_ACCEPTANCE_NOT_VERIFIED'],
  ['unverified review',{reviewChange:{decision:{state:'PAUSED'}}},'REVIEW_NOT_ELIGIBLE_FOR_COMMIT']
]){
  const f=await fixture(params);try{
    const result=await f.make().apply({workspaceId:WS});
    eq(result.reason,expected,name+' rejected correctly');
    eq(result.nextPromptAllowed,false,name+' cannot dispatch');
    eq(f.prepares,0,name+' cannot prepare a state mutation');
  }finally{await f.dispose();}
}
{
  const f=await fixture({fault:'AFTER_PREPARE'});try{
    await f.make().apply({workspaceId:WS});
    f.setHead('c'.repeat(40));
    const resumed=await f.make().recover({workspaceId:WS});
    eq(resumed.reason,'NATIVE_AUTHORIZATION_OR_HEAD_MISMATCH','moved HEAD blocks restart');
    eq((await f.checkpointStore.read()).phase,'RECONCILE_REQUIRED','holds checkpoint');
    eq((await f.outbox.read()).items[0].state,'ACKNOWLEDGED','outbox not released');
  }finally{await f.dispose();}
}
{
  const f=await fixture({fault:'AFTER_PREPARE'});try{
    await f.make().apply({workspaceId:WS});
    const ck=await f.checkpointStore.read();
    const denied=transitionCheckpoint(ck,{type:'REVIEW_COMMIT',goalId:'goal-01',
      expectedVersion:ck.version,reviewId:ck.review.reviewId,responseId:'response-01',trustedEvidence:false});
    eq(denied.ok,false,'model cannot assert review commit');
    eq(transitionCheckpoint(ck,{type:'RESULT',goalId:'goal-01',expectedVersion:ck.version,
      taskId:'task-01',resultId:'response-01',trustedEvidence:true}).ok,false,
      'legacy RESULT cannot bypass prepared review');
    await f.checkpointStore.apply({type:'STOP',goalId:'goal-01',expectedVersion:ck.version});
    eq((await f.make().recover({workspaceId:WS})).status,'BLOCKED',
      'operator stop blocks restart reconciliation');
  }finally{await f.dispose();}
}
{
  const f=await fixture({changed:false});try{
    eq((await f.make().apply({workspaceId:WS})).status,'RECONCILED',
      'same-HEAD verified review can be persisted');
    eq((await f.make().recover({workspaceId:WS})).status,'ALREADY_RECONCILED',
      'no-progress review is idempotent');
  }finally{await f.dispose();}
}
console.log(`Goal review durable reconciliation: PASS (${assertions} assertions, file-backed fake host; no Windows or ChatGPT)`);
