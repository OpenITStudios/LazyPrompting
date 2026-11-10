import assert from "node:assert/strict";
import {planNextPrompt} from "../src/prompt/prompt-supervisor.mjs";
const workspace={workspaceId:"ws1",sessionId:"chat1",taskId:"task1",status:"READY",
 contextRevision:2,transportApproved:true,remainingPrompts:5,goal:"Improve model geometry",
 nextAction:"Inspect cube silhouette and propose the next bounded patch",constraints:["Keep branch unchanged"]};
const observation={complete:true,responseId:"response2",sessionId:"chat1",workspaceId:"ws1",contextRevision:2};
assert.equal(planNextPrompt({workspace,observation}).status,"READY_TO_SEND");
assert.equal(planNextPrompt({workspace,observation:{...observation,workspaceId:"ws2"}}).status,"WAITING");
assert.equal(planNextPrompt({workspace:{...workspace,pendingPromptId:"p1"},observation}).reason,"PROMPT_ALREADY_PENDING");
assert.equal(planNextPrompt({workspace:{...workspace,status:"PAUSED"},observation}).status,"PAUSED");
assert.equal(planNextPrompt({workspace,observation:{...observation,requiresApproval:true}}).status,"PAUSED");
assert.equal(planNextPrompt({workspace:{...workspace,remainingPrompts:0},observation}).status,"STOPPED");
console.log("Prompt supervisor source assertions authored, NOT_EXECUTED");
