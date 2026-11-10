export type SchedulerLifecycle={generation:number;phase:"UNAVAILABLE"|"CHECKING";reason:string;revision:null};
export function initialSchedulerLifecycle():SchedulerLifecycle;
export function beginSchedulerRead(state:SchedulerLifecycle):{state:SchedulerLifecycle;token:number};
export function settleSchedulerRead(state:SchedulerLifecycle,token:number,host:unknown):{applied:boolean;state:SchedulerLifecycle;reason:string|null};
export function disconnectScheduler(state:SchedulerLifecycle):SchedulerLifecycle;
