import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";
import {WorkspaceRegistry} from "../src/runtime/workspace-registry.mjs";
const dir=await mkdtemp(join(tmpdir(),"lazy-workspaces-"));
try{
 const store=new WorkspaceRegistry(join(dir,"registry.json"));
 const w={workspaceId:"ws1",sessionId:"chat1",taskIds:["t1"],status:"READY",
  repository:"OpenITStudios/LazyPrompting",branch:"Local",headSha:"a".repeat(40),contextRevision:1};
 assert.equal((await store.register(0,w)).ok,true);
 assert.equal((await store.register(0,{...w,workspaceId:"ws2",sessionId:"chat2"})).reason,"STALE_REGISTRY_VERSION");
 await assert.rejects(()=>store.register(1,{...w,workspaceId:"ws2"}),/WORKSPACE_IDENTITY_CONFLICT/);
 assert.equal((await store.setStatus(1,"ws1","PAUSED")).ok,true);
 assert.equal((await store.read()).workspaces[0].status,"PAUSED");
}finally{await rm(dir,{recursive:true,force:true});}
console.log("Workspace registry assertions authored, NOT_EXECUTED");
