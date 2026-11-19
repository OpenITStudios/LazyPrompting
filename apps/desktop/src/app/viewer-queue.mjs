// Serialized latest-intent-wins viewer operations. No polling, timers, or AI.
export function createViewerQueue({hide,show,resize}) {
 if(typeof hide!=="function"||typeof show!=="function")throw Error("INVALID_OPERATIONS");
 let generation=0,tail=Promise.resolve(),closed=false,lastKey=null,lastResult=false,visibleWorkspace=null;
 function schedule(workspaceId,mounted,geometryKey="") {
   if(closed)return Promise.resolve(false);
   const key=JSON.stringify([workspaceId,Boolean(mounted),geometryKey]);
   if(key===lastKey){const expected=generation;return tail.then(()=>!closed&&expected===generation&&lastResult);}
   lastKey=key;
   const ticket=++generation;
   const task=async()=>{
     if(closed||ticket!==generation)return false;
     try {
       // Geometry of the same visible WebView requires no hide/mount cycle.
       if(mounted&&visibleWorkspace===workspaceId&&typeof resize==="function"){
         if(await resize(workspaceId)===true){
           // The request may have been superseded while native resized.
           return !closed&&ticket===generation;
         }
       }
       const hidden=await hide(mounted?workspaceId:undefined);
       // A failed hide leaves native visibility uncertain: never reuse it.
       visibleWorkspace=null;
       if(!hidden){if(ticket===generation)lastKey=null;return false}
       if(closed||ticket!==generation||!mounted)return false;
       const shown=await show(workspaceId);
       if(shown!==true){await hide();if(ticket===generation)lastKey=null;return false}
       if(closed||ticket!==generation){await hide();return false}
       visibleWorkspace=workspaceId;
       return true;
     } catch {
       if(ticket===generation)lastKey=null;
       try{await hide()}catch{}
       visibleWorkspace=null;
       return false;
     }
   };
   const result=tail.then(task,task);
   tail=result.then(value=>{if(ticket===generation)lastResult=value;},()=>{if(ticket===generation){lastResult=false;lastKey=null}});
   return result;
 }
 function close(){
   if(closed)return tail.then(()=>lastResult);
   closed=true;lastKey=null;lastResult=false;visibleWorkspace=null;++generation;
   const result=tail.then(()=>hide(),()=>hide());
   tail=result.then(value=>{lastResult=value===true;},()=>{lastResult=false;});
   return result;
 }
 return {schedule,close};
}
