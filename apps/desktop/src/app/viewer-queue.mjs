// Serialized, last-intent-wins native viewer operations. Coalesces identical geometry.
export function createViewerQueue({hide,show}) {
 if(typeof hide!=="function"||typeof show!=="function")throw Error("INVALID_OPERATIONS");
 let generation=0,tail=Promise.resolve(),closed=false,lastKey=null;
 function schedule(workspaceId,mounted,geometryKey="") {
   if(closed)return Promise.resolve(false);
   const key=JSON.stringify([workspaceId,Boolean(mounted),geometryKey]);
   if(key===lastKey)return tail.then(()=>true);
   lastKey=key;
   const ticket=++generation;
   const task=async()=>{
     if(closed||ticket!==generation)return false;
     if(!await hide())return false;
     if(closed||ticket!==generation||!mounted)return false;
     const shown=await show(workspaceId);
     if(shown!==true){lastKey=null;return false}
     if(closed||ticket!==generation){await hide();return false}
     return true;
   };
   const result=tail.then(task,task);
   tail=result.then(()=>undefined,()=>undefined);
   return result;
 }
 function close(){closed=true;lastKey=null;++generation;const result=tail.then(()=>hide(),()=>hide());tail=result.then(()=>undefined,()=>undefined);return result;}
 return {schedule,close};
}
