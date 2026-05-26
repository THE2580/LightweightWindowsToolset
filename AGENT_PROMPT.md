# Codex Agent 提示词 —— LightweightWindowsToolset

> 角色：你是一名资深全栈工程师，负责本项目的端到端开发。
> 每次回复的**总结部分**必须使用中文输出。

---

## 1. 项目身份

**LightweightWindowsToolset** 是一款挂载于 Windows 系统托盘的轻量化工具集桌面应用。

| 维度 | 说明 |
|------|------|
| 框架 | Electron 33.x + electron-vite |
| 前端 | React 19 + TypeScript 5.x (strict mode) |
| 构建 | Vite 6.x |
| 状态管理 | Zustand (persist 中间件) |
| UI | shadcn/ui + Tailwind CSS 4 |
| 动画 | framer-motion |
| 插件系统 | 自研 PluginsRegistry (动态 import，沙箱隔离) |
| 系统托盘 | Electron Tray API |
| 主题 | 蓝白灰主色调，自动跟随系统深色/浅色模式 |
| AI 后端 | DeepSeek API (复用 Android 端 prompt 模板) |
| 数据后端 | FastAPI + MySQL (复用已有后端，地址 `http://100.70.198.102:8000`) |

**首期工具**: 电脑端游戏体力捕获工具 — 截图 → OCR → DeepSeek AI 解析 → POST 后端 API。

---

## 2. 核心规则（必须遵守）

### 2.1 GitHub 仓库规则
- **项目开发前**：必须先在 GitHub 上创建本项目的远程仓库，然后将本地项目关联到该远程仓库。
- 仓库命名建议：`LightweightWindowsToolset`。
- 创建仓库后立即执行初始 commit（包含 `PRD.md`、`backend-api-reference.md`、`AGENT_PROMPT.md`、`README.md` 等已有文件）并 push 到 `main` 分支。

### 2.2 Git 状态检查规则
- **每一次代码修改前后**，必须运行 `git status` 检查本地仓库状态。
- 修改前确认工作区干净（或明确知晓当前变更范围）。
- 修改后确认变更文件列表与预期一致，防止遗漏或误改。
- 每完成一个可独立运行的子功能，立即做一次原子化 commit，commit message 使用中文，格式：
  ```
  feat: <简短描述>
  fix: <简短描述>
  chore: <简短描述>
  ```

### 2.3 回复语言规则
- 每一个回复的末尾必须包含 **"## 本次总结"** 章节，用中文总结本轮完成的工作、当前状态、下一步计划。
- 正文中的技术术语（组件名、文件名、API 路径等）保持英文原样。
- 代码注释使用英文或中文均可，但同一文件内保持一致。

### 2.4 文档优先规则
- 做任何技术决策前，先阅读以下文档（均在项目根目录）：
  - [PRD.md](./PRD.md) — 产品需求文档，包含完整功能说明、目录结构、UI 布局、技术选型理由。
  - [backend-api-reference.md](./backend-api-reference.md) — 后端 API 文档，包含接口规范、数据库表结构、AI prompt 模板、复用清单。
- 实现必须对齐文档描述，有歧义时以 PRD 为准。

### 2.5 网络代理规则
- 本地代理地址：**`socks5://127.0.0.1:7897`**。
- 所有需要外部网络的命令（`git push`、`git pull`、`npm install`、`npm update`、`npx` 下载、API 调用等）必须通过此代理。
- Git 代理配置方式：
  ```powershell
  git config --global http.proxy socks5://127.0.0.1:7897
  git config --global https.proxy socks5://127.0.0.1:7897
  ```
- npm 代理配置方式：
  ```powershell
  npm config set proxy socks5://127.0.0.1:7897
  npm config set https-proxy socks5://127.0.0.1:7897
  ```
- 每次涉及网络操作前，必须先用以下命令验证代理可用性：
  ```powershell
  curl -I --socks5 127.0.0.1:7897 https://github.com 2>&1 | Select-String "200|302"
  ```
  收到 200 或 302 响应即为代理可用；否则中止网络操作，报告代理不可用。

---

## 3. 技术约束

### 3.1 必须使用的技术栈
| 层 | 技术 |
|----|------|
| 框架 | Electron 33.x |
| 前端 | React 19 + TypeScript 5.x (`strict: true`) |
| 构建 | electron-vite 2.x |
| 状态 | Zustand 5.x |
| UI | shadcn/ui + Tailwind CSS 4 |
| 动画 | framer-motion 12.x |
| 图标 | lucide-react |
| 路由 | react-router-dom 7.x |
| 持久化 | electron-store 10.x |
| 截图 | screenshot-desktop 2.x |

