// Read-only presentation boundary. No scheduler invocation, dispatch, or network access.
const ID=/^workspace-(0[1-9]|10)$/;
const STATES=new Set(["READY","WAITING","REVIEW","PAUSED","BLOCKED","STOPPED"]);
export function projectSchedulerStatus(snapshot,workspaceIds){
 const unavailable={verified:false,reason:"NO_TRUSTED_SCHEDULER_SNAPSHOT",activeCount:null,byId:{}};
 if(!Array.isArray(workspaceIds)||workspaceIds.length!==10||
  new Set(workspaceIds).size!==10||workspaceIds.some(id=>!ID.test(id)))return unavailable;
 // A renderer-provided trusted flag is NOT proof of provenance. The native host must\n // authenticate and validate snapshots before this function is ever wired to live data.\n if(!snapshot||snapshot.trusted!==true||!Number.isSafeInteger(snapshot.revision)||snapshot.revision<0||
  !Array.isArray(snapshot.workspaces)||snapshot.workspaces.length!==10)return unavailable;
 const byId={};
 for(const w of snapshot.workspaces){
  if(!ID.test(w?.workspaceId??"")||!workspaceIds.includes(w.workspaceId)||byId[w.workspaceId]||
   !STATES.has(w.status)||typeof w.pending!=="boolean")return unavailable;
  byId[w.workspaceId]={status:w.status,pending:w.pending};
 }
 if(Object.keys(byId).length!==10)return unavailable;
 const activeCount=Object.values(byId).filter(w=>w.pending).length;
 if(activeCount>2)return {verified:false,reason:"CAPACITY_EXCEEDED",activeCount:null,byId:{}};
 return {verified:true,reason:null,activeCount,byId};
}
