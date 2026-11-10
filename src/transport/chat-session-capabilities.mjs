// An explicit capability gate, not a claim that ChatGPT consumer sessions expose an API.
const REQUIRED=["createSession","sendPrompt","observeResponse","lookupSession","verifySession","lookupDelivery"];
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
export function assessChatTransport({manifest,hostAttestation}={}){
 const deny=(reason,missing=[])=>({ready:false,reason,missing});
 if(!manifest||manifest.kind!=="SUPPORTED_CHAT_SESSION_HOST"||
    !ID.test(manifest.providerId??"")||!ID.test(manifest.integrationId??""))
  return deny("UNRECOGNIZED_HOST");
 if(manifest.approved!==true||manifest.documented!==true||
    manifest.unattendedUseApproved!==true)
  return deny("TRANSPORT_APPROVAL_MISSING");
 if(manifest.usesWebScraping===true||manifest.usesUndocumentedEndpoint===true)
  return deny("PROHIBITED_TRANSPORT");
 const missing=REQUIRED.filter(k=>manifest.capabilities?.[k]!==true);
 if(missing.length)return deny("MISSING_CHAT_SESSION_CAPABILITIES",missing);
 if(manifest.supportsExistingConsumerChats!==true)
  return deny("EXISTING_CHAT_SUPPORT_UNVERIFIED");
 if(hostAttestation?.existingChatBindingVerified!==true)
  return deny("EXISTING_CHAT_BINDING_REQUIRED");
 if(hostAttestation?.trusted!==true||hostAttestation.providerId!==manifest.providerId||
    hostAttestation.integrationId!==manifest.integrationId||
    hostAttestation.sessionBindingVerified!==true)
  return deny("HOST_ATTESTATION_REQUIRED");
 return {ready:true,reason:"CAPABILITIES_ATTESTED",providerId:manifest.providerId,
  integrationId:manifest.integrationId};
}
export function requireChatTransport(args){
 const result=assessChatTransport(args);
 if(!result.ready)throw new Error("CHAT_TRANSPORT_NOT_READY:"+result.reason);
 return result;
}
