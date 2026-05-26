# LightweightWindowsToolset — 项目开发进展总结

> 最后更新: 2026-05-26
> 当前分支: main (领先 origin/main 18 commits)
> 最新提交: 096519c

---

## 一、项目概览

一款挂载于 Windows 系统托盘的轻量化插件式桌面工具集。首期工具为 PC 端游戏体力捕获（截图 → OCR → DeepSeek AI 解析 → 后端 API）。

### 技术栈

| 层 | 技术 | 实际版本 |
|----|------|---------|
| 框架 | Electron | 33.x |
| 构建 | electron-vite | 5.x (Vite 7.3.3) |
| 前端 | React 19 + TypeScript 5.x (strict) |
| 状态管理 | Zustand | 5.x |
| UI | shadcn/ui + Tailwind CSS 4 |
| 动画 | framer-motion | 12.x |
| 图标 | lucide-react | 0.460.x |
| 持久化 | electron-store | 8.2.0 (CJS) |
| 路由 | react-router-dom | 7.x (HashRouter) |
| 打包 | electron-builder | 25.x |
| 截图 | screenshot-desktop | 1.15.0 |
| OCR | Windows.Media.Ocr (PowerShell) |

### 关键配置

- **代理**: `socks5://127.0.0.1:7897` (所有网络操作必须通过)
- **后端 API**: `http://100.70.198.102:8000` (FastAPI + MySQL, 可设置修改)
- **DeepSeek API**: `https://api.deepseek.com/chat/completions`, 默认模型 `deepseek-v4-flash`
- **项目根目录**: `E:\codex_agent_project\LightweightWindowsToolset`
- **Electron 应用目录**: `electron-app/`
- **开发命令**: `cd electron-app && npm run dev`
- **打包命令**: `npm run package` (便携版, `--dir`), `npm run package:nsis` (NSIS 安装包)
- **构建命令**: `npx electron-vite build`
- **主窗口**: 676×444, 不可调整大小, 单实例锁
- **侧边栏**: 155px 展开 / 44px 折叠

---

## 二、目录结构

