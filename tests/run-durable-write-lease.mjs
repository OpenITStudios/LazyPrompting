import assert from "node:assert/strict";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {DurableWriteLease} from "../src/runtime/durable-write-lease.mjs";
const root=await mkdtemp(join(tmpdir(),"lazy-lease-"));
const sha="a".repeat(40);
try{
 const lease=new DurableWriteLease(root,{readHead:async()=>sha});
 const req={workspaceId:"ws1",repository:"OpenITStudios/LazyPrompting",branch:"Local",expectedHead:sha};
 const a=await lease.acquire(req);
 assert.equal(a.acquired,true);
 assert.equal((await lease.acquire({...req,workspaceId:"ws2"})).reason,"LEASE_HELD_OR_STALE");
 assert.equal(await lease.verify({workspaceId:"ws1",token:a.token,expectedHead:sha}),true);
 assert.equal(await lease.release({workspaceId:"ws2",token:a.token}),false);
 assert.equal(await lease.release({workspaceId:"ws1",token:a.token}),true);
}finally{await rm(root,{recursive:true,force:true});}
console.log("Durable lease source tests authored; NOT_EXECUTED");
