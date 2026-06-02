import { createHash } from 'crypto'
import { createWriteStream, existsSync, mkdirSync, readdirSync, rmSync } from 'fs'
import { basename, dirname, join } from 'path'
import { pipeline } from 'stream/promises'
import { app, BrowserWindow, ipcMain, net, shell } from 'electron'
import { getStore } from './settings'

type Distribution = 'installer' | 'portable' | 'development'
type UpdatePhase = 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'downloaded' | 'error'
type UpdateCheckSource = 'manual' | 'auto'

interface ReleaseAsset {
  name: string
  browser_download_url: string
  size: number
  digest?: string
}

interface GitHubRelease {
  tag_name: string
  html_url: string
  name: string
  body: string
  draft: boolean
  prerelease: boolean
  assets: ReleaseAsset[]
}

interface UpdateInfo {
  currentVersion: string
  latestVersion: string
  releaseName: string
  releaseNotes: string
  releaseUrl: string
  distribution: Distribution
  assetName: string
  assetSize: number
}

interface UpdateState {
  phase: UpdatePhase
  currentVersion: string
  distribution: Distribution
  info: UpdateInfo | null
  downloadedBytes: number
  totalBytes: number
  percent: number
  downloadedPath: string | null
  message: string
  checksum: 'pending' | 'verified' | 'unavailable'
  checkSource: UpdateCheckSource | null
}

const RELEASE_API = 'https://api.github.com/repos/THE2580/LightweightWindowsToolset/releases/latest'
const RELEASE_LATEST_PAGE = 'https://github.com/THE2580/LightweightWindowsToolset/releases/latest'
const RELEASE_DOWNLOAD_BASE = 'https://github.com/THE2580/LightweightWindowsToolset/releases/download'
const USER_AGENT = 'LightweightWindowsToolset-Updater'

let mainWindow: BrowserWindow | null = null
let state: UpdateState = createInitialState()
let downloadPromise: Promise<UpdateState> | null = null

function detectDistribution(): Distribution {
  if (!app.isPackaged) {
    if (process.env['LWT_UPDATE_DISTRIBUTION'] === 'installer') return 'installer'
    if (process.env['LWT_UPDATE_DISTRIBUTION'] === 'portable') return 'portable'
    return 'development'
  }
  try {
    const entries = readdirSync(dirname(process.execPath))
    return entries.some((name) => /^(unins|uninstall).*\.exe$/i.test(name)) ? 'installer' : 'portable'
  } catch { /* portable is the conservative fallback */ }
  return 'portable'
}

function createInitialState(): UpdateState {
  return {
    phase: 'idle',
    currentVersion: currentVersion(),
    distribution: detectDistribution(),
    info: null,
    downloadedBytes: 0,
    totalBytes: 0,
    percent: 0,
    downloadedPath: null,
    message: '',
    checksum: 'pending',
    checkSource: null
  }
}

function currentVersion(): string {
  return process.env['LWT_UPDATE_CURRENT_VERSION'] || app.getVersion()
}

function emitState(): void {
  mainWindow?.webContents.send('updater:state', state)
}

function setState(patch: Partial<UpdateState>): UpdateState {
  state = { ...state, ...patch }
  emitState()
  return state
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '').split('-')[0]
}

function compareVersions(left: string, right: string): number {
  const a = normalizeVersion(left).split('.').map((value) => Number.parseInt(value, 10) || 0)
  const b = normalizeVersion(right).split('.').map((value) => Number.parseInt(value, 10) || 0)
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const delta = (a[index] || 0) - (b[index] || 0)
    if (delta !== 0) return delta > 0 ? 1 : -1
  }
  return 0
}

function assetPattern(distribution: Distribution): RegExp {
  return distribution === 'portable'
    ? /^LightweightWindowsToolset-v[\d.]+-portable-win-x64\.zip$/i
    : /^LightweightWindowsToolset-v[\d.]+-setup-win-x64\.exe$/i
}

function updateDownloadsDir(): string {
  return join(app.getPath('downloads'), 'LightweightWindowsToolset')
}

async function fetchLatestRelease(): Promise<GitHubRelease> {
  const response = await net.fetch(RELEASE_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': USER_AGENT,
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })
  if (response.ok) return await response.json() as GitHubRelease
  console.warn(`[updater] GitHub Release API failed: HTTP ${response.status}, falling back to releases/latest page`)
  const pageResponse = await net.fetch(RELEASE_LATEST_PAGE, { headers: { 'User-Agent': USER_AGENT } })
  if (!pageResponse.ok) throw new Error(`GitHub Release 页面请求失败: HTTP ${pageResponse.status}`)
  const html = await pageResponse.text()
  const tag = html.match(/\/releases\/tag\/(v[\d.]+)/i)?.[1]
    ?? html.match(/\/releases\/download\/(v[\d.]+)/i)?.[1]
  if (!tag) throw new Error('无法从 GitHub Release 页面解析最新版本')
  const version = normalizeVersion(tag)
  const setupName = `LightweightWindowsToolset-v${version}-setup-win-x64.exe`
  const portableName = `LightweightWindowsToolset-v${version}-portable-win-x64.zip`
  return {
    tag_name: tag,
    html_url: `https://github.com/THE2580/LightweightWindowsToolset/releases/tag/${tag}`,
    name: `LightweightWindowsToolset ${tag}`,
    body: '',
    draft: false,
    prerelease: false,
    assets: [
      { name: setupName, browser_download_url: `${RELEASE_DOWNLOAD_BASE}/${tag}/${setupName}`, size: 0 },
      { name: portableName, browser_download_url: `${RELEASE_DOWNLOAD_BASE}/${tag}/${portableName}`, size: 0 }
    ]
  }
}

