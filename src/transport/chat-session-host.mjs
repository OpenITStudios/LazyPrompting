import {requireChatTransport} from "./chat-session-capabilities.mjs";
// Trusted callback interface only. No built-in ChatGPT Web access.
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
export class ChatSessionHost {
 constructor({manifest,attestation,callbacks}={}){
  requireChatTransport({manifest,hostAttestation:attestation});
  for(const name of ["createSession","sendPrompt","observeResponse","lookupSession","verifySession"])
   if(typeof callbacks?.[name]!=="function")throw new Error("MISSING_TRUSTED_CALLBACK:"+name);
  this.callbacks=callbacks;
 }
 async createSession({workspaceId,oldSessionId,handoffId,capsule}={}){
  if(![workspaceId,oldSessionId,handoffId].every(x=>ID.test(x??""))||
     !capsule||capsule.workspaceId!==workspaceId||capsule.sessionId!==oldSessionId)
   throw new Error("INVALID_SESSION_CREATE_SCOPE");
  return this.callbacks.createSession({workspaceId,oldSessionId,handoffId,capsule});
 }
 async sendPrompt({sessionId,prompt,idempotencyKey}={}){
  if(!ID.test(sessionId??"")||!ID.test(idempotencyKey??"")||
     typeof prompt!=="string"||!prompt||prompt.length>12000)
   throw new Error("INVALID_CHAT_PROMPT");
  return this.callbacks.sendPrompt({sessionId,prompt,idempotencyKey});
 }
 async observeResponse({sessionId,responseHandle}={}){
  if(!ID.test(sessionId??"")||!ID.test(responseHandle??""))
   throw new Error("INVALID_RESPONSE_SCOPE");
  return this.callbacks.observeResponse({sessionId,responseHandle});
 }
 async lookupSession({workspaceId,handoffId,oldSessionId}={}){
  if(![workspaceId,handoffId,oldSessionId].every(x=>ID.test(x??"")))
   throw new Error("INVALID_SESSION_LOOKUP");
  return this.callbacks.lookupSession({workspaceId,handoffId,oldSessionId});
 }
 async verifySession(args={}){
  if(!ID.test(args.sessionId??"")||!ID.test(args.workspaceId??""))
   throw new Error("INVALID_SESSION_VERIFICATION");
  return this.callbacks.verifySession(args);
 }
}
