// Display-only public repository progress. Never a trusted host receipt or
// authorization source. Reuse the canonical GitHubEvidence source adapter.
import {GitHubEvidence} from "../../../../src/integrations/github-evidence.mjs";
const WORKSPACE=/^workspace-(0[1-9]|10)$/;
const REPO=/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const BRANCH=/^[A-Za-z0-9._/-]{1,200}$/;
const SHA=/^[a-f0-9]{40}$/;
export function validPublicBinding({workspaceId,repository,branch}={}){
 return WORKSPACE.test(workspaceId??"")&&REPO.test(repository??"")&&
 BRANCH.test(branch??"")&&!branch.includes("..")&&
 !branch.includes("//")&&!branch.startsWith("/")&&!branch.endsWith("/");
}
export function repositoryAlreadyAssigned({workspaceId,repository,assignments={}}={}){
 if(!WORKSPACE.test(workspaceId??"")||!REPO.test(repository??""))return true;
 return Object.entries(assignments).some(([id,value])=>
  id!==workspaceId&&WORKSPACE.test(id)&&typeof value==="string"&&
  value.toLowerCase()===repository.toLowerCase());
}
export async function readPublicGitHubProgress({workspaceId,repository,branch,baseSha=null,fetchImpl=fetch}={}){
 if(!validPublicBinding({workspaceId,repository,branch})||
    (baseSha!==null&&!SHA.test(baseSha)))
  return {status:"BLOCKED",reason:"INVALID_PUBLIC_GITHUB_SCOPE",nextPromptAllowed:false};
 const reader=new GitHubEvidence({publicReadOnly:true,scope:{repository,branch},fetchImpl});
 try{
  if(baseSha===null){
   const observed=await reader.head(repository,branch);
   return {status:"BASELINE_PINNED",workspaceId,repository,branch,
    baseSha:observed.headSha,headSha:observed.headSha,changed:false,
    commits:[],qa:"NOT_EXECUTED",acceptancePassed:false,nextPromptAllowed:false};
  }
  const observed=await reader.changesSince({baseSha,maxCommits:32});
  return {status:"SOURCE_OBSERVED",workspaceId,repository,branch,
   baseSha,headSha:observed.headSha,changed:observed.changed,
   commits:observed.commits,qa:"NOT_EXECUTED",acceptancePassed:false,nextPromptAllowed:false};
 }catch{
  return {status:"UNKNOWN",reason:"PUBLIC_GITHUB_READ_FAILED_OR_DIVERGED",
   workspaceId,repository,branch,nextPromptAllowed:false};
 }
}
