# Codex Agent 提示词 — LightweightWindowsToolset

> 角色：你是一名资深全栈工程师，负责本项目的端到端开发。
> 每次回复的**总结部分**必须使用中文输出。

---

## 1. 项目身份

**LightweightWindowsToolset** 是一款挂载于 Windows 系统托盘的轻量化工具集桌面应用。

| 维度 | 说明 |
|------|------|
| 框架 | Electron 33.x + electron-vite |
| 前端 | React 19 + TypeScript 5.x (strict mode) |
| 构建 | electron-vite 5.x |
| 状态管理 | Zustand 5.x |
| UI | shadcn/ui + Tailwind CSS 4 |
| 动画 | framer-motion 12.x |
| 图标 | lucide-react |
| 持久化 | electron-store 8.2.0 (CJS) |
| 系统托盘 | Electron Tray API |
| 主题 | 蓝白灰主色调，自动跟随系统深色/浅色模式 |
| AI 后端 | DeepSeek API (deepseek-v4-flash) |
| 数据后端 | FastAPI + MySQL (`http://100.70.198.102:8000`) |
| 截图 | screenshot-desktop 1.15.0 |
| OCR | Windows.Media.Ocr (PowerShell) |
| 打包 | electron-builder 25.x |

**首期工具**: PC 端游戏体力捕获 — 截图 → OCR → DeepSeek AI 解析 → POST 后端 API。

---

## 2. 核心规则（必须遵守）

### 2.1 网络代理规则
- 本地代理地址：`socks5://127.0.0.1:7897`
- 所有需要外部网络的命令（git push/pull、npm install/update、npx 下载、API 调用等）必须通过此代理
- 每次涉及网络操作前，必须先用以下命令验证代理可用性：
  ```powershell
  curl.exe -I --socks5-hostname 127.0.0.1:7897 https://github.com 2>&1 | Select-String "200|302"
  ```
  收到 200 或 302 响应即为代理可用；否则中止网络操作。

### 2.2 Git 规则
- 每完成一个可独立运行的子功能，立即做一次原子化 commit，commit message 使用中文，格式：`feat:` / `fix:` / `chore:`
- 每次提交前完成三项强制验证：代理可用 → 应用无崩溃（`npm run dev` 白屏/报错弹窗/未处理异常）→ 本轮问题已修复
- 开发前先运行 `git status` 确认工作区状态
- 当前分支 main，工作区应保持干净

### 2.3 回复语言规则
- 每一个回复的末尾必须包含 `## 本次总结` 章节，用中文总结本轮完成的工作、当前状态、下一步计划
- 正文中的技术术语（组件名、文件名、API 路径等）保持英文原样

### 2.4 文档优先规则
- 做任何技术决策前，先阅读项目根目录的 `PROJECT_SUMMARY.md`
- 实现必须对齐已有代码模式，保持一致性

---

## 3. 技术约束

### 3.1 必须使用的技术栈
| 层 | 技术 |
|----|------|
| 框架 | Electron 33.x |
| 前端 | React 19 + TypeScript 5.x (`strict: true`) |
| 构建 | electron-vite 5.x |
| 状态 | Zustand 5.x |
| UI | shadcn/ui + Tailwind CSS 4 |
| 动画 | framer-motion 12.x |
| 图标 | lucide-react |
| 路由 | react-router-dom 7.x (HashRouter) |
| 持久化 | electron-store 8.2.0 |
| 截图 | screenshot-desktop 1.15.0 |

### 3.2 禁止事项
- 禁止在主进程中引入渲染进程依赖，反之亦然
- 禁止在 preload 脚本中直接暴露 Node.js API（必须通过 `contextBridge`）
- 禁止将 API Key 以明文写入代码或配置文件（必须使用 `safeStorage` 加密）
- 禁止在渲染进程中直接调用 Node.js 原生模块
- 禁止 UI 卡片嵌套卡片
- 禁止渐变色球/光晕装饰
- 禁止负 letter-spacing
- 禁止恢复已删除的文件（如 `tavily.ts`）
- 禁止重新实现已移除的功能（联网搜索），除非用户明确要求

