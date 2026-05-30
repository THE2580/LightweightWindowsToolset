import { app } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync } from 'fs'

let backendProcess: ChildProcess | null = null

const PYTHON_EXE = 'E:\\devtools\\python\\python-3.14.5\\pythonw.exe'
const BACKEND_DIR = 'E:\\codex_agent_project\\AndroidGameInfoTools\\backend'

export function isBackendRunning(): boolean {
  return backendProcess !== null && backendProcess.exitCode === null
}

export function startBackend(): boolean {
  if (isBackendRunning()) return true

  const mainPy = join(BACKEND_DIR, 'main.py')
  if (!existsSync(mainPy)) {
    console.error('[backend-process] main.py not found at', mainPy)
    return false
  }

  try {
    backendProcess = spawn(PYTHON_EXE, ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000'], {
      cwd: BACKEND_DIR,
      stdio: 'ignore',
      detached: false,
      windowsHide: true,
    })

    backendProcess.on('error', (err) => {
      console.error('[backend-process] spawn error:', err.message)
      backendProcess = null
    })

    backendProcess.on('exit', (code, signal) => {
      console.log('[backend-process] exited, code:', code, 'signal:', signal)
      backendProcess = null
    })

    // Don't wait - unref so it doesn't block app exit
    backendProcess.unref()

    console.log('[backend-process] Started, pid:', backendProcess.pid)
    return true
  } catch (e) {
    console.error('[backend-process] Failed to start:', e)
    return false
  }
}

export function stopBackend(): void {
  if (!backendProcess || backendProcess.exitCode !== null) {
    backendProcess = null
    return
  }

  try {
    // Graceful: send CTRL_C_EVENT equivalent via taskkill
    const pid = backendProcess.pid
    if (pid) {
      // Use taskkill to kill the pythonw process tree
      spawn('taskkill', ['/pid', String(pid), '/f', '/t'], {
        stdio: 'ignore',
        windowsHide: true,
      })
    }
    backendProcess = null
    console.log('[backend-process] Stopped')
  } catch (e) {
    console.error('[backend-process] Stop error:', e)
    backendProcess = null
  }
}
