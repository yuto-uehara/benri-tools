'use strict';
(() => {
  const B=window.Benri;
  const length={mm:0.001,cm:0.01,m:1,km:1000,in:0.0254,ft:0.3048,yd:0.9144,mi:1609.344,shaku:10/33,sun:1/33,ken:60/33,ri:12960/33};
  const weight={mg:0.001,g:1,kg:1000,t:1000000,oz:28.349523125,lb:453.59237,monme:3.75,kan:3750,kin:600};
  const labels={shaku:'尺',sun:'寸',ken:'間',ri:'里',monme:'匁',kan:'貫',kin:'斤'};
  B.watch(()=>{
    [['length',length],['weight',weight]].forEach(([type,units])=>{
      const value=B.read(`${type}-value`,{min:0}),selected=B.$(`${type}-unit`).value;
      let valid=value!==null;
      Object.entries(units).forEach(([key,factor])=>{
        const el=B.$(`${type}-results`).querySelector(`[data-unit="${key}"]`),result=value===null?null:(selected===key?value:value*units[selected]/factor);
        if(result===null || !Number.isFinite(result)){el.dataset.value='';el.textContent='—';valid=false;}
        else{el.dataset.value=String(result);const display=Number(result.toPrecision(8));el.textContent=`${display.toLocaleString('ja-JP',{maximumSignificantDigits:8})} ${labels[key]||key}`;}
      });
      B.message(valid?'':'0以上の数値を入力してください。大きすぎる値は換算できません。',`${type}-message`);
    });
  });
})();
