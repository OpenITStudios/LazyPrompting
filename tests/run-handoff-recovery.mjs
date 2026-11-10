import assert from "node:assert/strict";
import {classifyHandoffRecovery} from "../src/prompt/handoff-recovery.mjs";
const e={workspaceId:"ws1",handoffId:"h1",oldSessionId:"chat1",contextRevision:2,status:"RESERVED"};
assert.equal(classifyHandoffRecovery({workspace:{workspaceId:"ws1",sessionId:"chat1",contextRevision:2},entries:[e]}).status,"RECONCILE_REQUIRED");
assert.equal(classifyHandoffRecovery({workspace:{workspaceId:"ws1",sessionId:"chat2",contextRevision:3,previousSessions:["chat1"]},entries:[e]}).status,"LEDGER_ACTIVATION_PENDING");
assert.equal(classifyHandoffRecovery({workspace:{workspaceId:"ws1",sessionId:"chat3",contextRevision:7},entries:[e]}).status,"BLOCKED");
console.log("Handoff restart recovery assertions authored, NOT_EXECUTED");
