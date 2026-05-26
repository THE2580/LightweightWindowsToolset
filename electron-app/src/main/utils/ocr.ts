// OCR module using Windows.Media.Ocr via PowerShell
// Runs in main process; receives an image buffer, returns recognized text

import { execFile } from 'child_process'
import { writeFile, unlink, mkdtemp } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const PS_SCRIPT = `
param([string]$ImagePath)

[System.Reflection.Assembly]::LoadWithPartialName("System.Runtime.WindowsRuntime") | Out-Null

$file = [Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath).GetAwaiter().GetResult()
$stream = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read).GetAwaiter().GetResult()
$decoder = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream).GetAwaiter().GetResult()
$bitmap = $decoder.GetSoftwareBitmapAsync().GetAwaiter().GetResult()

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
if (-not $engine) {
  Write-Error "Failed to create OCR engine"
  exit 1
}

$result = $engine.RecognizeAsync($bitmap).GetAwaiter().GetResult()
$result.Text
`.trim()

/**
 * Run OCR on a PNG image buffer using Windows.Media.Ocr
 * Returns the recognized text, or empty string on failure
 */
export async function recognizeText(imageBuffer: Buffer): Promise<string> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'lwt-ocr-'))
  const imgPath = join(tmpDir, 'capture.png')
  const psPath = join(tmpDir, 'ocr.ps1')

  try {
    await writeFile(imgPath, imageBuffer)
    await writeFile(psPath, PS_SCRIPT, 'utf-8')

    const text = await new Promise<string>((resolve, reject) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psPath, '-ImagePath', imgPath],
        { timeout: 10000, encoding: 'utf-8', windowsHide: true },
        (err, stdout, stderr) => {
          if (err) {
            console.error('[OCR] PowerShell error:', err.message, stderr)
            // Don't reject — return empty string and let caller decide
            resolve('')
            return
          }
          resolve((stdout || '').trim())
        }
      )
    })

    return text
  } catch (e) {
    console.error('[OCR] Exception:', e)
    return ''
  } finally {
    // Cleanup temp files
    unlink(imgPath).catch(() => {})
    unlink(psPath).catch(() => {})
  }
}
