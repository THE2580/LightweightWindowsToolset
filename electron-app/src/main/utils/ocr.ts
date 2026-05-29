// OCR module using Windows.Media.Ocr via PowerShell
// Runs in main process; receives an image buffer, returns recognized text

import { execFile } from 'child_process'
import { writeFile, unlink, mkdtemp } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * PowerShell OCR script template.
 * Uses System.IO.File.ReadAllBytes + InMemoryRandomAccessStream to load the image,
 * avoiding unreliable WinRT StorageFile.GetFileFromPathAsync in PowerShell.
 * __IMAGEPATH__ is replaced at runtime with the actual PNG path.
 */
const PS_SCRIPT_TEMPLATE = `
# OCR via Windows.Media.Ocr — optimized edition
# Params: $ImagePath (PNG file), $CropX $CropY $CropW $CropH (optional crop rect)
$ImagePath = '__IMAGEPATH__'
$CropX = __CROPX__
$CropY = __CROPY__
$CropW = __CROPW__
$CropH = __CROPH__

# Force UTF-8 output encoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 *> $null

try { Add-Type -AssemblyName System.Runtime.WindowsRuntime *> $null } catch { }
try { Add-Type -AssemblyName System.Drawing *> $null } catch { }

# Load WinRT types
try {
  [Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType=WindowsRuntime] | Out-Null
  [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime] | Out-Null
  [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType=WindowsRuntime] | Out-Null
  [Windows.Globalization.Language, Windows.Globalization, ContentType=WindowsRuntime] | Out-Null
} catch {
  Write-Output "OCR_ERROR:WinRT_LOAD_FAILED"
  exit 0
}

# --- One-time reflection setup (cached, not per-call) ---
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
if (-not $asTaskMethod) {
  Write-Output "OCR_ERROR:REFLECTION:Cannot find AsTask<T> method"
  exit 0
}

function Await-WinRT($asyncOp, [Type]$resultType, $timeoutMs = 10000) {
  $gmi = $asTaskMethod.MakeGenericMethod(@($resultType))
  $task = $gmi.Invoke($null, @($asyncOp))
  if (-not $task.Wait($timeoutMs)) { throw "Async op timed out after \${timeoutMs}ms" }
  return $task.Result
}

# --- Load and crop image ---
$bitmap = $null
try {
  if ($CropW -gt 0 -and $CropH -gt 0) {
    # Crop with System.Drawing (synchronous, fast) then convert to SoftwareBitmap
    $fullBmp = [System.Drawing.Bitmap]::FromFile($ImagePath)
    $cropRect = New-Object System.Drawing.Rectangle($CropX, $CropY, $CropW, $CropH)
    # Ensure crop rect is within image bounds
    if ($cropRect.Right -gt $fullBmp.Width) { $cropRect.Width = $fullBmp.Width - $cropRect.X }
    if ($cropRect.Bottom -gt $fullBmp.Height) { $cropRect.Height = $fullBmp.Height - $cropRect.Y }
    if ($cropRect.X -lt 0) { $cropRect.X = 0; $cropRect.Width = $cropRect.Width + $CropX }
    if ($cropRect.Y -lt 0) { $cropRect.Y = 0; $cropRect.Height = $cropRect.Height + $CropY }
    if ($cropRect.Width -le 0 -or $cropRect.Height -le 0) {
      # Fallback to full image
      $ms = New-Object System.IO.MemoryStream
      [System.Drawing.Image]::FromFile($ImagePath).Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
      $ms.Seek(0, 0) | Out-Null
    } else {
      $croppedBmp = $fullBmp.Clone($cropRect, $fullBmp.PixelFormat)
      $ms = New-Object System.IO.MemoryStream
      $croppedBmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
      $croppedBmp.Dispose()
      $ms.Seek(0, 0) | Out-Null
    }
    $fullBmp.Dispose()
  } else {
    # No crop — load full image
    $ms = New-Object System.IO.MemoryStream
    [System.Drawing.Image]::FromFile($ImagePath).Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $ms.Seek(0, 0) | Out-Null
  }

  $ras = [System.IO.WindowsRuntimeStreamExtensions]::AsRandomAccessStream($ms)
  $decoder = Await-WinRT ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($ras)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $bitmap = Await-WinRT ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
} catch {
  Write-Output "OCR_ERROR:BITMAP_LOAD:\$($_.Exception.Message)"
  exit 0
}

# --- Try OCR languages ---
$langs = @('zh-Hans-CN', 'zh-CN', 'zh-Hans', 'ja-JP', 'en-US')
$engine = $null
$usedLang = ''

foreach ($lang in $langs) {
  try {
    $wl = [Windows.Globalization.Language]::new($lang)
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($wl)
    if ($engine) { $usedLang = $lang; break }
  } catch { }
}

if (-not $engine) {
  try {
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    $usedLang = 'user-profile'
  } catch { }
}

if (-not $engine) {
  Write-Output "OCR_ERROR:NO_ENGINE"
  exit 0
}

# --- Run recognition ---
$result = $null
try {
  $result = Await-WinRT ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
} catch {
  Write-Output "OCR_ERROR:RECOGNIZE:\$($_.Exception.Message)"
  exit 0
}

if ($result -and $result.Text) {
  Write-Output "OCR_OK:$usedLang"
  Write-Output $result.Text
} else {
  Write-Output "OCR_OK:$usedLang:EMPTY"
}
`.trim()



