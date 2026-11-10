import assert from "node:assert/strict";
import test from "node:test";
import {resolveBrowserAddress} from "./browser-address.mjs";

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
