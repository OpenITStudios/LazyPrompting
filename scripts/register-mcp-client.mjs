// Pair the installed LazyPrompting desktop MCP with an MCP client.
// Read-only by default: it prints the exact registration for each client.
// Only `--apply` writes, and only through a client CLI that owns its own config.
//
// Usage:
//   node scripts/register-mcp-client.mjs
//   node scripts/register-mcp-client.mjs --client opencode
//   node scripts/register-mcp-client.mjs --client opencode --apply
import {existsSync} from "node:fs";
import {execFileSync} from "node:child_process";
import {homedir} from "node:os";
import {join, resolve} from "node:path";

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const value = name => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

// The native host verifies the pipe client executable path, so only the
// installed executable may be registered. A debug build or a copy is refused.
function installedExecutable() {
  const local = process.env.LOCALAPPDATA;
  if (!local) throw new Error("LOCALAPPDATA_UNAVAILABLE");
  const candidate = join(local, "LazyPrompting", "lazyprompting-desktop.exe");
  if (!existsSync(candidate)) throw new Error("LAZYPROMPTING_NOT_INSTALLED");
  return candidate;
}

function findOnPath(names) {
  const path = process.env.PATH ?? "";
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
  return null;
}

const executable = installedExecutable();
const json = {
  command: executable,
  args: ["mcp"],
};

const snippets = {
  opencode: {
    file: join(homedir(), ".config", "opencode", "opencode.jsonc"),
    cli: `opencode mcp add lazyprompting --global -- "${executable}" mcp`,
    config: {
      $schema: "https://opencode.ai/config.json",
      mcp: {servers: {lazyprompting: {type: "local", command: [executable, "mcp"]}}}
    },
    note: "OpenCode V2 keeps servers under mcp.servers. Set codemode:false to expose the four tools directly."
  },
  "claude-desktop": {
    file: join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Claude", "claude_desktop_config.json"),
    config: {mcpServers: {lazyprompting: json}},
    note: "Restart Claude Desktop after editing the file."
  },
  "claude-code": {
    file: join(homedir(), ".claude.json"),
    cli: `claude mcp add lazyprompting -- "${executable}" mcp`,
    config: {mcpServers: {lazyprompting: json}},
    note: "Claude Code accepts the same mcpServers shape in .mcp.json."
  },
  cursor: {
    file: join(homedir(), ".cursor", "mcp.json"),
    config: {mcpServers: {lazyprompting: json}},
    note: ""
  },
  "vscode": {
    file: join(process.env.USERPROFILE ?? homedir(), ".vscode", "mcp.json"),
    config: {servers: {lazyprompting: {command: executable, args: ["mcp"]}}},
    note: "Project scope uses .vscode/mcp.json with the same servers key."
  },
  windsurf: {
    file: join(homedir(), ".codeium", "windsurf", "mcp_config.json"),
    config: {mcpServers: {lazyprompting: json}},
    note: ""
  },
  zed: {
    file: join(homedir(), ".config", "zed", "settings.json"),
    config: {context_servers: {lazyprompting: {command: {path: executable, args: ["mcp"], env: {}}}}},
    note: ""
  },
  "mcp-inspector": {
    file: null,
    cli: `npx @modelcontextprotocol/inspector --cli "${executable}" mcp --method tools/list`,
    config: null,
    note: "The official reference client. It needs no configuration."
  }
};

const requested = value("--client");
const apply = flag("--apply");
const names = requested ? [requested] : Object.keys(snippets);

for (const name of names) {
  const entry = snippets[name];
  if (!entry) {
    console.error(`Unknown client "${name}". Known: ${Object.keys(snippets).join(", ")}`);
    process.exitCode = 1;
    continue;
  }
  console.log(`\n=== ${name} ===`);
  if (entry.file) console.log(`file: ${entry.file}`);
  if (entry.config) console.log(JSON.stringify(entry.config, null, 2));
  if (entry.cli) console.log(`cli : ${entry.cli}`);
  if (entry.note) console.log(`note: ${entry.note}`);
}

if (!apply) {
  console.log("\nDry run. Add --apply to run a client CLI that owns its own configuration file.");
  process.exit(0);
}

// Only a client CLI may write its own configuration file.
const cli = {
  opencode: ["mcp", "add", "lazyprompting", "--global", "--", executable, "mcp"],
  "claude-code": ["mcp", "add", "lazyprompting", "--", executable, "mcp"]
}[requested];
if (!cli) {
  console.error(`No safe apply path for "${requested}". Copy the JSON snippet above into the listed file.`);
  process.exitCode = 1;
} else {
  const binary = findOnPath(requested === "opencode" ? ["opencode"] : ["claude"]);
  if (!binary) {
    console.error(`Client CLI not found on PATH. Use the JSON snippet for ${requested}.`);
    process.exitCode = 1;
  } else {
    console.log(`\nRunning: ${binary} ${cli.join(" ")}`);
    execFileSync(binary, cli, {stdio: "inherit"});
  }
}
