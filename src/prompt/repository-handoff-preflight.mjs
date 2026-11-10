import {assessRepositoryCheckpoint,buildRepositoryResumePrompt} from "./repository-continuity.mjs";
// Read-only source attestation injected by trusted host; no GitHub writes.
export class RepositoryHandoffPreflight {
 constructor({verifySource}={}){
  if(typeof verifySource!=="function")throw new Error("TRUSTED_SOURCE_VERIFIER_REQUIRED");
  this.verifySource=verifySource;
 }
 async prepare({workspace,checkpoint}={}){
  if(!workspace||!checkpoint)return {ready:false,reason:"MISSING_CHECKPOINT"};
  let proof;
  try{proof=await this.verifySource({repository:workspace.repository,branch:workspace.branch,
   commitSha:checkpoint.commitSha,statusPath:checkpoint.statusPath,
   rulesPaths:["AGENTS.md","GITHUB_RULES.md"]});}
  catch{return {ready:false,reason:"SOURCE_VERIFICATION_UNAVAILABLE"};}
  const verified=assessRepositoryCheckpoint({workspace,checkpoint,sourceProof:proof});
  if(!verified.ready)return verified;
  const resume=buildRepositoryResumePrompt(verified);
  if(!resume.ready)return resume;
  return {...verified,resumePrompt:resume.prompt};
 }
}
