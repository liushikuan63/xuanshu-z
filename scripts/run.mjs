/** 项目统一命令入口：node scripts/run.mjs [command] [...args] */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const banner = (s) => console.log(`\n\x1b[36m◆ ${s}\x1b[0m`);
const nodeScript = (file, args, label) => ({
  command: process.execPath,
  args: [path.join(ROOT, 'scripts', file), ...args],
  cwd: ROOT,
  label,
});

/** 导出纯解析函数，便于测试每个 npm script 是否真的路由到目标命令。 */
export function resolveCommand(mode = 'web', args = []) {
  switch (mode) {
    case 'web':
    case 'dev':
      return { command: NPM, args: ['run', 'dev', '--workspace', '@xuanshu/web', '--', ...args], cwd: ROOT, label: '启动 Web 工作台 http://localhost:5190' };
    case 'desktop':
      return { command: NPM, args: ['run', 'dev', '--workspace', '@xuanshu/desktop', '--', ...args], cwd: ROOT, label: '启动桌面端（需先启动 Web，或先构建 Web）' };
    case 'test':
      return { command: NPM, args: ['exec', 'vitest', '--', 'run', ...args], cwd: ROOT, label: '运行 vitest 全量测试' };
    case 'typecheck':
      return { command: NPM, args: ['exec', 'tsc', '--', '--noEmit', ...args], cwd: ROOT, label: '运行 TypeScript 严格检查' };
    case 'install':
      return { command: NPM, args: ['install', ...args], cwd: ROOT, label: '安装全部 workspace 依赖' };
    case 'build:web':
      return { command: NPM, args: ['run', 'build', '--workspace', '@xuanshu/web', '--', ...args], cwd: ROOT, label: '构建 Web 生产包' };
    case 'desktop:dist':
      return { command: NPM, args: ['run', 'dist', '--workspace', '@xuanshu/desktop', '--', ...args], cwd: ROOT, label: '构建桌面安装包' };
    case 'doctor': return nodeScript('doctor.mjs', args, '运行环境体检');
    case 'verify-citation': return nodeScript('verify-citation.mjs', args, '校验引擎引用');
    case 'verify-playbook': return nodeScript('verify-playbook.mjs', args, '校验断事路径卡');
    case 'verify-secrets': return nodeScript('verify-secrets.mjs', args, '检查 Git 跟踪文件中的明文凭据');
    case 'ai:fallback:setup': return nodeScript('setup-ai-fallback.mjs', args, '生成本机加密 AI 保底配置');
    case 'ai:fallback:verify': return nodeScript('setup-ai-fallback.mjs', ['--verify', ...args], '生成并实测本机加密 AI 保底配置');
    case 'kb:lint': return nodeScript('kb-lint.mjs', args, '校验知识库语料');
    case 'kb:repair': return nodeScript('repair-corpus.mjs', args, '修复知识库派生字段');
    case 'cal': return nodeScript('daily-advice.mjs', args, '生成每日建议');
    default: return null;
  }
}

export const SUPPORTED_COMMANDS = [
  'web', 'dev', 'desktop', 'test', 'typecheck', 'install', 'build:web',
  'desktop:dist', 'doctor', 'verify-citation', 'verify-playbook', 'verify-secrets',
  'ai:fallback:setup', 'ai:fallback:verify', 'kb:lint', 'kb:repair', 'cal',
];

function run() {
  const mode = process.argv[2] || 'web';
  if (mode === '--help' || mode === '-h') {
    console.log(`用法: node scripts/run.mjs <command> [...args]\n命令: ${SUPPORTED_COMMANDS.join(', ')}`);
    return;
  }
  const spec = resolveCommand(mode, process.argv.slice(3));
  if (!spec) {
    console.error(`未知命令: ${mode}\n可用命令: ${SUPPORTED_COMMANDS.join(', ')}`);
    process.exitCode = 1;
    return;
  }
  banner(spec.label);
  const child = spawn(spec.command, spec.args, {
    cwd: spec.cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32' && spec.command === NPM,
  });
  child.once('error', (error) => {
    console.error(`命令启动失败: ${error.message}`);
    process.exitCode = 1;
  });
  child.once('exit', (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) run();
