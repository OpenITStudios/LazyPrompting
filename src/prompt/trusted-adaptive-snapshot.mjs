import {planAdaptiveEventSweep} from "./adaptive-event-supervisor.mjs";
// Trusted host owns events, signals and outbox; durable progress store owns counters.
export class TrustedAdaptiveSnapshot {
 constructor({readWorkspaces,readSignals,readOutbox,readEvents,progressStore,readCursor}={}){
  if([readWorkspaces,readSignals,readOutbox,readEvents,readCursor].some(x=>typeof x!=="function")||
     !progressStore||typeof progressStore.snapshot!=="function")
   throw Error("TRUSTED_ADAPTIVE_SOURCES_REQUIRED");
  Object.assign(this,{readWorkspaces,readSignals,readOutbox,readEvents,progressStore,readCursor});
 }
 async inspect({maxDispatches=3,maxInFlight=10}={}){
  try{
   const workspaces=await this.readWorkspaces();
   if(!Array.isArray(workspaces)||workspaces.length>10)return {ready:false,reason:"WORKSPACES_INVALID",dispatch:[]};
   const identities=workspaces.map(w=>({workspaceId:w.workspaceId,sessionId:w.sessionId}));
   const [signals,pending,events,progress,cursor]=await Promise.all([
    this.readSignals({workspaces:identities}),this.readOutbox(),this.readEvents({workspaces:identities}),
    this.progressStore.snapshot(),this.readCursor()
   ]);
   return planAdaptiveEventSweep({workspaces,signals,pending,events,progress,cursor,maxDispatches,maxInFlight});
  }catch{return {ready:false,reason:"TRUSTED_ADAPTIVE_SOURCE_UNAVAILABLE",dispatch:[]};}
 }
}
