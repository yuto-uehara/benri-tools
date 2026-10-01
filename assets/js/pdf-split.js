// 指定順にページ範囲をコピーし、範囲ごとにPDFを出力する。
import { $, task, load, bindInput, requireFile, ranges, integer, copy, baseName, download, done, note } from './pdf-common.js';
let item;
bindInput('pdf-input', files => task(async () => {
  item = undefined;
  item = await load(files[0]);
  note(`総ページ数：${item.doc.getPageCount()}`);
}));
$('run').onclick = () => task(async () => {
  requireFile(item);
  const count = item.doc.getPageCount(),
    mode = document.querySelector('[name=split-mode]:checked').value;
  let groups;
  if (mode === 'ranges') groups = ranges($('ranges').value, count);else {
    const n = mode === 'every' ? 1 : integer('chunk-size');
    groups = [];
    for (let i = 1; i <= count; i += n) groups.push(Array.from({
      length: Math.min(n, count - i + 1)
    }, (_, j) => i + j));
  }
  for (const [i, g] of groups.entries()) {
    note(`分割中… ${i + 1}/${groups.length}`);
    download(await (await copy(item, g)).save(), `${baseName(item.file.name)}_p${g[0]}${g.length > 1 ? '-' + g.at(-1) : ''}.pdf`);
  }
  done();
});
