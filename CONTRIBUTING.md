# 贡献指南

## 开发流程

1. 使用 Node.js 20 或更高版本运行 `npm install`。
2. 从最新主分支创建单一目的分支。
3. 将引擎、界面、语料、构建和文档变更拆成可独立审阅的提交。
4. 提交前运行 `npm run check`、`npm run kb:lint` 和受影响平台的生产构建。
5. 涉及响应式界面时，至少检查 390×844、768×1024 和 1440×900 三个视口。

## 提交约定

使用简短的 Conventional Commits 前缀：

```text
fix(core): 修正小六壬时辰映射
fix(ui): 完善平板侧栏布局
feat(knowledge): 增加书目存佚状态
docs(wiki): 补充 Android 打包说明
build(android): 更新离线资源打包流程
```

一次提交只处理一个可说明、可验证的主题。不要提交 `node_modules`、`.tools`、`.tmp-corpus`、本机 `local.properties`、环境变量、APK 或其他构建产物。

## 语料贡献

- 先证明书名、作者、年代、底本和来源 URL，再导入正文。
- 古籍原作处于公有领域，不代表网站电子文本可任意复制；必须记录转录许可。
- 不以片段、目录、OCR 乱码或多个网络转载拼接成“全文”。
- 亡佚、口传、扫描待校和现代版权受限资料应保留书录并明确状态。
- 修改 `corpus.jsonl` 后必须运行 `npm run kb:lint`；修改引擎引文后还要运行 `npm run verify-citation`。

更多细节见 [知识库 Wiki](docs/wiki/Knowledge-Base.md)。

