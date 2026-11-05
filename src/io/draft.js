/**
 * 草稿：把原图存进 IndexedDB（不是 localStorage，那里放不下几 MB 的照片）
 * 重开 App 时能「继续上次」，覆盖升级也不丢。
 */
const DB_NAME = 'collage-helper';
const STORE = 'draft';
const KEY = 'last';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    try {
      result = fn(store);
    } catch (e) {
      reject(e);
      return;
    }
    t.oncomplete = () => resolve(result && result.__req ? result.__req.result : result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

/** 保存草稿：blobs 是原始 File 数组，meta 是版式/裁剪/清晰度等 */
export async function saveDraft({ blobs, meta }) {
  const payload = { blobs, meta, savedAt: Date.now() };
  await tx('readwrite', s => s.put(payload, KEY));
}

export async function loadDraft() {
  try {
    return await tx('readonly', s => ({ __req: s.get(KEY) }));
  } catch (e) {
    return null;
  }
}

export async function clearDraft() {
  try {
    await tx('readwrite', s => s.delete(KEY));
  } catch (e) {
    /* 清不掉也不影响主流程 */
  }
}
