'use strict';
(() => {
  const B=window.Benri, ids=['age-years','age-detail','kazoe','birth-wareki','school-grade','eto'];
  B.dates(['basedate']);
  function anniversary(b,y) { return B.utc(y,b.getUTCMonth()+1,b.getUTCDate()); }
  function addMonths(date,n) {
    const y=date.getUTCFullYear(),m=date.getUTCMonth();
    const first=B.utc(y,m+n+1,1);
    const last=B.utc(first.getUTCFullYear(),first.getUTCMonth()+2,0).getUTCDate();
    return B.utc(first.getUTCFullYear(),first.getUTCMonth()+1,Math.min(date.getUTCDate(),last));
  }
  B.watch(()=>{
    const birth=B.parseDate(B.$('birthdate').value),base=B.parseDate(B.$('basedate').value);
    B.message('');
    if(!birth || !base || birth>base) {B.clear(ids); B.message(birth && base ? '生年月日は基準日以前の日付を選んでください。':'生年月日と基準日を入力してください。');return;}
    let years=base.getUTCFullYear()-birth.getUTCFullYear();
    if(anniversary(birth,base.getUTCFullYear())>base) years--;
    const reached=anniversary(birth,birth.getUTCFullYear()+years);
    let months=0;
    while(months<11 && addMonths(reached,months+1)<=base) months++;
    const days=Math.round((base-addMonths(reached,months))/B.DAY);
    B.put('age-years',years,`${years}歳`);
    B.put('age-detail',`${years}-${months}-${days}`,`${years}歳${months}ヶ月${days}日`);
    B.put('kazoe',base.getUTCFullYear()-birth.getUTCFullYear()+1,`${base.getUTCFullYear()-birth.getUTCFullYear()+1}歳`);
    const wa=B.wareki(birth);B.put('birth-wareki',wa);
    const early=birth.getUTCMonth()<3 || (birth.getUTCMonth()===3 && birth.getUTCDate()===1);
    const entry=birth.getUTCFullYear()+(early?6:7);
    const fiscal=base.getUTCFullYear()-(base.getUTCMonth()<3?1:0),n=fiscal-entry+1;
    const grade=n>=17?'—（学齢を過ぎています）':n>=13?`大学${n-12}年生相当`:n>=10?`高校${n-9}年生`:n>=7?`中学${n-6}年生`:n>=1?`小学${n}年生`:n===0?'年長（5歳児クラス）':n===-1?'年中（4歳児クラス）':n===-2?'年少（3歳児クラス）':'未就学';
    B.put('school-grade',grade);B.put('eto',B.eto(birth.getUTCFullYear()));
  });
})();
