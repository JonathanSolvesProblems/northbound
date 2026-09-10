"""Judge-frame screenshots of the project page, plus the OG image.

Renders docs/index.html at 1280x720, the size it is seen at in a video player
or a judge's laptop browser, so the screenshot test is against the real frame.

    python scripts/shots.py            # local file
    python scripts/shots.py --live     # the deployed GitHub Pages URL
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'broll'
LIVE = 'https://jonathansolvesproblems.github.io/northbound/'


def main():
    url = LIVE if '--live' in sys.argv else (ROOT / 'docs' / 'index.html').as_uri()
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(headless=True)

        pg = b.new_page(viewport={'width': 1280, 'height': 720})
        pg.goto(url, wait_until='networkidle'); pg.wait_for_timeout(1400)
        pg.screenshot(path=str(OUT / '_site-1280-hero.png'))
        for name, sel in (('headline', 'section.sign:nth-of-type(3)'), ('verdicts', '#verdicts'), ('ablation', '#ablation')):
            pg.evaluate(f"document.querySelector('{sel}').scrollIntoView({{block:'start'}})")
            pg.wait_for_timeout(1100)
            pg.screenshot(path=str(OUT / f'_site-1280-{name}.png'))

        og = b.new_page(viewport={'width': 1200, 'height': 630})
        og.goto(url, wait_until='networkidle'); og.wait_for_timeout(1400)
        og.evaluate("window.scrollTo(0, 30)"); og.wait_for_timeout(300)
        og.screenshot(path=str(ROOT / 'docs' / 'media' / 'og.png'))

        b.close()
    print('wrote broll/_site-1280-{hero,headline,verdicts,ablation}.png and docs/media/og.png')


if __name__ == '__main__':
    main()
