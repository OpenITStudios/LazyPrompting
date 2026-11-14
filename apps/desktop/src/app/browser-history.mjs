// App-session navigation history only. Never read ChatGPT content or persist
// arbitrary browsing URLs to disk. The native browser owns real navigation.
const WORKSPACE=/^workspace-(0[1-9]|10)$/;
export function safeHistoryUrl(value){
 try{
  if(typeof value!=="string"||value.length>2048)return null;
  const u=new URL(value);
  if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash)return null;
  if(["chatgpt.com","www.chatgpt.com","chat.openai.com"].includes(u.hostname))return null;
  return u.href;
 }catch{return null}
}
export function appendSessionHistory(entries,workspaceId,tabId,url){
 if(!WORKSPACE.test(workspaceId??"")||!/^tab-0[1-3]$/.test(tabId??""))return entries??[];
 const clean=safeHistoryUrl(url);
 if(!clean)return entries??[];
 const list=Array.isArray(entries)?entries:[];
 if(list[0]===clean)return list;
 return [clean,...list.filter(x=>x!==clean)].slice(0,20);
}
