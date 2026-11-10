import { invoke } from "@tauri-apps/api/core";
export type SharedProfileView={workspaceId:string;conversationId:string;selected:boolean;pending:boolean};
export async function readSharedProfileViews():Promise<SharedProfileView[]>{
 if(typeof window==="undefined"||!("__TAURI_INTERNALS__" in window))return [];
 try{
  const items=await invoke<SharedProfileView[]>("list_shared_profile_views");
  if(!Array.isArray(items)||items.length>10||items.some(x=>
   !/^[A-Za-z0-9:_-]{1,128}$/.test(x?.workspaceId??"")||
   !/^[A-Za-z0-9:_-]{1,128}$/.test(x?.conversationId??"")||
   typeof x.selected!=="boolean"||typeof x.pending!=="boolean")||
   items.filter(x=>x.selected).length>1)return [];
  return items;
 }catch{return [];}
}
