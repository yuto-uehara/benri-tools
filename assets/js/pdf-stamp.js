// 日本語を透過PNGに描画し、元の回転を考慮して配置する。
import { $, task, load, bindInput, requireFile, integer, copy, baseName, download, done, note } from './pdf-common.js';
let item;
bindInput('pdf-input', files => task(async () => {
  item = undefined;
  item = await load(files[0]);
  note(`総ページ数：${item.doc.getPageCount()}`);
}));
$('run').onclick = () => task(async () => {
  requireFile(item);
  const mode = document.querySelector('[name=stamp-mode]:checked').value,
    size = Number($('font-size').value),
    opacity = Number($('opacity').value);
  if (!Number.isFinite(size) || size < 1 || size > 200) throw Error('文字サイズは1〜200ptで指定してください。');
  if (!Number.isFinite(opacity) || opacity < 0.1 || opacity > 1) throw Error('不透明度は0.1〜1で指定してください。');
  const start = integer('start-number', 0),
    skip = $('skip-first').checked;
  if (mode === 'text' && !$('stamp-text').value.trim()) throw Error('挿入するテキストを入力してください。');
  const doc = await copy(item, item.doc.getPages().map((_, i) => i + 1));
  for (const [i, page] of doc.getPages().entries()) {
    if (mode === 'number' && skip && i === 0) continue;
    note(`挿入中… ${i + 1}/${doc.getPageCount()}`);
    const n = start + i - (skip ? 1 : 0),
      format = $('number-format').value;
    const text = mode === 'text' ? $('stamp-text').value : format === 'n-total' ? `${n} / ${doc.getPageCount()}` : format === 'dash' ? `- ${n} -` : format === 'page-ja' ? `${n}ページ` : String(n);
    const canvas = document.createElement('canvas'),
      ctx = canvas.getContext('2d');
    ctx.font = `${size * 4}px system-ui, sans-serif`;
    const width = Math.ceil(ctx.measureText(text).width + size * 4),
      height = Math.ceil(size * 6);
    if (width * height > 16000000 || width > 16000) throw Error('テキストが長すぎます。短くするか文字サイズを下げてください。');
    canvas.width = width;
    canvas.height = height;
    ctx.font = `${size * 4}px system-ui, sans-serif`;
    ctx.fillStyle = $('color').value;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size * 2, height / 2);
    const png = await new Promise(r => canvas.toBlob(r, 'image/png')),
      image = await doc.embedPng(await png.arrayBuffer());
    const r = (page.getRotation().angle % 360 + 360) % 360,
      pw = page.getWidth(),
      ph = page.getHeight(),
      vw = r % 180 ? ph : pw,
      vh = r % 180 ? pw : ph;
    let w = width / 4,
      h = height / 4;
    const shrink = Math.min(1, Math.max(1, vw - 24) / w, Math.max(1, vh - 24) / h);
    w *= shrink;
    h *= shrink;
    const pos = $('position').value;
    let x = pos.endsWith('left') ? 12 : pos.endsWith('right') ? vw - w - 12 : (vw - w) / 2,
      y = pos.startsWith('top') ? vh - h - 12 : pos === 'center' ? (vh - h) / 2 : 12;
    let px = x,
      py = y;
    if (r === 90) {
      px = pw - y;
      py = x;
    } else if (r === 180) {
      px = pw - x;
      py = ph - y;
    } else if (r === 270) {
      px = y;
      py = ph - x;
    }
    page.drawImage(image, {
      x: px,
      y: py,
      width: w,
      height: h,
      rotate: PDFLib.degrees(r),
      opacity
    });
  }
  download(await doc.save(), `${baseName(item.file.name)}_stamped.pdf`);
  done();
});
