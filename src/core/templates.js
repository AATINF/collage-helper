/**
 * 版式定义（唯一数据源）
 * 想加一种模板：往 TEMPLATES 里加一条即可，其余代码不用动。
 * cells 里的坐标是 0~1 的相对值 [x, y, w, h]，左上角为原点。
 */

export const TEMPLATES = [
  { id: 'v2', name: '上下两张', count: 2, cells: [[0, 0, 1, .5], [0, .5, 1, .5]] },
  { id: 'h2', name: '左右两张', count: 2, cells: [[0, 0, .5, 1], [.5, 0, .5, 1]] },

  { id: 'r3', name: '三行', count: 3, cells: [[0, 0, 1, 1 / 3], [0, 1 / 3, 1, 1 / 3], [0, 2 / 3, 1, 1 / 3]] },
  { id: 'c3', name: '三列', count: 3, cells: [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]] },
  {
    id: 'bigTop2', name: '一大两小', count: 3,
    cells: [[0, 0, 1, 2 / 3], [0, 2 / 3, .5, 1 / 3], [.5, 2 / 3, .5, 1 / 3]],
  },
  {
    id: 'bigLeft2', name: '左大右二', count: 3,
    cells: [[0, 0, 2 / 3, 1], [2 / 3, 0, 1 / 3, .5], [2 / 3, .5, 1 / 3, .5]],
  },

  {
    id: 'g4', name: '四宫格', count: 4,
    cells: [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]],
  },
  {
    id: 'bigLeft3', name: '左大右三', count: 4,
    cells: [[0, 0, 2 / 3, 1], [2 / 3, 0, 1 / 3, 1 / 3], [2 / 3, 1 / 3, 1 / 3, 1 / 3], [2 / 3, 2 / 3, 1 / 3, 1 / 3]],
  },

  {
    id: 'bigTop4', name: '一大四小', count: 5,
    cells: [[0, 0, 1, .6], [0, .6, .25, .4], [.25, .6, .25, .4], [.5, .6, .25, .4], [.75, .6, .25, .4]],
  },
  {
    id: 'top2bottom3', name: '上二下三', count: 5,
    cells: [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, 1 / 3, .5], [1 / 3, .5, 1 / 3, .5], [2 / 3, .5, 1 / 3, .5]],
  },

  {
    id: 'g6v', name: '六宫格·竖', count: 6,
    cells: [0, 1, 2].flatMap(r => [0, 1].map(c => [c / 2, r / 3, 1 / 2, 1 / 3])),
  },
  {
    id: 'g6h', name: '六宫格·横', count: 6,
    cells: [0, 1].flatMap(r => [0, 1, 2].map(c => [c / 3, r / 2, 1 / 3, 1 / 2])),
  },

  {
    id: 'bigTop6', name: '一大六小', count: 7,
    cells: [[0, 0, 1, .5], ...[0, 1].flatMap(r => [0, 1, 2].map(c => [c / 3, .5 + r / 4, 1 / 3, 1 / 4]))],
  },
  {
    id: 'top4bottom3', name: '上四下三', count: 7,
    cells: [
      ...[0, 1, 2, 3].map(c => [c / 4, 0, 1 / 4, .5]),
      ...[0, 1, 2].map(c => [c / 3, .5, 1 / 3, .5]),
    ],
  },

  {
    id: 'top2big6', name: '上二下六', count: 8,
    cells: [
      [0, 0, .5, .5], [.5, 0, .5, .5],
      ...[0, 1].flatMap(r => [0, 1, 2].map(c => [c / 3, .5 + r / 4, 1 / 3, 1 / 4])),
    ],
  },
  {
    id: 'g8', name: '八宫格', count: 8,
    cells: [0, 1].flatMap(r => [0, 1, 2, 3].map(c => [c / 4, r / 2, 1 / 4, 1 / 2])),
  },

  {
    id: 'g9', name: '九宫格', count: 9,
    cells: [0, 1, 2].flatMap(r => [0, 1, 2].map(c => [c / 3, r / 3, 1 / 3, 1 / 3])),
  },
];

/** 该张数可用的版式 */
export function templatesFor(count) {
  return TEMPLATES.filter(t => t.count === count);
}

export function templateById(id) {
  return TEMPLATES.find(t => t.id === id) || null;
}

/** 生成版式缩略图 SVG（供模板选择条使用） */
export function templateSVG(tpl, color = '#D1D1D6') {
  const g = 3, s = 58;
  const rects = tpl.cells.map(([x, y, w, h]) => {
    const X = g + x * (s - 2 * g), Y = g + y * (s - 2 * g);
    const W = w * (s - 2 * g) - 2, H = h * (s - 2 * g) - 2;
    return `<rect x="${X.toFixed(1)}" y="${Y.toFixed(1)}" width="${Math.max(W, 1).toFixed(1)}" height="${Math.max(H, 1).toFixed(1)}" rx="3" fill="${color}"/>`;
  }).join('');
  return `<svg viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;
}
