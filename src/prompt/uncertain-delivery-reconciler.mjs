const ID=/^[A-Za-z0-9:_-]{1,128}$/;
// Read-only host lookup by idempotency key; NEVER resends a prompt.
export class UncertainDeliveryReconciler {
 constructor({outbox,verifySession,lookupDelivery}={}){
  if(!outbox||typeof outbox.pending!=="function"||typeof outbox.ack!=="function"||
    typeof verifySession!=="function"||typeof lookupDelivery!=="function")
   throw Error("DELIVERY_RECONCILER_DEPENDENCIES_REQUIRED");
  Object.assign(this,{outbox,verifySession,lookupDelivery});
 }
 async inspect({workspaceId,sessionId,hostIdentity}={}){
  if(!ID.test(workspaceId??"")||!ID.test(sessionId??""))
   return {status:"BLOCKED",reason:"INVALID_IDENTITY"};
  let verified;
  try{verified=await this.verifySession({workspaceId,sessionId,hostIdentity});}
  catch{return {status:"BLOCKED",reason:"SESSION_VERIFICATION_UNAVAILABLE"};}
  if(verified!==true)return {status:"BLOCKED",reason:"SESSION_UNVERIFIED"};
  let pending;
  try{pending=await this.outbox.pending(workspaceId);}
  catch{return {status:"BLOCKED",reason:"OUTBOX_UNAVAILABLE"};}
  if(pending.length!==1||pending[0].sessionId!==sessionId)
   return {status:"BLOCKED",reason:"AMBIGUOUS_OR_CROSS_SESSION_PENDING"};
  const item=pending[0];
  if(item.state==="ACKNOWLEDGED")return {status:"ACKNOWLEDGED",promptId:item.promptId};
  if(!["RESERVED","RECONCILE_REQUIRED"].includes(item.state))
   return {status:"BLOCKED",reason:"UNSUPPORTED_DELIVERY_STATE"};
  let result;
  try{result=await this.lookupDelivery({sessionId,idempotencyKey:item.promptId,hostIdentity});}
  catch{return {status:"RECONCILE_REQUIRED",reason:"HOST_LOOKUP_UNAVAILABLE"};}
  if(result?.trusted!==true||result.sessionId!==sessionId||result.idempotencyKey!==item.promptId)
   return {status:"RECONCILE_REQUIRED",reason:"UNVERIFIED_DELIVERY_LOOKUP"};
  if(result.status!=="ACCEPTED"||!ID.test(result.responseHandle??""))
   return {status:"RECONCILE_REQUIRED",reason:result.status==="NOT_FOUND"?"ABSENCE_NOT_PROOF_OF_NON_DELIVERY":"DELIVERY_UNRESOLVED"};
  try{await this.outbox.ack({workspaceId,promptId:item.promptId,
    hostReceipt:{responseHandle:result.responseHandle}});}
  catch{return {status:"RECONCILE_REQUIRED",reason:"ACK_PERSISTENCE_UNKNOWN"};}
  return {status:"ACKNOWLEDGED",promptId:item.promptId};
 }
}
