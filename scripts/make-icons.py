"""Draws Ovelo's "Glowing O" icon and writes every PNG the app needs.

Run from the repo root:  python3 scripts/make-icons.py

No image libraries: each pixel's colour is worked out directly, with
anti-aliased edges from the distance to the ring's edges. The colours match
src/constants/theme.ts (sky, white, and coral glowing into amber).
"""
import math, os, struct, zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKY = (0xBF, 0xE1, 0xF8)
WHITE = (0xFF, 0xFF, 0xFF)
CORAL = (0xE8, 0x56, 0x2A)
AMBER = (0xF5, 0x9E, 0x0B)


def mix(a, b, t):
    t = max(0.0, min(1.0, t))
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def write_png(path, size, pixels):
    rows = b''.join(b'\x00' + bytes(pixels[y * size * 4:(y + 1) * size * 4]) for y in range(size))
    def chunk(kind, data):
        c = struct.pack('>I', len(data)) + kind + data
        return c + struct.pack('>I', zlib.crc32(kind + data) & 0xFFFFFFFF)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(rows, 9)) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


def render(size, *, background, ring_outer, ring_inner, ring_colour='glow', corner=0.0):
    """background: 'sky' (sky fading to white top to bottom) or None (transparent).
    ring_outer / ring_inner: radii as a fraction of the size. corner: rounded
    corner radius as a fraction of the size (0 = square)."""
    px = bytearray(size * size * 4)
    c = size / 2
    ro, ri = ring_outer * size, ring_inner * size
    rc = corner * size
    for y in range(size):
        fy = (y + 0.5) / size
        bg = mix(SKY, WHITE, fy)
        for x in range(size):
            fx = (x + 0.5) / size
            # Rounded square mask (1 inside, 0 outside, soft edge).
            if rc > 0:
                qx = max(abs(x + 0.5 - c) - (c - rc), 0.0)
                qy = max(abs(y + 0.5 - c) - (c - rc), 0.0)
                d = math.hypot(qx, qy) - rc
                mask = max(0.0, min(1.0, 0.5 - d))
            else:
                mask = 1.0
            # Ring coverage from distance to its two edges.
            r = math.hypot(x + 0.5 - c, y + 0.5 - c)
            cover = max(0.0, min(1.0, 0.5 - (r - ro))) * max(0.0, min(1.0, 0.5 - (ri - r)))
            if ring_colour == 'glow':
                # Coral at the ring's top-left edge to amber at its bottom-right.
                lo, hi = 0.5 - ring_outer, 0.5 + ring_outer
                ring = mix(CORAL, AMBER, ((fx + fy) / 2 - lo) / (hi - lo)) if hi > lo else CORAL
            else:
                ring = ring_colour
            if background == 'sky':
                col = mix(bg, ring, cover)
                alpha = mask
            else:
                col = ring
                alpha = cover * mask
            i = (y * size + x) * 4
            px[i:i + 4] = bytes((round(col[0]), round(col[1]), round(col[2]), round(alpha * 255)))
    return px


# The mock: ring radius 27 with a 13 wide stroke on a 100 square.
OUTER, INNER = 0.335, 0.205
jobs = [
    # iOS and the universal icon: square, opaque (the system rounds the corners).
    ('icon.png', 1024, dict(background='sky', ring_outer=OUTER, ring_inner=INNER)),
    # Android adaptive icon: the ring sits inside the safe middle area.
    ('android-icon-foreground.png', 1024, dict(background=None, ring_outer=0.25, ring_inner=0.153)),
    ('android-icon-background.png', 1024, dict(background='sky', ring_outer=0, ring_inner=0)),
    ('android-icon-monochrome.png', 1024, dict(background=None, ring_outer=0.25, ring_inner=0.153, ring_colour=(255, 255, 255))),
    # Browser tab: rounded square, like the Home Screen look.
    ('favicon.png', 196, dict(background='sky', ring_outer=OUTER, ring_inner=INNER, corner=0.22)),
    # Splash screen: just the glowing ring, shown on a plain background.
    ('splash-icon.png', 512, dict(background=None, ring_outer=0.48, ring_inner=0.294)),
    # "Add to Home Screen" on iPhone: Safari looks for this at the site root.
    ('../../public/apple-touch-icon.png', 180, dict(background='sky', ring_outer=OUTER, ring_inner=INNER)),
]
for name, size, opts in jobs:
    path = os.path.normpath(os.path.join(ROOT, 'assets', 'images', name))
    write_png(path, size, render(size, **opts))
    print('wrote', os.path.relpath(path, ROOT), size)
