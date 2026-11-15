import {createHmac} from "node:crypto";
// Jev-inspired indexed observation projection for the existing Lightpanda
// LOCAL PREVIEW adapter only. No selector, CDP backend node ID, DOM value,
// action authority, network grant, browser side effect, or model callback.
//
// Lightpanda's LP.getSemanticTree({format:"text",interactiveOnly:true}) is
// an experimental API: the pinned native binary may not support it.
// Display indexes are local to this single read, never executable targets.
const WS=/^workspace-(0[1-9]|10)$/;
const MAX_INPUT=65536;
const MAX_ITEMS=36;
const MAX_BYTES=4096;
const MAX_LABEL=96;
const ALLOWED=new Set(["button","link","checkbox","radio","switch",
 "tab","menuitem","menuitemradio","option","combobox","textbox",
 "searchbox","spinbutton"]);
const REDACT=/password|secret|api[_ -]?key|access[_ -]?token|bearer\s|one[- ]time|otp|private[_ -]?key|credit[_ -]?card/i;
const utf8=x=>Buffer.byteLength(x,"utf8");
function safeLabel(x){
 if(typeof x!=="string")return null;
 const name=Array.from(x.replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim())
  .slice(0,MAX_LABEL).join("");
 if(!name||REDACT.test(name)||
    (name.includes("@")&&name.includes("."))||
    (name.match(/[0-9]/g)?.length??0)>=12)return null;
 return name;
}
export function inspectLightpandaControlIndex(semanticTree,{
 workspaceId,navigationEpoch=0,fingerprintKey
}={}){
 if(!WS.test(workspaceId??"")||
    !Number.isSafeInteger(navigationEpoch)||navigationEpoch<0||
    !Buffer.isBuffer(fingerprintKey)||fingerprintKey.length!==32||
    typeof semanticTree!=="string"||utf8(semanticTree)>MAX_INPUT)
  throw Error("LIGHTPANDA_CONTROL_INDEX_INVALID");
 const output=[];
 const targets=[]; // private, never part of the public snapshot projection
 let count=0,truncated=false;
 const observedIds=new Set();
 // Backend node IDs have small entropy. Use a per-workspace, rotating
 // 256-bit key so the public fingerprint does not reveal them through
 // an offline guessed-ID dictionary. The key never leaves the adapter.
 const identity=createHmac("sha256",fingerprintKey)
  .update("lightpanda-index-v2\0").update(workspaceId)
  .update("\0").update(String(navigationEpoch)).update("\0");
 for(const line of semanticTree.split(/\r?\n/)){
  // Lightpanda's official text form is: 16 [i] link 'Learn more'.
  // The backend ID remains entirely private to this one projection.
  const item=/^\s*([1-9][0-9]{0,9})\s+\[i\]\s+([a-z][a-z0-9_-]{0,31})\s+(['"])(.*)\3\s*$/i.exec(line);
  if(!item)continue;
  const role=item[2].toLowerCase();
  if(!ALLOWED.has(role))continue;
  const backendId=Number(item[1]);
  if(!Number.isSafeInteger(backendId)||backendId>2147483647)
   throw Error("LIGHTPANDA_CONTROL_INDEX_INVALID");
  const label=safeLabel(item[4]);
  if(!label)continue;
  // Reusing one backend ID for two displayed controls makes any future
  // action-target proposal ambiguous; fail before returning a list.
  if(observedIds.has(backendId))
   throw Error("LIGHTPANDA_CONTROL_INDEX_AMBIGUOUS");
  const current=`#${count+1} ${role} ${JSON.stringify(label)}`;
  if(count===MAX_ITEMS||utf8(output.join("\n")+(output.length?"\n":"")+current)>MAX_BYTES){
   truncated=true;break;
  }
  observedIds.add(backendId);
  targets.push(Object.freeze({backendNodeId:backendId,role,label}));
  identity.update(String(backendId)).update("\0").update(role)
   .update("\0").update(label).update("\0");
  output.push(current);count++;
 }
 const content=output.length?output.join("\n"):"(no eligible interactive controls)";
 // Same sanitized labels with replacement backend nodes must not compare
 // as unchanged. The opaque HMAC is a comparison key, not action authority.
 const fingerprint=identity.update(content).update("\0")
  .update(String(count)).update(truncated?"\0truncated":"\0complete")
  .digest("hex");
 const projection=Object.freeze({
  source:"LIGHTPANDA_LOCAL_PREVIEW_CONTROL_INDEX",
  workspaceId,view:"index",content,items:count,truncated,
  fingerprint,unchanged:false,
  readOnly:true,untrustedPageContent:true,
  displayIndexesOnly:true,snapshotLocalRefs:false,
  actionAuthorized:false,nextPromptAllowed:false,
  resultVerified:false,qa:"NOT_EXECUTED"
 });
 return Object.freeze({projection,targets:Object.freeze(targets)});
}
// Public callers receive only the redacted display projection.
export function projectLightpandaControlIndex(tree,options){
 return inspectLightpandaControlIndex(tree,options).projection;
}
const CLICK_ROLES=new Set(["button","link","tab","menuitem",
 "checkbox","radio","switch","option"]);
const TEXT_ROLES=new Set(["textbox","searchbox"]);
export function reviewLightpandaTarget(inspected,{
 expectedFingerprint,displayIndex,operation
}={},nodeDetails){
 if(!inspected||typeof inspected!=="object"||
    !inspected.projection||!Array.isArray(inspected.targets)||
    typeof expectedFingerprint!=="string"||
    !/^[a-f0-9]{64}$/.test(expectedFingerprint)||
    !Number.isSafeInteger(displayIndex)||displayIndex<1||displayIndex>MAX_ITEMS||
    !["CLICK","TYPE_TEXT"].includes(operation))
  throw Error("LIGHTPANDA_REVIEW_INVALID");
 const projection=inspected.projection;
 // One review has to observe exactly one untruncated page snapshot. There
 // are no action refs or grants in this result, even for an exact match.
 if(projection.truncated)throw Error("LIGHTPANDA_INDEX_TRUNCATED");
 if(projection.fingerprint!==expectedFingerprint)
  throw Error("LIGHTPANDA_REVIEW_STALE");
 const target=inspected.targets[displayIndex-1];
 if(!target)throw Error("LIGHTPANDA_REVIEW_TARGET_NOT_FOUND");
 const roles=operation==="CLICK"?CLICK_ROLES:TEXT_ROLES;
 if(!roles.has(target.role))throw Error("LIGHTPANDA_REVIEW_ROLE_DENIED");
 if(!nodeDetails||typeof nodeDetails!=="object"||
    nodeDetails.backendNodeId!==target.backendNodeId||
    nodeDetails.role!==target.role||
    nodeDetails.name!==target.label||
    nodeDetails.isInteractive!==true)
  throw Error("LIGHTPANDA_REVIEW_TARGET_CHANGED");
 // Password, file and other privileged input types can never be
 // proposed as text targets; no field values or selectors are exposed.
 if(operation==="TYPE_TEXT"&&
    ![undefined,"text","search"].includes(nodeDetails.inputType))
  throw Error("LIGHTPANDA_REVIEW_INPUT_TYPE_DENIED");
 return Object.freeze({
  source:"LIGHTPANDA_LOCAL_PREVIEW_TARGET_REVIEW",
  workspaceId:projection.workspaceId,
  fingerprint:projection.fingerprint,displayIndex,operation,
  role:target.role,label:target.label,
  status:"NATIVE_ACTION_GRANT_REQUIRED",
  readOnly:true,untrustedPageContent:true,actionAuthorized:false,
  nextPromptAllowed:false,resultVerified:false,qa:"NOT_EXECUTED"
 });
}
