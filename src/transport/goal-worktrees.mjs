import {execFile} from "node:child_process";
import {createHash, randomUUID} from "node:crypto";
import {lstat, mkdir, readFile, realpath, rm} from "node:fs/promises";
import {dirname, isAbsolute, join} from "node:path";
import {promisify} from "node:util";

const exec=promisify(execFile);
const missing=async path=>lstat(path).then(()=>false,error=>{
 if(error.code==="ENOENT")return true;
 throw error;
});
const quoted=value=>"'"+value.replaceAll("'","''")+"'";

export async function openGoalWorktrees({cwd, dataDir, baseSha, coding, tasks}, server) {
 if(!coding || ![coding.git,coding.root].every(isAbsolute) ||
    dirname(coding.root).toLowerCase()!==dirname(cwd).toLowerCase() ||
    !/^\.lazyprompting-worktrees-[a-f0-9-]+$/.test(coding.root.split(/[\\/]/).at(-1)??"") ||
    !Array.isArray(coding.tasks))
  throw Error("GOAL_WORKTREE_CONFIG_INVALID");
 const hooks=join(dataDir,"empty-hooks");
 await mkdir(hooks,{recursive:true});
 if(await missing(coding.root)) await mkdir(coding.root);
 if((await realpath(coding.root)).toLowerCase()!==coding.root.toLowerCase())
  throw Error("GOAL_WORKTREE_ROOT_REDIRECTED");
 const git=async (directory,args)=>{
  const env={...Object.fromEntries(Object.entries(process.env).filter(([name])=>!/^GIT_/i.test(name))),
   GIT_CONFIG_NOSYSTEM:"1",GIT_CONFIG_GLOBAL:"NUL"};
  const {stdout}=await exec(coding.git,["--no-optional-locks","-c","core.fsmonitor=false","-c",`core.hooksPath=${hooks}`,"-C",directory,...args],
   {cwd:directory,env,timeout:15_000,maxBuffer:1024*1024,windowsHide:true});
  return stdout;
 };
 const head=async directory=>(await git(directory,["rev-parse","HEAD"])).trim();
 const common=(await git(cwd,["rev-parse","--path-format=absolute","--git-common-dir"])).trim();
 const config=await git(cwd,["config","--local","--name-only","--list"]);
 if (/^(filter\.|include\.|includeif\.)/im.test(config)) throw Error("GOAL_GIT_EXTERNAL_FILTER_UNSUPPORTED");
 if(await head(cwd)!==baseSha) throw Error("GOAL_BASE_CHANGED");
 const paths=[];
 for(let i=0;i<coding.tasks.length;i++){
  const path=join(coding.root,`task-${i+1}`);
  if(await missing(path)) {
   if(tasks[i].threadId || tasks[i].worktree) throw Error("GOAL_WORKTREE_MISSING");
   await git(cwd,["worktree","add","--detach","--",path,baseSha]);
  }
  if((await realpath(path)).toLowerCase()!==path.toLowerCase() || await head(path)!==baseSha ||
     (await git(path,["rev-parse","--path-format=absolute","--git-common-dir"])).trim()!==common)
   throw Error("GOAL_WORKTREE_BINDING_CHANGED");
  paths.push(path);
 }
 return paths.map((path,i)=>{
  const scope=coding.tasks[i];
  const sandboxPolicy={type:"workspaceWrite",writableRoots:[path],excludeTmpdirEnvVar:true,excludeSlashTmp:true,networkAccess:false};
  const allowed=new Set(scope.files.map(file=>file.toLowerCase()));
  const powershell=join(process.env.SystemRoot,"System32","WindowsPowerShell","v1.0","powershell.exe");
  return {
   path,scope,turnPolicy:{cwd:path,approvalPolicy:"never",sandboxPolicy},
   async probe(){
    const filename=".lp-sandbox-"+randomUUID();
    const inside=join(path,filename);
    const sibling=join(paths[(i+1)%paths.length]===path?coding.root:paths[(i+1)%paths.length],filename);
    const metadata=join(common,filename);
    const command=`$ErrorActionPreference='Stop'; [IO.File]::WriteAllText(${quoted(inside)},'probe'); foreach ($destination in @(${quoted(sibling)},${quoted(metadata)})) { try { [IO.File]::WriteAllText($destination,'probe') } catch {} }; exit 0`;
    try {
     const result=await server.runCommand([powershell,"-NoProfile","-NonInteractive","-Command",command],path,sandboxPolicy);
     if(result.exitCode!==0 || await missing(inside) || !await missing(sibling) || !await missing(metadata))
      throw Error("GOAL_WORKTREE_SANDBOX_UNVERIFIED");
    } finally {
     await rm(inside,{force:true});
     await rm(sibling,{force:true});
     await rm(metadata,{force:true});
    }
   },
   async verify(){
    if(await head(path)!==baseSha || await head(cwd)!==baseSha) throw Error("GOAL_BASE_CHANGED");
    const observe=async()=>{
     const changes=(await git(path,["status","--porcelain=v1","-z","--untracked-files=all","--no-renames"]))
      .split("\0").filter(Boolean).map(row=>row.slice(3));
     if(changes.some(file=>!allowed.has(file.toLowerCase())))throw Error("GOAL_UNAPPROVED_FILE_CHANGE");
     const hash=createHash("sha256");
     for(const name of changes){
      const file=join(path,name);
      hash.update(name+"\0");
      if(await missing(file)){hash.update("deleted\0");continue;}
      const stat=await lstat(file);
      if(!stat.isFile() || stat.size>1024*1024 || (await realpath(file)).toLowerCase()!==file.toLowerCase())
       throw Error("GOAL_FILE_EVIDENCE_UNAVAILABLE");
      hash.update(createHash("sha256").update(await readFile(file)).digest("hex")+"\0");
     }
     return {changes,changeDigest:hash.digest("hex")};
    };
    const before=await observe();
    const result=await server.runCommand(scope.verify,path,{type:"readOnly"});
    if(!Number.isInteger(result.exitCode))throw Error("GOAL_TEST_RESULT_UNCONFIRMED");
    const after=await observe();
    if(before.changeDigest!==after.changeDigest || await head(path)!==baseSha)
     throw Error("GOAL_WORKTREE_CHANGED_DURING_VERIFICATION");
    return {...after,exitCode:result.exitCode,pass:after.changes.length>0&&result.exitCode===0};
   }
  };
 });
}
