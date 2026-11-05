/**
 * 原生能力桥（唯一和 Capacitor 打交道的地方）
 * 浏览器里也能跑：全部降级成浏览器自带行为，方便先在电脑/手机浏览器验收。
 */

export const IS_APP = !!(window.Capacitor
  && typeof window.Capacitor.isNativePlatform === 'function'
  && window.Capacitor.isNativePlatform());

/** 取原生插件；不存在返回 null，调用方自己降级 */
function plugin(name) {
  const p = window.Capacitor && window.Capacitor.Plugins;
  return (p && p[name]) || null;
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result);
      const i = s.indexOf(',');
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error || new Error('读取文件失败'));
    r.readAsDataURL(blob);
  });
}

/**
 * 保存图片。App 里走原生桥写进系统「下载」；浏览器里走 a[download]。
 * 返回 { uri, displayPath, native }
 */
export async function saveImage(blob, fileName, mime = 'image/jpeg') {
  const fs = plugin('FileSaver');
  if (IS_APP && fs) {
    const data = await blobToBase64(blob);
    const ret = await fs.save({ data, fileName, mime });
    return { uri: ret.uri, displayPath: ret.displayPath || ('Download/' + fileName), native: true };
  }

  // 浏览器兜底
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { uri: url, displayPath: '浏览器下载目录/' + fileName, native: false };
}

/** 用系统里能打开图片的 App 打开刚保存的文件 */
export async function openSaved({ uri, mime = 'image/jpeg' }) {
  const fs = plugin('FileSaver');
  if (IS_APP && fs && uri) return fs.openFile({ uri, mime });
  if (uri) window.open(uri, '_blank');
}

/** 拉起系统分享面板 */
export async function shareSaved({ uri, mime = 'image/jpeg', blob, fileName }) {
  const fs = plugin('FileSaver');
  if (IS_APP && fs && uri) return fs.share({ uri, mime });
  // 浏览器：优先 Web Share API，不支持就退回复制提示由调用方处理
  if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: mime })] })) {
    return navigator.share({ files: [new File([blob], fileName, { type: mime })] });
  }
  throw new Error('当前浏览器不支持分享');
}

/** 生成带时间戳的文件名，例如 拼图_20261105_2213.jpg */
export function timestampName(prefix) {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${prefix}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.jpg`;
}
