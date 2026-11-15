// Manual, deterministic Node-only IO baseline.
// This reports JSON wire bytes and MCP outer round trips, NOT LLM tokens,
// native Windows performance, or a statistically supported usage saving.
import assert from "node:assert/strict";
import {CapabilityRouter} from "../src/gateway/capability-router.mjs";
import {toMcpResult} from "../src/gateway/result-projection.mjs";

const gateway=new CapabilityRouter();
try {
 const status=await gateway.invoke("supervisor.status",{});
 const decision=await gateway.invoke("supervisor.evaluate",{input:{}});
 assert.equal(status.status,"OK");
 assert.equal(decision.status,"OK");
 const expected={
  gateway:status.structuredContent.gateway,
  hasDecision:decision.structuredContent!==null
 };
 const code=[
  "const s=await tools.supervisor.status();",
  "const d=await tools.supervisor.evaluate({input:{}});",
  "return {gateway:s.gateway,hasDecision:d !== null};"
 ].join("\n");
 const codeResult=await gateway.invoke("code_mode.execute",{code});
 assert.equal(codeResult.status,"OK",JSON.stringify(codeResult));
 assert.deepEqual(codeResult.structuredContent.value,expected);
 assert.equal(codeResult.structuredContent.toolCalls,2);

 const invoke=(id,name,args)=>({jsonrpc:"2.0",id,method:"tools/call",params:{
  name:"invoke_capability",arguments:{name,arguments:args}
 }});
 const wraps=(id,result)=>({jsonrpc:"2.0",id,result:toMcpResult(result)});
 const baselineRequests=[
  invoke(1,"supervisor.status",{}),
  invoke(2,"supervisor.evaluate",{input:{}})
 ];
 const composedRequest=invoke(1,"code_mode.execute",{code});
 const separateResponses=[wraps(1,status),wraps(2,decision)];
 const composedResponse=wraps(1,codeResult);
 const bytes=value=>Buffer.byteLength(JSON.stringify(value),"utf8");
 const total=messages=>messages.reduce((n,v)=>n+bytes(v)+1,0);
 const baseline={
  modelFacingBytes:total([...baselineRequests,...separateResponses]),
  responseBytes:total(separateResponses),
  outerRoundTrips:2,
  invokedCapabilities:2
 };
 const composed={
  modelFacingBytes:total([composedRequest,composedResponse]),
  responseBytes:total([composedResponse]),
  outerRoundTrips:1,
  invokedCapabilities:codeResult.structuredContent.toolCalls
 };
 assert.equal(baseline.outerRoundTrips-composed.outerRoundTrips,1);
 // No speculative bytes or token-savings threshold: the code text itself
 // may be larger than separate calls for small two-tool workloads.
 console.log(JSON.stringify({
  provenance:"SYNTHETIC_NODE_FIXTURE_NOT_INSTALLED",
  exactRuntimeRevision:"CHECK_CHECKED_OUT_SHA_MANUALLY",
  metric:"JSON_UTF8_WIRE_BYTES_AND_OUTER_ROUND_TRIPS",
  modelTokens:null,providerUsage:null,wallLatencyMs:null,
  baseline,codeMode:composed,
  delta:{
   modelFacingBytes:baseline.modelFacingBytes-composed.modelFacingBytes,
   responseBytes:baseline.responseBytes-composed.responseBytes,
   outerRoundTrips:baseline.outerRoundTrips-composed.outerRoundTrips
  },
  warning:"No real LLM tokenizer, native host, or network/provider invocation"
 }));
}finally{
 await gateway.close();
}
