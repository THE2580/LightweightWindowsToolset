import { ipcMain } from 'electron'
import screenshot from 'screenshot-desktop'
import { recognizeText } from '../utils/ocr'

interface CaptureResult {
  ocrText: string
  imageBase64: string
}

export function registerCaptureIpc(): void {
  ipcMain.handle('capture:trigger', async (): Promise<CaptureResult> => {
    try {
      // Step 1: Capture all displays using GDI (screenshot-desktop default)
      const imgBuffer: Buffer = await screenshot({ format: 'png' })

      // Step 2: Run OCR
      const ocrText = await recognizeText(imgBuffer)

      // Step 3: Encode to base64 for renderer preview
      const imageBase64 = imgBuffer.toString('base64')

      return { ocrText, imageBase64 }
    } catch (err) {
      console.error('[Capture] Pipeline error:', err)
      return { ocrText: '', imageBase64: '' }
    }
  })
}
