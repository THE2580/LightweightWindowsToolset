import { app } from 'electron'
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'

const BOOT_DIR: string = (() => {
  try { return app.getPath('userData') }
  catch { return join(app.getPath('home'), '.lightweight-windows-toolset') }
})()

const BOOT_FILE = join(BOOT_DIR, 'storage-path.json')
const CONFIG_FILENAME = 'config.json'

let _cachedDir: string | null = null

export function getStorageDir(): string {
  if (_cachedDir) return _cachedDir
  try {
    if (existsSync(BOOT_FILE)) {
      const raw = readFileSync(BOOT_FILE, 'utf-8')
      const data = JSON.parse(raw) as { path?: string }
      if (data.path && existsSync(data.path)) {
        _cachedDir = data.path
        return _cachedDir
      }
    }
  } catch { /* use default */ }
  _cachedDir = BOOT_DIR
  return _cachedDir
}

export function getStoragePathDisplay(): string {
  return getStorageDir()
}

function validateDir(dirPath: string): string | null {
  if (!dirPath || dirPath.trim().length === 0) {
    return 'Path cannot be empty'
  }
  if (!/^[A-Za-z]:[\\\\/]/.test(dirPath)) {
    return 'Please enter an absolute path, e.g. D:\\\\MyData'
  }
  const resolved = dirPath.trim()
  try {
    if (!existsSync(resolved)) {
      mkdirSync(resolved, { recursive: true })
    }
    const testFile = join(resolved, '.write_test')
    writeFileSync(testFile, 'ok', 'utf-8')
    unlinkSync(testFile)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return 'Path is not writable: ' + msg
  }
  return null
}

export function setStoragePath(newDir: string): { success: boolean; error?: string; newPath?: string } {
  const trimmed = newDir.trim()
  const validationError = validateDir(trimmed)
  if (validationError) {
    return { success: false, error: validationError }
  }

  const oldDir = getStorageDir()
  const oldConfig = join(oldDir, CONFIG_FILENAME)
  const newConfig = join(trimmed, CONFIG_FILENAME)

  if (oldDir === trimmed) {
    return { success: true, newPath: trimmed }
  }

  try {
    if (existsSync(oldConfig)) {
      copyFileSync(oldConfig, newConfig)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, error: 'Migration failed: ' + msg }
  }

  try {
    const data = JSON.stringify({ path: trimmed }, null, 2)
    writeFileSync(BOOT_FILE, data, 'utf-8')
  } catch (e) {
    try { if (existsSync(newConfig)) unlinkSync(newConfig) } catch { /* ok */ }
    const msg = e instanceof Error ? e.message : String(e)
    return { success: false, error: 'Failed to write boot file: ' + msg }
  }

  _cachedDir = trimmed
  return { success: true, newPath: trimmed }
}
