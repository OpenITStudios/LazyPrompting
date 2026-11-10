import test from "node:test";
import assert from "node:assert/strict";
import {projectLightpandaStatus,readLightpandaStatus,admitLightpandaOperation,projectLightpandaProbe,probeLightpandaOnce,projectLightpandaDiscovery,discoverLightpandaOnce} from "./lightpanda-host.mjs";
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

test("TCP reachability never implies CDP verification",()=>{const r=projectLightpandaProbe({source:"NATIVE_LIGHTPANDA_HOST",backend:"LIGHTPANDA_CDP",endpointConfigured:true,tcpReachable:true,cdpVerified:false,automationEnabled:false,reason:"TCP_REACHABLE_CDP_UNVERIFIED"});assert.equal(r.tcpReachable,true);assert.equal(r.cdpVerified,false);assert.equal(r.automationEnabled,false)});
test("probe rejects forged CDP verified flag",()=>assert.equal(projectLightpandaProbe({source:"NATIVE_LIGHTPANDA_HOST",backend:"LIGHTPANDA_CDP",endpointConfigured:true,tcpReachable:true,cdpVerified:true,automationEnabled:false}).reason,"INVALID_NATIVE_PROBE"));
test("explicit probe uses fixed native command",async()=>{let cmd;await probeLightpandaOnce(async name=>{cmd=name;return {source:"NATIVE_LIGHTPANDA_HOST",backend:"LIGHTPANDA_CDP",endpointConfigured:false,tcpReachable:false,cdpVerified:false,automationEnabled:false,reason:"NOT_CONFIGURED"}});assert.equal(cmd,"lightpanda_probe")});

test("valid CDP discovery shape never enables automation",()=>{const r=projectLightpandaDiscovery({source:"NATIVE_LIGHTPANDA_HOST",backend:"LIGHTPANDA_CDP",discoveryShapeValid:true,identityVerified:false,websocketConnected:false,automationEnabled:false});assert.equal(r.discoveryShapeValid,true);assert.equal(r.automationEnabled,false)});
test("forged discovery identity is rejected",()=>assert.equal(projectLightpandaDiscovery({source:"NATIVE_LIGHTPANDA_HOST",backend:"LIGHTPANDA_CDP",discoveryShapeValid:true,identityVerified:true,websocketConnected:false,automationEnabled:false}).reason,"INVALID_NATIVE_DISCOVERY"));
test("discovery invokes fixed native command",async()=>{let name;await discoverLightpandaOnce(async command=>{name=command;return null});assert.equal(name,"lightpanda_discover")});
