# LightweightWindowsToolset — 产品需求文档 (PRD)

> 轻量化 Windows 桌面工具集应用
> 版本: v1.0.0-draft | 最后更新: 2026-05-26

---

## 1. 产品概述

### 1.1 产品定位

一款挂载于 Windows 系统托盘的轻量化工具集桌面应用。采用 **插件化架构**，每个功能以独立"工具"模块形式加载，支持热扩展。首个开发工具为**电脑端游戏体力捕获工具**（复用既有后端 API）。

### 1.2 核心目标

| 维度 | 目标 |
|------|------|
| 资源占用 | 内存 ≤ 100MB（空闲 ~40MB），CPU ≤ 5%（空闲 ~0.5%） |
| 启动速度 | 冷启动 < 2s，热启动（托盘恢复）< 200ms |
| 可扩展性 | 新增工具只需添加一个目录 + 注册配置文件，不改核心代码 |
| 视觉体验 | 蓝白灰主色调，自动跟随系统深色/浅色模式，60fps 过渡动画 |
| 隐蔽性 | 最小化到系统托盘，后台运行不打扰 |

---

## 2. 技术架构

### 2.1 技术选型

| 层 | 技术 | 理由 |
|----|------|------|
| 框架 | **Electron 33.x** | 跨平台潜力，成熟生态，系统托盘原生支持 |
| 前端 | **React 19 + TypeScript 5.x** | 组件化，类型安全，生态丰富 |
| 构建 | **Vite 6.x (electron-vite)** | 极速 HMR，多窗口支持 |
| 状态管理 | **Zustand** | 轻量（< 1KB），无 boilerplate，支持 persist 中间件 |
| UI 组件 | **shadcn/ui + Tailwind CSS 4** | 蓝白灰主题定制，自动深色模式，组件可 tree-shake |
| 动画 | **framer-motion** | 声明式动画，layout 动画，60fps |
| 插件系统 | **自研 PluginsRegistry** | 动态 import，沙箱隔离，权限控制 |
| 系统托盘 | **Electron Tray API** | 原生托盘 + 右键菜单 |
| 主题 | **Tailwind dark: 类 + CSS 变量** | 跟随系统 + 手动切换 |
| AI 聊天 | **DeepSeek API (复用现有)** | 流式 SSE，与 Android 端共用逻辑 |

### 2.2 为什么选 Electron 而不是 Python GUI / WPF

| 方案 | 资源占用 | 开发效率 | UI 美观度 | 可扩展性 | 跨平台 |
|------|---------|---------|----------|---------|--------|
| **Electron** | 中等 (~40-100MB) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ |
| Python (PyQt/tkinter) | 低 (~20-50MB) | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ❌ |
| WPF (.NET) | 低 (~15-30MB) | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ❌ |
| Tauri 2.x | 极低 (~5-15MB) | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ✅ |

> **选择 Electron 的核心理由**：
> - React + Tailwind + shadcn/ui 的前端生态让 UI 美观度和开发效率远超原生方案
> - 插件系统天然适合"动态加载工具模块"的需求（CommonJS/ESM require 即用）
> - Node.js 生态可直接与既有 Python 后端通过 HTTP 通信
> - 资源占用通过以下手段可控：仅加载当前工具、BrowserWindow 按需创建、shared 进程模型
> - 若未来资源占用成为瓶颈，可迁移至 Tauri（React 前端可直接复用）

