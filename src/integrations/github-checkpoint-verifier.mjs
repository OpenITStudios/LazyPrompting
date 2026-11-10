// Read-only GitHub checkpoint verification via injected authenticated GitHub client.
// The client must expose getBranchHead and readFile; no GitHub write operation is accepted.
const SHA=/^[a-f0-9]{40}$/;
const REPO=/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const BRANCH=/^[A-Za-z0-9._/-]{1,200}$/;
const PATH=/^[A-Za-z0-9._/-]{1,240}$/;
export class GitHubCheckpointVerifier {
 constructor({getBranchHead,readFile}={}){
  if(typeof getBranchHead!=="function"||typeof readFile!=="function")
   throw new Error("READ_ONLY_GITHUB_CLIENT_REQUIRED");
  this.getBranchHead=getBranchHead;this.readFile=readFile;
 }
 async verifySource({repository,branch,commitSha,statusPath,rulesPaths}={}){
  if(!REPO.test(repository??"")||!BRANCH.test(branch??"")||
     branch.includes("..")||branch.startsWith("/")||branch.endsWith("/")||
     !SHA.test(commitSha??"")||!PATH.test(statusPath??"")||
     statusPath.includes("..")||statusPath.startsWith("/")||
     !Array.isArray(rulesPaths)||rulesPaths.length!==2||
     rulesPaths[0]!=="AGENTS.md"||rulesPaths[1]!=="GITHUB_RULES.md")
   return {verified:false,reason:"INVALID_CHECKPOINT_SOURCE_SCOPE"};
  const head=await this.getBranchHead({repository,branch});
  if(!SHA.test(head?.sha??"")||head.sha!==commitSha)
   return {verified:false,reason:"CHECKPOINT_HEAD_CHANGED"};
  // Read immutable commit ref, never floating branch for the files.
  const paths=[...rulesPaths,statusPath];
  const contents=await Promise.all(paths.map(path=>this.readFile({repository,path,ref:commitSha})));
  if(contents.some((item,i)=>item?.ref!==commitSha||item.path!==paths[i]||
      typeof item.content!=="string"||!item.content.trim()||
      Buffer.byteLength(item.content,"utf8")>1024*1024))
   return {verified:false,reason:"CHECKPOINT_FILES_UNVERIFIED"};
  const after=await this.getBranchHead({repository,branch});
  if(after?.sha!==commitSha)return {verified:false,reason:"CHECKPOINT_HEAD_CHANGED_DURING_READ"};
  return {verified:true,repository,branch,commitSha,branchHeadSha:commitSha,
   statusPath,statusRead:true,rulesRead:true};
 }
}
