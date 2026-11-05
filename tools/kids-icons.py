# kids-icons.py: draw the Kids app's icons into public/kids/: a kite on the app's green, four panels
# (gold, white, white, rose) with a waving tail and two bows. Chosen 2026-11-05 over two faces and a
# paper boat: it stays clear at favicon size, and it is nobody's portrait.
# Run from the fork root: python tools/kids-icons.py
from PIL import Image, ImageDraw

GREEN, WHITE, GOLD, ROSE, INK = (46, 125, 91), (255, 255, 255), (255, 209, 102), (242, 138, 178), (29, 59, 47)
TOP, RIGHT, BOTTOM, LEFT = (0.585, 0.09), (0.835, 0.385), (0.475, 0.68), (0.235, 0.325)


def cross():
    """Where the spine (top-bottom) meets the spar (left-right)."""
    (x1, y1), (x2, y2), (x3, y3), (x4, y4) = TOP, BOTTOM, LEFT, RIGHT
    d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
    t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d
    return (x1 + t * (x2 - x1), y1 + t * (y2 - y1))


def bezier(p0, p1, p2, p3, n=48):
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        yield (u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
               u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1])


def draw(size, safe=1.0):
    """safe < 1 shrinks the drawing into the maskable safe zone."""
    s = size * 4 if size > 64 else 512   # small icons are drawn big and scaled down
    img = Image.new("RGB", (s, s), GREEN)
    d = ImageDraw.Draw(img)
    k = s * safe
    o = (s - k) / 2
    P = lambda p: (o + p[0] * k, o + p[1] * k)   # noqa: E731

    def line(points, w, fill):
        pts = [P(p) for p in points]
        d.line(pts, fill=fill, width=round(w * k), joint="curve")
        r = w * k / 2
        for x, y in (pts[0], pts[-1]):
            d.ellipse([x - r, y - r, x + r, y + r], fill=fill)

    # The tail first, under the kite; thicker on the small icons so it survives.
    tail_w = 0.022 if size > 64 else 0.04
    a = list(bezier(BOTTOM, (0.40, 0.76), (0.56, 0.78), (0.44, 0.84)))
    b = list(bezier((0.44, 0.84), (0.37, 0.88), (0.31, 0.87), (0.25, 0.92)))
    line(a + b, tail_w, WHITE)
    for (x, y), turn in (((0.46, 0.765), 1), ((0.36, 0.875), -1)):
        d.polygon([P((x, y)), P((x - 0.075, y - 0.05 * turn)), P((x - 0.065, y + 0.05 * turn))], fill=ROSE)
        d.polygon([P((x, y)), P((x + 0.075, y + 0.05 * turn)), P((x + 0.065, y - 0.05 * turn))], fill=GOLD)

    c = cross()
    for corners, fill in (((TOP, LEFT), GOLD), ((TOP, RIGHT), WHITE), ((BOTTOM, LEFT), WHITE), ((BOTTOM, RIGHT), ROSE)):
        d.polygon([P(corners[0]), P(corners[1]), P(c)], fill=fill)
    if size > 64:   # the sticks would only smudge at favicon size
        line([TOP, BOTTOM], 0.012, INK)
        line([LEFT, RIGHT], 0.012, INK)
    return img.resize((size, size), Image.LANCZOS)


out = "public/kids/"
for name, size, safe in [("logo-512.png", 512, 1), ("logo-192.png", 192, 1), ("apple-touch-icon.png", 180, 1),
                         ("favicon-32.png", 32, 1), ("favicon-16.png", 16, 1), ("logo-maskable-512.png", 512, 0.8)]:
    draw(size, safe).save(out + name)
print("icons in public/kids/")
