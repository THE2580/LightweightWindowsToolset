// OCR module using Windows.Media.Ocr via PowerShell with language fallback
// Runs in main process; receives an image buffer, returns recognized text

import { execFile } from 'child_process'
import { writeFile, unlink, mkdtemp } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const PS_SCRIPT_BASE = `
param([string]$ImagePath)

[System.Reflection.Assembly]::LoadWithPartialName("System.Runtime.WindowsRuntime") | Out-Null

$file = [Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath).GetAwaiter().GetResult()
$stream = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read).GetAwaiter().GetResult()
$decoder = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream).GetAwaiter().GetResult()
$bitmap = $decoder.GetSoftwareBitmapAsync().GetAwaiter().GetResult()

# Try to create OCR engine with specified language, fallback to user profile
$engine = $null
try {
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new("__LANG__"))
} catch { }

if (-not $engine) {
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
}

if (-not $engine) {
  Write-Error "OCR_ENGINE_FAILED:No OCR engine available for any language"
  exit 1
}

$result = $engine.RecognizeAsync($bitmap).GetAwaiter().GetResult()
if ($result -and $result.Text) {
  $result.Text
} else {
  # Return empty string on no text found (not an error)
  ""
}
`.trim()

const LANGUAGE_FALLBACKS = ['zh-Hans-CN', 'ja-JP', 'en-US', 'zh-Hans', 'zh-CN']

/**
 * Run OCR on a PNG image buffer using Windows.Media.Ocr
 * Tries multiple language packs in order, falls back to user profile languages.
 * Returns the recognized text, or empty string on failure.
 */
export async function recognizeText(imageBuffer: Buffer): Promise<string> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'lwt-ocr-'))
  const imgPath = join(tmpDir, 'capture.png')

  try {
    await writeFile(imgPath, imageBuffer)

    // Try each language in order, then fall back to user profile
    for (const lang of LANGUAGE_FALLBACKS) {
      const text = await runOcr(imgPath, lang)
      if (text && text.trim()) {
        return text.trim()
      }
      // Empty result with this language, try next
    }

    // Final fallback: user profile languages
    const text = await runOcr(imgPath, '')
    return text.trim()
  } catch (e) {
    console.error('[OCR] Exception:', e)
    return ''
  } finally {
    // Cleanup temp files
    unlink(imgPath).catch(() => {})
  }
}

/**
 * Execute OCR with a specific language
 * @param imgPath - path to PNG image file
 * @param language - BCP-47 language tag, or empty string to use user profile languages
 */
async function runOcr(imgPath: string, language: string): Promise<string> {
  const psPath = join(tmpdir(), `lwt-ocr-${Date.now()}-${Math.random().toString(36).slice(2)}.ps1`)
  const script = language ? PS_SCRIPT_BASE.replace('__LANG__', language) : PS_SCRIPT_BASE.replace(/^.*__LANG__.*\n/m, '')

  try {
    await writeFile(psPath, script, 'utf-8')

    return await new Promise<string>((resolve, reject) => {
      execFile(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psPath, '-ImagePath', imgPath],
        { timeout: 15000, encoding: 'utf-8', windowsHide: true },
        (err, stdout, stderr) => {
          if (err) {
            const errMsg = stderr || err.message
            if (errMsg.includes('OCR_ENGINE_FAILED')) {
              // Engine not available for this language - expected for fallback attempts
              resolve('')
              return
            }
            console.error(`[OCR] Error (lang=${language}):`, errMsg)
            resolve('')
            return
          }
          resolve((stdout || '').trim())
        }
      )
    })
  } finally {
    unlink(psPath).catch(() => {})
  }
}
