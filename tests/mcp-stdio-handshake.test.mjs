import {test} from "node:test";
import assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {verifyMcpStdioServer} from "../src/runtime/mcp-stdio-handshake.mjs";
const fake=fileURLToPath(new URL("./fixtures/mcp-handshake-server.mjs",import.meta.url));
const run=(mode="success")=>verifyMcpStdioServer(process.execPath,[fake,mode],{timeoutMs:500});
test("valid initialize, notification, and exact four tools",async()=>{
  assert.deepEqual(await run(),{ok:true,tools:4,reason:"MCP_STDIO_VERIFIED"});
});
test("rejects a misleading four-tool list",async()=>{
  assert.equal((await run("wrong-name")).reason,"MCP_TOOLS_CONTRACT_MISMATCH");
});
test("missing initialization times out rather than passing",async()=>{
  assert.equal((await run("missing-init")).reason,"MCP_HANDSHAKE_TIMEOUT");
});
test("refuses polluted stdio output",async()=>{
  assert.equal((await run("junk-output")).reason,"MCP_INVALID_STDOUT");
});
test("does not accept a failed server exit",async()=>{
  assert.equal((await run("exit-error")).reason,"MCP_SERVER_EXIT_FAILED");
});
test("invalid verification config is fail-closed",async()=>{
  assert.equal((await verifyMcpStdioServer("",[])).ok,false);
  assert.equal((await verifyMcpStdioServer(process.execPath,[],{timeoutMs:-1})).ok,false);
});
