import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

describe('八术产品名称', () => {
  it('Web、README、Wiki 与需求文档使用统一全称', () => {
    for (const file of ['apps/web/index.html', 'README.md', 'docs/wiki/Home.md', 'docs/requirements.md']) {
      expect(read(file), file).toContain('八术');
      expect(read(file), file).not.toContain('五术综合占卜工作台');
    }
  });

  it('Android 与桌面壳使用适合系统界面的统一短名', () => {
    expect(JSON.parse(read('apps/mobile/capacitor.config.json')).appName).toBe('玄枢八术');
    expect(read('apps/mobile/android/app/src/main/res/values/strings.xml')).toContain('玄枢八术');
    expect(read('apps/desktop/electron-builder.yml')).toContain('productName: 玄枢八术');
  });
});
