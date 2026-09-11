"""Devpost image gallery: eight 3:2 previews with a caption each, under 140 characters.

Story order, the same as the video: the sign, what the data said, the rule, the
headline, an amber verdict, the red refusal, the board, the ablation. Page shots
are rendered from the live page at a 3:2 viewport. Terminal shots are the last
frames of the b-roll clips, letterboxed to 3:2 in the terminal's own background
so nothing is cropped (the red refusal wraps to the full width).

    python scripts/preview.py     -> broll/preview/1..8-*.png + broll/preview/captions.md
"""
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'broll' / 'preview'
STILLS = ROOT / 'broll' / '_stills'
URL = 'https://jonathansolvesproblems.github.io/northbound/'
W, H = 1500, 1000                      # 3:2
TERM_BG = (18, 22, 28)                 # the terminal player's background

PAGE = [
    ('1-northbound', None),
    ('2-their-data', 'section.sign:nth-of-type(1)'),
    ('3-the-rule',   'section.sign:nth-of-type(2)'),
    ('4-headline',   'section.sign:nth-of-type(3)'),
]
TERMINAL = [
    ('5-amber-verdict', '05-offer-amber'),
    ('6-red-refusal',   '06-offer-red'),
    ('7-board',         '07-board'),
    ('8-ablation',      '09-ablation'),
]
CAPTIONS = {
    '1-northbound':    "A load board that knows which US freight a Canadian truck is legally allowed to haul. Built on Roadstar's own dispatch history.",
    '2-their-data':    "Where the empty miles really are. In 10,479 real legs, coming home empty happened 6 times. Repositioning inside the US: 778.",
    '3-the-rule':      "19 CFR 123.14(c)(1) allows US point-to-point freight as part of the return to base country. So the verdict turns on direction.",
    '4-headline':      "217 empty legs, 66,702 miles, already heading for the border and legally able to carry freight. $155,815 at ATRI's cost per mile.",
    '5-amber-verdict': "Paste the offer as it arrived. GLM 5.2 on SPUR reads it, the regulation decides. Fairburn GA to Walton KY: amber, heading home.",
    '6-red-refusal':   "The refusal. Columbus OH to Atlanta GA moves away from base, so it is red, naming Tariff Act section 592 and the driver's B-1 status.",
    '7-board':         "34 real trucks, two rulebooks, live CBP waits. Driver 84 has 53 hours on the US cycle and 11 the moment he crosses at Bluewater.",
    '8-ablation':      "Same 100 real offers in five broker formats, read twice. GLM 5.2 on: 100% reach the correct legal verdict. Model off: 40%.",
}
for k, c in CAPTIONS.items():
    assert len(c) <= 140, f'{k}: {len(c)} characters'

OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1, color_scheme='dark')
    pg = ctx.new_page()
    pg.goto(URL, wait_until='domcontentloaded', timeout=60_000)
    pg.evaluate('document.fonts.ready')
    pg.wait_for_function("[...document.querySelectorAll('video')].every(v=>v.readyState>=2)", timeout=40_000)
    pg.wait_for_timeout(600)
    for name, sel in PAGE:
        if sel:
            pg.evaluate(f"window.scrollTo(0, document.querySelector('{sel}').getBoundingClientRect().top + window.scrollY - 28)")
        else:
            pg.evaluate('window.scrollTo(0, 0)')
        pg.wait_for_timeout(700)      # the headlight sweep on the sign settles
        pg.screenshot(path=str(OUT / f'{name}.png'))
    b.close()

for name, still in TERMINAL:
    src = Image.open(STILLS / f'{still}.png').convert('RGB')
    canvas = Image.new('RGB', (src.width, src.width * 2 // 3), TERM_BG)
    canvas.paste(src, (0, (canvas.height - src.height) // 2))
    canvas.save(OUT / f'{name}.png')

lines = ['# Image gallery, upload in this order', '',
         'One caption per image, each under 140 characters (Devpost limit). Same order as the video.', '']
for name in [n for n, _ in PAGE] + [n for n, _ in TERMINAL]:
    im = Image.open(OUT / f'{name}.png')
    lines += [f'## {name}.png  ({im.width}x{im.height}, {len(CAPTIONS[name])} chars)', '', '```', CAPTIONS[name], '```', '']
(OUT / 'captions.md').write_text('\n'.join(lines), encoding='utf-8')

for f in sorted(OUT.glob('*.png')):
    im = Image.open(f)
    print(f'  {f.name:<22} {im.width}x{im.height}  {f.stat().st_size // 1024:>4} KB   {len(CAPTIONS[f.stem]):>3} chars')
print(f'\n{len(CAPTIONS)} images + captions.md in {OUT.relative_to(ROOT)}')
