import {evaluateContinuation} from "./decision-engine.mjs";

// One-step controller. External dispatch is denied unless an independent trusted broker
// authorizes the exact task and HEAD. The agent adapter must enforce the receipt too.
export class SupervisorOrchestrator {
  constructor({checkpointStore,evidenceProvider,agentAdapter,authorizeDispatch,recoveryJournal=null}={}){
    if(!checkpointStore||!evidenceProvider||!agentAdapter||typeof authorizeDispatch!=="function")
      throw new Error("TRUSTED_DEPENDENCIES_REQUIRED");
    this.store=checkpointStore;this.evidence=evidenceProvider;
    this.agent=agentAdapter;this.authorizeDispatch=authorizeDispatch;this.journal=recoveryJournal;
  }
  async inspect({goal,observation,checkpoint,receipt}){
    if(!goal||!observation||!checkpoint)return {decision:{state:"BLOCKED",reason:"MISSING_CONTEXT"},evidence:null};
    const evidence=await this.evidence.reconcile({goal,observation,receipt});
    const decision=evaluateContinuation({goal,observation,evidence,checkpoint});
    return {decision,evidence};
  }
  async reserveAndDispatch({goal,observation,checkpoint,taskId,grantId,receipt,workspaceId}){
    const {decision,evidence}=await this.inspect({goal,observation,checkpoint,receipt});
    if(decision.state!=="READY"||!decision.prompt)return {status:"NOT_DISPATCHED",decision};
    if(checkpoint.goalId!==goal.id||checkpoint.phase!=="READY"||
       !/^[A-Za-z0-9:_-]{1,128}$/.test(taskId??"")||
       !/^[a-f0-9]{40}$/.test(evidence?.headSha??""))
      return {status:"NOT_DISPATCHED",reason:"INVALID_DISPATCH_CONTEXT"};
    const journal=async type=>{if(this.journal){
      if(!/^[A-Za-z0-9:_-]{1,128}$/.test(workspaceId??""))throw new Error("WORKSPACE_ID_REQUIRED");
      await this.journal.append({workspaceId,taskId,type,sourceSha:evidence.headSha});
    }};
    // Journal intent before grant consumption; unknown journal state fails closed.
    try{await journal("INTENT_RECORDED");}catch{return {status:"RECONCILE_REQUIRED",reason:"JOURNAL_INTENT_UNKNOWN"};}
    // Authorization is a trusted host callback, never a flag from the worker.
    const grant=await this.authorizeDispatch({
      grantId,goalId:goal.id,taskId,repository:goal.repository,
      branch:goal.branch,expectedHead:evidence.headSha,operation:"agent-dispatch"
    });
    if(!grant||grant.authorized!==true||grant.taskId!==taskId)
      return {status:"NOT_DISPATCHED",reason:grant?.reason??"AUTHORIZATION_DENIED"};
    try{await journal("GRANT_RESERVED");}catch{return {status:"RECONCILE_REQUIRED",reason:"GRANT_RESERVED_JOURNAL_UNKNOWN"};}
    // Reservation must be committed before any external send.
    let reservation;
    try{
      reservation=await this.store.apply({
        type:"RESERVE",goalId:goal.id,expectedVersion:checkpoint.version,taskId
      });
    }catch{
      return {status:"RECONCILE_REQUIRED",reason:"RESERVATION_COMMIT_UNKNOWN"};
    }
    if(!reservation.ok)return {status:"RECONCILE_REQUIRED",reason:"GRANT_CONSUMED_CHECKPOINT_NOT_RESERVED"};
    try{
      await journal("CHECKPOINT_RESERVED");
      await journal("DISPATCH_ATTEMPTED");
      const ack=await this.agent.dispatch({
        goalId:goal.id,taskId,prompt:decision.prompt,repository:goal.repository,
        branch:goal.branch,authorizationReceipt:grant
      });
      if(!ack||typeof ack.receiptId!=="string"||!ack.receiptId)
        throw new Error("MISSING_DISPATCH_RECEIPT");
      const committed=await this.store.apply({
        type:"DISPATCH_ACK",goalId:goal.id,expectedVersion:reservation.checkpoint.version,
        taskId,receiptId:ack.receiptId
      });
      if(!committed.ok)throw new Error("ACK_CHECKPOINT_FAILED");
      await journal("ACK_RECORDED");
      return {status:"DISPATCHED",receiptId:ack.receiptId,decision};
    }catch(error){
      // If send succeeded but acknowledgement was lost, outcome is unknown.
      await journal("RECONCILE_REQUIRED").catch(()=>{});
      await this.store.apply({
        type:"DISPATCH_UNCERTAIN",goalId:goal.id,
        expectedVersion:reservation.checkpoint.version,taskId
      }).catch(()=>{});
      return {status:"RECONCILE_REQUIRED",reason:"DISPATCH_OUTCOME_UNKNOWN"};
    }
  }
}