```
LightweightWindowsToolset/
├── AGENT_PROMPT.md              # 原始开发提示词
├── PROJECT_SUMMARY.md           # 本文档
├── PRD.md                       # 产品需求文档
├── backend-api-reference.md     # 后端 API 复用文档
├── README.md
├── .gitignore
├── electron-app/
│   ├── package.json             # 依赖: react 19, zustand 5, electron 33, tailwindcss 4 等
│   ├── electron.vite.config.ts  # 三入口: main/preload/renderer
│   ├── tsconfig.json / .node / .web
│   ├── resources/
│   │   ├── tray-icon.png        # 32x32 蓝色圆形图标 (#3B82F6)
│   │   └── icon.ico             # 256x256 应用图标
│   ├── dist/
│   │   └── win-unpacked/        # 便携版打包输出
│   │       └── 轻量化工具集.exe  # 180MB 独立可执行文件
│   └── src/
│       ├── main/                # Electron 主进程
│       │   ├── index.ts         # 窗口创建(676×444固定), 托盘, IPC, 单实例, 关闭行为
│       │   ├── tray.ts          # 托盘: 显示/工具管理/设置/退出 + destroyTray()
│       │   ├── ipc/
│       │   │   ├── window.ts    # 窗口控制 + setTitle
│       │   │   ├── settings.ts  # electron-store 读写, 导出 getStore(), closeBehavior 默认 'quit'
│       │   │   └── capture.ts   # screenshot-desktop + OCR 管线
│       │   ├── plugins/
│       │   │   └── registry.ts  # 插件发现/扫描 (未完全接入)
│       │   └── utils/
│       │       ├── store.ts     # electron-store 实例
│       │       ├── hotkey.ts    # 全局快捷键注册 (工具已有,未调用)
│       │       └── ocr.ts       # PowerShell + Windows.Media.Ocr
│       ├── preload/
│       │   └── index.ts         # contextBridge: window/settings/capture/tray API
│       └── renderer/            # React 渲染进程
│           ├── index.html       # CSP 已配置
│           ├── main.tsx         # React 入口, 调用 initPluginStore()
│           ├── App.tsx          # HashRouter + AppListeners (IPC 导航)
│           ├── env.d.ts         # Window.api 类型声明
│           ├── styles/
│           │   └── globals.css  # @tailwindcss + @theme (蓝白灰) + @layer base
│           ├── components/
│           │   ├── ui/          # button, card, input, label
│           │   ├── layout/
│           │   │   ├── AppShell.tsx    # 主布局: TitleBar + Sidebar + main(p-5)
│           │   │   ├── TitleBar.tsx    # 自定义标题栏(从 settingsStore 读标题)
│           │   │   └── Sidebar.tsx     # 155px/44px 侧边栏, overflow-hidden, transition-[width]
│           │   └── shared/
│           │       ├── AnimatedRoute.tsx  # framer-motion 页面过渡
│           │       └── ThemeToggle.tsx    # 深色/浅色/系统切换
│           ├── pages/
│           │   ├── HomePage.tsx      # 主页: 工具卡片网格(2列), 从 BUILTIN_PLUGINS 动态渲染
│           │   └── SettingsPage.tsx  # 设置: sticky 标签栏(通用/API/快捷键), closeBehavior 选项
│           ├── features/
│           │   ├── stamina-capture/  # 体力捕获工具
│           │   │   ├── CapturePage.tsx / CapturePanel.tsx (完整管线: 截图→OCR→AI→后端)
│           │   │   ├── StaminaDisplay.tsx / GameSelector.tsx / CaptureHistory.tsx
│           │   │   ├── api/backend.ts    # 后端 POST/GET
│           │   │   ├── api/deepseek.ts   # DeepSeek 非流式解析
│           │   │   ├── index.ts + plugin.json
│           │   ├── ai-chat/          # AI 聊天 (组件已写, 未接入 AppShell)
│           │   │   ├── ChatSidebar.tsx    # SSE 流式对话
│           │   │   ├── api/deepseek.ts   # 流式调用
│           │   │   ├── index.ts + plugin.json
│           │   └── window-pinner/    # 置顶窗口 (待开发)
│           │       ├── index.ts + plugin.json
│           ├── stores/
│           │   ├── settingsStore.ts  # theme, autoStart, windowTitle, backend, model, closeBehavior
│           │   ├── pluginStore.ts    # plugins, disabledTools, UPCOMING_TOOLS, initPluginStore()
│           │   ├── deepseekStore.ts  # 共享 DeepSeek API Key
│           │   └── captureStore.ts   # 体力捕获状态, 游戏配置
│           └── lib/
│               ├── utils.ts          # cn() classname helper
│               ├── theme.ts          # applyTheme()
│               ├── plugin-loader.tsx # 动态插件路由 (通过 plugin-registry 查找)
│               └── plugin-registry.ts # BUILTIN_PLUGINS 静态注册表 (仅工具,不含 AI 聊天)
└── tools/                           # 外部插件目录
    ├── stamina-capture/plugin.json
    ├── window-pinner/plugin.json
    └── _template/plugin.json
```

---

## 三、已实现功能 ✅

### 核心框架
- ✅ Electron 33 项目脚手 (electron-vite + React 19 + TS strict)
- ✅ Tailwind CSS 4 主题系统 (蓝白灰 + 深色模式, @theme + @layer base)
- ✅ 主进程 BrowserWindow (frameless, 676×444 固定尺寸, resizable:false)
- ✅ 单实例锁 (app.requestSingleInstanceLock, 重复启动聚焦已有窗口)
- ✅ 系统托盘: 左键显示/隐藏, 右键菜单 (显示窗口/工具管理/设置/退出)
- ✅ contextBridge 安全 IPC: window/settings/capture/tray
- ✅ electron-store 持久化设置 (含 closeBehavior)
- ✅ TypeScript strict 模式编译通过
- ✅ electron-builder 便携版打包 (npm run package)
- ✅ 256×256 ICO 应用图标

### UI 布局
- ✅ 自定义标题栏 (frameless, 最小化/关闭, 动态标题, 关闭按钮红色 hover)
- ✅ 侧边栏 155px 展开 / 44px 折叠 (transition-[width] 200ms ease-out, overflow-hidden)
- ✅ 侧边栏折叠按钮展开时靠右, 折叠时靠动画平滑移动
- ✅ 所有图标使用固定宽度容器 (w-5), 折叠动画无跳闪
- ✅ AppShell 主布局: TitleBar + Sidebar + main(p-5)
- ✅ framer-motion 页面过渡动画
- ✅ 主题切换 (跟随系统/浅色/深色)

