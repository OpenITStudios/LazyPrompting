import assert from "node:assert/strict";
import {assessWebViewPreflight,WEBVIEW_PREFLIGHT_CHECKS} from "../apps/desktop/src/webview-preflight.mjs";
const attestation={providerId:"webview2",trustedSource:true,platform:"windows",reviewedByOperator:true};
const observations={providerId:"webview2",platform:"windows",verified:true,
 ...Object.fromEntries(WEBVIEW_PREFLIGHT_CHECKS.map(k=>[k,true]))};
assert.equal(assessWebViewPreflight({platform:"windows",observations,attestation}).ready,false);
assert.equal(assessWebViewPreflight({platform:"windows",observations,attestation}).reviewComplete,true);
assert.equal(assessWebViewPreflight({platform:"windows",observations:{...observations,manualLoginSupported:false},attestation}).ready,false);
assert.equal(assessWebViewPreflight({platform:"windows",observations,attestation:{...attestation,trustedSource:false}}).ready,false);
assert.equal(assessWebViewPreflight({platform:"windows",observations:{...observations,readsBrowserCredentials:true},attestation}).ready,false);
console.log("WebView preflight cases authored; NOT_EXECUTED");
