# LightweightWindowsToolset — 项目开发进展总结

> 最后更新: 2026-05-26
> 当前分支: main
> 最新提交: 138de9b

---

## 一、项目概述

一款挂载于 Windows 系统托盘的轻量化插件式桌面工具集。首期工具为 PC 端游戏体力捕获（截图 → OCR → DeepSeek AI 解析 → 后端 API）。

### 技术栈

| 层 | 技术 | 实际版本 |
|----|------|---------|
| 框架 | Electron | 33.x |
| 构建 | electron-vite | 5.x (Vite 7.3.3) |
| 前端 | React 19 + TypeScript 5.x (strict) | |
| 状态管理 | Zustand | 5.x |
| UI | shadcn/ui + Tailwind CSS 4 | |
| 动画 | framer-motion | 12.x |
| 图标 | lucide-react | 0.460.x |
| 持久化 | electron-store | 8.2.0 (CJS) |
| 路由 | react-router-dom | 7.x (HashRouter) |
| 打包 | electron-builder | 25.x (未配置) |

### 关键配置

- **代理**: `socks5://127.0.0.1:7897` (所有网络操作必须通过)
- **后端 API**: `http://100.70.198.102:8000` (FastAPI + MySQL, 可设置修改)
- **DeepSeek API**: `https://api.deepseek.com/chat/completions`, 默认模型 `deepseek-v4-flash`
- **项目根目录**: `E:\codex_agent_project\LightweightWindowsToolset`
- **Electron 应用目录**: `electron-app/`
- **开发命令**: `cd electron-app && npm run dev`

---

## 二、目录结构

```
LightweightWindowsToolset/
├── AGENT_PROMPT.md              # 开发提示词
├── PRD.md                       # 产品需求文档
├── backend-api-reference.md     # 后端 API 复用文档
├── README.md
├── .gitignore
├── electron-app/
│   ├── package.json             # 依赖: react 19, zustand 5, electron 33, tailwindcss 4 等
│   ├── electron.vite.config.ts  # 三入口: main/preload/renderer
│   ├── tsconfig.json / .node / .web
│   ├── resources/
│   │   └── tray-icon.png        # 32x32 蓝色圆形图标 (#3B82F6)
│   └── src/
│       ├── main/                # Electron 主进程
│       │   ├── index.ts         # 窗口创建(960x680, 最小800x600), 托盘, IPC
│       │   ├── tray.ts          # 托盘: 显示/工具管理/设置/退出
│       │   ├── ipc/
│       │   │   ├── window.ts    # 窗口控制 + setTitle
│       │   │   ├── settings.ts  # electron-store 读写, 导出 getStore()
│       │   │   └── capture.ts   # 截图 IPC (目前为 mock)
│       │   ├── plugins/
│       │   │   └── registry.ts  # 插件发现/扫描 (未完全集成)
│       │   └── utils/
│       │       ├── store.ts     # electron-store 实例
│       │       └── hotkey.ts    # 全局快捷键注册
│       ├── preload/
│       │   └── index.ts         # contextBridge: window/settings/capture/tray API
│       └── renderer/            # React 渲染进程
│           ├── index.html       # CSP 已配置
│           ├── main.tsx         # React 入口
│           ├── App.tsx          # HashRouter + AppListeners (IPC 导航)
│           ├── env.d.ts         # Window.api 类型声明
│           ├── styles/
│           │   └── globals.css  # @tailwindcss + @theme (蓝白灰) + @layer base
│           ├── components/
│           │   ├── ui/          # button, card, input, label
│           │   ├── layout/
│           │   │   ├── AppShell.tsx    # 主布局: TitleBar + Sidebar + main(p-10)
│           │   │   ├── TitleBar.tsx    # 自定义标题栏(从 settingsStore 读标题)
│           │   │   └── Sidebar.tsx     # 可折叠(220px→56px)侧边栏, 工具切换+开关
│           │   └── shared/
│           │       ├── AnimatedRoute.tsx  # framer-motion 页面过渡
│           │       └── ThemeToggle.tsx    # 深色/浅色/系统切换
│           ├── pages/
│           │   ├── HomePage.tsx      # 中文大标题+英文副标题, 工具卡片网格
│           │   └── SettingsPage.tsx  # 标签栏导航: 通用/API/快捷键
│           ├── features/
│           │   ├── stamina-capture/  # 体力捕获工具
│           │   │   ├── CapturePage.tsx / CapturePanel.tsx
│           │   │   ├── StaminaDisplay.tsx / GameSelector.tsx / CaptureHistory.tsx
│           │   │   ├── api/backend.ts    # 后端 POST/GET
│           │   │   ├── api/deepseek.ts   # DeepSeek 非流式解析
│           │   │   ├── index.ts + plugin.json
│           │   ├── ai-chat/          # AI 聊天
│           │   │   ├── ChatSidebar.tsx   # SSE 流式对话
│           │   │   ├── api/deepseek.ts   # 流式调用
│           │   │   ├── index.ts + plugin.json
│           │   └── window-pinner/    # 置顶窗口 (待开发)
│           │       ├── index.ts + plugin.json
│           ├── stores/
│           │   ├── settingsStore.ts  # theme, autoStart, windowTitle, backend, model
│           │   ├── pluginStore.ts    # plugins, disabledTools, UPCOMING_TOOLS
│           │   ├── deepseekStore.ts  # 共享 DeepSeek API Key
│           │   └── captureStore.ts   # 体力捕获状态, 游戏配置
│           └── lib/
│               ├── utils.ts          # cn() classname helper
│               ├── theme.ts          # applyTheme()
│               └── plugin-loader.tsx # 动态插件路由 (基础)
└── tools/                           # 外部插件目录
    ├── stamina-capture/plugin.json
    ├── window-pinner/plugin.json
    └── _template/plugin.json
```

