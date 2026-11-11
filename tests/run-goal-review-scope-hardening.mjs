import assert from 'node:assert/strict';
import {GitHubGoalReview} from '../src/prompt/github-goal-review.mjs';
const BASE='a'.repeat(40),HEAD='b'.repeat(40);
const repository='OpenITStudios/A-MIVUBI-Blockbench',branch='chatgpt-dev';
let count=0;
const eq=(actual,expected,reason)=>{assert.deepEqual(actual,expected,reason);count++};
function fixture({checkpointDelta={},goalDelta={},workspaceDelta={},pendingDelta={},turnDelta={},noReceipt=false}={}){
  let sourceReads=0,turnReads=0,leaseCalls=0;
  const w={workspaceId:'workspace-01',sessionId:'session-01',taskIds:['task-01'],status:'READY',
    repository,branch,headSha:BASE,contextRevision:4,...workspaceDelta};
  const p={workspaceId:'workspace-01',sessionId:'session-01',taskId:'task-01',promptId:'prompt-01',
    responseHandle:'handle-01',state:'ACKNOWLEDGED',contextRevision:4,...pendingDelta};
  const goal={id:'goal-01',repository,branch,allowedActions:['Review code'],preserve:[],
    maxIterations:10,maxMinutes:240,maxModelTokens:20000,...goalDelta};
  const checkpoint={version:3,goalId:'goal-01',goalHash:'goal-hash-01',
    phase:'WAITING',pendingTaskId:'task-01',workspaceId:'workspace-01',
    sessionId:'session-01',repository,branch,headSha:BASE,iteration:1,
    elapsedMinutes:1,modelTokensUsed:20,noProgress:0,transportApproved:true,
    ...checkpointDelta};
  const turn={verified:true,source:'TRUSTED_HOST',status:'TURN_COMPLETED',workspaceId:'workspace-01',
    sessionId:'session-01',taskId:'task-01',promptId:'prompt-01',responseHandle:'handle-01',
    contextRevision:4,responseId:'response-01',...turnDelta};
  const reviewer=new GitHubGoalReview({
    registry:{read:async()=>({version:2,workspaces:[w]})},
    outbox:{pending:async()=>[p]},
    sourceFactory:async()=>({scope:{repository,branch},changesSince:async()=>{
      sourceReads++;return {repository,branch,baseSha:BASE,headSha:HEAD,
        changed:true,commits:[{sha:HEAD,summary:'Allowed update'}]};}}),
    receiptFactory:async()=>({scope:{repository,branch},reconcile:async()=>({
      verified:true,reason:'TRUSTED_RECEIPT',repository,branch,headSha:HEAD,
      changed:true,qa:'PASS',acceptancePassed:false})}),
    verifyTurn:async()=>{turnReads++;return turn},readGoal:async()=>goal,
    readCheckpoint:async()=>checkpoint,
    withLease:async fn=>{leaseCalls++;return fn()}
  });
  const inspect=()=>reviewer.inspect({workspaceId:'workspace-01',
    proposal:{outcome:'CONTINUE',nextAction:{action:'Review code',owner:'source',proof:'tests'}},
    receipt:noReceipt?null:{id:'receipt-01'}});
  return {inspect,reviewer,get sourceReads(){return sourceReads},
    get turnReads(){return turnReads},get leaseCalls(){return leaseCalls}};
}
{
  const f=fixture(),r=await f.inspect();
  eq(r.status,'REVIEWED','valid checkpoint can be reviewed');
  eq(r.goalId,'goal-01','review binds immutable goal');
  eq(r.taskId,'task-01','review binds exact active task');
  eq(r.responseHandle,'handle-01','review binds host response handle');
  eq(r.checkpointVersion,3,'review returns checkpoint CAS version');
  eq(r.contextRevision,4,'review binds workspace context');
  eq(r.nextPromptAllowed,false,'read-only reviewer does not dispatch');
  eq(f.leaseCalls,1,'standalone review uses lease');
  const inside=await f.reviewer.inspectUnderLease({workspaceId:'workspace-01'});
  eq(inside.status,'REVIEW_REQUIRED','inner read is read-only, pending receipt');
  eq(f.leaseCalls,1,'host composition does not nest scheduler lease');
}
for(const [name,delta,expected] of [
  ['foreign goal',{checkpointDelta:{goalId:'goal-02'}},'UNTRUSTED_GOAL_OR_CHECKPOINT_SCOPE'],
  ['stale version',{checkpointDelta:{version:-1}},'UNTRUSTED_GOAL_OR_CHECKPOINT_SCOPE'],
  ['missing version',{checkpointDelta:{version:undefined}},'UNTRUSTED_GOAL_OR_CHECKPOINT_SCOPE'],
  ['wrong task',{checkpointDelta:{pendingTaskId:'task-02'}},'UNTRUSTED_GOAL_OR_CHECKPOINT_SCOPE'],
  ['wrong branch',{checkpointDelta:{branch:'main'}},'UNTRUSTED_GOAL_OR_CHECKPOINT_SCOPE'],
  ['wrong repo',{checkpointDelta:{repository:'Wrong/Repo'}},'UNTRUSTED_GOAL_OR_CHECKPOINT_SCOPE'],
  ['wrong workspace',{checkpointDelta:{workspaceId:'workspace-02'}},'UNTRUSTED_GOAL_OR_CHECKPOINT_SCOPE'],
  ['wrong session',{checkpointDelta:{sessionId:'other-session'}},'UNTRUSTED_GOAL_OR_CHECKPOINT_SCOPE'],
  ['paused',{checkpointDelta:{phase:'PAUSED'}},'UNTRUSTED_GOAL_OR_CHECKPOINT_SCOPE'],
  ['done',{checkpointDelta:{phase:'DONE'}},'UNTRUSTED_GOAL_OR_CHECKPOINT_SCOPE'],
  ['review pending',{checkpointDelta:{phase:'RECONCILE_REQUIRED'}},'UNTRUSTED_GOAL_OR_CHECKPOINT_SCOPE'],
  ['goal hash mismatch',{goalDelta:{goalHash:'other-goal-hash'}},'UNTRUSTED_GOAL_OR_CHECKPOINT_SCOPE']
]){
  const f=fixture(delta),r=await f.inspect();
  eq(r.reason,expected,name+' refused');
  eq(r.nextPromptAllowed,false,name+' cannot dispatch');
  eq(f.sourceReads,0,name+' cannot fetch GitHub with stale checkpoint');
  eq(f.turnReads,0,name+' cannot certify turn for stale checkpoint');
}
{
  const f=fixture({turnDelta:{source:'UI_OBSERVER',status:'UI_COMPLETED_OBSERVED'}});
  const r=await f.inspect();
  eq(r.reason,'CHAT_TURN_NOT_AUTHORITATIVELY_CONFIRMED','UI-only completion rejected');
  eq(f.sourceReads,0,'no GitHub calls after invalid turn');
}
{
  const f=fixture({pendingDelta:{state:'RESERVED'}}),r=await f.inspect();
  eq(r.reason,'OUTBOX_RESPONSE_NOT_ACKNOWLEDGED','unacknowledged prompt denied');
  eq(f.turnReads,0,'no turn verifier invoked before ACK');
}
console.log(`Goal review checkpoint hardening: PASS (${count} assertions, fake host and no network)`);
