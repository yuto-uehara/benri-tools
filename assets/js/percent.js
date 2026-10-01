'use strict';
(() => {
  const B=window.Benri;
  B.watch(()=>{
    for(let p=1;p<=4;p++){
      const a=B.read(`p${p}-a`),b=B.read(`p${p}-b`),id=`p${p}-result`;
      if(a===null || b===null || (p===2 && b===0) || (p===3 && a===0)) {B.put(id,null);if(p===4)B.put('p4-discount',null);B.message((p===2 && b===0)||(p===3 && a===0)?'基準となる値が0のときは割合を計算できません。':'2つの数値を入力してください。',`p${p}-message`);continue;}
      const value=p===1?a*b/100:p===2?a/b*100:p===3?(b-a)/a*100:a*(1-b/100),result=B.round(value);
      if(!Number.isFinite(result) || Math.abs(result)>Number.MAX_SAFE_INTEGER){B.put(id,null);if(p===4)B.put('p4-discount',null);B.message('計算できる範囲を超えています。',`p${p}-message`);continue;}
      B.put(id,result,`${p===3 && result>0?'+':''}${B.format(result)}${p===2 || p===3?'%':''}`);
      if(p===4) B.put('p4-discount',B.round(a*b/100));
      B.message('',`p${p}-message`);
    }
  });
})();
