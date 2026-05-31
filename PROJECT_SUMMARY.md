# LightweightWindowsToolset — 项目进展总结

> 最后更新: 2026-05-31 (第二十三轮 — 按键统计 Native AOT + 开发者日志 + pinman 全局同步 + 资源 latest/UTC)
> 当前分支: main
> 未提交改动: 有（第二十三轮尚未提交；详见第十四节）
> 最新已提交: c94832a feat: dark mode, storage migration, about page, backend integration, ETA cross-day
> 编译状态: ✅ 通过（electron-vite build、pinman.exe Native AOT、keystats.exe Native AOT、便携版打包均成功）

---

## 一、项目概览

Windows 系统托盘插件式桌面工具集（Electron 33 + React 19 + TypeScript strict）。

**已完成工具**:
- 游戏资源捕获（stable，开发完成）
- 窗口置顶（独立 C# Native AOT 进程 pinman.exe，多窗口 + 事件推送 + 弹窗通知，✅ 稳定）
- 今日按键统计（独立 C# Native AOT 进程 keystats.exe，Raw Input + 本地持久化 + 趋势图，✅ stable）

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
| OCR | Windows.Media.Ocr (PowerShell 反射) |
| AI | DeepSeek API (`deepseek-v4-flash`) |
| **窗口置顶** | **pinman.exe — C# Native AOT（~1.2MB），P/Invoke Win32 API，stdin/stdout IPC + stderr 事件推送** |
| **按键统计** | **keystats.exe — C# Native AOT（~1.8MB），Raw Input，stdin/stdout IPC + 本地 JSON** |
| .NET SDK | 9.0.304 (仅编译，运行时零依赖) |

---

## 二、关键配置与约束

**环境**:
- OS: Windows (2240×1400, 150% DPI)
- Node.js: v24.12.0, npm: 11.6.2
- .NET SDK: 9.0.304（`dotnet` 在 PATH）
- Python: `E:\devtools\python\python-3.14.5\python.exe`
- 代理: `socks5://127.0.0.1:7897`
- 后端: `http://100.70.198.102:8000` (Tailscale)
- 根目录: `E:\codex_agent_project\LightweightWindowsToolset`

**窗口**: 676×444 固定不可调, 侧边栏 155px/44px

