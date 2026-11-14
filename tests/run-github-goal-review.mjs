import assert from 'node:assert/strict';
import {GitHubGoalReview} from '../src/prompt/github-goal-review.mjs';
import {GitHubEvidence} from '../src/integrations/github-evidence.mjs';
import {ReceiptReconciler} from '../src/integrations/receipt-reconciler.mjs';

const SHA0='a'.repeat(40),SHA1='b'.repeat(40);
const repository='OpenITStudios/A-MIVUBI-Blockbench', branch='chatgpt-dev';
const workspaceId='workspace-01',sessionId='temporary-chat-01',taskId='task-01';
const promptId='turn-01',responseHandle='handle-01',responseId='result-01';
const workspace={workspaceId,sessionId,taskIds:[taskId],status:'READY',repository,
  branch,headSha:SHA0,contextRevision:3};
const pending={workspaceId,sessionId,taskId,promptId,responseHandle,
  contextRevision:3,state:'ACKNOWLEDGED'};
const goal={id:'goal-01',repository,branch,allowedActions:['Inspect UV'],
  preserve:['Do not change base branch'],maxIterations:8,maxMinutes:240,maxModelTokens:10000};
const checkpoint={version:2,goalId:'goal-01',phase:'WAITING',pendingTaskId:taskId,
  workspaceId,sessionId,headSha:SHA0,iteration:1,elapsedMinutes:12,
  modelTokensUsed:100,noProgress:0,transportApproved:true};
const proposal={outcome:'CONTINUE',nextAction:{action:'Inspect UV',owner:'UV generator',
  proof:'Run deterministic UV checks'}};
