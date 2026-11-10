import test from "node:test";
import assert from "node:assert/strict";
import {projectLightpandaStatus,readLightpandaStatus,admitLightpandaOperation} from "./lightpanda-host.mjs";
const base={source:"NATIVE_LIGHTPANDA_HOST",backend:"LIGHTPANDA_CDP",connected:false,verified:false,automationEnabled:false,endpointConfigured:false,reason:"NOT_CONFIGURED"};
test("native not-configured state stays offline",()=>assert.equal(projectLightpandaStatus(base).connected,false));
test("forged connected status fails closed",()=>assert.equal(projectLightpandaStatus({...base,connected:true}).reason,"UNVERIFIED_RUNTIME_CLAIM"));
test("invalid source rejected",()=>assert.equal(projectLightpandaStatus({...base,source:"RENDERER"}).reason,"UNTRUSTED_HOST_STATUS"));
test("read invokes only fixed status command",async()=>{let cmd;await readLightpandaStatus(async name=>{cmd=name;return base});assert.equal(cmd,"lightpanda_host_status")});
test("host failure stays disconnected",async()=>assert.equal((await readLightpandaStatus(async()=>{throw Error("down")})).connected,false));
test("all ten workspaces cannot automate without native admission",()=>{for(let i=1;i<=10;i++){const workspaceId=`workspace-${String(i).padStart(2,"0")}`;assert.equal(admitLightpandaOperation({workspaceId,operatorApproved:true,transportVerified:true,scopeVerified:true,complianceVerified:true}).reason,"NATIVE_ADMISSION_REQUIRED")}});
test("no approval denies operation",()=>assert.equal(admitLightpandaOperation({workspaceId:"workspace-01"}).reason,"OPERATOR_APPROVAL_REQUIRED"));

test("configured endpoint does not imply connected",()=>{const r=projectLightpandaStatus({...base,endpointConfigured:true,reason:"ENDPOINT_CONFIGURED_NOT_CONNECTED"});assert.equal(r.endpointConfigured,true);assert.equal(r.connected,false);assert.equal(r.automationEnabled,false)});
test("missing native configuration field is rejected",()=>{const {endpointConfigured,...raw}=base;assert.equal(projectLightpandaStatus(raw).reason,"UNTRUSTED_HOST_STATUS")});
