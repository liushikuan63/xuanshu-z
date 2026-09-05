/** 排盘共享层：向导与专业模式共用（runCast 纯调度，无 UI） */
import {
  computeBazi, computeLiuyao, computeMeihua, computeZiwei, computeQimen, computeLiuren, computeXiaoliuren, computeJinkou,
  computeQimenDay, qimenDayRules, qimenDayBoard, qimenDayEvidence, qimenDayTiming, qimenDayFacts, qimenDayWarnings,
  liuyaoRules, baziRules, meihuaRules, ziweiRules, qimenRules, liurenRules, xiaoliurenRules, jinkouRules,
  liuyaoBoard, baziBoard, meihuaBoard, ziweiBoard, qimenBoard, liurenBoard, xiaoliurenBoard, jinkouBoard,
  liuyaoEvidence, baziEvidence, meihuaEvidence, ziweiEvidence, qimenEvidence, liurenEvidence, xiaoliurenEvidence, jinkouEvidence,
  liuyaoTiming, meihuaTiming, ziweiTiming, qimenTiming, liurenTiming, xiaoliurenTiming, jinkouTiming,
  liuyaoFacts, meihuaFacts, ziweiFacts, qimenFacts, liurenFacts, xiaoliurenFacts, jinkouFacts,
  stableHash, defaultConfig,
  type ArtType, type RawInput, type RuleHit, type BoardSpec, type CitationRef, type TimingCandidate, type FactBundle, type Warning,
} from '@xuanshu/core';

export type AnyChart = unknown;

export interface CastResult {
  chart: AnyChart; rules: RuleHit[]; board: BoardSpec; evidence: CitationRef[];
  timing: TimingCandidate[]; facts: FactBundle; warnings: Warning[];
}

export function runCast(art: ArtType, input: RawInput, cfg: ReturnType<typeof defaultConfig>): CastResult {
  const hash = stableHash(cfg);
  switch (art) {
    case 'bazi': { const c = computeBazi(input, cfg, hash); return { chart: c, rules: baziRules(c, cfg), board: baziBoard(c, cfg), evidence: baziEvidence(c, baziRules(c, cfg)), timing: [], facts: baziFactsWeb(c), warnings: [] }; }
    case 'liuyao': { const c = computeLiuyao(input, cfg, hash); return { chart: c, rules: liuyaoRules(c), board: liuyaoBoard(c), evidence: liuyaoEvidence(c, liuyaoRules(c)), timing: liuyaoTiming(c), facts: liuyaoFacts(c, cfg.category), warnings: [] }; }
    case 'meihua': { const c = computeMeihua(input, cfg, hash); return { chart: c, rules: meihuaRules(c), board: meihuaBoard(c), evidence: meihuaEvidence(c, meihuaRules(c)), timing: meihuaTiming(c), facts: meihuaFacts(c, cfg.category), warnings: [] }; }
    case 'ziwei': { const degraded = !!input.hourMissing && !!input.allowHourMissingFallback; const c = computeZiwei(input, cfg, hash, degraded); return { chart: c, rules: ziweiRules(c), board: ziweiBoard(c), evidence: ziweiEvidence(c, ziweiRules(c)), timing: ziweiTiming(c), facts: ziweiFacts(c, cfg.category), warnings: [] }; }
    case 'qimen': {
      if ((cfg.paipan?.qimenTimeType ?? 'shi') === 'ri') {
        const c = computeQimenDay(input, cfg, hash);
        const rules = qimenDayRules(c, cfg);
        return { chart: c, rules, board: qimenDayBoard(c), evidence: qimenDayEvidence(c, rules), timing: qimenDayTiming(c), facts: qimenDayFacts(c, cfg.category), warnings: qimenDayWarnings(c) };
      }
      const c = computeQimen(input, cfg, hash); return { chart: c, rules: qimenRules(c), board: qimenBoard(c), evidence: qimenEvidence(c, qimenRules(c)), timing: qimenTiming(c), facts: qimenFacts(c, cfg.category), warnings: [] };
    }
    case 'liuren': { const c = computeLiuren(input, cfg, hash); return { chart: c, rules: liurenRules(c), board: liurenBoard(c), evidence: liurenEvidence(c, liurenRules(c)), timing: liurenTiming(c), facts: liurenFacts(c, cfg.category), warnings: [] }; }
    case 'xiaoliuren': { const c = computeXiaoliuren(input, cfg, hash); return { chart: c, rules: xiaoliurenRules(c), board: xiaoliurenBoard(c), evidence: xiaoliurenEvidence(c, xiaoliurenRules(c)), timing: xiaoliurenTiming(c), facts: xiaoliurenFacts(c, cfg.category), warnings: [] }; }
    case 'jinkou': { const c = computeJinkou(input, cfg, hash); return { chart: c, rules: jinkouRules(c), board: jinkouBoard(c), evidence: jinkouEvidence(c, jinkouRules(c)), timing: jinkouTiming(c), facts: jinkouFacts(c, cfg.category), warnings: [] }; }
  }
}

