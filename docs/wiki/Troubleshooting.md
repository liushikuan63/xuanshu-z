# 故障排查

## 开发服务器端口被占用

`npm run dev` 默认使用 5190。先关闭旧进程，或直接用 Vite 参数选择其他端口：

```bash
npm --workspace @xuanshu/web run dev -- --port 5191
```

## 页面长时间停在“正在载入离线典籍”

打开浏览器开发者工具查看失败的语料 chunk。先运行 `npm run build:web`；若构建成功，清除站点缓存后重试。不要把 86 部语料重新合并成单一入口包来掩盖问题。

## 书目显示可读但打不开

运行 `npm test -- --run tests/books.test.ts`。该测试会确认所有 `hasCorpus: true` 的 `id` 或 `corpusId` 都存在真实语料目录。

## 语料校验失败

先运行只读预览：

```bash
npm run kb:repair
```

确认只有可逆的乱码、`normalized_text` 或 `charRange` 修复后，才运行：

```bash
npm run kb:repair -- --write
npm run kb:lint
```

`□` 表示源文本中已经不可恢复的缺字，不能凭猜测补写。

## Android 构建找不到 Java 或 SDK

确认 JDK 17 和 Android SDK 34 可用。`scripts/mobile-emulator.mjs` 优先使用仓库本地 `.tools/jdk-17.0.20.1+1`，SDK 默认位于 `D:/Android/Sdk`，也可通过 `ANDROID_HOME` 指定。`local.properties` 只属于本机，不应提交。

## Gradle 构建内存不足

关闭并行构建或把 `apps/mobile/android/gradle.properties` 中的 `org.gradle.jvmargs` 调高到本机可承受范围。修改后先执行 `gradlew.bat --stop`，再重试 `assembleDebug`。

