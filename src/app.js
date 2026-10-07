const STORAGE_KEY = 'notice-tool-state-v1';
const DATA_VERSION = 1;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const defaultNotice = () => ({
  id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  title: 'ご案内',
  description: 'こちらに説明文を入力してください。\n改行もそのまま反映されます。',
  url: '',
  showQr: true,
  image: '',
  titleColor: '#111827',
  bodyColor: '#111827',
  backgroundColor: '#ffffff'
});

const defaultState = () => ({
  version: DATA_VERSION,
  settings: { orientation: 'portrait', layout: 'single' },
  notices: [defaultNotice()]
});

let state = loadLocalState();
let imageFiles = [];

const orientationEl = $('#orientation');
const layoutModeEl = $('#layoutMode');
const noticeEditorsEl = $('#noticeEditors');
const previewAreaEl = $('#previewArea');
const pageCountEl = $('#pageCount');
const printPageStyleEl = $('#printPageStyle');

boot();

async function boot() {
  orientationEl.value = state.settings.orientation;
  layoutModeEl.value = state.settings.layout;
  bindGlobalEvents();
  await loadImageFiles();
  renderAll();
}

function bindGlobalEvents() {
  orientationEl.addEventListener('change', () => {
    state.settings.orientation = orientationEl.value;
    commit();
  });
  layoutModeEl.addEventListener('change', () => {
    state.settings.layout = layoutModeEl.value;
    commit();
  });
  $('#addNotice').addEventListener('click', () => {
    state.notices.push(defaultNotice());
    commit();
    requestAnimationFrame(() => $$('.editor-card').at(-1)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
  });
  $('#exportJson').addEventListener('click', exportJson);
  $('#importJson').addEventListener('click', () => $('#jsonFile').click());
  $('#jsonFile').addEventListener('change', importJson);
  $('#printPdf').addEventListener('click', () => window.print());
  window.addEventListener('resize', updatePreviewZoom);
}

async function loadImageFiles() {
  try {
    const res = await fetch('assets/images.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('manifest unavailable');
    const json = await res.json();
    imageFiles = Array.isArray(json) ? json.filter(v => typeof v === 'string') : [];
  } catch {
    imageFiles = [];
  }
}

function renderAll() {
  renderEditors();
  renderPreview();
  updatePrintPageRule();
  saveLocalState();
}

function commit() { renderAll(); }

function renderEditors() {
  noticeEditorsEl.innerHTML = '';
  state.notices.forEach((notice, index) => {
    const card = document.createElement('article');
    card.className = 'editor-card';
    card.dataset.id = notice.id;

    const imageOptions = imageOptionHtml(notice.image);
    card.innerHTML = `
      <div class="editor-card-header">
        <strong>案内 ${index + 1}</strong>
        <div class="editor-actions">
          <button type="button" class="small move-up" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="small move-down" ${index === state.notices.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="small duplicate">複製</button>
          <button type="button" class="small danger delete" ${state.notices.length === 1 ? 'disabled' : ''}>削除</button>
        </div>
      </div>
      <div class="editor-body">
        <label class="field">
          <span>タイトル</span>
          <input type="text" data-key="title" value="${escapeAttr(notice.title)}" placeholder="タイトル">
        </label>
        <label class="field">
          <span>上部画像</span>
          <select data-key="image">${imageOptions}</select>
          <p class="help">リポジトリの images フォルダ内の画像を選択します。</p>
        </label>
        <label class="field full">
          <span>説明文</span>
          <textarea data-key="description" placeholder="説明文">${escapeHtml(notice.description)}</textarea>
          <p class="help">入力した改行をそのまま掲示物へ反映します。</p>
        </label>
        <label class="field">
          <span>URL</span>
          <input type="url" data-key="url" value="${escapeAttr(notice.url)}" placeholder="https://example.com/">
        </label>
        <label class="field">
          <span>QRコード</span>
          <span class="check-row"><input type="checkbox" data-key="showQr" ${notice.showQr ? 'checked' : ''}> URLのQRコードを表示</span>
        </label>
        <div class="field full">
          <span class="field-label">色</span>
          <div class="color-row">
            ${colorControl('titleColor', 'タイトル', notice.titleColor)}
            ${colorControl('bodyColor', '説明文・URL', notice.bodyColor)}
            ${colorControl('backgroundColor', '背景', notice.backgroundColor)}
          </div>
        </div>
      </div>`;

    bindEditorCard(card, index);
    noticeEditorsEl.append(card);
  });
}

function bindEditorCard(card, index) {
  $$('[data-key]', card).forEach(el => {
    const eventName = el.matches('select,input[type="checkbox"],input[type="color"]') ? 'change' : 'input';
    el.addEventListener(eventName, () => {
      const key = el.dataset.key;
      state.notices[index][key] = el.type === 'checkbox' ? el.checked : el.value;
      if (el.type === 'color') {
        const value = el.closest('.color-field')?.querySelector('.color-value');
        if (value) value.textContent = el.value.toUpperCase();
      }
      renderPreview();
      saveLocalState();
    });
  });

  $('.move-up', card).addEventListener('click', () => moveNotice(index, -1));
  $('.move-down', card).addEventListener('click', () => moveNotice(index, 1));
  $('.duplicate', card).addEventListener('click', () => {
    const copy = typeof structuredClone === 'function' ? structuredClone(state.notices[index]) : JSON.parse(JSON.stringify(state.notices[index]));
    copy.id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    state.notices.splice(index + 1, 0, copy);
    commit();
  });
  $('.delete', card).addEventListener('click', () => {
    if (state.notices.length <= 1) return;
    state.notices.splice(index, 1);
    commit();
  });
}

function moveNotice(index, delta) {
  const target = index + delta;
  if (target < 0 || target >= state.notices.length) return;
  [state.notices[index], state.notices[target]] = [state.notices[target], state.notices[index]];
  commit();
}

function renderPreview() {
  previewAreaEl.innerHTML = '';
  const perPage = state.settings.layout === 'split' ? 2 : 1;
  const pages = chunk(state.notices, perPage);
  pageCountEl.textContent = `${pages.length}ページ / ${state.notices.length}件`;

  pages.forEach((items, pageIndex) => {
    const wrap = document.createElement('div');
    wrap.className = 'preview-page-wrap';
    wrap.innerHTML = `<p class="preview-page-label">${pageIndex + 1} / ${pages.length} ページ</p>`;

    const page = document.createElement('div');
    page.className = `a4-page ${state.settings.orientation} ${state.settings.layout}`;

    for (let slot = 0; slot < perPage; slot++) {
      const notice = items[slot];
      if (notice) page.append(createNoticePanel(notice));
      else {
        const empty = document.createElement('div');
        empty.className = 'notice-panel empty-panel';
        page.append(empty);
      }
    }
    wrap.append(page);
    previewAreaEl.append(wrap);
  });
  updatePrintPageRule();
  requestAnimationFrame(updatePreviewZoom);
}

function createNoticePanel(notice) {
  const panel = document.createElement('section');
  panel.className = 'notice-panel';
  panel.style.setProperty('--notice-bg', safeColor(notice.backgroundColor, '#ffffff'));
  panel.style.setProperty('--title-color', safeColor(notice.titleColor, '#111827'));
  panel.style.setProperty('--body-color', safeColor(notice.bodyColor, '#111827'));
  panel.style.setProperty('--title-size', titleSize(notice.title));
  panel.style.setProperty('--body-size', bodySize(notice.description));

  if (notice.image) {
    const imageWrap = document.createElement('div');
    imageWrap.className = 'notice-image-wrap';
    const img = document.createElement('img');
    img.className = 'notice-image';
    img.alt = '';
    img.src = imagePath(notice.image);
    img.addEventListener('error', () => imageWrap.remove());
    imageWrap.append(img);
    panel.append(imageWrap);
  }

  const content = document.createElement('div');
  content.className = 'notice-content';
  const title = document.createElement('h3');
  title.className = 'notice-title';
  title.textContent = notice.title || '';
  content.append(title);

  const description = document.createElement('p');
  description.className = 'notice-description';
  description.textContent = notice.description || '';
  content.append(description);

  const normalizedUrl = normalizeUrl(notice.url);
  if (notice.showQr && normalizedUrl) {
    const qrBlock = document.createElement('div');
    qrBlock.className = 'notice-qr-block';
    const canvas = document.createElement('canvas');
    canvas.className = 'notice-qr';
    canvas.setAttribute('aria-label', 'QRコード');
    try {
      window.NoticeQR.draw(canvas, normalizedUrl, { size: 600, quietZone: 4 });
      qrBlock.append(canvas);
    } catch (error) {
      console.warn('QR generation failed:', error);
    }
    const urlText = document.createElement('div');
    urlText.className = 'notice-url';
    urlText.textContent = normalizedUrl;
    qrBlock.append(urlText);
    content.append(qrBlock);
  }
  panel.append(content);
  return panel;
}

function titleSize(text = '') {
  const n = [...text].length;
  const split = state.settings.layout === 'split';
  if (split) return n > 30 ? '6mm' : n > 18 ? '7mm' : '8.5mm';
  return n > 36 ? '8mm' : n > 22 ? '10mm' : '12mm';
}

function bodySize(text = '') {
  const n = [...text].length;
  const lines = String(text).split('\n').length;
  const split = state.settings.layout === 'split';
  if (split) return n > 220 || lines > 8 ? '3.4mm' : n > 120 ? '3.8mm' : '4.3mm';
  return n > 360 || lines > 12 ? '4.2mm' : n > 200 ? '5mm' : '6mm';
}

function updatePreviewZoom() {
  const available = Math.max(260, previewAreaEl.clientWidth - 44);
  $$('.preview-page-wrap', previewAreaEl).forEach(wrap => {
    const page = $('.a4-page', wrap);
    if (!page) return;
    wrap.style.zoom = '1';
    const width = page.getBoundingClientRect().width;
    const zoom = Math.min(1, available / width);
    wrap.style.zoom = String(zoom);
  });
}

function updatePrintPageRule() {
  const orientation = state.settings.orientation === 'landscape' ? 'landscape' : 'portrait';
  printPageStyleEl.textContent = `@page { size: A4 ${orientation}; margin: 0; }`;
}

function imageOptionHtml(current) {
  const files = [...new Set([...(current ? [current] : []), ...imageFiles])];
  return [
    `<option value=""${current ? '' : ' selected'}>画像なし</option>`,
    ...files.map(file => `<option value="${escapeAttr(file)}"${file === current ? ' selected' : ''}>${escapeHtml(file)}</option>`)
  ].join('');
}

function imagePath(file) {
  return `images/${String(file).split('/').map(encodeURIComponent).join('/')}`;
}

function colorControl(key, label, value) {
  const color = safeColor(value, '#111827');
  return `<label class="color-field"><input type="color" data-key="${key}" value="${color}"><span><span class="field-label">${label}</span><br><span class="color-value">${color.toUpperCase()}</span></span></label>`;
}

function exportJson() {
  const data = JSON.stringify({ ...state, version: DATA_VERSION }, null, 2);
  const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `notice_${timestamp()}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

async function importJson(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    state = normalizeState(parsed);
    orientationEl.value = state.settings.orientation;
    layoutModeEl.value = state.settings.layout;
    commit();
  } catch (error) {
    alert(`JSONを読み込めませんでした。\n${error.message}`);
  }
}

function normalizeState(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('JSON形式が正しくありません。');
  const notices = Array.isArray(raw.notices) && raw.notices.length ? raw.notices : [defaultNotice()];
  return {
    version: DATA_VERSION,
    settings: {
      orientation: raw.settings?.orientation === 'landscape' ? 'landscape' : 'portrait',
      layout: raw.settings?.layout === 'split' ? 'split' : 'single'
    },
    notices: notices.map(n => ({
      ...defaultNotice(),
      ...n,
      id: n.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
      showQr: n.showQr !== false,
      titleColor: safeColor(n.titleColor, '#111827'),
      bodyColor: safeColor(n.bodyColor, '#111827'),
      backgroundColor: safeColor(n.backgroundColor, '#ffffff')
    }))
  };
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : defaultState();
  } catch {
    return defaultState();
  }
}

function saveLocalState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

function normalizeUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  try {
    const url = new URL(text.match(/^https?:\/\//i) ? text : `https://${text}`);
    return url.href;
  } catch {
    return text;
  }
}

function safeColor(value, fallback) { return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback; }
function chunk(array, size) { return Array.from({ length: Math.ceil(array.length / size) }, (_, i) => array.slice(i * size, i * size + size)); }
function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escapeAttr(value) { return escapeHtml(value).replace(/`/g, '&#96;'); }
function timestamp() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
