import {evaluateContinuation} from '../supervisor/decision-engine.mjs';

// Read-only join of existing workspace, prompt outbox, trusted turn evidence,
// and SHA-pinned GitHub progress. Not a ChatGPT transport or dispatch authority.
const WS=/^workspace-(0[1-9]|10)$/;
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const SHA=/^[a-f0-9]{40}$/;
const result=(status,reason,extra={})=>({status,reason,nextPromptAllowed:false,...extra});
const scopeMatches=(scope,w)=>scope?.repository===w.repository&&scope?.branch===w.branch;
const finish=(x,proof)=>result(x.status,x.reason,{source:proof??null});

export class GitHubGoalReview {
  constructor({registry,outbox,sourceFactory,receiptFactory,verifyTurn,readGoal,
    readCheckpoint,withLease,decide=evaluateContinuation}={}){
    if(typeof registry?.read!=='function'||typeof outbox?.pending!=='function'||
      [sourceFactory,receiptFactory,verifyTurn,readGoal,readCheckpoint,withLease,decide]
        .some(x=>typeof x!=='function'))
      throw Error('GITHUB_GOAL_REVIEW_DEPENDENCIES_REQUIRED');
    Object.assign(this,{registry,outbox,sourceFactory,receiptFactory,verifyTurn,
      readGoal,readCheckpoint,withLease,decide});
  }
  async inspect({workspaceId,proposal={},receipt=null,maxCommits=32}={}){
    if(!WS.test(workspaceId??'')||!Number.isSafeInteger(maxCommits)||
       maxCommits<1||maxCommits>100)
      return result('BLOCKED','INVALID_REVIEW_SCOPE');
    try{return await this.withLease(()=>this.#inspect({workspaceId,proposal,receipt,maxCommits}));}
    catch{return result('BLOCKED','REVIEW_LEASE_OR_HOST_UNAVAILABLE');}
  }
  async #inspect({workspaceId,proposal,receipt,maxCommits}){
    let snapshot,items;
    try {
      snapshot=await this.registry.read();
      items=await this.outbox.pending(workspaceId);
    } catch {return result('BLOCKED','PERSISTED_STATE_UNAVAILABLE');}
    const w=snapshot?.workspaces?.find(x=>x.workspaceId===workspaceId);
    if(!w)return result('BLOCKED','WORKSPACE_NOT_FOUND');
    if(w.status!=='READY')return result(w.status,'WORKSPACE_NOT_READY');
    if(!Array.isArray(items)||items.length!==1)
      return result('WAITING','EXACTLY_ONE_PENDING_PROMPT_REQUIRED');
    const pending=items[0];
    if(pending.state!=='ACKNOWLEDGED'||pending.workspaceId!==workspaceId||
       pending.sessionId!==w.sessionId||pending.contextRevision!==w.contextRevision||
       !w.taskIds.includes(pending.taskId)||!ID.test(pending.promptId??'')||
       !ID.test(pending.responseHandle??''))
      return result('WAITING','OUTBOX_RESPONSE_NOT_ACKNOWLEDGED');
    let goal,checkpoint,source,receipts;
    try {
      [goal,checkpoint]=await Promise.all([
        this.readGoal({workspaceId,sessionId:w.sessionId}),
        this.readCheckpoint({workspaceId,sessionId:w.sessionId})]);
      source=await this.sourceFactory({workspaceId,repository:w.repository,branch:w.branch});
      receipts=await this.receiptFactory({workspaceId,repository:w.repository,branch:w.branch,source});
    } catch{return result('BLOCKED','TRUSTED_REVIEW_PROVIDERS_UNAVAILABLE');}
    if(!goal||!ID.test(goal.id??'')||!scopeMatches(goal,w)||
       !source||!scopeMatches(source.scope,w)||typeof source.changesSince!=='function'||
       !receipts||!scopeMatches(receipts.scope,w)||typeof receipts.reconcile!=='function'||
       !checkpoint||checkpoint.headSha!==w.headSha||
       (checkpoint.sessionId!==undefined&&checkpoint.sessionId!==w.sessionId)||
       !SHA.test(w.headSha??''))
      return result('BLOCKED','UNTRUSTED_GOAL_OR_CHECKPOINT_SCOPE');
    let turn;
    try {turn=await this.verifyTurn({workspaceId,sessionId:w.sessionId,
      taskId:pending.taskId,promptId:pending.promptId,responseHandle:pending.responseHandle,
      contextRevision:w.contextRevision});}
    catch{return result('WAITING','TRUSTED_CHAT_TURN_UNAVAILABLE');}
    // A browser's UI_COMPLETED_OBSERVED signal is NOT a verified final turn.
    if(turn?.verified!==true||turn.source!=='TRUSTED_HOST'||
       turn.status!=='TURN_COMPLETED'||turn.workspaceId!==workspaceId||
       turn.sessionId!==w.sessionId||turn.taskId!==pending.taskId||
       turn.promptId!==pending.promptId||turn.responseHandle!==pending.responseHandle||
       turn.contextRevision!==w.contextRevision||!ID.test(turn.responseId??''))
      return result('WAITING','CHAT_TURN_NOT_AUTHORITATIVELY_CONFIRMED');
    let progress;
    try {progress=await source.changesSince({baseSha:w.headSha,maxCommits});}
    catch{return result('BLOCKED','GITHUB_PROGRESS_UNAVAILABLE_OR_DIVERGED');}
    if(!scopeMatches(progress,w)||progress.baseSha!==w.headSha||
       !SHA.test(progress.headSha??'')||typeof progress.changed!=='boolean'||
       !Array.isArray(progress.commits)||progress.commits.length>maxCommits||
       (progress.changed!==Boolean(progress.commits.length))||
       (progress.changed&&progress.commits.at(-1)?.sha!==progress.headSha)||
       (!progress.changed&&progress.headSha!==w.headSha)||
       progress.commits.some(c=>!SHA.test(c?.sha??'')||
         typeof c.summary!=='string'||c.summary.length>160)||
       new Set(progress.commits.map(c=>c.sha)).size!==progress.commits.length)
      return result('BLOCKED','GITHUB_SOURCE_PROVENANCE_MISMATCH');
    const project={repository:w.repository,branch:w.branch,headSha:progress.headSha,
      baseSha:w.headSha,commits:progress.commits.map(c=>({sha:c.sha,summary:c.summary})),
      changed:progress.changed,qa:'NOT_EXECUTED',acceptancePassed:false};
    // GitHub commits alone are not ChatGPT's last answer, QA evidence, or
    // permission to advance. Return compact diff pointers for Codex review.
    if(!receipt)return result('REVIEW_REQUIRED','TRUSTED_MILESTONE_RECEIPT_MISSING',
      {source:project});
    let checked;
    try {checked=await receipts.reconcile({goal,observation:{
      headSha:progress.headSha,promptId:pending.promptId},receipt});}
    catch{return finish(result('REVIEW_REQUIRED','TRUSTED_MILESTONE_RECONCILIATION_FAILED'),project);}
    if(checked?.verified!==true||checked.reason!=='TRUSTED_RECEIPT'||
       !scopeMatches(checked,w)||checked.headSha!==progress.headSha||
       checked.changed!==progress.changed||
       !['PASS','FAIL','NOT_EXECUTED'].includes(checked.qa))
      return result('REVIEW_REQUIRED','MILESTONE_RECEIPT_UNVERIFIED_OR_CONTRADICTORY',
        {source:project});
    const evidence={...checked,verified:true,repository:w.repository,
      branch:w.branch,headSha:progress.headSha};
    const observation={complete:true,taskId:pending.taskId,resultId:turn.responseId,
      headSha:progress.headSha,outcome:proposal?.outcome,
      nextAction:proposal?.nextAction,requiresApproval:proposal?.requiresApproval,
      blocked:proposal?.blocked};
    let decision;
    try {decision=this.decide({goal,checkpoint,observation,evidence});}
    catch{return result('BLOCKED','SUPERVISOR_DECISION_UNAVAILABLE',{source:project});}
    if(!decision||!['READY','DONE','WAITING','BLOCKED','PAUSED','STOPPED'].includes(decision.state))
      return result('BLOCKED','INVALID_SUPERVISOR_DECISION',{source:project});
    // Preview only; existing registry/outbox remain the sole durable owners.
    // A separate host-authorized CAS+outbox reconciliation must happen before
    // any next prompt can be sent, including after a successful review.
    return result('REVIEWED',decision.reason,{source:{...project,qa:checked.qa,
      acceptancePassed:checked.acceptancePassed},
      decision,workspaceId,sessionId:w.sessionId,promptId:pending.promptId,
      responseId:turn.responseId,requiresDurableHostReconciliation:true});
  }
}
