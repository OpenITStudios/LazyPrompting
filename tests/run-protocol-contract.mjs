import assert from "node:assert/strict";
import {negotiateProtocol} from "../src/gateway/protocol-contract.mjs";
const input={protocolVersion:"2025-03-26",capabilities:{},clientInfo:{name:"test",version:"1"}};
assert.deepEqual(negotiateProtocol(input),{ok:true,version:"2025-03-26",negotiated:true});
assert.equal(negotiateProtocol({...input,protocolVersion:"2024-01-01"}).negotiated,false);
assert.equal(negotiateProtocol({...input,protocolVersion:"bad"}).ok,false);
assert.equal(negotiateProtocol({...input,clientInfo:null}).ok,false);
console.log("Protocol contract: 4 assertions authored");
