import assert from "node:assert/strict";
import {GitHubCheckpointVerifier} from "../src/integrations/github-checkpoint-verifier.mjs";
const sha="a".repeat(40),repository="OpenITStudios/LazyPrompting",branch="Local";
const input={repository,branch,commitSha:sha,statusPath:"docs/operations/current-state.md",rulesPaths:["AGENTS.md","GITHUB_RULES.md"]};
const good=new GitHubCheckpointVerifier({getBranchHead:async()=>({sha}),
 readFile:async({path,ref})=>({path,ref,content:"verified content"})});
assert.equal((await good.verifySource(input)).verified,true);
const bad=new GitHubCheckpointVerifier({getBranchHead:async()=>({sha:"b".repeat(40)}),
 readFile:async()=>{throw Error("should not read");}});
assert.equal((await bad.verifySource(input)).verified,false);
let calls=0;
const moving=new GitHubCheckpointVerifier({getBranchHead:async()=>({sha:++calls===1?sha:"b".repeat(40)}),
 readFile:async({path,ref})=>({path,ref,content:"content"})});
assert.equal((await moving.verifySource(input)).verified,false);
console.log("GitHub checkpoint verifier assertions authored, NOT_EXECUTED");
