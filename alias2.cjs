const fs=require('fs');
function swap(f, oldDef, cid, book, alias, tpl){
  let s=fs.readFileSync(f,'utf8');
  if(!s.includes(oldDef)){console.log('MISS',f,cid);return;}
  const aliasDef='const '+cid+'_ALIAS: Record<string,string> = {\n'+Object.entries(alias).map(([k,v])=>`  '${k}': '${v}',`).join('\n')+'\n};\n';
  const newDef=aliasDef+oldDef.split(' => ')[0]
    .replace('const '+cid+'','const '+cid)
    + ' => {\n  const ch = '+cid+'_ALIAS[ch0] ?? ch0;\n  return cite(\''+cid.replace('_ALIAS','')+'\', \''+book+'\', ch, `'+tpl+'`, \'（原典回链，见书阁）\', \'A\');\n};'
    .replaceAll('ch0(ch)','ch0');
  fs.writeFileSync(f,s.replace(oldDef,newDef));
  console.log('ok',f,cid);
}
// 逐个手写更稳
function swapFull(f, oldDef, newDef){
  let s=fs.readFileSync(f,'utf8');
  if(!s.includes(oldDef)){console.log('MISS',f,oldDef.slice(0,40));return;}
  fs.writeFileSync(f,s.replace(oldDef,newDef));
  console.log('ok',oldDef.slice(0,36));
}
const L='packages/core/src/arts/liuyao/engine.ts';
swapFull(L,
 "const C_BSZZ = (ch: string) => cite('bianshi', '卜筮正宗', ch, `bianshi.${ch}`, '（《卜筮正宗》原典回链，见书阁）', 'A');",
 "const C_BSZZ_ALIAS: Record<string,string> = {\n  '用神分类': '用神分類定例第一', '世应论': '世應論用神第二', '六冲六合': '合處逢冲，冲中逢合論第十五',\n  '月破': '月破論第九', '旬空': '旬空論第十', '六兽': '六獸評論第七', '六亲': '六親變化歌',\n  '反吟': '反吟卦定例第十一', '伏吟': '伏吟卦定例第十二', '旺衰': '旺相休囚論第十三', '飞伏': '卦爻呈象，并飛伏神卦身定例',\n};\nconst C_BSZZ = (ch0: string) => {\n  const ch = C_BSZZ_ALIAS[ch0] ?? ch0;\n  return cite('bianshi', '卜筮正宗', ch, `bianshi.${ch}`, '（《卜筮正宗》原典回链，见书阁）', 'A');\n};");
swapFull(L,
 "const C_ZS = (ch: string) => cite('zengshan', '增删卜易', ch, `zengshan.${ch}`, '（《增删卜易》原典回链，见书阁）', 'A');",
 "const C_ZS_ALIAS: Record<string,string> = {\n  '用神章': '用神章第八', '官鬼章': '用神元神忌神仇神章第九', '子孙章': '六親歌第五',\n  '应期': '動變生尅冲合章第十五', '进退神章': '動静生尅章第十四', '元神': '元神忌神衰旺章第十',\n  '月建': '四時旺相章第又十五', '旬空': '用神章第八', '世应': '世應章第六', '动变': '動變章第七',\n};\nconst C_ZS = (ch0: string) => {\n  const ch = C_ZS_ALIAS[ch0] ?? ch0;\n  return cite('zengshan', '增删卜易', ch, `zengshan.${ch}`, '（《增删卜易》原典回链，见书阁）', 'A');\n};");
swapFull(L,
 "const C_HJC = (ch: string) => cite('huangjince', '黄金策', ch, `huangjince.${ch}`, '（《黄金策》原典回链，见书阁）', 'A');",
 "const C_HJC_ALIAS: Record<string,string> = {\n  '总断': '黃金䇿總斷千金賦直解', '总断千金赋': '黃金䇿總斷千金賦直解', '月破': '黃金䇿總斷千金賦直解',\n  '世应': '黃金䇿總斷千金賦直解', '伏神': '黃金䇿總斷千金賦直解', '旬空': '黃金䇿總斷千金賦直解', '暗动': '黃金䇿總斷千金賦直解',\n};\nconst C_HJC = (ch0: string) => {\n  const ch = C_HJC_ALIAS[ch0] ?? ch0;\n  return cite('huangjince', '黄金策', ch, `huangjince.${ch}`, '（《黄金策》原典回链，见书阁）', 'A');\n};");
