export type SchedulerView={verified:boolean;reason:string|null;activeCount:number|null;byId:Record<string,{status:string;pending:boolean}>};
export function projectSchedulerStatus(snapshot:unknown,workspaceIds:string[]):SchedulerView;
