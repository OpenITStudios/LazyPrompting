// Read-only scheduler availability lifecycle. Never grants transport or dispatch rights.
export function initialSchedulerLifecycle(){
 return {generation:0,phase:"UNAVAILABLE",reason:"NOT_CHECKED",revision:null};
}
export function beginSchedulerRead(state){
 if(!state||!Number.isSafeInteger(state.generation))throw new Error("INVALID_LIFECYCLE");
 return {state:{...state,generation:state.generation+1,phase:"CHECKING",reason:"READ_PENDING"},token:state.generation+1};
}
export function settleSchedulerRead(state,token,host){
 if(!state||!Number.isSafeInteger(token)||token!==state.generation)return {applied:false,state,reason:"STALE_RESPONSE"};
 const valid=host?.source==="NATIVE_HOST"&&host.connected===false&&
 host.authenticated===false&&host.snapshot===null&&
 host.reason==="TRUSTED_SCHEDULER_NOT_CONFIGURED";
 return {applied:true,state:{...state,phase:"UNAVAILABLE",
  reason:valid?host.reason:"INVALID_OR_UNAVAILABLE_HOST_STATUS",revision:null},reason:null};
}
export function disconnectScheduler(state){
 if(!state||!Number.isSafeInteger(state.generation))throw new Error("INVALID_LIFECYCLE");
 return {generation:state.generation+1,phase:"UNAVAILABLE",reason:"DISCONNECTED",revision:null};
}
