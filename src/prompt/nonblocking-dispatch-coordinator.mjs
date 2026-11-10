import {planNonblockingDispatch} from "./nonblocking-dispatch-planner.mjs";
// One sweep, sequential acceptance receipts; response completion is NOT awaited.
// Single scheduler owner required; host must persist cursor and serialize sweeps.
export class NonblockingDispatchCoordinator {
 constructor({readSnapshot,readCursor,saveCursor,makePlan,dispatchGate,withSchedulerLease,adaptiveSnapshot=null}={}){
  if(typeof readSnapshot!=="function"||typeof readCursor!=="function"||
     typeof saveCursor!=="function"||typeof makePlan!=="function"||
     !dispatchGate||typeof dispatchGate.send!=="function"||
     typeof withSchedulerLease!=="function"||
     (adaptiveSnapshot!==null&&typeof adaptiveSnapshot.inspect!=="function"))
   throw new Error("DISPATCH_COORDINATOR_DEPENDENCIES_REQUIRED");
  Object.assign(this,{readSnapshot,readCursor,saveCursor,makePlan,dispatchGate,withSchedulerLease,adaptiveSnapshot});
 }
 async sweep(options={}){
  try{return await this.withSchedulerLease(()=>this.runSweep(options));}
  catch{return {status:"BLOCKED",reason:"SCHEDULER_LEASE_UNAVAILABLE"};}
 }
 async runSweep({maxDispatches=10,maxInFlight=10,hostIdentity}={}){
  let snapshot,cursor;
  try{cursor=await this.readCursor();snapshot=await this.readSnapshot();}
  catch{return {status:"BLOCKED",reason:"SCHEDULER_STATE_UNAVAILABLE"};}
  const decision=this.adaptiveSnapshot
   ?await this.adaptiveSnapshot.inspect({maxDispatches,maxInFlight})
   :planNonblockingDispatch({...snapshot,cursor,maxDispatches,maxInFlight});
  if(this.adaptiveSnapshot&&decision.ready===true){
   // Revalidate every adaptive candidate against the current trusted snapshot.
   const guard=planNonblockingDispatch({...snapshot,cursor,maxDispatches:10,maxInFlight});
   if(!guard.ready)return {status:"BLOCKED",reason:guard.reason};
   const eligible=new Set(guard.dispatch.map(x=>x.workspaceId+":"+x.sessionId));
   if(decision.dispatch.some(x=>!eligible.has(x.workspaceId+":"+x.sessionId)))
    return {status:"BLOCKED",reason:"ADAPTIVE_SNAPSHOT_STALE"};
  }
  if(!decision.ready)return {status:"BLOCKED",reason:decision.reason};
  const outcomes=[];
  for(const target of decision.dispatch){
   let plan;
   try{plan=await this.makePlan(target);}
   catch{outcomes.push({...target,status:"NOT_SENT",reason:"PROMPT_PLAN_UNAVAILABLE"});continue;}
   if(plan?.workspaceId!==target.workspaceId||plan?.sessionId!==target.sessionId){
    outcomes.push({...target,status:"NOT_SENT",reason:"PROMPT_IDENTITY_MISMATCH"});continue;
   }
   let result;
   try{result=await this.dispatchGate.send(plan,{hostIdentity,maxConcurrent:maxInFlight});}
   catch{result={status:"RECONCILE_REQUIRED",reason:"DISPATCH_OUTCOME_UNKNOWN"};}
   outcomes.push({...target,status:result?.status??"RECONCILE_REQUIRED",reason:result?.reason});
   // Advance after SENT or uncertain delivery to avoid immediate re-targeting;
   // durable outbox must still prevent duplicate sends on restart.
   if(result?.status==="SENT"||result?.status==="RECONCILE_REQUIRED"){
    try{await this.saveCursor({expectedCursor:cursor,nextCursor:cursor+1});cursor++;}
    catch{return {status:"RECONCILE_REQUIRED",reason:"CURSOR_PERSISTENCE_UNKNOWN",outcomes};}
   }
  }
  return {status:"SWEEP_COMPLETE",outcomes,cursor,observations:decision.observe};
 }
}
