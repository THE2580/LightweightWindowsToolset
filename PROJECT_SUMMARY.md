# LightweightWindowsToolset — 项目进展总结

> 最后更新: 2026-05-30 (第十七轮)
> 当前分支: main
> 最新提交: 0f5a9d5 (fix: 变量名残留 fg→pr + unpinInternal 异常安全 + createBorderOverlay 自清理)
> 未提交改动: 无
> 编译状态: ✅ 通过

---

## 一、项目概览

Windows 系统托盘插件式桌面工具集（Electron 33 + React 19 + TypeScript strict）。

**已完成工具**:
- 游戏资源捕获（stable，开发完成）
- 窗口置顶（stable，功能可用但架构不合适——需重写）

**待开发工具**:
- 今日按键统计（upcoming，仅注册）

### 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Electron 33.x |
| 构建 | electron-vite 5.x (Vite 7.3.3) |
| 前端 | React 19 + TypeScript strict |
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
| 窗口操作(置顶) | PowerShell/C# P/Invoke (SetWindowPos, GetWindowRect, IsWindow) |

---

## 二、关键配置与约束

**环境**:
- OS: Windows (2240×1400, 150% DPI)
- Node.js: v24.12.0, npm: 11.6.2
- Python: `E:\devtools\python\python-3.14.5\python.exe`
- 代理: `socks5://127.0.0.1:7897`
- 后端: `http://100.70.198.102:8000` (Tailscale, FastAPI + MySQL)
- 根目录: `E:\codex_agent_project\LightweightWindowsToolset`

**窗口**: 676×444 固定不可调, 侧边栏 155px/44px

