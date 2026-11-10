import assert from "node:assert/strict";
import {ResponseObserver} from "../src/prompt/response-observer.mjs";
import {ResponseLifecycle} from "../src/prompt/response-lifecycle.mjs";
const state={items:[{workspaceId:"w",sessionId:"s",promptId:"p",responseHandle:"h",state:"ACKNOWLEDGED"}]};
const queued=[];
const queue={
 enqueue:async x=>{if(!queued.some(y=>y.responseId===x.responseId))queued.push({...x,state:"PENDING"});},
 pending:async()=>queued.filter(x=>x.state==="PENDING"),
 complete:async x=>{const item=queued.find(y=>y.responseId===x.responseId);assert.equal(x.verified,true);item.state="EVALUATED";}
};
const outbox={read:async()=>state,pending:async()=>state.items.filter(x=>x.state!=="RESPONSE_VERIFIED"),
 reconcile:async()=>{assert.equal(queued.length,1);state.items[0].state="RESPONSE_VERIFIED";}};
const observer=new ResponseObserver({outbox,evaluationQueue:queue,verifySession:async()=>true,
 observeResponse:async()=>({trusted:true,complete:true,sessionId:"s",responseHandle:"h",responseId:"r",text:"done"})});
const lifecycle=new ResponseLifecycle({outbox,observer,evaluationQueue:queue,evaluate:async()=>({decision:"REVIEW"})});
const result=await lifecycle.inspect({workspaces:[{workspaceId:"w",sessionId:"s"}]});
assert.equal(result.results[0].status,"EVALUATED");
assert.equal((await queue.pending()).length,0);
console.log("Durable response bridge scenarios authored, NOT_EXECUTED");
