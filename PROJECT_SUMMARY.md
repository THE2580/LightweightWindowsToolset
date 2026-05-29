# LightweightWindowsToolset — 项目进展总结

> 最后更新: 2026-05-29 (第八轮)
> 当前分支: main (codex/ 前缀)
> 最新提交: 7d5bd76 (chore: electron-vite watch 排除 test-results 等非源码文件)
> 未提交改动: 无 (第八轮已全部提交, 5 commits)
> 编译状态: ✅ 通过
> 打包状态: ✅ 便携版已产出 (`dist/win-unpacked/轻量化工具集.exe`)
> E2E 实测: ❌ 未完成

---

## 一、项目概览

挂载于 Windows 系统托盘的轻量化插件式桌面工具集。首期工具为 PC 端游戏资源捕获（快捷键 → 截图 → OCR → DeepSeek AI → 后端 API）。

### 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Electron 33.x |
| 构建 | electron-vite 5.x (Vite 7.3.3) |
| 前端 | React 19 + TypeScript 5.x (strict) |
| 状态管理 | Zustand 5.x |
| UI | shadcn/ui + Tailwind CSS 4 |
| 动画 | framer-motion 12.x |
| 图标 | lucide-react 0.460.x |
| 持久化 | electron-store 8.2.0 (CJS) |
| 路由 | react-router-dom 7.x (HashRouter) |
| 打包 | electron-builder 25.x |
| 截图 | screenshot-desktop 1.15.0 (GDI) |
| OCR | Windows.Media.Ocr (PowerShell 反射 AsTask<T> + task.Wait) |
| AI | DeepSeek API (`deepseek-v4-flash`) |

### 关键配置