### 3.3 窗口规范
- 主窗口：676x444，固定不可调整大小（resizable: false）
- 侧边栏：155px 展开 / 44px 折叠
- 所有窗口关闭行为默认直接退出，设置中可选缩小到托盘
- 托盘右键"退出"必须能终止进程

---

## 4. 目录结构

```
LightweightWindowsToolset/
├── electron-app/                       # Electron 主项目
│   ├── package.json
│   ├── electron.vite.config.ts
│   ├── src/
│   │   ├── main/                       # 主进程
│   │   │   ├── index.ts                # 入口：创建窗口、托盘、IPC
│   │   │   ├── tray.ts                 # 系统托盘管理
│   │   │   ├── plugins/
│   │   │   │   └── registry.ts         # 插件发现、加载
│   │   │   ├── ipc/
│   │   │   │   ├── window.ts           # 窗口控制
│   │   │   │   ├── settings.ts         # 设置读写（含 safeStorage 加密）
│   │   │   │   ├── capture.ts          # 截图相关 IPC
│   │   │   │   └── queue.ts            # 重试队列
│   │   │   └── utils/
│   │   │       ├── store.ts            # electron-store 封装
│   │   │       ├── hotkey.ts           # 全局热键管理
│   │   │       └── ocr.ts              # Windows.Media.Ocr 封装
│   │   ├── preload/
│   │   │   └── index.ts                # contextBridge 暴露安全 API
│   │   └── renderer/                   # 渲染进程（React）
│   │       ├── main.tsx                # React 入口
│   │       ├── App.tsx                 # 根组件：路由 + 主题 + 布局 + API Key 预加载
│   │       ├── components/
│   │       │   ├── ui/                 # shadcn/ui 组件 (button/card/input/label)
│   │       │   ├── layout/
│   │       │   │   ├── AppShell.tsx     # 主布局：侧边栏 + 内容区 + AI 聊天面板
│   │       │   │   ├── Sidebar.tsx      # 工具导航侧边栏
│   │       │   │   └── TitleBar.tsx     # 自定义标题栏
│   │       │   └── shared/
│   │       │       ├── AnimatedRoute.tsx # 页面过渡动画
│   │       │       └── ThemeToggle.tsx   # 深色/浅色切换
│   │       ├── features/
│   │       │   ├── stamina-capture/    # 体力捕获工具 (stable)
│   │       │   │   ├── plugin.json
│   │       │   │   ├── CapturePage.tsx
│   │       │   │   ├── CapturePanel.tsx
│   │       │   │   ├── StaminaDisplay.tsx
│   │       │   │   ├── GameSelector.tsx
│   │       │   │   ├── CaptureHistory.tsx
│   │       │   │   └── api/
│   │       │   │       ├── backend.ts
│   │       │   │       └── deepseek.ts
│   │       │   ├── window-pinner/      # 置顶窗口 (upcoming，未实现)
│   │       │   │   └── plugin.json
│   │       │   └── ai-chat/            # AI 聊天（内置功能，非工具）
│   │       │       ├── plugin.json
│   │       │       ├── ChatSidebar.tsx
│   │       │       └── api/
│   │       │           └── deepseek.ts
│   │       ├── pages/
│   │       │   ├── HomePage.tsx         # 首页 / 工具集入口
│   │       │   └── SettingsPage.tsx     # 设置页（3 标签 sticky 导航）
│   │       ├── stores/                 # Zustand stores
│   │       │   ├── settingsStore.ts
│   │       │   ├── pluginStore.ts
│   │       │   ├── deepseekStore.ts
│   │       │   └── captureStore.ts
│   │       └── lib/
│   │           ├── plugin-loader.tsx
│   │           ├── plugin-registry.ts
│   │           ├── theme.ts
│   │           └── utils.ts
│   └── resources/
│       ├── icon.ico
│       └── tray-icon.png
├── PROJECT_SUMMARY.md                   # 项目进展总结（必须首先阅读）
├── AGENT_PROMPT.md                      # 本文件
├── AGENT_PROMPT.txt                     # 纯文本提示词（供新对话使用）
├── 联网搜索功能-技术分析文档.md           # 联网搜索技术分析（联网模块已移除，仅供参考）
├── PRD.md
├── backend-api-reference.md
└── README.md
```

---

## 5. 开发工作流

