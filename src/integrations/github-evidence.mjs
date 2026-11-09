// Source identity only. A GitHub HEAD check is not proof of a test PASS or of authorized writes.
export class GitHubEvidence {
  constructor({token,fetchImpl=fetch}={}){
    if(!token)throw new Error("GITHUB_TOKEN_REQUIRED");
    this.token=token;this.fetchImpl=fetchImpl;
  }
  async head(repository,branch){
    if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)||!["Local"].includes(branch))
      throw new Error("TARGET_NOT_ALLOWED");
    const [owner,name]=repository.split("/");
    const url="https://api.github.com/repos/"+encodeURIComponent(owner)+"/"+encodeURIComponent(name)+"/branches/"+encodeURIComponent(branch);
    const res=await this.fetchImpl(url,{headers:{Authorization:"Bearer "+this.token,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"},signal:AbortSignal.timeout(10000)});
    if(!res.ok)throw new Error("GITHUB_HEAD_UNAVAILABLE_"+res.status);
    const data=await res.json();
    const sha=data?.commit?.sha;
    if(!/^[a-f0-9]{40}$/.test(sha))throw new Error("INVALID_GITHUB_HEAD");
    return {repository,branch,headSha:sha,proof:"SOURCE_HEAD_VERIFIED"};
  }
  async reconcile({repository,branch,claimedSha}){
    const head=await this.head(repository,branch);
    return {...head,verified:head.headSha===claimedSha,qa:"NOT_EXECUTED",acceptancePassed:false};
  }
}
