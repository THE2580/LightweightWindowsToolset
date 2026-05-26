import { ipcMain } from 'electron'

// Placeholder capture handler — real screenshot + OCR pipeline will be wired later
// Using screenshot-desktop for GDI capture and Windows.Media.Ocr for text extraction

export function registerCaptureIpc(): void {
  ipcMain.handle('capture:trigger', async () => {
    // Phase 1: mock response for scaffolding verification
    // Phase 2: screenshot-desktop → worker_thread OCR → return text
    return {
      ocrText: '62/200 原粹树脂',
      imageBase64: ''
    }
  })
}
