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

 const publicRepo="OpenITStudios/AnotherPublicRepo", publicBranch="Local";
 const headSha="b".repeat(40);
 const admission={trusted:true,source:"NATIVE_HOST",operation:"REGISTER_PUBLIC_SOURCE",
  workspaceId:"workspace-02",sessionId:"chat2",repository:publicRepo,branch:publicBranch};
 const readHead=async()=>({repository:publicRepo,branch:publicBranch,
  headSha,proof:"SOURCE_HEAD_VERIFIED"});
 const callback=async()=>admission;
 const registration=await store.registerVerifiedPublicSource({expectedVersion:2,
  workspaceId:"workspace-02",sessionId:"chat2",repository:publicRepo,
  branch:publicBranch,authorize:callback,readHead});
 assert.equal(registration.ok,true);
 const saved=await store.read();
 assert.equal(saved.workspaces[1].repository,publicRepo);
 assert.equal(saved.workspaces[1].headSha,headSha);
 assert.equal(saved.workspaces[1].status,"PAUSED");
 assert.equal(saved.workspaces[1].contextRevision,0);
 assert.equal((await store.registerVerifiedPublicSource({expectedVersion:3,
  workspaceId:"workspace-03",sessionId:"chat3",
  repository:"OpenITStudios/ThirdRepo",branch:"Local",readHead,
  authorize:async()=>({...admission,workspaceId:"workspace-03",sessionId:"chat3",
    repository:"OpenITStudios/ThirdRepo"})})).reason,"PUBLIC_SOURCE_HEAD_UNVERIFIED");
 assert.equal((await store.registerVerifiedPublicSource({expectedVersion:3,
  workspaceId:"workspace-03",sessionId:"chat3",
  repository:publicRepo,branch:publicBranch,readHead,
  authorize:async()=>({...admission,workspaceId:"workspace-03",sessionId:"chat3"})})).ok,false);
 assert.equal((await store.read()).version,3);
 await assert.rejects(()=>store.registerVerifiedPublicSource({expectedVersion:3,
  workspaceId:"workspace-04",sessionId:"chat4",repository:"Bad Repo",branch:"Local",
  readHead,authorize:callback}),/INVALID_PUBLIC_SOURCE_BINDING/);
 const denied=await store.registerVerifiedPublicSource({expectedVersion:3,
  workspaceId:"workspace-05",sessionId:"chat5",repository:"OpenITStudios/FourthRepo",
  branch:"Local",readHead,authorize:async()=>({trusted:true})});
 assert.equal(denied.reason,"NATIVE_SOURCE_BINDING_AUTH_REQUIRED");
}finally{await rm(dir,{recursive:true,force:true});}
console.log("Workspace registry assertions authored, NOT_EXECUTED");
