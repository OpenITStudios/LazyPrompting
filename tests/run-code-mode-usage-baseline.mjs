// Manual deterministic Node-only IO comparison. Source fixture, not a
// token/latency saving, Windows result, or independently verified model run.
import assert from "node:assert/strict";
import {CapabilityRouter,projectCheckpointSummary} from "../src/gateway/capability-router.mjs";
import {toMcpResult} from "../src/gateway/result-projection.mjs";

const invoke=(id,name,args)=>({jsonrpc:"2.0",id,method:"tools/call",params:{
 name:"invoke_capability",arguments:{name,arguments:args}
}});
const wraps=(id,result)=>({jsonrpc:"2.0",id,result:toMcpResult(result)});
const bytes=value=>Buffer.byteLength(JSON.stringify(value),"utf8");
const total=messages=>messages.reduce((n,v)=>n+bytes(v)+1,0);
function measure(entries,code,codeResult){
 const directRequests=entries.map(([name,args],i)=>invoke(i+1,name,args));
 const directResponses=entries.map(([, ,result],i)=>wraps(i+1,result));
 const composedRequest=invoke(1,"code_mode.execute",{code});
 const composedResponse=wraps(1,codeResult);
 const baseline={
  modelFacingBytes:total([...directRequests,...directResponses]),
  responseBytes:total(directResponses),
  outerRoundTrips:entries.length,invokedCapabilities:entries.length
 };
 const codeMode={
  modelFacingBytes:total([composedRequest,composedResponse]),
  responseBytes:total([composedResponse]),outerRoundTrips:1,
  invokedCapabilities:codeResult.structuredContent.toolCalls
 };
 return {baseline,codeMode,delta:{
  modelFacingBytes:baseline.modelFacingBytes-codeMode.modelFacingBytes,
  responseBytes:baseline.responseBytes-codeMode.responseBytes,
  outerRoundTrips:baseline.outerRoundTrips-codeMode.outerRoundTrips
 }};
}

const gateway=new CapabilityRouter();
try{
 const status=await gateway.invoke("supervisor.status",{});
 const decision=await gateway.invoke("supervisor.evaluate",{input:{}});
 assert.equal(status.status,"OK");
 assert.equal(decision.status,"OK");
 const expected={gateway:status.structuredContent.gateway,
  hasDecision:decision.structuredContent!==null};
 const code=[
  "const s=await tools.supervisor.status();",
  "const d=await tools.supervisor.evaluate({input:{}});",
  "return {gateway:s.gateway,hasDecision:d !== null};"
 ].join("\n");
 const codeResult=await gateway.invoke("code_mode.execute",{code});
 assert.equal(codeResult.status,"OK",JSON.stringify(codeResult));
 assert.deepEqual(codeResult.structuredContent.value,expected);
 assert.equal(codeResult.structuredContent.toolCalls,2);
 const supervisor=measure([
  ["supervisor.status",{},status],
  ["supervisor.evaluate",{input:{}},decision]
 ],code,codeResult);
 assert.equal(supervisor.delta.outerRoundTrips,1);

 // Compare the direct checkpoint.read contract with the same canonical
 // recovery state projected through Code Mode's checkpoint.summary.
 const recovery={state:"READY",checkpoint:{
  phase:"READY",version:4,pendingTaskId:null,
  privateFixture:"excluded-from-code-mode"
 }};
 const recovered=new CapabilityRouter({checkpointStore:{
  recovery:async()=>recovery
 }});
 let checkpoint;
 try{
  const raw=await recovered.invoke("checkpoint.read",{});
  const health=await recovered.invoke("supervisor.status",{});
  assert.equal(raw.status,"OK");
  assert.equal(health.status,"OK");
  const projected=projectCheckpointSummary(raw.structuredContent);
  const recoveryCode=[
   "const r=await tools.checkpoint.summary();",
   "const h=await tools.supervisor.status();",
   "return {state:r.state,version:r.version,",
   "gateway:h.gateway,nextAllowed:r.nextPromptAllowed};"
  ].join("\n");
  const compact=await recovered.invoke("code_mode.execute",{code:recoveryCode});
  assert.equal(compact.status,"OK",JSON.stringify(compact));
  assert.deepEqual(compact.structuredContent.value,{
   state:projected.state,version:projected.version,
   gateway:health.structuredContent.gateway,
   nextAllowed:projected.nextPromptAllowed
  });
  assert.equal(compact.structuredContent.toolCalls,2);
  assert.ok(!JSON.stringify(compact).includes("excluded-from-code-mode"));
  checkpoint=measure([
   ["checkpoint.read",{},raw],
   ["supervisor.status",{},health]
  ],recoveryCode,compact);
  assert.equal(checkpoint.delta.outerRoundTrips,1);
 }finally{await recovered.close();}

 console.log(JSON.stringify({
  provenance:"SYNTHETIC_NODE_FIXTURE_NOT_INSTALLED",
  exactRuntimeRevision:"CHECK_CHECKED_OUT_SHA_MANUALLY",
  metric:"JSON_UTF8_WIRE_BYTES_AND_OUTER_ROUND_TRIPS",
  modelTokens:null,providerUsage:null,wallLatencyMs:null,
  // Preserve original output keys for existing baseline readers.
  baseline:supervisor.baseline,codeMode:supervisor.codeMode,delta:supervisor.delta,
  scenarios:[
   {name:"supervisor_pure",...supervisor},
   {name:"checkpoint_recovery",...checkpoint}
  ],
  warning:"No measured model tokens, native host, or network/provider invocation"
 }));
}finally{await gateway.close();}
