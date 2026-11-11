// Host-only composition. The MCP caller's "proposal" is never used as a
// worker report. Agent feedback is attested against one verified turn before
// the existing read-only GitHub review may propose a continuation.
const WS=/^workspace-(0[1-9]|10)$/;
const DIGEST=/^[a-f0-9]{64}$/;
const KEYS=['goalId','workspaceId','sessionId','taskId','promptId',
  'responseHandle','responseId','contextRevision'];
const fail=(reason,extra={})=>({status:'REVIEW_REQUIRED',reason,
  nextPromptAllowed:false,...extra});
export class TrustedGoalReview {
  constructor({review,feedback,readIdentity}={}){
    if(typeof review?.inspectUnderLease!=='function'||
       typeof feedback?.resolve!=='function'||typeof readIdentity!=='function')
      throw Error('TRUSTED_GOAL_REVIEW_HOST_REQUIRED');
    Object.assign(this,{review,feedback,readIdentity});
  }
  // Caller holds one host scheduler lease. In particular, *do not* expose
  // this wrapper directly as a provider controlled by untrusted MCP args.
  async inspectUnderLease({workspaceId,receipt=null,maxCommits=32}={}){
    if(!WS.test(workspaceId??''))return fail('INVALID_WORKSPACE_ID');
    let scope,feedback;
    try{
      scope=await this.readIdentity({workspaceId});
      if(!scope||scope.workspaceId!==workspaceId||
         !Array.isArray(scope.allowedActions))return fail('BOUND_WORKER_IDENTITY_UNAVAILABLE');
      const {allowedActions,...identity}=scope;
      feedback=await this.feedback.resolve({identity,allowedActions});
    }catch{return fail('TRUSTED_WORKER_FEEDBACK_UNAVAILABLE');}
    if(feedback?.status!=='VERIFIED')return fail(
      feedback?.reason??'TRUSTED_WORKER_FEEDBACK_REQUIRED',
      feedback?.report?{workerReport:feedback.report}:{});
    if(!DIGEST.test(feedback.fingerprint??''))return fail('INVALID_WORKER_FEEDBACK_FINGERPRINT');
    let reviewed;
    try{
      reviewed=await this.review.inspectUnderLease({workspaceId,
        proposal:feedback.proposal,receipt,maxCommits});
    }catch{return fail('BOUND_GITHUB_REVIEW_UNAVAILABLE');}
    if(reviewed?.status!=='REVIEWED'){
      const blocked=reviewed??fail('BOUND_GITHUB_REVIEW_UNAVAILABLE');
      // A verified worker explanation is useful even when GitHub did not
      // change or QA is missing. It never substitutes for source/QA proof.
      return {...blocked,feedbackVerified:true,
        workerFeedbackHash:feedback.fingerprint,workerReport:feedback.report,
        nextPromptAllowed:false};
    }
    if(KEYS.some(k=>reviewed[k]!==scope[k])||
       reviewed.source?.repository!==scope.repository||
       reviewed.source?.branch!==scope.branch||
       reviewed.source?.baseSha!==scope.baseSha||
       !['READY','DONE'].includes(reviewed.decision?.state))
      return fail('WORKER_FEEDBACK_REVIEW_BINDING_MISMATCH');
    // The existing GitHub/QA receipts still determine whether READY or DONE
    // is appropriate. Worker summary and refs are context, not QA authority.
    return {...reviewed,feedbackVerified:true,
      workerFeedbackHash:feedback.fingerprint,workerReport:feedback.report,
      nextPromptAllowed:false};
  }
}
