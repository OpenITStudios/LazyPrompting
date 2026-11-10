// Host-supplied send/observe callbacks; never assumes access to ChatGPT Web UI.
// The caller must persist a pending prompt before sending and reconcile uncertain delivery.
export class PromptDispatchGate {
 constructor({store,sendPrompt,verifySession,policy=null,singleDispatchPerTask=false}={}){
  if(!store||typeof store.reserve!=="function"||typeof store.ack!=="function"||
     typeof sendPrompt!=="function"||typeof verifySession!=="function")
   throw new Error("TRUSTED_PROMPT_HOST_REQUIRED");
  this.store=store;this.sendPrompt=sendPrompt;this.verifySession=verifySession;this.policy=policy;
  this.singleDispatchPerTask=singleDispatchPerTask;
 }
 async send(plan,{hostIdentity,promptLimit,maxConcurrent=2}={}){
  if(plan?.status!=="READY_TO_SEND"||typeof plan.prompt!=="string"||
     !/^[A-Za-z0-9:_-]{1,128}$/.test(plan.workspaceId??"")||
     !/^[A-Za-z0-9:_-]{1,128}$/.test(plan.sessionId??""))
   return {status:"NOT_SENT",reason:"INVALID_PROMPT_PLAN"};
  if((await this.verifySession({hostIdentity,workspaceId:plan.workspaceId,
      sessionId:plan.sessionId,taskId:plan.taskId,contextRevision:plan.contextRevision}))!==true)
   return {status:"NOT_SENT",reason:"SESSION_AUTHENTICATION_FAILED"};
  if(this.policy){
   let resolved;
   try{resolved=await this.policy.resolve({hostIdentity,workspaceId:plan.workspaceId,
    sessionId:plan.sessionId,contextRevision:plan.contextRevision});}
   catch{return {status:"NOT_SENT",reason:"HOST_POLICY_UNAVAILABLE"};}
   if(resolved?.authorized!==true)return {status:"NOT_SENT",reason:resolved?.reason??"HOST_POLICY_DENIED"};
   promptLimit=resolved.promptLimit;maxConcurrent=resolved.maxConcurrent;
  }
  let reservation;
  try{reservation=await this.store.reserve({
   workspaceId:plan.workspaceId,sessionId:plan.sessionId,taskId:plan.taskId,
   contextRevision:plan.contextRevision,prompt:plan.prompt,promptLimit,maxConcurrent,
   singleDispatchPerTask:this.singleDispatchPerTask
  });}catch{return {status:"RECONCILE_REQUIRED",reason:"PROMPT_RESERVATION_UNKNOWN"};}
  if(!reservation||reservation.reserved!==true)return {status:"NOT_SENT",reason:reservation?.reason??"PROMPT_NOT_RESERVED"};
  try{
   const result=await this.sendPrompt({sessionId:plan.sessionId,prompt:plan.prompt,
     idempotencyKey:reservation.promptId});
   if(!result||result.accepted!==true||!result.receipt?.responseHandle)throw new Error("DELIVERY_UNCONFIRMED");
   await this.store.ack({workspaceId:plan.workspaceId,promptId:reservation.promptId,
     hostReceipt:result.receipt});
   return {status:"SENT",promptId:reservation.promptId};
  }catch{
   // Never resend automatically after uncertain delivery.
   return {status:"RECONCILE_REQUIRED",reason:"PROMPT_DELIVERY_UNKNOWN",promptId:reservation.promptId};
  }
 }
}
