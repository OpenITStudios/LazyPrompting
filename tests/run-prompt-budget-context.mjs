import assert from "node:assert/strict";
import {checkPromptBudget} from "../src/prompt/prompt-budget.mjs";
import {projectPromptContext} from "../src/prompt/context-projection.mjs";
const workspace={workspaceId:"ws1",status:"READY",promptLimit:2};
assert.equal(checkPromptBudget({workspace,outboxItems:[]}).admitted,true);
assert.equal(checkPromptBudget({workspace,outboxItems:[{workspaceId:"ws1",state:"RESERVED"}]}).reason,"PROMPT_PENDING");
assert.equal(checkPromptBudget({workspace,outboxItems:[{workspaceId:"ws1",state:"RESPONSE_VERIFIED"},{workspaceId:"ws1",state:"RESPONSE_VERIFIED"}]}).reason,"PROMPT_BUDGET_EXHAUSTED");
assert.equal(projectPromptContext({workspaceId:"ws1",sessionId:"chat1",taskId:"t1",goal:"Continue",nextAction:"Inspect",lastResponse:{workspaceId:"ws2",sessionId:"chat2"}}).reason,"CROSS_WORKSPACE_CONTEXT");
console.log("Prompt budget/context source assertions authored, NOT_EXECUTED");