### 设置页面
- ✅ 三标签栏导航: 通用 | API 设置 | 快捷键 (sticky top-0, -mt-5 pt-5 补 padding 缝隙)
- ✅ 通用: 窗口标题(保存+重置)、开机自启(toggle)、主题(分段按钮)、关闭行为(下拉: 直接退出/缩小托盘)、AI 面板位置
- ✅ API: DeepSeek Key(密码+可见切换+保存)、模型名称、后端地址
- ✅ 快捷键: 体力捕获/AI 聊天预设展示 (kbd 样式)

### 插件/工具系统
- ✅ 两态: stable (已实现可开关) / upcoming (待开发,锁定不可开)
- ✅ BUILTIN_PLUGINS 静态注册表 (仅工具, AI 聊天不在其中)
- ✅ 侧边栏从 BUILTIN_PLUGINS 动态渲染导航项
- ✅ 主页卡片从 BUILTIN_PLUGINS 动态渲染 (2列网格)
- ✅ 主页开关与侧边栏开关状态同步 (订阅 disabledTools Set)
- ✅ 托盘菜单仅列 stable 工具

### 体力捕获管线
- ✅ 截图: screenshot-desktop (GDI) → Buffer
- ✅ OCR: main/utils/ocr.ts → PowerShell + Windows.Media.Ocr
- ✅ DeepSeek 解析: features/stamina-capture/api/deepseek.ts (非流式, prompt 模板)
- ✅ 后端 API: features/stamina-capture/api/backend.ts (POST/GET)
- ✅ CapturePanel 完整管线: 截图 → OCR → AI 解析 → 后端提交, 各步骤状态反馈
- ✅ 游戏选择器 (原神/绝区零/终末地/异环)
- ✅ 体力展示 (数值/进度条/恢复时间)
- ✅ 今日记录列表
- ✅ 路由对接 (plugin-loader.tsx → BUILTIN_PLUGINS.component)

---

## 四、未实现功能 ❌ / 🔹

### 核心缺失
- ❌ OCR 模块仅在 Windows 10+ 且支持 WinRT 时有效, 无 PaddleOCR 回退方案
- ❌ 截图管线未经端到端实测 (依赖游戏窗口实际存在)
- ❌ 全局快捷键注册 — hotkey.ts 工具函数已有, 未在 main 中调用
- ❌ Electron Notification 通知 — 未实现
- ❌ AI 聊天面板未接入 AppShell — ChatSidebar 组件已写, 侧边栏按钮无点击事件
- ❌ 截图历史记录持久化 — 当前仅内存状态

### 部分实现
- 🔹 插件系统: registry.ts 扫描逻辑已写, renderer 侧边栏/主页已动态化, 但托盘 TOOLS 仍硬编码
- 🔹 托盘工具管理 checkbox: 主进程 hardcode checked:true, 未与 renderer 状态同步
- 🔹 API Key safeStorage 加密: 未使用, 当前明文存储
- 🔹 后端 API 重试队列: 未实现
- 🔹 设置页 AI 聊天面板位置选项: UI 已有, 实际面板未接入

### 待开发工具
- ❌ 置顶窗口 (window-pinner) — upcoming
- ❌ 数据看板 — upcoming (主页预览卡片)
- ❌ 窗口管理 — upcoming (主页预览卡片)

---

## 五、已修复问题记录

| 问题 | 根因 | 修复提交 |
|------|------|---------|
| CSS 内边距不生效 | `*{padding:0}` 排在 Tailwind 工具类之后 | 移入 @layer base |
| electron-store ESM 不兼容 | v10+ 为 ESM, 主进程为 CJS | 降级至 v8.2.0 |
| 体力捕获主页始终显示开启 | stable 工具未检查 isToolEnabled() | 重构为 stable/upcoming 两态 |
| 窗口 1265×815 撑满屏幕 | 屏幕 2240×1400 不匹配 | 改回 PRD 规格 960×680 |
| 侧边栏标签格式不统一 | 导航项 span 有 truncate flex-1, 底部项没有 | 统一为简单 span |
| 托盘退出无效 | close 事件中 event.preventDefault() 拦截了所有关闭 | 添加 isQuitting 标记 (244a244) |
| 便携版旧进程残留无法退出 | 旧版无退出标记, SYSTEM 权限 | 修复 + 管理员 taskkill 清理 |
| 侧边栏折叠动画文字闪烁 | 文字条件渲染, 动画中间态消失 | 改为始终渲染 + overflow-hidden + truncate (4c1c92d) |
| 侧边栏折叠图标跳闪 | justify-center 条件切换导致图标位置突变 | 图标固定 w-5 容器, 始终 flex-start (4c1c92d) |
| 主页工具开关不同步 | 订阅 isToolEnabled 函数引用, React 不感知返回值变化 | 改为订阅 disabledTools Set 自身 (1341a61) |
| 侧边栏折叠按钮展开时居中 | 不符合设计预期 | 改为 justify-end, 动画期间平滑滑入 (746f02f) |

