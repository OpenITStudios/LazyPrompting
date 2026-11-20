import {isAbsolute,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyGoalContract} from '../supervisor/goal-contract.mjs';
import {WorkspaceRegistry} from '../runtime/workspace-registry.mjs';
import {PromptOutbox} from './prompt-outbox.mjs';
import {CheckpointStore} from '../supervisor/checkpoint-store.mjs';
import {createSchedulerFileLease} from './scheduler-file-lease.mjs';
import {GitHubGoalReview} from './github-goal-review.mjs';
import {StructuredWorkerFeedback} from './structured-worker-feedback.mjs';
import {TrustedGoalReview} from './trusted-goal-review.mjs';
import {GoalReviewReconciliation} from './goal-review-reconciliation.mjs';
import {assessGoalGuardian} from './goal-guardian.mjs';
import {createScopedGoalEvidenceProviders} from '../integrations/scoped-goal-evidence-providers.mjs';

// Single native-host composition. Not a public MCP endpoint, sender, API
// client, or alternative state owner. All external evidence remains injected
// by a separately authenticated host. No default startup instantiates this.
const WS=/^workspace-(0[1-9]|10)$/;
const REQUIRED=['readGoal','sourceFactory','receiptFactory','verifyTurn',
 'readIdentity','readResult','verifyResult','readHead','authorize'];
const PATHS=['registryPath','outboxPath','checkpointPath','schedulerLeasePath'];
const hold=(reason)=>({status:'BLOCKED',reason,nextPromptAllowed:false});

// Compact, read-only continuation projection. A matching state key helps a
// trusted client avoid retransmitting unchanged context; it is NOT a grant,
// a verified GitHub HEAD or a cached ChatGPT identity/receipt.
function projectContinuation({workspaceId,checkpoint,registry,knownStateKey=null}={}){
 const blocked=reason=>({source:'CANONICAL_GOAL_CONTINUATION',...hold(reason),
  workspaceId,trackedStateUnchanged:false,stateKey:null,
  qa:'NOT_EXECUTED',chatTurnVerified:false});
 const goal=checkpoint?.goalContract;
 if(!verifyGoalContract(goal)||checkpoint.workspaceId!==workspaceId||
    checkpoint.goalId!==goal.goalId||checkpoint.goalHash!==goal.goalHash)
  return blocked('APPROVED_GOAL_CONTRACT_REQUIRED');
 const binding=registry?.workspaces?.find(w=>w.workspaceId===workspaceId);
 if(!Number.isSafeInteger(checkpoint.version)||checkpoint.version<0||
    !Number.isSafeInteger(registry?.version)||registry.version<0||
    !binding||binding.goalId!==goal.goalId||
    binding.goalHash!==goal.goalHash||binding.goalRevision!==goal.revision||
    binding.repository!==goal.repository||binding.branch!==goal.branch||
    checkpoint.repository!==goal.repository||checkpoint.branch!==goal.branch||
    checkpoint.headSha!==binding.headSha||
    (checkpoint.sessionId!==undefined&&checkpoint.sessionId!==binding.sessionId)||
    !Number.isSafeInteger(binding.contextRevision)||binding.contextRevision<0||
    !['PAUSED','READY','BLOCKED','STOPPED'].includes(binding.status)||
    !['PAUSED','READY','WAITING','RECONCILE_REQUIRED','DISPATCH_PENDING',
      'STOPPED','DONE'].includes(checkpoint.phase)||
    !['UNBOUND','BOUND_VERIFIED'].includes(checkpoint.chatState))
  return blocked('GOAL_WORKSPACE_SCOPE_MISMATCH');
 const revision={
  workspaceId,goalId:goal.goalId,goalHash:goal.goalHash,
  goalRevision:goal.revision,checkpointVersion:checkpoint.version,
  registryVersion:registry.version,contextRevision:binding.contextRevision,
  sessionId:binding.sessionId,headSha:binding.headSha,
  workspaceStatus:binding.status,phase:checkpoint.phase,
  chatState:checkpoint.chatState,
  pendingTaskId:checkpoint.pendingTaskId??null,
  lastResultId:checkpoint.lastResultId??null
 };
 const stateKey=createHash('sha256').update(JSON.stringify(revision)).digest('hex');
 // Never transform a recorded phase or a model-supplied stateKey into
 // permission for a next prompt. ChatGPT identity and QA remain unverified.
 const reviewDue=checkpoint.phase==='RECONCILE_REQUIRED'||
   checkpoint.phase==='DISPATCH_PENDING';
 const waiting=checkpoint.phase==='WAITING'&&
   typeof checkpoint.pendingTaskId==='string'&&
   checkpoint.pendingTaskId.length>0&&
   checkpoint.chatState==='BOUND_VERIFIED'&&binding.status==='READY';
 const status=checkpoint.phase==='STOPPED'||binding.status==='STOPPED'
   ?'STOPPED':binding.status==='BLOCKED'?'BLOCKED':
   checkpoint.phase==='DONE'?'DONE_RECORDED':
   reviewDue?'RECONCILE_REQUIRED':
   checkpoint.chatState==='UNBOUND'||binding.status==='PAUSED'
    ?'PAUSED':waiting?'WAITING_FOR_VERIFIED_RECEIPT':'REVIEW_REQUIRED';
 return {source:'CANONICAL_GOAL_CONTINUATION',status,
  reason:status==='PAUSED'?'CHAT_IDENTITY_OR_SCOPE_PAUSED':
    status==='WAITING_FOR_VERIFIED_RECEIPT'?'NO_NEW_TRUSTED_RECEIPT':
    status==='RECONCILE_REQUIRED'?'UNRESOLVED_EFFECT_OR_CHECKPOINT':
    status==='DONE_RECORDED'?'RECORDED_TERMINAL_NOT_INDEPENDENT_QA':
    status==='STOPPED'?'STOP_RECORDED':
    status==='BLOCKED'?'WORKSPACE_INACTIVE':'REVIEW_REQUIRED',
  workspaceId,goalId:goal.goalId,goalRevision:goal.revision,
  checkpointVersion:checkpoint.version,contextRevision:binding.contextRevision,
  stateKey,trackedStateUnchanged:stateKey===knownStateKey,
  // No text, transcript, source proof or private state is projected.
  nextPromptAllowed:false,qa:'NOT_EXECUTED',chatTurnVerified:false};
}

