// Repo-first continuity: only verified source metadata may authorize a resume prompt.
// ChatGPT, not LazyPrompting, reads and writes the target repository.
const SHA=/^[a-f0-9]{40}$/;
const REPO=/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const BRANCH=/^[A-Za-z0-9._/-]{1,200}$/;
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const safe=x=>typeof x==="string"&&x.length>0&&x.length<=512&&!/[\x00-\x1f\x7f]/.test(x);
export function assessRepositoryCheckpoint({workspace,checkpoint,sourceProof}={}){
 const fail=reason=>({ready:false,reason});
 if(!workspace||!ID.test(workspace.workspaceId??"")||!ID.test(workspace.sessionId??"")||
    !REPO.test(workspace.repository??"")||!BRANCH.test(workspace.branch??"")||
    workspace.branch.includes("..")||!SHA.test(workspace.headSha??""))
  return fail("INVALID_WORKSPACE_SCOPE");
 if(!checkpoint||checkpoint.repository!==workspace.repository||
    checkpoint.branch!==workspace.branch||!SHA.test(checkpoint.commitSha??"")||
    !safe(checkpoint.statusPath)||!safe(checkpoint.nextAction)||
    checkpoint.rulesPaths?.[0]!=="AGENTS.md"||
    checkpoint.rulesPaths?.[1]!=="GITHUB_RULES.md")
  return fail("INVALID_CHECKPOINT");
 if(!sourceProof||sourceProof.verified!==true||
    sourceProof.repository!==workspace.repository||
    sourceProof.branch!==workspace.branch||
    sourceProof.commitSha!==checkpoint.commitSha||
    sourceProof.statusPath!==checkpoint.statusPath||
    sourceProof.statusRead!==true||sourceProof.rulesRead!==true)
  return fail("CHECKPOINT_NOT_SOURCE_VERIFIED");
 if(sourceProof.branchHeadSha!==checkpoint.commitSha)
  return fail("CHECKPOINT_STALE_REVERIFY_REQUIRED");
 return {ready:true,repository:checkpoint.repository,branch:checkpoint.branch,
  commitSha:checkpoint.commitSha,statusPath:checkpoint.statusPath,
  nextAction:checkpoint.nextAction,workspaceId:workspace.workspaceId};
}
export function buildRepositoryResumePrompt(verified){
 if(verified?.ready!==true)return {ready:false,reason:"UNVERIFIED_REPOSITORY_CHECKPOINT"};
 const prompt=[
  "Resume the existing project from its repository, not from assumptions about prior chat memory.",
  "Repository: "+verified.repository,
  "Branch: "+verified.branch,
  "Checkpoint commit: "+verified.commitSha,
  "Read AGENTS.md and GITHUB_RULES.md, then "+verified.statusPath+".",
  "Pin and compare the current branch HEAD; inspect actual changed source and unresolved work.",
  "If HEAD differs from the checkpoint, reconcile changes before proceeding.",
  "Preserve approved scope, constraints, and previous decisions recorded in the repository.",
  "Next recorded action: "+verified.nextAction,
  "Perform one bounded useful next step using ChatGPT's own authorized tools.",
  "Update the canonical repository status and commit relevant work before the next handoff when authorized.",
  "Report commit SHA and evidence; never claim tests passed unless executed.",
  "Do not delete or overwrite the previous chat; stop if permissions or context are uncertain."
 ].join("\n");
 return {ready:true,prompt,workspaceId:verified.workspaceId};
}