---

## 六、现存问题 ⚠️

1. ⚠️ **退出模式「直接退出」不生效** — 设置 closeBehavior='quit' 后点击关闭按钮, 托盘仍然存在, 进程未终止。已尝试 destroyTray() + app.exit(0) 仍无效, 根因待查
2. ⚠️ **设置页 sticky 标签栏顶部有缝隙** — -mt-5 pt-5 方案可能不足以完全消除, 滚动时仍有内容穿过
3. ⚠️ 托盘「退出」菜单项调用 app.quit() — 在 closeBehavior='quit' 时可能因同样的根因失败
4. ⚠️ AI 聊天面板未接入 — 侧边栏底部按钮无点击响应
5. ⚠️ 托盘工具管理 checkbox 状态未同步 — 主进程 hardcode checked:true
6. ⚠️ Playwright 已安装但未写 E2E 测试
7. ⚠️ safeStorage API Key 加密未实现 — 当前明文存储
8. ⚠️ 后端 API 无重试队列和本地缓存

---

## 七、关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| OCR 引擎 | Windows.Media.Ocr (PowerShell) | 零安装, PRD 推荐开发阶段方案 |
| 截图方式 | GDI (screenshot-desktop) | PRD 3.2.4; DXGI 作为全屏游戏回退 |
| DeepSeek 调用 | 非流式(体力解析) + SSE 流式(聊天) | 更快 JSON 返回 vs 用户体验 |
| 状态管理 | Zustand | 轻量, 无 boilerplate |
| CSS 主题 | Tailwind CSS 4 @theme + CSS 变量 | 蓝白灰精确色值, dark: 前缀 |
| 路由 | HashRouter | Electron 兼容, 无服务端路由 |
| 窗口关闭 | closeBehavior 可选: quit/tray | 默认直接退出, 可选最小化到托盘 |
| 工具状态 | stable/upcoming 两态 | 防止待开发工具被用户开启 |
| electron-store 版本 | 8.2.0 (CJS) | 主进程 CJS 不兼容 ESM |
| 默认打包 | 便携版 (--dir) | NSIS 下载通过代理超时 |
| 侧边栏宽度 | 155px / 44px | 适配 676×444 窗口 |
| AI 聊天定位 | 内置功能, 非工具 | 不在工具列表/开关中, 侧边栏底部独立入口 |

---

## 八、开发待办

### P0 — 阻塞核心功能
- [ ] ⚠️ 修复退出模式「直接退出」不终止进程的 bug
- [ ] ⚠️ 修复托盘「退出」菜单项在 closeBehavior='quit' 时的退出行为

### P1 — 重要功能
- [ ] 全局快捷键注册 (Ctrl+Shift+D 捕获)
- [ ] Electron Notification (捕获成功/失败)
- [ ] AI 聊天面板接入 AppShell (侧边栏按钮点击 → 滑出 ChatSidebar)
- [ ] 后端 API 重试队列 + 本地缓存
- [ ] 托盘工具管理 checkbox 双向同步
- [ ] safeStorage API Key 加密
- [ ] 设置页 sticky 缝隙彻底修复

### P2 — 增强
- [ ] NSIS 安装包 (需代理稳定)
- [ ] 自定义快捷键绑定 UI
- [ ] 截图历史记录持久化
- [ ] Playwright E2E 测试
- [ ] 置顶窗口工具开发
- [ ] 数据看板 / 窗口管理工具

---

## 九、Git 仓库

- Remote: https://github.com/THE2580/LightweightWindowsToolset
- Branch: main (领先 origin/main 18 commits)
- 代理: socks5://127.0.0.1:7897

---

## 十、环境

- OS: Windows (屏幕 2240×1400)
- Node.js: v24.12.0, npm: 11.6.2
- gh CLI: 已认证 (THE2580)
- 代理: socks5://127.0.0.1:7897 (必须运行)
- 开发服务器: electron-vite dev (renderer 热更新)
