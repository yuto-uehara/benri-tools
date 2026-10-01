'use strict';
(() => {
  const B=window.Benri;
  B.watch(()=>{
    const total=B.read('total',{min:0,integer:true}),people=B.read('people',{min:1,integer:true}),unit=B.read('unit',{min:1,integer:true});
    B.message('');B.$('breakdown').textContent='';
    if(total===null || people===null || unit===null){B.clear(['per-person','organizer','exact']);B.message('合計金額は0以上、人数は1以上の整数で入力してください。');return;}
    const per=people===1?total:(B.$('mode').value==='up'?Math.ceil:Math.floor)(total/people/unit)*unit;
    const organizer=total-per*(people-1),exact=B.round(total/people);
    if(!Number.isSafeInteger(per) || !Number.isSafeInteger(organizer)){B.clear(['per-person','organizer','exact']);B.message('計算できる範囲を超えています。金額や人数を小さくしてください。');return;}
    B.put('per-person',per,`${B.format(per)}円`);B.put('organizer',organizer,`${B.format(organizer)}円`);B.put('exact',exact,`${exact.toLocaleString('ja-JP',{minimumFractionDigits:2,maximumFractionDigits:2})}円`);
    B.$('breakdown').textContent=`${B.format(per)}円 × ${B.format(people-1)}人 ＋ 幹事 ${B.format(organizer)}円 ＝ ${B.format(total)}円`;
    if(organizer<0) B.message('単位が大きすぎます。幹事の支払額がマイナスになるため、丸め単位を小さくしてください。');
  });
})();
