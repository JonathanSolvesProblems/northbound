"""Empty miles in Roadstar's own completed dispatch history.

The ground truth here is theirs, not mine. I do not decide which legs ran, how far
they ran, or whether they ran loaded. Their TMS recorded all three and I only add
them up. The cost rate comes from ATRI, who I also do not control.

Run: python scripts/empty_miles.py
"""
import csv
from collections import Counter, defaultdict

SRC = 'data/raw/sheets/dispatch.csv'
NULLS = {'', '<null>', 'NULL', 'null', 'N/A'}
CA_PROV = {'ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'PE', 'NL', 'YT', 'NT', 'NU'}

ATRI_PER_MILE = 2.336        # ATRI, An Analysis of the Operational Costs of Trucking, 2026 edition (2025 costs)
ATRI_MARGINAL_PER_MILE = 1.854


def v(row, key):
    x = (row.get(key) or '').strip()
    return None if x in NULLS else x


def num(row, key):
    x = v(row, key)
    try:
        return float(x)
    except (TypeError, ValueError):
        return None


def country(desc):
    if not desc or ',' not in desc:
        return None
    code = desc.rsplit(',', 1)[1].strip().upper()[:2]
    if not code.isalpha():
        return None
    return 'CA' if code in CA_PROV else 'US'


rows = list(csv.DictReader(open(SRC, newline='', encoding='utf-8', errors='replace')))
print(f'{len(rows):,} completed dispatch legs\n')

flags = Counter(v(r, 'LS_MT_LOADED') or '?' for r in rows)
print('LS_MT_LOADED:', dict(flags))

dates = sorted(d[:10] for d in (v(r, 'LS_EXPECTED_DATE') for r in rows) if d and not d.startswith('1980'))
print(f'date range  : {dates[0]} to {dates[-1]}\n')

# Is LS_LEG_DIST miles or kilometres? Infer from the longest legs against a known
# geography: Ontario to southern California is about 2,200 miles / 3,600 km.
longest = sorted(rows, key=lambda r: -(num(r, 'LS_LEG_DIST') or 0))[:3]
print('longest legs, to sanity check the distance unit:')
for r in longest:
    print(f"  {num(r,'LS_LEG_DIST'):>8,.0f}  {v(r,'LEGO_ZONE_DESC')} -> {v(r,'LEGD_ZONE_DESC')}")
print()

EMPTY = 'E'   # their flag: L loaded, E empty
tot = defaultdict(float)
counts = Counter()
for r in rows:
    dist = num(r, 'LS_LEG_DIST') or 0.0
    empty = (v(r, 'LS_MT_LOADED') or '').upper() == EMPTY
    key = 'empty' if empty else 'loaded'
    tot[key] += dist
    counts[key] += 1

total_dist = tot['empty'] + tot['loaded']
total_legs = counts['empty'] + counts['loaded']
print('=' * 68)
print('EMPTY RUNNING IN ROADSTAR\'S OWN COMPLETED HISTORY')
print('=' * 68)
print(f"  loaded legs   {counts['loaded']:>7,}   {tot['loaded']:>12,.0f} miles")
print(f"  empty legs    {counts['empty']:>7,}   {tot['empty']:>12,.0f} miles")
print(f"  ---")
print(f"  total         {total_legs:>7,}   {total_dist:>12,.0f} miles")
if total_dist:
    print(f"\n  {tot['empty']/total_dist*100:.1f}% of all distance ran empty.")
    print(f"  {counts['empty']/total_legs*100:.1f}% of all legs ran empty.")

# Where the empty running happens, which is the part that matters for backhaul.
print('\n' + '=' * 68)
print('EMPTY LEGS BY DIRECTION')
print('=' * 68)
lanes = defaultdict(lambda: [0, 0.0])
for r in rows:
    if (v(r, 'LS_MT_LOADED') or '').upper() != EMPTY:
        continue
    o, d = country(v(r, 'LEGO_ZONE_DESC')), country(v(r, 'LEGD_ZONE_DESC'))
    lane = f'{o or "?"} -> {d or "?"}'
    lanes[lane][0] += 1
    lanes[lane][1] += num(r, 'LS_LEG_DIST') or 0.0

label = {
    'US -> CA': 'running home empty from the US',
    'US -> US': 'empty inside the US',
    'CA -> US': 'crossing south empty',
    'CA -> CA': 'empty inside Canada',
}
print(f'  {"LANE":<12}{"LEGS":>8}{"DISTANCE":>14}   what it is')
print('  ' + '-' * 64)
for lane, (n, dist) in sorted(lanes.items(), key=lambda kv: -kv[1][1]):
    print(f'  {lane:<12}{n:>8,}{dist:>14,.0f}   {label.get(lane, "")}')

home = lanes.get('US -> CA', [0, 0.0])
print('\n' + '=' * 68)
print(f"  {home[0]:,} empty legs came home from the United States,")
print(f"  covering {home[1]:,.0f} miles of running that earned nothing.")
print(f"\n  At ATRI's 2025 industry cost of ${ATRI_PER_MILE}/mile:  ${home[1]*ATRI_PER_MILE:,.0f}")
print(f"  Excluding fuel, at ${ATRI_MARGINAL_PER_MILE}/mile:       ${home[1]*ATRI_MARGINAL_PER_MILE:,.0f}")
print('=' * 68)
