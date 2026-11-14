import assert from "node:assert/strict";
import {prepareOperatorContinuation} from "../apps/desktop/src/app/operator-continuation.mjs";
const bytes=s=>new TextEncoder().encode(s).length;
const input={workspaceId:"workspace-01",priorDraft:"Inspect repository A",
 reply:"One file was modified but not tested.",nextAction:"Review the actual diff"};
const result=prepareOperatorContinuation(input);
assert.equal(result.ready,true);
assert.equal(result.status,"DRAFT_ONLY");
assert.equal(result.responseVerified,false);
assert.equal(result.nextPromptAllowed,false);
assert.equal(result.excerpted,false);
assert.match(result.prompt,/OPERATOR-PASTED, UNVERIFIED/);
assert.match(result.prompt,/Review the actual diff/);
assert.ok(bytes(result.prompt)<=12000);
const inferred=prepareOperatorContinuation({...input,nextAction:undefined});
assert.equal(inferred.ready,true);
assert.match(inferred.prompt,/Identify the next UNFINISHED step/);
assert.equal(prepareOperatorContinuation({...input,nextAction:""}).ready,true);
for(const bad of [
 {...input,workspaceId:"workspace-11"}, {...input,reply:""},
 {...input,reply:"x".repeat(16001)}, {...input,nextAction:"x".repeat(801)},
 {...input,reply:"\u0000"}
]) assert.equal(prepareOperatorContinuation(bad).ready,false);
// Maximum legitimate input must still yield a draft that the native Send once
// boundary accepts, even with multi-byte Unicode and repeated rounds.
const long=prepareOperatorContinuation({workspaceId:"workspace-10",
 priorDraft:"🛠".repeat(3000),reply:"✓".repeat(8000),nextAction:"Review evidence"});
assert.equal(long.ready,true);
assert.equal(long.excerpted,true);
assert.ok(bytes(long.prompt)<=12000);
assert.match(long.prompt,/EXCERPT/);
const second=prepareOperatorContinuation({...input,priorDraft:long.prompt,reply:"More findings"});
assert.equal(second.ready,true);
assert.ok(bytes(second.prompt)<=12000);
console.log("Operator continuation assertions passed");
