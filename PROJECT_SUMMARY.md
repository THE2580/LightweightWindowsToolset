# LightweightWindowsToolset — 项目开发进展总结

> 最后更新: 2026-05-26
> 当前分支: main (领先 origin/main 34 commits)
> 最新提交: 3bd5b9c

---

## 一、项目概览

一款挂载于 Windows 系统托盘的轻量化插件式桌面工具集。首期工具为 PC 端游戏体力捕获（截图 → OCR → DeepSeek AI 解析 → 后端 API）。

### 技术栈

| 层    | 技术                                 | 实际版本             |
| ---- | ---------------------------------- | ---------------- |
| 框架   | Electron                           | 33.x             |
| 构建   | electron-vite                      | 5.x (Vite 7.3.3) |
| 前端   | React 19 + TypeScript 5.x (strict) |                  |
| 状态管理 | Zustand                            | 5.x              |
| UI   | shadcn/ui + Tailwind CSS 4         |                  |
| 动画   | framer-motion                      | 12.x             |
| 图标   | lucide-react                       | 0.460.x          |
| 持久化  | electron-store                     | 8.2.0 (CJS)      |
| 路由   | react-router-dom                   | 7.x (HashRouter) |
| 打包   | electron-builder                   | 25.x             |
| 截图   | screenshot-desktop                 | 1.15.0           |
| OCR  | Windows.Media.Ocr (PowerShell)     |                  |

### 关键配置

- **代理**: `socks5://127.0.0.1:7897` (所有网络操作必须通过)
- **后端 API**: `http://100.70.198.102:8000` (FastAPI + MySQL, 可设置修改)
- **DeepSeek API**: `https://api.deepseek.com/chat/completions`, 默认模型 `deepseek-v4-flash`
- **项目根目录**: `E:\codex_agent_project\LightweightWindowsToolset`
- **Electron 应用目录**: `electron-app/`
- **开发命令**: `cd electron-app && npm run dev`
- **打包命令**: `npm run package` (便携版, `--dir`)
- **构建命令**: `npx electron-vite build`
- **主窗口**: 676x444, 不可调整大小, 单实例锁
- **侧边栏**: 155px 展开 / 44px 折叠

---

## 二、已实现功能

