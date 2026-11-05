/**
 * 合成：把一组照片画到 canvas 上
 * 两种模式：网格模板（正方形） / 长图拼接（竖接、横接）
 */
import { drawCover } from './image.js';

export const MAX_LONG_EDGE = 16384;   // 长图总高/总宽上限，超过就整体等比缩小，避免闪退
const BG = '#FFFFFF';

/** 圆角矩形路径（ctx.roundRect 在旧 WebView 上没有，这里自己画） */
function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/**
 * 网格拼图：输出正方形。
 * 视觉规则（很重要，决定成品好不好看）：四周留白 + 格子之间留缝 + 圆角 + 浅灰格子底色。
 * 这样"完整显示"模式下照片两侧的空白看起来是设计感，而不是没画满。
 */
export function drawGrid(canvas, tpl, photos, size, opts = {}) {
  const fit = opts.fit === 'cover' ? 'cover' : 'contain';
  const pad = Math.round(size * 0.014);      // 画布外边距
  const gap = Math.round(size * 0.012);      // 格子间距
  const radius = Math.round(size * 0.016);   // 格子圆角
  const cellBg = '#F2F2F7';

  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingQuality = 'high';

  const inner = size - pad * 2;

  tpl.cells.forEach(([x, y, w, h], i) => {
    const photo = photos[i];
    const X = Math.round(pad + x * inner) + (x > 0 ? Math.round(gap / 2) : 0);
    const Y = Math.round(pad + y * inner) + (y > 0 ? Math.round(gap / 2) : 0);
    const W = Math.round(w * inner) - gap;
    const H = Math.round(h * inner) - gap;
    if (W <= 0 || H <= 0) return;

    ctx.save();
    roundRectPath(ctx, X, Y, W, H, radius);
    ctx.fillStyle = (photo && photo.bg) || cellBg;
    ctx.fill();
    ctx.clip();
    if (photo && photo.img) drawCover(ctx, photo.img, X, Y, W, H, photo.crop, fit);
    ctx.restore();
  });

  return { width: size, height: size };
}

/**
 * 长图拼接：所有图按同一宽度（竖向）或同一高度（横向）依次排列，间距 0。
 * 返回实际输出尺寸。
 */
export function drawLong(canvas, photos, { direction = 'vertical', size = 2048 } = {}) {
  const list = photos.filter(p => p && p.img);
  if (!list.length) return { width: size, height: size };

  // 先按目标长边算出每张图缩放后的尺寸
  let dims;
  if (direction === 'vertical') {
    dims = list.map(p => ({ w: size, h: Math.round(size * p.img.height / p.img.width) }));
    const total = dims.reduce((s, d) => s + d.h, 0);
    if (total > MAX_LONG_EDGE) {           // 太长就整体缩小
      const k = MAX_LONG_EDGE / total;
      const w = Math.max(1, Math.floor(size * k));
      // 用 floor 而不是 round：逐张取整后总高才不会超出上限（round 会累加出几像素溢出）
      dims = dims.map(d => ({ w, h: Math.max(1, Math.floor(d.h * k)) }));
      size = w;
    }
    const height = dims.reduce((s, d) => s + d.h, 0);
    canvas.width = size;
    canvas.height = height;
  } else {
    dims = list.map(p => ({ h: size, w: Math.round(size * p.img.width / p.img.height) }));
    const total = dims.reduce((s, d) => s + d.w, 0);
    if (total > MAX_LONG_EDGE) {
      const k = MAX_LONG_EDGE / total;
      const h = Math.max(1, Math.floor(size * k));
      dims = dims.map(d => ({ w: Math.max(1, Math.floor(d.w * k)), h }));
      size = h;
    }
    const width = dims.reduce((s, d) => s + d.w, 0);
    canvas.width = width;
    canvas.height = size;
  }

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';

  let x = 0, y = 0;
  list.forEach((p, i) => {
    const d = dims[i];
    drawCover(ctx, p.img, x, y, d.w, d.h, p.crop);
    if (direction === 'vertical') y += d.h; else x += d.w;
  });

  return { width: canvas.width, height: canvas.height };
}

/** canvas -> Blob（JPG，质量 0.92，兼顾体积和画质） */
export function canvasToBlob(canvas, quality = .92) {
  return new Promise((resolve, reject) => {
    if (canvas.toBlob) {
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error('导出失败'))), 'image/jpeg', quality);
    } else {
      // 极老 WebView 的兜底：dataURL 转 blob
      try {
        const d = canvas.toDataURL('image/jpeg', quality).split(',')[1];
        const bin = atob(d);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        resolve(new Blob([buf], { type: 'image/jpeg' }));
      } catch (e) {
        reject(e);
      }
    }
  });
}
