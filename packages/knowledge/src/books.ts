/** 五术书库目录（山·医·命·相·卜；数量由 BOOK_CATALOG 动态计算）：
 *  每条含：类别/子类、朝代作者（题名/托名如实标注）、一句话白话概述、
 *  关联术数(art)、关联术语(terms，取词库/讲辑已收录词)、是否已有可读语料(hasCorpus)。
 *  可读语料的 canonicalId 对应 data/.kb/books/<canonicalId>，可进阅读器精读；
 *  未内置者先以「书录卡」展示概要，后续采集语料后立即可读（语料目录自动打包）。 */
export type WushuCategory = '山' | '医' | '命' | '相' | '卜';
export type CorpusStatus = 'full' | 'related' | 'scan' | 'lost' | 'oral' | 'restricted' | 'uncertain';

export interface BookSource {
  label: string;
  url: string;
  note?: string;
}

export const CORPUS_STATUS_LABEL: Record<CorpusStatus, string> = {
  full: '已内置全文',
  related: '已内置相关原典',
  scan: '有扫描待校',
  lost: '原典亡佚',
  oral: '口传/近现代整理',
  restricted: '版权受限',
  uncertain: '题名或底本待考',
};

export const CORPUS_STATUS_DESCRIPTION: Record<CorpusStatus, string> = {
  full: '已内置可检索正文，可从书架直接进入精读。',
  related: '原条目并非单一定本或原书已亡佚；已内置可核验的相关存世原典，可进入精读。',
  scan: '已找到版本、馆藏或扫描线索，尚未完成可靠文字校勘，暂不把 OCR 当作全文。',
  lost: '早期书目有著录，但原典已亡佚；仅保留存佚记录和后世相关原典。',
  oral: '属于口传或近现代整理体系，尚无可确认为公版统一底本的正文。',
  restricted: '已核验书目信息，但属于现代作品或授权边界不明，不能整本复制入库。',
  uncertain: '题名、作者、年代或底本尚不能可靠核定，暂不拼接网络转载作为全文。',
};

export function corpusStatusOf(book: BookEntry): CorpusStatus {
  return book.corpusStatus ?? (book.hasCorpus ? 'full' : 'uncertain');
}

export interface BookEntry {
  id: string;                 // canonical_id（内置语料时与原语料一致）
  title: string;              // 书名
  author?: string;            // 作者（题名/托名会注明）
  era?: string;               // 时代
  category: WushuCategory;
  sub: string;                // 子类
  art?: string[];             // 关联术数（bazi/ziwei/liuyao/meihua/qimen/liuren/xiaoliuren/jinkou）
  terms?: string[];           // 关联术语（书阁将按术语库命中数过滤展示）
  hasCorpus: boolean;         // 是否已有全文或相关存世原典可读
  corpusId?: string;          // 内置语料 canonical_id（与 id 不同时指定，如托名异名）
  corpusStatus?: CorpusStatus;// 精确可用状态；未填时由 hasCorpus 推断 full/uncertain
  sourceNote?: string;        // 存佚、版本、版权或关联原典说明
  sources?: BookSource[];     // 经核验的在线书目/原文/扫描来源
  note: string;               // 一句话白话概述
}

export function corpusIdOf(book: Pick<BookEntry, 'id' | 'corpusId'>): string {
  return book.corpusId ?? book.id;
}

export const WUSHU_CATEGORIES: WushuCategory[] = ['山', '医', '命', '相', '卜'];