const M='packages/core/src/arts/meihua/engine.ts';
swapFull(M,
 "const C_MHS = (ch: string) => cite('meihua', '梅花易数', ch, `meihua.${ch}`, '（《梅花易数》原典回链，见书阁）', 'A');",
 "const C_MHS_ALIAS: Record<string,string> = {\n  '体用总诀': '卷二', '体用互变之诀': '卷二', '八卦万物类占': '卷一', '万物类象': '卷一',\n  '三要灵应篇': '卷一', '卦数期例': '卷一', '占断总诀': '卷三', '十应诀': '卷三',\n};\nconst C_MHS = (ch0: string) => {\n  const ch = C_MHS_ALIAS[ch0] ?? ch0;\n  return cite('meihua', '梅花易数', ch, `meihua.${ch}`, '（《梅花易数》原典回链，见书阁）', 'A');\n};");
const Z='packages/core/src/arts/ziwei/engine.ts';
swapFull(Z,
 "const C_QS = (ch: string, seg?: string) => cite('ziwei-quanshu', '紫微斗数全书', ch, seg ?? `ziwei-quanshu.${ch}`, '（《紫微斗数全书》原典回链，见书阁）', 'A');",
 "const C_QS_ALIAS: Record<string,string> = {\n  '诸星论': '诸星问答论第八', '命宫论': '诸星问答论第八', '诸星在十二宫论': '诸星问答论第八',\n  '诸星在命宫论': '诸星问答论第八', '太岁行事诀': '诸星问答论第八', '安命身宫诀': '诸星问答论第八',\n  '定五行局诀': '诸星问答论第八', '格局': '诸星问答论第八', '大限': '诸星问答论第八',\n};\nconst C_QS = (ch0: string, seg?: string) => {\n  const ch = C_QS_ALIAS[ch0] ?? ch0;\n  return cite('ziwei-quanshu', '紫微斗数全书', ch, seg ?? `ziwei-quanshu.${ch}`, '（《紫微斗数全书》原典回链，见书阁）', 'A');\n};");
swapFull(Z,
 "const C_QJ = (ch: string, seg?: string) => cite('ziwei-quanshu', '紫微斗数全书', ch, seg ?? `ziwei-quanshu.${ch}`, '（《紫微斗数全书》原典回链，见书阁）', 'A');",
 "const C_QJ_ALIAS: Record<string,string> = {\n  '四化论': '斗数准绳第四', '四化表': '斗数准绳第四',\n};\nconst C_QJ = (ch0: string, seg?: string) => {\n  const ch = C_QJ_ALIAS[ch0] ?? ch0;\n  return cite('ziwei-quanshu', '紫微斗数全书', ch, seg ?? `ziwei-quanshu.${ch}`, '（《紫微斗数全书》原典回链，见书阁）', 'A');\n};");
const Q='packages/core/src/arts/qimen/engine.ts';
swapFull(Q,
 "const C_YB = (ch: string) => cite('yanbodiaosouge', '烟波钓叟歌', ch, `yanbodiaosouge.${ch}`, '（《烟波钓叟歌》原典回链，见书阁）', 'A');",
 "const C_YB_ALIAS: Record<string,string> = {\n  '值符': '全文', '值使': '全文', '击刑': '全文', '格局': '全文', '阴阳顺逆': '全文',\n  '门迫': '全文', '空亡': '全文', '入墓': '全文', '马星': '全文',\n};\nconst C_YB = (ch0: string) => {\n  const ch = C_YB_ALIAS[ch0] ?? ch0;\n  return cite('yanbodiaosouge', '烟波钓叟歌', ch, `yanbodiaosouge.${ch}`, '（《烟波钓叟歌》原典回链，见书阁）', 'A');\n};");
