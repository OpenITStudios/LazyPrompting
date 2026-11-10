import {scheduleWorkspaceHealth} from "./workspace-health-scheduler.mjs";
// Host callbacks supply authenticated status. Never infer completion from scrolling.
export class TrustedHealthSnapshot {
 constructor({readWorkspaces,readSignals,readOutbox}={}){
  if(typeof readWorkspaces!=="function"||typeof readSignals!=="function"||
     typeof readOutbox!=="function")throw new Error("TRUSTED_HEALTH_CALLBACKS_REQUIRED");
  Object.assign(this,{readWorkspaces,readSignals,readOutbox});
 }
 async inspect({maxActive=2,cursor=0}={}){
  let snapshot;
  try{
   const workspaces=await this.readWorkspaces();
   if(!Array.isArray(workspaces)||workspaces.length>10)return {ready:false,reason:"WORKSPACE_SNAPSHOT_INVALID"};
   const signals=await this.readSignals({workspaces:workspaces.map(w=>({workspaceId:w.workspaceId,sessionId:w.sessionId}))});
   const pending=await this.readOutbox();
   snapshot={workspaces,signals,pending,maxActive,cursor};
  }catch{return {ready:false,reason:"HEALTH_SOURCE_UNAVAILABLE"};}
  return scheduleWorkspaceHealth(snapshot);
 }
}
