# 快速开始

## 环境要求

- Node.js 20+
- npm 10+
- Android 打包需要 JDK 17 和 Android SDK 34
- Electron 打包按目标系统准备对应签名环境；本地开发不需要签名

## 安装与运行

```bash
npm install
npm run doctor
npm run dev
```

开发服务器默认位于 `http://127.0.0.1:5190/`。命令路由统一由 `scripts/run.mjs` 管理，运行 `node scripts/run.mjs help` 可查看所有入口。

## 首次质量检查

```bash
npm run check
npm run kb:lint
npm run build:web
```

`npm run check` 依次执行 TypeScript 严格检查、Vitest、引文对账和路径卡结构校验。语料校验独立运行，以免日常引擎修改反复扫描全部 3 万余段文本。

## 数据存储

- 用户配置、阅读进度和部分轻量状态保存在浏览器本地存储。
- 案例记录使用 IndexedDB/Dexie。
- AI Key 只保存在内存，刷新或重启后需要重新填写。
- Android APK 内置生产 Web 资源和语料，无网络时仍可排盘和阅读。

