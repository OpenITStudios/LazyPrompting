import assert from "node:assert/strict";
import {LocalBrowserAdapter} from "../src/browser/playwright-adapter.mjs";
const adapter=new LocalBrowserAdapter();
for(const url of ["https://chatgpt.com","https://example.com","file:///etc/passwd","http://127.0.0.1:3000@evil.com/"]){
  assert.throws(()=>adapter.assertAllowed(url));
}
assert.equal(adapter.assertAllowed("http://localhost/"),"http://localhost/");
assert.equal(adapter.assertAllowed("http://127.0.0.1/"),"http://127.0.0.1/");
console.log("Browser origin contract: 6/6 passed (no browser launched)");
