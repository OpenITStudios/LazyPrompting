import {verifyGoalContract} from "../supervisor/goal-contract.mjs";

// Advisory only. Native authorization, independent QA and ChatGPT final-turn
// receipt remain separate. Never dispatch, infer semantic alignment, or mark DONE.
const DIGEST=/^[a-f0-9]{64}$/;
const hold=(reason,status="REVIEW_REQUIRED")=>({
 status,reason,reviewAdmissible:false,nextPromptAllowed:false,
 chatTurnVerified:false,semanticAlignmentVerified:false
});
export function assessGoalGuardian({checkpoint,binding,review}={}){
 const goal=checkpoint?.goalContract;
 if(!verifyGoalContract(goal)||
    checkpoint.goalId!==goal.goalId||checkpoint.goalHash!==goal.goalHash||
    checkpoint.workspaceId!==goal.workspaceId)
  return hold("APPROVED_GOAL_CONTRACT_REQUIRED");
 if(!binding||binding.workspaceId!==goal.workspaceId||
    binding.goalId!==goal.goalId||binding.goalHash!==goal.goalHash||
    binding.goalRevision!==goal.revision||
    binding.repository!==goal.repository||binding.branch!==goal.branch||
    checkpoint.repository!==goal.repository||checkpoint.branch!==goal.branch||
    checkpoint.headSha!==binding.headSha||
    (checkpoint.sessionId!==undefined&&checkpoint.sessionId!==binding.sessionId)||
    binding.status!=="READY")
  return hold("GOAL_WORKSPACE_SCOPE_MISMATCH");
 if(checkpoint.phase==="STOPPED"||checkpoint.phase==="DONE")
  return hold("GOAL_ALREADY_TERMINAL",checkpoint.phase);
 if(checkpoint.chatState!=="BOUND_VERIFIED")
  return hold("CHAT_IDENTITY_UNVERIFIED");
 if(checkpoint.phase!=="WAITING"||!checkpoint.pendingTaskId)
  return hold("GOAL_NOT_AWAITING_VERIFIED_RESULT");
 if(review?.status!=="REVIEWED"||review.feedbackVerified!==true||
    !DIGEST.test(review.workerFeedbackHash??""))
  return hold("TRUSTED_REVIEW_REQUIRED");
 if(review.goalId!==goal.goalId||review.workspaceId!==goal.workspaceId||
    review.sessionId!==binding.sessionId||
    review.checkpointVersion!==checkpoint.version||
    review.contextRevision!==binding.contextRevision||
    review.taskId!==checkpoint.pendingTaskId||
    review.source?.repository!==goal.repository||
    review.source?.branch!==goal.branch||
    review.source?.baseSha!==binding.headSha||
    !/^[a-f0-9]{40}$/.test(review.source?.headSha??"")||
    !["PASS","FAIL","NOT_EXECUTED"].includes(review.source?.qa))
  return hold("GOAL_REVIEW_BINDING_MISMATCH");
 if(review.decision?.state==="DONE"){
  if(review.workerReport?.outcome!=="DONE")return hold("INCONSISTENT_WORKER_OUTCOME");
  if(review.source.qa!=="PASS"||review.source.acceptancePassed!==true)
   return hold("GOAL_ACCEPTANCE_NOT_VERIFIED");
  return {...hold("ACCEPTANCE_CANDIDATE_VERIFIED","DONE_CANDIDATE"),
   reviewAdmissible:true};
 }
 if(review.decision?.state!=="READY")
  return hold("NO_AUTHORIZED_CONTINUATION");
 if(review.workerReport?.outcome!=="CONTINUE")
  return hold("INCONSISTENT_WORKER_OUTCOME");
 const next=review.workerReport?.nextAction;
 if(!next||typeof next.action!=="string"||
    !goal.allowedActions.includes(next.action)||
    // Supervisor action is a control decision (CONTINUE), not the
    // worker's domain-specific nextAction string. Check BOTH independently.
    review.decision.action!=="CONTINUE"||
    next.requiresApproval===true)
  return hold("NEXT_ACTION_OUTSIDE_APPROVED_GOAL");
 // Exact action identity is necessary, but cannot prove semantic compliance.
 return {...hold("APPROVED_ACTION_CANDIDATE","IN_SCOPE_CANDIDATE"),
  reviewAdmissible:true,
  action:next.action};
}
