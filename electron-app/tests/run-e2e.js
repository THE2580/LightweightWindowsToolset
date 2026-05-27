/**
 * E2E test runner for Electron app
 * Runs tests sequentially using Playwright's _electron API directly
 */
const { _electron: electron } = require('playwright')
const { join } = require('path')

const APP_ROOT = join(__dirname, '..')
const MAIN_ENTRY = join(APP_ROOT, 'out/main/index.js')

let passed = 0
let failed = 0

function ok(condition, name) {
  if (condition) { passed++; console.log('  OK ' + name) }
  else { failed++; console.log('  FAIL ' + name) }
}

async function run() {
  console.log('=== Electron App E2E Tests ===\n')

  console.log('Launching Electron app...')
  const app = await electron.launch({ args: [MAIN_ENTRY], cwd: APP_ROOT })
  const page = await app.firstWindow({ timeout: 15000 })
  await page.waitForLoadState('load')
  await page.waitForFunction(() => document.querySelector('#root')?.textContent?.length > 100, { timeout: 10000 })
  console.log('App launched successfully\n')

  try {
    // === App Shell ===
    console.log('--- App Shell ---')

    const titleText = await page.locator('.titlebar-drag span').first().textContent()
    ok(titleText.trim().length > 0, 'Title bar displays app title')
    ok(await page.locator('button[aria-label="Minimize"]').isVisible(), 'Minimize button visible')
    ok(await page.locator('button[aria-label="Close"]').isVisible(), 'Close button visible')

    // === Navigation ===
    console.log('\n--- Navigation ---')
    ok(await page.locator('h1').first().isVisible(), 'Home page heading visible')
    ok(await page.locator('text=Lightweight').isVisible(), 'Subtitle visible')

    // Settings button is in the bottom div (not inside nav)
    await page.locator('a, button:has-text("\u8BBE\u7F6E"), [href="/settings"]').last().click()
    await page.waitForTimeout(1000)
    ok(await page.locator('h1:has-text("\u8BBE\u7F6E")').isVisible(), 'Settings page accessible')

    // === Settings Tabs ===
    console.log('\n--- Settings Tabs ---')
    ok(await page.locator('button:has-text("\u901A\u7528")').isVisible(), 'General tab visible')
    ok(await page.locator('button:has-text("API")').isVisible(), 'API tab visible')
    ok(await page.locator('button:has-text("\u5FEB\u6377\u952E")').isVisible(), 'Hotkey tab visible')

    // === General Tab ===
    console.log('\n--- General Tab ---')
    ok(await page.locator('input').first().isVisible(), 'Window title input visible')
    ok(await page.locator('button:has-text("\u4FDD\u5B58")').first().isVisible(), 'Save button visible')
    ok(await page.locator('select').isVisible(), 'Close behavior dropdown visible')
    const selectText = await page.locator('select').textContent()
    ok(selectText.includes('\u76F4\u63A5\u9000\u51FA') && selectText.includes('\u7F29\u5C0F\u5230\u6258\u76D8'), 'Close behavior options: quit + tray')

    // === API Tab ===
    console.log('\n--- API Tab ---')
    await page.locator('button:has-text("API")').click()
    await page.waitForTimeout(300)
    ok(await page.locator('text=DeepSeek API Key').isVisible(), 'API Key section visible')
    ok(await page.locator('input[type="password"]').isVisible(), 'Password input visible')
    ok(await page.locator('input').nth(1).isVisible(), 'Model input visible')
    ok(await page.locator('input').nth(2).isVisible(), 'Backend URL input visible')

    // === Hotkey Tab ===
    console.log('\n--- Hotkey Tab ---')
    await page.locator('button:has-text("\u5FEB\u6377\u952E")').click()
    await page.waitForTimeout(300)
    ok(await page.locator('text=\u4F53\u529B\u6355\u83B7').first().isVisible(), 'Capture hotkey section visible')
    ok(await page.locator('text=AI \u804A\u5929').first().isVisible(), 'Chat hotkey section visible')

    // === AI Chat ===
    console.log('\n--- AI Chat Sidebar ---')
    // Navigate home first
    await page.goBack()
    await page.waitForTimeout(800)
    ok(await page.locator('h1').first().isVisible(), 'Back to home page')

    // Find AI Chat button
    const chatBtns = page.locator('button:has-text("\u804A\u5929")')
    ok(await chatBtns.first().isVisible(), 'AI Chat button visible')
    await chatBtns.first().click()
    await page.waitForTimeout(800)
    ok(await page.locator('textarea').isVisible(), 'Chat textarea visible')
    ok(await page.locator('button[aria-label="Send"]').isVisible(), 'Send button visible')
    ok(await page.locator('button:has-text("\u6E05\u7A7A\u8BB0\u5F55")').isVisible(), 'Clear history button visible')
    ok(await page.locator('text=\u53D1\u9001\u6D88\u606F').isVisible(), 'Empty state message visible')

    // Close chat
    await page.locator('button[aria-label="Close chat"]').click()
    await page.waitForTimeout(500)

    // === Sidebar Collapse ===
    console.log('\n--- Sidebar Collapse ---')
    ok(await page.locator('button[aria-label="Collapse sidebar"]').isVisible(), 'Collapse button visible')
    await page.locator('button[aria-label="Collapse sidebar"]').click()
    await page.waitForTimeout(500)
    ok(await page.locator('button[aria-label="Expand sidebar"]').isVisible(), 'Sidebar collapsed')
    await page.locator('button[aria-label="Expand sidebar"]').click()
    await page.waitForTimeout(500)
    ok(await page.locator('button[aria-label="Collapse sidebar"]').isVisible(), 'Sidebar expanded back')

    console.log('\n=== Done: ' + passed + ' passed, ' + failed + ' failed ===')
  } catch (err) {
    console.error('\nUnexpected error:', err.message)
    failed++
  } finally {
    await app.close()
    process.exit(failed > 0 ? 1 : 0)
  }
}

run().catch(e => { console.error(e); process.exit(1) })
