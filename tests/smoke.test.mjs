/**
 * 冒烟测试：在 jsdom 里把页面跑起来，确认
 *   1) 所有模块能正常 import（没有循环依赖 / 拼错路径）
 *   2) init() 不抛异常（没有写错的元素 id）
 *   3) 关键界面元素都在，初始状态正确（开始按钮禁用、相册有"添加"格）
 * 运行：node tests/smoke.test.mjs
 */
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const dom = new JSDOM(html, { url: 'http://localhost/', pretendToBeVisual: true });
const { window } = dom;

// 把浏览器全局挂到 node 上，app.js 才能按浏览器方式跑
global.window = window;
global.document = window.document;
Object.defineProperty(global, 'navigator', { value: window.navigator, configurable: true });
global.HTMLElement = window.HTMLElement;
global.Node = window.Node;
global.FileReader = window.FileReader;
global.Image = window.Image;
global.URL = window.URL;
global.localStorage = window.localStorage;
global.requestAnimationFrame = cb => setTimeout(cb, 0);

// jsdom 没有 canvas 实现：给 getContext 一个够用的假 ctx
const fakeCtx = new Proxy({}, {
  get: (t, k) => {
    if (k === 'canvas') return null;
    if (typeof k === 'string' && ['fillStyle', 'imageSmoothingQuality', 'font', 'textAlign'].includes(k)) return '';
    return () => {};
  },
  set: () => true,
});
window.HTMLCanvasElement.prototype.getContext = () => fakeCtx;
window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/jpeg;base64,AAAA';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✓', name); }
  else { fail++; console.log('  ✗', name, extra); }
};

console.log('\n【冒烟】页面初始化');
let err = null;
try {
  await import(path.join(root, 'src/app.js'));
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
} catch (e) {
  err = e;
}
ok('模块全部 import 成功', !err, err && err.message);
ok('init 没有抛异常', !err, err && err.stack?.split('\n')[1]);

const $ = id => window.document.getElementById(id);
ok('3 个屏幕容器都在', ['screen-pick', 'screen-edit'].every(i => !!$(i)));
ok('弹层元素齐全', ['cropMask', 'orderMask', 'moreMask', 'resultMask'].every(i => !!$(i)));
ok('选图页默认可见', $('screen-pick').classList.contains('active'));
ok('没选图时"开始拼图"禁用', $('btnStart').disabled === true);
ok('相册里有"添加照片"格', window.document.querySelectorAll('#album .tile.add').length === 1);
ok('没选图时显示空状态引导', $('emptyState').hidden === false);
ok('没选图时相册网格隐藏', $('album').hidden === true);
ok('空状态有"从相册选择"按钮', !!$('btnPickEmpty'));
ok('版式选择条初始为空（还没进入编辑）', $('tplStrip').children.length === 0);
ok('版本号占位存在', !!$('appVer') && $('appVer').textContent.startsWith('v'));
ok('fileInput 支持多选', $('fileInput').multiple === true);
ok('导出按钮存在', !!$('btnExport'));

console.log(`\n结果：${pass} 通过 / ${fail} 失败\n`);
process.exit(fail ? 1 : 0);
