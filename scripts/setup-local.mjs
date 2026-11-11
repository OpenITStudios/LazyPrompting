// One-command local setup for the installed LazyPrompting desktop MCP.
//
// Detects the MCP clients on this machine, registers the installed executable
// with each one, and verifies the registration with a real stdio handshake.
// Read-only unless --apply is given.
//
// Usage:
//   node scripts/setup-local.mjs
//   node scripts/setup-local.mjs --apply
//   node scripts/setup-local.mjs --apply --client opencode
import {spawnSync} from "node:child_process";
import {copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync} from "node:fs";
import {homedir} from "node:os";
import {dirname, join} from "node:path";
import {pathToFileURL} from "node:url";

export const SERVER_NAME = "lazyprompting";

// Merge one server entry into a configuration object at a nested key path.
export function mergeAtPath(config, path, name, entry) {
  const next = {...(config ?? {})};
  let cursor = next;
  for (const key of path.slice(0, -1)) {
    cursor[key] = {...(cursor[key] ?? {})};
    cursor = cursor[key];
  }
  const last = path[path.length - 1];
  cursor[last] = {...(cursor[last] ?? {}), [name]: entry};
  return next;
}

// Parse a client configuration file. Comments are not silently dropped: a file
// that is not plain JSON is reported so the caller can print a snippet
// instead of rewriting it.
export function parseConfigFile(text) {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export function installedExecutable(env = process.env) {
  const local = env.LOCALAPPDATA;
  if (!local) throw new Error("LOCALAPPDATA_UNAVAILABLE");
  const candidate = join(local, "LazyPrompting", "lazyprompting-desktop.exe");
  return existsSync(candidate) ? candidate : null;
}

export function findExecutable(env, names, extraPaths = []) {
  const path = env.PATH ?? "";
  const separator = process.platform === "win32" ? ";" : ":";
  for (const name of names) {
    for (const directory of path.split(separator)) {
      if (!directory) continue;
      for (const suffix of process.platform === "win32" ? [".exe", ".cmd", ""] : [""]) {
        const candidate = join(directory, name + suffix);
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  for (const candidate of extraPaths) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  return null;
}

export function clientDefinitions(env = process.env, home = homedir()) {
  const roaming = env.APPDATA ?? join(home, "AppData", "Roaming");
  const userProfile = env.USERPROFILE ?? home;
  const local = env.LOCALAPPDATA ?? join(home, "AppData", "Local");
  const codexNative = join(local, "OpenAI", "Codex", "bin");
  const codexCandidates = existsSync(codexNative)
    ? readdirSync(codexNative, {withFileTypes: true})
        .filter(entry => entry.isDirectory())
        .map(entry => join(codexNative, entry.name, "codex.exe"))
    : [];
  return [
    {
      name: "codex",
      label: "Codex CLI",
      cli: findExecutable(env, ["codex"], codexCandidates),
      cliArgs: ["mcp", "add", SERVER_NAME, "--"],
      file: join(home, ".codex", "config.toml"),
      path: null
    },
    {
      name: "opencode",
      label: "OpenCode",
      cli: findExecutable(env, ["opencode"], [
        join(local, "Programs", "@opencode-aidesktop", "resources", "opencode-cli.exe")
      ]),
      cliArgs: ["mcp", "add", SERVER_NAME, "--global", "--"],
      file: join(home, ".config", "opencode", "opencode.jsonc"),
      path: ["mcp", "servers"]
    },
    {
      name: "claude-code",
      label: "Claude Code",
      cli: findExecutable(env, ["claude"], [
        join(local, "Programs", "Claude Code", "claude.exe")
      ]),
      cliArgs: ["mcp", "add", SERVER_NAME, "--"],
      file: join(home, ".claude.json"),
      path: ["mcpServers"]
    },
    {
      name: "claude-desktop",
      label: "Claude Desktop",
      cli: null,
      file: join(roaming, "Claude", "claude_desktop_config.json"),
      path: ["mcpServers"]
    },
    {
      name: "cursor",
      label: "Cursor",
      cli: null,
      file: join(home, ".cursor", "mcp.json"),
      path: ["mcpServers"]
    },
    {
      name: "vscode",
      label: "VS Code",
      cli: null,
      file: join(userProfile, ".vscode", "mcp.json"),
      path: ["servers"]
    },
    {
      name: "windsurf",
      label: "Windsurf",
      cli: null,
      file: join(home, ".codeium", "windsurf", "mcp_config.json"),
      path: ["mcpServers"]
    },
    {
      name: "zed",
      label: "Zed",
      cli: null,
      file: join(home, ".config", "zed", "settings.json"),
      path: ["context_servers"]
    }
  ];
}

// Read one server entry from a configuration object at a nested key path.
export function readEntry(config, path, name) {
  let cursor = config;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object") return undefined;
    cursor = cursor[key];
  }
  if (!cursor || typeof cursor !== "object") return undefined;
  return cursor[name];
}

// The entry shape follows each client contract, not the model.
export function entryFor(client, executable) {
  if (client.name === "opencode") {
    return {type: "local", command: [executable, "mcp"]};
  }
  if (client.name === "zed") {
    return {command: {path: executable, args: ["mcp"], env: {}}};
  }
  return {command: executable, args: ["mcp"]};
}

// Verify a registration with a real MCP handshake over stdio.
export function verifyServer(command, args, timeoutMs = 30000) {
  const requests = [
    JSON.stringify({
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: {protocolVersion: "2025-03-26", capabilities: {}, clientInfo: {name: "lazyprompting-setup", version: "1"}}
    }),
    JSON.stringify({jsonrpc: "2.0", id: 2, method: "tools/list", params: {}})
  ].join("\n") + "\n";
  const result = spawnSync(command, args, {input: requests, encoding: "utf8", timeout: timeoutMs});
  const lines = (result.stdout ?? "").trim().split("\n").filter(Boolean);
  let tools = 0;
  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      tools = parsed?.result?.tools?.length ?? tools;
    } catch {
      // A non-JSON line is not a tool listing.
    }
  }
  return {ok: tools === 4, tools};
}

function register(client, executable, apply) {
  // Never rewrite a configuration that already holds the exact entry. A client
  // reloads its configuration when the file changes and drops a working
  // server connection.
  if (client.file && client.path && existsSync(client.file)) {
    const parsed = parseConfigFile(readFileSync(client.file, "utf8"));
    if (parsed && readEntry(parsed, client.path, SERVER_NAME)) {
      const current = JSON.stringify(readEntry(parsed, client.path, SERVER_NAME));
      const wanted = JSON.stringify(entryFor(client, executable));
      if (current === wanted) {
        return {state: "registered", detail: "already present", unchanged: true};
      }
    }
  }
  if (client.file && !client.path && existsSync(client.file)) {
    // A TOML configuration cannot be merged safely. Skip it when the exact
    // executable is already listed.
    const text = readFileSync(client.file, "utf8");
    if (text.includes(executable)) {
      return {state: "registered", detail: "already present", unchanged: true};
    }
  }
  if (client.cli) {
    if (!apply) return {state: "planned", detail: client.cliArgs.join(" ")};
    const result = spawnSync(client.cli, [...client.cliArgs, executable, "mcp"], {encoding: "utf8"});
    if (result.status !== 0) {
      const detail = (result.stderr ?? "").trim().split("\n").pop() ?? `exit ${result.status}`;
      return {state: "failed", detail};
    }
    return {state: "registered", detail: "client CLI"};
  }
  if (!client.file || !client.path) {
    const hint = client.cliArgs
      ? `${client.name} mcp add ${SERVER_NAME} -- <installed exe> mcp`
      : `edit ${client.file ?? "the client configuration"} manually`;
    return {state: "manual", detail: hint};
  }
  const existing = existsSync(client.file) ? readFileSync(client.file, "utf8") : "";
  const parsed = parseConfigFile(existing);
  if (parsed === null) {
    return {state: "manual", detail: `not plain JSON: ${client.file}`};
  }
  if (!apply) return {state: "planned", detail: client.file};
  mkdirSync(dirname(client.file), {recursive: true});
  if (existsSync(client.file)) {
    copyFileSync(client.file, `${client.file}.bak-${Date.now()}`);
  }
  const merged = mergeAtPath(parsed, client.path, SERVER_NAME, entryFor(client, executable));
  writeFileSync(client.file, `${JSON.stringify(merged, null, 2)}\n`);
  return {state: "registered", detail: client.file};
}

function main(argv) {
  const apply = argv.includes("--apply");
  const index = argv.indexOf("--client");
  const only = index === -1 ? null : argv[index + 1];
  const executable = installedExecutable();
  if (!executable) {
    console.error("LazyPrompting is not installed. Install the Windows bundle first.");
    process.exitCode = 1;
    return;
  }
  console.log(`installed: ${executable}`);
  console.log(`mode     : ${apply ? "apply" : "dry run"}`);
  const clients = clientDefinitions().filter(client => !only || client.name === only);
  const rows = [];
  for (const client of clients) {
    rows.push({label: client.label, ...register(client, executable, apply)});
  }
  for (const row of rows) {
    console.log(`${row.state.padEnd(10)} ${row.label.padEnd(16)} ${row.detail}`);
  }
  if (!apply) {
    console.log("\nDry run. Re-run with --apply to write the registrations.");
    return;
  }
  console.log("\nverification (real stdio handshake):");
  for (const row of rows) {
    if (row.state !== "registered") continue;
    const result = verifyServer(executable, ["mcp"]);
    console.log(`${result.ok ? "connected" : "failed   "} ${row.label} (tools=${result.tools})`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
