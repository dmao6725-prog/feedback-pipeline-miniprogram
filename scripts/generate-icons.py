#!/usr/bin/env python3
"""Generate local PNG icons for the mini program without external deps."""

from __future__ import annotations

import math
import os
import struct
import zlib


OUT_DIR = os.path.join("miniprogram", "assets", "icons")
GRAY = (152, 162, 179, 255)
BLUE = (47, 109, 246, 255)


class Canvas:
    def __init__(self, width: int, height: int, scale: int = 4):
        self.w = width
        self.h = height
        self.scale = scale
        self.sw = width * scale
        self.sh = height * scale
        self.pixels = bytearray(self.sw * self.sh * 4)

    def blend(self, x: int, y: int, color):
        if x < 0 or y < 0 or x >= self.sw or y >= self.sh:
            return
        idx = (y * self.sw + x) * 4
        r, g, b, a = color
        src_a = a / 255.0
        dst_a = self.pixels[idx + 3] / 255.0
        out_a = src_a + dst_a * (1.0 - src_a)
        if out_a <= 0:
            return
        for offset, value in enumerate((r, g, b)):
            dst = self.pixels[idx + offset]
            out = (value * src_a + dst * dst_a * (1.0 - src_a)) / out_a
            self.pixels[idx + offset] = int(out + 0.5)
        self.pixels[idx + 3] = int(out_a * 255 + 0.5)

    def disk(self, cx: float, cy: float, radius: float, color):
        cx *= self.scale
        cy *= self.scale
        radius *= self.scale
        min_x = int(cx - radius - 1)
        max_x = int(cx + radius + 1)
        min_y = int(cy - radius - 1)
        max_y = int(cy + radius + 1)
        rr = radius * radius
        for y in range(min_y, max_y + 1):
            for x in range(min_x, max_x + 1):
                if (x - cx) * (x - cx) + (y - cy) * (y - cy) <= rr:
                    self.blend(x, y, color)

    def line(self, x1, y1, x2, y2, color, width=6):
        dist = max(1, math.hypot(x2 - x1, y2 - y1))
        steps = int(dist * self.scale * 1.8)
        for i in range(steps + 1):
            t = i / steps
            self.disk(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, width / 2, color)

    def polyline(self, points, color, width=6):
        for i in range(len(points) - 1):
            self.line(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1], color, width)

    def rect(self, x, y, w, h, color, width=6, radius=10):
        self.line(x + radius, y, x + w - radius, y, color, width)
        self.line(x + radius, y + h, x + w - radius, y + h, color, width)
        self.line(x, y + radius, x, y + h - radius, color, width)
        self.line(x + w, y + radius, x + w, y + h - radius, color, width)
        self.arc(x + radius, y + radius, radius, math.pi, 1.5 * math.pi, color, width)
        self.arc(x + w - radius, y + radius, radius, 1.5 * math.pi, 2 * math.pi, color, width)
        self.arc(x + w - radius, y + h - radius, radius, 0, 0.5 * math.pi, color, width)
        self.arc(x + radius, y + h - radius, radius, 0.5 * math.pi, math.pi, color, width)

    def arc(self, cx, cy, radius, start, end, color, width=6):
        steps = max(8, int(abs(end - start) * radius * 1.5))
        points = []
        for i in range(steps + 1):
            t = start + (end - start) * (i / steps)
            points.append((cx + math.cos(t) * radius, cy + math.sin(t) * radius))
        self.polyline(points, color, width)

    def circle(self, cx, cy, radius, color, width=6):
        self.arc(cx, cy, radius, 0, 2 * math.pi, color, width)

    def downsample(self):
        out = bytearray(self.w * self.h * 4)
        s = self.scale
        area = s * s
        for y in range(self.h):
            for x in range(self.w):
                totals = [0, 0, 0, 0]
                for yy in range(s):
                    for xx in range(s):
                        idx = ((y * s + yy) * self.sw + (x * s + xx)) * 4
                        for c in range(4):
                            totals[c] += self.pixels[idx + c]
                out_idx = (y * self.w + x) * 4
                for c in range(4):
                    out[out_idx + c] = int(totals[c] / area + 0.5)
        return out


def write_png(path: str, width: int, height: int, rgba: bytes):
    def chunk(kind: bytes, data: bytes) -> bytes:
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)
        raw.extend(rgba[y * stride:(y + 1) * stride])

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def save(name: str, width: int, height: int, draw):
    canvas = Canvas(width, height)
    draw(canvas)
    write_png(os.path.join(OUT_DIR, name), width, height, canvas.downsample())


def draw_analysis(c: Canvas, color):
    c.rect(18, 20, 60, 56, color, width=6, radius=10)
    c.line(30, 62, 68, 62, color, width=5)
    c.line(32, 56, 32, 48, color, width=6)
    c.line(44, 56, 44, 40, color, width=6)
    c.line(56, 56, 56, 46, color, width=6)
    c.polyline([(30, 36), (42, 42), (54, 30), (68, 34)], color, width=5)


def draw_history(c: Canvas, color):
    c.circle(48, 48, 28, color, width=7)
    c.line(48, 48, 48, 31, color, width=6)
    c.line(48, 48, 61, 56, color, width=6)
    c.arc(32, 24, 12, 2.9, 4.7, color, width=6)


def draw_settings(c: Canvas, color):
    for y, knob in ((30, 62), (48, 36), (66, 54)):
        c.line(24, y, 72, y, color, width=6)
        c.disk(knob, y, 7, color)


def draw_empty_history(c: Canvas, color):
    c.rect(48, 38, 96, 118, color, width=8, radius=18)
    c.rect(70, 24, 52, 28, color, width=8, radius=12)
    c.line(70, 82, 122, 82, color, width=7)
    c.line(70, 108, 122, 108, color, width=7)
    c.line(70, 134, 104, 134, color, width=7)


def draw_upload(c: Canvas, color):
    c.rect(32, 18, 64, 92, color, width=7, radius=12)
    c.line(70, 18, 96, 44, color, width=7)
    c.line(70, 18, 70, 44, color, width=7)
    c.line(70, 44, 96, 44, color, width=7)
    c.line(64, 90, 64, 54, color, width=8)
    c.polyline([(48, 70), (64, 54), (80, 70)], color, width=8)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    icons = [
        ("tab-analysis.png", 96, 96, GRAY, draw_analysis),
        ("tab-analysis-active.png", 96, 96, BLUE, draw_analysis),
        ("tab-history.png", 96, 96, GRAY, draw_history),
        ("tab-history-active.png", 96, 96, BLUE, draw_history),
        ("tab-settings.png", 96, 96, GRAY, draw_settings),
        ("tab-settings-active.png", 96, 96, BLUE, draw_settings),
        ("empty-history.png", 192, 192, BLUE, draw_empty_history),
        ("upload-file.png", 128, 128, BLUE, draw_upload),
    ]
    for name, width, height, color, draw_fn in icons:
        save(name, width, height, lambda canvas, c=color, fn=draw_fn: fn(canvas, c))


if __name__ == "__main__":
    main()
