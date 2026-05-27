# Agent Prompt — LightweightWindowsToolset

请先完整阅读 `E:\codex_agent_project\LightweightWindowsToolset\PROJECT_SUMMARY.md` 理解项目全貌后再展开工作。

## 注意事项

1. **代理**: 所有网络操作（npm install、git push/pull、npx 下载）必须通过代理 `socks5://127.0.0.1:7897`，操作前先用 `curl.exe -I --socks5-hostname 127.0.0.1:7897 https://github.com` 验证代理可用。

2. **原子化 commit**: 每完成一个可独立运行的子功能做原子化 commit，使用中文 commit message（`feat:` / `fix:` / `chore:` / `style:` / `docs:` 格式）。

3. **提交前三项强制验证**:
   - 代理可用
   - 应用无崩溃（`npm run dev` 启动无白屏、无报错弹窗、无未处理异常）
   - 本轮问题已修复

4. **TypeScript 严格模式**: `strict: true`，构建命令: `cd electron-app && npx electron-vite build`。

5. **开发前先运行 `git status`** 确认工作区状态。

6. **窗口关闭行为**: 所有窗口关闭默认直接退出，设置中可选缩小到托盘；托盘右键"退出"必须能终止进程。

7. **禁止以下 UI 样式**: 禁止 UI 卡片嵌套卡片、禁止渐变球/光晕装饰、禁止负 letter-spacing。

8. **主色调**: 严格遵循蓝白灰（light: primary `#2563EB` / dark: primary `#3B82F6`）。

9. **打包**: 默认不再打包便携版 EXE，仅在你明确说"打包"时才执行 `cd electron-app && npm run package`。打包前清理 dist 目录并确保无 `轻量化工具集.exe` 进程残留（`taskkill /F /IM "轻量化工具集.exe"`）。已配置 `CSC_IDENTITY_AUTO_DISCOVERY=false signAndEditExecutable=false`。

10. **窗口尺寸**: 676x444 固定不可调，侧边栏 155px/44px。

11. **AI 聊天**: 属于内置功能不是工具，不在工具列表和开关中出现。

12. **中文字符串编码**: 所有中文字符串必须在源代码中以有效 UTF-8 存储。严禁使用 PowerShell 管道传中文给 Python（会导致字节损坏为 ASCII `?`）。如需 Python 写中文，使用显式 UTF-8 十六进制字节数组或 apply_patch 工具。

13. **已删除的文件不要恢复**: git 历史中已删除的文件（如 `tavily.ts`）不要恢复，已移除的功能（联网搜索）不要重新实现，除非明确要求。

14. **设置页输入框保存逻辑**: 编辑时显示保存按钮 → 保存成功后隐藏保存按钮（不允许自动保存）。

15. **每次回复末尾必须包含中文总结**（## 本次总结）。

16. **工具禁用 = 快捷键禁用**: 禁用工具时通过 `tool:set-enabled` IPC 通知主进程注销对应快捷键。不做 UI 级假禁用。

17. **新工具默认无快捷键**: 以后所有新工具添加都不要配置默认快捷键（默认值为空字符串）。用户需手动在设置中配置。

18. **快捷键配置 UI**: 追加式按键录入，「配置快捷键」→ `+` `-` `保存` `取消` → 逐框录入 → 保存时自动去重。冲突检测标红。

19. **开发服务器**: 完成后提示用户运行 `cd electron-app && npm run dev` 启动开发服务器。

## 工作流程

1. 阅读 PROJECT_SUMMARY.md 理解项目
2. `git status` 确认状态
3. 代理验证
4. 实施修改
5. `npx electron-vite build` 验证 TypeScript 编译
6. `npm run dev` 启动验证无崩溃
7. 必要时运行 `npm run test:e2e`（28 条测试）
8. 原子化 commit

请全程使用中文回复我。
