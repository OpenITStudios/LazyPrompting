import assert from "node:assert/strict";
import test from "node:test";
import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {PromptOutbox} from "../src/prompt/prompt-outbox.mjs";
const goal={workspaceId:"workspace-01",goalDigest:"a".repeat(64),
 conversationDigest:"b".repeat(64),promptDigest:"c".repeat(64)};
test("native plugin intent persists hashes, blocks competing work and never authorizes a send",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"lazy-plugin-"));
 try{
  const path=join(dir,"outbox.json"),box=new PromptOutbox(path);
  const first=await box.reserveChatPluginIntent(goal);
  assert.equal(first.reserved,true);
  for(const k of ["deliveryVerified","resultVerified","nextPromptAllowed"])assert.equal(first[k],false);
  for(const k of ["bind","claim","receipt"])assert.match(first[k],/^[0-9a-f]{48}$/);
  const bytes=await readFile(path,"utf8");
  for(const k of ["bind","claim","receipt"])assert.equal(bytes.includes(first[k]),false);
  const reopened=new PromptOutbox(path);
  assert.equal((await reopened.reserveChatPluginIntent(goal)).reason,"WORKSPACE_CHAT_PLUGIN_PENDING");
  assert.equal((await reopened.reserve({...goal,sessionId:"chat",taskId:"task",
   contextRevision:1,prompt:"prompt",promptLimit:2})).reason,"WORKSPACE_CHAT_PLUGIN_PENDING");
  assert.equal((await reopened.reserveOperatorChatAttempt({workspaceId:goal.workspaceId,
   conversationDigest:goal.conversationDigest,promptDigest:goal.promptDigest}))
   .reason,"WORKSPACE_CHAT_PLUGIN_PENDING");
  assert.equal((await reopened.reservePreviewActionIntent({workspaceId:goal.workspaceId,
   documentEpoch:1,snapshotFingerprint:"d".repeat(64),targetDigest:"e".repeat(64),
   operation:"CLICK",textDigest:null})).reason,"WORKSPACE_CHAT_PLUGIN_PENDING");
  const id="12345678-1234-1234-1234-123456789abc";
  assert.equal((await reopened.reserveAgentIntent({workspaceId:goal.workspaceId,
   taskId:"task",goalId:id,runId:id+"."+"f".repeat(32),profileId:"codex",
   scopeHash:"a".repeat(64),sourceSha:"a".repeat(40),
   contextRevision:1,prompt:"prompt",promptLimit:2})).reason,"WORKSPACE_CHAT_PLUGIN_PENDING");
  const held=await reopened.holdChatPluginIntent({workspaceId:goal.workspaceId,turnId:first.turnId});
  assert.equal(held.state,"RECONCILE_REQUIRED");
  assert.equal((await new PromptOutbox(path).pendingChatPluginIntent(goal.workspaceId)).state,
   "RECONCILE_REQUIRED");
  assert.equal((await reopened.reserveChatPluginIntent({...goal,promptDigest:"f".repeat(64)}))
   .reason,"WORKSPACE_CHAT_PLUGIN_PENDING");
  const status=await reopened.pendingChatPluginIntent(goal.workspaceId);
  assert.equal(status.resultVerified,false);
  assert.equal(status.nextPromptAllowed,false);
  assert.equal(JSON.stringify(status).includes(first.bind),false);
  assert.equal((await reopened.pendingChatPluginIntent("workspace-02")).active,0);
  for(const bad of [{...goal,approved:true},{...goal,workspaceId:"workspace-11"},
   {...goal,goalDigest:"0".repeat(64)},{...goal,rawPrompt:"secret"}])
    await assert.rejects(()=>box.reserveChatPluginIntent(bad),/CHAT_PLUGIN_INVALID_INTENT/);
  const tampered=JSON.parse(await readFile(path,"utf8"));
  tampered.chatPluginIntents[0].qa="PASSED";
  const corrupt=join(dir,"corrupt.json"),encoded=JSON.stringify(tampered);
  await writeFile(corrupt,encoded);
  await assert.rejects(()=>new PromptOutbox(corrupt).reserveChatPluginIntent(goal),
   /CORRUPT_PROMPT_OUTBOX/);
  assert.equal(await readFile(corrupt,"utf8"),encoded);
  const other=new PromptOutbox(join(dir,"operator.json"));
  assert.equal((await other.reserveOperatorChatAttempt({workspaceId:goal.workspaceId,
   conversationDigest:goal.conversationDigest,promptDigest:goal.promptDigest})).reserved,true);
  assert.equal((await other.reserveChatPluginIntent(goal)).reason,"WORKSPACE_OPERATOR_CHAT_PENDING");
  const race=new PromptOutbox(join(dir,"race.json"));
  const results=await Promise.allSettled([race.reserveChatPluginIntent(goal),
   new PromptOutbox(race.path).reserveChatPluginIntent(goal)]);
  assert.equal(results.filter(x=>x.status==="fulfilled"&&x.value.reserved).length,1);
  for(const result of results){
   if(result.status==="rejected")assert.match(String(result.reason),/OUTBOX_LOCK_BUSY/);
   else if(!result.value.reserved)assert.equal(result.value.reason,"WORKSPACE_CHAT_PLUGIN_PENDING");
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});
