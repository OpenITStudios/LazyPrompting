import assert from "node:assert/strict";
import test from "node:test";
import {resolveBrowserAddress,isTemporaryChatGptAddress} from "./browser-address.mjs";

test("an address navigates directly and words go to web search",()=>{
 assert.equal(resolveBrowserAddress("chatgpt.com"),"https://chatgpt.com/");
 assert.equal(resolveBrowserAddress("localhost:3000/dev"),"http://localhost:3000/dev");
 const search=new URL(resolveBrowserAddress("how to trim RAM & CPU"));
 assert.equal(search.origin,"https://www.bing.com");
 assert.equal(search.pathname,"/search");
 assert.equal(search.searchParams.get("q"),"how to trim RAM & CPU");
});

test("unsafe protocols and credentials never become search queries",()=>{
 for(const value of ["file:///C:/secret","javascript:alert(1)","https://user:password@example.com/",""]){
  assert.equal(resolveBrowserAddress(value),null);
 }
});


test("ordinary ChatGPT Chat remains navigable but Temporary Chat links are refused",()=>{
 for(const good of [
  "chatgpt.com",
  "https://chatgpt.com/c/12345678-1234-1234-1234-123456789abc",
  "https://chatgpt.com/?model=auto",
 ])assert.ok(resolveBrowserAddress(good)?.startsWith("https://chatgpt.com/"));
 for(const bad of [
  "chatgpt.com/?temporary-chat=true",
  "https://chatgpt.com/?model=auto&Temporary-Chat=false",
  "https://www.chatgpt.com/?temporary_chat=1",
  "https://chat.openai.com/?temporaryChat=true",
  "https://chatgpt.com/?temporary%2Dchat=1",
 ]){
  const full=bad.startsWith("https://")?bad:`https://${bad}`;
  assert.equal(isTemporaryChatGptAddress(full),true);
  assert.equal(resolveBrowserAddress(bad),null);
 }
 assert.equal(isTemporaryChatGptAddress("https://example.com/?temporary-chat=true"),false);
 assert.equal(resolveBrowserAddress("https://example.com/?temporary-chat=true"),"https://example.com/?temporary-chat=true");
});
