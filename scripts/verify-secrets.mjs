import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const patterns = [
  {
    label: 'OpenRouter API Key',
    regex: new RegExp(`\\b${['sk', 'or', 'v1'].join('-')}-[A-Za-z0-9_-]{24,}\\b`),
  },
  { label: 'GitHub Token', regex: /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/ },
  { label: 'Private Key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
];

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT })
  .toString('utf8')
  .split('\0')
  .filter(Boolean);
const findings = [];

for (const relative of tracked) {
  const absolute = path.join(ROOT, relative);
  if (!fs.existsSync(absolute) || fs.statSync(absolute).size > 8 * 1024 * 1024) continue;
  const buffer = fs.readFileSync(absolute);
  if (buffer.includes(0)) continue;
  const content = buffer.toString('utf8');
  for (const pattern of patterns) {
    if (pattern.regex.test(content)) findings.push(`${relative}: ${pattern.label}`);
  }
}

if (findings.length) {
  console.error(`检测到 ${findings.length} 处疑似凭据：`);
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(`凭据检查通过：${tracked.length} 个 Git 跟踪文件未发现已知明文凭据。`);
}
