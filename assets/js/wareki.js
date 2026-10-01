'use strict';
(() => {
  const B=window.Benri;B.dates(['date-input']);
  const yearNow=new Date().getFullYear();B.$('era-year').value=String(yearNow-2018);B.$('year-input').value=String(yearNow);
  const body=B.$('era-table-body');
  for(let y=1926;y<=2030;y++) {const tr=document.createElement('tr');[`${y}年`,B.warekiYear(y),B.eto(y),y<=yearNow?`${yearNow-y}歳`:'未出生'].forEach(text=>{const td=document.createElement('td');td.textContent=text;tr.appendChild(td);});body.appendChild(tr);}
  B.$('table-year').textContent=String(yearNow);
  B.watch(()=>{
    const date=B.parseDate(B.$('date-input').value);
    if(date){const result=B.wareki(date);B.put('wareki-result',B.iso(date)<B.eras[0].start?null:result);B.message(B.iso(date)<B.eras[0].start?'明治より前には対応していません。':'','date-message');}else{B.put('wareki-result',null);B.message('日付を選んでください。','date-message');}
    const era=B.eras.find(e=>e.key===B.$('era').value),year=B.read('era-year',{min:1,integer:true});
    if(year===null){B.put('seireki-result',null);B.message('元年は1として、1以上の整数を入力してください。','era-message');}
    else if(era.max && year>era.max){B.put('seireki-result',null);B.message(`${era.name}は${era.max}年（${era.end}）までです。`,'era-message');}
    else if(!Number.isSafeInteger(era.year+year-1)){B.put('seireki-result',null);B.message('計算できる範囲を超えています。年数を小さくしてください。','era-message');}
    else{const y=era.year+year-1;B.put('seireki-result',y,`${y}年`);B.message('改元があった年は、月日によって元号が異なります。','era-message');}
    const y=B.read('year-input',{min:1,integer:true}),wa=y!==null?B.warekiYear(y):'';
    B.put('wareki-year-result',wa||null);B.message(wa?'':y!==null && y<1868?'明治より前には対応していません。':'西暦年を1以上の整数で入力してください。','year-message');
  });
})();
