// OCR module using Windows.Media.Ocr via PowerShell
// Runs in main process; receives an image buffer, returns recognized text

import { execFile, type ChildProcess } from 'child_process'
import { writeFile, unlink, mkdtemp } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const PS_SCRIPT_TEMPLATE = `
# OCR via Windows.Media.Ocr — adaptive upscale edition
$ImagePath = '__IMAGEPATH__'
$CropX = __CROPX__
$CropY = __CROPY__
$CropW = __CROPW__
$CropH = __CROPH__

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 *> $null

try { Add-Type -AssemblyName System.Runtime.WindowsRuntime *> $null } catch { }
try { Add-Type -AssemblyName System.Drawing *> $null } catch { }

try {
  [Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType=WindowsRuntime] | Out-Null
  [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime] | Out-Null
  [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType=WindowsRuntime] | Out-Null
  [Windows.Globalization.Language, Windows.Globalization, ContentType=WindowsRuntime] | Out-Null
} catch { Write-Output "OCR_ERROR:WinRT_LOAD_FAILED"; exit 0 }

$asExtensions = [System.WindowsRuntimeSystemExtensions]
$asTaskMethod = $null
foreach ($m in $asExtensions.GetMethods()) {
  if ($m.Name -eq 'AsTask' -and $m.GetParameters().Count -eq 1) {
    $p = $m.GetParameters()[0]
    if ($p.ParameterType.IsGenericType) {
      $gt = $p.ParameterType.GetGenericTypeDefinition()
      if ($gt.Name -eq 'IAsyncOperation\`1') { $asTaskMethod = $m; break }
    }
  }
}
if (-not $asTaskMethod) { Write-Output "OCR_ERROR:REFLECTION"; exit 0 }

function Await-WinRT($asyncOp, [Type]$resultType, $timeoutMs = 10000) {
  $gmi = $asTaskMethod.MakeGenericMethod(@($resultType))
  $task = $gmi.Invoke($null, @($asyncOp))
  if (-not $task.Wait($timeoutMs)) { throw "Timeout" }
  return $task.Result
}

# --- Upscale only: NearestNeighbor preserves sharp edges for small text ---
function Upscale-Image($srcBitmap, [int]$targetW) {
  $srcW = $srcBitmap.Width
  $srcH = $srcBitmap.Height
  $scale = [Math]::Max(1.0, $targetW / $srcW)
  $outW = [int]($srcW * $scale)
  $outH = [int]($srcH * $scale)
  if ($outW -gt 3840) { $outH = [int]($outH * 3840 / $outW); $outW = 3840 }

  $out = New-Object System.Drawing.Bitmap($outW, $outH)
  $g = [System.Drawing.Graphics]::FromImage($out)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
  $g.DrawImage($srcBitmap, 0, 0, $outW, $outH)
  $g.Dispose()
  return $out
}

# --- Load, crop, upscale ---
$bitmap = $null
try {
  if ($CropW -gt 0 -and $CropH -gt 0) {
    $fullBmp = [System.Drawing.Bitmap]::FromFile($ImagePath)
    $cropRect = New-Object System.Drawing.Rectangle($CropX, $CropY, $CropW, $CropH)
    if ($cropRect.Right -gt $fullBmp.Width) { $cropRect.Width = $fullBmp.Width - $cropRect.X }
    if ($cropRect.Bottom -gt $fullBmp.Height) { $cropRect.Height = $fullBmp.Height - $cropRect.Y }
    if ($cropRect.X -lt 0) { $cropRect.X = 0; $cropRect.Width = $cropRect.Width + $CropX }
    if ($cropRect.Y -lt 0) { $cropRect.Y = 0; $cropRect.Height = $cropRect.Height + $CropY }
    if ($cropRect.Width -le 0 -or $cropRect.Height -le 0) {
      $processed = [System.Drawing.Bitmap]::FromFile($ImagePath)
    } else {
      $cropped = $fullBmp.Clone($cropRect, $fullBmp.PixelFormat)
      $fullBmp.Dispose()
      # Adaptive: <1200px wide → 3x, else → 2x (always enough height after upscale)
      if ($cropped.Width -lt 1200) { $targetW = $cropped.Width * 3 }
      else                         { $targetW = $cropped.Width * 2 }
      $processed = Upscale-Image $cropped $targetW
      $cropped.Dispose()
    }
  } else {
    $fullBmp = [System.Drawing.Bitmap]::FromFile($ImagePath)
    if ($fullBmp.Width -lt 1200) { $targetW = $fullBmp.Width * 3 }
    else                         { $targetW = $fullBmp.Width * 2 }
    $processed = Upscale-Image $fullBmp $targetW
    $fullBmp.Dispose()
  }

  $ms = New-Object System.IO.MemoryStream
  $processed.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $processed.Dispose()
  $ms.Seek(0, 0) | Out-Null

  $ras = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($ms)
  $decoder = Await-WinRT ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($ras)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await-WinRT ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
} catch {
  Write-Output "OCR_ERROR:BITMAP_LOAD:\$($_.Exception.Message)"
  exit 0
}

# --- OCR language fallback ---
$langs = @('zh-Hans-CN', 'zh-CN', 'zh-Hans', 'ja-JP', 'en-US')
$engine = $null; $usedLang = ''
foreach ($lang in $langs) {
  try { $wl = [Windows.Globalization.Language]::new($lang); $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($wl); if ($engine) { $usedLang = $lang; break } } catch { }
}
if (-not $engine) {
  try { $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages(); $usedLang = 'user-profile' } catch { }
}
if (-not $engine) { Write-Output "OCR_ERROR:NO_ENGINE"; exit 0 }

$result = $null
try { $result = Await-WinRT ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult]) }
catch { Write-Output "OCR_ERROR:RECOGNIZE:\$($_.Exception.Message)"; exit 0 }

if ($result -and $result.Text) {
  Write-Output "OCR_OK:$usedLang"
  Write-Output $result.Text
} else {
  Write-Output "OCR_OK:$usedLang:EMPTY"
}
`.trim()



