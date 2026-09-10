"""Capture b-roll for every shot in DEMO.md, as video.

For each shot this runs the REAL command, keeps its REAL output, then plays that
output back in a terminal-styled page at a readable pace and records it headless
through Playwright. Nothing on screen is typed by hand and nothing is seeded: the
text is exactly what the command printed.

    python scripts/broll.py            # all shots
    python scripts/broll.py 05 06      # just these
    python scripts/broll.py --replay   # re-record from the captured .txt, no re-running
    python scripts/broll.py --page     # record the deployed project page, scrolling

Output: broll/NN-name.mp4 (1920x1080, CRF 18) plus broll/NN-name.png (last frame)
and broll/NN-name.txt (the raw captured output, for the record).
"""
import json, os, re, subprocess, sys, time, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BROLL = ROOT / 'broll'
W, H = 1920, 1080

# Load .env so the model-backed shots run live.
_env = ROOT / '.env'
if _env.exists():
    for line in _env.read_text(encoding='utf-8').splitlines():
        if '=' in line and not line.strip().startswith('#'):
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip())

PY = sys.executable
NPX = shutil.which('npx.cmd') or shutil.which('npx') or 'npx'

# ------------------------------------------------------------------ shots
# focus: a substring of an output line to scroll into view and hold on.
# hold: seconds to rest on the final frame.
SHOTS = [
    dict(id='02-empty-miles', title='Roadstar, two months, where the empty miles are',
         cmd=[PY, 'scripts/empty_miles.py'], show='python scripts/empty_miles.py',
         focus='EMPTY LEGS BY DIRECTION', hold=6),
    dict(id='03-the-rule', title='19 CFR 123.14(c)(1)',
         cmd=[PY, '-c', "t=open('LEGAL.md',encoding='utf-8').read();s=t.index('## Layer 1');e=t.index('## Layer 2');print(t[s:e].strip())"],
         show='sed -n "/Layer 1/,/Layer 2/p" LEGAL.md',
         focus='general direction', hold=7),
    dict(id='04-headline', title='217 legs that could legally have carried freight',
         cmd=[PY, 'scripts/fillable.py'], show='python scripts/fillable.py',
         focus='At ATRI', hold=7),
    dict(id='05-offer-amber', title='GLM 5.2 reads it, the law decides: AMBER',
         cmd=[NPX, 'tsx', 'src/cli/offer.ts', '--driver', 'Driver67',
              'van, Fairburn GA to Walton KY, pu 9/12 0700-1200, 42k, $1450 all in'],
         show='npx tsx src/cli/offer.ts --driver Driver67 "van, Fairburn GA to Walton KY, pu 9/12 0700-1200, 42k, $1450 all in"',
         focus='AMBER', hold=8),
    dict(id='06-offer-red', title='The refusal, and what it prevented',
         cmd=[NPX, 'tsx', 'src/cli/offer.ts', '--driver', 'Driver18',
              "Hey, got a hot one. Columbus OH to Atlanta GA, loads tomorrow morning, 38,500 lbs dry van, paying $2,100. Your guy's sitting right there, can he grab it?"],
         show='npx tsx src/cli/offer.ts --driver Driver18 "Hey, got a hot one. Columbus OH to Atlanta GA, loads tomorrow morning, 38,500 lbs dry van, paying $2,100. Your guy\'s sitting right there, can he grab it?"',
         focus='RED', hold=8),
    dict(id='07-board', title='Two rulebooks, one driver, live CBP',
         cmd=[NPX, 'tsx', 'src/cli/board.ts'], show='npx tsx src/cli/board.ts',
         focus='LOSES 42.1h', hold=7),
    dict(id='08-overlap', title='Empty trucks beside their own freight',
         cmd=[PY, 'scripts/overlap.py'], show='python scripts/overlap.py',
         focus='FAIRBURN', hold=7),
    dict(id='09-ablation', title='With the model, and without',
         cmd=[NPX, 'tsx', 'src/cli/ablation.ts', '30'], show='npx tsx src/cli/ablation.ts 30',
         focus='CORRECT LEGAL VERDICT', hold=8, slow=True),
    dict(id='10-check-claims', title='The prose cannot drift from the data',
         cmd=[PY, 'scripts/check_claims.py'], show='python scripts/check_claims.py',
         focus='PASS:', hold=5),
]