export function baziFactsWeb(c: ReturnType<typeof computeBazi>): FactBundle {
  return { facts: [
    { key: 'pillars', label: '四柱', value: c.pillars.map(p => p.gz).join(' ') },
    { key: 'yongshen', label: '用神', value: `${c.yongShen.primary}（${c.yongShen.method}）` },
    { key: 'wangshuai', label: '旺衰', value: `${c.strength}（同党 ${c.selfRatio}%）` },
    { key: 'geju', label: '格局', value: c.geju },
  ] as never };
}

/** 当前系统时间（offsetMin=校准偏移分钟，正=系统比标准快 → 起卦时间相应提前；用于纠错系统时间不准） */
export const nowParts = (offsetMin = 0) => {
  const d = new Date(Date.now() + (offsetMin || 0) * 60000);
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), minute: d.getMinutes() };
};

/** 按配置的时间校准偏移取"当前时刻"：起卦/排盘统一走这里，避免系统时间错误导致排盘错位 */
export function calibNow(cfg?: { calendar?: { timeOffsetMin?: number } } | null): { year: number; month: number; day: number; hour: number; minute: number } {
  return nowParts(cfg?.calendar?.timeOffsetMin ?? 0);
}

/** 供时间校对条/起卦栏展示的时刻文本：YYYY-MM-DD HH:mm */
export const fmtClock = (p: { year: number; month: number; day: number; hour: number; minute: number }) =>
  `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')} ${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`

