# 当前进展

## 当前阶段

- 桌面端正在开发第五个工具：`计时器`。
- 本轮开始前已先提交基线：`a92c716 feat: 新增计时器工具`。
- 本轮已完成计时器工具的拖拽中断、悬浮窗 hover、时间显示和窗口双击行为修复，并已打开开发版供测试。
- 用户已确认开发版测试通过；本轮自由窗口响应式微调已提交，并已生成、修复且推送 GitHub Release `1.2.4`。

## 已完成

- 计时器新增“自由窗口”：可调整窗口大小，独立置顶显示，与小悬浮窗互斥；打开其中一种窗口时会自动关闭同一计时器的另一种窗口。
- 计时器页面卡片新增自由窗口按钮，顶部独立窗口统计同时包含小悬浮窗和自由窗口，“关闭窗口”会同时关闭两类独立窗口。
- 自由窗口会持久化位置与尺寸；禁用计时器工具、退出软件、删除计时器时会关闭小悬浮窗和自由窗口。
- 自由窗口主体已改为整体响应式布局：时间字号增长曲线放缓，状态、时间、按钮作为一组居中，按钮和标题栏轻微跟随窗口尺寸变化，避免只放大时间导致比例失衡。
- `electron-app` 版本号已从 `1.2.3` 提升到 `1.2.4`，用于生成最新本地 release。
- 已生成并修复 `1.2.4` 安装版和便携版本地 release 产物：
  - `electron-app/dist/LightweightWindowsToolset-v1.2.4-setup-win-x64.exe`
  - `electron-app/dist/LightweightWindowsToolset-v1.2.4-portable-win-x64.zip`

- 支持多个正计时/倒计时，名称可重复，内部使用唯一 ID。
- 支持备注字段，添加/编辑弹窗可输入备注，卡片原生 `title` 显示备注。
- 支持开始、暂停、重置、删除、暂停全部、重置暂停项、关闭全部悬浮窗。
- 支持系统通知：仅倒计时结束时按单个计时器配置通知。
- 支持独立置顶悬浮窗：退出或禁用工具时关闭悬浮窗并暂停计时器。
- 支持计时器卡片拖拽排序，排序持久化，运行中计时器仍优先上浮。
- 已优化卡片状态对比、按钮过渡、拖拽手柄、备注显示、底部边界、弹窗动画。
- 本轮新增：
  - 拖拽时窗口失焦、页面隐藏、指针取消会主动中断拖拽状态。
  - 主面板和悬浮窗使用 250ms 前端轻量 tick 计算显示时间，倒计时按向上取整显示，减少直观跳秒。
  - 悬浮窗改为透明窗口外壳 + 单层圆角卡片，按钮仅在 hover 时显示，并加入过渡动画。
  - 悬浮窗去掉全局拖动，改为顶部独立拖拽条，避免拖拽区域影响 hover；同时去掉窗口系统阴影，减少透明直角边框观感。
  - 悬浮窗进一步收紧为 `150x76`，去掉卡片阴影，hover 元素改为固定布局下的 opacity/transform 动画，避免类型文字和按钮重排闪现。
  - 悬浮窗非 hover 状态改为独立居中标题层和居中时间层；hover 状态改为独立左标题/右类型层，时间上移并缩小，按钮缩小贴底，避免按钮与时间重叠。
  - 最新微调：非 hover 标题和时间整体上移，非 hover 时间显示放大，hover 状态坐标和动画保持不动。
  - 主窗口和计时器悬浮窗均禁用最大化/全屏入口，降低双击拖拽区域导致窗口瞬移的风险。

## 下一步

- 等待用户验证本轮新增功能：禁用当前工具跳转首页、本地时间卡片和时钟自由窗口。
- 若后续仍有悬浮窗 hover、拖拽回位或双击窗口行为问题，优先复现具体交互，再做最小修复。

## 验证记录

本轮已通过：

- `cd electron-app && npx electron-vite build`
- `cd pinman && dotnet publish -c Release -r win-x64 --self-contained -p:PublishAot=true -p:DebugType=none -p:DebugSymbols=false`
- `cd keystats && dotnet publish -c Release -r win-x64 --self-contained -p:PublishAot=true -p:DebugType=none -p:DebugSymbols=false`
- `cd appstats && dotnet publish -c Release -r win-x64 --self-contained -p:PublishAot=true -p:DebugType=none -p:DebugSymbols=false`
- 用户开发版测试通过。
- `cd electron-app && npx electron-builder --win --config.win.signAndEditExecutable=false`，使用临时 `ELECTRON_BUILDER_CACHE` 规避全局 cache 权限问题后成功生成 NSIS 安装包。
- 已复制生成英文命名安装包，并从 `dist/win-unpacked` 压缩生成 `LightweightWindowsToolset-v1.2.4-portable-win-x64.zip`。
- 发现上述 `signAndEditExecutable=false` 会跳过 `rcedit --set-icon`，导致 release 主程序和安装包显示 Electron 默认图标；已用 `rcedit-x64.exe --set-icon resources/icon.ico` 修复 `dist/win-unpacked/轻量化工具集.exe`，再用 `electron-builder --win --prepackaged dist/win-unpacked --config.win.signAndEditExecutable=false` 重建 NSIS，并重新生成英文安装包副本和 portable zip。
- 已通过 `System.Drawing.Icon.ExtractAssociatedIcon()` 提取主程序和安装包图标，确认均为项目齿轮图标。
- 已清理 `electron-app/dist` 中 `1.0.1` 到 `1.2.3` 的旧 release 产物，保留 `1.2.4` 和 `win-unpacked`。
- 本轮新功能已通过 `cd electron-app && npm run build`。
- 已创建 GitHub Release：`https://github.com/THE2580/LightweightWindowsToolset/releases/tag/v1.2.4`。

## 本轮新增功能

- 已实现禁用当前正在浏览的工具时自动跳转首页，避免工具已禁用但页面仍可操作。
- 已在计时器页统计卡片区域新增本地时间时钟显示，点击可打开/关闭对应时钟自由窗口；顶部独立窗口统计不新增“一键关闭”入口。
- 已调整计时器页布局：顶部标题工具栏实底吸附，统计卡片保持在内容顶部，时钟卡片回到统计卡片下方；隐藏统计卡片使用高度折叠动画，避免列表归位生硬和临时滚动条。
- 最新修复：计时器页标题工具栏改为固定在页面顶部，下方内容独立滚动；本地时间卡片改为与统计卡片、计时器列表一致的全宽卡片。
- 最新修复：计时器页标题栏取消高层级覆盖，避免压住 AI 聊天侧栏；标题栏改为页面固定头部并去掉上边界裁切；统计卡片隐藏动画改为 `popLayout` 轻量归位；时钟自由窗口时间改为视觉垂直居中；页面级滚动条改为隐藏，内部列表滚动条保留。
- `electron-app` 版本号已提升到 `1.2.5`，README 已补充计时器说明与当前版本。
- 最新回归修复：打包/构建模式下计时器小悬浮窗、自由窗口和本地时间窗口的 `loadFile` hash 已统一改为带 `/` 的 HashRouter 路由；已用 Playwright Electron 验证本地时间窗口 URL 为 `#/timer-clock` 且内容可见。
- `electron-app` 版本号已提升到 `1.2.6`，用于发布计时器独立窗口路由回归修复。
