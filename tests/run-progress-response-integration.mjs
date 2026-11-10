import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createDurableResponseRuntime} from "../src/prompt/durable-response-runtime.mjs";
const dir=await mkdtemp(join(tmpdir(),"lazy-progress-runtime-"));
try{
 let state="ACKNOWLEDGED";
 const outbox={read:async()=>({items:[{workspaceId:"w",sessionId:"s",promptId:"p",responseHandle:"h",state}]}),
  pending:async()=>state==="RESPONSE_VERIFIED"?[]:[{workspaceId:"w",sessionId:"s",promptId:"p",responseHandle:"h",state}],
  reconcile:async()=>{state="RESPONSE_VERIFIED";}};
 const runtime=createDurableResponseRuntime({outbox,queuePath:join(dir,"q.json"),leasePath:join(dir,"lease"),
  progressPath:join(dir,"progress.json"),verifySession:async()=>true,
  observeResponse:async()=>({trusted:true,complete:true,sessionId:"s",responseHandle:"h",responseId:"r",text:"done"}),
  evaluate:async()=>({verified:true,progressMade:false})});
 const result=await runtime.inspect({workspaces:[{workspaceId:"w",sessionId:"s"}]});
 assert.equal(result.results[0].status,"EVALUATED");
 assert.equal((await runtime.progressSnapshot())[0].noProgressCycles,1);
}finally{await rm(dir,{recursive:true,force:true});}
console.log("Progress response integration source tests authored, NOT_EXECUTED");
