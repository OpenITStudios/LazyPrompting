import {classifySessionHealth} from "./session-health.mjs";
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
// Deterministic, side-effect-free routing. Never sends prompts or creates sessions.
export function scheduleWorkspaceHealth({workspaces=[],signals=[],pending=[],maxActive=2}={}){
 const fail=reason=>({ready:false,reason,actions:[]});
 if(!Array.isArray(workspaces)||workspaces.length>10||!Array.isArray(signals)||
    !Array.isArray(pending)||!Number.isSafeInteger(maxActive)||maxActive<1||maxActive>10)
  return fail("INVALID_SCHEDULER_INPUT");
 const ids=new Set(),sessions=new Set();
 for(const w of workspaces){
  if(!ID.test(w?.workspaceId??"")||!ID.test(w?.sessionId??"")||
     ids.has(w.workspaceId)||sessions.has(w.sessionId)||
     !["READY","PAUSED","BLOCKED","STOPPED"].includes(w.status))
   return fail("WORKSPACE_IDENTITY_CONFLICT");
  ids.add(w.workspaceId);sessions.add(w.sessionId);
 }
 if(signals.some(s=>!ids.has(s?.workspaceId)||!ID.test(s?.sessionId??""))||
    pending.some(p=>!ids.has(p?.workspaceId))||
    new Set(signals.map(s=>s.workspaceId)).size!==signals.length)
  return fail("CROSS_WORKSPACE_OR_DUPLICATE_SIGNAL");
 const bySignal=new Map(signals.map(s=>[s.workspaceId,s]));
 const busy=new Set(pending.filter(p=>p.state!=="RESPONSE_VERIFIED").map(p=>p.workspaceId));
 const actions=[];
 for(const w of workspaces){
  const signal=bySignal.get(w.workspaceId);
  const health=classifySessionHealth({workspaceId:w.workspaceId,sessionId:w.sessionId,hostSignal:signal});
  let action=health.action,reason=health.reason;
  if(w.status==="STOPPED"||w.status==="BLOCKED"){action="PAUSE";reason="WORKSPACE_INACTIVE";}
  else if(w.status==="PAUSED"&&action!=="PREPARE_HANDOFF"){action="PAUSE";reason="WORKSPACE_PAUSED";}
  if(busy.has(w.workspaceId)&&["PLAN_NEXT","PREPARE_HANDOFF"].includes(action)){
   action="RECONCILE";reason="PENDING_PROMPT_EXISTS";
  }
  actions.push({workspaceId:w.workspaceId,sessionId:w.sessionId,health:health.state,action,reason});
 }
 // Active slots apply only to PLAN_NEXT; observations/reconciliation remain visible.
 let allocated=0;
 for(const a of actions){
  if(a.action!=="PLAN_NEXT")continue;
  if(allocated>=maxActive){a.action="WAIT";a.reason="ACTIVE_WORKSPACE_LIMIT";}
  else allocated++;
 }
 return {ready:true,actions,activeSlots:allocated};
}
