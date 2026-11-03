# kids-icons.py: draw the kids app's icons into public/kids/ (green field, two white children of
# different heights, a small terracotta heart between them, as Casa Artlia's house with its heart).
# Run from the fork root: python tools/kids-icons.py
from PIL import Image, ImageDraw

GREEN, WHITE, HEART = (46, 125, 91), (255, 255, 255), (194, 89, 58)


def heart(d, cx, cy, r, fill):
    d.ellipse([cx - r, cy - r * 0.9, cx, cy + r * 0.1], fill=fill)
    d.ellipse([cx, cy - r * 0.9, cx + r, cy + r * 0.1], fill=fill)
    d.polygon([(cx - r * 0.97, cy - 0.25 * r), (cx + r * 0.97, cy - 0.25 * r), (cx, cy + r * 1.05)], fill=fill)


def draw(size, safe=1.0):
    """safe < 1 shrinks the drawing into the maskable safe zone."""
    s = size * 4
    img = Image.new("RGB", (s, s), GREEN)
    d = ImageDraw.Draw(img)
    k = s * safe
    o = (s - k) / 2
    P = lambda x, y: (o + x * k, o + y * k)   # noqa: E731

    def child(cx, head_y, head_r, body_w, body_top, body_bottom):
        x0, y0 = P(cx - head_r, head_y - head_r); x1, y1 = P(cx + head_r, head_y + head_r)
        d.ellipse([x0, y0, x1, y1], fill=WHITE)
        bx0, by0 = P(cx - body_w / 2, body_top); bx1, by1 = P(cx + body_w / 2, body_bottom)
        rad = (bx1 - bx0) / 2
        d.rounded_rectangle([bx0, by0, bx1, by1 + rad], radius=rad, fill=WHITE)

    child(0.34, 0.36, 0.105, 0.30, 0.50, 0.80)   # the older one
    child(0.68, 0.47, 0.085, 0.24, 0.585, 0.80)  # the younger one
    d.rectangle([0, P(0, 0.80)[1], s, s], fill=GREEN)   # cut the bodies flat at the bottom
    hx, hy = P(0.515, 0.30)
    heart(d, hx, hy, 0.055 * k, HEART)
    return img.resize((size, size), Image.LANCZOS)


out = "public/kids/"
for name, size, safe in [("logo-512.png", 512, 1), ("logo-192.png", 192, 1), ("apple-touch-icon.png", 180, 1),
                         ("favicon-32.png", 32, 1), ("favicon-16.png", 16, 1), ("logo-maskable-512.png", 512, 0.8)]:
    draw(size, safe).save(out + name)
print("icons in public/kids/")