export const BOOK_CATALOG: BookEntry[] = [
  // ══════════ 山 · 拳法（12）══════════
  { id: 'baduanjin', title: '八段锦', author: '历代导引家传承（非单一著作）', era: '宋元以后·明清定型', category: '山', sub: '拳法', hasCorpus: true, corpusId: 'xiuling-yaozhi', corpusStatus: 'related', sourceNote: '“八段锦”是多支功法的合称，未发现可作为唯一底本的同名定本；书阁关联《修龄要指》所收八段锦导引法及同类导引原文。', sources: [{ label: '中国哲学书电子化计划·八段锦扫描书目', url: 'https://ctext.org/library.pl?if=gb&res=98985', note: '同名扫描本题材并非现代常见八段锦功法，不能据题名直接混同。' }], note: '以“八段”口诀流传的导引体系，传本和动作谱系不一；本条以相关存世原典代替虚构的“唯一全文”。', terms: ['导引', '吐纳'] },
  { id: 'yijinjing', title: '易筋经', author: '题 达摩（明刻本托名）', era: '明（1624 年刻本存世）', category: '山', sub: '拳法', hasCorpus: true, note: '少林武学内功经典，“易筋”指把萎弱筋力换为强壮劲力，讲究伸筋拔骨、以意引气。', terms: ['导引', '吐纳'] },
  { id: 'wuqinxi', title: '五禽戏', author: '传 华佗（三国）', era: '东汉末见载·后世续传', category: '山', sub: '拳法', hasCorpus: true, corpusId: 'yangsheng-yanminglu', corpusStatus: 'related', sourceNote: '《华佗五禽诀》《华佗老子五禽六气诀》等早期著作已亡佚；现以内置《养性延命录》的五禽戏记载作为可核验原典。', sources: [{ label: '维基文库·养性延命录', url: 'https://zh.wikisource.org/zh-hans/养性延命录', note: '存世早期五禽戏具体动作记载。' }], note: '模仿虎、鹿、熊、猿、鸟的导引体系；原始专书亡佚，现存早期文字见《养性延命录》等。', terms: ['导引'] },
  { id: 'taijiquan', title: '太极拳论', author: '题 王宗岳（传本作者有争议）', era: '清代传本', category: '山', sub: '拳法', hasCorpus: true, corpusId: 'taijiquan-lun', corpusStatus: 'full', sourceNote: '目录原把拳种“太极拳”当作书名，现改为有存世文本的《太极拳论》；维基文库标记正文完整但底本可靠性未定。', sources: [{ label: '维基文库·太极拳论', url: 'https://zh.wikisource.org/zh-hans/太极拳论' }], note: '以阴阳、粘走、懂劲为纲的太极拳核心拳论；作者归属和成文年代仍有争议。', terms: ['站桩', '导引'] },
  { id: 'emei-shierzhung', title: '峨嵋十二桩', author: '峨嵋派近现代传承', era: '近现代整理', category: '山', sub: '拳法', hasCorpus: false, corpusStatus: 'oral', sourceNote: '属于近现代口传与整理的功法体系，未核验到1931年前形成且可自由再利用的统一文字底本；保留书录和存佚说明。', note: '峨嵋武学筑基桩功的近现代整理体系，不宜伪装成一部有固定古本的“全文古籍”。', terms: ['站桩', '吐纳'] },
  { id: 'baguazhang', title: '八卦掌', author: '传 董海川（清）', era: '清末形成', category: '山', sub: '拳法', hasCorpus: false, corpusStatus: 'scan', sourceNote: '八卦掌是拳种而非单一古籍；可追溯的《八卦拳学》等民国拳谱目前仅核验到公版扫描/书目，尚未取得可靠校对文本。', sources: [{ label: '中国体育图书汇目（含《八卦拳学》书目）', url: 'https://upload.wikimedia.org/wikipedia/commons/2/2e/SSID-13120277_中國體育圖書匯目.pdf' }], note: '清末形成的内家拳体系；本条保留拳种书录，待公版拳谱完成校对后再内置正文。', terms: ['八卦'] },
  { id: 'changshi-wuji', title: '苌氏武技书', author: '苌乃周（清）', era: '清', category: '山', sub: '拳法', hasCorpus: true, corpusStatus: 'full', sourceNote: '已依据维基文库可读本导入六卷正文；原作属公有领域，电子文本按 CC BY-SA 4.0 标注。', sources: [{ label: '维基文库·苌氏武技书', url: 'https://zh.wikisource.org/zh-hans/萇氏武技書' }], note: '河南苌家拳理论专著，把拳理上溯到阴阳五行、子午流注，是“武以载道”的典型。', terms: ['五行'] },
  { id: 'lingjianzi', title: '灵剑子', author: '题 许逊（晋）', era: '晋（托名）', category: '山', sub: '拳法', hasCorpus: true, note: '道教导引吐纳功法书，四时按季行功、配以按摩叩齿，属"山"家养生。', terms: ['导引', '胎息'] },
  { id: 'xiuling-yaozhi', title: '修龄要指', author: '冷谦（明）', era: '明·洪武', category: '山', sub: '拳法', hasCorpus: true, note: '养生导引要诀合集，主张"导引以却病、术数以延年"，八段锦早期文献之一。', terms: ['导引'] },
  { id: 'wanshou-xianshu', title: '万寿仙书', author: '曹无极辑·题罗洪先传', era: '清刻本（1832年本见录）', category: '山', sub: '拳法', hasCorpus: false, corpusStatus: 'scan', sourceNote: '可确认四卷清刻本和馆藏扫描，但尚无可靠、可逐字校验的开放电子全文；仅保留版本信息，避免把 OCR 乱码当作正文。', sources: [{ label: 'Chinese Religious Text Authority·万寿仙书', url: 'https://crta.info/wiki/萬壽仙書_-_K63', note: '记录1832年木刻本、辑者和馆藏信息。' }, { label: '维基文库·四库全书存目丛书书目', url: 'https://zh.wikisource.org/zh/四庫全書存目叢書', note: '列有《万寿仙书》四卷及馆藏版本。' }], note: '养生导引图谱集；现阶段提供版本和馆藏线索，待扫描校勘后再内置。', terms: ['导引', '吐纳'] },
  { id: 'quanjing-quanfa', title: '拳经拳法备要', author: '题 张孔昭（清）', era: '清', category: '山', sub: '拳法', hasCorpus: true, note: '少林拳法口诀总集，总论散手/步法/运气，是“拳经”的通行本。', terms: ['五行'] },
  { id: 'shierduanjin', title: '十二段锦', author: '佚名（多种传承）', era: '清代以后传本', category: '山', sub: '拳法', hasCorpus: false, corpusStatus: 'uncertain', sourceNote: '同名坐式功法有多种次序和口诀，尚未核验到可作为统一底本的公版全文；与《修龄要指》所收“十六段锦”不可混同。', note: '坐式导引功法的后世传承名目；现存版本不一，故保留书录而不拼接成伪“全文”。', terms: ['导引', '胎息'] },

  // 山 · 丹道/内丹（D1 新增公版全文）
  { id: 'baopuzi', title: '抱朴子·内篇', author: '葛洪（东晋）', era: '东晋', category: '山', sub: '丹道/仙道', hasCorpus: true, terms: ['导引', '胎息', '五行'], note: '仙道理论总集：金丹、黄白、神仙可学论，兼收摄生、辟谷、符箓，“山”家丹道最重要典籍之一。' },
  { id: 'huangtingjing', title: '黄庭经', author: '托名 魏华存（晋传）', era: '魏晋（托名）', category: '山', sub: '丹道/仙道', hasCorpus: true, terms: ['导引', '胎息'], note: '内丹经典：以存想身中神(黄庭神)守一为法门，描摹五脏六腑神兵，是吐纳存想的上乘口诀。' },
  { id: 'wuzhenpian', title: '悟真篇', author: '张伯端（紫阳真人，北宋）', era: '北宋', category: '山', sub: '丹道/仙道', hasCorpus: true, terms: ['导引', '吐纳'], note: '内丹南宗祖经：以歌诀讲性命双修、炼精化气，与《参同契》并称丹道双璧。' },
  { id: 'taiyi-jinhuazongzhi', title: '太乙金华宗旨', author: '托名 吕洞宾（清本）', era: '清（托名）', category: '山', sub: '丹道/仙道', hasCorpus: true, terms: ['导引', '吐纳'], note: '回光守中为法的内丹经典，第十三章论“金华即光，光即性”，近世修持参考本。' },
  { id: 'yinfujing', title: '阴符经', author: '题 轩辕黄帝（托名）', era: '先秦—唐（托名）', category: '山', sub: '丹道/仙道', hasCorpus: true, terms: ['五行'], note: '“观天之道，执天之行”三百余字：讲天机、盗机与修炼，兼为兵家/医家共奉的小经。' },

  // ══════════ 医 · 中医（12）══════════
  { id: 'suwen', title: '黄帝内经·素问', author: '托名黄帝（先秦至汉成书，多篇并存）', era: '先秦—西汉', category: '医', sub: '中医', hasCorpus: true, terms: ['阴阳', '气血'], note: '中医理论总纲：阴阳五行、藏象经络、病机治法皆源于此，“法于阴阳、和于术数”即其总纲。' },
  { id: 'lingshu', title: '黄帝内经·灵枢', author: '托名黄帝（与素问同源）', era: '先秦—西汉', category: '医', sub: '中医', hasCorpus: true, terms: ['阴阳', '经络', '子午流注'], note: '又称《针经》，九针经脉、营卫气血的系统论述，针灸学的源头。' },
  { id: 'shennong-bencao', title: '神农本草经', author: '托名神农（汉）', era: '汉', category: '医', sub: '中医', hasCorpus: true, terms: ['四气五味', '君臣佐使'], note: '现存最早本草学专著，载药 365 种，分上中下三品，奠定了药性（四气五味）理论。' },
  { id: 'nanjing', title: '难经', author: '题 秦越人（托名扁鹊）', era: '战国—汉', category: '医', sub: '中医', hasCorpus: true, terms: ['脉象'], note: '以问答体阐发《内经》疑难 81 条，“独取寸口”脉法即源于此。' },
  { id: 'shanghan-zabing', title: '伤寒杂病论', author: '张仲景（东汉）', era: '东汉末', category: '医', sub: '中医', hasCorpus: true, terms: ['六经辨证', '气血'], note: '辨证论治的奠基之作，六经辨证体系，后世“经方”之源。' },
  { id: 'shanghan', title: '伤寒论（宋本）', author: '张仲景（东汉）·宋 林亿校定', era: '东汉—宋刊定', category: '医', sub: '中医', hasCorpus: true, terms: ['六经辨证'], note: '《伤寒杂病论》中伤寒部分单行本，六经辨证主体，经方之源；内置宋本通行整理本。' },
  { id: 'jinkui-yaolue', title: '金匮要略', author: '张仲景（东汉）·宋 林亿等编次', era: '东汉—宋刊定', category: '医', sub: '中医', hasCorpus: true, terms: ['六经辨证'], note: '《伤寒杂病论》杂病部分单行本，脏腑经络辨证治疗杂病。' },
  { id: 'maijing', title: '脉经', author: '王叔和（西晋）', era: '西晋', category: '医', sub: '中医', hasCorpus: true, terms: [], note: '系统整理脉学的第一部专著，24 种脉象及其主病，中医诊脉规范之源。' },
  { id: 'qianjin-yifang', title: '千金翼方', author: '孙思邈（唐）', era: '唐·永淳', category: '医', sub: '中医', hasCorpus: true, note: '药王晚年集成之作，《千金要方》之续编，兼收用药、针灸、禁经。' },
  { id: 'bencao-gangmu', title: '本草纲目', author: '李时珍（明）', era: '明·万历', category: '医', sub: '中医', hasCorpus: true, terms: ['四气五味', '君臣佐使'], note: '药物学集大成者，1892 种药物按十六部六十类编排，附方一万余首。' },
  { id: 'wenre-lun', title: '温热论', author: '叶桂（叶天士）口述·门人整理', era: '清·乾隆', category: '医', sub: '中医', hasCorpus: true, terms: ['卫气营血'], note: '温病学奠基之作，“卫气营血”辨证纲领出自此书。' },
  { id: 'xuezheng-lun', title: '血证论', author: '唐宗海（容川，清）', era: '清·光绪', category: '医', sub: '中医', hasCorpus: true, terms: ['气血'], note: '系统论治血症专著，主张“止血、消瘀、宁血、补血”四法，血证最切用。' },
  { id: 'fuqingzhu-nvke', title: '傅青主女科', author: '题 傅山（清）', era: '清（托名）', category: '医', sub: '中医', hasCorpus: true, terms: ['气血'], note: '妇科专著，重脾肾、善调肝，方药简效，妇科临床常用。' },

  // 医 · D1 新增公版全文（针灸/本草/方剂/温病/脉学）
  { id: 'qianjin-fang', title: '备急千金要方', author: '孙思邈（唐）', era: '唐·永淳', category: '医', sub: '中医', hasCorpus: true, terms: ['四气五味', '君臣佐使'], note: '药王第一部方书总集：妇人、伤寒、脏腑、杂病方论俱备，“大医精诚”文亦在其中。' },
  { id: 'zhouhou-beijifang', title: '肘后备急方', author: '葛洪（东晋）·陶弘景增补', era: '东晋—梁', category: '医', sub: '方剂', hasCorpus: true, terms: ['四气五味'], note: '应急简易方书，首创“青蒿绞汁”治疟创意，取材随手可得的急病手册。' },
  { id: 'wenre-tiaobian', title: '温病条辨', author: '吴鞠通（清）', era: '清·嘉庆', category: '医', sub: '温病', hasCorpus: true, terms: ['卫气营血'], note: '温病“三焦辨证”体系：上中下三焦分治，银翘散、桑菊饮等名方出处。' },
  { id: 'binhumaixue', title: '濒湖脉学', author: '李时珍（明）', era: '明·万历', category: '医', sub: '脉学', hasCorpus: true, terms: ['脉象'], note: '27 种脉象的诗歌体脉诀，配“相类脉”鉴别，学脉入门公认善本。' },
  { id: 'sisheng-xinyuan', title: '四圣心源', author: '黄元御（清）', era: '清·乾隆', category: '医', sub: '中医（气化学派）', hasCorpus: true, terms: ['阴阳', '五行', '气血'], note: '以“一气周流、土枢四象”重释《内经》，气化理论代表作，圆运动学说源头。' },
  { id: 'zhenjiu-jiayijing', title: '针灸甲乙经', author: '皇甫谧（西晋）', era: '西晋', category: '医', sub: '针灸', hasCorpus: true, terms: ['经络', '子午流注'], note: '现存最早针灸专著：腧穴、经脉、主治系统编排，针灸学的“教科书之祖”。' },
  { id: 'zhenjiu-dacheng', title: '针灸大成', author: '杨继洲（明）', era: '明·万历', category: '医', sub: '针灸', hasCorpus: true, terms: ['经络', '子午流注'], note: '针灸集大成之作：针道流源、穴位歌赋、补泻手法、治症要穴俱备。' },
  { id: 'qijing-bamai', title: '奇经八脉考', author: '李时珍（明）', era: '明·万历', category: '医', sub: '针灸', hasCorpus: true, terms: ['经络'], note: '奇经八脉专论：八脉循行、交会穴与主治，李时珍晚年医学精粹。' },
  { id: 'shiliao-bencao', title: '食疗本草', author: '孟诜（唐）·张鼎增订', era: '唐', category: '医', sub: '本草/食疗', hasCorpus: true, terms: ['四气五味'], note: '现存最早食疗专著：按药食两用品逐味列性味、宜忌与食疗方。' },
  { id: 'yaoxingge', title: '药性歌括四百味', author: '龚廷贤（明）等', era: '明', category: '医', sub: '本草', hasCorpus: true, terms: ['四气五味', '君臣佐使'], note: '四百余味常用药以四句歌括记性味功效，中医入门背药性最通用读本。' },
  { id: 'yixue-yuanliu', title: '医学源流论', author: '徐大椿（清）', era: '清·乾隆', category: '医', sub: '中医（医论）', hasCorpus: true, terms: ['阴阳', '气血'], note: '名医徐灵胎医论集：论元气、论病源、论治法，医理思辨深度极高。' },
  { id: 'bianque-xinshu', title: '扁鹊心书', author: '题 窦材（宋）', era: '宋', category: '医', sub: '灸治', hasCorpus: true, terms: ['经络'], note: '重灸法著书：以保扶阳气为纲，附“三世扁鹊”歌诀，灸法救急多验方。' },

  // ══════════ 命（14）══════════
  // 八字通论
  { id: 'yuanhaiziping', title: '渊海子平', author: '题 徐子平（宋）·徐升编', era: '宋（明刊）', category: '命', sub: '八字通论', art: ['bazi'], hasCorpus: true, terms: ['十神', '五行', '藏干', '大运', '流年', '十二长生'], note: '子平法纲领性著作，十神、格局、用神的框架在此定型；内置全文可精读。' },
  { id: 'sanming-tonghui', title: '三命通会', author: '万民英（明）', era: '明·万历', category: '命', sub: '八字通论', art: ['bazi'], hasCorpus: true, terms: ['十神', '五行', '大运', '神煞', '纳音'], note: '八字学集大成实录（选录内置），神煞大全、纳音、格局、吉凶参验俱备。' },
  { id: 'ditiansui', title: '滴天髓原文', author: '题 刘基（明）·任铁樵注', era: '明（清 任注通行）', category: '命', sub: '八字通论', art: ['bazi'], hasCorpus: true, corpusId: 'ditiansui', terms: ['五行', '用神', '调候'], note: '“命理圣经”，原文二十余章讲体用、精神、衰旺；内置《滴天髓阐微》（任注本）同源精读。' },
  { id: 'qiongtong-baojian', title: '穷通宝鉴', author: '清·余春台编（调候总论）', era: '清·光绪', category: '命', sub: '八字通论', art: ['bazi'], hasCorpus: true, terms: ['用神', '五行'], note: '专论“调候用神”：按十干十二月逐月取用，四季旺衰配十干最实用。' },
  // 紫微斗数
  { id: 'ziwei-fawei', title: '斗数发微论', author: '佚名（传统歌诀）', era: '明清口诀', category: '命', sub: '紫微斗数', art: ['ziwei'], hasCorpus: true, corpusId: 'ziwei-quanshu', terms: ['紫微斗数', '四化'], note: '斗数入门发微歌诀，讲星曜性情与四化的“因”与“果”。' },
  { id: 'gusuifu', title: '斗数骨髓赋', author: '题 吕洞宾（托名）', era: '明清口诀', category: '命', sub: '紫微斗数', art: ['ziwei'], hasCorpus: true, corpusId: 'suidi-fu', terms: ['紫微斗数', '四化', '庙旺落陷'], note: '斗数名赋，星情断语总汇；内置语料含《女命骨髓赋》。' },
  { id: 'guanyin-jingyan', title: '观命经验谈', author: '南北山人（民国）', era: '民国', category: '命', sub: '紫微斗数', art: ['ziwei'], hasCorpus: false, corpusStatus: 'restricted', sourceNote: '原目录“观音经验谈”系题名误写；在线书目和正文线索均指向南北山人《观命经验谈》。作者生卒与文本授权无法确认，暂不整本复制。', sources: [{ label: '在线书目与章节索引', url: 'https://www.luckclub.cn/ziwei/003/', note: '用于核对题名、作者与章节，不作为开放授权证明。' }], terms: ['紫微斗数'], note: '民国紫微斗数论命材料；已校正题名和作者，版权边界未明，仅提供可核验书目信息。' },
  { id: 'nüming-gusuifu', title: '女命骨髓赋', author: '佚名（托名吕洞宾传）', era: '明清口诀', category: '命', sub: '紫微斗数', art: ['ziwei'], hasCorpus: true, corpusId: 'suidi-fu', terms: ['紫微斗数', '四化'], note: '女命专论：夫妻、福德、子女宫位的星情断语，常与骨髓赋同诵。' },
  { id: 'shiyuge', title: '十喻歌', author: '佚名（传统歌诀）', era: '明清口诀', category: '命', sub: '紫微斗数', art: ['ziwei'], hasCorpus: true, terms: ['紫微斗数'], note: '以十个比喻概括斗数断诀，如“星曜如舟、四化如帆”。' },
  { id: 'xuanwei-lun', title: '玄微论', author: '佚名（传统歌诀）', era: '明清口诀', category: '命', sub: '紫微斗数', art: ['ziwei'], hasCorpus: true, terms: ['紫微斗数', '四化'], note: '斗数星性玄论，主星性情与格局总纲。' },
  { id: 'zengbu-taiweifu', title: '增补太微赋', author: '佚名（明《全书》系）', era: '明', category: '命', sub: '紫微斗数', art: ['ziwei'], hasCorpus: true, corpusId: 'taiwei-fu', terms: ['紫微斗数', '四化', '庙旺落陷'], note: '太微赋之增补本，讲星曜安宫与命宫格局；内置《太微赋》语料同源精读。' },
  { id: 'chongbu-doushu', title: '重补斗数彀率', author: '佚名（传统歌诀）', era: '明清口诀', category: '命', sub: '紫微斗数', art: ['ziwei'], hasCorpus: true, corpusId: 'ziwei-quanshu', terms: ['紫微斗数'], note: '“彀率”指射箭之标准，此赋为斗数断盘的标准口诀；内置《紫微斗数全书》卷一\u201c增补斗数彀率第六\u201d语料精读。' },
  // 七政四余
  { id: 'xingxue-dacheng', title: '星学大成', author: '万民英（明）', era: '明·嘉靖', category: '命', sub: '七政四余', hasCorpus: true, note: '七政四余（日月五星+四余曜）星命学大全，三十卷集历代星学家言；内置四库全书文渊阁本。' },
  { id: 'xingxue-zashi', title: '星学大成·杂诗', author: '万民英（明）·附诗诀', era: '明·嘉靖', category: '命', sub: '七政四余', hasCorpus: true, corpusId: 'xingxue-dacheng', note: '《星学大成》所收杂诗断语，以诗句快断星宫吉凶；随整书精读。' },

  // ══════════ 相（23）══════════
  // 地相（风水）
  { id: 'qingnangjing', title: '青囊经', author: '题 黄石公/杨筠松（托名）', era: '汉—唐（托名）', category: '相', sub: '地相（风水）', hasCorpus: true, terms: ['五行'], note: '风水理气派总纲，“天光下临、地德上载，藏风聚气”，体用兼备。' },
  { id: 'zangjing', title: '葬经', author: '郭璞（晋）', era: '西晋', category: '相', sub: '地相（风水）', hasCorpus: true, terms: ['五行'], note: '阴宅风水开山之作，“葬者，乘生气也”，龙、穴、砂、水、向五诀之源。' },
  { id: 'zhaijing', title: '宅经', author: '托名黄帝（《黄帝宅经》）', era: '汉—唐托名', category: '相', sub: '地相（风水）', hasCorpus: true, terms: ['五行'], note: '阳宅风水专书，讲宅之阴阳、五实/五虚与宅相呼应。' },
  { id: 'hanlongjing', title: '撼龙经', author: '杨筠松（唐）', era: '唐', category: '相', sub: '地相（风水）', hasCorpus: true, terms: ['五行'], note: '龙脉寻龙专论，九星行龙、龙格辨析，形势派经典。' },
  { id: 'boshanpian', title: '博山篇', author: '题 黄妙应（五代宋）', era: '五代—宋', category: '相', sub: '地相（风水）', hasCorpus: true, terms: ['五行'], note: '形势与理气合参的简明读本，龙穴砂水向六要俱全。' },
  { id: 'cuiguanpian', title: '催官篇', author: '赖布衣（宋）', era: '宋', category: '相', sub: '地相（风水）', hasCorpus: true, terms: ['五行'], note: '以翻卦纳甲、八曜官鬼论催官，理气派代表著作。' },
  { id: 'dili-zhengzong', title: '地理大成', author: '清·叶九升辑', era: '清', category: '相', sub: '地相（风水）', hasCorpus: false, corpusStatus: 'scan', sourceNote: '原目录将叶九升《地理大成》误写为《地理正宗》；已校正题名。在线可见目录和章节，但尚未完成全套底本与 OCR 的逐卷校验。', sources: [{ label: '识典古籍·地理大成', url: 'https://www.shidianguji.com/book/SDZJ0178', note: '用于核对书名、辑者、序与章节目录。' }], terms: ['五行'], note: '叶九升辑风水文献汇编，涵盖山法、平阳和诸家地理论说；待逐卷校勘后内置。' },
  { id: 'yangzhai-shishu', title: '阳宅十书', author: '明·王君荣辑', era: '明·万历', category: '相', sub: '地相（风水）', hasCorpus: true, terms: ['五行'], note: '阳宅形家+理气十卷，门主灶命四要、九星游年应用广泛。' },
  { id: 'yilongjing', title: '疑龙经', author: '杨筠松（唐）', era: '唐', category: '相', sub: '地相（风水）', hasCorpus: true, terms: ['五行'], note: '《撼龙经》姊妹篇：辨“疑龙”真伪、正龙出脉之论，寻龙点穴须参此篇。' },
  { id: 'tianyu-jing', title: '天玉经', author: '题 杨筠松（唐，以理气传）', era: '唐（托名大）', category: '相', sub: '地相（风水）', hasCorpus: true, terms: ['五行'], note: '理气派重典：内传上中下+外编，以九星翻卦、排龙放水论兴衰。' },
  // 人相/识人
  { id: 'renwuzhi', title: '人物志', author: '刘劭（三国魏）', era: '三国·魏', category: '相', sub: '识人/人材学', hasCorpus: true, terms: ['骨相', '气色'], note: '识人鉴才专书：论“观人察质”的九征、体别、材理，是相人由“形相”上升为“才性鉴识”的枢纽。' },
  // 人相
  { id: 'mayi-shenxiang', title: '麻衣神相', author: '题 麻衣道者（宋）', era: '宋（托名）', category: '相', sub: '人相', hasCorpus: true, note: '相术通行教科书：形神、气色、五官、十二宫相法大成。', terms: ['骨相', '五岳四渎'] },
  { id: 'shenxiang-quanbian', title: '神相全编', author: '明·袁忠彻等辑', era: '明', category: '相', sub: '人相', hasCorpus: true, note: '汇集历代相法的大全，骨相、形相、五岳四渎俱备。', terms: ['气色', '骨相', '五岳四渎'] },
  { id: 'shenxiang-tieguan', title: '神相铁关刀', author: '题 陈希夷（托名）', era: '明（托名）', category: '相', sub: '人相', hasCorpus: true, note: '以"铁关刀"为喻的断语型相书，直断骨形气色。' },
  { id: 'taiqing-shenjian', title: '太清神鉴', author: '题 王朴（五代）', era: '五代—宋', category: '相', sub: '人相', hasCorpus: true, note: '早期相书，讲五行气质配形骨，神鉴为要；内置四库全书文渊阁本六卷。' },
  { id: 'liuzhuang-shenxiang', title: '柳庄神相', author: '袁珙（明）', era: '明·永乐', category: '相', sub: '人相', hasCorpus: true, note: '柳庄袁氏父子相法经验谈，官府相士用书。' },
  { id: 'bingjian', title: '冰鉴', author: '题 曾国藩（清）', era: '清（托名为大）', category: '相', sub: '人相', hasCorpus: true, note: '“观人之道”名篇，以神骨/刚柔/容貌论识人，相法与用人哲学结合。', terms: ['骨相', '气色'] },
  { id: 'gongdu-xiangfa', title: '公笃相法', author: '陈公笃（民国）', era: '民国', category: '相', sub: '人相', hasCorpus: true, note: '民国相法代表作，融骨相、气色、问答断，案例丰富。' },
  { id: 'guanren-yuwei', title: '观人于微', author: '砚农居士', era: '现代（2001年版见录）', category: '相', sub: '人相', hasCorpus: false, corpusStatus: 'restricted', sourceNote: '可核验版本出版于2001年，属于现代版权作品；原目录“民国整理”没有依据，已更正且不抓取全文。', sources: [{ label: '星侨网路书店·观人于微', url: 'https://www.nccsoft.com/books/goods.php?id=10285', note: '用于核对作者和2001年出版信息。' }], note: '现代相人法读物；只保留书目信息，不作为公版古籍收录。' },
  { id: 'jinjiaojian', title: '金较剪', author: '题名与作者待考', era: '待考', category: '相', sub: '人相', hasCorpus: false, corpusStatus: 'uncertain', sourceNote: '目前只能确认“神相金较剪”作为相法名目被后世资料引用，未核验到独立古籍的作者、年代、卷数和可靠底本。', note: '来源未明的相法名目；在底本可考前仅保留辨伪说明，不据网络转载拼造全文。' },
  // 星相（天文占候）
  { id: 'tianguanshu', title: '史记·天官书', author: '司马迁（西汉）', era: '西汉', category: '相', sub: '星相（天文占候）', hasCorpus: true, terms: ['五行'], note: '《史记》论天文星占专篇，二十八宿、五星分野，中国星占学源头之一。' },
  { id: 'shiji', title: '史记', author: '司马迁（西汉）', era: '西汉', category: '相', sub: '星相（天文占候）', hasCorpus: true, terms: ['五行'], note: '纪传体通史开山之作：本纪、表、书、世家、列传，其中《天官书》《历书》《封禅书》为星占历法专篇。' },
  { id: 'hanshu-tianwenzhi', title: '汉书·天文志', author: '班固（东汉）', era: '东汉', category: '相', sub: '星相（天文占候）', hasCorpus: true, terms: ['五行'], note: '官方天象记录与占候之志，日月五星、彗孛云气的应验记录。' },
  { id: 'lingxian', title: '灵宪', author: '张衡（东汉）', era: '东汉', category: '相', sub: '星相（天文占候）', hasCorpus: true, terms: ['五行'], note: '浑天说纲领之作，论天地生成与日月五星运行，“宇之表无极”。' },
  { id: 'tuibeitu', title: '推背图', author: '题 李淳风、袁天罡（托名）', era: '唐（托名）', category: '相', sub: '星相（天文占候）', hasCorpus: true, note: '谶纬预言书，六十象配卦配诗，历代屡有改易，仅作文化名目参考。' },
  { id: 'shaobingge', title: '烧饼歌', author: '题 刘基（托名）', era: '明（托名）', category: '相', sub: '星相（天文占候）', hasCorpus: true, note: '托名刘伯温的谶语歌诀，民间流传，非信史。' },
  { id: 'tiangong-kaiwu', title: '天工开物', author: '宋应星（明）', era: '明·崇祯', category: '相', sub: '星相（天文占候）', hasCorpus: true, note: '技术全书，讲“天工”与“人工”合一、物性造化，从观察万物反观天地运行。' },

  // ══════════ 卜（11）══════════
  // 易经
  { id: 'zhouyi', title: '易经', author: '周（伏羲画卦、文王演易）', era: '周', category: '卜', sub: '易经', art: ['liuyao', 'meihua'], hasCorpus: true, terms: ['八卦', '六爻', '体用'], note: '群经之首：六十四卦卦爻辞，是六爻、梅花、奇门与一切易占的源头；内置《周易（王弼注本）》全文。' },
  { id: 'yizhuan', title: '易传（孔子后学）', author: '孔子后学（十翼）', era: '战国—汉', category: '卜', sub: '易经', art: ['liuyao', 'meihua'], hasCorpus: true, terms: ['八卦', '六爻', '阴阳'], note: '“十翼”解释《易经》：系辞、彖、象、文言、说卦等，把卜筮上升为哲学。' },
  { id: 'dongpo-yizhuan', title: '东坡易传', author: '苏轼（宋）', era: '北宋', category: '卜', sub: '易经', art: ['liuyao', 'meihua'], hasCorpus: true, terms: ['八卦', '六爻'], note: '“三苏”合著易注，以性命之学解易，开“以易谈心性”一路。' },
  // 六爻
  { id: 'bianshi', title: '卜筮正宗', author: '王洪绪（清初）', era: '清·康熙', category: '卜', sub: '六爻', art: ['liuyao'], hasCorpus: true, terms: ['用神', '世应', '动爻', '旬空', '六亲', '六冲'], note: '纳甲筮法正统教材，用神取法、飞伏神、月破日辰尽收；内置全文。' },
  { id: 'zengshan', title: '增删卜易', author: '野鹤老人·李文辉增删', era: '清·康熙', category: '卜', sub: '六爻', art: ['liuyao'], hasCorpus: true, terms: ['用神', '世应', '动爻', '六亲', '六冲', '合冲'], note: '六爻实战案例集大成，“动爻为枢、月日为大象”，最宜对卦例；内置全文。' },
  { id: 'jingshi-yizhuan', title: '京氏易传', author: '京房（西汉）', era: '西汉', category: '卜', sub: '六爻', art: ['liuyao'], hasCorpus: true, terms: ['八宫', '六爻'], note: '八宫卦序、世应、纳甲、六亲的原点，纳甲筮法祖经。' },
  { id: 'huangjince', title: '黄金策', author: '题 刘伯温（托名）', era: '明（托名）', category: '卜', sub: '六爻', art: ['liuyao'], hasCorpus: true, terms: ['用神', '世应', '动爻', '五行'], note: '总断千金赋等断卦总纲（内置直解），六爻高阶判读口诀。' },
  { id: 'duanyi-tianji', title: '断易天机', author: '明·徐绍锦（校）', era: '明', category: '卜', sub: '六爻', art: ['liuyao'], hasCorpus: true, terms: ['用神', '动爻', '六亲'], note: '明代断易大全，配图例诀，卦理与应期并讲。' },
  { id: 'yiyin', title: '易隐', author: '曹九锡（清）', era: '清', category: '卜', sub: '六爻', art: ['liuyao'], hasCorpus: true, terms: ['用神', '世应', '纳音'], note: '六爻高阶秘本，风水/命理并入卦中，格局繁博。' },
  // 梅花易数
  { id: 'meihua', title: '梅花易数', author: '题 邵雍（托名）', era: '宋（托名，明清广传）', category: '卜', sub: '梅花易数', art: ['meihua'], hasCorpus: true, terms: ['体用', '互卦', '本卦', '变卦', '八卦'], note: '“体用生克”起卦断事法门，时间/报数/字占皆可；内置全文。' },
  { id: 'huangji-shishi', title: '皇极经世书', author: '邵雍（宋）', era: '北宋', category: '卜', sub: '梅花易数', art: ['meihua'], hasCorpus: true, terms: ['八卦', '梅花易数'], note: '邵雍“元会运世”宇宙律动体系，梅花易数哲理之源。' },

  // ── 既有语料补充（未在用户清单、但有内置全文）──
  { id: 'shenfeng-tongkao', title: '神峰通考', author: '张楠（明）', era: '明', category: '命', sub: '八字通论', art: ['bazi'], hasCorpus: true, terms: ['十神', '五行', '大运'], note: '“病药”论用神之先驱，以去病之药为第一要义；内置全文。' },
  { id: 'ziwei-quanshu', title: '紫微斗数全书', author: '题 陈希夷（明《全书》系）', era: '明', category: '命', sub: '紫微斗数', art: ['ziwei'], hasCorpus: true, terms: ['紫微斗数', '四化', '庙旺落陷'], note: '斗数通行本全书，星曜谱系、安星口诀、断语总集成；内置全文。' },
  { id: 'yanbodiaosouge', title: '烟波钓叟歌', author: '题 赵普（托名）', era: '宋（托名）', category: '卜', sub: '奇门遁甲', art: ['qimen'], hasCorpus: true, terms: ['奇门', '阳遁', '阴遁', '八门九星'], note: '奇门遁甲总诀，法抉、三奇六仪、九星八门纲领；内置全文。' },
  { id: 'liuren-daquan', title: '六壬大全', author: '明·郭御青等（选录内置）', era: '明', category: '卜', sub: '大六壬', art: ['liuren'], hasCorpus: true, terms: ['月将', '三传', '天将'], note: '大六壬集大成（选录内置），课经、类神、占例俱备。' },
  { id: 'bianta', title: '毕法赋', author: '宋·邵彦和（传）', era: '宋', category: '卜', sub: '大六壬', art: ['liuren'], hasCorpus: true, terms: ['月将', '三传', '空亡'], note: '大六壬“断课圣经”百法口诀，课格应期尽收；内置全文。' },
];

