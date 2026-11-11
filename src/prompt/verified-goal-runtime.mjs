import {isAbsolute,resolve} from 'node:path';
import {WorkspaceRegistry} from '../runtime/workspace-registry.mjs';
import {PromptOutbox} from './prompt-outbox.mjs';
import {CheckpointStore} from '../supervisor/checkpoint-store.mjs';
import {createSchedulerFileLease} from './scheduler-file-lease.mjs';
import {GitHubGoalReview} from './github-goal-review.mjs';
import {StructuredWorkerFeedback} from './structured-worker-feedback.mjs';
import {TrustedGoalReview} from './trusted-goal-review.mjs';
import {GoalReviewReconciliation} from './goal-review-reconciliation.mjs';

// Single native-host composition. Not a public MCP endpoint, sender, API
// client, or alternative state owner. All external evidence remains injected
// by a separately authenticated host. No default startup instantiates this.
const WS=/^workspace-(0[1-9]|10)$/;
const REQUIRED=['readGoal','sourceFactory','receiptFactory','verifyTurn',
 'readIdentity','readResult','verifyResult','readHead','authorize'];
const PATHS=['registryPath','outboxPath','checkpointPath','schedulerLeasePath'];
const hold=(reason)=>({status:'BLOCKED',reason,nextPromptAllowed:false});

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
 return Object.freeze({
  // The caller cannot supply a model-produced proposal or new target paths.
  reconcile:({workspaceId,receipt=null,maxCommits=32}={})=>
   WS.test(workspaceId??'')?runtime.apply({workspaceId,receipt,maxCommits}):
   Promise.resolve(hold('INVALID_WORKSPACE_ID')),
  recover:({workspaceId}={})=>WS.test(workspaceId??'')?
   runtime.recover({workspaceId}):Promise.resolve(hold('INVALID_WORKSPACE_ID'))
 });
}
