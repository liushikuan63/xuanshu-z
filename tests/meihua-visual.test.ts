import { describe, expect, it } from 'vitest';
import { trigramLinesForDisplay } from '../packages/ui/src/boards';

describe('梅花卦象爻线展示', () => {
  it('把自下而上的卦码转换为从上到下的视觉顺序', () => {
    expect(trigramLinesForDisplay('100').map(line => line.bit)).toEqual(['0', '0', '1']);
    expect(trigramLinesForDisplay('011').map(line => line.bit)).toEqual(['1', '1', '0']);
  });

  it('一组三爻只标记真实的单个动爻', () => {
    const lines = trigramLinesForDisplay('111', 0);
    expect(lines.filter(line => line.moving)).toHaveLength(1);
    expect(lines.findIndex(line => line.moving)).toBe(2);
    expect(lines[2].lineIndex).toBe(0);
  });
});
