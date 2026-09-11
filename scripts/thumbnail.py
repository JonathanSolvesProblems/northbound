"""Devpost thumbnail: the hero sign, filling a 3:2 card.

Rendered from the live page so it matches what a judge sees on the next click.
The gallery card is about 250 px wide, so only the sign, the name, and the one
bold line survive; the buttons and the second section are hidden, and nothing
is cut off mid-sentence at the bottom.

    python scripts/thumbnail.py     -> broll/thumbnail-3x2.png (1200x800, PNG)
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'broll' / 'thumbnail-3x2.png'
URL = 'https://jonathansolvesproblems.github.io/northbound/'

CSS = """
  main.road > *:not(.gantry):not(.hero) { display: none !important; }
  main.road { padding-bottom: 0 !important; min-height: 100vh; }
  .hero { margin-top: 64px !important; padding: 56px 52px 72px !important; }
  .hero h1 { font-size: 136px !important; line-height: 1 !important; }
  .hero .lede { font-size: 36px !important; line-height: 1.25 !important; margin-top: 30px !important; }
  .hero .dim { font-size: 26px !important; line-height: 1.35 !important; margin-top: 22px !important; }
  .hero .routes { display: none !important; }
  .hero .tab { font-size: 17px !important; }
"""

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': 1200, 'height': 800}, device_scale_factor=1, color_scheme='dark')
    pg = ctx.new_page()
    pg.goto(URL, wait_until='domcontentloaded', timeout=60_000)
    pg.evaluate('document.fonts.ready')
    pg.add_style_tag(content=CSS)
    pg.wait_for_timeout(800)
    pg.screenshot(path=str(OUT), clip={'x': 0, 'y': 0, 'width': 1200, 'height': 800})
    b.close()

print(f'{OUT.relative_to(ROOT)}  1200x800  {OUT.stat().st_size // 1024} KB')
