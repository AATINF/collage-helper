/**
 * 拼图助手 · 入口（只负责装配和界面交互，具体能力都在 core/ 和 io/ 里）
 *
 * 想改功能时的地图：
 *   加模板          -> core/templates.js
 *   改绘制/输出     -> core/compose.js
 *   改保存/分享     -> io/bridge.js（+ android 里的 FileSaverPlugin.java）
 *   改草稿存储      -> io/draft.js
 *   改界面结构      -> index.html + styles.css
 */
import { state, update, subscribe, metaSnapshot, restoreMeta, resetPhotos } from './state.js';
import { templatesFor, templateById, templateSVG } from './core/templates.js';
import { loadImage, makeThumb } from './core/image.js';
import { drawGrid, drawLong, canvasToBlob, MAX_LONG_EDGE } from './core/compose.js';
import { pickImages, onlyImages } from './io/picker.js';
import { saveImage, openSaved, shareSaved, timestampName, IS_APP } from './io/bridge.js';
import { saveDraft, loadDraft, clearDraft } from './io/draft.js';
import { toast } from './ui/toast.js';

const $ = id => document.getElementById(id);
const MAX_PHOTOS = 9;
const PREVIEW_SIZE = 700;   // 预览用的 canvas 边长（不是最终画质）

/* ---------------- 屏幕切换 ---------------- */
function show(which) {
  $('screen-pick').classList.toggle('active', which === 'pick');
  $('screen-edit').classList.toggle('active', which === 'edit');
}

/* ---------------- ① 选图页 ---------------- */
function renderAlbum() {
  const album = $('album');
  album.innerHTML = '';

  state.photos.forEach((p, i) => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.innerHTML = `<img src="${p.thumb}" alt=""><span class="badge">${i + 1}</span>
      <button class="del" aria-label="移除">×</button>`;
    tile.querySelector('.del').onclick = e => {
      e.stopPropagation();
      removePhoto(i);
    };
    album.appendChild(tile);
  });

  if (state.photos.length < MAX_PHOTOS) {
    const add = document.createElement('button');
    add.className = 'tile add';
    add.innerHTML = '<span>+</span><em>添加照片</em>';
    add.onclick = () => addFromPicker();
    album.appendChild(add);
  }

  const n = state.photos.length;
  const btn = $('btnStart');
  btn.textContent = n ? `开始拼图（${n} 张）` : '开始拼图';
  btn.disabled = n < 2;
}

async function addFromPicker() {
  const room = MAX_PHOTOS - state.photos.length;
  if (room <= 0) return toast(`最多 ${MAX_PHOTOS} 张，够拼了`);
  const files = onlyImages(await pickImages());
  if (!files.length) return;
  await addPhotos(files.slice(0, room));
  if (files.length > room) toast(`最多 ${MAX_PHOTOS} 张，多余的没加进来`);
}

async function addPhotos(files) {
  for (const file of files) {
    try {
      const img = await loadImage(file);
      state.photos.push({ file, img, thumb: makeThumb(img, 320), crop: { scale: 1, x: 0, y: 0 } });
    } catch (e) {
      console.warn('跳过一张读不了的图', file.name, e);
      toast(`「${file.name || '某张图'}」打不开，已跳过`);
    }
  }
  update(() => {});
  renderAlbum();
  queueDraftSave();
}

function removePhoto(i) {
  const gone = state.photos.splice(i, 1)[0];
  if (gone && gone.img && gone.img.bitmap && gone.img.bitmap.close) {
    try { gone.img.bitmap.close(); } catch (e) {}
  }
  renderAlbum();
  queueDraftSave();
}

/* ---------------- ② 编辑页 ---------------- */
function enterEdit(mode) {
  if (state.photos.length < 2) return toast('至少选 2 张照片');
  state.mode = mode;
  if (mode === 'grid') {
    const list = templatesFor(state.photos.length);
    if (!list.length) return toast('这个张数还没有对应版式');
    if (!list.some(t => t.id === state.tplId)) state.tplId = list[0].id;
  }
  renderEdit();
  show('edit');
  queueDraftSave();
}

