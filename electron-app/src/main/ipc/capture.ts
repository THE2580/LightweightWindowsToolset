import { ipcMain, Notification } from 'electron'
import screenshot from 'screenshot-desktop'
import { recognizeText } from '../utils/ocr'

interface CaptureResult {
  ocrText: string
  imageBase64: string
}

export function registerCaptureIpc(): void {
  ipcMain.handle('capture:trigger', async (): Promise<CaptureResult> => {
    try {
      const imgBuffer: Buffer = await screenshot({ format: 'png' })
      const ocrText = await recognizeText(imgBuffer)
      const imageBase64 = imgBuffer.toString('base64')

      // Show success notification
      new Notification({
        title: '体力捕获完成',
        body: ocrText ? `识别结果: ${ocrText.substring(0, 50)}${ocrText.length > 50 ? '...' : ''}` : '未识别到文字',
        silent: false
      }).show()

      return { ocrText, imageBase64 }
    } catch (err) {
      console.error('[Capture] Pipeline error:', err)

      // Show failure notification
      new Notification({
        title: '体力捕获失败',
        body: '截图或 OCR 处理出错，请重试',
        silent: false
      }).show()

      return { ocrText: '', imageBase64: '' }
    }
  })
}
