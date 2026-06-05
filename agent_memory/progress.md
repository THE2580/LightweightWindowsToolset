# 当前进展

## 当前阶段

- 桌面端 `v1.2.3` 已发布。
- “快捷方式整理”工具开发已放弃，源码入口与后台逻辑已移除。
- 安装版游戏资源捕获截图失败问题已修复并发布。

## 已完成

- 移除 `shortcut-organizer` 插件注册，首页和侧边栏不再显示该工具。
- 移除主进程 shortcut organizer IPC 注册和 Dock 恢复/关闭逻辑。
- 移除 renderer `/shortcut-dock` 路由、快捷方式页面和 Dock 小窗页面。
- 移除 preload / `env.d.ts` 中的 `shortcuts` API 与相关类型。
- 移除为该工具临时加入的 renderer 全局外部文件拖放防护。
- 修复安装版缺少 `screenshot-desktop` Windows 脚本导致截图失败：`electron-app/package.json` 已加入 `asarUnpack`。
- 已发布 GitHub Release `v1.2.3`，包含安装版和便携版资产。

## 下一步

- 开始移动端资源捕获离线 pending 同步队列开发。
- 移动端第一版只保存 pending 记录，同步成功后删除本地 pending 记录。
- 自动同步与自动刷新共用同一个定时流程。
