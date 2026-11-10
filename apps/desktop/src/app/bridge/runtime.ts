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

export type NativeWorkspaceInstance = { workspaceId: string; state: "UNBOUND" };
export async function readNativeWorkspaceInstances(): Promise<NativeWorkspaceInstance[]> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return [];
  try {
    const result = await invoke<NativeWorkspaceInstance[]>("list_workspace_instances");
    if (!Array.isArray(result) || result.length > 10 ||
        result.some(item => !/^[A-Za-z0-9:_-]{1,128}$/.test(item?.workspaceId ?? "") ||
          item.state !== "UNBOUND")) return [];
    return result;
  } catch { return []; }
}