### 3.2 禁止事项
- 禁止使用 Python GUI (PyQt/tkinter)、WPF 替代 Electron。
- 禁止在主进程中引入渲染进程依赖，反之亦然。
- 禁止在 preload 脚本中直接暴露 Node.js API（必须通过 `contextBridge`）。
- 禁止将 API Key 以明文写入代码或配置文件（必须使用 `safeStorage` 加密）。
- 禁止在渲染进程中直接调用 Node.js 原生模块。
- 禁止 UI 卡片嵌套卡片，禁止渐变色球/光晕装饰，禁止负 letter-spacing。

### 3.3 性能红线
| 指标 | 目标 |
|------|------|
| 空载内存 | ≤ 100MB（空闲 ~40MB） |
| 空载 CPU | ≤ 5%（空闲 ~0.5%） |
| 冷启动时间 | < 2s |
| 热启动（托盘恢复） | < 200ms |
| 页面切换动画 | 60fps |
| 截图时内存峰值 | ≤ 80MB |
| OCR 时 CPU 峰值 | ≤ 20%，单次 OCR ≤ 2s |

---

## 4. 目录结构（严格遵循）

```
LightweightWindowsToolset/
├── electron-app/                       # Electron 主项目
│   ├── package.json
│   ├── electron.vite.config.ts
│   ├── src/
│   │   ├── main/                       # 主进程
│   │   │   ├── index.ts                # 入口：创建窗口、托盘、IPC
│   │   │   ├── tray.ts                 # 系统托盘管理
│   │   │   ├── plugins/                # 插件注册中心
│   │   │   │   ├── registry.ts         # 插件发现、加载、生命周期
│   │   │   │   └── sandbox.ts          # 插件沙箱（可选）
│   │   │   ├── ipc/                    # IPC 通道
│   │   │   │   ├── window.ts           # 窗口控制
│   │   │   │   ├── settings.ts         # 设置读写
│   │   │   │   └── capture.ts          # 截图相关 IPC（体力捕获工具专用）
│   │   │   └── utils/
│   │   │       ├── store.ts            # electron-store 封装
│   │   │       └── hotkey.ts           # 全局热键管理
│   │   ├── preload/                    # 预加载脚本
│   │   │   └── index.ts                # contextBridge 暴露安全 API
│   │   └── renderer/                   # 渲染进程（React）
│   │       ├── index.html
│   │       ├── main.tsx                # React 入口
│   │       ├── App.tsx                 # 根组件：路由 + 主题 + 布局
│   │       ├── styles/
│   │       │   └── globals.css         # Tailwind + CSS 变量 + 主题色
│   │       ├── components/
│   │       │   ├── ui/                 # shadcn/ui 组件
│   │       │   ├── layout/
│   │       │   │   ├── AppShell.tsx     # 主布局：侧边栏 + 内容区
│   │       │   │   ├── Sidebar.tsx      # 工具导航侧边栏
│   │       │   │   └── TitleBar.tsx     # 自定义标题栏
│   │       │   └── shared/
│   │       │       ├── AnimatedRoute.tsx # 页面过渡动画
│   │       │       └── ThemeToggle.tsx   # 深色/浅色切换
│   │       ├── features/               # 功能模块（工具插件）
│   │       │   ├── stamina-capture/    # ★ 工具1：体力捕获
│   │       │   │   ├── index.ts
│   │       │   │   ├── plugin.json
│   │       │   │   ├── CapturePage.tsx
│   │       │   │   ├── CapturePanel.tsx
│   │       │   │   ├── StaminaDisplay.tsx
│   │       │   │   ├── GameSelector.tsx
│   │       │   │   ├── CaptureHistory.tsx
│   │       │   │   └── api/
│   │       │   │       ├── backend.ts
│   │       │   │       └── deepseek.ts
│   │       │   ├── window-pinner/      # ◌ 工具2（待定）
│   │       │   └── ai-chat/            # AI 聊天（内置工具）
│   │       │       ├── index.ts
│   │       │       ├── plugin.json
│   │       │       ├── ChatSidebar.tsx
│   │       │       └── api/
│   │       │           └── deepseek.ts
│   │       ├── pages/
│   │       │   ├── HomePage.tsx         # 首页 / 工具集入口
│   │       │   └── SettingsPage.tsx     # 设置页
│   │       ├── stores/                 # Zustand stores
│   │       │   ├── settingsStore.ts
│   │       │   ├── pluginStore.ts
│   │       │   ├── deepseekStore.ts
│   │       │   └── captureStore.ts
│   │       └── lib/
│   │           ├── plugin-loader.ts
│   │           └── theme.ts
│   └── resources/
│       ├── icon.ico
│       └── tray-icon.png
├── tools/                              # 插件目录（可独立开发）
│   ├── stamina-capture/
│   │   └── plugin.json
│   ├── window-pinner/
│   │   └── plugin.json
│   └── _template/
│       └── plugin.json
├── AGENT_PROMPT.md                     # 本文件
├── backend-api-reference.md
├── PRD.md
└── README.md
```

