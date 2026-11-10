// Host-authenticated response observation, not text-only inference or ChatGPT Web scraping.
export class ResponseObserver {
 constructor({outbox,observeResponse,verifySession,evaluationQueue=null}={}){
  if(!outbox||typeof outbox.pending!=="function"||typeof outbox.reconcile!=="function"||
     typeof observeResponse!=="function"||typeof verifySession!=="function")
   throw new Error("TRUSTED_RESPONSE_HOST_REQUIRED");
  if(evaluationQueue!==null&&typeof evaluationQueue.enqueue!=="function")throw new Error("INVALID_EVALUATION_QUEUE");
  this.outbox=outbox;this.observeResponse=observeResponse;this.verifySession=verifySession;this.evaluationQueue=evaluationQueue;
 }
 async inspect({workspaceId,sessionId,hostIdentity}={}){
  if((await this.verifySession({hostIdentity,workspaceId,sessionId}))!==true)
   return {status:"BLOCKED",reason:"SESSION_AUTHENTICATION_FAILED"};
  const items=await this.outbox.pending(workspaceId);
  if(items.length!==1)return {status:"BLOCKED",reason:items.length?"AMBIGUOUS_PENDING_PROMPTS":"NO_PENDING_PROMPT"};
  const item=items[0];
  if(item.sessionId!==sessionId)return {status:"BLOCKED",reason:"CROSS_SESSION_OBSERVATION_DENIED"};
  if(item.state!=="ACKNOWLEDGED")return {status:"RECONCILE_REQUIRED",reason:"DELIVERY_NOT_ACKNOWLEDGED"};
  const result=await this.observeResponse({sessionId,responseHandle:item.responseHandle});
  if(!result||result.complete!==true)return {status:"WAITING",reason:"RESPONSE_NOT_COMPLETE"};
  if(result.trusted!==true||result.sessionId!==sessionId||
     result.responseHandle!==item.responseHandle||
     !/^[A-Za-z0-9:_-]{1,128}$/.test(result.responseId??""))
   return {status:"BLOCKED",reason:"UNTRUSTED_RESPONSE_IDENTITY"};
  // Persist evaluation identity BEFORE closing the outbox entry.
  if(this.evaluationQueue){
   try{await this.evaluationQueue.enqueue({workspaceId,sessionId,responseId:result.responseId});}
   catch{return {status:"RECONCILE_REQUIRED",reason:"EVALUATION_ENQUEUE_FAILED"};}
  }
  await this.outbox.reconcile({workspaceId,promptId:item.promptId,responseId:result.responseId,verified:true});
  return {status:"OBSERVED",workspaceId,responseId:result.responseId,
   // Content is informational only; never an authorization or GitHub proof.
   responseText:typeof result.text==="string"?result.text.slice(0,16000):""};
 }
}
