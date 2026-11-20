// Focused alias for the canonical preflight. Keep npm's strict script-entrypoint
// parser unchanged; do not duplicate checks, start CI or launch a browser.
if(process.argv.length!==2)throw Error("TARGETED_PREFLIGHT_ARGUMENTS_INVALID");
process.argv.push("--targeted");
await import("./preflight-localtest.mjs");
