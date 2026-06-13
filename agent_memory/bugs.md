# 问题与风险

## 当前注意

- 计时器现在有两类独立窗口：小悬浮窗 `floatingWindows/floatingIds` 与自由窗口 `freeWindows/freeIds`。两者必须保持互斥，同一计时器打开一种窗口时要自动关闭另一种。
- 禁用计时器工具、退出软件、删除计时器时必须同时关闭小悬浮窗和自由窗口，避免后台窗口残留。

- `electron-app/src/renderer/pages/HomePage.tsx` 可能在 `git status` 中显示 `M`，如果 `git diff` 为空则属于 CRLF/LF 噪声，不要作为真实改动提交。
- 重新打包或 Native AOT publish 前，先清理运行中的本项目进程，避免 `pinman.exe`、`keystats.exe`、`appstats.exe` 被锁。
- Windows 下源码和记忆文件写入继续使用 `apply_patch`。
- 当前账户打包 NSIS 时，默认 `electron-builder` 可能在解压 `winCodeSign` 时因无符号链接权限失败；可使用 `npx electron-builder --win --config.win.signAndEditExecutable=false` 绕过该路径。
- 全局 `electron-builder` cache 可能出现 NSIS 目录重命名 `Access is denied`；可临时设置 `ELECTRON_BUILDER_CACHE` 到 `%TEMP%` 下的新目录后重跑。

## 计时器工具已处理问题

- 卡片拖拽时切换页面、窗口失焦或应用进入后台后，拖拽状态可能未中断。
  - 本轮处理：监听 `window.blur`、`pagehide`、`pointercancel`、`document.visibilitychange`，恢复真实顺序并清理拖拽状态。
- 计时器悬浮窗 hover/focus 行为不符合预期。
  - 本轮处理：去掉 focus 驱动按钮显示，按钮只在 hover 时显示；透明窗口外壳用于消除双重圆角；顶部独立拖拽条作为唯一拖拽区域，避免吞掉 hover。
  - 后续优化：悬浮窗内部改为固定绝对定位，类型文字和按钮只做 opacity/transform，不再用增删节点或布局重排，避免失去 hover 时文字先偏移再消失。
  - 后续优化：非 hover 标题和时间使用独立居中层，hover 标题/类型使用独立层，避免同一元素在居中与左右布局之间切换造成视觉偏移。
- 悬浮窗刚打开时 hover 不能立即生效。
  - 本轮处理：外层改为 `no-drag` hover 捕获，拖拽区域缩小到顶部行。
- 时间显示存在直观跳秒。
  - 本轮处理：前端以 250ms tick 根据 `lastStartedAt` 推导显示值；倒计时显示按秒向上取整。
- 主窗口和计时器悬浮窗双击拖拽区域会触发最大化/还原类事件，表现为向左上角瞬移。
  - 本轮处理：主窗口和悬浮窗设置 `maximizable:false`、`fullscreenable:false`，并监听 `maximize`/`enter-full-screen` 强制回退；窗口 IPC 的 `toggleMaximize` 改为无操作。

## 待观察

- 透明悬浮窗在 Windows 上通常可用，但如果后续出现性能或渲染异常，可改回非透明窗口并用更保守的单层矩形 UI 兜底。
- Windows 透明窗口会把 CSS 阴影裁成直角边缘；悬浮窗应避免使用外扩 `box-shadow`，优先使用边框和紧凑布局。
- `-webkit-app-region: drag` 区域仍可能吞掉部分鼠标事件，因此悬浮窗交互区必须保持 `no-drag`，只把顶部拖拽条设为 `drag`。
