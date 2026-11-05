/**
 * 图片读取与绘制工具
 * - 读文件时处理 EXIF 方向（手机竖拍的照片否则会躺倒）
 * - 统一用 cover 方式把图填满格子，支持缩放/平移的裁剪参数
 */

const MAX_EDGE = 4096;   // 单张图解码上限，防大图吃爆内存

/**
 * File -> { bitmap, width, height }
 * 优先 createImageBitmap(file, {imageOrientation:'from-image'})，它自带 EXIF 纠正且比 <img> 省内存。
 */
export async function loadImage(file) {
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return shrinkIfHuge({ bitmap: bmp, width: bmp.width, height: bmp.height });
    } catch (e) {
      /* 老 WebView 不支持时回落到 <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const el = new Image();
      el.onload = () => res(el);
      el.onerror = () => rej(new Error('图片格式不支持'));
      el.src = url;
    });
    return await shrinkIfHuge({ bitmap: img, width: img.naturalWidth, height: img.naturalHeight });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** 超过 MAX_EDGE 的图先降采样，避免后面每格重绘时反复处理巨图 */
async function shrinkIfHuge(img) {
  const long = Math.max(img.width, img.height);
  if (long <= MAX_EDGE) return img;
  const k = MAX_EDGE / long;
  const w = Math.round(img.width * k), h = Math.round(img.height * k);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(img.bitmap, 0, 0, w, h);
  const bmp = await createImageBitmap(c);
  return { bitmap: bmp, width: w, height: h, shrunk: true };
}

/** 相册格子里用的小图（存成 dataURL，省内存也方便存草稿） */
export function makeThumb(img, size = 220) {
  const { width: w, height: h } = img;
  const k = Math.min(size / w, size / h, 1);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(img.bitmap, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', .82);
}

/**
 * 把图片画进一个矩形。
 * mode = 'contain'（完整显示，不裁掉任何部分，四周留白）/ 'cover'（填满格子，超出部分裁掉）
 * crop = { scale: 1, x: 0, y: 0 }，x/y 是 -1~1 的相对偏移，只在有富余空间时生效。
 */
export function drawCover(ctx, img, dx, dy, dw, dh, crop = {}, mode = 'cover') {
  const scale = crop.scale || 1;
  const ox = crop.x || 0, oy = crop.y || 0;
  const fit = mode === 'contain' ? Math.min : Math.max;
  const base = fit(dw / img.width, dh / img.height) * scale;
  const w = img.width * base, h = img.height * base;
  const ex = Math.max(w - dw, 0) / 2, ey = Math.max(h - dh, 0) / 2;
  const x = dx + (dw - w) / 2 + ox * ex;
  const y = dy + (dh - h) / 2 + oy * ey;
  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, dw, dh);
  ctx.clip();
  ctx.drawImage(img.bitmap, x, y, w, h);
  ctx.restore();
}

/**
 * 取一张图的主色调（缩到 1x1 取平均色），再和白色混合成柔和的浅色。
 * 用途：完整显示模式下，格子里的留白用照片自己的色调填充，
 * 看起来像设计过的留白，而不是空着的白块。
 */
export function dominantColor(img, mixWithWhite = 0.6) {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const ctx = c.getContext('2d');
    ctx.drawImage(img.bitmap, 0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    const m = v => Math.round(v + (255 - v) * mixWithWhite);
    return `rgb(${m(r)}, ${m(g)}, ${m(b)})`;
  } catch (e) {
    return '#F2F2F7';
  }
}
