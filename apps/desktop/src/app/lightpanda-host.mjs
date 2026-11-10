// Lightpanda is a separate automation backend, never a WebView2 session.
// Pure capability/admission logic; no process launch, CDP connection, or network I/O.
const ID=/^workspace-(0[1-9]|10)$/;
export const LIGHTPANDA_BACKEND="LIGHTPANDA_CDP";
export function projectLightpandaStatus(raw) {
 const offline=reason=>Object.freeze({backend:LIGHTPANDA_BACKEND,connected:false,verified:false,automationEnabled:false,reason});
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return offline("INVALID_HOST_STATUS");
 if(raw.source!=="NATIVE_LIGHTPANDA_HOST"||raw.backend!==LIGHTPANDA_BACKEND||typeof raw.connected!=="boolean"||typeof raw.verified!=="boolean"||typeof raw.automationEnabled!=="boolean")return offline("UNTRUSTED_HOST_STATUS");
 if(raw.connected||raw.verified||raw.automationEnabled)return offline("UNVERIFIED_RUNTIME_CLAIM");
 return offline(typeof raw.reason==="string"&&raw.reason.length<80?raw.reason:"NOT_CONFIGURED");
}
export async function readLightpandaStatus(invokeNative) {
 if(typeof invokeNative!=="function")return projectLightpandaStatus(null);
 try{return projectLightpandaStatus(await invokeNative("lightpanda_host_status"))}
 catch{return Object.freeze({backend:LIGHTPANDA_BACKEND,connected:false,verified:false,automationEnabled:false,reason:"NATIVE_HOST_UNAVAILABLE"})}
}
export function admitLightpandaOperation({workspaceId,operatorApproved=false,transportVerified=false,scopeVerified=false,complianceVerified=false,paused=false}={}) {
 if(!ID.test(workspaceId??""))return {allowed:false,reason:"INVALID_WORKSPACE"};
 if(paused)return {allowed:false,reason:"PAUSED"};
 if(!operatorApproved)return {allowed:false,reason:"OPERATOR_APPROVAL_REQUIRED"};
 if(!transportVerified)return {allowed:false,reason:"TRANSPORT_UNVERIFIED"};
 if(!scopeVerified)return {allowed:false,reason:"SCOPE_UNVERIFIED"};
 if(!complianceVerified)return {allowed:false,reason:"COMPLIANCE_UNVERIFIED"};
 // Renderer-side booleans cannot establish host authority. Native admission is mandatory.
 return {allowed:false,reason:"NATIVE_ADMISSION_REQUIRED"};
}
