'use strict';
window.Benri = (() => {
  const DAY = 86400000;
  const eras = [
    {key:'meiji', name:'明治', start:'1868-10-23', year:1868, max:45, end:'1912年7月29日'},
    {key:'taisho', name:'大正', start:'1912-07-30', year:1912, max:15, end:'1926年12月24日'},
    {key:'showa', name:'昭和', start:'1926-12-25', year:1926, max:64, end:'1989年1月7日'},
    {key:'heisei', name:'平成', start:'1989-01-08', year:1989, max:31, end:'2019年4月30日'},
    {key:'reiwa', name:'令和', start:'2019-05-01', year:2019, max:null}
  ];
  const $ = id => document.getElementById(id);
  function normalize(value) {
    return String(value).replace(/[０-９．，＋－]/g, c => String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/[,\s]/g,'').replace(/−/g,'-');
  }
  function number(value, {min=-Infinity, max=Infinity, integer=false}={}) {
    const s = normalize(value);
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= min && n <= max && (!integer || Number.isSafeInteger(n)) ? n : null;
  }
  const read = (id, options) => number($(id).value, options);
  function utc(y,m,d) {
    const date = new Date(0);
    date.setUTCFullYear(y,m-1,d); date.setUTCHours(0,0,0,0);
    return date;
  }
  function parseDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return null;
    const [y,m,d] = match.slice(1).map(Number);
    if (y<1 || m<1 || m>12 || d<1 || d>31) return null;
    const date = utc(y,m,d);
    return date.getUTCFullYear()===y && date.getUTCMonth()===m-1 && date.getUTCDate()===d ? date : null;
  }
  function iso(date) {
    if (!date || !Number.isFinite(date.getTime()) || date.getUTCFullYear()<1 || date.getUTCFullYear()>9999) return '';
    return `${String(date.getUTCFullYear()).padStart(4,'0')}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
  }
  const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const dateText = date => `${date.getUTCFullYear()}年${date.getUTCMonth()+1}月${date.getUTCDate()}日（${'日月火水木金土'[date.getUTCDay()]}）`;
  const eraLabel = (era,year) => `${era.name}${year===1?'元':year}年`;
  function wareki(date) {
    const value = iso(date);
    if (!value) return '';
    const era = [...eras].reverse().find(e=>value>=e.start);
    return era ? `${eraLabel(era,date.getUTCFullYear()-era.year+1)}${date.getUTCMonth()+1}月${date.getUTCDate()}日` : '明治より前には対応していません';
  }
  function warekiYear(year) {
    if (!Number.isSafeInteger(year) || year<1868) return '';
    return eras.filter((e,i)=>year>=e.year && (!eras[i+1] || year<=eras[i+1].year)).map(e=>eraLabel(e,year-e.year+1)).join(' / ');
  }
  const eto = year => ['子（ね）','丑（うし）','寅（とら）','卯（う）','辰（たつ）','巳（み）','午（うま）','未（ひつじ）','申（さる）','酉（とり）','戌（いぬ）','亥（い）'][((year-4)%12+12)%12];
  const format = n => n.toLocaleString('ja-JP',{maximumFractionDigits:12});
  const round = (n,d=2) => { const p=10**d; return Math.round((n+Number.EPSILON*Math.abs(n))*p)/p; };
  function put(id,value,text) {
    const el=$(id);
    if (!el) return;
    if (value===null || value===undefined || (typeof value==='number' && !Number.isFinite(value))) {el.dataset.value='';el.textContent='—';return;}
    el.dataset.value=String(value); el.textContent=text===undefined ? (typeof value==='number'?format(value):String(value)) : text;
  }
  const clear = ids => ids.forEach(id=>put(id,null));
  const message = (text,id='message') => {const el=$(id);if(el) el.textContent=text;};
  function watch(update,root=document) {
    root.addEventListener('input',update);root.addEventListener('change',update);update();
  }
  function dates(ids) {ids.forEach(id=>{if($(id)) $(id).value=today();});}
  return {$,DAY,eras,normalize,number,read,utc,parseDate,iso,today,dateText,wareki,warekiYear,eto,format,round,put,clear,message,watch,dates,eraLabel};
})();
