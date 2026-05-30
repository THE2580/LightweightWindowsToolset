import { ipcMain, BrowserWindow } from 'electron'
import { execFile } from 'child_process'
import { writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// ── Types ──

interface PinnedWindow {
  hwnd: number
  processName: string
  windowTitle: string
  pinnedAt: number // timestamp
  borderColor: string
}

interface WindowRect {
  left: number
  top: number
  right: number
  bottom: number
}

interface ForegroundInfo {
  hwnd: number
  processName: string
  windowTitle: string
  isDesktop: boolean
  rect: WindowRect | null
}

// ── State ──

const pinnedWindows = new Map<number, PinnedWindow>()
const borderOverlays = new Map<number, BrowserWindow>()
const missingRectRetries = new Map<number, number>() // hwnd → retry count
let pollTimer: ReturnType<typeof setInterval> | null = null
let currentBorderColor = '#2563EB'
const DEFAULT_BORDER_WIDTH = 3
const MAX_RETRIES = 2 // number of consecutive null rects before unpinning

// ── PowerShell helpers ──

/** Execute a PowerShell script via a temp file. Returns stdout or null on error. */
function execPowerShell(script: string, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'lwt-'))
    const psPath = join(tmpDir, 's.ps1')
    writeFileSync(psPath, script, 'utf-8')

    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psPath],
      { timeout: timeoutMs, windowsHide: true },
      (err, stdout) => {
        try { unlinkSync(psPath) } catch { /* ok */ }
        try { rmdirSync(tmpDir) } catch { /* ok */ }
        if (err || !stdout) { resolve(null); return }
        resolve(stdout.trim())
      }
    )
  })
}

/** Extract a JSON object from PS output (may contain noise). */
function extractJson<T>(raw: string): T | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < 0) return null
  try { return JSON.parse(raw.substring(start, end + 1)) } catch { return null }
}

function getForegroundWindowInfo(): Promise<ForegroundInfo> {
  const script = `
$cs = @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public struct RECT {
    public int Left; public int Top; public int Right; public int Bottom;
}

public class Win32Pin {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")]
    public static extern IntPtr GetDesktopWindow();
    [DllImport("user32.dll")]
    public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
}
"@
Add-Type -TypeDefinition $cs *> $null

$hwnd = [Win32Pin]::GetForegroundWindow()
if ($hwnd -eq [IntPtr]::Zero) {
  Write-Output '{"hwnd":0,"processName":"","windowTitle":"","isDesktop":true,"rect":null}'
  exit 0
}

$procId = 0
[Win32Pin]::GetWindowThreadProcessId($hwnd, [ref]$procId)
$pn = try { (Get-Process -Id $procId -ErrorAction Stop).ProcessName } catch { "unknown" }

$sb = New-Object System.Text.StringBuilder(256)
[Win32Pin]::GetWindowText($hwnd, $sb, 256)
$windowTitle = $sb.ToString()

$desktopHwnd = [Win32Pin]::GetDesktopWindow()
$isDesktop = ($hwnd -eq $desktopHwnd) -or
             ($pn -eq "explorer") -or
             ($pn -eq "Progman") -or
             ($pn -eq "ShellExperienceHost")

if ($isDesktop) {
  @{hwnd=[int64]$hwnd; processName=$pn; windowTitle=''; isDesktop=$true; rect=$null} | ConvertTo-Json -Compress
  exit 0
}

$rect = New-Object RECT
$hasRect = [Win32Pin]::GetWindowRect($hwnd, [ref]$rect)
$r = if ($hasRect) {
  @{left=$rect.Left; top=$rect.Top; right=$rect.Right; bottom=$rect.Bottom}
} else { $null }
$result = @{hwnd=[int64]$hwnd; processName=$pn; windowTitle=$windowTitle; isDesktop=$false; rect=$r}
$result | ConvertTo-Json -Compress
`.trim()

  return execPowerShell(script, 10000).then((stdout) => {
    if (!stdout) return { hwnd: 0, processName: '', windowTitle: '', isDesktop: true, rect: null }
    return extractJson<ForegroundInfo>(stdout) ?? { hwnd: 0, processName: '', windowTitle: '', isDesktop: true, rect: null }
  })
}

