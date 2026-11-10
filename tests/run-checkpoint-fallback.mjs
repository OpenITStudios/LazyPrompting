import assert from "node:assert/strict";
import {chooseLastVerifiedCheckpoint} from "../src/prompt/checkpoint-fallback.mjs";
const sha="a".repeat(40);
const workspace={workspaceId:"w1",sessionId:"s1",repository:"OpenITStudios/LazyPrompting",branch:"Local",headSha:sha};
const checkpoint={repository:workspace.repository,branch:"Local",commitSha:sha,statusPath:"docs/operations/current-state.md",nextAction:"Continue from verified source",rulesPaths:["AGENTS.md","GITHUB_RULES.md"]};
const sourceProof={verified:true,repository:workspace.repository,branch:"Local",commitSha:sha,branchHeadSha:sha,statusPath:checkpoint.statusPath,statusRead:true,rulesRead:true};
assert.equal(chooseLastVerifiedCheckpoint({workspace,candidates:[{sequence:1,checkpoint,sourceProof}]}).ready,true);
assert.equal(chooseLastVerifiedCheckpoint({workspace,candidates:[{sequence:1,checkpoint,sourceProof:{...sourceProof,branchHeadSha:"b".repeat(40)}}]}).ready,false);
console.log("Checkpoint fallback assertions authored, NOT_EXECUTED");
