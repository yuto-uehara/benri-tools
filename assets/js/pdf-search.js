// 検索・座標計算・出力を端末内で行う。PDF座標の四隅を表示と保存で共有する。
import {
  $, bindInput, load, renderer, releaseRenderer, clearResult, fail, note,
  task, baseName, download, done
} from './pdf-common.js';
import { TextLayer } from '../vendor/pdfjs/pdf.min.mjs';

const palette = ['#ffeb3b', '#69d9ee', '#95df8a', '#f7a4c7', '#c7a5ef'];
const viewer = $('viewer');
const count = $('match-count');
const measure = document.createElement('canvas').getContext('2d');
let session,
  fileVersion = 0,
  searchVersion = 0,
  navigationVersion = 0;
let matches = [],
  keywords = [],
  current = -1,
  debounce,
  resizeTimer,
  exporting = false;
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const active = s => session === s && s.version === fileVersion;

function controls() {
  const ready = matches.length > 0 && !exporting;
  $('prev-match').disabled = $('next-match').disabled = !ready;
  $('export').disabled = exporting || !!session && !session.complete;
}

function updateCurrent() {
  count.dataset.current = current < 0 ? '0' : String(current + 1);
  count.textContent = !count.dataset.query ? '' : matches.length ? `${current + 1}/${matches.length}件` : '0件';
  viewer.querySelectorAll('.hit').forEach(hit => hit.classList.toggle('current', Number(hit.dataset.index) === current));
  const list = $('result-list');
  list.querySelectorAll('button').forEach(button => {
    const selected = Number(button.dataset.index) === current;
    button.classList.toggle('is-current', selected);
    button.setAttribute('aria-current', selected ? 'true' : 'false');
    if (selected) {
      // 一覧内だけをスクロールし、ページ全体の移動はnavigateに任せる。
      const row = button.getBoundingClientRect();
      const top = list.getBoundingClientRect().top + list.clientTop;
      const bottom = top + list.clientHeight;
      if (row.top < top || row.height > list.clientHeight) {
        list.scrollTop += row.top - top;
      } else if (row.bottom > bottom) {
        list.scrollTop += row.bottom - bottom;
      }
    }
  });
  $('match-announcement').textContent = current < 0 ? '' : `${matches.length}件中${current + 1}件目、${matches[current].page.number}ページ：${matches[current].keyword.text}`;
  controls();
}

function resetSearch() {
  ++searchVersion;
  ++navigationVersion;
  clearTimeout(debounce);
  matches = [];
  keywords = [];
  current = -1;
  count.dataset.total = '0';
  count.dataset.current = '0';
  count.dataset.query = $('search-input').value;
  count.dataset.state = session && !session.complete ? 'searching' : 'done';
  $('keyword-summary').replaceChildren();
  $('result-list').replaceChildren();
  updateCurrent();
}

function discardPage(record) {
  ++record.drawVersion;
  record.renderTask?.cancel();
  record.textLayer?.cancel();
  record.renderTask = record.textLayer = null;
  const canvas = record.node.querySelector('canvas');
  if (canvas) canvas.width = canvas.height = 0;
  record.node.replaceChildren();
  record.rendered = false;
}

function dispose(s) {
  if (!s) return;
  s.observer?.disconnect();
  s.pages.forEach(discardPage);
  if (s.pdf) void releaseRenderer(s.pdf);
}

function sizePage(record) {
  const initial = record.page.getViewport({
    scale: 1
  });
  const scale = Math.min(800, viewer.clientWidth) / initial.width;
  record.viewport = record.page.getViewport({
    scale: Math.max(Number.EPSILON, scale)
  });
  record.node.style.width = `${record.viewport.width}px`;
  record.node.style.height = `${record.viewport.height}px`;
  // pdf.js TextLayerは回転前の寸法で配置し、レイヤー全体を回転する。
  record.node.style.setProperty('--total-scale-factor', record.viewport.scale * record.viewport.userUnit);
  record.node.style.setProperty('--scale-round-x', '1px');
  record.node.style.setProperty('--scale-round-y', '1px');
}

