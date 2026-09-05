#!/usr/bin/env node
/**
 * 本机一次性浏览器正文接收器。
 * 仅监听 127.0.0.1，收到一次 POST 后写入 .tmp-corpus/browser/<cid>.txt 并退出。
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cid = process.argv[2];
const port = Number(process.argv[3] ?? '18765');
if (!/^[a-z0-9-]+$/.test(cid ?? '')) throw new Error('首个参数必须是安全的 canonical_id');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('端口必须在 1024-65535 之间');

const outputDir = path.join(ROOT, '.tmp-corpus', 'browser');
const outputPath = path.join(outputDir, `${cid}.txt`);
const maxBytes = 20 * 1024 * 1024;

const page = `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><title>玄枢古籍正文采集</title>
<style>body{font:16px/1.6 system-ui;max-width:900px;margin:32px auto;padding:0 20px;color:#181818}textarea{box-sizing:border-box;width:100%;height:70vh;padding:12px;font:15px/1.5 ui-monospace,monospace}button{margin-top:12px;padding:10px 20px}#status{margin-left:12px}</style>
<h1>玄枢古籍正文采集</h1><textarea id="text" autofocus aria-label="古籍正文"></textarea>
<div><button id="save" type="button">保存正文</button><span id="status"></span></div>
<script>
save.addEventListener('click', async () => {
  save.disabled = true;
  status.textContent = '正在保存...';
  const response = await fetch('/capture', { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: text.value });
  status.textContent = response.ok ? await response.text() : '保存失败';
});
</script></html>`;

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(page);
    return;
  }
  if (request.method !== 'POST' || request.url !== '/capture') {
    response.writeHead(404).end('Not found');
    return;
  }

  const chunks = [];
  let bytes = 0;
  request.on('data', (chunk) => {
    bytes += chunk.length;
    if (bytes > maxBytes) request.destroy(new Error('正文超过 20 MiB 限制'));
    else chunks.push(chunk);
  });
  request.on('end', () => {
    const text = Buffer.concat(chunks).toString('utf8');
    if (text.trim().length < 100) {
      response.writeHead(400, { 'Content-Type': 'text/plain;charset=utf-8' }).end('正文过短，未保存');
      return;
    }
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputPath, text, 'utf8');
    response.writeHead(200, { 'Content-Type': 'text/plain;charset=utf-8' }).end(`已保存 ${text.length} 字`);
    console.log(`OK ${outputPath}：${text.length} 字`);
    response.on('finish', () => server.close());
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`READY http://127.0.0.1:${port}/ -> ${outputPath}`);
});
