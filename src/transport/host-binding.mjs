// Official-host binding boundary. No undocumented Codex endpoints are assumed.
// A deployment must supply a reviewed, authenticated implementation of this contract.
export function createHostBinding({probe,connect,disconnect,verifyGrant,verifyReceipt,readCurrentHead}={}){
 const names={probe,connect,disconnect,verifyGrant,verifyReceipt,readCurrentHead};
 for(const [name,fn] of Object.entries(names)){
  if(typeof fn!=="function")throw new Error("HOST_BINDING_MISSING_"+name);
 }
 return Object.freeze({...names});
}
export function verifyHostReceipt(receipt,{goalId,taskId,repository,branch,headSha}){
 if(!receipt||typeof receipt!=="object"||receipt.trusted!==true||
    receipt.goalId!==goalId||receipt.taskId!==taskId||
    receipt.repository!==repository||receipt.branch!==branch||receipt.headSha!==headSha)
  return {accepted:false,reason:"HOST_RECEIPT_MISMATCH"};
 if(!/^[A-Za-z0-9:_-]{1,128}$/.test(receipt.receiptId??""))
  return {accepted:false,reason:"INVALID_RECEIPT_ID"};
 return {accepted:true,reason:"RECEIPT_FIELDS_MATCH"};
}
