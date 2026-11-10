export type Workspace={id:string;name:string;connection:"NOT_CONNECTED";activity:"UNKNOWN";setupConfirmed:boolean};
export type WorkspaceState={revision:number;selectedId:string;mode:"compact"|"grid";filter:string;focus:boolean;workspaces:Workspace[]};
export type WorkspaceAction={type:string;expectedRevision:number;workspaceId?:string;name?:string;mode?:string;filter?:string;focus?:boolean;confirmed?:boolean};
export function createWorkspaceState():WorkspaceState;
export function applyWorkspaceAction(state:WorkspaceState,action:WorkspaceAction):{status:"APPLIED"|"REJECTED";reason:string|null;state:WorkspaceState};
export function listVisibleWorkspaces(state:WorkspaceState):Workspace[];
export function readWorkspaceState(state:WorkspaceState):WorkspaceState;
