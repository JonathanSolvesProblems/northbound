"""Of Roadstar's empty US-to-US repositioning legs, how many were heading home?

A US point-to-point move on Canadian equipment is permitted under 19 CFR
123.14(c)(1) when it is "in the general direction of ... the return of the vehicle
to its base country". So an empty leg that was already travelling toward the border
is a leg that could legally have been carrying freight.

Ground truth is Roadstar's: which legs ran, how far, and whether they ran empty.
Coordinates are GeoNames. The cost rate is ATRI's. None of the three are mine.

Run: python scripts/fillable.py
"""
import csv, json, math
from collections import defaultdict

NULLS = {'', '<null>', 'NULL', 'null', 'N/A'}
CA_PROV = {'ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'PE', 'NL', 'YT', 'NT', 'NU'}
ATRI_PER_MILE = 2.336
MIN_RETURN_PROGRESS_KM = 25          # matches src/legal/cabotage.ts

# Same 15 crossings as src/legal/geo.ts, keyed by CBP port code.
CROSSINGS = [
    ('380001', 'Ambassador Bridge', 42.3120, -83.0733),
    ('380102', 'Gordie Howe International Bridge', 42.2925, -83.1085),
    ('380201', 'Bluewater Bridge', 42.9997, -82.4223),
    ('090101', 'Peace Bridge', 42.9053, -78.9060),
    ('090104', 'Lewiston-Queenston Bridge', 43.1637, -79.0430),
    ('070801', 'Thousand Islands Bridge', 44.3350, -75.9930),
    ('380301', 'Sault Ste. Marie', 46.5100, -84.3480),
    ('070401', 'Massena', 44.9861, -74.7369),
    ('070101', 'Ogdensburg', 44.7136, -75.4586),
    ('360401', 'International Falls', 48.6019, -93.4069),
    ('340101', 'Pembina', 48.9436, -97.2408),
    ('331001', 'Sweetgrass', 48.9986, -111.9633),
    ('300401', 'Pacific Highway', 49.0025, -122.7375),
    ('302301', 'Lynden', 49.0025, -122.4847),
    ('300901', 'Sumas', 49.0025, -122.2647),
]

from geocode import geocode_desc as lookup, country_of as country


def v(r, k):
    x = (r.get(k) or '').strip()
    return None if x in NULLS else x


def num(r, k):
    try:
        return float(v(r, k))
    except (TypeError, ValueError):
        return 0.0


def haversine_km(a, b):
    R = 6371.0088
    dlat = math.radians(b[0] - a[0]); dlon = math.radians(b[1] - a[1])
    h = math.sin(dlat/2)**2 + math.cos(math.radians(a[0]))*math.cos(math.radians(b[0]))*math.sin(dlon/2)**2
    return 2*R*math.asin(min(1, math.sqrt(h)))


def nearest_border_km(pt):
    return min(haversine_km(pt, (c[2], c[3])) for c in CROSSINGS)


rows = list(csv.DictReader(open('data/raw/sheets/dispatch.csv', newline='', encoding='utf-8', errors='replace')))
empty_us = [r for r in rows
            if (v(r, 'LS_MT_LOADED') or '').upper() == 'E'
            and country(v(r, 'LEGO_ZONE_DESC')) == 'US'
            and country(v(r, 'LEGD_ZONE_DESC')) == 'US']

toward, away, unresolved = [], [], []
lane_toward = defaultdict(lambda: [0, 0.0])

for r in empty_us:
    o, d = lookup(v(r, 'LEGO_ZONE_DESC')), lookup(v(r, 'LEGD_ZONE_DESC'))
    miles = num(r, 'LS_LEG_DIST')
    if not o or not d:
        unresolved.append((r, miles)); continue
    progress = nearest_border_km(o) - nearest_border_km(d)
    if progress >= MIN_RETURN_PROGRESS_KM:
        toward.append((r, miles, progress))
        lane = f"{v(r,'LEGO_ZONE_DESC')} -> {v(r,'LEGD_ZONE_DESC')}"
        lane_toward[lane][0] += 1
        lane_toward[lane][1] += miles
    else:
        away.append((r, miles))

tot_miles = sum(m for _, m in [(x[0], x[1]) for x in toward]) if toward else 0
tw_miles = sum(x[1] for x in toward)
aw_miles = sum(m for _, m in away)
un_miles = sum(m for _, m in unresolved)
all_miles = tw_miles + aw_miles + un_miles

print('=' * 72)
print("EMPTY US-TO-US LEGS THAT WERE ALREADY HEADING HOME")
print('=' * 72)
print(f'  Roadstar dispatch history, {len(empty_us):,} empty US-to-US legs, {all_miles:,.0f} miles\n')
print(f'  {"toward the border":<26}{len(toward):>6} legs{tw_miles:>12,.0f} miles')
print(f'  {"not toward the border":<26}{len(away):>6} legs{aw_miles:>12,.0f} miles')
print(f'  {"city not resolved":<26}{len(unresolved):>6} legs{un_miles:>12,.0f} miles')
print(f'\n  Gazetteer resolved {(len(toward)+len(away))/len(empty_us)*100:.1f}% of legs.')

print('\n' + '=' * 72)
print(f'  {len(toward)} empty legs, {tw_miles:,.0f} miles, ran toward the border with no freight.')
print(f'  19 CFR 123.14(c)(1) treats carriage in that direction as incidental to')
print(f'  international traffic, so those legs could legally have been paid for.')
print(f'\n  At ATRI 2025 ${ATRI_PER_MILE}/mile that is  ${tw_miles*ATRI_PER_MILE:,.0f}  over roughly two months.')
print('=' * 72)

print('\n  Repeating lanes worth a standing backhaul agreement:\n')
print(f'  {"LANE":<48}{"LEGS":>6}{"MILES":>9}')
print('  ' + '-' * 63)
for lane, (n, m) in sorted(lane_toward.items(), key=lambda kv: -kv[1][1])[:12]:
    print(f'  {lane[:48]:<48}{n:>6}{m:>9,.0f}')

if unresolved:
    misses = defaultdict(int)
    for r, _ in unresolved:
        for f in ('LEGO_ZONE_DESC', 'LEGD_ZONE_DESC'):
            if not lookup(v(r, f)):
                misses[v(r, f)] += 1
    print('\n  Unresolved place names (honest gap, not silently dropped):')
    for name, n in sorted(misses.items(), key=lambda kv: -kv[1])[:8]:
        print(f'    {n:>3}x  {name}')
