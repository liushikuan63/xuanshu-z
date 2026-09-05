# 玄枢 · 八术综合占卜工作台

玄枢是本地优先的确定性排盘与古籍引证工作台，覆盖八字、六爻纳甲、梅花易数、紫微斗数、奇门遁甲、大六壬、小六壬和金口诀。每条规则命中都保留 `ruleId`、证据等级和原典定位；AI 精解默认关闭，且不会参与排盘计算。

## 当前能力

- Web、Electron 桌面端和 Capacitor Android 共用同一套 React UI 与排盘内核。
- 手机使用底部主导航，平板使用 62px 紧凑侧栏，桌面使用 216px 完整侧栏。
- 86 部离线语料、32,673 个可检索段落，支持 BM25、异体字归一、批注、深链和引文高亮。
- 书目不再只分“全文/书录”：区分全文、相关原典、扫描待校、原典亡佚、口传整理、版权受限和底本待考。
- 排盘纯函数由完整配置快照与 `configHash` 决定；记录本只校准解释和案例，不回写排盘层。

## 快速开始

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

开发地址默认为 `http://127.0.0.1:5190/`。常用质量命令：

```bash
npm run check          # 凭据扫描、严格类型、全量测试、引文和路径卡校验
npm run kb:lint        # 语料结构、文本派生字段和乱码检查
npm run build:web      # 生产 Web 构建
npm run desktop:dist   # Electron 安装包
node scripts/mobile-emulator.mjs sync  # Web + Capacitor 同步 + debug APK
```

## 工作区

| 路径 | 责任 |
|---|---|
| `packages/core` | 历法、八术引擎、规则与确定性配置 |
| `packages/knowledge` | 书目、术语、BM25、异体字与语料接口 |
| `packages/reader` | 原典定位、批注、阅读进度与版本信息 |
| `packages/ledger` | IndexedDB 案例记录、配额和导入导出 |
| `packages/intake` | 求测分类、起卦向导与路径卡 |
| `packages/answer` | 事实、规则、应期、证据与安全层装配 |
| `packages/ai` | 默认关闭的 OpenAI 兼容精解适配器 |
| `packages/ui` | 三端共享的 React 视图与设计系统 |
| `apps/web` | Vite Web 壳与离线语料分包 |
| `apps/desktop` | Electron 壳 |
| `apps/mobile` | Capacitor Android 壳 |
| `data/.kb/books` | 逐书 `meta.json` 与 `corpus.jsonl` |

## 文档

完整维护文档位于 [项目 Wiki](docs/wiki/Home.md)：

- [快速开始](docs/wiki/Quick-Start.md)
- [架构说明](docs/wiki/Architecture.md)
- [代码审查与修复](docs/wiki/Review-and-Fixes.md)
- [Web、桌面与 Android](docs/wiki/Platforms.md)
- [知识库与书目状态](docs/wiki/Knowledge-Base.md)
- [测试与质量门禁](docs/wiki/Testing-and-Quality.md)
- [来源与授权](docs/wiki/Sources-and-Licensing.md)
- [故障排查](docs/wiki/Troubleshooting.md)

## 边界说明

本项目用于传统文化、历法和文献研究，不构成医疗、法律、投资或其他专业意见。古籍原作是否进入公有领域与电子转录文本的许可是两件事；每部语料必须以自身 `meta.json` 为准，不应把目录中的时代字段当作授权证明。

代码仓库目前未声明统一开源许可证。公开可见不等于获得复制、再许可或商业使用授权；贡献与再分发前请先确认仓库所有者后续选择的代码许可证，并遵守各语料来源的独立条款。