bindInput('pdf-input', async files => {
  const version = ++fileVersion;
  dispose(session);
  const s = {
    version,
    pages: [],
    pdf: null,
    item: null,
    complete: false,
    jumpAfterExtraction: false,
    queue: Promise.resolve(),
    viewerWidth: viewer.clientWidth
  };
  session = s;
  viewer.replaceChildren();
  clearResult({
    resetSizeWarning: true
  });
  resetSearch();
  $('search-input').disabled = false;
  $('no-text-message').hidden = true;
  note('PDFを読み込み中…');
  try {
    const item = await load(files[0]);
    if (!active(s)) return;
    const pdf = await renderer(item);
    if (!active(s)) {
      await releaseRenderer(pdf);
      return;
    }
    s.pdf = pdf;
    s.item = item;
    // 最初に全ページの枠だけ作り、canvasは可視範囲に入るまで作らない。
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      if (!active(s)) return;
      const node = document.createElement('div');
      node.className = 'pdf-page';
      node.dataset.page = n;
      node.setAttribute('aria-label', `${n}ページ`);
      const record = {
        number: n,
        page,
        node,
        content: null,
        text: '',
        items: [],
        hits: [],
        drawVersion: 0,
        rendered: false,
        nearby: false
      };
      s.pages.push(record);
      viewer.append(node);
      sizePage(record);
    }
    if ('IntersectionObserver' in window) {
      s.observer = new IntersectionObserver(entries => {
        if (!active(s)) return;
        for (const entry of entries) {
          const record = s.pages[Number(entry.target.dataset.page) - 1];
          record.nearby = entry.isIntersecting;
          if (record.nearby) {
            void drawPage(s, record);
          } else if (record.rendered || record.renderTask) {
            discardPage(record);
          }
        }
      }, {
        rootMargin: '500px 0px'
      });
      s.pages.forEach(record => s.observer.observe(record.node));
    } else {
      checkVisible();
    }
    // 抽出は順番に行い、入力やスクロールのイベントを受け付ける。
    for (const record of s.pages) {
      note(`テキストを読み取り中… ${record.number}/${pdf.numPages}`);
      const content = await record.page.getTextContent();
      if (!active(s)) return;
      cacheText(record, content);
      if (record.nearby) void drawPage(s, record);
      await pause();
    }
    if (!active(s)) return;
    s.complete = true;
    const empty = s.pages.filter(p => !p.text.trim()).map(p => p.number);
    if (empty.length) {
      $('no-text-message').hidden = false;
      $('no-text-message').textContent = empty.length === s.pages.length ? 'このPDFには文字情報（テキストレイヤー）がありません。スキャンした画像のPDFは、OCR（文字認識）で文字情報を付けないと検索できません。' : `${empty.slice(0, 20).join('、')}${empty.length > 20 ? ` ほか${empty.length - 20}ページ` : ''}ページ目は文字情報がないため検索対象外です。`;
      $('search-input').disabled = empty.length === s.pages.length;
    }
    note(`テキストの読み取り完了：${pdf.numPages}ページ`);
    const jump = s.jumpAfterExtraction;
    s.jumpAfterExtraction = false;
    await search(jump);
  } catch (error) {
    if (!active(s)) return;
    dispose(s);
    s.complete = true;
    s.item = null;
    viewer.replaceChildren();
    resetSearch();
    fail(error);
    note('処理を完了できませんでした。');
    controls();
  }
});
function cacheText(record, content) {
  record.content = content;
  // 正規化ON/OFF別の比較文字列と元位置の対応表を、ページの存続中は再利用する。
  record.comparisons = new Map();
  let offset = 0;
  for (const item of content.items) {
    if (typeof item.str !== 'string') continue;
    const style = content.styles[item.fontName] || {};
    record.items.push({
      item,
      style,
      start: offset,
      end: offset + item.str.length,
      widths: null
    });
    record.text += item.str;
    offset += item.str.length;
    // hasEOLを区切りにして異なる行の誤一致を避ける。同じ行のアイテム境界は連結。
    if (item.hasEOL) {
      record.text += '\n';
      offset++;
    }
  }
}

// 正規化後の各UTF-16位置を元文字の開始・終了へ戻す。㈱などの展開も対応。
function comparable(text, normalize) {
  let value = '',
    starts = [],
    ends = [],
    offset = 0;
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    let character = chars[i];
    // 半角カナの濁点と結合文字は直前の文字と一緒に正規化する。
    if (normalize && i + 1 < chars.length && /[\uFF9E\uFF9F\u0300-\u036f\u3099\u309a]/u.test(chars[i + 1])) character += chars[++i];
    const converted = normalize ? character.normalize('NFKC').toLowerCase() : character;
    for (let j = 0; j < converted.length; j++) {
      starts.push(offset);
      ends.push(offset + character.length);
    }
    value += converted;
    offset += character.length;
  }
  return {
    value,
    starts,
    ends
  };
}