export function createVerifiedGoalRuntime({paths,host}={}){
 if(!paths||typeof paths!=='object'||Array.isArray(paths)||
    PATHS.some(p=>typeof paths[p]!=='string'||!isAbsolute(paths[p])||!paths[p].trim()))
  throw Error('ABSOLUTE_GOAL_RUNTIME_PATHS_REQUIRED');
 const values=PATHS.map(p=>resolve(paths[p]));
 // Prevent different canonical stores accidentally sharing one disk file or
 // lease path (including case-insensitive collisions on Windows).
 const names=process.platform==='win32'?values.map(x=>x.toLowerCase()):values;
 if(new Set(names).size!==names.length)throw Error('GOAL_RUNTIME_STORAGE_COLLISION');
 if(!host||typeof host!=='object'||REQUIRED.some(k=>typeof host[k]!=='function'))
  throw Error('TRUSTED_GOAL_RUNTIME_HOST_REQUIRED');
 const registry=new WorkspaceRegistry(values[0]);
 const outbox=new PromptOutbox(values[1]);
 const checkpointStore=new CheckpointStore(values[2]);
 const withLease=createSchedulerFileLease(values[3]);
 const reviewer=new GitHubGoalReview({registry,outbox,
  sourceFactory:host.sourceFactory,receiptFactory:host.receiptFactory,
  verifyTurn:host.verifyTurn,readGoal:host.readGoal,
  readCheckpoint:()=>checkpointStore.read(),withLease});
 const feedback=new StructuredWorkerFeedback({
  readResult:host.readResult,verifyResult:host.verifyResult});
 const guarded=new TrustedGoalReview({review:reviewer,feedback,
  readIdentity:host.readIdentity});
 const runtime=new GoalReviewReconciliation({review:guarded,registry,
  outbox,checkpointStore,readHead:host.readHead,
  authorize:host.authorize,withLease});
 // One bounded status read per request; no worker, GitHub or model calls.
 // The caller may supply a previous opaque key only to suppress redundant
 // context presentation, never to skip native scope/revision checks.
 const continuationStatus=async({workspaceId,knownStateKey=null}={})=>{
  if(!WS.test(workspaceId??''))return hold('INVALID_WORKSPACE_ID');
  if(knownStateKey!==null&&
     (typeof knownStateKey!=='string'||!/^[a-f0-9]{64}$/.test(knownStateKey)))
   return hold('INVALID_KNOWN_STATE_KEY');
  try{return await withLease(async()=>{
    const [checkpoint,snapshot]=await Promise.all([
      checkpointStore.read(),registry.read()]);
    return projectContinuation({workspaceId,checkpoint,registry:snapshot,knownStateKey});
  });}catch{return hold('GOAL_CONTINUATION_STATE_UNAVAILABLE');}
 };
 // Read-only goal guardian, admitted through the same native-injected
 // supervisor composition and scheduler lease. Not a public send or worker API.
 const guardianReview=async({workspaceId,receipt=null,maxCommits=32}={})=>{
  if(!WS.test(workspaceId??''))return hold('INVALID_WORKSPACE_ID');
  try{return await withLease(async()=>{
    const [checkpoint,snapshot]=await Promise.all([
      checkpointStore.read(),registry.read()]);
    const binding=snapshot.workspaces.find(w=>w.workspaceId===workspaceId);
    // Do not call an agent when the goal/chat has not been authenticated.
    if(!checkpoint?.goalContract||checkpoint.phase!=='WAITING'||
       checkpoint.chatState!=='BOUND_VERIFIED'||binding?.status!=='READY')
      return assessGoalGuardian({checkpoint,binding});
    // No host-supplied receipt event: do not repeat the expensive verified
    // worker/GitHub/QA chain just because a caller asked for status.
    if(receipt===null)return {status:'REVIEW_REQUIRED',
      reason:'VERIFIED_RECEIPT_EVENT_REQUIRED',reviewAdmissible:false,
      nextPromptAllowed:false,chatTurnVerified:false,
      semanticAlignmentVerified:false};
    const review=await guarded.inspectUnderLease({workspaceId,receipt,maxCommits});
    return assessGoalGuardian({checkpoint,binding,review});
  });}catch{return hold('GOAL_GUARDIAN_HOST_OR_STATE_UNAVAILABLE');}
 };
 return Object.freeze({
  // The caller cannot supply a model-produced proposal or new target paths.
  reconcile:({workspaceId,receipt=null,maxCommits=32}={})=>
   WS.test(workspaceId??'')?runtime.apply({workspaceId,receipt,maxCommits}):
   Promise.resolve(hold('INVALID_WORKSPACE_ID')),
  recover:({workspaceId}={})=>WS.test(workspaceId??'')?
   runtime.recover({workspaceId}):Promise.resolve(hold('INVALID_WORKSPACE_ID')),
  // Leased read-only source inspection; not a verified chat turn or DONE.
  sourceProgress:({workspaceId,maxCommits=32}={})=>WS.test(workspaceId??'')?
   reviewer.inspectSourceProgress({workspaceId,maxCommits}):
   Promise.resolve(hold('INVALID_WORKSPACE_ID')),
  guardianReview,
  continuationStatus
 });
}


