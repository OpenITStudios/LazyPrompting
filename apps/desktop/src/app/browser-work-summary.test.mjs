import test from "node:test";
import assert from "node:assert/strict";
import {projectBrowserWorkSummary,projectIntegratedWorkSignals} from "./browser-work-summary.mjs";
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

test("plugin outcome cannot bypass native send/continuation holds",()=>{
 const uncertain=projectBrowserWorkSummary({
  hasSavedChat:true,sendStatus:"NO_PENDING",pluginStatus:"RECONCILE_REQUIRED",
  responseHint:"POSSIBLY_COMPLETED"
 });
 assert.equal(uncertain.kind,"hold");
 assert.match(uncertain.detail,/Do not retry/);
 assert.equal(projectBrowserWorkSummary({
  sendStatus:"AMBIGUOUS_HOLD",pluginStatus:"RECONCILE_REQUIRED"
 }).title,"Recovery required");
 const binding=projectBrowserWorkSummary({pluginStatus:"AWAITING_VERIFIED_BINDING"});
 assert.equal(binding.kind,"review");
 assert.equal(projectBrowserWorkSummary({pluginStatus:"NO_PENDING"}).kind,"idle");
});
test("one source-owned read-only overview for plugin and app-wide Codex statuses",()=>{
 const missing=projectIntegratedWorkSignals();
 assert.equal(missing.visible,false);
 assert.equal(missing.nextPromptAllowed,false);
 const status=projectIntegratedWorkSignals({
  pluginStatus:"RECONCILE_REQUIRED",codexStatus:"AVAILABLE",
  codexRuns:[{state:"RUNNING"}],codexTruncated:false
 });
 assert.equal(status.visible,true);
 assert.match(status.label,/Plugin: review required/);
 assert.match(status.label,/1 app-wide run/);
 assert.equal(status.chatBound,false);
 assert.equal(status.deliveryVerified,false);
 assert.equal(status.resultVerified,false);
 assert.equal(status.qa,"NOT_VERIFIED");
 for(const plugin of ["NO_PENDING","UNAVAILABLE","NOT_CHECKED"]){
  const result=projectIntegratedWorkSignals({pluginStatus:plugin,codexStatus:"UNAVAILABLE"});
  assert.equal(result.nextPromptAllowed,false);
  assert.equal(result.chatBound,false);
 }
 const invalid=projectIntegratedWorkSignals({pluginStatus:"NATIVE_APPROVED",codexStatus:"AVAILABLE"});
 assert.match(invalid.label,/unavailable/);
 assert.equal(invalid.nextPromptAllowed,false);
});
