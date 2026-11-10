import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {DurableEvaluationQueue} from "../src/prompt/durable-evaluation-queue.mjs";
const dir=await mkdtemp(join(tmpdir(),"lazy-evaluation-"));
try{const q=new DurableEvaluationQueue(join(dir,"queue.json"));
 assert.equal((await q.enqueue({workspaceId:"w1",sessionId:"s1",responseId:"r1"})).enqueued,true);
 assert.equal((await q.enqueue({workspaceId:"w1",sessionId:"s1",responseId:"r1"})).enqueued,false);
 assert.equal((await q.pending()).length,1);
 await assert.rejects(q.complete({workspaceId:"w1",sessionId:"s1",responseId:"r1",verified:false}));
 await q.complete({workspaceId:"w1",sessionId:"s1",responseId:"r1",verified:true});
 assert.equal((await q.pending()).length,0);
}finally{await rm(dir,{recursive:true,force:true});}
console.log("Durable evaluation queue scenarios authored, NOT_EXECUTED");
