import {planNonblockingDispatch} from "./nonblocking-dispatch-planner.mjs";
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
// Host-authenticated events are hints for priority, never substitutes for current session/outbox checks.
export function planAdaptiveEventSweep({workspaces=[],signals=[],pending=[],events=[],progress=[],cursor=0,maxDispatches=2,maxInFlight=2}={}){
 const fail=reason=>({ready:false,reason,dispatch:[]});
 if(!Number.isSafeInteger(maxDispatches)||maxDispatches<1||maxDispatches>10||\n    !Number.isSafeInteger(maxInFlight)||maxInFlight<1||maxInFlight>10||\n    !Array.isArray(events)||events.length>100||!Array.isArray(progress)||progress.length>10)
  return fail("INVALID_EVENT_INPUT");
 const identities=new Map(workspaces.map(w=>[w.workspaceId,w.sessionId]));
 if(identities.size!==workspaces.length||events.some(e=>!ID.test(e?.workspaceId??"")||
   e.sessionId!==identities.get(e.workspaceId)||e.trusted!==true||
   !["RESPONSE_COMPLETED","SESSION_READY","CONTEXT_EXHAUSTED","APPROVAL_REQUIRED"].includes(e.type)))
  return fail("UNVERIFIED_EVENT_IDENTITY");
 const base=planNonblockingDispatch({workspaces,signals,pending,cursor,maxDispatches:10,maxInFlight});
 if(!base.ready)return base;
 const progressById=new Map();
 for(const p of progress){
  if(!identities.has(p?.workspaceId)||progressById.has(p.workspaceId)||
     !Number.isSafeInteger(p.noProgressCycles)||p.noProgressCycles<0||
     p.verified!==true)return fail("UNVERIFIED_PROGRESS");
  progressById.set(p.workspaceId,p);
 }
 const priority=new Set(events.filter(e=>e.type==="RESPONSE_COMPLETED"||e.type==="SESSION_READY").map(e=>e.workspaceId));
 const eligible=base.dispatch.filter(x=>(progressById.get(x.workspaceId)?.noProgressCycles??0)<3);
 const blocked=base.dispatch.filter(x=>(progressById.get(x.workspaceId)?.noProgressCycles??0)>=3);
 const ordered=[...eligible.filter(x=>priority.has(x.workspaceId)),...eligible.filter(x=>!priority.has(x.workspaceId))];
 const dispatch=ordered.slice(0,maxDispatches);
 return {ready:true,dispatch,review:blocked.map(x=>({...x,reason:"PROGRESS_STALLED_REVIEW_REQUIRED"})),
  observe:base.observe,inFlight:base.inFlight,eventsConsidered:events.length,
  // Actual cursor advancement remains receipt-driven in dispatch coordinator.
  nextCursor:cursor};
}
