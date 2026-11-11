import assert from 'node:assert/strict';
import {GitHubEvidence} from '../src/integrations/github-evidence.mjs';
import {ReceiptReconciler} from '../src/integrations/receipt-reconciler.mjs';
const A='a'.repeat(40),B='b'.repeat(40),C='c'.repeat(40),D='d'.repeat(40);
const scope={repository:'OpenITStudios/A-MIVUBI-Blockbench',branch:'chatgpt-dev'};
let count=0;
const eq=(x,y,msg)=>{assert.deepEqual(x,y,msg);count++;};
const reject=async(fn,part)=>{await assert.rejects(fn,e=>e.message.includes(part));count++;};
const json=data=>({ok:true,status:200,json:async()=>data});
const compare=(overrides={})=>({status:'ahead',ahead_by:2,total_commits:2,
  base_commit:{sha:A},merge_base_commit:{sha:A},
  commits:[{sha:B,commit:{message:'Fix geometry\nSource only'}},
    {sha:C,commit:{message:'Update QA\nNot executed'}}],...overrides});
const expectedHead=`https://api.github.com/repos/OpenITStudios/A-MIVUBI-Blockbench/branches/chatgpt-dev`;
const expectedCompare=`https://api.github.com/repos/OpenITStudios/A-MIVUBI-Blockbench/compare/${A}...${C}?per_page=100`;
let calls=[];
const normal=async(url,options)=>{calls.push(url);eq(options.headers.Accept,'application/vnd.github+json','official v3 accept');
  if(url===expectedHead)return json({commit:{sha:C}});
  if(url===expectedCompare)return json(compare());
  throw Error('Unexpected URL '+url);
};
const reader=new GitHubEvidence({token:'test-not-real',fetchImpl:normal,scope});
const progress=await reader.changesSince({baseSha:A});
eq(progress.proof,'SOURCE_COMMIT_RANGE_VERIFIED','verified full SHA comparison');
eq(progress.repository,scope.repository,'repository bound');
eq(progress.branch,scope.branch,'branch bound');
eq(progress.baseSha,A,'immutable source cursor');
eq(progress.headSha,C,'pinned HEAD');
eq(progress.qa,'NOT_EXECUTED','no fabricated QA');
eq(progress.acceptancePassed,false,'no fabricated goal completion');
eq(progress.commits.map(x=>x.sha),[B,C],'all new commits in order');
eq(progress.commits[0].summary,'Fix geometry','compact summary only');
eq(calls.filter(x=>x===expectedHead).length,2,'HEAD rechecked after compare');
eq(calls.filter(x=>x===expectedCompare).length,1,'one bounded range query');
await reject(()=>reader.head('OpenITStudios/LazyPrompting','Local'),'TARGET_NOT_ALLOWED');
await reject(()=>reader.head(scope.repository,'main'),'TARGET_NOT_ALLOWED');
await reject(()=>reader.changesSince({baseSha:'bad'}),'INVALID_PROGRESS_CURSOR');
await reject(()=>reader.changesSince({baseSha:A,maxCommits:101}),'INVALID_PROGRESS_CURSOR');
const sameReader=new GitHubEvidence({token:'token',scope,
  fetchImpl:async(url)=>{eq(url,expectedHead,'unchanged only reads head');return json({commit:{sha:A}});}});
