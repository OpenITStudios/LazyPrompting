import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {join, resolve, dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'apps/desktop/browser-extension');
const PINNED = Object.freeze({
  'manifest.json': 'c2a9d9611e8b036b55ff96f6d505c292e5a5d0f6d24821520564f292bd32d2dc',
  'background.js': 'd60b0431b96b6d2c1a835c45635271b3a6c4e08ee2d804bd0d87d9688d283403',
  'content-script.js': 'd135a579fc2f2308203a094e5f183c7fca72f5fe5e6a2ceba45f3fff5f0f9d33',
});
const hash = data => createHash('sha256').update(data).digest('hex');
function inspect(dir) {
  const report = {};
  for (const [name, expected] of Object.entries(PINNED)) {
    try {report[name] = hash(readFileSync(join(dir,name))) === expected;}
    catch {report[name] = false;}
  }
  return report;
}
let assertions = 0;
const eq = (actual,expected,message) => {assert.deepEqual(actual,expected,message);assertions++};
const ok = (value,message) => {assert.ok(value,message);assertions++};
const original = inspect(root);
for (const file of Object.keys(PINNED)) eq(original[file],true,'pinned '+file);
const manifest = JSON.parse(readFileSync(join(root,'manifest.json'),'utf8'));
eq(manifest.manifest_version,3,'MV3 only');
eq(manifest.host_permissions,['http://127.0.0.1/*'],'no external host');
eq(manifest.permissions,['storage'],'minimal capabilities');
eq(manifest.content_scripts[0].matches,['http://127.0.0.1/*'],'fixture-only content script');
eq(manifest.content_scripts[0].js,['content-script.js'],'fixed injected script');
eq(manifest.background.service_worker,'background.js','fixed background');
ok(!('externally_connectable' in manifest),'no externally connectable entry');
ok(!JSON.stringify(manifest).includes('chatgpt.com'),'no ChatGPT host permission');
const tmp = mkdtempSync(join(tmpdir(),'lp-extension-integrity-'));
try {
  for (const f of Object.keys(PINNED)) copyFileSync(join(root,f),join(tmp,f));
  ok(Object.values(inspect(tmp)).every(Boolean),'unmodified copy matches');
  writeFileSync(join(tmp,'content-script.js'),readFileSync(join(tmp,'content-script.js'),'utf8')+'\n//tampered\n');
  eq(inspect(tmp)['content-script.js'],false,'tampered content rejected');
  copyFileSync(join(root,'content-script.js'),join(tmp,'content-script.js'));
  const changed = JSON.parse(readFileSync(join(tmp,'manifest.json'),'utf8'));
  changed.host_permissions.push('https://chatgpt.com/*');
  writeFileSync(join(tmp,'manifest.json'),JSON.stringify(changed));
  eq(inspect(tmp)['manifest.json'],false,'permission widening changes manifest hash');
  copyFileSync(join(root,'manifest.json'),join(tmp,'manifest.json'));
  rmSync(join(tmp,'background.js'));
  eq(inspect(tmp)['background.js'],false,'missing background denied');
  ok(Object.values(inspect(root)).every(Boolean),'fixture bundle remains immutable');
} finally {rmSync(tmp,{recursive:true,force:true});}
console.log('Fixture extension integrity: PASS ('+assertions+' assertions, Node-only)');
