// Observe all acknowledged pending chats independently of dispatch order.
// Completion is host-authenticated; evaluation of response text is advisory only.
export class ResponseLifecycle {
 constructor({outbox,observer,evaluate,evaluationQueue=null}={}){
  if(!outbox||typeof outbox.read!=="function"||
     !observer||typeof observer.inspect!=="function"||
     typeof evaluate!=="function"||(evaluationQueue!==null&&
     (typeof evaluationQueue.pending!=="function"||typeof evaluationQueue.complete!=="function")))
   throw Error("RESPONSE_LIFECYCLE_DEPENDENCIES_REQUIRED");
  Object.assign(this,{outbox,observer,evaluate,evaluationQueue});
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
   if(this.evaluationQueue){
    try{await this.evaluationQueue.complete({workspaceId:w.workspaceId,sessionId:w.sessionId,responseId:observed.responseId,verified:true});}
    catch{results.push({workspaceId:w.workspaceId,status:"EVALUATION_COMMIT_REQUIRED",responseId:observed.responseId});continue;}
   }
   results.push({workspaceId:w.workspaceId,status:"EVALUATED",responseId:observed.responseId,
    evaluation});
  }
  // Replay durable evaluations after restart; never fabricate response text.
  if(this.evaluationQueue){
   let backlog;
   try{backlog=await this.evaluationQueue.pending();}
   catch{return {status:"RECONCILE_REQUIRED",reason:"EVALUATION_QUEUE_UNAVAILABLE",results};}
   for(const item of backlog){
    if(!workspaces.some(w=>w.workspaceId===item.workspaceId&&w.sessionId===item.sessionId))continue;
    if(results.some(r=>r.workspaceId===item.workspaceId&&r.responseId===item.responseId))continue;
    // The evaluator must retrieve trusted response content by identity if needed.
    try{
     const evaluation=await this.evaluate({...item,text:null,recovery:true});
     await this.evaluationQueue.complete({...item,verified:true});
     results.push({workspaceId:item.workspaceId,status:"EVALUATED",responseId:item.responseId,evaluation,recovered:true});
    }catch{results.push({workspaceId:item.workspaceId,status:"EVALUATION_REQUIRED",responseId:item.responseId});}
   }
  }
  return {status:"INSPECTION_COMPLETE",results};
 }
}
