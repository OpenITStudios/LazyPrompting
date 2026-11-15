import {createHash} from "node:crypto";
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
export function projectLightpandaControlIndex(semanticTree,{workspaceId,navigationEpoch=0}={}){
 if(!WS.test(workspaceId??"")||
    !Number.isSafeInteger(navigationEpoch)||navigationEpoch<0||
    typeof semanticTree!=="string"||utf8(semanticTree)>MAX_INPUT)
  throw Error("LIGHTPANDA_CONTROL_INDEX_INVALID");
 const output=[];
 let count=0,truncated=false;
 for(const line of semanticTree.split(/\r?\n/)){
  // Lightpanda's text format uses: 16 [i] link 'Learn more'.
  // The integer is the browser backend ID, not authority to operate.
  const item=/^\s*[0-9]{1,10}\s+\[i\]\s+([a-z][a-z0-9_-]{0,31})\s+(['"])(.*)\2\s*$/i.exec(line);
  if(!item||!ALLOWED.has(item[1].toLowerCase()))continue;
  const label=safeLabel(item[3]);
  if(!label)continue;
  const current=`#${count+1} ${item[1].toLowerCase()} ${JSON.stringify(label)}`;
  if(count===MAX_ITEMS||utf8(output.join("\n")+(output.length?"\n":"")+current)>MAX_BYTES){
   truncated=true;break;
  }
  output.push(current);count++;
 }
 const content=output.length?output.join("\n"):"(no eligible interactive controls)";
 // Correlate only the REDACTED projection with workspace and navigation.
 // Hash is a comparison key, not a native node handle or execution grant.
 const fingerprint=createHash("sha256").update("lightpanda-index-v1\0")
  .update(workspaceId).update("\0").update(String(navigationEpoch))
  .update("\0").update(content).update("\0").update(String(count))
  .update(truncated?"\0truncated":"\0complete").digest("hex");
 return Object.freeze({
  source:"LIGHTPANDA_LOCAL_PREVIEW_CONTROL_INDEX",
  workspaceId,view:"index",content,items:count,truncated,
  fingerprint,unchanged:false,
  readOnly:true,untrustedPageContent:true,
  displayIndexesOnly:true,snapshotLocalRefs:false,
  actionAuthorized:false,nextPromptAllowed:false,
  resultVerified:false,qa:"NOT_EXECUTED"
 });
}
