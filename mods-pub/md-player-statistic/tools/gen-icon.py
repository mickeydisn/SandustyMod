#!/usr/bin/env python3
"""Generate assets/statistic-icon.png — the hotbar icon for md-player-statistic.

The engine's `items.register` reads `sandkit.graphics[sprite.id].texture`
unconditionally, so this file MUST exist or the item never registers and the
overlay is unreachable. Regenerate with:

    python3 tools/gen-icon.py
"""
import os
import struct
import zlib

S = 32
# Palette mirrors KPI_CATEGORIES in src/constants.ts.
BG = (0x0F, 0x17, 0x2A, 0xCC)
BORDER = (0x33, 0x41, 0x55, 0xFF)
BARS = [(0x4A, 0xDE, 0x80), (0x60, 0xA5, 0xFA), (0xFB, 0xBF, 0x24)]  # green, blue, amber

px = [[(0, 0, 0, 0) for _ in range(S)] for _ in range(S)]

# Dark plate with slightly rounded corners.
for y in range(2, S - 2):
    for x in range(2, S - 2):
        cx = min(x - 2, S - 3 - x)
        cy = min(y - 2, S - 3 - y)
        if (cx, cy) in ((0, 0), (1, 0), (0, 1)):
            continue
        px[y][x] = BG

# 1px border.
for i in range(S):
    for (x, y) in ((i, 1), (i, S - 2), (1, i), (S - 2, i)):
        if px[y][x][3]:
            px[y][x] = BORDER

# Three ascending bars — a "statistics" glyph.
bar_w, gap = 5, 3
heights = [8, 14, 20]
base_y = S - 7
for i, h in enumerate(heights):
    col = BARS[i]
    bx = 7 + i * (bar_w + gap)
    for y in range(base_y - h, base_y):
        for x in range(bx, bx + bar_w):
            if 0 <= x < S and 0 <= y < S:
                px[y][x] = (*col, 0xFF)

raw = b"".join(
    b"\x00" + b"".join(struct.pack("BBBB", *px[y][x]) for x in range(S)) for y in range(S)
)


def chunk(tag: bytes, data: bytes) -> bytes:
    body = tag + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


png = (
    b"\x89PNG\r\n\x1a\n"
    + chunk(b"IHDR", struct.pack(">IIBBBBB", S, S, 8, 6, 0, 0, 0))
    + chunk(b"IDAT", zlib.compress(raw, 9))
    + chunk(b"IEND", b"")
)

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "assets", "statistic-icon.png")
out = os.path.normpath(out)
with open(out, "wb") as fh:
    fh.write(png)
print("wrote %s (%d bytes, %dx%d)" % (out, len(png), S, S))
