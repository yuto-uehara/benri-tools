// PDF tools only: all document data stays in this browser.
export const $ = id => document.getElementById(id);
export const baseName = name => name.replace(/\.[^.]+$/, '');
let urls = [],
  busy = false,
  sizeWarning = false;
let singleInput = false,
  singleReady = false;
// 読み込みの成否を実行ボタンに反映し、拒否理由を保持する。
function updateSingleControls() {
  if (!singleInput) return;
  for (const id of ['run', 'extract', 'rotate-all-right', 'rotate-all-left', 'rotate-all-180']) {
    if ($(id)) $(id).disabled = busy || !singleReady;
  }
}
export function clearResult() {
  urls.forEach(URL.revokeObjectURL);
  urls = [];
  $('pdf-result').replaceChildren();
  $('pdf-result').dataset.state = 'idle';
  $('pdf-error').textContent = '';
}
export function fail(error) {
  $('pdf-error').textContent = error instanceof Error ? /encrypt|password/i.test(error.message) ? '暗号化されたPDFには対応していません。パスワード保護を解除したPDFを選んでください。' : error.message : String(error);
  $('pdf-result').dataset.state = 'error';
}
export function note(s) {
  $('pdf-status').textContent = s + (sizeWarning ? ' 50MBを超えるファイルは時間がかかる場合があります。' : '');
}
export async function task(fn) {
  if (busy) return;
  busy = true;
  sizeWarning = false;
  clearResult();
  const buttons = [...document.querySelectorAll('button')];
  const disabled = buttons.map(b => b.disabled);
  buttons.forEach(b => b.disabled = true);
  document.querySelectorAll('input[type=file]').forEach(i => i.disabled = true);
  try {
    await fn();
  } catch (e) {
    fail(e);
    note('処理を完了できませんでした。');
  } finally {
    buttons.forEach((b, i) => b.disabled = disabled[i]);
    document.querySelectorAll('input[type=file]').forEach(i => i.disabled = false);
    busy = false;
    updateSingleControls();
  }
}
export function sizes(files) {
  if (files.some(f => f.size > 100 * 1024 ** 2) || files.reduce((a, f) => a + f.size, 0) > 300 * 1024 ** 2) throw Error('端末のメモリ不足を避けるため、1ファイル100MB以下、合計300MB以下で選んでください。');
  sizeWarning = sizeWarning || files.some(f => f.size > 50 * 1024 ** 2);
  if (sizeWarning) note('ファイル容量を確認しました。');
}
export async function load(file) {
  sizes([file]);
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') throw Error('PDFファイルを選んでください。');
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const doc = await PDFLib.PDFDocument.load(bytes);
    if (!doc.getPageCount()) throw Error('ページがありません');
    if (singleInput) singleReady = true;
    return {
      file,
      bytes,
      doc
    };
  } catch (e) {
    if (/encrypt|password/i.test(e.message)) throw e;
    throw Error('PDFを読み込めません。破損していないPDFファイルを選んでください。');
  }
}
export function requireFile(file) {
  if (!file) throw Error('まずファイルを選んでください。');
  return file;
}
export function download(data, name, type = 'application/pdf', preview = false) {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], {
    type
  }));
  urls.push(url);
  const a = document.createElement('a');
  a.className = 'pdf-download';
  a.href = url;
  a.download = name;
  a.textContent = `ダウンロード：${name}`;
  if (preview) {
    const img = document.createElement('img');
    img.src = url;
    img.alt = name;
    a.prepend(img);
  }
  $('pdf-result').append(a);
  a.click();
}
export function done() {
  $('pdf-result').dataset.state = 'done';
  note('完了しました。下のリンクから再度ダウンロードできます。');
}
export function bindInput(id, handler) {
  const input = $(id),
    zone = $('drop-zone');
  singleInput = id === 'pdf-input' && !input.multiple;
  updateSingleControls();
  const select = async files => {
    if (busy || !files.length) return;
    if (singleInput) {
      singleReady = false;
      updateSingleControls();
    }
    $('selected-files').textContent = [...files].map(f => f.name).join('、');
    await handler([...files]);
    input.value = '';
  };
  input.addEventListener('change', () => select(input.files));
  if (zone) {
    zone.addEventListener('dragover', e => {
      e.preventDefault();
    });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      select(e.dataTransfer.files);
    });
  }
}
export function ranges(text, count) {
  const t = text.normalize('NFKC').replace(/[、，]/g, ',').replace(/[‐‑–—−ー]/g, '-');
  if (!t.trim()) throw Error('ページ範囲を入力してください。');
  return t.split(',').map(part => {
    const m = part.trim().match(/^(\d+)\s*(?:-\s*(\d*)\s*)?$/);
    if (!m) throw Error('範囲は「1-3, 5, 7-」の形式で指定してください。');
    const a = Number(m[1]),
      b = m[2] === undefined ? a : m[2] === '' ? count : Number(m[2]);
    if (a < 1 || b < a || b > count) throw Error(`ページ範囲は1〜${count}の中で指定してください。`);
    return Array.from({
      length: b - a + 1
    }, (_, i) => a + i);
  });
}
let pdfjsPromise;
// PDFDocumentProxy と読み込みタスクを対応付け、タスク側で解放する。
const rendererTasks = new WeakMap();
async function disposeTask(loadingTask) {
  try {
    await loadingTask.destroy();
  } catch {/* 後始末で成功結果をエラーにしない。 */}
}
export async function releaseRenderer(pdf) {
  const loadingTask = rendererTasks.get(pdf);
  if (loadingTask) {
    rendererTasks.delete(pdf);
    await disposeTask(loadingTask);
  }
}
export async function renderer(item) {
  if (!pdfjsPromise) pdfjsPromise = import('../vendor/pdfjs/pdf.min.mjs').then(lib => {
    lib.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
    return lib;
  });
  const lib = await pdfjsPromise;
  const loadingTask = lib.getDocument({
    data: item.bytes.slice(),
    cMapUrl: new URL('../vendor/pdfjs/cmaps/', import.meta.url).href,
    cMapPacked: true,
    standardFontDataUrl: new URL('../vendor/pdfjs/standard_fonts/', import.meta.url).href,
    wasmUrl: new URL('../vendor/pdfjs/wasm/', import.meta.url).href
  });
  try {
    const pdf = await loadingTask.promise;
    rendererTasks.set(pdf, loadingTask);
    return pdf;
  } catch (error) {
    await disposeTask(loadingTask);
    throw error;
  }
}
export async function thumbnails(item, nodes) {
  let pdf;
  try {
    pdf = await renderer(item);
    for (let i = 0; i < nodes.length; i++) {
      if (!nodes[i].isConnected) break;
      const page = await pdf.getPage(i + 1),
        vp = page.getViewport({
          scale: 1
        }),
        canvas = document.createElement('canvas'),
        view = page.getViewport({
          scale: 140 / vp.width
        });
      canvas.width = Math.ceil(view.width);
      canvas.height = Math.ceil(view.height);
      await page.render({
        canvasContext: canvas.getContext('2d'),
        viewport: view
      }).promise;
      nodes[i].querySelector('.preview').replaceChildren(canvas);
      page.cleanup();
    }
  } catch (e) {
    nodes.forEach(n => {
      if (!n.querySelector('canvas')) n.querySelector('.preview').textContent = 'プレビューできません';
    });
  } finally {
    if (pdf) await releaseRenderer(pdf);
  }
}
export function button(label, cls, fn) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = label;
  b.onclick = () => {
    if (!busy) fn();
  };
  return b;
}
export function list(items, render) {
  $('file-list').replaceChildren();
  items.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'file-item';
    const p = document.createElement('p');
    p.textContent = `${item.file.name} / ${item.doc ? item.doc.getPageCount() + 'ページ / ' : ''}${(item.file.size / 1024 / 1024).toFixed(2)} MB`;
    row.append(p);
    if (item.url) {
      const img = document.createElement('img');
      img.src = item.url;
      img.alt = item.file.name;
      row.prepend(img);
    }
    [['↑', 'move-up', -1], ['↓', 'move-down', 1]].forEach(([l, c, d]) => {
      const b = button(l, c, () => {
        const j = i + d;
        if (j >= 0 && j < items.length) {
          [items[i], items[j]] = [items[j], items[i]];
          render();
        }
      });
      b.disabled = i + d < 0 || i + d >= items.length;
      row.append(b);
    });
    row.append(button('削除', 'remove', () => {
      if (item.url) URL.revokeObjectURL(item.url);
      items.splice(i, 1);
      clearResult();
      render();
    }));
    $('file-list').append(row);
  });
}
export async function copy(item, numbers) {
  const doc = await PDFLib.PDFDocument.create();
  const pages = await doc.copyPages(item.doc, numbers.map(n => n - 1));
  pages.forEach(p => doc.addPage(p));
  return doc;
}
export function integer(id, min = 1) {
  const n = Number($(id).value.normalize('NFKC').replace(/,/g, ''));
  if (!Number.isSafeInteger(n) || n < min) throw Error('有効な整数を入力してください。');
  return n;
}
