# 玄枢八术 Wiki

玄枢八术是一个本地优先、可复现的八术排盘和古籍引证工作台。Web、Electron 和 Android 共用排盘引擎、知识库与 UI；排盘计算不依赖网络，AI 精解默认关闭并与确定性结果隔离。

## 导航

- [快速开始](Quick-Start)
- [系统架构](Architecture)
- [开发与提交](Development)
- [代码审查与修复](Review-and-Fixes)
- [Web、桌面与 Android](Platforms)
- [知识库与书目状态](Knowledge-Base)
- [测试与质量门禁](Testing-and-Quality)
- [来源与授权](Sources-and-Licensing)
- [故障排查](Troubleshooting)

## 当前基线

| 项目 | 当前值 |
|---|---:|
| 术数引擎 | 8 |
| 离线语料 | 86 部 |
| 可检索段落 | 32,673 |
| 路径卡 | 28 张 |
| 支持端 | Web / Windows、macOS、Linux 桌面壳 / Android |

数字以 `data/.kb/books/manifest.json` 和测试输出为准。新增语料后应同步更新本页和 README。

## 设计原则

1. 排盘层确定、纯函数、可复现。
2. 解释层可校准，但不能悄悄改变排盘结果。
3. 引文必须能回到具体语料段，找不到时明确降级。
4. 书目状态据实表达；不把目录、扫描或相关原典冒充全文。
5. 三端共享能力，交互按手机、平板、桌面分别验收。
