# LightweightWindowsToolset — 项目进展总结

> 最后更新: 2026-05-30 (第十四轮)
> 当前分支: main
> 最新提交: 8767811 (refactor: 窗口置顶简化为单窗口模式 + 修复边框渲染)
> 未提交改动: 无
> 编译状态: ✅ 通过

---

## 一、项目概览

Windows 系统托盘插件式桌面工具集（Electron 33 + React 19 + TypeScript strict）。首期工具为 PC 端游戏资源捕获。二期工具"窗口置顶"已完成主体开发（存在性能/描边问题待优化）。

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
| 窗口操作 | PowerShell/C# P/Invoke (SetWindowPos, GetWindowRect, IsWindow) |

### 关键配置

- **代理**: `socks5://127.0.0.1:7897`
- **后端 API**: `http://100.70.198.102:8000` (Tailscale IP)
- **DeepSeek**: `https://api.deepseek.com/chat/completions`
- **根目录**: `E:\codex_agent_project\LightweightWindowsToolset`
- **窗口**: 676×444 固定不可调, 侧边栏 155px/44px
- **主题**: 蓝白灰 (light #2563EB / dark #3B82F6)
- **设计约束**: 禁止渐变球/光晕, 禁止负 letter-spacing, 禁止 UI 卡片嵌套卡片, 禁止 hover scale 动画(overflow 裁剪)
- **开发命令**: `cd electron-app && npm run dev`
- **构建命令**: `cd electron-app && npx electron-vite build`
- **打包命令**: `cd electron-app && npm run package`（打包前清理 dist + kill 轻量化工具集.exe, CSC_IDENTITY_AUTO_DISCOVERY=false）
- **Windows 文件写入**: 禁止 PowerShell Set-Content/Out-File/[System.IO.File]::WriteAllText 等 shell 写文件，必须使用 apply_patch 系列工具。Python 脚本用 apply_patch_add_file 创建后 exec_command 执行
- **中文字符串**: UTF-8 存储，严禁 PowerShell 管道传中文给 Python（会导致乱码）。Python 脚本中用中文直接写入即可（UTF-8 编码）
- **窗口关闭**: 默认直接退出，可选缩小到托盘；托盘右键"退出"必须终止进程
- **已删除文件不要恢复**（如 tavily.ts），已移除功能不要重新实现（如联网搜索、测试模块）
- **设置页**: 编辑时显示保存按钮，保存成功后隐藏（不允许自动保存）
- **工具禁用 = 快捷键禁用**
- **新工具默认无快捷键**（默认空字符串）
- **快捷键**: 追加式录入，保存时一次性检测，JSON 数组存储。≥2键、左修饰右普通、仅一个普通键。录入时禁用全局快捷键
- **AI 聊天**: 内置功能非工具，不在工具列表和开关中
- **编译验证是每次修改的最后一个步骤**

---

## 二、已完成功能 ✅

### 2.1 核心框架
- Electron 33 + React 19 + TypeScript strict + Tailwind CSS 4 蓝白灰主题
- 系统托盘 (左键显隐, 右键动态菜单, 退出终止全部进程)
- contextBridge 安全 IPC, electron-store 持久化, safeStorage 加密
- 自定义标题栏, 侧边栏折叠动画, 主题切换

### 2.2 设置页面
- 三标签: 通用 / API 设置 / 快捷键
- 通用: 窗口标题, 开机自启, 主题模式, 关闭行为
- API: DeepSeek Key (加密), 模型名称, 后端地址
- 快捷键: 追加式录入, 保存时校验, JSON 数组存储, 录入时禁用全局快捷键，**已支持三个工具**（资源捕获、AI 聊天、窗口置顶）

### 2.3 插件/工具系统
- `BUILTIN_PLUGINS` 静态注册, stable/upcoming 两态, 侧边栏/主页动态渲染
- 工具禁用 = 快捷键注销 (tool:set-enabled IPC)
- AI 聊天为内置功能, 不在工具列表, 不在开关中
- 已注册工具: 游戏资源捕获(stable), 窗口置顶(stable), 今日按键统计(upcoming)

### 2.4 快捷键系统
- globalShortcut 注册/注销, 支持 resource-capture / ai-chat / window-pinner 三个 action
- 追加式录入 + 保存时校验 + 冲突检测
- 录入时禁用全局快捷键, 保存/取消后恢复
- **已知修复**: 修复了 `hotkey:update` 中 `info?.enabled !== false` 导致首次保存快捷键无法注册的 bug，改为直接注册

### 2.5 AI 聊天
- ChatSidebar SSE 流式对话, 右侧滑入滑出动画

### 2.6 开机自启
- `app.setLoginItemSettings()` 实时开关

---

## 三、资源捕获工具 ✅ (开发完成)

```
快捷键 → 前景检测(进程名→游戏名映射) → 进程校验
  → 无效进程: 弹窗显示进程名 + 提示"请切换到支持的游戏窗口后重试" → 2.5s fadeOut
  → 有效进程: 弹窗(fadeIn) → 截图 → OCR(预处理放大) → AI解析 → 后端POST → 弹窗结果(fadeOut)
```

### 3.1 管线架构（第十一轮重写）
- **渲染进程统一管理**：弹窗生命周期 + AI解析 + 后端提交
- **主进程降为纯数据**：`capture:trigger` 只做截图+OCR
- **弹窗每次新建** BrowserWindow，CSS fadeIn/fadeOut
- **每步超时截停**：截图 8s / OCR 15s / AI 30s

### 3.2 进程校验
- 未配置游戏: 弹窗显示进程名 + 提示切换游戏窗口，不执行截图
- 配置游戏: 进程名匹配 GAME_CONFIGS.processName（大小写不敏感，去 .exe）

### 3.3 OCR 预处理
- NearestNeighbor 自适应放大: <1200px 宽 → 3x, else → 2x, 上限 3840px
- 保留原始彩色图像（不加灰度）

### 3.4 OCR 文本过滤
- 只保留含 `\d+/\d+` 或中文资源标签的行，无匹配时兜底取最后 30 行

### 3.5 DeepSeek AI 解析
- 多资源并行 prompt, 正则回退解析
- 30s AbortController 超时

### 3.6 后端通信
- 主进程 Node.js http 模块（绕过 socks5 代理）
- 重试队列: electron-store 持久化, 启动时冲刷
- `capture_time` 统一 UTC (`utcNow()`)

### 3.7 状态管理
- `resourceMap: Record<resourceTypeId, ResourceSnapshot>`
- `captureHistory` 最多 50 条, 并发锁 `captureState === 'idle'`
- 恢复速率定时刷新, 每秒 tick 倒计时

### 3.8 恢复速率配置

| 游戏 | 资源 | 恢复速率 |
|------|------|----------|
| 原神 | 原粹树脂 | 8 分钟/点 |
| 原神 | 洞天宝钱 | 2 分钟/点 |
| 绝区零 | 电量 | 6 分钟/点 |
| 终末地 | 理智 | 7.2 分钟/点 |
| 异环 | 本性像素 | 6 分钟/点 |

### 3.9 第十二轮修复与优化
- 修复 OCR 成功后 selectedResourceType 未同步 → 进度条数据不更新
- 修复 refreshRecords/loadTodayFromBackend 记录排序 → 恢复量计算不准（改为按 capture_time 升序 + 最新覆盖）
- 移除 loadTodayFromBackend 对 selectedGame 的后端覆盖 → 初始始终为原神
- ResourceDisplay 移除 subResources 多行显示 → 单资源 + GameSelector 下拉切换
- 恢复时间取整（Math.floor）+ 增加「预计 HH:MM 恢复满」时钟时刻
- CapturePage ↻ 图标改为可点击重置按钮（重置刷新间隔为默认 2s）
- OCR 弹窗步骤文案优化：正在截取游戏画面… / 正在识别画面文字… / 正在解析资源数据…
- 无效进程弹窗副提示从「进程: xxx」改为「请切换到支持的游戏窗口后重试」

---

## 四、窗口置顶工具 ✅ (开发完成)

```
快捷键 → PowerShell 获取前台 HWND → 已置顶? 取消 : 置顶
  → SetWindowPos(HWND_TOPMOST)
  → 创建透明边框覆盖窗(BrowserWindow)
  → 400ms 定时轮询窗口位置 + IsWindow 存活性检测
```

### 4.1 已实现功能
- 快捷键/按钮置顶当前前台窗口，再次触发取消；已置顶时触发替换为新窗口（单窗口模式）
- 8 色预设 + 自定义颜色选择器配置边框颜色
- 已置顶窗口卡片：窗口标题、进程名、置顶时间
- 4-div 绝对定位边框渲染（替代 CSS border，解决透明 BrowserWindow 中渲染不可靠问题）
- 工具页空状态提示显示实际快捷键（kbd 样式，无快捷键时显示"未设置"）
- 快捷键配置已集成到设置页（HotkeyAction='pinner'，含 enable/disable 开关）
- 退出应用时自动取消所有置顶
- 工具禁用 = 快捷键注销联动

### 4.2 技术实现
- **主进程**: `src/main/ipc/pinner.ts`
  - PowerShell/C# P/Invoke 调用 `SetWindowPos`、`GetWindowRect`、`IsWindow`
  - 透明 `BrowserWindow` 边框覆盖窗管理
  - 400ms 定时轮询窗口位置 + 存活性
- **渲染进程**: `src/renderer/features/window-pinner/PinnerPage.tsx`
- **状态管理**: `src/renderer/stores/pinnerStore.ts`（Zustand）
- **设置持久化**: pinnerMaxWindows(默认5), pinnerBorderColor(默认#2563EB), pinnerHotkey
- **快捷键**: window-pinner action，已集成到 main/index.ts 和 preload

### 4.3 第十三轮修复 (三个严重问题已解决)

| # | 问题 | 修复方式 |
|---|------|----------|
| 1 | PowerShell 进程洪水 CPU 100% | 400ms 轮询从 N 次 execFile 合并为单次批量 PS 脚本 `getAllWindowRects`（一次 PS 进程查询所有 HWND 的 rect） |
| 2 | 边框覆盖窗位置/大小错误 | 移除 scaleFactor 除法——非 DPI-aware PS 进程的 GetWindowRect 已返回逻辑坐标 (DIP)，二次除法导致坐标缩小 |
| 3 | 置顶窗口自动取消 | 增加 `missingRectRetries` 重试机制：连续 2 次 getWindowRect 返回 null 才取消置顶，容忍临时 PS 超时 |

### 4.4 文件清单

| 文件 | 职责 |
|------|------|
| `electron-app/src/main/ipc/pinner.ts` | 主进程核心：PS/C# HWND检测、SetWindowPos、边框覆盖窗、轮询 |
| `electron-app/src/renderer/stores/pinnerStore.ts` | 状态管理：已置顶列表、最大数量、边框颜色、设置持久化 |
| `electron-app/src/renderer/features/window-pinner/PinnerPage.tsx` | 工具页 UI：列表、颜色选择器、最大数量设置 |
| `electron-app/src/renderer/features/window-pinner/index.ts` | 入口导出 |
| `electron-app/src/renderer/features/window-pinner/plugin.json` | 插件清单 |

---

## 五、待开发工具

### 5.1 今日按键统计 (upcoming)
- **状态**: 已注册为 upcoming，侧边栏和首页显示"即将推出"，未创建实现文件
- **描述**: 统计每日键盘鼠标按键次数，隔天自动重置，支持历史记录与按键排行
- **注册文件**: plugin-registry.ts (id: 'key-counter'), Sidebar.tsx, HomePage.tsx

---

## 六、已知问题 ⚠️

| # | 问题 | 严重度 | 状态 |
|---|------|--------|------|
| 1 | 后端伪报错（写入成功但前端提示 unreachable） | 中 | 未修复 |
| 2 | 历史记录未持久化（captureHistory 仅内存, 重启丢失） | 低 | 未修复 |
| 3 | 托盘热键仍可触发捕获（缩小到托盘后可能误截本应用） | 低 | 未修复 |
| 4 | 游戏分辨率与屏幕分辨率差异大时 OCR 识别率下降 | 中 | 已加 UI 提示，未根治 |

---

## 七、已修复问题 ✅

| # | 问题 | 修复方式 | 轮次 |
|---|------|----------|------|
| 1 | OCR 弹窗不稳定/闪现 | 弹窗每次新建不复用，CSS fadeIn/fadeOut | 11 |
| 2 | 弹窗状态机更新不及时 | 渲染进程统一管理弹窗 | 11 |
| 3 | AI 解析步骤可能卡住 | 30s AbortController + AbortError | 11 |
| 4 | 弹窗进程名未映射 | GAME_CONFIGS.processName 匹配 | 11 |
| 5 | OCR 链路性能 | 每步超时截停、NearestNeighbor 放大 | 11 |
| 6 | 未配置进程应拦截 | 弹窗显示无效进程提示 | 11 |
| 7 | OCR 文本噪音大 | filterOcrText 过滤 | 11 |
| 8 | 历史 OCR 文本被截断 | max-h-14 → max-h-40 | 11 |
| 9 | OCR成功后进度条未更新 | selectedResourceType 同步到检测游戏的主资源 | 12 |
| 10 | 后端记录恢复量计算不准 | 按 capture_time 升序排序 + 最新覆盖 | 12 |
| 11 | 初始资源页不是原神 | 移除 loadTodayFromBackend 的 selectedGame 覆盖 | 12 |
| 12 | 进度条同时显示多资源 | 改为单资源 + GameSelector 下拉切换 | 12 |
| 13 | 恢复时间小数位过多 | Math.floor 取整 + 增加预计时钟时刻 | 12 |
| 14 | 刷新间隔重置按钮不可点击 | ↻ span → button, 点击重置为 2s | 12 |
| 15 | OCR弹窗文案生硬 | 改为「正在截取游戏画面…」等 | 12 |
| 16 | hotkey:update 首次保存不注册 | 移除 info?.enabled !== false 判断 | 12 |
| 17 | 窗口置顶快捷键录入无响应 | handleKeyCapture 补全 editingPinner 分支 | 12 |
| 18 | 窗口置顶 topmost.ToString 报错 | TS 侧预计算 psBool | 12 |
| 19 | 窗口置顶 PS 进程洪水 CPU 100% | 批量 getAllWindowRects 合并 N 次 execFile 为单次 | 13 |
| 20 | 窗口置顶边框覆盖窗位置/大小错误 | 移除 scaleFactor 除法（非 DPI-aware PS 已返回逻辑坐标） | 13 |
| 21 | 窗口置顶窗口误自动取消 | missingRectRetries 重试（连续 2 次 null 才取消） | 13 |
| 19 | 设置页白屏 | 从git恢复后精确逐行添加pinner变量 | 12 |

---

## 八、最高优先级待办 🔴

> 第十三轮已全部修复 ✅ — 详见第四节

---

## 九、关键设计决策

| 决策 | 选择 | 原因 |
|------|------|------|
| OCR 引擎 | Windows.Media.Ocr via PS 反射 AsTask | 零安装 |
| 截图 | screenshot-desktop GDI 全屏 | 快, DPI 补偿 |
| 后端 HTTP | 主进程 Node.js http | 绕过 socks5 代理 |
| 弹窗管理 | 渲染进程统一, 每次新建 BrowserWindow | 状态一致, 无复用残留 |
| 弹窗更新 | executeJavaScript 直操作 DOM | 无 loadURL 闪烁 |
| OCR 预处理 | NearestNeighbor 自适应放大, 不加灰度 | 保留锐利边缘和颜色对比度 |
| 资源状态键 | resourceType.id (非 gameId) | 多资源独立 |
| 捕获触发 | 仅快捷键 | 避免本应用在前 |
| 游戏检测 | 进程名自动解析 | 数据来源一致 |
| 快捷键存储 | JSON 数组 | 消除 + 分隔符歧义 |
| 并发控制 | captureState === 'idle' | 防止频繁 OCR |
| capture_time | utcNow() = new Date().toISOString() | UTC 时间 |
| 窗口置顶操作 | PowerShell/C# P/Invoke | 避免 native addon 编译依赖 |
| 置顶边框 | 透明 BrowserWindow 覆盖 | 最简可行方案 |

---

## 十、关键文件地图

### 主进程
| 文件 | 职责 |
|------|------|
| `electron-app/src/main/index.ts` | 入口, tray, 快捷键注册, 三工具 hotkey 管理 |
| `electron-app/src/main/ipc/capture.ts` | 前景检测, 截图+OCR(纯数据), 弹窗 IPC |
| `electron-app/src/main/ipc/backend.ts` | 主进程 HTTP 后端通信 |
| `electron-app/src/main/ipc/queue.ts` | 重试队列持久化 |
| `electron-app/src/main/ipc/pinner.ts` | **窗口置顶核心**：PS/C# HWND检测、SetWindowPos、边框覆盖窗、轮询 |
| `electron-app/src/main/utils/ocr.ts` | OCR PS 脚本 |
| `electron-app/src/main/tray.ts` | 托盘管理 |

### 渲染进程
| 文件 | 职责 |
|------|------|
| `electron-app/src/renderer/App.tsx` | 入口, 三工具 hotkey 监听分发 |
| `electron-app/src/renderer/stores/captureStore.ts` | 资源捕获管线编排、进程校验、OCR 过滤、恢复计算 |
| `electron-app/src/renderer/stores/pinnerStore.ts` | **窗口置顶**状态管理 |
| `electron-app/src/renderer/stores/settingsStore.ts` | 设置持久化（含三工具 hotkey） |
| `electron-app/src/renderer/stores/pluginStore.ts` | 工具启用/禁用/upcoming 管理 |
| `electron-app/src/renderer/features/resource-capture/CapturePage.tsx` | 资源捕获页面入口 |
| `electron-app/src/renderer/features/resource-capture/ResourceDisplay.tsx` | 资源值+进度条+恢复倒计时+预计时钟 |
| `electron-app/src/renderer/features/resource-capture/CapturePanel.tsx` | 快捷键提示面板 |
| `electron-app/src/renderer/features/resource-capture/CaptureHistory.tsx` | 历史记录面板 |
| `electron-app/src/renderer/features/resource-capture/GameSelector.tsx` | 游戏+资源下拉 |
| `electron-app/src/renderer/features/window-pinner/PinnerPage.tsx` | **窗口置顶**工具页 UI |
| `electron-app/src/renderer/pages/SettingsPage.tsx` | 设置页（含三工具快捷键行） |
| `electron-app/src/renderer/pages/HomePage.tsx` | 首页工具卡片 |
| `electron-app/src/renderer/lib/plugin-registry.ts` | BUILTIN_PLUGINS 注册 |

### 预加载
| 文件 | 职责 |
|------|------|
| `electron-app/src/preload/index.ts` | contextBridge API（含 pinner 命名空间） |
| `electron-app/src/renderer/env.d.ts` | TypeScript 类型声明 |

---

## 十一、环境

- OS: Windows (2240×1400, 150% DPI)
- Node.js: v24.12.0, npm: 11.6.2
- Python: `E:\devtools\python\python-3.14.5\python.exe`
- 代理: `socks5://127.0.0.1:7897`
- 后端: `http://100.70.198.102:8000` (Tailscale, FastAPI + MySQL `game_resource_manage.resource_capture_records`)

---

## 十二、提交规范

- 原子化 commit，中文 message（feat:/fix:/chore:/style:/docs:）
- 提交前验证: `npx electron-vite build` 编译通过
- 分支前缀: `codex/`
