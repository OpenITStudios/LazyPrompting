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
      x.configured!==false || typeof x.runtimeObserved!=="boolean" ||
      !(x.runtimeVersion===null || (typeof x.runtimeVersion==="string" && /^\d+(\.\d+)+$/.test(x.runtimeVersion))) ||
      !["WINDOWS_REGISTRY_READ_ONLY","NOT_IMPLEMENTED"].includes(x.discoverySource) ||
      x.runtimeObserved!==(x.runtimeVersion!==null) ||
      x.sharedLoginVerified!==false || x.tabIdentityVerified!==false ||
      x.browserInstallAuthorized!==false || x.navigationEnabled!==false ||
      x.automationEnabled!==false) return null;
    return x;
  } catch { return null; }
}
