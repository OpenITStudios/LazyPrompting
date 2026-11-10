import assert from "node:assert/strict";
import {assessChatTransport} from "../src/transport/chat-session-capabilities.mjs";
const capabilities=Object.fromEntries(["createSession","sendPrompt","observeResponse","lookupSession","verifySession","lookupDelivery"].map(x=>[x,true]));
const manifest={kind:"SUPPORTED_CHAT_SESSION_HOST",providerId:"provider",integrationId:"integration",
 approved:true,documented:true,unattendedUseApproved:true,supportsExistingConsumerChats:true,capabilities};
const hostAttestation={trusted:true,providerId:"provider",integrationId:"integration",sessionBindingVerified:true,existingChatBindingVerified:true};
assert.equal(assessChatTransport({manifest,hostAttestation}).ready,true);
assert.equal(assessChatTransport({manifest:{...manifest,supportsExistingConsumerChats:false},hostAttestation}).ready,false);
assert.equal(assessChatTransport({manifest:{...manifest,capabilities:{...capabilities,lookupDelivery:false}},hostAttestation}).ready,false);
assert.equal(assessChatTransport({manifest,hostAttestation:{...hostAttestation,existingChatBindingVerified:false}}).ready,false);
console.log("Existing chat transport admission scenarios authored, NOT_EXECUTED");