/** 全国主要城市坐标表（东经 lng + 北纬 lat?，供真太阳时换算/城市匹配）；p=省份/直辖市/自治区/特别行政区，供筛选分组 */
export const CITY_LONGS: Array<{ n: string; lng: number; p: string; lat?: number }> = [
  // 直辖市
  { n: '北京', lng: 116.41, p: '北京' }, { n: '天津', lng: 117.20, p: '天津' }, { n: '上海', lng: 121.47, p: '上海' }, { n: '重庆', lng: 106.55, p: '重庆' },
  // 河北
  { n: '石家庄', lng: 114.51, p: '河北' }, { n: '唐山', lng: 118.18, p: '河北' }, { n: '秦皇岛', lng: 119.60, p: '河北' }, { n: '邯郸', lng: 114.54, p: '河北' },
  { n: '保定', lng: 115.46, p: '河北' }, { n: '张家口', lng: 114.88, p: '河北' }, { n: '承德', lng: 117.96, p: '河北' }, { n: '沧州', lng: 116.84, p: '河北' },
  { n: '廊坊', lng: 116.68, p: '河北' }, { n: '邢台', lng: 114.50, p: '河北' },
  // 山西
  { n: '太原', lng: 112.55, p: '山西' }, { n: '大同', lng: 113.30, p: '山西' }, { n: '阳泉', lng: 113.58, p: '山西' }, { n: '长治', lng: 113.12, p: '山西' },
  { n: '晋城', lng: 112.85, p: '山西' }, { n: '朔州', lng: 112.43, p: '山西' }, { n: '晋中', lng: 112.75, p: '山西' }, { n: '运城', lng: 111.00, p: '山西' },
  { n: '忻州', lng: 112.73, p: '山西' }, { n: '临汾', lng: 111.52, p: '山西' }, { n: '吕梁', lng: 111.14, p: '山西' },
  // 内蒙古
  { n: '呼和浩特', lng: 111.75, p: '内蒙古' }, { n: '包头', lng: 109.84, p: '内蒙古' }, { n: '乌海', lng: 106.79, p: '内蒙古' }, { n: '赤峰', lng: 118.89, p: '内蒙古' },
  { n: '通辽', lng: 122.24, p: '内蒙古' }, { n: '鄂尔多斯', lng: 109.78, p: '内蒙古' }, { n: '呼伦贝尔', lng: 119.77, p: '内蒙古' }, { n: '巴彦淖尔', lng: 107.39, p: '内蒙古' },
  { n: '乌兰察布', lng: 113.13, p: '内蒙古' },
  // 辽宁
  { n: '沈阳', lng: 123.43, p: '辽宁' }, { n: '大连', lng: 121.61, p: '辽宁' }, { n: '鞍山', lng: 122.99, p: '辽宁' }, { n: '抚顺', lng: 123.96, p: '辽宁' },
  { n: '本溪', lng: 123.77, p: '辽宁' }, { n: '丹东', lng: 124.38, p: '辽宁' }, { n: '锦州', lng: 121.13, p: '辽宁' }, { n: '营口', lng: 122.23, p: '辽宁' },
  { n: '阜新', lng: 121.67, p: '辽宁' }, { n: '辽阳', lng: 123.17, p: '辽宁' }, { n: '盘锦', lng: 122.07, p: '辽宁' }, { n: '铁岭', lng: 123.84, p: '辽宁' },
  { n: '朝阳', lng: 120.45, p: '辽宁' }, { n: '葫芦岛', lng: 120.84, p: '辽宁' },
  // 吉林
  { n: '长春', lng: 125.32, p: '吉林' }, { n: '吉林市', lng: 126.55, p: '吉林' }, { n: '四平', lng: 124.35, p: '吉林' }, { n: '辽源', lng: 125.14, p: '吉林' },
  { n: '通化', lng: 125.94, p: '吉林' }, { n: '白山', lng: 126.42, p: '吉林' }, { n: '松原', lng: 124.82, p: '吉林' }, { n: '白城', lng: 122.84, p: '吉林' },
  { n: '延吉', lng: 129.51, p: '吉林' },
  // 黑龙江
  { n: '哈尔滨', lng: 126.53, p: '黑龙江' }, { n: '齐齐哈尔', lng: 123.96, p: '黑龙江' }, { n: '鸡西', lng: 130.97, p: '黑龙江' }, { n: '鹤岗', lng: 130.28, p: '黑龙江' },
  { n: '双鸭山', lng: 131.16, p: '黑龙江' }, { n: '大庆', lng: 125.10, p: '黑龙江' }, { n: '伊春', lng: 128.84, p: '黑龙江' }, { n: '佳木斯', lng: 130.32, p: '黑龙江' },
  { n: '牡丹江', lng: 129.63, p: '黑龙江' }, { n: '黑河', lng: 127.53, p: '黑龙江' }, { n: '绥化', lng: 126.99, p: '黑龙江' },
  // 江苏
  { n: '南京', lng: 118.80, p: '江苏' }, { n: '无锡', lng: 120.31, p: '江苏' }, { n: '徐州', lng: 117.19, p: '江苏' }, { n: '常州', lng: 119.97, p: '江苏' },
  { n: '苏州', lng: 120.62, p: '江苏' }, { n: '南通', lng: 120.86, p: '江苏' }, { n: '连云港', lng: 119.22, p: '江苏' }, { n: '淮安', lng: 119.02, p: '江苏' },
  { n: '盐城', lng: 120.16, p: '江苏' }, { n: '扬州', lng: 119.41, p: '江苏' }, { n: '镇江', lng: 119.45, p: '江苏' }, { n: '泰州', lng: 119.92, p: '江苏' },
  { n: '宿迁', lng: 118.28, p: '江苏' },
  // 浙江
  { n: '杭州', lng: 120.15, p: '浙江' }, { n: '宁波', lng: 121.55, p: '浙江' }, { n: '温州', lng: 120.70, p: '浙江' }, { n: '嘉兴', lng: 120.76, p: '浙江' },
  { n: '湖州', lng: 120.09, p: '浙江' }, { n: '绍兴', lng: 120.58, p: '浙江' }, { n: '金华', lng: 119.65, p: '浙江' }, { n: '衢州', lng: 118.87, p: '浙江' },
  { n: '舟山', lng: 122.21, p: '浙江' }, { n: '台州', lng: 121.42, p: '浙江' }, { n: '丽水', lng: 119.92, p: '浙江' },
  // 安徽
  { n: '合肥', lng: 117.23, p: '安徽' }, { n: '芜湖', lng: 118.43, p: '安徽' }, { n: '蚌埠', lng: 117.39, p: '安徽' }, { n: '淮南', lng: 116.99, p: '安徽' },
  { n: '马鞍山', lng: 118.51, p: '安徽' }, { n: '淮北', lng: 116.80, p: '安徽' }, { n: '铜陵', lng: 117.81, p: '安徽' }, { n: '安庆', lng: 117.05, p: '安徽' },
  { n: '黄山', lng: 118.34, p: '安徽' }, { n: '滁州', lng: 118.32, p: '安徽' }, { n: '阜阳', lng: 115.81, p: '安徽' }, { n: '宿州', lng: 116.98, p: '安徽' },
  { n: '六安', lng: 116.52, p: '安徽' }, { n: '亳州', lng: 115.78, p: '安徽' }, { n: '池州', lng: 117.49, p: '安徽' }, { n: '宣城', lng: 118.76, p: '安徽' },
  // 福建
  { n: '福州', lng: 119.30, p: '福建' }, { n: '厦门', lng: 118.09, p: '福建' }, { n: '莆田', lng: 119.01, p: '福建' }, { n: '三明', lng: 117.64, p: '福建' },
  { n: '泉州', lng: 118.68, p: '福建' }, { n: '漳州', lng: 117.65, p: '福建' }, { n: '南平', lng: 118.18, p: '福建' }, { n: '龙岩', lng: 117.02, p: '福建' },
  { n: '宁德', lng: 119.55, p: '福建' },
  // 江西
  { n: '南昌', lng: 115.86, p: '江西' }, { n: '景德镇', lng: 117.21, p: '江西' }, { n: '萍乡', lng: 113.85, p: '江西' }, { n: '九江', lng: 115.99, p: '江西' },
  { n: '新余', lng: 114.92, p: '江西' }, { n: '鹰潭', lng: 117.07, p: '江西' }, { n: '赣州', lng: 114.94, p: '江西' }, { n: '吉安', lng: 114.99, p: '江西' },
  { n: '宜春', lng: 114.39, p: '江西' }, { n: '抚州', lng: 116.36, p: '江西' }, { n: '上饶', lng: 117.94, p: '江西' },
  // 山东
  { n: '济南', lng: 117.00, p: '山东' }, { n: '青岛', lng: 120.38, p: '山东' }, { n: '淄博', lng: 117.97, p: '山东' }, { n: '枣庄', lng: 117.32, p: '山东' },
  { n: '东营', lng: 118.67, p: '山东' }, { n: '烟台', lng: 121.45, p: '山东' }, { n: '潍坊', lng: 119.16, p: '山东' }, { n: '济宁', lng: 116.59, p: '山东' },
  { n: '泰安', lng: 117.09, p: '山东' }, { n: '威海', lng: 122.12, p: '山东' }, { n: '日照', lng: 119.53, p: '山东' }, { n: '临沂', lng: 118.36, p: '山东' },
  { n: '德州', lng: 116.36, p: '山东' }, { n: '聊城', lng: 115.99, p: '山东' }, { n: '滨州', lng: 117.97, p: '山东' }, { n: '菏泽', lng: 115.48, p: '山东' },
  // 河南
  { n: '郑州', lng: 113.63, p: '河南' }, { n: '开封', lng: 114.31, p: '河南' }, { n: '洛阳', lng: 112.45, p: '河南' }, { n: '平顶山', lng: 113.19, p: '河南' },
  { n: '安阳', lng: 114.39, p: '河南' }, { n: '鹤壁', lng: 114.30, p: '河南' }, { n: '新乡', lng: 113.93, p: '河南' }, { n: '焦作', lng: 113.24, p: '河南' },
  { n: '濮阳', lng: 115.03, p: '河南' }, { n: '许昌', lng: 113.85, p: '河南' }, { n: '漯河', lng: 114.02, p: '河南' }, { n: '三门峡', lng: 111.19, p: '河南' },
  { n: '南阳', lng: 112.53, p: '河南' }, { n: '商丘', lng: 115.66, p: '河南' }, { n: '信阳', lng: 114.09, p: '河南' }, { n: '周口', lng: 114.65, p: '河南' },
  { n: '驻马店', lng: 114.02, p: '河南' },
  // 湖北
  { n: '武汉', lng: 114.31, p: '湖北' }, { n: '黄石', lng: 115.04, p: '湖北' }, { n: '十堰', lng: 110.80, p: '湖北' }, { n: '宜昌', lng: 111.29, p: '湖北' },
  { n: '襄阳', lng: 112.14, p: '湖北' }, { n: '鄂州', lng: 114.89, p: '湖北' }, { n: '荆门', lng: 112.20, p: '湖北' }, { n: '孝感', lng: 113.92, p: '湖北' },
  { n: '荆州', lng: 112.24, p: '湖北' }, { n: '黄冈', lng: 114.87, p: '湖北' }, { n: '咸宁', lng: 114.32, p: '湖北' }, { n: '随州', lng: 113.38, p: '湖北' },
  { n: '恩施', lng: 109.49, p: '湖北' },
  // 湖南
  { n: '长沙', lng: 112.94, p: '湖南' }, { n: '株洲', lng: 113.13, p: '湖南' }, { n: '湘潭', lng: 112.94, p: '湖南' }, { n: '衡阳', lng: 112.57, p: '湖南' },
  { n: '邵阳', lng: 111.47, p: '湖南' }, { n: '岳阳', lng: 113.13, p: '湖南' }, { n: '常德', lng: 111.70, p: '湖南' }, { n: '张家界', lng: 110.48, p: '湖南' },
  { n: '益阳', lng: 112.36, p: '湖南' }, { n: '郴州', lng: 113.01, p: '湖南' }, { n: '永州', lng: 111.61, p: '湖南' }, { n: '怀化', lng: 110.00, p: '湖南' },
  { n: '娄底', lng: 111.99, p: '湖南' }, { n: '吉首', lng: 109.74, p: '湖南' },
  // 广东
  { n: '广州', lng: 113.26, p: '广东' }, { n: '深圳', lng: 114.06, p: '广东' }, { n: '珠海', lng: 113.58, p: '广东' }, { n: '汕头', lng: 116.68, p: '广东' },
  { n: '佛山', lng: 113.12, p: '广东' }, { n: '韶关', lng: 113.60, p: '广东' }, { n: '湛江', lng: 110.36, p: '广东' }, { n: '肇庆', lng: 112.47, p: '广东' },
  { n: '江门', lng: 113.08, p: '广东' }, { n: '茂名', lng: 110.93, p: '广东' }, { n: '惠州', lng: 114.42, p: '广东' }, { n: '梅州', lng: 116.12, p: '广东' },
  { n: '汕尾', lng: 115.38, p: '广东' }, { n: '河源', lng: 114.70, p: '广东' }, { n: '阳江', lng: 111.98, p: '广东' }, { n: '清远', lng: 113.06, p: '广东' },
  { n: '东莞', lng: 113.75, p: '广东' }, { n: '中山', lng: 113.39, p: '广东' }, { n: '潮州', lng: 116.62, p: '广东' }, { n: '揭阳', lng: 116.37, p: '广东' },
  { n: '云浮', lng: 112.04, p: '广东' },
  // 广西
  { n: '南宁', lng: 108.32, p: '广西' }, { n: '柳州', lng: 109.42, p: '广西' }, { n: '桂林', lng: 110.29, p: '广西' }, { n: '梧州', lng: 111.28, p: '广西' },
  { n: '北海', lng: 109.12, p: '广西' }, { n: '防城港', lng: 108.35, p: '广西' }, { n: '钦州', lng: 108.65, p: '广西' }, { n: '贵港', lng: 109.60, p: '广西' },
  { n: '玉林', lng: 110.18, p: '广西' }, { n: '百色', lng: 106.62, p: '广西' }, { n: '贺州', lng: 111.55, p: '广西' }, { n: '河池', lng: 108.09, p: '广西' },
  { n: '来宾', lng: 109.22, p: '广西' }, { n: '崇左', lng: 107.36, p: '广西' },
  // 海南
  { n: '海口', lng: 110.20, p: '海南' }, { n: '三亚', lng: 109.51, p: '海南' }, { n: '儋州', lng: 109.58, p: '海南' },
  // 四川
  { n: '成都', lng: 104.07, p: '四川' }, { n: '自贡', lng: 104.78, p: '四川' }, { n: '攀枝花', lng: 101.72, p: '四川' }, { n: '泸州', lng: 105.44, p: '四川' },
  { n: '德阳', lng: 104.40, p: '四川' }, { n: '绵阳', lng: 104.68, p: '四川' }, { n: '广元', lng: 105.84, p: '四川' }, { n: '遂宁', lng: 105.59, p: '四川' },
  { n: '内江', lng: 105.06, p: '四川' }, { n: '乐山', lng: 103.77, p: '四川' }, { n: '南充', lng: 106.08, p: '四川' }, { n: '眉山', lng: 103.83, p: '四川' },
  { n: '宜宾', lng: 104.64, p: '四川' }, { n: '广安', lng: 106.63, p: '四川' }, { n: '达州', lng: 107.47, p: '四川' }, { n: '雅安', lng: 103.04, p: '四川' },
  { n: '巴中', lng: 106.75, p: '四川' }, { n: '资阳', lng: 104.63, p: '四川' }, { n: '西昌', lng: 102.26, p: '四川' },
  // 贵州
  { n: '贵阳', lng: 106.63, p: '贵州' }, { n: '六盘水', lng: 104.83, p: '贵州' }, { n: '遵义', lng: 106.93, p: '贵州' }, { n: '安顺', lng: 105.95, p: '贵州' },
  { n: '毕节', lng: 105.28, p: '贵州' }, { n: '铜仁', lng: 109.18, p: '贵州' }, { n: '凯里', lng: 107.98, p: '贵州' }, { n: '兴义', lng: 104.90, p: '贵州' },
  // 云南
  { n: '昆明', lng: 102.83, p: '云南' }, { n: '曲靖', lng: 103.80, p: '云南' }, { n: '玉溪', lng: 102.55, p: '云南' }, { n: '保山', lng: 99.17, p: '云南' },
  { n: '昭通', lng: 103.72, p: '云南' }, { n: '丽江', lng: 100.23, p: '云南' }, { n: '普洱', lng: 100.97, p: '云南' }, { n: '临沧', lng: 100.09, p: '云南' },
  { n: '大理', lng: 100.23, p: '云南' }, { n: '楚雄', lng: 101.55, p: '云南' }, { n: '蒙自', lng: 103.39, p: '云南' }, { n: '文山', lng: 104.24, p: '云南' },
  { n: '景洪', lng: 100.80, p: '云南' }, { n: '香格里拉', lng: 99.70, p: '云南' },
  // 西藏
  { n: '拉萨', lng: 91.14, p: '西藏' }, { n: '日喀则', lng: 88.88, p: '西藏' }, { n: '昌都', lng: 97.17, p: '西藏' }, { n: '林芝', lng: 94.36, p: '西藏' },
  { n: '山南', lng: 91.77, p: '西藏' }, { n: '那曲', lng: 92.05, p: '西藏' },
  // 陕西
  { n: '西安', lng: 108.94, p: '陕西' }, { n: '铜川', lng: 108.95, p: '陕西' }, { n: '宝鸡', lng: 107.24, p: '陕西' }, { n: '咸阳', lng: 108.71, p: '陕西' },
  { n: '渭南', lng: 109.51, p: '陕西' }, { n: '延安', lng: 109.49, p: '陕西' }, { n: '汉中', lng: 107.03, p: '陕西' }, { n: '榆林', lng: 109.75, p: '陕西' },
  { n: '安康', lng: 109.03, p: '陕西' }, { n: '商洛', lng: 109.94, p: '陕西' },
  // 甘肃
  { n: '兰州', lng: 103.83, p: '甘肃' }, { n: '嘉峪关', lng: 98.29, p: '甘肃' }, { n: '金昌', lng: 102.19, p: '甘肃' }, { n: '白银', lng: 104.14, p: '甘肃' },
  { n: '天水', lng: 105.72, p: '甘肃' }, { n: '武威', lng: 102.64, p: '甘肃' }, { n: '张掖', lng: 100.45, p: '甘肃' }, { n: '平凉', lng: 106.68, p: '甘肃' },
  { n: '酒泉', lng: 98.49, p: '甘肃' }, { n: '庆阳', lng: 107.64, p: '甘肃' }, { n: '定西', lng: 104.63, p: '甘肃' }, { n: '陇南', lng: 104.92, p: '甘肃' },
  { n: '临夏', lng: 103.21, p: '甘肃' },
  // 青海
  { n: '西宁', lng: 101.78, p: '青海' }, { n: '海东', lng: 102.10, p: '青海' }, { n: '格尔木', lng: 94.90, p: '青海' }, { n: '玉树', lng: 97.01, p: '青海' },
  { n: '德令哈', lng: 97.37, p: '青海' },
  // 宁夏
  { n: '银川', lng: 106.23, p: '宁夏' }, { n: '石嘴山', lng: 106.38, p: '宁夏' }, { n: '吴忠', lng: 106.20, p: '宁夏' }, { n: '固原', lng: 106.24, p: '宁夏' },
  { n: '中卫', lng: 105.19, p: '宁夏' },
  // 新疆
  { n: '乌鲁木齐', lng: 87.62, p: '新疆' }, { n: '克拉玛依', lng: 84.87, p: '新疆' }, { n: '吐鲁番', lng: 89.19, p: '新疆' }, { n: '哈密', lng: 93.51, p: '新疆' },
  { n: '昌吉', lng: 87.30, p: '新疆' }, { n: '博乐', lng: 82.07, p: '新疆' }, { n: '库尔勒', lng: 86.15, p: '新疆' }, { n: '阿克苏', lng: 80.26, p: '新疆' },
  { n: '喀什', lng: 75.99, p: '新疆' }, { n: '伊宁', lng: 81.32, p: '新疆' }, { n: '塔城', lng: 82.98, p: '新疆' }, { n: '阿勒泰', lng: 88.14, p: '新疆' },
  { n: '石河子', lng: 86.03, p: '新疆' },
  // 港澳台
  { n: '香港', lng: 114.17, p: '香港' }, { n: '澳门', lng: 113.55, p: '澳门' }, { n: '台北', lng: 121.56, p: '台湾' }, { n: '高雄', lng: 120.31, p: '台湾' },
];

