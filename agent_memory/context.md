# 项目背景

LightweightWindowsToolset 是 Windows 系统托盘插件式桌面工具集，桌面端基于 Electron 33、React 19、TypeScript strict，并包含多个 Native AOT 辅助进程。

## 当前工具

- 游戏资源捕获：截图识别游戏资源值，记录并同步到后端 API。
- 窗口置顶：通过 `pinman.exe` 管理窗口置顶。
- 按键统计：通过 `keystats.exe` 统计键鼠按键。
- 软件使用统计：通过 `appstats.exe` 统计前台软件使用时长。

## 重要约束

- 默认中文沟通，代码标识保持仓库既有风格。
- Windows 写源码/文档内容使用 `apply_patch`。
- 不恢复用户主动删除的文件或功能。
- 工具禁用必须完整停止入口、快捷键、后台进程、状态。
- 代码修改后按要求验证 Electron 构建和 Native AOT 发布。
- 启动开发版或重新打包前，先清理本项目 Electron / Node / pinman / keystats / appstats 相关进程。
