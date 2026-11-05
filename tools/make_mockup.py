#!/usr/bin/env python3
"""拼图助手 · v1 UI 视觉稿（3 屏）—— iOS 风格：浅灰底 / 白色圆角卡片 / 8pt 栅格 / 单强调色
产出 design/ui-mockup.png
"""
import pathlib
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'design'
OUT.mkdir(exist_ok=True)
FB = '/root/workspace/fonts/NotoSansCJKsc-Bold.otf'
FR = '/root/workspace/fonts/NotoSansCJKsc-Regular.otf'
F = lambda p, s: ImageFont.truetype(p, s)

W, H = 390, 844
INK, INK2, INK3 = '#1C1C1E', '#8E8E93', '#C7C7CC'
BG, CARD, ACCENT, LINE = '#F2F2F7', '#FFFFFF', '#0A84FF', '#E5E5EA'
PHOTOS = [('#C7D2FE', '#6D74F0'), ('#FBCFE8', '#EC4899'), ('#BFDBFE', '#3B82F6'),
          ('#FED7AA', '#F97316'), ('#BBF7D0', '#10B981'), ('#DDD6FE', '#8B5CF6')]


def shadow(size, radius, blur=18, alpha=38, offset=(0, 6)):
    """返回一张带柔和阴影的透明层。"""
    w, h = size
    layer = Image.new('RGBA', (w + blur * 2, h + blur * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x, y = blur + offset[0], blur + offset[1]
    d.rounded_rectangle([x, y, x + w, y + h], radius=radius, fill=(0, 0, 0, alpha))
    return layer.filter(ImageFilter.GaussianBlur(blur))


def card(img, box, radius=20, fill=CARD, sh=True):
    if sh:
        x0, y0, x1, y1 = box
        w, h = x1 - x0, y1 - y0
        s = shadow((w, h), radius)
        img.alpha_composite(s, (x0 - 18, y0 - 18))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box, radius=radius, fill=fill)


def photo(w, h, radius, pair, idx=0):
    """画一张"照片"占位：渐变 + 太阳 + 山。"""
    top, bot = pair
    g = Image.new('RGB', (1, h))
    px = g.load()
    for y in range(h):
        t = y / max(h - 1, 1)
        px[0, y] = tuple(round(int(top[i:i + 2], 16) + (int(bot[i:i + 2], 16) - int(top[i:i + 2], 16)) * t)
                         for i in (1, 3, 5))
    g = g.resize((w, h), Image.BILINEAR).convert('RGBA')
    d = ImageDraw.Draw(g)
    d.ellipse([w * 0.62, h * 0.16, w * 0.82, h * 0.16 + w * 0.2], fill=(255, 255, 255, 170))
    d.polygon([(0, h), (w * 0.38, h * 0.46), (w * 0.72, h), ], fill=(255, 255, 255, 120))
    d.polygon([(w * 0.42, h), (w * 0.74, h * 0.62), (w, h)], fill=(255, 255, 255, 90))
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)
    g.putalpha(m)
    return g


LAYOUTS = [
    [[0, 0, 1, .5], [0, .5, 1, .5]],
    [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]],
    [[0, 0, 1, 2 / 3], [0, 2 / 3, .5, 1 / 3], [.5, 2 / 3, .5, 1 / 3]],
    [[0, 0, .5, 1], [.5, 0, .5, 1]],
    [[0, 0, 1, 1 / 3], [0, 1 / 3, 1, 1 / 3], [0, 2 / 3, 1, 1 / 3]],
    [[0, 0, 1 / 3, 1], [1 / 3, 0, 1 / 3, 1], [2 / 3, 0, 1 / 3, 1]],
]


def layout_thumb(size, cells, on=False):
    """版式示意缩略图：白卡 + 灰格子。"""
    img = Image.new('RGBA', (size, size), '#FFFFFF' if not on else '#EAF3FF')
    d = ImageDraw.Draw(img)
    g = 3
    for (x, y, w, h) in cells:
        d.rounded_rectangle([g + x * (size - 2 * g), g + y * (size - 2 * g),
                             g + (x + w) * (size - 2 * g) - 2, g + (y + h) * (size - 2 * g) - 2],
                            radius=4, fill='#0A84FF' if on else '#D1D1D6')
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=12, fill=255)
    img.putalpha(m)
    return img


