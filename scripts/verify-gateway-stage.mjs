import {createHash} from 'node:crypto';
import {readFile, lstat, realpath} from 'node:fs/promises';
import {dirname, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

// Read-only installer input gate. No network, staging, install or MCP launch.
// These pins must remain in sync with stage-gateway-resources.mjs.
export const NODE_SHA256='58e74bf02fc5bbacc41dcb8bef089961cd5bddd37830b87784e4fc624d145d1f';
export const LICENSE_SHA256='4573185d56580da2b890ba34a85a409257640f1c5632eade4300137266194d18';
const HASH=/^[a-f0-9]{64}$/;
const sha=b=>createHash('sha256').update(b).digest('hex');
const requireValid=(ok,reason)=>{if(!ok)throw Error(reason);};
const inside=(root,path)=>path.startsWith(root+sep);
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x);
function safePath(p){
 return typeof p==='string'&&p.length>0&&p.length<300&&
   !p.includes('\\')&&!p.startsWith('/')&&!p.endsWith('/')&&
   p.split('/').every(part=>part!==''&&part!=='.'&&part!=='..'&&!part.includes(':'));
}
async function plainFile(file,insideRoot){
 const canonical=await realpath(file);
 requireValid(inside(insideRoot,canonical),'STAGE_FILE_OUTSIDE_ROOT');
 const stat=await lstat(file);
 requireValid(stat.isFile()&&!stat.isSymbolicLink(),'STAGE_FILE_NOT_REGULAR');
 return readFile(canonical);
}

export async function verifyGatewayStage({repoRoot,nodeSha=NODE_SHA256,licenseSha=LICENSE_SHA256}={}){
 requireValid(typeof repoRoot==='string'&&repoRoot.trim(),'STAGE_REPO_ROOT_REQUIRED');
 requireValid(HASH.test(nodeSha)&&HASH.test(licenseSha),'STAGE_PIN_INVALID');
 const root=await realpath(repoRoot);
 const stage=join(root,'apps/desktop/src-tauri/resources/gateway');
 let stageRoot;
 try{stageRoot=await realpath(stage);}catch{throw Error('GATEWAY_STAGE_MISSING');}
 requireValid(inside(root,stageRoot),'GATEWAY_STAGE_OUTSIDE_REPO');
 const manifestBytes=await plainFile(join(stageRoot,'manifest.json'),stageRoot);
 requireValid(manifestBytes.length>0&&manifestBytes.length<=1024*1024,'STAGE_MANIFEST_SIZE_INVALID');
 let manifest;
 try{manifest=JSON.parse(manifestBytes.toString('utf8'));}catch{throw Error('STAGE_MANIFEST_INVALID');}
 requireValid(plain(manifest)&&Object.keys(manifest).sort().join(',')==='files,nodeSha256'&&
  manifest.nodeSha256===nodeSha&&plain(manifest.files),'STAGE_MANIFEST_INVALID');
 const files=Object.entries(manifest.files);
 requireValid(files.length>=3&&files.length<=512,'STAGE_FILE_LIST_INVALID');
 requireValid(['mcp-gateway.mjs','src/gateway/mcp-gateway.mjs','NODE-LICENSE.txt']
   .every(k=>Object.hasOwn(manifest.files,k)),'STAGE_GATEWAY_ENTRY_MISSING');
 let sourceFiles=0;
 for(const [name,expected] of [['node.exe',nodeSha],...files]){
  requireValid(safePath(name)&&HASH.test(expected),'STAGE_ENTRY_INVALID');
  let data;
  try{data=await plainFile(join(stageRoot,...name.split('/')),stageRoot);}
  catch(e){if(e.message==='STAGE_FILE_OUTSIDE_ROOT'||e.message==='STAGE_FILE_NOT_REGULAR')throw e;
    throw Error('STAGE_FILE_MISSING:'+name);}
  requireValid(sha(data)===expected,'STAGE_HASH_MISMATCH:'+name);
  if(name==='NODE-LICENSE.txt')requireValid(expected===licenseSha,'STAGE_LICENSE_PIN_MISMATCH');
  if(name.startsWith('src/')){
   let source;
   try{source=await plainFile(join(root,...name.split('/')),root);}
   catch{throw Error('STAGE_SOURCE_MISSING:'+name);}
   requireValid(sha(source)===expected,'STAGE_SOURCE_STALE:'+name);
   sourceFiles++;
  }
 }
 const stagingSource=await readFile(join(root,'scripts/stage-gateway-resources.mjs'),'utf8');
 requireValid(stagingSource.includes('const expectedHash="'+nodeSha+'"')&&
   stagingSource.includes('licenseHash!=="'+licenseSha+'"'),'STAGE_SOURCE_PIN_DRIFT');
 return Object.freeze({status:'SOURCE_STAGE_VERIFIED',filesChecked:files.length+1,
  sourceFilesChecked:sourceFiles,manifestSha256:sha(manifestBytes),
  nativeBuildVerified:false,installedAppVerified:false});
}

const self=process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(self){
 const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 try{const result=await verifyGatewayStage({repoRoot});console.log(JSON.stringify(result));}
 catch(e){console.error('BLOCKED_GATEWAY_STAGE: '+(e.message||'UNAVAILABLE'));process.exitCode=1;}
}