/** 全国地级市纬度（北纬°，供经纬度二维最近匹配消歧；省会/直辖市纬度见 CAP_LAT） */
export const CITY_LAT: Record<string, number> = {
  // 山东（省会济南在 CAP_LAT）
  青岛: 36.07, 烟台: 37.46, 威海: 37.51, 潍坊: 36.71, 淄博: 36.81, 日照: 35.42, 临沂: 35.10, 济宁: 35.41, 泰安: 36.19,
  德州: 37.44, 聊城: 36.45, 菏泽: 35.23, 滨州: 37.38, 东营: 37.43, 枣庄: 34.81,
  // 江苏（南京已在 CAP_LAT）
  无锡: 31.57, 苏州: 31.30, 常州: 31.81, 南通: 31.98, 连云港: 34.60, 徐州: 34.26, 盐城: 33.35, 扬州: 32.39, 镇江: 32.19,
  泰州: 32.46, 淮安: 33.60, 宿迁: 33.96,
  // 浙江（杭州在 CAP_LAT）
  宁波: 29.87, 温州: 28.00, 嘉兴: 30.75, 湖州: 30.89, 绍兴: 30.00, 金华: 29.08, 衢州: 28.94, 舟山: 30.02, 台州: 28.66, 丽水: 28.45,
  // 福建（福州在 CAP_LAT）
  厦门: 24.48, 莆田: 25.45, 三明: 26.27, 泉州: 24.87, 漳州: 24.51, 南平: 26.64, 龙岩: 25.08, 宁德: 26.67,
  // 广东（广州/深圳在 CAP_LAT）
  珠海: 22.27, 汕头: 23.35, 佛山: 23.02, 韶关: 24.81, 湛江: 21.27, 肇庆: 23.05, 江门: 22.58, 茂名: 21.66, 惠州: 23.11,
  梅州: 24.29, 汕尾: 22.79, 河源: 23.74, 阳江: 21.86, 清远: 23.68, 东莞: 23.02, 中山: 22.52, 潮州: 23.66, 揭阳: 23.55, 云浮: 22.92,
  // 广西（南宁在 CAP_LAT）
  柳州: 24.33, 桂林: 25.27, 梧州: 23.48, 北海: 21.48, 防城港: 21.69, 钦州: 21.97, 贵港: 23.11, 玉林: 22.64, 百色: 23.90,
  贺州: 24.40, 河池: 24.70, 来宾: 23.73, 崇左: 22.39,
  // 河北（石家庄在 CAP_LAT）
  唐山: 39.63, 秦皇岛: 39.94, 邯郸: 36.63, 保定: 38.87, 张家口: 40.77, 承德: 40.95, 沧州: 38.30, 廊坊: 39.52, 邢台: 37.07,
  // 河南（郑州在 CAP_LAT）
  开封: 34.80, 洛阳: 34.62, 平顶山: 33.77, 安阳: 36.10, 鹤壁: 35.75, 新乡: 35.30, 焦作: 35.24, 濮阳: 35.76, 许昌: 34.04,
  漯河: 33.58, 三门峡: 34.77, 南阳: 32.99, 商丘: 34.41, 信阳: 32.15, 周口: 33.63, 驻马店: 33.01,
  // 湖北（武汉在 CAP_LAT）
  黄石: 30.20, 十堰: 32.63, 宜昌: 30.69, 襄阳: 32.01, 鄂州: 30.39, 荆门: 31.04, 孝感: 30.92, 荆州: 30.32, 黄冈: 30.45,
  咸宁: 29.84, 随州: 31.69, 恩施: 30.27,
  // 湖南（长沙在 CAP_LAT）
  株洲: 27.83, 湘潭: 27.83, 衡阳: 26.89, 邵阳: 27.24, 岳阳: 29.37, 常德: 29.03, 张家界: 29.12, 益阳: 28.55, 郴州: 25.79,
  永州: 26.42, 怀化: 27.55, 娄底: 27.70, 吉首: 28.31,
  // 安徽（合肥在 CAP_LAT）
  芜湖: 31.35, 蚌埠: 32.92, 淮南: 32.63, 马鞍山: 31.67, 淮北: 33.95, 铜陵: 30.95, 安庆: 30.54, 黄山: 29.71, 滁州: 32.30,
  阜阳: 32.89, 宿州: 33.65, 六安: 31.75, 亳州: 33.87, 池州: 30.66, 宣城: 30.94,
  // 陕西（西安在 CAP_LAT）
  铜川: 34.90, 宝鸡: 34.36, 咸阳: 34.33, 渭南: 34.50, 延安: 36.59, 汉中: 33.07, 榆林: 38.29, 安康: 32.69, 商洛: 33.87,
  // 四川（成都在 CAP_LAT）
  自贡: 29.34, 攀枝花: 26.58, 泸州: 28.87, 德阳: 31.13, 绵阳: 31.47, 广元: 32.43, 遂宁: 30.51, 内江: 29.58, 乐山: 29.55,
  南充: 30.80, 眉山: 30.05, 宜宾: 28.75, 广安: 30.46, 达州: 31.21, 雅安: 30.00, 巴中: 31.87, 资阳: 30.12, 西昌: 27.89,
  // 贵州（贵阳在 CAP_LAT）
  六盘水: 26.59, 遵义: 27.73, 安顺: 26.25, 毕节: 27.30, 铜仁: 27.72, 凯里: 26.58, 兴义: 25.09,
  // 云南（昆明在 CAP_LAT）
  曲靖: 25.49, 玉溪: 24.35, 保山: 25.11, 昭通: 27.34, 丽江: 26.86, 普洱: 22.83, 临沧: 23.89, 大理: 25.61, 楚雄: 25.03,
  蒙自: 23.36, 文山: 23.37, 景洪: 22.01, 香格里拉: 27.83,
  // 海南（海口在 CAP_LAT）
  三亚: 18.25, 儋州: 19.52,
  // 山西（太原在 CAP_LAT）
  大同: 40.08, 阳泉: 37.86, 长治: 36.20, 晋城: 35.49, 朔州: 39.33, 晋中: 37.69, 运城: 35.03, 忻州: 38.42, 临汾: 36.09, 吕梁: 37.52,
  // 内蒙古（呼和浩特在 CAP_LAT）
  包头: 40.66, 乌海: 39.67, 赤峰: 42.26, 通辽: 43.61, 鄂尔多斯: 39.61, 呼伦贝尔: 49.21, 巴彦淖尔: 40.74, 乌兰察布: 40.99,
  // 辽宁（沈阳在 CAP_LAT）
  大连: 38.91, 鞍山: 41.11, 抚顺: 41.88, 本溪: 41.29, 丹东: 40.13, 锦州: 41.10, 营口: 40.67, 阜新: 42.02, 辽阳: 41.27,
  盘锦: 41.12, 铁岭: 42.22, 朝阳: 41.58, 葫芦岛: 40.71,
  // 吉林（长春在 CAP_LAT）
  吉林市: 43.84, 四平: 43.17, 辽源: 42.90, 通化: 41.73, 白山: 41.94, 松原: 45.14, 白城: 45.62, 延吉: 42.90,
  // 黑龙江（哈尔滨在 CAP_LAT）
  齐齐哈尔: 47.35, 鸡西: 45.30, 鹤岗: 47.35, 双鸭山: 46.65, 大庆: 46.59, 伊春: 47.73, 佳木斯: 46.81, 牡丹江: 44.58, 黑河: 50.25, 绥化: 46.65,
  // 甘肃（兰州在 CAP_LAT）
  嘉峪关: 39.77, 金昌: 38.52, 白银: 36.54, 天水: 34.58, 武威: 37.93, 张掖: 38.93, 平凉: 35.54, 酒泉: 39.73, 庆阳: 35.71,
  定西: 35.58, 陇南: 33.40, 临夏: 35.60,
  // 青海（西宁在 CAP_LAT）
  海东: 36.50, 格尔木: 36.40, 玉树: 33.01, 德令哈: 37.37,
  // 宁夏（银川在 CAP_LAT）
  石嘴山: 38.98, 吴忠: 37.99, 固原: 36.00, 中卫: 37.50,
  // 新疆（乌鲁木齐在 CAP_LAT）
  克拉玛依: 45.60, 吐鲁番: 42.95, 哈密: 42.83, 昌吉: 44.01, 博乐: 44.90, 库尔勒: 41.73, 阿克苏: 41.17, 喀什: 39.47, 伊宁: 43.91,
  塔城: 46.75, 阿勒泰: 47.85, 石河子: 44.31,
  // 港澳台
  高雄: 22.62,
};

