// Pre-install browser provider admission. Claims are not proof; an external reviewer must supply verified evidence.
const REQUIRED=["sharedManualLogin","tabIdentity","processOwnership","restartReconciliation","profilePersistence","supportedUpdates","networkBoundary","resourceObservation"];
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
export function assessBrowserProvider({provider,evidence}={}){
 const deny=(reason,missing=[])=>({ready:false,reason,missing});
 if(!ID.test(provider?.id??"")||!["EMBEDDED_WEBVIEW","EXTERNAL_CHROMIUM"].includes(provider?.kind))return deny("INVALID_PROVIDER");
 if(provider.usesUndocumentedChatGPTAutomation===true||provider.extractsCredentials===true||provider.copiesCookies===true)
  return deny("PROHIBITED_BEHAVIOR");
 if(evidence?.providerId!==provider.id||evidence?.verified!==true||evidence?.approvedForInstall!==true)
  return deny("VERIFIED_INSTALL_ADMISSION_REQUIRED");
 const missing=REQUIRED.filter(k=>evidence.capabilities?.[k]!==true);
 if(missing.length)return deny("PROVIDER_CAPABILITIES_UNVERIFIED",missing);
 if(evidence.browserVersionVerified!==true||evidence.platformVerified!==true)return deny("PLATFORM_VERSION_UNVERIFIED");
 return {ready:true,reason:"INSTALL_ADMISSION_VERIFIED",providerId:provider.id,kind:provider.kind};
}
