'use strict';
(() => {
  const B=window.Benri;
  B.watch(()=>{
    const height=B.read('height',{min:Number.MIN_VALUE}),weight=B.read('weight',{min:Number.MIN_VALUE});
    if(height===null || weight===null){B.clear(['bmi','bmi-category','ideal-weight','weight-diff']);B.message('身長と体重を0より大きい数値で入力してください。');return;}
    const m=height/100,bmi=weight/(m*m),ideal=22*m*m,diff=weight-ideal;
    if([bmi,ideal,diff].some(n=>!Number.isFinite(n) || Math.abs(n)>Number.MAX_SAFE_INTEGER)){B.clear(['bmi','bmi-category','ideal-weight','weight-diff']);B.message('計算できる範囲の身長・体重を入力してください。');return;}
    B.message('');
    const category=bmi<18.5?'低体重（やせ）':bmi<25?'普通体重':bmi<30?'肥満（1度）':bmi<35?'肥満（2度）':bmi<40?'肥満（3度）':'肥満（4度）';
    const fixed=n=>B.round(n,1).toFixed(1);
    B.put('bmi',fixed(bmi));B.put('bmi-category',category);B.put('ideal-weight',fixed(ideal),`${fixed(ideal)} kg`);B.put('weight-diff',fixed(diff),`${B.round(diff,1)>0?'+':''}${fixed(diff)} kg`);
  });
})();