# ------------------------------------------------------------------ player
PLAYER = r'''<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#12161c;overflow:hidden}
#term{position:absolute;inset:0;padding:44px 56px;box-sizing:border-box;
  font:22px/1.42 "Cascadia Code","Consolas","JetBrains Mono",ui-monospace,monospace;
  color:#d6dbe3;white-space:pre-wrap;overflow-wrap:anywhere;overflow:hidden}
#term .p{color:#7aa2f7}
#term .c{color:#e6edf3}
#term .cur{display:inline-block;width:11px;height:24px;background:#d6dbe3;vertical-align:-3px;
  animation:b 1s steps(1) infinite}
@keyframes b{50%{opacity:0}}
.hi{color:#ffd166}.ok{color:#7ee787}.bad{color:#ff7b72}.amb{color:#ffd166}.dim{color:#8b949e}
#bar{position:absolute;left:0;right:0;top:0;height:12px;background:#12161c}
</style></head><body><div id="term"></div><div id="bar"></div>
<script>
const D = __DATA__;
const term=document.getElementById('term');
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function colour(line){
  let h=esc(line);
  h=h.replace(/\b(PASS:.*|READY\.|OK)\b/g,'<span class="ok">$1</span>');
  h=h.replace(/\b(RED|FAIL:.*|NOT legal.*)\b/g,'<span class="bad">$1</span>');
  h=h.replace(/\b(AMBER|GREEN)\b/g,'<span class="amb">$1</span>');
  h=h.replace(/(\$[\d,]+)/g,'<span class="hi">$1</span>');
  h=h.replace(/^(=+|-+)$/g,'<span class="dim">$1</span>');
  return h;
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function run(){
  const prompt='<span class="p">roadstar</span> <span class="dim">$</span> ';
  let head=prompt; term.innerHTML=head+'<span class="cur"></span>';
  await sleep(250);
  for(const ch of D.cmd){ head+='<span class="c">'+esc(ch)+'</span>'; term.innerHTML=head+'<span class="cur"></span>'; await sleep(ch===' '?55:34); }
  await sleep(500);
  term.innerHTML=head;
  const out=document.createElement('div'); out.style.marginTop='0.4em'; term.appendChild(out);
  await sleep(D.slow?900:350);
  const lines=D.out; let focusEl=null;
  for(let i=0;i<lines.length;i++){
    const d=document.createElement('div'); d.className='ln'; d.innerHTML=colour(lines[i])||'&nbsp;';
    out.appendChild(d);
    if(!focusEl && D.focus && lines[i].includes(D.focus)) focusEl=d;
    term.scrollTop=term.scrollHeight;          // keep the tail in view, like a real terminal
    await sleep(lines[i].trim()===''?60:(D.slow?70:28));
  }
  await sleep(600);
  if(focusEl){
    const target=Math.max(0, focusEl.offsetTop - window.innerHeight*0.42);
    const from=term.scrollTop, t0=performance.now(), dur=900;
    await new Promise(res=>{ (function f(){ const k=Math.min(1,(performance.now()-t0)/dur); const e=1-Math.pow(1-k,3);
      term.scrollTop=from+(target-from)*e; if(k<1) requestAnimationFrame(f); else res(); })(); });
  }
  await sleep(D.hold*1000);
  document.title='DONE';
}
run();
</script></body></html>'''

# ------------------------------------------------------------------ page shots
# The project page is b-roll too. Recorded from the deployed URL, so what the
# video shows is exactly what a judge opens.
PAGE_URL = 'https://jonathansolvesproblems.github.io/northbound/'
PAGE_SHOTS = [
    dict(id='00-page-hero',     hold=5,  scroll_to=None),
    dict(id='00-page-scroll',   hold=2,  scroll_to='section.sign:nth-of-type(3)', glide=9),
    dict(id='00-page-headline', hold=6,  scroll_to='section.sign:nth-of-type(3)'),
    dict(id='00-page-verdicts', hold=6,  scroll_to='#verdicts', media=True),
    dict(id='00-page-close',    hold=5,  scroll_to='footer'),
]


def record_page(shot):
    from playwright.sync_api import sync_playwright
    vid_dir = BROLL / '_rec'; vid_dir.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={'width': W, 'height': H}, color_scheme='dark',
                                  record_video_dir=str(vid_dir), record_video_size={'width': W, 'height': H})
        page = ctx.new_page()
        # networkidle waits on 11 MB of looping media; fonts are what the frame needs.
        page.goto(PAGE_URL, wait_until='domcontentloaded')
        page.evaluate('document.fonts.ready')
        page.wait_for_timeout(900)
        if shot.get('media'):
            page.wait_for_function("[...document.querySelectorAll('video')].every(v=>v.readyState>=2)", timeout=40_000)
        if shot.get('glide'):
            # a slow human scroll from the top to the target, then rest
            target_y = page.evaluate(f"document.querySelector('{shot['scroll_to']}').getBoundingClientRect().top + window.scrollY - 24")
            steps = int(shot['glide'] * 60)
            for i in range(1, steps + 1):
                k = i / steps; e = 1 - (1 - k) ** 3
                page.evaluate(f"window.scrollTo(0, {target_y} * {e})")
                page.wait_for_timeout(16)
        elif shot.get('scroll_to'):
            page.evaluate(f"document.querySelector('{shot['scroll_to']}').scrollIntoView({{block:'start', behavior:'smooth'}})")
            page.wait_for_timeout(1400)
        page.wait_for_timeout(int(shot['hold'] * 1000))
        page.screenshot(path=str(BROLL / f'{shot["id"]}.png'))
        video = page.video; ctx.close(); webm = Path(video.path()); browser.close()
    mp4 = BROLL / f'{shot["id"]}.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(webm), '-vf', f'scale={W}:{H}:flags=lanczos,format=yuv420p',
                    '-r', '30', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-movflags', '+faststart', str(mp4)], check=True)
    webm.unlink(missing_ok=True)
    return mp4


