import assert from "node:assert/strict";
import {ResponseLifecycle} from "../src/prompt/response-lifecycle.mjs";
const workspaces=[{workspaceId:"w1",sessionId:"s1"},{workspaceId:"w2",sessionId:"s2"}];
const lifecycle=new ResponseLifecycle({
 outbox:{read:async()=>({items:[{workspaceId:"w1",sessionId:"s1",state:"ACKNOWLEDGED"},{workspaceId:"w2",sessionId:"s2",state:"RESERVED"}]})},
 observer:{inspect:async()=>({status:"OBSERVED",responseId:"r1",responseText:"Done"})},
 evaluate:async()=>({decision:"REVIEW"})
});
const result=await lifecycle.inspect({workspaces});
assert.equal(result.status,"INSPECTION_COMPLETE");
assert.equal(result.results.length,1);
assert.equal(result.results[0].status,"EVALUATED");
console.log("Response lifecycle source scenarios authored, NOT_EXECUTED");
