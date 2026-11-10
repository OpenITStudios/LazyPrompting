import {ResponseObserver} from "./response-observer.mjs";
import {ResponseLifecycle} from "./response-lifecycle.mjs";
import {DurableEvaluationQueue} from "./durable-evaluation-queue.mjs";
import {createSchedulerFileLease} from "./scheduler-file-lease.mjs";
import {DurableProgressReview} from "./durable-progress-review.mjs";
// Fail-closed composition: same durable queue, exclusive lifecycle sweep.
export function createDurableResponseRuntime({outbox,queuePath,leasePath,progressPath=null,observeResponse,verifySession,evaluate}={}){
 if(!outbox||typeof outbox.read!=="function"||typeof outbox.pending!=="function"||
    typeof outbox.reconcile!=="function"||typeof observeResponse!=="function"||
    typeof verifySession!=="function"||typeof evaluate!=="function")
  throw Error("DURABLE_RESPONSE_RUNTIME_DEPENDENCIES_REQUIRED");
 const queue=new DurableEvaluationQueue(queuePath);
 const withLease=createSchedulerFileLease(leasePath);
 const observer=new ResponseObserver({outbox,observeResponse,verifySession,evaluationQueue:queue});
 const progress=progressPath===null?null:new DurableProgressReview(progressPath);
 const verifiedEvaluate=async input=>{
  const result=await evaluate(input);
  if(progress){
   if(result?.verified!==true||typeof result.progressMade!=="boolean")
    throw Error("VERIFIED_PROGRESS_EVIDENCE_REQUIRED");
   await progress.record({workspaceId:input.workspaceId,sessionId:input.sessionId,
    responseId:input.responseId,verified:true,progressMade:result.progressMade});
  }
  return result;
 };
 const lifecycle=new ResponseLifecycle({outbox,observer,evaluate:verifiedEvaluate,evaluationQueue:queue});
 return Object.freeze({
  inspect:async options=>{
   try{return await withLease(()=>lifecycle.inspect(options));}
   catch{return {status:"BLOCKED",reason:"RESPONSE_LIFECYCLE_LEASE_UNAVAILABLE"};}
  },
  pendingEvaluations:()=>queue.pending(),
  progressSnapshot:()=>progress?progress.snapshot():Promise.resolve([])
 });
}