function setWindowTopmost(hwnd: number, topmost: boolean): Promise<boolean> {
  const flag = topmost ? '-1' : '-2'
  const psBool = topmost ? '$true' : '$false'
  const script = `
$cs = @"
using System;
using System.Runtime.InteropServices;
public class Win32Top {
    [DllImport("user32.dll")]
    public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);
    static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
    const uint SWP_NOMOVE = 0x0002;
    const uint SWP_NOSIZE = 0x0001;
    const uint SWP_NOACTIVATE = 0x0010;
    const uint SWP_SHOWWINDOW = 0x0040;

    public static bool Toggle(IntPtr hWnd, bool topmost) {
        if (!IsWindow(hWnd)) return false;
        return SetWindowPos(hWnd, topmost ? HWND_TOPMOST : HWND_NOTOPMOST,
            0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);
    }
}
"@
Add-Type -TypeDefinition $cs *> $null
$ok = [Win32Top]::Toggle([IntPtr]${hwnd}, ${psBool})
Write-Output $ok
`.trim()

  return execPowerShell(script, 8000).then((stdout) => stdout?.trim() === 'True')
}

/**
 * Batch query GetWindowRect + IsWindow for multiple HWNDs in a single PS process.
 * Returns a Map of hwnd → rect (null if window is gone or call failed).
 */
function getAllWindowRects(hwnds: number[]): Promise<Map<number, WindowRect | null>> {
  if (hwnds.length === 0) return Promise.resolve(new Map())

  const hwndList = hwnds.join(',')

  const script = `
$cs = @"
using System;
using System.Runtime.InteropServices;
public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
public class Win32Batch {
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
}
"@
Add-Type -TypeDefinition $cs *> $null
@{${hwndList}} | ForEach-Object {
  $h = [IntPtr]$_
  if ([Win32Batch]::IsWindow($h)) {
    $r = New-Object RECT
    if ([Win32Batch]::GetWindowRect($h, [ref]$r)) {
      Write-Output "$_|$($r.Left),$($r.Top),$($r.Right),$($r.Bottom)"
    } else {
      Write-Output "$_|null"
    }
  } else {
    Write-Output "$_|dead"
  }
}
`.trim()

  return execPowerShell(script, 5000).then((stdout) => {
    const result = new Map<number, WindowRect | null>()
    if (!stdout) {
      // If the whole batch failed, mark all as null
      for (const h of hwnds) result.set(h, null)
      return result
    }

    const lines = stdout.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    for (const line of lines) {
      const sepIdx = line.indexOf('|')
      if (sepIdx < 0) continue
      const hwndStr = line.substring(0, sepIdx)
      const data = line.substring(sepIdx + 1)
      const hwnd = parseInt(hwndStr, 10)
      if (isNaN(hwnd)) continue

      if (data === 'null' || data === 'dead') {
        result.set(hwnd, null)
      } else {
        const parts = data.split(',').map(Number)
        if (parts.length === 4 && parts.every(p => !isNaN(p))) {
          result.set(hwnd, { left: parts[0], top: parts[1], right: parts[2], bottom: parts[3] })
        } else {
          result.set(hwnd, null)
        }
      }
    }
    // Any HWND not in the output also gets null
    for (const h of hwnds) {
      if (!result.has(h)) result.set(h, null)
    }
    return result
  })
}

// ── Coordinate conversion ──

/**
 * Convert a rect from GetWindowRect (non-DPI-aware PowerShell) into
 * BrowserWindow coordinates. GetWindowRect from a non-DPI-aware process
 * returns coordinates already in DIP (logical) space matching BrowserWindow's
 * coordinate system, so no scaleFactor division is needed.
 */
