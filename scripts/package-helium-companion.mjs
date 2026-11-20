/* Independent minimal Helium extension; no third-party source copied. */
import {mkdir,copyFile,writeFile} from "node:fs/promises";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const common=join(root,"apps/desktop/browser-extension/chatgpt-composer/companion");
const helium=join(root,"apps/desktop/browser-extension/helium");
const output=join(root,"artifacts/runtime/helium-companion");
const baseFiles=[["core.js","companion/core.js"],
 ["compact-history.js","companion/compact-history.js"]];
const localFiles=[["usage-meter-signal.js","companion/usage-meter-signal.js"],
 ["compact-controller.js","companion/compact-controller.js"],
 ["compact.css","companion/compact.css"]];
export function heliumManifest(){
 return {
  manifest_version:3,
  name:"LazyPrompting Compact History (Helium)",
  version:"0.1.0",
  description:"Always-on compact chat rendering and message count beside Usage Meter tokens.",
  permissions:[],
  host_permissions:["https://chatgpt.com/*"],
  content_scripts:[{
   matches:["https://chatgpt.com/*"],
   js:["companion/core.js","companion/compact-history.js",
     "companion/usage-meter-signal.js","companion/compact-controller.js"],
   css:["companion/compact.css"],
   run_at:"document_idle",all_frames:false
  }]
 };
}
export async function packageHelium(){
 await mkdir(dirname(output),{recursive:true});
 await mkdir(output); // fail closed if destination exists
 await mkdir(join(output,"companion"));
 for(const [from,to] of baseFiles)await copyFile(join(common,from),join(output,to));
 for(const [from,to] of localFiles)await copyFile(join(helium,from),join(output,to));
 await writeFile(join(output,"manifest.json"),JSON.stringify(heliumManifest(),null,2)+"\n");
 return output;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)
 packageHelium().then(p=>console.log("Load unpacked: "+p)).catch(e=>{
  console.error("Helium packaging blocked: "+e.message);process.exitCode=1;
 });

