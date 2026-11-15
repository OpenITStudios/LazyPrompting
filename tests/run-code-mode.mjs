import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {CapabilityRouter} from "../src/gateway/capability-router.mjs";
import {codeModeCatalog} from "../src/gateway/code-mode-runtime.mjs";

const gateway = new CapabilityRouter();
const catalog = (await gateway.invoke("code_mode.catalog")).structuredContent;
assert.equal(catalog.engine,"CONFINED_JS_READ_ONLY");
assert.deepEqual(catalog.capabilities.map(x=>x.name),
 ["supervisor.status","supervisor.evaluate"]);
assert.equal(codeModeCatalog().maxToolCalls,8);
async function run(code) {
  return gateway.invoke("code_mode.execute",{code});
}
const composed=await run([
 "const first = await tools.supervisor.status();",
 "const second = await tools.supervisor.evaluate({input:{}});",
 "return {gateway:first.gateway, hasSecond:second !== null};"
].join("\n"));
assert.equal(composed.status,"OK",JSON.stringify(composed));
assert.equal(composed.structuredContent.value.gateway,"READY");
assert.equal(composed.structuredContent.value.hasSecond,true);
assert.equal(composed.structuredContent.toolCalls,2);

const selected=await run([
 "const response=await tools.supervisor.status();",
 "const result=[];",
 "for(const item of Object.keys(response)){",
 "  if(item === 'gateway' || item === 'mode') result.push(item);",
 "}",
 "return result;"
].join("\n"));
assert.equal(selected.status,"OK",JSON.stringify(selected));
assert.deepEqual(selected.structuredContent.value,["gateway","mode"]);

for (const code of [
 "return process;",
 "return globalThis;",
 "return this;",
 "return await tools.browser.open({url:'https://example.com'});",
 "return await tools.code_mode.execute({code:'return 1'});",
 "return ({}).constructor;",
 "return ({__proto__: {admin:true}});",
 "while(true){}",
 "return new Function('return process')();",
 "return import('node:fs');",
 "const a=globalThis;return a;",
 "return Object.getPrototypeOf({});"
]) {
 const answer=await run(code);
 assert.equal(answer.status,"ERROR",code);
 assert.match(answer.code,/^CODE_MODE_/);
}
const excessiveString = await run([
 "const a = 'x';",
 ...Array.from({length:16},(_,i)=>
   "const v"+i+" = "+(i===0?"a+a":"v"+(i-1)+"+v"+(i-1))+";"),
 "return v15;"
].join("\n"));
assert.equal(excessiveString.code,"CODE_MODE_DATA_LIMIT");

const excessiveObject = await run([
 "const a = {data:'data'};",
 ...Array.from({length:15},(_,i)=>
   "const v"+i+" = {left:"+(i===0?"a":"v"+(i-1))+",right:"+(i===0?"a":"v"+(i-1))+"};"),
 "return v14;"
].join("\n"));
assert.equal(excessiveObject.code,"CODE_MODE_DATA_LIMIT");

const capped=await run([
 "for(const item of [1,2,3,4,5,6,7,8,9]){",
 " await tools.supervisor.status();",
 "}",
 "return true;"
].join("\n"));
assert.equal(capped.code,"CODE_MODE_CALL_LIMIT");
assert.equal((await run("return tools.supervisor.status;")).status,"ERROR");
assert.equal((await gateway.invoke("code_mode.execute",{code:""})).code,"INVALID_ARGUMENTS");
assert.equal((await gateway.invoke("code_mode.execute",{code:"return 1",extra:true})).code,"INVALID_ARGUMENTS");
await gateway.close();
assert.equal((await gateway.invoke("code_mode.execute",{code:"return 1;"})).code,"GATEWAY_CLOSED");

const standalone=spawnSync(process.execPath,["src/gateway/mcp-gateway.mjs"],{
 input:JSON.stringify({jsonrpc:"2.0",id:1,method:"lazyprompting/code",
  params:{action:"execute",code:"return 1;"}})+"\n",
 encoding:"utf8",timeout:5000,
 env:{...process.env,LAZY_NATIVE_BOOTSTRAP:""}
});
assert.equal(standalone.status,0,standalone.stderr);
assert.equal(JSON.parse(standalone.stdout).error.code,-32601);
console.log("Code Mode source cases: composed reads, bounded output, negative syntax/authority cases");
