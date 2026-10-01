'use strict';
(() => {
  const B=window.Benri;
  B.watch(()=>{
    const amount=B.read('amount',{min:0,integer:true}),rate=Number(document.querySelector('input[name="rate"]:checked').value),direction=document.querySelector('input[name="direction"]:checked').value;
    B.message('');
    if(amount===null){B.clear(['result-excl','result-tax','result-incl']);B.message('金額を0以上の整数で入力してください。');return;}
    const numerator=BigInt(amount)*BigInt(rate),denominator=BigInt(direction==='excl'?100:100+rate);
    let tax=numerator/denominator,remainder=numerator%denominator;
    const rounding=B.$('rounding').value;
    if((rounding==='ceil' && remainder>0n) || (rounding==='round' && remainder*2n>=denominator)) tax++;
    const t=Number(tax),excl=direction==='excl'?amount:amount-t,incl=direction==='excl'?amount+t:amount;
    if(!Number.isSafeInteger(incl)){B.clear(['result-excl','result-tax','result-incl']);B.message('金額が大きすぎます。より小さな金額を入力してください。');return;}
    [['result-excl',excl],['result-tax',t],['result-incl',incl]].forEach(([id,n])=>B.put(id,n,`${B.format(n)}円`));
  });
})();
