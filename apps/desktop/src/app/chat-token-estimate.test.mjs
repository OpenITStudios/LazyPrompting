import test from "node:test";
import assert from "node:assert/strict";
import {parseReportedChatTokens as parse} from "./chat-token-estimate.mjs";

test("operator estimate parses counts and compact labels, never an official capacity",()=>{
 for(const [s,n] of [
  ["0",0],["1130000",1130000],["4,441,883",4441883],
  ["Chat ~4.44M",4440000],["~4.44M tokens",4440000],
  ["This chat is about 4,441,883 tokens — roughly what ChatGPT re-reads with each new message here.",4441883],
  ["3.6M",3600000],["100M",100000000]
 ])assert.equal(parse(s),n,s);
 for(const s of ["","4.444M","4,44,1883","4M and something","ChatGPT 4M",
  "101M","1e7","0x40","-1","This chat is about 4M tokens",
  "4.4M / confirmed","4".repeat(161),null,{},4441883])
  assert.equal(parse(s),null,String(s));
});
