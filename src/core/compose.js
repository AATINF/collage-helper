/**
 * 合成：把一组照片画到 canvas 上
 * 两种模式：网格模板（正方形） / 长图拼接（竖接、横接）
 */
import { drawCover } from './image.js';

export const MAX_LONG_EDGE = 16384;   // 长图总高/总宽上限，超过就整体等比缩小，避免闪退
const BG = '#FFFFFF';

/** 网格拼图：输出正方形，size 为边长 */
export function drawGrid(canvas, tpl, photos, size) {
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingQuality = 'high';

  tpl.cells.forEach(([x, y, w, h], i) => {
    const photo = photos[i];
    if (!photo) return;
    const dx = Math.round(x * size), dy = Math.round(y * size);
    // 用整像素计算宽高，避免格子之间出现 1px 缝
    const dw = Math.round((x + w) * size) - dx;
    const dh = Math.round((y + h) * size) - dy;
    drawCover(ctx, photo.img, dx, dy, dw, dh, photo.crop);
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
