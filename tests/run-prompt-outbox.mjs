import assert from "node:assert/strict";
import {mkdtemp,readFile,rm,writeFile,mkdir} from "node:fs/promises";
import {spawnSync} from "node:child_process";
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
 })).reason,"WORKSPACE_OPERATOR_CHAT_PENDING");
 assert.equal((await afterCrash.reserveOperatorChatAttempt({
  ...input,conversationDigest:"d".repeat(64)
 })).reason,"WORKSPACE_OPERATOR_CHAT_PENDING");
 const pendingBinding=await afterCrash.pendingOperatorChatAttempt("workspace-01");
 assert.equal(pendingBinding.active,1);
 assert.equal(pendingBinding.ambiguous,false);
 assert.equal(pendingBinding.promptDigest,input.promptDigest);
 assert.equal(pendingBinding.conversationDigest,input.conversationDigest);
 assert.equal(pendingBinding.deliveryVerified,false);
 assert.equal(pendingBinding.resultVerified,false);
 await assert.rejects(()=>afterCrash.reviewOperatorChatAttempt({
  ...input,approved:true
 }),/INVALID_OPERATOR_CHAT_REVIEW/);
 await assert.rejects(()=>afterCrash.reviewOperatorChatAttempt({
  ...input,promptDigest:"c".repeat(64)
 }),/OPERATOR_CHAT_REVIEW_SCOPE_MISMATCH/);
 const review=await afterCrash.reviewOperatorChatAttempt(input);
 assert.deepEqual(review,{reviewed:true,attemptId:attempt.attemptId,
  state:"REVIEWED_UNVERIFIED",resultVerified:false,nextPromptAllowed:false});
 assert.equal((await afterCrash.pendingOperatorChatAttempt("workspace-01")).active,0);
 assert.equal((await afterCrash.reviewOperatorChatAttempt(input)).reviewed,false);
 const repeated=await new PromptOutbox(operatorFile).reserveOperatorChatAttempt(input);
 assert.equal(repeated.reserved,true); // Later explicitly reviewed turn.
 assert.notEqual(repeated.attemptId,attempt.attemptId);
 assert.equal((await afterCrash.reserveOperatorChatAttempt(input)).reason,
  "OPERATOR_PROMPT_ALREADY_ATTEMPTED");
 assert.equal((await afterCrash.reserveOperatorChatAttempt({
  ...input,promptDigest:"c".repeat(64)
 })).reason,"WORKSPACE_OPERATOR_CHAT_PENDING");
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
 // The reverse collision matters too: a pending ordinary ChatGPT
 // attempt must block other same-file workspace operations.
 const activeFile=new PromptOutbox(join(root,"operator-active.json"));
 assert.equal((await activeFile.reserveOperatorChatAttempt(input)).reserved,true);
 assert.equal((await activeFile.reserve({
  workspaceId:"workspace-01",sessionId:"chat2",taskId:"task2",
  contextRevision:1,prompt:"A new Codex task",promptLimit:3
 })).reason,"WORKSPACE_OPERATOR_CHAT_PENDING");
 const goal="12345678-1234-1234-1234-123456789abc";
 assert.equal((await activeFile.reserveAgentIntent({
  workspaceId:"workspace-01",taskId:"task1",goalId:goal,
  runId:goal+"."+"f".repeat(32),profileId:"codex",
  scopeHash:"c".repeat(64),sourceSha:"d".repeat(40),
  contextRevision:1,prompt:"A later agent",promptLimit:3
 })).reason,"WORKSPACE_OPERATOR_CHAT_PENDING");
 assert.equal((await activeFile.reservePreviewActionIntent({
  workspaceId:"workspace-01",documentEpoch:3,
  snapshotFingerprint:"c".repeat(64),targetDigest:"d".repeat(64),
  operation:"CLICK",textDigest:null
 })).reason,"WORKSPACE_OPERATOR_CHAT_PENDING");

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
 // Lock recovery is never automatic. The owner file is created
 // only by an admitted PromptOutbox transaction; a live process or
 // malformed/legacy lock must remain held, without cleanup or retry.
 const lockToken="11111111-1111-1111-1111-111111111111";
 const live=new PromptOutbox(join(root,"live-owner.json"));
 await mkdir(live.lock);
 await writeFile(join(live.lock,"owner.json"),JSON.stringify({
  version:1,pid:process.pid,token:lockToken
 })+"\n");
 assert.equal((await live.inspectInterruptedLock()).status,"LOCK_HELD");
 await assert.rejects(()=>live.recoverInterruptedLock({ownerToken:lockToken}),
  /OUTBOX_LOCK_NOT_CONFIRMED_STALE/);
 await rm(live.lock,{recursive:true,force:true});

 const unknown=new PromptOutbox(join(root,"unknown-owner.json"));
 await mkdir(unknown.lock); // Legacy or crashed-before-owner lock.
 assert.equal((await unknown.inspectInterruptedLock()).status,"LOCK_UNVERIFIED");
 await assert.rejects(()=>unknown.recoverInterruptedLock({ownerToken:lockToken}),
  /OUTBOX_LOCK_NOT_CONFIRMED_STALE/);
 await rm(unknown.lock,{recursive:true,force:true});

 // The process exited before a lock owner record was installed.
 // This fixture is synthetic; it never sends browser/ChatGPT effects.
 const child=spawnSync(process.execPath,
  ["-e","process.stdout.write(String(process.pid))"],{
   encoding:"utf8",windowsHide:true,timeout:5000
  });
 assert.equal(child.status,0);
 const oldPid=Number(child.stdout);
 assert.ok(Number.isSafeInteger(oldPid)&&oldPid>0);
 const orphan=new PromptOutbox(join(root,"orphan.json"));
 await mkdir(orphan.lock);
 await writeFile(join(orphan.lock,"owner.json"),JSON.stringify({
  version:1,pid:oldPid,token:lockToken
 })+"\n");
 assert.deepEqual(await orphan.inspectInterruptedLock(),{
  status:"LOCK_STALE_CANDIDATE",ownerToken:lockToken
 });
 await assert.rejects(()=>orphan.recoverInterruptedLock({
  ownerToken:"22222222-2222-2222-2222-222222222222"
 }),/OUTBOX_LOCK_NOT_CONFIRMED_STALE/);
 assert.equal((await orphan.recoverInterruptedLock({ownerToken:lockToken})).recovered,true);
 assert.equal((await orphan.inspectInterruptedLock()).status,"UNLOCKED");
 assert.equal((await orphan.reserveOperatorChatAttempt(input)).reserved,true);
 assert.equal((await new PromptOutbox(orphan.path).reserveOperatorChatAttempt(input)).reason,
  "OPERATOR_PROMPT_ALREADY_ATTEMPTED");
}finally{await rm(root,{recursive:true,force:true});}
console.log("Prompt outbox and durable operator-chat restart/replay fixtures authored");
