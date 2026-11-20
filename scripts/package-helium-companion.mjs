// Unpacked Helium release from existing canonical Companion JS/CSS sources.
// No network, no modification of the native WebView2 manifest or source.
import {mkdir,readFile,copyFile,writeFile} from "node:fs/promises";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const canonical=join(root,"apps/desktop/browser-extension/chatgpt-composer");
const browser=join(root,"apps/desktop/browser-extension/helium");
const output=join(root,"artifacts/runtime/helium-companion");
const common=["companion/core.js","companion/compact-history.js",
 "companion/limit-notice.js","companion/toolbar.js","companion/toolbar.css"];
const variants=[["standalone-meter.js","companion/standalone-meter.js"],
 ["standalone-meter.css","companion/standalone-meter.css"]];
export function heliumManifest(input){
 if(input?.manifest_version!==3||input?.content_scripts?.length!==1)
  throw Error("HELIUM_INVALID_CANONICAL_MANIFEST");
 const cs=input.content_scripts[0];
 if(cs.js?.at(-1)!=="companion/toolbar.js"||
    !cs.css?.includes("companion/toolbar.css"))throw Error("HELIUM_INVALID_ASSETS");
 return {...input,name:"LazyPrompting Companion (Helium)",
  description:"Manual chat length monitoring and conservative offscreen rendering for Chromium.",
  content_scripts:[{...cs,js:[...cs.js.slice(0,-1),"companion/standalone-meter.js",cs.js.at(-1)],
   css:[...cs.css,"companion/standalone-meter.css"]}]};
}
export async function packageHelium(){
 await mkdir(dirname(output),{recursive:true});
 await mkdir(output); // existing destination fails, never overwrite another build
 await mkdir(join(output,"companion"));
 const manifest=heliumManifest(JSON.parse(await readFile(join(canonical,"manifest.json"),"utf8")));
 for(const path of common)await copyFile(join(canonical,path),join(output,path));
 for(const [from,to] of variants)await copyFile(join(browser,from),join(output,to));
 await writeFile(join(output,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
 return output;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)
 packageHelium().then(p=>console.log("Load unpacked from: "+p)).catch(e=>{
  console.error("Helium packaging stopped: "+e.message);process.exitCode=1;
 });
