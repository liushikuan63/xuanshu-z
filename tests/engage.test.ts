/** 趣味/引导数据校验：签库数量、问法模板覆盖、徽章阈值、一句人话输出 */
import { describe, it, expect } from 'vitest';
import { SIGNS, dailySign, QUESTION_TEMPLATES, BADGES, badgesEarned, nextBadge, oneLineHuman } from '../packages/ui/src/engage';

describe('趣味/引导数据', () => {
  it('每日一签：库非空，同一天签文稳定，缺签时不越界', () => {
    expect(SIGNS.length).toBeGreaterThanOrEqual(12);
    const a = dailySign(new Date(2026, 7, 31));
    const b = dailySign(new Date(2026, 7, 31));
    expect(a.title).toBe(b.title);
    expect(dailySign(new Date(2025, 0, 1))).toBeTruthy();
  });
  it('问法模板：覆盖全部 14 类事项，每类至少 2 个', () => {
    const cats = ['求财', '事业', '感情', '学业', '健康', '出行', '官非', '失物', '择日', '家宅', '生育', '合作', '决策', '其他'];
    for (const c of cats) {
      expect(QUESTION_TEMPLATES[c]).toBeTruthy();
      expect(QUESTION_TEMPLATES[c].length).toBeGreaterThanOrEqual(2);
    }
  });
  it('成就徽章：阈值递增、进度函数正确', () => {
    for (let i = 1; i < BADGES.length; i++) expect(BADGES[i].need).toBeGreaterThan(BADGES[i - 1].need);
    expect(badgesEarned(5).length).toBe(1);
    expect(badgesEarned(100).map(b => b.name)).toContain('百问不惑');
    expect(nextBadge(3650)).toBeNull();
  });
  it('一句人话：吉凶定性正确、包含首条断语、不以“。”结尾重复标点', () => {
    const r = oneLineHuman('六爻', [{ level: '吉', title: '用神旺相', fact: '用神得日辰生扶' }, { level: '吉', title: '世爻发动', fact: '世爻动而化进' }]);
    expect(r.line).toContain('用神旺相');
    expect(r.emoji.trim().length).toBeGreaterThan(0);
    expect(r.line).not.toMatch(/。。$/);
    const r2 = oneLineHuman('梅花易数', [{ level: '凶', title: '体被克', fact: '体卦受克主阻' }]);
    expect(r2.line).toContain('偏阻');
    const r3 = oneLineHuman('大六壬', []);
    expect(r3.line).toContain('无');
  });
});