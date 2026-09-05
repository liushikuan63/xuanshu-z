/** 书库配图（bookImages.ts）：含图古籍的插图关联（本地包内公版图 + 来源标注）。
 * src 指向 apps/web/public/bookimg/ 下已打包的公有领域图，使用**相对路径**（无前导 /），
 * 以兼容 Web 端 base:'./' 与 Capacitor file:// 资源根，确保离线/App 内本地显示；
 * 仅收录可查证来源的图，源描述 + 许可字段如实标注；AI 生成图用 note 明示「AI 生成示意图（非原书图）」。
 */
export interface BookImage {
  src: string;          // 相对 public 的路径（如 bookimg/baduanjin.jpg，无前导斜杠）
  alt: string;          // 图片说明（对应卷/象/篇）
  source?: string;      // 来源（如 维基共享资源·公有领域）
  license?: string;     // 许可（如 Public domain / CC BY-SA）
  note?: string;        // 补充说明（含 AI 生成标注）
}

export const BOOK_IMAGES: Record<string, BookImage[]> = {
  baduanjin: [
    { src: 'bookimg/baduanjin.jpg', alt: '八段锦练习图（公版）', source: '维基共享资源', license: 'Public domain', note: '八段锦为导引健身术，图中示功法身姿。' },
    { src: 'bookimg/baduanjin-1.jpg', alt: '八段锦式样一（公版）', source: '维基共享资源', license: 'Public domain' },
  ],
  'bencao-gangmu': [
    { src: 'bookimg/bencao-1.jpg', alt: '本草纲目·药物部（明刻本插图，公版）', source: '维基共享资源（Wellcome Collection）', license: 'Public domain' },
    { src: 'bookimg/bencao-2.jpg', alt: '本草纲目·柑类药图（明抄彩绘，公版）', source: '维基共享资源（Wellcome Collection）', license: 'Public domain' },
  ],
  'shennong-bencao': [
    { src: 'bookimg/bencao-1.jpg', alt: '本草类药图（明刻本通例，公版）', source: '维基共享资源（Wellcome Collection）', license: 'Public domain', note: '《神农本草经》原书无图传世，此为后世本草药图通例，供观其形色。' },
  ],
  'zhenjiu-jiayijing': [
    { src: 'bookimg/zhenjiu-1.jpg', alt: '针灸头面三行循行图（清代木版，公版）', source: '维基共享资源（Wellcome Collection）', license: 'Public domain' },
    { src: 'bookimg/zhenjiu-2.jpg', alt: '针灸督脉循行图（清代木版，公版）', source: '维基共享资源（Wellcome Collection）', license: 'Public domain' },
  ],
  'zhenjiu-dacheng': [
    { src: 'bookimg/zhenjiu-1.jpg', alt: '针灸头面三行循行图（清代木版，公版）', source: '维基共享资源（Wellcome Collection）', license: 'Public domain' },
    { src: 'bookimg/zhenjiu-2.jpg', alt: '针灸督脉循行图（清代木版，公版）', source: '维基共享资源（Wellcome Collection）', license: 'Public domain' },
  ],
  tuibeitu: [
    { src: 'bookimg/tuibei-1.gif', alt: '推背图·象三（公版扫描）', source: '维基共享资源', license: 'Public domain', note: '推背图六十象以图配诗谶，此象为流传版本之一。' },
  ],
  yijinjing: [
    { src: 'bookimg/baduanjin.jpg', alt: '导引身法示意（公版，与八段锦同源功法图）', source: '维基共享资源', license: 'Public domain', note: '易筋经与八段锦同属伸筋导引，此图为导引身法通例。' },
  ],
};