function characterWidths(segment) {
  if (segment.widths) return segment.widths;
  const {
    item,
    style
  } = segment;
  measure.font = `100px ${style.fontFamily || 'sans-serif'}`;
  let total = 0,
    offset = 0;
  const widths = [0];
  for (const char of item.str) {
    const width = Math.max(0, measure.measureText(char).width);
    for (let j = 1; j <= char.length; j++) widths[offset + j] = total + width * j / char.length;
    total += width;
    offset += char.length;
  }
  const extent = style.vertical ? item.height : item.width;
  segment.widths = widths.map((w, i) => total ? w / total * extent : i / Math.max(1, item.str.length) * extent);
  return segment.widths;
}

function quadsFor(record, start, end) {
  const quads = [];
  for (const segment of record.items) {
    if (segment.end <= start || segment.start >= end || !segment.item.str.length) continue;
    const {
      item,
      style
    } = segment;
    const [a, b, c, d, x, y] = item.transform;
    const size = Math.hypot(c, d) || Math.hypot(a, b) || item.height || 1;
    const angle = Math.atan2(b, a) + (style.vertical ? Math.PI / 2 : 0);
    const ux = Math.cos(angle),
      uy = Math.sin(angle);
    // 上方向はtransformの第2列。斜体のせん断も保ち、縦書きは文字の横方向にする。
    const up = style.vertical || Math.hypot(c, d) === 0 ? [-uy * size, ux * size] : [c, d];
    const ascent = Number.isFinite(style.ascent) ? style.ascent : 0.8;
    const descent = Number.isFinite(style.descent) ? style.descent : -0.2;
    const widths = characterWidths(segment);
    let left = widths[Math.max(0, start - segment.start)];
    let right = widths[Math.min(item.str.length, end - segment.start)];
    if (item.dir === 'rtl') [left, right] = [widths.at(-1) - right, widths.at(-1) - left];
    const point = (along, height) => [x + ux * along + up[0] * height, y + uy * along + up[1] * height];
    // Acrobat互換: テキストの左上・右上・左下・右下。
    quads.push([point(left, ascent), point(right, ascent), point(left, descent), point(right, descent)]);
  }
  return quads;
}

async function search(jump = true) {
  clearTimeout(debounce);
  debounce = null;
  const version = ++searchVersion,
    s = session;
  ++navigationVersion;
  const query = $('search-input').value,
    normalize = $('normalize').checked;
  const words = $('multi').checked ? query.split(/[ \u3000]+/).filter(Boolean) : query ? [query] : [];
  const terms = words.map((text, index) => ({
    text,
    value: comparable(text, normalize).value,
    color: palette[index % palette.length],
    count: 0
  }));
  count.dataset.query = query;
  count.dataset.state = 'searching';
  const found = [],
    byPage = new Map();
  for (const record of s?.pages || []) {
    if (!record.content) continue;
    let mapped = record.comparisons.get(normalize);
    if (!mapped) {
      mapped = comparable(record.text, normalize);
      record.comparisons.set(normalize, mapped);
    }
    const hits = [];
    for (const keyword of terms) {
      if (!keyword.value) continue;
      let from = 0,
        position,
        previousStart = -1,
        previousEnd = -1;
      while ((position = mapped.value.indexOf(keyword.value, from)) !== -1) {
        const start = mapped.starts[position],
          end = mapped.ends[position + keyword.value.length - 1];
        // 展開した一文字の中に同じ語が複数あっても元範囲は一度だけ数える。
        if (start !== previousStart || end !== previousEnd) {
          hits.push({
            page: record,
            keyword,
            start,
            end,
            quads: quadsFor(record, start, end)
          });
          keyword.count++;
        }
        previousStart = start;
        previousEnd = end;
        from = position + keyword.value.length;
      }
    }
    hits.sort((a, b) => a.start - b.start || terms.indexOf(a.keyword) - terms.indexOf(b.keyword));
    byPage.set(record, hits);
    found.push(...hits);
    if (record.number % 8 === 0) {
      await pause();
      if (version !== searchVersion || session !== s) return;
    }
  }
  if (version !== searchVersion || session !== s) return;
  matches = found;
  keywords = terms;
  current = matches.length ? 0 : -1;
  matches.forEach((hit, index) => hit.index = index);
  for (const record of s?.pages || []) {
    record.hits = byPage.get(record) || [];
    paintHits(record);
  }
  count.dataset.total = String(matches.length);
  count.dataset.state = s && !s.complete ? 'searching' : 'done';
  showSummary();
  showResults();
  updateCurrent();
  if (jump && current >= 0 && s?.complete) await navigate(current);
}

