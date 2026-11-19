// Static repository ownership and packaging checks only.
// Does not start MCP servers, spawn a browser, access GitHub or modify files.
import {readFileSync, existsSync, statSync, readdirSync} from 'node:fs';
import {resolve, dirname, extname, join, sep, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {scriptEntrypoints} from './script-entrypoints.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
let checked = 0;
function read(path) { return readFileSync(resolve(root, path), 'utf8'); }
function check(condition, message) {
  checked++;
  if (!condition) failures.push(message);
}
function json(path) { return JSON.parse(read(path)); }

const required = [
  '.gitattributes', '.node-version', '.editorconfig', '.gitignore',
  'README.md', 'AGENTS.md', 'GITHUB_RULES.md', 'CONTEXT.md',
  'CONTRIBUTING.md', 'SECURITY.md', 'toolchain.json',
  'package.json', 'package-lock.json',
  'apps/desktop/package.json', 'apps/desktop/package-lock.json',
  'apps/desktop/src-tauri/Cargo.toml',
  'apps/desktop/src-tauri/tauri.conf.json',
  'apps/desktop/src-tauri/src/mcp_stdio_host.rs',
  'apps/desktop/src-tauri/src/mcp_capabilities.rs',
  'apps/desktop/src-tauri/src/goal_run_projection.rs',
  'apps/desktop/src-tauri/src/goal_run_storage.rs',
  'apps/desktop/src-tauri/src/gateway_result.rs',
  'src/gateway/mcp-gateway.mjs', 'src/gateway/capability-registry.mjs',
  'src/mcp/server.mjs', 'src/mcp/chatgpt-probe.mjs',
  'src/runtime/backend-lifecycle.mjs', 'src/gateway/backend-lifecycle.mjs',
  'mcp/AGENTS.md', 'mcp/README.md', 'mcp/ARCHITECTURE.md',
  'docs/README.md', 'docs/architecture/README.md',
  'docs/governance/README.md', 'docs/operations/README.md',
  'docs/validation/README.md', 'docs/operations/current-state.md',
  'docs/operations/history/2026-11-10-full-checkpoint.md',
  '.github/workflows/localtest-readiness.yml'
];
for (const path of required) check(existsSync(resolve(root, path)), 'Required owner missing: ' + path);
if (failures.length) {
  for (const error of failures) console.error('[FAIL]', error);
  process.exit(1);
}

const pkg = json('package.json');
const desktop = json('apps/desktop/package.json');
const tauri = json('apps/desktop/src-tauri/tauri.conf.json');
const toolchain = json('toolchain.json');
const cargoVersion = read('apps/desktop/src-tauri/Cargo.toml').match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const pinnedNode = read('.node-version').trim();
check(pkg.version === desktop.version && pkg.version === tauri.version &&
  pkg.version === cargoVersion, 'Package, desktop, Tauri and Cargo versions differ');
check(toolchain.node.developmentVersion === pinnedNode,
  'Pinned Node version differs from toolchain metadata');
check(/^22\./.test(pinnedNode) && /^>=20/.test(pkg.engines?.node ?? ''),
  'Node compatibility/pin contract changed; update the review and tests');
check(toolchain.windowsGateway.nodeVersion === '24.14.1',
  'Packaged Windows Node pin changed without staging review');

const ci = read('.github/workflows/localtest-readiness.yml');
check(/^\s*workflow_dispatch\s*:/m.test(ci), 'Windows preflight must remain manual-only');
check(!/^\s*(?:push|pull_request|schedule)\s*:/m.test(ci),
  'Windows preflight gained an unapproved automatic trigger');
check(ci.includes("node-version: '22.16.0'"), 'Windows preflight Node pin drifted');
check((ci.match(/npm ci --no-audit --no-fund/g) ?? []).length === 2,
  'Windows preflight must install root and desktop from lockfiles');

const scripts = pkg.scripts ?? {};
check(scripts['start:mcp'] === 'node src/gateway/mcp-gateway.mjs',
  'Existing start:mcp compatibility entrypoint changed');
check(scripts['start:mcp:gateway'] === scripts['start:mcp'],
  'Node gateway alias must resolve to canonical gateway');
check(scripts['start:mcp:legacy'] === 'node src/mcp/server.mjs',
  'Legacy MCP must remain separately named');
check(scripts['start:mcp:probe'] === 'node src/mcp/chatgpt-probe.mjs',
  'Opt-in ChatGPT probe entrypoint changed');
check(scripts['test:repository'] === 'node scripts/verify-repository.mjs',
  'Repository check command mismatch');
for (const [name, command] of Object.entries(scripts)) {
  let targets;
  try { targets = scriptEntrypoints(command); }
  catch {
    check(false, 'Script ' + name + ' has an unsupported Node command grammar');
    continue;
  }
  for (const target of targets) {
    check(existsSync(resolve(root, target)),
      'Script ' + name + ' has missing entrypoint ' + target);
  }
}

const publicTools = ['status', 'search_capabilities', 'describe_capability', 'invoke_capability'];
const rust = read('apps/desktop/src-tauri/src/mcp_stdio_host.rs');
const nativeCatalog = read('apps/desktop/src-tauri/src/mcp_capabilities.rs');
const rustMain = read('apps/desktop/src-tauri/src/main.rs');
check(rustMain.includes('mod mcp_capabilities;') && rust.includes('use crate::mcp_capabilities::'),
  'Installed Rust MCP discovery module is not connected to the host');
const goalRun = read('apps/desktop/src-tauri/src/goal_runs.rs');
const gatewaySession = read('apps/desktop/src-tauri/src/gateway_session.rs');
const gatewayStdio = read('apps/desktop/src-tauri/src/gateway_stdio.rs');
const nativeIpcPipe = read('apps/desktop/src-tauri/src/native_ipc_pipe.rs');
const gatewayResult = read('apps/desktop/src-tauri/src/gateway_result.rs');
const goalStorage = read('apps/desktop/src-tauri/src/goal_run_storage.rs');
const nativeGoal = read('apps/desktop/src-tauri/src/goal_runs.rs');
const durableOutbox = read('src/prompt/prompt-outbox.mjs');
check(rustMain.includes('mod goal_run_storage;') &&
  nativeGoal.includes('use crate::goal_run_storage::') &&
  goalStorage.includes('pub(crate) fn read_bounded('),
  'Native goal bounded state reads are not connected');
check(gatewaySession.includes('require_callback_budget(deadline)?;') &&
  gatewaySession.includes('with_write_watchdog(') &&
  gatewaySession.includes('self.child.stop();') &&
  gatewaySession.includes('after_write(deadline)') &&
  gatewayStdio.includes('pub(crate) fn deadline(&self) -> Option<Instant>'),
  'Native stdio write timeout and tracked deadline are not connected');
check(nativeIpcPipe.includes('fn callback_budget(') &&
  /pipe\.serve_code_effect_callbacks\(\s*&token,\s*deadline,/.test(gatewaySession) &&
  /pipe\.authorize_next\(\s*&grant,\s*deadline,/.test(gatewaySession) &&
  /callback_budget\(\s*request_deadline,\s*DEADLINE,\s*"IPC_ADMISSION_TIMEOUT"\s*,?\s*\)/.test(nativeIpcPipe),
  'Private native callback budget is not bound to the parent request');
check(durableOutbox.includes('readBoundedOutbox(this.path)') &&
  durableOutbox.includes('Buffer.byteLength(encoded,"utf8")>MAX_OUTBOX_BYTES'),
  'Durable PromptOutbox byte limits are not connected');
check(rustMain.includes('mod goal_run_projection;') &&
  goalRun.includes('use crate::goal_run_projection::'),
  'Native goal status projection module is not wired to its owner');
check(rustMain.includes('mod gateway_result;') &&
  gatewaySession.includes('use crate::gateway_result::{take_code_mode_content, take_object_result};'),
  'Native gateway result projection module is not wired to its owner');
check(gatewaySession.includes('fn request_private_object(') &&
  gatewaySession.includes('take_code_mode_content(reply)') &&
  gatewayResult.includes('pub(crate) fn take_code_mode_content('),
  'Native private RPC and Code Mode result handling are not integrated');
const node = read('src/gateway/mcp-gateway.mjs');
for (const name of publicTools) {
  check(rust.includes('"name":"' + name + '"'), 'Desktop MCP tool missing: ' + name);
  check(node.includes('name:"' + name + '"'), 'Node gateway MCP tool missing: ' + name);
}
for (const capability of ['goal_run.start', 'goal_run.status', 'goal_run.report',
  'goal_run.control', 'workspace_browser.open', 'workspace_browser.navigate',
  'workspace_browser.location', 'workspace_browser.back',
  'workspace_browser.forward', 'workspace_browser.reload',
  'workspace_chat.prepare_handoff']) {
  check(nativeCatalog.includes('"' + capability + '"'), 'Desktop capability absent: ' + capability);
}

// Check resolved relative imports under the Node source tree. Bare package imports
// are deliberately outside this static path check and stay with lockfile QA.
function walk(directory, extension) {
  return readdirSync(directory, {withFileTypes:true}).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path, extension) : entry.isFile() && extname(path) === extension ? [path] : [];
  });
}
for (const file of walk(resolve(root, 'src'), '.mjs')) {
  const code = readFileSync(file, 'utf8');
  const imports = [
    ...code.matchAll(/\bfrom\s*["'](\.{1,2}\/[^"']+)["']/g),
    ...code.matchAll(/\bimport\s*["'](\.{1,2}\/[^"']+)["']/g),
    ...code.matchAll(/\bimport\s*\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g)
  ];
  for (const hit of imports) {
    const target = resolve(dirname(file), hit[1]);
    check(existsSync(target) && statSync(target).isFile(),
      'Broken relative import in ' + file.slice(root.length+1) + ': ' + hit[1]);
    // The Gateway may compose transport, but transport must not depend on Gateway.
    if (file.startsWith(join(root, 'src', 'transport') + sep)) {
      check(!target.startsWith(join(root, 'src', 'gateway') + sep),
        'Forbidden transport-to-gateway import: ' + file.slice(root.length+1) + ' -> ' + hit[1]);
    }
  }
}