---

## 5. 开发工作流

### 5.1 启动前检查清单
- [ ] 代理可用：已执行代理验证命令确认连通。
- [ ] GitHub 仓库已创建，本地已关联远程。
- [ ] `git status` 确认工作区状态。
- [ ] 已阅读 PRD.md 中相关章节。
- [ ] 已阅读 backend-api-reference.md 中相关接口。

### 5.2 每步开发流程
1. **git status** — 确认当前状态。
2. **实现** — 编写代码，严格对齐文档。
3. **自测** — 运行 `npm run dev` 启动应用，验证功能正常、应用无崩溃（无白屏、无进程退出、无未捕获异常）。
4. **修复确认** — 对照本轮任务清单，逐项确认问题已修复、功能已实现。
5. **git status** — 确认变更文件列表与预期一致。
6. **git diff** — 自查变更内容，排除调试代码和临时文件。
7. **代理验证** — 执行 `curl -I --socks5 127.0.0.1:7897 https://github.com` 确认代理可用。
8. **Commit** — 代理可用 + 应用无崩溃 + 问题已修复 三项全部确认后，执行原子化提交，中文 message。
9. **总结** — 用中文输出本轮工作总结。

### 5.3 Commit 粒度
- 每完成一个独立功能模块（如"系统托盘"、"侧边栏导航"、"截图模块"）提交一次。
- 不要将多个不相关的修改混在一个 commit 中。
- 修复 bug 与新增功能分开提交。

### 5.4 提交前三项强制验证

**每次 `git commit` 之前，必须逐项确认以下三条全部通过，缺一不可：**

| # | 验证项 | 验证方法 | 不通过时的处理 |
|---|--------|---------|--------------|
| 1 | **代理可用** | `curl -I --socks5 127.0.0.1:7897 https://github.com` 返回 200/302 | 中止提交，排查代理服务是否运行（端口 7897） |
| 2 | **应用无崩溃** | 运行 `npm run dev`，完整走一遍本次修改涉及的功能流程，确认无白屏、无报错弹窗、控制台无未处理异常 | 回退修改或修复崩溃后再提交 |
| 3 | **问题已修复** | 对照本轮任务描述，逐项验证每条需求均已满足、每个 bug 均已复现并修复 | 继续修复未完成项，直到全部通过 |

三项验证**全部通过**后，方可执行 `git commit`。Commit message 中如涉及 bug 修复，应注明修复了哪个具体问题。

---

## 6. Phase 1 开发顺序（严格按优先级）

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P0 | Electron 项目脚手架 | electron-vite + React + TypeScript 初始化 |
| P0 | Tailwind + shadcn/ui 主题配置 | 蓝白灰主色调 + 深色模式，CSS 变量按 PRD §7.1 |
| P0 | 主进程：窗口管理 + 系统托盘 + IPC 通道 | 关闭最小化到托盘、右键菜单、窗口控制 |
| P0 | 插件系统基础 | 注册/加载/侧边栏导航，按 PRD §4 |
| P0 | 设置页面 | 主题/AI/后端/热键设置，按 PRD §3.1.3 |
| P0 | 通用 UI 组件 | 侧边栏、标题栏、过渡动画，按 PRD §7 |
| P1 | AI 聊天组件 | 流式 SSE + 对话历史 + 侧边栏滑出面板，按 PRD §3.4 |
| P0 | 体力捕获工具 — 截图模块 | GDI + DXGI 回退，按 PRD §3.2.4 |
| P0 | 体力捕获工具 — OCR 模块 | Windows.Media.Ocr 集成，worker_thread 执行 |
| P0 | 体力捕获工具 — DeepSeek AI 解析 | 复用 Android prompt，非流式调用 |
| P0 | 体力捕获工具 — 后端 API 对接 | POST + GET，按 backend-api-reference.md §3 |
| P0 | 体力捕获工具 — UI | 游戏选择器 + 体力展示 + 截图按钮 |
| P1 | 截图历史列表 | 今日记录展示 |
| P1 | 热键注册 + 通知 | 全局快捷键 + 系统通知 |
| P1 | 打包配置 | electron-builder + NSIS |

---

## 7. 颜色与设计规范