/** 省份/直辖市/自治区/特别行政区列表（按城市表出现顺序去重），供地区选择器筛选 */
export const CITY_PROVINCES: string[] = (() => {
  const out: string[] = [];
  for (const c of CITY_LONGS) if (!out.includes(c.p)) out.push(c.p);
  return out;
})();

/** 某省（或全部）的城市列表；province 传 undefined 时返回全表 */
export function citiesOfProvince(province?: string): Array<{ n: string; lng: number; p: string; lat?: number }> {
  return province ? CITY_LONGS.filter(c => c.p === province) : CITY_LONGS;
}

/** 从经纬度反查城市名：窗口内经度相近者 → 用纬度做二维最近匹配（阈值内才命名，超出则不猜） */
export function cityNameOf(lng: number | null | undefined, preferName?: string | null, lat?: number | null): string | null {
  if (lng == null) return null;
  if (preferName) {
    const hit = CITY_LONGS.find(c => c.n === preferName && Math.abs(c.lng - lng) < 0.15);
    if (hit) return hit.n;
  }
  // 经度窗口内候选（±0.18°，约 ±16km）
  const cands = CITY_LONGS.filter(c => Math.abs(c.lng - lng) < 0.18);
  if (!cands.length) return null;
  // 提供纬度时：二维最近（经度×纬度都接近才认作同一城市），阈值 100km，防止把千里之外的同经度城市错标
  if (lat != null) {
    const rad = lat * Math.PI / 180;
    const kmPerDegLng = 111.32 * Math.cos(rad);
    const latOf = (c: { n: string; lat?: number }) => c.lat ?? CITY_LAT[c.n] ?? CAP_LAT[c.n];
    const latCands = cands.filter(c => latOf(c) != null);
    if (latCands.length) {
      let best: string | null = null, bestKm = Infinity;
      for (const c of latCands) {
        const dy = Math.abs((latOf(c) as number) - lat) * 111.19;
        const dx = Math.abs(c.lng - lng) * kmPerDegLng;
        const d = Math.sqrt(dy * dy + dx * dx);
        if (d < bestKm) { bestKm = d; best = c.n; }
      }
      return bestKm <= 100 ? best : null;
    }
    return null; // 有纬度但窗口内候选都没纬度可比，不瞎猜
  }
  // 无纬度：取窗口内经度最近者（±0.15 内才命名）
  let best: string | null = null, bestD = Infinity;
  for (const c of cands) {
    const d = Math.abs(c.lng - lng);
    if (d < bestD) { bestD = d; best = c.n; }
  }
  return bestD < 0.15 ? best : null;
}

