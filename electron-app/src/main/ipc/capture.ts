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

// --- Dynamic pipeline overlay ---
// Overlay lifecycle is managed by the RENDERER process.
// Main process only provides IPC handlers: create / update / result / close.
// Each overlay:create rebuilds a fresh BrowserWindow (no reuse).

let overlay: BrowserWindow | null = null

const OVERLAY_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system,BlinkMacSystemFont,"Microsoft YaHei",sans-serif; background: transparent; overflow: hidden; -webkit-app-region: no-drag; }
  .container { background: rgba(15,23,42,0.94); border: 1px solid rgba(37,99,235,0.3); border-radius: 8px; padding: 11px 12px; margin: 2px; backdrop-filter: blur(14px); animation: fadeIn 0.22s ease-out; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
  .container.leaving { animation: fadeOut 0.28s ease-out forwards; }
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

  /* Invalid-process banner */
  .invalid-banner { display: none; flex-direction: column; align-items: center; gap: 6px; padding: 5px 0; }
  .invalid-banner.show { display: flex; }
  .invalid-banner .icon-x { width: 20px; height: 20px; border-radius: 50%; background: rgba(248,113,113,0.15); display: flex; align-items: center; justify-content: center; color: #f87171; font-size: 11px; font-weight: 700; }
  .invalid-banner .msg { color: #fca5a5; font-size: 9px; font-weight: 600; }
  .invalid-banner .sub { color: #64748b; font-size: 7px; }
</style>
</head>
<body>
<div class="container" id="container">
  <div class="header">
    <span class="title" id="titleText">资源捕获</span>
    <span class="process" id="processName"></span>
  </div>
  <div class="invalid-banner" id="invalidBanner">
    <div class="icon-x">✗</div>
    <div class="msg">当前为无效进程</div>
    <div class="sub" id="invalidProcessName"></div>
  </div>
  <div class="steps" id="steps"></div>
  <div class="result-line" id="resultLine"></div>
</div>
<script>
  // Render step states
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

  // Show invalid-process banner
  window._showInvalid = function(processName) {
    document.getElementById('titleText').textContent = '资源捕获';
    document.getElementById('processName').textContent = processName || '';
    document.getElementById('invalidProcessName').textContent = '进程: ' + (processName || '未知');
    document.getElementById('invalidBanner').classList.add('show');
    document.getElementById('steps').innerHTML = '';
    document.getElementById('resultLine').className = 'result-line';
  };

  // Trigger fade-out animation, then notify main process
  window._startFadeOut = function() {
    var c = document.getElementById('container');
    c.classList.add('leaving');
    c.addEventListener('animationend', function() {
      window.close(); // semantically signals "done" to the main process
    }, { once: true });
  };
</script>
</body>
</html>`

const OVERLAY_W = 238
const OVERLAY_BASE_H = 53

function computeOverlayHeight(stepCount: number, hasResult: boolean): number {
  return OVERLAY_BASE_H + stepCount * 15 + (hasResult ? 20 : 0)
}

function destroyOverlay(): void {
  if (overlay && !overlay.isDestroyed()) {
    overlay.hide()
    overlay.close()
    overlay = null
  }
}

function createOverlayWindow(processName: string, stepLabels: string[], isInvalid: boolean): Promise<void> {
  return new Promise((resolve) => {
    // Destroy any previous overlay unconditionally (fresh start)
    destroyOverlay()

    const primaryDisplay = screen.getPrimaryDisplay()
    const { width: screenW } = primaryDisplay.workAreaSize
    const winH = isInvalid ? 110 : computeOverlayHeight(stepLabels.length, false)
    const x = Math.round((screenW - OVERLAY_W) / 2)
    const y = 40

    overlay = new BrowserWindow({
      width: OVERLAY_W,
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

    overlay.webContents.on('did-finish-load', () => {
      if (isInvalid) {
        overlay?.webContents.executeJavaScript(
          `window._showInvalid(${JSON.stringify(processName)})`
        ).catch(() => {})
        // Auto-close invalid overlay after 2.5s
        setTimeout(() => {
          if (overlay && !overlay.isDestroyed()) {
            overlay.webContents.executeJavaScript('window._startFadeOut()').catch(() => {})
            // Fallback: destroy after animation
            setTimeout(() => destroyOverlay(), 400)
          }
        }, 2500)
      } else {
        const initialSteps = stepLabels.map((label, i) => ({
          s: 'pending',
          l: label
        }))
        // Set step 0 to running
        if (initialSteps.length > 0) {
          initialSteps[0].s = 'running'
        }
        overlay?.webContents.executeJavaScript(
          `window._render(${JSON.stringify(initialSteps)}, ${JSON.stringify(processName)}, null)`
        ).catch(() => {})
      }
      resolve()
    })

    // If page load times out, resolve anyway
    setTimeout(() => resolve(), 3000)

    overlay.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(OVERLAY_HTML)}`)
  })
}

// --- Window detection ---

