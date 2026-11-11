import assert from 'node:assert/strict';
import {createScopedGoalEvidenceProviders} from '../src/integrations/scoped-goal-evidence-providers.mjs';
const repository='OpenITStudios/Example',branch='Local',base='a'.repeat(40),head='b'.repeat(40);
let checks=0,requests=0,qa=0;
const eq=(x,y)=>{assert.deepEqual(x,y);checks++};
const fetchImpl=async url=>{requests++;assert.ok(url.includes('/OpenITStudios/Example/'));checks++;
 if(url.includes('/branches/'))return {ok:true,json:async()=>({commit:{sha:head}})};
 return {ok:true,json:async()=>({status:'ahead',base_commit:{sha:base},merge_base_commit:{sha:base},
  ahead_by:1,total_commits:1,commits:[{sha:head,commit:{message:'Bound change'}}]})};};
const host=createScopedGoalEvidenceProviders({scope:{repository,branch},token:'token-from-host',fetchImpl,
 verifyReceipt:async arg=>{qa++;return {trusted:true,repository,branch,goalId:'goal-01',
  promptId:'prompt-01',headSha:arg.headSha,qa:'PASS',changed:true,acceptancePassed:true}}});
const scope={workspaceId:'workspace-01',repository,branch};
const source=await host.sourceFactory(scope),receipts=await host.receiptFactory({...scope,source});
eq((await host.readHead(scope)).headSha,head);
eq((await source.changesSince({baseSha:base})).commits[0].sha,head);
const result=await receipts.reconcile({goal:{id:'goal-01',repository,branch},
 observation:{headSha:head,promptId:'prompt-01'},receipt:{id:'qa'}});
eq(result.reason,'TRUSTED_RECEIPT');eq(result.acceptancePassed,true);eq(qa,1);
const missing=await receipts.reconcile({goal:{id:'goal-01',repository,branch},
 observation:{headSha:head,promptId:'prompt-01'},receipt:null});
eq(missing.acceptancePassed,false);eq(missing.qa,'NOT_EXECUTED');
const before=requests;
for(const target of [{...scope,branch:'main'},{...scope,repository:'Evil/Other'},
 {...scope,workspaceId:'workspace-11'}]){
 await assert.rejects(host.sourceFactory(target),/PROJECT_SCOPE_CHANGED/);checks++;
}
await assert.rejects(host.receiptFactory({...scope,source:{scope:source.scope}}),/PROVIDER_CHANGED/);checks++;
eq(requests,before);
const mismatched=createScopedGoalEvidenceProviders({scope:{repository,branch},token:'token',fetchImpl,
 verifyReceipt:async args=>({trusted:true,repository,branch,goalId:'wrong',promptId:'prompt-01',
  headSha:args.headSha,qa:'PASS',changed:true,acceptancePassed:true})});
const s=await mismatched.sourceFactory(scope),r=await mismatched.receiptFactory({...scope,source:s});
const bad=await r.reconcile({goal:{id:'goal-01',repository,branch},observation:{headSha:head,promptId:'prompt-01'},receipt:{}});
eq(bad.reason,'RECEIPT_UNVERIFIED');eq(bad.acceptancePassed,false);
for(const options of [{},{scope:{repository,branch},token:'token'},
 {scope:{repository:'invalid',branch},token:'token',verifyReceipt:async()=>({})}]){
 assert.throws(()=>createScopedGoalEvidenceProviders(options));checks++;
}
console.log('Scoped GitHub+QA evidence integration: PASS ('+checks+' assertions; synthetic network/QA, no native)');