function showSummary() {
  $('keyword-summary').replaceChildren();
  if (!$('multi').checked) return;
  for (const keyword of keywords) {
    const chip = document.createElement('span');
    chip.className = 'keyword-chip';
    const swatch = document.createElement('span');
    swatch.className = 'keyword-swatch';
    swatch.style.backgroundColor = keyword.color;
    swatch.setAttribute('aria-hidden', 'true');
    chip.append(swatch, document.createTextNode(`${keyword.text}：${keyword.count}件`));
    $('keyword-summary').append(chip);
  }
}

function showResults() {
  const list = $('result-list');
  list.replaceChildren();
  for (const hit of matches.slice(0, 500)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'result-item';
    button.dataset.index = hit.index;
    button.dataset.page = hit.page.number;
    const label = document.createElement('span');
    label.className = 'result-page';
    label.textContent = `p.${hit.page.number}`;
    const snippet = document.createElement('span'),
      mark = document.createElement('mark');
    mark.style.backgroundColor = hit.keyword.color;
    mark.textContent = hit.page.text.slice(hit.start, hit.end);
    snippet.append(document.createTextNode(hit.page.text.slice(Math.max(0, hit.start - 20), hit.start)), mark, document.createTextNode(hit.page.text.slice(hit.end, hit.end + 20)));
    button.append(label, snippet);
    button.onclick = () => {
      if (!exporting) void navigate(hit.index);
    };
    list.append(button);
  }
  if (matches.length > 500) {
    const p = document.createElement('p');
    p.textContent = `ほか${matches.length - 500}件（「前へ」「次へ」で移動できます）`;
    list.append(p);
  }
}

function paintHits(record) {
  const layer = record.node.querySelector('.hit-layer');
  if (!layer) return;
  layer.replaceChildren();
  for (const hit of record.hits) {
    for (const quad of hit.quads) {
      const points = quad.map(p => record.viewport.convertToViewportPoint(...p));
      const xs = points.map(p => p[0]),
        ys = points.map(p => p[1]);
      const left = Math.min(...xs),
        top = Math.min(...ys),
        width = Math.max(...xs) - left,
        height = Math.max(...ys) - top;
      if (width <= 0 || height <= 0) continue;
      const div = document.createElement('div');
      div.className = 'hit';
      div.dataset.index = hit.index;
      div.dataset.page = record.number;
      div.classList.toggle('current', hit.index === current);
      div.style.backgroundColor = hit.keyword.color;
      Object.assign(div.style, {
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        clipPath: `polygon(${[points[0], points[1], points[3], points[2]].map(p => `${(p[0] - left) / width * 100}% ${(p[1] - top) / height * 100}%`).join(',')})`
      });
      layer.append(div);
    }
  }
}

async function drawPage(s, record, force = false) {
  if (!active(s) || record.rendered || !record.content) return;
  if (force) record.nearby = true;
  if (record.pending && record.pendingVersion === record.drawVersion) return record.pending;
  const drawVersion = record.drawVersion;
  const work = async () => {
    if (!active(s) || record.drawVersion !== drawVersion || !force && !record.nearby) return;
    const viewport = record.viewport,
      canvas = document.createElement('canvas');
    const ratio = Math.min(window.devicePixelRatio || 1, 3, Math.sqrt(15900000 / (viewport.width * viewport.height)), 16000 / Math.max(viewport.width, viewport.height));
    canvas.width = Math.max(1, Math.floor(viewport.width * ratio));
    canvas.height = Math.max(1, Math.floor(viewport.height * ratio));
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;
    canvas.setAttribute('aria-hidden', 'true');
    const text = document.createElement('div');
    text.className = 'textLayer';
    const layer = document.createElement('div');
    layer.className = 'hit-layer';
    layer.setAttribute('aria-hidden', 'true');
    record.node.replaceChildren(canvas, text, layer);
    try {
      record.renderTask = record.page.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
        transform: [canvas.width / viewport.width, 0, 0, canvas.height / viewport.height, 0, 0],
        background: 'white'
      });
      await record.renderTask.promise;
      if (!active(s) || record.drawVersion !== drawVersion) return;
      record.textLayer = new TextLayer({
        textContentSource: record.content,
        container: text,
        viewport
      });
      await record.textLayer.render();
      if (!active(s) || record.drawVersion !== drawVersion) return;
      // round()未対応のSafariでもTextLayerの回転前寸法を正しく指定する。
      const textScale = viewport.scale * viewport.userUnit;
      text.style.width = `${viewport.rawDims.pageWidth * textScale}px`;
      text.style.height = `${viewport.rawDims.pageHeight * textScale}px`;
      record.rendered = true;
      paintHits(record);
    } catch (error) {
      if (active(s) && record.drawVersion === drawVersion && !/cancel/i.test(error.name)) {
        discardPage(record);
        record.node.textContent = 'このページはプレビューできません。検索結果は保存できます。';
      }
    } finally {
      if (record.drawVersion === drawVersion) record.renderTask = null;
    }
  };
  const pending = s.queue.then(work);
  record.pending = pending;
  record.pendingVersion = drawVersion;
  s.queue = pending.catch(() => {});
  try {
    await pending;
  } finally {
    if (record.pending === pending) record.pending = null;
  }
}

