/**
 * 纯逻辑自测（不需要浏览器）：版式几何 + 合成尺寸
 * 运行：node tests/logic.test.mjs
 */
import { TEMPLATES, templatesFor, templateSVG } from '../src/core/templates.js';
import { drawGrid, drawLong, MAX_LONG_EDGE } from '../src/core/compose.js';
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

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`);
process.exit(fail ? 1 : 0);