function currentTemplate() {
  return state.mode === 'grid' ? templateById(state.tplId) : null;
}

function renderEdit() {
  const grid = state.mode === 'grid';
  $('tplStrip').hidden = !grid;
  $('longTools').hidden = grid;

  if (grid) {
    const tpl = currentTemplate();
    $('editTitle').textContent = tpl ? tpl.name : '拼图';
    const strip = $('tplStrip');
    strip.innerHTML = '';
    templatesFor(state.photos.length).forEach(t => {
      const b = document.createElement('button');
      b.className = 'tpl' + (t.id === state.tplId ? ' on' : '');
      b.innerHTML = templateSVG(t, t.id === state.tplId ? '#0A84FF' : '#D1D1D6');
      b.onclick = () => { state.tplId = t.id; renderEdit(); queueDraftSave(); };
      strip.appendChild(b);
    });
  } else {
    $('editTitle').textContent = '长图拼接';
    $('segDir').querySelectorAll('button').forEach(b => {
      b.classList.toggle('on', b.dataset.dir === state.long.direction);
    });
    $('btnReverse').classList.toggle('on', state.long.reverse);
  }

  $('editHint').textContent = grid
    ? '点任意一格：替换 / 裁剪取景　长按：调整顺序'
    : '点任意一张：裁剪取景　长按：调整顺序';
  $('qualityLine').textContent = `输出：${qualityLabel()} · JPG`;

  renderPreview();
}

function qualityLabel() {
  return ({ 1080: '省空间 1080px', 2048: '高清 2048px', 4096: '原图 4096px' })[state.quality] || `${state.quality}px`;
}

function orderedPhotos() {
  const list = state.photos.slice();
  if (state.mode === 'long' && state.long.reverse) list.reverse();
  return list;
}

function renderPreview() {
  const canvas = $('preview');
  const photos = orderedPhotos();
  if (state.mode === 'grid') {
    const tpl = currentTemplate();
    if (tpl) drawGrid(canvas, tpl, photos, PREVIEW_SIZE);
  } else {
    const dir = state.long.direction;
    // 预览用较小的长边，避免每次改参数都重算大图
    drawLong(canvas, photos, { direction: dir, size: dir === 'vertical' ? 640 : 900 });
  }
  // 预览时把 canvas 显示尺寸交给 CSS 控制
  canvas.style.width = '';
  canvas.style.height = '';
}

/* ---------------- 点击 / 长按定位 ---------------- */
function cellAtPointer(ev) {
  const canvas = $('preview');
  const r = canvas.getBoundingClientRect();
  const nx = (ev.clientX - r.left) / r.width;
  const ny = (ev.clientY - r.top) / r.height;
  const photos = orderedPhotos();

  if (state.mode === 'grid') {
    const tpl = currentTemplate();
    if (!tpl) return -1;
    const i = tpl.cells.findIndex(([x, y, w, h]) => nx >= x && nx <= x + w && ny >= y && ny <= y + h);
    return i;
  }
  // 长图：按累计比例找落在哪张图
  const dims = photos.map(p => (state.long.direction === 'vertical'
    ? p.img.height / p.img.width
    : p.img.width / p.img.height));
  const total = dims.reduce((a, b) => a + b, 0);
  let acc = 0;
  const t = state.long.direction === 'vertical' ? ny : nx;
  for (let i = 0; i < dims.length; i++) {
    const k = dims[i] / total;
    if (t >= acc && t <= acc + k) return i;
    acc += k;
  }
  return -1;
}

