import assert from "node:assert/strict";
import {prepareChatContinuation} from "../src/prompt/chat-continuation.mjs";
const x=prepareChatContinuation({workspaceId:"w1",oldSessionId:"s1",taskId:"t1",goal:"Build app",nextAction:"Continue implementation",projectHint:"OpenITStudios/LazyPrompting"});
assert.equal(x.ready,true);
assert.match(x.prompt,/ChatGPT owns any GitHub work/);
assert.equal(prepareChatContinuation({workspaceId:"w1",oldSessionId:"s1",taskId:"t1",goal:"Build app",nextAction:"Continue",pendingPrompt:true}).ready,false);
console.log("Chat-only continuation assertions authored, NOT_EXECUTED");
