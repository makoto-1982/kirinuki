#!/usr/bin/env python3
import json
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "scripts" / "og-assets"
OUT = ROOT / "public" / "og"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 1200, 630
NAVY, CREAM, INK = "#071B4A", "#FFF2CC", "#061A49"
ORANGE, CYAN, BEIGE = "#FF603B", "#49C0E2", "#E8D09A"

def font(size):
    return ImageFont.truetype(str(ASSETS / "m-plus-rounded-1c-japanese-800-normal.woff"), size)

def font_bold(size):
    return ImageFont.truetype(str(ASSETS / "m-plus-rounded-1c-japanese-700-normal.woff"), size)

def contain(image, max_w, max_h):
    ratio = min(max_w / image.width, max_h / image.height)
    return image.resize((round(image.width * ratio), round(image.height * ratio)), Image.Resampling.LANCZOS)

def rounded(draw, xy, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)

def paste_logo(canvas, logo):
    logo = contain(logo, 384, 140)
    canvas.alpha_composite(logo, ((W-logo.width)//2, 22 + (140-logo.height)//2))

def play(draw):
    cx, cy, r = 349, 375, 53
    draw.ellipse((cx-r, cy-r, cx+r, cy+r), fill=CREAM, outline=INK, width=6)
    draw.polygon([(cx-10,cy-19),(cx-10,cy+19),(cx+23,cy)], fill=INK)

def fit_lines(draw, text, max_width=405, max_lines=3):
    for size in range(43, 27, -1):
        f = font(size)
        lines, current = [], ""
        for char in text.strip():
            candidate = current + char
            if current and draw.textlength(candidate, font=f) > max_width:
                lines.append(current)
                current = char
            else:
                current = candidate
        if current:
            lines.append(current)
        if len(lines) <= max_lines:
            # Avoid an orphaned Japanese character (for example the final "ー").
            if len(lines) >= 2:
                while len(lines[-1]) < 4 and len(lines[-2]) > 4:
                    lines[-1] = lines[-2][-1] + lines[-1]
                    lines[-2] = lines[-2][:-1]
            return lines, f, size
    return lines[:max_lines], font(28), 28

def safe_id(value):
    if not re.fullmatch(r"[A-Za-z0-9_-]+", value):
        raise ValueError(f"Unsafe clip id: {value}")
    return value

def render_card(clip, left, right, logo):
    image = Image.new("RGBA", (W, H), NAVY)
    draw = ImageDraw.Draw(image)
    for y in range(24, H, 44):
        for x in range(22, W, 44):
            draw.ellipse((x, y, x+4, y+4), fill="#193D77")

    image.alpha_composite(left, (-380, -28))
    image.alpha_composite(right, (755, -42))
    paste_logo(image, logo)

    rounded(draw, (250,190,968,585), 42, "#020D2E")
    rounded(draw, (238,177,956,572), 42, CREAM, BEIGE, 8)
    rounded(draw, (272,220,425,529), 28, CYAN, INK, 7)
    play(draw)
    rounded(draw, (450,220,922,529), 28, "#FFF8E7", INK, 7)

    draw.text((480,254), f"切り抜き  ·  EP.{int(clip['episode']):03d}", font=font_bold(24), fill=ORANGE)
    lines, title_font, size = fit_lines(draw, clip["clipTitle"])
    spacing = max(7, round(size * .22))
    draw.multiline_text((479,322), "\n".join(lines), font=title_font, fill=INK, spacing=spacing)
    return image.convert("RGB")

def main():
    clips = json.loads((ROOT / "data" / "clips.json").read_text(encoding="utf-8"))
    left = contain(Image.open(ASSETS / "karatachi-left.png").convert("RGBA"), 970, 720)
    right = contain(Image.open(ASSETS / "karatachi-right.png").convert("RGBA"), 790, 760)
    logo = Image.open(ASSETS / "saihate-logo.png").convert("RGBA")

    expected = set()
    for clip in clips:
        clip_id = safe_id(clip["id"])
        target = OUT / f"{clip_id}.jpg"
        expected.add(target.name)
        render_card(clip, left, right, logo).save(target, "JPEG", quality=86, optimize=True, progressive=True)

    for old in OUT.glob("*.jpg"):
        if old.name not in expected:
            old.unlink()
    print(f"Generated {len(clips)} OG images in {OUT}")

if __name__ == "__main__":
    main()
