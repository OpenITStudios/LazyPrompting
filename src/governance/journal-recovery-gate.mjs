// Restart gate: a journaled task must be reconciled before a new dispatch attempt.
// A final ACK is not proof of completed work; only verified result ends the task.
export class JournalRecoveryGate {
 constructor({journal,checkpointStore,replayLedger}={}){
  if(!journal||typeof journal.read!=="function"||!checkpointStore||
     typeof checkpointStore.recovery!=="function"||!replayLedger||typeof replayLedger.read!=="function")
   throw new Error("RECOVERY_PROVIDERS_REQUIRED");
  this.journal=journal;this.store=checkpointStore;this.ledger=replayLedger;
 }
 async inspect({workspaceId,taskId}={}){
  if(!/^[A-Za-z0-9:_-]{1,128}$/.test(workspaceId??"")||
     !/^[A-Za-z0-9:_-]{1,128}$/.test(taskId??""))
   return {safeToDispatch:false,reason:"INVALID_TASK_IDENTITY"};
  const [entries,checkpoint,ledger]=await Promise.all([
   this.journal.read(),this.store.recovery(),this.ledger.read()
  ]);
  const records=entries.filter(x=>x.workspaceId===workspaceId&&x.taskId===taskId);
  const reservations=ledger.reservations.filter(x=>x.taskId===taskId);
  if(records.length||reservations.length||
     checkpoint.checkpoint?.pendingTaskId===taskId)
   return {safeToDispatch:false,reason:"EXISTING_TASK_RECONCILIATION_REQUIRED",
     journalStage:records.at(-1)?.type??"NONE",checkpointState:checkpoint.state,
     replayReserved:reservations.length>0};
  if(checkpoint.state!=="READY")return {safeToDispatch:false,reason:"CHECKPOINT_NOT_READY"};
  return {safeToDispatch:true,reason:"NO_PREVIOUS_TASK_EFFECT"};
 }
}
