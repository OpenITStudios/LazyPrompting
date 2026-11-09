// Dependency-injected official agent host adapter. No browser automation or ChatGPT Web scraping.
export class OfficialAgentAdapter {
  constructor({submit,getResult,authorize}={}){
    if(typeof submit!=="function"||typeof getResult!=="function"||typeof authorize!=="function")
      throw new Error("OFFICIAL_HOST_CALLBACKS_REQUIRED");
    this.submit=submit;this.getResult=getResult;this.authorize=authorize;
  }
  async dispatch({goalId,taskId,prompt,repository,branch}){
    if(!/^[A-Za-z0-9:_-]{1,128}$/.test(taskId)||typeof prompt!=="string"||prompt.length>12000||branch!=="Local")
      throw new Error("INVALID_DISPATCH");
    const allowed=await this.authorize({goalId,taskId,repository,branch,operation:"agent-dispatch"});
    if(allowed!==true)throw new Error("TRUSTED_HOST_AUTHORIZATION_REQUIRED");
    return this.submit({goalId,taskId,prompt,repository,branch});
  }
  async observe(taskId){
    if(!/^[A-Za-z0-9:_-]{1,128}$/.test(taskId))throw new Error("INVALID_TASK_ID");
    return this.getResult(taskId);
  }
}
