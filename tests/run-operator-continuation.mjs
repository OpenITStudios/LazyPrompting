import assert from "node:assert/strict";
import {prepareOperatorContinuation} from "../apps/desktop/src/app/operator-continuation.mjs";
const input={workspaceId:"workspace-01",priorDraft:"Inspect repository A",
 reply:"One file was modified but not tested.",nextAction:"Review the actual diff"};
const result=prepareOperatorContinuation(input);
assert.equal(result.ready,true);
assert.equal(result.status,"DRAFT_ONLY");
assert.equal(result.responseVerified,false);
assert.equal(result.nextPromptAllowed,false);
const inferred=prepareOperatorContinuation({...input,nextAction:undefined});
assert.equal(inferred.ready,true);
assert.match(inferred.prompt,/Identify the next UNFINISHED step/);
assert.match(inferred.prompt,/No specific next step was supplied/);
assert.equal(inferred.responseVerified,false);
assert.equal(prepareOperatorContinuation({...input,nextAction:""}).ready,true);
assert.match(result.prompt,/OPERATOR-PASTED, UNVERIFIED/);
assert.match(result.prompt,/Review the actual diff/);
for(const bad of [
 {...input,workspaceId:"workspace-11"},
 {...input,reply:""},

 {...input,reply:"x".repeat(16001)},
 {...input,nextAction:"x".repeat(801)},
 {...input,reply:"\u0000"}
])assert.equal(prepareOperatorContinuation(bad).ready,false);
console.log("Operator continuation assertions passed");
