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
