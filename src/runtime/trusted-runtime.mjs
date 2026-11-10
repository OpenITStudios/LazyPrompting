import {CheckpointStore} from "../supervisor/checkpoint-store.mjs";
import {ReplayLedger} from "../governance/replay-ledger.mjs";
import {AuthorizationBroker} from "../governance/authorization-broker.mjs";
import {ReservationVerifier} from "../governance/reservation-verifier.mjs";
import {ReceiptReconciler} from "../integrations/receipt-reconciler.mjs";
import {OfficialAgentAdapter} from "../transport/official-agent-adapter.mjs";
import {SupervisorOrchestrator} from "../supervisor/orchestrator.mjs";
import {SupervisorScheduler} from "../supervisor/scheduler.mjs";
import {RecoveryJournal} from "../governance/recovery-journal.mjs";
import {JournalRecoveryGate} from "../governance/journal-recovery-gate.mjs";

// Trusted composition root. No default credentials, grants, transport or browser access.
// The caller supplies authenticated providers; model text cannot configure these callbacks.
export function createTrustedRuntime({checkpointPath,ledgerPath,journalPath,sourceProvider,
  verifyGrant,verifyReceipt,submit,getResult,
  clock,maxTicks=30}={}){
 if(typeof checkpointPath!=="string"||!checkpointPath||
    typeof ledgerPath!=="string"||!ledgerPath||checkpointPath===ledgerPath||
    (journalPath!==undefined&&(typeof journalPath!=="string"||!journalPath||journalPath===checkpointPath||journalPath===ledgerPath))||
    !sourceProvider||typeof sourceProvider.head!=="function"||
    [verifyGrant,verifyReceipt,submit,getResult].some(f=>typeof f!=="function"))
   throw new Error("TRUSTED_RUNTIME_DEPENDENCIES_REQUIRED");
 const store=new CheckpointStore(checkpointPath);
 const ledger=new ReplayLedger(ledgerPath);
 const journal=journalPath?new RecoveryJournal(journalPath):null;
 const recoveryGate=journal?new JournalRecoveryGate({journal,checkpointStore:store,replayLedger:ledger}):null;
 const broker=new AuthorizationBroker({
  verifyGrant,readCurrentHead:async (repo,branch)=>(await sourceProvider.head(repo,branch)).headSha,
  replayLedger:ledger,clock
 });
 const evidence=new ReceiptReconciler({sourceProvider,verifyReceipt});
 const reservationVerifier=new ReservationVerifier({
  ledger,verifyGrant,clock,
  readCurrentHead:async (repo,branch)=>(await sourceProvider.head(repo,branch)).headSha
 });
 const agent=new OfficialAgentAdapter({
  submit,getResult,verifyAuthorizationReceipt:args=>reservationVerifier.verify(args)
 });
 const orchestrator=new SupervisorOrchestrator({
  checkpointStore:store,evidenceProvider:evidence,agentAdapter:agent,
  authorizeDispatch:request=>broker.authorize(request),recoveryJournal:journal,recoveryGate
 });
 // This verifier must verify authoritative task result provenance independently.
 const verifyResult=async ({pendingTaskId,result,checkpoint})=>{
  if(!result||result.taskId!==pendingTaskId||result.complete!==true||
     !/^[A-Za-z0-9:_-]{1,128}$/.test(result.resultId??"")||
     result.goalId!==checkpoint.goalId||!result.receipt)return false;
  const goal={id:checkpoint.goalId,repository:"OpenITStudios/LazyPrompting",branch:"Local"};
  const observation={headSha:result.headSha,taskId:pendingTaskId,resultId:result.resultId};
  const reconciled=await evidence.reconcile({goal,observation,receipt:result.receipt});
  return reconciled.verified===true&&reconciled.reason==="TRUSTED_RECEIPT"&&
    ["PASS","FAIL"].includes(reconciled.qa);
 };
 const scheduler=new SupervisorScheduler({store,agent,orchestrator,verifyResult,maxTicks});
 return Object.freeze({store,ledger,journal,recoveryGate,broker,reservationVerifier,evidence,agent,orchestrator,scheduler});
}
