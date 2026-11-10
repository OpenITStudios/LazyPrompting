// Deterministic gateway resource staging. Does not download executables or run tests.
// Usage: node scripts/stage-gateway-resources.mjs <absolute-node-executable> <sha256-hex>
import {readFile,copyFile,mkdir,mkdtemp,rename,rm,writeFile,realpath,stat,lstat} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve,dirname,relative,isAbsolute,join,sep} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const source=resolve(root,"src/gateway/mcp-gateway.mjs");
const target=resolve(root,"apps/desktop/src-tauri/resources/gateway");
const [nodePath,expectedHash]=process.argv.slice(2);
if(!nodePath||!isAbsolute(nodePath)||!/^[a-f0-9]{64}$/i.test(expectedHash??""))throw Error("NODE_BINARY_AND_SHA256_REQUIRED");
const nodeReal=await realpath(nodePath);
if(!(await stat(nodeReal)).isFile())throw Error("NODE_NOT_FILE");
const nodeBytes=await readFile(nodeReal);
const digest=createHash("sha256").update(nodeBytes).digest("hex");
if(digest!==expectedHash.toLowerCase())throw Error("NODE_SHA256_MISMATCH");
const visited=new Set();
const entries=[];
async function collect(file){
 const real=await realpath(file);
 const rel=relative(root,real);
 if(rel.startsWith(".."+sep)||rel===".."||isAbsolute(rel))throw Error("SOURCE_OUTSIDE_REPO");
 if(visited.has(real))return;
 visited.add(real);
 const text=await readFile(real,"utf8");
 // Static ESM dependency closure; reject unknown dynamic imports and bare packages.
 const imports=[...text.matchAll(/(?:^|[\n;])\s*(?:import|export)\s+(?:[^"'\n]*?\s+from\s+)?["']([^"']+)["']/gm)].map(m=>m[1]);
 const dynamic=[...text.matchAll(/\bimport\s*\(([^)]*)\)/g)];
 for(const match of dynamic) {
   if(!/^\s*["'][^"']+["']\s*$/.test(match[1]))throw Error("DYNAMIC_IMPORT_UNRESOLVED:"+rel);
   imports.push(match[1].trim().slice(1,-1));
 }
 for(const spec of imports){
   if(spec.startsWith("node:"))continue;
   if(!spec.startsWith("."))throw Error("EXTERNAL_IMPORT_UNBUNDLED:"+spec);
   await collect(resolve(dirname(real),spec));
 }
 entries.push({real,rel});
}
await collect(source);
// Fail closed on an existing target: never delete a prior staged distribution.
// A release packager must explicitly own replacement and signing.
try {
 await lstat(target);
 throw Error("GATEWAY_STAGE_ALREADY_EXISTS");
} catch(error) {
 if(error?.code!=="ENOENT")throw error;
}
await mkdir(dirname(target),{recursive:true});
const temporary=await mkdtemp(join(dirname(target),".gateway-stage-"));
let published=false;
try {
 for(const {real,rel} of entries){
  const destination=join(temporary,rel);
  await mkdir(dirname(destination),{recursive:true});
  await copyFile(real,destination);
 }
 const executable=join(temporary,process.platform==="win32"?"node.exe":"node");
 await copyFile(nodeReal,executable);
 await writeFile(join(temporary,"mcp-gateway.mjs"),'import "./src/gateway/mcp-gateway.mjs";\\n');
 const fileHashes={};
 for(const {rel} of entries){
  fileHashes[rel]=createHash("sha256").update(await readFile(join(temporary,rel))).digest("hex");
 }
 fileHashes["mcp-gateway.mjs"]=createHash("sha256").update(await readFile(join(temporary,"mcp-gateway.mjs"))).digest("hex");
 await writeFile(join(temporary,"manifest.json"),JSON.stringify({nodeSha256:digest,files:fileHashes},null,2)+"\n");
 // Publish only after all files are written. Existing target is never overwritten.
 await rename(temporary,target);
 published=true;
} finally {
 if(!published)await rm(temporary,{recursive:true,force:true});
}
console.log("Staged gateway resource closure; no runtime verification performed.");
