# LightweightWindowsToolset — 项目开发进展总结

> 最后更新: 2026-05-27
> 当前分支: main
> 最新提交: 750dbf8 docs: 全面更新 PROJECT_SUMMARY + 生成 AGENT_PROMPT
> 总提交数: 60 (与 origin/main 同步)

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
| OCR  | Windows.Media.Ocr (PowerShell)     |

### 关键配置

- **代理**: `socks5://127.0.0.1:7897`（所有网络操作必须通过）
- **后端 API**: `http://100.70.198.102:8000`（FastAPI + MySQL，可在设置中修改）
- **DeepSeek API**: `https://api.deepseek.com/chat/completions`，默认模型 `deepseek-v4-flash`
- **项目根目录**: `E:\codex_agent_project\LightweightWindowsToolset`
- **Electron 应用目录**: `electron-app/`
- **开发命令**: `cd electron-app && npm run dev`
- **打包命令**: `cd electron-app && npm run package`（便携版 `--dir`，已配置 `CSC_IDENTITY_AUTO_DISCOVERY=false signAndEditExecutable=false`）
- **构建命令**: `cd electron-app && npx electron-vite build`
- **主窗口**: 676x444，固定不可调整大小，单实例锁
- **侧边栏**: 155px 展开 / 44px 折叠

---

## 二、已实现功能 ✅

### 核心框架
- Electron 33 + electron-vite + React 19 + TypeScript strict 完整脚手架
- Tailwind CSS 4 蓝白灰主题（light: primary #2563EB / dark: primary #3B82F6）
- BrowserWindow 676x444 固定，frameless，单实例锁（`requestSingleInstanceLock`）
- 系统托盘：左键显示/隐藏，右键动态菜单（工具管理 checkbox / 设置 / 退出）
- contextBridge 安全 IPC：`window/settings/capture/tray/hotkey/queue`
- electron-store 持久化设置，safeStorage 加密 API Key
- electron-builder 便携版打包（`--dir`，winCodeSign 跳过）
- 自定义标题栏（最小化/关闭，动态标题）
- 侧边栏 155px/44px 折叠动画（framer-motion）
- framer-motion 页面过渡动画
- 主题切换（跟随系统 / 浅色 / 深色）
- 窗口关闭行为：默认直接退出（`event.preventDefault() + app.quit()`），设置中可选缩小到托盘
- 托盘右键"退出"能完整终止进程
- 关闭按钮「直接退出」正确终止进程（`isQuitting` 标记 + `destroyTray()` + `app.quit()`）

### 设置页面
- 三标签 sticky 导航栏（通用 | API 设置 | 快捷键），`-top-5` 方案无缝隙
- **通用**: 窗口标题（保存/重置按钮）、开机自启、主题模式、关闭行为、AI 聊天点击外部关闭、AI 聊天自动展开（含检测区域全局显示开关 + 水平/竖直滑块调节 + 半透明蓝色预览）
- **API**: DeepSeek API Key（密码切换显示 + 保存按钮，safeStorage 加密）/ 模型名称（草稿编辑显示保存按钮）/ 后端 API 地址（草稿编辑显示保存按钮）
- **快捷键**: 追加式录入（点击 `+` 逐键追加）+ 启用/禁用开关 + 冲突检测（完全冲突标红弹窗 / 单键重叠标黄）+ 减号移除按键 + 录制时自动禁用所有快捷键
- 输入框保存逻辑：编辑时显示保存按钮 → 保存成功后隐藏（窗口标题 / API Key / 模型 / 后端地址）

### 插件/工具系统
- stable / upcoming 两态，BUILTIN_PLUGINS 静态注册表
- 侧边栏 / 主页卡片从注册表动态渲染，开关双向同步
- 托盘菜单动态重建，checkbox 状态同步
- AI 聊天属于内置功能不是工具，不在工具列表和开关中出现

### 体力捕获管线
- 截图（screenshot-desktop GDI）→ OCR（Windows.Media.Ocr via PowerShell）→ DeepSeek AI 解析 → 后端 POST
- 后台快捷键 Ctrl+Shift+D（可自定义）触发完整管线，不依赖 UI 页面
- 游戏选择器 / 体力展示 / 今日记录 UI
- Electron Notification 捕获成功/失败通知
- 后端 API 指数退避重试（1s/2s/4s，最多 3 次）

### AI 聊天
- ChatSidebar SSE 流式对话，侧边栏按钮 / 快捷键切换
- 右侧滑入滑出动画（`transition-all duration-200`）
- 点击外部关闭（可在设置中开关）
- 鼠标 hover 检测区自动展开（可在设置中开关 + 调节区域宽高）
- 检测区全局显示开关 + 半透明蓝色预览
- 标题"AI 聊天"位于面板顶部与折叠按钮同一行
- 空白态居中提示「发送消息与 AI 开始对话」
- 清空记录按钮（Trash2 图标）
- 按钮统一样式（白色背景，启用：蓝色边框/蓝色字体，禁用：灰色边框/灰色字体）
- API Key 启动预加载（App.tsx `useEffect` → `loadApiKey`，无需先打开设置）