function applyZeroCorrection(text: string): string {
  let corrected = text
  corrected = corrected.replace(/(\d)[oO](\d|\/)/g, '$10$2')
  corrected = corrected.replace(/(^|\s)[oO](?=\/)/g, '$10')
  corrected = corrected.replace(/(?<!\d)[oO](\d)/g, '0$1')
  return corrected
}

async function runOcr(
  imgPath: string,
  crop?: { x: number; y: number; w: number; h: number }
): Promise<string> {
  let childProcess: ChildProcess | null = null
  const escapedPath = imgPath.replace(/\\/g, '\\\\')
  let script = PS_SCRIPT_TEMPLATE.replace('__IMAGEPATH__', escapedPath)
  script = script.replace('__CROPX__', String(crop?.x ?? 0))
  script = script.replace('__CROPY__', String(crop?.y ?? 0))
  script = script.replace('__CROPW__', String(crop?.w ?? 0))
  script = script.replace('__CROPH__', String(crop?.h ?? 0))
  const psPath = join(tmpdir(), `lwt-ocr-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`)

  try {
    await writeFile(psPath, script, 'utf-8')
    return await new Promise<string>((resolve) => {
      childProcess = execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psPath],
        { timeout: 15000, encoding: 'utf-8', windowsHide: true },
        (err, stdout, stderr) => {
          childProcess = null
          const output = (stdout || '').trim()
          if (stderr) console.error('[OCR] PS stderr:', stderr.trim())
          if (err) console.error('[OCR] PS exit error:', err.message)
          const lines = output.split(/\r?\n/)
          if (lines.length === 0) { console.error('[OCR] No output'); resolve(''); return }
          const statusLine = lines[0]
          if (statusLine.startsWith('OCR_ERROR:')) { console.error('[OCR] Error:', statusLine); resolve(''); return }
          if (statusLine.startsWith('OCR_OK:')) {
            console.log('[OCR] OK, lang:', statusLine)
            resolve(lines.slice(1).join('\n').trim())
            return
          }
          resolve(output)
        }
      )
    })
  } finally {
    unlink(psPath).catch(() => {})
    if (childProcess) { try { childProcess.kill() } catch { } }
  }
}

export async function recognizeText(
  imageBuffer: Buffer,
  crop?: { x: number; y: number; w: number; h: number }
): Promise<string> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'lwt-ocr-'))
  const imgPath = join(tmpDir, 'capture.png')
  try {
    await writeFile(imgPath, imageBuffer)
    console.log('[OCR] Image:', imgPath, imageBuffer.length, 'bytes')
    const rawText = await runOcr(imgPath, crop)
    if (!rawText) { console.error('[OCR] No text'); return '' }
    const corrected = applyZeroCorrection(rawText.trim())
    if (corrected !== rawText.trim()) console.log('[OCR] Zero-corrected')
    return corrected
  } catch (e) {
    console.error('[OCR] Exception:', e)
    return ''
  } finally {
    unlink(imgPath).catch(() => {})
  }
}