function physicalToDipRect(rect: WindowRect): { x: number; y: number; width: number; height: number } {
  // GetWindowRect from non-DPI-aware PS returns DIP coordinates directly
  const x = rect.left - DEFAULT_BORDER_WIDTH
  const y = rect.top - DEFAULT_BORDER_WIDTH
  const w = (rect.right - rect.left) + DEFAULT_BORDER_WIDTH * 2
  const h = (rect.bottom - rect.top) + DEFAULT_BORDER_WIDTH * 2

  return { x, y, width: w, height: h }
}

// ── Border overlay management ──

function createBorderOverlay(hwnd: number, rect: WindowRect, color: string): BrowserWindow | null {
  try {
    const bounds = physicalToDipRect(rect)
    if (bounds.width <= 0 || bounds.height <= 0) return null

    const overlay = new BrowserWindow({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      focusable: false,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      type: 'toolbar',
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false
      }
    })

    overlay.setAlwaysOnTop(true, 'screen-saver')
    overlay.setVisibleOnAllWorkspaces(true)
    overlay.setIgnoreMouseEvents(true)

    const bw = DEFAULT_BORDER_WIDTH
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { width:100%; height:100%; background:transparent; border:${bw}px solid ${color}; overflow:hidden; }
    </style></head><body></body></html>`

    overlay.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return overlay
  } catch (e) {
    console.error('[Pinner] Failed to create border overlay:', e)
    return null
  }
}

function updateBorderOverlay(hwnd: number, rect: WindowRect): void {
  const overlay = borderOverlays.get(hwnd)
  if (!overlay || overlay.isDestroyed()) return

  try {
    const bounds = physicalToDipRect(rect)
    if (bounds.width > 0 && bounds.height > 0) {
      overlay.setBounds(bounds)
    }
  } catch { /* window may be destroyed */ }
}

function destroyBorderOverlay(hwnd: number): void {
  const overlay = borderOverlays.get(hwnd)
  if (overlay && !overlay.isDestroyed()) {
    overlay.close()
  }
  borderOverlays.delete(hwnd)
}

function destroyAllBorderOverlays(): void {
  for (const [hwnd] of borderOverlays) {
    destroyBorderOverlay(hwnd)
  }
}

// ── Periodic position polling ──

async function pollPinnedWindows(): Promise<void> {
  const hwnds = Array.from(pinnedWindows.keys())
  if (hwnds.length === 0) { stopPolling(); return }

  const rects = await getAllWindowRects(hwnds)

  const toRemove: number[] = []

  for (const hwnd of hwnds) {
    const rect = rects.get(hwnd)
    if (rect) {
      // Got a valid rect → reset retries, update overlay
      missingRectRetries.delete(hwnd)
      updateBorderOverlay(hwnd, rect)
    } else {
      // Window rect failed → check retry count
      const retries = (missingRectRetries.get(hwnd) ?? 0) + 1
      if (retries < MAX_RETRIES) {
        missingRectRetries.set(hwnd, retries)
      } else {
        // Max retries exceeded → consider window gone
        missingRectRetries.delete(hwnd)
        toRemove.push(hwnd)
      }
    }
  }

  // Clean up windows that exceeded retries
  for (const hwnd of toRemove) {
    await unpinWindowInternal(hwnd, false)
  }

  if (toRemove.length > 0) {
    broadcastPinnedList()
  }

  if (pinnedWindows.size === 0) {
    stopPolling()
  }
}

function startPolling(): void {
  if (pollTimer) return
  pollTimer = setInterval(() => { pollPinnedWindows() }, 400)
}

function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

// ── Pin/Unpin logic ──

async function unpinWindowInternal(hwnd: number, updateBorder: boolean): Promise<boolean> {
  const pinned = pinnedWindows.get(hwnd)
  if (!pinned) return false

  await setWindowTopmost(hwnd, false)
  pinnedWindows.delete(hwnd)
  missingRectRetries.delete(hwnd)

  if (updateBorder) {
    destroyBorderOverlay(hwnd)
  }

  return true
}

function broadcastPinnedList(): void {
  const list = Array.from(pinnedWindows.values()).map((pw, index) => ({
    hwnd: pw.hwnd,
    processName: pw.processName,
    windowTitle: pw.windowTitle,
    pinnedAt: pw.pinnedAt,
    order: index + 1
  }))

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && win.webContents) {
      win.webContents.send('pinner:list-update', list)
    }
  }
}

// ── IPC handlers ──

export function registerPinnerIpc(): void {
  // Toggle pin for foreground window
  ipcMain.handle('pinner:toggle', async (_event, maxWindows: number, borderColor: string) => {
    if (borderColor) currentBorderColor = borderColor

    const fg = await getForegroundWindowInfo()
    if (!fg || fg.isDesktop || fg.hwnd === 0) {
      return { success: false, reason: 'NO_FOREGROUND', message: '未检测到有效的前台窗口' }
    }

    // Check if already pinned → unpin
    if (pinnedWindows.has(fg.hwnd)) {
      await unpinWindowInternal(fg.hwnd, true)
      broadcastPinnedList()
      return { success: true, action: 'unpin', hwnd: fg.hwnd, processName: fg.processName, windowTitle: fg.windowTitle }
    }

    // Check max windows limit
    if (pinnedWindows.size >= maxWindows) {
      const oldest = pinnedWindows.entries().next().value
      if (oldest) {
        await unpinWindowInternal(oldest[0], true)
      }
    }

    // Pin
    const ok = await setWindowTopmost(fg.hwnd, true)
    if (!ok) {
      return { success: false, reason: 'SET_FAILED', message: '设置窗口置顶失败' }
    }

    pinnedWindows.set(fg.hwnd, {
      hwnd: fg.hwnd,
      processName: fg.processName,
      windowTitle: fg.windowTitle,
      pinnedAt: Date.now(),
      borderColor: currentBorderColor
    })

    // Create border overlay
    if (fg.rect) {
      const overlay = createBorderOverlay(fg.hwnd, fg.rect, currentBorderColor)
      if (overlay) {
        borderOverlays.set(fg.hwnd, overlay)
      }
    }

    startPolling()
    broadcastPinnedList()

    return { success: true, action: 'pin', hwnd: fg.hwnd, processName: fg.processName, windowTitle: fg.windowTitle }
  })

  // Unpin specific window
  ipcMain.handle('pinner:unpin', async (_event, hwnd: number) => {
    const ok = await unpinWindowInternal(hwnd, true)
    if (ok) {
      broadcastPinnedList()
      if (pinnedWindows.size === 0) stopPolling()
    }
    return { success: ok }
  })

  // Unpin all windows
  ipcMain.handle('pinner:unpin-all', async () => {
    for (const [hwnd] of pinnedWindows) {
      await unpinWindowInternal(hwnd, true)
    }
    stopPolling()
    broadcastPinnedList()
    return { success: true }
  })

  // Get current pinned list
  ipcMain.handle('pinner:get-list', () => {
    return Array.from(pinnedWindows.values()).map((pw, index) => ({
      hwnd: pw.hwnd,
      processName: pw.processName,
      windowTitle: pw.windowTitle,
      pinnedAt: pw.pinnedAt,
      order: index + 1
    }))
  })

  // Update border color for all pinned windows
  ipcMain.handle('pinner:set-border-color', (_event, color: string) => {
    currentBorderColor = color
    for (const [hwnd, pinned] of pinnedWindows) {
      pinned.borderColor = color
      destroyBorderOverlay(hwnd)
      // Batch rect query for all windows — reused via getAllWindowRects
      getAllWindowRects([hwnd]).then((rects) => {
        const rect = rects.get(hwnd)
        if (rect) {
          const overlay = createBorderOverlay(hwnd, rect, color)
          if (overlay) borderOverlays.set(hwnd, overlay)
        }
      }).catch(() => {})
    }
    return { success: true }
  })

  // Cleanup on app quit
  ipcMain.handle('pinner:cleanup', async () => {
    stopPolling()
    for (const [hwnd] of pinnedWindows) {
      await setWindowTopmost(hwnd, false)
    }
    pinnedWindows.clear()
    missingRectRetries.clear()
    destroyAllBorderOverlays()
    return { success: true }
  })
}
