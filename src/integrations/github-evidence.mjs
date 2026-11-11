// GitHub source evidence only. Repository commits do not prove ChatGPT completion,
// authorized writes, or executable QA. Project access must be bound by a trusted host.
const REPO=/^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const BRANCH=/^[A-Za-z0-9._/-]{1,200}$/;
const SHA=/^[a-f0-9]{40}$/;
const validScope=({repository,branch}={})=>REPO.test(repository??'')&&
  BRANCH.test(branch??'')&&!branch.includes('..')&&!branch.startsWith('/')&&
  !branch.endsWith('/')&&!branch.includes('//');

export class GitHubEvidence {
  constructor({token,fetchImpl=fetch,scope=null}={}){
    if(typeof token!=='string'||!token)throw new Error('GITHUB_TOKEN_REQUIRED');
    if(typeof fetchImpl!=='function')throw new Error('GITHUB_FETCH_REQUIRED');
    if(scope!==null&&!validScope(scope))throw new Error('INVALID_GITHUB_SCOPE');
    this.token=token;this.fetchImpl=fetchImpl;
    // Existing callers retain legacy read-only Local lookup; new multi-repo
    // progress checks require an explicit project scope supplied by the host.
    this.scope=scope?Object.freeze({repository:scope.repository,branch:scope.branch}):null;
  }
  #target(repository,branch){
    if(!validScope({repository,branch})||
       (this.scope?(repository!==this.scope.repository||branch!==this.scope.branch):branch!=='Local'))
      throw new Error('TARGET_NOT_ALLOWED');
    const [owner,name]=repository.split('/');
    return 'https://api.github.com/repos/'+encodeURIComponent(owner)+'/'+encodeURIComponent(name);
  }
  async #get(url){
    const res=await this.fetchImpl(url,{headers:{Authorization:'Bearer '+this.token,
      Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
      signal:AbortSignal.timeout(10000)});
    if(!res?.ok)throw new Error('GITHUB_EVIDENCE_UNAVAILABLE_'+(res?.status??'UNKNOWN'));
    return res.json();
  }
  async head(repository,branch){
    const api=this.#target(repository,branch);
    const data=await this.#get(api+'/branches/'+encodeURIComponent(branch));
    const headSha=data?.commit?.sha;
    if(!SHA.test(headSha??''))throw new Error('INVALID_GITHUB_HEAD');
    return {repository,branch,headSha,proof:'SOURCE_HEAD_VERIFIED'};
  }
  async reconcile({repository,branch,claimedSha}={}){
    const head=await this.head(repository,branch);
    return {...head,verified:head.headSha===claimedSha,qa:'NOT_EXECUTED',acceptancePassed:false};
  }
  async changesSince({baseSha,maxCommits=32}={}){
    // This is a read-only, bounded, SHA-pinned project cursor. It is not a
    // transcript reader and cannot authorize another ChatGPT prompt by itself.
    if(!this.scope)throw new Error('BOUND_PROJECT_SCOPE_REQUIRED');
    if(!SHA.test(baseSha??'')||!Number.isSafeInteger(maxCommits)||
       maxCommits<1||maxCommits>100)throw new Error('INVALID_PROGRESS_CURSOR');
    const {repository,branch}=this.scope;
    const head=await this.head(repository,branch);
    if(head.headSha===baseSha){
      // Even a no-op progress cursor can become stale between two reads.
      // Reconfirm the original branch before publishing unchanged evidence.
      const after=await this.head(repository,branch);
      if(after.headSha!==head.headSha)throw Error('GITHUB_BRANCH_MOVED_DURING_COMPARE');
      return {...head,baseSha,changed:false,commits:[],
        qa:'NOT_EXECUTED',acceptancePassed:false,proof:'SOURCE_HEAD_UNCHANGED'};
    }
    const api=this.#target(repository,branch);
    const compared=await this.#get(api+'/compare/'+baseSha+'...'+head.headSha+'?per_page=100');
    // A force-push, divergent branch, truncated comparison, or concurrent
    // branch movement is not a safe continuation cursor.
    const items=compared?.commits;
    if(compared?.status!=='ahead'||compared?.base_commit?.sha!==baseSha||
       compared?.merge_base_commit?.sha!==baseSha||
       !Number.isSafeInteger(compared.ahead_by)||
       !Number.isSafeInteger(compared.total_commits)||
       !Array.isArray(items)||!items.length||
       items.at(-1)?.sha!==head.headSha||
       compared.ahead_by!==items.length||compared.total_commits!==items.length||
       items.length>maxCommits||items.length>100||
       items.some(x=>!SHA.test(x?.sha??'')||typeof x.commit?.message!=='string')||
       new Set(items.map(x=>x.sha)).size!==items.length)
      throw new Error('GITHUB_PROGRESS_UNVERIFIED');
    const after=await this.head(repository,branch);
    if(after.headSha!==head.headSha)throw new Error('GITHUB_BRANCH_MOVED_DURING_COMPARE');
    return {...head,baseSha,changed:true,commits:items.map(x=>({
      sha:x.sha,summary:x.commit.message.split('\n')[0].slice(0,160)})),
      qa:'NOT_EXECUTED',acceptancePassed:false,proof:'SOURCE_COMMIT_RANGE_VERIFIED'};
  }
}
