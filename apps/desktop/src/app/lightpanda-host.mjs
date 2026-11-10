// Lightpanda is a separate automation backend, never a WebView2 session.
// Pure capability/admission logic; no process launch, CDP connection, or network I/O.
const ID=/^workspace-(0[1-9]|10)$/;
export const LIGHTPANDA_BACKEND="LIGHTPANDA_CDP";
export function projectLightpandaStatus(raw) {
 const offline=reason=>Object.freeze({backend:LIGHTPANDA_BACKEND,connected:false,verified:false,automationEnabled:false,endpointConfigured:false,reason});
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return offline("INVALID_HOST_STATUS");
 if(raw.source!=="NATIVE_LIGHTPANDA_HOST"||raw.backend!==LIGHTPANDA_BACKEND||typeof raw.connected!=="boolean"||typeof raw.verified!=="boolean"||typeof raw.automationEnabled!=="boolean"||typeof raw.endpointConfigured!=="boolean")return offline("UNTRUSTED_HOST_STATUS");
 if(raw.connected||raw.verified||raw.automationEnabled)return offline("UNVERIFIED_RUNTIME_CLAIM");
 if(raw.endpointConfigured&&raw.reason!=="ENDPOINT_CONFIGURED_NOT_CONNECTED")return offline("INCONSISTENT_HOST_STATUS");
 if(!raw.endpointConfigured&&!["NOT_CONFIGURED","INVALID_ENDPOINT_CONFIGURATION"].includes(raw.reason))return offline("INCONSISTENT_HOST_STATUS");
 return Object.freeze({backend:LIGHTPANDA_BACKEND,connected:false,verified:false,automationEnabled:false,endpointConfigured:raw.endpointConfigured,reason:typeof raw.reason==="string"&&raw.reason.length<80?raw.reason:"NOT_CONFIGURED"});
}
export async function readLightpandaStatus(invokeNative) {
 if(typeof invokeNative!=="function")return projectLightpandaStatus(null);
 try{return projectLightpandaStatus(await invokeNative("lightpanda_host_status"))}
 catch{return Object.freeze({backend:LIGHTPANDA_BACKEND,connected:false,verified:false,automationEnabled:false,endpointConfigured:false,reason:"NATIVE_HOST_UNAVAILABLE"})}
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

export function projectLightpandaProbe(raw) {
 const failed=reason=>Object.freeze({backend:LIGHTPANDA_BACKEND,endpointConfigured:false,tcpReachable:false,cdpVerified:false,automationEnabled:false,reason});
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||raw.source!=="NATIVE_LIGHTPANDA_HOST"||raw.backend!==LIGHTPANDA_BACKEND||
    typeof raw.endpointConfigured!=="boolean"||typeof raw.tcpReachable!=="boolean"||
    raw.cdpVerified!==false||raw.automationEnabled!==false)return failed("INVALID_NATIVE_PROBE");
 if(raw.tcpReachable&&!raw.endpointConfigured)return failed("INCONSISTENT_NATIVE_PROBE");
 if(raw.tcpReachable&&raw.reason!=="TCP_REACHABLE_CDP_UNVERIFIED")return failed("INCONSISTENT_NATIVE_PROBE");
 return Object.freeze({backend:LIGHTPANDA_BACKEND,endpointConfigured:raw.endpointConfigured,tcpReachable:raw.tcpReachable,cdpVerified:false,automationEnabled:false,reason:typeof raw.reason==="string"&&raw.reason.length<80?raw.reason:"UNVERIFIED"});
}
export async function probeLightpandaOnce(invokeNative) {
 if(typeof invokeNative!=="function")return projectLightpandaProbe(null);
 try{return projectLightpandaProbe(await invokeNative("lightpanda_probe"))}
 catch{return Object.freeze({backend:LIGHTPANDA_BACKEND,endpointConfigured:false,tcpReachable:false,cdpVerified:false,automationEnabled:false,reason:"NATIVE_PROBE_FAILED"})}
}

export function projectLightpandaDiscovery(raw) {
 const fail=reason=>Object.freeze({discoveryShapeValid:false,identityVerified:false,websocketConnected:false,automationEnabled:false,reason});
 if(!raw||raw.source!=="NATIVE_LIGHTPANDA_HOST"||raw.backend!==LIGHTPANDA_BACKEND||
    typeof raw.discoveryShapeValid!=="boolean"||raw.identityVerified!==false||
    raw.websocketConnected!==false||raw.automationEnabled!==false)return fail("INVALID_NATIVE_DISCOVERY");
 return Object.freeze({discoveryShapeValid:raw.discoveryShapeValid,identityVerified:false,websocketConnected:false,automationEnabled:false,reason:raw.discoveryShapeValid?"CDP_DISCOVERY_SHAPE_ONLY":"CDP_DISCOVERY_UNAVAILABLE"});
}
export async function discoverLightpandaOnce(invokeNative) {
 if(typeof invokeNative!=="function")return projectLightpandaDiscovery(null);
 try{return projectLightpandaDiscovery(await invokeNative("lightpanda_discover"))}
 catch{return projectLightpandaDiscovery(null)}
}

export function projectLightpandaHandshake(raw) {
 const failed=reason=>Object.freeze({websocketHandshake:false,identityVerified:false,automationEnabled:false,reason});
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    raw.source!=="NATIVE_LIGHTPANDA_HOST"||raw.backend!==LIGHTPANDA_BACKEND||
    typeof raw.websocketHandshake!=="boolean"||raw.identityVerified!==false||
    raw.automationEnabled!==false)return failed("INVALID_NATIVE_HANDSHAKE");
 return Object.freeze({websocketHandshake:raw.websocketHandshake,identityVerified:false,automationEnabled:false,
   reason:raw.websocketHandshake?"WEBSOCKET_UPGRADE_ONLY":"WEBSOCKET_HANDSHAKE_UNAVAILABLE"});
}
export async function handshakeLightpandaOnce(invokeNative) {
 if(typeof invokeNative!=="function")return projectLightpandaHandshake(null);
 try{return projectLightpandaHandshake(await invokeNative("lightpanda_handshake"))}
 catch{return projectLightpandaHandshake(null)}
}

export function projectLightpandaProtocol(raw) {
 const fail=reason=>Object.freeze({cdpProtocolResponded:false,identityVerified:false,automationEnabled:false,reason});
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||raw.source!=="NATIVE_LIGHTPANDA_HOST"||
    raw.backend!==LIGHTPANDA_BACKEND||typeof raw.cdpProtocolResponded!=="boolean"||
    raw.identityVerified!==false||raw.automationEnabled!==false)return fail("INVALID_NATIVE_PROTOCOL");
 return Object.freeze({cdpProtocolResponded:raw.cdpProtocolResponded,identityVerified:false,automationEnabled:false,
   reason:raw.cdpProtocolResponded?"CDP_PROTOCOL_RESPONSE_ONLY":"CDP_PROTOCOL_UNAVAILABLE"});
}
export async function probeLightpandaProtocolOnce(invokeNative) {
 if(typeof invokeNative!=="function")return projectLightpandaProtocol(null);
 try{return projectLightpandaProtocol(await invokeNative("lightpanda_protocol_probe"))}
 catch{return projectLightpandaProtocol(null)}
}
