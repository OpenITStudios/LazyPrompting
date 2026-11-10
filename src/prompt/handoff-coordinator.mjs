import {createHash} from "node:crypto";
import {prepareChatHandoff,verifyChatHandoff} from "./chat-handoff.mjs";
// Host owns session creation, verification and archival; no ChatGPT Web scraping.
export class HandoffCoordinator {
 constructor({registry,ledger,outbox,createSession,verifyNewSession}={}){
  if(!registry||typeof registry.read!=="function"||typeof registry.switchSession!=="function"||
     !ledger||typeof ledger.reserve!=="function"||typeof ledger.activate!=="function"||
     !outbox||typeof outbox.pending!=="function"||
     typeof createSession!=="function"||typeof verifyNewSession!=="function")
   throw new Error("HANDOFF_HOST_DEPENDENCIES_REQUIRED");
  Object.assign(this,{registry,ledger,outbox,createSession,verifyNewSession});
 }
 async begin({workspaceId,context}={}){
  const state=await this.registry.read(),workspace=state.workspaces.find(w=>w.workspaceId===workspaceId);
  if(!workspace)return {status:"BLOCKED",reason:"WORKSPACE_NOT_FOUND"};
  if(workspace.status!=="PAUSED")return {status:"BLOCKED",reason:"WORKSPACE_MUST_BE_PAUSED"};
  const plan=prepareChatHandoff({workspace:{...workspace,taskId:context?.taskId},
   oldSession:workspace.sessionId,context,outboxItems:await this.outbox.pending(workspaceId)});
  if(!plan.ready)return {status:"BLOCKED",reason:plan.reason};
  const capsuleHash=createHash("sha256").update(JSON.stringify(plan.capsule)).digest("hex");
  const reservation=await this.ledger.reserve({workspaceId,oldSessionId:plan.oldSessionId,
   contextRevision:plan.contextRevision,capsuleHash});
  if(!reservation.reserved)return {status:"BLOCKED",reason:reservation.reason};
  // A crash after this call can leave a new chat with unknown identity.
  // Do not automatically create another chat after uncertain delivery.
  let newSessionId,proof;
  try{
   const created=await this.createSession({workspaceId,oldSessionId:plan.oldSessionId,
    handoffId:reservation.handoffId,capsule:plan.capsule});
   newSessionId=created?.sessionId;
   proof=await this.verifyNewSession({workspaceId,sessionId:newSessionId,
    handoffId:reservation.handoffId,capsuleHash,contextRevision:plan.contextRevision});
  }catch{return {status:"RECONCILE_REQUIRED",reason:"NEW_SESSION_OUTCOME_UNKNOWN",handoffId:reservation.handoffId};}
  const verified=verifyChatHandoff({plan,newSessionId,hostProof:proof});
  if(!verified.activated)return {status:"RECONCILE_REQUIRED",reason:verified.reason,handoffId:reservation.handoffId};
  let switched;
  try{switched=await this.registry.switchSession({expectedVersion:state.version,workspaceId,
    oldSessionId:plan.oldSessionId,newSessionId,contextRevision:plan.contextRevision});}
  catch{return {status:"RECONCILE_REQUIRED",reason:"SESSION_BINDING_SWITCH_UNKNOWN",handoffId:reservation.handoffId};}
  if(!switched.ok)return {status:"RECONCILE_REQUIRED",reason:"STALE_REGISTRY_VERSION",handoffId:reservation.handoffId};
  try{await this.ledger.activate({handoffId:reservation.handoffId,workspaceId,newSessionId,verified:true});}
  catch{return {status:"RECONCILE_REQUIRED",reason:"HANDOFF_LEDGER_ACTIVATION_UNKNOWN",handoffId:reservation.handoffId};}
  return {status:"HANDOFF_COMPLETE_PAUSED",workspaceId,newSessionId,
   oldSessionId:plan.oldSessionId,oldSessionDisposition:"RETAIN_ARCHIVED"};
 }
}