function bindCanvasGestures() {
  const canvas = $('preview');
  let timer = 0, longPressed = false;

  canvas.addEventListener('pointerdown', ev => {
    longPressed = false;
    timer = setTimeout(() => {
      longPressed = true;
      openOrder();
    }, 520);
  });
  const cancel = () => clearTimeout(timer);
  canvas.addEventListener('pointerup', cancel);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('pointermove', cancel);

  canvas.addEventListener('click', ev => {
    if (longPressed) { longPressed = false; return; }
    const idx = cellAtPointer(ev);
    if (idx < 0) return;
    openCrop(idx);
  });
}

/* ---------------- 裁剪取景 ---------------- */
let cropCtx = null;

function openCrop(index) {
  const photo = orderedPhotos()[index];
  if (!photo) return;
  const realIndex = state.photos.indexOf(photo);
  const stage = $('cropStage');
  const img = $('cropImg');

  img.src = makeThumb(photo.img, 900);       // 取景预览用大图，够清楚又不卡
  $('cropZoom').value = photo.crop.scale || 1;

  const base = photo.crop || { scale: 1, x: 0, y: 0 };
  cropCtx = { index: realIndex, photo, ox: base.x || 0, oy: base.y || 0, zoom: base.scale || 1 };

  const draw = () => {
    const w = stage.clientWidth, h = stage.clientHeight;
    const s0 = Math.max(w / photo.img.width, h / photo.img.height) * cropCtx.zoom;
    const iw = photo.img.width * s0, ih = photo.img.height * s0;
    const ex = Math.max(iw - w, 0) / 2, ey = Math.max(ih - h, 0) / 2;
    img.style.width = iw + 'px';
    img.style.height = ih + 'px';
    img.style.transform = `translate(-50%,-50%) translate(${cropCtx.ox * ex}px, ${cropCtx.oy * ey}px)`;
  };
  cropCtx.draw = draw;

  // 等图加载完再算尺寸
  if (img.complete) requestAnimationFrame(draw);
  else img.onload = () => requestAnimationFrame(draw);

  let start = null;
  stage.onpointerdown = ev => {
    const w = stage.clientWidth, h = stage.clientHeight;
    const s0 = Math.max(w / photo.img.width, h / photo.img.height) * cropCtx.zoom;
    start = {
      x: ev.clientX, y: ev.clientY, ox: cropCtx.ox, oy: cropCtx.oy,
      ex: Math.max(photo.img.width * s0 - w, 0) / 2,
      ey: Math.max(photo.img.height * s0 - h, 0) / 2,
    };
    stage.setPointerCapture(ev.pointerId);
  };
  stage.onpointermove = ev => {
    if (!start) return;
    const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
    cropCtx.ox = start.ex ? Math.max(-1, Math.min(1, start.ox + dx / start.ex)) : 0;
    cropCtx.oy = start.ey ? Math.max(-1, Math.min(1, start.oy + dy / start.ey)) : 0;
    draw();
  };
  stage.onpointerup = () => { start = null; };

  $('cropMask').hidden = false;
}

function initCropSheet() {
  $('cropZoom').oninput = ev => {
    if (!cropCtx) return;
    cropCtx.zoom = parseFloat(ev.target.value);
    cropCtx.draw();
  };
  $('cropCancel').onclick = () => { $('cropMask').hidden = true; cropCtx = null; };
  $('cropOk').onclick = () => {
    if (!cropCtx) return;
    cropCtx.photo.crop = { scale: cropCtx.zoom, x: cropCtx.ox, y: cropCtx.oy };
    $('cropMask').hidden = true;
    cropCtx = null;
    renderPreview();
    queueDraftSave();
  };
}

/* ---------------- 排序 ---------------- */
let orderSel = -1;

function openOrder() {
  orderSel = -1;
  renderOrderGrid();
  $('orderMask').hidden = false;
}

