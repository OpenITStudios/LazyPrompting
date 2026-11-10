// Observe all acknowledged pending chats independently of dispatch order.
// Completion is host-authenticated; evaluation of response text is advisory only.
export class ResponseLifecycle {
 constructor({outbox,observer,evaluate}={}){
  if(!outbox||typeof outbox.read!=="function"||
     !observer||typeof observer.inspect!=="function"||
     typeof evaluate!=="function")throw Error("RESPONSE_LIFECYCLE_DEPENDENCIES_REQUIRED");
  Object.assign(this,{outbox,observer,evaluate});
 }
 async inspect({workspaces=[],hostIdentity}={}){
  if(!Array.isArray(workspaces)||workspaces.length>10)return {status:"BLOCKED",reason:"INVALID_WORKSPACES"};
  let items;
  try{items=(await this.outbox.read()).items;}
  catch{return {status:"BLOCKED",reason:"OUTBOX_UNAVAILABLE"};}
  const results=[];
  for(const w of workspaces){
   if(typeof w?.workspaceId!=="string"||typeof w?.sessionId!=="string")continue;
   const active=items.filter(x=>x.workspaceId===w.workspaceId&&x.state!=="RESPONSE_VERIFIED");
   if(active.length!==1||active[0].sessionId!==w.sessionId||active[0].state!=="ACKNOWLEDGED")continue;
   let observed;
   try{observed=await this.observer.inspect({workspaceId:w.workspaceId,sessionId:w.sessionId,hostIdentity});}
   catch{observed={status:"RECONCILE_REQUIRED",reason:"OBSERVATION_OUTCOME_UNKNOWN"};}
   if(observed?.status!=="OBSERVED"){results.push({workspaceId:w.workspaceId,status:observed?.status??"BLOCKED",reason:observed?.reason});continue;}
   let evaluation;
   try{evaluation=await this.evaluate({workspaceId:w.workspaceId,sessionId:w.sessionId,
    responseId:observed.responseId,text:observed.responseText});}
   catch{results.push({workspaceId:w.workspaceId,status:"EVALUATION_REQUIRED",responseId:observed.responseId});continue;}
   results.push({workspaceId:w.workspaceId,status:"EVALUATED",responseId:observed.responseId,
    evaluation});
  }
  return {status:"INSPECTION_COMPLETE",results};
 }
}
