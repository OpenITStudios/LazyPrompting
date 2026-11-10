// Read-only renderer projection of native WebView2 detection.
// Does not launch a WebView, authenticate, navigate or trust renderer flags.
export function projectWebviewStatus(raw) {
 const unavailable=(reason)=>Object.freeze({candidate:"WEBVIEW2",observed:false,usable:false,reason});
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return unavailable("INVALID_NATIVE_STATUS");
 if(raw.candidate!=="SYSTEM_WEBVIEW"||typeof raw.os!=="string"||typeof raw.runtimeObserved!=="boolean"||typeof raw.runtimeUsableVerified!=="boolean"||typeof raw.discoverySource!=="string")return unavailable("INVALID_NATIVE_STATUS");
 if(raw.runtimeUsableVerified===true)return unavailable("UNVERIFIED_NATIVE_CLAIM");
 if(raw.navigationEnabled===true||raw.automationEnabled===true)return unavailable("UNEXPECTED_CAPABILITY");
 return Object.freeze({candidate:"WEBVIEW2",observed:raw.runtimeObserved,usable:false,reason:raw.runtimeObserved?"CANDIDATE_OBSERVED_NOT_VERIFIED":"RUNTIME_NOT_OBSERVED"});
}
export async function readWebviewStatus(invokeNative) {
 if(typeof invokeNative!=="function")return projectWebviewStatus(null);
 try { return projectWebviewStatus(await invokeNative("webview_provider_status")); }
 catch { return Object.freeze({candidate:"WEBVIEW2",observed:false,usable:false,reason:"NATIVE_HOST_UNAVAILABLE"}); }
}
