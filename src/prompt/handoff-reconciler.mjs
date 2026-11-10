import {classifyHandoffRecovery} from "./handoff-recovery.mjs";
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
// Explicit, host-authenticated reconciliation; never creates, deletes or resends a chat.
export class HandoffReconciler {
 constructor({registry,ledger,lookupSession,verifySession}={}){
  if(!registry||typeof registry.read!=="function"||typeof registry.switchSession!=="function"||
     !ledger||typeof ledger.read!=="function"||typeof ledger.activate!=="function"||
     typeof lookupSession!=="function"||typeof verifySession!=="function")
   throw new Error("TRUSTED_HANDOFF_RECONCILER_REQUIRED");
  Object.assign(this,{registry,ledger,lookupSession,verifySession});
 }
 async reconcile(workspaceId){
  if(!ID.test(workspaceId??""))return {status:"BLOCKED",reason:"INVALID_WORKSPACE_ID"};
  const [registry,ledger]=await Promise.all([this.registry.read(),this.ledger.read()]);
  const workspace=registry.workspaces.find(w=>w.workspaceId===workspaceId);
  if(!workspace||workspace.status!=="PAUSED")return {status:"BLOCKED",reason:"WORKSPACE_NOT_PAUSED"};
  const state=classifyHandoffRecovery({workspace,entries:ledger.entries});
  if(state.status==="READY"||state.status==="BLOCKED")return state;
  const entry=ledger.entries.find(e=>e.handoffId===state.handoffId&&e.workspaceId===workspaceId);
  if(!entry||!ID.test(entry.handoffId??"")||!ID.test(entry.oldSessionId??"")||
     !/^[a-f0-9]{64}$/.test(entry.capsuleHash??""))
   return {status:"BLOCKED",reason:"INVALID_HANDOFF_RECORD"};
  let newSessionId=state.newSessionId;
  if(state.status==="RECONCILE_REQUIRED"){
   let found;
   try{found=await this.lookupSession({workspaceId,handoffId:entry.handoffId,oldSessionId:entry.oldSessionId});}
   catch{return {status:"RECONCILE_REQUIRED",reason:"HOST_LOOKUP_UNAVAILABLE"};}
   if(!found||found.found!==true||!ID.test(found.sessionId??""))
    return {status:"RECONCILE_REQUIRED",reason:"NEW_SESSION_NOT_CONFIRMED"};
   newSessionId=found.sessionId;
  }
  if(newSessionId===entry.oldSessionId)return {status:"BLOCKED",reason:"SESSION_NOT_ROTATED"};
  let proof;
  try{proof=await this.verifySession({workspaceId,handoffId:entry.handoffId,
   sessionId:newSessionId,capsuleHash:entry.capsuleHash,contextRevision:entry.contextRevision});}
  catch{return {status:"RECONCILE_REQUIRED",reason:"HOST_VERIFICATION_UNAVAILABLE"};}
  if(proof?.trusted!==true||proof.workspaceId!==workspaceId||
     proof.sessionId!==newSessionId||proof.handoffId!==entry.handoffId||
     proof.capsuleHash!==entry.capsuleHash||proof.contextAccepted!==true)
   return {status:"BLOCKED",reason:"HOST_PROOF_MISMATCH"};
  if(state.status==="RECONCILE_REQUIRED"){
   let switched;
   try{switched=await this.registry.switchSession({expectedVersion:registry.version,workspaceId,
    oldSessionId:entry.oldSessionId,newSessionId,contextRevision:entry.contextRevision});}
   catch{return {status:"RECONCILE_REQUIRED",reason:"REGISTRY_SWITCH_UNCERTAIN"};}
   if(switched?.ok!==true)return {status:"RECONCILE_REQUIRED",reason:"STALE_REGISTRY"};
  }
  try{await this.ledger.activate({handoffId:entry.handoffId,workspaceId,newSessionId,verified:true});}
  catch{return {status:"RECONCILE_REQUIRED",reason:"LEDGER_ACTIVATION_UNCERTAIN"};}
  return {status:"HANDOFF_COMPLETE_PAUSED",workspaceId,newSessionId,
   oldSessionId:entry.oldSessionId,oldSessionDisposition:"RETAIN_ARCHIVED"};
 }
}