ANSI = re.compile(r'\x1b\[[0-9;]*[A-Za-z]')


def capture(shot, replay=False):
    cached = BROLL / f'{shot["id"]}.txt'
    if replay and cached.exists():
        lines = cached.read_text(encoding='utf-8').splitlines()
        print(f'\n[{shot["id"]}] replaying {len(lines)} captured lines')
        return lines, 0
    print(f'\n[{shot["id"]}] running: {shot["show"][:70]}')
    t0 = time.time()
    r = subprocess.run(shot['cmd'], cwd=ROOT, capture_output=True, text=True,
                       encoding='utf-8', errors='replace', env={**os.environ, 'PYTHONIOENCODING': 'utf-8'})
    out = ANSI.sub('', (r.stdout or '') + (('\n' + r.stderr) if r.returncode and r.stderr else ''))
    lines = [ln.rstrip() for ln in out.splitlines()]
    while lines and not lines[0].strip():
        lines.pop(0)
    print(f'   {len(lines)} lines, exit {r.returncode}, {time.time()-t0:.0f}s')
    (BROLL / f'{shot["id"]}.txt').write_text('\n'.join(lines), encoding='utf-8')
    return lines, r.returncode


def record(shot, lines):
    from playwright.sync_api import sync_playwright
    page_path = BROLL / f'_{shot["id"]}.html'
    data = dict(cmd=shot['show'], out=lines, focus=shot.get('focus'), hold=shot.get('hold', 5), slow=shot.get('slow', False))
    page_path.write_text(PLAYER.replace('__DATA__', json.dumps(data)), encoding='utf-8')

    vid_dir = BROLL / '_rec'
    vid_dir.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx = browser.new_context(viewport={'width': W, 'height': H},
                                  record_video_dir=str(vid_dir), record_video_size={'width': W, 'height': H},
                                  device_scale_factor=1)
        page = ctx.new_page()
        page.goto(page_path.as_uri())
        # Estimate the playback length and wait for the page to declare itself done.
        est = 2 + len(shot['show']) * 0.04 + len(lines) * (0.07 if shot.get('slow') else 0.03) + shot.get('hold', 5) + 3
        try:
            page.wait_for_function("document.title==='DONE'", timeout=int((est + 30) * 1000))
        except Exception:
            print('   (timed out waiting for playback end, keeping what was recorded)')
        page.screenshot(path=str(BROLL / f'{shot["id"]}.png'))
        video = page.video
        ctx.close()
        webm = Path(video.path())
        browser.close()

    mp4 = BROLL / f'{shot["id"]}.mp4'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(webm),
                    '-vf', f'scale={W}:{H}:flags=lanczos,format=yuv420p', '-r', '30',
                    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-movflags', '+faststart', str(mp4)], check=True)
    webm.unlink(missing_ok=True)
    page_path.unlink(missing_ok=True)
    return mp4


def probe(mp4):
    r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries',
                        'stream=width,height,r_frame_rate:format=duration', '-of', 'json', str(mp4)],
                       capture_output=True, text=True)
    j = json.loads(r.stdout)
    s = j['streams'][0]
    return f"{s['width']}x{s['height']} {float(j['format']['duration']):.1f}s"


def main():
    BROLL.mkdir(exist_ok=True)
    args = sys.argv[1:]
    replay = '--replay' in args
    want = set(a for a in args if not a.startswith('--'))
    results = []
    if '--page' in args or any(w.startswith('00') for w in want):
        for shot in PAGE_SHOTS:
            if want and not any(shot['id'].startswith(w) for w in want) and '--page' not in args:
                continue
            print(f'\n[{shot["id"]}] recording the live page')
            mp4 = record_page(shot)
            results.append((shot['id'], probe(mp4)))
            print(f'   -> {mp4.name}  {results[-1][1]}')
    if '--page' in args and not want:
        chosen = []
    else:
        chosen = [s for s in SHOTS if not want or any(s['id'].startswith(w) for w in want)]
    for shot in chosen:
        lines, code = capture(shot, replay=replay)
        if not lines:
            print('   no output, skipping recording'); results.append((shot['id'], 'NO OUTPUT')); continue
        mp4 = record(shot, lines)
        results.append((shot['id'], probe(mp4)))
        print(f'   -> {mp4.name}  {results[-1][1]}')
    shutil.rmtree(BROLL / '_rec', ignore_errors=True)
    print('\nB-ROLL')
    for sid, info in results:
        print(f'  {sid:<18} {info}')


if __name__ == '__main__':
    main()
