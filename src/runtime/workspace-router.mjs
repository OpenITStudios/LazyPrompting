// Pure workspace binding gate. Transport/host must authenticate caller independently.
export function selectWorkspace({bindings,callerSessionId,workspaceId,taskId}={}){
 const blocked=reason=>({admitted:false,reason});
 if(!Array.isArray(bindings)||!Array.isArray([callerSessionId,workspaceId,taskId])||
    [callerSessionId,workspaceId,taskId].some(v=>typeof v!=="string"||!/^[A-Za-z0-9:_-]{1,128}$/.test(v)))
  return blocked("INVALID_IDENTITY");
 const matches=bindings.filter(b=>b.sessionId===callerSessionId&&b.workspaceId===workspaceId);
 if(matches.length!==1)return blocked("SESSION_WORKSPACE_MISMATCH");
 const b=matches[0];
 if(b.status==="PAUSED"||b.status==="STOPPED"||b.status==="BLOCKED")return blocked("WORKSPACE_INACTIVE");
 if(!Array.isArray(b.taskIds)||!b.taskIds.includes(taskId))return blocked("TASK_OUTSIDE_WORKSPACE");
 if(b.repository!=="OpenITStudios/LazyPrompting"||b.branch!=="Local"||
    !/^[a-f0-9]{40}$/.test(b.headSha??"")||
    !Number.isSafeInteger(b.contextRevision)||b.contextRevision<0)
  return blocked("INVALID_WORKSPACE_SCOPE");
 return {admitted:true,workspaceId,taskId,repository:b.repository,branch:b.branch,
  headSha:b.headSha,contextRevision:b.contextRevision};
}
export function scheduleNextWorkspace({workspaces,activeCount=0,maxActive=2,lastWorkspaceId=null}={}){
 if(!Array.isArray(workspaces)||workspaces.length>10||!Number.isSafeInteger(activeCount)||
    !Number.isSafeInteger(maxActive)||maxActive<1||activeCount<0||activeCount>=maxActive)
  return {state:"NO_SLOT"};
 const ready=workspaces.filter(w=>w.status==="READY"&&w.grantValid===true&&
   Number.isSafeInteger(w.remainingTicks)&&w.remainingTicks>0);
 if(!ready.length)return {state:"NO_READY_WORKSPACE"};
 const idx=ready.findIndex(w=>w.workspaceId===lastWorkspaceId);
 const selected=ready[(idx+1)%ready.length];
 return {state:"SELECTED",workspaceId:selected.workspaceId};
}
