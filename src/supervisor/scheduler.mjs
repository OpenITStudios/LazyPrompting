// Explicit one-tick scheduler. No timers, background loop, or implicit auto-dispatch.
export class SupervisorScheduler {
  constructor({store,agent,orchestrator,maxTicks=30}={}){
    if(!store||!agent||!orchestrator||!Number.isSafeInteger(maxTicks)||maxTicks<1||maxTicks>100)
      throw new Error("INVALID_SCHEDULER_DEPENDENCIES");
    this.store=store;this.agent=agent;this.orchestrator=orchestrator;this.maxTicks=maxTicks;
    this.ticks=0;
  }
  async tick({goal,observation,checkpoint,taskId}={}){
    if(this.ticks>=this.maxTicks)return {status:"STOPPED",reason:"TICK_BUDGET"};
    this.ticks++;
    const recovered=await this.store.recovery();
    if(recovered.state==="RECONCILE_REQUIRED"){
      const pending=recovered.checkpoint?.pendingTaskId;
      if(!pending)return {status:"BLOCKED",reason:"MISSING_PENDING_TASK"};
      const result=await this.agent.observe(pending);
      if(!result||result.complete!==true||result.trustedEvidence!==true)
        return {status:"WAITING",reason:"PENDING_TASK_NOT_VERIFIED"};
      const outcome=await this.store.apply({
        type:"RESULT",goalId:recovered.checkpoint.goalId,
        expectedVersion:recovered.checkpoint.version,taskId:pending,
        resultId:result.resultId,trustedEvidence:true
      });
      return outcome.ok?{status:"RECONCILED",resultId:result.resultId}:{status:"BLOCKED",reason:outcome.reason};
    }
    if(recovered.state!=="READY")return {status:"NOT_DISPATCHED",reason:"CHECKPOINT_"+recovered.state};
    if(!goal||!observation||!checkpoint||!taskId)return {status:"BLOCKED",reason:"MISSING_TASK_CONTEXT"};
    if(recovered.checkpoint.version!==checkpoint.version||
       recovered.checkpoint.goalId!==goal.id)return {status:"BLOCKED",reason:"STALE_CALLER_CHECKPOINT"};
    return this.orchestrator.reserveAndDispatch({goal,observation,checkpoint,taskId});
  }
}