---

## 三、已实现功能 ✅

### 核心框架
- ✅ Electron 33 项目脚手架 (electron-vite + React 19 + TS strict)
- ✅ Tailwind CSS 4 主题系统 (蓝白灰 + 深色模式, @theme + @layer base)
- ✅ CSS 级联修复: reset 样式在 @layer base 内，确保工具类优先级
- ✅ 主进程: BrowserWindow (frameless, close→托盘)
- ✅ 系统托盘: 左键显示/隐藏, 右键菜单
- ✅ contextBridge 安全 IPC: window/settings/capture/tray
- ✅ electron-store 持久化设置
- ✅ TypeScript strict 模式编译通过

### UI 布局
- ✅ 自定义标题栏 (frameless, 最小化/关闭, 动态标题)
- ✅ 侧边栏: 220px 可折叠至 56px (200ms 过渡), 工具导航 + 开关
- ✅ AppShell 主布局: TitleBar + Sidebar + main(p-10=40px 内边距)
- ✅ Card 组件内边距 p-8 (32px)
- ✅ framer-motion 页面过渡动画 (200ms)
- ✅ 主题切换 (跟随系统/浅色/深色)

### 设置页面
- ✅ 三标签栏导航: 通用 | API 设置 | 快捷键
- ✅ 通用: 窗口标题(保存+重置)、开机自启(toggle)、主题(分段按钮)、AI面板位置(下拉)
- ✅ API: DeepSeek Key(密码+可见切换+保存)、模型名称、后端地址
- ✅ 快捷键: 体力捕获/AI聊天预设展示 (kbd 样式)

### 工具状态系统
- ✅ 两态: stable (已实现,可开关) / upcoming (待开发,锁定不可开)
- ✅ UPCOMING_TOOLS 集合: window-pinner
- ✅ 侧边栏: stable 工具显示拨动开关, upcoming 显示"待开发"标签
- ✅ toggleToolEnabled() 对 upcoming 工具直接拒绝
- ✅ 主页卡片: stable 工具可通过开关变灰, upcoming 始终灰色
- ✅ 托盘菜单: 仅列出 stable 工具

### 主页
- ✅ 中文标题 (3xl 粗体) + 英文副标题 (sm 灰色)
- ✅ 工具卡片网格: 4 个 (体力捕获/置顶窗口/数据看板/窗口管理)
- ✅ 状态标签: "已禁用" / "即将推出"
- ✅ 禁用/待开发工具统一灰色 (opacity-50)

### 托盘菜单
- ✅ 显示主窗口
- ✅ 工具管理 (checkbox 子菜单, 仅 stable 工具)
- ✅ 设置 (直接跳转 /settings 页)
- ✅ 退出

### 数据流
- ✅ 渲染器→主进程 IPC: window setTitle, settings get/set/getAll
- ✅ 主进程→渲染器 IPC: navigate(页面跳转), tray:toggle-tool(工具开关)
- ✅ TitleBar 动态读取 settingsStore.windowTitle
- ✅ 体力捕获 UI 组件完整: GameSelector, StaminaDisplay, CapturePanel, CaptureHistory
- ✅ 后端 API 客户端 (backend.ts): POST /api/stamina/record, GET /api/stamina/today
- ✅ DeepSeek API 客户端: 非流式体力解析 + SSE 流式聊天

---

## 四、未实现功能 ❌ / 🔶

### 核心缺失
- ❌ 截图管线 (screenshot-desktop 实际集成) — capture.ts 目前为 mock
- ❌ OCR 模块 (Windows.Media.Ocr worker_thread) — 未实现
- ❌ DeepSeek AI 体力解析实际调用 — 前端 API 已写好, 主流程未对接
- ❌ 全局快捷键注册 — hotkey.ts 工具函数已有, 未在 main 中调用
- ❌ Electron Notification 通知 — 未实现
- ❌ electron-builder NSIS 打包配置 — 未配置
- ❌ AI 聊天面板滑出 — ChatSidebar 组件已有, 但 AppShell 未集成到侧边栏
- ❌ 主页体力捕获卡片点击进入工具页面 — plugin-loader.tsx 未完整对接路由

