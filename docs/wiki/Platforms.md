# Web、桌面与 Android

## 响应式布局

| 视口 | 导航 | 重点 |
|---|---|---|
| 手机 `< 700px` | 底部主导航 | 安全区、单列、44px 触控目标、无横向滚动 |
| 平板 `700-920px` | 62px 紧凑侧栏 | 隐藏底栏，图标稳定，不挤压正文 |
| 桌面 `> 920px` | 216px 完整侧栏 | 高密度信息、键鼠操作、宽表格可扫描 |

验收至少覆盖 `390×844`、`768×1024`、`1440×900`，并逐页检查首页、起卦、合参、记录、书阁、路径卡、统计、万年历和设置。

## Web

```bash
npm run dev
npm run build:web
```

生产输出在 `apps/web/dist/`。语料按书拆成异步 chunk，入口页面在应用加载前显示明确状态；加载失败会显示错误提示，而不是空白页。

## Electron

```bash
node scripts/run.mjs desktop
npm run desktop:dist
```

桌面壳启用 `contextIsolation` 与沙箱，外部链接交给系统浏览器。正式发布应在对应平台完成代码签名。

## Android

```bash
node scripts/mobile-emulator.mjs sync
```

脚本依次执行 Web 生产构建、`cap sync android` 和 `gradlew assembleDebug`。APK 位于：

```text
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

若已通过 `npm run ai:fallback:verify` 生成本机 `apps/web/.env.local`，Web 与 Android 构建会注入同一份加密 OpenRouter 保底配置；该本机文件和明文凭据都不会进入公开仓库。

当前包名为 `xuanshu.workbench`，`minSdk 22`、`targetSdk 34`。定位只在用户主动点击“当前位置”时请求，用于真太阳时和方位计算；也可完全使用手动城市选择。

Debug APK 适合本机验收，不适合商店发布。正式发布前应提升 `versionCode`，配置独立签名、备份密钥，并按目标商店当期要求复核 `targetSdk` 与隐私声明。