### 2.3 目录结构

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
│   │   │   │   ├── window.ts           # 窗口控制（最小化/置顶/恢复）
│   │   │   │   ├── settings.ts         # 设置读写
│   │   │   │   └── capture.ts          # 截图相关 IPC（体力捕获工具专用）
│   │   │   └── utils/
│   │   │       ├── store.ts            # electron-store 封装
│   │   │       └── hotkey.ts           # 全局热键管理
│   │   │
│   │   ├── preload/                    # 预加载脚本
│   │   │   └── index.ts                # contextBridge 暴露安全 API
│   │   │
│   │   └── renderer/                   # 渲染进程（React）
│   │       ├── index.html
│   │       ├── main.tsx                # React 入口
│   │       ├── App.tsx                 # 根组件：路由 + 主题 + 布局
│   │       ├── styles/
│   │       │   └── globals.css         # Tailwind + CSS 变量 + 主题色
│   │       ├── components/             # 通用 UI 组件
│   │       │   ├── ui/                 # shadcn/ui 组件（button, card, dialog...）
│   │       │   ├── layout/
│   │       │   │   ├── AppShell.tsx     # 主布局：侧边栏 + 内容区
│   │       │   │   ├── Sidebar.tsx      # 工具导航侧边栏
│   │       │   │   └── TitleBar.tsx     # 自定义标题栏（最小化/关闭）
│   │       │   └── shared/
│   │       │       ├── AnimatedRoute.tsx # 页面过渡动画
│   │       │       └── ThemeToggle.tsx   # 深色/浅色切换
│   │       │
│   │       ├── features/               # 功能模块（工具插件）
│   │       │   ├── stamina-capture/    # ★ 工具1：体力捕获
│   │       │   │   ├── index.ts        # 工具注册入口
│   │       │   │   ├── plugin.json     # 工具元数据
│   │       │   │   ├── CapturePage.tsx  # 主页面
│   │       │   │   ├── CapturePanel.tsx # 截图控制面板
│   │       │   │   ├── StaminaDisplay.tsx # 体力数据显示
│   │       │   │   ├── GameSelector.tsx # 游戏选择器
│   │       │   │   ├── CaptureHistory.tsx # 截图历史
│   │       │   │   └── api/
│   │       │   │       ├── backend.ts   # 后端 API 调用
│   │       │   │       └── deepseek.ts  # DeepSeek AI 解析
│   │       │   │
│   │       │   ├── window-pinner/      # ○ 工具2（待定）：置顶焦点窗口
│   │       │   │   ├── index.ts
│   │       │   │   └── plugin.json
│   │       │   │
│   │       │   └── ai-chat/            # AI 聊天（内置工具）
│   │       │       ├── index.ts
│   │       │       ├── plugin.json
│   │       │       ├── ChatSidebar.tsx
│   │       │       └── api/
│   │       │           └── deepseek.ts
│   │       │
│   │       ├── pages/
│   │       │   ├── HomePage.tsx         # 首页 / 工具集入口
│   │       │   └── SettingsPage.tsx     # 设置页
│   │       │
│   │       ├─── stores/                 # Zustand stores
│   │       │   ├─── settingsStore.ts    # 全局设置
│   │       │   ├─── pluginStore.ts      # 插件列表/状态
│   │       │   ├─── deepseekStore.ts    # 共享 DeepSeek API 配置（Key/模型，所有工具共用）
│   │       │   └─── captureStore.ts     # 体力捕获状态（工具1专用）
│   │       └── lib/                    # 工具函数
│   │           ├── plugin-loader.ts    # 前端插件加载器
│   │           └── theme.ts            # 主题工具
│   │
│   └── resources/                      # 应用图标等静态资源
│       ├── icon.ico
│       └── tray-icon.png
│
├── tools/                              # 插件目录（可独立开发）
│   ├── stamina-capture/                # ★ 工具1
│   │   └── plugin.json
│   ├── window-pinner/                  # ○ 工具2（待定）
│   │   └── plugin.json
│   └── _template/                      # 新工具模板
│       └── plugin.json
│
├── backend-api-reference.md            # 后端 API 复用文档（已创建）
├── PRD.md                              # 本文档
└── README.md
```

---

## 3. 功能需求

### 3.1 系统级功能

#### 3.1.1 系统托盘
- **关闭行为**：点击主窗口关闭按钮 → 最小化到系统托盘（不退出应用），右键托盘菜单选“退出”才真正关闭进程
- **空闲态**：显示应用图标，左键点击恢复主窗口，右键弹出菜单
- **右键菜单**：
  - 显示主窗口
  - 快速截图（体力捕获）
  - 切换置顶窗口（将来）
  - ────────
  - 设置
  - 退出
- **通知**：体力捕获完成、AI 解析结果等通过系统通知（Notification API）弹出
- **开机自启**：设置页可选开关

#### 3.1.2 主题系统
| 模式 | 触发条件 | 主色 | 背景 | 文字 |
|------|---------|------|------|------|
| 浅色 | 系统浅色 / 手动选择 | 蓝色 #2563EB | 白色 #FFFFFF / 灰色 #F8FAFC | #1E293B |
| 深色 | 系统深色 / 手动选择 | 蓝色 #3B82F6 | 深灰 #0F172A / #1E293B | #F1F5F9 |

- 主题切换：0.3s 过渡动画（CSS transition on `color`, `background-color`, `border-color`）
- 默认：跟随系统（`prefers-color-scheme`），设置页可改为手动
- 所有组件使用 Tailwind `dark:` 前缀 + shadcn/ui 内置暗色模式支持

#### 3.1.3 设置界面

设置页分为以下板块：

**通用**
- 开机自启（开关，默认关）
- 语言（预留）
- 主题模式（跟随系统 / 浅色 / 深色）
- AI 聊天面板位置（左侧 / 右侧，默认右侧）

**API 设置**
- DeepSeek API Key（加密存储）
- 模型选择（默认 `deepseek-v4-flash`，所有工具共用）
- 后端 API 地址（默认 `http://100.70.198.102:8000`）

