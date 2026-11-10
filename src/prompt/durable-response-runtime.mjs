import {ResponseObserver} from "./response-observer.mjs";
import {ResponseLifecycle} from "./response-lifecycle.mjs";
import {DurableEvaluationQueue} from "./durable-evaluation-queue.mjs";
import {createSchedulerFileLease} from "./scheduler-file-lease.mjs";
// Fail-closed composition: same durable queue, exclusive lifecycle sweep.
export function createDurableResponseRuntime({outbox,queuePath,leasePath,observeResponse,verifySession,evaluate}={}){
 if(!outbox||typeof outbox.read!=="function"||typeof outbox.pending!=="function"||
    typeof outbox.reconcile!=="function"||typeof observeResponse!=="function"||
    typeof verifySession!=="function"||typeof evaluate!=="function")
  throw Error("DURABLE_RESPONSE_RUNTIME_DEPENDENCIES_REQUIRED");
 const queue=new DurableEvaluationQueue(queuePath);
 const withLease=createSchedulerFileLease(leasePath);
 const observer=new ResponseObserver({outbox,observeResponse,verifySession,evaluationQueue:queue});
 const lifecycle=new ResponseLifecycle({outbox,observer,evaluate,evaluationQueue:queue});
 return Object.freeze({
  inspect:async options=>{
   try{return await withLease(()=>lifecycle.inspect(options));}
   catch{return {status:"BLOCKED",reason:"RESPONSE_LIFECYCLE_LEASE_UNAVAILABLE"};}
  },
  pendingEvaluations:()=>queue.pending()
 });
}
