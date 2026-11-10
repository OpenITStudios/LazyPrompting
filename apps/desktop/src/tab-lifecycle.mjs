// Provider-neutral tab observation model. No browser commands or credentials.
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
export class TabLifecycle {
 constructor(){this.tabs=new Map();}
 observe({workspaceId,conversationId,tabId,phase,verified}={}){
  if(verified!==true||![workspaceId,conversationId,tabId].every(x=>ID.test(x??""))||
     !["OPEN","PARKED","FOCUSED","CLOSED","LOST"].includes(phase))throw Error("UNTRUSTED_TAB_OBSERVATION");
  const old=this.tabs.get(workspaceId);
  if(old&&(old.conversationId!==conversationId||old.tabId!==tabId))throw Error("TAB_IDENTITY_CHANGED_REVIEW");
  if([...this.tabs].some(([id,x])=>id!==workspaceId&&(x.tabId===tabId||x.conversationId===conversationId)))
   throw Error("TAB_OR_CONVERSATION_ALREADY_BOUND");
  if(old?.phase==="CLOSED"&&phase!=="CLOSED")throw Error("CLOSED_TAB_REQUIRES_REBIND");
  if(phase==="FOCUSED")for(const [id,x] of this.tabs)if(id!==workspaceId&&x.phase==="FOCUSED")x.phase="PARKED";
  this.tabs.set(workspaceId,{workspaceId,conversationId,tabId,phase});
  return this.snapshot();
 }
 recoverAfterRestart(){for(const x of this.tabs.values())if(x.phase!=="CLOSED")x.phase="LOST";return this.snapshot();}
 snapshot(){return [...this.tabs.values()].map(x=>({...x}));}
}
