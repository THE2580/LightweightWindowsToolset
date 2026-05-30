import { ipcMain, BrowserWindow, screen } from 'electron'
import { execFile } from 'child_process'
import { writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// ── Types ──

interface PinnedWindow {
  hwnd: number
  processName: string
  windowTitle: string
  pinnedAt: number
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

let currentPinned: PinnedWindow | null = null
let borderOverlay: BrowserWindow | null = null
let missingRectRetries = 0
let pollTimer: ReturnType<typeof setInterval> | null = null
let currentBorderColor = '#2563EB'
const DEFAULT_BORDER_WIDTH = 3
const MAX_RETRIES = 2

// ── PowerShell helper (execFile + DPI-aware script prefix) ──

const DPI_PREAMBLE = `
$dpi = @"
using System;
using System.Runtime.InteropServices;
public class DpiInit {
    [DllImport("shcore.dll")]
    public static extern int SetProcessDpiAwareness(int awareness);
}
"@
Add-Type -TypeDefinition $dpi *> $null
[DpiInit]::SetProcessDpiAwareness(1) *> $null
`.trim()

function execPowerShell(script: string, timeoutMs: number): Promise<string | null> {
  return new Promise((resolve) => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'lwt-'))
    const psPath = join(tmpDir, 's.ps1')
    writeFileSync(psPath, DPI_PREAMBLE + '\n' + script, 'utf-8')

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

function extractJson<T>(raw: string): T | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < 0) return null
  try { return JSON.parse(raw.substring(start, end + 1)) } catch { return null }
}

// ── Win32 operations ──

function getForegroundWindowInfo(): Promise<ForegroundInfo> {
  const script = `
$cs = @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public struct RECT_FG {
    public int Left; public int Top; public int Right; public int Bottom;
}

public class W32FG {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT_FG lpRect);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")]
    public static extern IntPtr GetDesktopWindow();
}
"@
Add-Type -TypeDefinition $cs *> $null

$hwnd = [W32FG]::GetForegroundWindow()
if ($hwnd -eq [IntPtr]::Zero) {
  Write-Output '{"hwnd":0,"processName":"","windowTitle":"","isDesktop":true,"rect":null}'
  exit 0
}

$procId = 0
[W32FG]::GetWindowThreadProcessId($hwnd, [ref]$procId)
$pn = try { (Get-Process -Id $procId -ErrorAction Stop).ProcessName } catch { "unknown" }

$sb = New-Object System.Text.StringBuilder(256)
[W32FG]::GetWindowText($hwnd, $sb, 256)
$windowTitle = $sb.ToString()

$desktopHwnd = [W32FG]::GetDesktopWindow()
$isDesktop = ($hwnd -eq $desktopHwnd) -or
             ($pn -eq "explorer") -or
             ($pn -eq "Progman") -or
             ($pn -eq "ShellExperienceHost")

if ($isDesktop) {
  @{hwnd=[int64]$hwnd; processName=$pn; windowTitle=''; isDesktop=$true; rect=$null} | ConvertTo-Json -Compress
  exit 0
}

$rect = New-Object RECT_FG
$hasRect = [W32FG]::GetWindowRect($hwnd, [ref]$rect)
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
  const psBool = topmost ? '$true' : '$false'
  const script = `
$cs = @"
using System;
using System.Runtime.InteropServices;
public class W32Top {
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
$ok = [W32Top]::Toggle([IntPtr]${hwnd}, ${psBool})
Write-Output $ok
`.trim()

  return execPowerShell(script, 8000).then((stdout) => stdout?.trim() === 'True')
}

function getWindowRect(hwnd: number): Promise<WindowRect | null> {
  const script = `
$cs = @"
using System;
using System.Runtime.InteropServices;
public struct RECT_WR { public int Left; public int Top; public int Right; public int Bottom; }
public class W32WR {
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT_WR lpRect);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
}
"@
Add-Type -TypeDefinition $cs *> $null
if (-not [W32WR]::IsWindow([IntPtr]${hwnd})) { Write-Output 'null'; exit 0 }
$r = New-Object RECT_WR
if ([W32WR]::GetWindowRect([IntPtr]${hwnd}, [ref]$r)) {
  Write-Output "$($r.Left),$($r.Top),$($r.Right),$($r.Bottom)"
} else {
  Write-Output 'null'
}
`.trim()

  return execPowerShell(script, 5000).then((stdout) => {
    if (!stdout || stdout === 'null') return null
    const parts = stdout.trim().split(',').map(Number)
    if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
      return { left: parts[0], top: parts[1], right: parts[2], bottom: parts[3] }
    }
    return null
  })
}

// ── Coordinate conversion ──
// DPI-aware PS: GetWindowRect returns PHYSICAL pixels.
// BrowserWindow uses DIP → divide by scaleFactor.

function physicalToDip(rect: WindowRect): { x: number; y: number; width: number; height: number } {
  const sf = screen.getPrimaryDisplay().scaleFactor
  return {
    x: Math.round(rect.left / sf) - DEFAULT_BORDER_WIDTH,
    y: Math.round(rect.top / sf) - DEFAULT_BORDER_WIDTH,
    width: Math.round((rect.right - rect.left) / sf) + DEFAULT_BORDER_WIDTH * 2,
    height: Math.round((rect.bottom - rect.top) / sf) + DEFAULT_BORDER_WIDTH * 2,
  }
}

// ── Border overlay ──

function createBorderOverlay(rect: WindowRect, color: string): BrowserWindow | null {
  try {
    const b = physicalToDip(rect)
    if (b.width <= 10 || b.height <= 10) return null

    const overlay = new BrowserWindow({
      x: b.x, y: b.y, width: b.width, height: b.height,
      frame: false, transparent: true, alwaysOnTop: true,
      focusable: false, skipTaskbar: true, resizable: false, hasShadow: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false },
    })
    overlay.setAlwaysOnTop(true, 'screen-saver')
    overlay.setVisibleOnAllWorkspaces(true)
    overlay.setIgnoreMouseEvents(true)

    const bw = DEFAULT_BORDER_WIDTH
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      *{margin:0;padding:0}html,body{width:100%;height:100%;overflow:hidden;background:transparent}
      .b{position:fixed;background:${color}}
      .bt{top:0;left:0;right:0;height:${bw}px}
      .bb{bottom:0;left:0;right:0;height:${bw}px}
      .bl{top:0;left:0;bottom:0;width:${bw}px}
      .br{top:0;right:0;bottom:0;width:${bw}px}
    </style></head><body>
      <div class="b bt"></div><div class="b bb"></div>
      <div class="b bl"></div><div class="b br"></div>
    </body></html>`
    overlay.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    return overlay
  } catch (e) {
    console.error('[Pinner] createBorderOverlay error:', e)
    return null
  }
}

