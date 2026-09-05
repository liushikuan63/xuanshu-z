/** 城市经纬度匹配：二维最近 + 阈值，杜绝"同经度错标千里外城市"（如 青岛↔无锡） */
import { describe, it, expect } from 'vitest';
import { cityNameOf } from '../packages/ui/src/castShared';

describe('cityNameOf 经纬度匹配', () => {
  it('青岛市区西缘 (120.30,36.07) 应匹配 青岛，而非同经度的 无锡', () => {
    expect(cityNameOf(120.30, undefined, 36.07)).toBe('青岛');
  });
  it('无锡 (120.31,31.57) 应匹配 无锡', () => {
    expect(cityNameOf(120.31, undefined, 31.57)).toBe('无锡');
  });
  it('青岛市中心 (120.38,36.07) 匹配 青岛', () => {
    expect(cityNameOf(120.38, undefined, 36.07)).toBe('青岛');
  });
  it('北京 (116.41,39.9) 匹配 北京', () => {
    expect(cityNameOf(116.41, undefined, 39.9)).toBe('北京');
  });
  it('远离城市（渤海 119.0,40.5）不瞎猜，返回 null', () => {
    expect(cityNameOf(119.0, undefined, 40.5)).toBeNull();
  });
  it('无纬度时按经度窗口回退（120.31→无锡，同经度取先出现的）', () => {
    expect(cityNameOf(120.31)).toBe('无锡');
  });
  it('无纬度且经度离谱时返回 null', () => {
    expect(cityNameOf(200)).toBeNull();
  });
  it('经纬度缺失返回 null', () => {
    expect(cityNameOf(null)).toBeNull();
  });
});