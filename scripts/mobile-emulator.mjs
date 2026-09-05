#!/usr/bin/env node
/**
 * Android 模拟器一键装测：node scripts/mobile-emulator.mjs [all|sync|boot|install|start|stop|screenshot] [ld]
 *   all|sync|boot|install|start|stop|screenshot  同默认（Google emulator 或 雷电）
 *   末尾追加 "ld" 则改用雷电模拟器（LDPlayer，默认实例 0，adb 端口 5555）
 *   例：node scripts/mobile-emulator.mjs all ld
 * 依赖：D:\Android\Sdk（platform-tools/emulator/cmdline-tools）、.tools\jdk-17（JAVA_HOME）、Node
 *        雷电：E:\leidian\LDPlayer14\ldconsole.exe（若有实例）
 */
import { execSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SDK = process.env.ANDROID_HOME || 'd:/Android/Sdk';
const JDK = path.join(ROOT, '.tools', 'jdk-17.0.20.1+1');
const AVD = 'xuanshu';
const APK = path.join(ROOT, 'apps', 'mobile', 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const PKG = 'xuanshu.workbench';

const banner = (s) => console.log(`\n\x1b[36m◆ ${s}\x1b[0m`);
const q = (c) => `"${c}"`;
const env = { ...process.env, JAVA_HOME: JDK, ANDROID_HOME: SDK, ANDROID_SDK_ROOT: SDK, PATH: `${SDK}/platform-tools;${SDK}/emulator;${SDK}/cmdline-tools/latest/bin;${JDK}/bin;${process.env.PATH}` };
const run = (cmd, opts = {}) => {
  banner((opts.label ?? cmd));
  const result = spawnSync(cmd, { cwd: opts.cwd ?? ROOT, shell: true, stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`命令执行失败（退出码 ${result.status ?? '未知'}）: ${cmd}`);
};

function adbShell(script) { return execSync(`adb shell ${script}`, { env, encoding: 'utf8' }).trim(); }

function waitBoot(timeoutSec = 240) {
  banner('等待模拟器引导完成');
  const t0 = Date.now();
  while ((Date.now() - t0) < timeoutSec * 1000) {
    try { if (adbShell('getprop sys.boot_completed').includes('1')) { console.log('BOOT_COMPLETED'); return true; } } catch { /* noop */ }
    execSync('ping -n 6 127.0.0.1 >NUL'); // sleep ≈5s（timeout 在 stdio 管道下不可用）
  }
  throw new Error('模拟器引导超时');
}

function isAvd() {
  try { return execSync(`avdmanager list avd`, { env, encoding: 'utf8' }).includes(AVD); } catch { return false; }
}
function isDevice() {
  try { return execSync(`adb devices`, { env, encoding: 'utf8' }).includes('emulator-'); } catch { return false; }
}

const mode = process.argv[2] || 'all';
const useLD = process.argv.includes('ld');
const LD_CONSOLE = 'E:/leidian/LDPlayer14/ldconsole.exe';
const isLDDevice = () => { try { return execSync(`adb devices`, { env, encoding: 'utf8' }).includes('5555'); } catch { return false; } };
if (useLD && isLDDevice()) env.ANDROID_SERIAL = '127.0.0.1:5555'; // 多设备并存时统一指向雷电实例

if (mode === 'sync' || mode === 'all') {
  banner('① 构建 Web 并同步 Capacitor');
  run(`node ../../node_modules/vite/bin/vite.js build`, { cwd: path.join(ROOT, 'apps', 'web') });
  run(`npx.cmd cap sync android`, { cwd: path.join(ROOT, 'apps', 'mobile') });
  banner('② Gradle 构建 debug APK');
  run(`gradlew.bat assembleDebug --console=plain`, { cwd: path.join(ROOT, 'apps', 'mobile', 'android') });
}

if (mode === 'boot' || mode === 'all') {
  if (useLD) {
    if (!isLDDevice()) {
      banner('启动雷电模拟器（实例 0）');
      spawnSync(`"${LD_CONSOLE}" launch --index 0`, { shell: true, stdio: 'inherit' });
      execSync('ping -n 3 127.0.0.1 >NUL'); // sleep ≈2s
      try { execSync(`adb connect 127.0.0.1:5555`, { env, stdio: 'inherit' }); } catch { /* noop */ }
    } else {
      console.log('雷电设备已连接，跳过启动');
    }
    env.ANDROID_SERIAL = '127.0.0.1:5555'; // 多设备并存时，后续 adb 命令统一指向雷电实例
  } else if (!isDevice()) {
    if (!isAvd()) {
      banner('创建 AVD (xuanshu / Pixel 5 / Android 14)');
      run(`echo no | avdmanager create avd -n ${AVD} -k "system-images;android-34;google_apis;x86_64" -d pixel_5 --force`);
    }
    banner('启动模拟器（软件渲染，后台）');
    spawnSync(`emulator -avd ${AVD} -gpu swiftshader_indirect -no-audio -no-boot-anim -no-snapshot`, { shell: true, stdio: 'ignore', env, detached: true });
  } else {
    console.log('已有模拟器/设备连接，跳过启动');
  }
  waitBoot(useLD ? 120 : 240);
}

if (mode === 'install' || mode === 'all') {
  banner('③ 安装 APK 并启动应用');
  run(`adb install -r ${q(APK)}`);
  run(`adb shell am start -n ${PKG}/${PKG}.MainActivity`);
}

if (mode === 'start') run(`adb shell am start -n ${PKG}/${PKG}.MainActivity`);
if (mode === 'stop') run(`adb emu kill`);
if (mode === 'screenshot') {
  const out = path.join(ROOT, '.tmp-corpus', 'shots', 'emulator.png');
  adbShell('screencap -p /sdcard/_xuanshu.png');
  execSync(`adb pull /sdcard/_xuanshu.png ${q(out)}`, { env, stdio: 'inherit' });
  console.log(`已保存: ${out}`);
}
console.log('\n✔ 完成');
