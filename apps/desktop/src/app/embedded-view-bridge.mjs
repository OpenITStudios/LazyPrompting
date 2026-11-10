// Native-only evidence adapter for the ten embedded WebView slots.
// This does not authorize navigation or infer rendering success.
const ID=/^workspace-(0[1-9]|10)$/;
export const workspaceIds=Object.freeze(Array.from({length:10},(_,i)=>`workspace-${String(i+1).padStart(2,"0")}`));
export function validateEmbeddedSnapshot(value,workspaceId) {
 if(!ID.test(workspaceId??"")||!value||typeof value!=="object"||Array.isArray(value))return {ok:false,reason:"INVALID_SNAPSHOT"};
 if(value.workspaceId!==workspaceId||value.viewLabel!==workspaceId.replace("workspace-","browser-")||value.source!=="NATIVE_TAURI_WINDOW_REGISTRY"||typeof value.mounted!=="boolean")return {ok:false,reason:"UNTRUSTED_SNAPSHOT"};
 return {ok:true,workspaceId,mounted:value.mounted};
}
export async function readEmbeddedSnapshot(invokeNative,workspaceId) {
 if(typeof invokeNative!=="function"||!ID.test(workspaceId??""))return {ok:false,reason:"INVALID_INPUT"};
 try{return validateEmbeddedSnapshot(await invokeNative("embedded_view_snapshot",{workspaceId}),workspaceId)}
 catch{return {ok:false,reason:"NATIVE_HOST_UNAVAILABLE"}}
}
export async function requestLocalPreviewMount(invokeNative,workspaceId) {
 if(typeof invokeNative!=="function"||!ID.test(workspaceId??""))return {ok:false,reason:"INVALID_INPUT"};
 try {
   const receipt=await invokeNative("mount_embedded_view",{workspaceId});
   if(!validateEmbeddedSnapshot(receipt,workspaceId).ok)return {ok:false,reason:"INVALID_MOUNT_RECEIPT"};
   // Independent read-after-write: never trust the mount return alone.
   return await readEmbeddedSnapshot(invokeNative,workspaceId);
 } catch {return {ok:false,reason:"NATIVE_MOUNT_FAILED"}}
}