export function catalogContainsCorpus(canonicalId: string): boolean {
  return BOOK_CATALOG.some(book => corpusIdOf(book) === canonicalId);
}

/** 按类别取书 */
export function booksOfCategory(cat: WushuCategory): BookEntry[] {
  return BOOK_CATALOG.filter(b => b.category === cat);
}
/** 按术数取书（关联术数命中） */
export function booksOfArt(art: string): BookEntry[] {
  return BOOK_CATALOG.filter(b => (b.art ?? []).includes(art));
}
/** 按关联术语取书（术语 ⇄ 书源，书阁与词库弹窗共用） */
export function booksWithTerm(term: string): BookEntry[] {
  return BOOK_CATALOG.filter(b => (b.terms ?? []).includes(term));
}
/** 按书名/作者/概述/子类关键词检索 */
export function searchBooks(q: string): BookEntry[] {
  const s = q.trim();
  if (!s) return BOOK_CATALOG;
  return BOOK_CATALOG.filter(b =>
    b.title.includes(s) || (b.sub ?? '').includes(s) || (b.author ?? '').includes(s) || (b.note ?? '').includes(s)
    // 多种方式检索：分类 / 关联术语 / 关联术数（支持别名，如「紫微」命中 ziwei、「六壬」命中大六壬）
    || (b.category ?? '').includes(s)
    || (b.terms ?? []).some(t => t.includes(s))
    || (b.art ?? []).some(a => (ART_ALIAS[a] ?? a).includes(s) || ART_ALIAS_INV[s] === a),
  );
}

/** 术数 id → 显示名（供别名检索；与 ui 的 ART_NAMES 对齐） */
const ART_ALIAS: Record<string, string> = {
  bazi: '八字', liuyao: '六爻', meihua: '梅花易数', ziwei: '紫微斗数', qimen: '奇门遁甲',
  liuren: '大六壬', xiaoliuren: '小六壬', jinkou: '金口诀', rijia: '日家奇门', liuren2: '六壬',
};
/** 显示名/别名 → 术数 id（反向映射，支持「六壬/小六壬/紫微/梅花」等输入） */
const ART_ALIAS_INV: Record<string, string> = Object.fromEntries(
  Object.entries(ART_ALIAS).flatMap(([id, name]) => [[name, id], [name.replace(/易数$/, ''), id]] as Array<[string, string]>),
);
