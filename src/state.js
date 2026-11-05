/** 全局状态：唯一数据源。改状态统一走 update()，界面只负责渲染。 */

export const state = {
  photos: [],        // [{ file, img:{bitmap,width,height}, thumb, crop:{scale,x,y} }]
  mode: 'grid',      // 'grid' | 'long'
  tplId: null,       // 网格模式当前版式
  quality: 2048,     // 输出长边
  fit: 'contain',    // 网格里照片怎么放：'contain' 完整显示 / 'cover' 填满裁剪
  long: { direction: 'vertical', reverse: false },
  lastSaved: null,   // { uri, displayPath, fileName, blob, mime }
};

const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit() {
  listeners.forEach(fn => {
    try { fn(state); } catch (e) { console.error(e); }
  });
}

export function update(fn) {
  fn(state);
  emit();
}

/** 只保留可序列化的元信息（草稿用） */
export function metaSnapshot() {
  return {
    mode: state.mode,
    tplId: state.tplId,
    quality: state.quality,
    fit: state.fit,
    long: { ...state.long },
    crops: state.photos.map(p => p.crop || { scale: 1, x: 0, y: 0 }),
  };
}

export function restoreMeta(meta) {
  if (!meta) return;
  state.mode = meta.mode === 'long' ? 'long' : 'grid';
  state.tplId = meta.tplId || null;
  state.quality = meta.quality || 2048;
  state.fit = meta.fit === 'cover' ? 'cover' : 'contain';
  state.long = { direction: 'vertical', reverse: false, ...(meta.long || {}) };
}

export function resetPhotos() {
  state.photos.forEach(p => { if (p.img && p.img.bitmap && p.img.bitmap.close) { try { p.img.bitmap.close(); } catch (e) {} } });
  state.photos = [];
}
