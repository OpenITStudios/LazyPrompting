// Benchmark input validation only. Never invents measurements or starts a browser.
const CASES=[1,4,10];
export function evaluateBrowserBenchmarks(samples){
 if(!Array.isArray(samples))return {complete:false,reason:"NO_SAMPLES"};
 const missing=CASES.filter(n=>!samples.some(x=>x?.workspaces===n));
 if(missing.length)return {complete:false,reason:"MISSING_WORKSPACE_CASES",missing};
 const seen=new Set();
 for(const s of samples){
  if(!CASES.includes(s?.workspaces)||seen.has(s.workspaces))return {complete:false,reason:"DUPLICATE_OR_UNKNOWN_CASE"};
  seen.add(s.workspaces);
  if(s.source!=="NATIVE_OBSERVATION"||!s.verified||!Number.isFinite(s.ramMb)||s.ramMb<0||
    !Number.isFinite(s.cpuPercent)||s.cpuPercent<0||s.cpuPercent>100||
    !Number.isFinite(s.switchMs)||s.switchMs<0||
    typeof s.platform!=="string"||!s.platform.trim()||
    typeof s.runtimeVersion!=="string"||!s.runtimeVersion.trim())
   return {complete:false,reason:"UNVERIFIED_OR_INVALID_METRICS"};
 }
 return {complete:true,reason:"MEASUREMENTS_PRESENT_NOT_PERFORMANCE_APPROVED",samples:samples.map(x=>({...x}))};
}
