import { ipcMain, BrowserWindow, screen } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync, mkdtempSync, rmdirSync } from 'fs'
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

// ── Persistent PowerShell session ──
// Single powershell.exe reused for all Win32 calls to eliminate process spawn overhead.
// DPI-aware: GetWindowRect returns physical pixels (converted to DIP via scaleFactor).

let psProc: ChildProcess | null = null
let psReady = false
const psBootWaiters: Array<() => void> = []

interface PsJob {
  script: string
  resolve: (result: string) => void
  timer: ReturnType<typeof setTimeout>
}
const psQueue: PsJob[] = []
let psBusy = false

function startPsSession(): ChildProcess {
  psReady = false
  psProc = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '-'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  })

  psProc.on('close', (code) => {
    console.warn(`[Pinner] PS session closed (code=${code})`)
    psProc = null
    psReady = false
  })
  psProc.on('error', (err) => {
    console.error('[Pinner] PS session error:', err.message)
  })

  // Bootstrap: set DPI awareness once
  const bootScript = `
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
Write-Output "_READY_"
`.trim()

  let bootAcc = ''
  const onBoot = (data: Buffer) => {
    bootAcc += data.toString()
    if (bootAcc.includes('_READY_')) {
      psProc!.stdout!.removeListener('data', onBoot)
      psReady = true
      const ws = psBootWaiters.splice(0)
      for (const cb of ws) cb()
    }
  }
  psProc.stdout!.on('data', onBoot)
  psProc.stdin!.write(bootScript + '\n')

  return psProc
}

function ensurePsReady(): Promise<void> {
  return new Promise((resolve) => {
    const p = psProc && !psProc.killed ? psProc : startPsSession()
    if (psReady) { resolve(); return }
    psBootWaiters.push(resolve)
  })
}

function drainPsQueue(): void {
  if (psBusy || psQueue.length === 0) return
  const job = psQueue.shift()!
  psBusy = true

  // Execute: write script to temp file, tell PS to run it, collect output
  const tmpDir = mkdtempSync(join(tmpdir(), 'lwt-'))
  const sf = join(tmpDir, 's.ps1')
  const of = join(tmpDir, 'o.txt')
  writeFileSync(sf, job.script, 'utf-8')

  // Unique completion marker per job
  const marker = `_DONE_${Date.now()}_${Math.random().toString(36).slice(2)}_`
  const cmd = `& '${sf.replace(/\\/g, '\\\\')}' | Out-File -FilePath '${of.replace(/\\/g, '\\\\')}' -Encoding UTF8; Write-Output '${marker}'\n`

  let acc = ''
  const onData = (data: Buffer) => {
    acc += data.toString()
    if (acc.includes(marker)) {
      psProc!.stdout!.removeListener('data', onData)
      clearTimeout(job.timer)

      let result = ''
      try {
        result = readFileSync(of, 'utf-8').trim()
        unlinkSync(of)
      } catch { /* output file may be empty */ }
      try { unlinkSync(sf) } catch {}
      try { rmdirSync(tmpDir) } catch {}

      job.resolve(result)
      psBusy = false
      drainPsQueue()
    }
  }

  psProc!.stdout!.on('data', onData)
  psProc!.stdin!.write(cmd)
}

function psExec(script: string, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      // Timeout: remove from queue, resolve empty
      const idx = psQueue.findIndex((j) => j.resolve === resolve)
      if (idx >= 0) psQueue.splice(idx, 1)
      resolve('')
    }, timeoutMs)

    psQueue.push({ script, resolve, timer })
    ensurePsReady().then(() => drainPsQueue())
  })
}

// ── Win32 operations ──

