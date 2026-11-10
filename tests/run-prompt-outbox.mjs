import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {PromptOutbox} from "../src/prompt/prompt-outbox.mjs";
const root=await mkdtemp(join(tmpdir(),"lazy-prompt-outbox-"));
try{
 const outbox=new PromptOutbox(join(root,"outbox.json"));
 const req={workspaceId:"ws1",sessionId:"chat1",taskId:"t1",contextRevision:1,prompt:"Continue exact work",promptLimit:2,maxConcurrent:2};
 const first=await outbox.reserve(req);
 assert.equal(first.reserved,true);
 assert.equal((await outbox.reserve(req)).reserved,false);
 assert.equal((await outbox.pending("ws1")).length,1);
 await outbox.ack({workspaceId:"ws1",promptId:first.promptId,hostReceipt:{responseHandle:"handle1"}});
 await outbox.reconcile({workspaceId:"ws1",promptId:first.promptId,responseId:"response1",verified:true});
 assert.equal((await outbox.pending("ws1")).length,0);
 assert.equal((await outbox.reserve(req)).reserved,true);
}finally{await rm(root,{recursive:true,force:true});}
console.log("Prompt outbox assertions authored, NOT_EXECUTED");
