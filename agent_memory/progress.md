# 当前进展

## 当前阶段

- 桌面端正在开发第五个工具：`计时器`。
- 本轮开始前已先提交基线：`a92c716 feat: 新增计时器工具`。
- 本轮已完成计时器工具的拖拽中断、悬浮窗 hover、时间显示和窗口双击行为修复，并已打开开发版供测试。

## 已完成

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

- 等待用户在开发版验证本轮计时器修复。
- 若仍有悬浮窗 hover、拖拽回位或双击窗口行为问题，优先复现具体交互，再做最小修复。

## 验证记录

本轮已通过：

- `cd electron-app && npx electron-vite build`
- `cd pinman && dotnet publish -c Release -r win-x64 --self-contained -p:PublishAot=true -p:DebugType=none -p:DebugSymbols=false`
- `cd keystats && dotnet publish -c Release -r win-x64 --self-contained -p:PublishAot=true -p:DebugType=none -p:DebugSymbols=false`
- `cd appstats && dotnet publish -c Release -r win-x64 --self-contained -p:PublishAot=true -p:DebugType=none -p:DebugSymbols=false`
