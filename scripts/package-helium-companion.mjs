/* Helium packages the exact same MV3 manifest and scripts as WebView2.
 * No independent feature/UI owner, no remote fetch and no popup. */
import {mkdir,readFile,copyFile,writeFile} from "node:fs/promises";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath,pathToFileURL} from "node:url";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const canonical=join(root,"apps/desktop/browser-extension/chatgpt-composer");
const output=join(root,"artifacts/runtime/helium-companion");
export function heliumManifest(input){
 if(input?.manifest_version!==3||input?.content_scripts?.length!==1||
    input?.host_permissions?.join()!=="https://chatgpt.com/*"||
    input?.permissions?.join()!=="storage"||
    !input.content_scripts[0].js?.includes("companion/settings.js")||
    !input.content_scripts[0].js?.includes("companion/toolbar.js")||
    input.action||input.options_page||input.background)
  throw Error("HELIUM_CANONICAL_MANIFEST_REQUIRED");
 return input;
}
export async function packageHelium(){
 await mkdir(dirname(output),{recursive:true});
 await mkdir(output); // no silent replacement of an existing package
 await mkdir(join(output,"companion"));
 const manifest=heliumManifest(JSON.parse(await readFile(join(canonical,"manifest.json"),"utf8")));
 const files=[...manifest.content_scripts[0].js,...manifest.content_scripts[0].css];
 for(const path of files)await copyFile(join(canonical,path),join(output,path));
 await writeFile(join(output,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");
 return output;
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)
 packageHelium().then(folder=>console.log("Helium unpacked extension: "+folder))
 .catch(error=>{console.error("Packaging stopped: "+error.message);process.exitCode=1;});

