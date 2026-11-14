import test from "node:test";
import assert from "node:assert/strict";
import {safeHistoryUrl,appendSessionHistory} from "../apps/desktop/src/app/browser-history.mjs";

test("support navigation history is bounded and does not log chat or query URLs",()=>{
 let entries=[];
 entries=appendSessionHistory(entries,"workspace-01","main","https://chatgpt.com/c/abc");
 assert.deepEqual(entries,[]);
 entries=appendSessionHistory(entries,"workspace-01","tab-01","https://example.com/a");
 entries=appendSessionHistory(entries,"workspace-01","tab-02","https://example.com/b");
 assert.deepEqual(entries,["https://example.com/b","https://example.com/a"]);
 entries=appendSessionHistory(entries,"workspace-01","tab-01","https://example.com/a");
 assert.deepEqual(entries,["https://example.com/a","https://example.com/b"]);
 for(let i=0;i<30;i++)entries=appendSessionHistory(entries,"workspace-01","tab-01",
  `https://example.com/page-${i}`);
 assert.equal(entries.length,20);
 assert.equal(entries[0],"https://example.com/page-29");
 assert.equal(appendSessionHistory(entries,"workspace-11","tab-01","https://x.org/"),entries);
});
test("history skips potentially sensitive URLs and non-web addresses",()=>{
 for(const url of ["https://chatgpt.com/c/123","https://example.com/?access=abc",
  "https://example.com/path#private","http://example.com/","file:///a",
  "javascript:alert(1)","https://user:pass@example.com/"])
  assert.equal(safeHistoryUrl(url),null);
 assert.equal(safeHistoryUrl("https://github.com/owner/repo"),"https://github.com/owner/repo");
});
