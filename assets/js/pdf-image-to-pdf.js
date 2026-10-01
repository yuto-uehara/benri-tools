// JPG/PNGを検証してから追加し、画像の縦横比を保って配置する。
import { $, task, sizes, bindInput, list, download, done, note } from './pdf-common.js';
const items = [];
const render = () => list(items, render);
bindInput('image-input', files => task(async () => {
  sizes([...items.map(i => i.file), ...files]);
  const added = [];
  try {
    for (const f of files) {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const jpg = bytes[0] === 255 && bytes[1] === 216,
        png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
      if (!jpg && !png) throw Error('JPG/PNGのみ対応しています。');
      const test = await PDFLib.PDFDocument.create();
      try {
        await (jpg ? test.embedJpg(bytes) : test.embedPng(bytes));
      } catch (e) {
        throw Error('画像を読み込めません。破損していないJPG/PNGを選んでください。');
      }
      added.push({
        file: f,
        bytes,
        jpg,
        url: URL.createObjectURL(f)
      });
    }
    items.push(...added);
    render();
  } catch (e) {
    added.forEach(i => URL.revokeObjectURL(i.url));
    throw e;
  }
}));
$('run').onclick = () => task(async () => {
  if (!items.length) throw Error('まず画像を選んでください。');
  const doc = await PDFLib.PDFDocument.create();
  for (const [i, item] of items.entries()) {
    note(`変換中… ${i + 1}/${items.length}`);
    const img = await (item.jpg ? doc.embedJpg(item.bytes) : doc.embedPng(item.bytes));
    let w = img.width,
      h = img.height;
    const size = $('page-size').value,
      m = Number($('margin').value) * 72 / 25.4;
    if (size !== 'fit') {
      [w, h] = size === 'a4' ? [595.2756, 841.8898] : [612, 792];
      const o = $('orientation').value;
      if (o === 'landscape' || o === 'auto' && img.width > img.height) [w, h] = [h, w];
    } else {
      w += m * 2;
      h += m * 2;
    }
    const ratio = Math.min((w - 2 * m) / img.width, (h - 2 * m) / img.height),
      iw = img.width * ratio,
      ih = img.height * ratio;
    doc.addPage([w, h]).drawImage(img, {
      x: (w - iw) / 2,
      y: (h - ih) / 2,
      width: iw,
      height: ih
    });
  }
  download(await doc.save(), 'images.pdf');
  done();
});
