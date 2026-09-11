"""Author the vidkit edit plan by hand.

Hand-authored on purpose: the rule for this video is that whenever the narration
cites a number, the source is on screen. A planner might do that. This guarantees
it. Boundaries come from the Whisper transcript of the spliced narration; the cue
words (19 CFR, ATRI, CBP) each cut to the page that backs them.

Also proofreads the transcript. Whisper `small` wrote Roadster, lakes, fright,
North Brown, and "section 519. Two" for section 592, and every one of those would
have burned into the captions.

    python scripts/edit_plan.py          -> broll/demo.edit-plan.json, broll/narration/narration-padded.mp3
"""
import json, subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NARR = ROOT / 'broll' / 'narration'
TRANSCRIPT = json.load(open(NARR / 'transcript.json', encoding='utf-8'))
OUT = ROOT / 'broll' / 'demo.edit-plan.json'

END = TRANSCRIPT['duration']           # 268.6
OUTRO = 5.4                             # branded close card after the last word
PAD = OUTRO + 0.4

# ------------------------------------------------------------ proofread
# word-level fixes, applied in order; a value of None deletes the word
FIX = {
    'Roadster': 'Roadstar', "Roadster's": "Roadstar's", 'roadster': 'Roadstar',
    'northbound': 'Northbound', 'Brown': None,
    'lakes,': 'legs,', 'lakes': 'legs',
    'pays': 'pastes',
    '519.': '592', 'Two': None,
    'weight': 'wait', 'Etobioca,': 'Etobicoke,', 'red': 'read',
    'fright': 'freight', 'MC,': 'Empty.', 'pros': 'prose', 'sponsors': "sponsor's",
    'Regex': 'regex', 'Spur': 'SPUR', 'B1': 'B-1', 'an': None,
}
# some fixes only make sense at a specific place; guard by neighbour
def fix_words(words):
    out = []
    for i, w in enumerate(words):
        t = w['word'].strip()
        nxt = words[i + 1]['word'].strip().rstrip('.') if i + 1 < len(words) else ''   # 'twice.' is 'twice'
        prv = words[i - 1]['word'].strip() if i > 0 else ''
        if t == 'North' and nxt == 'Brown':
            out.append({**w, 'word': ' Northbound'}); continue
        if t == 'Brown' and prv == 'North':
            continue
        if t == 'Two' and prv == '519.':
            continue
        if t == 'an' and prv == 'as' and nxt == 'incidental':
            continue
        if t == 'red' and nxt == 'twice':
            out.append({**w, 'word': ' read'}); continue
        if t == 'Carriage' and prv == 'says':
            out.append({**w, 'word': ' carriage'}); continue
        if t == 'Red' and nxt == 'not':
            out.append({**w, 'word': ' Red.'}); continue
        if t == 'not' and prv == 'Red':
            out.append({**w, 'word': ' Not'}); continue
        if t == 'this' and prv == 'MC,':
            out.append({**w, 'word': ' This'}); continue
        if t == 'Then' and nxt == '42':
            out.append({**w, 'word': ' Van,'}); continue
        if t == '14' and nxt == '.50':
            out.append({**w, 'word': ' $1,450'}); continue
        if t == '.50' and prv == '14':
            continue
        if t == 'the' and nxt == 'real':
            out.append({**w, 'word': ' their'}); continue
        if t in ('Then', 'Two', 'an', 'red', 'the'):
            out.append(w); continue
        rep = FIX.get(t, t)
        if rep is None:
            continue
        # keep Whisper's own spacing on untouched words, so ",000" stays glued to "2"
        out.append(w if rep == t else {**w, 'word': ' ' + rep})
    return out

def glue_splits(words):
    """Whisper emits "$155" + ",000" and "88" + "%" as two tokens, the second with
    no leading space. The caption renderer strips every token and joins them with
    spaces, so the burned-in caption reads "$155 ,000". Fold each continuation
    into the token before it."""
    out = []
    for w in words:
        if out and not w['word'].startswith(' '):
            out[-1] = {**out[-1], 'word': out[-1]['word'] + w['word'], 'end': w['end']}
        else:
            out.append(w)
    return out

# proofread across the whole narration, not per Whisper segment: "section 519." ended
# one segment and the stray "Two" opened the next, so a per-segment neighbour guard
# never saw them together. The captioner flattens the words anyway.
_words = glue_splits(fix_words([w for seg in TRANSCRIPT['segments'] for w in seg['words']]))
TRANSCRIPT['segments'] = [{'start': _words[0]['start'], 'end': _words[-1]['end'],
                           'text': ''.join(w['word'] for w in _words).strip(), 'words': _words}]

