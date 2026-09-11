"""Devpost thumbnail: the hero sign, filling a 3:2 card.

Rendered from the live page so it matches what a judge sees on the next click.
The gallery card is about 250 px wide, so the sign fills the frame edge to edge
and carries only the name and the one bold line. The gantry, the road margins,
the second sentence, the buttons and every later section are hidden: at card
size they were grey noise around a small green rectangle.

    python scripts/thumbnail.py     -> broll/thumbnail-3x2.png (1200x800, PNG)
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'broll' / 'thumbnail-3x2.png'
URL = 'https://jonathansolvesproblems.github.io/northbound/'

CSS = """
  /* the sign IS the card: no gantry, no road margins, nothing a 250 px card cannot show */
  main.road > *:not(.hero) { display: none !important; }
  main.road { max-width: none !important; padding: 0 !important; margin: 0 !important; }
  main.road::before, main.road::after { display: none !important; }
  .hero { margin: 0 !important; position: fixed !important; inset: 22px !important;
          padding: 0 !important; display: flex !important; flex-direction: column !important;
          justify-content: center !important; align-items: flex-start !important;
          padding-left: 64px !important; padding-right: 64px !important; box-sizing: border-box !important; }
  .hero h1 { font-size: 140px !important; line-height: .92 !important; margin: 0 0 18px !important;
             letter-spacing: -.03em !important; white-space: nowrap !important; }
  .hero .lede { font-size: 58px !important; line-height: 1.12 !important; margin: 24px 0 0 !important;
                max-width: none !important; font-weight: 700 !important; }
  .hero .lede b { display: block; }
  .hero .lede .empty { color: var(--warn); }
  .hero .lede-rest { display: none !important; }
  .hero .dim { display: none !important; }
  .hero .routes { display: none !important; }
  .hero .tab { font-size: 22px !important; right: 48px !important; top: 0 !important;
               padding: 10px 22px !important; }
"""

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': 1200, 'height': 800}, device_scale_factor=1, color_scheme='dark')
    pg = ctx.new_page()
    pg.goto(URL, wait_until='domcontentloaded', timeout=60_000)
    pg.evaluate('document.fonts.ready')
    pg.evaluate("""() => { const l = document.querySelector('.hero .lede'); const b = l.querySelector('b');
      [...l.childNodes].filter(n => n !== b).forEach(n => { const s = document.createElement('span');
        s.className = 'lede-rest'; s.textContent = n.textContent; l.replaceChild(s, n); });
      b.innerHTML = b.textContent.replace('Empty.', '<span class="empty">Empty.</span>'); }""")
    pg.add_style_tag(content=CSS)
    pg.wait_for_timeout(800)
    pg.screenshot(path=str(OUT), clip={'x': 0, 'y': 0, 'width': 1200, 'height': 800})
    b.close()

print(f'{OUT.relative_to(ROOT)}  1200x800  {OUT.stat().st_size // 1024} KB')
