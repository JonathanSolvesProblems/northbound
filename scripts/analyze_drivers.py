"""What the driver file already says about Roadstar's fleet.

No other dataset needed. Run: python scripts/analyze_drivers.py
"""
import csv, os
from collections import Counter

RAW = os.path.join(os.path.dirname(__file__), '..', 'data', 'raw', 'drivers.csv')
NULLS = {'', '<null>', 'NULL', 'null', 'N/A'}

CA_PROV = {'ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'PE', 'NL', 'YT', 'NT', 'NU'}


def val(row, key):
    v = (row.get(key) or '').strip()
    return None if v in NULLS else v


def num(row, key):
    v = val(row, key)
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def dms(v):
    """TMS position format: 0433201N -> 43.5336 ; 0795300W -> -79.8833"""
    if not v or len(v) < 8:
        return None
    hemi = v[-1].upper()
    deg, minute, sec = int(v[0:3]), int(v[3:5]), int(v[5:7])
    dec = deg + minute / 60 + sec / 3600
    return -dec if hemi in ('S', 'W') else dec


def country_of(loc):
    """LAST_SAT_LOC looks like '0.21M W of MILTON, ON'. Trust the code, not geometry."""
    if not loc or ',' not in loc:
        return None
    code = loc.rsplit(',', 1)[1].strip().upper()[:2]
    if not code.isalpha():
        return None
    return 'CA' if code in CA_PROV else 'US'


with open(RAW, newline='', encoding='utf-8-sig', errors='replace') as fh:
    rows = [r for r in csv.DictReader(fh) if val(r, 'DRIVER_ID')]

print(f'\nROADSTAR FLEET SNAPSHOT  ({len(rows)} driver records)\n' + '=' * 62)

print('\nStatus')
for s, n in Counter(val(r, 'STATUS') or 'unknown' for r in rows).most_common():
    print(f'  {s:<18} {n:>4}')

print('\nCycle currently in force')
for z, n in Counter(val(r, 'CURRENT_DRIVER_CYCLE_ZONE') or 'unset' for r in rows).most_common():
    label = {'U': 'US cycle', 'C': 'Canadian cycle'}.get(z, z)
    print(f'  {label:<18} {n:>4}')

# Where is the fleet sitting right now
located = [(r, country_of(val(r, 'LAST_SAT_LOC'))) for r in rows]
by_country = Counter(c for _, c in located if c)
print('\nLast known position')
for c, n in by_country.most_common():
    print(f'  {"Canada" if c == "CA" else "United States":<18} {n:>4}')
print(f'  {"no position":<18} {sum(1 for _, c in located if not c):>4}')

# The dual-ruleset gap, straight out of their own columns
print('\n' + '=' * 62)
print('THE SAME DRIVER, TWO RULEBOOKS')
print('=' * 62)
gaps = []
for r in rows:
    us, ca = num(r, 'REMAINING_HOURS_US_7'), num(r, 'REMAINING_HOURS_CAN_7')
    if us is None or ca is None:
        continue
    gaps.append((val(r, 'FIRST_NAME'), us, ca, ca - us, country_of(val(r, 'LAST_SAT_LOC'))))

print(f'\n{len(gaps)} drivers carry both a US and a Canadian remaining-hours figure.')
material = [g for g in gaps if abs(g[3]) >= 1]
print(f'{len(material)} of them differ by an hour or more. '
      f'{len(material)/len(gaps)*100:.0f}% of the fleet.')

avg = sum(abs(g[3]) for g in gaps) / len(gaps)
print(f'Mean absolute difference: {avg:.1f} hours.')

# The operationally interesting case: short in the US, fine at home.
LOW = 11.0
stuck = [g for g in gaps if g[1] < LOW and g[2] >= LOW]
print(f'\n{len(stuck)} drivers have under {LOW:.0f}h left on their US cycle '
      f'while still holding {LOW:.0f}h or more on their Canadian one.')
if stuck:
    print('\n  DRIVER        US 7-day   CAN 7-day   GAIN   POSITION')
    for name, us, ca, gap, ctry in sorted(stuck, key=lambda g: -g[3])[:10]:
        where = {'US': 'in the US', 'CA': 'in Canada'}.get(ctry, 'unknown')
        print(f'  {name:<12} {us:>7.1f}   {ca:>8.1f}  {gap:>+6.1f}   {where}')

# Backhaul candidates: sitting in the US, available, with hours to run.
cands = [r for r, c in located
         if c == 'US' and val(r, 'STATUS') == 'AVAIL' and (num(r, 'REMAINING_HOURS') or 0) > 0]
print(f'\n{len(cands)} drivers are available, positioned in the US, and hold driving hours.')
print('These are the trucks that either find a load home or run empty.')