// Opt-in native-host composition that binds three previously independent
// GitHub callbacks to one pinned project and one host-owned QA verifier.
// This must only be constructed with a separately authenticated native host;
// the caller cannot supply a source/receipt/head provider of its own.
const EVIDENCE_HOST_KEYS=['readGoal','verifyTurn','readIdentity','readResult',
 'verifyResult','authorize','verifyReceipt'];
export function createVerifiedGoalRuntimeWithGitHub({paths,host,github}={}){
 if(!host||typeof host!=='object'||Array.isArray(host)||
    EVIDENCE_HOST_KEYS.some(k=>typeof host[k]!=='function')||
    Object.keys(host).some(k=>!EVIDENCE_HOST_KEYS.includes(k)))
  throw Error('TRUSTED_SCOPED_GOAL_HOST_REQUIRED');
 if(!github||typeof github!=='object'||Array.isArray(github)||
    Object.keys(github).some(k=>!['token','scope','fetchImpl'].includes(k)))
  throw Error('TRUSTED_SCOPED_GITHUB_CONFIG_REQUIRED');
 const providers=createScopedGoalEvidenceProviders({...github,
  verifyReceipt:host.verifyReceipt});
 const {verifyReceipt,...hostCallbacks}=host;
 return createVerifiedGoalRuntime({paths,host:{...hostCallbacks,...providers}});
}
