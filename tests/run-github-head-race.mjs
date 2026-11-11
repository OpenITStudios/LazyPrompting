import assert from 'node:assert/strict';
import {GitHubEvidence} from '../src/integrations/github-evidence.mjs';
const A='a'.repeat(40),B='b'.repeat(40),C='c'.repeat(40);
const scope={repository:'OpenITStudios/Example',branch:'Local'};
let assertions=0;
const equal=(x,y,msg)=>{assert.deepEqual(x,y,msg);assertions++};
const readerFor=results=>{
 let calls=0;
 const client=new GitHubEvidence({token:'synthetic',scope,fetchImpl:async(url)=>{
  if(!url.endsWith('/branches/Local'))throw Error('UNEXPECTED_COMPARE_REQUEST');
  const sha=results[Math.min(calls++,results.length-1)];
  return {ok:true,json:async()=>({commit:{sha}})};
 }});
 return {client,get calls(){return calls}};
};
const stable=readerFor([A,A]);
const same=await stable.client.changesSince({baseSha:A});
equal(stable.calls,2,'unchanged branch must receive a second independent HEAD read');
equal(same.changed,false,'confirmed no-change report');
equal(same.qa,'NOT_EXECUTED','no QA claim');
equal(same.acceptancePassed,false,'no goal acceptance claim');
const changedDuringRead=readerFor([A,B]);
await assert.rejects(changedDuringRead.client.changesSince({baseSha:A}),/GITHUB_BRANCH_MOVED_DURING_COMPARE/);assertions++;
equal(changedDuringRead.calls,2,'changed during no-op path triggers second query');
const forceMove=readerFor([A,C]);
await assert.rejects(forceMove.client.changesSince({baseSha:A}),/GITHUB_BRANCH_MOVED_DURING_COMPARE/);assertions++;
equal(forceMove.calls,2,'non-fast-forward changes cannot be silently ignored');
console.log('GitHub unchanged-HEAD race regression: PASS ('+assertions+' assertions; fake HTTP)');
