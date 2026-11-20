import { spawn } from 'node:child_process';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// DOM/WebDriver key events do not reach the native global keyboard hook.
export async function pressF24(): Promise<void> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await pressF24Once();
      return;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < MAX_RETRIES) {
        console.warn(`pressF24 attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS}ms: ${lastError.message}`);
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw lastError;
}

function pressF24Once(): Promise<void> {
  const script = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class HotkeyTestInput {
  [StructLayout(LayoutKind.Explicit, Size = 40)]
  public struct INPUT {
    [FieldOffset(0)] public uint type;
    [FieldOffset(8)] public ushort key;
    [FieldOffset(12)] public uint flags;
  }
  [DllImport("user32.dll", SetLastError = true)]
  public static extern uint SendInput(uint count, INPUT[] inputs, int size);
  public static void Send(bool up) {
    var input = new INPUT { type = 1, key = 0x87, flags = up ? 2u : 0u };
    if (SendInput(1, new[] { input }, 40) != 1)
      throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
  }
}
'@
try {
  [HotkeyTestInput]::Send($true)
  Start-Sleep -Milliseconds 200
  [HotkeyTestInput]::Send($false)
  Start-Sleep -Milliseconds 200
} finally {
  [HotkeyTestInput]::Send($true)
}
`;
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    throw new Error('Native key input requires an interactive Windows x64 desktop');
  }
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 10000,
    });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    child.once('error', reject);
    child.once('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`SendInput failed (${code}): ${output}`));
    });
  });
}
