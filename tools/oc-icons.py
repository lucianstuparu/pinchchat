# oc-icons.py: draw oc's icons into public/ from the coach's mark: a disc #f72585 with a white dot, 37.5% of its width
# (my.design v2/README.md, rule 10; Lucian 2026-11-05: "Replace the smiley everywhere"). The icon an OS masks itself,
# Apple's and the maskable one fill the square, since a transparent corner shows black or gets cut.
# Run from the fork root: python tools/oc-icons.py
from PIL import Image, ImageDraw

PINK, WHITE = (247, 37, 133, 255), (255, 255, 255, 255)


def disc(size):
    s = size * 4
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse([0, 0, s - 1, s - 1], fill=PINK)
    r = s * 0.1875
    d.ellipse([s / 2 - r, s / 2 - r, s / 2 + r, s / 2 + r], fill=WHITE)
    return img.resize((size, size), Image.LANCZOS)


def filled(size, dot):
    """The whole square pink; `dot` is the dot's share of the width (0.3 keeps it inside the maskable safe zone)."""
    s = size * 4
    img = Image.new("RGBA", (s, s), PINK)
    d = ImageDraw.Draw(img)
    r = s * dot / 2
    d.ellipse([s / 2 - r, s / 2 - r, s / 2 + r, s / 2 + r], fill=WHITE)
    return img.resize((size, size), Image.LANCZOS).convert("RGB")


for name, size in (("favicon-16", 16), ("favicon-32", 32), ("logo-192", 192), ("logo-512", 512), ("logo", 512)):
    disc(size).save(f"public/{name}.png", optimize=True)
filled(180, 0.3).save("public/apple-touch-icon.png", optimize=True)
filled(512, 0.3).save("public/logo-maskable-512.png", optimize=True)
