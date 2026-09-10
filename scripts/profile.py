"""Profile every CSV in data/raw. Run: python scripts/profile.py [file...]

Answers the only question that matters right now: does this data support a
backtest against Roadstar's own history, or does it not.
"""
import csv, sys, glob, os, re
from collections import Counter

RAW = os.path.join(os.path.dirname(__file__), '..', 'data', 'raw')

DATE_RE = re.compile(r'^\d{1,2}/\d{1,2}/\d{4}')
NUM_RE = re.compile(r'^-?\d+(\.\d+)?$')
NULLS = {'', '<null>', 'NULL', 'null', 'N/A'}


def kind(v):
    if v in NULLS:
        return 'null'
    if DATE_RE.match(v):
        return 'date'
    if NUM_RE.match(v):
        return 'num'
    return 'str'


def profile(path):
    with open(path, newline='', encoding='utf-8-sig', errors='replace') as fh:
        rows = list(csv.DictReader(fh))
    if not rows:
        print(f'{os.path.basename(path)}: EMPTY')
        return
    cols = list(rows[0].keys())
    print(f'\n{"="*78}\n{os.path.basename(path)}   {len(rows)} rows x {len(cols)} cols\n{"="*78}')
    print(f'{"COLUMN":<28} {"FILL":>6} {"UNIQ":>6}  TYPE   SAMPLE')
    print('-' * 78)
    for c in cols:
        vals = [(r.get(c) or '').strip() for r in rows]
        nonnull = [v for v in vals if v not in NULLS]
        fill = len(nonnull) / len(vals) * 100
        uniq = len(set(nonnull))
        types = Counter(kind(v) for v in nonnull)
        t = types.most_common(1)[0][0] if types else 'null'
        sample = next((v for v in nonnull), '')
        if len(sample) > 26:
            sample = sample[:26] + '...'
        flag = '  <-- EMPTY' if fill == 0 else ''
        print(f'{c:<28} {fill:5.0f}% {uniq:>6}  {t:<5}  {sample}{flag}')


if __name__ == '__main__':
    targets = sys.argv[1:] or sorted(glob.glob(os.path.join(RAW, '*.csv')))
    if not targets:
        print('No CSVs in data/raw yet.')
    for t in targets:
        profile(t)
