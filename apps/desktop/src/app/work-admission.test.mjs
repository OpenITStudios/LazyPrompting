import test from "node:test";
import assert from "node:assert/strict";
import {admitWork,classifyNextStep} from "./work-admission.mjs";
import {projectGoalLifecycle,acceptNativeCodexGoals} from "./goal-lifecycle.mjs";
const base={id:"job_1",workspaceId:"workspace-01",authorized:true,transportVerified:true,paused:false,blocked:false,attempts:0,steps:0,tokens:0,elapsedMs:0};
test("valid work admitted without any model invocation",()=>assert.equal(admitWork(base).allowed,true));
for(const [field,value,reason] of [["authorized",false,"NOT_AUTHORIZED"],["transportVerified",false,"TRANSPORT_UNVERIFIED"],["paused",true,"STOPPED"],["blocked",true,"STOPPED"],["attempts",2,"ATTEMPT_BUDGET"],["steps",12,"STEP_BUDGET"],["tokens",12000,"TOKEN_BUDGET"],["elapsedMs",120000,"TIME_BUDGET"],["workspaceId","workspace-11","INVALID_WORKSPACE"],["tokens",-1,"INVALID_USAGE"]]){
 test(`rejects ${field}=${value}`,()=>assert.equal(admitWork({...base,[field]:value}).reason,reason));
}
test("rejects malformed input and limits",()=>{assert.equal(admitWork(null).allowed,false);assert.equal(admitWork(base,{maxAttempts:0,maxSteps:12,maxTokens:100,maxElapsedMs:1000}).reason,"INVALID_LIMITS")});
test("unchanged events do not invoke AI",()=>assert.equal(classifyNextStep({changed:false,requiresReasoning:true}),"SKIP_UNCHANGED"));
test("known actions bypass AI",()=>assert.equal(classifyNextStep({changed:true,knownAction:true,requiresReasoning:true}),"DETERMINISTIC"));
test("unknown work requires review",()=>assert.equal(classifyNextStep({changed:true}),"REVIEW_REQUIRED"));

test("reasoning routes only to Codex handoff",()=>assert.equal(classifyNextStep({changed:true,requiresReasoning:true}),"CODEX_HANDOFF"));

test("goal lifecycle never promotes UI observations into host authority",()=>{
 const empty=projectGoalLifecycle({workspaceId:"workspace-01"});
 assert.equal(empty.stage,"GOAL_BINDING_UNVERIFIED");
 assert.equal(empty.goalApproval,"NOT_ATTESTED");
 assert.equal(empty.nextPromptAllowed,false);
 const draft=projectGoalLifecycle({workspaceId:"workspace-01",hasDraft:true,
  savedChatUrl:true,hasPublicSource:true});
 assert.equal(draft.stage,"MANUAL_DRAFT_REVIEW_REQUIRED");
 assert.equal(draft.chatIdentity,"URL_BOOKMARK_ONLY");
 assert.equal(draft.sourceEvidence,"PUBLIC_GITHUB_UNVERIFIED");
 assert.equal(draft.qa,"NOT_EXECUTED");
 assert.equal(draft.resultVerified,false);
 const busy=projectGoalLifecycle({workspaceId:"workspace-01",hasDraft:true,chatHint:"GENERATING"});
 assert.equal(busy.stage,"CHAT_UI_STATUS_UNVERIFIED");
 const uncertain=projectGoalLifecycle({workspaceId:"workspace-01",chatHint:"POSSIBLY_COMPLETED",
  hasPublicSource:true});
 assert.equal(uncertain.stage,"EVIDENCE_REVIEW_REQUIRED");
 assert.equal(uncertain.nextPromptAllowed,false);
 const fake=projectGoalLifecycle({workspaceId:"workspace-01",chatHint:"DONE",
  qa:"PASS",authorized:true,goalComplete:true});
 assert.equal(fake.stage,"GOAL_BINDING_UNVERIFIED");
 assert.equal(fake.goalApproval,"NOT_ATTESTED");
 assert.equal(fake.nextPromptAllowed,false);
 assert.equal(projectGoalLifecycle({workspaceId:"workspace-11"}).stage,"INVALID_WORKSPACE");
});

test("native Codex goal list is read-only and cannot falsely complete a ChatGPT goal",()=>{
 const run={runId:"12345678-1234-1234-1234-123456789abc.0123456789abcdef0123456789abcdef",
  mode:"READ_ONLY",state:"REVIEW_COMPLETE",checkpointRevision:3,
  taskCount:1,tasks:[{id:"task-1",state:"REVIEWED",recordedCheck:"NOT_RECORDED",
    recordedChecks:0,lastExitCode:null}],
  source:"NATIVE_CODEX_V1_RUN_STATUS",qa:"NOT_VERIFIED",
  chatTurnVerified:false,nextPromptAllowed:false};
 const base={source:"NATIVE_CODEX_V1_STATUS",qa:"NOT_VERIFIED",
  nextPromptAllowed:false,truncated:false,runs:[run]};
 const accepted=acceptNativeCodexGoals(base);
 assert.equal(accepted?.runs[0].state,"REVIEW_COMPLETE");
 assert.equal(accepted?.runs[0].mode,"READ_ONLY");
 assert.equal(accepted?.runs[0].checkpointRevision,3);
 assert.equal(accepted?.runs[0].tasks[0].state,"REVIEWED");
 assert.equal(accepted?.runs[0].tasks[0].recordedCheck,"NOT_RECORDED");
 assert.equal(accepted?.truncated,false);
 for(const bad of [
  {...base,qa:"PASS"},{...base,nextPromptAllowed:true},
  {...base,runs:[{...run,chatTurnVerified:true}]},
  {...base,runs:[{...run,state:"DONE"}]},
  {...base,runs:[{...run,mode:"UNRESTRICTED"}]},
  {...base,runs:[{...run,checkpointRevision:-1}]},
  {...base,runs:[run,run]},
  {...base,runs:Array(11).fill(run)},
  {...base,truncated:"false"},
  {...base,runs:[{...run,source:"MODEL_TEXT"}]},
  {...base,runs:[{...run,taskCount:0}]},
  {...base,runs:[{...run,tasks:[...run.tasks,...run.tasks]}]},
  {...base,runs:[{...run,tasks:[{...run.tasks[0],id:"task-2"}]}]},
  {...base,runs:[{...run,tasks:[{...run.tasks[0],recordedCheck:"QA_PASS"}]}]},
  {...base,runs:[{...run,tasks:[{...run.tasks[0],recordedChecks:3}]}]},
  {...base,runs:[{...run,tasks:[{...run.tasks[0],lastExitCode:0}]}]},
 ])assert.equal(acceptNativeCodexGoals(bad),null);
 assert.deepEqual(acceptNativeCodexGoals({...base,runs:[]}),
  {runs:[],truncated:false});
 const coding={...run,mode:"WORKTREE_WRITE",state:"CODING_COMPLETE",
  tasks:[{id:"task-1",state:"VERIFIED",recordedCheck:"RECORDED_PASS",
    recordedChecks:1,lastExitCode:0}]};
 const projected=acceptNativeCodexGoals({...base,runs:[coding]});
 assert.equal(projected?.runs[0].tasks[0].recordedCheck,"RECORDED_PASS");
 assert.equal(projected?.runs[0].mode,"WORKTREE_WRITE");
});