const receipt={revision:'approved-01'};
let assertions=0;
const eq=(actual,expected,reason)=>{assert.deepEqual(actual,expected,reason);assertions++};
const yes=(value,reason)=>{assert.ok(value,reason);assertions++};
const fixture=(options={})=>{
  const stats={github:0,turn:0,receipt:0,lease:0,reads:0,pending:0};
  const current={...workspace,...options.workspace};
  const pendingItem={...pending,...options.pending};
  const goalValue={...goal,...options.goal};
  const ck={...checkpoint,...options.checkpoint};
  const turnData={source:'TRUSTED_HOST',status:'TURN_COMPLETED',verified:true,
    workspaceId,sessionId,taskId,promptId,responseHandle,contextRevision:3,
    responseId,...options.turn};
  const proof={trusted:true,repository,branch,headSha:SHA1,goalId:'goal-01',
    promptId,qa:'PASS',changed:true,acceptancePassed:false,...options.proof};
  let headCalls=0;
  const fakeFetch=async url=>{
    stats.github++;
    if(options.githubError)throw Error('GITHUB_UNAVAILABLE');
    if(url.includes('/branches/')){
      headCalls++;
      return {ok:true,json:async()=>({commit:{sha:options.headMoved&&headCalls===2?SHA0:SHA1}})};
    }
    return {ok:true,json:async()=>({status:'ahead',ahead_by:1,total_commits:1,
      base_commit:{sha:SHA0},merge_base_commit:{sha:SHA0},
      commits:[{sha:SHA1,commit:{message:'Improve voxel UV from approved task'}}]})};
  };
  const sourceFactory=async({repository:repo,branch:br})=>{
    const scope=options.badScope?{repository:'Other/Repo',branch:br}:{repository:repo,branch:br};
    return new GitHubEvidence({token:'test-only',scope,fetchImpl:fakeFetch});
  };
  const receiptFactory=async({source,repository:repo,branch:br})=>{
    const scope={repository:repo,branch:br};
    return new ReceiptReconciler({sourceProvider:source,scope,
      verifyReceipt:async()=>{stats.receipt++;return proof;}});
  };
  const registry={read:async()=>{stats.reads++;return {version:2,workspaces:[current]};}};
  const outbox={pending:async()=>{stats.pending++;return options.noPending?[]:[pendingItem];}};
  const verifyTurn=async()=>{stats.turn++;return turnData;};
  const withLease=async fn=>{stats.lease++;return fn();};
  const bridge=new GitHubGoalReview({registry,outbox,sourceFactory,receiptFactory,
    readGoal:async()=>goalValue,readCheckpoint:async()=>ck,verifyTurn,withLease});
  return {bridge,stats};
};
const run=(f,input={})=>f.bridge.inspect({workspaceId,proposal,receipt,...input});
const good=fixture();
const r=await run(good);
eq(r.status,'REVIEWED','full review completed');
eq(r.decision.state,'READY','next action planned without dispatch');
eq(r.decision.action,'CONTINUE','approved action selected');
yes(r.decision.prompt.includes('Verified HEAD: '+SHA1),'prompt uses pinned head');
yes(r.decision.prompt.includes('Inspect UV'),'prompt refers to proposed action');
eq(r.nextPromptAllowed,false,'no automatic prompt dispatch');
eq(r.requiresDurableHostReconciliation,true,'host must reconcile persisted stores');
eq(r.source.qa,'PASS','verified QA propagated');
eq(r.source.commits.length,1,'changed commits recognized');
eq(good.stats.github,4,'GitHub compare + second HEAD read by receipt reconciler');
eq(good.stats.turn,1,'one external trusted host completion lookup');
eq(good.stats.receipt,1,'one independent receipt verification');
eq(good.stats.lease,1,'one scheduler lease');
eq(good.stats.reads,1,'registry read once');
eq(good.stats.pending,1,'outbox inspected once');
const noReceipt=fixture();
const r2=await run(noReceipt,{receipt:null});
eq(r2.status,'REVIEW_REQUIRED','commit alone needs Codex verification');
eq(r2.reason,'TRUSTED_MILESTONE_RECEIPT_MISSING','missing milestone reason');
eq(r2.source.commits[0].sha,SHA1,'commit pointer available for Codex');
eq(r2.source.acceptancePassed,false,'commit does not prove acceptance');
eq(r2.nextPromptAllowed,false,'unverified milestone cannot dispatch');
eq(noReceipt.stats.receipt,0,'no verifier call without receipt');
for(const [description,opts,reason] of [
 ['unverified UI-only turn',{turn:{source:'UI_OBSERVER',status:'UI_COMPLETED_OBSERVED'}},'CHAT_TURN_NOT_AUTHORITATIVELY_CONFIRMED'],
 ['host return incomplete',{turn:{status:'GENERATING'}},'CHAT_TURN_NOT_AUTHORITATIVELY_CONFIRMED'],
 ['wrong prompt',{turn:{promptId:'other'}},'CHAT_TURN_NOT_AUTHORITATIVELY_CONFIRMED'],
 ['wrong session',{turn:{sessionId:'another-chat'}},'CHAT_TURN_NOT_AUTHORITATIVELY_CONFIRMED'],
 ['wrong workspace',{turn:{workspaceId:'workspace-02'}},'CHAT_TURN_NOT_AUTHORITATIVELY_CONFIRMED'],
 ['wrong context rev',{turn:{contextRevision:4}},'CHAT_TURN_NOT_AUTHORITATIVELY_CONFIRMED'],
 ['wrong response handle',{turn:{responseHandle:'wrong'}},'CHAT_TURN_NOT_AUTHORITATIVELY_CONFIRMED'],
 ['no host verification',{turn:{verified:false}},'CHAT_TURN_NOT_AUTHORITATIVELY_CONFIRMED'],
 ['reserved but not acked',{pending:{state:'RESERVED'}},'OUTBOX_RESPONSE_NOT_ACKNOWLEDGED'],
 ['wrong outbox session',{pending:{sessionId:'other'}},'OUTBOX_RESPONSE_NOT_ACKNOWLEDGED'],
 ['wrong outbox revision',{pending:{contextRevision:9}},'OUTBOX_RESPONSE_NOT_ACKNOWLEDGED'],
 ['workspace paused',{workspace:{status:'PAUSED'}},'WORKSPACE_NOT_READY'],
 ['stale host checkpoint',{checkpoint:{headSha:SHA1}},'UNTRUSTED_GOAL_OR_CHECKPOINT_SCOPE'],
 ['spoofed scope',{badScope:true},'UNTRUSTED_GOAL_OR_CHECKPOINT_SCOPE'],
 ['wrong goal project',{goal:{branch:'Local'}},'UNTRUSTED_GOAL_OR_CHECKPOINT_SCOPE'],
 ['GitHub offline',{githubError:true},'GITHUB_PROGRESS_UNAVAILABLE_OR_DIVERGED'],
 ['HEAD moved',{headMoved:true},'GITHUB_PROGRESS_UNAVAILABLE_OR_DIVERGED']
]){
  const f=fixture(opts),review=await run(f);
  eq(review.reason,reason,description);
  eq(review.nextPromptAllowed,false,'blocked: '+description);
  if(['unverified UI-only turn','host return incomplete','wrong prompt','wrong session','wrong workspace',
    'wrong context rev','wrong response handle','no host verification','reserved but not acked',
    'wrong outbox session','wrong outbox revision','workspace paused','stale host checkpoint',
    'spoofed scope','wrong goal project'].includes(description))
    eq(f.stats.github,0,'no unnecessary GitHub calls: '+description);
}