**快捷键设置**（统一板块，按工具划分）
- 每个工具独立一个快捷键配置区域，显示工具名称和其声明的快捷键项
- **追加按键式配置**：
  - 点击快捷键输入框，按下一个键 → 设为单键快捷键（如 `D`）
  - 点击右侧“+”按钮 → 追加一个按键，变为组合快捷键（如 `Ctrl + D`）
  - 可继续追加，形成多键组合（如 `Ctrl + Shift + D`）
  - 每个按键右侧有“×”按钮可移除该键
  - 快捷键冲突时输入框变红，提示已被其他功能占用
- 预设快捷键：体力捕获 `Ctrl + Shift + D`，AI 聊天 `Ctrl + Shift + A`

**工具管理**
- 各工具的独立设置项（由工具 plugin.json 声明）

设置持久化：electron-store (JSON 文件)，API Key 使用 Electron safeStorage 加密存储

#### 3.1.4 全局热键
所有全局快捷键统一在设置页“快捷键设置”板块中配置，支持单键、双键、多键组合，采用追加按键式交互。
- 热键仅在主窗口存在时注册，避免冲突
- 注册失败时输入框变红提示冲突


### 3.2 ★ 工具1：电脑端游戏体力捕获工具 (Phase 1)

#### 3.2.1 功能概述
在 PC 端玩游戏时，一键截取游戏窗口中的体力 UI 区域 → OCR 识别 → DeepSeek AI 解析 `xx/yy` 格式 → 提交到后端 API 存入 MySQL。Android 端和 PC 端共享同一数据库。

#### 3.2.2 用户流程

```
[用户玩游戏] → 按 Ctrl+Shift+D 或点击界面上"截图"按钮
    → [截取当前前台窗口]（GDI BitBlt）
    → [可选：手动框选体力区域]（若自动识别不准确）
    → [OCR 提取文字]（PaddleOCR 或 Windows.Media.Ocr）
    → [DeepSeek AI 解析 xx/yy]（复用 Android 端 prompt）
    → [显示解析结果]（剩余/最大体力 + 恢复时间预测）
    → [自动 POST 到后端 API]（/api/stamina/record）
    → [系统通知：捕获成功]
    → [列表展示今日所有游戏体力状态]
```

#### 3.2.3 UI 布局

```
┌─────────────────────────────────────────────┐
│  [侧边栏]          │  体力捕获 — 原神        │
│                    │                        │
│  🏠 首页           │  ┌──────────────────┐  │
│  ⚡ 体力捕获       │  │                  │  │
│  📌 置顶窗口(待定) │  │   游戏选择器     │  │
│  💬 AI 聊天       │  │   [原神 ▾]      │  │
│                    │  │                  │  │
│                    │  └──────────────────┘  │
│                    │                        │
│                    │  ┌──────────────────┐  │
│                    │  │   体力状态卡片   │  │
│                    │  │                  │  │
│                    │  │  62 / 200 (31%)  │  │
│                    │  │  ████████░░░░░░  │  │
│                    │  │  下次恢复: 8分钟  │  │
│                    │  │                  │  │
│                    │  └──────────────────┘  │
│                    │                        │
│                    │  [📷 截图捕获体力]     │
│                    │                        │
│                    │  ── 今日记录 ─────────  │
│                    │  │ 原神  62/200     │  │
│                    │  │ 绝区零 180/240   │  │
│                    │  └──────────────────┘  │
│                    │                        │
│  ⚙ 设置           │                        │
│                    │                        │
│  ────────────────  │                        │
│  💬 AI 聊天  [▶]   │                        │
│  (点击展开侧边栏)   │                        │
└─────────────────────────────────────────────┘
```

