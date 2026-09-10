"""Empty trucks running lanes where Roadstar already had freight moving.

Careful about the claim. Every order in Tlorder was hauled, so none of it is
"revenue left on the table". The honest and more interesting finding is a
utilisation one: an empty truck ran a lane, in the direction of home, at the same
time as a load of theirs moved along that same lane. Same company, two trucks, one
of them empty and legally able to carry.

Ground truth is entirely Roadstar's: which legs ran empty, which orders moved,
when, and from where. Coordinates are GeoNames. The rate is ATRI's.

Run: python scripts/overlap.py
"""
import csv, json, math
from datetime import datetime, timedelta
from collections import defaultdict

NULLS = {'', '<null>', 'NULL', 'null', 'N/A'}
CA_PROV = {'ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'PE', 'NL', 'YT', 'NT', 'NU'}
ATRI_PER_MILE = 2.336
MIN_RETURN_PROGRESS_KM = 25
NEAR_ORIGIN_KM = 150          # how close a pickup has to be to count as "on the lane"
TIME_WINDOW_H = 48

CROSSINGS = [
    (42.3120, -83.0733), (42.2925, -83.1085), (42.9997, -82.4223), (42.9053, -78.9060),
    (43.1637, -79.0430), (44.3350, -75.9930), (46.5100, -84.3480), (44.9861, -74.7369),
    (44.7136, -75.4586), (48.6019, -93.4069), (48.9436, -97.2408), (48.9986, -111.9633),
    (49.0025, -122.7375), (49.0025, -122.4847), (49.0025, -122.2647),
]
from geocode import geocode as geo, geocode_desc as geo_desc, country_of as country_desc


def v(r, k):
    x = (r.get(k) or '').strip()
    return None if x in NULLS else x


def num(r, k):
    try:
        return float(v(r, k))
    except (TypeError, ValueError):
        return 0.0


def hav(a, b):
    R = 6371.0088
    dlat = math.radians(b[0]-a[0]); dlon = math.radians(b[1]-a[1])
    h = math.sin(dlat/2)**2 + math.cos(math.radians(a[0]))*math.cos(math.radians(b[0]))*math.sin(dlon/2)**2
    return 2*R*math.asin(min(1, math.sqrt(h)))


def border_km(pt):
    return min(hav(pt, c) for c in CROSSINGS)


def when(s):
    """Their TMS writes 1980-01-01 as the null date. Never treat that as a time."""
    if not s or s.startswith('1980'):
        return None
    for f in ('%Y-%m-%d %H:%M:%S', '%Y-%m-%d'):
        try:
            return datetime.strptime(s[:19] if len(s) >= 19 else s, f)
        except (ValueError, TypeError):
            continue
    return None


# --- the orders Roadstar actually moved -------------------------------------
orders = []
for r in csv.DictReader(open('data/raw/sheets/tlorder.csv', newline='', encoding='utf-8', errors='replace')):
    o = geo(v(r, 'ORIGCITY'), v(r, 'ORIGPROV'))
    d = geo(v(r, 'DESTCITY'), v(r, 'DESTPROV'))
    t = when(v(r, 'ACTUAL_PICKUP') or v(r, 'CREATED_TIME') or '')
    if not (o and d and t):
        continue
    orders.append({
        'bill': v(r, 'BILL_NUMBER'), 'cust': v(r, 'CALLNAME'), 'o': o, 'd': d, 't': t,
        'oc': f"{v(r,'ORIGCITY')}, {v(r,'ORIGPROV')}", 'dc': f"{v(r,'DESTCITY')}, {v(r,'DESTPROV')}",
        'type': v(r, 'LOAD_TYPE'), 'wgt': num(r, 'WEIGHT_LBS'),
        'progress': border_km(o) - border_km(d),
    })
print(f'{len(orders):,} of 4,031 orders geocoded and dated ({len(orders)/4031*100:.0f}%)')

# --- the empty legs that were already heading home --------------------------
legs = []
for r in csv.DictReader(open('data/raw/sheets/dispatch.csv', newline='', encoding='utf-8', errors='replace')):
    if (v(r, 'LS_MT_LOADED') or '').upper() != 'E':
        continue
    if country_desc(v(r, 'LEGO_ZONE_DESC')) != 'US' or country_desc(v(r, 'LEGD_ZONE_DESC')) != 'US':
        continue
    o, d = geo_desc(v(r, 'LEGO_ZONE_DESC')), geo_desc(v(r, 'LEGD_ZONE_DESC'))
    # Empty repositioning legs carry no customer expected-date, so LS_EXPECTED_DATE
    # is the 1980 sentinel on every one of them. PICKUP_BY and PLAN_DEPART are full.
    t = when(v(r, 'PICKUP_BY') or v(r, 'PLAN_DEPART') or v(r, 'LS_PLANNED_DEPARTURE') or '')
    if not (o and d and t):
        continue
    if border_km(o) - border_km(d) < MIN_RETURN_PROGRESS_KM:
        continue
    legs.append({'driver': v(r, 'NAME'), 'o': o, 'd': d, 't': t, 'miles': num(r, 'LS_LEG_DIST'),
                 'oc': v(r, 'LEGO_ZONE_DESC'), 'dc': v(r, 'LEGD_ZONE_DESC')})
print(f'{len(legs)} border-bound empty US legs geocoded and dated\n')

# --- overlap ----------------------------------------------------------------
matched, examples = [], []
for leg in legs:
    hits = [o for o in orders
            if abs((o['t'] - leg['t']).total_seconds()) <= TIME_WINDOW_H*3600
            and hav(o['o'], leg['o']) <= NEAR_ORIGIN_KM
            and o['progress'] >= MIN_RETURN_PROGRESS_KM]
    if hits:
        matched.append(leg)
        best = min(hits, key=lambda o: hav(o['o'], leg['o']))
        examples.append((leg, best, len(hits)))

m_miles = sum(l['miles'] for l in matched)
print('=' * 74)
print('EMPTY TRUCKS ON LANES WHERE FREIGHT WAS ALREADY MOVING')
print('=' * 74)
print(f'  {len(matched)} of {len(legs)} border-bound empty legs ran within {NEAR_ORIGIN_KM} km and')
print(f'  {TIME_WINDOW_H}h of one of Roadstar\'s own loads that was also heading toward the border.')
print(f'\n  {m_miles:,.0f} empty miles   ${m_miles*ATRI_PER_MILE:,.0f} at ATRI 2025')
print('=' * 74)
print('\n  Same company, two trucks, one of them empty and legally able to carry.')
print('  Not lost revenue. A load assignment that could have gone the other way.\n')

print('  Examples:\n')
for leg, o, n in sorted(examples, key=lambda x: -x[0]['miles'])[:8]:
    print(f"  {leg['driver']} ran EMPTY  {leg['oc']} -> {leg['dc']}  ({leg['miles']:,.0f} mi, {leg['t']:%Y-%m-%d})")
    print(f"     while bill {o['bill']} for {o['cust'][:34]}")
    print(f"     moved       {o['oc']} -> {o['dc']}  ({o['t']:%Y-%m-%d})")
    print(f"     {n} of their own loads qualified in that window\n")
