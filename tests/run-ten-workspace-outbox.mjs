import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {PromptOutbox} from "../src/prompt/prompt-outbox.mjs";
const root=await mkdtemp(join(tmpdir(),"lazy-ten-workspaces-"));
try{
 const outbox=new PromptOutbox(join(root,"outbox.json"));
 const req=i=>({workspaceId:"ws"+i,sessionId:"chat"+i,taskId:"task"+i,
  contextRevision:1,prompt:"Continue workspace "+i,promptLimit:1,maxConcurrent:2});
 const first=await Promise.all([outbox.reserve(req(1)),outbox.reserve(req(2))]);
 assert.equal(first.filter(x=>x.reserved).length,2);
 assert.equal((await outbox.reserve(req(3))).reason,"GLOBAL_CAPACITY_REACHED");
 for(let i=1;i<=2;i++){
  await outbox.ack({workspaceId:"ws"+i,promptId:first[i-1].promptId,hostReceipt:{responseHandle:"handle"+i}});
  await outbox.reconcile({workspaceId:"ws"+i,promptId:first[i-1].promptId,responseId:"response"+i,verified:true});
 }
 const rest=await Promise.all(Array.from({length:8},(_,i)=>outbox.reserve(req(i+3))));
 assert.equal(rest.filter(x=>x.reserved).length,2);
 assert.equal(new Set((await outbox.read()).items.map(x=>x.workspaceId)).size,4);
 assert.equal((await outbox.reserve(req(1))).reason,"PROMPT_BUDGET_EXHAUSTED");
}finally{await rm(root,{recursive:true,force:true});}
console.log("Ten-workspace isolation and capacity source assertions authored, NOT_EXECUTED");