#### 3.2.4 技术细节

**截图方式**（主进程 native module）：
| 方式 | 适用场景 | 实现 |
|------|---------|------|
| GDI BitBlt | 窗口模式游戏、普通应用 | `screenshot-desktop` npm 包 或自行编写 native addon |
| DXGI Desktop Duplication | 全屏 DirectX 游戏（如原神全屏） | `dxgi-screen-capture` 或自行实现 |

- 默认使用 GDI，检测到全屏 DirectX 应用时自动切换到 DXGI
- 截图不存盘（内存中流转），OCR 完成后释放

**OCR 方案**：
| 方案 | 集成方式 | 优势 | 劣势 |
|------|---------|------|------|
| **PaddleOCR JSON API** | 本地 HTTP 服务 (Flask 包裹) | 准确率最高 95%+ | 需安装 paddlepaddle，体积 ~150MB |
| **Windows.Media.Ocr** | Node.js ffi 调用 UWP API | 零依赖，系统内置 | 准确率稍低 88-93% |

- **推荐**：开发阶段用 Windows.Media.Ocr（零安装），后期可选配 PaddleOCR 提升准确率
- OCR 在 worker_thread 中执行，不阻塞 UI

**AI 解析**：
- 完全复用 Android 端 `StaminaOcrProcessor` 中的 prompt 模板和 JSON 提取正则
- 调用共享 DeepSeek API（地址、Key、模型均从统一配置读取）
- 支持流式响应（SSE）显示解析进度

**后端通信**：
- 复用现有后端 API（详见 `backend-api-reference.md` §3）
- `source` 字段传 `"windows"` 区别于 Android 端
- 连接失败时本地缓存 + 重试队列（最多 3 次，间隔递增）

#### 3.2.5 状态管理（Zustand Store）

```typescript
interface CaptureStore {
  // 当前选择游戏
  selectedGame: GameId;
  // 体力状态
  stamina: { remaining: number | null; max: number | null } | null;
  // OCR 原始文本
  ocrText: string;
  // 截图状态
  captureState: 'idle' | 'capturing' | 'ocr' | 'parsing' | 'posting' | 'done' | 'error';
  // 今日记录
  todayRecords: StaminaRecord[];
  // 动作
  triggerCapture: () => Promise<void>;
  selectGame: (id: GameId) => void;
  refreshTodayRecords: () => Promise<void>;
}
```

---

### 3.3 共享 DeepSeek API 配置

工具集中的 AI 聊天与体力捕获工具的 AI 解析**共用同一套 DeepSeek API 配置**。后续新增工具如需调用 AI，直接复用此配置，无需重复设置。

- **默认模型**：`deepseek-v4-flash`（可在设置中切换）
- **API 地址**：`https://api.deepseek.com/chat/completions`
- **API Key**：在设置页统一配置，加密存储（`safeStorage`）
- **流式**：AI 聊天使用 SSE 流式输出；体力解析使用非流式（更快返回 JSON 结果）
- **配置作用域**：全局单例，所有工具通过 `useDeepSeekStore` 获取

### 3.4 AI 聊天（全局侧边栏面板）

#### 3.4.1 功能概述
全局 AI 聊天面板，固定于主窗口侧边。点击展开按钮后从侧边滑出，**默认右侧，从右向左展开**（设为左侧时从左向右展开）。不绑定任何游戏角色，作为通用 AI 助手使用。

- **展开/折叠**：侧边栏底部固定 AI 聊天展开按钮，点击后聊天面板滑出（宽度 360px），带 200ms ease-out 滑动动画
- **滑动方向**：默认右侧 → 从右向左展开；设置中改为左侧 → 从左向右展开
- **流式输出**（SSE）：逐字显示 AI 回复
- **对话历史**：本地 IndexedDB 持久化，最多保留 50 轮
- **通用助手**：单一通用 prompt，不为游戏角色预设（与 Android 端 AI 聊天不同）
- **API 配置**：使用共享 DeepSeek API 配置（§3.3），默认模型 `deepseek-v4-flash`

