'use strict';
(() => {
  const B=window.Benri,fields=['hourly','monthly','annual'],outputs=['summary-hourly','summary-monthly','summary-annual','summary-daily','summary-annual-hours'];
  let source='hourly';
  function update(event) {
    if(event && fields.includes(event.target.id)) source=event.target.id;
    const h=B.read('hours-per-day',{min:Number.MIN_VALUE,max:24}),d=B.read('days-per-month',{min:Number.MIN_VALUE,max:31}),bonus=B.read('bonus',{min:0}),value=B.read(source,{min:0});
    B.message('');
    function invalid(text){B.clear(outputs);fields.filter(id=>id!==source).forEach(id=>B.$(id).value='');B.message(text);}
    if(h===null || d===null || bonus===null || value===null){invalid('時間は0より大きく24以下、日数は0より大きく31以下で、金額は0以上を入力してください。');return;}
    let monthly=source==='hourly'?value*h*d:source==='monthly'?value:(value-bonus)/12;
    if(monthly<0){invalid('年収は年間賞与以上の金額を入力してください。');return;}
    const hourly=monthly/(h*d),annual=monthly*12+bonus,values={hourly,monthly,annual};
    if(Object.values(values).some(n=>!Number.isFinite(n) || !Number.isSafeInteger(Math.round(n)))){invalid('計算できる範囲を超えています。条件や金額を見直してください。');return;}
    fields.forEach(id=>{const rounded=Math.round(values[id]);if(id!==source) B.$(id).value=String(rounded);B.put(`summary-${id}`,rounded,`${B.format(rounded)}円`);});
    B.put('summary-daily',Math.round(hourly*h),`${B.format(Math.round(hourly*h))}円`);
    const hours=h*d*12;B.put('summary-annual-hours',hours,`${B.format(hours)}時間`);
  }
  B.watch(update);
})();
