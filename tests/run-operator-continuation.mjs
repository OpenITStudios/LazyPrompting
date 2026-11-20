import assert from "node:assert/strict";
import {prepareOperatorContinuation} from "../apps/desktop/src/app/operator-continuation.mjs";
const input={workspaceId:"workspace-01",priorDraft:"Inspect repository A",
 reply:"One file was modified but not tested.",nextAction:"Review the actual diff"};
const result=prepareOperatorContinuation(input);
assert.equal(result.ready,true);
assert.equal(result.status,"INPUT_VALIDATED");
assert.equal(result.source,"DESKTOP_INPUT_PREFLIGHT");
assert.equal(result.responseVerified,false);
assert.equal(result.deliveryVerified,false);
assert.equal(result.nextPromptAllowed,false);
assert.equal(result.excerpted,false);
assert.equal(Object.hasOwn(result,"prompt"),false,"Rust must be the sole draft formatter");
const clarification=prepareOperatorContinuation({...input,nextAction:undefined});
assert.equal(clarification.ready,true);
assert.equal(clarification.excerpted,false);
assert.equal(prepareOperatorContinuation({...input,nextAction:""}).ready,true);
for(const bad of [
 {...input,workspaceId:"workspace-11"}, {...input,reply:""},
 {...input,reply:"x".repeat(16001)}, {...input,nextAction:"x".repeat(801)},
 {...input,reply:"✓".repeat(6000)},
 {...input,nextAction:"✓".repeat(300)},
 {...input,priorDraft:"🛠".repeat(3001)},
 {...input,reply:"\u0000"}
]) assert.equal(prepareOperatorContinuation(bad).ready,false);
// Manual path accepts large valid input for native review without
// pretending that its 3,000-byte Codex Code Mode limit was satisfied.
const long=prepareOperatorContinuation({workspaceId:"workspace-10",
 priorDraft:"🛠".repeat(3000),reply:"✓".repeat(5000),nextAction:"Review evidence"});
assert.equal(long.ready,true);
assert.equal(long.excerpted,false);
assert.equal(Object.hasOwn(long,"prompt"),false);
const longClarification=prepareOperatorContinuation({workspaceId:"workspace-10",
 priorDraft:"🛠".repeat(3000),reply:"✓".repeat(5000)});
assert.equal(longClarification.ready,true);
assert.equal(longClarification.excerpted,true);
const second=prepareOperatorContinuation({...input,
 priorDraft:"Prior validated native draft",reply:"More findings"});
assert.equal(second.ready,true);
console.log("Operator continuation preflight assertions authored; native draft not executed");