function updateBorderOverlay(rect: WindowRect): void {
  if (!borderOverlay || borderOverlay.isDestroyed()) return
  try {
    const b = physicalToDip(rect)
    if (b.width > 10 && b.height > 10) borderOverlay.setBounds(b)
  } catch {}
}

function destroyBorderOverlay(): void {
  if (borderOverlay && !borderOverlay.isDestroyed()) borderOverlay.close()
  borderOverlay = null
}

// ── Polling (serialized) ──

let pollingActive = false

async function pollPinnedWindow(): Promise<void> {
  if (!currentPinned) { stopPolling(); return }
  if (pollingActive) return
  pollingActive = true
  try {
    const rect = await getWindowRect(currentPinned.hwnd)
    if (rect) {
      missingRectRetries = 0
      updateBorderOverlay(rect)
    } else {
      missingRectRetries++
      if (missingRectRetries >= MAX_RETRIES) {
        await unpinInternal(false)
        broadcastState()
      }
    }
  } finally {
    pollingActive = false
  }
}

function startPolling(): void {
  if (pollTimer) return
  pollTimer = setInterval(() => { pollPinnedWindow() }, 400)
}

function stopPolling(): void {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

// ── Pin / Unpin ──

async function unpinInternal(updateBorder: boolean): Promise<boolean> {
  if (!currentPinned) return false
  await setWindowTopmost(currentPinned.hwnd, false)
  currentPinned = null
  missingRectRetries = 0
  if (updateBorder) destroyBorderOverlay()
  return true
}

function broadcastState(): void {
  const info = currentPinned
    ? { hwnd: currentPinned.hwnd, processName: currentPinned.processName, windowTitle: currentPinned.windowTitle, pinnedAt: currentPinned.pinnedAt }
    : null
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && win.webContents) win.webContents.send('pinner:state-update', info)
  }
}

// ── IPC ──

export function registerPinnerIpc(): void {
  ipcMain.handle('pinner:toggle', async (_event, borderColor: string) => {
    if (borderColor) currentBorderColor = borderColor
    if (currentPinned) {
      await unpinInternal(true)
      broadcastState()
      stopPolling()
      return { success: true, action: 'unpin' }
    }
    const fg = await getForegroundWindowInfo()
    if (!fg || fg.isDesktop || fg.hwnd === 0) {
      return { success: false, reason: 'NO_FOREGROUND', message: '未检测到有效的前台窗口' }
    }
    const ok = await setWindowTopmost(fg.hwnd, true)
    if (!ok) return { success: false, reason: 'SET_FAILED', message: '设置窗口置顶失败' }
    currentPinned = { hwnd: fg.hwnd, processName: fg.processName, windowTitle: fg.windowTitle, pinnedAt: Date.now(), borderColor: currentBorderColor }
    if (fg.rect) {
      const ov = createBorderOverlay(fg.rect, currentBorderColor)
      if (ov) borderOverlay = ov
    }
    startPolling()
    broadcastState()
    return { success: true, action: 'pin', hwnd: fg.hwnd, processName: fg.processName, windowTitle: fg.windowTitle }
  })

  ipcMain.handle('pinner:unpin', async () => {
    const ok = await unpinInternal(true)
    if (ok) { broadcastState(); stopPolling() }
    return { success: ok }
  })

  ipcMain.handle('pinner:get-state', () => {
    if (!currentPinned) return null
    return { hwnd: currentPinned.hwnd, processName: currentPinned.processName, windowTitle: currentPinned.windowTitle, pinnedAt: currentPinned.pinnedAt }
  })

  ipcMain.handle('pinner:set-border-color', async (_event, color: string) => {
    currentBorderColor = color
    if (currentPinned) {
      currentPinned.borderColor = color
      destroyBorderOverlay()
      const rect = await getWindowRect(currentPinned.hwnd)
      if (rect) {
        const ov = createBorderOverlay(rect, color)
        if (ov) borderOverlay = ov
      }
    }
    return { success: true }
  })

  ipcMain.handle('pinner:cleanup', async () => {
    stopPolling()
    if (currentPinned) {
      await setWindowTopmost(currentPinned.hwnd, false)
      currentPinned = null
    }
    missingRectRetries = 0
    destroyBorderOverlay()
    return { success: true }
  })
}
