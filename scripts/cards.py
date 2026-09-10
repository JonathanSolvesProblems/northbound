"""Branded title and end cards for the demo, 1920x1080.

Drawn at 4x and downsampled so the circle edge and the ring do not stair-step.
The headshot crop starts at y=0 and is SQUARE, resized square to square, because
the top of the hair sits at y=27 of 1500 and any lower crop decapitates him.

    python scripts/cards.py
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps
import subprocess

ROOT = Path(__file__).resolve().parent.parent
BROLL = ROOT / 'broll'
W, H = 1920, 1080
S = 4                       # supersample

BG = (18, 22, 28)           # matches the terminal player
ACCENT = (255, 209, 102)    # amber, the colour of the verdict that matters
TEXT = (230, 237, 243)
MUTED = (139, 148, 158)


def font(size, bold=False):
    for name in (['segoeuib.ttf', 'arialbd.ttf'] if bold else ['segoeui.ttf', 'arial.ttf']):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def mono(size):
    for name in ('CascadiaCode.ttf', 'consola.ttf', 'cour.ttf'):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def headshot_circle(diameter):
    src = Image.open(BROLL / '_headshot.jpg').convert('RGB')
    side = src.width                       # 1000, square crop from the very top
    face = src.crop((0, 0, side, side)).resize((diameter, diameter), Image.LANCZOS)
    mask = Image.new('L', (diameter, diameter), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, diameter - 1, diameter - 1), fill=255)
    out = Image.new('RGBA', (diameter, diameter), (0, 0, 0, 0))
    out.paste(face, (0, 0), mask)
    return out


def card(lines_below, out_name):
    img = Image.new('RGB', (W * S, H * S), BG)
    d = ImageDraw.Draw(img)

    dia = 300 * S
    ring = 6 * S
    cx, cy = W * S // 2, int(H * S * 0.34)
    d.ellipse((cx - dia // 2 - ring, cy - dia // 2 - ring, cx + dia // 2 + ring, cy + dia // 2 + ring), fill=ACCENT)
    img.paste(headshot_circle(dia), (cx - dia // 2, cy - dia // 2), headshot_circle(dia))

    y = cy + dia // 2 + 44 * S
    title = font(96 * S, bold=True)
    tw = d.textlength('NORTHBOUND', font=title)
    d.text((cx - tw / 2, y), 'NORTHBOUND', font=title, fill=TEXT)
    y += 96 * S + 22 * S

    d.rectangle((cx - 60 * S, y, cx + 60 * S, y + 5 * S), fill=ACCENT)
    y += 5 * S + 24 * S

    site = font(34 * S)
    sw = d.textlength('jonathansolvesproblems.com', font=site)
    d.text((cx - sw / 2, y), 'jonathansolvesproblems.com', font=site, fill=MUTED)
    y += 34 * S + 40 * S

    for text, f, col in lines_below:
        if col == ACCENT:
            y += 22 * S           # breathe before the link line
        lw = d.textlength(text, font=f)
        d.text((cx - lw / 2, y), text, font=f, fill=col)
        y += f.size + 12 * S

    img = img.resize((W, H), Image.LANCZOS)
    png = BROLL / f'{out_name}.png'
    img.save(png)
    return png


def still_to_video(png, seconds, name):
    mp4 = BROLL / f'{name}.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-loop', '1', '-i', str(png), '-t', str(seconds),
                    '-vf', 'format=yuv420p', '-r', '30', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
                    '-movflags', '+faststart', str(mp4)], check=True)
    return mp4


if __name__ == '__main__':
    sub = font(40 * S)
    small = mono(28 * S)

    opening = card([
        ('Built on Roadstar Trucking’s dispatch history', sub, TEXT),
        ('RoadStar Hackathon 2026', sub, MUTED),
    ], '01-title')
    still_to_video(opening, 4, '01-title')

    closing = card([
        ('Your truck already drove that lane. Empty.', sub, TEXT),
        ('Northbound finds the freight it could legally have carried.', sub, TEXT),
        ('github.com/JonathanSolvesProblems/northbound', small, ACCENT),
    ], '11-close')
    still_to_video(closing, 5, '11-close')

    print('cards written: 01-title, 11-close')
