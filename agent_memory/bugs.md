# 问题与风险

## 已处理

- 快捷方式整理工具会在处理部分快捷方式图标时触发目标程序启动。用户已决定放弃该工具开发，桌面端源码入口和后台逻辑已移除。
- 安装版游戏资源捕获截图失败，报缺少 `app.asar.unpacked\node_modules\screenshot-desktop\lib\win32\screenCapture_1.3.2.bat`。根因是 `screenshot-desktop` 的 win32 脚本未被 asar 解包；已在 `electron-app/package.json` 加入：
  - `asarUnpack: ["node_modules/screenshot-desktop/lib/win32/**"]`

## 当前注意

- `git status` 仍可能显示多个桌面端源码文件为 `M`，但 `git diff --stat` 为空时属于 CRLF/LF 归一化噪声，不要当作真实代码改动提交。
- `agent_memory/` 用于项目恢复上下文；更新时保持简短、当前有效。
- 重新打包或 Native AOT publish 前，先清理运行中的本项目进程，避免 exe 被锁。
