import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {WorkspaceRegistry} from "../src/runtime/workspace-registry.mjs";
const root=await mkdtemp(join(tmpdir(),"lazy-handoff-registry-"));
try{
 const registry=new WorkspaceRegistry(join(root,"registry.json"));
 const w={workspaceId:"w1",sessionId:"s1",taskIds:["t1"],status:"PAUSED",
 repository:"OpenITStudios/LazyPrompting",branch:"Local",headSha:"a".repeat(40),contextRevision:2};
 assert.equal((await registry.register(0,w)).ok,true);
 assert.equal((await registry.switchSession({expectedVersion:1,workspaceId:"w1",oldSessionId:"s1",newSessionId:"s2",contextRevision:2})).ok,true);
 const now=(await registry.read()).workspaces[0];
 assert.equal(now.sessionId,"s2");
 assert.deepEqual(now.previousSessions,["s1"]);
 assert.equal(now.status,"PAUSED");
 await assert.rejects(()=>registry.switchSession({expectedVersion:2,workspaceId:"w1",oldSessionId:"s1",newSessionId:"s3",contextRevision:2}),/STALE_HANDOFF_BINDING/);
}finally{await rm(root,{recursive:true,force:true});}
console.log("Handoff registry tests authored, NOT_EXECUTED");
