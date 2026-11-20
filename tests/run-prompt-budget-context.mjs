import assert from "node:assert/strict";
import {checkPromptBudget} from "../src/prompt/prompt-budget.mjs";
import {projectPromptContext} from "../src/prompt/context-projection.mjs";
const workspace={workspaceId:"ws1",status:"READY",promptLimit:2};
assert.equal(checkPromptBudget({workspace,outboxItems:[]}).admitted,true);
assert.equal(checkPromptBudget({workspace,outboxItems:[{workspaceId:"ws1",state:"RESERVED"}]}).reason,"PROMPT_PENDING");
assert.equal(checkPromptBudget({workspace,outboxItems:[{workspaceId:"ws1",state:"RESPONSE_VERIFIED"},{workspaceId:"ws1",state:"RESPONSE_VERIFIED"}]}).reason,"PROMPT_BUDGET_EXHAUSTED");
assert.equal(projectPromptContext({workspaceId:"ws1",sessionId:"chat1",taskId:"t1",goal:"Continue",nextAction:"Inspect",lastResponse:{workspaceId:"ws2",sessionId:"chat2"}}).reason,"CROSS_WORKSPACE_CONTEXT");

const context=projectPromptContext({
 workspaceId:"ws1",sessionId:"chat1",taskId:"t1",goal:"Continue",nextAction:"Inspect",
 decisions:["Keep original goal","Review source","Keep original goal","Release held"],
 constraints:["Keep branch","Keep branch","Preserve STOP","Preserve STOP"]
});
assert.equal(context.valid,true);
assert.deepEqual(context.capsule.decisions,
 ["Review source","Keep original goal","Release held"]);
assert.deepEqual(context.capsule.constraints,["Keep branch","Preserve STOP"]);
assert.equal(projectPromptContext({workspaceId:"ws1",sessionId:"chat1",taskId:"t1",
 goal:"Continue",nextAction:"Inspect",
 lastResponse:{workspaceId:"ws1",sessionId:"other",summary:"private"}}).reason,
 "CROSS_WORKSPACE_CONTEXT");

const revisionAware=projectPromptContext({
 workspaceId:"ws1",sessionId:"chat1",taskId:"t1",
 goal:"Continue",nextAction:"Inspect",
 decisions:["Use existing pipeline","Use existing pipeline"],
 supersededDecisions:["Add extra planner","Add extra planner"],
 progressNotes:["Operator reports draft only","No verified tests yet"]
});
assert.equal(revisionAware.valid,true);
assert.deepEqual(revisionAware.capsule.decisions,["Use existing pipeline"]);
assert.deepEqual(revisionAware.capsule.supersededDecisions,["Add extra planner"]);
assert.deepEqual(revisionAware.capsule.progressNotes,
 ["Operator reports draft only","No verified tests yet"]);
assert.equal(revisionAware.capsule.contextLimited.goal,false);
const boundedHistory=projectPromptContext({
 workspaceId:"ws1",sessionId:"chat1",taskId:"t1",
 goal:"G".repeat(1200),nextAction:"Inspect",
 decisions:Array.from({length:15},(_,i)=>"decision-"+i),
 supersededDecisions:Array.from({length:15},(_,i)=>"superseded-"+i),
 progressNotes:Array.from({length:15},(_,i)=>"progress-"+i)
});
assert.equal(boundedHistory.valid,true);
assert.equal(boundedHistory.capsule.goal.length,1000);
assert.equal(boundedHistory.capsule.contextLimited.goal,true);
assert.equal(boundedHistory.capsule.contextLimited.decisions,true);
assert.equal(boundedHistory.capsule.contextLimited.supersededDecisions,true);
assert.equal(boundedHistory.capsule.contextLimited.progressNotes,true);
assert.equal(boundedHistory.capsule.decisions.length,8);
assert.equal(boundedHistory.capsule.supersededDecisions.length,8);

console.log("Prompt budget/context source assertions authored, NOT_EXECUTED");
