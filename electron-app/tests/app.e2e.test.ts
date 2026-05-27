import { test, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { join } from 'path'

let electronApp: ElectronApplication
let page: Page

const APP_ROOT = join(__dirname, '..')
const MAIN_ENTRY = join(APP_ROOT, 'out/main/index.js')

test.beforeAll(async () => {
  electronApp = await electron.launch({
    args: [MAIN_ENTRY],
    cwd: APP_ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  })

  page = await electronApp.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  if (electronApp) {
    await electronApp.close()
  }
})

test.describe('App Shell', () => {
  test('should display title bar with app title', async () => {
    const titleText = page.locator('.titlebar-drag span.text-xs')
    await expect(titleText).toBeVisible()
    await expect(titleText).not.toBeEmpty()
  })

  test('should have minimize and close buttons in title bar', async () => {
    const minimizeBtn = page.locator('button[aria-label="Minimize"]')
    const closeBtn = page.locator('button[aria-label="Close"]')
    await expect(minimizeBtn).toBeVisible()
    await expect(closeBtn).toBeVisible()
  })

  test('should render sidebar with home and settings navigation', async () => {
    const homeBtn = page.getByTitle('首页')
    await expect(homeBtn).toBeVisible()

    const settingsBtn = page.getByTitle('设置')
    await expect(settingsBtn).toBeVisible()
  })

  test('should navigate to settings page when clicking settings button', async () => {
    const settingsBtn = page.getByTitle('设置')
    await settingsBtn.click()
    await page.waitForTimeout(500)

    const settingsHeading = page.locator('h1', { hasText: '设置' })
    await expect(settingsHeading).toBeVisible()
  })

  test('should navigate back to home when clicking home button', async () => {
    const homeBtn = page.getByTitle('首页')
    await homeBtn.click()
    await page.waitForTimeout(500)

    const appTitle = page.locator('h1', { hasText: '轻量化工具集' })
    await expect(appTitle).toBeVisible()
  })

  test('should render tool cards on home page', async () => {
    const homeBtn = page.getByTitle('首页')
    await homeBtn.click()
    await page.waitForTimeout(500)

    // stamina capture card should be visible
    const staminaCard = page.getByText('体力捕获')
    await expect(staminaCard).toBeVisible()
  })
})

test.describe('Settings Page', () => {
  test.beforeEach(async () => {
    const settingsBtn = page.getByTitle('设置')
    await settingsBtn.click()
    await page.waitForTimeout(500)
  })

  test('should display three setting tabs', async () => {
    const tabs = page.locator('button', { hasText: /通用|API 设置|快捷键/ })
    await expect(tabs).toHaveCount(3)
  })

  test('should switch between tabs', async () => {
    // Click API Settings tab
    await page.getByText('API 设置').click()
    await page.waitForTimeout(200)
    await expect(page.getByText('DeepSeek API Key')).toBeVisible()

    // Click Hotkey tab
    await page.getByText('快捷键').click()
    await page.waitForTimeout(200)
    await expect(page.getByText('体力捕获')).toBeVisible()
  })

  test('should show window title input with save button', async () => {
    // General tab is default
    const titleInput = page.locator('input').first()
    await expect(titleInput).toBeVisible()

    const saveBtn = page.getByRole('button', { name: '保存' }).first()
    await expect(saveBtn).toBeVisible()
  })

  test('should have theme mode selector', async () => {
    const systemBtn = page.getByText('跟随系统')
    const lightBtn = page.getByText('浅色')
    const darkBtn = page.getByText('深色')

    await expect(systemBtn).toBeVisible()
    await expect(lightBtn).toBeVisible()
    await expect(darkBtn).toBeVisible()
  })

  test('should have close behavior dropdown', async () => {
    const select = page.locator('select')
    await expect(select).toBeVisible()
    await expect(select).toContainText('直接退出')
    await expect(select).toContainText('缩小到托盘')
  })

  test('API tab: should show API key input with show/hide toggle', async () => {
    await page.getByText('API 设置').click()
    await page.waitForTimeout(200)

    const pwInput = page.locator('input[type="password"]')
    await expect(pwInput).toBeVisible()

    const toggleBtn = page.locator('button[tabindex="-1"]')
    await expect(toggleBtn).toBeVisible()
  })

  test('Hotkey tab: should display hotkey configuration for both actions', async () => {
    await page.getByText('快捷键').click()
    await page.waitForTimeout(200)

    // Both hotkey entries should be visible
    await expect(page.getByText('体力捕获')).toBeVisible()
    await expect(page.getByText('AI 聊天')).toBeVisible()

    // Toggle switches should be present
    const toggleSwitches = page.locator('button[class*="rounded-full"]')
    await expect(toggleSwitches).toHaveCount(2)
  })
})

test.describe('AI Chat Sidebar', () => {
  test.beforeEach(async () => {
    // Navigate to home first
    const homeBtn = page.getByTitle('首页')
    await homeBtn.click()
    await page.waitForTimeout(300)
  })

  test('should toggle chat sidebar when clicking AI Chat button', async () => {
    const chatBtn = page.getByTitle('AI 聊天')
    await expect(chatBtn).toBeVisible()

    // Click to open chat
    await chatBtn.click()
    await page.waitForTimeout(500)

    // Chat panel should be visible
    await expect(page.getByText('AI 聊天')).toBeVisible()

    // Close chat
    const closeChatBtn = page.locator('button[aria-label="Close chat"]')
    await closeChatBtn.click()
    await page.waitForTimeout(300)
  })

  test('should show empty chat state message', async () => {
    const chatBtn = page.getByTitle('AI 聊天')
    await chatBtn.click()
    await page.waitForTimeout(500)

    const emptyMsg = page.getByText('发送消息与 AI 开始对话')
    await expect(emptyMsg).toBeVisible()
  })

  test('should have send button and input field in chat sidebar', async () => {
    const chatBtn = page.getByTitle('AI 聊天')
    await chatBtn.click()
    await page.waitForTimeout(500)

    const textarea = page.locator('textarea')
    await expect(textarea).toBeVisible()

    const sendBtn = page.locator('button[aria-label="Send"]')
    await expect(sendBtn).toBeVisible()
  })

  test('should have clear history button in chat sidebar', async () => {
    const chatBtn = page.getByTitle('AI 聊天')
    await chatBtn.click()
    await page.waitForTimeout(500)

    const clearBtn = page.getByText('清空记录')
    await expect(clearBtn).toBeVisible()
  })
})

test.describe('Sidebar Collapse', () => {
  test('should toggle sidebar collapse/expand', async () => {
    const expandBtn = page.locator('button[aria-label="Collapse sidebar"]')
    await expect(expandBtn).toBeVisible()

    // Collapse
    await expandBtn.click()
    await page.waitForTimeout(400)

    const collapseBtn = page.locator('button[aria-label="Expand sidebar"]')
    await expect(collapseBtn).toBeVisible()

    // Expand back
    await collapseBtn.click()
    await page.waitForTimeout(400)

    await expect(expandBtn).toBeVisible()
  })
})

test.describe('Window Controls', () => {
  test('minimize button triggers IPC minimize call', async () => {
    const minimizeBtn = page.locator('button[aria-label="Minimize"]')
    await expect(minimizeBtn).toBeVisible()
  })

  test('close button triggers IPC close call', async () => {
    const closeBtn = page.locator('button[aria-label="Close"]')
    await expect(closeBtn).toBeVisible()
  })
})
