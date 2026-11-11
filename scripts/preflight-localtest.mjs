// Read-only, deterministic preflight. No browser launch, credentials, AI calls or GitHub writes.
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const checks=[
 ["repository",["test:repository","test:chat-fixture","test:browser-extension-fixture","test:chatgpt-send-candidate","test:fixture-mcp-bridge","test:native-window-fixture","test:native-fixture-source","test:fixture-extension-integrity"]],
 ["gateway",["test:mcp","test:gateway","test:protocol","test:browser-contract","test:lightpanda-cdp","test:lightpanda-gateway","test:codex-preview-tools","test:workspace-isolation","test:workspace-browser","test:trusted-runtime"]],
 ["desktop",["test:work-admission","test:webview-status","test:view-coordinator","test:embedded-view-bridge","test:viewer-queue","test:lightpanda-host"]]
];
let failures=0;
function run(label,command,args,cwd=root){
 const result=spawnSync(command,args,{cwd,stdio:"inherit",shell:process.platform==="win32"});
 if(result.error){console.error(`[BLOCKED] ${label}: ${result.error.message}`);failures++;return;}
 if(result.status!==0){console.error(`[FAIL] ${label}: exit ${result.status??"unknown"}`);failures++;return;}
 console.log(`[PASS] ${label}`);
}
for(const [scope,scripts] of checks)for(const script of scripts)
 run(`${scope}:${script}`,"npm",["run",script],scope==="desktop"?resolve(root,"apps/desktop"):root);
run("desktop:build","npm",["run","build"],resolve(root,"apps/desktop"));
const cargo=spawnSync("cargo",["--version"],{cwd:root,encoding:"utf8",shell:process.platform==="win32"});
if(cargo.error||cargo.status!==0){console.error("[BLOCKED] Rust toolchain not available; native preflight incomplete");failures++;}
else{
 run("rust:fmt","cargo",["fmt","--manifest-path","apps/desktop/src-tauri/Cargo.toml","--","--check"]);
 run("rust:check","cargo",["check","--manifest-path","apps/desktop/src-tauri/Cargo.toml"]);
 run("rust:test","cargo",["test","--manifest-path","apps/desktop/src-tauri/Cargo.toml"]);
}
console.log(`Local-test preflight: ${failures===0?"PASS":"BLOCKED/FAIL"} (${failures} issues). Native runtime and real Lightpanda connectivity require separate manual verification.`);
process.exitCode=failures?1:0;