function buildDetectScript(): string {
  return `
$cs = @"
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

Add-Type -TypeDefinition $cs *> $null

$hwnd = [Win32Window]::GetForegroundWindow()
if ($hwnd -eq [IntPtr]::Zero) {
  @{processName=""; windowTitle=""; isDesktop=$true; rect=$null} | ConvertTo-Json -Compress
  exit 0
}

$procId = 0
[Win32Window]::GetWindowThreadProcessId($hwnd, [ref]$procId)
$pn = try { (Get-Process -Id $procId -ErrorAction Stop).ProcessName } catch { "unknown" }

$sb = New-Object System.Text.StringBuilder(256)
[Win32Window]::GetWindowText($hwnd, $sb, 256)
$windowTitle = $sb.ToString()

$desktopHwnd = [Win32Window]::GetDesktopWindow()
$isDesktop = ($hwnd -eq $desktopHwnd) -or
             ($pn -eq "explorer") -or
             ($pn -eq "Progman") -or
             ($pn -eq "ShellExperienceHost")

if ($isDesktop) {
  @{processName=$pn; windowTitle=$windowTitle; isDesktop=$true; rect=$null} | ConvertTo-Json -Compress
  exit 0
}

$rect = New-Object RECT
$hasRect = [Win32Window]::GetWindowRect($hwnd, [ref]$rect)

$w = $rect.Right - $rect.Left
$h = $rect.Bottom - $rect.Top
if (-not $hasRect -or $w -le 0 -or $h -le 0) {
  @{processName=$pn; windowTitle=$windowTitle; isDesktop=$false; rect=$null} | ConvertTo-Json -Compress
  exit 0
}

$r = @{left=$rect.Left; top=$rect.Top; right=$rect.Right; bottom=$rect.Bottom}
@{processName=$pn; windowTitle=$windowTitle; isDesktop=$false; rect=$r} | ConvertTo-Json -Compress
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

/** Wrap a promise with a timeout. Returns a rejected promise if timeout fires. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} 超时 (${ms / 1000}s)`)), ms)
    )
  ])
}

export function registerCaptureIpc(): void {
  // --- capture:trigger — pure screenshot + OCR, NO foreground detection, NO overlay management ---
  ipcMain.handle('capture:trigger', async (): Promise<CaptureResult> => {
    try {
      // --- Screenshot phase (8s timeout) ---
      let imgBuffer: Buffer
      try {
        imgBuffer = await withTimeout(
          screenshot({ format: 'png' }),
          8000,
          '截图'
        )
        console.log('[Capture] screenshot-desktop captured', imgBuffer.length, 'bytes')
      } catch (captureErr) {
        console.error('[Capture] Screenshot failed:', captureErr)
        return {
          ocrText: '',
          imageBase64: '',
          success: false,
          errorCode: 'CAPTURE_TIMEOUT',
          errorMessage: `截图失败: ${captureErr instanceof Error ? captureErr.message : String(captureErr)}`
        }
      }

      const imageBase64 = imgBuffer.toString('base64')

      const scaleFactor = screen.getPrimaryDisplay().scaleFactor

      // Get foreground window info for crop rect (lightweight, just for cropping)
      let cropRect: { x: number; y: number; w: number; h: number } | undefined
      try {
        const fgInfo = await getForegroundWindow()
        if (fgInfo.rect && !fgInfo.isDesktop) {
          cropRect = {
            x: Math.round(fgInfo.rect.left * scaleFactor),
            y: Math.round(fgInfo.rect.top * scaleFactor),
            w: Math.round((fgInfo.rect.right - fgInfo.rect.left) * scaleFactor),
            h: Math.round((fgInfo.rect.bottom - fgInfo.rect.top) * scaleFactor)
          }
          console.log('[Capture] scaleFactor:', scaleFactor, 'crop rect:', cropRect.x, cropRect.y, cropRect.w, 'x', cropRect.h)
        }
      } catch {
        console.log('[Capture] Foreground detection for crop failed, using full image')
      }

      // --- OCR phase (15s timeout) ---
      const ocrText = await withTimeout(
        recognizeText(imgBuffer, cropRect),
        15000,
        'OCR'
      )
      console.log('[Capture] OCR result length:', ocrText.length, 'text:', JSON.stringify(ocrText.substring(0, 100)))

      return {
        ocrText,
        imageBase64,
        success: true,
      }
    } catch (err) {
      console.error('[Capture] Pipeline error:', err)
      return {
        ocrText: '',
        imageBase64: '',
        success: false,
        errorCode: 'PIPELINE_ERROR',
        errorMessage: `截图或OCR处理出错: ${err instanceof Error ? err.message : String(err)}`
      }
    }
  })

  // --- capture:detect-foreground — lightweight process detection (unchanged) ---
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

  // --- Overlay IPC ---

  ipcMain.handle('overlay:create', async (_event, processName: string, stepLabels: string[], isInvalid = false) => {
    await createOverlayWindow(processName, stepLabels, isInvalid)
  })

  ipcMain.handle('overlay:update', (_event, stepStates: { s: string; l: string }[], processName?: string) => {
    if (!overlay || overlay.isDestroyed()) return
    overlay.webContents.executeJavaScript(
      `window._render(${JSON.stringify(stepStates)}, ${JSON.stringify(processName ?? null)}, null)`
    ).catch(() => {})
  })

  ipcMain.handle('overlay:result', (_event, stepStates: { s: string; l: string }[], processName: string, resultText: string, isSuccess: boolean) => {
    if (!overlay || overlay.isDestroyed()) return

    // Resize for result line
    overlay.setSize(OVERLAY_W, computeOverlayHeight(stepStates.length, true))

    overlay.webContents.executeJavaScript(
      `window._render(${JSON.stringify(stepStates)}, ${JSON.stringify(processName)}, ${JSON.stringify({ t: resultText, ok: isSuccess })})`
    ).catch(() => {})

    // Trigger fade-out after result display
    const fadeDelay = isSuccess ? 2000 : 3000
    setTimeout(() => {
      if (overlay && !overlay.isDestroyed()) {
        overlay.webContents.executeJavaScript('window._startFadeOut()').catch(() => {})
        // Fallback destroy in case animationend doesn't fire
        setTimeout(() => destroyOverlay(), 500)
      }
    }, fadeDelay)
  })

  ipcMain.handle('overlay:close', () => {
    destroyOverlay()
  })
}
