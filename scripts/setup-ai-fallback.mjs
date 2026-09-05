import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = path.join(ROOT, 'apps', 'web', '.env.local');
const MANAGED_NAMES = ['VITE_AI_FALLBACK_CIPHER', 'VITE_AI_FALLBACK_WRAP_KEY'];

function replaceManagedValues(current, values) {
  const unmanaged = current
    .split(/\r?\n/)
    .filter(line => !MANAGED_NAMES.some(name => line.startsWith(`${name}=`)))
    .filter((line, index, lines) => line || (index > 0 && index < lines.length - 1));
  const managed = MANAGED_NAMES.map(name => `${name}=${values[name]}`);
  return [...unmanaged, ...managed, ''].join('\n');
}

async function verifyOpenRouter(key) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'X-Title': 'Xuanshu local fallback verification',
    },
    body: JSON.stringify({
      model: 'openrouter/free',
      messages: [{ role: 'user', content: 'Reply with OK only.' }],
      max_tokens: 128,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw new Error(`OpenRouter 实际调用失败（HTTP ${response.status}）`);
  const data = await response.json();
  if (data?.error) throw new Error('OpenRouter 返回了应用层错误');
  if (!data?.choices?.[0]?.message?.content) throw new Error('OpenRouter 返回成功，但没有可用的回复内容');
  return typeof data.model === 'string' ? data.model : 'openrouter/free';
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const current = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';

  if (args.has('--clear')) {
    const clean = replaceManagedValues(current, Object.fromEntries(MANAGED_NAMES.map(name => [name, ''])))
      .split(/\r?\n/)
      .filter(line => !MANAGED_NAMES.some(name => line.startsWith(`${name}=`)))
      .join('\n');
    fs.writeFileSync(ENV_FILE, clean, { encoding: 'utf8', mode: 0o600 });
    console.log('已从本机 .env.local 移除 AI 保底配置。');
    return;
  }

  const key = process.env.OPENROUTER_API_KEY?.trim() ?? '';
  const expectedPrefix = `${['sk', 'or', 'v1'].join('-')}-`;
  if (!key.startsWith(expectedPrefix) || key.length < expectedPrefix.length + 24) {
    throw new Error('请通过进程环境变量 OPENROUTER_API_KEY 提供有效凭据；不要把凭据写入命令参数或源码。');
  }

  const verifiedModel = args.has('--verify') ? await verifyOpenRouter(key) : '';

  const wrapKey = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', wrapKey, iv);
  const encrypted = Buffer.concat([cipher.update(key, 'utf8'), cipher.final()]);
  const payload = Buffer.concat([iv, encrypted, cipher.getAuthTag()]);
  const content = replaceManagedValues(current, {
    VITE_AI_FALLBACK_CIPHER: payload.toString('base64url'),
    VITE_AI_FALLBACK_WRAP_KEY: wrapKey.toString('base64url'),
  });
  fs.writeFileSync(ENV_FILE, content, { encoding: 'utf8', mode: 0o600 });
  process.env.OPENROUTER_API_KEY = '';
  console.log(`已生成本机加密 AI 保底配置：${path.relative(ROOT, ENV_FILE)}`);
  if (verifiedModel) console.log(`OpenRouter 保底模型实际调用验证成功：${verifiedModel}`);
}

main().catch(error => {
  process.env.OPENROUTER_API_KEY = '';
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
