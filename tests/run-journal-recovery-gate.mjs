import assert from "node:assert/strict";
import {JournalRecoveryGate} from "../src/governance/journal-recovery-gate.mjs";
let records=[],reservations=[],state="READY";
const gate=new JournalRecoveryGate({
 journal:{read:async()=>records},
 checkpointStore:{recovery:async()=>({state,checkpoint:{pendingTaskId:null}})},
 replayLedger:{read:async()=>({reservations})}
});
const task={workspaceId:"ws1",taskId:"task1"};
assert.equal((await gate.inspect(task)).safeToDispatch,true);
records=[{workspaceId:"ws1",taskId:"task1",type:"DISPATCH_ATTEMPTED"}];
assert.equal((await gate.inspect(task)).reason,"EXISTING_TASK_RECONCILIATION_REQUIRED");
records=[];reservations=[{taskId:"task1"}];
assert.equal((await gate.inspect(task)).safeToDispatch,false);
reservations=[];state="RECONCILE_REQUIRED";
assert.equal((await gate.inspect(task)).reason,"CHECKPOINT_NOT_READY");
console.log("Recovery gate source assertions authored, NOT_EXECUTED");