/**
 * Apply zero-correction to OCR output.
 * OCR engines commonly misrecognize digit 0 as letter o/O.
 */
function applyZeroCorrection(text: string): string {
  let corrected = text
  corrected = corrected.replace(/(\d)[oO](\d|\/)/g, '$10$2')
  corrected = corrected.replace(/(^|\s)[oO](?=\/)/g, '$10')
  corrected = corrected.replace(/(?<!\d)[oO](\d)/g, '0$1')
  return corrected
}

/**
 * Execute OCR PowerShell script with the image path baked into the script.
 */
async function runOcr(
  imgPath: string,
  crop?: { x: number; y: number; w: number; h: number }
): Promise<string> {
  // Embed the image path directly in the script to avoid parameter-passing issues
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
      execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psPath],
        { timeout: 15000, encoding: 'utf-8', windowsHide: true },
        (err, stdout, stderr) => {
          const output = (stdout || '').trim()
          if (stderr) {
            console.error('[OCR] PowerShell stderr:', stderr.trim())
          }
          if (err) {
            console.error('[OCR] PowerShell exit error:', err.message)
          }

          const lines = output.split(/\r?\n/)
          if (lines.length === 0) {
            console.error('[OCR] No output from PowerShell')
            resolve('')
            return
          }

          const statusLine = lines[0]
          if (statusLine.startsWith('OCR_ERROR:')) {
            console.error('[OCR] Engine error:', statusLine)
            resolve('')
            return
          }
          if (statusLine.startsWith('OCR_OK:')) {
            console.log('[OCR] Engine success, language:', statusLine)
            const text = lines.slice(1).join('\n').trim()
            resolve(text)
            return
          }

          // Legacy: output is just text
          resolve(output)
        }
      )
    })
  } finally {
    unlink(psPath).catch(() => {})
  }
}

/**
 * Run OCR on a PNG image buffer using Windows.Media.Ocr
 * Applies zero-correction before returning.
 * Returns the recognized text, or empty string on failure.
 */
export async function recognizeText(
  imageBuffer: Buffer,
  crop?: { x: number; y: number; w: number; h: number }
): Promise<string> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'lwt-ocr-'))
  const imgPath = join(tmpDir, 'capture.png')

  try {
    await writeFile(imgPath, imageBuffer)
    console.log('[OCR] Image written to:', imgPath, 'size:', imageBuffer.length)

    const rawText = await runOcr(imgPath, crop)

    if (!rawText) {
      console.error('[OCR] No text recognized from image')
      return ''
    }

    const corrected = applyZeroCorrection(rawText.trim())
    if (corrected !== rawText.trim()) {
      console.log('[OCR] Zero-correction applied:', JSON.stringify(rawText.trim()), '→', JSON.stringify(corrected))
    }
    return corrected
  } catch (e) {
    console.error('[OCR] Exception:', e)
    return ''
  } finally {
    unlink(imgPath).catch(() => {})
  }
}
