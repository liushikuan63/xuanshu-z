const fs=require('fs');
function patch(f, varName, map){
  let s=fs.readFileSync(f,'utf8');
  const aliasSrc=Object.entries(map).map(([k,v])=>`  '${k}': '${v}',`).join('\n');
  // 在 helper 定义前插入 alias 表
  const re=new RegExp("const "+varName+" = \(ch: string");
  if(!re.test(s)){console.log('NOFN',f,varName);return;}
  s=s.replace(re, "const "+varName+"_ALIAS: Record<string,string> = {\n"+aliasSrc+"\n};\nconst "+varName+" = (ch: string");
  // helper 内映射
  s=s.replace(new RegExp("const "+varName+"_ALIAS([\s\S]*?\nconst "+varName+" = \(ch: string(\?)?: string) => cite\('([^']+)', '([^']+)', ch, `([^`]+)\${'{'}ch(\}[^`]*)?`"),
    (m,pre,opt,cid,book,segPrefix,segSuffix)=>{
      return m.replace("cite('"+cid+"', '"+book+"', ch, `"+segPrefix+"${ch}"+(segSuffix||"")+"`", "cite('"+cid+"', '"+book+"', "+varName+"_ALIAS[ch] ?? ch, `"+segPrefix+"${"+varName+"_ALIAS[ch] ?? ch}"+(segSuffix||"")+"`");
    });
  fs.writeFileSync(f,s);
  console.log('patched',f,varName);
}
patch('packages/core/src/arts/liuyao/engine.ts','C_BSZZ',{
  '用神分类':'用神分類定例第一','世应论':'世應論用神第二','六冲六合':'合處逢冲，冲中逢合論第十五',
  '月破':'月破論第九','旬空':'旬空論第十','六兽':'六獸評論第七','六亲':'六親變化歌','反吟':'反吟卦定例第十一','伏吟':'伏吟卦定例第十二','旺衰':'旺相休囚論第十三',
});
patch('packages/core/src/arts/liuyao/engine.ts','C_ZS',{
  '用神章':'用神章第八','官鬼章':'用神元神忌神仇神章第九','子孙章':'六親歌第五',
  '应期':'動變生尅冲合章第十五','进退神章':'動静生尅章第十四','元神':'元神忌神衰旺章第十','月建':'四時旺相章第又十五','旬空':'用神章第八','世应':'世應章第六','动变':'動變章第七',
});
patch('packages/core/src/arts/liuyao/engine.ts','C_HJC',{
  '总断':'黃金䇿總斷千金賦直解','总断千金赋':'黃金䇿總斷千金賦直解','月破':'黃金䇿總斷千金賦直解',
  '世应':'黃金䇿總斷千金賦直解','伏神':'黃金䇿總斷千金賦直解','旬空':'黃金䇿總斷千金賦直解','暗动':'黃金䇿總斷千金賦直解',
});
patch('packages/core/src/arts/meihua/engine.ts','C_MHS',{
  '体用总诀':'卷二','体用互变之诀':'卷二','八卦万物类占':'卷一','万物类象':'卷一','三要灵应篇':'卷一','卦数期例':'卷一','占断总诀':'卷三','十应诀':'卷三',
});
patch('packages/core/src/arts/ziwei/engine.ts','C_QS',{
  '诸星论':'诸星问答论第八','命宫论':'诸星问答论第八','诸星在十二宫论':'诸星问答论第八','诸星在命宫论':'诸星问答论第八',
  '太岁行事诀':'诸星问答论第八','安命身宫诀':'诸星问答论第八','定五行局诀':'诸星问答论第八','格局':'诸星问答论第八','大限':'诸星问答论第八',
});
patch('packages/core/src/arts/ziwei/engine.ts','C_QJ',{
  '四化论':'斗数准绳第四','四化表':'斗数准绳第四',
});
patch('packages/core/src/arts/qimen/engine.ts','C_YB',{
  '值符':'全文','值使':'全文','击刑':'全文','格局':'全文','阴阳顺逆':'全文','门迫':'全文','空亡':'全文','入墓':'全文','马星':'全文',
});
