// Local UI controller: no browser, network, storage or MCP transport.
const ID=/^workspace-(0[1-9]|10)$/;
export function createWorkspaceState(){
 return {revision:0,selectedId:"workspace-01",mode:"compact",filter:"",focus:false,
  workspaces:Array.from({length:10},(_,i)=>({id:`workspace-${String(i+1).padStart(2,"0")}`,name:`ChatGPT ${String(i+1).padStart(2,"0")}`,connection:"NOT_CONNECTED",activity:"UNKNOWN",setupConfirmed:false}))};
}
export function applyWorkspaceAction(state,action){
 const reject=reason=>({status:"REJECTED",reason,state});
 if(!state||!Array.isArray(state.workspaces)||!action||typeof action!=="object")return reject("INVALID_INPUT");
 if(!Number.isSafeInteger(action.expectedRevision)||action.expectedRevision!==state.revision)return reject("STALE_REVISION");
 const next={...state,workspaces:state.workspaces};
 const workspace=state.workspaces.find(w=>w.id===action.workspaceId);
 switch(action.type){
  case "SELECT":
   if(!workspace)return reject("UNKNOWN_WORKSPACE");
   next.selectedId=workspace.id;break;
  case "RENAME":
   if(!workspace||typeof action.name!=="string")return reject("INVALID_RENAME");
   {const name=action.name.trim();if(!name||name.length>80||/[\u0000-\u001f\u007f]/.test(name))return reject("INVALID_NAME");
    next.workspaces=state.workspaces.map(w=>w.id===workspace.id?{...w,name}:w);}
   break;
  case "SET_PROJECT_NAME":
   if(!workspace||typeof action.projectName!=="string")return reject("INVALID_PROJECT_NAME");
   {const project=action.projectName.trim();if(!project||project.length>60||/[\\u0000-\\u001f\\u007f]/.test(project))return reject("INVALID_PROJECT_NAME");
    const slot=workspace.id.slice(-2);next.workspaces=state.workspaces.map(w=>w.id===workspace.id?{...w,name:`ChatGPT ${slot} - ${project}`}:w);}
   break;
  case "CONFIRM_SETUP":
   if(!workspace||typeof action.confirmed!=="boolean")return reject("INVALID_SETUP_CONFIRMATION");
   next.workspaces=state.workspaces.map(w=>w.id===workspace.id?{...w,setupConfirmed:action.confirmed}:w);
   break;
  case "VIEW_MODE":
   if(!["compact","grid"].includes(action.mode))return reject("INVALID_VIEW_MODE");
   next.mode=action.mode;break;
  case "FILTER":
   if(typeof action.filter!=="string"||action.filter.length>120)return reject("INVALID_FILTER");
   next.filter=action.filter;break;
  case "FOCUS":
   if(typeof action.focus!=="boolean")return reject("INVALID_FOCUS");
   next.focus=action.focus;break;
  default:return reject("UNSUPPORTED_ACTION");
 }
 next.revision=state.revision+1;
 return {status:"APPLIED",reason:null,state:next};
}
export function listVisibleWorkspaces(state){
 const q=state.filter.trim().toLocaleLowerCase();
 return state.workspaces.filter(w=>w.name.toLocaleLowerCase().includes(q)||w.id.includes(q));
}
export function readWorkspaceState(state){
 return {revision:state.revision,selectedId:state.selectedId,mode:state.mode,filter:state.filter,focus:state.focus,
 workspaces:state.workspaces.map(w=>({...w}))};
}
