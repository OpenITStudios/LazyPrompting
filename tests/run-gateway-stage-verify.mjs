import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyGatewayStage,NODE_SHA256,LICENSE_SHA256} from '../scripts/verify-gateway-stage.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const base=await mkdtemp(join(tmpdir(),'lazy-stage-check-'));
let n=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);n++};
const fail=async(text)=>{await assert.rejects(verifyGatewayStage({repoRoot:base,
 nodeSha:hash('synthetic-node'),licenseSha:hash('synthetic-license')}),e=>e.message.includes(text));n++;};
try{
 const stage=join(base,'apps/desktop/src-tauri/resources/gateway');
 await fail('GATEWAY_STAGE_MISSING');
 await mkdir(join(stage,'src/gateway'),{recursive:true});
 await mkdir(join(base,'src/gateway'),{recursive:true});
 await mkdir(join(base,'scripts'),{recursive:true});
 await writeFile(join(stage,'node.exe'),'synthetic-node');
 await writeFile(join(stage,'NODE-LICENSE.txt'),'synthetic-license');
 const source='export const worker="test";\n';
 await writeFile(join(stage,'src/gateway/mcp-gateway.mjs'),source);
 await writeFile(join(base,'src/gateway/mcp-gateway.mjs'),source);
 await writeFile(join(stage,'mcp-gateway.mjs'),'import "./src/gateway/mcp-gateway.mjs";\n');
 const nodeHash=hash('synthetic-node'),licenseHash=hash('synthetic-license');
 await writeFile(join(base,'scripts/stage-gateway-resources.mjs'),
  'const expectedHash="'+nodeHash+'";if(licenseHash!=="'+licenseHash+'")throw Error();');
 let entries={'NODE-LICENSE.txt':licenseHash,'src/gateway/mcp-gateway.mjs':hash(source),
  'mcp-gateway.mjs':hash('import "./src/gateway/mcp-gateway.mjs";\n')};
 const publish=async()=>writeFile(join(stage,'manifest.json'),
  JSON.stringify({nodeSha256:nodeHash,files:entries}));
 await publish();
 const verified=await verifyGatewayStage({repoRoot:base,nodeSha:nodeHash,licenseSha:licenseHash});
 eq(verified.status,'SOURCE_STAGE_VERIFIED','valid staged tree');
 eq(verified.filesChecked,4,'file count');
 eq(verified.sourceFilesChecked,1,'source closure');
 eq(verified.nativeBuildVerified,false,'stage not Rust build');
 eq(verified.installedAppVerified,false,'stage not installation');
 await writeFile(join(base,'src/gateway/mcp-gateway.mjs'),'different');await fail('STAGE_SOURCE_STALE');
 await writeFile(join(base,'src/gateway/mcp-gateway.mjs'),source);
 await writeFile(join(stage,'src/gateway/mcp-gateway.mjs'),'tampered');await fail('STAGE_HASH_MISMATCH');
 await writeFile(join(stage,'src/gateway/mcp-gateway.mjs'),source);
 entries={'../escape':hash('x'),...entries};await publish();await fail('STAGE_ENTRY_INVALID');
 delete entries['../escape'];await publish();
 await writeFile(join(stage,'node.exe'),'wrong');await fail('STAGE_HASH_MISMATCH');
 await writeFile(join(stage,'node.exe'),'synthetic-node');
 await unlink(join(stage,'NODE-LICENSE.txt'));await fail('STAGE_FILE_MISSING');
 await writeFile(join(stage,'NODE-LICENSE.txt'),'synthetic-license');
 await writeFile(join(stage,'manifest.json'),'not json');await fail('STAGE_MANIFEST_INVALID');
 const rootStage=await readFile(join(base,'scripts/stage-gateway-resources.mjs'),'utf8');
 eq(rootStage.includes(nodeHash),true,'pin from staging source');
 // Assert production constants still match the source-controlled stage pins.
 const own=await readFile(new URL('../scripts/stage-gateway-resources.mjs',import.meta.url),'utf8').catch(()=>null);
 if(own){eq(own.includes('const expectedHash="'+NODE_SHA256+'"'),true,'node pin parity');
  eq(own.includes('licenseHash!=="'+LICENSE_SHA256+'"'),true,'license pin parity');}
 console.log('Gateway stage verification tests: PASS ('+n+' assertions, fake files only)');
}finally{await rm(base,{recursive:true,force:true});}
