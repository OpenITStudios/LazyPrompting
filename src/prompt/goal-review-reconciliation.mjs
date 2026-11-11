import {createHash} from 'node:crypto';

// Host-owned, durable reconciliation of a verified, READ-ONLY goal review.
// Never sends a chat prompt, grants permissions, or writes a repository.
// The host MUST provide its exclusive scheduler lease and native authority.
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const SHA=/^[a-f0-9]{40}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const WS=/^workspace-(0[1-9]|10)$/;
const deny=(status,reason)=>({status,reason,nextPromptAllowed:false});
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const valid=x=>typeof x==='string'&&ID.test(x);
const validReview=r=>r&&SHA.test(r.baseSha??'')&&SHA.test(r.headSha??'')&&
  [r.goalId,r.workspaceId,r.sessionId,r.taskId,r.promptId,r.responseHandle,r.responseId].every(valid)&&
  WS.test(r.workspaceId)&&Number.isSafeInteger(r.contextRevision)&&r.contextRevision>=0&&
  Number.isSafeInteger(r.checkpointVersion)&&r.checkpointVersion>=0&&
  ['READY','DONE'].includes(r.targetPhase)&&['PASS','FAIL','NOT_EXECUTED'].includes(r.qa)&&
  (r.targetPhase!=='DONE'||(r.qa==='PASS'&&r.acceptancePassed===true))&&
  typeof r.reason==='string'&&r.reason.length<=160&&
  typeof r.repository==='string'&&/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/.test(r.repository)&&
  typeof r.branch==='string'&&/^[A-Za-z0-9._/-]{1,200}$/.test(r.branch)&&
  !r.branch.includes('..')&&!r.branch.includes('//')&&!r.branch.startsWith('/')&&!r.branch.endsWith('/')&&
  DIGEST.test(r.reviewId??'')&&r.reviewId===digest(Object.fromEntries(Object.entries(r).filter(([key])=>key!=='reviewId')));

