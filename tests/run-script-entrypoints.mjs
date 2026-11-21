import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {scriptEntrypoints} from '../scripts/script-entrypoints.mjs';
let checks=0;
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++};
const reject=(command,label)=>{assert.throws(()=>scriptEntrypoints(command),/SCRIPT_ENTRYPOINT_INVALID/,label);checks++};
eq(scriptEntrypoints('node scripts/verify-repository.mjs'),['scripts/verify-repository.mjs'],'regular Node entrypoint');
eq(scriptEntrypoints('node scripts/preflight-targeted.mjs'),['scripts/preflight-targeted.mjs'],
 'focused preflight is one fixed Node entrypoint, no arbitrary CLI flags');
reject('node scripts/preflight-localtest.mjs --targeted',
 'npm manifest grammar still blocks freeform CLI script arguments');
eq(scriptEntrypoints('node .agents/evals/run-permission-cases.mjs'),['.agents/evals/run-permission-cases.mjs'],'hidden agent source path');
eq(scriptEntrypoints('node --test tests/goal-run-pause.test.mjs'),['tests/goal-run-pause.test.mjs'],'Node test runner');
eq(scriptEntrypoints('node --test tests/goal-run-scope-fingerprint.test.mjs tests/goal-run-recovery.test.mjs'),['tests/goal-run-scope-fingerprint.test.mjs','tests/goal-run-recovery.test.mjs'],'two Node test targets');
eq(scriptEntrypoints('node tests/a.mjs && node tests/b.mjs && node tests/c.mjs'),['tests/a.mjs','tests/b.mjs','tests/c.mjs'],'all chained Node scripts');
eq(scriptEntrypoints('node scripts/preflight-localtest.mjs && node --test tests/goal-run-pause.test.mjs'),['scripts/preflight-localtest.mjs','tests/goal-run-pause.test.mjs'],'mixed chained forms');
for(const command of [
  '', ' ', 'npm run test:repository', 'node', 'node --test',
  'node --test --watch tests/a.mjs', 'node tests/a.mjs --debug',
  'node --test tests/a.mjs && echo unsafe', 'node tests/a.mjs &&',
  'node tests/a.mjs; echo unsafe', 'node tests/a.mjs | cat',
  'node ../secret.mjs', 'node /absolute/secret.mjs',
  'node src/../../secret.mjs', 'node --test tests/a.mjs tests/a.mjs',
  'node tests/a.js', 'node --test tests/a.mjs tests/b.js',
  'node tests/a.mjs && node --test ../secret.mjs',
  'node tests/a.mjs && npm run build'
])reject(command,'deny unsupported/ambiguous script '+command);
// Read-only preflight regression: a first failed check must gate all later work.
const preflight=await readFile(new URL('../scripts/preflight-localtest.mjs',import.meta.url),'utf8');
for(const [pattern,label] of [
 [/for\(const \[scope,scripts\] of selectedChecks\)\{[\s\S]*?if\(failures\)break;/,'failed npm stops the suite'],
 [/if\(!targeted&&failures===0\)\{/,'Node failure skips frontend build'],
 [/run\("desktop:build"[\s\S]*?if\(failures===0\)\{/,'frontend failure skips Cargo'],
 [/for\(const \[label,args\] of \[[\s\S]*?if\(failures\)break;/,'failed Cargo stops later Cargo checks']
]){assert.match(preflight,pattern,label);checks++;}
console.log('Script entrypoint parser: PASS ('+checks+' assertions; synthetic commands)');
