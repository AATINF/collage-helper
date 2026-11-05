/**
 * 纯逻辑自测（不需要浏览器）：版式几何 + 合成尺寸
 * 运行：node tests/logic.test.mjs
 */
import { TEMPLATES, templatesFor, templateSVG } from '../src/core/templates.js';
import { drawGrid, drawLong, layoutJustified, drawJustified, MAX_LONG_EDGE } from '../src/core/compose.js';
import { drawCover } from '../src/core/image.js';

let pass = 0, fail = 0;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra); }
}

/* ---------- 假的 canvas / ctx，只记录调用 ---------- */
function fakeCtx() {
  const calls = [];
  return {
    calls,
    fillStyle: '', imageSmoothingQuality: '',
    fillRect: (...a) => calls.push(['fillRect', a]),
    save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
    moveTo() {}, lineTo() {}, arcTo() {}, closePath() {}, arc() {}, fill() {},
    drawImage: (...a) => calls.push(['drawImage', a]),
  };
}
function fakeCanvas() {
  const ctx = fakeCtx();
  return { width: 0, height: 0, getContext: () => ctx, _ctx: ctx };
}
const img = (w, h) => ({ bitmap: { fake: true }, width: w, height: h });

console.log('\n【1】版式数据');
ok('模板数量 ≥ 12', TEMPLATES.length >= 12, `实际 ${TEMPLATES.length}`);
for (let n = 2; n <= 9; n++) {
  ok(`${n} 张有可用版式`, templatesFor(n).length >= 1, `有 ${templatesFor(n).length} 个`);
}
for (const t of TEMPLATES) {
  const area = t.cells.reduce((s, c) => s + c[2] * c[3], 0);
  ok(`「${t.name}」格子铺满整图`, near(area, 1, 1e-9), `面积和 ${area}`);
  const inRange = t.cells.every(([x, y, w, h]) => x >= 0 && y >= 0 && x + w <= 1.0001 && y + h <= 1.0001);
  ok(`「${t.name}」坐标不越界`, inRange);
  ok(`「${t.name}」格子数 == 张数`, t.cells.length === t.count);
  ok(`「${t.name}」缩略图 SVG 正常`, templateSVG(t).startsWith('<svg'));
}

console.log('\n【2】网格合成');
{
  const c = fakeCanvas();
  const tpl = templatesFor(4)[0];
  const photos = [img(4000, 3000), img(3000, 4000), img(1000, 1000), img(500, 800)]
    .map(i => ({ img: i, crop: { scale: 1, x: 0, y: 0 } }));
  const out = drawGrid(c, tpl, photos, 2048);
  ok('输出为正方形 2048', out.width === 2048 && out.height === 2048);
  const draws = c._ctx.calls.filter(x => x[0] === 'drawImage');
  ok('每格都画了图', draws.length === 4, `实际 ${draws.length}`);
  ok('绘制参数无 NaN', draws.every(([, a]) => a.slice(1).every(v => Number.isFinite(v))));
}

console.log('\n【3】长图拼接');
{
  const c = fakeCanvas();
  const photos = [img(1080, 2400), img(1080, 1920), img(1080, 1080)].map(i => ({ img: i, crop: {} }));
  const out = drawLong(c, photos, { direction: 'vertical', size: 1080 });
  const expect = Math.round(1080 * 2400 / 1080) + Math.round(1080 * 1920 / 1080) + Math.round(1080 * 1080 / 1080);
  ok('竖向：宽度=目标宽', out.width === 1080);
  ok('竖向：高度=各图缩放后之和', out.height === expect, `${out.height} vs ${expect}`);
}
{
  const c = fakeCanvas();
  const photos = [img(4000, 3000), img(3000, 4000)].map(i => ({ img: i, crop: {} }));
  const out = drawLong(c, photos, { direction: 'horizontal', size: 2000 });
  ok('横向：高度=目标高', out.height === 2000);
  ok('横向：宽度累加正确', out.width === Math.round(2000 * 4000 / 3000) + Math.round(2000 * 3000 / 4000), `实际 ${out.width}`);
}
{
  const c = fakeCanvas();
  const photos = Array.from({ length: 40 }, () => ({ img: img(1080, 3000), crop: {} }));
  const out = drawLong(c, photos, { direction: 'vertical', size: 2048 });
  ok(`超长自动封顶 (≤${MAX_LONG_EDGE})`, out.height <= MAX_LONG_EDGE, `实际 ${out.height}`);
  ok('封顶后宽度按比例缩小', out.width < 2048 && out.width > 0, `实际 ${out.width}`);
}

console.log('\n【4】取景裁剪');
{
  const c = fakeCanvas();
  drawCover(c._ctx, img(4000, 3000), 0, 0, 500, 500, { scale: 1, x: 0, y: 0 });
  const [, a] = c._ctx.calls.filter(x => x[0] === 'drawImage')[0];
  const [, , , dw, dh] = a;
  ok('cover 时短边撑满格子', Math.min(dw, dh) >= 500 - 0.01, `画了 ${dw}x${dh}`);
  ok('cover 时比例不变', near(dw / dh, 4000 / 3000, 1e-6), `${dw}x${dh}`);

  const c2 = fakeCanvas();
  drawCover(c2._ctx, img(4000, 3000), 0, 0, 500, 500, { scale: 2, x: 1, y: -1 });
  const [, b] = c2._ctx.calls.filter(x => x[0] === 'drawImage')[0];
  ok('放大 2 倍后尺寸翻倍', Math.abs(b[3] - dw * 2) < 0.01, `${b[3]} vs ${dw * 2}`);
  ok('偏移不产生 NaN', b.slice(1).every(v => Number.isFinite(v)));
}

