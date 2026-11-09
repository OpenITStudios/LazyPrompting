import assert from "node:assert/strict";
import {selectWorkspace,scheduleNextWorkspace} from "../src/runtime/workspace-router.mjs";
const head="a".repeat(40);
const bindings=[
 {sessionId:"chat1",workspaceId:"ws1",taskIds:["t1"],status:"READY",repository:"OpenITStudios/LazyPrompting",branch:"Local",headSha:head,contextRevision:1},
 {sessionId:"chat2",workspaceId:"ws2",taskIds:["t2"],status:"READY",repository:"OpenITStudios/LazyPrompting",branch:"Local",headSha:head,contextRevision:4}
];
assert.equal(selectWorkspace({bindings,callerSessionId:"chat1",workspaceId:"ws1",taskId:"t1"}).admitted,true);
assert.equal(selectWorkspace({bindings,callerSessionId:"chat1",workspaceId:"ws2",taskId:"t2"}).reason,"SESSION_WORKSPACE_MISMATCH");
assert.equal(selectWorkspace({bindings,callerSessionId:"chat1",workspaceId:"ws1",taskId:"t2"}).reason,"TASK_OUTSIDE_WORKSPACE");
assert.equal(selectWorkspace({bindings:[{...bindings[0],status:"PAUSED"}],callerSessionId:"chat1",workspaceId:"ws1",taskId:"t1"}).reason,"WORKSPACE_INACTIVE");
const workspaces=[{workspaceId:"ws1",status:"READY",grantValid:true,remainingTicks:5},{workspaceId:"ws2",status:"READY",grantValid:true,remainingTicks:5}];
assert.equal(scheduleNextWorkspace({workspaces}).workspaceId,"ws1");
assert.equal(scheduleNextWorkspace({workspaces,lastWorkspaceId:"ws1"}).workspaceId,"ws2");
assert.equal(scheduleNextWorkspace({workspaces,activeCount:2}).state,"NO_SLOT");
console.log("Workspace isolation: 7 source assertions authored; not executed");
