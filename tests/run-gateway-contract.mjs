import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {CapabilityRouter} from "../src/gateway/capability-router.mjs";
import {listCapabilities,searchCapabilities} from "../src/gateway/capability-registry.mjs";

const gateway=new CapabilityRouter();
assert.equal(listCapabilities().length,9);
assert.equal(gateway.status().structuredContent.dispatch,"DISABLED");
assert.equal(gateway.search("supervisor").structuredContent.results.length,2);
assert.equal(gateway.describe("supervisor.evaluate").structuredContent.readiness,"AVAILABLE");
assert.equal(gateway.describe("browser.open").structuredContent.readiness,"DISABLED");
assert.equal(gateway.describe("unknown").code,"UNKNOWN_CAPABILITY");
assert.equal((await gateway.invoke("browser.open",{url:"https://example.com"})).code,"CAPABILITY_DISABLED");
assert.equal((await gateway.invoke("supervisor.status")).status,"OK");
assert.equal((await gateway.invoke("supervisor.evaluate",{input:{}})).status,"OK");
assert.equal((await gateway.invoke("supervisor.status",{unexpected:true})).code,"INVALID_ARGUMENTS");
assert.equal(searchCapabilities("browser",{enabled:new Set(["gateway"])}).length,0);
const standalone=spawnSync(process.execPath,[
 fileURLToPath(new URL("../src/gateway/mcp-gateway.mjs",import.meta.url))
],{input:JSON.stringify({jsonrpc:"2.0",id:1,method:"lazyprompting/codex",params:{action:"dispatch"}})+"\n",
 encoding:"utf8",timeout:5000,env:{...process.env,LAZY_NATIVE_BOOTSTRAP:""}});
assert.equal(standalone.status,0,standalone.stderr);
assert.equal(JSON.parse(standalone.stdout).error.code,-32601);
console.log("Gateway contract passed, including standalone Codex RPC denial");