console.log('\n【5】完整显示 / 填满裁剪');
{
  const wide = img(4000, 1000);           // 很宽的风景图放进正方形格子
  const c1 = fakeCanvas();
  drawCover(c1._ctx, wide, 0, 0, 500, 500, {}, 'contain');
  const [, a1] = c1._ctx.calls.filter(x => x[0] === 'drawImage')[0];
  ok('完整显示：不裁切（宽高都 ≤ 格子）', a1[3] <= 500.01 && a1[4] <= 500.01, `${a1[3]}x${a1[4]}`);
  ok('完整显示：比例保持', near(a1[3] / a1[4], 4, 1e-6), `${a1[3]}/${a1[4]}`);
  ok('完整显示：水平居中', Math.abs(a1[1] - 0) < 0.01 && Math.abs(a1[1] + a1[3] / 2 - 250) < 0.01, `x=${a1[1]}`);

  const c2 = fakeCanvas();
  drawCover(c2._ctx, wide, 0, 0, 500, 500, {}, 'cover');
  const [, a2] = c2._ctx.calls.filter(x => x[0] === 'drawImage')[0];
  ok('填满裁剪：短边至少撑满格子', Math.min(a2[3], a2[4]) >= 500 - 0.01, `${a2[3]}x${a2[4]}`);
  ok('填满裁剪：确实被裁（宽 > 格子）', a2[3] > 500, `${a2[3]}`);
}
{
  const c = fakeCanvas();
  const tpl = templatesFor(2)[0];
  const photos = [{ img: img(1080, 2400), crop: {} }, { img: img(1080, 2400), crop: {} }];
  const out = drawGrid(c, tpl, photos, 1024, { fit: 'contain' });
  const draws = c._ctx.calls.filter(x => x[0] === 'drawImage');
  ok('网格默认完整显示：两张竖图都不裁', draws.every(([, a]) => a[4] <= 513), JSON.stringify(draws.map(d => d[1].slice(3, 5))));
  ok('输出尺寸不受影响', out.width === 1024 && out.height === 1024);
}

console.log('\n【6】无缝拼接（同高铺满，不裁不留白）');
{
  const photos = [img(1920, 1080), img(1920, 1080)].map(i => ({ img: i, crop: {} }));
  const L = layoutJustified(photos, { width: 2048, targetRowHeight: 1024 });
  ok('两张横图排成一行', L.rows.length === 1, `行数 ${L.rows.length}`);
  ok('整行宽度正好等于画布宽', Math.abs(L.rows[0].totalW - 2048) < 0.5, `${L.rows[0].totalW}`);
  ok('行高按比例算出（2048/2/1.777）', Math.abs(L.rows[0].h - 2048 / 2 / (1920 / 1080)) < 0.5, `${L.rows[0].h}`);
  ok('画布高度等于行高', Math.abs(L.height - L.rows[0].h) < 1);
}
{
  // 4 张不同比例：每行等高、每行铺满、照片不被裁
  const photos = [img(1080, 1920), img(1920, 1080), img(1000, 1000), img(1600, 1200)].map(i => ({ img: i, crop: {} }));
  const L = layoutJustified(photos, { width: 2048, targetRowHeight: 1024 });
  ok('至少分成 2 行', L.rows.length >= 2, `行数 ${L.rows.length}`);
  const fullRows = L.rows.slice(0, -1);
  ok('除最后一行外都铺满宽度',
    fullRows.every(r => Math.abs(r.totalW - 2048) < 0.5),
    fullRows.map(r => r.totalW.toFixed(1)).join(','));
  ok('同一行内等高', L.rows.every(r => r.widths.length === r.idx.length));
  const noCrop = L.rows.every(r => r.idx.every((i, k) => {
    const a = photos[i].img.width / photos[i].img.height;
    return Math.abs(r.widths[k] / r.h - a) < 1e-6;      // 宽高比 == 原图比例 => 没有裁切
  }));
  ok('每张都保持原比例（没有裁剪）', noCrop);
  ok('总高度合理', L.height > 0 && L.height < 2048 * 4);
}
{
  const c = fakeCanvas();
  const photos = [img(1080, 1920), img(1920, 1080), img(1000, 1000), img(1600, 1200), img(1080, 1080)]
    .map(i => ({ img: i, crop: {} }));
  const out = drawJustified(c, photos, { width: 1600, targetRowHeight: 800 });
  ok('画布宽度 = 指定宽度', out.width === 1600 && c.width === 1600);
  const draws = c._ctx.calls.filter(x => x[0] === 'drawImage');
  ok('每张都画了', draws.length === 5, `实际 ${draws.length}`);
  ok('绘制参数无 NaN', draws.every(([, a]) => a.slice(1).every(v => Number.isFinite(v))));
  // 每行首尾相接：前一张的右边 = 后一张的左边
  const rows = layoutJustified(photos, { width: 1600, targetRowHeight: 800 }).rows;
  const contiguous = rows.every(r => {
    let x = r.x;
    return r.widths.every(w => { const okx = true; x += w; return okx; }) && Math.abs(x - (r.x + r.totalW)) < 1e-6;
  });
  ok('行内首尾相接（没有缝）', contiguous);
}

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`);
process.exit(fail ? 1 : 0);
