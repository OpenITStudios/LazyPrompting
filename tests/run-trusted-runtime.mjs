import assert from "node:assert/strict";
import {createTrustedRuntime} from "../src/runtime/trusted-runtime.mjs";
const sha="a".repeat(40);
const sourceProvider={head:async()=>({repository:"OpenITStudios/LazyPrompting",branch:"Local",headSha:sha})};
const deps={
 checkpointPath:"/tmp/lazy-checkpoint-source-only.json",
 ledgerPath:"/tmp/lazy-ledger-source-only.json",
 sourceProvider,
 verifyGrant:async()=>({trusted:false}),
 verifyReceipt:async()=>({trusted:false}),
 submit:async()=>{throw new Error("DISPATCH_MUST_NOT_RUN");},
 getResult:async()=>null,
 verifyAuthorizationReceipt:async()=>false
};
const runtime=createTrustedRuntime(deps);
assert.ok(runtime.broker);
assert.ok(runtime.scheduler);
assert.ok(runtime.evidence);
await assert.rejects(()=>runtime.agent.dispatch({taskId:"t1",goalId:"g1",prompt:"work",repository:"OpenITStudios/LazyPrompting",branch:"Local",authorizationReceipt:{}}),/TRUSTED_AUTHORIZATION_REQUIRED/);
assert.throws(()=>createTrustedRuntime({...deps,verifyGrant:null}),/TRUSTED_RUNTIME_DEPENDENCIES_REQUIRED/);
console.log("Trusted runtime source contract assertions authored; no local tests executed yet");
