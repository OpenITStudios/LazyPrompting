import {evaluateContinuation} from "./decision-engine.mjs";

// Explicitly invoked one-step controller. Never runs unattended or dispatches without a trusted host.
export class SupervisorOrchestrator {
  constructor({checkpointStore,evidenceProvider,agentAdapter}={}){
    if(!checkpointStore||!evidenceProvider||!agentAdapter)throw new Error("DEPENDENCIES_REQUIRED");
    this.store=checkpointStore;this.evidence=evidenceProvider;this.agent=agentAdapter;
  }
  async inspect({goal,observation,checkpoint}){
    const head=await this.evidence.reconcile({
      repository:goal.repository,branch:goal.branch,claimedSha:observation?.headSha
    });
    const evidence={...head,changed:false,qa:"NOT_EXECUTED",acceptancePassed:false};
    const decision=evaluateContinuation({goal,observation,evidence,checkpoint});
    return {decision,evidence};
  }
  async reserveAndDispatch({goal,observation,checkpoint,taskId}){
    const {decision}=await this.inspect({goal,observation,checkpoint});
    if(decision.state!=="READY"||!decision.prompt) return {status:"NOT_DISPATCHED",decision};
    if(checkpoint.goalId!==goal.id||checkpoint.phase!=="READY")throw new Error("CHECKPOINT_NOT_READY");
    const reservation=await this.store.apply({type:"RESERVE",goalId:goal.id,expectedVersion:checkpoint.version,taskId});
    if(!reservation.ok)return {status:"NOT_DISPATCHED",reason:reservation.reason};
    try {
      const receipt=await this.agent.dispatch({goalId:goal.id,taskId,prompt:decision.prompt,repository:goal.repository,branch:goal.branch});
      if(!receipt||typeof receipt.receiptId!=="string")throw new Error("MISSING_DISPATCH_RECEIPT");
      const ack=await this.store.apply({type:"DISPATCH_ACK",goalId:goal.id,expectedVersion:reservation.checkpoint.version,taskId,receiptId:receipt.receiptId});
      if(!ack.ok)throw new Error("ACK_CHECKPOINT_FAILED");
      return {status:"DISPATCHED",receiptId:receipt.receiptId,decision};
    }catch(error){
      // Unknown delivery: never resend automatically.
      await this.store.apply({type:"DISPATCH_UNCERTAIN",goalId:goal.id,expectedVersion:reservation.checkpoint.version,taskId}).catch(()=>{});
      return {status:"RECONCILE_REQUIRED",reason:String(error?.message??error)};
    }
  }
}
