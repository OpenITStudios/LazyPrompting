# WebView2 source QA and native verification gate — 2026-11-10

## Concrete defects corrected
- The Rust status test previously asserted runtime_observed=false even when a valid installed Windows runtime would set it true. It now checks the invariant against runtime_version and does not depend on the test host installation.
- The frontend version validation previously used an incorrectly escaped regular expression and could reject valid version strings. The parser now accepts dotted numeric versions and enforces consistency with runtime_observed.
- Browser Manager wording incorrectly described isolated browser profiles. It now reflects one shared browser profile and logically separate conversations.

## Native verification matrix — not executed
1. Windows without WebView2 runtime: expect runtimeObserved=false and runtimeVersion=null, no launch.
2. Windows with a valid runtime: verify official runtime API and registry views against OS architecture and user/machine install. Registry is advisory only.
3. Windows with malformed/zero version: reject; do not infer browser capability.
4. macOS/Linux: return NOT_IMPLEMENTED; never infer WebView2 availability.
5. Frontend bridge: valid dotted version accepted; malformed/mismatched source rejected; status remains fail-closed.
6. Rust build and Tauri frontend build, plus Windows launch, require separately authorized test execution.
7. Only after verified platform evidence and user authorization: manual shared-login test, logout/restart recovery and 1/4/10 workspace benchmarks.

## Remaining risk
Registry path, product GUID, registry view and Windows runtime behavior are unverified in this source-only review. A browser process is not created. ChatGPT existing-session automation remains blocked by transport policy. No test PASS or compatibility claim is made.