async function getForegroundWindowInfo(): Promise<ForegroundInfo> {
  const script = `
$cs = @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public struct RECT_FG { public int Left; public int Top; public int Right; public int Bottom; }
public class W32FG {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT_FG lpRect);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")] public static extern IntPtr GetDesktopWindow();
}
"@
Add-Type -TypeDefinition $cs *> $null
$h = [W32FG]::GetForegroundWindow()
if ($h -eq [IntPtr]::Zero) { Write-Output '{"hwnd":0,"processName":"","windowTitle":"","isDesktop":true,"rect":null}'; exit }
$pid=0; [W32FG]::GetWindowThreadProcessId($h,[ref]$pid)
$pn = try {(Get-Process -Id $pid -ErrorAction Stop).ProcessName} catch {"unknown"}
$sb=New-Object System.Text.StringBuilder(256); [W32FG]::GetWindowText($h,$sb,256); $wt=$sb.ToString()
$dh=[W32FG]::GetDesktopWindow()
$isDesk=($h -eq $dh) -or ($pn -eq "explorer") -or ($pn -eq "Progman") -or ($pn -eq "ShellExperienceHost")
if ($isDesk) { Write-Output ('{"hwnd":'+[int64]$h+',"processName":"'+$pn+'","windowTitle":"","isDesktop":true,"rect":null}'); exit }
$r=New-Object RECT_FG
$hr=[W32FG]::GetWindowRect($h,[ref]$r)
$rj=if($hr){"{""left"":$($r.Left),""top"":$($r.Top),""right"":$($r.Right),""bottom"":$($r.Bottom)}"}else{"null"}
$wtEsc=$wt -replace '"','\\"'
Write-Output ('{"hwnd":'+[int64]$h+',"processName":"'+$pn+'","windowTitle":"'+$wtEsc+'","isDesktop":false,"rect":'+$rj+'}')
`.trim()

  const stdout = await psExec(script, 10000)
  if (!stdout) return { hwnd: 0, processName: '', windowTitle: '', isDesktop: true, rect: null }
  try {
    const s = stdout.indexOf('{'), e = stdout.lastIndexOf('}')
    if (s < 0 || e < 0) return { hwnd: 0, processName: '', windowTitle: '', isDesktop: true, rect: null }
    return JSON.parse(stdout.substring(s, e + 1))
  } catch {
    return { hwnd: 0, processName: '', windowTitle: '', isDesktop: true, rect: null }
  }
}

async function setWindowTopmost(hwnd: number, topmost: boolean): Promise<boolean> {
  const flag = topmost ? '$true' : '$false'
  const script = `
$cs = @"
using System;
using System.Runtime.InteropServices;
public class W32TOP {
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
    static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
    const uint SWP_NOMOVE = 0x0002;
    const uint SWP_NOSIZE = 0x0001;
    const uint SWP_NOACTIVATE = 0x0010;
    const uint SWP_SHOWWINDOW = 0x0040;
    public static bool Toggle(IntPtr hWnd, bool topmost) {
        if (!IsWindow(hWnd)) return false;
        return SetWindowPos(hWnd, topmost ? HWND_TOPMOST : HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_SHOWWINDOW);
    }
}
"@
Add-Type -TypeDefinition $cs *> $null
$ok = [W32TOP]::Toggle([IntPtr]${hwnd}, ${flag})
Write-Output $ok
`.trim()
  const stdout = await psExec(script, 8000)
  return stdout?.trim() === 'True'
}

async function getWindowRect(hwnd: number): Promise<WindowRect | null> {
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
if (-not [W32WR]::IsWindow([IntPtr]${hwnd})) { Write-Output 'null'; exit }
$r = New-Object RECT_WR
if ([W32WR]::GetWindowRect([IntPtr]${hwnd}, [ref]$r)) {
  Write-Output "$($r.Left),$($r.Top),$($r.Right),$($r.Bottom)"
} else { Write-Output 'null' }
`.trim()
  const stdout = await psExec(script, 5000)
  if (!stdout || stdout === 'null') return null
  const parts = stdout.trim().split(',').map(Number)
  if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
    return { left: parts[0], top: parts[1], right: parts[2], bottom: parts[3] }
  }
  return null
}

// ── Coordinate conversion (physical → DIP) ──
// PS session is DPI-aware: GetWindowRect returns PHYSICAL pixels.
// BrowserWindow uses DIP coordinates → divide by scaleFactor.

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

// ── Polling (serialized: won't overlap) ──

let pollingActive = false

async function pollPinnedWindow(): Promise<void> {
  if (!currentPinned) { stopPolling(); return }
  if (pollingActive) return  // skip if previous poll still in flight
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
    if (psProc && !psProc.killed) { psProc.kill(); psProc = null; psReady = false }
    psQueue.length = 0
    return { success: true }
  })
}
