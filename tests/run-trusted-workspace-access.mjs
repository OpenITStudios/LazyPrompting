import assert from "node:assert/strict";
import {TrustedWorkspaceAccess} from "../src/runtime/trusted-workspace-access.mjs";
const registry={read:async()=>({version:3,workspaces:[
 {sessionId:"s1",workspaceId:"w1",taskIds:["t1"],status:"READY",repository:"OpenITStudios/LazyPrompting",branch:"Local",headSha:"a".repeat(40),contextRevision:2},
 {sessionId:"s2",workspaceId:"w2",taskIds:["t2"],status:"READY",repository:"OpenITStudios/LazyPrompting",branch:"Local",headSha:"a".repeat(40),contextRevision:2}
]})};
const access=new TrustedWorkspaceAccess({registry,authenticateSession:async token=>token==="host1"?{trusted:true,sessionId:"s1"}:null});
assert.equal((await access.admit({hostCredential:"host1",workspaceId:"w1",taskId:"t1"})).admitted,true);
assert.equal((await access.admit({hostCredential:"host1",workspaceId:"w2",taskId:"t2"})).admitted,false);
assert.equal((await access.admit({hostCredential:"wrong",workspaceId:"w1",taskId:"t1"})).reason,"HOST_AUTHENTICATION_REQUIRED");
console.log("Trusted workspace access: source test authored, NOT_EXECUTED");
