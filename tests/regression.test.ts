import { describe, expect, it } from 'vitest';
import {
  computeJinkou,
  computeMeihua,
  computeXiaoliuren,
  defaultConfig,
  jinkouEvidence,
  jinkouRules,
  jingPiFor,
  stableHash,
} from '@xuanshu/core';
import { resolveCommand, SUPPORTED_COMMANDS } from '../scripts/run.mjs';

describe('已修复问题的回归保护', () => {
  it('每个公开项目命令都能解析到明确的执行目标', () => {
    for (const command of SUPPORTED_COMMANDS) {
      const resolved = resolveCommand(command);
      expect(resolved, command).not.toBeNull();
      expect(resolved?.command, command).toBeTruthy();
      expect(resolved?.args.length, command).toBeGreaterThan(0);
    }
    expect(resolveCommand('not-a-command')).toBeNull();
    expect(resolveCommand('doctor')?.args[0]).toMatch(/doctor\.mjs$/);
    expect(resolveCommand('build:web')?.args).toContain('build');
    expect(resolveCommand('ai:fallback:verify')?.args).toContain('--verify');
  });

  it('奇门精批沿用盘面的阳遁标识', () => {
    const result = jingPiFor('qimen', {
      yinYang: '阳遁', ju: 1, juMethod: 'chaibu', panType: 'zhuan',
      timeType: 'shi', zhifuStar: '天蓬', zhifuGate: '休门', xunShou: '甲子戊',
      cells: [], patterns: [],
    } as never);
    expect(result.headline).toContain('阳遁1局');
    expect(result.headline).not.toContain('阴遁');
  });

  it('小六壬下午时辰不再输出 undefined', () => {
    const config = defaultConfig();
    const chart = computeXiaoliuren({ time: { year: 2026, month: 9, day: 5, hour: 15, minute: 0 } }, config, stableHash(config));
    expect(chart.step).toContain('申时');
    expect(chart.step).not.toContain('undefined');
  });

  it('梅花盘提供本互变错综完整卦名', () => {
    const config = defaultConfig();
    const chart = computeMeihua(
      { method: 'numbers', numbers: [34, 43], time: { year: 2026, month: 9, day: 5, hour: 15, minute: 0 } },
      config, stableHash(config),
    );
    expect([chart.guaName, chart.huGuaName, chart.bianGuaName, chart.cuoGuaName, chart.xzGuaName]).not.toContain('未知');
  });

  it('金口诀四位生克属于规则命中，不混入引文证据', () => {
    const config = defaultConfig();
    const chart = computeJinkou(
      { time: { year: 2026, month: 9, day: 5, hour: 15, minute: 0 } },
      config, stableHash(config),
    );
    const rules = jinkouRules(chart);
    expect(rules.some(rule => rule.ruleId === 'jinkou.siwei.rel')).toBe(true);
    expect(jinkouEvidence(chart, rules)).toEqual([]);
  });
});