**主题**: 蓝白灰 (light #2563EB / dark #3B82F6)

**设计约束**:
- 禁止渐变球/光晕, 禁止负 letter-spacing
- 禁止 UI 卡片嵌套卡片, 禁止 hover scale 动画(会导致 overflow 裁剪黑色伪影)

**开发命令**: `cd electron-app && npm run dev`
**构建命令**: `cd electron-app && npx electron-vite build`
**打包命令**: `cd electron-app && npm run package`（打包前清理 dist + kill 轻量化工具集.exe, CSC_IDENTITY_AUTO_DISCOVERY=false）

**窗口关闭**: 默认直接退出，可选缩小到托盘；托盘右键"退出"必须终止进程

**Windows 文件写入**: 禁止 PowerShell Set-Content/Out-File/[System.IO.File]::WriteAllText 等 shell 写文件，必须使用 apply_patch 系列工具。Python 脚本用 apply_patch_add_file 创建后 exec_command 执行

**中文字符串**: UTF-8 存储，严禁 PowerShell 管道传中文给 Python（会导致乱码）

**已删除文件不要恢复**（如 tavily.ts），已移除功能不要重新实现（如联网搜索、测试模块）

**设置页**: 编辑时显示保存按钮，保存成功后隐藏（不允许自动保存）

**快捷键**:
- 追加式录入，保存时一次性检测，JSON 数组存储
- ≥2键、左修饰右普通、仅一个普通键
- 录入时禁用全局快捷键
- 工具禁用 = 快捷键禁用，新工具默认无快捷键（空字符串）

**AI 聊天**: 内置功能非工具，不在工具列表和开关中

**编译验证是每次修改的最后一个步骤**

---

## 三、已完成功能 ✅

### 3.1 核心框架
- Electron 33 + React 19 + TypeScript strict + Tailwind CSS 4
- 系统托盘 (左键显隐, 右键动态菜单, 退出终止全部进程)
- contextBridge 安全 IPC, electron-store 持久化, safeStorage 加密
- 自定义标题栏, 侧边栏折叠动画, 主题切换

### 3.2 设置页面
- 三标签: 通用 / API 设置 / 快捷键
- 通用: 窗口标题, 开机自启, 主题模式, 关闭行为
- API: DeepSeek Key (加密), 模型名称, 后端地址
- 快捷键: 追加式录入, 保存时校验, JSON 数组存储, 已支持三个工具

### 3.3 插件/工具系统
- `BUILTIN_PLUGINS` 静态注册, stable/upcoming 两态
- 工具禁用 = 快捷键注销 (`tool:set-enabled` IPC)
- 已注册: 游戏资源捕获(stable), 窗口置顶(stable), 今日按键统计(upcoming)

### 3.4 快捷键系统
- globalShortcut 注册/注销, 支持 resource-capture / ai-chat / window-pinner
- 追加式录入 + 保存时校验 + 冲突检测

### 3.5 AI 聊天
- ChatSidebar SSE 流式对话, 右侧滑入滑出

### 3.6 开机自启
- `app.setLoginItemSettings()` 实时开关

---

## 四、资源捕获工具 ✅ (开发完成，稳定)

```
快捷键 → 前景检测(进程名→游戏名映射) → 进程校验
  → 无效进程: 弹窗提示 → 2.5s fadeOut
  → 有效进程: 弹窗 → 截图 → OCR → AI解析 → 后端POST → 弹窗结果(fadeOut)
```

**架构**: 渲染进程统一管理弹窗生命周期 + AI解析 + 后端提交；主进程降为纯数据（截图+OCR）

**关键特性**:
- 进程校验：未配置游戏弹窗提示不截图
- OCR 预处理：NearestNeighbor 自适应放大（<1200px→3x, else→2x, 上限3840px），保留彩色
- OCR 文本过滤：只保留含 `\d+/\d+` 或中文标签的行
- AI 解析：多资源并行 prompt + 正则回退 + 30s AbortController 超时
- 后端通信：主进程 Node.js http（绕过 socks5），重试队列持久化，capture_time UTC
- 恢复速率：每秒 tick 倒计时 + 预计 HH:MM 恢复满时钟

**支持游戏**: 原神、绝区零、终末地、异环（含恢复速率配置）

---

## 五、窗口置顶工具 ⚠️ (功能可用，架构不合适，待重写)

### 5.1 当前状态

**能工作**: 快捷键/按钮置顶前台窗口，再次触发取消（单窗口模式），8 色边框预设，已置顶窗口卡片显示。

**实现方式**: PowerShell `execFile` 调用 C# P/Invoke（SetWindowPos / GetWindowRect / IsWindow），每次操作冷启动一个 PS 进程。边框用透明 `BrowserWindow` + 4 个绝对定位 div 渲染。400ms `setInterval` 轮询窗口位置（`pollingActive` 锁防重叠），`missingRectRetries` 连续 2 次 null 才取消置顶。DPI 感知通过每个 PS 脚本注入 `SetProcessDpiAwareness(1)` + Node 侧 `screen.scaleFactor` 除法统一。

### 5.2 核心问题（不复修，直接重写）

| # | 问题 | 说明 |
|---|------|------|
| 1 | PS 进程冷启动开销 | 每次 execFile 启动 200-500ms，操作响应不够快 |
| 2 | 架构与轻量定位不符 | Electron 本身 ~100MB 基线 + PS 进程，与"轻量工具集"理念矛盾 |
| 3 | 边框跟随延迟 | 受 PS 启动时间制约，无法做到丝滑跟随 |
| 4 | DPI 坐标反复踩坑 | 之前除/不除 scaleFactor 来回摇摆多轮才稳定 |
| 5 | 上层依赖脆弱 | Electron BrowserWindow 边框、IPC 串行化、PS 脚本语法坑 |

### 5.3 文件清单

| 文件 | 职责 |
|------|------|
| `electron-app/src/main/ipc/pinner.ts` | 主进程：PS execFile、SetWindowPos、边框 BrowserWindow、轮询 |
| `electron-app/src/renderer/stores/pinnerStore.ts` | 状态管理（单窗口） |
| `electron-app/src/renderer/features/window-pinner/PinnerPage.tsx` | UI 页面 |

### 5.4 重写方向

参考 GitHub 开源窗口置顶工具（AutoHotkey/Python/C# 等轻量实现），用独立轻量进程替代当前的 Electron 内嵌方案。关键词：零 Electron 依赖、Native Win32 API、内存 < 5MB、快捷键内核级响应。

---

## 六、待开发工具

### 6.1 今日按键统计 (upcoming)
- 仅注册，侧边栏显示"即将推出"
- 描述: 统计每日键盘鼠标按键次数，隔天自动重置，按键排行

---

## 七、已知问题 ⚠️

| # | 问题 | 严重度 | 所属 |
|---|------|--------|------|
| 1 | 后端伪报错（写入成功但前端提示 unreachable） | 中 | 资源捕获 |
| 2 | 历史记录未持久化（captureHistory 仅内存, 重启丢失） | 低 | 资源捕获 |
| 3 | 托盘热键仍可触发捕获（缩小到托盘后可能误截本应用） | 低 | 资源捕获 |
| 4 | 游戏分辨率与屏幕分辨率差异大时 OCR 识别率下降 | 中 | 资源捕获 |
| 5 | 窗口置顶方案与轻量定位矛盾，需整体重写 | 🔴 高 | 窗口置顶 |

---

## 八、已修复问题（摘要）

**资源捕获**: OCR 弹窗闪现(11)、弹窗状态机不同步(11)、AI 超时卡住(11)、进程名未映射(11)、OCR 噪音(11)、进度条数据未更新(12)、恢复量计算不准(12)、多资源切换体验(12)、恢复时间取整+时钟(12)、快捷键首次保存不注册(12)、无效进程提示文案(12)

**窗口置顶**: PS 进程洪水→批量查询(13)、边框坐标 DPI 错误(13)、置顶误自动取消→retry(13)、多窗口简化→单窗口(14)、边框 CSS→4-div 渲染(14)、DPI 感知→SetProcessDpiAwareness(15)、持久 PS 会话失败→回退 execFile(15)、合并 toggle 双调用→单次(16)、Add-Type 静态字段 null→IntPtr::new(16)、变量名遗留→fg→pr(16)、边框残留→try-catch+自清理(17)

---

## 九、关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| OCR 引擎 | Windows.Media.Ocr via PS 反射 | 零安装 |
| 截图 | screenshot-desktop GDI 全屏 | 快, DPI 补偿 |
| 后端 HTTP | 主进程 Node.js http | 绕过 socks5 代理 |
| 弹窗管理 | 渲染进程统一, 每次新建 BrowserWindow | 状态一致, 无复用残留 |
| OCR 预处理 | NearestNeighbor 自适应放大, 不加灰度 | 保留锐利边缘和颜色对比度 |
| 快捷键存储 | JSON 数组 | 消除 + 分隔符歧义 |
| 并发控制 | captureState === 'idle' | 防止频繁 OCR |
| capture_time | utcNow() = new Date().toISOString() | UTC 时间 |
| 窗口置顶操作 | PowerShell/C# P/Invoke | 避免 native addon 编译依赖 |

---

## 十、关键文件地图

### 主进程
| 文件 | 职责 |
|------|------|
| `electron-app/src/main/index.ts` | 入口, tray, 快捷键注册, 三工具 hotkey 管理 |
| `electron-app/src/main/ipc/capture.ts` | 前景检测, 截图+OCR, 弹窗 IPC |
| `electron-app/src/main/ipc/backend.ts` | 主进程 HTTP 后端通信 |
| `electron-app/src/main/ipc/queue.ts` | 重试队列持久化 |
| `electron-app/src/main/ipc/pinner.ts` | 窗口置顶：PS execFile、SetWindowPos、边框 BrowserWindow、轮询 |
| `electron-app/src/main/utils/ocr.ts` | OCR PS 脚本 |

### 渲染进程
| 文件 | 职责 |
|------|------|
| `electron-app/src/renderer/App.tsx` | 入口, hotkey 监听分发 |
| `electron-app/src/renderer/stores/captureStore.ts` | 资源捕获管线编排 |
| `electron-app/src/renderer/stores/pinnerStore.ts` | 窗口置顶状态管理 |
| `electron-app/src/renderer/stores/settingsStore.ts` | 设置持久化 |
| `electron-app/src/renderer/stores/pluginStore.ts` | 工具启用/禁用管理 |
| `electron-app/src/renderer/features/resource-capture/` | 资源捕获页面组件 |
| `electron-app/src/renderer/features/window-pinner/PinnerPage.tsx` | 窗口置顶 UI |
| `electron-app/src/renderer/pages/SettingsPage.tsx` | 设置页 |
| `electron-app/src/renderer/pages/HomePage.tsx` | 首页 |
| `electron-app/src/renderer/lib/plugin-registry.ts` | BUILTIN_PLUGINS 注册 |

### 预加载
| 文件 | 职责 |
|------|------|
| `electron-app/src/preload/index.ts` | contextBridge API |
| `electron-app/src/renderer/env.d.ts` | TypeScript 类型声明 |

---

## 十一、最高优先级待办

1. **研究 GitHub 开源窗口置顶工具** — 分析 AutoHotkey/Python/C# 等轻量实现方案
2. **重写窗口置顶工具** — 脱离 Electron 依赖，用独立轻量进程实现，内存 < 5MB

---

## 十二、提交规范

- 原子化 commit，中文 message（feat:/fix:/chore:/style:/docs:）
- 提交前验证: `npx electron-vite build` 编译通过
- 分支前缀: `codex/`
