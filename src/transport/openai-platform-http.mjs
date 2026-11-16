// Official OpenAI Platform REST only. No consumer ChatGPT access,
// proxy, browser cookie, private endpoint, SDK retry or raw-error logs.
// OPENAI_API_KEY is read only inside the authenticated local gateway.
const BASE="https://api.openai.com/v1/";
const RESPONSE=/^resp_[A-Za-z0-9_-]{1,128}$/;
const KEY=/^[\x21-\x7e]{20,512}$/;
const MAX_BYTES=1024*1024;

export function createOpenAIPlatformClient({
 apiKey,fetchImpl=fetch,timeoutMs=90000
}={}){
 if(typeof apiKey!=="string"||!KEY.test(apiKey)||
    typeof fetchImpl!=="function"||
    !Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>120000)
  throw Error("OPENAI_API_KEY_OR_CLIENT_UNAVAILABLE");
 async function request(method,path,body,{signal}={}){
  if(signal?.aborted)throw Error("OPENAI_REQUEST_CANCELLED");
  const ctl=new AbortController();
  const onAbort=()=>ctl.abort();
  signal?.addEventListener("abort",onAbort,{once:true});
  const timer=setTimeout(()=>ctl.abort(),timeoutMs);
  try{
   let response;
   try{
    response=await fetchImpl(BASE+path,{
    method,redirect:"error",cache:"no-store",
    headers:{"Authorization":"Bearer "+apiKey,
     "Content-Type":"application/json"},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
    signal:ctl.signal
   });
   }catch{
    // Transport interruption does not imply OpenAI never received it.
    throw Error(signal?.aborted?"OPENAI_REQUEST_CANCELLED":
      "OPENAI_API_TRANSPORT_UNCERTAIN");
   }
  if(!response.ok)
   throw Error("OPENAI_API_HTTP_"+(Number(response.status)||0));
  const len=Number(response.headers?.get?.("content-length"));
  if(Number.isFinite(len)&&len>MAX_BYTES)throw Error("OPENAI_API_RESPONSE_TOO_LARGE");
  let text;
  try{text=await response.text();}
  catch{throw Error("OPENAI_API_RESPONSE_UNCERTAIN");}
  if(typeof text!=="string"||
     Buffer.byteLength(text,"utf8")>MAX_BYTES)
   throw Error("OPENAI_API_RESPONSE_TOO_LARGE");
  let value;
  try{value=JSON.parse(text);}
  catch{throw Error("OPENAI_API_RESPONSE_UNVERIFIED");}
  if(!value||typeof value!=="object"||Array.isArray(value))
   throw Error("OPENAI_API_RESPONSE_UNVERIFIED");
  return value;
  }finally{
   clearTimeout(timer);
   signal?.removeEventListener("abort",onAbort);
  }
 }
 return {
  conversations:{create:()=>request("POST","conversations",{})},
  responses:{
   create:(input,options)=>request("POST","responses",input,options),
   retrieve:(id,options)=>{
    if(!RESPONSE.test(id??""))throw Error("OPENAI_RESPONSE_ID_INVALID");
    return request("GET","responses/"+id,undefined,options);
   }
  }
 };
}
