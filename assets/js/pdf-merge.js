import { $, task, sizes, load, note, bindInput, list, download, done } from './pdf-common.js';
const items=[]; const render=()=>{list(items,render);$('run').disabled=items.length<2;};render();
bindInput('pdf-input', files=>task(async()=>{sizes([...items.map(i=>i.file),...files]);const added=[];for(const [i,f] of files.entries()){note(`読み込み中… ${i+1}/${files.length}`);added.push(await load(f));}items.push(...added);render();}).then(()=>render()));
$('run').onclick=()=>task(async()=>{if(items.length<2)throw Error('PDFを2ファイル以上選んでください。');const doc=await PDFLib.PDFDocument.create();for(const [i,item]of items.entries()){note(`結合中… ${i+1}/${items.length}`);(await doc.copyPages(item.doc,item.doc.getPageIndices())).forEach(p=>doc.addPage(p));}download(await doc.save(),'merged.pdf');done();});