async function checkForUpdates(checkSource: UpdateCheckSource): Promise<UpdateState> {
  if (state.phase === 'downloading') return state
  setState({ phase: 'checking', checkSource, message: '正在检查更新...', downloadedPath: null, percent: 0, downloadedBytes: 0, totalBytes: 0, checksum: 'pending' })
  try {
    const release = await fetchLatestRelease()
    if (release.draft || release.prerelease) throw new Error('最新 Release 不是正式版本')
    const latestVersion = normalizeVersion(release.tag_name)
    if (compareVersions(latestVersion, currentVersion()) <= 0) {
      return setState({ phase: 'up-to-date', info: null, message: '当前已是最新版本' })
    }
    const distribution = detectDistribution()
    const asset = release.assets.find((item) => assetPattern(distribution).test(item.name))
    if (!asset) throw new Error(`未找到适用于${distribution === 'portable' ? '便携版' : '安装版'}的更新资产`)
    return setState({
      phase: 'available',
      distribution,
      info: {
        currentVersion: currentVersion(),
        latestVersion,
        releaseName: release.name || release.tag_name,
        releaseNotes: release.body || '',
        releaseUrl: release.html_url,
        distribution,
        assetName: asset.name,
        assetSize: asset.size
      },
      totalBytes: asset.size,
      message: `发现新版本 v${latestVersion}`
    })
  } catch (error) {
    return setState({ phase: 'error', info: null, message: error instanceof Error ? error.message : '检查更新失败' })
  }
}

async function sha256(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  const { createReadStream } = await import('fs')
  await pipeline(createReadStream(filePath), hash)
  return hash.digest('hex')
}

async function downloadUpdate(): Promise<UpdateState> {
  if (downloadPromise) return downloadPromise
  downloadPromise = (async () => {
    let target: string | null = null
    try {
      if (!state.info) throw new Error('请先检查更新')
      if (state.distribution === 'development') throw new Error('开发版不执行真实更新下载')
      const release = await fetchLatestRelease()
      const asset = release.assets.find((item) => item.name === state.info?.assetName)
      if (!asset) throw new Error('更新资产已不存在，请重新检查更新')
      const dir = updateDownloadsDir()
      mkdirSync(dir, { recursive: true })
      target = join(dir, basename(asset.name))
      if (existsSync(target)) rmSync(target, { force: true })
      setState({ phase: 'downloading', downloadedBytes: 0, totalBytes: asset.size, percent: 0, downloadedPath: null, checksum: 'pending', message: '正在下载更新...' })
      const response = await net.fetch(asset.browser_download_url, { headers: { 'User-Agent': USER_AGENT } })
      if (!response.ok || !response.body) throw new Error(`下载安装包失败: HTTP ${response.status}`)
      const totalBytes = asset.size || Number.parseInt(response.headers.get('content-length') || '0', 10) || 0
      setState({ totalBytes })
      const writer = createWriteStream(target)
      const reader = response.body.getReader()
      let downloadedBytes = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        downloadedBytes += value.byteLength
        const percent = totalBytes > 0 ? Math.min(100, Math.round(downloadedBytes / totalBytes * 100)) : 0
        setState({ downloadedBytes, percent })
        if (!writer.write(value)) await new Promise<void>((resolve) => writer.once('drain', resolve))
      }
      await new Promise<void>((resolve, reject) => {
        writer.end(resolve)
        writer.once('error', reject)
      })
      const expected = asset.digest?.match(/^sha256:(.+)$/i)?.[1]?.toLowerCase()
      if (expected) {
        const actual = await sha256(target)
        if (actual.toLowerCase() !== expected) {
          rmSync(target, { force: true })
          throw new Error('SHA-256 校验失败，已删除下载文件')
        }
      }
      return setState({
        phase: 'downloaded',
        downloadedBytes,
        percent: 100,
        downloadedPath: target,
        checksum: expected ? 'verified' : 'unavailable',
        message: expected ? '下载完成，SHA-256 校验通过' : '下载完成，Release 未提供校验摘要'
      })
    } catch (error) {
      if (target && existsSync(target)) rmSync(target, { force: true })
      return setState({ phase: 'error', message: error instanceof Error ? error.message : '下载更新失败' })
    } finally {
      downloadPromise = null
    }
  })()
  return downloadPromise
}

async function applyDownloadedUpdate(): Promise<void> {
  if (!state.downloadedPath || !existsSync(state.downloadedPath)) throw new Error('未找到已下载的更新文件')
  if (state.distribution === 'portable') {
    shell.showItemInFolder(state.downloadedPath)
    return
  }
  const error = await shell.openPath(state.downloadedPath)
  if (error) throw new Error(`启动安装程序失败: ${error}`)
  app.quit()
}

export function registerUpdaterIpc(window: BrowserWindow): void {
  mainWindow = window
  state = createInitialState()
  ipcMain.handle('updater:get-state', () => state)
  ipcMain.handle('updater:check', () => checkForUpdates('manual'))
  ipcMain.handle('updater:download', () => downloadUpdate())
  ipcMain.handle('updater:apply', () => applyDownloadedUpdate())
  ipcMain.handle('updater:open-release', () => state.info ? shell.openExternal(state.info.releaseUrl) : undefined)
}

export function scheduleAutoUpdateCheck(): void {
  if (!(getStore().get('autoCheckUpdates', true) as boolean)) return
  setTimeout(() => {
    checkForUpdates('auto').catch((error) => console.error('[updater] Auto-check failed:', error))
  }, 5000)
}
