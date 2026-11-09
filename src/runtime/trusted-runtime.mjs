import {CheckpointStore} from "../supervisor/checkpoint-store.mjs";
import {ReplayLedger} from "../governance/replay-ledger.mjs";
import {AuthorizationBroker} from "../governance/authorization-broker.mjs";
import {ReceiptReconciler} from "../integrations/receipt-reconciler.mjs";
import {OfficialAgentAdapter} from "../transport/official-agent-adapter.mjs";
import {SupervisorOrchestrator} from "../supervisor/orchestrator.mjs";
import {SupervisorScheduler} from "../supervisor/scheduler.mjs";

// Trusted composition root. No default credentials, grants, transport or browser access.
// The caller supplies authenticated providers; model text cannot configure these callbacks.
export function createTrustedRuntime({checkpointPath,ledgerPath,sourceProvider,
  verifyGrant,verifyReceipt,submit,getResult,verifyAuthorizationReceipt,
  clock,maxTicks=30}={}){
 if(typeof checkpointPath!=="string"||!checkpointPath||
    typeof ledgerPath!=="string"||!ledgerPath||checkpointPath===ledgerPath||
    !sourceProvider||typeof sourceProvider.head!=="function"||
    [verifyGrant,verifyReceipt,submit,getResult,verifyAuthorizationReceipt].some(f=>typeof f!=="function"))
   throw new Error("TRUSTED_RUNTIME_DEPENDENCIES_REQUIRED");
 const store=new CheckpointStore(checkpointPath);
 const ledger=new ReplayLedger(ledgerPath);
 const broker=new AuthorizationBroker({
  verifyGrant,readCurrentHead:async (repo,branch)=>(await sourceProvider.head(repo,branch)).headSha,
  replayLedger:ledger,clock
 });
 const evidence=new ReceiptReconciler({sourceProvider,verifyReceipt});
 const agent=new OfficialAgentAdapter({submit,getResult,verifyAuthorizationReceipt});
 const orchestrator=new SupervisorOrchestrator({
  checkpointStore:store,evidenceProvider:evidence,agentAdapter:agent,
  authorizeDispatch:request=>broker.authorize(request)
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
 return Object.freeze({store,ledger,broker,evidence,agent,orchestrator,scheduler});
}
