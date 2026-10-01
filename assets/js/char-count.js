'use strict';
(() => {
  const B=window.Benri;
  function update() {
    const text=B.$('text').value.replace(/\r\n?/g,'\n'),lines=text?text.split('\n'):[];
    B.put('count-all',Array.from(text).length);
    B.put('count-no-newline',Array.from(text.replace(/\n/g,'')).length);
    B.put('count-no-space',Array.from(text.replace(/[ \u3000\t\n]/g,'')).length);
    B.put('count-lines',lines.length);
    B.put('count-paragraphs',lines.filter(line=>/\S/u.test(line)).length);
    B.put('count-bytes',new TextEncoder().encode(text).length,`${B.format(new TextEncoder().encode(text).length)}バイト`);
    B.put('manuscript-pages',Math.ceil(lines.reduce((sum,line)=>sum+Math.max(1,Math.ceil(Array.from(line).length/20)),0)/20),`${Math.ceil(lines.reduce((sum,line)=>sum+Math.max(1,Math.ceil(Array.from(line).length/20)),0)/20)}枚`);
  }
  B.$('clear-text').addEventListener('click',()=>{B.$('text').value='';update();B.$('text').focus();});B.watch(update);
})();
