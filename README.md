# LightweightWindowsToolset

轻量化 Windows 桌面工具集。应用常驻系统托盘，以插件形式提供一组低占用、可独立启停的实用工具，覆盖游戏资源捕获、窗口置顶、输入统计、软件使用统计和计时器。

## 下载

前往 [Releases](https://github.com/THE2580/LightweightWindowsToolset/releases) 下载最新版本：

- **安装版**：适合长期使用，支持桌面快捷方式、开始菜单入口和卸载。
- **便携版**：解压后直接运行，适合放置在自定义目录或移动存储中。

当前仅提供 Windows x64 版本。

当前版本：**v1.2.6**。

## 内置工具

### 游戏资源捕获

截取游戏画面，通过 Windows 系统 OCR 和 AI 解析资源值，自动保存本地捕获记录，并可同步到配套后端。

### 窗口置顶

通过轻量 Native AOT 后台进程 `pinman.exe` 将任意窗口固定在最上层，支持快捷键、多窗口置顶和本应用自动置顶。

### 按键统计

通过轻量 Native AOT 后台进程 `keystats.exe` 统计键盘与鼠标按键次数，支持日、月、年趋势和按键排行。

### 软件使用统计

通过轻量 Native AOT 后台进程 `appstats.exe` 统计前台软件使用时长，支持日、月、年排行、离开状态暂停和软件名称映射。

### 计时器

管理多个正计时和倒计时任务，支持备注、拖拽排序、暂停全部、重置暂停项、倒计时结束通知、小悬浮窗、可调整大小的自由窗口，以及本地时间自由窗口。

## 设计原则

- 工具可独立启用或禁用。
- 工具禁用后同时隐藏入口、注销快捷键并停止对应后台进程。
- 计时器独立窗口会在禁用工具、退出软件或删除计时器时同步关闭，避免后台窗口残留。
- 按键统计和软件使用统计仅保存在本地。
- 软件使用统计不记录窗口标题、文件路径或键盘输入内容。
- 优先使用系统能力和轻量原生进程，避免不必要的常驻开销。

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 33 |
| 前端 | React 19 + TypeScript strict |
| 构建 | electron-vite + electron-builder |
| 状态管理 | Zustand |
| 样式与动画 | Tailwind CSS 4 + Framer Motion |
| 原生工具 | C# Native AOT |

## 本地开发

环境要求：

- Node.js
- npm
- .NET SDK 9
- Windows x64

启动开发版：

```powershell
cd electron-app
npm install
npm run dev
```

构建 Electron：

```powershell
cd electron-app
npx electron-vite build
```

构建 Native AOT 工具：

```powershell
cd pinman
dotnet publish -c Release -r win-x64 --self-contained -p:PublishAot=true -p:DebugType=none -p:DebugSymbols=false

cd ..\keystats
dotnet publish -c Release -r win-x64 --self-contained -p:PublishAot=true -p:DebugType=none -p:DebugSymbols=false

cd ..\appstats
dotnet publish -c Release -r win-x64 --self-contained -p:PublishAot=true -p:DebugType=none -p:DebugSymbols=false
```

## 目录结构

```text
LightweightWindowsToolset/
├── electron-app/   # Electron 主应用
├── pinman/         # 窗口置顶 Native AOT 工具
├── keystats/       # 按键统计 Native AOT 工具
├── appstats/       # 软件使用统计 Native AOT 工具
└── tools/          # 辅助工具
```

## 许可证

项目尚未添加开源许可证。未经许可，请勿将代码用于再分发或商业用途。