**主题**: 蓝白灰 (light #2563EB / dark #3B82F6)

**设计约束**:
- 禁止渐变球/光晕, 禁止负 letter-spacing
- 禁止 UI 卡片嵌套卡片, 禁止 hover scale 动画

**开发命令**: `cd electron-app && npm run dev`
**构建命令**: `cd electron-app && npx electron-vite build`
**pinman 构建**: `cd pinman && dotnet publish -c Release -r win-x64 --self-contained -p:PublishAot=true -p:DebugType=none -p:DebugSymbols=false`
**keystats 构建**: `cd keystats && dotnet publish -c Release -r win-x64 --self-contained -p:PublishAot=true -p:DebugType=none -p:DebugSymbols=false`
**打包命令**: `cd electron-app && npm run package`（打包前清理 dist + kill 进程, CSC_IDENTITY_AUTO_DISCOVERY=false）

**开发服务器启动后**: 先 kill 已有 electron/pinman/keystats 进程再启动

**窗口关闭**: 默认直接退出，可选缩小到托盘；托盘右键退出必须终止进程

**Windows 文件写入**: 禁止 PowerShell Set-Content/Out-File/[System.IO.File]::WriteAllText 等 shell 写文件，必须使用 apply_patch 系列工具

**中文字符串**: UTF-8 存储，严禁 PowerShell 管道传中文给 Python（会导致乱码）。Python 脚本中直接写中文即可

**已删除文件不要恢复**（如 `tavily.ts`、`BorderWindow.cs`、`pinner.ts`），已移除功能不要重新实现（如联网搜索、测试模块、窗口边框）

**设置页**: 编辑时显示保存按钮，保存成功后隐藏（不允许自动保存）

**快捷键**:
- 追加式录入，保存时一次性检测，JSON 数组存储
- ≥2键、左修饰右普通、仅一个普通键
- 录入时禁用全局快捷键
- 工具禁用 = 完全停止（前端入口隐藏 + 快捷键注销 + 后台进程终止[如有]），禁用状态持久化重启保持，新工具默认无快捷键（空字符串）
- **窗口置顶快捷键由 pinman.exe 原生 RegisterHotKey 管理**，不再用 Electron globalShortcut

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
- 固定标签: 通用 / API 设置 / 快捷键 / 关于
- 开发者模式开启后动态显示: 控制台日志
- 通用: 窗口标题, 开机自启, 主题模式, 关闭行为, 存储路径, 开发者模式
- API: DeepSeek Key (加密), 模型名称, 后端地址
- 快捷键: 追加式录入, 保存时校验, JSON 数组存储, 已支持三个工具

### 3.3 插件/工具系统
- `BUILTIN_PLUGINS` 静态注册, stable/upcoming 两态
- 工具禁用 = 完全停止：前端入口隐藏 + 快捷键注销 + 后台进程终止（禁用状态持久化，重启保持）
- 已注册: 游戏资源捕获(stable), 窗口置顶(stable), 今日按键统计(stable)

### 3.4 AI 聊天
- ChatSidebar SSE 流式对话, 右侧滑入滑出

### 3.5 开机自启
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

## 五、窗口置顶工具 — pinman.exe ✅ (开发完成，稳定)

### 5.1 架构

独立 C# Native AOT 编译的原生 Windows 进程，零运行时依赖。置顶/取消置顶通过托盘气泡通知反馈（无窗口描边）。

| 指标 | 实际 |
|------|------|
| 二进制体积 | ~1.2 MB 单文件 |
| 内存占用 | ~3-5 MB（idle 后） |
| 快捷键响应 | `RegisterHotKey` <1ms |
| 置顶操作 | 直接 `SetWindowPos`，零 Electron 开销 |
| IPC | stdin/stdout 行协议 + stderr 事件推送 |

### 5.2 源码结构

| 文件 | 职责 |
|------|------|
| `pinman/pinman.csproj` | .NET 9 Native AOT 项目配置 |
| `pinman/app.manifest` | DPI PerMonitorV2 声明 |
| `pinman/Native.cs` | 全部 Win32 P/Invoke 声明和常量 |
| `pinman/Program.cs` | 入口、消息循环、WM_HOTKEY、IPC 命令处理、托盘气泡、事件推送 |
| `pinman/PinEntry.cs` | 单个置顶窗口状态模型（TargetHwnd + TimerId） |
| `pinman/StdioIpc.cs` | stdin/stdout 行协议 IPC（200ms WM_TIMER 轮询） |
| `electron-app/resources/pinman.exe` | 编译产物副本 |
| `electron-app/src/main/ipc/pinman.ts` | Electron 端：spawn + 命令队列（含 fire 标志 + discardNextResponse）+ 事件转发 |

**⚠️ 已删除 `pinman/BorderWindow.cs`**（第十九轮移除窗口描边），不可恢复。

### 5.3 IPC 协议

stdin/stdout 行协议，一行命令对应一行响应：

| 命令 | 响应 | 说明 |
|------|------|------|
| `PING` | `PONG` | 心跳 |
| `TOGGLE` | `OK` | 切换前台窗口置顶 |
| `PIN <hwnd>` | `OK` | 程序化置顶指定窗口 |
| `UNPIN <hwnd>` | `OK` | 取消指定窗口 |
| `UNPINALL` | `OK` | 全部取消 |
| `STATUS` | `OK {"pinned":N,...}` | 状态 JSON（单行，不含控制字符） |
| `CONFIG maxPins=N` | `OK` | 设置最大置顶数（1-100） |
| `CONFIG hotkey=Alt+P` | `OK` | 设置快捷键 |
| `SHUTDOWN` | `OK` | 退出 |

**stderr 事件**（即时推送，非轮询）:

| 格式 | 说明 |
|------|------|
| `@PINMAN_EVENT pinned {"hwnd":N,"title":"..."}` | 窗口被置顶 |
| `@PINMAN_EVENT unpinned {"hwnd":N}` | 窗口取消置顶 |

### 5.4 命令队列机制（Electron 端关键实现）

`pinman.ts` 维护一个命令队列，所有 stdin 写入通过队列序列化：

- **`sendCommand(cmd)`**: 常规命令，入队 + 等待响应（最多 5s 超时）
- **`sendCommandFire(cmd)`**: 火而忘，入队 + `fire: true` 标志。队列处理时写入后设 `discardNextResponse = true`，RL handler 丢弃该响应后才继续处理下一个队列项
- **`discardNextResponse`**: 防止 fire 命令的响应污染后续命令的 `pendingResolve`

### 5.5 STATUS JSON 转义

`JsonEsc()` 在 `Program.cs` 中，用 `char.IsControl(c)` 覆盖全部 U+0000~U+001F 控制字符，转义为 `\uXXXX`。同时转义 `\`、`"`、`\n`、`\r`、`\t`、`\b`、`\f`。确保 STATUS 响应永远是合法单行 JSON，不会因窗口标题含 mojibake 而断裂。

### 5.6 前端状态管理

- `pinnerStore.ts`: 多窗口状态 + 事件监听 `listenEvents()` + 1s 轮询后备
- `PinnerPage.tsx`: 多窗口列表（仅显示标题+取消按钮），最大置顶数输入，启动时自动置顶本应用开关
- 已移除边框颜色预设和边框宽度控件（第十九轮）

### 5.7 已实现功能 ✅

- ✅ 多窗口同时置顶（可配置上限 1-100）
- ✅ 原生 RegisterHotKey，快捷键即时响应
- ✅ stderr `@PINMAN_EVENT` 事件推送，前端 <1s 更新
- ✅ 1s 轮询 STATUS 作为后备
- ✅ 首次启动热键自动加载（`startPinman(win, hotkey)` 参数 + 1s 延迟 CONFIG）
- ✅ 设置页保存热键即时生效（`sendCommandFire` 走队列）
- ✅ `PIN <hwnd>` 程序化置顶命令
- ✅ "启动时自动置顶本应用"设置（`pinnerAutoPinApp` 开关）
- ✅ 托盘气泡通知（pin/unpin 时显示窗口标题）
- ✅ 应用退出自动清理所有置顶
- ✅ 中文 UI
- ✅ 弹窗通知替代气泡（BrowserWindow 淡出，无托盘气球依赖）
- ✅ "置顶本应用时处于最顶部"选项（pinman 200ms WM_TIMER 重断言）
- ✅ 工具禁用 = pinman.exe 完全停止（进程终止，内存释放，禁用状态持久化）
- ✅ 设置页 ?tab=hotkey 直达快捷键标签
- ✅ 快捷键 badge 化显示（JSON 解析 + font-mono 绿框）
- ✅ 置顶后隐藏"置顶本窗口"按钮（selfHwnd 匹配检测）
- ✅ 窗口列表可滚动（flex 布局）+ 长标题 hover 预览

### 5.8 已修复问题（第十九轮）

| # | 问题 | 根因 | 修复 |
|---|------|------|------|
| 🔴 | 快捷键不触发 | `sendCommandFire` 绕过队列直接写 stdin，响应污染后续命令的 `pendingResolve` | `sendCommandFire` 走队列 + `discardNextResponse` 丢弃响应 |
| 🔴 | 首次启动热键不加载 | 启动时 `sendCommandFire` 在 pinman 就绪前发送失败 | `startPinman` 接受 hotkey 参数，1s init 阶段统一发送 |
| 🔴 | 多窗口列表不显示 | `JsonEsc` 只转义 `\` `"`，窗口标题含 `\r`/`\n` 时 JSON 断裂 | `char.IsControl()` 覆盖全部控制字符 → `\uXXXX` |
| 🔴 | 事件推送完全失效 | `@PINMAN_EVENT` 解析 off-by-one，type 永为空 | `line.substring('@PINMAN_EVENT '.length)` 修正 |
| 🟡 | 轮询响应慢（3s） | 纯轮询无推送 | stderr 事件推送 + 轮询降为 1s |

---

## 六、工具开发状态

### 6.1 今日按键统计 ✅ (stable)
- 已由 upcoming 切换为 stable。
- 独立 `keystats.exe` 使用 Raw Input 全局监听键盘和鼠标左/右/中键。
- 页面包含今日总数、键盘/鼠标拆分、日/月/年趋势、TOP 20 排行、虚拟键鼠可视化。
- 物理键盘与鼠标测试通过。

---

## 七、已知问题 ⚠️

| # | 问题 | 严重度 | 所属 | 状态 |
|---|------|--------|------|------|
| 1 | 后端伪报错（写入成功但前端提示 unreachable） | 中 | 资源捕获 | 未修 |
| 2 | 历史记录未持久化（captureHistory 仅内存, 重启丢失） | 低 | 资源捕获 | 未修 |
| 3 | 托盘热键仍可触发捕获（缩小到托盘后可能误截本应用） | 低 | 资源捕获 | 未修 |
| 4 | 游戏分辨率与屏幕分辨率差异大时 OCR 识别率下降 | 中 | 资源捕获 | 未修 |
| 5 | ~~首次启动时快捷键偶发不同步~~ | 低 | 窗口置顶 | ✅ 已修复——startPinman(win,hotkey) + 1s 延迟 CONFIG |
| 6 | ~~不在窗口置顶标签页时，原生快捷键执行后前端状态延迟到进入页面才刷新~~ | 中 | 窗口置顶 | ✅ 已修复——监听与 1s 轮询提升到 App 生命周期 |

---

## 八、已修复问题（历史摘要）

**资源捕获**（第十一~十二轮）: OCR 弹窗闪现、弹窗状态机不同步、AI 超时卡住、进程名未映射、OCR 噪音、进度条数据未更新、恢复量计算不准、多资源切换体验、恢复时间取整+时钟、快捷键首次保存不注册、无效进程提示文案

**窗口置顶(旧-PS方案)**（第十三~十七轮）: PS 进程洪水→批量查询、边框坐标 DPI 错误、置顶误自动取消→retry、多窗口简化→单窗口、边框 CSS→4-div 渲染、DPI 感知→SetProcessDpiAwareness、持久 PS 会话失败→回退 execFile、合并 toggle 双调用→单次、Add-Type 静态字段 null→IntPtr::new、变量名遗留→fg→pr、边框残留→try-catch+自清理

**窗口置顶(新-pinman方案-第二十一轮)**:
- 气泡不弹出 → Shell_NotifyIcon DllImport 缺 CharSet.Unicode 导致 Unicode 字符串按 ANSI 传递
- 中文乱码 → pinman Console.OutputEncoding=UTF8（系统默认 GBK 与 Node.js readline UTF-8 不匹配）
- 弹窗被置顶窗口遮挡 → did-finish-load 重断言 SetWindowPos(HWND_TOPMOST)
- 工具禁用仅侧边栏隐藏 → 持久化 disabledTools 到 electron-store + 停止 pinman 进程

**窗口置顶(新-pinman方案-第十八~十九轮)**:
- EPIPE 崩溃 → stopPinman 三层保护
- sendCommand 并发覆盖 pendingResolve → 命令队列序列化
- 热键转发动态 import() 失效 → 直接 import
- CreateSolidBrush/GetStockObject DllImport 错误 → gdi32 修复
- pinman.exe spawn 路径错误 → 修复
- PinnerPage 英文 → 全中文化
- TCP named pipe 在 Native AOT 下不可用 → stdin/stdout IPC
- **快捷键不触发**（第十九轮）→ `sendCommandFire` 走队列 + `discardNextResponse`
- **首次启动热键不加载**（第十九轮）→ `startPinman(win, hotkey)`
- **多窗口列表不显示**（第十九轮）→ `char.IsControl()` 全覆盖转义
- **事件推送失效**（第十九轮）→ `@PINMAN_EVENT` 解析 off-by-one 修正
- 边框渲染系统完整移除（第十九轮）→ 改为气泡通知

---

## 九、关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| OCR 引擎 | Windows.Media.Ocr via PS 反射 | 零安装 |
| 截图 | screenshot-desktop GDI 全屏 | 快, DPI 补偿 |
| 后端 HTTP | 主进程 Node.js http | 绕过 socks5 代理 |
| 弹窗管理 | 渲染进程统一, 每次新建 BrowserWindow | 状态一致 |
| OCR 预处理 | NearestNeighbor 自适应放大 | 保留锐利边缘 |
| 快捷键存储 | JSON 数组 | 消除 + 分隔符歧义 |
| **窗口置顶核心** | **C# Native AOT 独立进程** | 脱离 Electron 依赖, 1.2MB, 内核级 RegisterHotKey |
| **IPC 方案** | **stdin/stdout 行协议** | Native AOT 下最可靠, TCP/named pipe 有兼容问题 |
| **IPC 并发控制** | **命令队列 + discardNextResponse** | 序列化 stdin 写入 + 防止火而忘响应污染 |
| **事件推送** | **stderr @PINMAN_EVENT** | 不干扰 stdin/stdout 命令协议, 即时推送 |
| **JSON 转义** | **char.IsControl() → \uXXXX** | 处理窗口标题中 mojibake 等任意控制字符 |
| **置顶反馈** | **BrowserWindow 弹窗** | 替代托盘气泡，不依赖 Shell_NotifyIcon CharSet，支持淡出动画 |
| **工具禁用** | **完全停止（持久化）** | 禁用 = 前端隐藏 + 快捷键注销 + 后台进程终止，状态存入 electron-store，重启保持 |
| **深色模式** | **@variant class-selector** | Tailwind v4 dark: 变体改用 .dark class 选择器，手动与系统统一 |
| **后端生命周期** | **随工具启停** | FastAPI 不再单独自启动，由 backend-process.ts 跟随资源捕获工具状态 |
| **存储迁移** | **引导文件 + 仅迁配置** | 改路径后仅复制 config.json，Chromium 缓存继续留 userData |
| **按键统计监听** | **Raw Input + RIDEV_INPUTSINK** | 只统计不拦截输入；避免低级 Hook 和 Electron 原生 addon |
| **按键统计持久化** | **userData/keystats.json 按日保存** | 输入事件仅内存自增，每 10 秒落盘，查询时聚合月/年 |
| **开发者日志** | **主进程内存环形缓冲 + renderer console 转发** | 最近 500 条日志，开发者模式动态显示日志页 |

---

## 十、关键文件地图

### pinman C# 项目 (独立进程)
| 文件 | 职责 |
|------|------|
| `pinman/pinman.csproj` | .NET 9 Native AOT 项目配置 |
| `pinman/app.manifest` | DPI PerMonitorV2 声明 |
| `pinman/Native.cs` | 全部 Win32 P/Invoke 声明和常量 |
| `pinman/Program.cs` | 入口、消息循环、WM_HOTKEY、IPC 命令处理、Status JSON 构建、JsonEsc、事件推送 |
| `pinman/PinEntry.cs` | PinEntry 数据模型（仅 TargetHwnd + TimerId） |
| `pinman/StdioIpc.cs` | stdin/stdout 行协议 IPC |
| `electron-app/resources/pinman.exe` | 编译产物副本 |

### keystats C# 项目 (独立进程)
| 文件 | 职责 |
|------|------|
| `keystats/keystats.csproj` | .NET 9 Native AOT 项目配置 |
| `keystats/app.manifest` | DPI PerMonitorV2 声明 |
| `keystats/Native.cs` | Raw Input Win32 P/Invoke |
| `keystats/Program.cs` | 消息循环、WM_INPUT、IPC、键名映射 |
| `keystats/StatsStore.cs` | 按日 JSON 持久化 |
| `electron-app/resources/keystats.exe` | 编译产物副本 |

### 主进程 (Electron)
| 文件 | 职责 |
|------|------|
| `electron-app/src/main/index.ts` | 入口, tray, 快捷键(仅 capture/chat), pinman 生命周期, auto-pin 逻辑 |
| `electron-app/src/main/ipc/capture.ts` | 前景检测, 截图+OCR, 弹窗 IPC |
| `electron-app/src/main/ipc/backend.ts` | 主进程 HTTP 后端通信 |
| `electron-app/src/main/ipc/queue.ts` | 重试队列持久化 |
| `electron-app/src/main/ipc/pinman.ts` | pinman.exe spawn + stdin/stdout IPC + 命令队列(含 fire/discard) + stderr 事件解析转发 |
| `electron-app/src/main/ipc/keystats.ts` | keystats.exe spawn + 生命周期 + IPC + stderr 日志转发 |
| `electron-app/src/main/ipc/logs.ts` | 主进程日志缓冲与 renderer 广播 |
| `electron-app/src/main/utils/ocr.ts` | OCR PS 脚本 |

### 渲染进程
| 文件 | 职责 |
|------|------|
| `electron-app/src/renderer/App.tsx` | 入口, hotkey 监听分发 |
| `electron-app/src/renderer/stores/captureStore.ts` | 资源捕获管线编排 |
| `electron-app/src/renderer/stores/pinnerStore.ts` | 多窗口状态 + 事件监听 + 1s 后备轮询 |
| `electron-app/src/renderer/stores/keyStatsStore.ts` | 按键统计快照 + 2s 页面刷新 |
| `electron-app/src/renderer/stores/settingsStore.ts` | 设置持久化（含 pinnerAutoPinApp） |
| `electron-app/src/renderer/stores/pluginStore.ts` | 工具启用/禁用管理 |
| `electron-app/src/renderer/features/resource-capture/` | 资源捕获页面组件 |
| `electron-app/src/renderer/features/window-pinner/PinnerPage.tsx` | 多窗口列表、最大置顶数、auto-pin 开关 |
| `electron-app/src/renderer/features/key-counter/KeyCounterPage.tsx` | 按键统计页面、SVG 趋势图、TOP 20、虚拟键鼠 |
| `electron-app/src/renderer/features/settings/ConsoleLogPanel.tsx` | 开发者控制台日志页 |
| `electron-app/src/renderer/pages/SettingsPage.tsx` | 设置页 |
| `electron-app/src/renderer/pages/HomePage.tsx` | 首页 |
| `electron-app/src/renderer/lib/plugin-registry.ts` | BUILTIN_PLUGINS 注册 |

### 预加载
| 文件 | 职责 |
|------|------|
| `electron-app/src/preload/index.ts` | contextBridge API（含 pinman.onEvent） |
| `electron-app/src/renderer/env.d.ts` | TypeScript 类型声明（含 PinStatus） |

---

## 十一、当前待办

| # | 事项 | 优先级 | 状态 |
|---|------|--------|------|
| 1 | 清理旧文件 `electron-app/src/main/ipc/pinner.ts`（已不被任何代码引用） | 低 | 未做 |
| 2 | 资源捕获已知问题（后端伪报错、历史不持久化等，共 4 项） | 中 | 未修 |
| 3 | 托盘热键仍可触发捕获（缩小到托盘后可能误截本应用） | 低 | 未修 |
| 4 | 清理/提交第二十三轮改动；不要误提交 Python `__pycache__` 和 QA 截图日志 | 高 | 未做 |

---

## 十二、提交规范

- 原子化 commit，中文 message（feat:/fix:/chore:/style:/docs:）
- 提交前验证: `npx electron-vite build` 编译通过 + `dotnet publish` 编译通过
- 分支前缀: `codex/`

---

## 十三、第二十三轮新增：今日按键统计工具

### 13.1 架构

- 新增独立 C# Native AOT 进程 `keystats.exe`，与 `pinman.exe` 同级。
- 使用 Win32 Raw Input：`RegisterRawInputDevices + RIDEV_INPUTSINK + WM_INPUT`。
- 不使用 Electron 原生 Node addon，不使用低级键盘 Hook。
- 工具启用时启动；工具禁用、应用退出时保存并终止进程。
- 私有内存实测约 `3.18 MB`。

### 13.2 统计范围

- 监听全部键盘按键按下事件。
- 监听鼠标左键、右键、中键按下事件。
- 按日保存原始计数。
- 前端按查询视图即时聚合：最近 30 天、最近 12 个月、最近 5 年。
- 提供今日总计、键盘计数、鼠标计数、TOP 20 按键排行与热门按键折线图。
- 提供虚拟键盘与鼠标可视化，悬浮按键显示今日按下次数。
- 统计卡片、趋势区、排行区、键鼠区统一增加轻量 hover 阴影、上浮和蓝色边框反馈。

### 13.3 持久化与 IPC

- 数据固定存放于 Electron `userData/keystats.json`，不随自定义配置目录迁移。
- 输入事件只更新内存字典，不执行磁盘 I/O。
- 每 10 秒自动落盘，退出时再次落盘。
- stdin/stdout 行协议：`PING`、`SNAPSHOT`、`SAVE`、`SHUTDOWN`。
- stderr 日志协议：`@KEYSTATS_LOG <level> <message>`，由 Electron 转入开发者控制台。

### 13.4 关键文件

| 文件 | 职责 |
|------|------|
| `keystats/Program.cs` | Raw Input 消息循环、IPC、按键名称映射 |
| `keystats/Native.cs` | Win32 Raw Input P/Invoke |
| `keystats/StatsStore.cs` | 按日 JSON 持久化 |
| `electron-app/resources/keystats.exe` | Native AOT 编译产物副本 |
| `electron-app/src/main/ipc/keystats.ts` | Electron 端进程生命周期与 IPC |
| `electron-app/src/renderer/stores/keyStatsStore.ts` | 渲染层状态 |
| `electron-app/src/renderer/features/key-counter/KeyCounterPage.tsx` | 统计页面与 SVG 图表 |

---

## 十四、第二十三轮完整交接快照

### 14.1 资源捕获 latest / UTC 修复

- 桌面端拉取资源数据由 `GET /api/resource/today` 改为 `GET /api/resource/latest`。
- 新接口按 `(game_name, resource_type)` 返回全历史最新记录；当天无记录时会回退到昨天或更早的最新值。
- FastAPI 写入时将带时区时间统一转为 UTC 后存入 MySQL `DATETIME`。
- API 返回 `capture_time` 明确带 `Z`，避免前端将无时区字符串误按本地时间解析。
- 旧 `/api/resource/today` 保留兼容 Android 端，并改为 UTC 零点边界。
- 后端源码位于相邻仓库：`E:\codex_agent_project\AndroidGameInfoTools\backend\main.py`。

### 14.2 开发者模式与日志页

- 设置 → 通用新增“开发者模式”开关，持久化到 electron-store。
- 开启后设置页动态显示“控制台日志”标签。
- 日志页展示最近 500 条主进程与渲染进程日志，支持实时追加、自动滚动和清空。
- 新增文件：
  - `electron-app/src/main/ipc/logs.ts`
  - `electron-app/src/renderer/lib/console-logger.ts`
  - `electron-app/src/renderer/features/settings/ConsoleLogPanel.tsx`

### 14.3 pinman 日志与全局同步修复

- pinman stderr 新增日志协议：`@PINMAN_LOG <level> <message>`。
- 覆盖启动、消息窗口、热键注册、托盘图标、IPC 配置、置顶/取消、Win32 错误、退出清理。
- Electron 端 stderr 使用分片缓冲，避免 stream chunk 切断行协议。
- 原生快捷键状态监听和 1s STATUS 轮询已从 `PinnerPage` 提升到 `AppListeners` 全局生命周期。
- 修复离开窗口置顶标签页后，快捷键执行但前端状态延迟到重新进入页面才刷新的问题。
- `startPinman()` 会重置 `shutdownInitiated=false`，确保禁用后重新启用可以恢复生命周期管理。

### 14.4 今日按键统计验证结果

- 物理键盘与鼠标按键测试通过。
- `keystats.exe` Native AOT 二进制约 `1.76 MB`。
- 运行态私有内存实测约 `3.18 MB`。
- IPC 冒烟测试通过：`PING → SNAPSHOT → SHUTDOWN`。
- 页面已完成视觉 QA：固定 676×444 窗口下，顶部指标和趋势首屏可见，虚拟键鼠进入页面下方滚动区域。
- 当前 UI 包含：
  - 指标卡片、趋势区、排行区、键鼠区 hover 上浮/阴影/蓝色边框
  - TOP 20 排行
  - 虚拟键盘和鼠标三键可视化
  - 悬浮按键显示今日按下次数

### 14.5 打包状态

- `electron-app/package.json` 已配置外置资源：
  - `resources/pinman.exe → process.resourcesPath/pinman.exe`
  - `resources/keystats.exe → process.resourcesPath/keystats.exe`
- 最新目录版产物：
  - `electron-app/dist/win-unpacked/轻量化工具集.exe`
  - `electron-app/dist/win-unpacked/resources/pinman.exe`
  - `electron-app/dist/win-unpacked/resources/keystats.exe`
- 最近一次验证：`electron-vite build`、两个 Native AOT 构建、`npm run package`、`git diff --check` 均通过。

### 14.6 当前未提交状态

主仓库 `E:\codex_agent_project\LightweightWindowsToolset`：

- 第二十三轮功能改动尚未提交。
- 新增 `keystats/` 原生项目、`electron-app/resources/keystats.exe`、按键统计页面/store、日志模块。
- 修改 pinman 源码与 `electron-app/resources/pinman.exe`。
- 仍存在历史/QA 未跟踪文件：`electron-app/package_out.txt`、`electron-app/tests/debug_chat_hotkey.js`、`log.txt`、`screenshot_settings.png`、`screenshot_keystats_ui.png`。提交前逐项确认，不要默认纳入 commit。

相邻后端仓库 `E:\codex_agent_project\AndroidGameInfoTools`：

- `backend/main.py` 有 latest/UTC 修复，尚未提交。
- `backend/__pycache__/main.cpython-314.pyc` 被 Python 导入测试改动；这是缓存副产物，不应提交。

### 14.7 下一步建议

1. 先手工回归三个工具的启用/禁用与重启持久化。
2. 检查并清理 QA 副产物与 Python `__pycache__`。
3. 按模块拆分原子提交：后端 latest/UTC、日志与 pinman、keystats 工具、文档。
4. 再继续处理资源捕获剩余已知问题。