async function navigate(index) {
  if (!matches.length) return;
  const token = ++navigationVersion,
    s = session;
  current = (index + matches.length) % matches.length;
  updateCurrent();
  const hit = matches[current],
    record = hit.page;
  await drawPage(s, record, true);
  if (token !== navigationVersion || !active(s)) return;
  const points = hit.quads.flat().map(point => record.viewport.convertToViewportPoint(...point));
  const y = points.length ? points.reduce((sum, point) => sum + point[1], 0) / points.length : record.viewport.height / 2;
  const toolbarHeight = document.querySelector('.search-toolbar').getBoundingClientRect().height;
  window.scrollTo({
    top: Math.max(0, window.scrollY + record.node.getBoundingClientRect().top + y - (window.innerHeight + toolbarHeight) / 2),
    behavior: 'auto'
  });
}

function checkVisible() {
  const s = session;
  if (!s || s.observer) return;
  for (const record of s.pages) {
    const rect = record.node.getBoundingClientRect();
    record.nearby = rect.bottom > -500 && rect.top < window.innerHeight + 500;
    if (record.nearby) {
      void drawPage(s, record);
    } else if (record.rendered) {
      discardPage(record);
    }
  }
}

window.addEventListener('scroll', checkVisible, {
  passive: true
});
function resizeViewer() {
  // Safariのアドレスバーによる高さだけの変更ではcanvasを破棄しない。
  if (!session || viewer.clientWidth === session.viewerWidth) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const s = session;
    if (!s || viewer.clientWidth === s.viewerWidth) return;
    s.viewerWidth = viewer.clientWidth;
    for (const record of s.pages) {
      discardPage(record);
      sizePage(record);
      if (record.nearby) void drawPage(s, record);
    }
  }, 150);
}

window.addEventListener('resize', checkVisible);
if ('ResizeObserver' in window) {
  const resizeObserver = new ResizeObserver(resizeViewer);
  resizeObserver.observe(viewer);
} else {
  window.addEventListener('resize', resizeViewer);
}

$('search-input').addEventListener('input', () => {
  ++searchVersion;
  ++navigationVersion;
  // このファイルの抽出中に入力された語だけ、抽出完了後に最初の一致へ移動する。
  if (session && !session.complete) session.jumpAfterExtraction = !!$('search-input').value;
  count.dataset.query = $('search-input').value;
  count.dataset.state = 'searching';
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    void search();
  }, 200);
});
$('search-input').addEventListener('keydown', async event => {
  if (event.key !== 'Enter' || event.isComposing) return;
  event.preventDefault();
  if (debounce || count.dataset.state !== 'done') await search(false);
  if (!matches.length) {
    if (!session) note('まずPDFファイルを選んでください。');
    return;
  }
  await navigate(current + (event.shiftKey ? -1 : 1));
});
for (const id of ['normalize', 'multi']) $(id).addEventListener('change', () => {
  void search();
});
$('prev-match').onclick = () => {
  void navigate(current - 1);
};
$('next-match').onclick = () => {
  void navigate(current + 1);
};

function colorRGB(color) {
  return [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255);
}