const same=await sameReader.changesSince({baseSha:A});
eq(same.changed,false,'unchanged source no comparison');
eq(same.commits,[],'no invented progress');
let reads=0;
const moved=new GitHubEvidence({token:'token',scope,fetchImpl:async(url)=>{
  if(url===expectedHead)return json({commit:{sha:++reads===1?C:D}});
  return json(compare());
}});
await reject(()=>moved.changesSince({baseSha:A}),'GITHUB_BRANCH_MOVED_DURING_COMPARE');
const invalids=[
  {status:'diverged'}, {status:'behind'}, {merge_base_commit:{sha:D}},
  {total_commits:3}, {ahead_by:3}, {commits:[]},
  {commits:[{sha:B,commit:{message:'one'}},{sha:B,commit:{message:'repeat'}}]},
  {commits:[{sha:B,commit:{message:'one'}},{sha:D,commit:{message:'wrong head'}}]}, {base_commit:{sha:D}}
];
for(const patch of invalids){
  const client=new GitHubEvidence({token:'token',scope,fetchImpl:async(url)=>url===expectedCompare?json(compare(patch)):json({commit:{sha:C}})});
  await reject(()=>client.changesSince({baseSha:A}),'GITHUB_PROGRESS_UNVERIFIED');
}
await reject(async()=>new GitHubEvidence({token:'token',scope:{repository:'bad',branch:'main'}}),'INVALID_GITHUB_SCOPE');
await reject(async()=>new GitHubEvidence({token:'token',scope:{...scope,branch:'../../evil'}}),'INVALID_GITHUB_SCOPE');
const legacy=new GitHubEvidence({token:'token',fetchImpl:async()=>json({commit:{sha:A}})});
eq((await legacy.head('OpenITStudios/LazyPrompting','Local')).headSha,A,'legacy Local-compatible read');
await reject(()=>legacy.changesSince({baseSha:A}),'BOUND_PROJECT_SCOPE_REQUIRED');
await reject(()=>legacy.head(scope.repository,scope.branch),'TARGET_NOT_ALLOWED');
const rSource={head:async(repo,branch)=>({repository:repo,branch,headSha:C})};
let verifierCalls=0;
const reconcile=new ReceiptReconciler({sourceProvider:rSource,scope,verifyReceipt:async()=>{
  verifierCalls++;return {trusted:true,headSha:C,qa:'PASS',repository:scope.repository,
   branch:scope.branch,goalId:'goal-1',promptId:'p-2',changed:true,acceptancePassed:true};
}});
const goal={...scope,id:'goal-1'}, observation={headSha:C,promptId:'p-2'};
eq((await reconcile.reconcile({goal,observation})).reason,'SOURCE_ONLY','no receipt is source only');
eq((await reconcile.reconcile({goal,observation})).acceptancePassed,false,'source only cannot complete goal');
eq(verifierCalls,0,'receipt verifier not needed without receipt');
eq((await reconcile.reconcile({goal:{...goal,repository:'OpenITStudios/Other'},observation,receipt:{}})).reason,
  'INVALID_TARGET','scope cannot be overridden');
eq((await reconcile.reconcile({goal,observation:{headSha:A,promptId:'p-2'},receipt:{}})).reason,
  'STALE_SOURCE','stale observation blocked');
eq((await reconcile.reconcile({goal:{...goal,id:''},observation,receipt:{}})).reason,'INVALID_RECEIPT_IDENTITY','goal ID required');
eq((await reconcile.reconcile({goal,observation:{headSha:C,promptId:''},receipt:{}})).reason,'INVALID_RECEIPT_IDENTITY','prompt ID required');
const accepted=await reconcile.reconcile({goal,observation,receipt:{sample:'trusted externally'}});
eq(accepted.reason,'TRUSTED_RECEIPT','validated receipt accepted');
eq(accepted.acceptancePassed,true,'trusted goal-specific proof only');
eq(verifierCalls,1,'only authenticated verifier called');
const mismatch=new ReceiptReconciler({sourceProvider:rSource,scope,
 verifyReceipt:async()=>({trusted:true,headSha:C,qa:'PASS',repository:scope.repository,
   branch:scope.branch,goalId:'goal-1',promptId:'other',changed:true,acceptancePassed:true})});
eq((await mismatch.reconcile({goal,observation,receipt:{}})).reason,'RECEIPT_UNVERIFIED','wrong prompt blocked');
eq((await mismatch.reconcile({goal,observation,receipt:{}})).acceptancePassed,false,'wrong prompt cannot mark goal done');
const noQa=new ReceiptReconciler({sourceProvider:rSource,scope,verifyReceipt:async()=>({trusted:true,headSha:C,qa:'NOT_EXECUTED',
 repository:scope.repository,branch:scope.branch,goalId:'goal-1',promptId:'p-2',changed:true,acceptancePassed:true})});
eq((await noQa.reconcile({goal,observation,receipt:{}})).acceptancePassed,false,'NO QA cannot mark acceptance complete');
const legacyR=new ReceiptReconciler({sourceProvider:rSource,verifyReceipt:async()=>({trusted:true,headSha:C,qa:'NOT_EXECUTED'})});
eq((await legacyR.reconcile({goal:{repository:'OpenITStudios/LazyPrompting',branch:'Local'},
 observation:{headSha:C},receipt:{}})).reason,'TRUSTED_RECEIPT','legacy receipt compatible');
eq((await legacyR.reconcile({goal,observation,receipt:{}})).reason,'INVALID_TARGET','legacy other repo blocked');
assert.throws(()=>new ReceiptReconciler({sourceProvider:rSource,verifyReceipt:async()=>true,scope:{...scope,branch:'../../main'}}),/INVALID_RECEIPT_SCOPE/);count++;
console.log(`GitHub scope + progress evidence: PASS (${count} assertions; fake HTTP, no GitHub mutation)`);
