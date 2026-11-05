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
 * 把图片画进一个矩形，保持比例并填满（cover），crop 控制取景。
 * crop = { scale: 1, x: 0, y: 0 }，x/y 是 -1~1 的相对偏移。
 */
export function drawCover(ctx, img, dx, dy, dw, dh, crop = {}) {
  const scale = crop.scale || 1;
  const ox = crop.x || 0, oy = crop.y || 0;
  const base = Math.max(dw / img.width, dh / img.height) * scale;
  const w = img.width * base, h = img.height * base;
  const x = dx + (dw - w) / 2 + ox * (w - dw) / 2;
  const y = dy + (dh - h) / 2 + oy * (h - dh) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(dx, dy, dw, dh);
  ctx.clip();
  ctx.drawImage(img.bitmap, x, y, w, h);
  ctx.restore();
}
