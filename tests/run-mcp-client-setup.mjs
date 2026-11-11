import assert from "node:assert/strict";
import {join} from "node:path";
import {
  SERVER_NAME,
  entryFor,
  installedExecutable,
  mergeAtPath,
  parseConfigFile,
  readEntry
} from "../scripts/setup-local.mjs";

let checks = 0;
const ok = (value, label) => {
  assert.ok(value, label);
  checks++;
};
const eq = (value, expected, label) => {
  assert.deepEqual(value, expected, label);
  checks++;
};

// Registration must never drop an existing server or an unrelated setting.
const existing = {
  $schema: "https://opencode.ai/config.json",
  mcp: {servers: {other: {type: "remote", url: "https://example.com/mcp"}}},
  theme: "dark"
};
const entry = {type: "local", command: ["C:\\app\\lazyprompting-desktop.exe", "mcp"]};
const merged = mergeAtPath(existing, ["mcp", "servers"], SERVER_NAME, entry);
eq(merged.mcp.servers.other, existing.mcp.servers.other, "existing server preserved");
eq(merged.theme, "dark", "unrelated setting preserved");
eq(merged.mcp.servers[SERVER_NAME], entry, "new server registered");
ok(!("lazyprompting" in existing.mcp.servers), "input object not mutated");

// Applying the same registration twice must not duplicate or drift.
const twice = mergeAtPath(merged, ["mcp", "servers"], SERVER_NAME, entry);
eq(twice, merged, "registration is idempotent");
eq(Object.keys(twice.mcp.servers).length, 2, "no duplicate server entry");

// A configuration file that is not plain JSON is refused, never rewritten.
eq(parseConfigFile(""), {}, "empty file is an empty configuration");
eq(parseConfigFile('{"a":1}'), {a: 1}, "plain JSON is parsed");
eq(parseConfigFile('{ // comment\n "a":1 }'), null, "commented file is refused");
eq(parseConfigFile("{not json"), null, "broken file is refused");

// An unchanged registration must be detected so the setup never rewrites a
// live client configuration.
eq(readEntry(merged, ["mcp", "servers"], SERVER_NAME), entry,
  "registered entry is readable");
eq(readEntry(merged, ["mcp", "servers"], "other").type, "remote",
  "other entries stay readable");
eq(readEntry({}, ["mcp", "servers"], SERVER_NAME), undefined,
  "missing entry is undefined");

// The entry shape follows the client contract, not the model.
eq(entryFor({name: "opencode"}, "C:\\app\\x.exe"), {
  type: "local",
  command: ["C:\\app\\x.exe", "mcp"]
}, "opencode uses a local type and a command array");
eq(entryFor({name: "cursor"}, "C:\\app\\x.exe"), {
  command: "C:\\app\\x.exe",
  args: ["mcp"]
}, "cursor style entry");
eq(entryFor({name: "zed"}, "C:\\app\\x.exe"), {
  command: {path: "C:\\app\\x.exe", args: ["mcp"], env: {}}
}, "zed style entry");

// Only an installed desktop build may be registered.
eq(installedExecutable({LOCALAPPDATA: join("Z:", "nowhere")}), null,
  "missing installation is reported");
ok(installedExecutable({LOCALAPPDATA: process.env.LOCALAPPDATA}),
  "installed desktop is found");

console.log(`Local setup contract: PASS (${checks} assertions)`);
