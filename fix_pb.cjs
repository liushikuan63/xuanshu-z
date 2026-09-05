const fs=require('fs');
const f='packages/intake/src/playbooks.ts';
let s=fs.readFileSync(f,'utf8');
const R=[
 // canonicalId 修正
 ["{ canonicalId: 'sanyao', book: '三命通会', chapter: '论妻妾'","{ canonicalId: 'sanming-tonghui', book: '三命通会', chapter: '论五行'"],
 // zengshan
 ["cA('zengshan', '增删卜易', '应期')","cA('zengshan', '增删卜易', '動變生尅冲合章第十五')"],
 ["cA('zengshan', '增删卜易', '失脱章')","cA('zengshan', '增删卜易', '用神章第八')"],
 ["cA('zengshan', '增删卜易', '求财章')","cA('zengshan', '增删卜易', '用神元神忌神仇神章第九')"],
 ["cA('zengshan', '增删卜易', '求名章')","cA('zengshan', '增删卜易', '用神章第八')"],
 ["cA('zengshan', '增删卜易', '婚姻章')","cA('zengshan', '增删卜易', '用神章第八')"],
 ["cA('zengshan', '增删卜易', '验卦')","cA('zengshan', '增删卜易', '世應章第六')"],
 ["cA('zengshan', '增删卜易', '进退神章')","cA('zengshan', '增删卜易', '動静生尅章第十四')"],
 ["cA('zengshan', '增删卜易', '用神章')","cA('zengshan', '增删卜易', '用神章第八')"],
 ["{ canonicalId: 'zengshan', book: '增删卜易', chapter: '求财章'","{ canonicalId: 'zengshan', book: '增删卜易', chapter: '用神元神忌神仇神章第九'"],
 ["{ canonicalId: 'zengshan', book: '增删卜易', chapter: '求名章'","{ canonicalId: 'zengshan', book: '增删卜易', chapter: '用神章第八'"],
 ["{ canonicalId: 'zengshan', book: '增删卜易', chapter: '失脱章'","{ canonicalId: 'zengshan', book: '增删卜易', chapter: '用神章第八'"],
 ["{ canonicalId: 'zengshan', book: '增删卜易', chapter: '婚姻章'","{ canonicalId: 'zengshan', book: '增删卜易', chapter: '用神章第八'"],
 ["{ canonicalId: 'zengshan', book: '增删卜易', chapter: '验卦'","{ canonicalId: 'zengshan', book: '增删卜易', chapter: '世應章第六'"],
 // bianshi
 ["cA('bianshi', '卜筮正宗', '用神分类')","cA('bianshi', '卜筮正宗', '用神分類定例第一')"],
 ["cA('bianshi', '卜筮正宗', '婚姻章')","cA('bianshi', '卜筮正宗', '世應論用神第二')"],
 ["cA('bianshi', '卜筮正宗', '仕途章')","cA('bianshi', '卜筮正宗', '世應論用神第二')"],
 ["cA('bianshi', '卜筮正宗', '子孙章')","cA('bianshi', '卜筮正宗', '用神分類定例第一')"],
 ["cA('bianshi', '卜筮正宗', '世应论')","cA('bianshi', '卜筮正宗', '世應論用神第二')"],
 ["cA('bianshi', '卜筮正宗', '进退神')","cA('bianshi', '卜筮正宗', '合中帶剋論第十四')"],
 ["{ canonicalId: 'bianshi', book: '卜筮正宗', chapter: '婚姻章'","{ canonicalId: 'bianshi', book: '卜筮正宗', chapter: '世應論用神第二'"],
 ["{ canonicalId: 'bianshi', book: '卜筮正宗', chapter: '仕途章'","{ canonicalId: 'bianshi', book: '卜筮正宗', chapter: '世應論用神第二'"],
 ["{ canonicalId: 'bianshi', book: '卜筮正宗', chapter: '用神分类'","{ canonicalId: 'bianshi', book: '卜筮正宗', chapter: '用神分類定例第一'"],
 // huangjince（单章直解）
 ["cA('huangjince', '黄金策', '捉贼')","cA('huangjince', '黄金策', '黃金䇿總斷千金賦直解')"],
 ["cA('huangjince', '黄金策', '失脱')","cA('huangjince', '黄金策', '黃金䇿總斷千金賦直解')"],
 ["cA('huangjince', '黄金策', '婚姻')","cA('huangjince', '黄金策', '黃金䇿總斷千金賦直解')"],
 ["{ canonicalId: 'huangjince', book: '黄金策', chapter: '出行'","{ canonicalId: 'huangjince', book: '黄金策', chapter: '黃金䇿總斷千金賦直解'"],
 ["{ canonicalId: 'huangjince', book: '黄金策', chapter: '失脱'","{ canonicalId: 'huangjince', book: '黄金策', chapter: '黃金䇿總斷千金賦直解'"],
 ["{ canonicalId: 'huangjince', book: '黄金策', chapter: '病症'","{ canonicalId: 'huangjince', book: '黄金策', chapter: '黃金䇿總斷千金賦直解'"],
 ["{ canonicalId: 'huangjince', book: '黄金策', chapter: '词讼'","{ canonicalId: 'huangjince', book: '黄金策', chapter: '黃金䇿總斷千金賦直解'"],
 // ziwei-quanshu
 ["cA('ziwei-quanshu', '紫微斗数全书', '太岁行事诀')","cA('ziwei-quanshu', '紫微斗数全书', '诸星问答论第八')"],
 ["cA('ziwei-quanshu', '紫微斗数全书', '四化论')","cA('ziwei-quanshu', '紫微斗数全书', '斗数准绳第四')"],
 ["cA('ziwei-quanshu', '紫微斗数全书', '诸星在夫妻宫断')","cA('ziwei-quanshu', '紫微斗数全书', '诸星问答论第八')"],
 ["cA('ziwei-quanshu', '紫微斗数全书', '诸星在疾厄宫断')","cA('ziwei-quanshu', '紫微斗数全书', '诸星问答论第八')"],
 ["cA('ziwei-quanshu', '紫微斗数全书', '诸星在官禄宫断')","cA('ziwei-quanshu', '紫微斗数全书', '诸星问答论第八')"],
 ["cA('ziwei-quanshu', '紫微斗数全书', '诸星在迁移宫断')","cA('ziwei-quanshu', '紫微斗数全书', '诸星问答论第八')"],
 ["cA('ziwei-quanshu', '紫微斗数全书', '安身命宫诀')","cA('ziwei-quanshu', '紫微斗数全书', '诸星问答论第八')"],
 ["{ canonicalId: 'ziwei-quanshu', book: '紫微斗数全书', chapter: '太岁行事诀'","{ canonicalId: 'ziwei-quanshu', book: '紫微斗数全书', chapter: '诸星问答论第八'"],
 ["{ canonicalId: 'ziwei-quanshu', book: '紫微斗数全书', chapter: '四化论'","{ canonicalId: 'ziwei-quanshu', book: '紫微斗数全书', chapter: '斗数准绳第四'"],
 ["{ canonicalId: 'ziwei-quanshu', book: '紫微斗数全书', chapter: '诸星在夫妻宫断'","{ canonicalId: 'ziwei-quanshu', book: '紫微斗数全书', chapter: '诸星问答论第八'"],
 ["{ canonicalId: 'ziwei-quanshu', book: '紫微斗数全书', chapter: '诸星在官禄宫断'","{ canonicalId: 'ziwei-quanshu', book: '紫微斗数全书', chapter: '诸星问答论第八'"],
 ["{ canonicalId: 'ziwei-quanshu', book: '紫微斗数全书', chapter: '诸星在疾厄宫断'","{ canonicalId: 'ziwei-quanshu', book: '紫微斗数全书', chapter: '诸星问答论第八'"],
 ["{ canonicalId: 'ziwei-quanshu', book: '紫微斗数全书', chapter: '命宫论'","{ canonicalId: 'ziwei-quanshu', book: '紫微斗数全书', chapter: '诸星问答论第八'"],
 // ditiansui / meihua
 ["cA('ditiansui', '滴天髓', '通神论')","cA('ditiansui', '滴天髓', '序第一')"],
 ["{ canonicalId: 'ditiansui', book: '滴天髓', chapter: '通神论'","{ canonicalId: 'ditiansui', book: '滴天髓', chapter: '序第一'"],
 ["{ canonicalId: 'meihua', book: '梅花易数', chapter: '体用总诀'","{ canonicalId: 'meihua', book: '梅花易数', chapter: '卷二'"],
];
let n=0,miss=0;
for(const [a,b] of R){ if(s.includes(a)){s=s.split(a).join(b);n++;} else {miss++;console.log('MISS:',a.slice(0,60));} }
fs.writeFileSync(f,s);
console.log('replaced',n,'missed',miss);
