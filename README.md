# LightweightWindowsToolset

轻量化 Windows 桌面工具集 — 一款挂载于系统托盘的插件化桌面应用。

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Electron 33.x |
| 前端 | React 19 + TypeScript 5.x |
| 构建 | electron-vite 2.x |
| 状态 | Zustand 5.x |
| UI | shadcn/ui + Tailwind CSS 4 |
| 动画 | framer-motion 12.x |

## 首期工具

- **电脑端游戏体力捕获**: 截图 → OCR → DeepSeek AI 解析 → 后端 API

## 开发

```bash
cd electron-app
npm install
npm run dev
```

## 目录结构

```
LightweightWindowsToolset/
├── electron-app/          # Electron 主项目
├── tools/                 # 插件目录
├── PRD.md                 # 产品需求文档
├── AGENT_PROMPT.md        # 开发提示词
└── backend-api-reference.md
```