def status_bar(img):
    d = ImageDraw.Draw(img)
    d.text((26, 15), '9:41', font=F(FB, 15), fill=INK)
    for i, hh in enumerate((5, 8, 11, 14)):
        d.rounded_rectangle([W - 74 + i * 6, 22 - hh, W - 71 + i * 6, 22], radius=2, fill=INK)
    d.rounded_rectangle([W - 40, 12, W - 22, 24], radius=4, outline=INK, width=2)
    d.rounded_rectangle([W - 38, 14, W - 30, 22], radius=2, fill=INK)


def home_bar(img):
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([W / 2 - 67, H - 14, W / 2 + 67, H - 9], radius=3, fill='#1C1C1E')


def screen_pick():
    img = Image.new('RGBA', (W, H), BG)
    status_bar(img)
    d = ImageDraw.Draw(img)
    d.text((22, 62), '拼图助手', font=F(FB, 32), fill=INK)
    d.text((22, 110), '本地拼接 · 照片不上传', font=F(FR, 14), fill=INK2)

    # 相册网格
    cols, tile, gap, x0, y0 = 3, 104, 9, 22, 148
    for i in range(6):
        r, c = divmod(i, cols)
        x, y = x0 + c * (tile + gap), y0 + r * (tile + gap)
        if i < 5:
            img.alpha_composite(photo(tile, tile, 14, PHOTOS[i], i), (x, y))
            if i == 2:  # 选中角标
                ImageDraw.Draw(img).ellipse([x + tile - 30, y + 8, x + tile - 8, y + 30], fill=ACCENT)
                ImageDraw.Draw(img).text((x + tile - 23, y + 12), '3', font=F(FB, 13), fill='white')
        else:
            d.rounded_rectangle([x, y, x + tile, y + tile], radius=14, outline='#C7C7CC', width=2)
            d.text((x + tile / 2 - 9, y + tile / 2 - 22), '+', font=F(FR, 34), fill=INK3)
            t = '添加'
            d.text((x + tile / 2 - d.textlength(t, font=F(FR, 12)) / 2, y + tile / 2 + 14), t,
                   font=F(FR, 12), fill=INK3)

    # 继续上次（保存草稿）
    card(img, (22, 384, W - 22, 470), radius=18)
    img.alpha_composite(photo(58, 58, 12, PHOTOS[1]), (36, 398))
    d = ImageDraw.Draw(img)
    d.text((108, 400), '继续上次', font=F(FB, 15), fill=INK)
    d.text((108, 426), '四宫格 · 5 张照片 · 2 分钟前', font=F(FR, 12), fill=INK2)
    d.text((W - 42, 412), '›', font=F(FR, 24), fill=INK3)

    # 底部操作卡
    card(img, (16, H - 172, W - 16, H - 40), radius=24)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([32, H - 156, W - 32, H - 100], radius=16, fill=ACCENT)
    t = '开始拼图（5 张）'
    d.text(((W - d.textlength(t, font=F(FB, 17))) / 2, H - 140), t, font=F(FB, 17), fill='white')
    d.rounded_rectangle([32, H - 90, W - 32, H - 46], radius=16, fill='#F2F2F7')
    t2 = '长图拼接 · 上下相接'
    d.text(((W - d.textlength(t2, font=F(FR, 15))) / 2, H - 78), t2, font=F(FR, 15), fill=INK)
    home_bar(img)
    return img


