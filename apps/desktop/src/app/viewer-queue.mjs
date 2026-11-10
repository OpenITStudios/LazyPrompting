// Serialized, last-intent-wins native viewer operations; no timers or AI.
export function createViewerQueue({hide,show}) {
 if(typeof hide!=="function"||typeof show!=="function")throw Error("INVALID_OPERATIONS");
 let generation=0,tail=Promise.resolve(),closed=false;
 function schedule(workspaceId,mounted) {
   if(closed)return Promise.resolve(false);
   const ticket=++generation;
   const task=async()=>{
     if(closed||ticket!==generation)return false;
     if(!await hide())return false;
     if(closed||ticket!==generation||!mounted)return false;
     await show(workspaceId);
     if(closed||ticket!==generation){await hide();return false}
     return true;
   };
   const result=tail.then(task,task);
   tail=result.then(()=>undefined,()=>undefined);
   return result;
 }
 function close(){closed=true;++generation;const result=tail.then(()=>hide(),()=>hide());tail=result.then(()=>undefined,()=>undefined);return result;}
 return {schedule,close};
}
