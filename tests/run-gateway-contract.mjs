import assert from "node:assert/strict";
import {CapabilityRouter} from "../src/gateway/capability-router.mjs";
import {listCapabilities,searchCapabilities} from "../src/gateway/capability-registry.mjs";

const gateway=new CapabilityRouter();
assert.equal(listCapabilities().length,6);
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
console.log("Gateway contract source: 11 assertions passed");
