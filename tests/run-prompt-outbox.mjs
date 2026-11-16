import assert from "node:assert/strict";
import {mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {PromptOutbox} from "../src/prompt/prompt-outbox.mjs";
const root=await mkdtemp(join(tmpdir(),"lazy prompt outbox 'é'-"));
try{
 const outbox=new PromptOutbox(join(root,"outbox.json"));
 const req={workspaceId:"ws1",sessionId:"chat1",taskId:"t1",contextRevision:1,prompt:"Continue exact work",promptLimit:2,maxConcurrent:2};
 const first=await outbox.reserve(req);
 assert.equal(first.reserved,true);
 const reopened=new PromptOutbox(join(root,"outbox.json"));
 assert.equal((await reopened.reserve(req)).reason,"WORKSPACE_PROMPT_PENDING");
 assert.equal((await outbox.pending("ws1")).length,1);
 await outbox.ack({workspaceId:"ws1",promptId:first.promptId,hostReceipt:{responseHandle:"handle1"}});
 await outbox.reconcile({workspaceId:"ws1",promptId:first.promptId,responseId:"response1",verified:true});
 assert.equal((await outbox.pending("ws1")).length,0);
 assert.equal((await outbox.reserve(req)).reserved,true);

 // Native online ChatGPT send-attempts remain UNVERIFIED after restart.
 // No real ChatGPT browser, message, cookie or user data is involved.
 const operatorFile=join(root,"operator-chat-outbox.json");
 const operator=new PromptOutbox(operatorFile);
 const input={workspaceId:"workspace-01",conversationDigest:"a".repeat(64),
  promptDigest:"b".repeat(64)};
 const attempt=await operator.reserveOperatorChatAttempt(input);
 assert.equal(attempt.reserved,true);
 assert.equal(attempt.deliveryVerified,false);
 assert.equal(attempt.resultVerified,false);
 assert.equal(attempt.nextPromptAllowed,false);
 assert.match(attempt.attemptId,/^[a-f0-9-]{36}$/);
 const afterCrash=new PromptOutbox(operatorFile);
 assert.deepEqual(await afterCrash.reserveOperatorChatAttempt(input),{
  reserved:false,reason:"OPERATOR_PROMPT_ALREADY_ATTEMPTED"
 });
 const raw=await readFile(operatorFile,"utf8");
 assert.equal(raw.includes("https://chatgpt.com"),false);
 assert.equal(raw.includes("Secret prompt"),false);
 assert.equal(raw.includes("deliveryVerified"),false);
 assert.equal(raw.includes("ATTEMPT_UNVERIFIED"),true);
 // A distinct, separately reviewed followup or conversation remains
 // possible. No unverified attempt is promoted into VERIFIED.
 assert.equal((await afterCrash.reserveOperatorChatAttempt({
  ...input,promptDigest:"c".repeat(64)
 })).reserved,true);
 assert.equal((await afterCrash.reserveOperatorChatAttempt({
  ...input,conversationDigest:"d".repeat(64)
 })).reserved,true);
 for(const invalid of [
  {...input,approved:true},{...input,text:"Secret prompt"},
  {...input,workspaceId:"workspace-11"},
  {...input,workspaceId:"../workspace-01"},
  {...input,conversationDigest:"0".repeat(64)},
  {...input,promptDigest:"0".repeat(64)},
  {...input,promptDigest:"f".repeat(63)}
 ])await assert.rejects(()=>operator.reserveOperatorChatAttempt(invalid),
  /INVALID_OPERATOR_CHAT_ATTEMPT/);
 // Do not convert a corrupt outbox into an empty record or retry.
 const state=JSON.parse(await readFile(operatorFile,"utf8"));
 const forged=structuredClone(state);
 forged.operatorChatAttempts[0].sent=true;
 await writeFile(operatorFile,JSON.stringify(forged));
 await assert.rejects(()=>new PromptOutbox(operatorFile).read(),
  /CORRUPT_PROMPT_OUTBOX/);
 const duplicated=structuredClone(state);
 duplicated.operatorChatAttempts.push({...state.operatorChatAttempts[0],
  attemptId:"12345678-1234-1234-1234-123456789abc"});
 await writeFile(operatorFile,JSON.stringify(duplicated));
 await assert.rejects(()=>new PromptOutbox(operatorFile).read(),
  /CORRUPT_PROMPT_OUTBOX/);
 // Same-file operations remain mutually exclusive before a new chat
 // reservation; a pending Codex prompt or preview action denies it.
 const collisionFile=join(root,"operator-collision.json");
 const collision=new PromptOutbox(collisionFile);
 assert.equal((await collision.reserve({
  workspaceId:"workspace-01",sessionId:"chat1",taskId:"task1",
  contextRevision:1,prompt:"Scheduled Codex turn",promptLimit:2
 })).reserved,true);
 assert.equal((await collision.reserveOperatorChatAttempt(input)).reason,
  "WORKSPACE_PROMPT_PENDING");
 const previewCollision=new PromptOutbox(join(root,"operator-preview-collision.json"));
 assert.equal((await previewCollision.reservePreviewActionIntent({
  workspaceId:"workspace-01",documentEpoch:3,
  snapshotFingerprint:"b".repeat(64),targetDigest:"c".repeat(64),
  operation:"CLICK",textDigest:null
 })).reserved,true);
 assert.equal((await previewCollision.reserveOperatorChatAttempt(input)).reason,
  "WORKSPACE_BROWSER_ACTION_PENDING");
}finally{await rm(root,{recursive:true,force:true});}
console.log("Prompt outbox and durable operator-chat restart/replay fixtures authored");
