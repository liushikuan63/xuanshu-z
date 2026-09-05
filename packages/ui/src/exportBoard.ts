/** 盘面导出图片：页面 foreignObject 序列化 → 裁切目标区域 → PNG。
 *  Web：触发下载；Capacitor（Android）：写入 Documents 后拉起系统分享。 */
const CAPTURE_MAX_H = 3200;

async function renderCrop(el: HTMLElement): Promise<{ dataUrl: string; w: number; h: number }> {
  const rect = el.getBoundingClientRect();
  const sx = window.scrollX, sy = window.scrollY;
  const x = Math.max(0, Math.floor(rect.left + sx));
  const y = Math.max(0, Math.floor(rect.top + sy));
  const w = Math.min(Math.ceil(rect.width), 1600);
  const h = Math.min(Math.ceil(rect.height), CAPTURE_MAX_H);
  const pageW = document.documentElement.scrollWidth;
  const pageH = Math.min(document.documentElement.scrollHeight, Math.max(y + h + 40, 900));
  const xml = new XMLSerializer().serializeToString(document.documentElement);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}" height="${pageH}"><foreignObject width="100%" height="100%">${xml}</foreignObject></svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const scale = 2;
  const cv = document.createElement('canvas');
  cv.width = w * scale; cv.height = h * scale;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = getComputedStyle(document.body).backgroundColor || '#f6f1e7';
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.drawImage(img, x, y, w, h, 0, 0, cv.width, cv.height);
  return { dataUrl: cv.toDataURL('image/png'), w: cv.width, h: cv.height };
}

/** 结册长图导出：盘面 + 断语 + （可选）AI 解读 拼成一张竖长图。
 *  临时把结册容器挂到页面顶部（不透明，覆盖上层），截取其区域后移除。 */
export async function exportAlbum(opts: {
  board: HTMLElement; title: string; sub?: string; lines?: string[]; tail?: string; filename: string;
}): Promise<string> {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;left:0;top:0;width:1080px;background:#fffdf6;color:#3b2f1e;padding:28px;z-index:99999;font-family:"Microsoft YaHei",system-ui,sans-serif;box-sizing:border-box;';
  const head = document.createElement('div');
  head.style.cssText = 'border-bottom:3px solid #caa04d;padding-bottom:12px;margin-bottom:16px;';
  head.innerHTML = `<div style="font-size:30px;font-weight:800;color:#2e2416;">${opts.title ?? '玄枢 · 排盘结册'}</div>${
    opts.sub ? `<div style="margin-top:6px;font-size:15px;color:#8a7a5c;">${String(opts.sub).replace(/</g, '&lt;')}</div>` : ''
  }<div style="margin-top:4px;font-size:13px;color:#b09a6f;">玄枢 · 八术综合占卜工作台（传统历法文化研究工具，仅供参考）</div>`;
  wrap.appendChild(head);
  const clone = opts.board.cloneNode(true) as HTMLElement;
  clone.style.width = '100%';
  clone.style.margin = '0';
  wrap.appendChild(clone);
  if (opts.lines && opts.lines.length) {
    const ul = document.createElement('div');
    ul.style.cssText = 'margin-top:16px;font-size:16px;line-height:2;color:#3b2f1e;border-top:1px dashed #d9c9a3;padding-top:12px;';
    ul.innerHTML = opts.lines.map((l, i) => `<div style="padding:3px 0;">${i + 1}. ${String(l).replace(/</g, '&lt;').split('\n').join('<br/>')}</div>`).join('');
    wrap.appendChild(ul);
  }
  if (opts.tail) {
    const t = document.createElement('div');
    t.style.cssText = 'margin-top:14px;font-size:14px;color:#5a4a30;white-space:pre-wrap;line-height:1.9;';
    t.textContent = opts.tail;
    wrap.appendChild(t);
  }
  // 半透明「玄枢」印章（D3b）：防误传 + 结册仪式感
  const stamp = document.createElement('div');
  stamp.style.cssText = 'margin-top:18px;display:flex;align-items:center;justify-content:space-between;gap:10px;';
  stamp.innerHTML =
    '<span style="border:2px solid rgba(166,63,54,.55);color:rgba(166,63,54,.8);border-radius:50%;width:58px;height:58px;display:inline-flex;align-items:center;justify-content:center;font-size:20px;font-weight:800;font-family:KaiTi,STKaiti,serif;transform:rotate(-8deg);flex:none;">玄枢</span>' +
    '<span style="flex:1;text-align:right;font-size:11.5px;color:rgba(176,154,111,.9);line-height:1.8;">已由玄枢离线推算生成 · 传统文化研究参考<br/>非医疗/投资/法律建议，请以专业人士意见为准</span>';
  wrap.appendChild(stamp);
  const foot = document.createElement('div');
  foot.style.cssText = 'margin-top:14px;font-size:12px;color:#b09a6f;text-align:center;line-height:2;';
  foot.innerHTML = '<span style="border:1.5px dashed #caa04d;border-radius:8px;padding:3px 12px;color:#b09a6f;font-size:13px;">玄枢 · 八术综合占卜工作台</span><div style="margin-top:6px;font-size:11px;color:#c9b587;">———— ' + new Date().toLocaleString() + ' 生成 ————</div>';
  wrap.appendChild(foot);
  document.body.appendChild(wrap);
  try {
    return await exportBoardImage(wrap, opts.filename);
  } finally {
    wrap.remove();
  }
}

const isNative = (): boolean => typeof (window as any).Capacitor !== 'undefined' && !!(window as any).Capacitor.isNativePlatform?.();

/** 导出：返回提示文案；永不抛错（失败降级为 toast 文案） */
export async function exportBoardImage(el: HTMLElement, filename: string): Promise<string> {
  try {
    const { dataUrl } = await renderCrop(el);
    if (isNative()) {
      const fsMod: any = await import('@capacitor/filesystem');
      const shareMod: any = await import('@capacitor/share');
      const base64 = dataUrl.split(',')[1];
      const res = await fsMod.Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: fsMod.Directory.Documents,
        encoding: undefined,
      });
      await shareMod.Share.share({ title: '玄枢盘面', url: res.uri, dialogTitle: '分享盘面图' });
      return '已生成并拉起分享';
    }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return '盘面图已保存到下载';
  } catch (e) {
    return '导出失败：' + (e instanceof Error ? e.message.slice(0, 60) : '未知错误');
  }
}
