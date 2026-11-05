#!/usr/bin/env python3
"""从图标 C（白底极简）生成所有需要的安卓图标尺寸。

产出：
  mipmap-*/ic_launcher.png          桌面图标（老式，带底色）
  mipmap-*/ic_launcher_round.png    圆形图标
  mipmap-*/ic_launcher_foreground.png  自适应图标的前景层（透明底，内容留在安全区）
  values/ic_launcher_background.xml  自适应图标的底色
"""
import pathlib

from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
RES = ROOT / 'android/app/src/main/res'

BG = '#F7F8FA'          # 极浅灰：纯白壁纸上也能看清边界
INK = '#0F172A'
ACCENT = '#22D3EE'

# 图标 C 的几何比例（相对于画布边长）
PAD, GAP, BOX, STROKE, RADIUS = 0.1875, 0.039, 0.273, 0.0234, 0.047

DENSITIES = {           # 老式图标
    'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192,
}
FOREGROUND = {          # 自适应图标前景层（108dp 网格）
    'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432,
}


def draw_mark(size, scale=1.0, with_bg=True, circle=False):
    """画 2x2 拼块：三个描边 + 一个实色。scale 控制内容占画布的比例。"""
    ss = 4                                   # 超采样，边缘更干净
    S = size * ss
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if with_bg:
        if circle:
            d.ellipse([0, 0, S - 1, S - 1], fill=BG)
        else:
            d.rectangle([0, 0, S - 1, S - 1], fill=BG)

    box = BOX * S * scale
    gap = GAP * S * scale
    stroke = max(1, int(STROKE * S * scale))
    radius = RADIUS * S * scale
    total = box * 2 + gap
    x0 = (S - total) / 2
    y0 = (S - total) / 2

    for i in range(4):
        x = x0 + (i % 2) * (box + gap)
        y = y0 + (i // 2) * (box + gap)
        rect = [x, y, x + box, y + box]
        if i == 3:
            d.rounded_rectangle(rect, radius=radius, fill=ACCENT)
        else:
            d.rounded_rectangle(rect, radius=radius, outline=INK, width=stroke)

    return img.resize((size, size), Image.LANCZOS)


def main():
    for name, size in DENSITIES.items():
        out = RES / f'mipmap-{name}'
        out.mkdir(parents=True, exist_ok=True)
        draw_mark(size).convert('RGB').save(out / 'ic_launcher.png')
        draw_mark(size, circle=True).convert('RGB').save(out / 'ic_launcher_round.png')
    for name, size in FOREGROUND.items():
        out = RES / f'mipmap-{name}'
        out.mkdir(parents=True, exist_ok=True)
        # 内容缩到 0.72，正好落在自适应图标的安全区里，不会被各种圆角/方形遮罩切掉
        draw_mark(size, scale=0.72, with_bg=False).save(out / 'ic_launcher_foreground.png')

    bg = RES / 'values/ic_launcher_background.xml'
    bg.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        f'    <color name="ic_launcher_background">{BG}</color>\n</resources>\n',
        encoding='utf-8')
    print('图标已生成：', ', '.join(DENSITIES))


if __name__ == '__main__':
    main()