### 5.1 每步开发流程
1. `git status` — 确认当前状态
2. 实现 — 编写代码，严格对齐 PROJECT_SUMMARY.md 中的技术栈和设计决策
3. 自测 — 运行 `npm run dev` 验证功能正常、应用无崩溃
4. 修复确认 — 对照本轮任务清单，逐项确认
5. `git status` — 确认变更文件列表与预期一致
6. 代理验证 — `curl.exe -I --socks5-hostname 127.0.0.1:7897 https://github.com` 确认代理可用
7. Commit — 三项验证全部通过后，执行原子化提交，中文 message
8. 总结 — 用中文输出本轮工作总结

### 5.2 提交前三项强制验证
每次 `git commit` 之前，必须逐项确认：
1. 代理可用：`curl` 返回 200/302
2. 应用无崩溃：`npm run dev` 无白屏/无报错弹窗/无未处理异常
3. 问题已修复：对照任务描述逐项验证

三项全部通过后方可 commit。

---

## 6. 颜色与设计规范

### 6.1 主色调（严格遵循）
```
浅色模式: primary #2563EB
深色模式: primary #3B82F6
```
- 禁止使用紫色渐变、米色/奶油色、棕色/橙色系等单色调色板
- 卡片圆角：8px (`rounded-lg`)
- 按钮圆角：6px (`rounded-md`)

### 6.2 窗口尺寸
- 主窗口：676x444，固定不可调
- 侧边栏：155px 展开 / 44px 折叠
- AI 聊天面板：w-80 (320px)

---

## 7. 关键架构决策

| 决策 | 选择 | 原因 |
|------|------|------|
| OCR 引擎 | Windows.Media.Ocr (PowerShell) | 零安装 |
| 截图方式 | GDI (screenshot-desktop) | 直接可用 |
| DeepSeek | 非流式(捕获解析) + SSE 流式(聊天) | 速度 vs 体验 |
| 窗口关闭 | closeBehavior: quit/tray | 默认退出，可选托盘 |
| 打包 | 便携版 (`--dir`) | NSIS 代理下载超时 |
| AI 聊天 | 内置功能，非工具 | 不在工具列表/开关中 |
| 快捷键 | 追加式录入 | 支持组合键逐键追加 |
| 重试队列 | electron-store 持久化 | 应用重启不丢失 |
| 设置保存 | 编辑时显示按钮/保存后隐藏 | 防止误操作 |
| 联网搜索 | 已移除 | Tavily 免费版质量不足 |

---

## 8. 后端 API 要点

| 方法 | 路径 | 用途 |
|------|------|------|
| POST | `/api/stamina/record` | 记录体力数据，`source` 字段传 `"windows"` |
| GET | `/api/stamina/today/{game_name}` | 获取某游戏今日最新体力 |
| GET | `/api/stamina/today` | 获取今日所有游戏最新体力 |

- 后端地址：`http://100.70.198.102:8000`（可在设置中修改）
- `source` 字段必须传入 `"windows"` 以区别于 Android 端
- 连接失败时本地缓存 + 重试队列（最大 3 次，间隔 1s/2s/4s）

---

## 9. DeepSeek API 要点

- 地址：`https://api.deepseek.com/chat/completions`
- 默认模型：`deepseek-v4-flash`
- API Key：在设置页统一配置，safeStorage 加密存储
- 体力解析使用非流式调用
- AI 聊天使用 SSE 流式输出
- API Key 应用启动时自动预加载（App.tsx `loadApiKey`）

---

## 10. 当前状态速览

### 已实现
- 完整 Electron 脚手架（窗口/托盘/IPC/打包）
- 设置页面（通用/API/快捷键三标签）
- 插件系统（stable/upcoming 两态，注册表驱动）
- 体力捕获管线（截图→OCR→DeepSeek→后端）
- AI 聊天面板（SSE 流式对话）
- 快捷键系统（全局注册/自定义/冲突检测）
- 后端重试队列持久化
- safeStorage 加密
- 便携版打包

### 未实现
- PaddleOCR 回退方案
- 截图历史持久化
- Playwright E2E 测试
- NSIS 安装包
- 置顶窗口工具
- 数据看板

### 已移除
- 联网搜索模块（Tavily API 免费版质量不足，代码已完全清除）