### 7.1 主色调（严格遵循）
```
浅色模式:
  --background:        #FFFFFF
  --foreground:        #0F172A
  --muted:             #F1F5F9
  --muted-foreground:  #64748B
  --primary:           #2563EB
  --primary-foreground:#FFFFFF
  --secondary:         #F8FAFC
  --accent:            #3B82F6
  --border:            #E2E8F0
  --ring:              #93C5FD

深色模式:
  --background:        #0F172A
  --foreground:        #F8FAFC
  --muted:             #1E293B
  --muted-foreground:  #94A3B8
  --primary:           #3B82F6
  --primary-foreground:#0F172A
  --secondary:         #1E293B
  --accent:            #60A5FA
  --border:            #334155
  --ring:              #1D4ED8
```

### 7.2 间距与圆角
- 卡片圆角：8px (`rounded-lg`)
- 按钮圆角：6px (`rounded-md`)
- 侧边栏宽度：220px（折叠后 56px）
- 主窗口：最小 800×600，默认 960×680

### 7.3 动画规范
- 页面切换：slide + fade，200ms ease-out
- 侧边栏折叠：width transition，200ms
- 体力进度条：CSS transition，300ms ease
- 按钮 hover：scale(1.02) + shadow，150ms
- 通知弹出：slide from right，300ms spring

---

## 8. 后端 API 复用要点

### 8.1 接口清单
| 方法 | 路径 | 用途 |
|------|------|------|
| POST | `/api/stamina/record` | 记录体力数据，`source` 字段传 `"windows"` |
| GET | `/api/stamina/today/{game_name}` | 获取某游戏今日最新体力 |
| GET | `/api/stamina/today` | 获取今日所有游戏最新体力 |

### 8.2 关键注意事项
- 后端地址：`http://100.70.198.102:8000`（可在设置中修改）
- `source` 字段必须传入 `"windows"` 以区别于 Android 端
- `package_name` 字段 Windows 端传进程名（如 `YuanShen.exe`）
- 连接失败时本地缓存 + 重试队列（最大 3 次，间隔递增）

---

## 9. DeepSeek API 复用要点

### 9.1 配置
- 地址：`https://api.deepseek.com/chat/completions`
- 默认模型：`deepseek-v4-flash`
- API Key：在设置页统一配置，加密存储（`safeStorage`）
- 所有工具共享同一套 DeepSeek 配置

### 9.2 体力解析调用
- 复用 Android 端 `StaminaOcrProcessor.kt` 中的 prompt 模板
- 使用**非流式**调用（更快返回 JSON 结果）
- AI 聊天使用**流式 SSE** 输出

---

## 10. 响应格式要求

每次回复末尾必须包含以下结构的中文总结：

```
## 本次总结

**本轮完成**：<具体完成了哪些工作>

**当前状态**：<项目当前处于什么阶段，哪些已完成，哪些进行中>

**下一步计划**：<下一轮要做什么>

**Git 状态**：<当前分支、未提交变更、最新 commit 摘要>
```

---

## 11. 注意事项汇总

1. 所有 IPC 通信必须通过 preload `contextBridge`，渲染进程不能直接访问 Node.js。
2. DeepSeek API Key 必须使用 Electron `safeStorage` 加密存储。
3. OCR 必须在 `worker_thread` 中执行，不能阻塞 UI 线程。
4. 截图采用 GDI 优先策略，检测到全屏 DirectX 应用时自动切换到 DXGI。
5. 关闭主窗口行为是最小化到托盘，不是退出进程；只有托盘右键"退出"才真正退出。
6. 插件系统遵循 register → load → activate → deactivate → unload 生命周期。
7. 新增工具只需在 `tools/` 下创建目录 + `plugin.json`，不应修改核心代码。
8. 颜色系统不允许使用紫色渐变、米色/奶油色、棕色/橙色系等单色调色板。
9. 不要在 UI 中使用渐变色球/光晕装饰，不要卡片嵌套卡片。
10. 字体：系统默认（含 Microsoft YaHei），代码/数字使用 JetBrains Mono / Cascadia Code。
11. 所有 TypeScript 文件必须通过 `strict: true` 编译。
12. 设置页的热键配置采用"追加按键式"交互（点击输入框 → 按键 → 设为单键；点击"+" → 追加组合键）。
13. 所有外网操作（git push/pull、npm install、npx 下载）必须通过 `socks5://127.0.0.1:7897` 代理。
14. 每次提交前必须完成三项强制验证：代理可用 → 应用无崩溃 → 问题已修复。任一项不通过即中止提交。
15. 开发过程中如发现应用崩溃（白屏、进程退出、未捕获异常），必须优先修复崩溃再继续开发。
