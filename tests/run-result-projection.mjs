import assert from "node:assert/strict";
import {projectResult,toMcpResult} from "../src/gateway/result-projection.mjs";
assert.equal(projectResult({status:"OK",structuredContent:{x:1}}).status,"OK");
assert.equal(projectResult({status:"OK",structuredContent:{x:"z".repeat(20000)}}).code,"RESULT_EXCEEDS_BUDGET");
assert.equal(projectResult({status:"ERROR",code:"BAD"}).code,"BAD");
assert.equal(toMcpResult({status:"OK",structuredContent:{x:1}}).content[0].text,"Structured result available");
assert.equal(toMcpResult({status:"ERROR",code:"BAD"}).isError,true);
console.log("Projection contract: 5 assertions passed");
