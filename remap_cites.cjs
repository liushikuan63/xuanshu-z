const fs=require('fs');
function rep(f,pairs){
  let s=fs.readFileSync(f,'utf8');
  for(const [a,b] of pairs){
    if(!s.includes(a)){console.log('MISS',f,a.slice(0,40));continue;}
    s=s.replace(a,b);
  }
  fs.writeFileSync(f,s);
  console.log('done',f);
}
rep('packages/core/src/arts/bazi/engine.ts',[
  ["const C_ZZYQ = () => cite('zipingzhenquan', '子平真诠', '论用神', 'zipingzhenquan.2.1', '用神者，月令所藏之神也', 'A');",
   "const C_ZZYQ = () => cite('yuanhaiziping', '渊海子平', '基础第一', 'yuanhaiziping.1.13', '假令月令有用神，得父母力；年有用神，得祖宗力', 'A');"],
]);
rep('packages/core/src/arts/liuren/engine.ts',[
  ["cite('liurenzhinan', '六壬指南', '占验门', 'liurenzhinan.1.1', '（《六壬指南》原典回链，见书阁）', 'A')",
   "cite('liuren-daquan', '六壬大全', '一賊尅法', 'liuren-daquan.5.1', '取課先從下賊呼，如無下賊上尅初', 'A')"],
  ["cite('liurenzhinan', '六壬指南', '课经', 'liurenzhinan.1.2', '（《六壬指南》课体回链）', 'A')",
   "cite('liuren-daquan', '六壬大全', '十干寄宫', 'liuren-daquan.4.1', '甲課寅兮乙課辰，丙戊課巳不須論', 'A')"],
  ["cite('liurenzhinan', '六壬指南', '占验门', 'liurenzhinan.1.3', '应期推法', 'A')",
   "cite('bianta', '毕法赋', '全文', 'bianta.1.2', '彼求我事支傳干，我求彼事干傳支', 'B')"],
]);
rep('packages/core/src/arts/ziwei/engine.ts',[
  ["const C_QJ = (ch: string, seg?: string) => cite('ziwei-quanji', '紫微斗数全集', ch, seg ?? `ziwei-quanji.${ch}`, '（《紫微斗数全集》原典回链，见书阁）', 'A');",
   "const C_QJ = (ch: string, seg?: string) => cite('ziwei-quanshu', '紫微斗数全书', ch, seg ?? `ziwei-quanshu.${ch}`, '（《紫微斗数全书》原典回链，见书阁）', 'A');"],
]);
