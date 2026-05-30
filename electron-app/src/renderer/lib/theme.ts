export function applyTheme(theme: 'system' | 'light' | 'dark'): void {
  const root = document.documentElement

  const setClass = (dark: boolean): void => {
    if (dark) root.classList.add('dark')
    else root.classList.remove('dark')
  }

  if (theme === 'dark') {
    setClass(true)
  } else if (theme === 'light') {
    setClass(false)
  } else {
    // Follow system, with live listener for changes
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setClass(mq.matches)
    try { mq.addEventListener('change', (e) => setClass(e.matches)) } catch { /* ok */ }
  }
}