const sourceOnly=fixture();
const sourceProgress=await sourceOnly.bridge.inspectSourceProgress({workspaceId});
eq(sourceProgress.status,'SOURCE_OBSERVED','read-only progress available without chat receipt');
eq(sourceProgress.reason,'GITHUB_CHANGES_REQUIRE_REVIEW','change is not completion');
eq(sourceProgress.source.headSha,SHA1,'exact source head reported');
eq(sourceProgress.source.qa,'NOT_EXECUTED','no synthetic QA promotion');
eq(sourceProgress.chatTurnVerified,false,'source does not confirm chat turn');
eq(sourceProgress.goalComplete,false,'commit alone does not finish goal');
eq(sourceProgress.nextPromptAllowed,false,'GitHub progress never enables send');
eq(sourceOnly.stats.turn,0,'no ChatGPT verification attempted');
eq(sourceOnly.stats.receipt,0,'no milestone receipt fabricated');
eq(sourceOnly.stats.pending,0,'no prompt-outbox mutation or pending needed');
const sourceWithoutChange=fixture();
const noChange=await sourceWithoutChange.bridge.inspectSourceProgress({workspaceId});
eq(noChange.status,'SOURCE_OBSERVED','source inspection remains independent');
const pausedSource=fixture({workspace:{status:'PAUSED'}});
eq((await pausedSource.bridge.inspectSourceProgress({workspaceId})).reason,'WORKSPACE_NOT_READY',
 'paused workspace cannot be promoted');
eq(pausedSource.stats.github,0,'no GitHub fetch while paused');
const divergedSource=fixture({githubError:true});
eq((await divergedSource.bridge.inspectSourceProgress({workspaceId})).reason,
 'GITHUB_PROGRESS_UNAVAILABLE_OR_DIVERGED','unavailable GitHub fails closed');
const wrongScopeSource=fixture({badScope:true});
eq((await wrongScopeSource.bridge.inspectSourceProgress({workspaceId})).reason,
 'UNTRUSTED_SOURCE_SCOPE','foreign scope rejected');
eq((await sourceOnly.bridge.inspectSourceProgress({workspaceId:'workspace-11'})).reason,
 'INVALID_REVIEW_SCOPE','invalid workspace rejected');

const noPending=fixture({noPending:true});
eq((await run(noPending)).reason,'EXACTLY_ONE_PENDING_PROMPT_REQUIRED','no live response cannot review');
eq(noPending.stats.github,0,'no GitHub calls on idle workspace');
for(const invalid of ['workspace-11','ws1','workspace-01/../../']){
  eq((await good.bridge.inspect({workspaceId:invalid})).reason,'INVALID_REVIEW_SCOPE','invalid workspace denied');
}
const wrongProof=fixture({proof:{promptId:'another-prompt'}});
eq((await run(wrongProof)).reason,'MILESTONE_RECEIPT_UNVERIFIED_OR_CONTRADICTORY',
  'wrong prompt QA receipt is not accepted');
const wrongCommit=fixture({proof:{changed:false}});
eq((await run(wrongCommit)).reason,'MILESTONE_RECEIPT_UNVERIFIED_OR_CONTRADICTORY',
  'milestone progress must match actual GitHub commit range');
const done=fixture({proof:{acceptancePassed:true}});
const doneResult=await run(done,{proposal:{outcome:'DONE'}});
eq(doneResult.decision.state,'DONE','complete only with independently trusted QA acceptance');
eq(doneResult.nextPromptAllowed,false,'DONE never schedules another prompt');
const notDone=fixture({proof:{qa:'NOT_EXECUTED',acceptancePassed:true}});
const notDoneResult=await run(notDone,{proposal:{outcome:'DONE'}});
eq(notDoneResult.decision.action,'VERIFY','unexecuted QA needs verification');
const unauthorized=fixture();
eq((await run(unauthorized,{proposal:{outcome:'CONTINUE',nextAction:{action:'Delete main',owner:'git',proof:'no'}}})).decision.reason,
  'OUT_OF_SCOPE_ACTION','supervisor blocks unapproved next action');
const noTransport=fixture({checkpoint:{transportApproved:false}});
eq((await run(noTransport)).decision.reason,'TRANSPORT_NOT_APPROVED','transport gate cannot be bypassed');
const stopped=fixture({checkpoint:{stopRequested:true}});
eq((await run(stopped)).decision.reason,'OPERATOR_STOP','operator STOP remains authoritative');
const halted=fixture({checkpoint:{noProgress:4}});
eq((await run(halted)).decision.reason,'STAGNATION','stagnation stops');
const noProvider=new GitHubGoalReview({registry:{read:()=>({})},outbox:{pending:()=>[]},
  sourceFactory:()=>{},receiptFactory:()=>{},verifyTurn:()=>{},readGoal:()=>{},
  readCheckpoint:()=>{},withLease:fn=>fn()});
eq((await noProvider.inspect({workspaceId})).reason,'WORKSPACE_NOT_FOUND','missing workspace');
assert.throws(()=>new GitHubGoalReview({registry:{},outbox:{}}),/DEPENDENCIES_REQUIRED/);assertions++;
console.log('GitHub goal review integration: PASS ('+assertions+' assertions; fake host + fake GitHub HTTP, no ChatGPT or Windows)');
