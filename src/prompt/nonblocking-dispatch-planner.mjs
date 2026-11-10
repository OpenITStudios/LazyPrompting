import {scheduleWorkspaceHealth} from "./workspace-health-scheduler.mjs";
// Plans one bounded dispatch sweep. A sent prompt stays pending until terminal response.
// maxDispatches is per sweep; maxInFlight is across chats, not per-chat.
export function planNonblockingDispatch({workspaces=[],signals=[],pending=[],cursor=0,maxDispatches=10,maxInFlight=10}={}){
 const fail=reason=>({ready:false,reason,dispatch:[]});
 if(!Number.isSafeInteger(maxDispatches)||maxDispatches<1||maxDispatches>10||
    !Number.isSafeInteger(maxInFlight)||maxInFlight<1||maxInFlight>10||
    !Array.isArray(pending))return fail("INVALID_DISPATCH_LIMITS");
 const base=scheduleWorkspaceHealth({workspaces,signals,pending,cursor,maxActive:10});
 if(!base.ready)return fail(base.reason);
 const inFlight=new Set(pending.filter(x=>x.state!=="RESPONSE_VERIFIED").map(x=>x.workspaceId));
 const available=Math.max(0,maxInFlight-inFlight.size);
 const candidates=base.actions.filter(a=>a.action==="PLAN_NEXT");
 const rotated=candidates.length?[...candidates.slice(cursor%candidates.length),...candidates.slice(0,cursor%candidates.length)]:[];
 const selected=rotated.slice(0,Math.min(available,maxDispatches));
 const chosen=new Set(selected.map(a=>a.workspaceId));
 return {ready:true,dispatch:selected.map(a=>({workspaceId:a.workspaceId,sessionId:a.sessionId})),
  observe:base.actions.filter(a=>a.action==="OBSERVE_ONLY"||a.action==="RECONCILE"),
  actions:base.actions.map(a=>chosen.has(a.workspaceId)?{...a,action:"DISPATCH_CANDIDATE"}:
   a.action==="PLAN_NEXT"?{...a,action:"WAIT",reason:"DISPATCH_OR_INFLIGHT_LIMIT"}:a),
  inFlight:inFlight.size,nextCursor:candidates.length?(cursor+selected.length)%candidates.length:0};
}
