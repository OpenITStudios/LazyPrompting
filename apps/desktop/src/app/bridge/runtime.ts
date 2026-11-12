import { invoke } from "@tauri-apps/api/core";

export type RuntimeStatus = {
  mode: "SOURCE_FOUNDATION";
  maxWorkspaces: number;
  activeBrowserInstances: number;
  transportConnected: boolean;
  automationEnabled: boolean;
};

const FALLBACK: RuntimeStatus = Object.freeze({
  mode: "SOURCE_FOUNDATION",
  maxWorkspaces: 10,
  activeBrowserInstances: 0,
  transportConnected: false,
  automationEnabled: false
});

export async function readRuntimeStatus(): Promise<RuntimeStatus> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return FALLBACK;
  try {
    const value = await invoke<RuntimeStatus>("runtime_status");
    if (value?.mode !== "SOURCE_FOUNDATION" || value.transportConnected !== false ||
        value.automationEnabled !== false || value.activeBrowserInstances !== 0 ||
        value.maxWorkspaces !== 10) return FALLBACK;
    return value;
  } catch {
    return FALLBACK;
  }
}

export type WebviewProviderStatus = {
  candidate: "SYSTEM_WEBVIEW";
  os: string;
  configured: false;
  runtimeObserved: boolean;
  runtimeUsableVerified: false;
  runtimeVersion: string | null;
  discoverySource: string;
  sharedLoginVerified: false;
  tabIdentityVerified: false;
  browserInstallAuthorized: false;
  navigationEnabled: false;
  automationEnabled: false;
};
export async function readWebviewProviderStatus(): Promise<WebviewProviderStatus | null> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return null;
  try {
    const x=await invoke<WebviewProviderStatus>("webview_provider_status");
    if (x?.candidate!=="SYSTEM_WEBVIEW" || typeof x.os!=="string" ||
      x.configured!==false || x.runtimeUsableVerified!==false || typeof x.runtimeObserved!=="boolean" ||
      !(x.runtimeVersion===null || (typeof x.runtimeVersion==="string" && /^\d+(\.\d+)+$/.test(x.runtimeVersion))) ||
      !["WINDOWS_REGISTRY_READ_ONLY","NOT_IMPLEMENTED"].includes(x.discoverySource) ||
      x.runtimeObserved!==(x.runtimeVersion!==null) ||
      x.sharedLoginVerified!==false || x.tabIdentityVerified!==false ||
      x.browserInstallAuthorized!==false || x.navigationEnabled!==false ||
      x.automationEnabled!==false) return null;
    return x;
  } catch { return null; }
}

export type SchedulerHostStatus = {
  source: "NATIVE_HOST";
  connected: false;
  authenticated: false;
  snapshot: null;
  reason: "TRUSTED_SCHEDULER_NOT_CONFIGURED";
};
const SCHEDULER_UNAVAILABLE: SchedulerHostStatus = Object.freeze({
  source: "NATIVE_HOST",
  connected: false,
  authenticated: false,
  snapshot: null,
  reason: "TRUSTED_SCHEDULER_NOT_CONFIGURED"
});
export async function readSchedulerHostStatus(): Promise<SchedulerHostStatus> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return SCHEDULER_UNAVAILABLE;
  try {
    const x=await invoke<SchedulerHostStatus>("scheduler_host_status");
    if (x?.source !== "NATIVE_HOST" || x.connected !== false ||
        x.authenticated !== false || x.snapshot !== null ||
        x.reason !== "TRUSTED_SCHEDULER_NOT_CONFIGURED") return SCHEDULER_UNAVAILABLE;
    return x;
  } catch { return SCHEDULER_UNAVAILABLE; }
}

export type AgentWorkerProfileStatus = {
  profileId: "codex-local" | "opencode-local";
  adapterId: "codex-app-server" | "opencode-v2";
  source: "NATIVE_HOST_READ_ONLY";
  configured: boolean;
  executableSha256: string | null;
  executionReady: false;
  reason: string;
};

// This is a read-only installed-binary inventory. It never activates a worker.
export async function readAgentWorkerProfiles(): Promise<AgentWorkerProfileStatus[]> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return [];
  try {
    const results = await invoke<AgentWorkerProfileStatus[]>("list_agent_worker_profiles");
    if (!Array.isArray(results) || results.length !== 2) return [];
    const expected = [
      ["codex-local", "codex-app-server"],
      ["opencode-local", "opencode-v2"]
    ];
    if (results.some((x, index) =>
      x?.profileId !== expected[index][0] ||
      x.adapterId !== expected[index][1] ||
      x.source !== "NATIVE_HOST_READ_ONLY" ||
      typeof x.configured !== "boolean" ||
      x.executionReady !== false ||
      typeof x.reason !== "string" ||
      !(x.executableSha256 === null ||
        (typeof x.executableSha256 === "string" && /^[a-f0-9]{64}$/.test(x.executableSha256)))
    )) return [];
    return results;
  } catch {
    return [];
  }
}

export type AgentGatewayStatus = {
  schemaVersion: 2;
  source: "NATIVE_GATEWAY";
  configured: boolean;
  readOnly: true;
  workerExecutionReady: false;
  fourPublicMcpToolsUnchanged: true;
};

// Query the actual authenticated native-to-gateway status without launching
// a worker, approving a goal or interpreting source support as readiness.
export async function readAgentGatewayStatus(): Promise<AgentGatewayStatus | null> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return null;
  try {
    const status=await invoke<AgentGatewayStatus>("agent_gateway_status");
    if (status?.schemaVersion!==2 || status.source!=="NATIVE_GATEWAY" ||
        typeof status.configured!=="boolean" || status.readOnly!==true ||
        status.workerExecutionReady!==false ||
        status.fourPublicMcpToolsUnchanged!==true) return null;
    return status;
  } catch {
    return null;
  }
}
