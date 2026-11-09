import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CheckpointStore } from "../src/supervisor/checkpoint-store.mjs";

const root = await mkdtemp(join(tmpdir(), "lazyprompting-checkpoint-"));
const file = join(root, "checkpoint.json");
const store = new CheckpointStore(file);
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log("PASS", name);
}
try {
  await check("uninitialized", async () => assert.equal((await store.recovery()).state, "UNINITIALIZED"));
  await check("initialize", async () => {
    await store.initialize({goalId:"G1",goalHash:"hash1",version:0,phase:"READY",pendingTaskId:null,lastTaskId:null,lastResultId:null});
    assert.equal((await store.read()).version, 0);
  });
  await check("duplicate initialize rejected", async () =>
    assert.rejects(() => store.initialize({goalId:"G1",goalHash:"hash1",version:0,phase:"READY"}), /ALREADY_INITIALIZED/));
  await check("reserve before send", async () => {
    const result = await store.apply({type:"RESERVE",goalId:"G1",expectedVersion:0,taskId:"t1"});
    assert.equal(result.ok,true);
    assert.equal((await store.recovery()).state,"RECONCILE_REQUIRED");
  });
  await check("stale CAS rejected", async () => {
    const result = await store.apply({type:"STOP",goalId:"G1",expectedVersion:0});
    assert.equal(result.ok,false);
    assert.equal((await store.read()).version,1);
  });
  await check("restart opens pending state", async () => {
    const second = new CheckpointStore(file);
    assert.equal((await second.recovery()).state,"RECONCILE_REQUIRED");
    assert.equal((await second.read()).pendingTaskId,"t1");
  });
  await check("uncertain dispatch requires reconciliation", async () => {
    const result = await store.apply({type:"DISPATCH_UNCERTAIN",goalId:"G1",expectedVersion:1,taskId:"t1"});
    assert.equal(result.ok,true);
    assert.equal((await store.read()).phase,"RECONCILE_REQUIRED");
  });
  await check("untrusted result rejected", async () => {
    const result = await store.apply({type:"RESULT",goalId:"G1",expectedVersion:2,taskId:"t1",resultId:"r1",trustedEvidence:false});
    assert.equal(result.ok,false);
  });
  await check("trusted result reconciles", async () => {
    const result = await store.apply({type:"RESULT",goalId:"G1",expectedVersion:2,taskId:"t1",resultId:"r1",trustedEvidence:true});
    assert.equal(result.ok,true);
    assert.equal((await store.recovery()).state,"READY");
  });
  await check("replayed task rejected", async () => {
    const result = await store.apply({type:"RESERVE",goalId:"G1",expectedVersion:3,taskId:"t1"});
    assert.equal(result.ok,false);
  });
  await check("exclusive lock fails closed", async () => {
    await store.withLock(async () => {
      await assert.rejects(() => new CheckpointStore(file).withLock(async () => {}), {code:"EEXIST"});
    });
  });
  console.log("Passed",passed,"checkpoint-store cases");
} finally {
  await rm(root,{recursive:true,force:true});
}
