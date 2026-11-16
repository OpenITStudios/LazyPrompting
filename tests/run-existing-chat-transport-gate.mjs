import assert from "node:assert/strict";
import {assessChatTransport,assessOfficialChatProduct} from "../src/transport/chat-session-capabilities.mjs";
const capabilities=Object.fromEntries(["createSession","sendPrompt","observeResponse","lookupSession","verifySession","lookupDelivery"].map(x=>[x,true]));
const manifest={kind:"SUPPORTED_CHAT_SESSION_HOST",providerId:"provider",integrationId:"integration",
 approved:true,documented:true,unattendedUseApproved:true,supportsExistingConsumerChats:true,capabilities};
const hostAttestation={trusted:true,providerId:"provider",integrationId:"integration",sessionBindingVerified:true,existingChatBindingVerified:true};
assert.equal(assessChatTransport({manifest,hostAttestation}).ready,true);
assert.equal(assessChatTransport({manifest:{...manifest,supportsExistingConsumerChats:false},hostAttestation}).ready,false);
assert.equal(assessChatTransport({manifest:{...manifest,capabilities:{...capabilities,lookupDelivery:false}},hostAttestation}).ready,false);
assert.equal(assessChatTransport({manifest,hostAttestation:{...hostAttestation,existingChatBindingVerified:false}}).ready,false);
for(const productFamily of ["WORKSPACE_AGENT","RESPONSES_API"]){
 assert.equal(assessChatTransport({
  manifest:{...manifest,productFamily},hostAttestation
 }).ready,false);
 assert.equal(assessChatTransport({
  manifest:{...manifest,productFamily},hostAttestation
 }).reason,"DIFFERENT_CHAT_PRODUCT");
}
const agent=assessOfficialChatProduct({
 product:"WORKSPACE_AGENT",capability:"RUN_STATUS"
});
assert.equal(agent.supported,true);
assert.equal(agent.statusAvailable,true);
assert.equal(agent.responseTextAvailable,false);
assert.equal(agent.consumerChatAnswerAvailable,false);
assert.equal(agent.autoContinueConsumerChat,false);
const api=assessOfficialChatProduct({
 product:"RESPONSES_API",capability:"OWN_RESPONSE"
});
assert.equal(api.supported,true);
assert.equal(api.responseTextAvailable,true);
assert.equal(api.existingConsumerChat,false);
assert.equal(api.autoContinueConsumerChat,false);
assert.equal(assessOfficialChatProduct({
 product:"CONSUMER_CHAT",capability:"READ_ARBITRARY_TURN"
}).supported,false);
console.log("Existing chat and official product identity gates authored, NOT_EXECUTED");
