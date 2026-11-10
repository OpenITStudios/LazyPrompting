import {execFile} from "node:child_process";
import {open, rename} from "node:fs/promises";
import {dirname, isAbsolute, join, toNamespacedPath} from "node:path";
import {promisify} from "node:util";

const run = promisify(execFile);
const moveWriteThrough = Buffer.from(`
$ErrorActionPreference = 'Stop'
Add-Type -Namespace LazyPrompting -Name StateFile -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("kernel32.dll", ExactSpelling=true, CharSet=System.Runtime.InteropServices.CharSet.Unicode, SetLastError=true)]
public static extern bool MoveFileExW(string source, string target, uint flags);
'@
if (![LazyPrompting.StateFile]::MoveFileExW($env:LAZY_STATE_SOURCE, $env:LAZY_STATE_TARGET, 9)) {
  throw [System.ComponentModel.Win32Exception]::new([System.Runtime.InteropServices.Marshal]::GetLastWin32Error())
}
`, "utf16le").toString("base64");

// The caller must flush and close the temporary file before publishing it.
export async function publishStateFile(temporary, destination) {
  if (process.platform === "win32") {
    const systemRoot = process.env.SystemRoot;
    if (!systemRoot || !isAbsolute(systemRoot)) throw new Error("WINDOWS_SYSTEM_ROOT_REQUIRED");
    // shortcut: use the system PowerShell for Win32 write-through until the native host owns state publication.
    const powershell = join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    try {
      await run(powershell, ["-NoProfile", "-NonInteractive", "-EncodedCommand", moveWriteThrough], {
        windowsHide: true,
        timeout: 15_000,
        env: {
          SystemRoot: systemRoot,
          TEMP: process.env.TEMP,
          TMP: process.env.TMP,
          LAZY_STATE_SOURCE: toNamespacedPath(temporary),
          LAZY_STATE_TARGET: toNamespacedPath(destination)
        }
      });
    } catch {
      throw new Error("WINDOWS_STATE_PUBLISH_UNCONFIRMED");
    }
    return;
  }

  await rename(temporary, destination);
  const directory = await open(dirname(destination), "r");
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}
