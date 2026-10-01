'use strict';
(() => {
  const B=window.Benri;B.dates(['date-from','date-to','base-date']);
  B.watch(()=>{
    const from=B.parseDate(B.$('date-from').value),to=B.parseDate(B.$('date-to').value);
    if(from && to) {const diff=Math.round((to-from)/B.DAY),abs=Math.abs(diff);B.put('days-between',diff,`${B.format(diff)}日`);B.put('days-inclusive',abs+1,`${B.format(abs+1)}日`);B.put('weeks-days',`${Math.floor(abs/7)}-${abs%7}`,`${B.format(Math.floor(abs/7))}週と${abs%7}日`);}
    else B.clear(['days-between','days-inclusive','weeks-days']);
    const base=B.parseDate(B.$('base-date').value),offset=B.read('offset-days',{integer:true});
    const date=base && offset!==null ? new Date(base.getTime()+offset*B.DAY):null;
    if(date && B.iso(date)) B.put('result-date',B.iso(date),B.dateText(date)); else B.put('result-date',null);
    B.message(from && to && date && B.iso(date)?'':'日付と整数の日数を入力してください。計算できる日付は西暦1〜9999年です。');
  });
})();
