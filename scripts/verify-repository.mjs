// Static repository ownership and packaging checks only.
// Does not start MCP servers, spawn a browser, access GitHub or modify files.
import {readFileSync, existsSync, statSync, readdirSync} from 'node:fs';
import {resolve, dirname, extname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

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
  'src/gateway/mcp-gateway.mjs', 'src/gateway/capability-registry.mjs',
  'src/mcp/server.mjs', 'src/mcp/chatgpt-probe.mjs',
  'mcp/AGENTS.md', 'mcp/README.md', 'mcp/ARCHITECTURE.md',
  'docs/README.md', 'docs/architecture/README.md',
  'docs/governance/README.md', 'docs/operations/README.md',
  'docs/validation/README.md', 'docs/operations/current-state.md',
  'docs/operations/history/2026-11-10-full-checkpoint.md'
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
  const match = command.match(/^node\s+((?:src|scripts|tests|\.agents)\/\S+\.mjs)(?:\s|$)/);
  if (match) check(existsSync(resolve(root, match[1])), 'Script ' + name + ' has missing entrypoint ' + match[1]);
}

const publicTools = ['status', 'search_capabilities', 'describe_capability', 'invoke_capability'];
const rust = read('apps/desktop/src-tauri/src/mcp_stdio_host.rs');
const node = read('src/gateway/mcp-gateway.mjs');
for (const name of publicTools) {
  check(rust.includes('"name":"' + name + '"'), 'Desktop MCP tool missing: ' + name);
  check(node.includes('name:"' + name + '"'), 'Node gateway MCP tool missing: ' + name);
}
for (const capability of ['goal_run.start', 'goal_run.status', 'goal_run.report',
  'goal_run.control', 'workspace_browser.open', 'workspace_browser.navigate',
  'workspace_browser.location', 'workspace_browser.back',
  'workspace_browser.forward', 'workspace_browser.reload']) {
  check(rust.includes('"' + capability + '"'), 'Desktop capability absent: ' + capability);
}

// Check resolved relative imports under the Node source tree. Bare package imports
// are deliberately outside this static path check and stay with lockfile QA.
function walk(directory) {
  return readdirSync(directory, {withFileTypes:true}).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : entry.isFile() && extname(path) === '.mjs' ? [path] : [];
  });
}
for (const file of walk(resolve(root, 'src'))) {
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
  }
}

for (const path of ['README.md', 'mcp/README.md', 'mcp/ARCHITECTURE.md',
  'docs/README.md', 'docs/architecture/README.md',
  'docs/governance/README.md', 'docs/operations/README.md',
  'docs/validation/README.md']) {
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
