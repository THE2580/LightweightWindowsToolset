import { ipcMain, BrowserWindow, screen } from 'electron'
import screenshot from 'screenshot-desktop'
import { execFile } from 'child_process'
import { writeFileSync, mkdtempSync, readFileSync, unlinkSync, rmdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { recognizeText } from '../utils/ocr'

interface WindowInfo {
  processName: string
  windowTitle: string
  isDesktop: boolean
  rect: { left: number; top: number; right: number; bottom: number } | null
}

interface CaptureResult {
  ocrText: string
  imageBase64: string
  success: boolean
  errorCode?: string
  errorMessage?: string
  resolvedGameId?: string
  windowInfo?: {
    processName: string
    windowTitle: string
  }
}

// --- Dynamic pipeline overlay with real-time DOM updates ---

let overlay: BrowserWindow | null = null
let overlayCloseTimer: ReturnType<typeof setTimeout> | null = null
// Store step labels set during overlay:create so capture:trigger can update them
let overlayStepLabels: string[] = []

const OVERLAY_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif; background: transparent; overflow: hidden; -webkit-app-region: no-drag; }
  .container { background: rgba(15,23,42,0.94); border: 1px solid rgba(37,99,235,0.3); border-radius: 8px; padding: 11px 12px; margin: 2px; backdrop-filter: blur(14px); animation: fadeIn 0.2s ease-out; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
  .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px; }
  .title { color: #93c5fd; font-size: 9px; font-weight: 600; }
  .process { color: #94a3b8; font-size: 7px; font-family: "SF Mono",Consolas,monospace; }
  .steps { display: flex; flex-direction: column; gap: 3px; }
  .step { display: flex; align-items: center; gap: 6px; font-size: 8px; color: #64748b; transition: color 0.2s; }
  .step.active { color: #e2e8f0; }
  .step.done { color: #94a3b8; }
  .step.fail { color: #fca5a5; }
  .icon { width: 11px; height: 11px; display: flex; align-items: center; justify-content: center; font-size: 8px; flex-shrink: 0; }
  .spinner { width: 9px; height: 9px; border: 1px solid #334155; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.6s linear infinite; flex-shrink: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .result-line { margin-top: 7px; padding-top: 7px; border-top: 1px solid rgba(148,163,184,0.15); font-size: 8px; font-weight: 600; display: none; }
  .result-line.show { display: block; }
  .result-line.ok { color: #4ade80; }
  .result-line.bad { color: #f87171; }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <span class="title">资源捕获</span>
    <span class="process" id="processName"></span>
  </div>
  <div class="steps" id="steps"></div>
  <div class="result-line" id="resultLine"></div>
</div>
<script>
  // Render functions called from main process via executeJavaScript
  window._render = function(steps, processName, result) {
    if (processName) document.getElementById('processName').textContent = processName;
    var container = document.getElementById('steps');
    container.innerHTML = steps.map(function(s) {
      var icon = '';
      if (s.s === 'running') icon = '<div class="spinner"></div>';
      else if (s.s === 'done') icon = '<span class="icon" style="color:#4ade80">✓</span>';
      else if (s.s === 'error') icon = '<span class="icon" style="color:#f87171">✗</span>';
      else icon = '<span class="icon" style="color:#475569">○</span>';
      var cls = 'step';
      if (s.s === 'running') cls += ' active';
      else if (s.s === 'done') cls += ' done';
      else if (s.s === 'error') cls += ' fail';
      return '<div class="' + cls + '">' + icon + '<span>' + s.l + '</span></div>';
    }).join('');
    if (result) {
      var rl = document.getElementById('resultLine');
      rl.textContent = result.t;
      rl.className = 'result-line show ' + (result.ok ? 'ok' : 'bad');
    }
  };
</script>
</body>
</html>`

function createOverlay(processName: string, stepLabels: string[]): void {
  // Kill any existing overlay
  if (overlay && !overlay.isDestroyed()) {
    overlay.close()
  }
  if (overlayCloseTimer) {
    clearTimeout(overlayCloseTimer)
    overlayCloseTimer = null
  }

  // Store step labels for use in capture:trigger progress updates
  overlayStepLabels = [...stepLabels]

  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenW } = primaryDisplay.workAreaSize
  const stepCount = stepLabels.length
  const winW = 238
  const winH = 53 + stepCount * 15
  const x = Math.round((screenW - winW) / 2)
  const y = 40

  overlay = new BrowserWindow({
    width: winW,
    height: winH,
    x,
    y,
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
  overlay.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(OVERLAY_HTML)}`)

  // Initial render after page loads
  overlay.webContents.on('did-finish-load', () => {
    const initialSteps = stepLabels.map((label, i) => ({
      s: i === 0 ? 'running' : 'pending',
      l: label
    }))
    overlay?.webContents.executeJavaScript(
      `window._render(${JSON.stringify(initialSteps)}, ${JSON.stringify(processName)}, null)`
    ).catch(() => {})
  })
}

function updateOverlaySteps(
  stepStates: { s: string; l: string }[],
  processName: string
): void {
  if (!overlay || overlay.isDestroyed()) return

  overlay.webContents.executeJavaScript(
    `window._render(${JSON.stringify(stepStates)}, ${JSON.stringify(processName)}, null)`
  ).catch(() => {})
}

function showOverlayResult(
  stepStates: { s: string; l: string }[],
  processName: string,
  resultText: string,
  isSuccess: boolean,
  autoCloseMs = 4000
): void {
  if (!overlay || overlay.isDestroyed()) return

  // Resize for result line
  overlay.setSize(238, overlay.getSize()[1] + 20)

  overlay.webContents.executeJavaScript(
    `window._render(${JSON.stringify(stepStates)}, ${JSON.stringify(processName)}, ${JSON.stringify({ t: resultText, ok: isSuccess })})`
  ).catch(() => {})

  // Auto-close after showing result
  if (overlayCloseTimer) clearTimeout(overlayCloseTimer)
  overlayCloseTimer = setTimeout(() => {
    if (overlay && !overlay.isDestroyed()) {
      overlay.close()
    }
    overlay = null
    overlayCloseTimer = null
    overlayStepLabels = []
  }, autoCloseMs)
}

function closeOverlay(): void {
  if (overlayCloseTimer) {
    clearTimeout(overlayCloseTimer)
    overlayCloseTimer = null
  }
  if (overlay && !overlay.isDestroyed()) {
    overlay.close()
  }
  overlay = null
  overlayStepLabels = []
}

// --- Window detection ---

function buildDetectScript(): string {
  return `
\$cs = @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
}

public class Win32Window {
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
    [DllImport("user32.dll")]
    public static extern IntPtr GetDesktopWindow();
}
"@

Add-Type -TypeDefinition \$cs *> \$null

\$hwnd = [Win32Window]::GetForegroundWindow()
if (\$hwnd -eq [IntPtr]::Zero) {
  @{processName=""; windowTitle=""; isDesktop=\$true; rect=\$null} | ConvertTo-Json -Compress
  exit 0
}

\$procId = 0
[Win32Window]::GetWindowThreadProcessId(\$hwnd, [ref]\$procId)
\$pn = try { (Get-Process -Id \$procId -ErrorAction Stop).ProcessName } catch { "unknown" }

\$sb = New-Object System.Text.StringBuilder(256)
[Win32Window]::GetWindowText(\$hwnd, \$sb, 256)
\$windowTitle = \$sb.ToString()

\$desktopHwnd = [Win32Window]::GetDesktopWindow()
\$isDesktop = (\$hwnd -eq \$desktopHwnd) -or
             (\$pn -eq "explorer") -or
             (\$pn -eq "Progman") -or
             (\$pn -eq "ShellExperienceHost")

if (\$isDesktop) {
  @{processName=\$pn; windowTitle=\$windowTitle; isDesktop=\$true; rect=\$null} | ConvertTo-Json -Compress
  exit 0
}

\$rect = New-Object RECT
\$hasRect = [Win32Window]::GetWindowRect(\$hwnd, [ref]\$rect)

\$w = \$rect.Right - \$rect.Left
\$h = \$rect.Bottom - \$rect.Top
if (-not \$hasRect -or \$w -le 0 -or \$h -le 0) {
  @{processName=\$pn; windowTitle=\$windowTitle; isDesktop=\$false; rect=\$null} | ConvertTo-Json -Compress
  exit 0
}

\$r = @{left=\$rect.Left; top=\$rect.Top; right=\$rect.Right; bottom=\$rect.Bottom}
@{processName=\$pn; windowTitle=\$windowTitle; isDesktop=\$false; rect=\$r} | ConvertTo-Json -Compress
`.trim()
}

function getForegroundWindow(): Promise<WindowInfo> {
  return new Promise((resolve) => {
    const script = buildDetectScript()
    const tmpDir = mkdtempSync(join(tmpdir(), 'lwt-fw-'))
    const psPath = join(tmpDir, 'detect.ps1')

    try {
      writeFileSync(psPath, script, 'utf-8')
    } catch (e) {
      console.error('[Capture] Failed to write detect script:', e)
      try { rmdirSync(tmpDir) } catch { /* ok */ }
      resolve({ processName: '', windowTitle: '', isDesktop: true, rect: null })
      return
    }

    execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psPath],
      { timeout: 15000, windowsHide: true },
      (err, stdout, stderr) => {
        try { unlinkSync(psPath) } catch { /* ok */ }
        try { rmdirSync(tmpDir) } catch { /* ok */ }

        if (err) {
          console.error('[Capture] Window detect error:', err.message)
          if (stderr) console.error('[Capture] Window detect stderr:', stderr)
        }
        if (err || !stdout) {
          resolve({ processName: '', windowTitle: '', isDesktop: true, rect: null })
          return
        }

        const raw = stdout.trim()
        const jsonStart = raw.indexOf('{')
        const jsonEnd = raw.lastIndexOf('}')
        if (jsonStart < 0 || jsonEnd < 0) {
          console.error('[Capture] No JSON in stdout:', JSON.stringify(raw))
          resolve({ processName: '', windowTitle: '', isDesktop: true, rect: null })
          return
        }
        const jsonStr = raw.substring(jsonStart, jsonEnd + 1)

        try {
          const info: WindowInfo = JSON.parse(jsonStr)
          console.log('[Capture] Detected:', info.processName, 'desktop=', info.isDesktop)
          resolve(info)
        } catch (e) {
          console.error('[Capture] JSON parse failed. jsonStr:', JSON.stringify(jsonStr))
          resolve({ processName: '', windowTitle: '', isDesktop: true, rect: null })
        }
      }
    )
  })
}

const KNOWN_PROCESSES: Record<string, string> = {
  'yuanshen': 'genshin',
  'genshinimpact': 'genshin',
  'zenlesszonezero': 'zzz',
  'endfield': 'endfield',
  'nte': 'nte',
}

function resolveGameFromProcess(processName: string): string | null {
  const lower = processName.toLowerCase()
  if (KNOWN_PROCESSES[lower]) return KNOWN_PROCESSES[lower]
  for (const [key, gameId] of Object.entries(KNOWN_PROCESSES)) {
    if (lower.includes(key)) return gameId
  }
  return null
}

// Step label keys for overlay progress — must match what the renderer passes to overlay:create
const STEP_SCREENSHOT = '正在截图...'
const STEP_OCR = 'OCR文本识别中...'
const STEP_AI = 'AI文本解析中...'

function buildOverlaySteps(statuses: { screenshot: string; ocr: string; ai: string }): { s: string; l: string }[] {
  return [
    { s: statuses.screenshot, l: STEP_SCREENSHOT },
    { s: statuses.ocr, l: STEP_OCR },
    { s: statuses.ai, l: STEP_AI },
  ]
}

export function registerCaptureIpc(): void {
  ipcMain.handle('capture:trigger', async (): Promise<CaptureResult> => {
    try {
      const windowInfo = await getForegroundWindow()

      if (windowInfo.isDesktop || !windowInfo.processName) {
        return {
          ocrText: '',
          imageBase64: '',
          success: false,
          errorCode: 'DESKTOP_FOREGROUND',
          errorMessage: '当前焦点为桌面，请切换到游戏窗口后再捕获',
          windowInfo: { processName: 'desktop', windowTitle: '桌面' }
        }
      }

      const resolvedGameId = resolveGameFromProcess(windowInfo.processName)
      if (!resolvedGameId) {
        return {
          ocrText: '',
          imageBase64: '',
          success: false,
          errorCode: 'UNKNOWN_PROCESS',
          errorMessage: `未识别的进程「${windowInfo.processName}」，仅支持已配置的游戏窗口`,
          windowInfo: { processName: windowInfo.processName, windowTitle: windowInfo.windowTitle }
        }
      }

      // --- Screenshot phase ---
      let imgBuffer: Buffer
      try {
        imgBuffer = await screenshot({ format: 'png' })
        console.log('[Capture] screenshot-desktop captured', imgBuffer.length, 'bytes')
      } catch (captureErr) {
        console.error('[Capture] screenshot-desktop failed:', captureErr)
        return {
          ocrText: '',
          imageBase64: '',
          success: false,
          errorCode: 'CAPTURE_ERROR',
          errorMessage: `截图失败: ${captureErr instanceof Error ? captureErr.message : String(captureErr)}`,
          windowInfo: { processName: windowInfo.processName, windowTitle: windowInfo.windowTitle }
        }
      }

      // --- Update overlay: screenshot done, OCR running ---
      updateOverlaySteps(
        buildOverlaySteps({ screenshot: 'done', ocr: 'running', ai: 'pending' }),
        '',
      )

      const imageBase64 = imgBuffer.toString('base64')

      const scaleFactor = screen.getPrimaryDisplay().scaleFactor
      let cropRect: { x: number; y: number; w: number; h: number } | undefined
      if (windowInfo.rect) {
        cropRect = {
          x: Math.round(windowInfo.rect.left * scaleFactor),
          y: Math.round(windowInfo.rect.top * scaleFactor),
          w: Math.round((windowInfo.rect.right - windowInfo.rect.left) * scaleFactor),
          h: Math.round((windowInfo.rect.bottom - windowInfo.rect.top) * scaleFactor)
        }
        console.log('[Capture] scaleFactor:', scaleFactor, 'crop rect:', cropRect.x, cropRect.y, cropRect.w, 'x', cropRect.h)
      } else {
        console.log('[Capture] No crop rect — using full image')
      }

      // --- OCR phase ---
      const ocrText = await recognizeText(imgBuffer, cropRect)
      console.log('[Capture] OCR result length:', ocrText.length, 'text:', JSON.stringify(ocrText.substring(0, 100)))

      // --- Update overlay: OCR done (or error), AI pending ---
      updateOverlaySteps(
        buildOverlaySteps({ screenshot: 'done', ocr: ocrText ? 'done' : 'error', ai: 'pending' }),
        '',
      )

      return {
        ocrText,
        imageBase64,
        success: true,
        resolvedGameId,
        windowInfo: { processName: windowInfo.processName, windowTitle: windowInfo.windowTitle }
      }
    } catch (err) {
      console.error('[Capture] Pipeline error:', err)
      closeOverlay()
      return {
        ocrText: '',
        imageBase64: '',
        success: false,
        errorCode: 'CAPTURE_ERROR',
        errorMessage: `截图或OCR处理出错: ${err instanceof Error ? err.message : String(err)}`
      }
    }
  })

  // Overlay IPC
  // Lightweight foreground detection — returns process info without screenshot/OCR
  ipcMain.handle('capture:detect-foreground', async () => {
    try {
      const wi = await getForegroundWindow()
      const gameId = (wi.isDesktop || !wi.processName)
        ? null
        : resolveGameFromProcess(wi.processName)
      return {
        processName: wi.processName || 'desktop',
        resolvedGameId: gameId,
        isDesktop: wi.isDesktop
      }
    } catch {
      return { processName: 'unknown', resolvedGameId: null, isDesktop: true }
    }
  })

  ipcMain.handle('overlay:create', (_event, processName: string, stepLabels: string[]) => {
    createOverlay(processName, stepLabels)
  })

  ipcMain.handle('overlay:update', (_event, stepStates: { s: string; l: string }[], processName: string) => {
    updateOverlaySteps(stepStates, processName)
  })

  ipcMain.handle('overlay:result', (_event, stepStates: { s: string; l: string }[], processName: string, resultText: string, isSuccess: boolean) => {
    showOverlayResult(stepStates, processName, resultText, isSuccess)
  })

  ipcMain.handle('overlay:close', () => {
    closeOverlay()
  })
}