---

### 3.5 ○ 工具2：置顶焦点窗口 (Phase 2，待定)

#### 3.5.1 功能设想
- 选择一个窗口 → 将其"钉"在屏幕最上层（`alwaysOnTop`）
- 可调节窗口透明度（10%-100%）
- "点击穿透"模式：窗口置顶但不拦截鼠标事件
- 快速切换：系统托盘右键菜单一键置顶/取消

---

## 4. 插件系统设计

### 4.1 插件注册格式

每个工具一个目录，内含 `plugin.json`：

```json
{
  "id": "stamina-capture",
  "name": "体力捕获",
  "version": "1.0.0",
  "description": "截取游戏窗口自动识别体力值",
  "icon": "zap",
  "entry": "./CapturePage.tsx",
  "settings": [
    {
      "key": "captureHotkey",
      "label": "截图快捷键",
      "type": "hotkey",
      "default": "Ctrl+Shift+D"
    },
    {
      "key": "autoPost",
      "label": "自动提交后端",
      "type": "boolean",
      "default": true
    }
  ],
  "permissions": ["screen-capture", "http-api"],
  "minWindow": { "width": 800, "height": 600 }
}
```

### 4.2 生命周期

```
注册(register) → 加载(load) → 激活(activate) → 停用(deactivate) → 卸载(unload)
```

- **register**：应用启动时扫描 `tools/` 或 `features/` 目录发现插件
- **load**：用户首次点击工具时动态 import 组件
- **activate**：切换到该工具页面
- **deactivate**：切换到其他工具，组件保持挂载（keep-alive）或卸载（取决于内存策略）
- **unload**：仅在应用退出时

### 4.3 添加新工具的步骤

1. 在 `tools/` 下创建目录 `my-tool/`
2. 编写 `plugin.json` 声明元数据
3. 编写 `index.ts` 导出 React 组件
4. 重启应用或点击"刷新插件" → 自动出现在侧边栏

---

## 5. 非功能需求

### 5.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|---------|
| 空闲内存 | ≤ 40MB | 任务管理器 - 工作集 |
| 空闲 CPU | ≤ 0.5% | 任务管理器 |
| 截图时内存峰值 | ≤ 80MB | 截图流程中监控 |
| OCR 时 CPU 峰值 | ≤ 20% | 单次 OCR 不超过 2s |
| 冷启动时间 | < 2s | app.on('ready') 到窗口首次渲染 |
| 页面切换动画 | 60fps | Chrome DevTools Performance |
| 安装包大小 | ≤ 80MB | NSIS 安装包 |

### 5.2 安全性

- **IPC 隔离**：渲染进程通过 preload 脚本的 `contextBridge` 访问有限 API，不直接暴露 Node.js
- **API Key 加密**：使用 `safeStorage` (Electron) 加密存储 DeepSeek API Key
- **插件权限**：`plugin.json` 声明所需权限，主进程校验
- **CSP 头**：设置 Content-Security-Policy 限制脚本来源

### 5.3 可维护性

- **TypeScript strict mode**：全项目 `strict: true`
- **ESLint + Prettier**：统一代码风格
- **组件测试**：关键组件用 Vitest + React Testing Library
- **E2E 测试**：Playwright（体力捕获流程）

---

## 6. 开发路线图

### Phase 1 — MVP（体力捕获工具） ⬅ 当前

| 任务 | 预估工时 | 优先级 |
|------|---------|--------|
| Electron 项目脚手架（electron-vite + React + TS） | 2h | P0 |
| Tailwind + shadcn/ui 主题配置（蓝白灰 + 深色模式） | 3h | P0 |
| 主进程：窗口管理 + 系统托盘 + IPC 通道 | 3h | P0 |
| 插件系统基础（注册/加载/侧边栏导航） | 4h | P0 |
| 设置页面（主题/AI/后端/热键） | 4h | P0 |
| 通用 UI 组件（侧边栏、标题栏、过渡动画） | 4h | P0 |
| AI 聊天组件（流式 SSE + 对话历史） | 4h | P1 |
| **体力捕获工具核心** | | |
| ├ 截图模块（GDI + DXGI 回退） | 6h | P0 |
| ├ OCR 模块（Windows.Media.Ocr 集成） | 4h | P0 |
| ├ DeepSeek AI 解析 | 2h | P0 |
| ├ 后端 API 对接（POST + GET） | 2h | P0 |
| ├ 游戏选择器 + 体力展示 UI | 4h | P0 |
| └ 截图历史列表 | 2h | P1 |
| 热键注册 + 通知 | 2h | P1 |
| 打包配置（electron-builder + NSIS） | 2h | P1 |
| 测试 + bug 修复 | 4h | P2 |

