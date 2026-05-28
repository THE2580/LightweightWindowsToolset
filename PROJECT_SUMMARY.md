> 最后更新: 2026-05-28 (第三轮 — 快捷键系统全面修复完毕)
> 当前分支: main
> 最新提交: b82ecde fix: 开机自启设置未生效
> 总提交数: 80 (领先 origin/main 10 个提交)
> 当前状态: 编译通过 + 打包成功 + 快捷键/开机自启均已验证生效

---

## 一、项目概览

一款挂载于 Windows 系统托盘的轻量化插件式桌面工具集。首期工具为 PC 端游戏体力捕获（截图 → OCR → DeepSeek AI 解析 → 后端 API）。

### 技术栈

| 层    | 技术                                 |
| ---- | ---------------------------------- |
| 框架   | Electron 33.x                      |
| 构建   | electron-vite 5.x (Vite 7.3.3)     |
| 前端   | React 19 + TypeScript 5.x (strict) |
| 状态管理 | Zustand 5.x                        |
| UI   | shadcn/ui + Tailwind CSS 4         |
| 动画   | framer-motion 12.x                  |
| 图标   | lucide-react 0.460.x               |
| 持久化  | electron-store 8.2.0 (CJS)         |
| 路由   | react-router-dom 7.x (HashRouter)  |
| 打包   | electron-builder 25.x              |
| 截图   | screenshot-desktop 1.15.0           |
| OCR  | Windows.Media.Ocr (PowerShell)，多语言回退链 |

### 关键配置

- **代理**: `socks5://127.0.0.1:7897`（所有网络操作必须通过）
- **后端 API**: `http://100.70.198.102:8000`（FastAPI + MySQL，可在设置中修改）
- **DeepSeek API**: `https://api.deepseek.com/chat/completions`，默认模型 `deepseek-v4-flash`
- **项目根目录**: `E:\codex_agent_project\LightweightWindowsToolset`
- **Electron 应用目录**: `electron-app/`
- **开发命令**: `cd electron-app && npm run dev`
- **构建命令**: `cd electron-app && npx electron-vite build`
- **打包命令**: `cd electron-app && npm run package`（仅当明确要求时执行）
- **E2E 测试**: `cd electron-app && npm run test:e2e`
- **主窗口**: 676x444，固定不可调整大小，单实例锁
- **侧边栏**: 155px 展开 / 44px 折叠

---

## 二、已实现功能

### 核心框架
- Electron 33 + electron-vite + React 19 + TypeScript strict 完整脚手架
- Tailwind CSS 4 蓝白灰主题（light: primary #2563EB / dark: primary #3B82F6）
- BrowserWindow 676x444 固定，frameless，单实例锁
- 系统托盘：左键显示/隐藏，右键动态菜单（工具管理 checkbox / 设置 / 退出）
- contextBridge 安全 IPC：window / settings / capture / tray / hotkey / queue / tool
- electron-store 持久化设置，safeStorage 加密 API Key
- 自定义标题栏（最小化/关闭，动态标题）
- 侧边栏 155px/44px 折叠动画（framer-motion）
- 主题切换（跟随系统 / 浅色 / 深色）
- 窗口关闭行为：默认直接退出，设置中可选缩小到托盘
- 托盘右键"退出"完整终止进程
- 单实例锁 + `isQuitting` 标记 + `destroyTray()` + `app.quit()`

### 设置页面
- 三标签 sticky 导航栏（通用 | API 设置 | 快捷键）
- **通用**: 窗口标题（保存/重置）、开机自启、主题模式、关闭行为、AI 聊天点击外部关闭、AI 聊天自动展开（含检测区域全局显示 + 宽高滑块）
- **API**: DeepSeek API Key（密码切换 + safeStorage 加密）/ 模型名称 / 后端 API 地址
- **快捷键**: 追加式按键录入，详细规则见下方「快捷键系统」章节
- 输入框保存逻辑：编辑时显示保存按钮，保存成功后隐藏

### 插件/工具系统
- stable / upcoming 两态，BUILTIN_PLUGINS 静态注册表
- 侧边栏 / 主页卡片从注册表动态渲染，开关双向同步
- 托盘菜单动态重建，checkbox 状态同步
- AI 聊天属于内置功能不是工具，不在工具列表和开关中出现
- 工具禁用时通知主进程注销对应快捷键，启用时恢复

### 体力捕获管线
- 截图（screenshot-desktop GDI）→ OCR（Windows.Media.Ocr via PowerShell，多语言回退链）→ DeepSeek AI 解析 → 后端 POST
- 后台快捷键触发完整管线，不依赖 UI 页面
- 游戏选择器 / 体力展示 / 今日记录 UI
- Electron Notification 捕获成功/失败通知
- 后端 API 指数退避重试（1s/2s/4s，最多 3 次）
- 重试队列持久化（electron-store），应用重启不丢失，启动时自动冲刷

### OCR 模块
- Windows.Media.Ocr via PowerShell，零安装依赖
- 语言回退链：zh-Hans-CN → ja-JP → en-US → zh-Hans → zh-CN → 用户配置文件
- OCR_ENGINE_FAILED 标记使 fallback 尝试静默跳过

### AI 聊天
- ChatSidebar SSE 流式对话
- 右侧滑入滑出动画，点击外部关闭 / hover 检测区自动展开
- API Key 启动预加载

