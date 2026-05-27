# LightweightWindowsToolset — 项目开发进展总结

> 最后更新: 2026-05-27
> 当前分支: main
> 最新提交: f2cca1f fix: 保存快捷键时自动去重
> 总提交数: 69 (与 origin/main 同步)

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
| OCR  | Windows.Media.Ocr (PowerShell)，支持多语言回退链 |

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
- **通用**: 窗口标题（保存/重置）、开机自启、主题模式、关闭行为、AI 聊天点击外部关闭、AI 聊天自动展开（含检测区域全局显示 + 宽高滑块 + 半透明蓝色预览）
- **API**: DeepSeek API Key（密码切换 + safeStorage 加密）/ 模型名称 / 后端 API 地址
- **快捷键**: 追加式按键录入（见下方快捷键系统详情）
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
- 超时 15s

### AI 聊天
- ChatSidebar SSE 流式对话，侧边栏按钮 / 快捷键切换
- 右侧滑入滑出动画
- 点击外部关闭（可在设置中开关）
- 鼠标 hover 检测区自动展开（可在设置中开关 + 调节区域宽高）
- 空白态居中提示 + 清空记录按钮
- API Key 启动预加载，无需先打开设置

### 快捷键系统（已完成重构）
- 全局快捷键注册/注销（globalShortcut API）
- **无默认快捷键**：所有工具初始不绑定快捷键，用户需手动配置
- **工具禁用联动**：禁用工具时通过 `tool:set-enabled` IPC 通知主进程注销对应快捷键
- **追加式按键录入**：
  - 点击「配置快捷键」进入编辑模式，显示 `+` `-` `保存` `取消` 按钮
  - `+` 追加按键录入框（前一个非空时允许），`-` 移除非空按键 ≥1 时显示
  - 点击录入框获得焦点后监听键盘事件，支持所有按键类型
  - 录入框三色状态：活跃监听橙色边框淡橙底、已录入黄色边框白底、空态虚线边框
- **冲突检测**：与其他快捷键冲突时整个组合背景标红，提示文字
- **保存自动去重**：点击保存时自动丢弃重复按键，保留首次出现
- 按钮布局：`+` 半透明浅绿、`-` 半透明浅红、`保存` 半透明淡蓝、`取消` 半透明橙色
- 保存后预览每个按键独立显示浅绿色边框白底
- 录制模式自动禁用所有快捷键，确认/取消后恢复

### E2E 测试
- Playwright Electron 测试框架，28 条自动化 UI 测试
- 覆盖：应用外壳、导航、设置页三标签、API/快捷键配置、AI 聊天侧边栏、侧边栏折叠
- 运行命令：`npm run test:e2e`（`node tests/run-e2e.js`）

---

## 三、未实现功能

| 功能 | 原因 |
|------|------|
| PaddleOCR 回退方案 | 仅 Windows.Media.Ocr，非 WinRT 系统无替代；已有多语言回退链增强 |
| 截图管线端到端实测 | 依赖实际游戏窗口存在，未经完整流程验证 |
| 截图历史记录持久化 | 当前仅内存状态，关闭后丢失 |
| safeStorage / Notification 运行实测 | 未在打包 EXE 中验证加密/通知功能是否正常 |
| 置顶窗口工具（window-pinner） | status: upcoming，仅有占位 plugin.json |
| NSIS 安装包 | 代理下载 winCodeSign 不稳定，当前仅便携版 |
| 数据看板 / 窗口管理工具 | 未进入开发计划 |

---

## 四、已修复问题

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
| 工具禁用后快捷键仍可触发 | 2d2d804 |
| 快捷键重复按键检测改为保存时去重 | f2cca1f |

---

## 五、现存问题

### P1（功能缺口）
- 截图管线未经端到端实测（需实际游戏窗口）
- safeStorage / Notification 未在打包 EXE 中完整运行实测
- 截图历史记录未持久化

### P2（功能扩展）
- NSIS 安装包
- 置顶窗口工具开发
- 数据看板 / 窗口管理工具

> 注意：联网搜索模块已完全移除（代码无残留），**不要再恢复或重新实现**，除非用户明确要求并提供了可靠的搜索 API。

---

## 六、关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| OCR 引擎 | Windows.Media.Ocr (PowerShell) + 多语言回退链 | 零安装 |
| 截图方式 | GDI (screenshot-desktop) | 直接可用 |
| DeepSeek | 非流式(解析) + SSE 流式(聊天) | 速度 vs 体验 |
| 窗口关闭 | closeBehavior: quit/tray | 默认退出，可选托盘 |
| 工具状态 | stable/upcoming 两态 | 防止未开发工具被启用 |
| 打包 | 便携版 (`--dir`) | NSIS 代理下载超时 |
| 侧边栏 | 155px / 44px | 适配 676x444 窗口 |
| AI 聊天 | 内置功能，非工具 | 不在工具列表/开关中 |
| 快捷键 | 追加式录入 + 无默认值 + 工具禁用联动 | 灵活组合，无配置不触发 |
| 重试队列 | electron-store 持久化 | 应用重启不丢失 |
| 设置保存 | 编辑时显示按钮 / 保存后隐藏 | 防止误操作 |
| 联网搜索 | 已移除 | Tavily 免费版质量不足 |
| E2E 测试 | Playwright Electron 独立脚本 | 避免 @playwright/test 框架与 Electron 兼容问题 |

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
