import assert from "node:assert/strict";
import {readPublicGitHubProgress,validPublicBinding,repositoryAlreadyAssigned} from "../apps/desktop/src/app/public-github-progress.mjs";
const a="a".repeat(40),b="b".repeat(40);
const args={workspaceId:"workspace-01",repository:"OpenITStudios/TestRepo",branch:"Local"};
let calls=[];
const api=async (url,options)=>{
 calls.push({url,options});
 assert.equal(options.headers.Authorization,undefined);
 if(url.includes("/compare/"))return {ok:true,json:async()=>({
   status:"ahead",base_commit:{sha:a},merge_base_commit:{sha:a},
   ahead_by:1,total_commits:1,commits:[{sha:b,commit:{message:"Fix bug"}}]
 })};
 return {ok:true,json:async()=>({commit:{sha:b}})};
};
assert.equal(validPublicBinding(args),true);
assert.equal(validPublicBinding({...args,workspaceId:"workspace-11"}),false);
assert.equal(validPublicBinding({...args,branch:"../../main"}),false);
const baseline=await readPublicGitHubProgress({...args,fetchImpl:api});
assert.equal(baseline.status,"BASELINE_PINNED");
assert.equal(baseline.headSha,b);
assert.equal(baseline.nextPromptAllowed,false);
assert.equal(calls.length,1);
const progress=await readPublicGitHubProgress({...args,baseSha:a,fetchImpl:api});
assert.equal(progress.status,"SOURCE_OBSERVED");
assert.equal(progress.changed,true);
assert.equal(progress.commits.length,1);
assert.equal(progress.qa,"NOT_EXECUTED");
assert.equal(progress.acceptancePassed,false);
assert.equal(progress.nextPromptAllowed,false);
assert.equal((await readPublicGitHubProgress({...args,baseSha:"bad",fetchImpl:api})).status,"BLOCKED");
assert.equal((await readPublicGitHubProgress({...args,fetchImpl:async()=>({ok:false,status:404})})).status,"UNKNOWN");
assert.equal(repositoryAlreadyAssigned({workspaceId:"workspace-01",
 repository:"OpenITStudios/TestRepo",assignments:{"workspace-02":"openitstudios/testrepo"}}),true);
assert.equal(repositoryAlreadyAssigned({workspaceId:"workspace-01",
 repository:"OpenITStudios/TestRepo",assignments:{"workspace-01":"OpenITStudios/TestRepo"}}),false);
console.log("Public GitHub desktop projection assertions passed");
