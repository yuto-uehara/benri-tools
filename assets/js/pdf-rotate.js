import { $, task, load, bindInput, requireFile, thumbnails, button, copy, baseName, download, done, note } from './pdf-common.js';
let item,
  pages = [];
function rotate(p, d) {
  p.angle = (p.angle + d + 360) % 360;
  p.node.querySelector('.preview').style.transform = `rotate(${p.angle}deg)`;
}
bindInput('pdf-input', files => task(async () => {
  item = undefined;
  pages = [];
  $('page-grid').replaceChildren();
  item = await load(files[0]);
  pages = item.doc.getPages().map((_, i) => {
    const p = {
      n: i + 1,
      angle: 0,
      node: document.createElement('div')
    };
    p.node.className = 'page-item';
    p.node.dataset.page = p.n;
    const preview = document.createElement('div');
    preview.className = 'preview';
    const label = document.createElement('p');
    label.textContent = `ページ ${p.n}`;
    p.node.append(preview, label, button('⟳ 右90°', 'rotate-right', () => rotate(p, 90)), button('⟲ 左90°', 'rotate-left', () => rotate(p, -90)));
    $('page-grid').append(p.node);
    return p;
  }); // 既存ノードのプレビューだけを非同期に更新し、操作状態は保持する。
  void thumbnails(item, pages.map(p => p.node));
  note(`総ページ数：${pages.length}`);
}));
for (const [id, d] of [['rotate-all-right', 90], ['rotate-all-left', -90], ['rotate-all-180', 180]]) $(id).onclick = () => pages.forEach(p => rotate(p, d));
$('run').onclick = () => task(async () => {
  requireFile(item);
  const doc = await copy(item, pages.map(p => p.n));
  doc.getPages().forEach((p, i) => p.setRotation(PDFLib.degrees((p.getRotation().angle + pages[i].angle + 360) % 360)));
  download(await doc.save(), `${baseName(item.file.name)}_rotated.pdf`);
  done();
});