const activeDocumentation = [
  'README.md', 'mcp/README.md', 'mcp/ARCHITECTURE.md',
  ...walk(resolve(root, 'docs'), '.md')
    .map(file => relative(root, file))
    .filter(path => !path.startsWith(join('docs', 'operations', 'history') + sep))
];
for (const path of activeDocumentation) {
  for (const match of read(path).matchAll(/\]\(([^)]+)\)/g)) {
    const destination = match[1].split('#')[0];
    if (!destination || /^(?:https?:|mailto:|#)/i.test(destination)) continue;
    if (/\s/.test(destination)) continue; // complex URI syntax is outside this checker
    let decoded;
    try { decoded = decodeURIComponent(destination); }
    catch { check(false, 'Malformed link URI in ' + path + ': ' + destination); continue; }
    check(existsSync(resolve(root, dirname(path), decoded)),
      'Broken relative documentation link in ' + path + ': ' + destination);
  }
}
check(read('docs/operations/current-state.md').length < 18000,
  'Active continuation is oversized; move historical evidence into history/');

if (failures.length) {
  for (const error of failures) console.error('[FAIL]', error);
  console.error('Repository structure: FAIL (' + failures.length + '/' + checked + ' checks)');
  process.exitCode = 1;
} else {
  console.log('Repository structure: PASS (' + checked + ' static checks; no runtime claims)');
}