- **代理**: `socks5://127.0.0.1:7897`
- **后端 API**: `http://100.70.198.102:8000` (Tailscale IP, FastAPI + MySQL)
- **DeepSeek**: `https://api.deepseek.com/chat/completions`
- **根目录**: `E:\codex_agent_project\LightweightWindowsToolset`
- **窗口**: 676x444 固定不可调, 侧边栏 155px/44px
- **主题**: 蓝白灰 (light #2563EB / dark #3B82F6)
- **设计约束**: 禁止渐变球/光晕, 禁止负 letter-spacing, 禁止 UI 卡片嵌套卡片

---

## 二、已完成功能 ✅

### 2.1 核心框架
- Electron 33 + React 19 + TypeScript strict 脚手架
- Tailwind CSS 4 蓝白灰主题, frameless 固定窗口
- 系统托盘 (左键显隐, 右键动态菜单, 退出终止全部进程)
- contextBridge 安全 IPC, electron-store 持久化, safeStorage 加密
- 自定义标题栏, 侧边栏折叠动画, 主题切换 (light/dark)

### 2.2 设置页面
- 三标签: 通用 / API 设置 / 快捷键
- 通用: 窗口标题, 开机自启, 主题模式, 关闭行为
- API: DeepSeek Key (加密), 模型名称, 后端地址
- 快捷键: 追加式录入, 按键 pill 样式, 保存时校验 (≥2键, 左修饰右普通, 仅1普通键), JSON 数组存储, 录入时禁用全局快捷键
- 显式保存按钮 (编辑时显示, 成功后隐藏)

### 2.3 插件/工具系统
- BUILTIN_PLUGINS 静态注册, stable/upcoming 两态
- 侧边栏/主页动态渲染, 开关双向同步
- 工具禁用 = 快捷键注销 (tool:set-enabled IPC)
- AI 聊天为内置功能, 不在工具列表

### 2.4 快捷键系统
- globalShortcut 注册/注销
- 无默认快捷键 (新工具默认空字符串)
- 追加式录入 + 保存时统一校验 + 冲突检测
- 录入时禁用全局快捷键, 保存/取消后恢复

### 2.5 AI 聊天
- ChatSidebar SSE 流式对话, 右侧滑入滑出动画

### 2.6 开机自启
- `app.setLoginItemSettings()` 实时开关

---

## 三、资源捕获管线 ✅ (第七轮，已打包便携版)

### 3.1 全链路

```
快捷键按下 → 前景窗口预检测(进程名→游戏名映射) → 弹窗立即显示(游戏名+步骤状态机)
  → 截图(screenshot-desktop GDI 全屏)
  → 主进程内弹窗步骤更新: 截图✓ → OCR进行中
  → OCR(PS反射AsTask<T>, DPI裁剪, 零校正)
  → 主进程内弹窗步骤更新: OCR✓/✗ → AI待执行
  → 渲染进程: AI解析进行中弹窗更新
  → AI解析(DeepSeek, 多资源并行)
  → 后端POST(主进程Node.js http, 绕过Chromium代理)
  → 弹窗结果展示(游戏名+结果行), 4秒后关闭
```

### 3.2 已实现的具体功能

**OCR 模块** (`ocr.ts`):
- PS 脚本反射 `System.WindowsRuntimeSystemExtensions.AsTask<T>` + `task.Wait()`
- `System.Drawing.Bitmap` 裁剪窗口区域 (crop rect × DPI scaleFactor)
- 语言回退链: zh-Hans-CN → zh-CN → zh-Hans → ja-JP → en-US → user-profile
- 零校正 (o/O → 0)
- UTF-8 输出强制

**截图+窗口检测** (`capture.ts`):
- `screenshot-desktop` 原生 GDI
- 前景窗口检测 (C# P/Invoke via PS: `GetForegroundWindow` + `GetWindowRect`)
- DPI 缩放补偿 (`screen.getPrimaryDisplay().scaleFactor`)
- 进程名 → 游戏ID映射: `yuanshen→genshin, genshinimpact→genshin, zenlesszonezero→zzz`
- 桌面检测: `GetDesktopWindow()` 句柄比对 + explorer/Progman/ShellExperienceHost
- **⚠️ 测试模式已完全移除** — 无 `test` 游戏, 无 `electron→test` 映射

**管线弹窗** (`capture.ts` overlay):
- `alwaysOnTop` transparent BrowserWindow, `screen-saver` 级别
- 尺寸约 238×(53+steps×15)px, 已整体缩小至原约 66% (先减 40% 再加 10%)
- DOM 实时更新: `webContents.executeJavaScript` 调 `window._render()`
- **弹窗标题显示映射后的游戏中文名**（渲染进程预检测前景→映射后再创建弹窗）
- 主进程在截图/OCR 阶段实时更新步骤状态（无需等待 IPC 返回）
- 步骤状态机: ○ 待执行 → spinner 执行中 → ✓ 成功 → ✗ 失败
- 结果展示后 4 秒自动关闭

**后端通信** (`backend.ts`):
- 主进程 Node.js `http` 模块 (不受 Chromium socks5 代理影响)
- 渲染进程通过 IPC: `window.api.backend.postRecord()` / `getToday()`
- 重试队列: electron-store 持久化, 启动时冲刷
- ⚠️ 偶尔后端伪报错 "Backend unreachable" 但实际写入成功

**状态管理** (`captureStore.ts`):
- `staminaMap: Record<resourceTypeId, StaminaSnapshot>` — **键为资源类型 ID，非游戏 ID**，各资源独立存储
- `StaminaSnapshot`: `{ remaining, max, recoveryMinutes, lastCaptureTime }`
- `captureHistory: CaptureHistoryEntry[]` 最多 50 条, 含 OCR 文本/进程名/失败原因
- 默认游戏 `'genshin'` (原神), 默认资源 `'GenshinImpact_ORIGINAL_RESIN'`
- 游戏名写入后端使用中文 (`resolvedGameConfig.name`)
- **管线全程使用检测到的进程名解析游戏**，不再依赖下拉框选择
- 捕获并发锁: 仅 `captureState === 'idle'` 允许触发

**恢复速率计算**:
- `ResourceTypeConfig` 含 `recoveryMinutes` 字段（每点恢复分钟数）
- `refreshRecords` 轮询时根据 `capture_time` + `recoveryMinutes` 反算当前实际值
- `StaminaDisplay` 每秒 tick 实时更新，显示：「下一恢复点: X 分 Y 秒」倒计时
- 各游戏恢复速率已配置:

| 游戏 | 资源 | 恢复速率 |
|------|------|----------|
| 原神 | 原粹树脂 | 8 分钟/点 |
| 原神 | 洞天宝钱 | 2 分钟/点 |
| 绝区零 | 电量 | 6 分钟/点 |
| 终末地 | 理智 | 7.2 分钟/点 |
| 异环 | 本性像素 | 6 分钟/点 |

**自动刷新**:
- `refreshRecords` 每 N 秒从后端拉取最新记录, 计算当前实际值, 不覆盖用户手动选择的游戏
- `loadTodayFromBackend` 仅初始加载时调用, 会设定 `selectedGame`
- 刷新间隔可自定义（`captureRefreshInterval`, 默认 2 秒, 持久化到 electron-store）
- 输入框在捕获页面头部 `↻ [N] 秒`, 失焦/回车保存, 值 ≤0 回弹

### 3.3 UI 组件

| 组件 | 职责 | 状态 |
|------|------|------|
| CapturePage | 页面入口, 初始加载+轮询刷新, 刷新间隔控件 | ✅ |
| CapturePanel | 提示文字(动态游戏名+动态快捷键pill样式), 无按钮 | ✅ |
| StaminaDisplay | 实时资源值+进度条+恢复倒计时+子资源列表 | ✅ |
| CaptureHistory | 手风琴列表(CSS max-height 过渡动画), 展开详情可复制OCR | ✅ |
| GameSelector | 游戏+资源下拉框 (常驻) | ✅ |

---


## 四、第八轮改动 (性能 + 动画 + 数据修复) ✅

### 4.1 渲染性能优化
- Zustand `useShallow` 浅比较: CaptureHistory/CapturePanel/GameSelector/StaminaDisplay/CapturePage 全部使用, 消除对象 selector 的无意义重渲染
- `React.memo(StaminaDisplay)`: 阻止父组件轮询重渲染向下传递
- Overlay BrowserWindow 复用: `show()`/`hide()` 替代每次 `new`/`close()`, 减少 GPU 资源分配
- `refreshRecords` 稳定化: 用 `useCaptureStore.getState().refreshRecords()` 替代 selector, `restartTimer` deps 从 `[refreshRecords]` 改为 `[]`

### 4.2 UI 动画完善
- 路由 exit 动画: 拆分 `AppContent` 组件, 用 `AnimatePresence mode="wait"` + `useLocation().pathname` 做 key, 页面切换滑入滑出 (12px, 0.2s)
- SettingsPage 标签淡入淡出: 三标签内容包裹 `motion.div` (4px, 0.15s)
- CSS transition 精确化: AppShell 聊天面板 `transition-all` → `transition-[right]`, CaptureHistory 手风琴 → `transition-[max-height,opacity]`

### 4.3 后端离线指示器
- `captureStore.backendOnline` 状态: 默认 `true`, API 请求成功设 `true`, catch 设 `false`
- CapturePage 标题下方显示 `WifiOff` 图标 + "后端离线" (琥珀色), 后端恢复后自动消失

### 4.4 数据拉取修复
- **后端** (`AndroidGameInfoTools/backend/main.py`): `GET /api/resource/today` SQL 从 `GROUP BY game_name` 改为 `GROUP BY (game_name, resource_type)`, subquery 和 join 均补上 `resource_type` 列. 修复了同游戏多资源类型只返回一条记录的问题
- **前端** (`captureStore.loadTodayFromBackend`): 从只取 `records[length-1]` 改为遍历全部记录, 逐条计算恢复值写入 `staminaMap`

### 4.5 编译配置
- `electron.vite.config.ts` 添加 `server.watch.ignored`: 排除 `out/`, `node_modules/`, `dist/`, `test-results/`, `*.txt`, `*.md`, `*.png`, `*.zip` 等非源码文件, 防止 Playwright 测试报告触发频繁重启

---

## 五、未修复问题 ⚠️

| # | 问题 | 严重度 | 详情 |
|---|------|--------|------|
| 1 | E2E 管线未实测 | **高** | 需实际打开绝区零/原神窗口完成一次完整捕获, 验证: AI 解析正确性 + 后端写入正确性 + 弹窗全链路正确性 |
| 2 | 后端伪报错 | **中** | 后端实际写入成功, 但前端偶尔提示 "Backend unreachable — record queued for retry"。`backend.ts` 已有详细日志, 需端到端复现后定位根因 |
| 3 | 历史记录未持久化 | **低** | captureHistory 仅内存, Electron 重启丢失 |
| 4 | 缩到托盘后全局热键仍可触发捕获 | **低** | 应用缩到托盘后按 hotkey 可能意外截本应用 |

---

## 六、关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| OCR 引擎 | Windows.Media.Ocr via PS 反射 AsTask | 零安装 |
| 截图 | screenshot-desktop GDI 全屏 + PS 裁剪 | 快, 支持 DPI 补偿 |
| 后端 HTTP | 主进程 Node.js http | 绕过 Chromium socks5 代理 |
| 弹窗更新 | executeJavaScript 直操作 DOM | 无 loadURL 闪烁 |
| 弹窗步骤更新 | 主进程内实时推送 | OCR 阶段真实进度可见 |
| 弹窗标题 | 渲染进程预检测前景→映射中文名 | 用户看到游戏名而非进程名 |
| 资源状态键 | `resourceType.id` (非 gameId) | 多资源独立不覆盖 |
| 恢复计算 | 轮询时根据 elapsedTime+recoveryRate 反算 | 显示当前实际值而非捕获快照 |
| 捕获触发 | 仅快捷键 (无按钮) | 避免按钮触发时本应用在前 |
| 游戏检测 | 进程名自动解析, 全程不依赖下拉框 | 管线数据来源一致 |
| 快捷键存储 | JSON 数组 | 消除 `+` 分隔符歧义 |
| 并发控制 | captureState === 'idle' 仅此状态可触发 | 防止频繁 OCR 卡死焦点进程 |
| 展开动画 | CSS max-height 过渡 | 比 framer-motion height:auto 更流畅 |

---

## 七、关键文件地图

| 文件 | 职责 |
|------|------|
| `electron-app/src/main/index.ts` | 入口, tray, 快捷键, IPC |
| `electron-app/src/main/ipc/capture.ts` | 前景检测, 截图, OCR调用, 管线弹窗(含步骤状态机) |
| `electron-app/src/main/ipc/backend.ts` | 主进程 HTTP 后端通信 |
| `electron-app/src/main/ipc/queue.ts` | 重试队列持久化 |
| `electron-app/src/main/ipc/settings.ts` | electron-store 封装 |
| `electron-app/src/main/utils/ocr.ts` | OCR PS脚本 (反射AsTask, DPI裁剪) |
| `electron-app/src/renderer/stores/captureStore.ts` | 核心状态: 管线编排, 历史, 游戏配置, 恢复计算 |
| `electron-app/src/renderer/stores/settingsStore.ts` | 设置持久化 (含刷新间隔) |
| `electron-app/src/renderer/features/stamina-capture/CapturePage.tsx` | 页面入口 + 自动轮询 + 刷新间隔控件 |
| `electron-app/src/renderer/features/stamina-capture/CapturePanel.tsx` | 提示面板 (动态快捷键pill) |
| `electron-app/src/renderer/features/stamina-capture/StaminaDisplay.tsx` | 资源值+进度条+恢复倒计时(每秒tick) |
| `electron-app/src/renderer/features/stamina-capture/CaptureHistory.tsx` | 手风琴历史记录(CSS过渡动画) |
| `electron-app/src/renderer/features/stamina-capture/GameSelector.tsx` | 游戏+资源下拉 |
| `electron-app/src/renderer/features/stamina-capture/api/backend.ts` | 渲染进程后端API (IPC) |
| `electron-app/src/renderer/features/stamina-capture/api/deepseek.ts` | DeepSeek AI 解析 |
| `electron-app/src/preload/index.ts` | contextBridge API |

---

## 八、环境

- OS: Windows (2240x1400, 150% DPI)
- Node.js: v24.12.0, npm: 11.6.2
- gh CLI: 已认证
- 代理: socks5://127.0.0.1:7897
- 后端: Tailscale 100.70.198.102:8000
> 后端数据库: game_resource_manage.resource_capture_records (已插入 5 条测试数据: 原神×2 + 绝区零×1 + 终末地×1 + 异环×1)
