// Serialized latest-intent-wins viewer operations. No polling, timers, or AI.
export function createViewerQueue({hide,show}) {
 if(typeof hide!=="function"||typeof show!=="function")throw Error("INVALID_OPERATIONS");
 let generation=0,tail=Promise.resolve(),closed=false,lastKey=null,lastResult=false;
 function schedule(workspaceId,mounted,geometryKey="") {
   if(closed)return Promise.resolve(false);
   const key=JSON.stringify([workspaceId,Boolean(mounted),geometryKey]);
   if(key===lastKey){const expected=generation;return tail.then(()=>!closed&&expected===generation&&lastResult);}
   lastKey=key;
   const ticket=++generation;
   const task=async()=>{
     if(closed||ticket!==generation)return false;
     try {
       if(!await hide()){if(ticket===generation)lastKey=null;return false}
       if(closed||ticket!==generation||!mounted)return false;
       const shown=await show(workspaceId);
       if(shown!==true){if(ticket===generation)lastKey=null;return false}
       if(closed||ticket!==generation){await hide();return false}
       return true;
     } catch {
       if(ticket===generation)lastKey=null;
       try{await hide()}catch{}
       return false;
     }
   };
   const result=tail.then(task,task);
   tail=result.then(value=>{if(ticket===generation)lastResult=value;},()=>{if(ticket===generation){lastResult=false;lastKey=null}});
   return result;
 }
 function close(){
   if(closed)return tail.then(()=>lastResult);
   closed=true;lastKey=null;lastResult=false;++generation;
   const result=tail.then(()=>hide(),()=>hide());
   tail=result.then(value=>{lastResult=value===true;},()=>{lastResult=false;});
   return result;
 }
 return {schedule,close};
}
