"""Validate the rendered demo, not the plan.

Every check here has caught a real fault on a previous video. Run only after
the render has exited; reading a file that is still being written reports bugs
that are already fixed.

    python scripts/check_video.py broll/demo.mp4
"""
import json, re, subprocess, sys
from pathlib import Path

VIDEO = Path(sys.argv[1] if len(sys.argv) > 1 else 'broll/demo.mp4')
PLAN = Path('broll/demo.edit-plan.json')
FRAMES = Path('broll/_frames'); FRAMES.mkdir(exist_ok=True)


def ff(args):
    return subprocess.run(['ffmpeg', '-hide_banner', *args], capture_output=True, text=True).stderr


def probe(*args):
    return subprocess.run(['ffprobe', '-v', 'error', *args, str(VIDEO)], capture_output=True, text=True).stdout.strip()


problems = []

# container
dur = float(probe('-show_entries', 'format=duration', '-of', 'csv=p=0'))
res = probe('-select_streams', 'v', '-show_entries', 'stream=width,height', '-of', 'csv=p=0').replace(',', 'x')
sr = probe('-select_streams', 'a', '-show_entries', 'stream=sample_rate', '-of', 'csv=p=0')
print(f'file        {VIDEO}  {res}  {int(dur // 60)}m{dur % 60:04.1f}s  audio {sr} Hz')
if not (180 <= dur <= 300):
    problems.append(f'duration {dur:.0f}s is outside the 3 to 5 minute rule')
if sr not in ('44100', '48000'):
    problems.append(f'audio sample rate {sr} Hz is non-standard; remux with -ar 48000')

# loudness
lu = ff(['-i', str(VIDEO), '-af', 'ebur128=framelog=quiet', '-f', 'null', '-'])
m = re.search(r'I:\s+(-?[0-9.]+) LUFS', lu)
if m:
    i = float(m.group(1)); print(f'loudness    {i:.1f} LUFS  (target -16)')
    if abs(i + 16) > 2: problems.append(f'loudness {i:.1f} LUFS, off target')

# black frames
bd = ff(['-i', str(VIDEO), '-vf', 'blackdetect=d=0.3:pix_th=0.06', '-an', '-f', 'null', '-'])
blacks = re.findall(r'black_start:([0-9.]+) black_end:([0-9.]+)', bd)
print(f'black       {len(blacks)} segment(s)' + (f'  {blacks[:3]}' if blacks else ''))
if blacks: problems.append(f'{len(blacks)} black segment(s)')

# motion per segment: every beat should move
plan = json.load(open(PLAN, encoding='utf-8'))
intro = float(plan.get('intro_duration', 0)) if plan.get('add_intro_card') else 0.0
print('motion per beat (scene changes above a low threshold):')
for s in plan['segments']:
    a, b = s['start_time'] + intro, s['end_time'] + intro
    sc = ff(['-ss', f'{a:.2f}', '-to', f'{b:.2f}', '-i', str(VIDEO), '-vf', "select='gt(scene,0.0005)',metadata=print", '-an', '-f', 'null', '-'])
    n = len(re.findall(r'scene_score', sc))
    still = s['clip_id'] in ('01-title', '11-close')
    flag = '' if (n > 0 or still) else '   <-- FROZEN?'
    print(f'   {s["clip_id"]:<18} {a:6.1f}-{b:6.1f}s  {n:4d}{flag}')
    if n == 0 and not still: problems.append(f'{s["clip_id"]} shows no motion')

# a frame from the middle of each beat, for the read-the-annotation check
for s in plan['segments']:
    mid = (s['start_time'] + s['end_time']) / 2 + intro
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{mid:.2f}', '-i', str(VIDEO), '-frames:v', '1',
                    str(FRAMES / f'{s["clip_id"]}.png')])
print(f'frames      {len(plan["segments"])} mid-beat frames in {FRAMES}/ for the eyeball check')

# blank openings: a Playwright recording starts before the page paints, and the
# page's dark background is not black, so blackdetect never sees it. The hero
# shot opened on 2.5s of flat #12161c once. A flat frame has no pixel spread.
from PIL import Image, ImageStat
print('opening frames (pixel spread 0.3s into each beat; flat means nothing painted yet):')
for s in plan['segments']:
    t = s['start_time'] + intro + 0.3
    f = FRAMES / f'_open-{s["clip_id"]}.png'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', f'{t:.2f}', '-i', str(VIDEO), '-frames:v', '1', str(f)])
    im = Image.open(f).convert('L')
    im = im.crop((0, 0, im.width, int(im.height * 0.7)))   # above the captions and lower third
    spread = ImageStat.Stat(im).stddev[0]
    flag = '' if spread > 4 else '   <-- BLANK?'
    print(f'   {s["clip_id"]:<18} {spread:5.1f}{flag}')
    if spread <= 4: problems.append(f'{s["clip_id"]} opens on a blank frame')
    f.unlink(missing_ok=True)

# caption sync: nothing should render before the first spoken word
first_word = plan['_transcript']['segments'][0]['words'][0]['start'] + intro
print(f'captions    first word at {first_word:.2f}s (intro card is {intro:.1f}s); check _frames for early captions')

print()
if problems:
    print('PROBLEMS:'); [print('  -', p) for p in problems]; sys.exit(1)
print('PASS: the rendered file is within spec.')