### 快捷键系统
- 全局快捷键注册/注销（globalShortcut API）
- 自定义快捷键配置（追加式录入，点击 `+` 逐键追加）
- 启用/禁用开关
- 冲突检测：完全冲突标红弹窗，单键重叠标黄
- 录制模式自动禁用所有快捷键，确认/取消后恢复

### 安全与可靠性
- safeStorage API Key 加密存储
- 窗口关闭行为：默认直接退出 / 设置可选缩小托盘
- 托盘退出完整终止进程
- 单实例锁
- IPC listener cleanup（防止 StrictMode 双重注册导致 toggle 抵消）
- 后端重试队列持久化（electron-store，应用重启后不丢失）
- 启动时自动冲刷积压队列（3s 延时）
- 捕获成功后自动冲刷积压队列

---

## 三、未实现功能 ❌

| 功能 | 原因 |
|------|------|
| PaddleOCR 回退方案 | 仅 Windows.Media.Ocr，非 WinRT 系统无替代 |
| 截图管线端到端实测 | 依赖游戏窗口实际存在，未经完整流程验证 |
| 截图历史记录持久化 | 当前仅内存状态，关闭后丢失 |
| safeStorage / Notification 运行实测 | 未在打包 EXE 中验证加密/通知功能是否正常 |
| 联网搜索模块 | Tavily API 免费版搜索质量不足，已完全移除代码 |
| 置顶窗口工具（window-pinner） | status: upcoming，仅有占位 plugin.json |
| Playwright E2E 测试 | playwright 已安装为 devDependency，未编写测试 |
| NSIS 安装包 | 代理下载 winCodeSign 不稳定，当前仅便携版 |
| 数据看板 / 窗口管理工具 | 未进入开发计划 |

---

## 四、已修复问题 🔧

| 问题 | 修复提交 |
|------|----------|
| 托盘退出无效（缺少 isQuitting 标记） | 244a244 |
| 窗口尺寸调整（最终 676x444） | 多次迭代 |
| 侧边栏折叠动画文字闪烁 | 1341a61 |
| 设置页 sticky 标签栏缝隙 | `-top-5` 方案 |
| 关闭按钮「直接退出」不终止进程 | e2a3d8e, 37ee654 |
| 托盘工具开关双向同步（StrictMode） | 82620aa |
| 后端重试队列持久化 | 5b26798 |
| AI 聊天面板重复标题 | 823cd3c |
| winCodeSign 签名 symlink 权限失败 | 66b8268 |
| AI 聊天面板乱码（UTF-8 字节损坏） | ec72721 |
| API 设置自动保存 | 0f5ed72, 7082e67 |
| AI 聊天需先打开设置才能使用（API Key 未预加载） | c70b316 |
| 设置页白屏（lastSearchRaw 未声明） | d2cef3d |
| 联网搜索乱码修复 + Tavily 迁移至主进程 IPC | 97d1850 |
| 联网搜索准确率优化（结果清洗 + 提示强化） | 2670c88 |
| 调试面板 fallback 文字乱码 | 531e0b2 |
| 联网搜索模块整体移除（Tavily 免费版质量不足） | 7f57319 |

---

## 五、现存问题 ⚠️

### P1（需实测验证）
- 快捷键 / 聊天面板 / Notification / safeStorage 未经完整运行实测
- OCR 仅 Windows.Media.Ocr，无 PaddleOCR 回退
- 截图管线未经端到端实测（需实际游戏窗口）
- Playwright E2E 测试未编写

### P2（功能扩展）
- NSIS 安装包
- 置顶窗口工具开发
- 截图历史记录持久化
- 数据看板 / 窗口管理工具

> 注意：联网搜索模块已完全移除（代码无残留），**不要再恢复或重新实现**，除非用户明确要求并提供了可靠的搜索 API。

---

## 六、关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| OCR 引擎 | Windows.Media.Ocr (PowerShell) | 零安装 |
| 截图方式 | GDI (screenshot-desktop) | 直接可用 |
| DeepSeek | 非流式(解析) + SSE 流式(聊天) | 速度 vs 体验 |
| 窗口关闭 | closeBehavior: quit/tray | 默认退出，可选托盘 |
| 工具状态 | stable/upcoming 两态 | 防止未开发工具被启用 |
| 打包 | 便携版 (`--dir`) | NSIS 代理下载超时 |
| 侧边栏 | 155px / 44px | 适配 676x444 窗口 |
| AI 聊天 | 内置功能，非工具 | 不在工具列表/开关中 |
| 聊天面板 | 固定右侧 | 简化布局 |
| 快捷键 | 追加式录入 | 支持组合键逐键追加 |
| 重试队列 | electron-store 持久化 | 应用重启不丢失 |
| 设置保存 | 编辑时显示按钮 / 保存后隐藏 | 防止误操作 |
| 联网搜索 | 已移除 | Tavily 免费版质量不足 |

---

## 七、Git 仓库

- Remote: https://github.com/THE2580/LightweightWindowsToolset
- Branch: main
- 代理: socks5://127.0.0.1:7897（必须运行）

---

## 八、环境

- OS: Windows（屏幕 2240x1400）
- Node.js: v24.12.0, npm: 11.6.2
- gh CLI: 已认证（THE2580）
- 代理: socks5://127.0.0.1:7897
- 开发服务器: `cd electron-app && npm run dev`（renderer 热更新）
