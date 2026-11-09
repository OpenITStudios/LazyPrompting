import assert from "node:assert/strict";
import {GuardedGitHubWriter} from "../src/integrations/guarded-github-writer.mjs";
const head="a".repeat(40);
let writes=0,allowed=false;
const writer=new GuardedGitHubWriter({
 lease:{verify:async()=>true},readHead:async()=>head,
 verifyAuthorization:async()=>allowed,
 conditionalWrite:async()=>{writes++;return {applied:true,commitSha:"b".repeat(40)};}
});
const request={workspaceId:"ws1",repository:"OpenITStudios/LazyPrompting",branch:"Local",expectedHead:head,leaseToken:"token",grant:{},change:{path:"x"}};
assert.equal((await writer.write(request)).reason,"WRITE_AUTHORIZATION_DENIED");
assert.equal(writes,0);
allowed=true;
assert.equal((await writer.write(request)).status,"WRITTEN");
assert.equal(writes,1);
assert.equal((await writer.write({...request,expectedHead:"c".repeat(40)})).reason,"STALE_HEAD");
console.log("Guarded writer source assertions authored, NOT_EXECUTED");
