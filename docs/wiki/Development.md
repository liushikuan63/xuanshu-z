# 开发与提交

## 常用命令

| 命令 | 用途 |
|---|---|
| `npm run dev` | Vite 开发服务器 |
| `npm run typecheck` | TypeScript 严格检查 |
| `npm test` | 全量 Vitest |
| `npm run check` | 类型、测试、引文和路径卡门禁 |
| `npm run kb:lint` | 全部语料一致性检查 |
| `npm run kb:repair` | 预览可逆语料修复 |
| `npm run kb:repair -- --write` | 明确写入可逆修复 |
| `npm run build:web` | 生产 Web 构建 |
| `npm run desktop:dist` | Electron 分发包 |

## 提交拆分

推荐依赖顺序：

1. `chore`：命令路由、忽略规则和构建基础设施。
2. `fix(core)`：排盘模型、算法与规则证据。
3. `fix(state)`：持久化、迁移与异常降级。
4. `fix(ui)`：响应式布局、可访问性和交互。
5. `feat(knowledge)`：书目、语料、来源和检索。
6. `build`：Web 分包、Electron 或 Android。
7. `docs`：README、Wiki、贡献和安全说明。

不要把生成目录、SDK、临时抓取文件或 APK 放进 Git。可发布 APK 应作为 GitHub Release 附件，不应进入源代码历史。

## 修改原则

- 优先复用现有包边界，不把业务规则塞进 React 组件。
- 新字段要考虑旧本地存储数据的合并和默认值。
- 修复算法必须增加最小回归测试。
- 书目新增必须区分“可读正文”和“相关原典”。
- UI 修改必须验证无横向溢出、无文本重叠、导航可达和触控目标稳定。