export class GoalReviewReconciliation {
  constructor({review,registry,outbox,checkpointStore,readHead,authorize,withLease}={}){
    if(typeof review?.inspectUnderLease!=='function'||typeof registry?.read!=='function'||
      typeof registry?.mutate!=='function'||typeof outbox?.read!=='function'||
      typeof outbox?.reconcile!=='function'||typeof checkpointStore?.read!=='function'||
      typeof checkpointStore?.apply!=='function'||
      [readHead,authorize,withLease].some(x=>typeof x!=='function'))
      throw Error('GOAL_RECONCILIATION_HOST_DEPENDENCIES_REQUIRED');
    Object.assign(this,{review,registry,outbox,checkpointStore,readHead,authorize,withLease});
  }
  async apply({workspaceId,proposal,receipt,maxCommits=32}={}){
    if(!WS.test(workspaceId??''))return deny('BLOCKED','INVALID_WORKSPACE_ID');
    try{return await this.withLease(async()=>{
      const state=await this.checkpointStore.read();
      if(state?.phase==='RECONCILE_REQUIRED'&&state.review){
        if(state.review.workspaceId!==workspaceId)return deny('BLOCKED','ACTIVE_REVIEW_BELONGS_TO_OTHER_WORKSPACE');
        return this.#finishPrepared(state);
      }
      if(state?.phase==='DONE'||state?.phase==='STOPPED')return deny(state.phase,'TERMINAL_CHECKPOINT');
      const result=await this.review.inspectUnderLease({workspaceId,proposal,receipt,maxCommits});
      if(result?.status!=='REVIEWED')return result??deny('BLOCKED','REVIEW_UNAVAILABLE');
      const decision=result.decision,src=result.source;
      if(!decision||!['READY','DONE'].includes(decision.state)||!src||
        result.requiresDurableHostReconciliation!==true||
        !valid(result.goalId)||!valid(result.taskId)||!valid(result.responseHandle))
        return deny('BLOCKED','REVIEW_NOT_ELIGIBLE_FOR_COMMIT');
      if(decision.state==='DONE'&&(src.qa!=='PASS'||src.acceptancePassed!==true))
        return deny('BLOCKED','GOAL_ACCEPTANCE_NOT_VERIFIED');
      if(!state||state.version!==result.checkpointVersion||state.goalId!==result.goalId||
        state.phase!=='WAITING'||state.pendingTaskId!==result.taskId||
        state.headSha!==src.baseSha||
        (state.workspaceId!==undefined&&state.workspaceId!==workspaceId)||
        (state.sessionId!==undefined&&state.sessionId!==result.sessionId))
        return deny('BLOCKED','CHECKPOINT_MOVED_SINCE_REVIEW');
      const record={goalId:result.goalId,workspaceId,sessionId:result.sessionId,
        taskId:result.taskId,promptId:result.promptId,responseHandle:result.responseHandle,
        responseId:result.responseId,contextRevision:result.contextRevision,
        checkpointVersion:result.checkpointVersion,repository:src.repository,branch:src.branch,
        baseSha:src.baseSha,headSha:src.headSha,targetPhase:decision.state,
        qa:src.qa,acceptancePassed:src.acceptancePassed===true,reason:decision.reason};
      record.reviewId=digest(record);
      if(!validReview(record))return deny('BLOCKED','INVALID_REVIEW_RECORD');
      const binding=await this.#readBoundState(record,{allowCommitted:false});
      if(binding.status!=='READY')return binding;
      if(!(await this.#sourceAndAuthorityValid(record)))
        return deny('BLOCKED','NATIVE_AUTHORIZATION_OR_HEAD_MISMATCH');
      const prepare=await this.checkpointStore.apply({type:'REVIEW_PREPARE',
        expectedVersion:state.version,goalId:record.goalId,taskId:record.taskId,
        review:record,trustedEvidence:true});
      if(prepare?.ok!==true)return deny('BLOCKED','REVIEW_PREPARE_REJECTED');
      return this.#finishPrepared(prepare.checkpoint,{authorized:true});
    });}catch{return deny('RECONCILE_REQUIRED','GOAL_RECONCILIATION_UNCERTAIN');}
  }
  async recover({workspaceId}={}){
    if(!WS.test(workspaceId??''))return deny('BLOCKED','INVALID_WORKSPACE_ID');
    try{return await this.withLease(async()=>{
      const state=await this.checkpointStore.read();
      if(state?.review&&state.phase==='RECONCILE_REQUIRED'){
        if(state.review.workspaceId!==workspaceId)return deny('BLOCKED','ACTIVE_REVIEW_BELONGS_TO_OTHER_WORKSPACE');
        return this.#finishPrepared(state);
      }
      if(state?.lastReview?.workspaceId===workspaceId&&
         ['READY','DONE'].includes(state.phase))
        return {...deny('ALREADY_RECONCILED','REVIEW_ALREADY_COMMITTED'),
          reviewId:state.lastReview.reviewId,phase:state.phase};
      return deny('BLOCKED','NO_PREPARED_REVIEW');
    });}catch{return deny('RECONCILE_REQUIRED','GOAL_RECOVERY_UNCERTAIN');}
  }
  async #headMatches(record){
    const head=await this.readHead({repository:record.repository,branch:record.branch});
    return head?.repository===record.repository&&head?.branch===record.branch&&
      head?.headSha===record.headSha;
  }
  async #sourceAndAuthorityValid(record){
    const [headValid,authority]=await Promise.all([
      this.#headMatches(record),
      this.authorize({source:'GOAL_RECONCILIATION',operation:'RECONCILE',
        reviewId:record.reviewId,goalId:record.goalId,workspaceId:record.workspaceId,
        sessionId:record.sessionId,repository:record.repository,
        branch:record.branch,headSha:record.headSha})
    ]);
    return headValid&&authority?.trusted===true&&
      authority?.source==='NATIVE_HOST'&&authority?.operation==='RECONCILE'&&
      authority?.reviewId===record.reviewId&&authority?.goalId===record.goalId&&
      authority?.workspaceId===record.workspaceId&&authority?.sessionId===record.sessionId&&
      authority?.repository===record.repository&&authority?.branch===record.branch&&
      authority?.headSha===record.headSha;
  }
  async #readBoundState(record,{allowCommitted}){
    const [r,o]=await Promise.all([this.registry.read(),this.outbox.read()]);
    const w=r?.workspaces?.find(w=>w.workspaceId===record.workspaceId);
    if(!Number.isSafeInteger(r?.version)||!w||w.status!=='READY'||
       w.sessionId!==record.sessionId||w.repository!==record.repository||
       w.branch!==record.branch||w.contextRevision!==record.contextRevision||
       !w.taskIds?.includes(record.taskId)||
       (w.headSha!==record.baseSha&&w.headSha!==record.headSha)||
       (w.headSha===record.headSha&&w.headSha!==record.baseSha&&
        w.lastGoalReviewId!==record.reviewId))
      return deny('RECONCILE_REQUIRED','WORKSPACE_BINDING_MOVED');
    const items=o?.items?.filter(item=>item.workspaceId===record.workspaceId&&item.promptId===record.promptId);
    const otherPending=o?.items?.some(item=>item.workspaceId===record.workspaceId&&
      item.promptId!==record.promptId&&item.state!=='RESPONSE_VERIFIED');
    const item=items?.[0];
    if(items?.length!==1||otherPending||item.sessionId!==record.sessionId||
      item.taskId!==record.taskId||item.contextRevision!==record.contextRevision||
      item.responseHandle!==record.responseHandle||
      !(item.state==='ACKNOWLEDGED'||allowCommitted&&item.state==='RESPONSE_VERIFIED'&&
        item.responseId===record.responseId))
      return deny('RECONCILE_REQUIRED','PROMPT_BINDING_MOVED');
    return {status:'READY',registry:r,workspace:w,item};
  }
  async #finishPrepared(state,{authorized=false}={}){
    const record=state?.review;
    if(state.phase!=='RECONCILE_REQUIRED'||!validReview(record)||
      state.goalId!==record.goalId||state.pendingTaskId!==record.taskId||
      state.headSha!==record.baseSha)
      return deny('BLOCKED','INVALID_PREPARED_REVIEW');
    const binding=await this.#readBoundState(record,{allowCommitted:true});
    if(binding.status!=='READY')return binding;
    if(!(await (authorized?this.#headMatches(record):this.#sourceAndAuthorityValid(record))))
      return deny('RECONCILE_REQUIRED','NATIVE_AUTHORIZATION_OR_HEAD_MISMATCH');
    if(binding.workspace.lastGoalReviewId!==record.reviewId){
      const update=await this.registry.mutate(binding.registry.version,current=>{
        const w=current.workspaces.find(w=>w.workspaceId===record.workspaceId);
        if(!w||w.status!=='READY'||w.sessionId!==record.sessionId||
           w.headSha!==record.baseSha||w.contextRevision!==record.contextRevision||
           w.repository!==record.repository||w.branch!==record.branch)
          throw Error('STALE_REVIEW_WORKSPACE');
        w.headSha=record.headSha;w.lastGoalReviewId=record.reviewId;
        current.version++;return current;
      });
      if(update?.ok!==true)return deny('RECONCILE_REQUIRED','REGISTRY_CAS_FAILED');
    }
    if(binding.item.state==='ACKNOWLEDGED'){
      await this.outbox.reconcile({workspaceId:record.workspaceId,promptId:record.promptId,
        responseId:record.responseId,verified:true});
    }
    // Verify all persisted effects (and external branch HEAD) before ready/DONE.
    const finalBinding=await this.#readBoundState(record,{allowCommitted:true});
    if(finalBinding.status!=='READY'||finalBinding.workspace.headSha!==record.headSha||
      finalBinding.workspace.lastGoalReviewId!==record.reviewId||
      finalBinding.item.state!=='RESPONSE_VERIFIED'||
      finalBinding.item.responseId!==record.responseId)
      return deny('RECONCILE_REQUIRED','RECONCILIATION_EFFECT_NOT_VERIFIED');
    if(!(await this.#headMatches(record)))
      return deny('RECONCILE_REQUIRED','HEAD_MOVED_BEFORE_COMMIT');
    const checkpoint=await this.checkpointStore.read();
    if(checkpoint?.version!==state.version||checkpoint.review?.reviewId!==record.reviewId)
      return deny('RECONCILE_REQUIRED','CHECKPOINT_CHANGED_DURING_REVIEW');
    const commit=await this.checkpointStore.apply({type:'REVIEW_COMMIT',
      expectedVersion:checkpoint.version,goalId:record.goalId,
      reviewId:record.reviewId,responseId:record.responseId,trustedEvidence:true});
    if(commit?.ok!==true)return deny('RECONCILE_REQUIRED','REVIEW_COMMIT_REJECTED');
    return {...deny('RECONCILED','HOST_STATE_PERSISTED'),reviewId:record.reviewId,
      workspaceId:record.workspaceId,goalId:record.goalId,
      headSha:record.headSha,phase:commit.checkpoint.phase};
  }
}
