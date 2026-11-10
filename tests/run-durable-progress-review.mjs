import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {DurableProgressReview} from "../src/prompt/durable-progress-review.mjs";
const dir=await mkdtemp(join(tmpdir(),"lazy-progress-"));
try{
 const store=new DurableProgressReview(join(dir,"progress.json"));
 for(let i=1;i<=3;i++)assert.equal((await store.record({workspaceId:"w",sessionId:"s",responseId:"r"+i,verified:true,progressMade:false})).noProgressCycles,i);
 assert.equal((await store.record({workspaceId:"w",sessionId:"s",responseId:"r3",verified:true,progressMade:false})).duplicate,true);
 assert.equal((await store.snapshot())[0].noProgressCycles,3);
 await assert.rejects(store.record({workspaceId:"w",sessionId:"s",responseId:"r4",verified:false,progressMade:true}));
 assert.equal((await store.record({workspaceId:"w",sessionId:"s",responseId:"r4",verified:true,progressMade:true})).noProgressCycles,0);
}finally{await rm(dir,{recursive:true,force:true});}
console.log("Durable progress review scenarios authored, NOT_EXECUTED");