def screen_edit():
    img = Image.new('RGBA', (W, H), BG)
    status_bar(img)
    d = ImageDraw.Draw(img)
    d.text((22, 54), '‹', font=F(FR, 30), fill=ACCENT)
    t = '四宫格'
    d.text(((W - d.textlength(t, font=F(FB, 17))) / 2, 62), t, font=F(FB, 17), fill=INK)
    t2 = '导出'
    d.text((W - 24 - d.textlength(t2, font=F(FB, 17)), 62), t2, font=F(FB, 17), fill=ACCENT)

    # 模板横滑（版式示意）
    tw, ty = 56, 106
    for i, lay in enumerate(LAYOUTS):
        x = 22 + i * (tw + 10)
        img.alpha_composite(layout_thumb(tw, lay, on=(i == 1)), (x, ty))
        if i == 1:
            d.rounded_rectangle([x - 3, ty - 3, x + tw + 3, ty + tw + 3], radius=15, outline=ACCENT, width=3)

    # 画布预览
    card(img, (22, 190, W - 22, W + 146), radius=22)
    inner, gap, pad = 316, 8, 15
    cell = (inner - gap) / 2
    bx, by = 22 + pad, 190 + pad
    k = 0
    for r in range(2):
        for c in range(2):
            img.alpha_composite(photo(int(cell), int(cell), 10, PHOTOS[k]), (int(bx + c * (cell + gap)), int(by + r * (cell + gap))))
            k += 1
    d.text((22, W + 158), '点任意一格：替换 / 裁剪取景   长按：调整顺序',
           font=F(FR, 12), fill=INK2)

    # 底部工具
    card(img, (16, H - 160, W - 16, H - 40), radius=24)
    labels = ['排序', '裁剪', '清晰度', '更多']
    for i, lab in enumerate(labels):
        cx = 46 + i * 84
        d.rounded_rectangle([cx - 30, H - 140, cx + 30, H - 96], radius=14,
                            fill=ACCENT if i == 2 else '#F2F2F7')
        col = 'white' if i == 2 else INK
        d.text((cx - d.textlength(lab, font=F(FR, 13)) / 2, H - 126), lab, font=F(FR, 13), fill=col)
    d.text((32, H - 84), '输出：高清 2048px · JPG', font=F(FR, 13), fill=INK2)
    home_bar(img)
    return img


def screen_result(edit):
    img = edit.copy()
    ov = Image.new('RGBA', (W, H), (0, 0, 0, 96))
    img.alpha_composite(ov)
    card(img, (16, H - 300, W - 16, H - 40), radius=28)
    d = ImageDraw.Draw(img)
    d.ellipse([40, H - 274, 84, H - 230], fill='#34C759')
    d.line([(51, H - 252), (59, H - 244), (73, H - 262)], fill='white', width=4, joint='curve')
    d.text((96, H - 272), '已保存到「下载」', font=F(FB, 19), fill=INK)
    d.text((96, H - 242), '拼图_20261105_2213.jpg · 2.4 MB', font=F(FR, 12), fill=INK2)
    d.rounded_rectangle([40, H - 214, W - 40, H - 200], radius=2, fill=LINE)

    d.rounded_rectangle([40, H - 186, 176, H - 134], radius=16, fill='#F2F2F7')
    t = '打开'
    d.text((40 + (136 - d.textlength(t, font=F(FB, 16))) / 2, H - 169), t, font=F(FB, 16), fill=INK)
    d.rounded_rectangle([192, H - 186, W - 40, H - 134], radius=16, fill=ACCENT)
    t = '分享'
    d.text((192 + (166 - d.textlength(t, font=F(FB, 16))) / 2, H - 169), t, font=F(FB, 16), fill='white')

    d.text((40, H - 112), '位置：手机存储 / Download', font=F(FR, 12), fill=INK2)
    d.text((40, H - 90), '再拼一张', font=F(FB, 15), fill=ACCENT)
    return img


if __name__ == '__main__':
    s1 = screen_pick()
    s2 = screen_edit()
    s3 = screen_result(s2)
    gap, m, top = 46, 40, 74
    Wt, Ht = m * 2 + W * 3 + gap * 2, top + H + 40
    out = Image.new('RGBA', (Wt, Ht), '#EDEFF3')
    d = ImageDraw.Draw(out)
    for i, (s, name) in enumerate([(s1, '① 选图'), (s2, '② 编辑'), (s3, '③ 导出结果')]):
        x = m + i * (W + gap)
        sh = shadow((W, H), 40, blur=24, alpha=44, offset=(0, 12))
        out.alpha_composite(sh, (x - 24, top - 24))
        out.alpha_composite(s, (x, top))
        d.rounded_rectangle([x, top, x + W, top + H], radius=40, outline='#D8DCE3', width=2)
        t = name
        d.text((x + (W - d.textlength(t, font=F(FB, 22))) / 2, top - 48), t, font=F(FB, 22), fill='#3A3A3C')
    out.convert('RGB').save(OUT / 'ui-mockup.png', quality=95)
    print('saved', OUT / 'ui-mockup.png', out.size)
