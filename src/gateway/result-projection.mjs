// Compact machine-readable results. Never duplicate a full JSON payload in text.
const allowedStatuses=new Set(["OK","ERROR"]);
export function projectResult(result,{maxChars=16000}={}){
 if(!Number.isSafeInteger(maxChars)||maxChars<512||maxChars>64000)throw new Error("INVALID_OUTPUT_BUDGET");
 if(!result||!allowedStatuses.has(result.status))return {status:"ERROR",code:"INVALID_RESULT"};
 if(result.status==="ERROR")return {status:"ERROR",code:String(result.code??"UNKNOWN_ERROR").slice(0,160)};
 const content=result.structuredContent;
 if(!content||typeof content!=="object"||Array.isArray(content))return {status:"ERROR",code:"INVALID_STRUCTURED_CONTENT"};
 let json;
 try{json=JSON.stringify(content);}catch{return {status:"ERROR",code:"UNSERIALIZABLE_CONTENT"};}
 if(json.length>maxChars)return {status:"ERROR",code:"RESULT_EXCEEDS_BUDGET"};
 return {status:"OK",structuredContent:content};
}
export function toMcpResult(result){
 const value=projectResult(result);
 return value.status==="ERROR"?
  {isError:true,content:[{type:"text",text:value.code}]}:
  {isError:false,structuredContent:value.structuredContent,content:[{type:"text",text:"Structured result available"}]};
}