function renderOrderGrid() {
  const grid = $('orderGrid');
  grid.innerHTML = '';
  state.photos.forEach((p, i) => {
    const tile = document.createElement('button');
    tile.className = 'tile' + (i === orderSel ? ' sel' : '');
    tile.innerHTML = `<img src="${p.thumb}" alt=""><span class="badge">${i + 1}</span>`;
    tile.onclick = () => {
      if (orderSel < 0) {
        orderSel = i;
      } else if (orderSel === i) {
        orderSel = -1;
      } else {
        const [a] = state.photos.splice(orderSel, 1);
        state.photos.splice(i, 0, a);
        orderSel = -1;
      }
      renderOrderGrid();
      renderAlbum();
      renderPreview();
      queueDraftSave();
    };
    grid.appendChild(tile);
  });
}

/* ---------------- 导出 ---------------- */
async function exportCollage() {
  const photos = orderedPhotos();
  if (photos.length < 2) return toast('至少 2 张才能拼');

  const canvas = document.createElement('canvas');
  const total = photos.reduce((s, p) => s + (p.img.width * p.img.height), 0);
  if (total > 120e6) toast('照片比较大，正在努力处理…', 1600);

  try {
    let out;
    if (state.mode === 'grid') {
      const tpl = currentTemplate();
      out = drawGrid(canvas, tpl, photos, state.quality);
    } else {
      out = drawLong(canvas, photos, { direction: state.long.direction, size: state.quality });
    }

    const blob = await canvasToBlob(canvas);
    const fileName = timestampName(state.mode === 'grid' ? '拼图' : '长图');
    const ret = await saveImage(blob, fileName, 'image/jpeg');

    state.lastSaved = { ...ret, blob, fileName, mime: 'image/jpeg' };
    showResult(ret, fileName, blob.size, out);
  } catch (e) {
    console.error(e);
    toast('导出失败：' + (e.message || e));
  } finally {
    // 释放大 canvas，避免连续导出时内存堆积
    canvas.width = canvas.height = 0;
  }
}

function showResult(ret, fileName, bytes, out) {
  $('resTitle').textContent = ret.native ? '已保存到「下载」' : '已保存到浏览器下载目录';
  $('resFile').textContent = `${fileName} · ${(bytes / 1024 / 1024).toFixed(2)} MB · ${out.width}×${out.height}`;
  $('resPath').textContent = ret.native ? '位置：手机存储 / Download' : '位置：浏览器的下载文件夹';
  $('resultMask').hidden = false;
}

function initResultSheet() {
  $('btnOpen').onclick = async () => {
    const s = state.lastSaved;
    if (!s) return;
    try {
      await openSaved({ uri: s.uri, mime: s.mime });
    } catch (e) {
      toast('没有能打开这张图的 App');
    }
  };
  $('btnShare').onclick = async () => {
    const s = state.lastSaved;
    if (!s) return;
    try {
      await shareSaved({ uri: s.uri, mime: s.mime, blob: s.blob, fileName: s.fileName });
    } catch (e) {
      toast(e.message === '当前浏览器不支持分享' ? '这个浏览器不支持分享，App 里可以' : '分享失败');
    }
  };
  $('btnAgain').onclick = async () => {
    $('resultMask').hidden = true;
    resetPhotos();
    renderAlbum();
    show('pick');
    await clearDraft();
    refreshDraftCard();
  };
  $('resultMask').addEventListener('click', ev => {
    if (ev.target.id === 'resultMask') $('resultMask').hidden = true;
  });
}

/* ---------------- 更多 / 清晰度 ---------------- */
function initMoreSheet() {
  const mark = () => {
    document.querySelectorAll('#qualityList button').forEach(b => {
      b.classList.toggle('on', Number(b.dataset.q) === state.quality);
    });
  };
  document.querySelectorAll('#qualityList button').forEach(b => {
    b.onclick = () => {
      state.quality = Number(b.dataset.q);
      mark();
      $('qualityLine').textContent = `输出：${qualityLabel()} · JPG`;
      queueDraftSave();
      toast('输出已设为 ' + qualityLabel());
    };
  });
  mark();
  $('moreClose').onclick = () => { $('moreMask').hidden = true; };
  $('moreMask').addEventListener('click', ev => {
    if (ev.target.id === 'moreMask') $('moreMask').hidden = true;
  });
}

