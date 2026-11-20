// Parse operator-pasted counts without reading ChatGPT conversations.
// Never label this value as official capacity or confirmed token usage.
const MAX=100_000_000;
export function parseReportedChatTokens(raw){
 if(typeof raw!=="string"||raw.length>160)return null;
 let value=raw.trim();
 const tooltip=/^This chat is about\s+([\d,]+)\s+tokens?\b/i.exec(value);
 if(tooltip)value=tooltip[1];
 else value=value.replace(/^Chat\s*/i,"").replace(/\s+tokens?$/i,"").trim();
 const short=/^~?(\d{1,3}(?:\.\d{1,2})?)\s*([kKmM])$/.exec(value);
 let count;
 if(short){
  count=Math.round(Number(short[1])*(short[2].toLowerCase()==="m"?1_000_000:1_000));
 }else if(/^(?:\d{1,9}|\d{1,3}(?:,\d{3})+)$/.test(value)){
  count=Number(value.replace(/,/g,""));
 }else return null;
 return Number.isSafeInteger(count)&&count>=0&&count<=MAX?count:null;
}
