import assert from "node:assert/strict";
import {mkdtemp,readFile,rm,writeFile} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {PromptOutbox} from "../src/prompt/prompt-outbox.mjs";

// Authored source fixture only. This never launches a browser or authorizes
// a click/fill: durable intent is NOT a native permit or host QA receipt.
const dir=await mkdtemp(join(tmpdir(),"lazy-browser-outbox-"));
const previewId="workspace-01";
const base={
 workspaceId:previewId,documentEpoch:8,
 snapshotFingerprint:"a".repeat(64),targetDigest:"b".repeat(64),
 operation:"CLICK",textDigest:null
};
try{
 const file=join(dir,"outbox.json"),outbox=new PromptOutbox(file);
 assert.deepEqual(await outbox.read(),{schemaVersion:1,items:[]});
 const original=await outbox.reservePreviewActionIntent(base);
 assert.equal(original.reserved,true);
 assert.match(original.actionId,/^[a-f0-9-]{36}$/);
 assert.match(original.reservationNonce,/^[a-f0-9]{32}$/);
 const persisted=await readFile(file,"utf8");
 assert.equal(persisted.includes("backendNodeId"),false);
 assert.equal(persisted.includes("selector"),false);
 assert.equal(persisted.includes("password"),false);
 const reopened=new PromptOutbox(file);
 const stored=await reopened.read();
 assert.equal(stored.schemaVersion,1);
 assert.equal(stored.browserActions.length,1);
 assert.equal(stored.browserActions[0].actionId,original.actionId);
 assert.equal(stored.browserActions[0].reservationNonce,original.reservationNonce);
 assert.equal(stored.browserActions[0].state,"RESERVED");
 const redacted=await reopened.pendingPreviewActions(previewId);
 assert.deepEqual(redacted,[{
  actionId:original.actionId,workspaceId:previewId,operation:"CLICK",
  state:"RESERVED"
 }]);
 assert.equal(JSON.stringify(redacted).includes(original.reservationNonce),false);
 assert.equal((await reopened.reservePreviewActionIntent(base)).reason,
  "WORKSPACE_BROWSER_ACTION_PENDING");
 assert.equal((await reopened.reserve({
  workspaceId:previewId,sessionId:"chat1",taskId:"t1",
  contextRevision:1,prompt:"Continue task",promptLimit:2
 })).reason,"WORKSPACE_BROWSER_ACTION_PENDING");
 // Preserve the prompt-only pending() consumer contract, including
 // its error path; browser holds have their own scoped read method.
 assert.deepEqual(await reopened.pending(previewId),[]);
 const goalId="12345678-1234-1234-1234-123456789abc";
 assert.equal((await reopened.reserveAgentIntent({
  workspaceId:previewId,taskId:"agent-task",goalId,
  runId:goalId+"."+"f".repeat(32),profileId:"codex",
  scopeHash:"d".repeat(64),sourceSha:"e".repeat(40),
  contextRevision:1,prompt:"Inspect approved source",promptLimit:2
 })).reason,"WORKSPACE_BROWSER_ACTION_PENDING");
 // Other workspaces remain independent. A concurrent action from the
 // same workspace is held; no retry or fabricated completion is added.
 const other=await reopened.reservePreviewActionIntent({
  ...base,workspaceId:"workspace-02",operation:"TYPE_TEXT",
  textDigest:"c".repeat(64)
 });
 assert.equal(other.reserved,true);
 assert.notEqual(other.reservationNonce,original.reservationNonce);
 assert.equal((await reopened.reserve({
  workspaceId:"workspace-03",sessionId:"chat3",taskId:"task3",
  contextRevision:1,prompt:"Unrelated workspace",promptLimit:2
 })).reserved,true);
 assert.equal((await reopened.reservePreviewActionIntent({
  ...base,workspaceId:"workspace-03"
 })).reason,"WORKSPACE_PROMPT_PENDING");
 const pendingAfterRestart=new PromptOutbox(file);
 assert.equal((await pendingAfterRestart.pendingPreviewActions(previewId)).length,1);
 assert.equal((await pendingAfterRestart.reservePreviewActionIntent(base)).reserved,false);
 const proof={...base,actionId:original.actionId,
  reservationNonce:original.reservationNonce};
 assert.deepEqual(await pendingAfterRestart.matchReservedPreviewAction(proof),{
  matched:true,actionAuthorized:false,resultVerified:false
 });
 for(const modified of [
  {...proof,actionId:other.actionId},
  {...proof,reservationNonce:other.reservationNonce},
  {...proof,workspaceId:"workspace-02"},
  {...proof,documentEpoch:9},
  {...proof,snapshotFingerprint:"f".repeat(64)},
  {...proof,targetDigest:"e".repeat(64)},
  {...proof,operation:"TYPE_TEXT",textDigest:"c".repeat(64)}
 ]){
  assert.equal((await pendingAfterRestart.matchReservedPreviewAction(modified))
   .matched,false);
 }
 await assert.rejects(()=>pendingAfterRestart.matchReservedPreviewAction({
  ...proof,approved:true
 }),/INVALID_BROWSER_ACTION_RESERVATION_PROOF/);
 for(const invalid of [
  {...base,workspaceId:"workspace-11"},
  {...base,documentEpoch:0},
  {...base,snapshotFingerprint:"not-a-hash"},
  {...base,targetDigest:"0".repeat(64)},
  {...base,operation:"DELETE"},
  {...base,approved:true},
  {...base,actionAuthorized:true},
  {...base,backendNodeId:17},
  {...base,operation:"CLICK",textDigest:"c".repeat(64)},
  {...base,operation:"TYPE_TEXT",textDigest:null},
  {...base,operation:"TYPE_TEXT",textDigest:"0".repeat(64)},
 ]){
  await assert.rejects(()=>reopened.reservePreviewActionIntent(invalid),
   /INVALID_BROWSER_ACTION_INTENT/);
 }
 // A durable pre-dispatch fence is one-way. A process restart
 // cannot mistake a sealed attempt for an unused authorization.
 await assert.rejects(()=>reopened.sealPreviewActionDispatch({
  ...proof,actionId:other.actionId
 }),/BROWSER_ACTION_DISPATCH_ALREADY_HELD/);
 await assert.rejects(()=>reopened.sealPreviewActionDispatch({
  ...proof,approved:true
 }),/INVALID_BROWSER_ACTION_DISPATCH/);
 const sealed=await reopened.sealPreviewActionDispatch(proof);
 assert.deepEqual(sealed,{sealed:true,actionId:original.actionId,
  state:"DISPATCH_PENDING",actionAuthorized:false,resultVerified:false});
 assert.equal((await new PromptOutbox(file).pendingPreviewActions(previewId))[0].state,
  "DISPATCH_PENDING");
 assert.equal((await reopened.matchReservedPreviewAction(proof)).matched,false);
 await assert.rejects(()=>reopened.sealPreviewActionDispatch(proof),
  /BROWSER_ACTION_DISPATCH_ALREADY_HELD/);
 assert.equal((await reopened.reservePreviewActionIntent(base)).reason,
  "WORKSPACE_BROWSER_ACTION_PENDING");
 // Unknown/late native results may only tighten the durable hold.
 // They never complete the action, clear a reservation or auto-retry.
 const holdArgs={workspaceId:previewId,actionId:original.actionId,
  reservationNonce:original.reservationNonce};
 await assert.rejects(()=>reopened.holdPreviewActionUncertain({
  ...holdArgs,reservationNonce:other.reservationNonce
 }),/BROWSER_ACTION_RESERVATION_NOT_FOUND/);
 const held=await reopened.holdPreviewActionUncertain(holdArgs);
 assert.deepEqual(held,{held:true,actionId:original.actionId,
  state:"RECONCILE_REQUIRED",actionAuthorized:false,resultVerified:false});
 assert.equal((await reopened.holdPreviewActionUncertain(holdArgs)).held,true);
 assert.deepEqual(await new PromptOutbox(file).pendingPreviewActions(previewId),[{
  actionId:original.actionId,workspaceId:previewId,
  operation:"CLICK",state:"RECONCILE_REQUIRED"
 }]);
 assert.equal((await reopened.matchReservedPreviewAction(proof)).matched,false);
 assert.equal((await reopened.reservePreviewActionIntent(base)).reason,
  "WORKSPACE_BROWSER_ACTION_PENDING");
 await assert.rejects(()=>reopened.holdPreviewActionUncertain({
  ...holdArgs,approved:true
 }),/INVALID_BROWSER_ACTION_HOLD/);
 const originalState=JSON.parse(await readFile(file,"utf8"));
 const corrupted=structuredClone(originalState);
 corrupted.browserActions[0].state="VERIFIED"; // Not settable by a caller.
 await writeFile(file,JSON.stringify(corrupted));
 await assert.rejects(()=>new PromptOutbox(file).read(),/CORRUPT_PROMPT_OUTBOX/);
 const duplicate=structuredClone(originalState);
 duplicate.browserActions[1].workspaceId=previewId;
 await writeFile(file,JSON.stringify(duplicate));
 await assert.rejects(()=>new PromptOutbox(file).read(),/CORRUPT_PROMPT_OUTBOX/);

 // A sealed action can complete only with a separate native-checked receipt.
 const verifiedFile=join(dir,"verified.json");
 const verifiedOutbox=new PromptOutbox(verifiedFile);
 const edge={...base,documentEpoch:Number.MAX_SAFE_INTEGER};
 const first=await verifiedOutbox.reservePreviewActionIntent(edge);
 const exact={...edge,actionId:first.actionId,reservationNonce:first.reservationNonce};
 await assert.rejects(()=>verifiedOutbox.verifyPreviewActionEffect({
  proof:exact,resultDigest:"1".repeat(64)
 }),/BROWSER_ACTION_VERIFICATION_STATE_MISMATCH/);
 await verifiedOutbox.sealPreviewActionDispatch(exact);
 await assert.rejects(()=>verifiedOutbox.verifyPreviewActionEffect({
  proof:{...exact,documentEpoch:edge.documentEpoch-1},resultDigest:"1".repeat(64)
 }),/BROWSER_ACTION_VERIFICATION_STATE_MISMATCH/);
 for(const bad of [
  {proof:exact,resultDigest:"0".repeat(64)},
  {proof:exact,resultDigest:"1".repeat(64),approved:true}
 ]){
  await assert.rejects(()=>verifiedOutbox.verifyPreviewActionEffect(bad),
   /INVALID_BROWSER_ACTION_VERIFICATION/);
 }
 const done=await verifiedOutbox.verifyPreviewActionEffect({
  proof:exact,resultDigest:"1".repeat(64)
 });
 assert.deepEqual(done,{verified:true,actionId:first.actionId,
  state:"VERIFIED",resultVerified:true});
 assert.deepEqual(await new PromptOutbox(verifiedFile).pendingPreviewActions(previewId),[]);
 await assert.rejects(()=>verifiedOutbox.verifyPreviewActionEffect({
  proof:exact,resultDigest:"1".repeat(64)
 }),/BROWSER_ACTION_VERIFICATION_STATE_MISMATCH/);
 await assert.rejects(()=>verifiedOutbox.holdPreviewActionUncertain({
  workspaceId:previewId,actionId:first.actionId,
  reservationNonce:first.reservationNonce
 }),/BROWSER_ACTION_ALREADY_VERIFIED/);
 const second=await verifiedOutbox.reservePreviewActionIntent(base);
 assert.equal(second.reserved,true);
 assert.notEqual(second.actionId,first.actionId);
 assert.equal((await verifiedOutbox.read()).browserActions.length,2);
 assert.equal((await verifiedOutbox.pendingPreviewActions(previewId)).length,1);
 const invalidCompleted=JSON.parse(await readFile(verifiedFile,"utf8"));
 invalidCompleted.browserActions[0].resultDigest="0".repeat(64);
 await writeFile(verifiedFile,JSON.stringify(invalidCompleted));
 await assert.rejects(()=>new PromptOutbox(verifiedFile).read(),
  /CORRUPT_PROMPT_OUTBOX/);
 const legacy=join(dir,"legacy.json");
 await writeFile(legacy,JSON.stringify({schemaVersion:1,items:[]}));
 assert.deepEqual(await new PromptOutbox(legacy).read(),{
  schemaVersion:1,items:[]
 });
 const next=new PromptOutbox(legacy);
 assert.equal((await next.reservePreviewActionIntent(base)).reserved,true);
 assert.equal((await next.read()).browserActions.length,1);
 console.log("Browser action outbox source fixture: durable pending, replay hold, legacy and privacy checks");
}finally{
 await rm(dir,{recursive:true,force:true});
}