# Whisper pins the first word to 0.00 even though the voice starts at 0.6s, so the
# opening caption would sit on screen for half a second of silence right after
# the title card. Speech onset measured from the waveform (RMS > 0.02).
first = TRANSCRIPT['segments'][0]['words'][0]
first['start'] = max(first['start'], 0.55)
TRANSCRIPT['text'] = ' '.join(s['text'] for s in TRANSCRIPT['segments'])

# ------------------------------------------------------------ segments
# start times are the first word of each beat in the transcript
S = lambda clip, a, b, lt='', ip=0.0: {
    'clip_id': clip, 'start_time': round(a, 2), 'end_time': round(b, 2),
    'lower_third': lt, 'effect': 'none', **({'in_point': ip} if ip else {}),
}
segments = [
    # the first 2.5s of the hero recording are the page loading cold (fonts, the
    # 11 MB media); scene detect puts first paint at 2.57s, so start after it
    S('00-page-hero',       0.0,   15.4, ip=2.7),
    S('02-empty-miles',    15.4,   37.8, "Roadstar's own dispatch history"),
    S('00-page-scroll',    37.8,   47.4),
    S('12-cfr-123-14',     47.4,   67.3, 'Source: 19 CFR 123.14(c)(1), Cornell LII'),
    S('00-page-headline',  67.3,   80.2),
    S('13-atri-cost',      80.2,   91.8, 'Source: ATRI, July 2026', ip=1.0),   # white until first paint at 0.93s
    S('00-page-verdicts',  91.8,  101.2),
    S('05-offer-amber',   101.2,  130.1, 'GLM 5.2 on SPUR, live'),
    S('06-offer-red',     130.1,  158.9, 'The refusal'),
    S('07-board',         158.9,  182.8, '34 real trucks, live CBP waits'),
    # the Ambassador Bridge commercial page: GENERAL tab for 1.6s, then the FAST tab,
    # so "both lanes" is literally on screen. The click is at 10.2s in the encoded
    # clip (scene detect), about 2.8s earlier than broll.py's wall-clock estimate,
    # because Playwright's recording starts after the page is created.
    S('14-cbp-waits',     182.8,  186.3, 'Source: bwt.cbp.gov, live', ip=8.6),
    S('08-overlap',       186.3,  215.9, "Their own order book"),
    S('09-ablation',      215.9,  247.4, 'n = 100, model on vs off'),
    S('10-check-claims',  247.4,  261.8, 'check_claims.py'),
    S('00-page-close',    261.8,  END),
    S('11-close',         END,    END + OUTRO),
]

plan = {
    'project_name': 'Northbound',
    'segments': segments,
    'add_intro_card': True,
    'intro_clip': '01-title',
    'intro_duration': 3.5,
    'intro_effect': 'none',
    'add_outro_card': False,
    'theme': {
        'palette': {'bg': '#31302D', 'accent': '#F5C400', 'text': '#F4F3EF', 'text2': '#A9A7A2'},
        'captions': {'word_pop': False, 'margin_v': 100},
    },
    '_transcript': TRANSCRIPT,
}
json.dump(plan, open(OUT, 'w', encoding='utf-8'), indent=1)

# pad the narration so -shortest keeps the close card
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(NARR / 'narration.mp3'),
                '-af', f'apad=pad_dur={PAD}', '-b:a', '192k', str(NARR / 'narration-padded.mp3')], check=True)

# sanity: every clip exists and is at least as long as its segment
from subprocess import run
bad = 0
for s in segments:
    f = ROOT / 'broll' / f"{s['clip_id']}.mp4"
    if not f.exists():
        print(f'  MISSING {f.name}'); bad += 1; continue
    dur = float(run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(f)],
                    capture_output=True, text=True).stdout.strip())
    need = s['end_time'] - s['start_time'] + s.get('in_point', 0)
    flag = 'ok ' if dur >= need else 'SHORT, will loop'
    if dur < need: bad += 1
    print(f"  {flag:<16} {s['clip_id']:<18} needs {need:5.1f}s  has {dur:5.1f}s")
print(f'\n{len(segments)} segments, {END + OUTRO:.1f}s + 3.5s intro. {"all clips long enough" if not bad else str(bad) + " problem(s)"}')
print(f'plan -> {OUT.relative_to(ROOT)}')
