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

test("plugin bind code requires exact native goal, workspace and chat",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"lazy-plugin-bind-"));
 try{
  const file=join(dir,"outbox.json"),box=new PromptOutbox(file);
  const first=await box.reserveChatPluginIntent(goal);
  assert.equal(first.reserved,true);
  const scope={workspaceId:goal.workspaceId,goalDigest:goal.goalDigest,
    conversationDigest:goal.conversationDigest,principalTag:"f".repeat(64)};
  const bind={...scope,bind:first.bind};
  const missing=await box.bindChatPluginIdentity({...scope,bind:"0".repeat(48)});
  assert.equal(missing.bound,false);
  for(const invalid of [
   {...bind,principalTag:"0".repeat(64)},
   {...bind,approved:true},{...bind,bind:"invalid"},
   {...bind,workspaceId:"workspace-11"},
   {...bind,goalDigest:"invalid"},{...bind,conversationDigest:"0".repeat(64)},
  ])await assert.rejects(()=>box.bindChatPluginIdentity(invalid),/CHAT_PLUGIN_INVALID_BIND/);
  for(const changed of [
   {...bind,workspaceId:"workspace-02"},
   {...bind,goalDigest:"d".repeat(64)},
   {...bind,conversationDigest:"e".repeat(64)},
  ]){
   const result=await box.bindChatPluginIdentity(changed);
   assert.equal(result.bound,false);
   assert.equal(result.reason,"CHAT_PLUGIN_BIND_UNAVAILABLE");
   assert.equal(result.nextPromptAllowed,false);
   assert.equal((await box.pendingChatPluginIntent(goal.workspaceId)).state,"RESERVED_UNVERIFIED");
  }
  const linked=await box.bindChatPluginIdentity(bind);
  assert.equal(linked.bound,true);
  assert.equal(linked.state,"IDENTITY_BOUND_UNVERIFIED");
  for(const key of ["deliveryVerified","resultVerified","nextPromptAllowed"])
   assert.equal(linked[key],false);
  const raw=await readFile(file,"utf8");
  assert.equal(raw.includes(first.bind),false);
  const again=await new PromptOutbox(file).bindChatPluginIdentity(bind);
  assert.equal(again.bound,false);
  assert.equal((await box.reserveChatPluginIntent(goal)).reason,"WORKSPACE_CHAT_PLUGIN_PENDING");
  assert.equal((await new PromptOutbox(file).pendingChatPluginIntent(goal.workspaceId))
   .state,"IDENTITY_BOUND_UNVERIFIED");
  await box.holdChatPluginIntent({workspaceId:goal.workspaceId,turnId:first.turnId});
  assert.equal((await new PromptOutbox(file).pendingChatPluginIntent(goal.workspaceId))
   .state,"RECONCILE_REQUIRED");
  const current=JSON.parse(raw);
  const legacy=structuredClone(current);
  delete legacy.chatPluginIntents[0].issuedAt;
  delete legacy.chatPluginIntents[0].expiresAt;
  delete legacy.chatPluginIntents[0].principalTag;
  legacy.chatPluginIntents[0].state="RESERVED_UNVERIFIED";
  const oldFile=join(dir,"legacy.json");
  await writeFile(oldFile,JSON.stringify(legacy));
  const historical=new PromptOutbox(oldFile);
  assert.equal((await historical.read()).chatPluginIntents.length,1);
  assert.equal((await historical.bindChatPluginIdentity(bind)).bound,false);
  const expired=structuredClone(current);
  delete expired.chatPluginIntents[0].principalTag;
  expired.chatPluginIntents[0].state="RESERVED_UNVERIFIED";
  expired.chatPluginIntents[0].issuedAt=Date.now()-1200000;
  expired.chatPluginIntents[0].expiresAt=expired.chatPluginIntents[0].issuedAt+600000;
  const expFile=join(dir,"expired.json");
  await writeFile(expFile,JSON.stringify(expired));
  const stale=new PromptOutbox(expFile);
  assert.equal((await stale.bindChatPluginIdentity(bind)).bound,false);
  assert.equal((await stale.pendingChatPluginIntent(goal.workspaceId)).active,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test("plugin outbox rejects type-coercible identities, tokens and corrupted JSON",async()=>{
 const root=await mkdtemp(join(tmpdir(),"lazy-plugin-types-"));
 try{
  const path=join(root,"outbox.json"),box=new PromptOutbox(path);
  for(const invalid of [
   {...goal,workspaceId:[goal.workspaceId]},
   {...goal,workspaceId:goal.workspaceId+"\n"},
   {...goal,goalDigest:[goal.goalDigest]},
   {...goal,goalDigest:goal.goalDigest+"\n"},
   {...goal,conversationDigest:[goal.conversationDigest]},
   {...goal,promptDigest:[goal.promptDigest]},
  ])await assert.rejects(()=>box.reserveChatPluginIntent(invalid),
   /CHAT_PLUGIN_INVALID_INTENT/);
  const first=await box.reserveChatPluginIntent(goal);
  assert.equal(first.reserved,true);
  const scoped={workspaceId:goal.workspaceId,goalDigest:goal.goalDigest,
   conversationDigest:goal.conversationDigest,principalTag:"f".repeat(64),
   bind:first.bind};
  for(const invalid of [
   {...scoped,bind:[first.bind]},{...scoped,bind:first.bind+"\n"},
   {...scoped,principalTag:["f".repeat(64)]},
   {...scoped,workspaceId:[goal.workspaceId]},
   {...scoped,conversationDigest:[goal.conversationDigest]},
   {...scoped,goalDigest:[goal.goalDigest]},
  ])await assert.rejects(()=>box.bindChatPluginIdentity(invalid),
   /CHAT_PLUGIN_INVALID_BIND/);
  await assert.rejects(()=>box.holdChatPluginIntent({
   workspaceId:[goal.workspaceId],turnId:first.turnId}),/CHAT_PLUGIN_INVALID_HOLD/);
  await assert.rejects(()=>box.holdChatPluginIntent({
   workspaceId:goal.workspaceId,turnId:[first.turnId]}),/CHAT_PLUGIN_INVALID_HOLD/);
  await assert.rejects(()=>box.pendingChatPluginIntent([goal.workspaceId]),
   /CHAT_PLUGIN_INVALID_WORKSPACE/);
  assert.equal((await box.pendingChatPluginIntent(goal.workspaceId)).state,
   "RESERVED_UNVERIFIED");
  const good=await box.read();
  const badPath=join(root,"tampered.json");
  for(const patch of [
   {workspaceId:[goal.workspaceId]},
   {turnId:[first.turnId]},
   {goalDigest:[goal.goalDigest]},
   {conversationDigest:goal.conversationDigest+"\n"},
   {bindDigest:[good.chatPluginIntents[0].bindDigest]},
  ]){
   const tampered=structuredClone(good);
   Object.assign(tampered.chatPluginIntents[0],patch);
   const bytes=JSON.stringify(tampered);
   await writeFile(badPath,bytes);
   const damaged=new PromptOutbox(badPath);
   await assert.rejects(()=>damaged.read(),/CORRUPT_PROMPT_OUTBOX/);
   await assert.rejects(()=>damaged.reserveChatPluginIntent(goal),
    /CORRUPT_PROMPT_OUTBOX/);
   assert.equal(await readFile(badPath,"utf8"),bytes);
  }
  // Invalid requests never consumed the original bind token.
  assert.equal((await box.bindChatPluginIdentity(scoped)).bound,true);
  assert.equal((await new PromptOutbox(path).pendingChatPluginIntent(goal.workspaceId))
   .state,"IDENTITY_BOUND_UNVERIFIED");
 }finally{await rm(root,{recursive:true,force:true});}
});


test("private pending diagnosis identifies holds without changing state or granting retry",async()=>{
 const root=await mkdtemp(join(tmpdir(),"lazy-plugin-status-"));
 try{
  const path=join(root,"outbox.json"),box=new PromptOutbox(path);
  const empty=await box.pendingChatPluginIntent(goal.workspaceId);
  assert.equal(empty.active,0);
  assert.equal(empty.diagnostic,"NO_PENDING");
  assert.equal(empty.operatorReviewRequired,false);
  assert.equal(empty.safeToRetry,false);
  assert.equal(empty.autoReleaseAllowed,false);
  const first=await box.reserveChatPluginIntent(goal);
  const disk=await readFile(path,"utf8");
  const fresh=await new PromptOutbox(path).pendingChatPluginIntent(goal.workspaceId);
  assert.equal(fresh.state,"RESERVED_UNVERIFIED");
  assert.equal(fresh.diagnostic,"AWAITING_VERIFIED_BINDING");
  assert.equal(fresh.operatorReviewRequired,true);
  for(const key of ["safeToRetry","autoReleaseAllowed","nextPromptAllowed",
   "deliveryVerified","resultVerified"])assert.equal(fresh[key],false);
  for(const code of [first.bind,first.claim,first.receipt,goal.goalDigest,
   goal.conversationDigest,goal.promptDigest])
   assert.equal(JSON.stringify(fresh).includes(code),false);
  assert.equal(await readFile(path,"utf8"),disk); // No state write.
  const row=JSON.parse(disk);
  const store=async(name,value)=>{
   const pathname=join(root,name+".json");
   await writeFile(pathname,JSON.stringify(value));
   return new PromptOutbox(pathname);
  };
  const original=row.chatPluginIntents[0];
  const legacy=structuredClone(row);
  delete legacy.chatPluginIntents[0].issuedAt;
  delete legacy.chatPluginIntents[0].expiresAt;
  const legacyBox=await store("legacy",legacy);
  assert.equal((await legacyBox.pendingChatPluginIntent(goal.workspaceId)).diagnostic,
   "LEGACY_UNTIMED_HOLD");
  const expired=structuredClone(row);
  expired.chatPluginIntents[0].issuedAt=Date.now()-20*60*1000;
  expired.chatPluginIntents[0].expiresAt=expired.chatPluginIntents[0].issuedAt+600000;
  const expiredBox=await store("expired",expired);
  assert.equal((await expiredBox.pendingChatPluginIntent(goal.workspaceId)).diagnostic,
   "BIND_WINDOW_EXPIRED_HOLD");
  assert.equal((await expiredBox.reserveChatPluginIntent(goal)).reason,
   "WORKSPACE_CHAT_PLUGIN_PENDING"); // Expiry never releases it.
  const future=structuredClone(row);
  future.chatPluginIntents[0].issuedAt=Date.now()+20*60*1000;
  future.chatPluginIntents[0].expiresAt=future.chatPluginIntents[0].issuedAt+600000;
  const futureBox=await store("future",future);
  assert.equal((await futureBox.pendingChatPluginIntent(goal.workspaceId)).diagnostic,
   "CLOCK_UNCERTAIN_HOLD");
  assert.equal((await futureBox.reserveChatPluginIntent(goal)).reason,
   "WORKSPACE_CHAT_PLUGIN_PENDING");
  const bound=await box.bindChatPluginIdentity({
   workspaceId:goal.workspaceId,goalDigest:goal.goalDigest,
   conversationDigest:goal.conversationDigest,principalTag:"f".repeat(64),
   bind:first.bind,
  });
  assert.equal(bound.bound,true);
  const boundState=await new PromptOutbox(path).pendingChatPluginIntent(goal.workspaceId);
  assert.equal(boundState.diagnostic,"IDENTITY_LINKED_CHAT_UNVERIFIED");
  assert.equal(boundState.safeToRetry,false);
  await box.holdChatPluginIntent({workspaceId:goal.workspaceId,turnId:first.turnId});
  const held=await new PromptOutbox(path).pendingChatPluginIntent(goal.workspaceId);
  assert.equal(held.diagnostic,"RECONCILE_REQUIRED");
  assert.equal(held.autoReleaseAllowed,false);
  assert.equal(held.operatorReviewRequired,true);
  assert.equal((await box.reserveChatPluginIntent(goal)).reason,
   "WORKSPACE_CHAT_PLUGIN_PENDING");
  const same=await box.pendingChatPluginIntent("workspace-02");
  assert.equal(same.diagnostic,"NO_PENDING");
  assert.equal(same.safeToRetry,false);
  // No diagnostic includes a raw token, account identity or session text.
  assert.equal(JSON.stringify(held).includes(first.bind),false);
  assert.equal(JSON.stringify(boundState).includes(original.principalTag??"___"),false);
 }finally{await rm(root,{recursive:true,force:true});}
});
