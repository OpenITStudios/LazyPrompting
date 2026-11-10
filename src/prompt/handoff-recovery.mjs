// Conservative restart reconciliation. Never creates a second chat or deletes old sessions.
export function classifyHandoffRecovery({workspace,entries}={}){
 const deny=(status,reason)=>({status,reason});
 if(!workspace||typeof workspace.workspaceId!=="string"||!Array.isArray(entries))
  return deny("BLOCKED","INVALID_HANDOFF_RECOVERY");
 const own=entries.filter(e=>e.workspaceId===workspace.workspaceId);
 const unresolved=own.filter(e=>e.status!=="ACTIVATED");
 if(unresolved.length>1)return deny("BLOCKED","MULTIPLE_PENDING_HANDOFFS");
 if(unresolved.length===0)return deny("READY","NO_PENDING_HANDOFF");
 const entry=unresolved[0];
 if(entry.status!=="RESERVED")return deny("BLOCKED","UNKNOWN_HANDOFF_STAGE");
 if(workspace.sessionId===entry.oldSessionId&&workspace.contextRevision===entry.contextRevision)
  return {status:"RECONCILE_REQUIRED",reason:"NEW_SESSION_CREATION_UNKNOWN",handoffId:entry.handoffId};
 if(workspace.sessionId!==entry.oldSessionId&&workspace.contextRevision===entry.contextRevision+1&&
    Array.isArray(workspace.previousSessions)&&workspace.previousSessions.includes(entry.oldSessionId))
  return {status:"LEDGER_ACTIVATION_PENDING",reason:"REGISTRY_SWITCH_ALREADY_COMMITTED",
   handoffId:entry.handoffId,newSessionId:workspace.sessionId};
 return deny("BLOCKED","HANDOFF_STATE_DIVERGED");
}
