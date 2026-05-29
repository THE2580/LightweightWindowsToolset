# LightweightWindowsToolset — 项目进展总结

> 最后更新: 2026-05-29 (第十一轮)
> 当前分支: main
> 最新提交: 250086a (feat: OCR链路全面重写 — 渲染进程统一管理弹窗、每步超时截停、无效进程拦截、预处理放大、OCR文本过滤)
> 未提交改动: 无
> 编译状态: ✅ 通过

---

## 一、项目概览

Windows 系统托盘插件式桌面工具集（Electron 33 + React 19 + TypeScript strict）。首期工具为 PC 端游戏资源捕获（快捷键 → 截图 → OCR → DeepSeek AI → 后端 API → 数据库）。

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

### 关键配置

- **代理**: `socks5://127.0.0.1:7897`
- **后端 API**: `http://100.70.198.102:8000` (Tailscale IP)
- **DeepSeek**: `https://api.deepseek.com/chat/completions`
- **根目录**: `E:\codex_agent_project\LightweightWindowsToolset`
- **窗口**: 676×444 固定不可调, 侧边栏 155px/44px
- **主题**: 蓝白灰 (light #2563EB / dark #3B82F6)
- **设计约束**: 禁止渐变球/光晕, 禁止负 letter-spacing, 禁止 UI 卡片嵌套卡片, 禁止 hover scale 动画(overflow 裁剪)

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
- 快捷键: 追加式录入, 保存时校验, JSON 数组存储, 录入时禁用全局快捷键

### 2.3 插件/工具系统
- `BUILTIN_PLUGINS` 静态注册, stable/upcoming 两态, 侧边栏/主页动态渲染
- 工具禁用 = 快捷键注销 (tool:set-enabled IPC)
- AI 聊天为内置功能, 不在工具列表, 不在开关中

### 2.4 快捷键系统
- globalShortcut 注册/注销, 无默认快捷键
- 追加式录入 + 保存时校验 + 冲突检测
- 录入时禁用全局快捷键, 保存/取消后恢复

### 2.5 AI 聊天
- ChatSidebar SSE 流式对话, 右侧滑入滑出动画

### 2.6 开机自启
- `app.setLoginItemSettings()` 实时开关

### 2.7 stamina → resource 全局重命名
- 目录/文件/接口/变量/函数/AI字段/插件ID 全面重命名
- `StaminaSnapshot` → `ResourceSnapshot`, `staminaMap` → `resourceMap`
- 插件 ID: `stamina-capture` → `resource-capture`

### 2.8 资源捕获界面 UI
- 布局: grid-cols-2 并排 ResourceDisplay + CapturePanel, 历史面板占满剩余空间
- Hover: ring+shadow 替代 scale (修复 overflow 裁剪黑色伪影)
- 历史面板: 折叠时内部滚动, 展开时整页滚动
- 快捷键面板底部有分辨率警告提示

---

## 三、资源捕获管线 ✅ (第十一轮重写)

```
快捷键 → 前景检测(进程名→游戏名映射) → 进程校验
  → 无效进程: 弹窗显示"当前为无效进程" + 进程名 → 2.5s fadeOut
  → 有效进程: 弹窗(fadeIn) → 截图 → OCR(预处理放大) → AI解析 → 后端POST → 弹窗结果(fadeOut)
```

### 3.1 管线架构
- **渲染进程统一管理**：弹窗生命周期(创建/更新步骤/展示结果/fadeOut) + AI解析 + 后端提交
- **主进程降为纯数据**：`capture:trigger` 只做截图+OCR，不碰弹窗
- **弹窗每次新建** BrowserWindow（不复用），CSS fadeIn/fadeOut 过渡动画
- **每步超时截停**：截图 8s / OCR 15s / AI 30s，任一失败立即终止管线

### 3.2 进程校验
- 未配置游戏: 弹窗显示进程名 + "当前为无效进程"，不执行截图
- 配置游戏: 进程名匹配 GAME_CONFIGS.processName（大小写不敏感，去 .exe）

### 3.3 OCR 预处理
- NearestNeighbor 自适应放大: <1200px 宽 → 3x, else → 2x, 上限 3840px
- 保留原始彩色图像（不加灰度，避免稀释数字对比度）

### 3.4 OCR 文本过滤
- AI 解析前过滤原始文本：只保留含 `\d+/\d+` 或中文资源标签(树脂/体力/宝钱/电量/理智/像素)的行
- 无匹配时兜底取最后 30 行

### 3.5 DeepSeek AI 解析 (`deepseek.ts`)
- 多资源并行 prompt, 正则回退解析
- 30s AbortController 超时，AbortError 显式抛出 `"AI 解析超时 (30s)"`
- AI 超时视为 OCR 链路失败

### 3.6 后端通信 (`backend.ts`)
- 主进程 Node.js http 模块 (绕过 Chromium socks5 代理)
- 重试队列: electron-store 持久化, 启动时冲刷
- `capture_time` 统一使用 UTC(`new Date().toISOString()`) 通过 `utcNow()` 工具函数

### 3.7 状态管理 (`captureStore.ts`)
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

---

## 四、已知问题 ⚠️

| # | 问题 | 严重度 | 状态 |
|---|------|--------|------|
| 1 | 后端伪报错（写入成功但前端提示 unreachable） | 中 | 未修复 |
| 2 | 历史记录未持久化（captureHistory 仅内存, 重启丢失） | 低 | 未修复 |
| 3 | 托盘热键仍可触发捕获（缩小到托盘后可能误截本应用） | 低 | 未修复 |
| 4 | 游戏分辨率与屏幕分辨率差异大时 OCR 识别率下降 | 中 | 已加 UI 提示，未根治 |
| 5 | 资源进度条 UI 同时显示多个资源，应改为下拉切换单一资源 | 中 | 未修复 |
| 6 | OCR 成功后资源进度条未用最新捕获数据更新 | 高 | 未修复 |

---

## 五、已修复问题 ✅ (第十一轮)

| # | 问题 | 修复方式 |
|---|------|----------|
| 1 | OCR 弹窗不稳定/闪现 | 弹窗每次新建不复用，CSS fadeIn/fadeOut |
| 2 | 弹窗状态机更新不及时 | 渲染进程统一管理弹窗，不再分主/渲染两处更新 |
| 3 | AI 解析步骤可能卡住 | 30s AbortController + AbortError 显式抛错 |
| 4 | 弹窗进程名未映射 | 渲染进程 GAME_CONFIGS.processName 匹配 |
| 5 | OCR 链路性能 | 每步超时截停、NearestNeighbor 放大预处理 |
| 6 | 未配置进程应拦截 | 弹窗显示"当前为无效进程"，不执行 OCR |
| 7 | OCR 文本噪音大 | filterOcrText 过滤仅保留资源相关行 |
| 8 | 历史 OCR 文本被截断 | max-h-14 → max-h-40 + whitespace-pre-wrap |

---

## 六、最高优先级待办 🔴

1. **优化 OCR 弹窗提示信息** — 仅需改弹窗内的文案
2. **优化资源显示 UI** — 进度条只显示一个资源，多资源通过下拉框切换
3. **修复资源进度条数据正确性** — OCR 识别成功后资源未用当前数据更新进度条

---

## 七、关键设计决策

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
| capture_time | utcNow() = new Date().toISOString() | UTC 时间, ECMAScript 保证 |

---

## 八、关键文件地图

| 文件 | 职责 |
|------|------|
| `electron-app/src/main/index.ts` | 入口, tray, 快捷键, IPC |
| `electron-app/src/main/ipc/capture.ts` | 前景检测, 截图+OCR(纯数据), 弹窗 IPC 处理器 |
| `electron-app/src/main/ipc/backend.ts` | 主进程 HTTP 后端通信 |
| `electron-app/src/main/ipc/queue.ts` | 重试队列持久化 |
| `electron-app/src/main/utils/ocr.ts` | OCR PS 脚本 (NearestNeighbor 放大, 15s 超时, ChildProcess kill) |
| `electron-app/src/renderer/stores/captureStore.ts` | 管线编排, 进程校验, OCR 过滤, 历史, 游戏配置, 恢复计算 |
| `electron-app/src/renderer/stores/settingsStore.ts` | 设置持久化 |
| `electron-app/src/renderer/features/resource-capture/CapturePage.tsx` | 页面入口 + 自动轮询 |
| `electron-app/src/renderer/features/resource-capture/CapturePanel.tsx` | 快捷键提示面板(含分辨率警告) |
| `electron-app/src/renderer/features/resource-capture/ResourceDisplay.tsx` | 资源值+进度条+恢复倒计时 |
| `electron-app/src/renderer/features/resource-capture/CaptureHistory.tsx` | 手风琴历史记录(完整OCR文本) |
| `electron-app/src/renderer/features/resource-capture/GameSelector.tsx` | 游戏+资源下拉 |
| `electron-app/src/renderer/features/resource-capture/api/backend.ts` | 渲染进程后端 API (IPC) |
| `electron-app/src/renderer/features/resource-capture/api/deepseek.ts` | DeepSeek AI 解析 (30s AbortController, AbortError 显式抛错) |
| `electron-app/src/preload/index.ts` | contextBridge API |
| `electron-app/src/renderer/env.d.ts` | TypeScript 类型声明 |

---

## 九、环境

- OS: Windows (2240×1400, 150% DPI)
- Node.js: v24.12.0, npm: 11.6.2
- Python: `E:\devtools\python\python-3.14.5\python.exe`
- 代理: `socks5://127.0.0.1:7897`
- 后端: `http://100.70.198.102:8000` (Tailscale, FastAPI + MySQL `game_resource_manage.resource_capture_records`)