function pathFor(quad) {
  const order = [quad[0], quad[1], quad[3], quad[2]];
  return `${order[0].join(' ')} m\n${order.slice(1).map(p => `${p.join(' ')} l`).join('\n')}\nh f`;
}

function annotate(doc, page, hit) {
  const {
      PDFName,
      PDFHexString,
      PDFArray
    } = PDFLib,
    context = doc.context;
  const points = hit.quads.flat(),
    xs = points.map(p => p[0]),
    ys = points.map(p => p[1]);
  const rect = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  const rgb = colorRGB(hit.keyword.color);
  // BBoxと描画座標をどちらもPDFユーザー空間にする。ページのRotateを再適用しない。
  const appearance = context.flateStream(`q\n/GS0 gs\n${rgb.join(' ')} rg\n${hit.quads.map(pathFor).join('\n')}\nQ`, {
    Type: 'XObject',
    Subtype: 'Form',
    FormType: 1,
    BBox: rect,
    Matrix: [1, 0, 0, 1, 0, 0],
    Resources: {
      ExtGState: {
        GS0: {
          Type: 'ExtGState',
          BM: 'Multiply',
          ca: 0.5,
          CA: 0.5
        }
      }
    }
  });
  const annotation = context.obj({
    Type: 'Annot',
    Subtype: 'Highlight',
    Rect: rect,
    QuadPoints: hit.quads.flat(2),
    C: rgb,
    CA: 1,
    F: 4,
    Contents: PDFHexString.fromText(hit.keyword.text),
    T: PDFHexString.fromText('PDF内検索・ハイライト'),
    M: PDFHexString.fromText(`D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z`),
    P: page.ref,
    AP: {
      N: context.register(appearance)
    }
  });
  let annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (!annots) {
    annots = context.obj([]);
    page.node.set(PDFName.of('Annots'), annots);
  }
  annots.push(context.register(annotation));
}

function drawHighlight(doc, page, hit, graphics) {
  const lib = PDFLib,
    rgb = colorRGB(hit.keyword.color);
  let gs = graphics.get(page);
  if (!gs) {
    const state = doc.context.obj({
      Type: 'ExtGState',
      ca: 0.4,
      BM: 'Multiply'
    });
    gs = page.node.newExtGState('SearchHighlight', doc.context.register(state));
    graphics.set(page, gs);
  }
  const ops = [lib.pushGraphicsState(), lib.setGraphicsState(gs), lib.setFillingRgbColor(...rgb)];
  for (const quad of hit.quads) {
    ops.push(lib.moveTo(...quad[0]), lib.lineTo(...quad[1]), lib.lineTo(...quad[3]), lib.lineTo(...quad[2]), lib.closePath(), lib.fill());
  }
  ops.push(lib.popGraphicsState());
  page.pushOperators(...ops);
}

$('export').onclick = async () => {
  if (!session?.item) {
    note('まずPDFファイルを選んでください。');
    return;
  }
  if (!session.complete || exporting) return;
  exporting = true;
  controls();
  $('search-input').disabled = true;
  $('normalize').disabled = $('multi').disabled = true;
  try {
    await task(async () => {
      // デバウンス待ちの入力も保存前に確定する。
      await search(false);
      if (!matches.length) throw Error('ハイライトする一致箇所がありません。検索語を入力してください。');
      const s = session,
        snapshot = matches.slice(),
        mode = $('export-mode').value;
      const doc = await PDFLib.PDFDocument.load(s.item.bytes),
        pages = doc.getPages(),
        graphics = new Map();
      for (let i = 0; i < snapshot.length; i++) {
        const hit = snapshot[i];
        if (!active(s)) return;
        note(`ハイライトを保存中… ${i + 1}/${snapshot.length}`);
        if (hit.quads.length) {
          if (mode === 'annot') {
            annotate(doc, pages[hit.page.number - 1], hit);
          } else {
            drawHighlight(doc, pages[hit.page.number - 1], hit, graphics);
          }
        }
        if (i % 25 === 0) await pause();
      }
      const bytes = await doc.save();
      if (!active(s)) return;
      download(bytes, `${baseName(s.item.file.name)}_highlighted.pdf`);
      done();
    });
  } finally {
    exporting = false;
    $('search-input').disabled = !!session && session.complete && session.pages.every(p => !p.text.trim());
    $('normalize').disabled = $('multi').disabled = false;
    controls();
  }
};
window.addEventListener('pagehide', event => {
  if (!event.persisted) {
    ++fileVersion;
    dispose(session);
  }
});
controls();
