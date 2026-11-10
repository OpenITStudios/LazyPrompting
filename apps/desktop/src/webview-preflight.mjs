// Pre-install WebView compatibility review. Never opens a browser or accepts cookies.
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const CHECKS=["runtimeAvailable","manualLoginSupported","sharedProfileVerified","multipleViewsVerified","conversationIdentityVerified","logoutPropagationVerified","restartRecoveryVerified","resourceTelemetryAvailable"];
export function assessWebViewPreflight({platform,observations,attestation}={}){
 const deny=(reason,missing=[])=>({ready:false,reason,missing});
 if(!["windows","macos","linux"].includes(platform))return deny("UNSUPPORTED_PLATFORM");
 if(!ID.test(attestation?.providerId??"")||attestation?.trustedSource!==true||
    attestation?.platform!==platform||attestation?.reviewedByOperator!==true)
  return deny("TRUSTED_REVIEW_REQUIRED");
 if(!observations||observations.providerId!==attestation.providerId||
    observations.platform!==platform||observations.verified!==true)
  return deny("OBSERVATION_IDENTITY_MISMATCH");
 const missing=CHECKS.filter(key=>observations[key]!==true);
 if(missing.length)return deny("WEBVIEW_PREFLIGHT_INCOMPLETE",missing);
 if(observations.usesUndocumentedChatGPTAutomation===true||
    observations.readsBrowserCredentials===true)return deny("PROHIBITED_INTEGRATION");
 return {ready:false,reviewComplete:true,reason:"TRUSTED_HOST_RUNTIME_VERIFICATION_REQUIRED",providerId:attestation.providerId,platform};
}
export const WEBVIEW_PREFLIGHT_CHECKS=Object.freeze([...CHECKS]);