### 快捷键系统（第三轮完整版）
- 全局快捷键注册/注销（globalShortcut API）
- **无默认快捷键**：所有工具初始不绑定，用户需手动配置
- **工具禁用联动**：禁用工具时 IPC 通知主进程注销快捷键
- **追加式按键录入**：`配置快捷键` → `+` `-` `保存` `取消` 按钮
- **三色槽位状态**：活跃监听橙色 / 已录入黄色 / 空态虚线
- **保存时去重**：自动丢弃重复按键
- **JSON 数组存储**（`'["Control","C"]'`），消除 `+` 分隔符歧义，向后兼容旧格式
- **保存时统一校验**（不在输入时实时拦截）：
  - 至少 2 键（≥1 修饰键 + 恰好 1 普通键）
  - 严格左修饰右普通，不允许交替排列
  - 仅一个普通键（Electron 不支持多字符组合如 Ctrl+B+C）
- **录入时禁用全局快捷键**：`startEdit` 调 `disableAllHotkeys`，`saveHotkey`/`cancelEdit` 调 `enableAllHotkeys`
- **清空快捷键彻底注销**：空 accelerator 时更新 `hotkeyActions` 防止 `enableAllHotkeys` 重注册
- **空 accelerator 保护**：`unregisterSingleHotkey` 跳过空字符串
- **保存按钮始终可点击**，不合法时红色提示

### 开机自启
- 设置页开关，实时调用 `app.setLoginItemSettings()`
- 模块加载时读取存储值同步一次
- 已打包 EXE 验证：任务管理器启动标签中可见实时开启/关闭

### E2E 测试
- Playwright Electron 测试框架，28 条自动化 UI 测试
- 运行命令：`npm run test:e2e`（`node tests/run-e2e.js`）

---

## 三、未实现功能

| 功能 | 原因 |
|------|------|
| 截图管线端到端实测 | 依赖实际游戏窗口 |
| 截图历史记录持久化 | 当前仅内存状态 |
| safeStorage / Notification 打包实测 | 未完整验证 |
| 置顶窗口工具（window-pinner） | status: upcoming |
| NSIS 安装包 | 代理下载 winCodeSign 不稳定 |
| 数据看板 / 窗口管理工具 | 未进入开发计划 |

---

## 四、已修复问题

| 问题 | 修复提交 |
|------|----------|
| 托盘退出无效 | 244a244 |
| 窗口尺寸调整（最终 676x444） | 多次迭代 |
| 侧边栏折叠动画文字闪烁 | 1341a61 |
| 关闭按钮不终止进程 | e2a3d8e, 37ee654 |
| 托盘工具开关双向同步 | 82620aa |
| 后端重试队列持久化 | 5b26798 |
| AI 聊天面板重复标题 | 823cd3c |
| winCodeSign 签名 symlink 失败 | 66b8268 |
| AI 聊天面板乱码（UTF-8 损坏） | ec72721 |
| API 设置自动保存 | 0f5ed72, 7082e67 |
| AI 聊天需先打开设置才可用 | c70b316 |
| 设置页白屏 | d2cef3d |
| 联网搜索模块整体移除 | 7f57319 |
| 工具禁用后快捷键仍触发 | 2d2d804 |
| 快捷键保存时去重 | f2cca1f |
| 快捷键闭包陈旧仅保存末键 | 7d4f44e |
| 快捷键存储 `+` 分隔符歧义 → JSON 数组 | 8a6bf4e |
| 录入时未禁用全局快捷键 | 7c9600e |
| `unregister('')` 崩溃 | c8d9687 |
| 首键修饰键被误拒 | fdf94b5 |
| 单键可保存绕过 | e826a0a |
| 输入时实时校验干扰录入 | f6616c9 |
| 校验逻辑不严谨（Ctrl+C+D 误拦） | 5f1fedc |
| 多字符组合 Ctrl+B+C 中间键被裁剪 | 8b07c08 |
| 开机自启设置未生效 | b82ecde |

---

## 五、关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| OCR 引擎 | Windows.Media.Ocr (PowerShell) + 回退链 | 零安装 |
| 截图方式 | GDI (screenshot-desktop) | 直接可用 |
| DeepSeek | 非流式(解析) + SSE 流式(聊天) | 速度 vs 体验 |
| 窗口关闭 | closeBehavior: quit/tray | 默认退出，可选托盘 |
| 打包 | 便携版 (`--dir`) | NSIS 代理下载超时 |
| 侧边栏 | 155px / 44px | 适配 676x444 窗口 |
| AI 聊天 | 内置功能，非工具 | 不在工具列表/开关中 |
| 快捷键存储 | JSON 数组序列化 | 消除 `+` 分隔符歧义 |
| 快捷键校验 | 保存时一次性检测 | 避免录入时实时拦截干扰 |
| 快捷键规则 | 左修饰右普通 + 仅 1 普通键 | Electron accelerator 限制 |
| 重试队列 | electron-store 持久化 | 重启不丢失 |
| 设置保存 | 显式保存按钮 | 防止误操作 |
| 联网搜索 | 已移除 | Tavily 免费版质量不足 |
| E2E 测试 | Playwright Electron 独立脚本 | 避免框架兼容问题 |
| 开机自启 | `app.setLoginItemSettings()` | 实时调用，打包验证 |

---

## 六、Git 仓库

- Remote: https://github.com/THE2580/LightweightWindowsToolset
- Branch: main
- 领先 origin/main: 10 个提交
- 代理: socks5://127.0.0.1:7897

---

## 七、环境

- OS: Windows（屏幕 2240x1400）
- Node.js: v24.12.0, npm: 11.6.2
- gh CLI: 已认证（THE2580）
- 代理: socks5://127.0.0.1:7897
- 开发服务器: `cd electron-app && npm run dev`