### 部分实现
- 🔶 插件系统: registry.ts 扫描逻辑已写, renderer sidebar 当前硬编码 NAV_ITEMS
- 🔶 截图捕获按钮: CapturePanel 点击后有模拟流水线 (setTimeout), 非真实截图
- 🔶 后端 API 重试队列: 未实现
- 🔶 API Key safeStorage 加密: 未使用, 当前明文存储
- 🔶 托盘工具管理 checkbox: 主进程 hardcode checked:true, 未与 renderer 状态同步

### 待开发工具
- ❌ 置顶窗口 (window-pinner) — Phase 2, 当前标记为 upcoming
- ❌ 数据看板 — upcoming (主页预览卡片)
- ❌ 窗口管理 — upcoming (主页预览卡片)

---

## 五、已修复问题记录

| 问题 | 根因 | 修复 |
|------|------|------|
| CSS 内边距不生效 | `*{padding:0}` 排在 Tailwind 工具类之后 | 移入 @layer base |
| electron-store ESM 不兼容 | v10+ 为 ESM, 主进程为 CJS | 降级至 v8.2.0 |
| 体力捕获主页始终显示开启 | stable 工具未检查 isToolEnabled() | 重构为 stable/upcoming 两态 |
| 窗口 1265x815 撑满屏幕 | 屏幕 2240x1400 不匹配 | 改回 PRD 规格 960x680 |
| 侧边栏标签格式不统一 | 导航项 span 有 truncate flex-1, 底部项没有 | 统一为简单 span |

---

## 六、现存问题 ⚠️

1. ⚠️ 截图/OCR/AI 管线全部未对接 — 体力捕获工具无法实际使用
2. ⚠️ 插件加载未接入 renderer — sidebar 和主页目前硬编码工具列表
3. ⚠️ 托盘工具管理 checkbox 状态未同步 — 主进程 hardcode checked:true
4. ⚠️ AI 聊天面板未接入 AppShell — 组件已写但布局未集成
5. ⚠️ Playwright 已安装但未写 E2E 测试
6. ⚠️ electron-builder 打包未配置
7. ⚠️ safeStorage API Key 加密未实现 — 当前明文存储

---

## 七、关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| OCR 引擎 | Windows.Media.Ocr (待集成) | 零安装, PRD 推荐开发阶段方案 |
| 截图方式 | GDI (screenshot-desktop) | PRD 3.2.4; DXGI 作为全屏游戏回退 |
| DeepSeek 调用 | 非流式 (体力解析) + SSE 流式 (聊天) | 更快 JSON 返回 vs 用户体验 |
| 状态管理 | Zustand | 轻量, 无 boilerplate |
| CSS 主题 | Tailwind CSS 4 @theme + CSS 变量 | 蓝白灰精确色值, dark: 前缀 |
| 路由 | HashRouter | Electron 兼容, 无服务端路由 |
| 窗口关闭 | 最小化到托盘 | PRD 3.1.1; 仅托盘退出才真正退出 |
| 工具状态 | stable/upcoming 两态 | 防止待开发工具被用户开启 |
| electron-store 版本 | 8.2.0 (CJS) | 主进程 CJS 不兼容 ESM |

---

## 八、开发待办

### P0 — 阻塞核心功能
- [ ] 截图管线: 集成 screenshot-desktop → IPC → renderer
- [ ] OCR 模块: worker_thread + Windows.Media.Ocr (或 PaddleOCR 回退)
- [ ] DeepSeek 体力解析: 对接 capturePipeline
- [ ] 插件系统接入 renderer: sidebar 从 pluginStore 动态读取
- [ ] CapturePage 路由对接

### P1 — 重要功能
- [ ] 全局快捷键注册 (Ctrl+Shift+D)
- [ ] Electron Notification (捕获成功/失败)
- [ ] AI 聊天面板接入 AppShell
- [ ] 后端 API 重试队列 + 本地缓存
- [ ] 托盘工具管理 checkbox 双向同步
- [ ] safeStorage API Key 加密

### P2 — 增强
- [ ] electron-builder NSIS 打包
- [ ] 自定义快捷键绑定 UI
- [ ] 截图历史记录展示
- [ ] Playwright E2E 测试

---

## 九、Git 仓库

- Remote: https://github.com/THE2580/LightweightWindowsToolset
- Branch: main
- 代理: socks5://127.0.0.1:7897

## 十、环境

- OS: Windows (屏幕 2240x1400)
- Node.js: v24.12.0, npm: 11.6.2
- gh CLI: 已认证 (THE2580)
- 代理: socks5://127.0.0.1:7897 (必须运行)
