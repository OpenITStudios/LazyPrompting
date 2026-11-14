import {defineConfig,searchForWorkspaceRoot} from "vite";
import {svelte} from "@sveltejs/vite-plugin-svelte";
import {fileURLToPath} from "node:url";
const repoRoot=fileURLToPath(new URL("../../",import.meta.url));
// The desktop imports the existing canonical read-only GitHubEvidence module.
export default defineConfig({plugins:[svelte()],server:{
 host:"127.0.0.1",strictPort:true,port:1425,
 fs:{allow:[searchForWorkspaceRoot(process.cwd()),repoRoot]}
}});