// —— 金口诀地分·方位判断（省会/直辖市纬度仅用于方位参考点，近似即可）——
export const CAP_LAT: Record<string, number> = {
  北京: 39.9, 天津: 39.1, 上海: 31.2, 重庆: 29.6, 石家庄: 38.0, 太原: 37.9, 呼和浩特: 40.8, 沈阳: 41.8,
  长春: 43.9, 哈尔滨: 45.8, 南京: 32.1, 杭州: 30.3, 合肥: 31.8, 福州: 26.1, 南昌: 28.7, 济南: 36.7,
  郑州: 34.8, 武汉: 30.6, 长沙: 28.2, 广州: 23.1, 南宁: 22.8, 海口: 20.0, 成都: 30.6, 贵阳: 26.6,
  昆明: 25.0, 拉萨: 29.7, 西安: 34.3, 兰州: 36.1, 西宁: 36.6, 银川: 38.5, 乌鲁木齐: 43.8, 香港: 22.3, 澳门: 22.2, 台北: 25.0,
};
const DIZHI_FANG = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']; // 每 30° 一位，子=正北 0°
export const FANG_NOTE: Record<string, string> = { 子: '正北', 丑: '东北偏北', 寅: '东北偏东', 卯: '正东', 辰: '东南偏东', 巳: '东南偏南', 午: '正南', 未: '西南偏南', 申: '西南偏西', 酉: '正西', 戌: '西北偏西', 亥: '西北偏北' };

/** 由两点坐标求「来方地支」：以参考点（出生地/起卦地）为原点，当前位置为来方，按方位角映射十二地支 */
export function bearingDizhi(refLat: number, refLng: number, lat: number, lng: number): string {
  const toR = Math.PI / 180;
  const dLng = (lng - refLng) * toR;
  const y = Math.sin(dLng) * Math.cos(lat * toR);
  const x = Math.cos(refLat * toR) * Math.sin(lat * toR) - Math.sin(refLat * toR) * Math.cos(lat * toR) * Math.cos(dLng);
  const deg = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  return DIZHI_FANG[Math.round(deg / 30) % 12];
}