/* ---------------- 草稿 ---------------- */
let draftTimer = 0;

function queueDraftSave() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(async () => {
    if (!state.photos.length) return;
    try {
      await saveDraft({ blobs: state.photos.map(p => p.file), meta: metaSnapshot() });
      refreshDraftCard();
    } catch (e) {
      console.warn('草稿保存失败', e);
    }
  }, 700);
}

async function refreshDraftCard() {
  const card = $('draftCard');
  const d = await loadDraft();
  if (!d || !d.blobs || !d.blobs.length) { card.hidden = true; return; }
  card.hidden = false;
  const n = d.blobs.length;
  const ago = Math.max(1, Math.round((Date.now() - (d.savedAt || Date.now())) / 60000));
  const tplName = d.meta && d.meta.tplId ? (templateById(d.meta.tplId) || {}).name : '';
  $('draftMeta').textContent = `${d.meta && d.meta.mode === 'long' ? '长图拼接' : (tplName || '网格拼图')} · ${n} 张 · ${ago < 60 ? ago + ' 分钟前' : Math.round(ago / 60) + ' 小时前'}`;
  try {
    const first = await loadImage(d.blobs[0]);
    $('draftThumb').src = makeThumb(first, 200);
  } catch (e) { /* 缩略图失败不影响 */ }
}

async function restoreDraft() {
  const d = await loadDraft();
  if (!d || !d.blobs || !d.blobs.length) return;
  resetPhotos();
  for (const f of d.blobs) {
    try {
      const img = await loadImage(f);
      state.photos.push({ file: f, img, thumb: makeThumb(img, 320), crop: { scale: 1, x: 0, y: 0 } });
    } catch (e) { /* 跳过坏图 */ }
  }
  restoreMeta(d.meta);
  if (d.meta && Array.isArray(d.meta.crops)) {
    state.photos.forEach((p, i) => { if (d.meta.crops[i]) p.crop = d.meta.crops[i]; });
  }
  renderAlbum();
  enterEdit(state.mode);
  toast('已恢复上次的拼图');
  const card = $('draftCard');
  card.hidden = true;
}

/* ---------------- 初始化 ---------------- */
function init() {
  renderAlbum();
  initCropSheet();
  initResultSheet();
  initMoreSheet();
  bindCanvasGestures();

  $('btnStart').onclick = () => enterEdit('grid');
  $('btnLong').onclick = () => enterEdit('long');
  $('btnBack').onclick = () => { show('pick'); renderAlbum(); };
  $('btnExport').onclick = exportCollage;
  $('draftCard').onclick = restoreDraft;

  $('segDir').querySelectorAll('button').forEach(b => {
    b.onclick = () => { state.long.direction = b.dataset.dir; renderEdit(); queueDraftSave(); };
  });
  $('btnReverse').onclick = () => {
    state.long.reverse = !state.long.reverse;
    $('btnReverse').classList.toggle('on', state.long.reverse);
    renderPreview();
    queueDraftSave();
  };

  document.querySelectorAll('.toolbar button').forEach(b => {
    b.onclick = () => {
      const tool = b.dataset.tool;
      if (tool === 'order') openOrder();
      else if (tool === 'crop') openCrop(0);
      else if (tool === 'quality' || tool === 'more') $('moreMask').hidden = false;
    };
  });

  ['cropMask', 'orderMask', 'moreMask'].forEach(id => {
    $(id).addEventListener('click', ev => { if (ev.target.id === id) $(id).hidden = true; });
  });
  $('orderDone').onclick = () => { $('orderMask').hidden = true; renderPreview(); };

  subscribe(() => { /* 需要时可以在这里做全局响应 */ });

  refreshDraftCard();

  // 浏览器里调试用：window.__collage 能看到内部状态
  window.__collage = { state, MAX_LONG_EDGE, IS_APP };
}

document.addEventListener('DOMContentLoaded', init);
