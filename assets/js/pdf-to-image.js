// 1ページずつ描画し、巨大なキャンバスは倍率を下げてメモリを抑える。
import { $, task, load, bindInput, requireFile, renderer, releaseRenderer, ranges, baseName, download, done, note } from './pdf-common.js';
let item;
bindInput('pdf-input', files => task(async () => {
  item = undefined;
  item = await load(files[0]);
  note(`総ページ数：${item.doc.getPageCount()}`);
}));
function format() {
  $('jpeg-options').hidden = $('format').value !== 'jpeg';
}
$('format').onchange = format;
format();
$('run').onclick = () => task(async () => {
  requireFile(item);
  const numbers = $('pages').value.trim() ? ranges($('pages').value, item.doc.getPageCount()).flat() : item.doc.getPages().map((_, i) => i + 1),
    pdf = await renderer(item);
  let reduced = false;
  try {
    for (const [i, n] of numbers.entries()) {
      note(`画像変換中… ${i + 1}/${numbers.length}`);
      const p = await pdf.getPage(n),
        initial = p.getViewport({
          scale: Number($('scale').value)
        });
      let scale = Number($('scale').value);
      if (initial.width * initial.height > 16000000) {
        scale *= Math.sqrt(15900000 / (initial.width * initial.height));
        reduced = true;
      }
      const vp = p.getViewport({
          scale
        }),
        canvas = document.createElement('canvas');
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      await p.render({
        canvasContext: canvas.getContext('2d'),
        viewport: vp,
        background: 'white'
      }).promise;
      const fmt = $('format').value,
        blob = await new Promise(resolve => canvas.toBlob(resolve, fmt === 'png' ? 'image/png' : 'image/jpeg', Number($('jpeg-quality').value)));
      if (!blob) throw Error('画像を生成できません。倍率を下げてお試しください。');
      download(blob, `${baseName(item.file.name)}_p${n}.${fmt === 'png' ? 'png' : 'jpg'}`, blob.type, true);
      canvas.width = canvas.height = 0;
      p.cleanup();
    }
    done();
    if (reduced) note('完了しました。大きなページは端末のメモリ不足を避けるため倍率を下げました。');
  } finally {
    await releaseRenderer(pdf);
  }
});
