import assert from "node:assert/strict";
import {assessChatTransport} from "../src/transport/chat-session-capabilities.mjs";
import {ChatSessionHost} from "../src/transport/chat-session-host.mjs";
const capabilities=Object.fromEntries(["createSession","sendPrompt","observeResponse","lookupSession","verifySession","lookupDelivery"].map(x=>[x,true]));
const manifest={kind:"SUPPORTED_CHAT_SESSION_HOST",providerId:"host1",integrationId:"adapter1",
 approved:true,documented:true,unattendedUseApproved:true,supportsExistingConsumerChats:true,capabilities};
const attestation={trusted:true,providerId:"host1",integrationId:"adapter1",sessionBindingVerified:true,existingChatBindingVerified:true};
assert.equal(assessChatTransport({manifest,hostAttestation:attestation}).ready,true);
assert.equal(assessChatTransport({manifest:{...manifest,usesWebScraping:true},hostAttestation:attestation}).ready,false);
assert.equal(assessChatTransport({manifest:{...manifest,capabilities:{...capabilities,lookupSession:false}},hostAttestation:attestation}).ready,false);
const callbacks=Object.fromEntries(Object.keys(capabilities).map(k=>[k,async()=>({ok:true})]));
const host=new ChatSessionHost({manifest,attestation,callbacks});
assert.deepEqual(await host.sendPrompt({sessionId:"chat1",prompt:"Continue",idempotencyKey:"p1"}),{ok:true});
await assert.rejects(()=>host.sendPrompt({sessionId:"bad id",prompt:"Continue",idempotencyKey:"p1"}),/INVALID_CHAT_PROMPT/);
console.log("Chat session host contract passed");
