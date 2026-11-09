// Trusted host adapter. A receipt must be checked by the host, not merely supplied by a model.
export class OfficialAgentAdapter {
 constructor({submit,getResult,verifyAuthorizationReceipt}={}){
  if(typeof submit!=="function"||typeof getResult!=="function"||
     typeof verifyAuthorizationReceipt!=="function")throw new Error("TRUSTED_HOST_CALLBACKS_REQUIRED");
  this.submit=submit;this.getResult=getResult;this.verifyAuthorizationReceipt=verifyAuthorizationReceipt;
 }
 async dispatch({goalId,taskId,prompt,repository,branch,authorizationReceipt}={}){
  if(!/^[A-Za-z0-9:_-]{1,128}$/.test(taskId??"")||
     typeof prompt!=="string"||!prompt||prompt.length>12000||
     repository!=="OpenITStudios/LazyPrompting"||branch!=="Local")
    throw new Error("INVALID_DISPATCH");
  const trusted=await this.verifyAuthorizationReceipt({
    receipt:authorizationReceipt,goalId,taskId,repository,branch,operation:"agent-dispatch"
  });
  if(trusted!==true)throw new Error("TRUSTED_AUTHORIZATION_REQUIRED");
  return this.submit({goalId,taskId,prompt,repository,branch,authorizationReceipt});
 }
 async observe(taskId){
  if(!/^[A-Za-z0-9:_-]{1,128}$/.test(taskId??""))throw new Error("INVALID_TASK_ID");
  return this.getResult(taskId);
 }
}
