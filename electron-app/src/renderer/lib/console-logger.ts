let installed = false

export function installRendererLogger(): void {
  if (installed) return
  installed = true
  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      try { window.api.logs.append(level, args) } catch { /* logging is non-critical */ }
    }
  }
  console.info('[Logs] Renderer logger initialized')
}
