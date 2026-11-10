import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createDurableResponseRuntime} from "../src/prompt/durable-response-runtime.mjs";
const dir=await mkdtemp(join(tmpdir(),"lazy-response-runtime-"));
try{
 let state="ACKNOWLEDGED",count=0;
 const outbox={read:async()=>({items:[{workspaceId:"w",sessionId:"s",promptId:"p",responseHandle:"h",state}]}),
 pending:async()=>state==="RESPONSE_VERIFIED"?[]:[{workspaceId:"w",sessionId:"s",promptId:"p",responseHandle:"h",state}],
 reconcile:async()=>{state="RESPONSE_VERIFIED";}};
 const runtime=createDurableResponseRuntime({outbox,queuePath:join(dir,"queue.json"),leasePath:join(dir,"lease"),
  verifySession:async()=>true,observeResponse:async()=>({trusted:true,complete:true,sessionId:"s",responseHandle:"h",responseId:"r",text:"done"}),
  evaluate:async()=>{count++;return {decision:"REVIEW"};}});
 const result=await runtime.inspect({workspaces:[{workspaceId:"w",sessionId:"s"}]});
 assert.equal(result.status,"INSPECTION_COMPLETE");
 assert.equal(result.results[0].status,"EVALUATED");
 assert.equal(count,1);
 assert.equal((await runtime.pendingEvaluations()).length,0);
}finally{await rm(dir,{recursive:true,force:true});}
console.log("Durable response runtime scenarios authored, NOT_EXECUTED");