### Phase 2 — 置顶焦点窗口

| 任务 | 预估工时 |
|------|---------|
| 窗口枚举（EnumWindows）native addon | 4h |
| 窗口置顶/取消 + 透明度调节 | 3h |
| 点击穿透模式 | 2h |
| 系统托盘快捷切换 | 1h |

### Phase 3 — 增强

- 插件市场（远程加载社区工具）
- 数据看板（体力趋势图表）
- 多语言支持
- Tauri 迁移评估

---

## 7. 设计规范

### 7.1 色彩系统

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

### 7.2 字体
- 系统默认：`-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif`
- 代码/数字：`"JetBrains Mono", "Cascadia Code", monospace`（体力数字展示）
- 字号：正文 14px，标题 18px/24px，体力数字 32px（大号醒目）

### 7.3 间距与圆角
- 间距系统：Tailwind 默认（4px 步进）
- 卡片圆角：8px（`rounded-lg`）
- 按钮圆角：6px（`rounded-md`）
- 侧边栏宽度：220px（折叠后 56px）

### 7.4 动画规范
- 页面切换：`framer-motion` slide + fade，200ms ease-out
- 侧边栏折叠：width transition，200ms
- 体力进度条：CSS transition，500ms ease
- 按钮 hover：scale(1.02) + shadow，150ms
- 通知弹出：slide from right，300ms spring

---

## 8. 复用清单（来自 AndroidGameInfoTools 项目）

| 复用什么 | 来源 | 用于 |
|---------|------|------|
| DeepSeek AI prompt 模板 | `StaminaOcrProcessor.kt` | 体力值解析 |
| JSON 提取正则 | `StaminaOcrProcessor.kt` | AI 响应解析 |
| 后端 API 全部 | `backend/main.py` | 数据持久化 |
| 数据库表结构 | `backend/models.py` | 数据模型参考 |
| 游戏配置 (GameId + 体力名) | `model/GameConfig.kt` | 游戏选择器 |
| DeepSeek API 调用模式 | `DeepSeekClient.kt` | 共享 API 配置，默认 `deepseek-v4-flash`，所有工具可复用 |
| 体力计算逻辑 | `StaminaViewModel.kt` | 恢复时间/目标计算 |

---

## 9. 附录

### A. package.json 核心依赖

```json
{
  "name": "lightweight-windows-toolset",
  "version": "1.0.0",
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "package": "electron-builder"
  },
  "dependencies": {
    "electron-store": "^10.0.0",
    "screenshot-desktop": "^2.0.0",
    "zustand": "^5.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "framer-motion": "^12.0.0",
    "lucide-react": "^0.460.0",
    "tailwindcss": "^4.0.0",
    "clsx": "^2.1.0",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "@electron-toolkit/preload": "^3.0.0",
    "@electron-toolkit/utils": "^4.0.0",
    "electron": "^33.0.0",
    "electron-vite": "^2.4.0",
    "electron-builder": "^25.0.0",
    "typescript": "^5.7.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "shadcn-ui": "^0.9.0"
  }
}
```

### B. 最小窗口尺寸

- 主窗口：960×680（最小 800×600）
- 设置窗口：600×500（模态对话框）
- AI 聊天：可作为独立小窗或内嵌面板

### C. 风险和缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| Electron 资源占用超标 | 中 | 中 | 延迟加载工具、单窗口架构、shared 进程 |
| Windows.Media.Ocr 准确率不足 | 中 | 高 | 预留 PaddleOCR 接入接口 |
| DXGI 全屏游戏截图黑屏 | 低 | 高 | 检测后自动切 GDI 窗口截图 |
| DeepSeek API 限流 | 低 | 中 | 本地缓存 + 重试队列 |
| vivo 设备 logcat 调试困难（不相关） | — | — | PC 端无此问题 |
