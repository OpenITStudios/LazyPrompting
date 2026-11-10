// Single-owner embedded-view lifecycle coordinator. No browser launch or network access.
const SLOT=/^workspace-(0[1-9]|10)$/;
export function createViewCoordinator(){
 return {revision:0,selectedId:"workspace-01",slots:Object.fromEntries(Array.from({length:10},(_,i)=>[`workspace-${String(i+1).padStart(2,"0")}`,{phase:"UNMOUNTED",generation:0}]))};
}
export function transitionView(state,action){
 const reject=reason=>({status:"REJECTED",reason,state});
 if(!state||!action||typeof action!=="object"||!SLOT.test(action.workspaceId??"")||!state.slots?.[action.workspaceId])return reject("INVALID_SLOT");
 if(!Number.isSafeInteger(action.expectedRevision)||action.expectedRevision!==state.revision)return reject("STALE_REVISION");
 const slot=state.slots[action.workspaceId],phase=slot.phase;
 let nextPhase;
 switch(action.type){
 case "SELECT": {
   if(state.selectedId===action.workspaceId)return {status:"UNCHANGED",reason:null,state};
   return {status:"APPLIED",reason:null,state:{...state,revision:state.revision+1,selectedId:action.workspaceId}};
 }
 case "REQUEST_MOUNT":
   if(phase!=="UNMOUNTED"&&phase!=="FAILED")return reject("ALREADY_ACTIVE");
   if(action.hostAuthorized!==true||action.providerVerified!==true)return reject("HOST_NOT_VERIFIED");
   nextPhase="MOUNTING";break;
 case "CONFIRM_MOUNT":
   if(phase!=="MOUNTING"||action.nativeEvidence!==true||action.generation!==slot.generation)return reject("MOUNT_EVIDENCE_REQUIRED");
   nextPhase="MOUNTED";break;
 case "MOUNT_FAILED":
   if(phase!=="MOUNTING"||action.generation!==slot.generation)return reject("STALE_MOUNT_FAILURE");
   nextPhase="FAILED";break;
 case "REQUEST_UNMOUNT":
   if(phase!=="MOUNTED"&&phase!=="FAILED")return reject("NOT_MOUNTED");
   nextPhase="UNMOUNTING";break;
 case "CONFIRM_UNMOUNT":
   if(phase!=="UNMOUNTING"||action.nativeEvidence!==true||action.generation!==slot.generation)return reject("UNMOUNT_EVIDENCE_REQUIRED");
   nextPhase="UNMOUNTED";break;
 default:return reject("UNKNOWN_ACTION");
 }
 const generation=action.type==="REQUEST_MOUNT"||action.type==="REQUEST_UNMOUNT"?slot.generation+1:slot.generation;
 return {status:"APPLIED",reason:null,state:{...state,revision:state.revision+1,slots:{...state.slots,[action.workspaceId]:{phase:nextPhase,generation}}}};
}
