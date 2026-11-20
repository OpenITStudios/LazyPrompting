import test from "node:test";
import assert from "node:assert/strict";
import {projectBrowserWorkSummary} from "./browser-work-summary.mjs";
test("idle is not an approved/verified result",()=>{const r=projectBrowserWorkSummary();assert.equal(r.kind,"idle");assert.match(r.detail,/not connected/);});
test("uncertain native send outranks draft and page hints",()=>{
 const r=projectBrowserWorkSummary({hasDraft:true,sendStatus:"AMBIGUOUS_HOLD",responseHint:"GENERATING"});
 assert.equal(r.kind,"hold");assert.match(r.detail,/Do not retry/);
 assert.equal(projectBrowserWorkSummary({sendStatus:"UNKNOWN"}).kind,"hold");
});
test("pending operator review takes precedence",()=>{
 assert.equal(projectBrowserWorkSummary({hasDraft:true,sendStatus:"REVIEW_REQUIRED"}).title,"Review original conversation");
 assert.equal(projectBrowserWorkSummary({hasDraft:true,responseHint:"POSSIBLY_COMPLETED"}).title,"Draft ready for review");
});
test("UI hints never claim verified completion",()=>{
 for(const responseHint of ["WAITING","GENERATING","POSSIBLY_COMPLETED","ERROR","UNKNOWN"])
  assert.ok(!/verified|complete|PASS/i.test(projectBrowserWorkSummary({responseHint}).title));
});

test("reported-token stages prioritize proactive recovery without claiming a verified limit",()=>{
 const base={hasSavedChat:true,sendStatus:"NO_PENDING"};
 assert.equal(projectBrowserWorkSummary({...base,chatState:"LONG_CHAT_ADVISORY"}).step,"Prepare");
 assert.match(projectBrowserWorkSummary({...base,chatState:"ROLLOVER_DUE"}).detail,/3.6M/);
 const cap=projectBrowserWorkSummary({...base,chatState:"ESTIMATE_CAP_HOLD",rolloverPrepared:true});
 assert.equal(cap.kind,"hold");
 assert.match(cap.title,/4M/);
 assert.match(cap.detail,/official ChatGPT limits are unknown/);
 assert.equal(projectBrowserWorkSummary({...base,chatState:"FULL_CONFIRMED"}).kind,"hold");
 assert.equal(projectBrowserWorkSummary({...base,chatState:"ACTIVE",rolloverPrepared:true}).step,"Recover");
});
