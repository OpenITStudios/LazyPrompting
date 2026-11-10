import assert from "node:assert/strict";
import {BackendLifecycle} from "../src/runtime/backend-lifecycle.mjs";
import {BackendLifecycle as GatewayCompatibility} from "../src/gateway/backend-lifecycle.mjs";
assert.strictEqual(GatewayCompatibility,BackendLifecycle, "Gateway export must preserve public class identity");
let time=0,signature="v1",connections=0,closures=0,available=true;
const lifecycle=new BackendLifecycle({
 clock:()=>time,probe:async()=>({ready:available,signature}),
 connect:async()=>({generation:++connections}),close:async()=>{closures++;}
});
assert.equal((await lifecycle.ensure()).reused,false);
assert.equal((await lifecycle.ensure()).reused,true);
signature="v2";
assert.equal((await lifecycle.ensure()).reused,false);
assert.equal(closures,1);
available=false;time=10;
assert.equal((await lifecycle.ensure()).ready,false);
assert.equal((await lifecycle.ensure()).reason,"BACKOFF");
time=300;available=true;
assert.equal((await lifecycle.ensure()).ready,true);
await lifecycle.invalidate();
assert.equal(lifecycle.status().state,"OFFLINE");
console.log("Lifecycle contract: 8 assertions passed");
