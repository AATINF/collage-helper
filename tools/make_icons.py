#!/usr/bin/env python3
"""生成 3 个图标候选（512x512）+ 一张对比预览图。
方案 A 深色拼块 / B 渐变带「拼」字 / C 白底极简线稿
"""
import pathlib
from PIL import Image, ImageDraw, ImageFont

OUT = pathlib.Path(__file__).resolve().parent.parent / 'icons'
OUT.mkdir(parents=True, exist_ok=True)

S = 512
FONT_BOLD = '/root/workspace/fonts/NotoSansCJKsc-Bold.otf'
FONT_REG = '/root/workspace/fonts/NotoSansCJKsc-Regular.otf'


def vertical_gradient(size, top, bottom):
    w, h = size
    base = Image.new('RGB', (1, h))
    px = base.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        px[0, y] = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return base.resize((w, h), Image.BILINEAR)


def icon_a():
    """深色底 + 2x2 彩色圆角拼块，右上角一块微微旋转错位。"""
    img = Image.new('RGB', (S, S), '#0F172A')
    d = ImageDraw.Draw(img, 'RGBA')
    colors = ['#22D3EE', '#38BDF8', '#818CF8', '#A78BFA']
    pad, gap, box = 96, 18, 140
    for i, c in enumerate(colors):
        x = pad + (i % 2) * (box + gap)
        y = pad + (i // 2) * (box + gap)
        if i == 1:  # 错位的一块，暗示"拼合"
            tile = Image.new('RGBA', (box, box), (0, 0, 0, 0))
            td = ImageDraw.Draw(tile)
            td.rounded_rectangle([0, 0, box - 1, box - 1], radius=26, fill=c)
            tile = tile.rotate(-9, resample=Image.BICUBIC, expand=False)
            img.paste(tile, (x + 10, y - 12), tile)
        else:
            d.rounded_rectangle([x, y, x + box, y + box], radius=26, fill=c)
    return img


def icon_b():
    """青色到靛蓝渐变底 + 白色「拼」字。"""
    img = vertical_gradient((S, S), (34, 211, 238), (79, 70, 229))
    d = ImageDraw.Draw(img, 'RGBA')
    # 右下角一片淡淡的拼图缺口
    d.ellipse([S - 150, S - 150, S + 40, S + 40], fill=(255, 255, 255, 28))
    f = ImageFont.truetype(FONT_BOLD, 300)
    text = '拼'
    bbox = d.textbbox((0, 0), text, font=f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    d.text(((S - tw) / 2 - bbox[0], (S - th) / 2 - bbox[1] - 8), text, font=f, fill='white')
    return img


def icon_c():
    """白底极简：3 个描边方格 + 1 个实色方格。"""
    img = Image.new('RGB', (S, S), '#FFFFFF')
    d = ImageDraw.Draw(img)
    pad, gap, box, stroke = 96, 20, 140, 12
    for i in range(4):
        x = pad + (i % 2) * (box + gap)
        y = pad + (i // 2) * (box + gap)
        if i == 3:
            d.rounded_rectangle([x, y, x + box, y + box], radius=24, fill='#22D3EE')
        else:
            d.rounded_rectangle([x, y, x + box, y + box], radius=24,
                                outline='#0F172A', width=stroke)
    return img


def preview(icons):
    """三联对比图，白底 + 标签。"""
    cell, margin, label_h = 300, 40, 74
    W = margin * 2 + cell * 3 + 30 * 2
    H = margin * 2 + cell + label_h
    img = Image.new('RGB', (W, H), '#F1F5F9')
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT_BOLD, 40)
    fs = ImageFont.truetype(FONT_REG, 30)
    labels = [('A', '深色拼块'), ('B', '渐变 · 拼'), ('C', '白底极简')]
    for i, (ic, (k, name)) in enumerate(zip(icons, labels)):
        x = margin + i * (cell + 30)
        img.paste(ic.resize((cell, cell), Image.LANCZOS), (x, margin))
        t = f'{k}  {name}'
        tw = d.textlength(t, font=f)
        d.text((x + (cell - tw) / 2, margin + cell + 14), t, font=f, fill='#0F172A')
    return img


if __name__ == '__main__':
    icons = [icon_a(), icon_b(), icon_c()]
    for name, ic in zip(['icon-A-dark.png', 'icon-B-gradient.png', 'icon-C-minimal.png'], icons):
        ic.save(OUT / name)
        print('saved', OUT / name)
    p = preview(icons)
    p.save(OUT / 'preview.png')
    print('saved', OUT / 'preview.png', p.size)
