import {createHash} from 'node:crypto';

// Native stdout/stderr capture is a PROCESS OBSERVATION ONLY, not a provider
// completion receipt, OS sandbox attestation or QA. This strict validator is
// designed for an output object returned by the TRUSTED host runIsolated()
// callback; an MCP/model/renderer payload is never a valid authority.
const RUN=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-f0-9]{32}$/;
const ID=/^[A-Za-z0-9:_-]{1,128}$/;
const SHA=/^[a-f0-9]{64}$/;
const CODE=/^AGENT_IO_[A-Z0-9_]{1,76}$/;
const FIELDS=[
  'source','disposition','reason','runId','dispatchId','sessionId',
  'scopeHash','profileId','processId','candidateTurnId','stdoutSha256',
  'stderrSha256','stdoutBytes','stderrBytes','eventCount','exitCode',
  'qa','nextPromptAllowed'
];
const record=value=>value!==null&&typeof value==='object'&&
  !Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
const exact=(obj,fields)=>record(obj)&&
  Object.keys(obj).length===fields.length&&fields.every(key=>Object.hasOwn(obj,key));

// The order is frozen so independent host implementations can attest the
// digest of a normalized candidate, not a model-supplied JSON string.
export function normalizeNativeIoCandidate(raw,expected) {
  if(!exact(raw,FIELDS)||!record(expected)||
     !['runId','dispatchId','sessionId','scopeHash','profileId'].every(k=>
       typeof expected[k]==='string'&&raw[k]===expected[k])||
     !RUN.test(raw.runId??'')||
     !ID.test(raw.dispatchId??'')||!ID.test(raw.sessionId??'')||
     !SHA.test(raw.scopeHash??'')||raw.profileId!=='opencode-local'||
     raw.source!=='NATIVE_PROCESS_OUTPUT_CAPTURE_ONLY'||
     !['TERMINAL_CANDIDATE','RECONCILE_REQUIRED'].includes(raw.disposition)||
     !CODE.test(raw.reason??'')||
     !Number.isInteger(raw.processId)||raw.processId<=0||
     raw.processId>0xffffffff||
     !(raw.candidateTurnId===null||ID.test(raw.candidateTurnId??''))||
     ![raw.stdoutSha256,raw.stderrSha256].every(x=>SHA.test(x??''))||
     !Number.isInteger(raw.stdoutBytes)||raw.stdoutBytes<0||
     raw.stdoutBytes>1048576||
     !Number.isInteger(raw.stderrBytes)||raw.stderrBytes<0||
     raw.stderrBytes>131072||
     !Number.isInteger(raw.eventCount)||raw.eventCount<0||
     raw.eventCount>512||
     !(raw.exitCode===null||
       (Number.isInteger(raw.exitCode)&&raw.exitCode>=-2147483648&&
        raw.exitCode<=2147483647))||
     raw.qa!=='NOT_EXECUTED'||raw.nextPromptAllowed!==false)
    throw Error('AGENT_NATIVE_IO_CANDIDATE_INVALID');
  if(raw.disposition==='TERMINAL_CANDIDATE' &&
     (raw.reason!=='AGENT_IO_HOST_RECONCILIATION_REQUIRED'||
      raw.exitCode!==0||raw.candidateTurnId===null||
      raw.eventCount===0))
    throw Error('AGENT_NATIVE_IO_TERMINAL_CONFLICT');
  return Object.freeze(Object.fromEntries(FIELDS.map(k=>[k,raw[k]])));
}

export function fingerprintNativeIoCandidate(raw,expected) {
  const c=normalizeNativeIoCandidate(raw,expected);
  return createHash('sha256').update(JSON.stringify([
    'LAZYPROMPTING_NATIVE_IO_CANDIDATE_V1',
    ...FIELDS.map(k=>c[k])
  ])).digest('hex');
}