### 核心框架
- Electron 33 + electron-vite + React 19 + TS strict 完整脚手架
- Tailwind CSS 4 蓝白灰主题 (light: primary #2563EB / dark: primary #3B82F6)
- BrowserWindow 676x444 固定, frameless, 单实例锁
- 系统托盘: 左键显示/隐藏, 右键动态菜单 (工具管理/设置/退出)
- contextBridge 安全 IPC: window/settings/capture/tray/hotkey
- electron-store 持久化 16 项设置
- electron-builder 便携版打包 (188MB EXE)
- 自定义标题栏 (最小化/关闭, 动态标题)
- 侧边栏 155px/44px 折叠动画
- framer-motion 页面过渡
- 主题切换 (跟随系统/浅色/深色)
- 所有窗口关闭行为默认直接退出，设置中可选缩小到托盘
- 托盘右键"退出"能终止进程

### 设置页面
- 三标签 sticky 导航栏 (通用 | API 设置 | 快捷键), -top-5 无缝隙
- 通用: 窗口标题/开机自启/主题/关闭行为/AI 聊天点击外部关闭/自动展开/检测区域配置
- API: DeepSeek Key(密码切换+保存, safeStorage 加密)/模型名称/后端地址
- 快捷键: 追加式录入 + 启用开关 + 冲突检测(标红标黄弹窗) + 减号移除按键 + 录制时自动禁用所有快捷键

### 插件/工具系统
- stable/upcoming 两态, BUILTIN_PLUGINS 静态注册表
- 侧边栏/主页卡片从注册表动态渲染, 开关双向同步
- 托盘菜单动态重建, checkbox 状态同步
- AI 聊天属于内置功能不是工具，不在工具列表和开关中出现

### 体力捕获管线
- 截图 (screenshot-desktop GDI) -> OCR (Windows.Media.Ocr) -> DeepSeek AI 解析 -> 后端 POST
- 后台快捷键 Ctrl+Shift+D (可自定义) 触发完整管线, 不依赖 UI 页面
- 游戏选择器/体力展示/今日记录
- Electron Notification 捕获成功/失败通知
- 后端 API 指数退避重试 (1s/2s/4s, 最多3次) + 本地 pendingQueue

### AI 聊天
- ChatSidebar SSE 流式对话, 侧边栏按钮/快捷键切换
- 右侧滑入滑出动画 (transition-all 200ms)
- 点击外部关闭 (可设置)
- 鼠标 hover 检测区自动展开 (可设置, 可调节区域宽高)
- 检测区全局显示开关 + 半透明蓝色预览
- 标题"AI 聊天"位于面板顶部与折叠按钮同一行

### 快捷键系统
- 全局快捷键注册/注销 (globalShortcut API)
- 自定义快捷键配置 (追加式录入，点击+逐键追加)
- 启用/禁用开关
- 冲突检测: 完全冲突标红弹窗, 单键重叠标黄
- 录制模式自动禁用所有快捷键, 确认/取消后恢复

### 安全与可靠性
- safeStorage API Key 加密存储
- 窗口关闭行为: 直接退出 / 缩小托盘
- 托盘退出完整终止进程
- 单实例锁
- IPC listener cleanup (防止 StrictMode 双重注册导致 toggle 抵消)

---

## 三、未实现功能

- OCR 模块仅在 Windows 10+ 且支持 WinRT 时有效, 无 PaddleOCR 回退方案
- 截图管线未经端到端实测 (依赖游戏窗口实际存在)
- 截图历史记录持久化 — 当前仅内存状态
- safeStorage / Notification 未经实际运行验证
- 后端重试队列仅内存存储, 应用重启后丢失
- 置顶窗口 (window-pinner) — upcoming
- Playwright E2E 测试
- NSIS 安装包 (代理下载 winCodeSign 不稳定)

---

## 四、现存问题

1. AI 聊天面板自动展开 / 快捷键冲突检测 / Notification / safeStorage 均未经 `npm run dev` 实际运行测试
2. 快捷键检测区域全局显示开关 + 实时预览逻辑已实现但未实测
3. 后端 API 重试队列仅内存存储, 应用重启后丢失
4. Playwright 已安装但未写 E2E 测试
5. OCR 无 PaddleOCR 回退方案
6. NSIS 安装包因代理下载 winCodeSign 不稳定暂未使用

---

## 五、关键设计决策

| 决策       | 选择                       | 原因                  |
| ---------- | -------------------------- | --------------------- |
| OCR 引擎   | Windows.Media.Ocr (PowerShell) | 零安装, PRD 推荐    |
| 截图方式   | GDI (screenshot-desktop)   | PRD 3.2.4             |
| DeepSeek   | 非流式(解析) + SSE 流式(聊天)  | 速度 vs 体验         |
| 窗口关闭   | closeBehavior: quit/tray   | 默认退出, 可选托盘    |
| 工具状态   | stable/upcoming 两态       | 防止未开发工具被启用  |
| 打包       | 便携版 (--dir)             | NSIS 代理下载超时     |
| 侧边栏     | 155px / 44px               | 适配 676x444 窗口    |
| AI 聊天    | 内置功能, 非工具           | 不在工具列表/开关中   |
| 聊天面板   | 固定右侧                   | 移除左侧选项, 简化    |
| 快捷键     | 追加式录入                 | 支持组合键逐键追加    |

---

## 六、开发待办

### P0 (无阻塞项)

### P1
- 快捷键/聊天面板/Notification/safeStorage 运行实测验证
- 后端重试队列持久化 (electron-store)
- OCR PaddleOCR 回退方案
- Playwright E2E 测试

### P2
- NSIS 安装包
- 置顶窗口工具开发
- 截图历史记录持久化
- 数据看板 / 窗口管理工具

---

## 七、Git 仓库

- Remote: https://github.com/THE2580/LightweightWindowsToolset
- Branch: main (领先 origin/main 34 commits)
- 代理: socks5://127.0.0.1:7897

---

## 八、环境

- OS: Windows (屏幕 2240x1400)
- Node.js: v24.12.0, npm: 11.6.2
- gh CLI: 已认证 (THE2580)
- 代理: socks5://127.0.0.1:7897 (必须运行)
- 开发服务器: electron-vite dev (renderer 热更新)
